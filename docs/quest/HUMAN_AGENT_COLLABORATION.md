# TRAZO Quest — Human + Agent Collaboration Model

**Version:** 1.0 (Canonical)  
**Status:** Frozen  
**Target:** TRAZO Quest / OpenAI WebMCP Collaboration Protocol  

---

## 1. The Collaboration Architecture

In TRAZO Quest, the human learner and the external AI agent (e.g., ChatGPT running in a WebMCP-enabled browser) collaborate on a **single shared visual workspace**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL AI AGENT                             │
│       (ChatGPT / Browser Agent — Conversational Intelligence)          │
│                                                                        │
│   • Intent clarification & dialogue                                    │
│   • Curriculum decomposition & planning                                │
│   • Proposing new missions & edge connections                          │
│   • Contextual coaching & scaffolding                                  │
│   • Calling structured WebMCP page tools                               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ WebMCP Tool Calls
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                             TRAZO QUEST                                │
│                    (Shared Interactive Workspace)                      │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                     REACT FLOW QUEST MAP                       │   │
│   │                                                                │   │
│   │    [M01: Data] ───────► [M02: ADF Test] ───────► [M03: VAR]    │   │
│   │          ▲                      │                              │   │
│   │          │                      │                              │   │
│   │   2.5D Mascot              Ghost Proposal                      │   │
│   │  (Active Focus)         [M02_b: Arch Test]                     │   │
│   │                         (Accept / Reject)                      │   │
│   └────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Direct Manipulation & Submissions
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            HUMAN LEARNER                               │
│                         (Agency & Execution)                           │
│                                                                        │
│   • Direct visual inspection of the entire graph                       │
│   • Real-world implementation & coding                                 │
│   • Direct evidence submission                                         │
│   • Review, accept, edit, or reject agent proposals                    │
│   • Ultimate owner of the learning journey                             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Evidence & Evaluator Gate
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      TRAZO PROGRESSION ENGINE                          │
│                    (Authoritative State & Judge)                       │
│                                                                        │
│   • Sealed Evaluation Contracts                                        │
│   • Independent Gemini 3.7 Judge Evaluation                            │
│   • Deterministic Policy Gate (Zero false PASS)                        │
│   • Authoritative DAG Unlocks & Artifact Materialization               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Division of Authority & Responsibilities

The separation of concerns between the three actors is absolute:

| Actor | Primary Responsibilities | Authority Boundaries & Restrictions |
| :--- | :--- | :--- |
| **Human Learner** | • Defines initial goal & intent.<br>• Performs actual intellectual work.<br>• Submits raw evidence.<br>• Accepts, edits, or deletes graph nodes. | • Cannot bypass locked prerequisites.<br>• Cannot force a `PASS` without verified evidence. |
| **External Agent** | • Conversational partner.<br>• Translates goals into structured paths.<br>• Proposes new missions/detours.<br>• Provides scaffolding & feedback.<br>• Executes WebMCP actions. | • **COLLABORATOR, NOT JUDGE.**<br>• Cannot mark missions completed.<br>• Cannot force graph unlocks.<br>• Cannot weaken evaluation contracts post-submission. |
| **TRAZO Platform** | • Persistent storage of Quest state.<br>• Real-time visual graph rendering.<br>• Enforces DAG mathematical validity.<br>• Executes the internal Judge against contracts.<br>• Persists canonical progression. | • Sole domain authority for state transitions.<br>• Strictly deterministic execution. |

---

## 3. The Core UX Principle: Never Hide the App Behind the Agent

A fatal flaw in early agentic prototypes is treating the software as a black-box backend that only the agent can see, forcing the human to interact exclusively through a tiny chat text box.

**In TRAZO Quest, the application is never hidden behind the agent.**

1. **Direct Spatial Manipulation:** The human can pan, zoom, click any node, inspect locked prerequisites, and view submitted evidence directly on the canvas at all times.
2. **Dual-Input Parity:** Any action the agent can perform via WebMCP tools (submitting evidence, starting a mission, proposing a detour), the human can also perform directly via the TRAZO UI.
3. **Transparent State:** The human always sees why a node is locked, what the active evaluation contract requires, and the exact rationale returned by the Judge.

---

## 4. The Proposal & Acceptance Pattern (Ghost Nodes)

When an external agent decides to alter or expand the Quest path (for example, suggesting a remedial math module or adding an advanced modeling detour), it must not silently mutate the user's graph without consent.

### The Canonical Workflow:
1. **Agent Proposes:** Agent calls `propose_mission` via WebMCP with parent connections.
2. **Ghost Node Rendered:** TRAZO renders the proposed node with a dashed border, muted indigo styling, and `[Accept / Edit / Reject]` action chips.
3. **Human Decides:**
   * **Accept:** Node transitions into authoritative Quest state; DAG edges are sealed; layout updates.
   * **Edit:** Human adjusts the prompt, title, or prerequisites before sealing.
   * **Reject:** Ghost node is removed from the canvas; zero state corruption.

*(Note: In MVP v0, direct creation via `create_quest_path` initializes the baseline graph; the Ghost Node review pattern represents the target interactive standard for incremental proposals).*

---

## 5. The Evolving Role of the Companion Mascot

In TRAZO Programs, the 2.5D mascot contained an embedded conversation panel that attempted to act as an in-app chatbot. In TRAZO Quest, having two conversational AIs (ChatGPT in the browser and the mascot in the canvas) creates severe confusion.

### The New Mascot Role in Quest:
The mascot is **the physical inhabitant of the world**, not a conversational competitor.

```
┌────────────────────────────────────────────────────────┐
│                   EXTERNAL AI AGENT                    │
│                 (The Mind / The Guide)                 │
│         Conversational, analytical, generative         │
└────────────────────────────────────────────────────────┘
                            ▲
                            │ Collaborates with
                            ▼
┌────────────────────────────────────────────────────────┐
│                   COMPANION MASCOT                     │
│               (The Body / The Inhabitant)              │
│       Physical presence, kinematics, wayfinding,       │
│        attention cues, celebration (Modo TRAZO)        │
└────────────────────────────────────────────────────────┘
                            ▲
                            │ Lives inside
                            ▼
┌────────────────────────────────────────────────────────┐
│                    TRAZO QUEST MAP                     │
│                  (The Physical World)                  │
│       Topological graph, dependency rules, progress    │
└────────────────────────────────────────────────────────┘
```

1. **Spatial Anchoring:** Sits beside the currently active mission node.
2. **Kinematic Navigation:** Walks along real SVG edge paths with 60/120 FPS GPU kinematics when the user transitions between missions.
3. **Directional Awareness:** Orients body and gaze in 8 compass directions (`N`, `NE`, `E`, `SE`, `S`, `SW`, `W`, `NW`) based on movement tangent vectors.
4. **Attention Expressions:** Shifts antenna and activates discrete attention cues when an action requires user focus or when an agent proposal is pending review.
5. **Modo TRAZO Celebration:** Upon a verified `PASS` from the internal Judge, the mascot performs a triumphant hop, illuminates the route in Cobalt, and triggers tactile feedback.
