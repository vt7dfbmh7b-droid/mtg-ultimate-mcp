# MTG Ultimate MCP

An MCP-powered Magic: The Gathering knowledge, Commander deck-building, pricing, simulation, and evidence-analysis service.

The goal is an **MTG brain for AI clients**: live Oracle/card data, exact printing identity, edition-aware prices, rules-aware deck analysis, combo discovery, Commander bracket signals, Monte Carlo consistency testing, upgrade research, community references, observed tournament outcomes, and eventually collection-aware complete deck building.

## Current stage — V0.3 printing-aware analysis and simulation

The server currently exposes fifteen read-only MCP tools:

| Tool | Purpose |
| --- | --- |
| `card_lookup` | Resolve a card by name, optionally constrained to a set code, and return Oracle knowledge plus the resolved printing. |
| `printing_lookup` | Resolve one exact physical printing from set/expansion code + collector number. |
| `card_printings` | List distinct printings of the same card with set codes, collector numbers, dates, finishes, and printing-specific price fields. |
| `compare_printing_prices` | Sort printings by current Scryfall USD reference price for nonfoil, foil, etched, or cheapest available finish. |
| `card_search` | Search Scryfall with full Scryfall query syntax. |
| `compare_cards` | Compare two cards for strategy, legality, mana, community adoption, and resolved-printing prices. |
| `analyze_deck` | Parse and analyze a Commander deck, including exact printing identity and printing-aware deck value. |
| `price_deck_printings` | Price the exact physical editions in a pasted decklist and flag name-only lines that are not price-exact. |
| `simulate_deck_consistency` | Run deterministic V0.3 Monte Carlo simulations with colored mana, tapped-land tempo, MDFCs, ramp sequencing, commander taxes, mulligans, and combo proxies. |
| `compare_deck_performance_profiles` | Run the same structural and same-seed simulation model on two lists to identify measurable candidate explanations for performance differences. |
| `find_deck_combos` | Use Commander Spellbook to find known combos already present and near-combos. |
| `estimate_commander_bracket` | Use current Commander Spellbook bracket evidence for classification, Game Changers, bans, extra turns, MLD, and combos. |
| `analyze_archidekt_references` | Load public Archidekt decks with creator/source attribution and compare structure/common choices. |
| `analyze_tournament_results` | Use TopDeck.gg EDH results and submitted decklists to compare observed higher- and lower-performing structures. Requires `TOPDECK_API_KEY`. |
| `suggest_upgrades` | Detect structural deficits and search current Scryfall data for legal candidate adds/cuts under optional budget, set, theme, and exclusion constraints. |

## Oracle card vs physical printing

MTG Ultimate deliberately treats these as two linked but different identities:

- **Oracle identity** answers rules, legality, synergy, combo, and deck-function questions.
- **Physical printing identity** answers set, collector number, release, finish, artwork/printing metadata, and price questions.

For example, two different Sol Ring releases share the same rules identity but can have very different market reference prices. A deck line such as:

```text
1 Sol Ring (CMM) 396
```

is resolved as that exact printing. A line such as:

```text
1 Sol Ring
```

still resolves correctly for rules/deck analysis, but its physical price is labelled non-exact because no edition was supplied.

Supported finish annotations currently include:

```text
1 Card Name (SET) 123 *F*   # foil
1 Card Name (SET) 123 *E*   # etched
1 Card Name (SET) 123 *N*   # nonfoil
```

Different physical printings of the same card are kept as distinct parsed entries instead of being collapsed together.

## Printing-aware pricing

Scryfall price fields are attached to individual card-printing objects, so V0.3 keeps set code + collector number attached to every returned price.

`price_deck_printings` and the `pricing` section of `analyze_deck` report:

- requested set code and collector number
- resolved set code and full set name
- release date
- rarity
- available finishes
- printing-specific Scryfall price fields
- selected unit price based on requested finish
- quantity-adjusted line value
- estimated deck total in USD reference pricing
- how many deck entries had exact physical printing information

This is deliberately separate from future **New Zealand store pricing**, because local stock and NZD retail prices may differ materially from international reference data.

## What V0.3 simulation models

`simulate_deck_consistency` is still a **Monte Carlo consistency/goldfish model**, not a claim to reproduce every Commander game.

V0.3 now models or approximates:

- London-style mulligan pressure
- real lands plus MDFC land options
- colored mana requirements rather than mana value alone
- mana-source color coverage by turn
- always-tapped land tempo loss
- conditional tapped lands through an explicit probabilistic approximation
- fetch-style lands as commander-color access proxies
- mana rocks versus summoning-sick mana creatures
- land-ramp spells
- rituals and one-shot mana separately from persistent sources
- opening and early mana development
- commander first-cast affordability
- commander affordability after +2 and +4 commander tax
- early interaction affordability using colored costs
- early draw/selection affordability using colored costs
- mana-screw and flood proxies
- natural combo-piece assembly
- clearly labelled tutor-assisted combo proxies

Every simulation result includes its assumptions and caveats. It does **not** convert goldfish percentages into invented multiplayer win rates.

`compare_deck_performance_profiles` uses the same seed/settings on both decks, which is useful for an old list versus an upgrade, two builds of the same commander, or a tournament/reference list versus a weaker version.

## Real-world evidence layer

### TopDeck.gg — observed tournament outcomes

