# Ultimate MTG Roadmap

This roadmap tracks milestone-level direction and durable completed evidence. `project-state.json` is authoritative for the active milestone, current status and exact next actions. Autonomous work must reconcile this roadmap against newer committed evidence before using it; stale roadmap language must never recreate completed work.

## North star

Build an evidence-backed Commander specialist that can consistently outperform strong general-purpose AI on complete deck construction and analysis while preserving exact legality, budget, printing, strategy and user constraints.

## PM-01 — Persistent Project State & Handoff Automation — VALIDATED

Delivered:
- `project-state.json` as machine-readable current-state authority;
- generated `docs/PROJECT-STATE.md` and `PROJECT_HANDOFF.md`;
- recovery protocol, decisions, known failures and validation matrix;
- CI state/handoff drift detection and self-reporting project-state integrity.

Do not repeat the completed comprehensive system audit unless a material architecture, runtime-entry-point, stable-boundary or state-integrity change invalidates it.

## PM-02 — Validation State Indexing — VALIDATED

Delivered:
- deterministic `validation-index.json` from registry + persisted metadata + project state;
- generated `docs/VALIDATION-STATE.md`;
- CI validation-index integrity;
- fresh-session recovery that distinguishes current, stale, passing and failing evidence.

## INTEL-01 — Win-package intelligence — VALIDATED

Validated direction includes bounded Commander Spellbook discovery with honest incomplete-evidence semantics, legality/color/printing/budget filtering, full-table closure, swap-feasible package selection, atomic injection, package protection and final route recognition.

The exact-source positive control at `5829b37b686255ba35d419b37be17095e54fb696` remains green. BENCH-01 still determines whether that intelligence translates into better complete decks.

## INTEL-02 — Actual autonomous deck improvement — IMPLEMENTED / BENCHMARK VALIDATION PENDING

Implemented safeguards include role truth, structural floors, strategy/resource/component preservation, exact legality/budget/printing truth and iterative candidate comparison.

Durable evidence:
- Food and Fellowship, Necron Dynasties, Squirreled Away and Scions & Spellcraft have useful exact-source scenario evidence;
- Marvel focused/broad remain red for target achievement because their restricted pool reaches an expected Bracket-5 construction ceiling; this must not be relabelled as success or weakened away;
- provider-unavailable evidence remains provider-unknown, not evidence of card absence.

The current latest fully validated executable BENCH product source is `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`. It is experimental validation evidence, not stable promotion.

## BENCH-01 — Adversarial Commander benchmark suite — ACTIVE

Goal: measure complete Commander decision quality across contrasting archetypes and prove whether the specialist actually beats strong general-purpose AI.

Operating rules:
- freeze executable product source across each benchmark batch;
- run multiple contrasting/unseen fixtures before intelligence fixes where appropriate;
- score hard truth before subjective quality;
- distinguish harness/provider failure, expected construction ceiling, target movement, target achievement and formal validation;
- preserve locked historical baselines;
- convert only repeated generic failures into tested product repairs;
- never add card-name, deck-name or benchmark-specific hacks;
- never treat a green workflow as proof of whole-deck superiority.

### Batch A — COMPLETE — historical pre-repair verdict

- Counter Blitz / Tidus: specialist failed the natural compound theme request and left the deck unchanged; locked strong general-AI baseline materially improved the deck. **General-AI win.**
- Liliana NZ$500: specialist produced a legal strong deck within the NZ$500 whole-deck cap while the locked strong general-AI baseline exceeded budget substantially. **Specialist win.**

Aggregate historical verdict: **1–1, split-not-promotion-grade.** Later repairs must not rewrite this evidence.

### Batch B — COMPLETE — compound-theme defect reproduced and repaired

Cavalry Charge independently reproduced Counter Blitz's compound free-form theme rejection. That cross-fixture evidence justified one generic controlled parser repair.

Parser repair baseline: `ce4c9eba59617be2cf57718408b40252230bccf4`.

Paired replay then exposed a second generic defect: aggregate OR-style theme satisfaction could improve while explicit requested components regressed. Counter lost proliferate density and Cavalry lost typal/combat density.

Generic component-preservation implementation: `d0e40cadee555468b9b5574234d1b63b477f8b55`.
Validated combined source: `dd085caf4e47f6f5e1976667dc90de2db46c00a1`.

Post-repair paired replay preserved explicit components and closed the component-compensation correctness blocker. Counter's dense-countermagic target remained a watch item only; later unseen batches did not reproduce the zero-target-progress allocation pattern.

### Batch C — COMPLETE — vocabulary boundary found, repaired and replay-accepted

Unseen Witherbloom Witchcraft and Urza's Iron Alliance exposed `lifegain` and `card draw` as missing controlled neutral-theme vocabulary, while Necron Dynasties provided a supported-vocabulary control. Source inspection proved both missing concepts already mapped to reusable measurable role semantics.

Generic taxonomy bridge product commit: `387709983880fa2fd10c7f0aa50cd8b1524852f5`.
Latest fully validated source-equivalent executable baseline: `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`.

