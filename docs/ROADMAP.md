# Ultimate MTG Roadmap

This roadmap tracks milestone-level direction and durable completed evidence. `project-state.json` is authoritative for the active milestone, current status and exact next actions. Autonomous work must reconcile this roadmap against newer committed evidence before using it; stale roadmap language must never recreate completed work.

## North star

Build an evidence-backed Commander specialist that can consistently outperform strong general-purpose AI on complete deck construction and analysis while preserving exact legality, budget, printing, strategy and user constraints.

## PM-01 — Persistent Project State & Handoff Automation — VALIDATED

Delivered `project-state.json`, generated recovery/handoff documents, recovery protocol and CI state-integrity checks. Do not repeat the completed comprehensive system audit unless a material architecture, runtime-entry-point, stable-boundary or state-integrity change invalidates it.

## PM-02 — Validation State Indexing — VALIDATED

Delivered deterministic validation indexing, generated validation-state recovery, CI integrity and fresh-session distinction between current/stale/passing/failing evidence.

## INTEL-01 — Win-package intelligence — VALIDATED

Bounded verified win-package discovery, legality/color/printing/budget filtering, full-table closure, swap-feasible selection, atomic injection, package protection and final-route recognition are validated. The exact-source positive control at `5829b37b686255ba35d419b37be17095e54fb696` remains green.

## INTEL-02 — Actual autonomous deck improvement — IMPLEMENTED / BENCHMARK VALIDATION PENDING

Implemented safeguards include role truth, structural floors, strategy/resource/component preservation, exact legality/budget/printing truth and iterative candidate comparison. Marvel restricted-pool controls remain honest expected-ceiling failures rather than target achievements. Provider unavailable remains provider-unknown, not evidence of absence.

The latest fully validated executable BENCH product source remains `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`. It is experimental validation evidence, not stable promotion.

## BENCH-01 — Adversarial Commander benchmark suite — ACTIVE

Operating rules remain: freeze executable source per batch; use contrasting unseen fixtures; score hard truth before subjective quality; distinguish harness/provider failure, construction ceiling, target movement, target achievement and formal validation; convert only repeated generic failures into tested repairs; never add deck/card/benchmark-specific hacks; never treat workflow success as whole-deck superiority.

### Batch A — COMPLETE

Historical pre-repair verdict: Counter Blitz general-AI win due compound-theme rejection; Liliana NZ$500 specialist win due exact budget compliance. Aggregate historical verdict remains **1–1, split-not-promotion-grade**.

### Batch B — COMPLETE

Cavalry Charge independently reproduced Counter Blitz compound-theme rejection, justifying the generic controlled parser repair. Paired replay then exposed aggregate component compensation. Generic component-preservation implementation was validated at `dd085caf4e47f6f5e1976667dc90de2db46c00a1`; paired replay closed that blocker. Counter dense-countermagic allocation remains watch-only because later unseen fixtures did not reproduce it.

### Batch C — COMPLETE

Unseen Witherbloom/Urza exposed missing controlled `lifegain`/`card draw` vocabulary while Necron controlled supported vocabulary. Source inspection proved reusable measurable semantics, justifying the generic taxonomy bridge. Product commit `387709983880fa2fd10c7f0aa50cd8b1524852f5`; latest fully validated source-equivalent executable baseline `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`. Corrected replay accepted the bridge without reproducing the allocation concern.

### Batch D — COMPLETE

Frozen source `e17b0a1c...` produced: Quick Draw 8 swaps / Bracket 3→3; Virtue and Valor 4 swaps / Bracket 2→2; Explorers of the Deep 4 swaps / Bracket 2→2. Terminal Virtue/Explorers packages included genuine component regressions, so the downstream compound-component preservation guard remains required and must not be weakened.

### Candidate-breadth diagnostic — COMPLETE

With the same frozen product source and all other inputs unchanged, changing only `candidatePackagesPerRound` from 4 to supported maximum 6 produced Quick Draw unchanged, Virtue unchanged, and Explorers improving from **4 swaps / Bracket 2 to 9 swaps / Bracket 3**.

### Cross-family breadth generalization — COMPLETE

The frozen-source follow-up compared breadth 4 vs 6 on two unrelated unseen families. **Elven Empire** remained 8 swaps / Bracket 2. **Animated Army** improved from 9 swaps / Bracket 2 to **12 swaps / Bracket 3**, with stronger rubric total and strategy count.

Explorers + Animated Army therefore establish a repeated cross-family bounded candidate-discovery/ranking defect signal, while Quick Draw, Virtue and Valor, and Elven Empire are unchanged controls.

### Candidate-discovery mechanism diagnosis — COMPLETE / REPAIR AUTHORIZED, VALIDATION PENDING

Detailed diagnosis: `docs/BENCH-01-CANDIDATE-DISCOVERY-DIAGNOSIS-2026-09-06.md`.

Frozen-source inspection establishes that `candidatePackagesPerRound` does not merely truncate a pre-ranked candidate pool. `refineCommanderDeckIterativelyV12()` invokes the planner sequentially. After each generated plan, `diversifyNextPackage()` adds roughly half of that package's incoming cards to `diversityBlocked`; later planner calls therefore explore search states that earlier candidate numbers never enter. Rejected strategy/package-acceptance cuts can also expand blocked-cut state.

That mechanism explains why positions 5–6 can expose viable accepted packages for Explorers and Animated Army. A fixed breadth of 4 can terminate the serial diversification chain while it is still producing materially new paths.

This source proof plus repeated unrelated-fixture evidence justifies a **generic adaptive bounded-diversification control-flow repair**. It does **not** justify changing the default/global breadth from 4 to 6: moving a fixed magic number would preserve the same failure mode at the new boundary.

Required repair properties:
- continue bounded diversification only while search states/packages remain materially novel and the attempt remains unresolved;
- terminate on duplicate/no-new-package states;
- maintain a strict hard work ceiling;
- preserve existing winner selection and candidate-attempt provenance;
- leave legality, budget, printing, package acceptance, strategy retention, target-progress, simulation, theme and compound-component correctness gates unchanged.

Before acceptance, add generic control-flow regressions, run focused and full validation, then freeze the exact repair SHA and replay Explorers + Animated Army plus Quick Draw, Virtue and Valor, and Elven Empire controls. Record runtime/work cost as well as quality movement. An unvalidated repair head is not a new validated baseline.

Remaining promotion evidence should still cover compact unrestricted combo, hybrid combat-combo, commander damage/combat, control, aristocrats, budget and unusual-partner families, plus expert comparison against strong locked general-AI baselines.

## INTEL-03 — Human-level strategic reasoning layer — PLANNED

Do not start speculative INTEL-03 work while BENCH-01 has the narrower adaptive-diversification repair/validation gate.

## INTEL-04 — Counterfactual deck comparison & expert explanation — PLANNED

Remains downstream of current BENCH evidence gathering.

## Promotion boundary

PR #29 and stable/current V0.13 remain unchanged while BENCH-01 is not promotion-grade. Standing authorization permits autonomous merge/promotion only after the candidate is fully validated, non-redundant, safe, blocker-free and supported by broad benchmark evidence demonstrating real forward quality rather than workflow success.
