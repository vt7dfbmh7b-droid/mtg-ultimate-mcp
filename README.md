# MTG Ultimate MCP

An MCP-powered Magic: The Gathering / Commander knowledge, rules, deck-building, upgrade, precon, printing, pricing, combo, simulation and evidence service.

The goal is an **MTG brain for AI clients**: accurate card/rules knowledge, legal Commander construction, exact physical printings, useful simulations, evidence-backed upgrades, complete deck drafts, NZ-focused shopping decisions, and simple explanations on top of deeper logic.

## Current stage — V0.13

V0.13 makes **New Zealand dollars (NZD) the primary pricing and budget currency**.

The default pricing rule is:

> **NZ$ first. Direct New Zealand prices when actually checked; otherwise convert the exact Scryfall USD printing reference to NZD and keep USD only as a labelled reference value.**

The older V0.12 USD-oriented tools remain registered for compatibility, but current clients should use the V0.13 pricing/refinement tools.

### V0.13 tools

| Tool | Purpose |
| --- | --- |
| `pricing_policy_v13` | Show the current USD→NZD rate and NZ-local pricing priority. |
| `price_card_nzd_v13` | Price a named card or exact set/collector-number printing with NZ$ first. |
| `refine_commander_deck_v13` | Iteratively refine any legal Commander deck using NZD budgets. |
| `refine_precon_v13` | Refine a stock precon using NZD-first prices and budgets. |
| `build_and_refine_commander_deck_v13` | Build from scratch and refine using NZD per-card/post-draft budgets. |

## NZD pricing policy

V0.13 uses these priorities:

1. Prefer a directly checked New Zealand listing for the **exact physical printing**.
2. TCGfind NZ / NZ retailers are the preferred local shopping lane.
3. If no direct local listing is available through a supported research path, use the exact Scryfall printing's USD reference price and convert it to NZD.
4. Keep the original USD number as `priceUsdReference` for auditability, not as the primary price.
5. Never imply a converted international reference includes NZ shipping or is a guaranteed checkout/landed cost.

A printing restriction always remains active. A cheaper unrelated printing cannot replace a required Final Fantasy, Marvel, Secret Lair, promo, foil or other requested edition.

### NZD budget fields

Current refinement tools use:

- `maxNzdPerCard`
- `maxTotalNzd`
- `maxPostDraftUpgradeNzd` for post-draft refinement of a from-scratch build

The V0.13 precon profile defaults are expressed directly in NZD:

- light — NZ$10/card
- balanced — NZ$20/card
- strong — NZ$35/card
- optimized — no default per-card cap

All can be overridden by the caller.

## Exchange-rate handling

The default FX source is Frankfurter's USD/NZD rate endpoint. The result is cached for six hours so repeated deck refinement does not repeatedly call the FX service.

```text
FX_API_BASE=https://api.frankfurter.dev
FX_CACHE_MS=21600000
USD_TO_NZD_FALLBACK=
```

The fallback is blank by default. If live FX is unavailable and there is no cached value, MTG Ultimate fails clearly instead of silently inventing an exchange rate. A manually configured fallback is labelled as such.

## Deck refinement foundation

The preferred deck workflow remains:

`rules + exact printing policy -> analyse -> generate competing packages -> rebuild each -> validate -> same-seed compare -> NZD budget check -> choose winner -> repeat until plateau`

The optimizer can compare several materially different legal packages per round and keep the strongest supported option. The default is **3 candidate packages per round**; callers can request 1–6.

Every package uses the same per-round simulation seed. Packages are rejected when they fail legality/resolution, physical-printing rules, budget, minimum improvement, or material-regression checks.

The comparison score is a within-deck engineering heuristic, **not** a universal Commander power score or measured multiplayer win rate.

## Simple explanations by default

Normal answers should stay easy to read:

> **Add:** Card X — improves early interaction and costs about NZ$8 for this printing.  
> **Cut:** Card Y — contributes less to the main plan.  
> **Why this package won:** it tested better than the alternatives, stayed legal, and fit the NZ$ budget.

Detailed simulation, FX, source and USD-reference data remain available when useful.

## Commander precons

Commander preconstructed decks are first-class objects.

MTG Ultimate reads the current MTGJSON deck catalog rather than maintaining a frozen hard-coded list. It can fetch the exact stock deck and retain quantity, card name, set code, collector number and foil/nonfoil state. Separate regular/Collector/foil product variants remain distinct where the source lists them separately.

