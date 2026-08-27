import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { MemoryQuestRepository } from '../src/server/quest/questRepository.ts'
import { QuestService } from '../src/server/quest/questService.ts'
import { createRequestListener } from '../src/server/app.ts'
import { adaptQuestToMap } from '../src/adapters/questToMapAdapter.ts'
import type { Quest } from '../src/domain/quest.ts'

function createSampleQuestPayload() {
  return {
    goal: {
      rawPrompt: 'Ayúdame a analizar la inflación en México.',
      targetOutcome: 'Análisis econométrico de la inflación en México',
    },
    missions: [
      {
        id: 'M1',
        title: 'Obtener datos de inflación',
        description: 'Descargar serie del INPC.',
        prerequisites: [],
        evaluationContract: {
          type: 'rubric' as const,
          description: 'Verificar serie INPC mensual válida.',
          rubricCriteria: [{ id: 'c1', label: 'Dataset', description: 'Datos válidos', isRequired: true }],
        },
      },
      {
        id: 'M2',
        title: 'Evaluar estacionariedad',
        description: 'Aplicar prueba ADF.',
        prerequisites: ['M1'],
        evaluationContract: {
          type: 'rubric' as const,
          description: 'Verificar prueba ADF.',
          rubricCriteria: [{ id: 'c2', label: 'ADF', description: 'ADF ejecutado', isRequired: true }],
        },
      },
    ],
    edges: [{ source: 'M1', target: 'M2' }],
  }
}

test('1. DOMAIN / SERVICE: Propose quest change creates pending proposal without altering canonical topology', async () => {
  const repo = new MemoryQuestRepository()
  const questService = new QuestService(repo)

  const quest = await questService.createQuest(createSampleQuestPayload())
  assert.equal(quest.version, 1)
  assert.equal(quest.missions.length, 2)
  assert.equal(quest.edges.length, 1)
  assert.equal(quest.proposals.length, 0)

  // External agent proposes M1A: Review stationarity intuition
  const result = await questService.proposeQuestChange(quest.id, {
    expectedVersion: 1,
    mission: {
      id: 'M1A',
      title: 'Comprender intuición de estacionariedad',
      description: 'Explicación visual de media y varianza constante.',
      evaluationContract: {
        type: 'rubric',
        description: 'Verificar comprensión conceptual.',
        rubricCriteria: [{ id: 'c_prop', label: 'Intuición', description: 'Concepto claro', isRequired: true }],
      },
    },
    connectFrom: ['M1'],
    connectTo: ['M2'],
  })

  // Version incremented to 2
  assert.equal(result.quest.version, 2)
  // Canonical missions and edges are UNTOUCHED!
  assert.equal(result.quest.missions.length, 2)
  assert.equal(result.quest.edges.length, 1)
  // Proposal is pending
  assert.equal(result.quest.proposals.length, 1)
  assert.equal(result.proposal.status, 'pending')
  assert.equal(result.proposal.mission.id, 'M1A')
  assert.deepEqual(result.proposal.connectFrom, ['M1'])
  assert.deepEqual(result.proposal.connectTo, ['M2'])
})

