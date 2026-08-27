import type {
  EvaluationContract,
  Quest,
  QuestEdge,
  QuestMission,
  QuestNodeType,
  QuestProgress,
  QuestProposal,
} from '../../domain/quest.ts'
import {
  validateEvaluationContract,
  validateQuest,
  validateQuestTopology,
} from '../../domain/questValidation.ts'
import {
  type IQuestRepository,
  ProposalNotFoundError,
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

export interface ProposeQuestChangeDTO {
  expectedVersion: number
  mission: {
    id?: string
    title: string
    description?: string
    objective?: string
    nodeType?: QuestNodeType
    mapSubtitle?: string
    evidencePrompt?: string
    evaluationContract: EvaluationContract
  }
  connectFrom: string[]
  connectTo?: string[]
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
  pendingProposalsCount: number
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
  proposals: Array<{
    id: string
    status: string
    missionId: string
    title: string
    connectFrom: string[]
    connectTo?: string[]
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

  async proposeQuestChange(
    questId: string,
    dto: ProposeQuestChangeDTO
  ): Promise<{ quest: Quest; proposal: QuestProposal }> {
    if (!dto || typeof dto !== 'object') {
      throw new Error('INVALID_PAYLOAD: Proposal payload is required.')
    }
    if (typeof dto.expectedVersion !== 'number') {
      throw new Error('INVALID_EXPECTED_VERSION: expectedVersion is required.')
    }
    if (!dto.mission || !dto.mission.title) {
      throw new Error('INVALID_MISSION: Proposed mission must have a title.')
    }
    if (!dto.mission.evaluationContract) {
      throw new Error('INVALID_CONTRACT: Proposed mission must have an evaluationContract.')
    }
    if (!Array.isArray(dto.connectFrom) || dto.connectFrom.length === 0) {
      throw new Error('INVALID_CONNECT_FROM: connectFrom must contain at least one source mission ID.')
    }

    validateEvaluationContract(dto.mission.evaluationContract, dto.mission.id || 'proposed_mission')

    let createdProposal: QuestProposal | null = null

    const updatedQuest = await this.repository.updateQuest(
      questId,
      dto.expectedVersion,
      (draft: Quest) => {
        const canonicalIds = new Set(draft.missions.map((m) => m.id))
        const pendingIds = new Set(
          (draft.proposals || [])
            .filter((p) => p.status === 'pending')
            .map((p) => p.mission.id)
        )

        // 1. Verify connectFrom and connectTo reference existing canonical missions
        for (const fromId of dto.connectFrom) {
          if (!canonicalIds.has(fromId)) {
            throw new Error(`DANGLING_EDGE_SOURCE: Proposed connectFrom mission "${fromId}" does not exist.`)
          }
        }
        for (const toId of dto.connectTo || []) {
          if (!canonicalIds.has(toId)) {
            throw new Error(`DANGLING_EDGE_TARGET: Proposed connectTo mission "${toId}" does not exist.`)
          }
        }

        // 2. Generate unique mission ID
        let propMissionId = dto.mission.id?.trim()
        if (!propMissionId || canonicalIds.has(propMissionId) || pendingIds.has(propMissionId)) {
          propMissionId = `${dto.connectFrom[0]}A`
          if (canonicalIds.has(propMissionId) || pendingIds.has(propMissionId)) {
            propMissionId = `M_${Date.now().toString(36).slice(-4)}`
          }
        }

        // 3. Compute sensible canvas position
        const fromMission = draft.missions.find((m) => m.id === dto.connectFrom[0])
        const toMission = dto.connectTo?.[0] ? draft.missions.find((m) => m.id === dto.connectTo![0]) : undefined
        let posX = fromMission ? fromMission.position.x + 130 : 250
        let posY = fromMission ? fromMission.position.y + 110 : 250
        if (fromMission && toMission) {
          posX = (fromMission.position.x + toMission.position.x) / 2
          posY = (fromMission.position.y + toMission.position.y) / 2 + 100
        }

        const normalizedMission: QuestMission = {
          id: propMissionId,
          title: dto.mission.title.trim(),
          description: (dto.mission.description || dto.mission.objective || dto.mission.title).trim(),
          nodeType: dto.mission.nodeType || 'normal',
          mapSubtitle: dto.mission.mapSubtitle,
          position: { x: posX, y: posY },
          prerequisites: [...dto.connectFrom],
          evidenceType: 'text',
          evidencePrompt: dto.mission.evidencePrompt || `Envía la evidencia para: ${dto.mission.title}`,
          evaluationContract: dto.mission.evaluationContract,
        }

        // 4. Simulate candidate DAG topology to ensure proposal won't create cycles
        const candidateMissions = [...draft.missions, normalizedMission]
        const candidateEdges = [
          ...draft.edges,
          ...dto.connectFrom.map((fromId) => ({
            id: `candidate_edge_${fromId}_${propMissionId}`,
            source: fromId,
            target: propMissionId!,
          })),
          ...(dto.connectTo || []).map((toId) => ({
            id: `candidate_edge_${propMissionId}_${toId}`,
            source: propMissionId!,
            target: toId,
          })),
        ]
        validateQuestTopology(candidateMissions, candidateEdges)

        // 5. Construct proposal
        const proposal: QuestProposal = {
          id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          questId,
          targetExpectedVersion: dto.expectedVersion,
          mission: normalizedMission,
          connectFrom: dto.connectFrom,
          connectTo: dto.connectTo,
          status: 'pending',
          createdAt: new Date().toISOString(),
        }

        draft.proposals = draft.proposals || []
        draft.proposals.push(proposal)
        createdProposal = proposal

        return draft
      }
    )

    return { quest: updatedQuest, proposal: createdProposal! }
  }

  async acceptProposal(
    questId: string,
    proposalId: string,
    expectedVersion: number
  ): Promise<Quest> {
    return await this.repository.updateQuest(questId, expectedVersion, (draft: Quest) => {
      const proposal = (draft.proposals || []).find((p) => p.id === proposalId)
      if (!proposal) {
        throw new ProposalNotFoundError(questId, proposalId)
      }
      if (proposal.status !== 'pending') {
        throw new Error(`PROPOSAL_ALREADY_DECIDED: Proposal "${proposalId}" is already ${proposal.status}.`)
      }

      // Check mission ID is not duplicate in canonical
      if (draft.missions.some((m) => m.id === proposal.mission.id)) {
        throw new Error(`DUPLICATE_MISSION_ID: Mission "${proposal.mission.id}" already exists in quest.`)
      }

      // 1. Insert mission into canonical missions
      draft.missions.push(structuredClone(proposal.mission))

      // 2. Insert canonical edges
      for (const fromId of proposal.connectFrom) {
        if (!draft.edges.some((e) => e.source === fromId && e.target === proposal.mission.id)) {
          draft.edges.push({
            id: `edge_${fromId}_${proposal.mission.id}`,
            source: fromId,
            target: proposal.mission.id,
          })
        }
      }
      for (const toId of proposal.connectTo || []) {
        if (!draft.edges.some((e) => e.source === proposal.mission.id && e.target === toId)) {
          draft.edges.push({
            id: `edge_${proposal.mission.id}_${toId}`,
            source: proposal.mission.id,
            target: toId,
          })
        }
        // Update downstream prerequisites
        const targetMission = draft.missions.find((m) => m.id === toId)
        if (targetMission && !targetMission.prerequisites.includes(proposal.mission.id)) {
          targetMission.prerequisites.push(proposal.mission.id)
        }
      }

      // 3. Validate updated canonical graph
      validateQuest(draft)

      // 4. Mark proposal accepted
      proposal.status = 'accepted'
      proposal.decidedAt = new Date().toISOString()

      return draft
    })
  }

  async rejectProposal(
    questId: string,
    proposalId: string,
    expectedVersion: number
  ): Promise<Quest> {
    return await this.repository.updateQuest(questId, expectedVersion, (draft: Quest) => {
      const proposal = (draft.proposals || []).find((p) => p.id === proposalId)
      if (!proposal) {
        throw new ProposalNotFoundError(questId, proposalId)
      }
      if (proposal.status !== 'pending') {
        throw new Error(`PROPOSAL_ALREADY_DECIDED: Proposal "${proposalId}" is already ${proposal.status}.`)
      }

      proposal.status = 'rejected'
      proposal.decidedAt = new Date().toISOString()
      return draft
    })
  }

  async getQuestStateProjection(id: string): Promise<QuestStateProjectionDTO | null> {
    const quest = await this.repository.getQuest(id)
    if (!quest) return null

    const completedSet = new Set(quest.progress.completedMissionIds || [])
    const pendingProposals = (quest.proposals || []).filter((p) => p.status === 'pending')

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
      pendingProposalsCount: pendingProposals.length,
      missions,
      edges: quest.edges.map((e) => ({
        source: e.source,
        target: e.target,
        optional: e.optional,
      })),
      proposals: (quest.proposals || []).map((p) => ({
        id: p.id,
        status: p.status,
        missionId: p.mission.id,
        title: p.mission.title,
        connectFrom: p.connectFrom,
        connectTo: p.connectTo,
      })),
    }
  }
}
