# TRAZO Quest — WebMCP Architectural Specification

**Version:** 1.0 (Canonical)  
**Status:** Frozen  
**Target:** OpenAI WebMCP Challenge / Browser-Native Tool Integration  

---

## 1. WebMCP Mental Model: Browser-Native Tool Surface

### 1.1 What WebMCP Is
WebMCP (Web Model Context Protocol) is a standard allowing a web application running in a browser to expose structured JavaScript tools and context directly to an external AI agent (such as ChatGPT, Operator, or an AI-enabled browser engine).

```
┌────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL AGENT (ChatGPT)                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 1. Browser discovers page tools
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     BROWSER RUNTIME (DOM / PAGE)                       │
│                                                                        │
│   window.navigator.modelContext  /  siteTools                          │
│   ├── create_quest_path                                                │
│   ├── get_quest_state                                                  │
│   ├── propose_mission                                                  │
│   ├── update_mission                                                   │
│   ├── submit_evidence                                                  │
│   └── get_mission_guidance                                             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 2. Tool handler dispatches request
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       TRAZO CLIENT ADAPTER (SPA)                       │
│              (Validates params, attaches session tokens)               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 3. Authenticated HTTPS API Calls
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          TRAZO BACKEND SERVER                          │
│                                                                        │
│   ├── Quest Service (`src/server/quest/`)                              │
│   │   └── Validates DAG Acyclicity & Node Geometry                     │
│   ├── Evidence Evaluator & Judge (`src/server/evaluator/`)             │
│   │   └── Evaluates Evidence against Sealed EvaluationContracts        │
│   ├── Deterministic Policy Engine (`src/domain/evaluationPolicy.ts`)   │
│   │   └── Enforces PASS / REWORK / CLARIFY Verdicts                    │
│   ├── Progression Engine (`src/domain/progression.ts`)                 │
│   │   └── Mathematically derives node states & unlocks                 │
│   └── Persistence Repository (`src/server/repository.ts`)             │
│       └── Cloud Firestore / FileStorage / In-Memory (Deep-Cloned)      │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.2 What WebMCP Is NOT
* ❌ **Not a remote MCP server:** It does not replace TRAZO's backend or run as an isolated stdio process.
* ❌ **Not a ChatGPT plugin installation:** It requires no centralized app store approval; any WebMCP-aware browser discovers page tools naturally when visiting the site.
* ❌ **Not an embedded model inside TRAZO:** The intelligence lives in the user's external agent; TRAZO provides the structured tool API and domain authority.

---

## 2. Authoritative Security & Integrity Invariants

1. **The Page is an Interface, Not the Authority:** An external agent cannot execute arbitrary SQL, modify database collections directly, or forge completion tokens. Every tool execution is routed to TRAZO's backend API where strict domain invariants are enforced.
2. **Deterministic Gatekeeping on Progression:** No tool exists to directly set a mission to `completed`. The only mechanism that can mutate progression is `submit_evidence`, which runs through the internal Gemini 3.7 Judge and the deterministic policy engine.
3. **DAG Integrity Verification:** Any tool that mutates the graph (`create_quest_path`, `propose_mission`) immediately executes topological sorting and cycle detection via `validateMethodologyGraph()`. Cyclic or disconnected graphs are rejected with informative error payloads.
4. **Immutable History:** A mission that has reached `completed` status with an existing canonical artifact cannot be deleted or mutated by an external agent. Completed milestones remain permanent anchor points in the learner's journey.
5. **Concurrency & Stale-Write Protection:** All read-modify-write operations on a Quest instance run through serialized backend exclusive queues (`runExclusive()`), preventing race conditions when human and agent interact simultaneously.

---

## 3. Minimal WebMCP Tool Surface (V0)

The WebMCP tool surface is intentionally restrained to six high-leverage tools:

### Tool 1: `create_quest_path`
* **Purpose:** Creates an initial Quest DAG from an open-ended user learning goal.
* **Mutates State:** Yes (Initializes Quest document).
* **Schema Definition:**
  ```json
  {
    "name": "create_quest_path",
    "description": "Initialize a new structured quest graph from a learning or implementation goal.",
    "parameters": {
      "type": "object",
      "properties": {
        "goalPrompt": { "type": "string", "description": "The user's raw goal statement." },
        "targetOutcome": { "type": "string", "description": "Concrete outcome achieved upon completing the quest." },
        "missions": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "title": { "type": "string" },
              "description": { "type": "string" },
              "nodeType": { "type": "string", "enum": ["normal", "optional", "milestone"] },
              "mapRole": { "type": "string", "enum": ["entry", "convergence"] },
              "prerequisites": { "type": "array", "items": { "type": "string" } },
              "evidencePrompt": { "type": "string" },
              "evaluationContract": {
                "type": "object",
                "properties": {
                  "type": { "type": "string", "enum": ["deterministic", "rubric", "artifact", "external_proof", "hybrid"] },
                  "description": { "type": "string" }
                },
                "required": ["type", "description"]
              },
              "producesArtifacts": { "type": "array", "items": { "type": "string" } },
              "consumesArtifacts": { "type": "array", "items": { "type": "string" } }
            },
            "required": ["id", "title", "description", "evidencePrompt", "evaluationContract"]
          }
        },
        "edges": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "source": { "type": "string" },
              "target": { "type": "string" },
              "optional": { "type": "boolean" }
            },
            "required": ["source", "target"]
          }
        }
      },
      "required": ["goalPrompt", "targetOutcome", "missions"]
    }
  }
  ```

---

### Tool 2: `get_quest_state`
* **Purpose:** Inspects current topology, active mission, available missions, and completed deliverables.
* **Mutates State:** No (Read-only).
* **Schema Definition:**
  ```json
  {
    "name": "get_quest_state",
    "description": "Get the current graph topology, progression status, and unlocked missions.",
    "parameters": {
      "type": "object",
      "properties": {
        "questId": { "type": "string" }
      },
      "required": ["questId"]
    }
  }
  ```

---

### Tool 3: `propose_mission`
* **Purpose:** Proposes adding a new mission node or detour to an active quest path.
* **Mutates State:** Yes (Appends node to Quest DAG upon DAG validation).
* **Schema Definition:**
  ```json
  {
    "name": "propose_mission",
    "description": "Propose a new mission node connected to existing nodes in the quest map.",
    "parameters": {
      "type": "object",
      "properties": {
        "questId": { "type": "string" },
        "mission": { "type": "object", "description": "Full QuestMission definition" },
        "connectFrom": { "type": "array", "items": { "type": "string" } },
        "connectTo": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["questId", "mission", "connectFrom"]
    }
  }
  ```

---

### Tool 4: `update_mission`
* **Purpose:** Updates prompts, title, or evaluation contract of an uncompleted mission.
* **Mutates State:** Yes (Updates uncompleted mission).
* **Schema Definition:**
  ```json
  {
    "name": "update_mission",
    "description": "Update details or evaluation criteria of a pending mission before submission.",
    "parameters": {
      "type": "object",
      "properties": {
        "questId": { "type": "string" },
        "missionId": { "type": "string" },
        "patch": { "type": "object" }
      },
      "required": ["questId", "missionId", "patch"]
    }
  }
  ```

---

### Tool 5: `submit_evidence`
* **Purpose:** Submits learner evidence for automated verification by the TRAZO Judge.
* **Mutates State:** Conditionally Yes (Advances progression only if verdict is `PASS`).
* **Schema Definition:**
  ```json
  {
    "name": "submit_evidence",
    "description": "Submit concrete evidence for a mission to be evaluated by the TRAZO Judge.",
    "parameters": {
      "type": "object",
      "properties": {
        "questId": { "type": "string" },
        "missionId": { "type": "string" },
        "content": {
          "type": "object",
          "properties": {
            "text": { "type": "string" },
            "url": { "type": "string" },
            "artifactPayload": { "type": "object" }
          }
        }
      },
      "required": ["questId", "missionId", "content"]
    }
  }
  ```

---

### Tool 6: `get_mission_guidance`
* **Purpose:** Retrieves full mission context, evaluation contract, and upstream artifacts to help the agent coach the user.
* **Mutates State:** No (Read-only).
* **Schema Definition:**
  ```json
  {
    "name": "get_mission_guidance",
    "description": "Retrieve comprehensive guidance, evaluation rules, and upstream artifacts for a mission.",
    "parameters": {
      "type": "object",
      "properties": {
        "questId": { "type": "string" },
        "missionId": { "type": "string" }
      },
      "required": ["questId", "missionId"]
    }
  }
  ```
