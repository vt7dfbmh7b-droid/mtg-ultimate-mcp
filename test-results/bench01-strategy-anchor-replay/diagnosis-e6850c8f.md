# BENCH-01 diagnosis — e6850c8f replay

## Scope

This diagnosis follows the mandatory whole-deck rejection of frozen product source `e6850c8ffab7c52cf0f6e1d7bf0c323e14d76ad7` across Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire and Animated Army.

## Proven source behavior

The current unrestricted Upgrade path builds three candidate sources for each structural deficit:

1. generic role search;
2. inferred-strategy supplemental role search;
3. controlled-theme role search, but only while the aggregate theme has a deficit.

For compound themes, final sorting currently does this before ordinary score:

1. substantive inferred commander strategy;
2. inferred-strategy score;
3. explicit component affinity;
4. ordinary candidate score.

The preferred candidate lane likewise admits a card when either:

- inferred strategy is substantive; or
- compound component affinity is meaningful (`>=4`).

Therefore a generic inferred-strategy candidate can enter the same preferred lane as a requested component candidate, and it is sorted ahead of that requested component whenever the strategy signal is substantive.

## Direct replay evidence

### Quick Draw

`Sword of Once and Future` and `Sword of Wealth and Power` were both accepted for the protection deficit because the existing strategy model gives them substantive `spells-control` / `value-engine` affinity. Neither accepted-swap explanation contains compound-component support. By contrast, several spell additions such as `Pact of Negation`, `Three Steps Ahead`, `Daze`, and `Mystical Tutor` do carry direct spellslinger/countermagic component evidence.

This is not just a scoring issue. The centralized `spells-control` supplemental Scryfall clause is currently:

`(o:"counter target spell" OR o:"instant or sorcery" OR o:"noncreature spell")`

It does **not** include `t:instant OR t:sorcery`. Thus a permanent that mentions/casts an instant or sorcery can qualify for the strategy supplemental search, while an ordinary protection instant whose Oracle text does not mention the words "instant" or "sorcery" may be excluded from that supplemental recall path.

That is a generic candidate-discovery defect for spells-control, independent of Stella Lee or any card name.

### Virtue and Valor

The compound request resolves to `Enchantments + Combat / attacks + Card draw`, yet cards such as `Hangarback Walker` and `Bloodforged Battle-Axe` were accepted via substantive `combat-tokens` affinity without explicit enchantment-component support. The sorter places that inferred strategy tier above component affinity, so requested enchantment mechanism is not the first tie-break among role-compatible candidates.

### Explorers / Elven Empire

The new mechanism filter materially improves both typal fixtures, especially Lathril, proving the current filter should not be reverted. The remaining problem is positive prioritization, not broad false-positive rejection alone.

### Animated Army

The previous generic additions disappear, but `Sword of the Animist` is still the only new tail card. It helps ramp while failing to deepen Bello's defining high-MV noncreature artifact/enchantment engine. This indicates that direct requested/commander mechanism needs stronger positive discovery/ranking than generic structural utility.

## Centralized defect

The repeated defect is now:

> **When an explicit resolved compound request exists, inferred generic strategy affinity is allowed to outrank and share the same primary lane with direct requested-component affinity.**

The explicit user/requested mechanism should be the stronger positive signal among candidates that already satisfy the same structural role. Inferred strategy remains valuable as a fallback and tie-break, but should not displace a direct requested component simply because the generic archetype scorer labels a card substantive.

## Smallest generic repair candidate

Do not patch card names or commanders.

For compound controlled themes:

1. Build the first preferred lane from **meaningful requested component affinity**.
2. If that lane yields no eligible printing, fall back to **substantive inferred strategy affinity**.
3. If that also yields no eligible printing, fall back to the generic structural lane.
4. Within the component-aligned lane, rank component affinity before inferred-strategy score, then use existing candidate score.
5. Preserve all existing legality, printing, role eligibility, structural-target, budget, component-preservation and final acceptance gates.

Separately, broaden the generic `spells-control` supplemental search to include actual instant/sorcery card types, e.g. `t:instant OR t:sorcery`, so ordinary spell-based role cards are not disadvantaged versus permanents that merely mention spells. This should receive its own focused regression because it changes candidate recall rather than only ordering.

## Validation requirements

Before acceptance:

- synthetic focused regression: compound explicit component candidate must beat substantive inferred-strategy-only candidate for the same role;
- fallback regression: substantive inferred-strategy candidate remains usable when no component-aligned eligible printing exists;
- generic fallback regression remains intact when neither aligned lane yields a printing;
- spells-control recall regression includes a role-compatible Instant/Sorcery whose Oracle text itself does not mention "instant or sorcery";
- existing typal improvements remain green;
- complete immutable repository validation;
- frozen-source replay and manual whole-deck review.

## Product boundary

`e6850c8f...` remains formally validated but manually rejected as a Commander product lineage. The accepted Commander baseline remains `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`. PR #29 remains open/unmerged and stable/current remains V0.13.
