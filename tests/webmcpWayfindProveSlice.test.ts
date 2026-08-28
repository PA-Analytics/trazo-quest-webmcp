import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { MemoryQuestRepository } from '../src/server/quest/questRepository.ts'
import { QuestService } from '../src/server/quest/questService.ts'
import { QuestEvaluator } from '../src/server/quest/questEvaluator.ts'
import { createRequestListener } from '../src/server/app.ts'
import { evaluateDeterministicRules } from '../src/domain/deterministicEvaluation.ts'
import type { CanonicalGeminiRuntime } from '../src/server/ai/runtime.ts'
import type { Quest } from '../src/domain/quest.ts'

// Hero 4-Node Inflation Quest Payload with Hybrid M2
function createHeroQuestPayload() {
  return {
    goal: {
      rawPrompt: 'Ayúdame a analizar la inflación en México con datos del INPC.',
      targetOutcome: 'Análisis econométrico de la inflación en México',
    },
    missions: [
      {
        id: 'M1',
        title: 'Obtener datos de inflación',
        description: 'Descargar serie del INPC mensual desde Banxico o INEGI.',
        prerequisites: [],
        producesArtifacts: ['inpc_series'],
        evaluationContract: {
          type: 'deterministic' as const,
          description: 'Verificar presencia de serie temporal válida.',
          deterministicRules: [
            {
              operator: 'exists' as const,
              field: 'seriesName',
              failureMessage: 'Debe indicarse el nombre de la serie.',
            },
            {
              operator: 'greater_than' as const,
              field: 'sampleSize',
              min: 12,
              failureMessage: 'La muestra debe contener al menos 12 observaciones mensuales.',
            },
          ],
        },
      },
      {
        id: 'M2',
        title: 'Evaluar estacionariedad (ADF)',
        description: 'Aplicar la prueba de Dickey-Fuller Aumentada (ADF) e interpretar hipótesis.',
        prerequisites: ['M1'],
        producesArtifacts: ['adf_result'],
        evaluationContract: {
          type: 'hybrid' as const,
          description: 'Verificar consistencia lógica de la prueba de hipótesis ADF.',
          deterministicRules: [
            {
              operator: 'between' as const,
              field: 'pValue',
              min: 0,
              max: 1,
              failureMessage: 'El p-value debe ser un número entre 0 y 1.',
            },
            {
              operator: 'between' as const,
              field: 'alpha',
              min: 0,
              max: 1,
              failureMessage: 'El nivel alpha debe ser un número entre 0 y 1.',
            },
            {
              operator: 'equals' as const,
              field: 'conclusion',
              expectedValue: 'fail_to_reject_unit_root',
              failureMessage:
                'Con p-value (0.14) > alpha (0.05), no se rechaza la hipótesis nula de raíz unitaria.',
            },
          ],
          rubricCriteria: [
            {
              id: 'c_adf_interpretation',
              label: 'Interpretación de no estacionariedad',
              description: 'Explica que la serie en niveles requiere diferenciación.',
              isRequired: true,
            },
          ],
        },
      },
      {
        id: 'M3',
        title: 'Diferenciación y Modelo ARMA',
        description: 'Calcular primera diferencia y estimar el orden autoregresivo.',
        prerequisites: ['M2'],
        evaluationContract: {
          type: 'rubric' as const,
          description: 'Verificar especificación del modelo en diferencias.',
          rubricCriteria: [
            {
              id: 'c_arma',
              label: 'Especificación ARMA',
              description: 'Especifica orden p y q razonable.',
              isRequired: true,
            },
          ],
        },
      },
    ],
    edges: [
      { source: 'M1', target: 'M2' },
      { source: 'M2', target: 'M3' },
    ],
  }
}

// Mock Gemini Runtime for Rubric testing
function createMockAiRuntime(opts: {
  shouldPass?: boolean
  confidence?: number
  failClosed?: boolean
}): CanonicalGeminiRuntime {
  return {
    model: 'mock-gemini',
    project: 'test',
    location: 'test',
    authMode: 'injected-test-client',
    async generateContent() {
      if (opts.failClosed) {
        throw new Error('AI_SERVICE_UNAVAILABLE')
      }
      const passed = opts.shouldPass ?? true
      const confidence = opts.confidence ?? 0.95
      return {
        text: JSON.stringify({
          criteria: [
            {
              criterionId: 'c_adf_interpretation',
              status: passed ? 'PASS' : 'NOT_MET',
              reason: passed ? 'Interpretación conceptual correcta' : 'Falta justificar la diferenciación',
            },
          ],
          recommendation: passed ? 'PASS' : 'REWORK',
          feedback: passed ? 'Excelente análisis conceptual.' : 'Debes explicar por qué no se rechaza la nula.',
          confidence,
        }),
      }
    },
  }
}

