import { memo } from 'react'
import {
  BaseEdge,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react'
import type { EdgeProgress, MapPosition } from '../domain/course'

export interface QuestEdgeData extends Record<string, unknown> {
  progressState: EdgeProgress
  routeTier: 'future' | 'immediate' | 'traveled'
  optional: boolean
  highlighted: boolean
  leadsToMilestone: boolean
  via?: MapPosition
  isGhost?: boolean
}

export type QuestFlowEdge = Edge<QuestEdgeData, 'quest'>

export function smoothSplineThroughVia(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  via: MapPosition,
): string {
  const dx1 = via.x - sourceX
  const dx2 = targetX - via.x

  const c1x = sourceX + dx1 * 0.45
  const c1y = sourceY
  const c2x = via.x - dx1 * 0.45
  const c2y = via.y

  const c3x = via.x + dx2 * 0.45
  const c3y = via.y
  const c4x = targetX - dx2 * 0.45
  const c4y = targetY

  return `M ${sourceX} ${sourceY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${via.x} ${via.y} C ${c3x} ${c3y}, ${c4x} ${c4y}, ${targetX} ${targetY}`
}

export const QuestEdge = memo(function QuestEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<QuestFlowEdge>) {
  const via = data?.via
  const [defaultPath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.34,
  })

  const edgePath = via
    ? smoothSplineThroughVia(sourceX, sourceY, targetX, targetY, via)
    : defaultPath

  return (
    <BaseEdge
      path={edgePath}
      className={`quest-edge-path ${data?.isGhost ? 'quest-edge-path--ghost' : ''}`}
      data-progress={data?.isGhost ? 'ghost' : data?.progressState ?? 'locked'}
      data-ghost={data?.isGhost ? 'true' : undefined}
      data-route={data?.routeTier ?? 'future'}
      data-optional={data?.optional ?? false}
      data-highlighted={data?.highlighted ?? false}
      data-destination={data?.leadsToMilestone ?? false}
    />
  )
})

