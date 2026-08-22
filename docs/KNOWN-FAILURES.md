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

Protection: active INTEL-02 writers keep isolated result paths and use bounded fetch/reset/recompute/push retries against the latest branch head. Intelligence execution remains independent from persistence, and the project-state writer regenerates metadata on every retry so it cannot commit stale self-references. Legacy evidence writers still require migration or a consolidated writer before this is globally closed.

Status: active INTEL-02 paths live-validated together at `3cfca39...`: focused Marvel, broad Marvel, Middle-earth and project-state integrity all executed independently and persisted exact-source evidence. Legacy concurrent writers remain an open project-management issue.

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

## KF-017 — Shared concurrency group cancels older pending controls

Observed: `b6657a0...` placed the focused Marvel, broad Marvel, Middle-earth, and project-state writers in one branch-scoped concurrency group with `cancel-in-progress: false`. GitHub still retained only one pending run in that group: while project-state integrity ran, the two Marvel controls were cancelled as later pending controls arrived, leaving Middle-earth as the sole queued run.

Risk: a workflow design intended to serialize evidence can silently skip entire intelligence scenarios, so a green surviving control says nothing about the cancelled controls.

Protection: each active control now has its own non-cancelling concurrency group and executes independently. Persistence no longer relies on cross-workflow serialization; every active writer retries up to eight times from the latest branch head, rebuilds shared generated evidence where applicable, and fails explicitly if reconciliation is exhausted. `workflow-evidence-writer-v15.test.ts` prevents a shared group from returning and requires every active push to remain inside a bounded latest-head retry loop.

Status: prevented on the active INTEL-02 paths and live-validated at `3cfca39...`; all four concurrent controls executed and persisted independently. Legacy writers remain covered by KF-013.

## KF-018 — Curve repair stops one step short after positive-pressure cuts are exhausted

Observed: the `efcffc2...` broad Marvel control safely replaced Vanquish the Horde with Ponder and moved average nonland mana value from 2.71 to 2.61, but the next round exposed only Aurelia as a cut candidate. The generic cut pool discarded every non-positive-pressure card even though the deck needed only one more mana-value point of reduction and had heavily surplus ramp/utility structure.

Risk: a refiner can make honest progress yet stop immediately short of a real threshold, or pressure the only protected strategy card, because a generic heuristic hides safe marginal cuts that become relevant near the target.

Protection: when the authoritative Bracket-5 curve gate is active, cut discovery may inspect the bounded top 15 nonland cuts even when their heuristic pressure is non-positive. Strategy preservation remains first, and curve pairing can use marginal cuts after the main high-pressure repair. Deterministic regressions cover both fallback-pool activation and the 2.61-to-2.60-style marginal choice; KF-020 adds the required package-wide stopping rule.

Status: prevented in deterministic tests and live-validated at `3cfca39...`; both Marvel lanes crossed the curve threshold at 2.59 using the same two-swap package. The first `a45c338...` live attempt remains the regression evidence for KF-020.

## KF-019 — Concurrent provider backoff outlives the focused MCP timeout

Observed: the first focused Marvel run at `efcffc2...` reached the MCP client's fixed ten-minute timeout while broad Marvel and Middle-earth were exercising the same bounded live providers. Build, regressions, artifact upload and result persistence all worked; the live refinement call alone ended with `SdkError: Request timed out`, while the broad copy completed successfully and the focused job was then rerun alone.

Risk: a valid bounded control can be classified as an intelligence failure when provider pacing/retry time, rather than deck logic, exhausts an overly tight transport budget.

Protection: the focused refinement transport budget is now fifteen minutes inside the existing sixty-minute job timeout. Execution and target-quality outcomes remain separately persisted, so a real intelligence failure cannot be hidden as transport delay. A deterministic source regression prevents the ten-minute timeout from returning.

Status: prevented in deterministic source tests and live-validated under concurrent provider load at `3cfca39...`; the focused control completed successfully inside the fifteen-minute transport budget.

## KF-020 — Curve package over-repairs and cuts core utility after crossing the target

Observed: `a45c338...` passed the focused quality gate but applied five curve swaps in one accepted round, dropping average nonland mana value from 2.71 to 2.46. It removed Lightning Greaves, Defense of the Heart, Lethal Scheme and Sun-Spider after the package already had enough cumulative reduction. The pairer compared every swap against the original whole-deck reduction requirement, never reduced the remaining requirement, and still gave Najeela's weak four-point `big-mana` inference full cut-order protection over surplus mana rocks.

Risk: a locally strategy-labelled package can satisfy a numeric gate while making unnecessary changes, eroding tutors, interaction and core commander utility. A green target-quality check would then overstate whole-deck improvement.

Protection: curve pairing now tracks the remaining package-wide mana-value reduction, stops adding curve swaps immediately after crossing the threshold, and chooses the largest safe reduction only while every option remains insufficient. Cut-order protection uses only archetypes with at least six points of command-zone evidence, so Najeela's substantive combat support still protects haste cards while incidental `big-mana` overlap does not shelter surplus ramp. Deterministic regressions reproduce the 7+1 cumulative repair and weak-signal utility ordering.

