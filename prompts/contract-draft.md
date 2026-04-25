---
description: Draft a contract using BMW standard templates and provided parameters.
args: <contract-type> [--parties "<party-a> and <party-b>"] [--jurisdiction <de|us|uk|fr>] [--topic <brief description>]
section: Legal Workflows
topLevelCli: true
---

You are running the `/contract-draft` workflow.

## Step 1 — Parse arguments

Extract from the user's message:
- `<contract-type>`: nda | supply | service | license
- `--parties`: party names (ask if not provided)
- `--jurisdiction`: governing law (default: DE)
- `--topic`: brief subject matter description (e.g., "software development services")

If contract-type is missing, ask: "What type of contract? (nda / supply / service / license)"

## Step 2 — Load BMW template

Check `knowledge-base/templates/` for a matching template:
- `nda` → `bmw-nda-standard.md`
- `supply` → `bmw-supply-agreement.md`
- `service` → `bmw-service-agreement.md`

Read the template. If no match, note that the draft will be based on general market standards for `<contract-type>` under `<jurisdiction>` law.

## Step 3 — Create matter and slug

Generate a slug: `<party-b-short>-<contract-type>-draft`.

## Step 4 — Write plan

Write `outputs/.plans/<slug>.md`:

```markdown
# Matter Plan: <slug>

- **Task type:** Contract Draft
- **Contract type:** <type>
- **Parties:** <Party A (BMW)> and <Party B>
- **Jurisdiction:** <jurisdiction>
- **Topic:** <topic>
- **Template:** <template path or "none — using market standard">
- **Date:** <today>

## Task ledger

- [ ] T1: contract-agent — draft contract from template + parameters
- [ ] T2: risk-agent — review draft for BMW risk exposure
- [ ] T3: qa-agent — citation check
```

## Step 5 — Draft contract

```json
{
  "tasks": [
    {
      "agent": "contract-agent",
      "task": "Read outputs/.plans/<slug>.md. Draft a <contract-type> contract between <Party A (BMW)> and <Party B> covering <topic>, governed by <jurisdiction> law. Use the template at <template path> as the base — fill in party-specific details and adapt clauses for the specific context. Ensure all BMW-standard clauses are present (liability cap, IP ownership, termination for cause, data protection, governing law). Write the complete draft to outputs/.drafts/<slug>-draft.md.",
      "output": "<slug>-draft.md"
    }
  ],
  "concurrency": 1,
  "failFast": false
}
```

## Step 6 — Risk review of draft

```json
{
  "tasks": [
    {
      "agent": "risk-agent",
      "task": "Read outputs/.plans/<slug>.md. Review the draft contract at outputs/.drafts/<slug>-draft.md for any risks to BMW. Check that BMW-standard protections are correctly included. Flag any gaps or weaknesses. Write outputs/.drafts/<slug>-draft-risk.md.",
      "output": "<slug>-draft-risk.md"
    }
  ],
  "concurrency": 1,
  "failFast": false
}
```

Apply any CRITICAL or HIGH risk findings to revise the draft before QA.

## Step 7 — QA pass

```json
{
  "tasks": [
    {
      "agent": "qa-agent",
      "task": "Review the draft at outputs/.drafts/<slug>-draft.md. Verify all legal references are accurate, jurisdiction is correctly applied throughout, and no placeholder text remains unfilled. Write outputs/.drafts/<slug>-qa-report.md.",
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
## Contract Draft: <slug>

**Contract type:** <type>
**Parties:** <A> and <B>
**Governing law:** <jurisdiction>

**Based on:** <template or "market standard">

**Risk review notes:**
- [Any CRITICAL/HIGH items the lawyer should check]

**Draft is ready for review at:** outputs/.drafts/<slug>-draft.md

**QA status:** [PASS/PASS WITH NOTES/BLOCKED]

This draft is for lawyer review — please review and modify before sending to counterparty.
Approve to save to matters folder?
```

## Step 9 — Deliver

On approval:
1. Copy draft to `outputs/matters/<slug>/<slug>-draft.md`
2. Write provenance sidecar
3. Confirm: "Draft saved. Please review outputs/matters/<slug>/<slug>-draft.md before sending to counterparty."
