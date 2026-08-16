# MTG Ultimate MCP

An MCP-powered Magic: The Gathering / Commander knowledge, rules, deck-building, upgrade, precon, printing, pricing, combo, simulation and evidence service.

The goal is an **MTG brain for AI clients**: accurate card/rules knowledge, legal Commander construction, exact physical printings, useful simulations, evidence-backed upgrades, complete deck drafts, and simple explanations on top of deeper logic.

## Current stage — V0.12

V0.12 refines three areas at once: **upgrade selection, evidence quality, and runtime reliability/architecture**.

The preferred deck workflow is now:

`rules + exact printing policy -> analyse -> generate competing packages -> rebuild each -> validate -> same-seed compare -> budget check -> choose winner -> repeat until plateau`

Instead of testing only one upgrade package per round, the new optimizer can compare several materially different legal packages and keep the strongest supported option.

### New V0.12 tools

| Tool | Purpose |
| --- | --- |
| `refine_commander_deck_v12` | Compare multiple candidate upgrade packages each round and iteratively refine any legal Commander deck. |
| `refine_precon_v12` | Start from the exact stock precon and apply competing-package refinement. |
| `build_and_refine_commander_deck_v12` | Build a legal 100-card draft, then compare competing refinement packages instead of treating the first draft as final. |
| `source_health_v12` | Probe structured data sources and report healthy/degraded/not-configured/reference-only state. |
| `cross_reference_tournament_evidence_v12` | Combine TopDeck.gg + EDHTop16 tournament evidence and conservatively deduplicate likely cross-site copies of the same appearance. |

### Competing-package optimization

The default is **3 candidate packages per round**; callers can request 1–6.

Every package uses the same per-round simulation seed, so the comparison is fairer. Packages are rejected when they fail legality/resolution, physical-printing rules, per-card/total budgets, minimum improvement, or material regression checks.

Later candidates temporarily block part of earlier candidate additions so the engine explores genuinely different paths instead of repeatedly resimulating the same suggestion.

The winner becomes the next full deck and the process repeats. The engine stops instead of forcing a change when no candidate clears the checks.

The comparison score is a within-deck engineering heuristic, **not** a universal Commander power score or measured win rate.

## Simple explanations by default

Normal answers should still be easy to read:

> **Add:** Card X — improves early interaction and fits the deck's plan.  
> **Cut:** Card Y — costs more mana and contributes less to the main route.  
> **Why this package won:** it tested better than the alternatives, stayed legal, and fit the requested budget/printing rules.

`standard` and `detailed` modes can expose candidate-package comparisons, simulation deltas, source health and evidence details when useful.

## Commander precons

Commander preconstructed decks are first-class objects.

MTG Ultimate reads the current MTGJSON deck catalog rather than maintaining a frozen hard-coded list. It can fetch the exact stock deck and retain quantity, card name, set code, collector number and foil/nonfoil state. Separate regular/Collector/foil product variants remain distinct where the source lists them separately.

Key tools include:

| Tool | Purpose |
| --- | --- |
| `list_commander_precons_v10` | Browse/search the self-updating Commander precon catalog. |
| `get_precon_stock_deck_v10` | Fetch the untouched stock list with exact physical printings. |
| `analyze_precon_v10` | Analyse stock rules, structure, combos/bracket evidence and simulation. |
| `upgrade_precon_v10` | One-pass stock OUT -> IN upgrade plan. |
| `refine_precon_v12` | Multi-package iterative refinement from the same untouched stock baseline. |

## Printing-aware deck building

MTG Ultimate separates **Oracle identity** from **physical printing identity**.

Rules/synergy use the Oracle card. Shopping/value/themed-printing restrictions use the exact edition:

```text
1 Card Name (SET) 123
```

Foil/etched/nonfoil information is retained where available.

A request such as **“Final Fantasy printings only”** means the selected physical printing must belong to the allowed FINAL FANTASY family. Qualifying promos and curated special/Secret Lair releases can be allowed; an unrelated printing of the same Oracle card cannot substitute.

