---
description: Draft a contract using BMW standard templates and provided parameters.
args: <contract-type> [--parties "<party-a> and <party-b>"] [--jurisdiction <de|us|uk|fr>] [--topic <brief description>]
section: Legal Workflows
topLevelCli: true
---

You are running the `/contract-draft` workflow.

## Step 1 — Parse arguments

Extract from the user's message:
- `<contract-type>`: nda | supply | service-md | employment | lease | work | purchase
- `--parties`: party names (ask if not provided)
- `--jurisdiction`: governing law (default: DE)
- `--topic`: brief subject matter description (e.g., "office lease in Munich", "asset deal for spare-parts business")

If contract-type is missing, ask: "What type of contract? (nda / supply / service-md / employment / lease / work / purchase)"

## Step 2 — Load BMW Code + playbook + template

**Always load the BMW Code of Conduct first:** `knowledge-base/policies/bmw-code-of-conduct-2025.md`. Use it as the primary BMW conduct frame for compliance, ethics, governance, data privacy, anti-corruption, fair treatment of contracting partners, environmental, human-rights, and company-asset obligations.

Then load the negotiation playbook: `knowledge-base/playbook/negotiation-map.md`. The red-lines column for the chosen contract type is mandatory and must be reflected in every draft.

Then check `knowledge-base/templates/` for a matching template:
- `nda` → `bmw-nda-standard.md`
- `supply` → `bmw-supply-agreement.md`
- `service-md` → `bmw-service-agreement-md.md` (managing director / board member)
- `employment` → `bmw-employment-agreement.md`
- `lease` → `bmw-commercial-lease-agreement.md`
- `work` → `bmw-work-contract.md` (Werkvertrag)
- `purchase` → `bmw-purchase-agreement.md` (asset / real estate / share deal)

Read the template. If no match, note that the draft will be based on general market standards for `<contract-type>` under `<jurisdiction>` law, but the red-lines from the playbook still apply.

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
- **Primary BMW policy source:** knowledge-base/policies/bmw-code-of-conduct-2025.md
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
      "task": "Read outputs/.plans/<slug>.md, knowledge-base/policies/bmw-code-of-conduct-2025.md, and knowledge-base/playbook/negotiation-map.md. Draft a <contract-type> contract between <Party A (BMW)> and <Party B> covering <topic>, governed by <jurisdiction> law. Use the Code of Conduct as the BMW conduct frame and the template at <template path> as the drafting base — fill in party-specific details and adapt clauses for the specific context. Every red-line item from the playbook for this contract type MUST be reflected in the draft (mandatory carve-outs for intent / gross negligence / life-body-health / fraud / guarantees / mandatory statutory liability; written-form requirements; jurisdiction-specific constraints such as § 311b BGB notarization for real estate or § 87a AktG for listed-company remuneration). Label the draft internally with the perspective from the playbook (e.g. [employer-friendly], [landlord-friendly]). Write the complete draft to outputs/.drafts/<slug>-draft.md.",
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
      "task": "Read outputs/.plans/<slug>.md, knowledge-base/policies/bmw-code-of-conduct-2025.md, knowledge-base/playbook/negotiation-map.md, and the draft contract at outputs/.drafts/<slug>-draft.md. Verify that every red-line for this contract type is present in the draft — any missing or weakened red-line is a CRITICAL finding. Then run the standard BMW risk sweep (litigation, regulatory, financial, reputational, operational) including Code of Conduct alignment. Write outputs/.drafts/<slug>-draft-risk.md.",
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
