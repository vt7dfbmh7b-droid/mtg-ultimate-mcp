# MTG Ultimate MCP

An MCP-powered Magic: The Gathering knowledge, Commander rules, deck-building, **printing-family aware** pricing/upgrades, simulation, combo, gameplay, and multi-source evidence service.

The goal is an **MTG brain for AI clients**: accurate card knowledge, legal Commander construction, exact edition-aware prices, useful simulations, evidence-backed upgrades, complete deck drafts, and real-world cross-references—while keeping normal explanations simple.

## Current stage — V0.9

V0.9 adds a **multi-source evidence layer** on top of the V0.8 printing-family, deck-building, rules and simulation foundation.

The central ideas are:

> **Rules facts, tournament results, recorded paper games, community popularity, primers, analysis scores and prices answer different questions. Do not collapse them into one fake certainty score.**

> **Oracle identity answers “what card is this?” Physical printing identity answers “is this exact edition allowed, and what does this edition cost?”**

## Simple explanations by default

Normal answers should lead with the practical conclusion. Card explanations focus on what the card does, why it is useful and at most one important rule when needed. Deck conclusions should sound like:

- `This swap gives you more early interaction and is supported by both community and tournament lists.`
- `This card is popular, but it is slow in this exact deck and the simulation does not support the swap.`
- `The card works mechanically, but no qualifying Final Fantasy printing fits the requested budget.`

Detailed source counts, simulation values and rules reasoning remain available when useful or requested.

## V0.9 cross-reference sources

MTG Ultimate now distinguishes sources by evidence class and intended use.

| Source | Main use |
| --- | --- |
| Wizards of the Coast | Official rules, products, bans/restrictions and releases |
| Scryfall | Oracle data, legality, exact printings, set/collector identity and reference prices |
| Commander Spellbook | Curated combos and near-combos |
| TopDeck.gg | Tournament standings, records and submitted EDH decklists |
| EDHTop16 | Additional competitive EDH tournament/meta evidence through its structured API |
| cEDH Decklist Database | Reviewer-curated cEDH archetypes and primers |
| Playgroup.gg | Recorded paper Commander game/deck outcome context |
| EDHREC | Broad Commander adoption, synergy and theme signals |
| Archidekt | Public deck references with existing structured integration |
| Moxfield | Public lists and detailed primers as attributed references |
| MTGGoldfish | Commander decklists, metagame and secondary price context |
| AetherHub | Additional public decks, deck-building and simulation references |
| DeckCheck | Independent CRISPI / PowerTune / DeckTrim-style second opinion |
| TCGfind NZ | New Zealand availability and local-price checking |
| TCGplayer / Cardmarket | Secondary international printing-price references |

Where a stable documented integration exists, MTG Ultimate can use structured data. Where it does not, the system returns an attributed research destination/query instead of depending on brittle undocumented private endpoints.

### V0.9 tools

| Tool | Purpose |
| --- | --- |
| `list_reference_sources_v09` | Show source roles, evidence classes, weighting and cautions. |
| `research_commander_across_sources_v09` | Research one/two commanders across the source set, including live EDHTop16 evidence when available. |
| `cross_reference_deck_evidence_v09` | Combine Archidekt, TopDeck, EDHTop16 and the wider evidence registry for deck-building/upgrading decisions. |

For build/upgrade work, the preferred loop is:

`rules + printing policy -> analyse -> candidate changes -> cross-reference -> simulate -> rebuild -> validate -> explain simply`

Agreement between different evidence classes is useful. Two websites that contain the same tournament/deck are not treated as two independent proofs.

## V0.8 themed printing-family behavior retained

A request such as **“Final Fantasy printings only”** means every card must have an eligible physical printing belonging to the FINAL FANTASY product/franchise family—not merely that the card was originally designed in the main set.

By default a themed family can include matching main/supplemental sets, qualifying promos, bonus/special releases, curated franchise Secret Lair printings and tied bundle/product promos.

Promo status alone is never sufficient. An unrelated Secret Lair printing cannot enter a Final Fantasy-only deck merely because it is a promo.

Key tools:

| Tool | Purpose |
| --- | --- |
| `find_printings_in_family_v08` | Find qualifying physical printings of an Oracle card. |
| `normalize_deck_printings_v08` | Convert an existing list to the requested printing family. |
| `build_commander_deck_v08` | Build a Commander deck under printing-family rules. |
| `plan_commander_upgrade_v08` | Produce exact IN/OUT swaps with qualifying edition-specific prices. |

Rules/combos use Oracle identity. Shopping/value uses exact printing identity, including set code, collector number and finish.

## Commander rules retained

The hard legality layer enforces Commander eligibility, supported commander pairs, exactly 100 cards, combined commander color identity, singleton/basic/card-specific copy-count rules and current legality data.

Example: a black-red commander allows black, red, black-red and colorless identity cards, but not cards containing white, blue or green identity.

A fully resolved illegal Commander deck is blocked from advanced optimization/simulation.

## Deck building and upgrades retained

The builder and upgrade engine support:

- from-scratch Commander deck drafts
- exact IN/OUT swaps
- protected/must-include/excluded cards
- target bracket
- theme restrictions
- per-card budgets
- set/printing-family restrictions
- exact set code + collector number output
- mana/role analysis
- known and near-combo evidence
- before/after same-seed simulation
- public/tournament reference comparisons

A first generated 100-card list is a draft, not a claim of global optimality. Future optimization passes can build -> simulate -> cross-reference -> replace -> re-simulate.

## Simulation/gameplay foundation retained

Earlier versions model London-style mulligans, colored mana, common conditional lands/fetches, ramp, tutors, draw, commander tax, Treasures, convoke, improvise, delve, affinity, Phyrexian mana, supported alternative costs, commander removal/recasts, protection battles, Ward-aware targeting, common multiplayer stack chains, supplied combat modifiers and zone-aware combo readiness.

The simulator is deliberately not described as a complete digital implementation of every Magic rule.

## Data and reliability principles

- Official rules/card facts beat community opinions.
- Popularity is an adoption signal, not a win-rate signal.
- Tournament results are observed associations, not proof that one card caused a win.
- Casual recorded games and cEDH tournaments represent different environments.
- Curated primers are strategy context, not measured results.
- Avoid double-counting overlapping events/decks across websites.
- Keep exact printing restrictions active through building, upgrades, pricing and final decklists.
- Do not depend on undocumented private APIs when an attributed public reference is safer.

See:

- `docs/V0.4_RULES_AND_SIMULATION.md`
- `docs/V0.5_ADVANCED_GAMEPLAY.md`
- `docs/V0.6_HYBRID_SIMULATION.md`
- `docs/V0.7_DECKBUILDING_AND_INTERACTION.md`
- `docs/V0.8_PRINTING_FAMILIES.md`
- `docs/V0.9_MULTI_SOURCE_EVIDENCE.md`

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Endpoints:

- MCP: `http://localhost:3000/mcp`
- Health: `http://localhost:3000/health`

Build and test:

```bash
npm run check
```

Optional tournament configuration:

```text
TOPDECK_API_KEY=...
EDHTOP16_API_BASE=https://edhtop16.com/api
```

The repository remains under active development on the feature branch and draft PR. A stage is only treated as green after strict TypeScript compilation and the full test suite pass.
