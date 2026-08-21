# Ultimate MTG Roadmap

This roadmap converts the north-star specification into bounded development milestones. `project-state.json` is authoritative for which milestone is active now.

## North star

Build the best evidence-backed autonomous Commander deck-building intelligence we can, then prove it deserves to be trusted.

The intended end state is a Commander specialist that can outperform a strong general-purpose AI on Commander deck construction through deeper domain focus, structured evidence, exhaustive checking, counterfactual comparison, and consistent verification.

## PM-01 — Persistent Project State & Handoff Automation — ACTIVE

Goal: stop treating chat history as project memory.

Exit criteria:
- `project-state.json` is the machine-readable current-state authority;
- `docs/PROJECT-STATE.md` and `PROJECT_HANDOFF.md` are generated from it;
- architecture decisions, known failures, roadmap and validation matrix are committed;
- CI detects state/handoff drift;
- a fresh chat can recover active branch, stable boundary, validated baseline, active milestone, blockers and next actions without reconstructing history manually.

## INTEL-01 — Win-package intelligence — PAUSED / VALIDATION PENDING

Goal: very-good verified win-package reasoning.

Required capabilities:
- bounded but deep Commander Spellbook discovery with honest incomplete-evidence semantics;
- exact commander legality/color/printing/budget filtering;
- multiplayer full-table closure identical to final evaluation semantics;
- package feasibility against available swap capacity;
- atomic package injection;
- protection of already-present package pieces;
- R/competitive preference only among feasible verified packages;
- no false absence when discovery is truncated or unavailable.

Exit evidence must include multiple constrained and unrestricted controls, not Marvel alone.

## INTEL-02 — Actual autonomous deck improvement — PAUSED / VALIDATION PENDING

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
