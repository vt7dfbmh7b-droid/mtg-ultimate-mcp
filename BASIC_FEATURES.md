# Ultimate MTG — Preferred Basic Feature Surface

This file is the maintenance map for ordinary MTG/Commander requests on the stable runtime.

The server deliberately keeps historical versioned tools registered for backward compatibility. That does **not** mean every generation should be treated as equally preferred. When several tools can answer the same user intent, prefer the current stable tool listed here unless a legacy-specific capability is explicitly required.

Stable runtime remains V0.13. Experimental V0.14/V0.15 research/build/model tools are not part of this stable basic surface.

## Preferred tools by everyday job

| User intent | Preferred stable tool(s) | Notes |
| --- | --- | --- |
| Look up a card | `card_lookup` | Live Scryfall identity/Oracle/legality/printing facts. |
| Explain what a card does / best uses | `card_intelligence_v05` | Prefer this over inventing strategic text from memory. |
| Search cards | `card_search` | General live card discovery. |
| Compare cards | `compare_cards` | Base comparison surface. |
| Check a full Commander deck's legality | `check_commander_rules` | Hard gate: exact 100, commander eligibility/pairing, color identity, singleton, Commander legality and unresolved cards. |
| Check whether one card fits supplied commander(s) | `check_card_for_commander` | Validates the supplied commander configuration as well as candidate color identity / Commander legality. |
| Analyze a deck | `analyze_deck` | Foundational deck metrics/roles. Use newer specialist tools when a request needs deeper mana, casting, combat, simulation or refinement. |
| Analyze mana | `analyze_mana_base_v04` | Uses resolved land types/text and Commander identity. |
| Simulate consistency | `simulate_deck_consistency` / `simulate_pod_pressure_v04` | Simulations are assumptions/estimates, never hard truth. |
| Find combos | `find_deck_combos` | Commander Spellbook-backed evidence; source outage is unavailable evidence, not proof of no combo. |
| Estimate bracket | `estimate_commander_bracket` | Advisory estimate. Requested bracket never overrides achieved evidence or hard legality. |
| Find exact printings | `printing_lookup`, `find_printings_in_family_v08` | Use exact set/collector identity when the user cares about physical versions/themes. |
| Browse stock Commander precons | `list_commander_precons_v10` | Live MTGJSON-backed catalog. |
| Fetch exact untouched precon | `get_precon_stock_deck_v10` | Preserve exact stock printing/quantity/finish identity. |
| Analyze stock precon | `analyze_precon_v10` | Stock-first analysis before suggesting upgrades. |
| Upgrade/refine a precon | `refine_precon_v13` | Current stable precon refinement path. |
| Price a card for a New Zealand user | `price_card_nzd_v13` | Current NZD-first price estimate/reference path. Prefer direct NZ retailer evidence when available. |
| Explain current pricing behavior | `pricing_policy_v13` | Describes FX/reference-price limitations. |
| Build/refine a Commander deck | `build_and_refine_commander_deck_v13` | Current stable construction/refinement path. Experimental V0.15 universal pipeline remains separate. |

## Compatibility rules

1. Historical tools remain registered so old clients do not break.
2. A higher historical version number does not automatically make a tool the preferred answer; use the map above.
3. Do not remove or rename legacy tools during ordinary cleanup without an explicit compatibility migration.
4. Do not expose V0.15 experimental model/research tools through `server-current` merely to simplify tool selection.
5. Hard truth always wins over strategy, simulation, popularity, requested power or learned/model output.

## Pricing compatibility note

Some older base responses such as `analyze_deck` / `price_deck_printings` retain legacy USD-oriented value fields for compatibility. They are not the preferred NZ pricing surface. For a current New Zealand price answer, use `price_card_nzd_v13` and disclose when the result is an FX-converted reference rather than a direct NZ listing.

## Current Commander eligibility note

Commander eligibility must follow current Wizards rules. In addition to ordinary legendary creatures and cards that explicitly permit themselves to be commanders, a **legendary Vehicle or legendary Spacecraft with printed power and toughness** is commander-eligible. Color-identity and Commander-format legality still apply.

## Failure behavior

- Unresolved cards make legality incomplete rather than silently legal.
- Missing external evidence is reported as unavailable rather than converted to a negative fact.
- Physical-printing restrictions and exact budgets fail closed when they cannot be verified.
- Simulations expose their assumptions and are not presented as observed win rates.
- Experimental learned outputs remain advisory/shadow-only.