Corrected-provenance replay accepted the bridge:
- Witherbloom: 12 swaps, Bracket 2 → 3, requested components preserved and lifegain/recursion improved;
- Urza: 6 swaps, Bracket 2 → 2, identity floors preserved before later package exhaustion;
- Necron: 2 swaps, Bracket 2 → 2, identity floors preserved before later package exhaustion;
- no fixture reproduced `zeroTargetProgressWhileFailedGatesRemain`.

Verdict: vocabulary bridge accepted; no allocation repair or guard weakening authorized from Batch C.

### Batch D — COMPLETE — raw evidence reconciled

Frozen executable product source: `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`.
Persisted evidence head: `ffcadb3c6d49e3acecbd2f626e14416bdf4dd7a9`.
Authoritative raw artifact: `test-results/bench01-batch-d/result.json`.
Detailed reconciled interpretation: `docs/BENCH-01-BATCH-D-2026-09-06.md`.

Authoritative results:
- **Quick Draw**: 8 swaps, Bracket 3 → 3; meaningful structural improvement, then target-advancement stop.
- **Virtue and Valor**: 4 swaps, Bracket 2 → 2; terminal competing packages would regress required compound-theme components.
- **Explorers of the Deep**: 4 swaps, Bracket 2 → 2; same terminal component-veto class.
- None reproduced the earlier Counter zero-target-progress pattern.

The downstream compound-component guard is doing necessary correctness work and remains locked.

### Batch D candidate-breadth diagnostic — COMPLETE / PERSISTENCE VERIFICATION ACTIVE

Detailed interpretation: `docs/BENCH-01-BATCH-D-CANDIDATE-BREADTH-2026-09-06.md`.

The diagnostic kept executable source frozen at `e17b0a1c...` and changed only `candidatePackagesPerRound` from the Batch D value 4 to the currently supported maximum 6.

Actions run `34019315945` passed the frozen-source guard, repository tests, build and diagnostic execution. Its uploaded raw artifact records:
- **Quick Draw**: unchanged at 8 swaps, Bracket 3;
- **Virtue and Valor**: unchanged at 4 swaps, Bracket 2;
- **Explorers of the Deep**: **9 swaps, Bracket 3**, versus 4 swaps/Bracket 2 at breadth 4.

Explorers therefore proves a real bounded package-diversification sensitivity: broader supported search surfaced additional component-preserving accepted paths and produced +5 swaps / +1 assessed bracket. Virtue provides the counterexample—the same breadth increase did not change its ceiling—and Quick Draw is an unchanged control.

This is **one positive fixture, not a repeated unrelated-fixture defect**. It does not authorize a Commander product change yet. `candidateCompoundThemeComponentGateV15()` must not be weakened; the terminal rejected packages still include genuine requested-component regressions.

The first diagnostic persistence attempt committed empty raw result/log copies because checkout reset occurred before runtime output was copied. The full uploaded Actions artifact remains intact. Workflow commit `18f47aec4d3a1109cb26a88d51960dd5100b0ac9` stages runtime evidence outside the checkout before reset and is being rerun to verify durable non-empty persistence. This is a harness/provenance correction only, not product validation movement.

### Current BENCH-01 gate

Freeze `e17b0a1c...` as the latest fully validated executable product source.

After corrected persistence is verified, broaden the diagnostic across unchanged source with at least:
1. another unseen component-rich typal/theme fixture; and
2. an unrelated non-typal compound-theme fixture.

Compare normal package breadth 4 with supported breadth 6 while keeping all other fixture inputs and executable product source unchanged.

Required evidence before another Commander product edit:
- reproduce breadth-sensitive missed opportunities in multiple unrelated families;
- retain exact legality, budget, strategy and every requested component floor;
- distinguish extra target movement from actual target achievement;
- if the pattern repeats, justify one generic candidate-discovery/ranking repair and validate it with focused regressions, full suite/build, then exact-source benchmark replay;
- if it does not repeat, classify Explorers as an isolated bounded-search sensitivity, Virtue as a supported-breadth construction ceiling, and continue broader BENCH coverage without changing product intelligence.

Remaining benchmark coverage should continue across compact unrestricted combo, hybrid combat-combo, commander-damage/combat, control, aristocrats, budget and unusual-partner families. Complete expert comparison against strong locked general-AI baselines remains necessary before promotion.

## INTEL-03 — Human-level strategic reasoning layer — PLANNED

Goal: strengthen commander role, synergy-network, structural-card importance, cut consequence, primary/secondary plan and coherent-package reasoning after BENCH-01 demonstrates where those capabilities are genuinely needed.

Do not start speculative INTEL-03 feature work while BENCH-01 has a narrower evidenced gate.

## INTEL-04 — Counterfactual deck comparison & expert explanation — PLANNED

Goal: compare complete legal 100-card alternatives and explain why one deck state is better under the exact constraints. This remains downstream of current BENCH evidence gathering.

## Promotion boundary

PR #29 and stable/current V0.13 remain unchanged while BENCH-01 is not promotion-grade. Standing authorization permits autonomous merge/promotion only after the candidate is fully validated, non-redundant, safe, blocker-free and supported by broad benchmark evidence demonstrating real forward quality rather than mere workflow success.
