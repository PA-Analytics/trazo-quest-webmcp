import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createRequestListener } from '../src/server/app.ts'
import { ImplementationService } from '../src/server/service.ts'
import {
  createCalibrationRepository,
  createImplementationRepository,
  createMethodologyRepository,
} from '../src/server/repository.ts'
import { MethodologyService } from '../src/server/methodologyService.ts'
import { QuestService, type CreateQuestDTO } from '../src/server/quest/questService.ts'
import { MemoryQuestRepository } from '../src/server/quest/questRepository.ts'
import { adaptQuestToMap, deriveQuestProgressStates } from '../src/adapters/questToMapAdapter.ts'
import type { Quest } from '../src/domain/quest.ts'

// Hero 4-Node Mexican Inflation Quest Payload
const HERO_QUEST_PAYLOAD: CreateQuestDTO = {
  goal: {
    rawPrompt: 'Ayúdame a analizar la inflación en México con datos reales.',
    targetOutcome: 'Análisis econométrico de la inflación en México',
  },
  missions: [
    {
      id: 'M1',
      title: 'Obtener datos de inflación',
      description: 'Descargar e inspeccionar la serie histórica del INPC desde INEGI o Banxico.',
      nodeType: 'normal',
      prerequisites: [],
      evidencePrompt: 'Pega el resumen del dataset descargado con rango de fechas y frecuencia.',
      evaluationContract: {
        type: 'rubric',
        description: 'Verificar que la serie temporal contenga el INPC mensual de México.',
        rubricCriteria: [
          {
            id: 'has_inpc_series',
            label: 'Serie INPC',
            description: 'Contiene la serie mensual del INPC con fechas válidas.',
            isRequired: true,
          },
        ],
      },
    },
    {
      id: 'M2',
      title: 'Evaluar estacionariedad',
      description: 'Aplicar la prueba de Dickey-Fuller Aumentada (ADF) a la serie de inflación.',
      nodeType: 'normal',
      prerequisites: ['M1'],
      evidencePrompt: 'Pega el estadístico ADF, p-valor y número de rezagos utilizados.',
      evaluationContract: {
        type: 'hybrid',
        description: 'Comprobar estadístico ADF y evaluar justificación econométrica.',
        deterministicRules: [
          {
            type: 'contains_all',
            failureMessage: 'Debe reportar p-value y estadístico t.',
          },
        ],
        rubricCriteria: [
          {
            id: 'adf_interpretation',
            label: 'Interpretación ADF',
            description: 'Explica si se rechaza la hipótesis nula de raíz unitaria.',
            isRequired: true,
          },
        ],
      },
    },
    {
      id: 'M3',
      title: 'Construir modelo de pronóstico básico',
      description: 'Ajustar un modelo autorregresivo simple sobre la serie estacionaria.',
      nodeType: 'normal',
      prerequisites: ['M2'],
      evidencePrompt: 'Pega la especificación del modelo y los coeficientes estimados.',
      evaluationContract: {
        type: 'rubric',
        description: 'Verificar que el modelo utilice la transformación correcta.',
        rubricCriteria: [
          {
            id: 'valid_model',
            label: 'Modelo válido',
            description: 'El modelo usa datos transformados y coeficientes coherentes.',
            isRequired: true,
          },
        ],
      },
    },
    {
      id: 'M4',
      title: 'Explicar el significado económico',
      description: 'Interpretar la persistencia inflacionaria y sus implicaciones para política monetaria.',
      nodeType: 'milestone',
      prerequisites: ['M3'],
      evidencePrompt: 'Redacta un diagnóstico económico sintetizando los hallazgos.',
      evaluationContract: {
        type: 'rubric',
        description: 'Explicar las conclusiones de política monetaria.',
        rubricCriteria: [
          {
            id: 'economic_sense',
            label: 'Sentido económico',
            description: 'Conclusiones claras alineadas con la dinámica inflacionaria observada.',
            isRequired: true,
          },
        ],
      },
    },
  ],
  edges: [
    { source: 'M1', target: 'M2' },
    { source: 'M2', target: 'M3' },
    { source: 'M3', target: 'M4' },
  ],
}

test('1. CREATE DOMAIN / SERVICE: Creates valid 4-node authoritative Quest', async () => {
  const memoryRepo = new MemoryQuestRepository()
  const questService = new QuestService(memoryRepo)

  const quest = await questService.createQuest(HERO_QUEST_PAYLOAD)

  // Verify server-owned fields
  assert.ok(quest.id.startsWith('quest_'))
  assert.equal(quest.version, 1)
  assert.ok(quest.createdAt)
  assert.ok(quest.updatedAt)
  assert.equal(quest.missions.length, 4)
  assert.equal(quest.edges.length, 3)
  assert.deepEqual(quest.entryNodeIds, ['M1'])

  // Verify initial progression
  assert.equal(quest.progress.activeMissionId, 'M1')
  assert.deepEqual(quest.progress.completedMissionIds, [])

  // Verify persistence
  const retrieved = await questService.getQuest(quest.id)
  assert.deepEqual(retrieved, quest)
})

