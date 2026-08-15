# MTG Ultimate MCP

An MCP-powered Magic: The Gathering knowledge and Commander deck-building service.

The goal is an **MTG brain for AI clients**: live card data, rules-aware deck analysis, combo discovery, Commander bracket signals, upgrade research, and eventually collection-aware deck building and full primers.

## V1 foundation

The first version exposes six read-only MCP tools:

| Tool | Purpose |
| --- | --- |
| `card_lookup` | Resolve a card from Scryfall and return Oracle text, color identity, Commander legality, prices, printing data, keywords, and strategic role tags. |
| `card_search` | Search Scryfall with full Scryfall query syntax. |
| `compare_cards` | Resolve two cards side-by-side for strategy, legality, mana, and price comparisons. |
| `analyze_deck` | Parse a Commander decklist and calculate deck size, type counts, average nonland mana value, role counts, color identity, legality, and singleton violations. |
| `find_deck_combos` | Use Commander Spellbook to find known combos already present and combos the deck is close to completing. |
| `estimate_commander_bracket` | Use Commander Spellbook's bracket estimator to surface bracket classification, Game Changers, bans, extra turns, mass land denial, and strategically relevant combos. |

## Data sources

### Scryfall

Scryfall is the primary live card-data source for Oracle text, legality, card identity, search, printing metadata, and price fields.

The service identifies itself with an explicit `User-Agent`, sends an `Accept` header, and spaces Scryfall requests to remain below Scryfall's published API traffic guidance.

### Commander Spellbook

Commander Spellbook powers combo discovery and its current Commander bracket estimator. V1 calls the public `find-my-combos` and `estimate-bracket` endpoints rather than maintaining a stale local combo database.

## Architecture

```text
AI / MCP client
      |
      v
  /mcp endpoint
      |
      +-- card_lookup / card_search / compare_cards
      |        |
      |        +--> Scryfall
      |
      +-- analyze_deck
      |        |
      |        +--> local parser + Scryfall collection lookup
      |
      +-- find_deck_combos
      |        |
      |        +--> Commander Spellbook
      |
      +-- estimate_commander_bracket
               |
               +--> Commander Spellbook
```

The HTTP server uses the current MCP TypeScript SDK's Streamable HTTP handler and exposes it at `/mcp`.

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
| `MTG_USER_AGENT` | project identifier | User-Agent sent to upstream services. |

## Decklist format

V1 understands common copy/paste deck formats, including set and collector annotations:

```text
// COMMANDER
1 Edgar Markov (INR) 234

// MAIN
1 Sol Ring (CMM) 396
1 Blood Artist
3 Swamp (NEO) 297
```

It also recognizes `# Commander`, `^Commander^`, and `[Commander]` tags. If a list has no Commander section, the `analyze_deck` tool accepts explicit `commanderNames`.

## Important V1 caveats

- Partner, Background, Doctor's companion, and similar commander-pairing rules are not yet fully validated locally.
- Strategic role tags are heuristics; Oracle text and known combo data remain the source material for final analysis.
- Scryfall price fields are useful reference data, not a complete NZ-specific shopping engine.
- Commander bracket results are delegated to Commander Spellbook's current estimator and should be presented with its evidence rather than treated as an unexplained absolute score.

## Roadmap

### V1.1 — stronger deck intelligence

- Card-function taxonomy with better ramp/draw/removal/wipe/protection detection
- Mana-source and pip analysis
- Land-base quality scoring
- Curve distribution
- Commander-specific synergy scoring
- Detect missing deck roles

### V1.2 — upgrade engine

- `suggest_cuts`
- `suggest_upgrades`
- Per-card budget limits
- Whole-upgrade budget limits
- Theme preservation
- Bracket targeting
- No-infinite / combo-light / combo-heavy preferences
- Printing/set restrictions such as Final Fantasy-only builds

### V1.3 — deck builder

- Build complete 100-card Commander lists from constraints
- Multiple win-condition routes
- Tutor/interaction/protection balance
- Mulligan guidance
- Full primer generation
- Exact IN/OUT swap plans

### V1.4 — collection and pricing

- User collection storage/import
- Build with owned cards first
- Missing-card shopping list
- NZ pricing/provider adapters
- Printing preference and proxy-friendly export formats

### V2 — deeper MTG knowledge

- Comprehensive Rules retrieval and citations
- Interaction explainer
- Priority/stack walkthroughs
- Trigger ordering and replacement effects
- Combo interruption points
- Matchup and pod analysis
- Deck version history and comparisons

## Development

The project is currently private and under active development. Changes should be developed on feature branches and merged through pull requests after CI passes.
