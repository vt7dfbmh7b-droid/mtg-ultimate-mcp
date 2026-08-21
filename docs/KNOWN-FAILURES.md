# Ultimate MTG Known Failure Catalogue

This catalogue records observed failure modes that must remain covered by regression tests or validation controls. A fixed failure is not deleted; mark it prevented and link the protection mechanism.

## KF-001 — Cosmetic tutor improvement beats missing win route

Observed: Marvel Bracket-5 refinement accepted `Aurelia, the Warleader` OUT → `The Masters of Evil` IN because tutors rose 8→9, while verified winning combos remained 0 and the actual tutor gate was already passing.

Risk: optimizer improves an aspirational role count rather than the requested target.

Protection: target-gate scoring plus explicit V0.11/V0.12 eligibility rejection while known Bracket-5 construction gates remain failed. Tutor growth above the real gate receives zero target credit and cannot be accepted through simulation score or a permissive score threshold.

Status: prevented in source and live-proven at `e11826c...`; the old Aurelia → The Masters of Evil candidate scored positively but was rejected with `package-does-not-repair-or-advance-failed-bracket-5-target-gate`. The next source checkpoint `758c565...` also generated and accepted a package for the actually failed curve gate instead of retrying cosmetic tutor growth.

## KF-002 — Hidden caller overrides package-card ceiling

Observed: general win-package discovery default was raised to four cards, but `deck-builder-v07.ts` still called it with `maxPackageCards: 3`.

Risk: live system silently behaves differently from the advertised policy.

Protection: autonomous caller uses four; static regression `deck-builder-win-package-ceiling-v15.test.ts`.

Status: prevented.

## KF-003 — First Spellbook page mistaken for complete search

Observed: discovery searched only the first popularity-ranked page, so an eligible constrained package beyond the first page could appear absent.

Risk: false no-package conclusion under printing-family restrictions.

Protection: bounded pagination with total/pages/exhausted/truncated/source-completeness audit. Truncation becomes verification-unavailable, not absence.

Status: prevented within bounded discovery contract.

## KF-004 — Generic infinite damage accepted as multiplayer win

Observed: package verification used a weaker closure rule than final Commander evaluation.

Risk: planner injects a supposed win package that final evaluation still counts as zero verified wins.

Protection: discovery aligned to authoritative full-table closure; unscoped infinite damage and single-target loss are not sufficient.

Status: prevented; live constrained proof pending.

## KF-005 — Ineligible popular packages consume candidate cap

Observed: globally popular but printing-ineligible packages could consume the candidate cap before physical eligibility filtering.

Risk: legal constrained packages never get evaluated.

Protection: candidate cap counts eligible verified packages after constraint checks; restricted physical-pool prefilter reduces wasted exact-printing work.

Status: prevented.

## KF-006 — Preferred R package is not injectable

Observed design risk: Bracket-5 selection could prefer the first R-tagged package regardless of how many missing cards the current swap package could fit.

Risk: a non-injectable competitive package hides a smaller verified route.

Protection: swap-feasible target-aware package selection; R preference applies among feasible candidates.

Status: prevented in source; broad live proof pending.

## KF-007 — Existing combo piece cut during package injection

Observed design risk: A+B+C package where A is already in the deck could add B+C while the normal cut engine removes A.

Risk: provenance says package injected but final deck does not contain the package.

Protection: already-present selected-package pieces are protected from cuts; final atomic-fit guard remains authoritative.

Status: prevented in source; broad live proof pending.

## KF-008 — Workflow commits source before live test and cancels itself

Observed: a self-editing workflow committed a source fix while `cancel-in-progress: true`; that push cancelled the current run and `[skip ci]` prevented a replacement run.

Risk: metadata suggests validation activity but the live control never executed.

Protection: permanent controls should validate checked-in source only. One-shot integration workflows must be isolated from read-only live controls.

Status: original one-shot source-editing workflow removed; permanent focused control now validates checked-in source. See KF-013 for the remaining concurrent evidence-writer race.

## KF-009 — Skipped/stale result mistaken for current validation

Observed: `refine-run-metadata.txt` remained on old `source_sha=a4a1450...` / `control_outcome=skipped` while newer source existed.

Risk: false green status from stale artifacts.

Protection: project state separates development checkpoint from validated SHA and explicitly records stale validation outputs. Future CI state update must bind result SHA to tested source lineage.

Status: prevented by validated PM-01/PM-02 state and validation indexing; current `e11826c...` failure is explicitly recorded as current rather than green.

## KF-010 — Pipeline success mistaken for autonomous quality

Observed: legal execution and successful result persistence were previously treated too generously even when the deck stayed at 0 verified wins and failed the same target gates.

Risk: engineering green masks intelligence failure.

Protection: validation matrix must distinguish execution controls from intelligence outcome controls.

Status: process protection live-proven at `e11826c...`: execution succeeded but scenario intelligence correctly failed because the deck did not change; adversarial BENCH-01 remains planned.

## KF-011 — Universal tutor double-counts mutually missing combo pieces

Permanent probability regression: one physical universal A/B tutor cannot simultaneously occupy both missing A and missing B roles in one draw state.

