# MTG Ultimate MCP

An MCP-powered Magic: The Gathering knowledge, Commander rules, deck-building, printing-aware pricing, simulation, combo, interaction, combat, and evidence-analysis service.

The goal is an **MTG brain for AI clients**: accurate card knowledge, legal Commander deck construction, exact printing/set-aware prices, useful deck analysis, realistic-enough simulations, combo research, upgrades, complete deck drafts, and real-world reference evidence—without making normal answers harder to understand than they need to be.

## Current stage — V0.7

V0.7 combines seven linked layers:

1. **Rules facts** — Oracle text, color identity, Commander legality, commander pairing, deck size, singleton/copy-count rules.
2. **Physical printing identity** — set code, collector number, finish, release metadata, and printing-specific prices.
3. **Deck construction and upgrades** — full Commander drafts, exact IN/OUT upgrade plans, budget/set/theme constraints, and same-seed before/after simulation.
4. **Baseline deck simulation** — strong land/fetch/tutor/draw/colored-mana sequencing from V0.4.
5. **Advanced game-state intelligence** — V0.5/V0.6 payment/resource simulation plus V0.7 Ward-aware targeting, stack chains, combat modifiers, and zone-aware combo readiness.
6. **Card/game intelligence** — simple card explanations by default, with deeper casting, interaction, combat, and rules analysis available when needed.
7. **Real-world evidence** — Scryfall, Commander Spellbook, attributed public Archidekt decks, and TopDeck.gg EDH tournament data when configured.

The project deliberately separates **known rules** from **simulation assumptions and evidence-derived heuristics**. If something cannot be solved confidently from the available game state, the tool should say so instead of inventing precision.

## Simple explanations by default

Normal card questions should be easy to read. `card_intelligence_v05` defaults to `detail: simple`, which focuses on:

- what the card does
- why it is useful
- what it works well with
- at most one important rule/interaction when needed

`standard` and `detailed` modes remain available for complicated interactions or when deeper rules analysis is requested.

## Main MCP tools

### Cards, printings, and prices

| Tool | Purpose |
| --- | --- |
| `card_lookup` | Resolve a card by name, optionally constrained to a set code. |
| `printing_lookup` | Resolve one exact physical printing from set code + collector number. |
| `card_printings` | List releases with set, collector number, finish, date, and price fields. |
| `compare_printing_prices` | Compare prices across physical releases of the same Oracle card. |
| `card_search` | Advanced live Scryfall search. |
| `compare_cards` | Compare two cards for rules, role, mana, legality, and printing prices. |
| `card_intelligence_v05` | Plain-English card explanation plus optional deeper intelligence. |

Rules identity and physical printing identity are intentionally separate. For example:

```text
1 Sol Ring (CMM) 396
1 Sol Ring (LTC) 284 *F*
```

use the same Oracle card for rules, but retain different set codes, collector numbers, finishes, and prices.

Supported finish annotations:

```text
*F* = foil
*E* = etched
*N* = nonfoil
```

### Commander rules

| Tool | Purpose |
| --- | --- |
| `check_commander_rules` | Hard Commander deck-construction validation. |
| `check_card_for_commander` | Check one card against designated commander(s). |
| `analyze_commander_dependencies_v05` | Find cards that depend on the commander being available/online. |

The legality layer enforces exactly 100 cards including commander(s), commander eligibility, supported legal two-commander pairings, current Commander legality/bans from live card data, combined commander color identity, off-color rejection, singleton/basic-land/card-specific copy-count exceptions, and basic-land-type color restrictions.

Example: a black-red commander permits black, red, black-red, and colorless identity cards, but not cards containing white, blue, or green identity.

A fully resolved illegal Commander deck is blocked from advanced simulation and optimization.

### Deck analysis, building, and upgrades