Status: prevented in deterministic tests and live-validated in both Marvel lanes at `3cfca39...`. The corrected package made exactly two swaps, repaired average nonland mana value from 2.71 to 2.59, retained Lightning Greaves and all tutors, added no failed construction gate, and stopped before the three unnecessary cuts seen at `a45c338...`.

## KF-021 — Generic role gains hollow out a precon's actual strategy

Observed: the first Food and Fellowship refinement produced a superficially stronger twelve-swap package while cutting Sanguine Bond, Essence Warden, Gollum, Obsessed Stalker and every board wipe. After Food/lifegain identity was added, the next run still reduced recursion from three cards to two. A later nominal pass proposed Toxic Deluge for Paradise Druid because mass negative-power removal was not recognized as a wipe and self-only hexproof was misclassified as deck protection.

Risk: generic curve, interaction and protection gains can turn an addressable precon into a worse deck while the aggregate score and target gates appear green. Role-classification false positives can also manufacture structural improvement by exchanging a real safety valve for an unrelated card.

Protection: Food/lifegain is now a semantic commander archetype; upgrade evidence tracks recursion and board-wipe structure; pairing preserves every pre-existing structural floor up to the target and declines a package when every cut creates another hole. Card-role truth excludes self-only hexproof or indestructible from deck protection and recognizes mass negative-power, counters, damage, bounce and sacrifice effects as board wipes. Deterministic regressions cover the archetype, structural floors, no-safe-cut refusal and both role-classification errors. The exact Food and Fellowship live control separately gates hard truth, target improvement and strategy preservation.

Status: prevented in deterministic tests and live-validated at `28e5616...`; the exact Food and Fellowship control made four supported swaps without reducing Food/lifegain affinity, recursion, wipes or persistent colored mana.

## KF-022 — Generic ramp count hides loss of five-color mana access

Observed: the broad Marvel control at `48a7c3f...` reported success after an eight-swap refinement removed Arcane Signet, Fellwar Stone, H.E.R.B.I.E. and four Talismans. Generic ramp remained above target at 23, but persistent colored mana sources fell from 12 to 5 in a five-color Najeela deck. The workflow gated execution and persistence, not whole-deck target quality, so this strategically unsafe result received a green badge.

Risk: treasure, rituals, cost reduction and colorless acceleration can keep the aggregate ramp metric high while the deck loses reliable access to the commander's colors or five-color activation. An autonomous refiner can therefore improve curve arithmetic while making the deck materially less functional.

Protection: role truth now distinguishes persistent colored mana from one-shot filtering and other generic ramp. Pairing tracks the count across the complete package and every accepted round, with color-count floors of four, six, seven and eight for two- through five-color command zones. Focused and broad live controls fail closed on missing or non-finite evidence, enforce whole-deck structural floors, require per-swap colored-mana evidence, and persist target-quality and strategy-quality outcomes separately. The exact five-color regression starts at 12 sources and proves no more than four may be cut below the floor of eight.

Status: the engine floor was live-observed at `28e5616...` (focused 13→12; broad 13→8), but KF-023 and KF-024 kept the Marvel controls correctly red. Exact-source revalidation remains required before the broad lane may be counted as a scenario pass.

## KF-023 — Compact refinement evidence drops a newly enforced safety field

Observed: the focused Marvel run at `28e5616...` produced the safe two-swap result and kept persistent colored sources at 12 from a starting 13, but the final workflow gate failed. The optimizer's compact candidate projection retained strategy and curve fields while silently omitting the new per-swap colored-source count and floor, so the persisted detailed-round evidence contained `null` for both values.

Risk: a safe deck can be rejected as unverifiable, and a workflow that correctly fails closed cannot distinguish missing evidence from an actual floor violation. Adding an engine safeguard without tracing it through every evidence projection leaves the live control permanently red.

Protection: the refinement evidence projector now carries `persistentColoredManaSourcesAfterSwap` and `persistentColoredManaSourceFloor` into every candidate comparison. A direct projection regression prevents either field from being dropped again, and the exact-source workflow remains fail closed until both values are finite.

Status: deterministic fix implemented locally; exact-source Marvel live revalidation pending.

## KF-024 — Aggregate archetype points hide a critical per-swap strategy loss

Observed: the broad Marvel run at `28e5616...` accepted a second-round package containing Aurelia, the Warleader → General Thunderbolt Ross. That pairing explicitly reported `meaningful-strategy-loss` and removed extra-combat, haste and untap roles. The package-level audit nevertheless reported `preserved` because two other generic combat/token additions raised aggregate `combat-tokens` affinity enough to reduce the net label-score loss to two points.

Risk: broad archetype points from unrelated cards can numerically compensate for removal of a deck's actual secondary engine. The optimizer may accept a package that its own per-swap evidence identifies as strategically unsafe.

Protection: optimizer eligibility now requires both the aggregate audit and every per-swap impact to be preserved. Compact audit evidence retains `swapImpacts`, and a deterministic regression proves that aggregate archetype compensation cannot conceal one meaningful pairing loss. A genuinely matched replacement still passes the existing compensated-replacement control.

Status: deterministic fix implemented locally; exact-source broad Marvel revalidation pending.

## Adding a failure

Every new material failure should record:
- exact observed behavior;
- why it matters;
- the protection mechanism;
- regression/control path;
- status (`open`, `partially prevented`, `prevented`, `accepted limitation`).