test('2. DOMAIN VALIDATION: Rejects malformed payload, cycles, and dangling edges', async () => {
  const memoryRepo = new MemoryQuestRepository()
  const questService = new QuestService(memoryRepo)

  // Empty missions
  await assert.rejects(
    () =>
      questService.createQuest({
        goal: { rawPrompt: 'Test', targetOutcome: 'Test' },
        missions: [],
      }),
    /EMPTY_MISSIONS/
  )

  // Directed cycle (M1 -> M2 -> M1)
  await assert.rejects(
    () =>
      questService.createQuest({
        goal: { rawPrompt: 'Cycle test', targetOutcome: 'Cycle outcome' },
        missions: [
          {
            id: 'M1',
            title: 'Node 1',
            evaluationContract: {
              type: 'rubric',
              description: 'Desc',
              rubricCriteria: [{ id: 'c1', label: 'C1', description: 'D1', isRequired: true }],
            },
          },
          {
            id: 'M2',
            title: 'Node 2',
            evaluationContract: {
              type: 'rubric',
              description: 'Desc',
              rubricCriteria: [{ id: 'c2', label: 'C2', description: 'D2', isRequired: true }],
            },
          },
        ],
        edges: [
          { source: 'M1', target: 'M2' },
          { source: 'M2', target: 'M1' },
        ],
      }),
    /GRAPH_CONTAINS_CYCLE/
  )

  // Dangling edge
  await assert.rejects(
    () =>
      questService.createQuest({
        goal: { rawPrompt: 'Dangling test', targetOutcome: 'Dangling outcome' },
        missions: [
          {
            id: 'M1',
            title: 'Node 1',
            evaluationContract: {
              type: 'rubric',
              description: 'Desc',
              rubricCriteria: [{ id: 'c1', label: 'C1', description: 'D1', isRequired: true }],
            },
          },
        ],
        edges: [{ source: 'M1', target: 'M_NONEXISTENT' }],
      }),
    /DANGLING_EDGE_TARGET/
  )

})