With a configured TopDeck API key, `analyze_tournament_results` queries completed Magic: The Gathering EDH tournaments and uses available submitted decklists plus wins/draws/losses.

It compares higher- and lower-performing sampled structures including land count, curve, early-play density, fast mana, ramp, draw, tutors, interaction, protection, and recursion.

The output describes these as **observed associations**, not causal proof. Pilot skill, pod composition, seat order, matchup mix, event size, and variance still matter.

### Archidekt — public community references

`analyze_archidekt_references` accepts up to ten public Archidekt deck IDs or URLs. It preserves creator/source links, compares deck structure, and calculates common cards across the sample.

Reference frequency is community evidence, not tournament proof: popularity, budget, theme, and creator preference can all affect inclusion rates.

## Data sources

### Scryfall

Scryfall is the primary live source for Oracle text, legality, color identity, exact set/collector printing resolution, printing metadata, search, EDHREC rank fields when present, and price fields.

The service uses explicit request identification, appropriate Accept headers, and request pacing.

### Commander Spellbook

Commander Spellbook powers known-combo discovery, near-combo discovery, and current Commander bracket evidence.

## Architecture

```text
AI / MCP client
      |
      v
  /mcp endpoint
      |
      +-- card / exact printing / prices ---------> Scryfall
      |
      +-- analyze + price deck -------------------> local parser + Scryfall exact identifiers
      |
      +-- simulate / compare deck profiles -------> local V0.3 Monte Carlo engine + Scryfall
      |
      +-- find_deck_combos / bracket -------------> Commander Spellbook
      |
      +-- analyze_archidekt_references -----------> Archidekt public deck API
      |
      +-- analyze_tournament_results -------------> TopDeck.gg API + Scryfall
      |
      +-- suggest_upgrades -----------------------> local structure engine + Scryfall
```

The HTTP server uses the MCP TypeScript SDK Streamable HTTP handler at `/mcp`.

## Run locally

Requirements:

- Node.js 20+
- npm

```bash
npm install
cp .env.example .env
npm run dev
```

Then:

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
| `TOPDECK_API_KEY` | empty | Optional TopDeck API key required by tournament analysis. |
| `MTG_USER_AGENT` | project identifier | User-Agent sent to upstream services. |

## Decklist format

The parser understands common copy/paste formats and preserves printing annotations:

```text
// COMMANDER
1 Edgar Markov (INR) 234

// MAIN
1 Sol Ring (CMM) 396
1 Blood Artist
3 Swamp (NEO) 297 *F*
```

It also recognizes `# Commander`, `^Commander^`, and `[Commander]` tags. Relevant tools accept explicit `commanderNames` when a list has no Commander section.

## Upgrade-engine constraints

`suggest_upgrades` currently supports:

- target structural bracket profile 1–5
- maximum Scryfall USD reference price per candidate
- allowed set codes, useful for universes/set-restricted builds
- additional Scryfall theme-query fragments
- excluded card names
- controlled candidate count per structural deficit

These structural profiles are heuristics, not official bracket definitions. Official/current bracket evidence remains separate.

## Important caveats

- Partner, Background, Doctor's companion, and similar commander-pairing rules still need a dedicated local validation pass.
- Strategic role tags are heuristics; Oracle text and known combo data remain the source material for exact interactions.
- Conditional land untapping, unusual mana restrictions, alternate costs, combat, priority, opponent interaction, and politics are still simplified or absent from V0.3 simulation.
- Same-seed deck comparisons improve consistency of comparison but do not reproduce real multiplayer games.
- Tournament cohort analysis is observational and can be biased by event/decklist availability.
- Scryfall price fields are reference data and are not a complete NZ-specific shopping engine.
- Name-only deck lines cannot identify a unique physical printing and are explicitly marked as non-exact for valuation.

## Roadmap

### V0.4 — simulation and evidence calibration

- exact land-type/fetch-target modeling
- shock/check/fast/battle land conditional logic instead of a general approximation
- commander-only/restricted mana such as Jeweled Lotus-style constraints
- alternate costs, delve/convoke/improvise, and cost reducers
- draw-engine activation and card-flow simulation
- tutor timing and tutor-class restrictions
- interaction windows and opponent-pressure profiles with user-controlled assumptions
- commander removal/recast state rather than affordability-only tax scenarios
- calibrate heuristic weights against observed tournament samples without inventing causal win rates

### Deck intelligence V0.5

- commander-specific synergy scoring
- exact colored-source requirements and land-base recommendations
- more detailed removal/threat coverage
- identify dead, redundant, and competing packages
- compare multiple versions of the same deck statistically
- explain why an exact IN/OUT package changes simulated consistency

### Full upgrade/builder stage

- whole-upgrade budget limits
- NZ pricing/provider adapters
- exact-printing and cheapest-printing purchase modes
- exact IN/OUT swap optimizer
- no-infinite / combo-light / combo-heavy preferences
- build complete 100-card Commander lists from constraints
- multiple win-condition routes
- mulligan guidance
- primer generation

### Collection and rules stage

- user collection import/storage including set + collector number + finish
- build with owned cards first
- missing-card shopping list
- Comprehensive Rules retrieval and citations
- interaction/priority/stack explainer
- combo interruption points
- deck version history

## Development

The project is private and under active development. Changes are developed on feature branches and merged through pull requests after CI passes.
