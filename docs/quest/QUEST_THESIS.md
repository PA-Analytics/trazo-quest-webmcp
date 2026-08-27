# TRAZO Quest — Canonical Product Thesis

**Version:** 1.0 (Canonical)  
**Status:** Frozen  
**Target:** TRAZO Quest / OpenAI WebMCP Challenge  
**Divergence Point:** `pre-webmcp-quest` (`fb07257a7401d8a4b3e5f6050e507c048a73c66f`)  

---

## 1. Product Lineage & The Discovery of Quest

### 1.1 The Origin: TRAZO Programs
TRAZO was originally conceived to solve a structural failure in online education: **courses teach, but learners rarely implement.** 

In a traditional educational program or cohort, a coach/creator already possesses a proven methodology, sequencing, evaluation criteria, and expected deliverables. TRAZO Programs converts that coach's methodology into an interactive visual Directed Acyclic Graph (DAG) of missions:

$$\text{Methodology} \longrightarrow \text{Mission Graph} \longrightarrow \text{Evidence Submission} \longrightarrow \text{Deterministic Evaluation} \longrightarrow \text{Visible Progress}$$

In TRAZO Programs:
* **Path Authority:** The Coach / Methodology defines the DAG topology, rubrics, and prerequisites.
* **Progress Authority:** The TRAZO Judge (Gemini 3.7) + Deterministic Policy Engine verifies evidence before unlocking downstream missions.

TRAZO Programs remains an entirely valid, active product line. This thesis does not rewrite or invalidate Programs; it establishes the foundation for a second, parallel entry point.

---

### 1.2 The Discovery: TRAZO Quest
The emergence of **WebMCP (Web Model Context Protocol)** revealed that the core primitive of TRAZO—the spatial, verifiable execution layer—does not require an existing coach or a pre-packaged curriculum to provide massive value.

A person often embarks on learning or building with nothing more than an open-ended intention:
* *"I want to learn econometrics by analyzing Mexican inflation."*
* *"I want to build my first micro-SaaS in Go and deploy it to Cloud Run."*
* *"I want to understand central bank monetary policy during liquidity traps."*
* *"I want to design and launch my first outbound sales campaign."*

Today, when a user asks a modern LLM (like ChatGPT) for guidance, the agent generates a textual roadmap in chat. However, that roadmap suffers from critical UX limitations:
1. **Ephemeral:** It disappears up the chat scroll window.
2. **Abstract & Textual:** It lacks spatial structure, hierarchy, and palpable geography.
3. **Disconnected from Evidence:** There is no mechanism requiring the user to prove they did the work before moving forward.
4. **Disconnected from State:** There is no persistent, shared source of truth tracking what is locked, active, or completed.
5. **No Independent Authority:** The conversational agent often becomes sycophantic, declaring "Great job! You mastered this!" without rigorous evaluation.

**TRAZO Quest transforms that fleeting chat roadmap into a shared, persistent visual workspace.**

```
┌────────────────────────────────────────────────────────────────────────┐
│                              TRAZO QUEST                               │
│                         SHARED QUEST WORKSPACE                         │
│                                   ▲                                    │
│                    ┌──────────────┴──────────────┐                     │
│                    │                             │                     │
│              HUMAN LEARNER                 EXTERNAL AGENT              │
│          (Intent & Execution)         (Decomposition & Scaffolding)    │
│                    │                             │                     │
│                    └─────────── WebMCP ──────────┘                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                        TRAZO PROGRESSION ENGINE
                    (Judge + Deterministic Policy)
```

In TRAZO Quest:
* **Path Creation Authority:** Collaborative between the **Human** and the **External AI Agent**.
* **Progress Authority:** Exclusively held by the **TRAZO Judge + Deterministic Policy Engine**.

---

## 2. Core Emotional Thesis

> *"The progress we make isn't always visible. TRAZO turns it into a path."*

### 2.1 The Phenomenon of Invisible Friction
When people attempt complex self-directed learning or creative execution, they frequently make meaningful micro-progress without feeling any sense of forward momentum. Their work is scattered across:
* Dozens of disconnected browser tabs.
* Half-written Google Docs, Jupyter notebooks, or Notion scratchpads.
* Fleeting chat threads with AI models.
* Lingering mental context and isolated to-do items.