That printing policy remains active through every refinement round.

## Commander legality

The hard rules layer validates:

- commander eligibility
- supported partner/two-commander configurations
- exactly 100 cards
- commander color identity
- singleton/basic/card-specific copy exceptions
- current Commander legality/banned state

A black-red commander therefore permits black, red, black-red and colorless identity cards, but not white, blue or green identity cards.

Fully resolved illegal decks are blocked from advanced building/refinement/simulation workflows.

## Budgets

Refinement distinguishes:

- `maxUsdPerCard` — maximum price of each incoming physical printing.
- `maxTotalUsd` — maximum combined reference spend of accepted upgrade swaps.

For from-scratch construction, `maxPostDraftUpgradeUsd` caps only the extra refinement swaps after the first draft; it is not presented as a full-deck purchase budget.

If a strict total budget is active and a selected printing has no verifiable price, the package is rejected rather than treated as free.

## Multi-source evidence

Different evidence classes stay separate:

- Wizards — official rules/product facts
- Scryfall — Oracle data, legality, exact printings and reference prices
- Commander Spellbook — curated combos and bracket evidence
- TopDeck.gg / EDHTop16 — competitive tournament results/decklists
- Playgroup.gg — recorded paper Commander context
- EDHREC — broad Commander adoption/synergy/precon context
- Archidekt / Moxfield / MTGGoldfish / AetherHub — public decks and primers
- cEDH Decklist Database — curated competitive archetype context
- DeckCheck — independent deck-analysis opinion
- TCGfind NZ — New Zealand availability/local-price checks
- TCGplayer / Cardmarket — international price cross-checks

No single popularity score, analysis score or tournament finish is treated as proof that a card is universally best.

### Tournament overlap protection

TopDeck.gg and EDHTop16 can contain the same underlying tournament appearance. V0.12 reports both the raw record count and an **effective unique record count** after conservative cross-site deduplication.

Likely duplicates require event/player/deck/result context. A reused deck URL alone is never enough to merge records, because a maintained deck link may be used at multiple events.

When the same appearance is found on both sites, agreement is treated as corroboration rather than a second independent result.

## Source health

`source_health_v12` probes structured sources such as Scryfall, Commander Spellbook, MTGJSON, EDHTop16 and TopDeck.gg when configured.

It reports:

- healthy
- degraded
- not configured
- reference-only
- latency for live probes

Reference destinations such as EDHREC, Moxfield, DeckCheck and TCGfind NZ are labelled separately instead of pretending they are mandatory backend APIs.

A degraded source should lower confidence or trigger another evidence path. The system must not invent data to fill an outage.

## Gameplay/simulation foundation

Earlier versions provide London-style mulligans, colored mana, common conditional lands/fetches, ramp, tutors, draw, commander tax, Treasures, common special payment mechanics, supported alternative costs, commander removal/recasts, protection battles, Ward-aware targeting, multiplayer stack abstractions, combat modifiers and zone-aware combo readiness.

The simulator is deliberately **not** described as a complete digital implementation of every Magic rule.

## Reliability and runtime architecture

The shared HTTP layer retries safe GET/HEAD requests on temporary failures such as `429`, `500`, `502`, `503` and `504`, with bounded attempts and `Retry-After` support. Read-oriented POST APIs are not automatically retried.

V0.12 also removes the stale-version problem from the MCP identity:

- the base MCP constructor now uses `config.version`
- package/config/health/User-Agent/MCP identity use the same release version
- `src/server-current.ts` is the stable runtime entry point
- `src/index.ts` no longer imports a numbered release module directly
- V0.12 exposes `registerMtgToolsV12(server)` as the preferred future registration pattern

Historical numbered server modules remain as compatibility/regression layers. The active runtime boundary is stable, so future releases can continue consolidating registration code without another public-entry rewrite.

Default operational settings:

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
- `docs/V0.12_COMPETING_REFINEMENT_AND_SOURCE_HEALTH.md`

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

The feature branch remains under active development in a draft PR. A release stage is only considered complete after strict TypeScript compilation and the full test suite pass.
