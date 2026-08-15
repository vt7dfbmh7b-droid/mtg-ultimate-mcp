# MTG Ultimate MCP

An MCP-powered Magic: The Gathering knowledge, Commander deck-building, simulation, and evidence-analysis service.

The goal is an **MTG brain for AI clients**: live card data, rules-aware deck analysis, combo discovery, Commander bracket signals, Monte Carlo consistency testing, upgrade research, community references, observed tournament outcomes, and eventually collection-aware complete deck building.

## Current stage — V0.2 analysis, simulation, and references

The server currently exposes eleven read-only MCP tools:

| Tool | Purpose |
| --- | --- |
| `card_lookup` | Resolve a card from Scryfall and return Oracle text, color identity, Commander legality, prices, printing data, EDHREC rank when available, and strategic role tags. |
| `card_search` | Search Scryfall with full Scryfall query syntax. |
| `compare_cards` | Resolve two cards side-by-side for strategy, legality, mana, community adoption, and price comparisons. |
| `analyze_deck` | Parse a Commander decklist and calculate curve, colored pips, early plays, lands, ramp, draw, tutors, interaction, protection, recursion, legality, color identity, and structural signals. |
| `simulate_deck_consistency` | Run deterministic Monte Carlo goldfish simulations for opening hands, mulligans, mana development, commander timing, interaction/draw availability, mana screw/flood proxies, and optional combo assembly. |
| `compare_deck_performance_profiles` | Run the same structural and same-seed simulation model on two lists, then surface measurable differences that could explain consistency/performance differences without claiming causation. |
| `find_deck_combos` | Use Commander Spellbook to find known combos already present and combos the deck is close to completing. |
| `estimate_commander_bracket` | Use Commander Spellbook's bracket estimator to surface bracket classification, Game Changers, bans, extra turns, mass land denial, and strategically relevant combos. |
| `analyze_archidekt_references` | Load public Archidekt decks, credit their creators, compare structures/common cards, and optionally compare them with a target deck. |
| `analyze_tournament_results` | Use TopDeck.gg EDH tournament results and submitted decklists to compare observed higher- and lower-performing structures. Requires `TOPDECK_API_KEY`. |
| `suggest_upgrades` | Detect structural deficits and search current Scryfall data for legal candidate adds/cuts under optional budget, set, theme-query, and exclusion constraints. |

## What “simulation” means here

`simulate_deck_consistency` is intentionally a **Monte Carlo consistency/goldfish model**, not a fake claim to simulate every Magic rule and opponent decision.

It can repeatedly sample realistic opening hands and early draws to measure things such as:

- London-style mulligan pressure
- opening land distribution
- mana development by turn
- commander castability by turn
- early interaction availability
- early draw/selection availability
- mana-screw and flood proxies
- natural assembly probability for user-specified combo pieces
- a clearly labelled tutor-assisted combo proxy

The model exposes its simplifying assumptions in every result. It does **not** pretend that a goldfish percentage is a real match win rate.

`compare_deck_performance_profiles` uses the **same seed and settings** on two resolved lists, which makes it useful for comparing an old list versus an upgraded list, a winning public list versus a lower-performing list, or two different builds of the same commander. Its explanations are candidate structural explanations, not claims that one variable caused a real-world win or loss.

## Real-world evidence layer

### TopDeck.gg — observed tournament outcomes

With a configured TopDeck API key, `analyze_tournament_results` queries completed Magic: The Gathering **EDH** tournaments and uses available submitted decklists plus wins/draws/losses.

It divides the sampled results into higher- and lower-performing cohorts and compares structural metrics including:

- land count
- nonland curve
- early-play density
- fast mana
- total ramp
- card draw/selection
- tutors
- total interaction
- cheap/free interaction
- protection
- recursion

The output deliberately calls these **observed associations**, not causal proof. Pilot skill, pods, seat order, matchup composition, event size, and variance all matter.

TopDeck requires visible attribution when its API data is displayed or published, so the tool returns attribution text with the analysis.

### Archidekt — public community references

`analyze_archidekt_references` accepts up to ten public Archidekt deck IDs or URLs. It preserves creator/source links, compares deck structure, and calculates cards shared across the reference sample.

Archidekt reference frequency is treated as community evidence rather than performance proof. A card appearing in many public decks can reflect budget, theme, popularity, or creator preference rather than objective superiority.

## Data sources

