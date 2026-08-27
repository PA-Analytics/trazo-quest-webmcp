import { memo } from 'react'
import {
  Handle,
  Position,
  useViewport,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import type { EvaluationStatus, Mission, ProgressState } from '../domain/course'
import { nodeTypeLabels, progressLabels } from '../presentation/labels'
import { MissionIcon, StateBadge } from './icons'

export interface QuestNodeData extends Record<string, unknown> {
  mission: Mission
  progressState: ProgressState
  evaluationStatus?: EvaluationStatus
  recommended: boolean
  selected: boolean
  lockedReason?: string
  onSelect: (missionId: string) => void
  onHover: (missionId: string | null) => void
  isGhost?: boolean
  proposalId?: string
  onAcceptProposal?: (proposalId: string) => void
  onRejectProposal?: (proposalId: string) => void
}

export type QuestFlowNode = Node<QuestNodeData, 'quest'>

export const QuestNode = memo(function QuestNode({ data }: NodeProps<QuestFlowNode>) {
  const {
    mission,
    progressState,
    evaluationStatus,
    recommended,
    selected,
    lockedReason,
    onSelect,
    onHover,
    isGhost,
    proposalId,
    onAcceptProposal,
    onRejectProposal,
  } = data
  const { zoom } = useViewport()
  const detailLevel = zoom >= 0.62 ? 'standard' : zoom >= 0.42 ? 'overview' : 'far'
  const stateLabel = isGhost ? 'Propuesta AI' : progressLabels[progressState]
  const typeLabel = isGhost ? 'Paso propuesto' : nodeTypeLabels[mission.nodeType]
  const description = lockedReason ? ` ${lockedReason}` : ''
  const subtitle = mission.mapSubtitle ? ` ${mission.mapSubtitle}` : ''
  const evaluationDescription =
    evaluationStatus === 'evaluating'
      ? ' Evidencia en evaluación.'
      : evaluationStatus === 'rework'
        ? ' La evidencia requiere ajustes.'
        : evaluationStatus === 'clarify'
          ? ' La evidencia necesita aclaración.'
          : evaluationStatus === 'human_review'
            ? ' La evidencia espera revisión humana.'
            : ''
  const recommendationDescription = recommended ? ' Recomendada por el Acompañante.' : ''
  const tooltipId = `mission-tooltip-${mission.id}`

  return (
    <div
      className={`quest-node-shell quest-node--${mission.nodeType} ${isGhost ? 'quest-node--ghost' : ''}`}
      data-progress={isGhost ? 'ghost' : progressState}
      data-ghost={isGhost ? 'true' : undefined}
      data-evaluation={evaluationStatus ?? 'idle'}
      data-recommended={recommended}
      data-selected={selected}
      data-detail={detailLevel}
      data-role={mission.mapRole}
      onPointerEnter={() => onHover(mission.id)}
      onPointerLeave={() => onHover(null)}
    >
      {mission.nodeType === 'milestone' && !isGhost && (
        <span className="quest-node-destination-rings" aria-hidden="true">
          <span />
          <span />
        </span>
      )}
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <button
        id={`mission-node-${mission.id}`}
        className="quest-node-button nodrag nopan"
        type="button"
        aria-label={`${typeLabel}: ${mission.title}. Estado: ${stateLabel}.${subtitle}${description}${evaluationDescription}${recommendationDescription}`}
        aria-describedby={tooltipId}
        aria-haspopup="dialog"
        aria-expanded={selected}
        onClick={() => onSelect(mission.id)}
        onFocus={() => onHover(mission.id)}
        onBlur={() => onHover(null)}
      >
        <span className="quest-node-depth" aria-hidden="true" />
        <span className="quest-node-shape" aria-hidden="true">
          <span className="quest-node-frame" />
          {isGhost ? (
            <span className="ghost-node-badge-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" strokeDasharray="3 3" />
                <path d="M12 8v8" />
                <path d="M8 12h8" />
              </svg>
            </span>
          ) : (
            <>
              <MissionIcon state={progressState} nodeType={mission.nodeType} missionId={mission.id} />
              <StateBadge state={progressState} />
            </>
          )}
        </span>
        {isGhost && (
          <span className="quest-node-ghost-pill" aria-hidden="true">
            PROPUESTA AI
          </span>
        )}
        {mission.mapRole === 'entry' && progressState === 'available' && !isGhost && (
          <span className="quest-node-entry-cue" aria-hidden="true">
            <span />
            Empieza aquí
          </span>
        )}
        {mission.nodeType === 'milestone' && !isGhost && (
          <span className="quest-node-eyebrow" aria-hidden="true">
            Destino
          </span>
        )}
        <span className="quest-node-title">{mission.title}</span>
        {mission.mapSubtitle && (
          <span className="quest-node-subtitle">{mission.mapSubtitle}</span>
        )}
        {isGhost && proposalId && (
          <div className="ghost-node-actions nodrag" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="ghost-action-btn ghost-action-btn--accept"
              title="Aceptar e integrar al recorrido"
              onClick={(e) => {
                e.stopPropagation()
                onAcceptProposal?.(proposalId)
              }}
            >
              Aceptar
            </button>
            <button
              type="button"
              className="ghost-action-btn ghost-action-btn--reject"
              title="Rechazar propuesta"
              onClick={(e) => {
                e.stopPropagation()
                onRejectProposal?.(proposalId)
              }}
            >
              Rechazar
            </button>
          </div>
        )}
        <span id={tooltipId} className="quest-node-tooltip" role="tooltip">
          <span>{mission.title}</span>
          <span>{isGhost ? 'Propuesta esperando aprobación' : stateLabel}</span>
          <span className="quest-node-tooltip__context">{mission.description}</span>
        </span>
      </button>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  )
})

