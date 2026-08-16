# MTG Ultimate MCP

An MCP-powered Magic: The Gathering knowledge, Commander rules, deck-building, **printing-family aware** pricing/upgrades, simulation, combo, interaction, combat, and evidence-analysis service.

The goal is an **MTG brain for AI clients**: accurate card knowledge, legal Commander construction, exact edition-aware prices, realistic-enough simulations, useful upgrades, complete deck drafts, and real-world reference evidence—while keeping normal explanations simple.

## Current stage — V0.8

V0.8 adds **physical printing-family policies** on top of the V0.7 deck-building and gameplay foundation.

The central rule is:

> **Oracle identity answers “what card is this?” Physical printing identity answers “is this exact edition allowed, and what does this edition cost?”**

That means a request such as **“Final Fantasy printings only”** does not mean “only cards originally designed in the FINAL FANTASY set.” It means every card used must have an eligible physical printing belonging to the FINAL FANTASY product/franchise family.

By default, a themed family can include:

- normal/main-set printings
- Commander/supplemental printings in the same family
- qualifying promo sets
- qualifying bonus/special printings
- curated franchise Secret Lair printings
- bundle/product promos tied to that family

Promo status by itself is **never enough**. An unrelated Secret Lair or promo printing does not become legal for a Final Fantasy-only deck merely because it is a promo.

## Simple explanations by default

Normal card questions should stay easy to read. `card_intelligence_v05` defaults to `detail: simple`, focusing on:

- what the card does
- why it is useful
- what it works well with
- at most one important rule/interaction when needed

The complicated rules, printing and simulation logic stays underneath unless deeper detail is requested.

## V0.8 printing-family tools

| Tool | Purpose |
| --- | --- |
| `find_printings_in_family_v08` | Show every qualifying physical printing of a named Oracle card inside a requested family/set policy. |
| `normalize_deck_printings_v08` | Convert an existing deck to qualifying exact printings and report cards that have no legal themed printing. |
| `build_commander_deck_v08` | Build a complete Commander draft while enforcing Commander rules plus the physical printing-family policy. |
| `plan_commander_upgrade_v08` | Generate exact IN/OUT upgrades where every new card has an eligible physical printing, with edition-specific pricing. |

Printing-family inputs support:

- `printingFamily` — e.g. `Final Fantasy`
- `allowedSets` — optional exact set-code restrictions/additions
- `includePromos` — defaults to `true`
- `includeSpecialReleases` — defaults to `true`
- existing per-card price limits

### FINAL FANTASY behavior

The built-in Final Fantasy family preset dynamically discovers physical Scryfall sets whose set names belong to the FINAL FANTASY family and also recognizes curated exact special-release printings that live in broader products such as Secret Lair.

This is important because a broad set code such as `SLD` contains many unrelated products. MTG Ultimate therefore does **not** whitelist all Secret Lair cards. It whitelists exact known FINAL FANTASY special printings instead.

Examples of the intended distinction:

```text
Cyclonic Rift — FINAL FANTASY Secret Lair printing     -> eligible
Cyclonic Rift — unrelated Secret Lair printing        -> not eligible
Cyclonic Rift — ordinary non-FINAL-FANTASY printing   -> not eligible
```

The final deck line always identifies the actual physical edition:

```text
1 Cyclonic Rift (SLD) 1869
```

If no qualifying printing exists, the builder/upgrader must choose a **different card**, not quietly use an unrelated printing of the desired Oracle card.

## Exact printing and pricing model

Rules logic and combo logic use Oracle identity. Shopping/value logic uses the exact printing:

```text
1 Sol Ring (CMM) 396
1 Sol Ring (LTC) 284 *F*
```

Supported finish annotations:

```text
*F* = foil
*E* = etched
*N* = nonfoil
```

Price constraints are applied to qualifying physical editions. A cheap unrelated printing cannot bypass a themed-printing requirement, and an expensive premium printing should not make an Oracle card appear unaffordable when a cheaper **qualifying** printing exists.

## Commander rules

The hard legality layer validates:

- exactly 100 cards including commander(s)
- commander eligibility
- supported two-commander pairings
- current Commander legality/bans from live card data
- combined commander color identity
- off-color rejection
- singleton/basic-land/card-specific copy-count exceptions
- basic-land-type color restrictions

Example: a black-red commander permits black, red, black-red, and colorless identity cards, but not cards whose color identity contains white, blue, or green.

A fully resolved illegal Commander deck is blocked from advanced simulation and optimization.

## Deck analysis, building and upgrades

Important tools retained from earlier stages include:

| Tool | Purpose |
| --- | --- |
| `analyze_deck` | Structure, curve, roles, printing value, and hard Commander legality. |
| `price_deck_printings` | Value exact `(SET) collector` entries and requested finishes. |
| `analyze_mana_base_v04` | Mana sources, conditional lands, fetch targets, restricted mana and reducers. |
| `suggest_upgrades` | Printing-aware legal upgrade candidates. |
| `plan_commander_upgrade_v07` | Whole-deck exact IN/OUT plan with same-seed before/after simulation. |
| `build_commander_deck_v07` | First-pass full Commander draft. |
| `plan_commander_upgrade_v08` | V0.7 upgrade workflow plus hard printing-family enforcement. |
| `build_commander_deck_v08` | V0.7 builder plus hard printing-family enforcement. |

