# MTG Ultimate MCP

An MCP-powered Magic: The Gathering knowledge, Commander rules, deck-building, printing-aware pricing, simulation, combo, interaction, combat, and evidence-analysis service.

The goal is an **MTG brain for AI clients**: accurate card knowledge, legal Commander deck construction, exact printing/set-aware prices, useful deck analysis, realistic-enough simulations, combo research, upgrades, and real-world reference evidence—without making normal answers harder to understand than they need to be.

## Current stage — V0.6

V0.6 combines six layers:

1. **Rules facts** — Oracle text, color identity, Commander legality, commander pairing, deck size, singleton/copy-count rules.
2. **Physical printing identity** — set code, collector number, finish, release metadata, and printing-specific prices.
3. **Baseline deck simulation** — strong land/fetch/tutor/draw/colored-mana sequencing from V0.4.
4. **Advanced gameplay simulation** — turn-level Treasures, special payment mechanics, commander pressure, and protection exchanges from V0.6.
5. **Card/game intelligence** — simple card explanations by default, with deeper casting, interaction, combat, and rules analysis available when needed.
6. **Real-world evidence** — Scryfall, Commander Spellbook, attributed public Archidekt decks, and TopDeck.gg EDH tournament data when configured.

The project deliberately separates **known rules** from **simulation assumptions**. If something cannot be solved confidently from the available game state, the tool should say so instead of inventing precision.

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

The legality layer enforces:

- exactly 100 cards including commander(s)
- commander eligibility
- supported legal two-commander pairings
- current Commander legality/bans from live card data
- combined commander color identity
- off-color rejection
- singleton/basic-land/card-specific copy-count exceptions
- basic-land-type color restrictions

Example: a black-red commander permits black, red, black-red, and colorless identity cards, but not cards containing white, blue, or green identity.

A fully resolved illegal Commander deck is blocked from advanced simulation and upgrade optimization.

### Deck analysis, mana, and upgrades

| Tool | Purpose |
| --- | --- |
| `analyze_deck` | Structure, curve, roles, printing value, and hard Commander legality. |
| `price_deck_printings` | Value exact `(SET) collector` entries and requested finishes. |
| `analyze_mana_base_v04` | Mana sources, common land conditions, fetch targets, restricted mana, reducers. |
| `suggest_upgrades` | Legal, printing-aware upgrades under budget/set/theme constraints. |

Upgrade pricing can select a cheaper valid printing instead of treating a card name as having one universal price.

### V0.6 hybrid simulation

| Tool | Purpose |
| --- | --- |
| `simulate_deck_consistency` | Existing detailed consistency model for opening hands, mana, lands, fetches, tutors, draw, and combos. |
| `simulate_pod_pressure_v04` | Existing pressure scenarios over the baseline consistency model. |
| `simulate_advanced_gameplay_v06` | New hybrid V0.6 simulation combining the baseline with advanced turn-level gameplay. |
| `compare_deck_performance_profiles` | Same-seed comparison of two deck structures/simulations. |

`simulate_advanced_gameplay_v06` keeps two views rather than forcing one model to pretend it is best at everything:

**Baseline lane (V0.4)**

- London-style mulligans
- colored mana requirements
- common conditional/tapped land behavior
- legal fetch targets still present in the library
- mana rocks, dorks, land ramp, and rituals
- restricted mana and common reducers
- actual common tutor restrictions/destinations
- one-shot and simple recurring draw
- commander tax affordability
- requested combo-piece assembly

**Advanced lane (V0.6)**

- Treasure creation and later spending
- convoke
- improvise
- delve
- artifact affinity
- Phyrexian mana/life payments
- supported named alternative costs such as evoke, escape, blitz, overload, prototype, and sneak when enough information is available
- commander casts, tax, removal, and battlefield uptime
- modeled challenges to key spells
- protection responses using resources still available after the original spell has been paid for
- board-wipe pressure proxy
- commander-dependent permanents
- named combo-piece zone readiness

The default `detail: simple` result is intentionally short and focuses on what helped, what slowed the deck down, and the most useful numbers. `standard` and `detailed` expose the deeper simulation data.

Pressure profiles are:

```text
goldfish | casual | upgraded | optimized | cedh
```

Their interaction/removal probabilities are **transparent simulation assumptions**, not measured win rates.

## V0.5 supplied-state gameplay tools retained

| Tool | Purpose |
| --- | --- |
| `analyze_card_casting_v05` | Detect advanced casting/payment mechanics and Treasure generation. |
| `analyze_deck_casting_v05` | Inventory those mechanics across a deck. |
| `evaluate_castability_v05` | Test whether a card can be cast from a supplied resource state. |
| `evaluate_interaction_exchange_v05` | Evaluate a named threat, answer, and optional protection response. |
| `simulate_combat_snapshot_v05` | Estimate one supplied combat snapshot. |

These are useful when the question is about a particular game state rather than thousands of simulated deck runs.

## Combos, brackets, and real-world evidence

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

Observed deck results are treated as associations, not proof that a single card caused a win or loss.

## Data sources

- **Scryfall** — Oracle identity, color identity, legality, exact printings, set/collector resolution, release metadata, finishes, and reference price fields.
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
      +-- baseline consistency --------------------> V0.4 simulation engine
      +-- advanced turn gameplay -----------------> V0.6 + V0.5 payment engine
      +-- combos / bracket ------------------------> Commander Spellbook
      +-- community references -------------------> Archidekt
      +-- tournament evidence --------------------> TopDeck.gg
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

V0.6 is much more useful for real deck testing, but it is still not a complete digital implementation of every Magic rule. Future work includes:

- ward payment and controller-sensitive targeting inside simulations
- replacement/prevention effects and layer interactions
- arbitrary modes, X values, unusual additional costs, and copy effects
- richer stack/priority trees and opponent target selection
- counters, Equipment, Auras, lords, and continuous effects in combat
- exact graveyard/exile/battlefield prerequisites for more combo lines
- multiplayer defending-player choices, attack taxes, and politics
- calibrating pressure assumptions against larger real-world tournament/reference datasets

See `docs/V0.4_RULES_AND_SIMULATION.md`, `docs/V0.5_ADVANCED_GAMEPLAY.md`, and `docs/V0.6_HYBRID_SIMULATION.md` for model boundaries.

## Development

The repository remains under active development on the feature branch and draft PR. Strict TypeScript compilation plus the full test suite must pass before a stage is treated as green.
