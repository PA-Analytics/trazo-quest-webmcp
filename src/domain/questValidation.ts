import type { EvaluationContract, Quest, QuestEdge, QuestMission } from './quest.ts'

export class QuestValidationError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(`[QuestValidationError] ${code}: ${message}`)
    this.name = 'QuestValidationError'
    this.code = code
  }
}

export function validateEvaluationContract(contract: EvaluationContract, missionId: string): void {
  if (!contract || typeof contract !== 'object') {
    throw new QuestValidationError(
      'INVALID_CONTRACT',
      `Mission "${missionId}" is missing an EvaluationContract.`
    )
  }

  const validTypes = ['deterministic', 'rubric', 'hybrid']
  if (!validTypes.includes(contract.type)) {
    throw new QuestValidationError(
      'INVALID_CONTRACT_TYPE',
      `Mission "${missionId}" has invalid contract type "${contract.type}". Expected one of: ${validTypes.join(', ')}.`
    )
  }

  if (!contract.description || typeof contract.description !== 'string' || contract.description.trim() === '') {
    throw new QuestValidationError(
      'INVALID_CONTRACT_DESCRIPTION',
      `Mission "${missionId}" requires a non-empty EvaluationContract description.`
    )
  }

  if (contract.type === 'deterministic' || contract.type === 'hybrid') {
    if (!Array.isArray(contract.deterministicRules) || contract.deterministicRules.length === 0) {
      throw new QuestValidationError(
        'MISSING_DETERMINISTIC_RULES',
        `Mission "${missionId}" specifies contract type "${contract.type}" but has no deterministicRules defined.`
      )
    }

    for (const [idx, rule] of contract.deterministicRules.entries()) {
      const validRuleTypes = ['regex', 'json_schema', 'numeric_range', 'contains_all']
      if (!validRuleTypes.includes(rule.type)) {
        throw new QuestValidationError(
          'INVALID_DETERMINISTIC_RULE_TYPE',
          `Mission "${missionId}" rule[${idx}] has invalid rule type "${rule.type}".`
        )
      }
      if (!rule.failureMessage || rule.failureMessage.trim() === '') {
        throw new QuestValidationError(
          'MISSING_RULE_FAILURE_MESSAGE',
          `Mission "${missionId}" rule[${idx}] must provide a failureMessage.`
        )
      }
    }
  }

  if (contract.type === 'rubric' || contract.type === 'hybrid') {
    if (!Array.isArray(contract.rubricCriteria) || contract.rubricCriteria.length === 0) {
      throw new QuestValidationError(
        'MISSING_RUBRIC_CRITERIA',
        `Mission "${missionId}" specifies contract type "${contract.type}" but has no rubricCriteria defined.`
      )
    }

    for (const [idx, criterion] of contract.rubricCriteria.entries()) {
      if (!criterion.id || !criterion.label || !criterion.description) {
        throw new QuestValidationError(
          'INVALID_RUBRIC_CRITERION',
          `Mission "${missionId}" criterion[${idx}] must define id, label, and description.`
        )
      }
    }
  }
}

export function validateQuestTopology(missions: QuestMission[], edges: QuestEdge[]): void {
  if (!Array.isArray(missions) || missions.length === 0) {
    throw new QuestValidationError('EMPTY_MISSIONS', 'A Quest must contain at least one mission.')
  }

  // 1. Unique Mission IDs
  const missionIds = new Set<string>()
  for (const mission of missions) {
    if (!mission.id || typeof mission.id !== 'string' || mission.id.trim() === '') {
      throw new QuestValidationError('INVALID_MISSION_ID', 'All missions must have a non-empty string id.')
    }
    if (missionIds.has(mission.id)) {
      throw new QuestValidationError('DUPLICATE_MISSION_ID', `Duplicate mission id found: "${mission.id}".`)
    }
    missionIds.add(mission.id)

    // Contract validation
    validateEvaluationContract(mission.evaluationContract, mission.id)
  }

  // 2. Validate Edges and Endpoints
  const inDegrees = new Map<string, number>()
  const adjacency = new Map<string, string[]>()
  for (const id of missionIds) {
    inDegrees.set(id, 0)
    adjacency.set(id, [])
  }

  for (const edge of edges) {
    if (edge.source === edge.target) {
      throw new QuestValidationError(
        'SELF_LOOP_DETECTED',
        `Edge "${edge.id}" forms a self-loop on mission "${edge.source}".`
      )
    }
    if (!missionIds.has(edge.source)) {
      throw new QuestValidationError(
        'DANGLING_EDGE_SOURCE',
        `Edge "${edge.id}" references nonexistent source mission "${edge.source}".`
      )
    }
    if (!missionIds.has(edge.target)) {
      throw new QuestValidationError(
        'DANGLING_EDGE_TARGET',
        `Edge "${edge.id}" references nonexistent target mission "${edge.target}".`
      )
    }

    adjacency.get(edge.source)!.push(edge.target)
    inDegrees.set(edge.target, (inDegrees.get(edge.target) ?? 0) + 1)
  }

  // 3. Cycle Detection via Kahn's Topological Sort
  const queue: string[] = []
  for (const [id, inDegree] of inDegrees.entries()) {
    if (inDegree === 0) {
      queue.push(id)
    }
  }

  let visitedCount = 0
  while (queue.length > 0) {
    const current = queue.shift()!
    visitedCount++

    for (const neighbor of adjacency.get(current) ?? []) {
      const remainingInDegree = (inDegrees.get(neighbor) ?? 0) - 1
      inDegrees.set(neighbor, remainingInDegree)
      if (remainingInDegree === 0) {
        queue.push(neighbor)
      }
    }
  }

  if (visitedCount !== missions.length) {
    throw new QuestValidationError(
      'GRAPH_CONTAINS_CYCLE',
      'The quest graph contains a directed cycle or deadlock dependency.'
    )
  }
}

export function validateQuest(quest: Quest): void {
  if (!quest.id || typeof quest.id !== 'string') {
    throw new QuestValidationError('INVALID_QUEST_ID', 'Quest must have a valid string id.')
  }
  if (typeof quest.version !== 'number' || quest.version < 1) {
    throw new QuestValidationError('INVALID_QUEST_VERSION', 'Quest version must be a positive integer >= 1.')
  }
  if (!quest.goal?.rawPrompt || !quest.goal?.targetOutcome) {
    throw new QuestValidationError('INVALID_QUEST_GOAL', 'Quest must have rawPrompt and targetOutcome defined.')
  }

  validateQuestTopology(quest.missions, quest.edges)
}
