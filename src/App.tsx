import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChapterNavigation } from './components/ChapterNavigation'
import { HudBar } from './components/HudBar'
import { MissionPanel } from './components/MissionPanel'
import { QuestMap } from './components/QuestMap'
import { CreatorCalibrationView } from './components/CreatorCalibrationView'
import { CoachIntro } from './components/CoachIntro'
import { IdentityEntry } from './components/IdentityEntry'
import { LearnerQuickSetup } from './components/LearnerQuickSetup'
import { RoleGateway } from './components/RoleGateway'
import { ProfileSelection, ProfileSwitcher } from './components/ProfileSwitcher'
import { DEFAULT_PACK_ID, packs, resolvePack } from './data/packs'
import type {
  Chapter,
  Course,
  EvaluationStatus,
  ImplementationState,
  Mission,
  MissionEvaluationState,
  MissionInteractionTurn,
  ProgressState,
} from './domain/course'
import type { UserProfile } from './domain/identity'
import type { Quest } from './domain/quest.ts'
import { adaptQuestToMap } from './adapters/questToMapAdapter.ts'
import { useWebMCPTool } from './hooks/useWebMCPTool.ts'
import {
  deriveMissionProgress,
  formatLockedReason,
} from './domain/progression'
import {
  isSystemEvaluationError,
  normalizeSubmissionFailure,
} from './presentation/missionEvaluation'
import type { SubmissionResponseDTO } from './server/types'

function getPrerequisiteSummary(mission: Mission, chapter: Chapter) {
  const titleById = new Map(chapter.missions.map((item) => [item.id, item.title]))
  if (mission.requiresAny?.length) {
    return `Elige una ruta: ${mission.requiresAny
      .map((id) => titleById.get(id) ?? id)
      .join(' o ')}.`
  }
  if (mission.prerequisites?.length) {
    return `Requiere: ${mission.prerequisites
      .map((id) => titleById.get(id) ?? id)
      .join(', ')}.`
  }
  return undefined
}

function getUnlockSummary(mission: Mission, chapter: Chapter) {
  const titleById = new Map(chapter.missions.map((item) => [item.id, item.title]))
  const nextTitles = [...new Set(
    chapter.edges
      .filter((edge) => edge.source === mission.id)
      .map((edge) => titleById.get(edge.target) ?? edge.target),
  )]

  return nextTitles.length > 0
    ? `Al verificar, se abre: ${nextTitles.join(' o ')}.`
    : 'Al verificar, completas este recorrido.'
}

/**
 * Dev/demo selection boundary: picks the active methodology pack from an explicit
 * URL parameter or a persisted local demo preference. Unknown ids fall back to the
 * default pack with a console warning; canonical state is never fabricated here.
 */
function selectDemoPackId(): string {
  const requested =
    new URLSearchParams(window.location.search).get('metodologia') ??
    localStorage.getItem('trazo_active_pack')
  if (!requested) return DEFAULT_PACK_ID
  if (!packs.some((pack) => pack.id === requested)) {
    console.warn(`[TRAZO] Unknown methodology '${requested}' requested; using default pack.`)
    return DEFAULT_PACK_ID
  }
  localStorage.setItem('trazo_active_pack', requested)
  return requested
}

