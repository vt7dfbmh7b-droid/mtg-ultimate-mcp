# MTG Ultimate MCP

An MCP-powered Magic: The Gathering / Commander knowledge, rules, deck-building, upgrade, precon, printing, pricing, combo, simulation and evidence service.

The goal is an **MTG brain for AI clients**: accurate card/rules knowledge, legal Commander construction, exact physical printings, useful simulations, evidence-backed upgrades, complete deck drafts, and simple explanations on top of deeper logic.

## Current stage — V0.11

V0.11 is a **refinement and optimization release**. Instead of only making one upgrade pass, MTG Ultimate can now iteratively improve a legal deck, rebuild it, re-check legality, compare the new version with the previous one, and stop when further changes no longer clear the requested improvement threshold.

The preferred workflow is now:

`rules + exact printing policy -> analyse -> propose small package -> rebuild -> validate -> same-seed compare -> budget check -> accept/reject -> repeat`

The engine deliberately keeps the current legal list when another round would be weaker, illegal, over budget, unverifiable, or below the improvement threshold.

### New V0.11 tools

| Tool | Purpose |
| --- | --- |
| `refine_commander_deck_v11` | Iteratively improve any supplied legal Commander deck. |
| `refine_precon_v11` | Start from an exact stock precon and iteratively improve it. |
| `build_and_refine_commander_deck_v11` | Build a legal 100-card draft from scratch, then refine it instead of treating the first draft as final. |

### Total-budget support

V0.11 separates two budget rules:

- `maxUsdPerCard` — maximum price of each incoming physical printing.
- `maxTotalUsd` — maximum combined reference price of all accepted upgrade swaps.

If a strict total budget is active and a selected printing has no verifiable reference price, the package is rejected rather than pretending it fits.

For from-scratch construction, `maxPostDraftUpgradeUsd` only applies to refinement swaps after the first draft; it is not described as a full-deck purchase budget.

### Conservative iterative optimization

Accepted changes become the input to the next round. New cards are protected by default so the optimizer does not immediately undo successful changes, while cards already cut are not re-added in the same run.

The internal acceptance score uses same-deck before/after signals such as opening-hand quality, commander uptime, protection, spell throughput and smaller structural role changes. It is **not** presented as a universal power score or measured win rate.

## Simple explanations by default

Normal answers lead with what matters:

> **Add:** Card X — improves early interaction and works directly with the commander.  
> **Cut:** Card Y — expensive and contributes less to the main plan.  
> **Result:** the refined version tested better, stayed legal and fits the requested budget.

Detailed round scoring, simulation outputs and evidence dumps remain available through `standard` or `detailed` output when useful.

## Commander precons

V0.10+ treats Commander preconstructed decks as first-class objects.

Instead of hard-coding a frozen list, MTG Ultimate reads the current MTGJSON deck catalog, filters Commander/EDH products, caches the catalog and fetches the exact stock deck when requested.

Stock identity retains quantity, card name, set code, collector number and foil/nonfoil status. Regular vs Collector/foil product variants remain separate when the source lists them separately.

Key precon tools retained:

| Tool | Purpose |
| --- | --- |
| `list_commander_precons_v10` | Browse/search the self-updating precon catalog. |
| `get_precon_stock_deck_v10` | Fetch the untouched exact stock deck. |
| `analyze_precon_v10` | Analyse stock legality, structure, combos/bracket evidence and simulation. |
| `precon_upgrade_profiles_v10` | Show light/balanced/strong/optimized/custom upgrade levels. |
| `upgrade_precon_v10` | Generate a one-pass exact OUT -> IN upgrade plan. |
| `refine_precon_v11` | Run the newer iterative upgrade process from the same exact stock baseline. |

## Printing-aware deck building

MTG Ultimate separates **Oracle identity** from **physical printing identity**.

Rules and synergy use the Oracle card. Shopping/value and themed-printing restrictions use the exact edition:

```text
1 Card Name (SET) 123
```

Foil/etched/nonfoil information is retained where available.

A restriction such as **“Final Fantasy printings only”** means the selected physical printing must belong to the allowed FINAL FANTASY family. Qualifying promos and curated special/Secret Lair releases can be included; an unrelated printing of the same Oracle card cannot substitute.

The same restriction remains active during iterative refinement.

## Commander legality

The hard rules layer validates:

- commander eligibility
- supported partner/two-commander configurations
- 100-card construction
- color identity
- singleton/basic/card-specific copy exceptions
- current Commander legality/banned status

Example: a black-red commander may use black, red, black-red and colorless identity cards, but not white, blue or green identity cards.

Fully resolved illegal decks are blocked from advanced upgrade/refinement/simulation workflows.

## Deck building and upgrading

The builder/upgrader supports:

- decks from scratch
- exact IN/OUT swaps
- full rebuilt decklists
- target bracket
- theme restrictions
- protected/must-include/excluded cards
- per-card and iterative total-upgrade budgets
- allowed-set and printing-family restrictions
- exact set + collector output
- role/mana analysis
- combo discovery
- before/after simulation
- public/tournament/community evidence
- iterative stop-on-plateau refinement

A generated 100-card list is treated as an evidence-backed draft, not an automatic claim of global optimality.

## Multi-source evidence

Different evidence classes stay separate:

- Wizards — official rules/product facts
- Scryfall — cards, legalities, printings, reference prices
- Commander Spellbook — combos and bracket evidence
- TopDeck.gg / EDHTop16 — competitive results/decklists
- Playgroup.gg — recorded paper Commander context
- EDHREC — broad Commander adoption/synergy/precon context
- Archidekt / Moxfield / MTGGoldfish / AetherHub — public deck references and primers
- cEDH Decklist Database — curated competitive archetype context
- DeckCheck — independent deck-analysis opinion
- TCGfind NZ — New Zealand availability/local-price checks
- TCGplayer / Cardmarket — international market cross-checks

No single popularity score, analysis score or tournament finish is treated as proof that a card is universally best.

## Gameplay/simulation foundation

Earlier versions provide London-style mulligans, colored mana, common conditional lands/fetches, ramp, tutors, draw, commander tax, Treasures, common special payment mechanics, supported alternative costs, commander removal/recasts, protection battles, Ward-aware targeting, multiplayer stack abstractions, combat modifiers and zone-aware combo readiness.

The simulator is deliberately **not** described as a complete digital implementation of every Magic rule.

## Reliability refinements

V0.11 adds bounded automatic retries for safe GET/HEAD data requests on temporary statuses such as `429`, `500`, `502`, `503` and `504`, with `Retry-After` support where provided. Permanent client errors are not hidden, and write-like requests are not automatically retried by the shared helper.

Default settings:

```text
HTTP_TIMEOUT_MS=15000
HTTP_RETRY_ATTEMPTS=3
HTTP_RETRY_BASE_MS=250
PRECON_CATALOG_CACHE_MS=21600000
```

## Documentation

- `docs/V0.4_RULES_AND_SIMULATION.md`
- `docs/V0.5_ADVANCED_GAMEPLAY.md`
- `docs/V0.6_HYBRID_SIMULATION.md`
- `docs/V0.7_DECKBUILDING_AND_INTERACTION.md`
- `docs/V0.8_PRINTING_FAMILIES.md`
- `docs/V0.9_MULTI_SOURCE_EVIDENCE.md`
- `docs/V0.10_PRECON_INTELLIGENCE.md`
- `docs/V0.11_REFINEMENT.md`

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

The feature branch remains under active development in a draft PR. A stage is only treated as complete after strict TypeScript compilation and the full test suite pass.
