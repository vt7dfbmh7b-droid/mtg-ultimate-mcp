# MTG Ultimate MCP

An MCP-powered Magic: The Gathering knowledge, Commander rules, deck-building, printing-aware pricing, simulation, combo, and evidence-analysis service.

The goal is an **MTG brain for AI clients**: live Oracle/card data, exact printing identity, edition-aware prices, hard Commander legality, rules-aware deck analysis, combo discovery, bracket signals, Monte Carlo testing, upgrade research, public deck references, observed tournament outcomes, and eventually collection-aware complete deck building.

## Current stage — V0.4

V0.4 has four major layers:

1. **Rules facts** — card text, color identity, Commander legality, commander pairing, deck size, singleton rules.
2. **Physical printing identity** — set code, collector number, finish, release metadata, and printing-specific prices.
3. **Deck/simulation intelligence** — mana sequencing, legal fetch targets, restricted mana, tutors, draw engines, commander taxes, combo assembly, and pod-pressure scenarios.
4. **Real-world evidence** — Scryfall, Commander Spellbook, attributed public Archidekt decks, and TopDeck.gg EDH tournament results when configured.

## MCP tools

Current tools include:

| Tool | Purpose |
| --- | --- |
| `card_lookup` | Resolve a card by name, optionally constrained to a set code. |
| `printing_lookup` | Resolve one exact physical printing from set code + collector number. |
| `card_printings` | List releases/printings with set, collector number, finish, date, and price fields. |
| `compare_printing_prices` | Compare prices across physical releases of the same card. |
| `card_search` | Advanced live card search. |
| `compare_cards` | Compare two cards for rules, role, mana, legality, and printing prices. |
| `check_commander_rules` | Hard Commander deck-construction validation. |
| `check_card_for_commander` | Check whether one card is legal with the designated commander(s). |
| `analyze_deck` | Structure + printing value + hard Commander legality. |
| `price_deck_printings` | Price exact `(SET) collector` deck entries and requested finishes. |
| `analyze_mana_base_v04` | Land/source analysis, exact fetch targets, common land conditions, restricted mana, reducers. |
| `simulate_deck_consistency` | Default V0.4 rules-aware Monte Carlo sequencer. |
| `simulate_pod_pressure_v04` | Explicit opponent-pressure scenarios over the V0.4 base model. |
| `compare_deck_performance_profiles` | Same-seed comparison of two deck structures/simulations. |
| `find_deck_combos` | Commander Spellbook combos and near-combos. |
| `estimate_commander_bracket` | Current bracket evidence and relevant cards/combos. |
| `analyze_archidekt_references` | Attributed public community deck comparisons. |
| `analyze_tournament_results` | Attributed TopDeck.gg EDH outcome/decklist comparisons. |
| `suggest_upgrades` | Legal, printing-aware candidate upgrades under budget/set/theme constraints. |

## Commander rules

V0.4 validates resolved decks before advanced simulation/optimization.

It checks:

- exactly 100 cards including commander(s)
- commander eligibility
- one commander normally, or two only through a supported pairing rule
- live Commander-format legality/banned status
- combined commander color identity
- every deck card's color identity is a subset of that combined identity
- basic-land-type color restrictions
- singleton by English card name
- unlimited basic lands and parsed Oracle copy-count exceptions
- unresolved cards return `incomplete` rather than a false legal result

### Example — Rakdos

A commander with black-red (`BR`) color identity may use:

- black cards
- red cards
- black-red cards
- colorless cards

It may not use cards with white, blue, or green in their color identity.

Hybrid remains an **AND** for current Commander color identity: a black/red hybrid-identity card requires both black and red in the commander identity.

Current paired-commander handling includes:

- Partner
- Friends forever
- Partner—Character select, only with the same variant
- Choose a Background + legendary Background
- Doctor's companion + an eligible Time Lord Doctor
- matching Partner with pairs

See [`docs/V0.4_RULES_AND_SIMULATION.md`](docs/V0.4_RULES_AND_SIMULATION.md) for details.

