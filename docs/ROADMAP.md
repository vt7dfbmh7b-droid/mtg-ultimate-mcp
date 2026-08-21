# Ultimate MTG Roadmap

This roadmap converts the north-star specification into bounded development milestones. `project-state.json` is authoritative for which milestone is active now.

## North star

Build the best evidence-backed autonomous Commander deck-building intelligence we can, then prove it deserves to be trusted.

The intended end state is a Commander specialist that can outperform a strong general-purpose AI on Commander deck construction through deeper domain focus, structured evidence, exhaustive checking, counterfactual comparison, and consistent verification.

## PM-01 — Persistent Project State & Handoff Automation — VALIDATED

Goal: stop treating chat history as project memory.

Delivered:
- `project-state.json` is the machine-readable current-state authority;
- `docs/PROJECT-STATE.md` and `PROJECT_HANDOFF.md` are generated from it;
- architecture decisions, known failures, roadmap and validation matrix are committed;
- CI detects state/handoff drift;
- a self-reporting integrity control binds project-management typecheck/state validation/source build to an exact source SHA.

Initial validated control:
- `test-results/project-management/integrity.txt`
- source `73366cf57c055fc0ae7831209ad155b360bf036f`
- project-management typecheck: success
- state validation: success
- normal source build: success

## PM-02 — Validation State Indexing — VALIDATED

Goal: stop making fresh chats hunt through individual result directories to determine what is current, stale, passing or failing.

Delivered:
- `validation-registry.json` registers high-value controls needed for recovery and milestone claims;
- `validation-index.json` is deterministically generated from registry + persisted metadata + project state;
- `docs/VALIDATION-STATE.md` is the generated human snapshot;
- index records bind tested source SHA, pass/fail/unknown state, claim level and checkpoint match;
- CI fails on a stale validation index;
- the self-reporting PM integrity control regenerates the index whenever it updates its own persisted result;
- `npm run project:resume` derives a fresh-session recovery brief without old chat history or individual result-folder inspection.

Validated PM-02 control:
- tested source `b920087e41d22a1575404620815c4882801cae9b`;
- management tooling typecheck: success;
- generated project-state validation: success;
- consolidated validation-index validation: success;
- fresh-session recovery smoke: success;
- normal MTG source build: success;
- validation index regenerated self-consistently and shows no unmet PM pass conditions.

## INTEL-01 — Win-package intelligence — IMPLEMENTED / VALIDATION PENDING

Goal: very-good verified win-package reasoning.

Implemented direction includes:
- bounded but deep Commander Spellbook discovery with honest incomplete-evidence semantics;
- exact commander legality/color/printing/budget filtering;
- multiplayer full-table closure aligned with final evaluation semantics;
- package feasibility against swap capacity;
- atomic package injection;
- protection of already-present package pieces;
- R/competitive preference among feasible verified packages;
- no false absence when discovery is truncated or unavailable.

Exit evidence must include fresh constrained and unrestricted controls, not Marvel alone.

## INTEL-02 — Actual autonomous deck improvement — ACTIVE

Goal: improve the deck that exists, not an abstract score.

Required capabilities:
- diagnose actual failed target gates;
- distinguish hard target requirements from aspirational role counts;
- prioritize first verified win route and other real blockers over cosmetic density;
- allow measurable multi-round progress toward failed gates;
- reject regressions of already-passing gates;
- reject zero-target-progress changes while known target construction failures remain;
- preserve meaningful primary/secondary strategy;
- choose coherent IN→OUT pairings and know when no change is better.

Immediate resumed work is deliberately narrow: finish the hard zero-target-progress guard and run the fresh checked-in-source Marvel Bracket-5 control before adding unrelated intelligence features.

## BENCH-01 — Adversarial Commander benchmark suite — PLANNED

Goal: measure intelligence rather than anecdotes.

Benchmark families:
- combat/commander-damage;
- compact combo;
- hybrid combat-combo;
- aristocrats;
- control;
- typal/tribal;
- graveyard/reanimator;
- counters;
- spellslinger;
- equipment;
- budget constrained;
- exact printing-family/theme constrained;
- unusual partner pairs;
- high Bracket 4;
- Bracket 5 / cEDH-ish construction.

Scored dimensions should include legality, constraint truth, target-gate movement, win-route correctness, strategy preservation, cut quality, probability/simulation improvement, spend efficiency, explanation quality and expert review.

## INTEL-03 — Human-level strategic reasoning layer — PLANNED

Goal: represent why cards and packages matter to this deck.

Planned concepts:
- commander role and dependency graph;
- primary, secondary and fallback game plans;
- synergy clusters and shared-core cards;
- structural-card importance / cut blast radius;
- setup cost, interruption exposure and recovery;
- dead-piece risk and card-role reuse;
- package overlap and redundancy;
- meta-sensitive interaction needs;
- deck identity / theme preservation.

## INTEL-04 — Counterfactual deck comparison & expert explanation — PLANNED

Goal: compare whole legal deck states, not isolated card grades.

Expected behavior:
- original deck vs candidate A/B/C under identical seeds/evidence;
- explicit hard-gate deltas;
- route-access and resilience deltas;
- mana/curve/interaction effects;
- price and printing truth;
- strategy trade-offs;
- smallest coherent improvement preference;
- expert-quality explanation of both accepted and rejected swaps.

## Later phases

Potential later work is intentionally subordinate to demonstrated Commander intelligence:
- richer tournament/meta learning;
- historical model evidence;
- personalized pilot preferences;
- additional formats;
- UI polish and convenience features.

Do not add breadth merely because it is possible. New work should either improve Commander expertise, verification, autonomous decision quality, or the evidence used to prove those qualities.
