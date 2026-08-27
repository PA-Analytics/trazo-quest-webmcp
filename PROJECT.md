# Project: 2.5D TRAZO Implementation Companion

## Product Lines & TRAZO Quest Split
This repository is the canonical home of **TRAZO Quest** (forked from TRAZO Programs at commit `fb07257a7401d8a4b3e5f6050e507c048a73c66f`).

* **TRAZO Programs:** Coach methodology $\longrightarrow$ Executable mission path.
* **TRAZO Quest:** Human + External Agent intention $\longrightarrow$ Executable mission path (via WebMCP).
* **Shared Core:** Directed Acyclic Graph (DAG) missions, concrete evidence submission, automated Judge evaluation, and deterministic progression.

For the canonical product thesis, collaboration model, and WebMCP architecture, see [docs/quest/QUEST_THESIS.md](docs/quest/QUEST_THESIS.md).

## Architecture
- **Layering**: React Flow Canvas (`.react-flow__viewport`) host layer -> In-Canvas 2.5D Companion Sprite + Decoupled Shadow -> Anchored Conversation Popover.
- **Kinematics Engine**: High-frequency frame loop (`useCompanionTraveler.ts`) using `SVGPathElement.getPointAtLength()` via `companionPathSampler.ts`, updating GPU `translate3d`, 8-way compass tangents, elevation bobbing, and dynamic shadow attenuation at 60/120fps with zero React fiber re-renders during motion.
- **State Machine**: 5 visual states (`IDLE`, `ATTENTION`, `THINKING`, `MOVING`, `VERIFIED`), integrated with TRAZO mission evaluation engine and recommendation proposals.
- **Visual Design**: Strict 60-30-10 palette (`#F1F1EC` Paper 60%, `#141A16` Ink 30%, `#3657FF` Cobalt 10%), zero generic SaaS clichés / purple gradients.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | 2.5D Physical Anatomy & Shadow | Decoupled ground shadow with height-coupled scaling $S = \max(0.65, 1 - h/22)$ and alpha attenuation | M1 | ORIGINAL_REQUEST §R1 |
| 2 | 5 Core Visual States | IDLE, ATTENTION, THINKING, MOVING, and VERIFIED (Modo TRAZO) state machine | M1 | ORIGINAL_REQUEST §R2 |
| 3 | 8-Compass Directional Orientation | Tangent vector lookahead deriving 8-quadrant body/eye orientation (`N`, `NE`, `E`, `SE`, `S`, `SW`, `W`, `NW`) | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Viewport Layer Mounting | Mount companion inside React Flow `.react-flow__viewport` with natural zoom/pan scaling | M2 | ORIGINAL_REQUEST §R1 |
| 5 | Node Placement & Y-Sorting | Offset positioning beside active node (`normal`, `milestone`, `optional`) and dynamic `z-index` | M2 | ORIGINAL_REQUEST §R1 |
| 6 | Real-Geometry Edge Travel | Constant-velocity ($220\text{ px/s}$) traversal along cubic Bezier and `smoothSplineThroughVia` edge splines | M3 | ORIGINAL_REQUEST §R3 |
| 7 | Reduced Motion Support | Full `prefers-reduced-motion` compliance with instant jump and suppressed keyframes | M3 | ORIGINAL_REQUEST §R5 |
| 8 | Anchored Conversation Popover | Pinned popover dialog with boundary clamping, auto-dismiss on Escape/outside-click/travel, and turn history | M4 | ORIGINAL_REQUEST §R4 |
| 9 | Micro-Reactions & Modo TRAZO | Hover focus, multi-tap squish, idle survey, and triumphant jump/route illumination on verified PASS | M4 | ORIGINAL_REQUEST §R2, §R4 |
| 10 | A11y, Anti-Slop & Red Team Verification | WCAG AA / APCA contrast, ARIA dialog/live semantics, typecheck clean, 75+ tests passing, zero slop | M5 | ORIGINAL_REQUEST §R5, DESIGN.md |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Companion Core & Kinematics Polish | Verify and polish `CompanionAvatar.tsx`, `useCompanionTraveler.ts`, `companionPathSampler.ts`, `companion.css` for 5 visual states, decoupled shadow, 8-compass orientation, 60-30-10 palette, zero TS errors | none | DONE |
| 2 | Canvas Inhabitation & Viewport Layer | Mount `CompanionAvatar` inside `QuestMapCanvas` (`QuestMap.tsx`) within the React Flow viewport coordinate space with node offsets and Y-sorting | M1 | DONE |
| 3 | Real-Geometry Edge Travel & Navigation | Implement edge path resolution from `QuestEdge` geometries, wire travel triggers to mission selection and CTA, test constant velocity and reduced-motion | M2 | DONE |
| 4 | Anchored Popover & Micro-Reactions | Refine anchored popover dialog with boundary clamping, dismissal handlers, interactive proposals, and micro-reactions | M3 | DONE |
| 5 | Verification, Anti-Slop Audit & Red Team | Execute full test suite (`npm test`), typecheck (`npm run typecheck`), a11y audit, anti-slop audit, Red Team review, and final gate | M4 | DONE |

## Interface Contracts
### `CompanionAvatar` Component & Ref Handle (`src/components/CompanionAvatar.tsx`)
```typescript
export interface CompanionHandle {
  moveToNode: (targetNodeId: string, edgePath?: string) => Promise<void>;
  teleportTo: (position: { x: number; y: number }) => void;
  setState: (state: CompanionState) => void;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
}

export type CompanionState = 'idle' | 'attention' | 'thinking' | 'moving' | 'verified';

export interface CompanionAvatarProps {
  activeNodeId: string;
  nodes: Node[];
  edges: Edge[];
  stateOverride?: CompanionState;
  onNavigateToMission?: (missionId: string) => void;
  onAskClarification?: (question: string) => Promise<void>;
  isEvaluating?: boolean;
  isVerifiedAction?: boolean;
  proposal?: RecommendationProposal | null;
}
```

### `CompanionPathSampler` (`src/utils/companionPathSampler.ts`)
```typescript
export interface SamplerPoint {
  x: number;
  y: number;
  tangentAngle: number;
  direction: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
}

export class CompanionPathSampler {
  constructor(svgPathString: string);
  get totalLength(): number;
  sampleAtDistance(distance: number): SamplerPoint;
  sampleAtProgress(t: number): SamplerPoint; // t in [0, 1]
}
```

## Code Layout
- `src/components/CompanionAvatar.tsx`: Main 2.5D mascot component + decoupled shadow + anchored popover.
- `src/components/QuestMap.tsx`: React Flow canvas hosting nodes, edges, viewport, and mounted CompanionAvatar.
- `src/components/QuestEdge.tsx`: Edge geometries (`smoothSplineThroughVia` and `getBezierPath`).
- `src/hooks/useCompanionTraveler.ts`: 60/120fps rAF kinematic loop and DOM transform mutations.
- `src/utils/companionPathSampler.ts`: SVG path length and tangent vector calculations.
- `src/styles/companion.css`: Companion styles, 2.5D physical shading, animations, and a11y overrides.
- `src/styles/trazo-tokens.css`: Canonical color tokens (`--trazo-paper`, `--trazo-ink`, `--trazo-indigo`, `--trazo-action`).
- `tests/`: Automated unit, integration, and E2E test suites.
