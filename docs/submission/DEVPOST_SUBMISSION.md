# OpenAI WebMCP Challenge — Submission Packet

## Project Name
**TRAZO Quest: WebMCP Interactive Progression Workspace**

## Short Elevator Pitch (1 Sentence)
> **A WebMCP-native shared visual workspace where humans and AI agents turn ambitious goals into interactive, evidence-evaluated progress graphs.**

---

## Devpost Submission Questions & Answers

### A. Project Overview & Inspiration
When users ask an AI agent for a learning curriculum or project plan in ChatGPT, the AI outputs a wall of markdown text. As conversation scrolls, the roadmap disappears into chat history. Moreover, saying *"I finished step 1"* causes the LLM to congratulate the user without validating whether real work occurred. 

TRAZO Quest reimagines the relationship between browser-based AI agents and web apps using WebMCP (`document.modelContext`). Instead of a disconnected chatbot, ChatGPT becomes an active co-pilot in a spatial, interactive React Flow workspace: generating roadmaps, navigating alongside the learner, proposing paths as reviewable Ghost Nodes, and submitting evidence against sealed evaluation contracts.

### B. What it Does
1. **Interactive Quest Map Generation (`create_quest`):** The external agent translates user prompts into persistent, interactive DAG roadmaps with prerequisites and milestone checkpoints.
2. **Ghost Node Collaboration (`propose_quest_change`):** When proposing new missions or branching paths, changes appear as non-authoritative Ghost Nodes. The human retains final structural authority via on-canvas Accept/Reject controls.
3. **Spatial Wayfinding (`focus_mission`):** External agents smoothly guide the user across the canvas, centering missions and opening detail panels.
4. **Evidence-Based Progression (`submit_evidence`):** Learners submit real work (structured data or textual rationale). Deterministic rules and sealed evaluation rubrics evaluate the submission. Progression (`PASS`) cannot be faked or bypassed.

### C. How We Built It
- **Frontend:** React 19, TypeScript, `@xyflow/react` (React Flow), custom tactile Paper/Ink/Indigo design system.
- **WebMCP Integration:** Imperative `document.modelContext.registerTool()` surface exposing 5 bounded tools with strict JSON Schema definitions, `readOnlyHint` annotations, and zero authority leakage.
- **Backend & Domain:** Node.js, Express/HTTP REST API, Firestore / transactional file-backed persistence with Optimistic Concurrency Control (`expectedVersion`).
- **Evaluation Engine:** Hybrid deterministic rule engine (12 pure mathematical/logical operators) and Gemini/Vertex AI rubric interpreter with sealed contract freezing.

### D. Challenges We Ran Into
1. **Human Agency vs. Agent Automation:** Giving an AI agent the ability to mutate a canvas can easily lead to destructive overwrite or disorientation. We designed the **Ghost Proposal Protocol**, ensuring external agents only propose non-authoritative changes that require human approval to become canonical.
2. **Preventing Progress Hallucination:** Chatbots frequently hallucinate completion. We built a **Sealed Contract Architecture** where evaluation criteria are cryptographically sealed upon the first submission attempt, preventing downstream tampering.
3. **State Synchronization:** Handling race conditions between user canvas interactions and agent tool invocations required atomic optimistic locking (`expectedVersion`) with clear HTTP 409 recovery.

### E. Accomplishments That We're Proud Of
- **Zero-Latency Reactive Canvas:** Real-time visual updates on the React Flow canvas immediately upon agent tool execution.
- **Deterministic Integrity:** 221 automated tests covering end-to-end hero workflows, adversarial prompt injection resistance, contract tamper-resistance, and optimistic concurrency.
- **Clean Architectural Separation:** Complete decoupling between external agent intent (transported via WebMCP), human approval (exercised on canvas), and progression truth (enforced by backend).

### F. What We Learned
- WebMCP (`document.modelContext`) is fundamentally different from traditional server-side MCP: it creates a direct, synchronous, in-browser bridge to the active UI state.
- Exposing high-level semantic tools (`focus_mission`, `propose_quest_change`) is dramatically more reliable for LLM agents than low-level DOM clickers or generic SQL mutators.

### G. What's Next for TRAZO Quest
- **Multiplayer Quests:** Shared quest maps for small teams with agent facilitation.
- **Declarative WebMCP Forms:** Extending tool definitions with declarative HTML attributes.
- **LTI/Canvas LMS Integration:** Exporting validated student artifacts into institutional gradebooks.

---

## WebMCP Tool Reference Table

| Tool Name | Type | Key Invariant |
| :--- | :---: | :--- |
| `create_quest` | Write | Establishes graph topology; cannot mark missions complete. |
| `get_quest_state` | Read-Only | Returns authoritative topology, completed states, and pending proposals. |
| `propose_quest_change` | Write | Injects reviewable Ghost Node; zero canonical mutation without human approval. |
| `focus_mission` | Read-Only | Smoothly animates camera viewport and opens mission panel. |
| `submit_evidence` | Write | Transports learner evidence; only sealed evaluator `PASS` earns progression. |

---

## Open Source Repository & Provenance
- **Repository:** Public on GitHub
- **License:** MIT License
- **Pre-Challenge Baseline Tag:** `pre-webmcp-quest` (`fb07257a7401d8a4b3e5f6050e507c048a73c66f`)
- **New WebMCP Additions:** 100% of Quest domain, Ghost Node collaboration protocol, sealed evaluators, and WebMCP site tools were designed and built during this challenge.
