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
  const [selectedPackId] = useState(() => selectDemoPackId())
  const staticCourse = useMemo(() => resolvePack(selectedPackId), [selectedPackId])
  const [graphCourse, setGraphCourse] = useState<Course | null>(null)
  const [graphProgress, setGraphProgress] = useState<Record<string, ProgressState> | null>(null)
  const course = graphCourse ?? staticCourse
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

  // WebMCP Smoke Test: Expose create_quest_smoke_test tool on document.modelContext
  useEffect(() => {
    if (typeof document === 'undefined') return

    // Ensure document.modelContext exists (native in Chrome/ChatGPT or minimal polyfill container)
    if (!(document as any).modelContext) {
      const toolRegistry: any[] = []
      ;(document as any).modelContext = {
        registerTool: (toolDef: any, options?: { signal?: AbortSignal }) => {
          toolRegistry.push(toolDef)
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              const idx = toolRegistry.indexOf(toolDef)
              if (idx !== -1) toolRegistry.splice(idx, 1)
            })
          }
          return {
            unregister: () => {
              const idx = toolRegistry.indexOf(toolDef)
              if (idx !== -1) toolRegistry.splice(idx, 1)
            },
          }
        },
        getRegisteredTools: () => [...toolRegistry],
      }
    }

    const modelContext = (document as any).modelContext ?? (navigator as any).modelContext
    if (!modelContext?.registerTool) return

    const controller = new AbortController()

    const executeSmokeTest = async ({ goal }: { goal?: string }) => {
      const goalTitle = goal || 'Analizar inflación en México'
      const smokeCourse: Course = {
        id: 'smoke-quest-course',
        title: goalTitle,
        chapters: [
          {
            id: 'smoke-chapter-1',
            title: goalTitle,
            shortTitle: 'Misiones',
            mapPromise: 'Recorrido dinámico generado vía WebMCP',
            missions: [
              {
                id: 'M1',
                title: 'Obtener datos de inflación',
                nodeType: 'normal',
                mapRole: 'entry',
                mapSubtitle: 'INEGI / Banxico',
                progressState: 'available',
                position: { x: 180, y: 160 },
                description: 'Descargar e inspeccionar la serie histórica del INPC.',
                evidenceType: 'text',
                evidencePrompt: 'Pega el resumen del dataset descargado.',
                evidenceCriteria: 'Debe contener la serie temporal del INPC.',
              },
              {
                id: 'M2',
                title: 'Evaluar estacionariedad',
                nodeType: 'normal',
                mapSubtitle: 'Test ADF',
                progressState: 'locked',
                prerequisites: ['M1'],
                position: { x: 440, y: 160 },
                description: 'Aplicar prueba de Dickey-Fuller aumentada (ADF).',
                evidenceType: 'text',
                evidencePrompt: 'Pega el estadístico ADF y su p-value.',
                evidenceCriteria: 'Debe reportar estadístico t y p-valor.',
              },
              {
                id: 'M3',
                title: 'Interpretar resultado económico',
                nodeType: 'milestone',
                mapRole: 'convergence',
                mapSubtitle: 'Diagnóstico',
                progressState: 'locked',
                prerequisites: ['M2'],
                position: { x: 700, y: 160 },
                description: 'Explicar las implicaciones macroeconómicas.',
                evidenceType: 'text',
                evidencePrompt: 'Pega tu conclusión económica breve.',
                evidenceCriteria: 'Debe concluir si requiere primeras diferencias.',
              },
            ],
            edges: [
              { id: 'edge-m1-m2', source: 'M1', target: 'M2' },
              { id: 'edge-m2-m3', source: 'M2', target: 'M3' },
            ],
          },
        ],
      }

      setGraphCourse(smokeCourse)
      setActiveChapterId('smoke-chapter-1')
      setSelectedMissionId('M1')
      setGraphProgress({
        M1: 'available',
        M2: 'locked',
        M3: 'locked',
      })
      setImplementationState({
        id: 'impl-smoke',
        userId: 'guest-learner',
        courseId: 'smoke-quest-course',
        completedMissionIds: [],
        activeMissionId: 'M1',
        learnerSetup: {
          goal: goalTitle,
          availableTime: '15_30_MIN',
          helpPreference: 'DIRECT',
          updatedAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      setProfile({
        userId: 'guest-learner',
        displayName: 'Explorador Quest',
        role: 'learner',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      setProfileLoading(false)
      setServerError(null)

      return {
        ok: true,
        goal: goalTitle,
        missionCount: 3,
        missionIds: ['M1', 'M2', 'M3'],
      }
    }

    try {
      modelContext.registerTool(
        {
          name: 'create_quest_smoke_test',
          description: 'Creates a temporary 3-node quest on the live canvas for WebMCP smoke testing.',
          inputSchema: {
            type: 'object',
            properties: {
              goal: { type: 'string', description: 'The user goal (e.g. Analyze Mexican inflation)' },
            },
            required: ['goal'],
          },
          execute: executeSmokeTest,
        },
        { signal: controller.signal },
      )

      // Expose debug invoker on window for automated/manual tests
      ;(window as any).__trazo_invoke_smoke_test = executeSmokeTest
    } catch (err) {
      console.warn('[WebMCP] Failed to register smoke test tool:', err)
    }

    return () => {
      controller.abort()
      delete (window as any).__trazo_invoke_smoke_test
    }
  }, [])

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
    (mission) => mission.id === implementationState?.activeMissionId,
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
          profile={profile}
          onProfileOpen={() => setShowProfileSelection(true)}
          onRecenter={() => setRecenterRequest((request) => request + 1)}
        />
        <QuestMap
          userId={profile.userId}
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
