# BENCH-01 candidate-discovery diagnosis — 2026-09-06

## Scope

This diagnosis follows the frozen-source breadth experiments. No Commander product intelligence is changed by this document. The latest fully validated executable product remains `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`.

## Repeated evidence

Two unrelated fixtures improve when only `candidatePackagesPerRound` changes from 4 to 6:

- Explorers of the Deep: 4 swaps / Bracket 2 → 9 swaps / Bracket 3.
- Animated Army: 9 swaps / Bracket 2 → 12 swaps / Bracket 3.

Three controls do not change under the same breadth comparison:

- Quick Draw: 8 swaps / Bracket 3.
- Virtue and Valor: 4 swaps / Bracket 2.
- Elven Empire: 8 swaps / Bracket 2.

This satisfies the BENCH-01 cross-fixture threshold for a generic bounded candidate-discovery/ranking defect signal.

## Source-level mechanism

At frozen source `e17b0a1c...`, `refineCommanderDeckIterativelyV12()` clamps `candidatePackagesPerRound` to 1–6 and, for each attempt size, executes exactly that many sequential candidate builds.

The candidates are **not** drawn from one precomputed pool and then merely truncated/ranked. Instead each candidate calls `evaluateCandidate()` again with an accumulated `diversityBlocked` set. After every generated plan, `diversifyNextPackage()` adds roughly half of that plan's incoming cards to the blocked set so the next planner invocation is forced down a materially different path. Rejected meaningful-strategy-loss and package-acceptance cuts also add outgoing cards to a separate blocked set.

Consequently, candidate #5 or #6 is a search state that does not exist at breadth 4. A breadth-4 run stops the diversification chain after four planner invocations even when further bounded diversification could expose a legal, strategy-preserving, component-preserving package. This is consistent with Explorers and Animated Army improving only at breadth 6.

The downstream `candidateCompoundThemeComponentGateV15()` remains a correctness boundary after the plan is built. The experiments do not justify weakening it, legality, budget, printing, package acceptance, strategy retention, target-progress or simulation gates.

## Repair direction

The evidence does **not** justify changing the default/global fixed breadth from 4 to 6 as the product repair. That would encode the benchmark symptom as a magic number and still leaves the same failure mode at the new boundary.

The generic repair candidate is **adaptive bounded diversification**: continue generating materially distinct candidate packages while the current attempt remains unresolved and the diversification chain is still producing novel search states, subject to a strict maximum work budget. Stop when a winner is found under existing acceptance rules, the planner no longer yields a materially new package/signature, or the bounded work budget is exhausted.

Before implementation, add focused regression coverage for the control flow itself so the repair is not tied to any deck/card names. Required properties:

1. an unresolved attempt may continue beyond an initial soft breadth when diversification is still novel;
2. duplicate/no-new-package states terminate rather than looping;
3. the hard work ceiling remains bounded;
4. existing winner selection and every downstream truth/correctness gate remain unchanged;
5. candidate-attempt provenance reports the adaptive search honestly.

Then validate the exact repair SHA with focused tests, full repository CI/build/state integrity, and replay Explorers + Animated Army plus unchanged controls from one frozen validated source. Performance/runtime cost must be recorded alongside quality movement.

## Verdict

A generic product repair is now justified at the **candidate-diversification control-flow layer**, but the accepted repair must be adaptive and bounded rather than a benchmark-specific breadth increase. No repair is accepted until its exact SHA completes formal validation and frozen-source replay.