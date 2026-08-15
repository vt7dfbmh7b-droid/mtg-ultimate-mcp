# MTG Ultimate MCP

An MCP-powered Magic: The Gathering knowledge, Commander rules, deck-building, printing-aware pricing, simulation, combo, interaction, combat, and evidence-analysis service.

The goal is an **MTG brain for AI clients**: live Oracle/card data, exact printing identity, hard Commander legality, card explanations and best-use guidance, combo discovery, rules-aware simulations, supplied-state payment/combat/interaction reasoning, bracket evidence, upgrade research, public deck references, observed tournament outcomes, and eventually collection-aware complete deck building.

## Current stage — V0.5

V0.5 has five linked layers:

1. **Rules facts** — Oracle text, color identity, Commander legality, commander pairing, deck size, singleton/copy-count rules.
2. **Physical printing identity** — set code, collector number, finish, release metadata, and printing-specific prices.
3. **Deck simulation** — V0.4 colored mana, land sequencing, legal fetch targets, tutors, draw engines, commander taxes, combo assembly, and pod-pressure scenarios.
4. **Advanced gameplay intelligence** — V0.5 casting/payment mechanics, state-aware castability, card explanations, counter/removal/protection exchanges, combat snapshots, and commander-dependent cards.
5. **Real-world evidence** — Scryfall, Commander Spellbook, attributed public Archidekt decks, and TopDeck.gg EDH tournament results when configured.

The project deliberately separates **known rules** from **simulation assumptions/heuristics**. If a result cannot be solved confidently from the supplied state, the output should say so instead of inventing precision.

## MCP tools

### Card / printing knowledge

| Tool | Purpose |
| --- | --- |
| `card_lookup` | Resolve a card by name, optionally constrained to a set code. |
| `printing_lookup` | Resolve one exact physical printing from set code + collector number. |
| `card_printings` | List releases/printings with set, collector number, finish, date, and price fields. |
| `compare_printing_prices` | Compare prices across physical releases of the same card. |
| `card_search` | Advanced live card search. |
| `compare_cards` | Compare two cards for rules, role, mana, legality, and printing prices. |
| `card_intelligence_v05` | One consolidated report: what a card does, best uses, synergies, casting mechanics, interaction profile, combat data, rules attention, and optional Commander fit. |

### Commander rules

| Tool | Purpose |
| --- | --- |
| `check_commander_rules` | Hard Commander deck-construction validation. |
| `check_card_for_commander` | Check whether one card is legal with the designated commander(s). |
| `analyze_commander_dependencies_v05` | Find cards whose Oracle text depends on or references the commander. |

The Commander rules layer enforces exact deck size, singleton/copy-count rules, current card legality, commander eligibility, supported two-commander pairing mechanics, combined color identity, and off-color/basic-land-type restrictions.

Example: a black-red commander permits black, red, black-red, and colorless identity cards. It does not permit a card with white, blue, or green in its color identity. Hybrid identity includes all colors shown in that identity.

### Deck / mana / pricing

| Tool | Purpose |
| --- | --- |
| `analyze_deck` | Structure + printing value + hard Commander legality. |
| `price_deck_printings` | Price exact `(SET) collector` entries and requested finishes. |
| `analyze_mana_base_v04` | Land/source analysis, exact fetch targets, common land conditions, restricted mana, reducers. |
| `suggest_upgrades` | Legal, printing-aware candidate upgrades under budget/set/theme constraints. |

### Simulation / comparison

| Tool | Purpose |
| --- | --- |
| `simulate_deck_consistency` | Default V0.4 rules-aware Monte Carlo sequencer. |
| `simulate_pod_pressure_v04` | Explicit opponent-pressure scenarios over the V0.4 base model. |
| `compare_deck_performance_profiles` | Same-seed comparison of two deck structures/simulations. |

V0.4 remains the deck-level Monte Carlo foundation and models common land decisions, colored mana, commander tax affordability, legal fetch targets, actual tutor targets, extra-card draw flow, restricted mana, common reducers, and requested combo assembly.

