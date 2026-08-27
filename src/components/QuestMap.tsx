import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  ReactFlow,
  ReactFlowProvider,
  type Node,
  type NodeTypes,
  type ReactFlowInstance,
  getBezierPath,
  Position,
} from '@xyflow/react'
import type {
  Chapter,
  MapPosition,
  Mission,
  MissionEvaluationState,
  MissionProgress,
  ProgressState,
} from '../domain/course'
import type { QuestProposal } from '../domain/quest'
import { deriveEdgeProgress } from '../domain/progression'
import { CompanionAvatar, type CompanionHandle } from './CompanionAvatar'
import { JunctionNode } from './JunctionNode'
import { MapControls } from './MapControls'
import { QuestEdge, smoothSplineThroughVia, type QuestFlowEdge } from './QuestEdge'
import { QuestNode, type QuestFlowNode } from './QuestNode'
import { TerritoryNode, type TerritoryFlowNode } from './TerritoryNode'

interface QuestMapProps {
  userId: string
  chapter: Chapter
  progress: MissionProgress
  evaluationStateByMissionId: Record<string, MissionEvaluationState>
  recommendedMissionId: string | null
  selectedMissionId: string | null
  lockedReasons: Record<string, string | undefined>
  recenterRequest: number
  onMissionSelect: (missionId: string) => void
  implementationId: string
  availableMissions: Mission[]
  onStartMission: (missionId: string) => Promise<void>
  onRecommendationChange: (missionId: string | null) => void
  activeMissionId?: string
  isEvaluating?: boolean
  isVerifiedAction?: boolean
  pendingProposals?: QuestProposal[]
  onAcceptProposal?: (proposalId: string) => Promise<void>
  onRejectProposal?: (proposalId: string) => Promise<void>
}

interface JunctionNodeData extends Record<string, unknown> {
  decorative: true
}

type JunctionFlowNode = Node<JunctionNodeData, 'junction'>
type MapNode = QuestFlowNode | JunctionFlowNode | TerritoryFlowNode

const nodeTypes = {
  quest: QuestNode,
  junction: JunctionNode,
  territory: TerritoryNode,
} satisfies NodeTypes

const edgeTypes = { quest: QuestEdge }

const nodeDimensions = {
  normal: 88,
  optional: 72,
  milestone: 160,
} as const

function getNodeDimension(mission: Mission) {
  if (mission.mapRole === 'entry' || mission.mapRole === 'convergence') return 104
  return nodeDimensions[mission.nodeType]
}

function getCompanionRestPosition(mission: Mission): MapPosition {
  const dim = getNodeDimension(mission)
  return {
    x: mission.position.x + dim + 16,
    y: mission.position.y + dim / 2,
  }
}

function ViewportOverlay({
  containerRef,
  children,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
  children: ReactNode
}) {
  const [viewportEl, setViewportEl] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const el =
      (containerRef.current?.querySelector('.react-flow__viewport') as HTMLElement | null) ||
      (document.querySelector('.react-flow__viewport') as HTMLElement | null)
    if (el) {
      setViewportEl(el)
    }
  }, [containerRef])

  if (!viewportEl) {
    return <>{children}</>
  }

  return createPortal(children, viewportEl)
}

