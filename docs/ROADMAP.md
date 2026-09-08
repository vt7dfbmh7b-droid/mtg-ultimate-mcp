# Ultimate MTG Roadmap

This roadmap tracks milestone-level direction and durable completed evidence. `project-state.json` is authoritative for the active milestone, current status, blockers and exact next actions. Reconcile this roadmap against newer committed evidence before using it.

## Autonomous schedule safety boundary

Before any scheduled or autonomous repository write, read root `AGENTS.md` and treat its **Hard workflow authority boundary** as binding. Scheduled/autonomous runs must not create, edit, rename, delete, stage, bypass or otherwise alter `.github/workflows/**`, `src/workflow-immutability.test.ts`, or its approved workflow-policy epoch. Existing immutable workflows may be used only through their checked-in interfaces. For the BENCH-01 strategy-anchor replay, request the already-validated frozen product SHA through `.automation/bench01-strategy-anchor-replay.request`; never edit the replay workflow merely to change the SHA. If a protected-surface change seems necessary, classify it as an interactive repository-maintenance blocker and continue other safe BENCH/product work rather than modifying the protected surface.

Scheduled/autonomous runs must also obey the root `AGENTS.md` single-flight rule: do not start a new branch-changing validation, replay, state writer, evidence persistence operation, or Commander product repair while another relevant branch-writing operation is still active. Manual verdicts belong under `test-results/bench01-manual-verdicts/`, outside replaceable generated replay output.

## Current BENCH-01 checkpoint — 2026-09-08

The generic commander-compatible Aura target-shape repair at `473edf473a284b9532aa03747abfa41a1081ca2c` passed immutable full CI and an exact-source frozen five-fixture replay. The durable whole-deck verdict accepts the repair as meaningful BENCH-01 progression but defers accepting it as the new Commander baseline. Accepted baseline remains `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`.

- Virtue and Valor / Ellivere: the prior `Angelic Destiny` → artifact-only `Hardlight Containment` swap is gone. `Angelic Destiny` and `Ancestral Mask` remain; the deck moves Bracket 2→3 without losing its enchanted-creature combat identity.
- Explorers of the Deep / Hakbal: `Reflections of Littjara` remains; prior typal-engine preservation stays fixed.
- Animated Army / Bello: `Esika's Chariot` remains; prior commander-shape preservation stays fixed.
- Quick Draw and Elven Empire: no material Aura-repair regression.
- All five outputs are exact-100, Commander legal and resolved.
- Target movement is not target achievement: Quick Draw remains Bracket 3; Ellivere, Hakbal and Bello finish Bracket 3; Elven Empire remains Bracket 2.
- The replay is a familiar post-repair control batch. Fresh contrasting Commander evidence and a strong general-AI comparison remain mandatory before baseline acceptance.

Evidence: `test-results/bench01-manual-verdicts/473edf473a284b9532aa03747abfa41a1081ca2c.md`. Exact next direction: freeze `473edf47...` for a genuinely fresh high-interaction control, aristocrats/graveyard, unrestricted combo or unusual-commander fixture; manually inspect the complete deck and compare it against strong general AI. Do not repeat the completed Aura regression/repair/replay and do not patch isolated questionable swaps without the generic-repair threshold.

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

### Historical frozen candidate — `00571713696977093fee717deecc2b26969e2643` — FORMALLY VALIDATED / MANUAL REJECT

The frozen five-fixture product candidate `00571713696977093fee717deecc2b26969e2643` (`fix(BENCH-01): reject context-dead low-curve utility`) passed focused/full/build validation and was replayed with `src/**` proven equal to the frozen product SHA across Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire and Animated Army.

Mandatory whole-deck review is now permanently persisted at `test-results/bench01-manual-verdicts/00571713696977093fee717deecc2b26969e2643.md` and **rejects the lineage as a new accepted Commander product baseline**.