Key tools include:

| Tool | Purpose |
| --- | --- |
| `list_commander_precons_v10` | Browse/search the self-updating Commander precon catalog. |
| `get_precon_stock_deck_v10` | Fetch the untouched stock list with exact physical printings. |
| `analyze_precon_v10` | Analyse stock rules, structure, combos/bracket evidence and simulation. |
| `upgrade_precon_v10` | Historical one-pass upgrade workflow. |
| `refine_precon_v13` | Current multi-package iterative precon refinement with NZD-first pricing. |

## Printing-aware deck building

MTG Ultimate separates **Oracle identity** from **physical printing identity**.

Rules/synergy use the Oracle card. Shopping/value/themed-printing restrictions use the exact edition:

```text
1 Card Name (SET) 123
```

Foil/etched/nonfoil information is retained where available.

A request such as **“Final Fantasy printings only”** means the selected physical printing must belong to the allowed FINAL FANTASY family. Qualifying promos and curated special/Secret Lair releases can be allowed; an unrelated printing of the same Oracle card cannot substitute.

That printing policy remains active through every refinement round and pricing check.

## Commander legality

The hard rules layer validates commander eligibility, supported partner/two-commander configurations, exactly 100 cards, combined commander color identity, singleton/basic/card-specific copy exceptions and current Commander legality.

Fully resolved illegal decks are blocked from advanced building/refinement/simulation workflows.

## Multi-source evidence

Different evidence classes stay separate:

- Wizards — official rules/product facts
- Scryfall — Oracle data, legality, exact printings and USD market reference values
- Commander Spellbook — curated combos and bracket evidence
- TopDeck.gg — structured competitive tournament results/decklists when configured
- EDHTop16 — attributed public competitive/meta reference
- Playgroup.gg — recorded paper Commander context
- EDHREC — broad Commander adoption/synergy/precon context
- Archidekt / Moxfield / MTGGoldfish / AetherHub — public decks and primers
- cEDH Decklist Database — curated competitive archetype context
- DeckCheck — independent deck-analysis opinion
- TCGfind NZ — New Zealand availability/local-price checks
- TCGplayer / Cardmarket — secondary international price cross-checks

No single popularity score, analysis score or tournament finish is treated as proof that a card is universally best.

## Source health and reliability

`source_health_v12` continues to probe Scryfall, Commander Spellbook, MTGJSON and TopDeck.gg when configured. Reference-only sources are not fabricated as backend APIs.

The shared HTTP/Scryfall layers use bounded retries where safe, request pacing and in-process caches to reduce redundant traffic during long refinement runs.

The V0.13 currency layer separately exposes the current FX status through `pricing_policy_v13`.

## Testing

Normal regression checks:

```bash
npm run check
```

Live dependency checks:

```bash
npm run test:live
```

The live smoke suite now verifies:

- Scryfall / Commander Spellbook / MTGJSON availability
- a real USD→NZD FX rate
- a real Scryfall printing converted to `priceNzd`
- no bare USD price is presented as the primary current pricing field
- `Limit Break (FINAL FANTASY VII)` resolves as a real exact 100-card stock precon

Full real-precon end-to-end test:

```bash
npm run test:e2e
```

The E2E scenario uses a real `Limit Break` stock deck, submits NZD per-card and total budgets, runs competing refinement packages, then independently verifies:

- exactly 100 cards
- hard Commander legality
- commander preservation
- stable land count for the automatic nonland swap lane
- exact OUT -> IN deck deltas
- exact incoming set / collector number / finish
- untouched stock printings stay unchanged
- every accepted card stays within the NZD per-card cap
- the package stays within the NZD total cap
- USD values remain only as source/reference fields

## Runtime architecture

The base MCP constructor uses central `config.version`; package/config/health/User-Agent/MCP identity therefore share the release version. `src/server-current.ts` is the stable current runtime boundary.

Historical numbered server modules remain as compatibility/regression layers rather than being deleted in a risky rewrite.

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
- `docs/V0.13_NZD_FIRST_PRICING.md`

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

The feature branch remains under active development in a draft PR. A release is treated as green only after the normal regression suite passes; live integrations and full Commander scenarios are tested separately so external-source outages can be distinguished from code regressions.