test('2. DOMAIN / SERVICE: Proposal validation rejects invalid contracts, cycles, dangling edges, and stale versions', async () => {
  const repo = new MemoryQuestRepository()
  const questService = new QuestService(repo)
  const quest = await questService.createQuest(createSampleQuestPayload())

  // Dangling connectFrom source
  await assert.rejects(
    () =>
      questService.proposeQuestChange(quest.id, {
        expectedVersion: 1,
        mission: {
          id: 'M_DANGLE',
          title: 'Dangling',
          evaluationContract: {
            type: 'rubric',
            description: 'Desc',
            rubricCriteria: [{ id: 'c', label: 'L', description: 'D', isRequired: true }],
          },
        },
        connectFrom: ['NON_EXISTENT_MISSION'],
      }),
    /DANGLING_EDGE_SOURCE/
  )

  // Dangling connectTo target
  await assert.rejects(
    () =>
      questService.proposeQuestChange(quest.id, {
        expectedVersion: 1,
        mission: {
          id: 'M_DANGLE2',
          title: 'Dangling target',
          evaluationContract: {
            type: 'rubric',
            description: 'Desc',
            rubricCriteria: [{ id: 'c', label: 'L', description: 'D', isRequired: true }],
          },
        },
        connectFrom: ['M1'],
        connectTo: ['NON_EXISTENT_TARGET'],
      }),
    /DANGLING_EDGE_TARGET/
  )

  // Cycle creation (e.g. M2 -> M_CYC -> M1)
  await assert.rejects(
    () =>
      questService.proposeQuestChange(quest.id, {
        expectedVersion: 1,
        mission: {
          id: 'M_CYC',
          title: 'Cycle node',
          evaluationContract: {
            type: 'rubric',
            description: 'Desc',
            rubricCriteria: [{ id: 'c', label: 'L', description: 'D', isRequired: true }],
          },
        },
        connectFrom: ['M2'],
        connectTo: ['M1'],
      }),
    /GRAPH_CONTAINS_CYCLE/
  )

  // Stale expectedVersion
  await assert.rejects(
    () =>
      questService.proposeQuestChange(quest.id, {
        expectedVersion: 999, // Stale version
        mission: {
          id: 'M_STALE',
          title: 'Stale test',
          evaluationContract: {
            type: 'rubric',
            description: 'Desc',
            rubricCriteria: [{ id: 'c', label: 'L', description: 'D', isRequired: true }],
          },
        },
        connectFrom: ['M1'],
      }),
    /StaleQuestVersionError/
  )

})

test('3. HUMAN ACCEPT: Accepting proposal mutates canonical graph, updates prerequisites, and increments version atomically', async () => {
  const repo = new MemoryQuestRepository()
  const questService = new QuestService(repo)
  const quest = await questService.createQuest(createSampleQuestPayload())

  const { quest: v2Quest, proposal } = await questService.proposeQuestChange(quest.id, {
    expectedVersion: 1,
    mission: {
      id: 'M1A',
      title: 'Comprender intuición de estacionariedad',
      description: 'Explicación visual.',
      evaluationContract: {
        type: 'rubric',
        description: 'Verificar comprensión.',
        rubricCriteria: [{ id: 'c_prop', label: 'Intuición', description: 'Concepto claro', isRequired: true }],
      },
    },
    connectFrom: ['M1'],
    connectTo: ['M2'],
  })

  assert.equal(v2Quest.version, 2)
  assert.equal(v2Quest.missions.length, 2)

  // Human clicks ACCEPT
  const acceptedQuest = await questService.acceptProposal(quest.id, proposal.id, 2)

  // Version incremented to 3
  assert.equal(acceptedQuest.version, 3)
  // Canonical missions now has 3 missions
  assert.equal(acceptedQuest.missions.length, 3)
  assert.ok(acceptedQuest.missions.some((m) => m.id === 'M1A'))
  // Canonical edges includes M1 -> M1A and M1A -> M2
  assert.ok(acceptedQuest.edges.some((e) => e.source === 'M1' && e.target === 'M1A'))
  assert.ok(acceptedQuest.edges.some((e) => e.source === 'M1A' && e.target === 'M2'))
  // M2 prerequisites updated to include M1A
  const m2 = acceptedQuest.missions.find((m) => m.id === 'M2')
  assert.ok(m2?.prerequisites.includes('M1A'))
  // Proposal marked accepted
  const propRecord = acceptedQuest.proposals.find((p) => p.id === proposal.id)
  assert.equal(propRecord?.status, 'accepted')
  assert.ok(propRecord?.decidedAt)

  // Cannot accept again
  await assert.rejects(
    () => questService.acceptProposal(quest.id, proposal.id, 3),
    /PROPOSAL_ALREADY_DECIDED/
  )
})

