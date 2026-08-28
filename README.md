# TRAZO Quest

> **WebMCP-native shared visual workspace where humans and AI agents turn ambitious goals into interactive, evidence-evaluated progress graphs.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![WebMCP](https://img.shields.io/badge/WebMCP-Model%20Context%20Protocol-emerald.svg)](https://developer.chrome.com/docs/ai/webmcp/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## The Problem: Chat Roadmaps Disappear into the Abyss

When users ask an AI agent for a learning curriculum or project plan in ChatGPT, the AI outputs a wall of markdown text.
- **No shared spatial truth:** As conversation scrolls, the roadmap disappears into chat history.
- **Zero verification:** Saying *"I finished step 1"* causes the LLM to congratulate the user without validating whether real work occurred.
- **No human architectural authority:** The AI cannot safely edit a canvas without risking hallucinated state or overwriting human intent.

**TRAZO Quest solves this.** An external AI agent (like ChatGPT Desktop with WebMCP Site Tools) discovers TRAZO page tools, creates an interactive Quest Map, proposes reviewable paths as non-authoritative **Ghost Nodes**, navigates the map alongside the user, and evaluates real evidence against pre-existing contracts.

> **Canonical Principle:**  
> *AI may suggest the path. The human approves structural change. Evidence earns progress.*

---

## Human + Agent Collaboration Model

```text
┌────────────────────────┐         WebMCP Site Tools         ┌────────────────────────┐
│                        │ ─────────────────────────────────> │                        │
│   External AI Agent    │                                    │      TRAZO Quest       │
│   (ChatGPT / Operator) │ <───────────────────────────────── │    (Shared Canvas)     │
│                        │      Authoritative Projection      │                        │
└────────────────────────┘                                    └───────────┬────────────┘
                                                                          │
                                                                   Human Authority
                                                                 (Accept / Reject UI)
                                                                          │
                                                                          ▼
                                                              ┌────────────────────────┐
                                                              │  Deterministic Judge   │
                                                              │   & Progression DAG    │
                                                              └────────────────────────┘
```

| Authority Domain | External AI Agent | Human User | TRAZO Engine |
| :--- | :--- | :--- | :--- |
| **Path Generation** | Proposes Candidate Nodes (`create_quest`) | Enters Goal | Validates DAG Topology |
| **Path Evolution** | Proposes Ghost Nodes (`propose_quest_change`) | **Accepts / Rejects** | Enforces Optimistic Locking |
| **Spatial Wayfinding** | Navigates & Centers View (`focus_mission`) | Inspects / Interacts | Animates Viewport & Companion |
| **Evidence Evaluation** | Transports Evidence (`submit_evidence`) | Does the Actual Work | **Authoritatively Evaluates (`PASS` / `REWORK`)** |
| **State Mutation** | *Zero Direct Authority* | Approves & Works | Persists to Firestore / Memory |

---

## Registered WebMCP Site Tools (`document.modelContext`)

TRAZO Quest registers exactly **5 WebMCP tools** on the active page:

| WebMCP Tool | Read Only | Description & Invariant |
| :--- | :---: | :--- |
| `create_quest` | No | Creates a new persistent TRAZO quest from a learner goal and structured missions. Sets the visual roadmap; cannot mark missions complete or unlock progress directly. |
| `get_quest_state` | **Yes** | Returns the authoritative graph topology, mission progress states (`locked`, `available`, `active`, `completed`), and pending reviewable proposals. |
| `propose_quest_change` | No | Proposes a reviewable node/path change. Renders as a non-authoritative **Ghost Node** awaiting human approval. |
| `focus_mission` | **Yes** | Smoothly centers the camera viewport on a canonical mission in the active quest canvas, opening its details panel. |
| `submit_evidence` | No | Submits learner work (text or structured data) to be evaluated against the mission's sealed `EvaluationContract`. Evaluates deterministically; only `PASS` unlocks downstream nodes. |

---

## Evaluation & Progression Engine

Progression in TRAZO is strictly deterministic and evidence-grounded:
1. **Deterministic Rules:** Pure mathematical/schema checks (`equals`, `not_equals`, `greater_than`, `between`, `exists`, `contains`, `regex`). Fast, zero-eval, works 100% offline.
2. **Rubric Criteria:** Gemini AI structured interpretation against pre-existing mission criteria.
3. **Hybrid Contracts:** Mandatory deterministic checks fail-closed. If deterministic rules fail, verdict is `REWORK` regardless of LLM sentiment.
4. **Sealed Contract Invariant:** Once evidence is submitted against a mission, its contract is frozen into `evaluationContractSnapshot`. Future attempts always evaluate against this frozen lineage, preventing retroactive criteria weakening.

---

## Reproducible Hero Demo Flow

The standard demonstration workflow analyzes Mexican inflation using real INPC series:

1. **CREATE:**  
   Prompt in ChatGPT: *"Use TRAZO to create a quest that helps me analyze Mexican inflation with real data."*  
   $\rightarrow$ `create_quest` is invoked. A 4-node econometrics DAG renders on the canvas.
2. **GET STATE:**  
   Prompt in ChatGPT: *"What does my TRAZO quest contain?"*  
   $\rightarrow$ `get_quest_state` reports missions M1 through M4.
3. **COLLABORATE (Ghost Node):**  
   Prompt in ChatGPT: *"Add an intermediate step before the stationarity test to understand what stationarity means conceptually."*  
   $\rightarrow$ `propose_quest_change` is invoked. A dashed **Ghost Node (M1A)** titled *"Intuición de estacionariedad"* appears on the canvas with **Aceptar** and **Rechazar** buttons.
4. **HUMAN ACCEPT:**  
   Human clicks **Aceptar** in TRAZO $\rightarrow$ Ghost Node becomes canonical node M1A; M2 prerequisites update.
5. **WAYFIND:**  
   Prompt in ChatGPT: *"What should I work on right now?"*  
   $\rightarrow$ `focus_mission({ missionId: "M2" })` centers the camera and opens M2's details panel.
6. **PROVE (REWORK):**  
   Submit contradictory evidence ($p=0.14 > \alpha=0.05$, but conclusion claims `reject_unit_root`)  
   $\rightarrow$ Evaluates to `REWORK`. Feedback is shown. Downstream mission M3 remains strictly locked.
7. **PROVE (PASS):**  
   Submit corrected evidence ($p=0.14 > \alpha=0.05$, conclusion `fail_to_reject_unit_root`)  
   $\rightarrow$ Evaluates to `PASS`. Mission M2 turns verified, downstream node M3 unlocks, and **Modo TRAZO** celebrates earned progress!

---

## Local Development & Testing

### Prerequisites
- Node.js v20+ or v24+
- npm v10+

### Setup & Run
```bash
# 1. Install dependencies
npm install

# 2. Run test suite (221+ automated tests)
npm test

# 3. Typecheck
npm run typecheck

# 4. Start local development server
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

---

## WebMCP / Site Tools Testing

### In ChatGPT Desktop (macOS / Windows):
1. Enable Developer Mode / Site Tools in ChatGPT Desktop Settings.
2. Start TRAZO locally at `http://localhost:5173` or open the public HTTPS deployment.
3. In ChatGPT Desktop, navigate or connect to the TRAZO URL.
4. The 5 registered site tools appear in ChatGPT's tool tray automatically.

---

## Challenge Provenance

This repository diverged from the earlier course-based TRAZO prototype at commit:
- **Pre-Challenge Baseline Tag:** `pre-webmcp-quest`
- **Baseline Commit SHA:** `fb07257a7401d8a4b3e5f6050e507c048a73c66f`

### Built specifically for the OpenAI WebMCP Challenge:
- Dynamic, user-prompted Quest domain (`Quest`, `QuestMission`, `QuestProposal`, `QuestProgress`).
- Complete WebMCP Site Tools implementation (`create_quest`, `get_quest_state`, `propose_quest_change`, `focus_mission`, `submit_evidence`).
- Ghost Node collaboration protocol with Human Accept / Reject authority.
- Optimistic concurrency control (`expectedVersion` with HTTP 409 conflict recovery).
- Sealed `EvaluationContract` architecture (Deterministic, Rubric, Hybrid).
- Real-time React Flow canvas synchronization.

---

## License

This project is licensed under the [MIT License](LICENSE).
