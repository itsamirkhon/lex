---
description: Check an entity, transaction, or topic for compliance with sanctions, supply chain law (LkSG), ESG, and GDPR.
args: <topic> [--check-type <sanctions|lksg|esg|gdpr|all>]
section: Legal Workflows
topLevelCli: true
---

You are running the `/compliance-check` workflow.

## Step 1 — Parse arguments

Extract from the user's message:
- `<topic>`: entity name, transaction description, or compliance topic
- `--check-type`: one or more of `sanctions`, `lksg`, `esg`, `gdpr`, `all` (default: `all`)

If topic is missing, ask: "What entity or transaction should I check?"

## Step 2 — Create matter and slug

Generate a slug: `<entity-short-name>-compliance` (e.g., `xyz-corp-compliance`).

## Step 3 — Write plan

Write `outputs/.plans/<slug>.md`:

```markdown
# Matter Plan: <slug>

- **Task type:** Compliance Check
- **Topic:** <topic>
- **Check types:** <list>
- **Date:** <today>

## Task ledger

- [ ] T1: compliance-agent — sanctions + regulatory checks
- [ ] T2: research-agent — fetch current regulation text if needed
- [ ] T3: qa-agent — verify citations (runs after T1–T2)
```

## Step 4 — Delegate (parallel)

```json
{
  "tasks": [
    {
      "agent": "compliance-agent",
      "task": "Read outputs/.plans/<slug>.md. Perform compliance check on: <topic>. Check types required: <check-types>. For sanctions: search OFAC SDN, EU consolidated list, UN list. For LkSG: use knowledge-base/memos/lksg-checklist.md. For ESG: check EU Taxonomy and CSRD. For GDPR: check data processing lawfulness. Write outputs/.drafts/<slug>-compliance-report.md.",
      "output": "<slug>-compliance-report.md"
    },
    {
      "agent": "research-agent",
      "task": "Read outputs/.plans/<slug>.md. Fetch the current text of the most relevant regulations for: <check-types> applied to <topic>. Jurisdiction: DE/EU primary. Write outputs/.drafts/<slug>-regulation-research.md.",
      "output": "<slug>-regulation-research.md"
    }
  ],
  "concurrency": 2,
  "failFast": false
}
```

## Step 5 — Synthesize

Read both output files. Write synthesis to `outputs/.drafts/<slug>-synthesis.md`:

- **Compliance Matrix**: PASS / FAIL / REQUIRES_REVIEW per framework
- **Critical findings**: any FAIL or REQUIRES_REVIEW with specific regulatory citation
- **Regulatory basis**: sources from research-agent
- **Required actions**: specific steps to achieve full compliance

## Step 6 — QA pass

```json
{
  "tasks": [
    {
      "agent": "qa-agent",
      "task": "Review outputs/.drafts/<slug>-synthesis.md and outputs/.drafts/<slug>-compliance-report.md. Verify all regulatory citations and sanctions list searches are documented with URLs and dates. Write outputs/.drafts/<slug>-qa-report.md.",
      "output": "<slug>-qa-report.md"
    }
  ],
  "concurrency": 1,
  "failFast": false
}
```

## Step 7 — Human review gate

Present:

```
## Compliance Check: <topic>

| Framework | Status |
|-----------|--------|
| Sanctions (OFAC/EU/UN) | [CLEAR/MATCH/POSSIBLE_MATCH] |
| LkSG | [COMPLIANT/NON_COMPLIANT/REQUIRES_REVIEW] |
| ESG | [COMPLIANT/NOT_APPLICABLE/REQUIRES_REVIEW] |
| GDPR | [COMPLIANT/NON_COMPLIANT/REQUIRES_REVIEW] |

**Action required:** [yes/no — with specific items]
**QA status:** [PASS/PASS WITH NOTES/BLOCKED]

Approve for delivery?
```

## Step 8 — Deliver

On approval:
1. Copy to `outputs/matters/<slug>/<slug>-compliance.md`
2. Write provenance sidecar
3. Confirm delivery
