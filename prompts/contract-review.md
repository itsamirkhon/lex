---
description: Review a contract for risks, non-standard clauses, and BMW policy compliance.
args: <file> [--jurisdiction <de|us|uk|fr>] [--contract-type <supply|service|nda|license>]
section: Legal Workflows
topLevelCli: true
---

You are running the `/contract-review` workflow.

## Step 1 — Parse arguments

Extract from the user's message:
- `<file>`: path to the contract file (PDF, DOCX, or .md/.txt)
- `--jurisdiction`: governing law jurisdiction (default: DE if not specified; ask if ambiguous)
- `--contract-type`: type hint (supply | service | nda | license; infer from file if not given)

If the file path is missing, ask: "Please provide the contract file path."

## Step 2 — Create matter and slug

Generate a slug: `<counterparty>-<contract-type>-review` (e.g., `acme-nda-review`). If counterparty is unclear from filename, use `contract-review-<date>`.

Create matter directory: `outputs/matters/<slug>/`

## Step 3 — Write plan

Write `outputs/.plans/<slug>.md`:

```markdown
# Matter Plan: <slug>

- **Task type:** Contract Review
- **File:** <file path>
- **Jurisdiction:** <jurisdiction>
- **Contract type:** <type>
- **Date:** <today>

## Task ledger

- [ ] T1: contract-agent — clause-by-clause analysis
- [ ] T2: risk-agent — risk register
- [ ] T3: knowledge-agent — precedent and template search
- [ ] T4: qa-agent — citation and consistency check (runs after T1–T3)

## Open questions for lawyer

(Fill in any questions that arise during review)
```

Read the plan back to the user: "I'll run contract-agent, risk-agent, and knowledge-agent in parallel, then QA. Proceeding..."

## Step 4 — Parse contract

If the file is PDF or DOCX, use the `document_parse` tool to extract text. Save parsed text to `outputs/matters/<slug>/uploads/<filename>-parsed.txt`.

If the file is already plaintext or markdown, read it directly.

## Step 5 — Delegate (parallel)

Spawn three agents simultaneously:

```json
{
  "tasks": [
    {
      "agent": "contract-agent",
      "task": "Read outputs/.plans/<slug>.md and knowledge-base/playbook/negotiation-map.md for context. The contract text is at outputs/matters/<slug>/uploads/<filename>-parsed.txt (or <file> if plaintext). Perform clause-by-clause analysis for a <contract-type> under <jurisdiction> law. For every clause, classify whether it touches a playbook red line (mandatory) or a negotiable lever, and compare against the matching template in knowledge-base/templates/ if one exists. Write your analysis to outputs/.drafts/<slug>-contract-analysis.md.",
      "output": "<slug>-contract-analysis.md"
    },
    {
      "agent": "risk-agent",
      "task": "Read outputs/.plans/<slug>.md and knowledge-base/playbook/negotiation-map.md for context. The contract text is at outputs/matters/<slug>/uploads/<filename>-parsed.txt (or <file> if plaintext). Identify all legal risks for BMW as a party to this <contract-type>. Any breach or weakening of a playbook red line for this contract type is automatically CRITICAL. Jurisdiction: <jurisdiction>. Write risk register to outputs/.drafts/<slug>-risk-assessment.md.",
      "output": "<slug>-risk-assessment.md"
    },
    {
      "agent": "knowledge-agent",
      "task": "Read outputs/.plans/<slug>.md. Always start with knowledge-base/playbook/negotiation-map.md and quote the red-line / negotiable-lever rows for this contract type. Then search knowledge-base/templates/, knowledge-base/precedents/, and knowledge-base/memos/ for additional material relevant to a <contract-type> contract under <jurisdiction> law. Write results to outputs/.drafts/<slug>-kb-results.md.",
      "output": "<slug>-kb-results.md"
    }
  ],
  "concurrency": 3,
  "failFast": false
}
```

## Step 6 — Synthesize

Read all three output files. Write synthesis to `outputs/.drafts/<slug>-synthesis.md`:

- **Executive Summary** (3–5 bullets): contract type, parties, governing law, overall risk level, top 3 issues
- **Clause Risk Table**: consolidated from contract-agent output (top 10 findings)
- **Risk Register**: top risks from risk-agent, with mitigation priorities
- **Relevant Precedents**: what knowledge-agent found that applies

## Step 7 — QA pass

```json
{
  "tasks": [
    {
      "agent": "qa-agent",
      "task": "Review outputs/.drafts/<slug>-synthesis.md and source artifacts outputs/.drafts/<slug>-contract-analysis.md and outputs/.drafts/<slug>-risk-assessment.md. Check all citations, jurisdiction claims, and unsupported findings. Write outputs/.drafts/<slug>-qa-report.md.",
      "output": "<slug>-qa-report.md"
    }
  ],
  "concurrency": 1,
  "failFast": false
}
```

Read the QA report. Fix any FATAL findings. Note all MAJOR findings for disclosure.

## Step 8 — Human review gate

Present to the lawyer:

```
## Contract Review: <slug>

**Overall risk level:** [CRITICAL/HIGH/MEDIUM/LOW]

**Top findings:**
1. [Finding 1 — severity]
2. [Finding 2 — severity]
3. [Finding 3 — severity]

**Recommended actions before signing:**
- [Action 1]
- [Action 2]

**QA status:** [PASS/PASS WITH NOTES/BLOCKED]
**QA notes:** [any MAJOR findings]

Do you approve this analysis for final delivery? Any changes or additional scope?
```

## Step 9 — Deliver

On lawyer approval:
1. Copy synthesis to `outputs/matters/<slug>/<slug>-review.md`
2. Write provenance sidecar `outputs/matters/<slug>/<slug>-review.provenance.md`
3. Confirm: "Analysis delivered to outputs/matters/<slug>/. Files: <slug>-review.md and <slug>-review.provenance.md"