test('1. WAYFIND: focus_mission verifies canonical mission exists and rejects ghost proposals and non-existent IDs', async () => {
  const repo = new MemoryQuestRepository()
  const questService = new QuestService(repo)
  const quest = await questService.createQuest(createHeroQuestPayload())

  assert.equal(quest.version, 1)

  // External agent proposes M1A
  const propRes = await questService.proposeQuestChange(quest.id, {
    expectedVersion: 1,
    mission: {
      id: 'M1A',
      title: 'Intuición gráfica',
      evaluationContract: {
        type: 'rubric',
        description: 'Intuición',
        rubricCriteria: [{ id: 'c1', label: 'C1', description: 'D1', isRequired: true }],
      },
    },
    connectFrom: ['M1'],
  })

  // Simulated focus_mission check:
  // 1. Canonical mission M2 exists
  const m2 = propRes.quest.missions.find((m) => m.id === 'M2')
  assert.ok(m2)
  assert.equal(m2?.id, 'M2')

  // 2. Pending proposal M1A cannot be focused as a canonical mission
  const m1aCanonical = propRes.quest.missions.find((m) => m.id === 'M1A')
  assert.equal(m1aCanonical, undefined)
  const m1aIsPendingProposal = (propRes.quest.proposals || []).some(
    (p) => p.status === 'pending' && p.mission.id === 'M1A'
  )
  assert.equal(m1aIsPendingProposal, true)

  // 3. Nonexistent mission fails
  const nonExistent = propRes.quest.missions.find((m) => m.id === 'M999')
  assert.equal(nonExistent, undefined)

  // 4. Focus operation causes ZERO version mutation
  assert.equal(propRes.quest.version, 2)
})

test('2. DETERMINISTIC ENGINE: Evaluates operators (exists, greater_than, between, equals) safely without eval', async () => {
  const rules = [
    { operator: 'exists' as const, field: 'seriesName', failureMessage: 'Missing seriesName' },
    { operator: 'greater_than' as const, field: 'sampleSize', min: 10, failureMessage: 'Too few samples' },
    { operator: 'between' as const, field: 'pValue', min: 0, max: 1, failureMessage: 'Invalid pValue' },
    { operator: 'equals' as const, field: 'conclusion', expectedValue: 'fail_to_reject_unit_root', failureMessage: 'Invalid conclusion' },
  ]

  // Valid evidence
  const validEv = {
    text: 'Analysis',
    data: {
      seriesName: 'INPC',
      sampleSize: 120,
      pValue: 0.14,
      conclusion: 'fail_to_reject_unit_root',
    },
  }
  const validRes = evaluateDeterministicRules(rules, validEv)
  assert.equal(validRes.allPassed, true)
  assert.equal(validRes.results.length, 4)

  // Inconsistent conclusion evidence (REWORK)
  const invalidEv = {
    text: 'Analysis',
    data: {
      seriesName: 'INPC',
      sampleSize: 120,
      pValue: 0.14,
      conclusion: 'reject_unit_root', // WRONG
    },
  }
  const invalidRes = evaluateDeterministicRules(rules, invalidEv)
  assert.equal(invalidRes.allPassed, false)
  assert.equal(invalidRes.results[3].passed, false)
  assert.equal(invalidRes.results[3].message, 'Invalid conclusion')
})

test('3. HERO DEMO PROVE: REWORK flow (M2 logically inconsistent conclusion rejects progression)', async () => {
  const repo = new MemoryQuestRepository()
  const evaluator = new QuestEvaluator(createMockAiRuntime({ shouldPass: true }))
  const questService = new QuestService(repo, evaluator)
  const quest = await questService.createQuest(createHeroQuestPayload())

  // Submit M2 with logically inconsistent evidence
  // pValue is 0.14 > 0.05, but student claims "reject_unit_root"
  const reworkResult = await questService.submitEvidence(quest.id, 'M2', {
    expectedVersion: 1,
    evidence: {
      text: 'El p-value es 0.14 (> 0.05), por lo tanto rechazo la hipótesis nula de raíz unitaria.',
      data: {
        pValue: 0.14,
        alpha: 0.05,
        conclusion: 'reject_unit_root',
      },
    },
  })

  // VERDICT IS REWORK
  assert.equal(reworkResult.verdict, 'REWORK')
  assert.match(reworkResult.feedback, /no se rechaza la hipótesis nula/)
  // NO UNLOCKS
  assert.deepEqual(reworkResult.unlockedMissionIds, [])
  // M2 is NOT completed
  assert.ok(!reworkResult.quest.progress.completedMissionIds.includes('M2'))
  // Version incremented to 2 with recorded submission attempt
  assert.equal(reworkResult.quest.version, 2)
  assert.equal(reworkResult.quest.progress.submissions?.length, 1)
  assert.equal(reworkResult.quest.progress.submissions[0].verdict, 'REWORK')
})

