# Ultimate MTG Roadmap

This roadmap tracks milestone-level direction and durable completed evidence. `project-state.json` is authoritative for the active milestone, current status, blockers and exact next actions. Reconcile this roadmap against newer committed evidence before using it.

## North star

Build an evidence-backed Commander specialist that can consistently outperform strong general-purpose AI on complete deck construction and analysis while preserving exact legality, budget, printing, strategy and user constraints.

## PM-01 — Persistent Project State & Handoff Automation — VALIDATED

Repository-authoritative project state, generated recovery/handoff surfaces and state-integrity checks are established. Do not repeat the comprehensive audit without a material architecture/runtime/stable-boundary/state-integrity change.

## PM-02 — Validation State Indexing — VALIDATED

Deterministic validation indexing and fresh-session recovery are established.

## INTEL-01 — Win-package intelligence — VALIDATED

Verified full-table win-package discovery/injection/protection and final-route recognition remain validated at their registered controls.

## INTEL-02 — Actual autonomous deck improvement — IMPLEMENTED / BENCHMARK VALIDATION PENDING

Hard-truth and preservation safeguards are implemented. BENCH-01 remains the active proof gate for actual whole-deck Commander quality.

The latest **accepted** fully validated executable Commander product remains `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`. Later descendants contain useful engineering work and evidence but have not yet passed the required manual whole-deck acceptance boundary.

## BENCH-01 — Adversarial Commander benchmark suite — ACTIVE

Operating rules: freeze one executable source per batch; use contrasting unseen fixtures; inspect complete decks manually; distinguish target movement from target achievement; convert only repeated generic weaknesses into tested repairs; never use fixture/card-specific hacks; never treat green workflows as proof of Commander superiority.

### Batch A — COMPLETE

Historical split: Liliana NZ$500 specialist win; Counter Blitz general-AI win due compound-theme rejection.

### Batch B — COMPLETE

Cavalry Charge reproduced the compound-language defect. Generic compound parsing and per-component preservation were subsequently validated. Counter dense-counters allocation remains watch-only because later batches did not reproduce it.

### Batch C — COMPLETE

Witherbloom/Urza exposed missing controlled lifegain/card-draw vocabulary. The generic measurable taxonomy bridge was validated; `e17b0a1c...` remains the latest accepted product baseline.

### Batch D — COMPLETE

Quick Draw, Virtue and Valor and Explorers showed terminal construction behavior under the frozen baseline. The downstream compound-component preservation guard was proven necessary and remains locked.

### Candidate-breadth diagnostic — COMPLETE

Changing only candidate breadth 4→6 improved Explorers and, independently, Animated Army while several controls were unchanged. Source inspection showed the parameter bounded serial planner diversification rather than truncating a pre-ranked pool.

### Adaptive bounded-diversification candidate — ENGINEERING GREEN / MANUAL REJECT

A generic adaptive diversification implementation was produced at `247fb37bc34ad70678ff12ec297a6e9bdc220323`. Engineering validation and replay mechanics were green, but mandatory manual whole-deck review rejected the product candidate.

Manual review found:
- Quick Draw: mechanically improved but several generic additions remained weakly on-plan.
- Virtue and Valor: structural fillers did not convincingly improve Ellivere identity.
- Explorers: 9 swaps / Bracket 3 recovered the breadth-6 state but replacement quality remained mixed.
- Elven Empire: clear identity regression; generic aristocrats/food/structural cards displaced Elf/Elf-payoff pieces while remaining Bracket 2.
- Animated Army: 5 swaps / Bracket 2 versus prior 12/B3 breadth-6 diagnostic, with strategy evidence incorrectly manufacturing Equipment/Voltron context from negative `non-Equipment` wording.

Evidence: `docs/benchmarks/BENCH-01-ADAPTIVE-MANUAL-REVIEW.md`.

### Generic strategy-anchor repair — VALIDATED LOCALLY / PRODUCT LINEAGE STILL MANUAL REJECT

A centralized semantic repair at `2e34ebff20d0a66b7c4649feb1e9984c156e43ca` requires a positive Equipment/equip/attach anchor before incidental protection/combat text can substantively create `equipment-voltron` identity. Focused strategy regression, full repository suite and build were green before a frozen-source five-fixture replay.

The repair **successfully closes the false Equipment/Voltron inference defect**, but does not make the overall adaptive lineage acceptable:
- Animated Army now uses `value-engine` rather than fabricated Equipment/Voltron strategy, yet still ends at only **3 swaps / Bracket 2**, cuts high-value Bello pieces for generic structural cards, and drops strategically relevant combo evidence **1→0**.
- Elven Empire still allows structural Bracket pressure and incidental strategy signals to displace stronger Elf identity cards.
- Explorers still demonstrates that passing minimum theme/component floors is not equivalent to preserving identity quality above those floors.
- Quick Draw and Virtue and Valor remain controls with broader replacement-quality concerns unresolved.

Evidence: `docs/benchmarks/BENCH-01-STRATEGY-ANCHOR-MANUAL-REVIEW.md`.

### Current generic weakness — IDENTITY-AWARE REPLACEMENT PRIORITY

The repeated cross-fixture problem is now narrower and better supported:

1. Hard legality, budget, printing, component and strategy-loss gates are required and should remain unchanged.
2. Structural Bracket targets can still make a candidate package look better even when the incoming card contributes materially less to the commander/requested identity than the outgoing card.
3. Aggregate theme/component minimums prevent catastrophic failure but can allow meaningful erosion above the minimum floor.
4. Correct strategy labels alone are insufficient; replacement scoring must account for relative identity/strategy value of **IN versus OUT**.

The next authorized product work is source diagnosis and, only if the mechanism is centralized, a small generic identity-aware replacement-priority repair. The repair must not freeze all typal/theme cards, simply raise minimum theme floors, weaken structural target gates, or add deck/card exceptions.

Required proof before acceptance:
- generic regressions across at least typal, artifact/enchantment and control families;
- focused + full repository validation and build;
- one exact frozen repair SHA;
- multi-fixture replay on Animated Army, Elven Empire and Explorers with Quick Draw and Virtue controls;
- manual complete-deck review showing actual Commander-quality improvement, not only Bracket/metric movement.

Remaining BENCH breadth should still cover unrestricted combo, hybrid combat/combo, commander damage, control, aristocrats, budget, unusual commander/partner incentives and strong general-AI comparison before promotion readiness.

## INTEL-03 — Human-level strategic reasoning layer — PLANNED

Do not start speculative INTEL-03 work while BENCH-01 has the narrower identity-aware replacement-priority gate.

## INTEL-04 — Counterfactual deck comparison & expert explanation — PLANNED

Remains downstream of current BENCH evidence gathering.

## Promotion boundary

PR #29 remains open/draft/unmerged and stable/current remains V0.13. Standing authorization permits autonomous merge/promotion only after the candidate is fully validated, safe, non-redundant, blocker-free and supported by promotion-grade benchmark evidence demonstrating real whole-deck Commander quality.
