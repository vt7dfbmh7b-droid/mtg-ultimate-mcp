# Ultimate MTG Architecture Decisions
## D-020 — Restricted printing-family exhaustion is an honest construction ceiling

Status: accepted.

When a restricted physical-printing pool is exhaustively enumerated within declared safety ceilings and every failed authoritative role gate has no candidate beyond existing or excluded cards, widening candidate ranking cannot create a valid repair. The system must retain the requested target, report the measured lower bracket and exact failed gates, and return no change with the pool evidence. It must not lower thresholds, invent route/evidence, or add benchmark/card-name exceptions. Re-run when the provider or policy ceilings change.

Reason: the Marvel restricted pool contains broad curve candidates but no new fast-mana or tutor role candidates beyond the cards already in the deck or excluded. The current zero-swap result is therefore a truthful constrained construction ceiling, not a recall defect.

This is a durable decision log. Record decisions that future chats or contributors must not casually rediscover or reverse. Add new entries; do not silently rewrite history.

## D-001 — GitHub repository state outranks chat memory

Status: accepted.

`project-state.json` is the machine-readable current-state authority. Generated handoff/state documents provide human recovery. Chat history may help explain context but must not override the repository.

Reason: conversation windows are temporary and hand-written handoffs become expensive and stale.

## D-002 — Stable and experimental state remain separate

Status: accepted.

Stable remains V0.13 until explicitly promoted. Experimental success, live controls, model evidence or benchmark wins cannot automatically update `main`, `src/server-current.ts`, package version or release state.

## D-003 — Pipeline success is not intelligence success

Status: accepted.

A workflow that builds/runs successfully proves execution, not that the resulting deck is better. Autonomous-intelligence claims require deck-level outcome evidence.

## D-004 — Hard Commander truths outrank optimization

Status: accepted.

Commander legality, exact card count, singleton, color identity, banned/legal facts, exact physical printing constraints, exclusions/must-includes, hard budgets and known rules truth are fail-closed boundaries.

## D-005 — Provider unavailable is not absence

Status: accepted.

Truncated, partial, failed or unavailable external evidence must remain unknown/partial. It may not be converted into proof that a card, combo, printing, tournament result or historical fact does not exist.

## D-006 — Full-table win closure is the authoritative Commander win definition

Status: accepted.

Generic `infinite damage`, `target opponent loses`, resource loops or unscoped lethal engines are not independently verified full-table Commander wins. Explicit all/each-opponent lethal/life-loss or explicit game-win closure is required unless another deterministic multiplayer closure is proven.

## D-007 — Discovery and final evaluation must share win semantics

Status: accepted.

The win-package planner may not call a package winning under a weaker rule than the final Commander evaluator. Candidate discovery must use the same multiplayer truth boundary.

## D-008 — Real target gates outrank aspirational role counts

Status: accepted.

If the actual Bracket-5 tutor requirement is already satisfied, adding more tutors receives no target-gate credit merely because an internal role target is higher. Failed real construction gates are the priority.

## D-009 — Measurable progress toward a failed gate is useful; cosmetic movement is not

Status: accepted.

A multi-round optimizer may accept progress that moves a currently failing gate toward its threshold even if one package does not cross it. Movement in an already-passing metric is not target progress.

## D-010 — Already-passing target gates are protected

Status: accepted.

A candidate that breaks an authoritative construction gate that was passing before is a regression and should normally be ineligible.

## D-011 — Win packages must be atomically feasible

Status: accepted.

A selected verified package must fit the current usable swap capacity. A preferred competitive/R package that cannot be injected may not hide a smaller verified package that can.

## D-012 — Existing pieces of a selected package are protected from cuts

Status: accepted.

If a verified package requires A+B+C and A is already present, autonomous refinement must not cut A while adding B+C and still claim the package was injected.

## D-013 — Preserve meaningful multi-route strategy

Status: accepted.

High-power optimization must not collapse a meaningful combat, commander-damage, aristocrats, control or alternate route solely to improve combo density, tutor density or a single score unless the requested objective explicitly demands that trade-off.

## D-014 — Whole-deck counterfactuals outrank isolated card grades

Status: direction accepted; implementation incomplete.

The long-term optimizer should compare legal 100-card deck states under the same constraints and evidence rather than treating cards as independently rankable upgrades.

## D-015 — The system must be able to recommend no change

Status: accepted.

If no supported legal change improves the requested target while preserving constraints and strategy, retaining the current deck is a successful autonomous decision.

## D-016 — Commander specialization is the product priority

Status: accepted.

Ultimate MTG should aim to outperform general-purpose AI specifically at Commander deck construction through specialization, structured verification and exhaustive comparison. Feature breadth is secondary to Commander expertise.

## D-017 — Project management is infrastructure, not documentation polish

Status: accepted.

The project-management layer must be machine-checkable: structured state, generated recovery documents, milestone IDs, durable decisions, validation mapping and known-failure regressions. New chats should resume from repo state, not rebuild it manually.

## D-018 — Strategic understanding plus machine verification is the superiority target

Status: accepted.

The intended advantage is not simply knowing more card names or producing a higher optimizer score. Ultimate MTG should combine the strategic understanding of a strong human Commander deck builder with machine-level consistency: whole-deck reasoning, commander and archetype understanding, structural-card and cut-consequence analysis, multiple real win routes, exact legality/printing/budget truth, probability, simulation, exhaustive candidate search and counterfactual comparison.

A claim that Ultimate MTG is better than general-purpose AI must be earned through comparative adversarial benchmarks using the same Commander problem, constraints and evidence. Single metrics, feature count, pipeline success or one favorable control are insufficient. If a strong general-purpose AI or knowledgeable Commander specialist can reliably make a better legal whole-deck decision from the same evidence, the product objective has not yet been met.

The detailed standing objective and proof standard live in `docs/COMMANDER-SPECIALIST-OBJECTIVE.md` and should be read during fresh-session recovery.


## D-019 — Caller-declared package floors are first-class refinement contracts

Status: accepted.

Refinement callers may declare structural strategy-fuel and low-volume package floors using generic semantic matchers rather than card-name exceptions. Valid floors are applied while constructing candidate IN/OUT packages and audited again after exact package resolution; malformed descriptors, unresolved cards or unmet minimum counts fail closed. An omitted contract preserves existing refinement behavior.

Reason: per-swap strategy preservation and aggregate affinity can both pass while a complete package loses the actual fuel or structural components a caller needs. The contract must be caller-owned, measurable, name-independent and visible in final evidence, while still allowing the caller to define different strategy components for different decks.