### V0.5 casting / payment / resources

| Tool | Purpose |
| --- | --- |
| `analyze_card_casting_v05` | Detect advanced casting/payment mechanics and Treasure generation on one card. |
| `analyze_deck_casting_v05` | Inventory those mechanics across a resolved deck. |
| `evaluate_castability_v05` | Test normal/alternative/free casting from a supplied resource state. |

V0.5 recognizes common patterns including:

- convoke
- improvise
- delve
- affinity
- Phyrexian mana
- named alternative costs such as evoke, escape, blitz, overload, prototype, and sneak when detectable from current Oracle text
- pitch-style “rather than pay this spell’s mana cost” text
- “without paying its mana cost” permissions
- immediate and recurring Treasure creation

`evaluate_castability_v05` can use colored/colorless/flexible mana, Treasures, convoke creatures, improvise artifacts, graveyard cards for delve, an affinity count, life for Phyrexian mana, and commander tax.

Commander tax is retained as an applicable additional cost on supported alternative/free casting lines.

### V0.5 interaction / combat

| Tool | Purpose |
| --- | --- |
| `evaluate_interaction_exchange_v05` | Compare a named threat, answer, and optional protection response. |
| `simulate_combat_snapshot_v05` | Estimate one combat snapshot from named attackers/blockers and track named commander damage. |

The interaction analyzer recognizes common hard/soft counters, counter restrictions, destroy/exile/bounce/damage removal, board-wipe signals, hexproof, indestructible, phasing, uncounterable effects, and countering the interaction spell.

It reports **definite**, **conditional**, or **unlikely** instead of claiming every arbitrary stack is fully solved.

The combat snapshot currently supports printed numeric power/toughness plus common flying, reach, menace, trample, double-strike awareness, first-strike awareness, deathtouch, lifelink/vigilance metadata, unblockable text, and named commander-damage tracking.

Variable stats such as `*` are explicitly unresolved rather than treated as zero.

### Combo / bracket / evidence

| Tool | Purpose |
| --- | --- |
| `find_deck_combos` | Commander Spellbook combos and near-combos. |
| `estimate_commander_bracket` | Current bracket evidence and relevant cards/combos. |
| `analyze_archidekt_references` | Attributed public community deck comparisons. |
| `analyze_tournament_results` | Attributed TopDeck.gg EDH outcome/decklist comparisons. |

## Oracle card vs physical printing

MTG Ultimate keeps rules identity and physical printing identity separate.

For example:

```text
1 Sol Ring (CMM) 396
```

resolves that exact printing for set/collector/finish/price data while still using Sol Ring’s Oracle identity for rules and deck analysis.

Name-only entries still work for rules analysis but cannot identify a unique physical release for exact valuation.

Supported finish annotations include:

```text
1 Card Name (SET) 123 *F*   # foil
1 Card Name (SET) 123 *E*   # etched
1 Card Name (SET) 123 *N*   # nonfoil
```

## Commander legality philosophy

A fully resolved illegal Commander deck is blocked from advanced simulation and upgrade optimization.

If one or more cards cannot be resolved, the rules engine returns an incomplete result instead of falsely declaring the list legal.

Supported current two-commander patterns include the project’s tested handling for original Partner, Friends forever, Partner—Character select, Choose a Background, Doctor’s companion, and matching Partner with pairs.

## V0.4 Monte Carlo model

The default consistency simulator currently models or approximates:

- London-style mulligans
- real lands and MDFCs
- colored casting requirements
- common tapped/conditional land behavior
- legal fetch targets still present in the simulated library
- mana rocks/dorks/land ramp/ritual-style sources
- common restricted mana
- common generic reducers
- commander first-cast and +2/+4 tax affordability
- one-shot and simple recurring draw flow
- actual common tutor target restrictions/destinations
- requested combo assembly
- early interaction availability

