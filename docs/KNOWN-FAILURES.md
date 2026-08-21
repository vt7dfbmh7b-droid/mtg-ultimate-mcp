# Ultimate MTG Known Failure Catalogue

This catalogue records observed failure modes that must remain covered by regression tests or validation controls. A fixed failure is not deleted; mark it prevented and link the protection mechanism.

## KF-001 — Cosmetic tutor improvement beats missing win route

Observed: Marvel Bracket-5 refinement accepted `Aurelia, the Warleader` OUT → `The Masters of Evil` IN because tutors rose 8→9, while verified winning combos remained 0 and the actual tutor gate was already passing.

Risk: optimizer improves an aspirational role count rather than the requested target.

Protection: target-gate scoring; tutor growth above the real gate receives zero target credit. Zero-target-progress hard guard remains the final pending refinement before INTEL-02 validation resumes.

Status: partially prevented / final live proof pending.

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

Status: process rule accepted; PM-01 will make this visible in validation state.

## KF-009 — Skipped/stale result mistaken for current validation

Observed: `refine-run-metadata.txt` remained on old `source_sha=a4a1450...` / `control_outcome=skipped` while newer source existed.

Risk: false green status from stale artifacts.

Protection: project state separates development checkpoint from validated SHA and explicitly records stale validation outputs. Future CI state update must bind result SHA to tested source lineage.

Status: PM-01 in progress.

## KF-010 — Pipeline success mistaken for autonomous quality

Observed: legal execution and successful result persistence were previously treated too generously even when the deck stayed at 0 verified wins and failed the same target gates.

Risk: engineering green masks intelligence failure.

Protection: validation matrix must distinguish execution controls from intelligence outcome controls.

Status: process protection in PM-01; adversarial BENCH-01 planned.

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

## Adding a failure

Every new material failure should record:
- exact observed behavior;
- why it matters;
- the protection mechanism;
- regression/control path;
- status (`open`, `partially prevented`, `prevented`, `accepted limitation`).