Because this effort lacks spatial coherence, the learner experiences cognitive fatigue and impostor syndrome: *"I spent three hours working, but I have no idea where I am or what I actually accomplished."*

### 2.2 Spatializing Momentum
TRAZO makes progress **spatial, tangible, and perceptible**. 

By projecting intention into a physical Directed Acyclic Graph (DAG) with explicit prerequisites, tangible checkpoints, and ground shadows, TRAZO transforms invisible cognitive labor into visible geography. Completing a mission illuminates a real route, seals a canonical artifact, and unlocks new territory.

---

## 3. Product Primitive: What TRAZO Is (and Is Not)

### 3.1 The Canonical Primitive
At its fundamental level:

$$\mathbf{TRAZO} \equiv \text{A Visual Execution Layer for Progress}$$

It converts intended outcomes into an immutable pipeline:

$$\text{Goal} \longrightarrow \text{Path (DAG)} \longrightarrow \text{Missions} \longrightarrow \text{Evidence} \longrightarrow \text{Evaluation} \longrightarrow \text{Progression}$$

| Dimension | TRAZO Programs | TRAZO Quest |
| :--- | :--- | :--- |
| **Origin of Path** | Pre-existing coach methodology | Human intention + External Agent plan |
| **Target User** | Enrolled student in a cohort/course | Autonomous builder, researcher, or learner |
| **Path Authority** | Creator / Coach | Human + External Agent (via WebMCP) |
| **Evaluation Criteria** | Pre-calibrated course rubric | Upfront `EvaluationContract` (sealed on creation) |
| **Progress Authority** | TRAZO Deterministic Engine | TRAZO Deterministic Engine |
| **Visual Canvas** | React Flow Cartographic Map | React Flow Cartographic Map |

### 3.2 What TRAZO Is NOT
To protect product clarity and prevent feature bloat, TRAZO Quest explicitly rejects being:
* ❌ **A generic LMS:** No passive video libraries, completion percentages, or quiz widgets.
* ❌ **An AI Chatbot:** The chat lives in ChatGPT or the external browser agent; TRAZO is the visual workspace.
* ❌ **A To-Do List or Task Manager:** Tasks are not arbitrary checkboxes; missions are nodes in a strictly typed dependency graph.
* ❌ **A Project Management Suite (Jira/Linear):** No sprint planning, story points, or ticket backlogs.
* ❌ **A Course Generator:** TRAZO does not vomit 50 pages of synthetic text; it creates a structured sequence of verifiable checkpoints.
* ❌ **A Habit Tracker:** No artificial streaks or empty dopamine loops. Progress is measured solely in verified deliverables.

---

## 4. Invariant Principles of TRAZO

The following permanent principles govern both Programs and Quest without exception:

1. **Progress Is Demonstrated, Not Checked:** A user cannot click a checkbox or tell an agent "I finished it" to unlock progress. State advances strictly upon submitting concrete evidence verified by TRAZO's Judge.
2. **Probabilistic Interpretation, Deterministic Integrity:** External LLMs interpret ambiguity and generate feedback, but deterministic backend code (`evaluationPolicy.ts`, `progression.ts`) is the sole authority permitted to mutate completion state.
3. **A Non-PASS Cannot Advance Progression:** Verdicts of `REWORK`, `CLARIFY`, `HUMAN_REVIEW`, or `SYSTEM_ERROR` record history and coaching feedback, but **never** unlock downstream nodes or materialize canonical artifacts.
4. **Contracts Before Evidence:** What constitutes success must be explicitly defined in an `EvaluationContract` *before* evidence is evaluated—never retrofitted or weakened after the fact.
5. **No AI Slop / Anti-Sycophancy:** No purple SaaS gradients, no fake "✨ AI-Powered" badges, and zero sycophantic false praise. If an evidence submission fails criteria, TRAZO reports the gap clearly and directly.
6. **The Map is the Application:** The spatial graph is not a decorative dashboard widget; it is the primary interface through which progress is understood and navigated.
