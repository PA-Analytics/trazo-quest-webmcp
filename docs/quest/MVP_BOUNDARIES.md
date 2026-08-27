# TRAZO Quest — MVP Boundaries & Demo Specification

**Version:** 1.0 (Canonical)  
**Status:** Frozen  
**Target:** OpenAI WebMCP Challenge / 3-Minute Live Evaluation  

---

## 1. The 3-Minute Hackathon Demo Narrative

The 3-minute demo showcases the entire vertical slice of TRAZO Quest from intention to verified unlock:

```
[0:00 - 0:30] THE PROBLEM & INTENTION
• Learner opens ChatGPT with the TRAZO WebMCP page open side-by-side.
• Learner prompts ChatGPT: "I want to learn econometrics by analyzing Mexican inflation data."

[0:30 - 1:00] AGENT WEBMCP CALL & SPATIAL RENDERING
• ChatGPT discovers TRAZO WebMCP tools and calls `create_quest_path`.
• TRAZO page instantly renders a 4-node DAG on the React Flow canvas:
  - M01: Data Ingestion & Stationarity Test (Active / Available)
  - M02: ARIMA & VAR Model Specification (Locked)
  - M03: Out-of-Sample Forecasting & Fan Charts (Locked)
• 2.5D Companion mascot sits beside M01 with drop shadow and directional gaze.

[1:00 - 1:45] COLLABORATIVE MODIFICATION
• Learner tells ChatGPT: "Add a detour for GARCH volatility modeling."
• ChatGPT calls `propose_mission` via WebMCP.
• New node M01_b (GARCH Detour) appears connected to the graph with updated edges.

[1:45 - 2:30] EVIDENCE SUBMISSION & INTERNAL JUDGE
• Learner completes M01 code and submits ADF test output directly via TRAZO.
• TRAZO dispatches the internal Gemini 3.7 Judge against the pre-sealed Hybrid Contract.
• Deterministic rule confirms statistical output presence -> Judge confirms economic reasoning.

[2:30 - 3:00] DETERMINISTIC UNLOCK & MODO TRAZO
• Policy engine returns PASS.
• Companion mascot enters Modo TRAZO (VERIFIED hop + route illumination).
• M02 and M01_b visually unlock to 'available'.
• Canonical artifact `inpc_clean_series` is persisted for downstream consumption.
```

---

## 2. Feature Prioritization Matrix

```
┌────────────────────────────────────────────────────────────────────────┐
│                      MUST HAVE (3-Minute Demo Core)                    │
├────────────────────────────────────────────────────────────────────────┤
│ 1. WebMCP Tool Surface v0 (create_quest_path, submit_evidence, etc.)   │
│ 2. Dynamic Quest Graph Rendering on React Flow (`QuestMap.tsx`)        │
│ 3. 2.5D Mascot Physical Layer (Shadow, 8-compass, Modo TRAZO)          │
│ 4. Generalized EvaluationContract (Deterministic & Rubric evaluation)  │
│ 5. Internal Gemini 3.7 Judge over Vertex AI with Policy Gate           │
│ 6. Pure mathematical progression derivation (`progression.ts`)         │
│ 7. Firestore / FileStorage persistence of dynamic Quest entities       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────┴────────────────────────────────────┐
│                              NICE TO HAVE                              │
├────────────────────────────────────────────────────────────────────────┤
│ • Interactive Ghost Node proposal chips (Accept / Edit / Reject)       │
│ • UI-based drag-and-drop node repositioning                            │
│ • Consumed upstream artifact preview drawer in MissionPanel            │
│ • Real-time SVG snapshot export of the completed Quest map             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────┴────────────────────────────────────┐
│                    EXPLICITLY KILLED (Scope Discipline)                │
├────────────────────────────────────────────────────────────────────────┤
│ ❌ Coach calibration UI, example generation & training workflows      │
│ ❌ Multi-role identity switcher & coach intro screens                  │
│ ❌ Multi-LMS webhooks (Skool, Teachable, Kajabi, Discord)              │
│ ❌ Long-term autonomous cron scheduler / stall detector daemon         │
│ ❌ Vector databases / RAG memory infrastructure                        │
│ ❌ In-app AI chatbot inside the companion mascot popover               │
│ ❌ Synthetic full-course text generators                               │
│ ❌ Gamification point stores, leaderboards, or vanity badges           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Strict Boundary Rules for Developers

1. **Do Not Re-Implement an LLM Chat Inside TRAZO:** ChatGPT is the conversational partner. TRAZO must not render a second full-screen chatbot that duplicates ChatGPT's job.
2. **Do Not Hardcode Course Data for Quest:** The Quest execution path must rely 100% on the dynamic `Quest` document received via WebMCP, never falling back to static `src/data/packs/` in production mode.
3. **Preserve the 60-30-10 Brand Tokens:** All Quest UI must strictly respect `--trazo-paper` (60%), `--trazo-ink` (30%), and `--trazo-indigo` (10%). Zero generic dark-mode templates or violet gradients.
4. **Preserve Deterministic Progression Invariants:** An external agent cannot pass missions by calling hypothetical `mark_complete` APIs. The only valid path to progression is verified evidence.
