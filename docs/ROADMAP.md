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

### Batch D — COMPLETE — repeated preservation-veto exhaustion requires diagnostics, not guard relaxation

Frozen executable product source: `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`.
Persisted evidence head: `ffcadb3c6d49e3acecbd2f626e14416bdf4dd7a9`.
Detailed interpretation: `docs/BENCH-01-BATCH-D-2026-09-06.md`.

Unseen results:
- **Quick Draw**: 12 swaps, Bracket 2 → 3; draw 8 → 12, countermagic 6 → 10, board wipes 0 → 3, cheap interaction 9 → 13; later candidates exhausted on component-preservation vetoes.
- **Virtue and Valor**: 8 swaps, Bracket 2 → 2; modest structural movement, then every attempted package size exhausted on component-preservation vetoes.
- **Explorers of the Deep**: 4 swaps, Bracket 2 → 2; interaction/ramp movement, then every attempted package size exhausted on component-preservation vetoes.
- None reproduced the earlier Counter zero-target-progress pattern.

The downstream compound-component guard is still doing necessary correctness work: rejected packages include cuts from requested identity material for largely off-theme structural additions. Do **not** weaken `candidateCompoundThemeComponentGateV15()`.

Source review shows candidate plans are generated through bounded role-plus-strategy search and only afterward checked by the component-preservation gate. The repeated Batch D terminal pattern therefore creates a narrower diagnostic question:

1. Are there no legal/budget/strategy-compatible candidates that repair the structural deficit while preserving the requested component? If so, this is an expected bounded construction ceiling.
2. Or do compatible candidates exist inside the relevant search universe but bounded discovery/ranking systematically omits them? If so, repeated cross-fixture evidence may justify one generic theme-aware candidate-discovery/ranking repair.

### Current BENCH-01 gate

Freeze `e17b0a1c...` as the latest fully validated executable product source and perform candidate-discovery diagnostics on the terminal Virtue and Valor and Explorers of the Deep rounds, using Quick Draw as a control.

Required evidence before another Commander product edit:
- identify the specific requested component threatened by terminal rejected packages;
- establish whether policy-compliant alternatives for the same structural role exist before final ranking/exclusion;
- show the same inappropriate omission/ranking pattern in multiple unrelated fixtures before implementing a generic repair;
- otherwise classify the result as an expected bounded construction ceiling and broaden unseen fixtures without changing product intelligence.

Remaining benchmark coverage should continue across compact unrestricted combo, hybrid combat-combo, commander-damage/combat, control, aristocrats, budget and unusual-partner families. Complete expert comparison against strong locked general-AI baselines remains necessary before promotion.

## INTEL-03 — Human-level strategic reasoning layer — PLANNED

Goal: strengthen commander role, synergy-network, structural-card importance, cut consequence, primary/secondary plan and coherent-package reasoning after BENCH-01 demonstrates where those capabilities are genuinely needed.

Do not start speculative INTEL-03 feature work while BENCH-01 has a narrower evidenced gate.

## INTEL-04 — Counterfactual deck comparison & expert explanation — PLANNED

Goal: compare complete legal 100-card alternatives and explain why one deck state is better under the exact constraints. This remains downstream of current BENCH evidence gathering.

## Promotion boundary

PR #29 and stable/current V0.13 remain unchanged while BENCH-01 is not promotion-grade. Standing authorization permits autonomous merge/promotion only after the candidate is fully validated, non-redundant, safe, blocker-free and supported by broad benchmark evidence demonstrating real forward quality rather than mere workflow success.