### Scryfall

Scryfall is the primary live card-data source for Oracle text, legality, card identity, search, printing metadata, EDHREC rank fields when present, and price fields.

The service identifies itself with an explicit `User-Agent`, sends an `Accept` header, and spaces Scryfall requests to remain below Scryfall's published API traffic guidance.

### Commander Spellbook

Commander Spellbook powers combo discovery and its current Commander bracket estimator. The service calls its public `find-my-combos` and `estimate-bracket` endpoints rather than maintaining a stale local combo database.

## Architecture

```text
AI / MCP client
      |
      v
  /mcp endpoint
      |
      +-- card knowledge / search / compare ------> Scryfall
      |
      +-- analyze_deck ---------------------------> local parser + Scryfall
      |
      +-- simulate / compare deck profiles -------> local Monte Carlo engine + Scryfall
      |
      +-- find_deck_combos / bracket -------------> Commander Spellbook
      |
      +-- analyze_archidekt_references -----------> Archidekt public deck API
      |
      +-- analyze_tournament_results -------------> TopDeck.gg API + Scryfall
      |
      +-- suggest_upgrades -----------------------> local structure engine + Scryfall
```

The HTTP server uses the MCP TypeScript SDK's Streamable HTTP handler and exposes it at `/mcp`.

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
| `TOPDECK_API_KEY` | empty | Optional TopDeck API key required by `analyze_tournament_results`. |
| `MTG_USER_AGENT` | project identifier | User-Agent sent to upstream services. |

## Decklist format

The parser understands common copy/paste deck formats, including set and collector annotations:

```text
// COMMANDER
1 Edgar Markov (INR) 234

// MAIN
1 Sol Ring (CMM) 396
1 Blood Artist
3 Swamp (NEO) 297
```

It also recognizes `# Commander`, `^Commander^`, and `[Commander]` tags. If a list has no Commander section, relevant tools accept explicit `commanderNames`.

## Upgrade-engine constraints

`suggest_upgrades` currently supports:

- target structural bracket profile 1–5
- maximum Scryfall USD price per candidate
- allowed set codes (useful for universes/set-restricted builds)
- an additional Scryfall theme-query fragment
- excluded card names
- controlled candidate count per deficit

The structural profiles help identify consistency gaps but are **not official bracket definitions**. Official bracket classification remains delegated to Commander Spellbook's current estimator.

## Important caveats

- Partner, Background, Doctor's companion, and similar commander-pairing rules are not yet fully validated locally.
- Strategic role tags are heuristics; Oracle text and known combo data remain the source material for final analysis.
- Monte Carlo simulation currently simplifies colored mana, tapped lands, complex sequencing, taxes, removal, combat, priority, and opponent decisions.
- Same-seed deck comparisons improve consistency of the comparison but still do not reproduce real multiplayer games.
- Tournament cohort analysis is observational and can be biased by which events/decklists are publicly available.
- Scryfall price fields are useful reference data, not a complete NZ-specific shopping engine.
- Upgrade cut suggestions are intentionally cautious and should be checked against simulations, reference lists, and actual play experience.

## Roadmap

### Next — simulation V0.3

- model tapped lands and colored sources
- MDFC/land-spell handling
- better mana-rock and mana-dork sequencing
- commander tax / recast scenarios
- draw-engine activation and tutor timing
- interaction-window modelling
- pod pressure profiles with explicit user-controlled assumptions
- calibrate heuristic weights against observed TopDeck samples instead of inventing unsupported win rates

### Deck intelligence V0.4

- commander-specific synergy scoring
- exact land-base source requirements
- more detailed removal categories and threat coverage
- identify dead/redundant packages
- compare multiple versions of the same deck statistically
- explain why an IN/OUT package improves simulated consistency

### Full upgrade/builder stage

- whole-upgrade budget limits
- NZ pricing/provider adapters
- exact IN/OUT swap optimizer
- no-infinite / combo-light / combo-heavy preferences
- build complete 100-card Commander lists from constraints
- multiple win-condition routes
- mulligan guidance
- primer generation

### Collection and rules stage

- user collection import/storage
- build with owned cards first
- missing-card shopping list
- Comprehensive Rules retrieval and citations
- interaction/priority/stack explainer
- combo interruption points
- deck version history

## Development

The project is private and under active development. Changes are developed on feature branches and merged through pull requests after CI passes.