## Oracle identity vs physical printing

MTG Ultimate deliberately keeps two linked identities:

- **Oracle identity** — rules, legality, synergy, combos, strategic analysis.
- **Physical printing identity** — set, collector number, release, finish, artwork/printing metadata, price.

For example:

```text
1 Sol Ring (CMM) 396
1 Sol Ring (LTC) 284 *F*
```

are the same rules card but different physical products with different pricing.

Supported finish annotations:

```text
*F*  foil
*E*  etched
*N*  nonfoil
```

A name-only line still works for rules analysis but is marked non-exact for physical valuation.

## V0.4 simulation

The default `simulate_deck_consistency` engine performs repeated, deterministic turn-sequence simulations rather than simply counting cards.

It now models/approximates:

- London mulligans
- colored mana requirements
- commander-color mana sources
- common restricted-mana payments
- common generic cost reducers
- MDFC land options
- shock/check/fast/slow/reveal/multiplayer/tapped land decisions
- fetch lands searching the actual remaining library for legal targets
- mana rocks, mana creatures, one-shot mana, and land ramp
- commander first-cast, +2 tax, and +4 tax affordability
- common tutor restrictions and actual target selection
- tutor movement of cards out of the simulated library
- one-shot card draw creating actual extra card flow
- simple recurring upkeep/end-step/attack/combat-damage draw proxies
- affordable interaction windows
- requested combo assembly with legal tutor target checks

The simulator is deliberately **not** presented as a full Magic rules engine or a multiplayer win-rate oracle.

## Pod-pressure scenarios

`simulate_pod_pressure_v04` adds visible/configurable opponent assumptions for:

- commander removal
- board resets
- key-spell interaction
- commander recasts using +2/+4 tax affordability
- protection-density proxies around challenged combo attempts

Built-in profiles:

- `goldfish`
- `casual`
- `core`
- `upgraded`
- `optimized`
- `cedh`

The numerical pressure values are returned in the output. They are scenario assumptions, not claimed universal real-world frequencies.

## Real-world evidence

### Scryfall

Primary live source for Oracle text, color identity, Commander legality, exact set/collector printing resolution, printing metadata, search, community-rank fields when available, and price fields.

### Commander Spellbook

Known combos, near-combos, and current Commander bracket evidence.

### Archidekt

Public reference decks with creator/source attribution. Inclusion frequency is treated as community evidence, not proof that a card caused wins.

### TopDeck.gg

Observed EDH tournament results/decklists when `TOPDECK_API_KEY` is configured. Higher/lower-performing structural differences are reported as associations rather than causal proof.

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

Validate:

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
| `TOPDECK_API_KEY` | empty | Optional TopDeck API key for tournament analysis. |
| `MTG_USER_AGENT` | project identifier | User-Agent sent upstream. |

## Decklist format

```text
// COMMANDER
1 Edgar Markov (INR) 234

// MAIN
1 Sol Ring (CMM) 396
1 Blood Artist
3 Swamp (NEO) 297 *F*
```

The parser also understands common commander tags and preserves set/collector/finish data.

## Current limitations

V0.4 is more rules-aware, but difficult mechanics still need deeper card-specific simulation, including alternate/free costs, Phyrexian mana, delve/convoke/improvise/affinity, conditionally generated Treasures, full zone-aware combo requirements, exact opponent target selection, complete priority/stack trees, and table politics.

Scryfall prices are reference data, not NZ-local retail checkout prices.

## Next stages

- deeper stack and interaction simulation
- commander-specific synergy scoring
- exact colored-source recommendations
- statistical IN/OUT swap comparison
- whole-upgrade budgets
- NZ pricing/store adapters
- full 100-card constrained deck builder
- collection import with exact printings/finishes
- owned-cards-first optimization
- rules/interaction explanations with source citations
- deck version history

## Development

The repository is private and changes stay on feature branches / pull requests until explicitly merged.
