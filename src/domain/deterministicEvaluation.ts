import type { DeterministicRule, EvidencePayload } from './quest.ts'

export interface RuleEvaluationResult {
  ruleIndex: number
  passed: boolean
  message: string
  operator: string
}

export function evaluateDeterministicRules(
  rules: DeterministicRule[] | undefined,
  evidence: EvidencePayload
): { allPassed: boolean; results: RuleEvaluationResult[] } {
  if (!rules || rules.length === 0) {
    return { allPassed: true, results: [] }
  }

  const results: RuleEvaluationResult[] = []
  let allPassed = true

  for (let idx = 0; idx < rules.length; idx++) {
    const rule = rules[idx]
    const op = rule.operator || rule.type || 'equals'
    const field = rule.targetField || rule.field
    const dataVal = field && evidence.data ? evidence.data[field] : undefined
    const textVal = evidence.text

    let passed = false

    switch (op) {
      case 'exists': {
        passed = dataVal !== undefined && dataVal !== null
        break
      }
      case 'equals': {
        const expected = rule.expectedValue !== undefined ? rule.expectedValue : rule.pattern
        passed = dataVal === expected || (dataVal === undefined && textVal === expected)
        break
      }
      case 'not_equals': {
        const expected = rule.expectedValue !== undefined ? rule.expectedValue : rule.pattern
        passed = dataVal !== expected
        break
      }
      case 'greater_than': {
        const minVal = rule.minValue !== undefined ? rule.minValue : rule.min
        passed = typeof dataVal === 'number' && Number.isFinite(dataVal) && minVal !== undefined && Number.isFinite(minVal) && dataVal > minVal
        break
      }
      case 'greater_than_or_equal': {
        const minVal = rule.minValue !== undefined ? rule.minValue : rule.min
        passed = typeof dataVal === 'number' && Number.isFinite(dataVal) && minVal !== undefined && Number.isFinite(minVal) && dataVal >= minVal
        break
      }
      case 'less_than': {
        const maxVal = rule.maxValue !== undefined ? rule.maxValue : rule.max
        passed = typeof dataVal === 'number' && Number.isFinite(dataVal) && maxVal !== undefined && Number.isFinite(maxVal) && dataVal < maxVal
        break
      }
      case 'less_than_or_equal': {
        const maxVal = rule.maxValue !== undefined ? rule.maxValue : rule.max
        passed = typeof dataVal === 'number' && Number.isFinite(dataVal) && maxVal !== undefined && Number.isFinite(maxVal) && dataVal <= maxVal
        break
      }
      case 'between':
      case 'numeric_range': {
        const minVal = rule.minValue !== undefined ? rule.minValue : rule.min
        const maxVal = rule.maxValue !== undefined ? rule.maxValue : rule.max
        passed =
          typeof dataVal === 'number' &&
          Number.isFinite(dataVal) &&
          minVal !== undefined &&
          Number.isFinite(minVal) &&
          maxVal !== undefined &&
          Number.isFinite(maxVal) &&
          dataVal >= minVal &&
          dataVal <= maxVal
        break
      }
      case 'contains': {
        const search = String(rule.expectedValue || rule.pattern || '').toLowerCase()
        const targetStr = String(dataVal !== undefined ? dataVal : textVal || '').toLowerCase()
        passed = search.length > 0 && targetStr.includes(search)
        break
      }
      case 'contains_all': {
        const targetStr = String(dataVal !== undefined ? dataVal : textVal || '').toLowerCase()
        const required = rule.requiredElements || []
        passed = required.length > 0 && required.every((req) => targetStr.includes(req.toLowerCase()))
        break
      }
      case 'regex': {
        if (rule.pattern && typeof rule.pattern === 'string' && rule.pattern.length <= 256) {
          try {
            const regex = new RegExp(rule.pattern, 'i')
            passed = regex.test(String(dataVal !== undefined ? dataVal : textVal || ''))
          } catch {
            passed = false
          }
        }
        break
      }
      case 'json_schema': {
        passed = typeof evidence.data === 'object' && evidence.data !== null
        break
      }
      default:
        passed = false
    }

    if (!passed) {
      allPassed = false
    }

    results.push({
      ruleIndex: idx,
      passed,
      message: passed ? 'Cumplido' : rule.failureMessage || `Regla [${op}] no satisfecha`,
      operator: op,
    })
  }

  return { allPassed, results }
}
