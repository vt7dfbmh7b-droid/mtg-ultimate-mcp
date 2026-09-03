# Restricted Marvel Candidate-Pool Audit — 2026-09-03

## Decision

No candidate-pool expansion or construction exception is justified by the current Marvel Bracket-5 evidence. The exact-source focused and broad controls both used the same bounded restricted policy pool and both ended with zero swaps after complete, fail-closed package evaluation. The result is an eligible-pool saturation/no-safe-package condition, not evidence of a recall hole.

The restricted path remains generic and policy-driven. It must not add a Marvel-specific query, card-name exception, scenario branch, or construction-time injection to make the benchmark green.

## Evidence

The persisted exact-source provenance reports:

| Evidence | Observed value | Interpretation |
|---|---:|---|
| Eligible restricted policy pool | 1,176 cards | Bounded Scryfall `allowedSets`/policy discovery completed and deduplicated by Oracle identity with a cheapest eligible printing witness. |
| Average-nonland-MV role matches before exclusions | 355 | The pool contains broad curve candidates; the lane is not empty because of a general discovery failure. |
| Ramp/fast-mana role matches before exclusions | 2 | Both authoritative role matches were already present or excluded in the existing deck. |
| Tutor role matches before exclusions | 2 | Both authoritative role matches were already present or excluded in the existing deck. |
| Protection role matches before exclusions | 23 | The policy pool has available protection candidates, but no package survived the whole-deck safety audit. |
| Candidate package attempts | 5 per bounded attempt | Each generated package was evaluated rather than silently discarded. |
| Candidate packages eligible | 0 | No package met exact card count, structural floors, compound component preservation, strategy preservation, and target-improvement requirements. |
| Final focused/broad swaps | 0 / 0 | `no-supported-improvement` was reported honestly; the deck was not changed. |

The focused and broad persisted results are the authoritative source artifacts:

- `test-results/marvel-bracket5/refine-result.json`
- `test-results/marvel-bracket5-broad/refine-result.json`

Both retain `candidateDiscovery.mode=exhaustive-bounded-printing-policy`, `eligiblePoolCards=1176`, `candidateAvailability=all-role-cards-already-present-or-excluded` for ramp/tutor lanes, complete printing and hard-truth checks, and zero accepted swaps.

## Audit of the candidate path

1. Restricted discovery enumerates the declared set/policy universe under explicit safety ceilings (`maxCards=2000`, `maxPages=50`) and keeps an exact eligible-printing witness for each retained Oracle card.
2. Restricted upgrade and build paths consume that same pool; they do not fall back to a role query that could bypass the policy.
3. Existing-card exclusions are applied only after role truth is computed, so the provenance distinguishes role availability from the fact that a card is already present or excluded.
4. Package generation is bounded and every candidate is tested against whole-deck structural, strategy, component-family, persistent colored-mana, target-gate, and printing constraints.
5. A completed zero-swap result is therefore a truthful refusal to spend a safe change, not a reason to widen the policy or manufacture a swap.

## Severity and follow-up

| Severity | Finding | Impact | Follow-up |
|---|---|---|---|
| Informational | Restricted role pool is saturated for the current authoritative ramp/tutor lanes. | No safe Marvel package currently exists within the declared physical policy and existing-deck exclusions. | Keep the control red and preserve the provenance; do not alter source policy. |
| Medium | The bounded Spellbook window remains an explicit ceiling. | A future provider result outside the completed window could add evidence, but current controls do not claim global package absence beyond that ceiling. | Re-run the exact-source control when provider pagination or policy inputs change; treat partial/unavailable results as unknown. |
| Low | Broader positive package integration is not covered by the Marvel-only negative benchmark. | INTEL-01 now has a separate positive full-table control, but the finished deck retained one verified route even though discovery found six independent library routes. | Preserve the exact-source pass (`33811643472`, `50e5d19...`) and track alternate-route retention as a separate, non-gating resilience follow-up. |

## Exit criteria

This audit is complete when the source remains generic, the exact-source Marvel controls preserve the zero-swap fail-closed outcome, and the separate INTEL-01 positive live control independently proves package discovery, strict full-table closure, exact affordable printings, atomic injection, final recognition, and route audits. That control passed at `50e5d19...` (workflow run `33811643472`); its evidence also records a one-route finished deck, so no alternate-route resilience claim is made. The Marvel result does not by itself validate INTEL-01 or INTEL-02 broadly.
