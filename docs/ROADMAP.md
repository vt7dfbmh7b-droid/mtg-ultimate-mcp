# Ultimate MTG Roadmap

This roadmap tracks milestone-level direction and durable completed evidence. `project-state.json` is authoritative for the active milestone, current status, blockers and exact next actions. Reconcile this roadmap against newer committed evidence before using it.

## Autonomous schedule safety boundary

Before any scheduled or autonomous repository write, read root `AGENTS.md` and treat its **Hard workflow authority boundary** as binding. Scheduled/autonomous runs must not create, edit, rename, delete, stage, bypass or otherwise alter `.github/workflows/**`, `src/workflow-immutability.test.ts`, or its approved workflow-policy epoch. Existing immutable workflows may be used only through their checked-in interfaces. For the BENCH-01 strategy-anchor replay, request the already-validated frozen product SHA through `.automation/bench01-strategy-anchor-replay.request`; never edit the replay workflow merely to change the SHA. If a protected-surface change seems necessary, classify it as an interactive repository-maintenance blocker and continue other safe BENCH/product work rather than modifying the protected surface.

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

### Frozen advisory-theme candidate repair — FULLY VALIDATED / MANUAL REJECT

The smallest post-floor advisory theme-membership repair was validated immutably at `2c5bbcebb49c6dab23abcb84acf4968f9741db3b` and replayed from that exact frozen executable source across Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire and Animated Army. Replay evidence is persisted at `36f6734e8f7b02dd24237aecb032379c0dd5cf4b`; mandatory manual verdict was historically persisted for that lineage.

The lineage was **manually rejected** despite green formal validation:
- Quick Draw still used upgrade slots on equipment/value pieces that diluted the Stella Lee spell plan.
- Virtue and Valor still replaced defining enchantment/Aura pieces with generic structural cards.
- Explorers still cut Merfolk/typal engines for generic counters/value/protection cards.
- Elven Empire improved one slot with Llanowar Elves but still accepted non-Elf structural utility and remained Bracket 2.
- Animated Army accepted zero swaps, so the repair failed the required regression guard.

### Subsequent strategy-compatible and mechanism-aware work — PARTIAL IMPROVEMENT / MANUAL REJECT LINEAGE

Later generic work moved replacement ordering toward commander/request identity and direct mechanism affinity. It produced meaningful local improvements, especially in Quick Draw and portions of Explorers/Elven Empire, but repeated whole-deck manual review still found generic/off-plan replacements and insufficient mechanism-positive prioritization. These descendants therefore did not replace `e17b0a1c...` as the accepted Commander baseline.

### Current frozen candidate — `00571713696977093fee717deecc2b26969e2643` — FORMALLY VALIDATED / MANUAL REVIEW PENDING

The latest frozen formally validated five-fixture product candidate is `00571713696977093fee717deecc2b26969e2643` (`fix(BENCH-01): reject context-dead low-curve utility`). Its source contents were subsequently validated in a clean descendant tree and the five-fixture strategy-anchor replay persisted successfully with `src/**` proven equal to the frozen product SHA.

The replay covers:
- Quick Draw
- Virtue and Valor
- Explorers of the Deep
- Elven Empire
- Animated Army

The repair closes the specific context-dead low-curve utility failure that previously allowed unusable color-restricted cost reducers to survive through structural low-curve lanes. In the latest Animated Army output, the previously decisive Jet Medallion-in-Gruul error is gone.

However, **this candidate is not yet an accepted Commander product checkpoint**. No current-tree manual whole-deck verdict has yet been persisted for the `005717...` replay. The next required action is therefore manual inspection of all five complete decks and one explicit accept/reject verdict with cross-fixture reasoning. Do not make another Commander product repair before that verdict unless a separate hard product or integrity blocker is independently proven.

If the lineage is rejected, isolate a repeated generic weakness across the complete decks before another product change. If the lineage is accepted, only then record `005717...` as the new accepted Commander product checkpoint with its exact formal and manual evidence.

After this five-fixture lineage is conclusively accepted or rejected, broaden BENCH-01 to fresh combo, hybrid, control, aristocrats, budget and unusual-commander fixtures, including strong general-AI comparison where practical, rather than continuing to polish the same precons.

## INTEL-03 — Human-level strategic reasoning layer — PLANNED

Do not start speculative INTEL-03 work while BENCH-01 still has narrower evidence-driven quality gates.

## INTEL-04 — Counterfactual deck comparison & expert explanation — PLANNED

Remains downstream of current BENCH evidence gathering.

## Promotion boundary

PR #29 remains open/draft/unmerged and stable/current remains V0.13. Standing authorization permits autonomous merge/promotion only after the candidate is fully validated, safe, non-redundant, blocker-free and supported by promotion-grade benchmark evidence demonstrating real whole-deck Commander quality.
