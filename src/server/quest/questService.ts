import type {
  EvaluationContract,
  Quest,
  QuestEdge,
  QuestMission,
  QuestNodeType,
  QuestProgress,
} from '../../domain/quest.ts'
import { validateQuest } from '../../domain/questValidation.ts'
import {
  type IQuestRepository,
  createQuestRepository,
} from './questRepository.ts'

export interface CreateMissionDTO {
  id?: string
  title: string
  description?: string
  objective?: string
  nodeType?: QuestNodeType
  mapSubtitle?: string
  prerequisites?: string[]
  evidencePrompt?: string
  evaluationContract: EvaluationContract
}

export interface CreateEdgeDTO {
  id?: string
  source: string
  target: string
  optional?: boolean
}

export interface CreateQuestDTO {
  goal: {
    rawPrompt: string
    targetOutcome: string
  }
  missions: CreateMissionDTO[]
  edges?: CreateEdgeDTO[]
}

export interface QuestStateProjectionDTO {
  questId: string
  version: number
  goal: {
    rawPrompt: string
    targetOutcome: string
  }
  totalMissions: number
  completedCount: number
  activeMissionId?: string
  missions: Array<{
    id: string
    title: string
    description: string
    status: 'locked' | 'available' | 'active' | 'completed'
    prerequisites: string[]
    evaluationType: string
    evaluationDescription: string
  }>
  edges: Array<{
    source: string
    target: string
    optional?: boolean
  }>
}

export class QuestService {
  private readonly repository: IQuestRepository

  constructor(repository?: IQuestRepository) {
    this.repository = repository || createQuestRepository()
  }

  async createQuest(dto: CreateQuestDTO): Promise<Quest> {
    if (!dto || typeof dto !== 'object') {
      throw new Error('INVALID_PAYLOAD: Quest payload is required.')
    }
    if (!dto.goal?.rawPrompt || !dto.goal?.targetOutcome) {
      throw new Error('INVALID_QUEST_GOAL: goal.rawPrompt and goal.targetOutcome are required.')
    }
    if (!Array.isArray(dto.missions) || dto.missions.length === 0) {
      throw new Error('EMPTY_MISSIONS: At least one mission is required.')
    }

    const questId = `quest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const now = new Date().toISOString()

    // Normalize missions
    const normalizedMissions: QuestMission[] = dto.missions.map((m, idx) => {
      const missionId = m.id?.trim() || `M${String(idx + 1).padStart(2, '0')}`
      const desc = m.description || m.objective || m.title
      return {
        id: missionId,
        title: m.title.trim(),
        description: desc.trim(),
        nodeType: m.nodeType || (idx === dto.missions.length - 1 ? 'milestone' : 'normal'),
        mapRole: idx === 0 ? 'entry' : idx === dto.missions.length - 1 ? 'convergence' : undefined,
        mapSubtitle: m.mapSubtitle,
        position: { x: 180 + idx * 260, y: 160 },
        prerequisites: Array.isArray(m.prerequisites)
          ? m.prerequisites
          : idx > 0 && dto.missions[idx - 1].id
          ? [dto.missions[idx - 1].id!]
          : [],
        evidenceType: 'text',
        evidencePrompt: m.evidencePrompt || `Envía la evidencia o conclusión para: ${m.title}`,
        evaluationContract: m.evaluationContract,
      }
    })

    // Normalize edges
    let normalizedEdges: QuestEdge[] = (dto.edges || []).map((e, idx) => ({
      id: e.id || `edge_${e.source}_${e.target}_${idx}`,
      source: e.source,
      target: e.target,
      optional: e.optional,
    }))

    // If edges omitted or incomplete, auto-wire linear edges from prerequisites
    if (normalizedEdges.length === 0 && normalizedMissions.length > 1) {
      normalizedEdges = []
      for (const m of normalizedMissions) {
        for (const prereq of m.prerequisites) {
          normalizedEdges.push({
            id: `edge_${prereq}_${m.id}`,
            source: prereq,
            target: m.id,
          })
        }
      }
      // If still 0 edges, connect sequentially
      if (normalizedEdges.length === 0) {
        for (let i = 0; i < normalizedMissions.length - 1; i++) {
          normalizedEdges.push({
            id: `edge_${normalizedMissions[i].id}_${normalizedMissions[i + 1].id}`,
            source: normalizedMissions[i].id,
            target: normalizedMissions[i + 1].id,
          })
          if (!normalizedMissions[i + 1].prerequisites.includes(normalizedMissions[i].id)) {
            normalizedMissions[i + 1].prerequisites.push(normalizedMissions[i].id)
          }
        }
      }
    }

    const targetIds = new Set(normalizedEdges.map((e) => e.target))
    const entryNodeIds = normalizedMissions.filter((m) => !targetIds.has(m.id)).map((m) => m.id)
    const initialEntry = entryNodeIds.length > 0 ? entryNodeIds[0] : normalizedMissions[0].id

    const progress: QuestProgress = {
      questId,
      completedMissionIds: [],
      activeMissionId: initialEntry,
      artifacts: {},
      updatedAt: now,
    }

    const canonicalQuest: Quest = {
      id: questId,
      version: 1,
      goal: {
        rawPrompt: dto.goal.rawPrompt.trim(),
        targetOutcome: dto.goal.targetOutcome.trim(),
      },
      entryNodeIds: entryNodeIds.length > 0 ? entryNodeIds : [initialEntry],
      missions: normalizedMissions,
      edges: normalizedEdges,
      proposals: [],
      progress,
      createdAt: now,
      updatedAt: now,
    }

    validateQuest(canonicalQuest)
    return await this.repository.createQuest(canonicalQuest)
  }

  async getQuest(id: string): Promise<Quest | null> {
    return await this.repository.getQuest(id)
  }

  async getQuestStateProjection(id: string): Promise<QuestStateProjectionDTO | null> {
    const quest = await this.repository.getQuest(id)
    if (!quest) return null

    const completedSet = new Set(quest.progress.completedMissionIds || [])

    const missions = quest.missions.map((m) => {
      let status: 'locked' | 'available' | 'active' | 'completed' = 'locked'
      if (completedSet.has(m.id)) {
        status = 'completed'
      } else if (m.id === quest.progress.activeMissionId) {
        status = 'active'
      } else if (
        !m.prerequisites ||
        m.prerequisites.length === 0 ||
        m.prerequisites.every((p) => completedSet.has(p))
      ) {
        status = 'available'
      }

      return {
        id: m.id,
        title: m.title,
        description: m.description,
        status,
        prerequisites: m.prerequisites || [],
        evaluationType: m.evaluationContract?.type || 'rubric',
        evaluationDescription: m.evaluationContract?.description || '',
      }
    })

    return {
      questId: quest.id,
      version: quest.version,
      goal: quest.goal,
      totalMissions: quest.missions.length,
      completedCount: quest.progress.completedMissionIds?.length || 0,
      activeMissionId: quest.progress.activeMissionId,
      missions,
      edges: quest.edges.map((e) => ({
        source: e.source,
        target: e.target,
        optional: e.optional,
      })),
    }
  }
}