Fixture-level conclusion:
- Quick Draw / Stella: local pass and strongest fixture; the earlier Equipment/Sword drift is gone and the replacement tail is coherently spellslinger/control oriented.
- Virtue and Valor / Ellivere: mixed; structural metrics improve and several incoming enchantment-support cards are good, but defining Aura/enchantment pieces are still too readily cut for broad value/interaction cards.
- Explorers of the Deep / Hakbal: fail; strong bracket/metric movement is accompanied by Merfolk/explore/counter identity dilution through generic interaction, blink, tutors and Equipment.
- Elven Empire / Lathril: fail; several good Elf additions coexist with cuts to Elf payoffs/typal cards for generic aristocrats utility and Equipment.
- Animated Army / Bello: decisive fail despite the local bug fix; Jet Medallion is gone, but direct Bello mechanism pieces such as qualifying high-MV artifact/enchantment cards are still displaced by low-cost generic structural/value cards.

The context-dead low-curve utility repair itself remains useful engineering evidence and should be retained. The observed Jet Medallion-in-Gruul failure is closed. That local success does not establish whole-deck specialist acceptance.

### Historical generic weakness — MECHANISM-AWARE RELATIVE IN-vs-OUT REPLACEMENT VALUE

The repeated cross-fixture defect is now narrower and better evidenced than generic incoming-card affinity alone: **direct requested-component and commander-mechanism importance is under-valued on the outgoing/cut side, so identity-bearing OUT cards can lose to generic structurally useful IN cards.**

Repeated evidence spans genuinely different mechanisms:
- Ellivere: Aura/enchantment identity pieces are cut while generic value/token/interaction cards enter.
- Hakbal: Merfolk/explore/counter engines and typal value pieces are displaced by generic interaction, blink, tutors and a Sword.
- Lathril: Elf payoff/typal cards are displaced by non-Elf structural utility and Equipment.
- Bello: qualifying high-MV artifact/enchantment mechanism pieces are displaced by cheaper generic structural cards even though those high-MV permanents directly embody the commander's incentive.

A recurring diagnostic signal is that outgoing identity-bearing cards can receive weak or zero cut-strategy affinity despite obvious deck-specific importance. Hard component/theme floors prevent catastrophic collapse but do not prove above-floor identity preservation.

The next justified repair is the smallest generic **advisory relative replacement mechanism**:
- score direct requested-component/commander-mechanism importance for OUT as well as IN;
- compare IN versus OUT mechanism/component value among already structurally valid replacements;
- apply an advisory identity-preservation/cut-priority preference above existing hard floors;
- preserve structural fallback when no credible strategy-compatible alternative exists;
- avoid card-name, fixture-name and commander-specific exceptions;
- add focused generic regressions spanning Aura/enchantment, typal, counters/explore-style, token/combat and high-MV artifact/enchantment mechanisms;
- pass full immutable validation before freezing the exact repair SHA and replaying representative failures plus contrasting controls;
- persist a new durable manual whole-deck verdict before any acceptance claim.

Do **not** solve this by freezing all theme cards, raising global theme minimums, adding scenario-specific vetoes, or merely increasing candidate breadth.

Once the repeated replacement-value defect is resolved or conclusively bounded, broaden BENCH-01 beyond these five precons to fresh combo, hybrid, control, aristocrats, budget and unusual commander incentives, with strong general-AI comparison where practical.

## INTEL-03 — Human-level strategic reasoning layer — PLANNED

Do not start speculative INTEL-03 work while BENCH-01 still has narrower evidence-driven quality gates.

## INTEL-04 — Counterfactual deck comparison & expert explanation — PLANNED

Remains downstream of current BENCH evidence gathering.

## Promotion boundary

PR #29 remains open/draft/unmerged and stable/current remains V0.13. Standing authorization permits autonomous merge/promotion only after the candidate is fully validated, safe, non-redundant, blocker-free and supported by promotion-grade benchmark evidence demonstrating real whole-deck Commander quality.
