# BMW Negotiation Playbook — Red Lines & Negotiable Levers

**Document type:** Cross-template negotiation map
**Governing law:** German law (BGB, HGB, GeschGehG, AktG, GmbHG, LkSG)
**Maintained by:** BMW Group Legal — Drafting & Negotiation Standards
**Status:** Authoritative. All Lex agents must consult this map before advising on positions.

---

## How to use this map

For every contract Lex reviews, drafts, or negotiates:

1. **Locate the contract type** in the matrix below.
2. **Treat the "Non-Negotiable / Red Lines" column as hard constraints.** These are mandatory carve-outs and form requirements driven by German statutory law (BGB, AktG, GmbHG, LkSG, GeschGehG) and BMW policy. Any deviation must be flagged as **CRITICAL** by `risk-agent` and as a **walk-away condition** by `negotiation-agent`.
3. **Treat the "Typically Negotiable" column as the lever set.** These are the items where BMW can trade, structure, or concede in exchange for value elsewhere.
4. **Default perspectives** (used for tone, opening positions, and BATNA framing):
   - Employment Agreement → **employer-friendly**
   - Commercial Lease → **landlord-friendly** (BMW is typically tenant; use this for opposing-side analysis, flip for own-side drafting)
   - Purchase Agreement → **seller-friendly / transaction-oriented**
   - Service Agreement (MD / Board) → **company-friendly**
   - Work Contract → **customer-oriented** (BMW is typically the customer)
5. **Economic levers** in negotiation should run primarily through: term, remuneration, liability caps, indemnities, options, allocation of maintenance / cure duties, non-competes, variable compensation, warranties, disclosure mechanics, and closing structure.

---

## Matrix

| Contract Type | Source Base | Non-Negotiable / Red Lines | Typically Negotiable |
|---|---|---|---|
| **Employment Agreement** | Standard employment + senior employee precedents. | Fixed-term arrangements and post-contractual non-competes require **written form**. Terminations must be in writing. Limitation periods must **not** capture claims based on intent, gross negligence, injury to life/body/health, or mandatory statutory claims. Probationary period **> 6 months** generally only supportable under a collective bargaining exception. | Recognition of prior service (except where there is a close factual link to a prior employment relationship with the same employer); transfer rights; workplace model; working time structure; overtime regime; voluntary benefits; company car; garden leave; design of non-compete and penalty clauses. |
| **Commercial Lease Agreement** | Office, commercial, logistics, production hall lease precedents. | Liability caps must carve out **intent, gross negligence, injury to life/body/health, fraud, guarantees, and mandatory statutory liability**. Exclusion of strict liability for initial defects under **§ 536a(1) BGB** only works if mandatory carve-outs remain intact. Indexation is regularly problematic if term **< 10 years**. | Permitted use; fixed term; options; rent level; rent-free periods; rent adjustment mechanism; security; subletting; exclusivity / competition protection; allocation of repair and cosmetic maintenance; traffic safety duties; insurance structure; modernization toleration; written-form cure mechanics; liability on landlord change; hazardous materials indemnity. |
| **Purchase Agreement** (asset / real estate / share) | Real estate purchase agreement, hotel development purchase agreement, SPA materials. | Fraud, intent, gross negligence, and injury to life/body/health must **not** be contractually cut off. If warranties are given, the liability regime must clearly preserve mandatory carve-outs. In real estate transactions, **transfer mechanics, priority notice / registration logic, and any mandatory notarization requirements** cannot be ignored. | Scope of warranties; knowledge qualifiers; disclosure effect; de minimis thresholds; baskets; caps; limitation periods; cure rights; closing mechanics; conditions precedent; purchase price holdbacks; indemnities; MAC-style protection; confidentiality; allocation of taxes, costs, and transition risk. |
| **Service Agreement** (Managing Director / Board Member) | Managing director service agreement and board service agreement precedents. | For listed companies, the service agreement must be **consistent with the company's remuneration system**. For board members, the **statutory D&O deductible** must be respected. Confidentiality clauses must not cut across whistleblower protections. Terminations should be documented in writing. | Term; notice period; linkage between office and service agreement; garden leave; age limits; fixed and variable compensation; bonus mechanics; company car; insurance scope; side benefits; post-contractual non-compete; non-compete compensation; clawback; penalty provisions. |
| **Work Contract** (Werkvertrag) | Event support work contract + liability playbook. | Liability clauses must preserve **intent, gross negligence, injury to life/body/health, fraud, guarantees, and mandatory product liability**. The statutory works defect framework remains the starting point; any shortening of limitation periods must be drafted carefully and separately. | Scope of work; interface matrix; change request mechanics; subcontractors / direct commissioning structures; lump-sum pricing; payment terms; delay caps; shortened limitation periods; confidentiality; data protection; force majeure. |
| **Supply Agreement** (Goods) | BMW standard supply agreement (existing). | Liability cap must carve out intent, gross negligence, injury to life/body/health, fraud, and mandatory product liability. **LkSG** compliance and supplier code adherence are mandatory. CISG is excluded. | Liability cap level (12 → 24 months purchase value); warranty period (24–36 months); payment terms (Net 30–60); IP allocation for funded development; audit cadence; termination-for-convenience notice; force majeure scope. |
| **NDA** (Mutual) | BMW standard NDA. | Confidentiality carve-outs for legally required disclosure must remain. Liability carve-outs for gross negligence and wilful misconduct must remain. GeschGehG-compliant trade-secret protection (reasonable protective measures) must be preserved. | Term (2 vs. 3 years); survival period (3 vs. 5 years for trade secrets); liability cap level; permitted recipients; return-vs-destroy election. |

