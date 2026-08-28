import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { MemoryQuestRepository } from '../src/server/quest/questRepository.ts'
import { QuestService } from '../src/server/quest/questService.ts'
import { QuestEvaluator } from '../src/server/quest/questEvaluator.ts'
import { createRequestListener } from '../src/server/app.ts'
import type { CanonicalGeminiRuntime } from '../src/server/ai/runtime.ts'
import type { Quest } from '../src/domain/quest.ts'

function createHeroInflationQuestPayload() {
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
      {
        id: 'M4',
        title: 'Interpretación Económica',
        description: 'Explicar la persistencia inflacionaria en términos de política monetaria.',
        prerequisites: ['M3'],
        evaluationContract: {
          type: 'rubric' as const,
          description: 'Verificar análisis macroeconómico.',
          rubricCriteria: [
            {
              id: 'c_econ',
              label: 'Análisis Macroeconómico',
              description: 'Relaciona persistencia con expectativas.',
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
}

function createMockAiRuntime(shouldPass = true): CanonicalGeminiRuntime {
  return {
    model: 'mock-gemini',
    project: 'test',
    location: 'test',
    authMode: 'injected-test-client',
    async generateContent() {
      return {
        text: JSON.stringify({
          criteria: [
            {
              criterionId: 'c_adf_interpretation',
              status: shouldPass ? 'PASS' : 'NOT_MET',
              reason: shouldPass ? 'Concepto claro' : 'Falta justificación',
            },
          ],
          recommendation: shouldPass ? 'PASS' : 'REWORK',
          feedback: shouldPass ? 'Análisis aprobado.' : 'Ajustar conclusión.',
          confidence: 0.95,
        }),
      }
    },
  }
}

test('FULL HERO FLOW HARDENING: Complete E2E lifecycle with optimistic concurrency and sealed evaluation', async () => {
  const repo = new MemoryQuestRepository()
  const evaluator = new QuestEvaluator(createMockAiRuntime(true))
  const questService = new QuestService(repo, evaluator)
  const app = createRequestListener({ questService })

  const server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const port = (server.address() as AddressInfo).port
  const baseUrl = `http://localhost:${port}`

  try {
    // ─── 1. CREATE QUEST ───────────────────────────────────────────────
    const createRes = await fetch(`${baseUrl}/api/v1/quests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createHeroInflationQuestPayload()),
    })
    assert.equal(createRes.status, 201)
    const quest = (await createRes.json()) as Quest
    assert.equal(quest.version, 1)
    assert.equal(quest.missions.length, 4)
    assert.equal(quest.edges.length, 3)

    // ─── 2. GET QUEST STATE ────────────────────────────────────────────
    const getRes = await fetch(`${baseUrl}/api/v1/quests/${quest.id}?projection=true`)
    assert.equal(getRes.status, 200)
    const projection = (await getRes.json()) as any
    assert.equal(projection.totalMissions, 4)
    assert.equal(projection.completedCount, 0)
    assert.equal(projection.pendingProposalsCount, 0)

    // ─── 3. PROPOSE GHOST NODE (COLLABORATE) ───────────────────────────
    const propRes = await fetch(`${baseUrl}/api/v1/quests/${quest.id}/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedVersion: 1,
        mission: {
          id: 'M1A',
          title: 'Intuición de estacionariedad',
          description: 'Visualización conceptual antes de la prueba ADF.',
          evaluationContract: {
            type: 'rubric',
            description: 'Verificar comprensión de estacionariedad.',
            rubricCriteria: [{ id: 'c1', label: 'Intuición', description: 'Concepto claro', isRequired: true }],
          },
        },
        connectFrom: ['M1'],
        connectTo: ['M2'],
      }),
    })
    assert.equal(propRes.status, 201)
    const propBody = (await propRes.json()) as any
    assert.equal(propBody.ok, true)
    assert.equal(propBody.quest.version, 2)
    assert.equal(propBody.proposal.status, 'pending')
    // Canonical missions still 4
    assert.equal(propBody.quest.missions.length, 4)

    // ─── 4. ACCEPT GHOST PROPOSAL (HUMAN AUTHORITY) ────────────────────
    const acceptRes = await fetch(
      `${baseUrl}/api/v1/quests/${quest.id}/proposals/${propBody.proposal.id}/accept`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedVersion: 2 }),
      }
    )
    assert.equal(acceptRes.status, 200)
    const acceptBody = (await acceptRes.json()) as any
    assert.equal(acceptBody.quest.version, 3)
    assert.equal(acceptBody.quest.missions.length, 5)
    assert.ok(acceptBody.quest.missions.some((m: any) => m.id === 'M1A'))

    // ─── 5. REJECT ANOTHER PROPOSAL (CLEAN DISMISSAL) ──────────────────
    const prop2Res = await fetch(`${baseUrl}/api/v1/quests/${quest.id}/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedVersion: 3,
        mission: {
          id: 'M_EXTRA',
          title: 'Paso innecesario',
          evaluationContract: {
            type: 'rubric',
            description: 'Desc',
            rubricCriteria: [{ id: 'c', label: 'L', description: 'D', isRequired: true }],
          },
        },
        connectFrom: ['M1'],
      }),
    })
    assert.equal(prop2Res.status, 201)
    const prop2Body = (await prop2Res.json()) as any
    assert.equal(prop2Body.quest.version, 4)

    const rejectRes = await fetch(
      `${baseUrl}/api/v1/quests/${quest.id}/proposals/${prop2Body.proposal.id}/reject`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedVersion: 4 }),
      }
    )
    assert.equal(rejectRes.status, 200)
    const rejectBody = (await rejectRes.json()) as any
    assert.equal(rejectBody.quest.version, 5)
    assert.equal(rejectBody.quest.missions.length, 5)
    assert.ok(!rejectBody.quest.missions.some((m: any) => m.id === 'M_EXTRA'))

    // ─── 6. PROVE M1 (PASS DETERMINISTIC) ──────────────────────────────
    const m1SubmitRes = await fetch(`${baseUrl}/api/v1/quests/${quest.id}/missions/M1/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedVersion: 5,
        evidence: {
          text: 'Descargada serie INPC desde INEGI.',
          data: { seriesName: 'INPC', sampleSize: 120 },
        },
      }),
    })
    assert.equal(m1SubmitRes.status, 200)
    const m1SubmitBody = (await m1SubmitRes.json()) as any
    assert.equal(m1SubmitBody.verdict, 'PASS')
    assert.equal(m1SubmitBody.quest.version, 6)
    assert.ok(m1SubmitBody.quest.progress.completedMissionIds.includes('M1'))

    // ─── 7. PROVE M2 (REWORK INCONSISTENT CONCLUSION) ──────────────────
    const m2ReworkRes = await fetch(`${baseUrl}/api/v1/quests/${quest.id}/missions/M2/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedVersion: 6,
        evidence: {
          text: 'p-value es 0.14 (> 0.05), por tanto rechazo la hipótesis nula.',
          data: { pValue: 0.14, alpha: 0.05, conclusion: 'reject_unit_root' }, // Inconsistent!
        },
      }),
    })
    assert.equal(m2ReworkRes.status, 200)
    const m2ReworkBody = (await m2ReworkRes.json()) as any
    assert.equal(m2ReworkBody.verdict, 'REWORK')
    assert.equal(m2ReworkBody.unlockedMissionIds.length, 0)
    assert.ok(!m2ReworkBody.quest.progress.completedMissionIds.includes('M2'))
    assert.equal(m2ReworkBody.quest.version, 7)

    // ─── 8. PROVE M2 (PASS CORRECTED EVIDENCE) ─────────────────────────
    const m2PassRes = await fetch(`${baseUrl}/api/v1/quests/${quest.id}/missions/M2/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedVersion: 7,
        evidence: {
          text: 'p-value es 0.14 (> 0.05), por lo tanto no se rechaza la nula de raíz unitaria.',
          data: { pValue: 0.14, alpha: 0.05, conclusion: 'fail_to_reject_unit_root' },
        },
      }),
    })
    assert.equal(m2PassRes.status, 200)
    const m2PassBody = (await m2PassRes.json()) as any
    assert.equal(m2PassBody.verdict, 'PASS')
    assert.ok(m2PassBody.quest.progress.completedMissionIds.includes('M2'))
    assert.ok(m2PassBody.unlockedMissionIds.includes('M3'))
    assert.equal(m2PassBody.quest.version, 8)

    assert.ok(m2PassBody.quest.progress.artifacts['adf_result'])

    // ─── 9. CONCURRENCY: STALE WRITE REJECTION ─────────────────────────
    const staleRes = await fetch(`${baseUrl}/api/v1/quests/${quest.id}/missions/M3/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedVersion: 6, // Current version is 8
        evidence: { text: 'Some work' },
      }),
    })
    assert.equal(staleRes.status, 409)
    const staleBody = (await staleRes.json()) as any
    assert.equal(staleBody.code, 'STALE_QUEST_VERSION')
    assert.equal(staleBody.currentVersion, 8)
  } finally {
    server.close()
  }
})