test('4. HUMAN REJECT: Rejecting proposal leaves canonical graph unchanged and increments version', async () => {
  const repo = new MemoryQuestRepository()
  const questService = new QuestService(repo)
  const quest = await questService.createQuest(createSampleQuestPayload())

  const { quest: v2Quest, proposal } = await questService.proposeQuestChange(quest.id, {
    expectedVersion: 1,
    mission: {
      id: 'M1A',
      title: 'Comprender intuición de estacionariedad',
      description: 'Explicación visual.',
      evaluationContract: {
        type: 'rubric',
        description: 'Verificar comprensión.',
        rubricCriteria: [{ id: 'c_prop', label: 'Intuición', description: 'Concepto claro', isRequired: true }],
      },
    },
    connectFrom: ['M1'],
    connectTo: ['M2'],
  })

  // Human clicks REJECT
  const rejectedQuest = await questService.rejectProposal(quest.id, proposal.id, 2)

  // Version incremented to 3
  assert.equal(rejectedQuest.version, 3)
  // Canonical missions and edges remain 2 and 1
  assert.equal(rejectedQuest.missions.length, 2)
  assert.equal(rejectedQuest.edges.length, 1)
  assert.ok(!rejectedQuest.missions.some((m) => m.id === 'M1A'))
  // Proposal marked rejected
  const propRecord = rejectedQuest.proposals.find((p) => p.id === proposal.id)
  assert.equal(propRecord?.status, 'rejected')
  assert.ok(propRecord?.decidedAt)
})

test('5. HTTP API: POST /proposals, POST /accept, POST /reject endpoints with optimistic concurrency', async () => {
  const repo = new MemoryQuestRepository()
  const questService = new QuestService(repo)
  const app = createRequestListener({ questService })

  const server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const port = (server.address() as AddressInfo).port
  const baseUrl = `http://localhost:${port}`

  try {
    // 1. Create quest
    const createRes = await fetch(`${baseUrl}/api/v1/quests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createSampleQuestPayload()),
    })
    assert.equal(createRes.status, 201)
    const initialQuest = (await createRes.json()) as Quest
    assert.equal(initialQuest.version, 1)

    // 2. Propose change via HTTP
    const proposeRes = await fetch(`${baseUrl}/api/v1/quests/${initialQuest.id}/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedVersion: 1,
        mission: {
          id: 'M1A',
          title: 'Intuición de estacionariedad',
          description: 'Visualización conceptual.',
          evaluationContract: {
            type: 'rubric',
            description: 'Verificar intuición.',
            rubricCriteria: [{ id: 'c1', label: 'C1', description: 'D1', isRequired: true }],
          },
        },
        connectFrom: ['M1'],
        connectTo: ['M2'],
      }),
    })
    assert.equal(proposeRes.status, 201)
    const proposeBody = (await proposeRes.json()) as any
    assert.equal(proposeBody.ok, true)
    assert.equal(proposeBody.quest.version, 2)
    assert.equal(proposeBody.proposal.status, 'pending')
    assert.equal(proposeBody.message, 'Proposal is visible in TRAZO and awaits human approval.')

    // 3. Stale proposal rejection (expectedVersion: 1 when current is 2)
    const staleRes = await fetch(`${baseUrl}/api/v1/quests/${initialQuest.id}/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedVersion: 1, // STALE!
        mission: {
          id: 'M1B',
          title: 'Another step',
          evaluationContract: {
            type: 'rubric',
            description: 'Desc',
            rubricCriteria: [{ id: 'c1', label: 'C1', description: 'D1', isRequired: true }],
          },
        },
        connectFrom: ['M1'],
      }),
    })
    assert.equal(staleRes.status, 409)
    const staleBody = (await staleRes.json()) as any
    assert.equal(staleBody.ok, false)
    assert.equal(staleBody.code, 'STALE_QUEST_VERSION')
    assert.equal(staleBody.currentVersion, 2)

    // 4. Accept proposal via HTTP
    const acceptRes = await fetch(
      `${baseUrl}/api/v1/quests/${initialQuest.id}/proposals/${proposeBody.proposal.id}/accept`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedVersion: 2 }),
      }
    )
    assert.equal(acceptRes.status, 200)
    const acceptBody = (await acceptRes.json()) as any
    assert.equal(acceptBody.ok, true)
    assert.equal(acceptBody.quest.version, 3)
    assert.equal(acceptBody.quest.missions.length, 3)

    // 5. Adapt to UI: QuestMapViewModel reflects canonical and pending state
    const viewModel = adaptQuestToMap(acceptBody.quest)
    assert.equal(viewModel.chapter.missions.length, 3)
    assert.equal(viewModel.pendingProposals.length, 0)
  } finally {
    server.close()
  }
})
