# TRAZO Quest — Evaluation Contract Specification

**Version:** 1.0 (Canonical)  
**Status:** Frozen  
**Target:** Generic Domain-Aware Verification System  

---

## 1. Why Evaluation Contracts Exist

In unstructured AI chats, the definition of success is fluid and frequently collapses into sycophancy: when a user submits incomplete or incorrect work, the LLM often compliments the attempt and declares the task finished.

In TRAZO, **completion has consequences**. A completed mission permanently alters graph state, unlocks downstream branches, and produces canonical artifacts that subsequent missions depend upon.

Therefore:
> **An Evaluation Contract must define what completion means BEFORE evidence is submitted.**  
> It cannot be invented on the fly, nor can it be retrofitted or softened after observing a flawed submission.

---

## 2. Domain-Aware Evaluation Standards

Different disciplines require fundamentally different standards of truth. A single monolithic LLM prompt cannot evaluate all human endeavors equally.

```
┌────────────────────────────────────────────────────────────────────────┐
│                      DOMAIN EVALUATION SPECTRUM                        │
├──────────────────────────┬─────────────────────────┬───────────────────┤
│ DISCIPLINE / DOMAIN      │ PRIMARY CONTRACT TYPE   │ STANDARD OF TRUTH │
├──────────────────────────┼─────────────────────────┼───────────────────┤
│ Econometrics / Statistics│ HYBRID (Deterministic + │ Statistical test  │
│                          │ Rubric)                 │ output + theory   │
├──────────────────────────┼─────────────────────────┼───────────────────┤
│ Software Engineering     │ DETERMINISTIC / PROOF   │ Tests pass, PR    │
│                          │                         │ URL accessible    │
├──────────────────────────┼─────────────────────────┼───────────────────┤
│ Business / Marketing     │ ARTIFACT / RUBRIC       │ Value proposition │
│                          │                         │ meets criteria    │
├──────────────────────────┼─────────────────────────┼───────────────────┤
│ Conceptual / Theory      │ RUBRIC                  │ 3-criterion check │
│                          │                         │ against nuance    │
└──────────────────────────┴─────────────────────────┴───────────────────┘
```

TRAZO Quest models this reality through explicit contract types.

---

## 3. The 5 Canonical Contract Types

### Type 1: `DETERMINISTIC`
* **Use Case:** Code outputs, mathematical results, data schema compliance, exact string/regex matches.
* **Mechanism:** Executed entirely by deterministic algorithms in code (zero LLM token cost).
* **Example:**
  ```json
  {
    "type": "deterministic",
    "description": "Verify that the script output reports a Dickey-Fuller test statistic less than -2.86.",
    "deterministicRules": [
      {
        "type": "regex",
        "pattern": "(ADF\\s*Statistic|Test\\s*Statistic)\\s*[:=]\\s*(-[2-9]\\.[0-9]+|-[1-9][0-9]+\\.[0-9]+)",
        "failureMessage": "Evidence must include an ADF statistic below critical value -2.86."
      }
    ]
  }
  ```

---

### Type 2: `RUBRIC`
* **Use Case:** Written analysis, strategic arguments, conceptual explanations, synthesis.
* **Mechanism:** Evaluated by the internal Gemini 3.7 Judge via structured JSON output against explicit required and optional criteria.
* **Example:**
  ```json
  {
    "type": "rubric",
    "description": "Evaluate the economic rationale for why the series requires first-differencing.",
    "rubricCriteria": [
      {
        "id": "c1_p_value_logic",
        "label": "Correct interpretation of null hypothesis",
        "description": "Explains that p > 0.05 implies failing to reject the unit root null.",
        "isRequired": true
      },
      {
        "id": "c2_economic_intuition",
        "label": "Economic justification",
        "description": "Explains why price level series exhibit persistent drift in inflationary regimes.",
        "isRequired": true
      }
    ]
  }
  ```

---

### Type 3: `ARTIFACT`
* **Use Case:** Synthesis missions that combine or build upon outputs from previous upstream missions.
* **Mechanism:** Checks that required upstream canonical artifacts exist in state, conform to schema, and are referenced coherently in the current deliverable.
* **Example:**
  ```json
  {
    "type": "artifact",
    "description": "Verify integration of the previously cleaned INPC series artifact into the VAR forecast.",
    "requiredArtifactKeys": ["inpc_clean_series", "model_specification"]
  }
  ```

---

### Type 4: `EXTERNAL_PROOF`
* **Use Case:** Real-world deployed software, published articles, public repositories, live endpoints.
* **Mechanism:** Verifies live HTTP accessibility, repository public visibility, or verified webhook payloads.
* **Example:**
  ```json
  {
    "type": "external_proof",
    "description": "Verify public accessibility of the deployed FastAPI forecasting endpoint.",
    "externalProofType": "url_accessible"
  }
  ```

---

### Type 5: `HYBRID`
* **Use Case:** Complex technical and analytical submissions (e.g., empirical econometrics, ML pipelines).
* **Mechanism:** Two-stage evaluation:
  1. **Deterministic Gatekeeper:** Regex / schema checks execute first. If deterministic rules fail, evaluation halts immediately with `REWORK` (zero LLM inference cost).
  2. **Semantic Judge:** If deterministic rules pass, the submission proceeds to the Gemini 3.7 Judge for multi-criteria rubric evaluation.

---

## 4. Evaluation Contract Lifecycle

```
[Agent Proposes Quest/Mission with Contract]
                      │
                      ▼
[TRAZO Schema & Acyclicity Validation]
                      │
                      ▼
[Contract Sealed & Persisted in Quest Graph] ◄─── Invariant: Immutable once Active
                      │
                      ▼
            [Human Submits Evidence]
                      │
                      ▼
         [TRAZO Evaluator Dispatched]
                      │
        ┌─────────────┴─────────────┐
        │                           │
  (Deterministic)               (Rubric / Hybrid)
        │                           │
  Regex / Schema              Gemini 3.7 Judge
  Evaluation                  Structured Output
        │                           │
        └─────────────┬─────────────┘
                      │
                      ▼
[Deterministic Policy Engine (`evaluationPolicy.ts`)]
                      │
       ┌──────────────┴──────────────┐
       │                             │
    [PASS]                      [NON-PASS]
       │                    (`REWORK` / `CLARIFY`)
       ▼                             ▼
• Persist Completion           • Record Feedback Trace
• Materialize Artifact         • Zero State Mutation
• Unlock Downstream Branches   • Zero Unlocks
```

---

## 5. Anti-Cheating & Integrity Protections

1. **Sealed Immutability:** Once a mission is initialized in an active Quest, its `EvaluationContract` is cryptographically hashed or sealed. An external agent cannot alter the rubric after reviewing the learner's evidence.
2. **Confidence Threshold ($0.70$):** In rubric evaluations, any Judge output with model confidence $< 0.70$ fails closed to `HUMAN_REVIEW` or `CLARIFY` and cannot trigger a `PASS`.
3. **Internal Contradiction Safeguards:** If the Judge's structured JSON contains any required criterion marked `NOT_MET`, the policy engine rejects the submission as `REWORK` even if the agent's prose feedback sounds encouraging.
4. **Idempotent Verification:** An already-passed mission returns existing verified state on repeated submissions without re-invoking the paid evaluator or duplicating artifacts.