function QuestMapCanvas({
  userId,
  chapter,
  progress,
  evaluationStateByMissionId,
  recommendedMissionId,
  selectedMissionId,
  lockedReasons,
  recenterRequest,
  onMissionSelect,
  implementationId,
  availableMissions,
  onStartMission,
  onRecommendationChange,
  activeMissionId,
  isEvaluating,
  isVerifiedAction,
  pendingProposals,
  onAcceptProposal,
  onRejectProposal,
}: QuestMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const companionRef = useRef<CompanionHandle>(null)
  const previousMissionIdRef = useRef<string | null>(selectedMissionId || activeMissionId || null)
  const [instance, setInstance] = useState<ReactFlowInstance<MapNode, QuestFlowEdge> | null>(null)
  const [hoveredMissionId, setHoveredMissionId] = useState<string | null>(null)
  const [cameraZoom, setCameraZoom] = useState(1)

  const activeOrInitialMission =
    chapter.missions.find((m) => m.id === (selectedMissionId || activeMissionId)) ||
    chapter.missions[0]

  const companionInitialPos = useMemo(() => {
    if (!activeOrInitialMission) return { x: 0, y: 0 }
    return getCompanionRestPosition(activeOrInitialMission)
  }, [activeOrInitialMission])

  const cameraDuration =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : 150

  const fitMap = useCallback(() => {
    if (!instance) return
    void instance.fitView({
      padding: 0.08,
      minZoom: 0.4,
      maxZoom: 1.05,
      duration: cameraDuration,
    })
  }, [cameraDuration, instance])

  const nodes = useMemo<MapNode[]>(() => {
    const missionNodes: QuestFlowNode[] = chapter.missions.map((mission) => ({
      id: mission.id,
      type: 'quest',
      position: mission.position,
      draggable: false,
      selectable: true,
      connectable: false,
      focusable: false,
      zIndex: 3,
      data: {
        mission,
        progressState: progress[mission.id],
        evaluationStatus: evaluationStateByMissionId[mission.id]?.status,
        recommended: mission.id === recommendedMissionId,
        selected: mission.id === selectedMissionId,
        lockedReason: lockedReasons[mission.id],
        onSelect: onMissionSelect,
        onHover: setHoveredMissionId,
      },
    }))

    const ghostNodes: QuestFlowNode[] = (pendingProposals || []).map((proposal) => ({
      id: proposal.mission.id,
      type: 'quest' as const,
      position: proposal.mission.position,
      draggable: false,
      selectable: true,
      connectable: false,
      focusable: false,
      zIndex: 4,
      data: {
        mission: {
          id: proposal.mission.id,
          title: proposal.mission.title,
          description: proposal.mission.description,
          nodeType: proposal.mission.nodeType,
          mapRole: proposal.mission.mapRole,
          mapSubtitle: proposal.mission.mapSubtitle,
          position: proposal.mission.position,
          prerequisites: proposal.mission.prerequisites,
          evidenceType: 'text',
          evidencePrompt: proposal.mission.evidencePrompt,
          evidenceCriteria: proposal.mission.evaluationContract?.description || '',
          progressState: 'locked' as ProgressState,
        },
        progressState: 'locked' as ProgressState,
        recommended: false,
        selected: proposal.mission.id === selectedMissionId,
        lockedReason: 'Propuesta esperando aprobación humana',
        onSelect: onMissionSelect,
        onHover: setHoveredMissionId,
        isGhost: true,
        proposalId: proposal.id,
        onAcceptProposal,
        onRejectProposal,
      },
    }))

    const junctionNodes: JunctionFlowNode[] = (chapter.junctions ?? []).map(
      (junction) => ({
        id: junction.id,
        type: 'junction' as const,
        position: {
          x: junction.position.x - 3,
          y: junction.position.y - 3,
        },
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
        deletable: false,
        zIndex: 4,
        data: { decorative: true },
      }),
    )

    const territoryNodes: TerritoryFlowNode[] = (chapter.regions ?? []).map(
      (region) => ({
        id: region.id,
        type: 'territory' as const,
        position: region.position,
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
        deletable: false,
        zIndex: 0,
        style: { width: region.width, height: region.height },
        data: { region },
      }),
    )

    return [...territoryNodes, ...missionNodes, ...ghostNodes, ...junctionNodes]
  }, [
    chapter,
    evaluationStateByMissionId,
    lockedReasons,
    onAcceptProposal,
    onMissionSelect,
    onRejectProposal,
    pendingProposals,
    progress,
    recommendedMissionId,
    selectedMissionId,
  ])

  const edges = useMemo<QuestFlowEdge[]>(
    () => {
      const nodeTypeById = new Map(
        chapter.missions.map((mission) => [mission.id, mission.nodeType]),
      )

      const canonicalEdges: QuestFlowEdge[] = chapter.edges.map((edge) => {
        const sourceState = progress[edge.source]
        const targetState = progress[edge.target]
        const routeTier =
          sourceState === 'completed' && targetState === 'completed'
            ? 'traveled'
            : sourceState === 'completed' &&
                ['available', 'active', 'submitted'].includes(targetState)
              ? 'immediate'
              : 'future'

        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'quest' as const,
          focusable: false,
          selectable: false,
          zIndex: 1,
          data: {
            progressState: deriveEdgeProgress(edge, progress),
            routeTier,
            optional: edge.optional ?? false,
            highlighted:
              hoveredMissionId === edge.source || hoveredMissionId === edge.target,
            leadsToMilestone: nodeTypeById.get(edge.target) === 'milestone',
            via: edge.via,
          },
        }
      })

      const ghostEdges: QuestFlowEdge[] = []
      for (const proposal of pendingProposals || []) {
        for (const fromId of proposal.connectFrom) {
          ghostEdges.push({
            id: `ghost_edge_${fromId}_${proposal.mission.id}`,
            source: fromId,
            target: proposal.mission.id,
            type: 'quest' as const,
            focusable: false,
            selectable: false,
            zIndex: 1,
            data: {
              progressState: 'locked',
              routeTier: 'future',
              optional: true,
              highlighted: hoveredMissionId === fromId || hoveredMissionId === proposal.mission.id,
              leadsToMilestone: false,
              isGhost: true,
            },
          })
        }
        for (const toId of proposal.connectTo || []) {
          ghostEdges.push({
            id: `ghost_edge_${proposal.mission.id}_${toId}`,
            source: proposal.mission.id,
            target: toId,
            type: 'quest' as const,
            focusable: false,
            selectable: false,
            zIndex: 1,
            data: {
              progressState: 'locked',
              routeTier: 'future',
              optional: true,
              highlighted: hoveredMissionId === proposal.mission.id || hoveredMissionId === toId,
              leadsToMilestone: false,
              isGhost: true,
            },
          })
        }
      }

      return [...canonicalEdges, ...ghostEdges]
    },
    [chapter.edges, chapter.missions, hoveredMissionId, pendingProposals, progress],
  )



  useEffect(() => {
    if (!selectedMissionId || selectedMissionId === previousMissionIdRef.current) return
    const prevId = previousMissionIdRef.current
    previousMissionIdRef.current = selectedMissionId

    const targetMission = chapter.missions.find((item) => item.id === selectedMissionId)
    if (!targetMission) return

    const targetRestPos = getCompanionRestPosition(targetMission)

    if (prevId) {
      const edge = chapter.edges.find(
        (item) =>
          (item.source === prevId && item.target === selectedMissionId) ||
          (item.target === prevId && item.source === selectedMissionId),
      )
      const prevMission = chapter.missions.find((item) => item.id === prevId)
      if (edge && prevMission) {
        const prevDim = getNodeDimension(prevMission)
        const targetDim = getNodeDimension(targetMission)
        const isForward = edge.source === prevId
        const sourceX = isForward
          ? prevMission.position.x + prevDim
          : targetMission.position.x + targetDim
        const sourceY = isForward
          ? prevMission.position.y + prevDim / 2
          : targetMission.position.y + targetDim / 2
        const targetX = isForward
          ? targetMission.position.x
          : prevMission.position.x
        const targetY = isForward
          ? targetMission.position.y + targetDim / 2
          : prevMission.position.y + prevDim / 2

        const edgePath = edge.via
          ? smoothSplineThroughVia(sourceX, sourceY, targetX, targetY, edge.via)
          : getBezierPath({
              sourceX,
              sourceY,
              targetX,
              targetY,
              sourcePosition: Position.Right,
              targetPosition: Position.Left,
              curvature: 0.34,
            })[0]

        companionRef.current?.moveToNode(edgePath, selectedMissionId)
        return
      }

      if (prevMission) {
        const prevRestPos = getCompanionRestPosition(prevMission)
        const fallbackPath = `M ${prevRestPos.x} ${prevRestPos.y} L ${targetRestPos.x} ${targetRestPos.y}`
        companionRef.current?.moveToNode(fallbackPath, selectedMissionId)
        return
      }
    }

    companionRef.current?.teleportTo(targetRestPos)
  }, [chapter.edges, chapter.missions, selectedMissionId])

  useEffect(() => {
    if (!instance || recenterRequest === 0) return
    fitMap()
  }, [fitMap, instance, recenterRequest])

  useEffect(() => {
    if (!instance || !mapContainerRef.current || selectedMissionId || !activeOrInitialMission) return
    if (mapContainerRef.current.clientWidth > 640) return

    const size = getNodeDimension(activeOrInitialMission)
    const timer = window.setTimeout(() => {
      void instance.setCenter(
        activeOrInitialMission.position.x + size / 2,
        activeOrInitialMission.position.y + size / 2,
        { zoom: 0.72, duration: 0 },
      )
    }, 80)

    return () => window.clearTimeout(timer)
  }, [activeOrInitialMission, instance, selectedMissionId])

  useEffect(() => {
    if (!instance || !selectedMissionId || !mapContainerRef.current) return
    const mission = chapter.missions.find((item) => item.id === selectedMissionId)
    if (!mission) return

    const mapWidth = mapContainerRef.current.clientWidth
    const panelWidth = Math.min(460, Math.max(360, mapWidth * 0.32))
    const zoom = instance.getZoom()
    const size = getNodeDimension(mission)
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const centerX = mission.position.x + size / 2 + panelWidth / (2 * zoom)
    const centerY = mission.position.y + size / 2

    void instance.setCenter(centerX, centerY, {
      zoom,
      duration: reducedMotion ? 0 : 250,
    })
  }, [chapter.missions, instance, selectedMissionId])

  function handleKeyboardPan(event: KeyboardEvent<HTMLDivElement>) {
    if (!instance || event.target !== event.currentTarget) return
    const step = event.shiftKey ? 96 : 48
    const viewport = instance.getViewport()
    const offsets: Partial<Record<string, { x: number; y: number }>> = {
      ArrowLeft: { x: step, y: 0 },
      ArrowRight: { x: -step, y: 0 },
      ArrowUp: { x: 0, y: step },
      ArrowDown: { x: 0, y: -step },
    }
    const offset = offsets[event.key]
    if (!offset) return
    event.preventDefault()
    void instance.setViewport(
      {
        x: viewport.x + offset.x,
        y: viewport.y + offset.y,
        zoom: viewport.zoom,
      },
      { duration: 0 },
    )
  }

  return (
    <div
      ref={mapContainerRef}
      id="quest-map"
      className="quest-map"
      tabIndex={0}
      aria-label="Lienzo del mapa de misiones"
      aria-describedby="quest-map-instructions"
      onKeyDown={handleKeyboardPan}
    >
      <p id="quest-map-instructions" className="visually-hidden">
        Mapa de misiones. Usa Tab para recorrer las misiones y Enter para abrir sus detalles.
        Usa las flechas para desplazar el mapa y los controles para acercar, alejar o volver a
        encuadrar la ruta.
        {chapter.regions && chapter.regions.length > 0 && (
          <> El capítulo recorre {chapter.regions.length} territorios: {chapter.regions.map((region) => `${region.title}, ${region.description.toLocaleLowerCase('es-MX')}`).join('; ')}.</>
        )}
      </p>
      <ReactFlow<MapNode, QuestFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={setInstance}
        onMove={(_event, viewport) => setCameraZoom(viewport.zoom)}
        minZoom={0.4}
        maxZoom={1.5}
        fitView
        fitViewOptions={{ padding: 0.08, minZoom: 0.4, maxZoom: 1.05 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        zoomOnDoubleClick={false}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        preventScrolling
        aria-label="Mapa visual de misiones"
        proOptions={{ hideAttribution: true }}
      >
        <ViewportOverlay containerRef={mapContainerRef}>
          <CompanionAvatar
            ref={companionRef}
            initialPosition={companionInitialPos}
            userId={userId}
            implementationId={implementationId}
            activeMissionId={activeMissionId}
            availableMissions={availableMissions}
            onStartMission={onStartMission}
            onSelectMission={onMissionSelect}
            onRecommendationChange={onRecommendationChange}
            isEvaluating={isEvaluating}
            isVerifiedAction={isVerifiedAction}
          />
        </ViewportOverlay>
      </ReactFlow>
      <MapControls
        zoom={cameraZoom}
        disabled={!instance}
        onZoomIn={() => void instance?.zoomIn({ duration: cameraDuration })}
        onZoomOut={() => void instance?.zoomOut({ duration: cameraDuration })}
        onFit={fitMap}
      />
    </div>
  )
}

export function QuestMap(props: QuestMapProps) {
  return (
    <ReactFlowProvider>
      <QuestMapCanvas {...props} />
    </ReactFlowProvider>
  )
}
