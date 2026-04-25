---
description: Perform a comprehensive legal risk assessment on a document, contract, or transaction.
args: <file-or-topic> [--jurisdiction <de|us|uk|fr>]
section: Legal Workflows
topLevelCli: true
---

You are running the `/risk-assessment` workflow.

## Step 1 — Parse arguments

Extract from the user's message:
- `<file-or-topic>`: path to a document OR description of a transaction/situation
- `--jurisdiction`: applicable law (default: DE if not specified)

## Step 2 — Create matter and slug

Generate a slug: `<short-topic>-risk` (e.g., `xyz-acquisition-risk`).

## Step 3 — Write plan

Write `outputs/.plans/<slug>.md`:

```markdown
# Matter Plan: <slug>

- **Task type:** Risk Assessment
- **Subject:** <file-or-topic>
- **Jurisdiction:** <jurisdiction>
- **Date:** <today>

## Task ledger

- [ ] T1: risk-agent — comprehensive risk register
- [ ] T2: research-agent — relevant legal context
- [ ] T3: knowledge-agent — analogous matters in KB
- [ ] T4: qa-agent — verification
```

## Step 4 — Parse input

If a file is provided (PDF/DOCX), parse it with `document_parse`. Save to `outputs/matters/<slug>/uploads/`.

## Step 5 — Delegate (parallel)

```json
{
  "tasks": [
    {
      "agent": "risk-agent",
      "task": "Read outputs/.plans/<slug>.md. Assess all legal risks in: <file path or topic description>. Jurisdiction: <jurisdiction>. Categorize risks as Litigation / Regulatory / Financial / Reputational / Operational. Grade CRITICAL / HIGH / MEDIUM / LOW. Write outputs/.drafts/<slug>-risk-assessment.md.",
      "output": "<slug>-risk-assessment.md"
    },
    {
      "agent": "research-agent",
      "task": "Read outputs/.plans/<slug>.md. Research the key legal frameworks applicable to this risk assessment: <topic summary>. Jurisdiction: <jurisdiction>. Focus on regulatory exposure, standard of care, and recent case law. Write outputs/.drafts/<slug>-risk-research.md.",
      "output": "<slug>-risk-research.md"
    },
    {
      "agent": "knowledge-agent",
      "task": "Read outputs/.plans/<slug>.md. Search knowledge-base/ for precedents and memos that address similar risks to: <topic summary>. Write outputs/.drafts/<slug>-kb-results.md.",
      "output": "<slug>-kb-results.md"
    }
  ],
  "concurrency": 3,
  "failFast": false
}
```

## Step 6 — Synthesize

Write `outputs/.drafts/<slug>-synthesis.md`:

- **Risk Summary**: overall risk level, top 3 risks
- **Risk Register** (sorted CRITICAL → LOW): consolidated table
- **Legal Context**: relevant statutes/cases from research-agent
- **Historical Precedents**: what the knowledge base shows about similar situations
- **Mitigation Roadmap**: ordered action items with owners and timelines

## Step 7 — QA pass

```json
{
  "tasks": [
    {
      "agent": "qa-agent",
      "task": "Review outputs/.drafts/<slug>-synthesis.md and outputs/.drafts/<slug>-risk-assessment.md. Verify all risk findings trace to specific evidence. Verify all regulatory citations have valid URLs. Write outputs/.drafts/<slug>-qa-report.md.",
      "output": "<slug>-qa-report.md"
    }
  ],
  "concurrency": 1,
  "failFast": false
}
```

## Step 8 — Human review gate

Present:

```
## Risk Assessment: <slug>

**Overall risk level:** [CRITICAL/HIGH/MEDIUM/LOW]

**Top risks:**
1. [Risk 1] — CRITICAL — [mitigation]
2. [Risk 2] — HIGH — [mitigation]
3. [Risk 3] — HIGH — [mitigation]

**Immediate actions required:**
- [Action 1]
- [Action 2]

**QA status:** [PASS/PASS WITH NOTES/BLOCKED]

Approve for delivery?
```

## Step 9 — Deliver

On approval:
1. Copy to `outputs/matters/<slug>/<slug>-risk-report.md`
2. Write provenance sidecar
3. Confirm delivery