It is a consistency/game-state model, not a claimed multiplayer win-rate oracle.

## V0.5 payment rules

The V0.5 payment solver follows the broad current casting-cost structure:

1. choose the normal or applicable alternative cost
2. add applicable additional costs such as commander tax
3. apply supported reductions such as affinity
4. pay the resulting cost using supported payment mechanics/resources

Supported supplied-state resources include:

- W/U/B/R/G/C mana
- flexible any-color mana
- Treasure tokens
- convoke creatures and their colors
- improvise artifacts
- graveyard cards for delve
- affinity count
- life for Phyrexian symbols

Card-specific permission, timing, sacrifice, discard, exile, X-value, and unusual additional-cost conditions may still require more state and are reported as conditional.

## Evidence sources

### Scryfall

Primary live source for Oracle identity, color identity, legality, exact printings, set/collector resolution, search, release metadata, finishes, and price fields.

### Commander Spellbook

Known combos, near-combos, and current Commander bracket evidence.

### Archidekt

Public community reference decks with source/creator attribution.

### TopDeck.gg

Observed EDH tournament results and available submitted decklists when `TOPDECK_API_KEY` is configured. Tournament comparisons are observational associations, not causal proof.

## Architecture

```text
AI / MCP client
      |
      v
   /mcp
      |
      +-- card / printing / prices ----------------> Scryfall
      +-- Commander legality ----------------------> local rules engine + Scryfall
      +-- deck analysis / Monte Carlo -------------> local V0.4 engine + Scryfall
      +-- card intelligence / casting / payment ---> local V0.5 engines + Scryfall
      +-- interaction / combat snapshots ----------> local V0.5 state engines + Scryfall
      +-- combos / bracket -------------------------> Commander Spellbook
      +-- public deck references ------------------> Archidekt
      +-- tournament evidence ---------------------> TopDeck.gg + Scryfall
```

## Run locally

Requirements:

- Node.js 20+
- npm

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

## Docker

```bash
docker build -t mtg-ultimate-mcp .
docker run --rm -p 3000:3000 mtg-ultimate-mcp
```

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port. |
| `HTTP_TIMEOUT_MS` | `15000` | Upstream request timeout. |
| `SCRYFALL_API_BASE` | `https://api.scryfall.com` | Scryfall API origin. |
| `COMMANDER_SPELLBOOK_API_BASE` | `https://backend.commanderspellbook.com` | Commander Spellbook API origin. |
| `TOPDECK_API_BASE` | `https://topdeck.gg/api` | TopDeck.gg API origin. |
| `TOPDECK_API_KEY` | empty | Optional API key for tournament analysis. |
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

The parser also recognizes common Commander tags and explicit `commanderNames` inputs when needed.

## Current limits

V0.5 is materially more rules-aware, but it is not a complete digital implementation of all Magic rules.

Deep-state work still includes:

- Treasure generation/spending inside every Monte Carlo turn
- alternative/free costs inside deck-level sequencing
- convoke/improvise/delve/affinity inside the Monte Carlo engine itself
- ward payment and controller-sensitive targeting
- replacement/prevention/layer systems
- arbitrary modes, X values, additional costs, and copy interactions
- board-state-aware opponent target selection
- full priority/stack trees
- commander-dependent permanents responding dynamically to removal/recast state
- counters/equipment/auras/lords/continuous effects in combat
- multiplayer defending-player choice and attack taxes
- richer graveyard/exile/battlefield requirements for combos
- politics and opponent strategic choice

See [`docs/V0.4_RULES_AND_SIMULATION.md`](docs/V0.4_RULES_AND_SIMULATION.md) and [`docs/V0.5_ADVANCED_GAMEPLAY.md`](docs/V0.5_ADVANCED_GAMEPLAY.md) for the model boundaries.

## Development

The project is private and under active development. Changes are developed on the feature branch and kept in a draft pull request while the foundation is still being expanded. CI uses strict TypeScript build checks plus the test suite before each stage is treated as green.
