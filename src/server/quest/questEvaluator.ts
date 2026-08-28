import type {
  EvaluationContract,
  EvidencePayload,
  QuestMission,
} from '../../domain/quest.ts'
import { evaluateDeterministicRules } from '../../domain/deterministicEvaluation.ts'
import { createCanonicalGeminiRuntime, type CanonicalGeminiRuntime } from '../ai/runtime.ts'

export interface EvaluationOutcome {
  verdict: 'PASS' | 'REWORK' | 'CLARIFY' | 'HUMAN_REVIEW'
  feedback: string
  ruleResults?: Array<{
    ruleIndex: number
    passed: boolean
    message: string
  }>
  criterionResults?: Array<{
    criterionId: string
    status: 'PASS' | 'NOT_MET' | 'UNVERIFIABLE'
    reason: string
  }>
}

export class QuestEvaluator {
  private runtime: CanonicalGeminiRuntime | null = null

  constructor(runtime?: CanonicalGeminiRuntime) {
    if (runtime) {
      this.runtime = runtime
    }
  }

  private getRuntime(): CanonicalGeminiRuntime {
    if (!this.runtime) {
      this.runtime = createCanonicalGeminiRuntime()
    }
    return this.runtime
  }

  async evaluate(
    contract: EvaluationContract,
    evidence: EvidencePayload,
    mission: QuestMission
  ): Promise<EvaluationOutcome> {
    if (!evidence || (!evidence.text && !evidence.data)) {
      return {
        verdict: 'REWORK',
        feedback: 'No se proveyó evidencia textual o estructurada para evaluación.',
      }
    }

    const type = contract.type || 'rubric'

    // 1. DETERMINISTIC ONLY
    if (type === 'deterministic') {
      const { allPassed, results } = evaluateDeterministicRules(contract.deterministicRules, evidence)
      const failedRules = results.filter((r) => !r.passed)

      if (!allPassed) {
        return {
          verdict: 'REWORK',
          feedback: failedRules.map((r) => r.message).join(' '),
          ruleResults: results,
        }
      }

      return {
        verdict: 'PASS',
        feedback: 'Evidencia verificada determinísticamente con éxito.',
        ruleResults: results,
      }
    }

    // 2. HYBRID OR RUBRIC: First check deterministic rules if hybrid
    let ruleResults: Array<{ ruleIndex: number; passed: boolean; message: string }> | undefined
    if (type === 'hybrid' && contract.deterministicRules && contract.deterministicRules.length > 0) {
      const { allPassed, results } = evaluateDeterministicRules(contract.deterministicRules, evidence)
      ruleResults = results
      if (!allPassed) {
        const failedRules = results.filter((r) => !r.passed)
        return {
          verdict: 'REWORK',
          feedback: failedRules.map((r) => r.message).join(' '),
          ruleResults,
        }
      }
    }

    // 3. RUBRIC EVALUATION
    if (!contract.rubricCriteria || contract.rubricCriteria.length === 0) {
      return {
        verdict: 'PASS',
        feedback: 'Evidencia aceptada.',
        ruleResults,
      }
    }

    try {
      const runtime = this.getRuntime()
      const prompt = `You are the TRAZO Quest deterministic judge evaluating evidence for the mission: "${mission.title}".
Mission Objective: "${mission.description}"
Evidence Criteria: "${contract.description}"

RUBRIC CRITERIA:
${contract.rubricCriteria.map((c) => `- [${c.id}] ${c.label}: ${c.description} (Required: ${c.isRequired})`).join('\n')}

LEARNER SUBMITTED EVIDENCE:
Text: ${evidence.text || '(None)'}
Data: ${evidence.data ? JSON.stringify(evidence.data, null, 2) : '(None)'}

Evaluate whether the evidence satisfies each criterion strictly.
Output ONLY valid JSON matching this schema:
{
  "criteria": [
    {
      "criterionId": "criterion_id",
      "status": "PASS" | "NOT_MET" | "UNVERIFIABLE",
      "reason": "Detailed explanation"
    }
  ],
  "recommendation": "PASS" | "REWORK" | "CLARIFY",
  "feedback": "Actionable feedback for the learner",
  "confidence": 0.0 to 1.0
}`

      const response = await runtime.generateContent({
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      })

      const rawText = response.text || ''
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      const parsed = JSON.parse(cleaned)

      const criteriaResults = parsed.criteria || []
      const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.9
      const confidenceThreshold = contract.confidenceThreshold || 0.70

      let hasNotMetRequired = false
      let hasUnverifiableRequired = false

      for (const criterion of contract.rubricCriteria) {
        if (!criterion.isRequired) continue
        const result = criteriaResults.find((c: any) => c.criterionId === criterion.id)
        if (!result || result.status === 'NOT_MET') {
          hasNotMetRequired = true
        } else if (result.status === 'UNVERIFIABLE') {
          hasUnverifiableRequired = true
        }
      }

      let verdict: 'PASS' | 'REWORK' | 'CLARIFY' | 'HUMAN_REVIEW' = 'PASS'
      if (hasNotMetRequired) {
        verdict = 'REWORK'
      } else if (hasUnverifiableRequired) {
        verdict = 'CLARIFY'
      } else if (confidence < confidenceThreshold) {
        verdict = 'HUMAN_REVIEW'
      } else if (parsed.recommendation === 'REWORK') {
        verdict = 'REWORK'
      } else if (parsed.recommendation === 'CLARIFY') {
        verdict = 'CLARIFY'
      }

      return {
        verdict,
        feedback: parsed.feedback || (verdict === 'PASS' ? 'Evidencia aprobada.' : 'La evidencia requiere ajustes.'),
        criterionResults: criteriaResults,
        ruleResults,
      }
    } catch (err: unknown) {
      console.error('[QuestEvaluator] Rubric evaluation failed:', err)
      const errorMsg = err instanceof Error ? err.message : String(err)
      throw new Error(`EVALUATION_FAILED: Error en el servicio de evaluación: ${errorMsg}`)
    }
  }
}
