# Lex — BMW Legal AI Agent Platform

> **Munich Hacking Legal Challenge** — an AI agent platform for the BMW Group legal department.
> Lex coordinates specialized AI agents (contract review, compliance, research, risk) and returns
> structured, traceable, source-cited deliverables to human lawyers.

Built on the [Pi](https://github.com/mariozechner/pi) coding-agent runtime. Forked and re-purposed
from [Feynman](https://github.com/getcompanion-ai/feynman).

---

## Quick Start

### Install

```sh
# One-line install (clones into ~/.local/share/lex)
curl -fsSL https://raw.githubusercontent.com/itsamirkhon/lex/main/install.sh | bash

# OR via npm
npm install -g bmw-lex
```

### Configure

```sh
lex auth        # paste your OpenRouter API key (sk-or-v1-...)
```

Get a key at [openrouter.ai/keys](https://openrouter.ai/keys). Lex uses Claude Sonnet 4.5 by default.

### Run

```sh
lex                                          # interactive REPL
lex contract-review samples/acme-supplier-nda-draft.md --jurisdiction de
lex compliance-check "Acme GmbH" --check-type sanctions,lksg
lex legal-research "force majeure pandemic" --jurisdiction de,uk
lex-web                                      # web UI on http://localhost:3000
```

> **Name conflict on Linux?** A system tool `/usr/bin/lex` (a lexer generator) may shadow ours.
> Fix with `export PATH="$HOME/.local/bin:$PATH"` or use the `bmw-lex` alias.

---

## What Lex Does

A corporate legal department handles thousands of recurring tasks: reviewing supplier contracts,
checking entities against sanctions lists, researching jurisdictional differences, drafting from
templates. Lex automates the **decomposable parts** while keeping a human lawyer in the loop for
judgment calls.

Every workflow:

1. **Classifies** the request (contract type, jurisdiction, urgency)
2. **Plans** the approach in `outputs/.plans/<slug>.md`
3. **Delegates** subtasks to specialist agents in parallel
4. **Synthesizes** findings into a single deliverable
5. **QA-checks** all citations and jurisdiction coverage
6. **Gates** on human review before final delivery
7. **Returns** the artifact + a `.provenance.md` sidecar with full audit trail

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  CLI / Web UI                                                │
│  bin/lex.js  •  bin/lex-web.js (Next.js on :3000)           │
└────────────────────────────┬────────────────────────────────┘
                             │
              ┌──────────────▼───────────────┐
              │  Lex Orchestrator            │
              │  .lex/SYSTEM.md              │
              │  Pi runtime + extensions     │
              └──────────────┬───────────────┘
                             │
       ┌─────────────────────┼─────────────────────┐
       │                     │                     │
   ┌───▼────┐         ┌──────▼──────┐       ┌──────▼─────┐
   │Workflow│         │  Subagents  │       │   Tools    │
   │Prompts │         │  .lex/agents│       │ extensions/│
   └────────┘         └─────────────┘       └────────────┘

         File-based handoff via outputs/.plans, outputs/.drafts
```

### Specialized agents

| Agent | Role | Output |
|-------|------|--------|
| `contract-agent`   | Clause-by-clause review, redlines, BMW-template comparison | `contract-analysis.md` |
| `compliance-agent` | OFAC/EU sanctions, LkSG, ESG, GDPR checks | `compliance-report.md` |
| `research-agent`   | Statute & case law (DE / US / UK / FR / EU) | `legal-research.md` |
| `risk-agent`       | Risk register with CRITICAL/HIGH/MEDIUM/LOW grading | `risk-assessment.md` |
| `negotiation-agent`| BATNA, position tiers (preferred → walk-away), redlines | `negotiation-brief.md` |
| `knowledge-agent`  | Internal precedent / template / memo search | `kb-results.md` |
| `qa-agent`         | Citation verification, jurisdiction completeness | `qa-report.md` |

### Workflow commands

| Command | Description |
|---------|-------------|
| `/contract-review <file> [--jurisdiction <de\|us\|uk\|fr>]` | Risk-grade a contract clause-by-clause |
| `/compliance-check <topic> [--check-type sanctions\|lksg\|esg\|gdpr\|all]` | Multi-framework compliance assessment |
| `/legal-research <question> [--jurisdiction <de\|us\|uk\|fr\|all>]` | Cross-jurisdiction statutory + case law research |
| `/risk-assessment <file-or-topic>` | Comprehensive legal risk register |
| `/contract-draft <nda\|supply\|service> [--jurisdiction <de>]` | Draft from BMW standard templates |

### Custom legal tools

Registered as Pi tools, available to all agents:

- `legal_web_search` — pre-filtered for `gesetze-im-internet.de`, `eur-lex.europa.eu`, `bailii.org`, etc.
- `sanctions_check` — searches OFAC SDN, EU Consolidated, UN Security Council lists
- `eurlex_search` — EU regulations, directives, decisions
- `document_parse` — PDF/DOCX → plaintext for contract analysis
- `document_upload` — copies files into a matter workspace

---

## Project Layout

```
.
├── bin/                       # CLI entry points (lex, lex-web)
├── dist/                      # Compiled TypeScript (cli, paths, runtime, setup)
├── extensions/
│   ├── legal-tools.ts         # Pi extension entry
│   └── legal-tools/           # Sub-modules (search, document, matter, header)
├── prompts/                   # Workflow templates (slash commands)
│   ├── contract-review.md
│   ├── compliance-check.md
│   ├── legal-research.md
│   ├── risk-assessment.md
│   └── contract-draft.md
├── .lex/
│   ├── SYSTEM.md              # Orchestrator system prompt
│   ├── settings.json          # Pi packages config
│   └── agents/                # 7 specialized subagent definitions
├── knowledge-base/            # BMW internal legal corpus (mock)
│   ├── templates/             # Standard NDA, supply, service agreements
│   ├── precedents/            # Approved clause language
│   └── memos/                 # LkSG checklist, sanctions procedure
├── samples/                   # Demo contracts for testing
├── web/                       # Next.js 15 web UI
│   └── app/
│       ├── page.tsx           # Main UI (slash-command input + artifact viewer)
│       └── api/               # task / status / upload / artifacts routes
├── scripts/
│   └── patch-embedded-pi.mjs  # Runtime patches to embedded Pi (tool name filter, etc.)
├── outputs/                   # Generated at runtime
│   ├── .plans/<slug>.md       # Matter plans (orchestrator scratch)
│   ├── .drafts/<slug>-*.md    # Subagent intermediate artifacts
│   └── matters/<id>/          # Final deliverables + provenance
├── install.sh                 # One-line installer
└── package.json
```

---

## Provenance & Auditability

Every final deliverable is paired with a `.provenance.md` sidecar:

```markdown
- Matter ID: bmw-acme-nda-review
- Date: 2026-04-25
- Jurisdiction(s): DE
- Governing Law: BGB / GeschGehG
- Task Type: contract-review
- Agents used: contract-agent, risk-agent, knowledge-agent, qa-agent
- Sources consulted: 14   |   Sources verified: 12
- QA result: PASS WITH NOTES
- QA MAJOR findings: Liability cap §8.2 references unverified market norm
- Human review gate: APPROVED
- Privilege status: PRIVILEGED
```

This enables full audit trails for regulatory inquiries, BAFA reporting, and internal governance.

---

## Demo Scenarios

### 1. Contract Review (CLI, ~2 min)

```sh
lex contract-review samples/acme-supplier-nda-draft.md --jurisdiction de
```

The sample NDA contains 5 intentional defects. Expected output:
- Clause-by-clause risk table
- 2 HIGH risks flagged (unlimited liability, wrong governing law)
- Negotiation positions per contested clause
- Comparison against `knowledge-base/templates/bmw-nda-standard.md`

### 2. Compliance Check (CLI, ~1.5 min)

```sh
lex compliance-check "supply chain partnership XYZ Corp China" --check-type sanctions,lksg
```

- OFAC SDN / EU / UN sanctions screening
- LkSG due-diligence checklist (10+ items)
- PASS / FAIL / REQUIRES_REVIEW per framework

### 3. Multi-Jurisdiction Research (CLI, ~2 min)

```sh
lex legal-research "force majeure pandemic clause enforceability" --jurisdiction de,uk
```

Comparative table with BGH and English High Court citations. All URLs verified by `qa-agent`.

### 4. Web UI (~2 min)

```sh
lex-web
# open http://localhost:3000
```

Drag-and-drop contract upload, live agent activity log, artifact viewer with markdown rendering,
provenance panel.

---

## Tech Stack

- **Runtime**: Pi coding-agent (`@mariozechner/pi-coding-agent`) on Node.js 20+
- **LLM**: Claude Sonnet 4.5 via OpenRouter (configurable to other providers)
- **Extension language**: TypeScript (loaded via `tsx` at runtime)
- **Web UI**: Next.js 15, React 19, react-markdown
- **Storage**: File-based (no database) — `outputs/`, `~/.lex/agent/`
- **Tool framework**: TypeBox JSON Schema for tool parameters

### Why file-based storage?

For legal work, the audit trail of intermediate artifacts is a feature, not a workaround. Plans,
drafts, QA reports, and provenance sidecars all sit on disk in human-readable Markdown — making the
system fully auditable, resumable across sessions, and easy to inspect without a database.

---

## Development

```sh
git clone https://github.com/itsamirkhon/lex.git
cd lex
npm install
lex --version

# Run from source
node bin/lex.js --help
```

### Adding a new agent

1. Create `.lex/agents/your-agent.md` with YAML frontmatter (`name`, `description`, `tools`, `output`)
2. Reference it in workflow prompts under `prompts/`
3. Restart Lex — it auto-discovers agents at startup

### Adding a new tool

Edit `extensions/legal-tools/your-tool.ts`, register via `pi.registerTool()`, and re-export from
`extensions/legal-tools.ts`.

---

## Open Questions for Production Deployment

- **Real Otto-Schmidt / Beck-Online integration** — currently uses targeted web search as fallback
- **Vector DB for KB search** — `knowledge-agent` currently uses grep, fine for MVP
- **MCP wrapping** — tools are inline Pi extensions; MCP server form would enable cross-agent reuse
- **Authentication** — web UI runs on localhost only; production needs SSO + role-based access
- **DOCX redline output** — currently emits Markdown; lawyers paste into Word

---

## License

MIT — built for the Munich Hacking Legal Challenge by BMW Group.

## Links

- Repository: https://github.com/itsamirkhon/lex
- Pi framework: https://github.com/mariozechner/pi
- Munich Hacking Legal: https://munich-hacking-legal.bmw.com (challenge brief)