export function App() {
  const [activeQuest, setActiveQuest] = useState<Quest | null>(null)
  const [selectedPackId] = useState(() => selectDemoPackId())
  const staticCourse = useMemo(() => resolvePack(selectedPackId), [selectedPackId])
  const [graphCourse, setGraphCourse] = useState<Course | null>(null)
  const [graphProgress, setGraphProgress] = useState<Record<string, ProgressState> | null>(null)

  const questViewModel = useMemo(() => {
    return activeQuest ? adaptQuestToMap(activeQuest) : null
  }, [activeQuest])

  const course = questViewModel?.course ?? graphCourse ?? staticCourse
  const [activeUserId, setActiveUserId] = useState(() => localStorage.getItem('trazo_active_user_id') || '')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(() => Boolean(localStorage.getItem('trazo_active_user_id')))
  const [activeChapterId, setActiveChapterId] = useState(course.chapters[0].id)
  const [implementationId, setImplementationId] = useState('')
  const [implementationState, setImplementationState] = useState<ImplementationState | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null)
  const [evidenceByMissionId, setEvidenceByMissionId] = useState<Record<string, string>>({})
  const [evaluationStateByMissionId, setEvaluationStateByMissionId] = useState<
    Record<string, MissionEvaluationState>
  >({})
  const [interactionHistoryByMissionId, setInteractionHistoryByMissionId] = useState<
    Record<string, MissionInteractionTurn[]>
  >({})
  const [recommendedMissionId, setRecommendedMissionId] = useState<string | null>(null)
  const [recenterRequest, setRecenterRequest] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const [showProfileSelection, setShowProfileSelection] = useState(false)
  const [isCreatingProfile, setIsCreatingProfile] = useState(false)

  // Restore active quest on initial load if present in query params or local storage
  useEffect(() => {
    if (typeof window === 'undefined') return
    const requestedQuestId =
      new URLSearchParams(window.location.search).get('questId') ||
      localStorage.getItem('trazo_active_quest_id')

    if (requestedQuestId) {
      void fetch(`/api/v1/quests/${encodeURIComponent(requestedQuestId)}`)
        .then(async (res) => {
          if (res.ok) {
            const data = (await res.json()) as Quest
            setActiveQuest(data)
            setSelectedMissionId(data.progress.activeMissionId || data.missions[0]?.id || null)
          }
        })
        .catch((err) => console.warn('[TRAZO] Failed to load stored quest:', err))
    }
  }, [])

  useEffect(() => {
    if (!activeUserId) {
      setProfile(null)
      setProfileLoading(false)
      return
    }

    setProfileLoading(true)
    void fetch(`/api/v1/profiles/${encodeURIComponent(activeUserId)}`)
      .then(async (response) => {
        if (response.status === 404) {
          localStorage.removeItem('trazo_active_user_id')
          setActiveUserId('')
          return null
        }
        if (!response.ok) throw new Error('No se pudo cargar tu perfil.')
        return (await response.json()) as UserProfile
      })
      .then((data) => {
        if (data) setProfile(data)
      })
      .catch(() => setServerError('No se pudo cargar tu perfil. Intenta de nuevo.'))
      .finally(() => setProfileLoading(false))
  }, [activeUserId])

  useEffect(() => {
    if (profile?.role === 'learner' && profile.learnerImplementationId) {
      setImplementationId(profile.learnerImplementationId)
    }
  }, [profile?.learnerImplementationId, profile?.role])

  // ─── WEBMCP TOOLS: CREATE & GET QUEST ────────────────────────────────────
  useWebMCPTool({
    name: 'create_quest',
    description: 'Initializes a new authoritative quest graph from a learning or execution goal.',
    inputSchema: {
      type: 'object',
      properties: {
        goal: {
          type: 'object',
          properties: {
            rawPrompt: { type: 'string', description: 'The user goal or prompt' },
            targetOutcome: { type: 'string', description: 'Concrete target outcome upon completion' },
          },
          required: ['rawPrompt', 'targetOutcome'],
        },
        missions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              objective: { type: 'string' },
              nodeType: { type: 'string', enum: ['normal', 'optional', 'milestone'] },
              prerequisites: { type: 'array', items: { type: 'string' } },
              evidencePrompt: { type: 'string' },
              evaluationContract: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['deterministic', 'rubric', 'hybrid'] },
                  description: { type: 'string' },
                },
                required: ['type', 'description'],
              },
            },
            required: ['title', 'evaluationContract'],
          },
        },
        edges: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              source: { type: 'string' },
              target: { type: 'string' },
              optional: { type: 'boolean' },
            },
            required: ['source', 'target'],
          },
        },
      },
      required: ['goal', 'missions'],
    },
    annotations: {
      readOnlyHint: false,
    },
    execute: async (payload: any) => {
      const response = await fetch('/api/v1/quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${response.status}: Failed to create quest`)
      }
      const createdQuest = (await response.json()) as Quest

      setActiveQuest(createdQuest)
      if (typeof window !== 'undefined') {
        localStorage.setItem('trazo_active_quest_id', createdQuest.id)
      }
      setSelectedMissionId(createdQuest.progress.activeMissionId || createdQuest.missions[0]?.id || null)

      // Ensure profile exists for UI rendering
      setProfile((prev) =>
        prev
          ? { ...prev, role: 'learner' }
          : {
              userId: 'guest-learner',
              displayName: 'Explorador Quest',
              role: 'learner',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
      )
      setProfileLoading(false)
      setServerError(null)

      return {
        ok: true,
        questId: createdQuest.id,
        version: createdQuest.version,
        totalMissions: createdQuest.missions.length,
        activeMissionId: createdQuest.progress.activeMissionId,
        missions: createdQuest.missions.map((m) => ({
          id: m.id,
          title: m.title,
          status: m.id === createdQuest.progress.activeMissionId ? 'active' : 'locked',
        })),
      }
    },
  })

  useWebMCPTool({
    name: 'get_quest_state',
    description: 'Get the current authoritative graph topology, progression status, and unlocked missions.',
    inputSchema: {
      type: 'object',
      properties: {
        questId: { type: 'string', description: 'Optional quest ID. Defaults to active quest on page.' },
      },
    },
    annotations: {
      readOnlyHint: true,
    },
    execute: async ({ questId }: { questId?: string } = {}) => {
      const targetId =
        questId ||
        activeQuest?.id ||
        (typeof window !== 'undefined' ? localStorage.getItem('trazo_active_quest_id') : null)

      if (!targetId) {
        return {
          ok: false,
          error: 'No active quest on page. Call create_quest first.',
        }
      }

      if (activeQuest && activeQuest.id === targetId) {
        const completedSet = new Set(activeQuest.progress.completedMissionIds || [])
        return {
          ok: true,
          questId: activeQuest.id,
          version: activeQuest.version,
          goal: activeQuest.goal,
          totalMissions: activeQuest.missions.length,
          completedCount: completedSet.size,
          activeMissionId: activeQuest.progress.activeMissionId,
          missions: activeQuest.missions.map((m) => ({
            id: m.id,
            title: m.title,
            description: m.description,
            status: completedSet.has(m.id)
              ? 'completed'
              : m.id === activeQuest.progress.activeMissionId
              ? 'active'
              : 'locked',
            prerequisites: m.prerequisites || [],
            evaluationType: m.evaluationContract?.type || 'rubric',
            evaluationDescription: m.evaluationContract?.description || '',
          })),
          edges: activeQuest.edges.map((e) => ({
            source: e.source,
            target: e.target,
            optional: e.optional,
          })),
        }
      }

      const response = await fetch(`/api/v1/quests/${encodeURIComponent(targetId)}?projection=true`)
      if (!response.ok) {
        throw new Error(`Quest "${targetId}" not found.`)
      }
      return await response.json()
    },
  })

  useWebMCPTool({
    name: 'propose_quest_change',
    description: 'Propose a new mission or structural path change to the active quest. The change appears as a non-authoritative Ghost Node awaiting human approval.',
    inputSchema: {
      type: 'object',
      properties: {
        questId: { type: 'string', description: 'Optional quest ID. Defaults to active quest on page.' },
        expectedVersion: { type: 'number', description: 'Current known version of the quest document.' },
        mission: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Optional mission ID' },
            title: { type: 'string', description: 'Mission title' },
            description: { type: 'string', description: 'Mission description' },
            objective: { type: 'string' },
            mapSubtitle: { type: 'string' },
            evidencePrompt: { type: 'string' },
            evaluationContract: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['deterministic', 'rubric', 'hybrid'] },
                description: { type: 'string' },
              },
              required: ['type', 'description'],
            },
          },
          required: ['title', 'evaluationContract'],
        },
        connectFrom: {
          type: 'array',
          items: { type: 'string' },
          description: 'Mission IDs that lead to this proposed mission',
        },
        connectTo: {
          type: 'array',
          items: { type: 'string' },
          description: 'Mission IDs that this proposed mission should lead to',
        },
      },
      required: ['expectedVersion', 'mission', 'connectFrom'],
    },
    annotations: {
      readOnlyHint: false,
    },
    execute: async (payload: any) => {
      const targetId = payload.questId || activeQuest?.id || (typeof window !== 'undefined' ? localStorage.getItem('trazo_active_quest_id') : null)
      if (!targetId) {
        return { ok: false, error: 'No active quest on page. Call create_quest first.' }
      }

      const response = await fetch(`/api/v1/quests/${encodeURIComponent(targetId)}/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (response.status === 409) {
          return {
            ok: false,
            code: 'STALE_QUEST_VERSION',
            expectedVersion: payload.expectedVersion,
            currentVersion: result.currentVersion,
            message: result.message || 'Quest changed since your last read. Refresh state before proposing again.',
          }
        }
        throw new Error(result.error || `HTTP ${response.status}: Failed to propose quest change`)
      }

      if (result.quest) {
        setActiveQuest(result.quest)
      }

      return {
        ok: true,
        questId: targetId,
        version: result.quest?.version,
        proposal: {
          id: result.proposal?.id,
          status: result.proposal?.status,
          missionId: result.proposal?.mission?.id,
          title: result.proposal?.mission?.title,
        },
        message: 'Proposal is visible in TRAZO and awaits human approval.',
      }
    },
  })

  const handleAcceptProposal = useCallback(async (proposalId: string) => {
    if (!activeQuest) return
    try {
      const response = await fetch(`/api/v1/quests/${encodeURIComponent(activeQuest.id)}/proposals/${encodeURIComponent(proposalId)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedVersion: activeQuest.version }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 409) {
          const freshResp = await fetch(`/api/v1/quests/${encodeURIComponent(activeQuest.id)}`)
          if (freshResp.ok) {
            const freshQuest = await freshResp.json()
            setActiveQuest(freshQuest)
          }
          alert('El quest cambió recientemente. Se actualizó el mapa; por favor intenta de nuevo.')
          return
        }
        throw new Error(result.error || 'Error al aceptar propuesta')
      }
      if (result.quest) {
        setActiveQuest(result.quest)
      }
    } catch (err: any) {
      console.error('[TRAZO] Accept proposal failed:', err)
      setServerError(err.message || 'Error al aceptar propuesta')
    }
  }, [activeQuest])

  const handleRejectProposal = useCallback(async (proposalId: string) => {
    if (!activeQuest) return
    try {
      const response = await fetch(`/api/v1/quests/${encodeURIComponent(activeQuest.id)}/proposals/${encodeURIComponent(proposalId)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedVersion: activeQuest.version }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 409) {
          const freshResp = await fetch(`/api/v1/quests/${encodeURIComponent(activeQuest.id)}`)
          if (freshResp.ok) {
            const freshQuest = await freshResp.json()
            setActiveQuest(freshQuest)
          }
          alert('El quest cambió recientemente. Se actualizó el mapa; por favor intenta de nuevo.')
          return
        }
        throw new Error(result.error || 'Error al rechazar propuesta')
      }
      if (result.quest) {
        setActiveQuest(result.quest)
      }
    } catch (err: any) {
      console.error('[TRAZO] Reject proposal failed:', err)
      setServerError(err.message || 'Error al rechazar propuesta')
    }
  }, [activeQuest])


  const resetProfileScopedState = useCallback(() => {
    setActiveChapterId(course.chapters[0].id)
    setImplementationId('')
    setImplementationState(null)
    setGraphCourse(null)
    setSelectedMissionId(null)
    setEvidenceByMissionId({})
    setEvaluationStateByMissionId({})
    setInteractionHistoryByMissionId({})
    setRecommendedMissionId(null)
    setRecenterRequest(0)
    setAnnouncement('')
    setServerError(null)
  }, [])

  const handleIdentityComplete = useCallback((createdProfile: UserProfile) => {
    resetProfileScopedState()
    localStorage.setItem('trazo_active_user_id', createdProfile.userId)
    setActiveUserId(createdProfile.userId)
    setProfile(createdProfile)
    setProfileLoading(false)
    setIsCreatingProfile(false)
    setShowProfileSelection(false)
  }, [resetProfileScopedState])

  const handleProfileSelect = useCallback((userId: string) => {
    if (!userId || userId === activeUserId) {
      setShowProfileSelection(false)
      return
    }
    resetProfileScopedState()
    localStorage.setItem('trazo_active_user_id', userId)
    setActiveUserId(userId)
    setProfile(null)
    setProfileLoading(true)
    setShowProfileSelection(false)
    setIsCreatingProfile(false)
  }, [activeUserId, resetProfileScopedState])

  const handleRoleComplete = useCallback((updatedProfile: UserProfile) => {
    setProfile(updatedProfile)
    if (updatedProfile.learnerImplementationId) setImplementationId(updatedProfile.learnerImplementationId)
  }, [])

  const withProfileSwitcher = (content: ReactNode) => (
    <div className="profile-context-shell">
      <ProfileSwitcher profile={profile!} onOpen={() => setShowProfileSelection(true)} />
      {content}
    </div>
  )

  const loadImplementation = useCallback(async () => {
    if (!profile || profile.role !== 'learner' || !implementationId) return
    setIsLoading(true)
    setServerError(null)
    setGraphCourse(null)
    setGraphProgress(null)
    try {
      const headers = { 'X-Trazo-User-Id': profile.userId }
      let res = await fetch(`/api/v1/implementations/${implementationId}`, { headers })
      if (res.status === 404) {
        res = await fetch('/api/v1/implementations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({
            id: implementationId,
            courseId: staticCourse.id,
            courseVersion: '1.0.0',
          }),
        })
      }
      if (!res.ok) {
        throw new Error(`Error al conectar con el backend (${res.status}): ${res.statusText}`)
      }
      const data: ImplementationState = await res.json()
      setImplementationState(data)
      const graphResponse = await fetch(`/api/v1/implementations/${encodeURIComponent(implementationId)}/methodology`, { headers })
      if (graphResponse.ok) {
        const graphView = await graphResponse.json() as {
          course?: Course
          progress?: Record<string, ProgressState>
        }
        if (graphView.course) setGraphCourse(graphView.course)
        if (graphView.progress) setGraphProgress(graphView.progress)
      }
    } catch {
      setServerError('No se pudo conectar con el estado de aprendizaje. Intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }, [implementationId, profile, staticCourse.id])

  useEffect(() => {
    void loadImplementation()
  }, [loadImplementation])

  const completedMissionIds = useMemo(
    () => new Set(implementationState?.completedMissionIds ?? []),
    [implementationState?.completedMissionIds],
  )

  const activeChapter =
    course.chapters.find((chapter) => chapter.id === activeChapterId) ?? course.chapters[0]

  const progress = useMemo(
    () => graphProgress ?? deriveMissionProgress(activeChapter.missions, completedMissionIds),
    [activeChapter.missions, completedMissionIds, graphProgress],
  )

  const availableMissions = useMemo(
    () =>
      activeChapter.missions.filter(
        (m) => progress[m.id] === 'available' || progress[m.id] === 'active',
      ),
    [activeChapter.missions, progress],
  )

  const selectedMission = activeChapter.missions.find(
    (mission) => mission.id === selectedMissionId,
  )
  const activeMission = activeChapter.missions.find(
    (mission) =>
      mission.id ===
      (activeQuest?.progress?.activeMissionId || implementationState?.activeMissionId),
  )
  const visualProgress = useMemo(() => {
    if (!activeMission || !['available', 'active', 'submitted'].includes(progress[activeMission.id])) {
      return progress
    }

    return {
      ...progress,
      [activeMission.id]: 'active' as const,
    }
  }, [activeMission, progress])
  const lockedReasons = useMemo(
    () =>
      Object.fromEntries(
        activeChapter.missions.map((mission) => [
          mission.id,
          progress[mission.id] === 'locked'
            ? formatLockedReason(mission, activeChapter.missions, completedMissionIds)
            : undefined,
        ]),
      ),
    [activeChapter.missions, completedMissionIds, progress],
  )
  const completedCount = Object.values(progress).filter(
    (state) => state === 'completed',
  ).length

  const artifactLabels = useMemo(() => {
    const labels: Record<string, string> = {}
    for (const mission of activeChapter.missions) {
      for (const spec of mission.artifactProductions ?? []) {
        if (spec.displayLabel) labels[spec.key] = spec.displayLabel
      }
    }
    return labels
  }, [activeChapter.missions])

  const handleChapterSelect = useCallback((chapter: Chapter) => {
    setActiveChapterId(chapter.id)
    setSelectedMissionId(null)
    setRecommendedMissionId(null)
    setRecenterRequest((request) => request + 1)
  }, [])

  const handleMissionSelect = useCallback((missionId: string) => {
    setSelectedMissionId(missionId)
  }, [])

  const handleClosePanel = useCallback(() => {
    const missionId = selectedMissionId
    setSelectedMissionId(null)
    window.requestAnimationFrame(() => {
      if (missionId) document.getElementById(`mission-node-${missionId}`)?.focus()
    })
  }, [selectedMissionId])

  const handleEvidenceChange = useCallback((missionId: string, evidence: string) => {
    setEvidenceByMissionId((current) => ({ ...current, [missionId]: evidence }))
  }, [])

  const handleStartMission = useCallback(
    async (missionId: string) => {
      try {
        const res = await fetch(`/api/v1/implementations/${implementationId}/start-mission`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Trazo-User-Id': profile?.userId ?? '' },
          body: JSON.stringify({ missionId }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || `Error iniciando misión (${res.status})`)
        }

        const updatedState: ImplementationState = await res.json()
        setImplementationState(updatedState)
        setSelectedMissionId(missionId)
        const missionTitle =
          activeChapter.missions.find((m) => m.id === missionId)?.title ?? missionId
        setAnnouncement(`Misión activa iniciada: ${missionTitle}`)
      } catch {
        setAnnouncement('No se pudo iniciar la misión. Intenta de nuevo.')
      }
    },
    [activeChapter.missions, implementationId, profile?.userId],
  )

  const handleSubmitEvidence = useCallback(
    async (missionId: string) => {
      if (!['available', 'active', 'submitted', 'completed'].includes(progress[missionId])) return
      const evidenceText = evidenceByMissionId[missionId]?.trim()
      if (!evidenceText) return
      const recentInteraction = interactionHistoryByMissionId[missionId]?.slice(-4) ?? []

      // Set evaluating UI state
      setEvaluationStateByMissionId((current) => ({
        ...current,
        [missionId]: { status: 'evaluating' },
      }))

      try {
        // TASK-004: Real Verified Action Submission Pipeline
        const res = await fetch(`/api/v1/implementations/${implementationId}/submissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Trazo-User-Id': profile?.userId ?? '' },
          body: JSON.stringify({
            missionId,
            evidence: {
              type: 'text',
              text: evidenceText,
            },
            recentInteraction,
          }),
        })

        if (!res.ok) {
          const errorData: unknown = await res.json().catch(() => null)
          const responseCode =
            typeof errorData === 'object' && errorData !== null && 'code' in errorData
              ? (errorData as { code?: unknown }).code
              : undefined
          throw normalizeSubmissionFailure(res.status, responseCode)
        }

        const data: SubmissionResponseDTO = await res.json()

        const interactionType = data.interactionType || 'EVIDENCE_SUBMISSION'
        let evalStatus: EvaluationStatus = 'system_error'

        if (interactionType === 'CONVERSATION') {
          evalStatus = 'conversation'
        } else if (interactionType === 'AMBIGUOUS') {
          evalStatus = 'ambiguous'
        } else {
          const statusMap = {
            PASS: 'pass',
            CLARIFY: 'clarify',
            REWORK: 'rework',
            HUMAN_REVIEW: 'human_review',
          } as const
          evalStatus = statusMap[data.policyVerdict] || 'system_error'
        }

        setEvaluationStateByMissionId((current) => ({
          ...current,
          [missionId]: {
            status: evalStatus,
            interactionType,
            message: data.message,
            evaluation: data.evaluation,
            policyVerdict: data.policyVerdict,
          },
        }))
        const companionMessage = data.message || data.evaluation?.coachingFeedback
        setInteractionHistoryByMissionId((current) => ({
          ...current,
          [missionId]: [
            ...(current[missionId] ?? []),
            { role: 'learner' as const, content: evidenceText },
            ...(companionMessage ? [{ role: 'companion' as const, content: companionMessage }] : []),
          ].slice(-6),
        }))

        if (interactionType === 'CONVERSATION' || interactionType === 'AMBIGUOUS' || data.completed) {
          setEvidenceByMissionId((current) => ({ ...current, [missionId]: '' }))
        }

        // IF PASS: Apply authoritative updated state returned from backend (NO OPTIMISTIC COMPLETION)
        if (data.completed) {
          const nextCompleted = new Set(data.state.completedMissionIds)
          const nextProgress = deriveMissionProgress(activeChapter.missions, nextCompleted)
          const missionTitle =
            activeChapter.missions.find((mission) => mission.id === missionId)?.title ?? missionId
          const unlockedTitles = activeChapter.missions
            .filter(
              (mission) =>
                progress[mission.id] === 'locked' &&
                nextProgress[mission.id] === 'available',
            )
            .map((mission) => mission.title)

          setImplementationState(data.state)
          setAnnouncement(
            unlockedTitles.length > 0
              ? `Acción verificada. ${missionTitle} completada. Se desbloqueó: ${unlockedTitles.join(', ')}.`
              : `Acción verificada. ${missionTitle} completada.`,
          )
        } else {
          // IF NOT PASS: Implementation state is NOT mutated; announce coaching feedback
          setAnnouncement(
            data.message ||
              data.evaluation?.coachingFeedback ||
              `El Acompañante solicita ajustes (${data.policyVerdict}).`,
          )
        }
      } catch (err: unknown) {
        const systemError = isSystemEvaluationError(err)
          ? err
          : normalizeSubmissionFailure()
        setEvaluationStateByMissionId((current) => ({
          ...current,
          [missionId]: {
            status: 'system_error',
            systemError,
          },
        }))
        setAnnouncement('No pude verificar esto ahora. Tu evidencia sigue disponible.')
      }
    },
    [
      activeChapter.missions,
      evidenceByMissionId,
      implementationId,
      interactionHistoryByMissionId,
      profile?.userId,
      progress,
    ],
  )

  if (!activeQuest) {
    if (!activeUserId) {
      return <IdentityEntry onComplete={handleIdentityComplete} />
    }

    if (showProfileSelection && profile) {
      return (
        <ProfileSelection
          activeProfileId={profile.userId}
          onSelect={handleProfileSelect}
          onCreate={() => {
            setShowProfileSelection(false)
            setIsCreatingProfile(true)
          }}
          onClose={() => setShowProfileSelection(false)}
        />
      )
    }

    if (isCreatingProfile) {
      return <IdentityEntry onComplete={handleIdentityComplete} onCancel={() => setIsCreatingProfile(false)} />
    }

    if (profileLoading) {
      return <div className="entry-shell"><p className="entry-loading">Cargando tu recorrido…</p></div>
    }

    if (!profile) {
      return (
        <div className="entry-shell">
          <div className="entry-card" role="alert">
            <p className="entry-kicker">TRAZO</p>
            <h1>No pudimos cargar tu recorrido</h1>
            <p className="entry-copy">{serverError ?? 'Intenta cargar tu perfil otra vez.'}</p>
            <button
              type="button"
              className="entry-primary-button"
              onClick={() => {
                setServerError(null)
                setProfileLoading(true)
                void fetch(`/api/v1/profiles/${encodeURIComponent(activeUserId)}`)
                  .then(async (response) => {
                    if (!response.ok) throw new Error('No se pudo cargar tu perfil.')
                    return (await response.json()) as UserProfile
                  })
                  .then(setProfile)
                  .catch(() => setServerError('No se pudo cargar tu perfil. Intenta de nuevo.'))
                  .finally(() => setProfileLoading(false))
              }}
            >
              Reintentar
            </button>
          </div>
        </div>
      )
    }

    if (!profile.role) {
      return withProfileSwitcher(<RoleGateway profile={profile} onComplete={handleRoleComplete} />)
    }

    if (profile.role === 'coach' && !profile.coachSetup) {
      return withProfileSwitcher(<CoachIntro profile={profile} onComplete={setProfile} />)
    }

    if (profile.role === 'coach') {
      const calibrationMission =
        course.chapters[0].missions.find((mission) => mission.mapRole === 'entry') ??
        course.chapters[0].missions[0]
      return withProfileSwitcher(<CreatorCalibrationView userId={profile.userId} initialMode={profile.coachSetup?.calibrationMode} mission={calibrationMission} />)
    }

    if (isLoading) {
      return withProfileSwitcher(
        <div className="app-shell" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
          <p style={{ color: 'var(--trazo-ink)', fontStyle: 'italic' }}>
            Cargando estado de implementación desde el backend...
          </p>
        </div>,
      )
    }

    if (serverError) {
      return withProfileSwitcher(
        <div className="app-shell" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24 }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <h2 style={{ color: 'var(--trazo-ink)' }}>Error de conexión con el backend</h2>
            <p style={{ color: 'var(--trazo-muted)', margin: '12px 0 20px' }}>{serverError}</p>
            <button
              type="button"
              className="submit-evidence-button"
              onClick={() => void loadImplementation()}
            >
              Reintentar conexión
            </button>
          </div>
        </div>,
      )
    }

    if (!implementationState?.learnerSetup) {
      return withProfileSwitcher(<LearnerQuickSetup userId={profile.userId} implementationId={implementationId} onComplete={setImplementationState} />)
    }
  }

  const effectiveProfile: UserProfile = profile ?? {
    userId: 'guest-learner',
    displayName: 'Explorador Quest',
    role: 'learner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  return (
    <div className="app-shell">
      <ChapterNavigation
        course={course}
        activeChapterId={activeChapter.id}
        onChapterSelect={handleChapterSelect}
      />
      <main className="map-stage">
        <HudBar
          chapterNumber={activeChapter.shortTitle}
          chapterTitle={activeChapter.title.replace(/^Chapter\s+\d+\s+·\s*/i, '')}
          completed={completedCount}
          total={activeChapter.missions.length}
          activeMissionTitle={activeMission?.title}
          profile={effectiveProfile}
          onProfileOpen={() => setShowProfileSelection(true)}
          onRecenter={() => setRecenterRequest((request) => request + 1)}
        />
        <QuestMap
          userId={effectiveProfile.userId}
          chapter={activeChapter}
          progress={visualProgress}
          evaluationStateByMissionId={evaluationStateByMissionId}
          recommendedMissionId={recommendedMissionId}
          selectedMissionId={selectedMissionId}
          lockedReasons={lockedReasons}
          recenterRequest={recenterRequest}
          onMissionSelect={handleMissionSelect}
          implementationId={implementationId}
          availableMissions={availableMissions}
          onStartMission={handleStartMission}
          onRecommendationChange={setRecommendedMissionId}
          activeMissionId={activeMission?.id}
          isEvaluating={selectedMissionId ? evaluationStateByMissionId[selectedMissionId]?.status === 'evaluating' : false}
          isVerifiedAction={selectedMissionId ? evaluationStateByMissionId[selectedMissionId]?.policyVerdict === 'PASS' : false}
          pendingProposals={questViewModel?.pendingProposals}
          onAcceptProposal={handleAcceptProposal}
          onRejectProposal={handleRejectProposal}
        />


      </main>

      {selectedMission && (
        <MissionPanel
          key={selectedMission.id}
          mission={selectedMission}
          progressState={visualProgress[selectedMission.id]}
          lockedReason={lockedReasons[selectedMission.id]}
          prerequisiteSummary={getPrerequisiteSummary(selectedMission, activeChapter)}
          unlockSummary={getUnlockSummary(selectedMission, activeChapter)}
          evidence={evidenceByMissionId[selectedMission.id] ?? ''}
          interactionHistory={interactionHistoryByMissionId[selectedMission.id] ?? []}
          evaluationState={evaluationStateByMissionId[selectedMission.id]}
          artifacts={implementationState?.artifacts}
          artifactLabels={artifactLabels}
          onClose={handleClosePanel}
          onEvidenceChange={handleEvidenceChange}
          onSubmitEvidence={handleSubmitEvidence}
        />
      )}

      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  )
}
