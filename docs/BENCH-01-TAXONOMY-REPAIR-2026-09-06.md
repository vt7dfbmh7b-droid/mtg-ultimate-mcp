# BENCH-01 generic theme-taxonomy repair — 2026-09-06

## Evidence that authorized the repair

Unseen Batch C exposed two independent controlled-vocabulary omissions before optimization:

- Witherbloom Witchcraft rejected `lifegain`.
- Urza's Iron Alliance rejected `card draw`.
- Necron Dynasties passed the same parser layer with already-supported vocabulary.

Source inspection then established that both omitted concepts already have shared measurable semantic truth in the existing card-role engine:

- `inferCardRoles()` emits `card draw`, `repeatable draw`, and related draw-engine roles.
- `inferCardRoles()` emits `repeatable life gain engine` and `life-gain-triggered draw engine` for measurable lifegain behavior.

This satisfies the project rule requiring multiple generic omitted concepts or a common registry-coverage mechanism before product repair. The change is therefore a shared neutral-theme registry bridge, not a deck-specific or benchmark-specific exception.

## Candidate repair

Product commit: `387709983880fa2fd10c7f0aa50cd8b1524852f5`.

The repair adds controlled mechanical-theme definitions for card draw and lifegain using generated bounded Scryfall discovery clauses plus independent role/Oracle-based final matching. It does not alter optimizer allocation, legality, budget, printing, bracket, or component-preservation logic.

Focused regressions prove:

- standalone `card draw` resolves to a controlled mechanical theme and matches resolved card semantics;
- standalone `lifegain` resolves to a controlled mechanical theme and matches resolved card semantics;
- unrelated compound families containing those concepts decompose completely;
- unknown leftovers remain fail-closed;
- focused neutral-theme tests pass;
- build/type-check passes before the repair commit is published.

## Validation status

This document intentionally does not mark the product repair fully validated. Normal repository CI must pass on a descendant whose `src/**` is unchanged from `387709983880fa2fd10c7f0aa50cd8b1524852f5`. Only then may that exact source tree be frozen for the Witherbloom + Urza replay.

## Next gate

After normal CI is green with source unchanged from the candidate repair:

1. freeze the validated source tree;
2. replay Witherbloom Witchcraft and Urza's Iron Alliance from that same unchanged source;
3. keep Necron Dynasties as the supported-vocabulary control;
4. judge parser resolution, hard truth, per-component movement/achievement, whole-deck coherence, and whether any new weakness repeats cross-fixture before another intelligence edit.
