<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project Handoff

`project-state.json` is the authoritative current-state source.

## Resume quickly

1. Read `project-state.json` first.
2. Read `docs/PROJECT-STATE.md`, `validation-index.json`, `docs/VALIDATION-STATE.md`, then only milestone-relevant evidence/docs.
3. Inspect live head of `agent/v15-native-deck-intelligence`, PR #29 and current/recent Actions before editing.
4. Do not reconstruct old chat context if repository state is sufficient.

## Current mode

- Active milestone: **BENCH-01 — Adversarial Commander benchmark suite**
- Experimental branch: `agent/v15-native-deck-intelligence`
- Stable/current: **V0.13**
- PR #29: keep open/unmerged until promotion-grade evidence exists.
- Latest accepted fully validated Commander product: `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`.

## What just completed

Adaptive diversification candidate `247fb37bc34ad70678ff12ec297a6e9bdc220323` passed engineering validation but failed mandatory manual whole-deck quality review.

Generic strategy-anchor repair descendant `2e34ebff20d0a66b7c4649feb1e9984c156e43ca` passed focused regression + full suite + build and replayed five fixtures from frozen source. It correctly removes the false Equipment/Voltron strategy inference caused by negative `non-Equipment` wording, but the overall adaptive lineage still fails Commander-quality acceptance.

Manual replay evidence shows:
- Animated Army: 3 swaps / Bracket 2; strategically relevant combo evidence 1→0; generic structural replacements still displace high-value Bello cards.
- Elven Empire: structural target pressure still accepts generic aristocrats/food/tutor/fast-mana cards over stronger Elf identity pieces.
- Explorers: hard theme floors remain satisfied but replacement quality above those floors is still mixed.
- Quick Draw / Virtue and Valor remain controls; the strategy-anchor repair does not resolve their broader generic-structural-versus-identity concerns.

Evidence: `docs/benchmarks/BENCH-01-STRATEGY-ANCHOR-MANUAL-REVIEW.md`.

## Exact next actions

1. Diagnose where structural target pressure and candidate scoring can allow an IN card with materially weaker commander/requested-theme affinity than the OUT card while aggregate floors still pass.
2. Define generic identity-aware replacement-priority regressions across typal, artifact/enchantment and control families.
3. Implement only the smallest centralized generic repair supported by source diagnosis.
4. Do not freeze all typal/theme cards, raise minimum floors as a proxy for quality, add card/deck exceptions, or weaken legality/budget/printing/component/strategy/simulation/target-progress gates.
5. Run focused + full validation, freeze the exact repair SHA, replay Animated Army + Elven Empire + Explorers with Quick Draw + Virtue controls, and manually review full decks before acceptance.
6. Only after actual cross-fixture whole-deck quality improves should BENCH-01 broaden or PR #29 / V0.15 promotion readiness be reconsidered.

## Recovery guardrails

Treat execution/tool limits as interruptions, not product failures. Resume from durable GitHub checkpoints. Never repeat completed batches because a prior invocation ended. Persist material evidence/state changes, but do not create state/doc commits just for activity.
