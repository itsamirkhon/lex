---
description: Research a legal question across specified jurisdictions with statute and case law citations.
args: <question> [--jurisdiction <de|us|uk|fr|all>]
section: Legal Workflows
topLevelCli: true
---

You are running the `/legal-research` workflow.

## Step 1 — Parse arguments

Extract from the user's message:
- `<question>`: the legal question to research
- `--jurisdiction`: one or more of `de`, `us`, `uk`, `fr`, `all` (default: `de` if not specified)

If question is missing or ambiguous, clarify before proceeding.

## Step 2 — Create matter and slug

Generate a slug: `<2-3 word question summary>-research` (e.g., `force-majeure-research`).

## Step 3 — Scale decision

- **Single jurisdiction, narrow question**: spawn 1 research-agent
- **Multiple jurisdictions**: spawn 1 research-agent per jurisdiction in parallel (max 4 concurrent)
- **"all" jurisdictions**: spawn 4 agents — DE, US, UK, FR

## Step 4 — Write plan

Write `outputs/.plans/<slug>.md`:

```markdown
# Matter Plan: <slug>

- **Task type:** Legal Research
- **Question:** <question>
- **Jurisdiction(s):** <list>
- **Date:** <today>

## Task ledger

- [ ] T1: research-agent (DE) — if DE in scope
- [ ] T2: research-agent (US) — if US in scope
- [ ] T3: research-agent (UK) — if UK in scope
- [ ] T4: research-agent (FR) — if FR in scope
- [ ] T5: qa-agent — citation verification
```

## Step 5 — Delegate research agents in parallel

For each jurisdiction in scope:

```json
{
  "tasks": [
    {
      "agent": "research-agent",
      "task": "Read outputs/.plans/<slug>.md. Research the following legal question under German (DE) law: <question>. Focus on: applicable statutes (gesetze-im-internet.de), BGH case law (bundesgerichtshof.de), and EU directives from eur-lex.europa.eu. Write findings with verified URLs to outputs/.drafts/<slug>-research-de.md.",
      "output": "<slug>-research-de.md"
    },
    {
      "agent": "research-agent",
      "task": "Read outputs/.plans/<slug>.md. Research the following legal question under UK law: <question>. Focus on: legislation.gov.uk statutes, BAILII case law, and UK Supreme Court decisions. Write findings with verified URLs to outputs/.drafts/<slug>-research-uk.md.",
      "output": "<slug>-research-uk.md"
    }
  ],
  "concurrency": 4,
  "failFast": false
}
```

## Step 6 — Synthesize

Read all research output files. Write synthesis to `outputs/.drafts/<slug>-synthesis.md`:

- **Research Question:** restate clearly
- **Summary Answer**: 2–3 sentence direct answer
- **Comparative Analysis Table** (if multi-jurisdiction):

| Issue | DE | US | UK | FR |
|-------|-----|-----|-----|-----|
| [Key aspect] | [rule + citation] | [rule + citation] | [rule + citation] | [rule + citation] |

- **Key Statutes and Cases**: numbered list per jurisdiction
- **Practical Implications for BMW**: what does this mean for contracts, compliance, or litigation?
- **Open Questions**: issues where law is unsettled or conflicts between jurisdictions

## Step 7 — QA pass

```json
{
  "tasks": [
    {
      "agent": "qa-agent",
      "task": "Review outputs/.drafts/<slug>-synthesis.md and all source research files (outputs/.drafts/<slug>-research-*.md). Verify all statute citations, case references, and URLs. Check jurisdiction completeness. Write outputs/.drafts/<slug>-qa-report.md.",
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
## Legal Research: <question>

**Jurisdictions covered:** <list>

**Summary answer:**
<2–3 sentences>

**Key sources:**
- [Source 1] — [jurisdiction]
- [Source 2] — [jurisdiction]

**QA status:** [PASS/PASS WITH NOTES/BLOCKED]

Approve for delivery?
```

## Step 9 — Deliver

On approval:
1. Copy to `outputs/matters/<slug>/<slug>-research.md`
2. Write provenance sidecar
3. Confirm delivery