| Tool | Purpose |
| --- | --- |
| `analyze_deck` | Structure, curve, roles, printing value, and hard Commander legality. |
| `price_deck_printings` | Value exact `(SET) collector` entries and requested finishes. |
| `analyze_mana_base_v04` | Mana sources, common land conditions, fetch targets, restricted mana, reducers. |
| `suggest_upgrades` | Legal, printing-aware upgrade candidates under budget/set/theme constraints. |
| `plan_commander_upgrade_v07` | Exact candidate IN/OUT swaps, protected-card constraints, whole rebuilt deck, and same-seed before/after simulation. |
| `build_commander_deck_v07` | Build a complete Commander draft from one or two commanders with legality, role, set, price, theme, include/exclude, land, printing, bracket, simulation, and optional community-reference checks. |

`plan_commander_upgrade_v07` treats simulation as supporting evidence rather than automatically replacing cards solely because a number improved. It returns the whole candidate deck so an AI/player can reject a swap that damages the intended theme or preferred win route.

`build_commander_deck_v07` emits exact selected set codes and collector numbers. Its first-pass role targets are consistency heuristics, not the official definition of Commander brackets; bracket evidence is checked separately when the external estimator is available.

Upgrade pricing can select a cheaper valid printing instead of treating a card name as having one universal price. The from-scratch builder always identifies the selected printing, but without an explicit price constraint it does not claim that printing is the globally cheapest release ever printed.

### V0.7 game-state intelligence

| Tool | Purpose |
| --- | --- |
| `rank_interaction_targets_v07` | Rank legal/important targets for a supplied answer and account for supported Ward costs/resources. |
| `evaluate_multiplayer_stack_v07` | Evaluate a supplied common counter/protection chain in stack order. |
| `analyze_combat_board_v07` | Apply common +1/+1/-1/-1 counters, static Equipment/Aura bonuses, and lord effects to combat stats. |
| `evaluate_combo_zones_v07` | Check whether named combo pieces are actually usable from their current/required zones. |

Ward is modeled as a triggered cost after an opponent legally targets the permanent, not as a hexproof-style targeting prohibition. Unsupported or state-dependent Ward costs remain conditional.

The stack model handles common hard/soft counter chains and uncounterable text. It does not claim to solve every possible priority branch, copied spell, retarget effect, mode, or split-second interaction.

The combat model keeps variable printed stats such as `*` unresolved instead of inventing a number. V0.7 adds supplied counters plus common static Equipment, Aura, and lord bonuses while leaving full Magic layer interactions for later work.

Zone-aware combo checks distinguish a piece being merely seen from being actually ready. A card stranded in the library, graveyard, or exile is not counted as live unless the supplied requirement or a supported permission says it can function there.

### Simulation

| Tool | Purpose |
| --- | --- |
| `simulate_deck_consistency` | Detailed consistency model for opening hands, mana, lands, fetches, tutors, draw, and combos. |
| `simulate_pod_pressure_v04` | Existing pressure scenarios over the baseline consistency model. |
| `simulate_advanced_gameplay_v06` | Hybrid baseline + advanced turn-level gameplay. |
| `simulate_calibrated_gameplay_v07` | Optionally use recent tournament-deck structure to choose the closest transparent simulation-pressure preset, then run the hybrid model. |
| `compare_deck_performance_profiles` | Same-seed comparison of two deck structures/simulations. |

The baseline lane models London-style mulligans, colored mana, common conditional/tapped lands, legal fetch targets, rocks/dorks/land ramp/rituals, restricted mana, common reducers, common tutor restrictions, card draw, commander tax affordability, and requested combo-piece assembly.

The advanced lane models Treasures, convoke, improvise, delve, artifact affinity, Phyrexian mana/life, supported alternative costs, commander removal/recasts/uptime, challenges to key spells, protection using resources left after paying for the original spell, board-wipe pressure, and commander-dependent permanents.

Pressure profiles are:

```text
goldfish | casual | upgraded | optimized | cedh
```

Their interaction/removal probabilities are **transparent simulation assumptions**, not measured win rates.

`simulate_calibrated_gameplay_v07` can use the structure of the higher-performing TopDeck.gg sample as an evidence-informed proxy for choosing among those existing presets. This does **not** turn registered decklists into measured per-game interaction rates; the calibration output exposes the structural signals and confidence/caveats.

