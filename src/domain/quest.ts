/**
 * TRAZO Quest — Dynamic Quest Domain Models
 * Canonical Domain Definitions for WebMCP-Native Educational & Implementation Graphs.
 */

export type QuestNodeType = 'normal' | 'optional' | 'milestone'

export type QuestMapRole = 'entry' | 'convergence'

export type QuestProgressState =
  | 'locked'
  | 'available'
  | 'active'
  | 'submitted'
  | 'completed'

export type EvaluationContractType = 'deterministic' | 'rubric' | 'hybrid'

export type DeterministicRuleType = 'regex' | 'json_schema' | 'numeric_range' | 'contains_all'

export interface DeterministicRule {
  type: DeterministicRuleType
  pattern?: string
  field?: string
  min?: number
  max?: number
  failureMessage: string
}

export interface QuestRubricCriterion {
  id: string
  label: string
  description: string
  isRequired: boolean
}

export interface EvaluationContract {
  type: EvaluationContractType
  description: string
  deterministicRules?: DeterministicRule[]
  rubricCriteria?: QuestRubricCriterion[]
  confidenceThreshold?: number // default 0.70
}

export interface QuestMission {
  id: string
  title: string
  description: string
  nodeType: QuestNodeType
  mapRole?: QuestMapRole
  mapSubtitle?: string
  position: { x: number; y: number }
  prerequisites: string[]
  evidenceType: 'text' | 'url'
  evidencePrompt: string
  evidenceCriteria?: string
  evaluationContract: EvaluationContract
  producesArtifacts?: string[]
  consumesArtifacts?: string[]
}

export interface QuestEdge {
  id: string
  source: string
  target: string
  optional?: boolean
  via?: { x: number; y: number }
}

export type ProposalStatus = 'pending' | 'accepted' | 'rejected'

export interface QuestProposal {
  id: string
  questId: string
  targetExpectedVersion: number
  mission: QuestMission
  connectFrom: string[]
  connectTo?: string[]
  status: ProposalStatus
  createdAt: string
  decidedAt?: string
}

export interface QuestGoal {
  rawPrompt: string
  targetOutcome: string
}

export interface Quest {
  id: string
  version: number
  goal: QuestGoal
  entryNodeIds: string[]
  missions: QuestMission[]
  edges: QuestEdge[]
  proposals: QuestProposal[]
  progress: QuestProgress
  createdAt: string
  updatedAt: string
}

export interface QuestArtifact {
  key: string
  sourceMissionId: string
  value: unknown
  createdAt: string
}

export interface QuestProgress {
  questId: string
  completedMissionIds: string[]
  activeMissionId?: string
  artifacts: Record<string, QuestArtifact>
  updatedAt: string
}