Simulation is supporting evidence rather than an automatic instruction to remove a thematic or preferred card.

## Game-state intelligence

V0.7/V0.6/V0.5 systems remain available:

- Ward-aware target ranking
- common multiplayer counter/protection stack chains
- supplied +1/+1/-1/-1 counters
- common static Equipment/Aura/lord combat bonuses
- zone-aware combo readiness
- Treasures and special payment mechanics
- commander tax/removal/recast pressure
- supplied-state castability and interaction checks

The service deliberately says when a state is unresolved rather than pretending to implement every possible Magic rule interaction.

## Simulation

Available simulation tools include:

| Tool | Purpose |
| --- | --- |
| `simulate_deck_consistency` | Opening hands, mana, lands, fetches, tutors, draw and combo consistency. |
| `simulate_pod_pressure_v04` | Pressure scenarios over the baseline model. |
| `simulate_advanced_gameplay_v06` | Hybrid baseline + advanced turn-level gameplay. |
| `simulate_calibrated_gameplay_v07` | Optional tournament-structure-informed pressure calibration. |
| `compare_deck_performance_profiles` | Same-seed comparison of two deck structures/simulations. |

Pressure outputs are model assumptions/evidence proxies, not claimed real-world win percentages.

## Combos and real-world evidence

| Tool | Purpose |
| --- | --- |
| `find_deck_combos` | Commander Spellbook combos and near-combos. |
| `estimate_commander_bracket` | Current bracket evidence and relevant cards/combos. |
| `analyze_archidekt_references` | Attributed public community deck comparisons. |
| `analyze_tournament_results` | Attributed TopDeck.gg EDH result/decklist comparisons. |

Reference decks help identify recurring cards/packages and structural differences, but observed association is not treated as proof that one card caused a win.

## Data sources

- **Scryfall** — Oracle identity, legality, exact printings, set metadata, set/collector resolution, promo metadata, finishes, release metadata and reference prices.
- **Commander Spellbook** — known combos, near-combos and bracket evidence.
- **Archidekt** — attributed public community deck references.
- **TopDeck.gg** — observed EDH tournament results/decklists when `TOPDECK_API_KEY` is configured.

## Architecture

```text
AI / MCP client
      |
      v
    /mcp
      |
      +-- cards / exact printings / prices --------> Scryfall
      +-- printing-family policy -------------------> V0.8 local policy + Scryfall sets
      +-- Commander legality -----------------------> local rules engine + Scryfall
      +-- build / upgrade --------------------------> V0.8/V0.7 engines
      +-- consistency / gameplay simulation --------> V0.4/V0.5/V0.6 engines
      +-- Ward / stack / combat / combo zones ------> V0.7 engines
      +-- combos / bracket -------------------------> Commander Spellbook
      +-- community references --------------------> Archidekt
      +-- tournament evidence ---------------------> TopDeck.gg
```

## Decklist format

```text
// COMMANDER
1 Edgar Markov (INR) 234

// MAIN
1 Sol Ring (CMM) 396
1 Blood Artist
3 Swamp (NEO) 297 *F*
```

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

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port. |
| `HTTP_TIMEOUT_MS` | `15000` | Upstream request timeout. |
| `SCRYFALL_API_BASE` | `https://api.scryfall.com` | Scryfall API origin. |
| `COMMANDER_SPELLBOOK_API_BASE` | `https://backend.commanderspellbook.com` | Commander Spellbook API origin. |
| `TOPDECK_API_BASE` | `https://topdeck.gg/api` | TopDeck.gg API origin. |
| `TOPDECK_API_KEY` | empty | Optional tournament-data API key. |
| `MTG_USER_AGENT` | project identifier | Upstream User-Agent. |

## Current limits / next work

V0.8 is still not a full digital implementation of Magic. Important future work includes richer replacement/layer/priority modeling, more card-specific timing logic, stronger commander-specific synergy discovery, iterative build → simulate → replace optimization, improved shopping/region pricing, and larger real-game calibration datasets.

Printing-family presets also need ongoing maintenance for special releases that live inside broad catch-all products. Normal family-named sets are discovered dynamically; exceptional releases such as franchise Secret Lairs are intentionally exact-listed so unrelated cards cannot leak into the family.

See `docs/V0.4_RULES_AND_SIMULATION.md`, `docs/V0.5_ADVANCED_GAMEPLAY.md`, `docs/V0.6_HYBRID_SIMULATION.md`, `docs/V0.7_DECKBUILDING_AND_INTERACTION.md`, and `docs/V0.8_PRINTING_FAMILIES.md`.

## Development

The repository remains under active development on the feature branch and draft PR. Strict TypeScript compilation plus the full test suite must pass before a stage is treated as green.