---

## Cross-cutting red lines (apply to every contract type)

These statutory carve-outs **must always survive** any liability cap, exclusion, or limitation clause under German law:

1. **Intent (Vorsatz)** — § 276(3) BGB.
2. **Gross negligence (grobe Fahrlässigkeit)** — settled BGH case law on AGB control.
3. **Injury to life, body, or health** — § 309 No. 7(a) BGB.
4. **Fraud / fraudulent misrepresentation (Arglist)** — § 444 BGB.
5. **Expressly assumed guarantees (Garantien)** — § 444 BGB.
6. **Mandatory product liability** — ProdHaftG.
7. **Essential contractual obligations (Kardinalpflichten)** — for slight negligence, may be limited to typical and foreseeable damage but cannot be wholly excluded.

If a counterparty draft caps or excludes any of items 1–6, `risk-agent` must score **CRITICAL** and `negotiation-agent` must mark it as **walk-away**.

---

## Default negotiation tiers (template positions)

Use this structure for every contested clause. The negotiation map dictates whether something is a red line or a lever — it does not dictate the specific numeric position, which depends on commercial context.

| Position | Meaning |
|---|---|
| **BMW Preferred** | Opening position. Aligns with the BMW template clause. Used when leverage is strong. |
| **Acceptable** | Fallback. Compromises a lever (not a red line) in exchange for value elsewhere. |
| **Walk-Away** | The line BMW will not cross. Always equals or exceeds the red-line column for that contract type. |

---

## Drafting perspective labels (internal use)

When `contract-agent` drafts from the templates, label the draft internally with the perspective so the reader knows the bias to correct for if BMW sits on the other side:

- Employment templates → `[employer-friendly]`
- Lease templates → `[landlord-friendly]`
- Purchase templates → `[seller-friendly / transaction-oriented]`
- Service templates → `[company-friendly]`
- Work contract templates → `[customer-oriented]`
- Supply agreement → `[buyer-friendly / BMW]`
- NDA → `[mutual / balanced]`

---

*Source authority: derived from BMW Legal precedent set Q1–Q2 2024 and German statutory framework. Update only with Legal — Drafting Standards approval.*