### V0.5 supplied-state gameplay tools retained

| Tool | Purpose |
| --- | --- |
| `analyze_card_casting_v05` | Detect advanced casting/payment mechanics and Treasure generation. |
| `analyze_deck_casting_v05` | Inventory those mechanics across a deck. |
| `evaluate_castability_v05` | Test whether a card can be cast from a supplied resource state. |
| `evaluate_interaction_exchange_v05` | Evaluate a named threat, answer, and optional protection response. |
| `simulate_combat_snapshot_v05` | Estimate one supplied combat snapshot. |

### Combos, brackets, and real-world evidence

| Tool | Purpose |
| --- | --- |
| `find_deck_combos` | Commander Spellbook combos and near-combos. |
| `estimate_commander_bracket` | Current bracket evidence and relevant cards/combos. |
| `analyze_archidekt_references` | Attributed public community deck comparisons. |
| `analyze_tournament_results` | Attributed TopDeck.gg EDH result/decklist comparisons. |

Real-world deck evidence is used to ask questions such as:

- which cards/packages recur in successful lists?
- what structural differences exist between stronger and weaker lists?
- does one build produce more reliable mana, interaction, protection, or early action?
- does a proposed upgrade improve the same seeded consistency model without violating theme/legality/budget constraints?

Observed deck results are treated as associations, not proof that a single card caused a win or loss.

## Data sources

- **Scryfall** — Oracle identity, color identity, legality, exact printings, set/collector resolution, release metadata, finishes, search, and reference price fields.
- **Commander Spellbook** — known combos, near-combos, and bracket evidence.
- **Archidekt** — attributed public community deck references.
- **TopDeck.gg** — observed EDH tournament results/decklists when `TOPDECK_API_KEY` is configured.

## Architecture

```text
AI / MCP client
      |
      v
    /mcp
      |
      +-- cards / printings / prices -------------> Scryfall
      +-- Commander legality ----------------------> local rules engine + Scryfall
      +-- build / upgrade / role search -----------> local V0.7 engine + Scryfall
      +-- baseline consistency --------------------> V0.4 simulation engine
      +-- advanced turn gameplay -----------------> V0.6 + V0.5 payment engine
      +-- Ward / stack / combat / combo zones ----> local V0.7 engines
      +-- combos / bracket ------------------------> Commander Spellbook
      +-- community references -------------------> Archidekt
      +-- tournament evidence/calibration --------> TopDeck.gg
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

## Decklist format

```text
// COMMANDER
1 Edgar Markov (INR) 234

// MAIN
1 Sol Ring (CMM) 396
1 Blood Artist
3 Swamp (NEO) 297 *F*
```

## Current limits / next deep-state work

V0.7 is much stronger at deck creation, upgrade testing, and supplied game states, but it is still not a complete digital implementation of every Magic rule. Important future work includes:

- replacement/prevention effects and full layer interactions
- arbitrary modes, X values, unusual additional costs, copies, and retargeting
- richer priority/stack trees and multiple legal target choices inside the full turn simulator
- attack taxes, defending-player selection, multiplayer politics, and richer combat decisions
- exact card-specific timing/activation prerequisites for more combo lines
- stronger automatic commander-specific theme/synergy discovery when building from scratch
- multi-pass build → simulate → replace → re-simulate optimization rather than stopping after the first legal 100-card draft
- shared cheapest-printing optimization across all from-scratch selections when that is the requested shopping goal
- larger tournament datasets and true game-log/event-sequence data for better pressure calibration

See `docs/V0.4_RULES_AND_SIMULATION.md`, `docs/V0.5_ADVANCED_GAMEPLAY.md`, `docs/V0.6_HYBRID_SIMULATION.md`, and `docs/V0.7_DECKBUILDING_AND_INTERACTION.md` for model boundaries.

## Development

The repository remains under active development on the feature branch and draft PR. Strict TypeScript compilation plus the full test suite must pass before a stage is treated as green. V0.7 passed the complete CI suite on its documented release head before this status-only README clarification.