test('3. HTTP API: POST /api/v1/quests and GET /api/v1/quests/:id', async () => {
  const memoryRepo = new MemoryQuestRepository()
  const questService = new QuestService(memoryRepo)

  const implRepo = createImplementationRepository('memory')
  const calibRepo = createCalibrationRepository('memory')
  const methRepo = createMethodologyRepository('memory')
  const methService = new MethodologyService(methRepo, calibRepo)
  const implService = new ImplementationService(implRepo, calibRepo, methService)

  const listener = createRequestListener(implService, {
    questService,
  })

  const server = createServer(listener)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 3001
  const baseUrl = `http://127.0.0.1:${port}`

  try {
    // 1. POST /api/v1/quests
    const postRes = await fetch(`${baseUrl}/api/v1/quests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(HERO_QUEST_PAYLOAD),
    })

    assert.equal(postRes.status, 201)
    const created = (await postRes.json()) as Quest
    assert.ok(created.id.startsWith('quest_'))
    assert.equal(created.version, 1)
    assert.equal(created.missions.length, 4)

    // 2. GET /api/v1/quests/:id
    const getRes = await fetch(`${baseUrl}/api/v1/quests/${created.id}`)
    assert.equal(getRes.status, 200)
    const fetched = (await getRes.json()) as Quest
    assert.equal(fetched.id, created.id)
    assert.equal(fetched.version, 1)

    // 3. GET /api/v1/quests/:id?projection=true
    const projRes = await fetch(`${baseUrl}/api/v1/quests/${created.id}?projection=true`)
    assert.equal(projRes.status, 200)
    const projection = (await projRes.json()) as {
      questId: string
      totalMissions: number
      missions: Array<{ id: string; status: string }>
    }
    assert.equal(projection.questId, created.id)
    assert.equal(projection.totalMissions, 4)
    assert.equal(projection.missions[0].status, 'active')
    assert.equal(projection.missions[1].status, 'locked')

    // 4. GET nonexistent quest returns 404
    const notFoundRes = await fetch(`${baseUrl}/api/v1/quests/nonexistent_id`)
    assert.equal(notFoundRes.status, 404)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

test('4. WEBMCP SITE TOOLS: create_quest and get_quest_state tool lifecycles', async () => {
  const registeredTools: Array<{
    name: string
    description: string
    inputSchema: Record<string, unknown>
    annotations?: { readOnlyHint?: boolean }
    execute: (input: any) => Promise<any>
  }> = []

  const mockModelContext = {
    registerTool: (def: any, options?: { signal?: AbortSignal }) => {
      registeredTools.push(def)
      if (options?.signal) {
        options.signal.addEventListener('abort', () => {
          const idx = registeredTools.indexOf(def)
          if (idx !== -1) registeredTools.splice(idx, 1)
        })
      }
    },
  }

  const memoryRepo = new MemoryQuestRepository()
  const questService = new QuestService(memoryRepo)

  let activeQuestState: Quest | null = null

  // Register create_quest
  const controller = new AbortController()
  mockModelContext.registerTool(
    {
      name: 'create_quest',
      description: 'Initializes a new authoritative quest graph.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: false },
      execute: async (payload: CreateQuestDTO) => {
        const created = await questService.createQuest(payload)
        activeQuestState = created
        return {
          ok: true,
          questId: created.id,
          version: created.version,
          totalMissions: created.missions.length,
          activeMissionId: created.progress.activeMissionId,
        }
      },
    },
    { signal: controller.signal }
  )

  // Register get_quest_state
  mockModelContext.registerTool(
    {
      name: 'get_quest_state',
      description: 'Get the current graph topology and progression status.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => {
        if (!activeQuestState) throw new Error('No active quest')
        const state = activeQuestState as Quest
        return {
          ok: true,
          questId: state.id,
          version: state.version,
          goal: state.goal,
          missions: state.missions.map((m) => ({
            id: m.id,
            title: m.title,
            status: m.id === state.progress.activeMissionId ? 'active' : 'locked',
          })),
        }
      },
    },
    { signal: controller.signal }
  )

  assert.equal(registeredTools.length, 2)
  assert.equal(registeredTools[0].name, 'create_quest')
  assert.equal(registeredTools[1].name, 'get_quest_state')
  assert.equal(registeredTools[1].annotations?.readOnlyHint, true)

  // Execute create_quest
  const createResult = await registeredTools[0].execute(HERO_QUEST_PAYLOAD)
  assert.equal(createResult.ok, true)
  assert.ok(createResult.questId.startsWith('quest_'))
  assert.equal(createResult.totalMissions, 4)
  assert.equal(createResult.activeMissionId, 'M1')

  // Execute get_quest_state
  const stateResult = await registeredTools[1].execute({})
  assert.equal(stateResult.ok, true)
  assert.equal(stateResult.questId, createResult.questId)
  assert.equal(stateResult.missions[0].status, 'active')
  assert.equal(stateResult.missions[1].status, 'locked')

  // Unregister via signal
  controller.abort()
  assert.equal(registeredTools.length, 0)
})

test('5. UI ADAPTER & PROGRESSION: adaptQuestToMap produces reactive canvas view', () => {
  const quest: Quest = {
    id: 'quest_hero_1',
    version: 1,
    goal: {
      rawPrompt: 'Analizar inflación en México',
      targetOutcome: 'Diagnóstico de inflación',
    },
    entryNodeIds: ['M1'],
    missions: [
      {
        id: 'M1',
        title: 'Obtener datos',
        description: 'Descargar INPC',
        nodeType: 'normal',
        mapRole: 'entry',
        position: { x: 180, y: 160 },
        prerequisites: [],
        evidenceType: 'text',
        evidencePrompt: 'Dataset',
        evaluationContract: { type: 'rubric', description: 'Desc' },
      },
      {
        id: 'M2',
        title: 'Evaluar ADF',
        description: 'Prueba de raíz unitaria',
        nodeType: 'normal',
        position: { x: 440, y: 160 },
        prerequisites: ['M1'],
        evidenceType: 'text',
        evidencePrompt: 'Resultados ADF',
        evaluationContract: { type: 'rubric', description: 'Desc' },
      },
    ],
    edges: [{ id: 'e1', source: 'M1', target: 'M2' }],
    proposals: [],
    progress: {
      questId: 'quest_hero_1',
      completedMissionIds: [],
      activeMissionId: 'M1',
      artifacts: {},
      updatedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // 1. Initial State
  const initialView = adaptQuestToMap(quest)
  assert.equal(initialView.course.title, 'Diagnóstico de inflación')
  assert.equal(initialView.chapter.missions.length, 2)
  assert.equal(initialView.progress['M1'], 'active')
  assert.equal(initialView.progress['M2'], 'locked')

  // 2. Progression after M1 is completed
  quest.progress.completedMissionIds = ['M1']
  quest.progress.activeMissionId = 'M2'

  const progressStates = deriveQuestProgressStates(quest)
  assert.equal(progressStates['M1'], 'completed')
  assert.equal(progressStates['M2'], 'active')

  const updatedView = adaptQuestToMap(quest)
  assert.equal(updatedView.progress['M1'], 'completed')
  assert.equal(updatedView.progress['M2'], 'active')
})
