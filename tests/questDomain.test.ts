import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { EvaluationContract, Quest, QuestProposal } from '../src/domain/quest.ts'
import {
  QuestValidationError,
  validateEvaluationContract,
  validateQuest,
  validateQuestTopology,
} from '../src/domain/questValidation.ts'
import {
  MemoryQuestRepository,
  StaleQuestVersionError,
} from '../src/server/quest/questRepository.ts'

function createSampleQuest(overrides?: Partial<Quest>): Quest {
  return {
    id: 'quest_mexican_inflation',
    version: 1,
    goal: {
      rawPrompt: 'Analizar la inflación en México con datos del INEGI',
      targetOutcome: 'Pipeline validado de pronóstico de inflación con prueba de estacionariedad',
    },
    entryNodeIds: ['M01'],
    missions: [
      {
        id: 'M01',
        title: 'Obtener datos de inflación',
        description: 'Descargar e inspeccionar la serie histórica del INPC.',
        nodeType: 'normal',
        mapRole: 'entry',
        position: { x: 100, y: 150 },
        prerequisites: [],
        evidenceType: 'text',
        evidencePrompt: 'Pega el resumen del dataset descargado.',
        evaluationContract: {
          type: 'deterministic',
          description: 'Verifica presencia de columnas de tiempo e índice.',
          deterministicRules: [
            {
              type: 'contains',
              pattern: 'INPC',
              failureMessage: 'Debe contener referencias a INPC.',
            },
          ],
        },
      },
      {
        id: 'M02',
        title: 'Evaluar estacionariedad',
        description: 'Aplicar prueba ADF a la serie del INPC.',
        nodeType: 'normal',
        position: { x: 350, y: 150 },
        prerequisites: ['M01'],
        evidenceType: 'text',
        evidencePrompt: 'Reporta el estadístico ADF y p-valor.',
        evaluationContract: {
          type: 'hybrid',
          description: 'Verifica test estadístico y razonamiento de raíz unitaria.',
          deterministicRules: [
            {
              type: 'contains',
              pattern: 'ADF',
              failureMessage: 'Debe incluir salida de prueba ADF.',
            },
          ],

          rubricCriteria: [
            {
              id: 'c1_adf_interpretation',
              label: 'Interpretación de no estacionariedad',
              description: 'Concluye correctamente si la serie en niveles tiene raíz unitaria.',
              isRequired: true,
            },
          ],
        },
      },
      {
        id: 'M03',
        title: 'Diagnóstico económico',
        description: 'Explicar implicaciones macroeconómicas.',
        nodeType: 'milestone',
        mapRole: 'convergence',
        position: { x: 600, y: 150 },
        prerequisites: ['M02'],
        evidenceType: 'text',
        evidencePrompt: 'Pega tu conclusión breve.',
        evaluationContract: {
          type: 'rubric',
          description: 'Evalúa coherencia macroeconómica.',
          rubricCriteria: [
            {
              id: 'c1_macro_coherence',
              label: 'Coherencia teórica',
              description: 'Explica las presiones inflacionarias observadas.',
              isRequired: true,
            },
          ],
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'M01', target: 'M02' },
      { id: 'e2', source: 'M02', target: 'M03' },
    ],
    proposals: [],
    progress: {
      questId: 'quest_mexican_inflation',
      completedMissionIds: [],
      activeMissionId: 'M01',
      artifacts: {},
      updatedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ─── 1. VALID DAG ────────────────────────────────────────────────────────────
test('DOMAIN: Valid dynamic DAG is accepted without errors', () => {
  const quest = createSampleQuest()
  assert.doesNotThrow(() => validateQuest(quest))
})

// ─── 2. CYCLE REJECTION ──────────────────────────────────────────────────────
test('DOMAIN: Graph containing directed cycle is rejected', () => {
  const quest = createSampleQuest({
    edges: [
      { id: 'e1', source: 'M01', target: 'M02' },
      { id: 'e2', source: 'M02', target: 'M03' },
      { id: 'e3_cycle', source: 'M03', target: 'M01' },
    ],
  })

  assert.throws(
    () => validateQuest(quest),
    (err: Error) => {
      assert.ok(err instanceof QuestValidationError)
      assert.equal(err.code, 'GRAPH_CONTAINS_CYCLE')
      return true
    }
  )
})

// ─── 3. DANGLING EDGE REJECTION ──────────────────────────────────────────────
test('DOMAIN: Dangling edge pointing to nonexistent target is rejected', () => {
  const quest = createSampleQuest({
    edges: [
      { id: 'e1', source: 'M01', target: 'M02' },
      { id: 'e2_dangling', source: 'M02', target: 'M99_NONEXISTENT' },
    ],
  })

  assert.throws(
    () => validateQuest(quest),
    (err: Error) => {
      assert.ok(err instanceof QuestValidationError)
      assert.equal(err.code, 'DANGLING_EDGE_TARGET')
      return true
    }
  )
})

// ─── 4. DUPLICATE MISSION REJECTION ──────────────────────────────────────────
test('DOMAIN: Duplicate mission ID is rejected', () => {
  const quest = createSampleQuest()
  quest.missions.push({ ...quest.missions[0] }) // duplicate M01

  assert.throws(
    () => validateQuest(quest),
    (err: Error) => {
      assert.ok(err instanceof QuestValidationError)
      assert.equal(err.code, 'DUPLICATE_MISSION_ID')
      return true
    }
  )
})

// ─── 5. EVALUATION CONTRACT VALIDATION ───────────────────────────────────────
test('DOMAIN: Mission without valid EvaluationContract is rejected', () => {
  assert.throws(
    () => validateEvaluationContract(null as any, 'M01'),
    (err: Error) => {
      assert.ok(err instanceof QuestValidationError)
      assert.equal(err.code, 'INVALID_CONTRACT')
      return true
    }
  )

  assert.throws(
    () =>
      validateEvaluationContract(
        { type: 'deterministic', description: 'desc', deterministicRules: [] },
        'M01'
      ),
    (err: Error) => {
      assert.ok(err instanceof QuestValidationError)
      assert.equal(err.code, 'MISSING_DETERMINISTIC_RULES')
      return true
    }
  )

  assert.throws(
    () =>
      validateEvaluationContract(
        { type: 'rubric', description: 'desc', rubricCriteria: [] },
        'M01'
      ),
    (err: Error) => {
      assert.ok(err instanceof QuestValidationError)
      assert.equal(err.code, 'MISSING_RUBRIC_CRITERIA')
      return true
    }
  )
})

// ─── 6. OPTIMISTIC CONCURRENCY: STALE VERSION REJECTED ──────────────────────
test('CONCURRENCY: Stale expectedVersion is rejected with STALE_QUEST_VERSION', async () => {
  const repo = new MemoryQuestRepository()
  const quest = createSampleQuest()
  await repo.createQuest(quest) // version = 1

  await assert.rejects(
    async () => {
      await repo.updateQuest(quest.id, 0, (draft) => {
        draft.goal.targetOutcome = 'Stale mutation attempt'
        return draft
      })
    },
    (err: Error) => {
      assert.ok(err instanceof StaleQuestVersionError)
      assert.equal(err.code, 'STALE_QUEST_VERSION')
      assert.equal(err.expectedVersion, 0)
      assert.equal(err.currentVersion, 1)
      return true
    }
  )
})

// ─── 7. OPTIMISTIC CONCURRENCY: VALID VERSION INCREMENTS VERSION ─────────────
test('CONCURRENCY: Correct expectedVersion increments version atomically', async () => {
  const repo = new MemoryQuestRepository()
  const quest = createSampleQuest()
  await repo.createQuest(quest) // version = 1

  const updated = await repo.updateQuest(quest.id, 1, (draft) => {
    draft.goal.targetOutcome = 'New target outcome'
    return draft
  })

  assert.equal(updated.version, 2)
  assert.equal(updated.goal.targetOutcome, 'New target outcome')

  const fetched = await repo.getQuest(quest.id)
  assert.equal(fetched?.version, 2)
  assert.equal(fetched?.goal.targetOutcome, 'New target outcome')
})

// ─── 8. CONTRACT SERIALIZATION INTEGRITY ──────────────────────────────────────
test('CONTRACT: EvaluationContract survives JSON roundtrip without mutation', () => {
  const contract: EvaluationContract = {
    type: 'hybrid',
    description: 'Dickey-Fuller test validation',
    confidenceThreshold: 0.75,
    deterministicRules: [
      {
        type: 'contains',
        pattern: '0.05',
        failureMessage: 'Test statistic required',
      },
    ],
    rubricCriteria: [
      {
        id: 'c1',
        label: 'Unit root hypothesis',
        description: 'Rejects null if p < 0.05',
        isRequired: true,
      },
    ],
  }

  const serialized = JSON.stringify(contract)
  const deserialized = JSON.parse(serialized) as EvaluationContract

  assert.deepEqual(deserialized, contract)
  assert.doesNotThrow(() => validateEvaluationContract(deserialized, 'M_TEST'))
})

// ─── 9. PROPOSALS DO NOT MUTATE CANONICAL GRAPH ──────────────────────────────
test('PROPOSALS: Creating a proposal does not alter canonical missions or edges', async () => {
  const repo = new MemoryQuestRepository()
  const quest = createSampleQuest()
  await repo.createQuest(quest)

  const proposal: QuestProposal = {
    id: 'prop_01',
    questId: quest.id,
    targetExpectedVersion: 1,
    mission: {
      id: 'M02_b',
      title: 'Prueba ARCH de heterocedasticidad',
      description: 'Evaluar volatilidad en los residuales.',
      nodeType: 'optional',
      position: { x: 350, y: 300 },
      prerequisites: ['M02'],
      evidenceType: 'text',
      evidencePrompt: 'Pega el p-valor de la prueba ARCH.',
      evaluationContract: {
        type: 'deterministic',
        description: 'Verifica reporte de prueba ARCH.',
        deterministicRules: [
          {
            type: 'contains',
            pattern: 'ARCH',
            failureMessage: 'Debe reportar prueba ARCH.',
          },
        ],
      },
    },

    connectFrom: ['M02'],
    status: 'pending',
    createdAt: new Date().toISOString(),
  }

  const createdProp = await repo.createProposal(proposal)
  assert.equal(createdProp.status, 'pending')

  // Verify canonical quest still has exactly 3 missions and 2 edges
  const canonical = await repo.getQuest(quest.id)
  assert.equal(canonical?.missions.length, 3)
  assert.equal(canonical?.edges.length, 2)
  assert.equal(canonical?.proposals.length, 1)
  assert.equal(canonical?.proposals[0].id, 'prop_01')
})