Risk: inflated route-access probabilities.

Protection: overlap-aware physical-card assignment and exact probability regression.

Status: prevented.

## KF-012 — Optimization destroys meaningful secondary route

Known product risk: pushing combo/tutor density can erase combat, commander-damage or other intended routes.

Risk: numerically stronger-looking list no longer matches the deck's strategic identity.

Protection: route protection, strategy-aware cuts, hybrid/multi-route design decision D-013; adversarial benchmark coverage required.

Status: partially prevented / BENCH-01 required.

## KF-013 — Concurrent live controls race to persist evidence

Observed: changing the Marvel refinement script triggered both the focused refinement control and the broader permanent-family control from the same source SHA. The focused control pushed its scoped result first; the broader control completed successfully but its result commit was rejected as non-fast-forward. The race recurred at `758c565...` in the opposite order: a printing-family proof advanced the branch first, while both successful Marvel controls uploaded valid artifacts but had their result pushes rejected.

Risk: valid evidence can remain only in workflow logs/artifacts, while the branch records whichever writer won rather than every completed control.

Protection: active INTEL-02 writers now share one non-cancelling branch-scoped concurrency group, sync the latest branch before copying their isolated result paths, and keep intelligence execution independent from persistence. The project-state writer also regenerates metadata after synchronizing so it cannot commit stale self-references. Legacy evidence writers still require migration or a consolidated writer before this is globally closed.

Status: active-path fix implemented locally after the race reproduced at `7fcd3ca...`; workflow revalidation pending. The `758c565...` refinement artifact was digest-verified and recovered on top of the winning writer, while legacy concurrent writers remain an open project-management issue.

## KF-014 — Failed target gate omitted from candidate generation

Observed: the `e11826c...` Marvel deck failed average nonland mana value and verified-winning-combo gates, but V0.7 candidate generation followed aspirational role counts and produced a tutor-only survivor even though the real tutor gate already passed.

Risk: the evaluator and zero-progress guard can diagnose and reject bad changes correctly while the optimizer remains unable to generate any package that addresses the real blocker.

Protection: Bracket-5 candidate generation now places authoritative failed target gates before aspirational deficits. The average-nonland-mv lane requires positive mana-value reduction, preserves lower-bracket behavior, and records its priority plus win-package discovery outcome in every attempted swap size. Deterministic protection lives in `upgrade-target-priority-v15.test.ts` and `optimizer-v12-attempt-provenance.test.ts`.

Status: prevented for the observed curve-generation path and live-proven at `758c565...`: two swaps repaired average nonland mana value from 2.71 to 2.54. Other gate types and archetypes still require broader controls.

## KF-015 — Curve repair cuts a strongly protected commander-strategy card

Observed: the `758c565...` Marvel refinement repaired average nonland mana value by cutting Aurelia, the Warleader for Reanimate. The pairing sorter maximized mana-value reduction before structural preservation and cut pressure, so Aurelia's fully protected `combat-tokens` affinity and extra-combat/untap/haste roles could not prevent the cut.

Risk: an autonomous package can pass a numeric target gate while weakening the commander's primary or secondary plan, turning a cosmetic metric repair into a strategically worse whole deck.

Protection: additions and cuts now retain the existing V0.15 per-strategy affinity evidence. Pairing places meaningful strategy preservation and structural-deficit preservation before the size of a curve reduction. Every candidate package carries per-swap lost-role evidence plus an aggregate strategy audit, and refinement fails closed when that audit is missing or reports an uncompensated loss from a card that received the maximum existing cut-protection signal. Deterministic protection lives in `upgrade-target-priority-v15.test.ts` and includes a Najeela/Aurelia-style ordering regression, explicit rejection, missing-evidence rejection, and a compensated-replacement control.

Status: prevented in deterministic source tests; fresh Marvel live revalidation remains required before claiming the observed scenario is strategically improved.

## KF-016 — Weak secondary commander signal blocks every safe target repair

Observed: the first `7fcd3ca...` Marvel revalidation correctly rejected cuts to Aurelia's strong `combat-tokens` plan, but it also treated Najeela's four-point `big-mana` inference as a meaningful deck identity. That made Vanquish the Horde's generic cost-reduction overlap look equally protected, left all 25 bounded candidates ineligible, and stopped with zero accepted rounds even though a safer curve cut existed.

Risk: fail-closed strategy protection can become overbroad and paralyse autonomous improvement, protecting a weak incidental overlap as strongly as the commander's substantive plan.

Protection: meaningful-loss gating now requires both at least four net affinity points removed and at least six points of command-zone evidence for that strategy. Pairing still protects Aurelia's strong combat affinity, while an exact weak-secondary-signal regression proves the safer Vanquish curve cut remains eligible and carries complete preservation evidence.

Status: prevented in deterministic source tests; fresh Marvel live revalidation required.

## Adding a failure

Every new material failure should record:
- exact observed behavior;
- why it matters;
- the protection mechanism;
- regression/control path;
- status (`open`, `partially prevented`, `prevented`, `accepted limitation`).
