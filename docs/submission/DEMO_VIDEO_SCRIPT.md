# TRAZO Quest — Hackathon Demo Video Script (2:40)

## Video Structure & Timing Overview
- **Total Duration:** 2 minutes 40 seconds (Target: 160s)
- **Format:** Screen capture with split-screen (ChatGPT Desktop on Left, TRAZO Canvas on Right) + Voiceover.

---

## Shot List & Script

### Act 1: The Problem — Chat Roadmaps Disappear (0:00 - 0:25) [25s]
- **Visual:** Split screen. On left, standard ChatGPT window asking for a curriculum. A giant markdown wall scrolls into oblivion.
- **Voiceover:**
  > *"When you ask an AI agent to build a learning roadmap in ChatGPT, it outputs a wall of markdown text. As the conversation scrolls, your plan disappears. Worse, if you tell the AI 'I finished step 1', it congratulates you without verifying that any real work happened.  
  > This is **TRAZO Quest**: a WebMCP-native shared workspace where ChatGPT and humans collaborate on an interactive, evidence-evaluated progress map."*

---

### Act 2: WebMCP Tool Discovery & Spatial Quest Creation (0:25 - 0:55) [30s]
- **Visual:** Open TRAZO in browser on right side. ChatGPT Desktop on left connects to TRAZO page. The 5 WebMCP tools (`create_quest`, `get_quest_state`, `propose_quest_change`, `focus_mission`, `submit_evidence`) light up in ChatGPT's tool panel.
- **Action:** User prompts in ChatGPT: *"Use TRAZO to create a quest that helps me analyze Mexican inflation with real data."*
- **Visual:** ChatGPT invokes `create_quest`. Instantly, the TRAZO canvas populates with a 4-node interactive econometrics DAG (M1: Data $\rightarrow$ M2: ADF Test $\rightarrow$ M3: ARMA Model $\rightarrow$ M4: Economic Policy).
- **Voiceover:**
  > *"Because TRAZO registers WebMCP Site Tools directly via `document.modelContext`, ChatGPT doesn't just describe a roadmap—it instantiates a live, interactive React Flow graph with prerequisites and milestones, instantly synced to the browser."*

---

### Act 3: The Ghost Proposal — Human Architectural Authority (0:55 - 1:35) [40s]
- **Visual:** Focus on the connection between M1 and M2.
- **Action:** User prompts in ChatGPT: *"Add an intermediate step before the stationarity test to understand what stationarity means conceptually."*
- **Visual:** ChatGPT invokes `propose_quest_change`. A dashed **Ghost Node (M1A: Intuición de estacionariedad)** appears on the canvas with **Aceptar** and **Rechazar** buttons.
- **Action:** Point out that M1A is non-authoritative. The human clicks **Aceptar**. The ghost node turns solid, the version increments atomically from v2 to v3, and the graph layout updates.
- **Voiceover:**
  > *"Here is the core architectural innovation: **AI proposes, human approves**.  
  > When ChatGPT suggests a new mission, TRAZO renders it as a non-authoritative Ghost Node. The agent cannot unilaterally rewrite your workspace. The human clicks 'Aceptar', and the node becomes part of the canonical progression graph with optimistic concurrency control."*

---

### Act 4: Spatial Wayfinding & Evidence-Based Evaluation (1:35 - 2:20) [45s]
- **Visual:** Zoom in on Mission M2 (ADF Test).
- **Action:** ChatGPT invokes `focus_mission({ missionId: "M2" })`. The camera smoothly glides to center on M2 and opens the details panel.
- **Action 1 (Failure/REWORK):** Learner submits flawed evidence (p-value 0.14 > 0.05, but concludes 'reject null hypothesis'). The evaluator runs against the sealed contract and returns **REWORK**. Mission M3 stays locked.
- **Action 2 (Success/PASS):** Learner corrects the conclusion to 'fail to reject null'. The deterministic engine validates the logic, returns **PASS**, marks M2 completed, unlocks downstream mission M3, and materializes the verified ADF artifact.
- **Voiceover:**
  > *"Next, spatial wayfinding: ChatGPT calls `focus_mission` to guide the user's viewport directly to the active task.  
  > When evidence is submitted, TRAZO's sealed evaluation engine evaluates the work. If logic is contradictory, it returns REWORK and refuses to advance. When valid evidence is submitted, it awards a PASS, unlocks the next node, and materializes a verified artifact. Progress cannot be hallucinated—it must be earned."*

---

### Act 5: Summary & Vision (2:20 - 2:40) [20s]
- **Visual:** Full view of the completed, glowing TRAZO Quest canvas with verified checkpoints.
- **Voiceover:**
  > *"TRAZO Quest proves what is possible when WebMCP bridges conversational AI agents with structured, human-governed browser canvases.  
  > Real-time tools. Human architectural authority. Deterministic progression integrity.  
  > Thank you."*