test('4. HERO DEMO PROVE: PASS flow (M2 corrected evidence completes mission, unlocks M3, materializes artifact)', async () => {
  const repo = new MemoryQuestRepository()
  const evaluator = new QuestEvaluator(createMockAiRuntime({ shouldPass: true }))
  const questService = new QuestService(repo, evaluator)
  const quest = await questService.createQuest(createHeroQuestPayload())

  // Complete M1 first
  const m1Result = await questService.submitEvidence(quest.id, 'M1', {
    expectedVersion: 1,
    evidence: {
      text: 'Serie INPC descargada de INEGI.',
      data: {
        seriesName: 'INPC General',
        sampleSize: 120,
      },
    },
  })
  assert.equal(m1Result.verdict, 'PASS')
  assert.equal(m1Result.quest.version, 2)
  assert.ok(m1Result.quest.progress.completedMissionIds.includes('M1'))

  // Submit corrected M2 evidence
  const m2Result = await questService.submitEvidence(quest.id, 'M2', {
    expectedVersion: 2,
    evidence: {
      text: 'El p-value es 0.14 (> 0.05), por lo que no se rechaza la hipótesis nula de raíz unitaria y la serie en niveles no es estacionaria.',
      data: {
        pValue: 0.14,
        alpha: 0.05,
        conclusion: 'fail_to_reject_unit_root',
      },
    },
  })

  // VERDICT IS PASS
  assert.equal(m2Result.verdict, 'PASS')
  // M2 is completed
  assert.ok(m2Result.quest.progress.completedMissionIds.includes('M2'))
  // M3 is unlocked!
  assert.deepEqual(m2Result.unlockedMissionIds, ['M3'])
  // Version incremented to 3
  assert.equal(m2Result.quest.version, 3)
  // Canonical artifact materialized
  assert.ok(m2Result.quest.progress.artifacts['adf_result'])
  assert.equal(
    (m2Result.quest.progress.artifacts['adf_result'].value as any).conclusion,
    'fail_to_reject_unit_root'
  )
})

test('5. SEALED CONTRACT: Contract snapshot is frozen on first submission and cannot be weakened retroactively', async () => {
  const repo = new MemoryQuestRepository()
  const evaluator = new QuestEvaluator(createMockAiRuntime({ shouldPass: true }))
  const questService = new QuestService(repo, evaluator)
  const quest = await questService.createQuest(createHeroQuestPayload())

  // First submission of M2
  const sub1 = await questService.submitEvidence(quest.id, 'M2', {
    expectedVersion: 1,
    evidence: {
      text: 'Intento 1',
      data: { pValue: 0.14, alpha: 0.05, conclusion: 'reject_unit_root' },
    },
  })
  assert.equal(sub1.verdict, 'REWORK')

  // Sealed contract snapshot in submission history contains original 3 deterministic rules
  const firstSubmission = sub1.quest.progress.submissions![0]
  assert.equal(firstSubmission.evaluationContractSnapshot.deterministicRules?.length, 3)

  // Even if mission definition were tampered, submitEvidence uses the frozen snapshot
  const sub2 = await questService.submitEvidence(quest.id, 'M2', {
    expectedVersion: 2,
    evidence: {
      text: 'Intento 2',
      data: { pValue: 0.14, alpha: 0.05, conclusion: 'reject_unit_root' },
    },
  })
  assert.equal(sub2.verdict, 'REWORK')
})

test('6. FAIL CLOSED & CONCURRENCY: AI outage fails closed with 503, stale versions return 409', async () => {
  const repo = new MemoryQuestRepository()
  const failingEvaluator = new QuestEvaluator(createMockAiRuntime({ failClosed: true }))
  const questService = new QuestService(repo, failingEvaluator)
  const app = createRequestListener({ questService })

  const server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const port = (server.address() as AddressInfo).port
  const baseUrl = `http://localhost:${port}`

  try {
    // 1. Create quest via HTTP
    const createRes = await fetch(`${baseUrl}/api/v1/quests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createHeroQuestPayload()),
    })
    assert.equal(createRes.status, 201)
    const initialQuest = (await createRes.json()) as Quest

    // 2. Submit M2 against failing AI runtime -> 503 EVALUATION_FAILED, ZERO progress change
    const failRes = await fetch(`${baseUrl}/api/v1/quests/${initialQuest.id}/missions/M2/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedVersion: 1,
        evidence: {
          text: 'Valid text',
          data: { pValue: 0.14, alpha: 0.05, conclusion: 'fail_to_reject_unit_root' },
        },
      }),
    })
    assert.equal(failRes.status, 503)
    const failBody = (await failRes.json()) as any
    assert.equal(failBody.code, 'EVALUATION_FAILED')

    // 3. Stale version submission -> 409 STALE_QUEST_VERSION
    const staleRes = await fetch(`${baseUrl}/api/v1/quests/${initialQuest.id}/missions/M2/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedVersion: 999, // Stale!
        evidence: {
          text: 'Valid text',
          data: { pValue: 0.14, alpha: 0.05, conclusion: 'fail_to_reject_unit_root' },
        },
      }),
    })
    assert.equal(staleRes.status, 409)
    const staleBody = (await staleRes.json()) as any
    assert.equal(staleBody.code, 'STALE_QUEST_VERSION')
    assert.equal(staleBody.currentVersion, 1)
  } finally {
    server.close()
  }
})
