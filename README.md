# MTG Ultimate MCP

An MCP-powered Magic: The Gathering / Commander knowledge, deck-building, upgrade, precon, printing, pricing, combo, simulation and evidence service.

The goal is an **MTG brain for AI clients**: accurate card/rules knowledge, legal Commander construction, exact physical printings, useful simulations, evidence-backed upgrades, complete deck drafts, and simple explanations on top of the deeper logic.

## Current stage — V0.10

V0.10 makes **Commander preconstructed decks first-class objects**.

Instead of hard-coding hundreds of lists, MTG Ultimate reads the current MTGJSON deck catalog, filters Commander/EDH products, caches it, and fetches the exact stock deck when requested. This lets the catalog grow as the source adds future Commander products.

The stock physical deck identity is retained: quantity, card name, set code, collector number, and foil/nonfoil status.

### New V0.10 tools

| Tool | Purpose |
| --- | --- |
| `list_commander_precons_v10` | Browse/search the self-updating Commander precon catalog by name, year or code. |
| `get_precon_stock_deck_v10` | Fetch the untouched stock list with exact physical printing information. |
| `analyze_precon_v10` | Analyse the stock list with Commander rules, metrics, combos/bracket evidence and simulation. |
| `precon_upgrade_profiles_v10` | Show light, balanced, strong, optimized and custom upgrade paths. |
| `upgrade_precon_v10` | Generate exact OUT -> IN upgrades, rebuild the full deck and simulate stock vs upgraded. |

Product variants such as regular and Collector/foil editions remain separate when MTGJSON lists them separately because the physical versions can have different printings and values.

### Upgrade profiles

- **Light:** up to 5 swaps, default $5/card cap.
- **Balanced:** up to 10 swaps, default $10/card cap.
- **Strong:** up to 15 swaps, default $20/card cap.
- **Optimized:** up to 15 swaps with no default per-card price cap.
- **Custom:** caller supplies bracket, swap count, price and other restrictions.

These are starting profiles, not universal power labels. Every option can still respect the intended precon plan, protected cards, exclusions, target bracket, allowed sets, budget and themed physical-printing policy.

A typical upgrade workflow is:

`exact stock deck -> Commander legality -> analyse -> candidate OUT/IN swaps -> printing/price restrictions -> rebuild -> validate -> same-seed simulation -> cross-reference evidence -> simple recommendation`

EDHREC precon pages and the V0.9 source network are supplied as evidence references. Community popularity is not automatically treated as proof that a card is optimal.

## Simple explanations by default

Normal answers lead with what matters rather than internal calculations. For example:

> **Add:** Card X — fixes weak early ramp and works directly with the commander.  
> **Cut:** Card Y — expensive and rarely advances the main plan.

Detailed simulation, source counts and rules reasoning stay available when useful.

## Printing-aware deck building

MTG Ultimate separates **Oracle identity** from **physical printing identity**.

Rules and synergy use the Oracle card. Shopping/value and themed-printing restrictions use the exact edition:

```text
1 Card Name (SET) 123
```

Foil/etched/nonfoil information is retained where available.

A restriction such as **“Final Fantasy printings only”** means the selected physical printing must belong to the allowed FINAL FANTASY family. Qualifying promos and curated special/Secret Lair releases can be included; an unrelated printing of the same Oracle card cannot substitute.

## Commander legality

The hard rules layer validates:

- commander eligibility
- supported partner/two-commander configurations
- 100-card construction
- color identity
- singleton/basic/card-specific copy exceptions
- current Commander legality/banned status

Example: a black-red commander may use black, red, black-red and colorless identity cards, but not white, blue or green identity cards.

Fully resolved illegal decks are blocked from advanced upgrade/simulation workflows.

## Deck building and upgrading

The general builder/upgrader supports:

- decks from scratch
- exact IN/OUT swaps
- full rebuilt decklists
- target bracket
- theme restrictions
- protected/must-include/excluded cards
- per-card price limits
- allowed-set and printing-family restrictions
- exact set + collector output
- role/mana analysis
- combo discovery
- before/after simulation
- public/tournament/community evidence

A generated 100-card list is treated as an evidence-backed draft, not an automatic claim of global optimality.

## Multi-source evidence

V0.9+ keeps different evidence classes separate:

- Wizards — official rules/product facts
- Scryfall — cards, legalities, printings, reference prices
- Commander Spellbook — combos and bracket evidence
- TopDeck.gg / EDHTop16 — competitive results/decklists
- Playgroup.gg — recorded paper Commander context
- EDHREC — broad Commander adoption/synergy/precon add-cut context
- Archidekt / Moxfield / MTGGoldfish / AetherHub — public deck references and primers
- cEDH Decklist Database — curated competitive archetype context
- DeckCheck — independent deck-analysis opinion
- TCGfind NZ — New Zealand availability/local-price checks
- TCGplayer / Cardmarket — international market cross-checks

No single popularity score, analysis score or tournament finish is treated as proof that a card is universally best.

## Gameplay/simulation foundation

Earlier versions provide London-style mulligans, colored mana, common conditional lands/fetches, ramp, tutors, draw, commander tax, Treasures, common special payment mechanics, supported alternative costs, commander removal/recasts, protection battles, Ward-aware targeting, multiplayer stack abstractions, combat modifiers and zone-aware combo readiness.

The simulator is deliberately **not** described as a complete digital implementation of every Magic rule.

## Documentation

- `docs/V0.4_RULES_AND_SIMULATION.md`
- `docs/V0.5_ADVANCED_GAMEPLAY.md`
- `docs/V0.6_HYBRID_SIMULATION.md`
- `docs/V0.7_DECKBUILDING_AND_INTERACTION.md`
- `docs/V0.8_PRINTING_FAMILIES.md`
- `docs/V0.9_MULTI_SOURCE_EVIDENCE.md`
- `docs/V0.10_PRECON_INTELLIGENCE.md`

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

Optional/configurable sources include TopDeck, EDHTop16 and MTGJSON. The precon catalog cache defaults to six hours and can be force-refreshed through the precon catalog tool.

The feature branch remains under active development in a draft PR. A stage is only treated as complete after strict TypeScript compilation and the full test suite pass.
