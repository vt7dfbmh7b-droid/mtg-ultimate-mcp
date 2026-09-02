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

Status: prevented in deterministic tests and live-validated at `cf3eedb...`; focused Marvel kept Aurelia and passed, while every accepted broad pairing was explicitly preserved.

## KF-016 — Weak secondary commander signal blocks every safe target repair

Observed: the first `7fcd3ca...` Marvel revalidation correctly rejected cuts to Aurelia's strong `combat-tokens` plan, but it also treated Najeela's four-point `big-mana` inference as a meaningful deck identity. That made Vanquish the Horde's generic cost-reduction overlap look equally protected, left all 25 bounded candidates ineligible, and stopped with zero accepted rounds even though a safer curve cut existed.

Risk: fail-closed strategy protection can become overbroad and paralyse autonomous improvement, protecting a weak incidental overlap as strongly as the commander's substantive plan.

Protection: meaningful-loss gating now requires both at least four net affinity points removed and at least six points of command-zone evidence for that strategy. Pairing still protects Aurelia's strong combat affinity, while an exact weak-secondary-signal regression proves the safer Vanquish curve cut remains eligible and carries complete preservation evidence.

Status: prevented in deterministic tests and live-validated at `cf3eedb...`; focused Marvel selected the safe Vanquish cut, and broad Marvel continued to make safe progress without freezing on weak `big-mana` overlap.

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

Status: prevented in deterministic tests and live-validated at `cf3eedb...`; the exact Food and Fellowship control made four supported swaps without reducing Food/lifegain affinity, recursion, wipes or persistent colored mana.

## KF-022 — Generic ramp count hides loss of five-color mana access

Observed: the broad Marvel control at `48a7c3f...` reported success after an eight-swap refinement removed Arcane Signet, Fellwar Stone, H.E.R.B.I.E. and four Talismans. Generic ramp remained above target at 23, but persistent colored mana sources fell from 12 to 5 in a five-color Najeela deck. The workflow gated execution and persistence, not whole-deck target quality, so this strategically unsafe result received a green badge.

Risk: treasure, rituals, cost reduction and colorless acceleration can keep the aggregate ramp metric high while the deck loses reliable access to the commander's colors or five-color activation. An autonomous refiner can therefore improve curve arithmetic while making the deck materially less functional.

Protection: role truth now distinguishes persistent colored mana from one-shot filtering and other generic ramp. Pairing tracks the count across the complete package and every accepted round, with color-count floors of four, six, seven and eight for two- through five-color command zones. Focused and broad live controls fail closed on missing or non-finite evidence, enforce whole-deck structural floors, require per-swap colored-mana evidence, and persist target-quality and strategy-quality outcomes separately. The exact five-color regression starts at 12 sources and proves no more than four may be cut below the floor of eight.

Status: the engine floor was live-observed at `cf3eedb...`: focused Marvel passed at 13→12 and broad Marvel held the enforced floor at 13→8. The broad lane remains red only because it stopped at average nonland mana value 2.61; KF-025 covers the role false negatives that hid a safe final repair.

## KF-023 — Compact refinement evidence drops a newly enforced safety field

Observed: the focused Marvel run at `28e5616...` produced the safe two-swap result and kept persistent colored sources at 12 from a starting 13, but the final workflow gate failed. The optimizer's compact candidate projection retained strategy and curve fields while silently omitting the new per-swap colored-source count and floor, so the persisted detailed-round evidence contained `null` for both values.

Risk: a safe deck can be rejected as unverifiable, and a workflow that correctly fails closed cannot distinguish missing evidence from an actual floor violation. Adding an engine safeguard without tracing it through every evidence projection leaves the live control permanently red.

Protection: the refinement evidence projector now carries `persistentColoredManaSourcesAfterSwap` and `persistentColoredManaSourceFloor` into every candidate comparison. A direct projection regression prevents either field from being dropped again, and the exact-source workflow remains fail closed until both values are finite.

Status: prevented in deterministic tests and live-validated at `cf3eedb...`; focused Marvel persisted finite per-swap source counts and floors and passed at 13→12, while broad Marvel retained the same complete evidence through 13→8.

## KF-024 — Aggregate archetype points hide a critical per-swap strategy loss

Observed: the broad Marvel run at `28e5616...` accepted a second-round package containing Aurelia, the Warleader → General Thunderbolt Ross. That pairing explicitly reported `meaningful-strategy-loss` and removed extra-combat, haste and untap roles. The package-level audit nevertheless reported `preserved` because two other generic combat/token additions raised aggregate `combat-tokens` affinity enough to reduce the net label-score loss to two points.

Risk: broad archetype points from unrelated cards can numerically compensate for removal of a deck's actual secondary engine. The optimizer may accept a package that its own per-swap evidence identifies as strategically unsafe.

Protection: optimizer eligibility now requires both the aggregate audit and every per-swap impact to be preserved. Compact audit evidence retains `swapImpacts`, and a deterministic regression proves that aggregate archetype compensation cannot conceal one meaningful pairing loss. A genuinely matched replacement still passes the existing compensated-replacement control.

Status: prevented in deterministic tests and live-validated at `cf3eedb...`; every accepted broad Marvel pairing reported preserved, and the previously unsafe Aurelia pairing was no longer selected.

## KF-025 — Role false negatives hide a safe final curve repair

Observed: after the KF-022 and KF-024 protections, broad Marvel at `cf3eedb...` stopped safely at average nonland mana value 2.61. The deck had actually gained Dispatch, but role truth did not recognize its target-tap/conditional-exile text as interaction. Lightning Bolt's direct-damage text and Reanimate's "put ... from a graveyard" text were also missed. The computed interaction count therefore stayed at 18, so the pairer could not exchange a surplus free counter for a one-mana curve card and offered only a protected combat engine as the final cut.

Risk: semantic false negatives can make a safe, role-balanced repair appear structurally impossible. The optimizer then stops just short of a real target or pressures a core strategy card even though the deck has genuine role surplus.

Protection: spot-interaction truth now covers direct damage to a target and target-tap conditional removal; recursion truth covers putting a target card from any graveyard onto the battlefield. Card-role regressions cover all three observed Oracle patterns, and a near-threshold five-color pairing regression proves surplus interaction is selected before a protected combat engine while the colored-mana floor remains intact.

Status: deterministic and focused exact-source validation passed at `77a5383...`; the broad control at the same source still failed target-quality and strategy-preservation gates, so broad Marvel remains pending.

## KF-026 — Graveyard hate and generic artifacts impersonate a precon's engine

Observed: the nominal Necron Dynasties pass at `98d4b264...`, repeated with cumulative retention at `5dc7641...`, classified Szarekh correctly as graveyard-reanimator plus artifact-engine but gave generic artifacts and any card mentioning a graveyard enough affinity to replace real engine pieces. The twelve-swap package cut Trazyn the Infinite and Resurrection Orb while adding Tormod's Crypt, Soul-Guide Lantern and generic equipment. Aggregate graveyard/artifact totals rose, so every mechanical gate stayed green even though the deck's recursive engine was hollowed out.

Risk: an archetype label can become a bag-of-words score. Graveyard hate then counts as graveyard support, and card type alone lets any artifact compensate numerically for an actual artifact engine. A legal, cheaper, higher-role-count deck can therefore be strategically worse.

Protection: graveyard-reanimator affinity now requires own-graveyard access, true recursion, setup or mass exchange semantics; graveyard hate alone contributes zero. A generic artifact permanent retains only a relevant but sub-substantive three-point signal, while explicit artifact/Vehicle engine text is required for substantive affinity. Trazyn-, Anrakyr-, Ghost Ark-, Living Death- and Soul-Guide-Lantern-style generic fixtures cover the boundary. The Necron live workflow independently requires both substantive identities, non-decreasing support/affinity, a recursion floor and per-swap meaningful-loss rejection.

Status: deterministic repair passes locally; the prior green evidence is explicitly rejected and exact-source Necron revalidation is pending.

## KF-027 — Aggregate token-strategy retention hides cuts to core payoffs

Observed: the Squirreled Away control at `51621b4...` passed legality, budget, target progress, per-round strategy audit and a 90% cumulative affinity threshold, yet cut Chatterfang, Squirrel General; Squirrel Sovereign; Beastmaster Ascension; End-Raze Forerunners; and other core token payoffs for generic protection and tutors. The final aggregate combat-token affinity retained 97.3%, masking the loss of individual engines and finishers.

Risk: ratio-based whole-deck retention allows several uniquely important cards to disappear when many lower-value cards still share the same broad archetype label. The optimizer can turn a coherent precon into generic good-stuff while claiming the commander plan was preserved.

Protection: generic role truth now recognizes token replacement/multiplication text and team-wide or typal anthem text. Those semantics produce substantive combat-token affinity and maximum cut protection, so a token multiplier or go-wide payoff cannot be exchanged for unrelated protection/tutor density. Deterministic fixtures use unnamed Chatterfang-, Beastmaster- and typal-anthem-style text, and the Squirreled Away evidence registry requires the semantic regression in addition to cumulative retention.

Status: deterministic repair passes locally; the nominal Squirreled Away green is retained only as adversarial regression evidence and exact-source revalidation is pending.

## KF-028 — Token-sacrifice and scaling payoffs disappear after the first token repair

Observed: the later nominal Squirreled Away pass at `87ac114...` no longer cut the KF-027 token multiplier, anthem and overrun fixtures, but it still cut Poison-Tip Archer, Moldervine Reclamation, Nadier's Nightblade and Honored Dreyleader for generic tutors and protection. Chatterfang's variable `Sacrifice X Squirrels` cost was not recognized as a repeatable sacrifice outlet, so the command zone exposed only `combat-tokens`; token-death drain/draw engines received no `aristocrats` protection, and a creature scaling from each other Squirrel/Food received no go-wide protection. Mechanical, cumulative and per-swap gates all stayed green.

Risk: fixing one set of named-looking symptoms can merely move the optimizer to the next unprotected layer of the same deck. A token precon can retain aggregate token creation while losing its sacrifice finishers, death-trigger card advantage and board-scaling payoffs, producing generic tutor/protection good-stuff rather than a coherent upgrade.

Protection: shared role truth now recognizes variable-quantity repeatable sacrifice costs such as `Sacrifice X <type>:` as sacrifice synergy and an outlet. This gives a token-multiplying commander a substantive generic `aristocrats` identity; death-drain, death-draw and token-departure payoffs inherit maximum contextual cut protection. Creature text that gains counters for each other controlled typal/token-engine permanent is also substantive go-wide support. Name-independent role, inference, affinity, preservation and workflow-evidence regressions cover the full boundary. The Squirreled Away live gate now requires both substantive combat-token and token-sacrifice command-zone identities.

Status: deterministic focused regressions pass locally; the `87ac114...` Squirreled Away result is rejected false-green evidence and exact-source live revalidation remains pending.

## KF-029 — Movement into a graveyard is read backwards as reanimation

Observed: a live shared-truth smoke against the Oracle text for Nihil Spellbomb still assigned six `graveyard-reanimator` points. The broad fallback expression matched “is put into a graveyard from the battlefield” because it only checked that `put`, `graveyard` and `battlefield` appeared in that order; it did not require the card to move from the graveyard onto the battlefield. This manufactured enough substantive affinity for graveyard hate to help replace a real Necron recursive engine in the nominal `87ac114...` pass.

Risk: a directional rules statement can be classified as its exact strategic opposite. Graveyard hate, death triggers or ordinary battlefield-to-graveyard movement may then satisfy a reanimation gate and conceal engine loss despite apparently semantic scoring.

Protection: the shared reanimation expression now requires explicit movement `from <a/your/the/any> graveyard` `to/onto the battlefield`. The generic graveyard-hate fixture includes the observed battlefield-to-graveyard wording and must remain at zero reanimator affinity, while positive own-graveyard and staged-reanimation fixtures remain substantive. A live Scryfall smoke confirmed Nihil Spellbomb and Tormod's Crypt at zero reanimator points and Lively Dirge at twenty-one.

Status: TypeScript, focused deterministic regressions and the live Oracle-classification smoke pass locally; exact-source strategy and Necron workflow revalidation remains pending.

## KF-030 — Self-sacrificing utility impersonates a repeatable sacrifice outlet

Observed: while extending variable-quantity sacrifice truth for the KF-028 repair, the prior generic `sacrifice this` role would give a self-sacrificing utility artifact seven substantive `aristocrats` points. Treating its own one-shot activation like Chatterfang's repeatable ability to sacrifice arbitrary token resources would let graveyard hate or cantrip artifacts numerically replace real death engines in a token-sacrifice deck.

Risk: the repair for one missing sacrifice syntax can overgeneralize and create a new false replacement class. A card that can sacrifice only itself is useful fodder, but it is not a repeatable outlet and should not receive the same structural protection or replacement credit.

Protection: self-referential costs using `this <permanent>` or the card's own Oracle name now receive a separate two-point `self sacrifice` signal. Only costs that sacrifice another, arbitrary, one-or-more, any-number-of or variable-X resource receive `sacrifice synergy`/`sacrifice outlet` truth. Generic and actual-name self-sacrifice regressions prevent promotion to substantive aristocrats support.

Status: TypeScript and focused deterministic regressions pass locally; exact-source strategy and Squirreled Away revalidation remains pending.

## KF-031 — Command-zone-only inference misses a precon's supported secondary plan

Observed: Hazel of the Rootbloom exposed a substantive token plan from the command zone, while the stock Squirreled Away 99 supplied the sacrifice outlets, death-drain payoffs and death-trigger draw engine. Upgrade selection therefore treated `aristocrats` as incidental and proposed cutting Poison-Tip Archer, Moldervine Reclamation, Nadier's Nightblade and Zulaport Cutthroat for generic tutors and protection. A looser repair also promoted Necron's shallow combat overlap as a core identity even though the stock deck supplied only 54 aggregate affinity points.

Risk: face-commander text is not a complete precon specification. Ignoring densely supported secondary plans hollows out the 99; promoting every incidental overlap creates the opposite failure and protects noise as identity.

Protection: upgrade context retains only substantive command-zone plans and may promote exactly one additional whole-deck plan. Promotion requires at least six substantive support cards, three bridge cards that also support a substantive command-zone plan and seventy-two aggregate affinity points. Weak command-zone hints are excluded from upgrade identity and rationales. Name-independent dense, shallow and weak-signal regressions cover both boundaries.

Status: deterministic regressions and current-source local exact controls pass. Squirreled Away makes one conservative NZ$5.28 swap and preserves both token and aristocrats support/affinity exactly; Necron preserves both graveyard and artifact identities. Exact-source GitHub revalidation remains pending.

## KF-032 — Aggregate affinity masks loss of strategy-support density

Observed: the repaired Necron package held artifact-engine affinity at 267 while reducing artifact support from 52 cards to 51. The earlier four-point meaningful-loss rule saw no material aggregate regression, so the package remained mechanically eligible even though the exact Necron workflow correctly required both support and affinity to be non-decreasing.

Risk: a few stronger label matches can numerically compensate for removing additional on-plan cards. An optimizer can gradually reduce engine density while claiming the same aggregate strategy strength, especially across several accepted rounds.

Protection: every resolved candidate package is now audited against one strategy context anchored to the pre-package deck. Each substantive starting identity must retain or improve both support-card count and aggregate affinity; missing resolution evidence fails closed. Rejected packages remain in attempt provenance, and refinement automatically retries smaller packages rather than spending identity to fill generic role quotas.

Status: deterministic density-loss regression and local exact Necron control pass. The accepted eight-swap package moved graveyard support/affinity 29→30 and 274→286 while holding artifact support at 52 and increasing affinity 267→270. Exact-source GitHub revalidation remains pending.

## KF-033 — Curve arithmetic consumes premium early infrastructure

Observed: a nominal Food and Fellowship pass repaired average nonland mana value by replacing Birds of Paradise with Everflowing Chalice. The curve pairer preferred the smallest sufficient numeric reduction, the role model called a zero-mana multikicker rock `fast mana`, and low-cost colored acceleration received no cut-quality protection. Moving Birds into a later generic protection swap reproduced the same underlying mistake after the curve-only symptom was blocked.

Risk: an optimizer can game average mana value while removing the one- and two-mana infrastructure that makes a deck functional. False fast-mana classification then makes the swap look like a structural gain, and a green curve gate conceals a worse real opening sequence.

Protection: the average-mana-value lane may cut only cards above the early-play band; supported 2→1 upgrades remain available through their actual role lanes. When several cuts cross the threshold, strategy and structural truth remain first, followed by cut quality before minimum excess reduction. Mana artifacts with paid X/kicker setup are not fast mana, and efficient fast mana plus low-cost colored acceleration receive explicit cut-pressure protection before slower ramp.

Status: deterministic role, pairing and cut-pressure regressions pass. The current local exact Food and Fellowship control makes six swaps for NZ$39.92, keeps Birds and Arcane Signet, holds ramp at 16 and persistent colored sources at 9, preserves Food support/affinity at 27/232, repairs curve 3.26→3.00 and early plays 22→26, and remains honestly Bracket 3. Exact-source GitHub revalidation remains pending.

## KF-034 — Board-scaling card advantage is treated as generic draw

Observed: after the token, aristocrats and efficient-ramp repairs, the current-source Squirreled Away control cut Shamanic Revelation for Swiftfoot Boots. Role truth recognized `draw a card for each creature you control` only as card draw, not as a payoff whose value scales directly with the wide token board the deck is built to create.

Risk: protecting token creation, anthems and death payoffs is still insufficient if board-scaling reload engines remain generic. The optimizer can remove a precon's best recovery/card-advantage spell for a staple while every broad token label and structural floor stays green.

Protection: drawing one card per controlled creature, or cards equal to the number of controlled creatures, is now a semantic `go-wide payoff`. It receives substantive combat-token affinity and maximum contextual cut protection. Role, strategy-inference and uncompensated-swap regressions use name-independent board-scaling draw text.

Status: deterministic regressions and the current-source local exact Squirreled Away control pass. The accepted package no longer cuts Shamanic Revelation or any marquee token/aristocrats payoff; it makes one supported swap and stops when no further package clears the stricter identity gates. Exact-source GitHub revalidation remains pending.

## KF-035 — Printed mana value hides the operational cost of mana and interaction

Observed: the exact-source Food and Fellowship run at `3e2729a...` accepted Great Oak Guardian → Giant's Boulder and credited the incoming one-mana artifact as fast mana, mana acceleration, a persistent colored source and cheap interaction. Its mana ability requires one mana to produce one mana, while its removal ability requires seven mana. The same raw-role path also let zero-mana graveyard hate satisfy Necron's generic free/cheap-interaction gate.

Risk: checking only a card's printed mana value and the words `add`, `destroy` or `exile target` manufactures structural improvement. Color filtering can impersonate acceleration, late activated removal can impersonate an early response, and graveyard-only hate can replace battlefield/stack interaction.

Protection: production deck metrics, candidate filtering, scoring and upgrade summaries now consume the existing fail-closed V0.15 role boundary. Mana truth compares fixed activated output with the mana paid into the ability, preserves genuinely net-positive paid rocks, and removes filtering-only acceleration/fast-mana/source credit. Interaction truth separates graveyard-only effects, activated-only effects and the minimum activation cost; the cheap-interaction gate requires operationally cheap generic interaction rather than merely a low printed mana value. Name-independent regressions cover a one-for-one color filter with seven-mana removal, a net-positive paid rock, zero-mana graveyard hate and ordinary one-mana removal.

Status: prevented in TypeScript and 903/903 deterministic tests locally; exact-source Food, Necron and full control-family revalidation is pending.

## KF-036 — Same-archetype affinity treats payoff, engine and enabler roles as interchangeable

Observed: the exact-source Squirreled Away run at `3e2729a...` accepted End-Raze Forerunners → Not Dead After All and Poison-Tip Archer → Diabolic Intent. Broad combat-token/aristocrats affinity stayed flat or rose, but a go-wide finisher/haste payoff became narrow protection and a repeatable death-drain payoff became a tutor/sacrifice enabler. Per-swap evidence listed the unreplaced roles but still called both pairings preserved.

Risk: a single archetype score can become a fungible currency. Adding more setup, protection or search then numerically compensates for removing the payoff or bridge that gives the setup a purpose, producing coherent-looking generic good-stuff instead of a stronger version of the deck's plan.

Protection: role truth now distinguishes repeatable death-drain payoffs from one-shot life-loss riders. For every maximum-protected substantive strategy card, swap preservation separately checks exact engine/payoff components associated with that archetype; incoming same-archetype affinity cannot replace a missing go-wide payoff, haste engine, repeatable death payoff, sacrifice outlet, recursion engine or other mapped functional component. Name-independent regressions cover combat payoff → token enabler and repeatable death payoff → sacrifice tutor.

Status: prevented in TypeScript and 903/903 deterministic tests locally; exact-source Squirreled Away and full control-family revalidation is pending.

## KF-037 — A fixed 15-card cut shortlist hides safe surplus cards

Observed: both exact-source Marvel controls at `3e2729a...` repeatedly paired every candidate addition with one unsafe or insufficient cut. Broad Marvel tried Helm of the Host for all five additions and correctly rejected each package for strategy loss; focused Marvel could find only one three-point curve reduction when the failed curve gate needed a larger cumulative repair. Safe higher-mana surplus cards existed in the legal 99 but fell outside the fixed top-15 cut-pressure slice.

Risk: robust downstream structure and strategy checks cannot select a safe card they never receive. A narrow heuristic shortlist can force repeated pressure on a protected engine, stop short of a reachable target, or misreport that no supported improvement exists.

Protection: cut discovery now exposes the complete finite resolved nonland cut pool to the existing structural, colored-mana, curve, strategy-component and deterministic tie-break filters. The Commander deck itself bounds the pool, so no unbounded provider search is introduced. A regression fills the old 15 slots with maximum-protected high-pressure engines and proves the pairer still reaches the lower-pressure safe surplus cut beyond them.

Status: prevented in TypeScript and 903/903 deterministic tests locally; focused/broad Marvel and full exact-source control-family revalidation is pending.

## KF-038 — Staged high-capacity recursion collapses into generic reanimator affinity

Observed: the exact-source Necron run at `b17f7cf...` accepted The War in Heaven → Lively Dirge. Both cards received broad graveyard-reanimator affinity, but the role parser missed the Saga's staged Oracle construction (`choose ... in your graveyard. Return each ...`) and therefore exposed only card draw on the cut. The replacement is useful, but it is a narrower tutor/return package than the removed draw, mill and three-creature reanimation engine.

Risk: an optimizer can preserve aggregate graveyard affinity while silently reducing the capacity of a deck's central recursion engine. Sentence boundaries and equal archetype scores can hide the loss even when the incoming card is independently playable.

Protection: recursion truth now recognizes staged selection-and-return wording and records multi-card and high-capacity recursion separately. Three-or-more/any-number returns and multi-card returns with a substantial total-mana-value allowance receive the high-capacity component; narrow multi-card returns do not. Graveyard-reanimator preservation requires an incoming high-capacity component before cutting one, regardless of flat or positive broad affinity.

Status: name-independent regressions and the full 905/905 deterministic suite pass locally; exact-source Necron/family revalidation pending.

## KF-039 — Distinct Commander engines collapse into generic draw, interaction, or affinity

Observed: exact-source controls at `b17f7cf...` remained mechanically green while accepting Moldervine Reclamation → Culling the Weak and Morbid Opportunist → Diabolic Intent in Squirreled Away, Swarmyard Massacre → Warping Wail in the same deck, Armor Wars → Brainstorm in broad Marvel, and Eagles of the North → Bastion Protector in Food and Fellowship. The role layer saw generic repeatable draw, token production, card draw, or a broad team buff, but missed death-trigger draw capacity, asymmetric typal board control, board-scaling draw, and the fact that a commander-only buff is not a go-wide payoff.

Risk: a deck can retain or improve coarse role counts and archetype affinity while losing exactly the bridge, scaling engine, selective wipe, or whole-team finisher that makes its plan coherent. One-shot mana, a tutor, a cantrip, or commander protection can then look fungible with strategy-specific engines.

Protection: role truth now distinguishes death-trigger draw engines, board-scaling card draw, asymmetric typal board-control payoffs, and multiplayer forced-sacrifice bridges. Those components are preserved separately inside their relevant aristocrats, value-engine, and combat-token strategies. Commander-only buffs are excluded from go-wide payoff truth. Name-independent regressions prove that flat same-archetype affinity cannot erase any of these components.

Status: focused regressions and the full 905/905 deterministic suite pass locally; exact-source Squirreled Away, Food, Marvel and family revalidation pending.

## KF-040 — Replacement mana and token/graveyard bridges remain fungible

Observed: the exact-source candidate at `b89e238...` prevented the earlier engine cuts but exposed a deeper safe-cut failure. Squirreled Away accepted Arcane Signet → Crop Rotation, Plumb the Forbidden → Diabolic Intent, Ogre Slumlord → Not Dead After All, Toski, Bearer of Secrets → Swiftfoot Boots and Skullclamp → Undying Malice. Necron accepted Beacon of Unrest → Lively Dirge, and Food and Fellowship accepted Mirkwood Bats → Lake-town Lookout. Aggregate strategy support and affinity remained exactly flat in Squirrels even though its mana development, mass-sacrifice conversion, death-token production, team combat draw, death-trigger draw and token-event drain engines were materially weakened.

Risk: a land-for-land search can impersonate acceleration; broad token, recursion or sacrifice labels can treat engines as disposable; and a creature-only return spell can replace artifact recursion inside an artifact/graveyard deck. The optimizer then fills tutor and protection quotas by consuming the cards that make those tutors and protected creatures worth playing.

Protection: land searches that sacrifice a land as an additional cost are classified as land replacement, not ramp or a persistent colored source. Role truth now distinguishes multi-creature sacrifice conversion, death-trigger token engines, team combat-damage draw, multi-card death-trigger draw, token-event life drain and artifact graveyard recursion. Each is an exact protected component of the applicable combat-token, aristocrats, Food/lifegain or artifact strategy, independent of aggregate affinity.

Status: focused name-independent regressions and the full 905/905 deterministic suite pass locally; exact-source Necron, Squirreled Away, Food and family revalidation pending.

## KF-041 — Uncapped single-target reanimation loses recursion-capacity truth

Observed: the exact-source Necron control at `f3c6f73...` no longer cut artifact recursion, but still accepted Dread Return → Lively Dirge. The removed spell can return a creature of any mana value and can be cast again through flashback; the replacement's return mode is capped at total mana value 4. Both received generic recursion truth, while only explicit multi-card wording could receive the existing high-capacity role.

Risk: a low-mana tutor/return spell can look like a curve upgrade while materially narrowing the deck's viable reanimation targets. Aggregate recursion count and reanimator affinity remain flat even though the deck loses access to its large threats.

Protection: an uncapped target-card return to the battlefield now retains high-capacity recursion truth, while returns with an explicit mana-value ceiling remain bounded. The existing exact strategy-component gate therefore rejects the capacity loss without referring to either card by name.

Status: name-independent regression and the full 905/905 deterministic suite pass locally; exact-source Necron/family revalidation pending.

## KF-042 — Package diversity changes additions but repeatedly pressures the same rejected engines

Observed: the exact-source Squirreled Away control at `f3c6f73...` correctly rejected packages that cut End-Raze Forerunners, Poison-Tip Archer and Moldervine Reclamation, but later candidate comparisons repeatedly returned to those same strategically invalid cuts while varying incoming cards. At the one-swap fallback, the only supported proposal still consumed the go-wide finisher, so the control stopped red without testing safer outgoing cards.

Risk: addition-only diversity can make a bounded search appear broad while it tunnels on the same few high-pressure cuts. Exact strategy preservation prevents damage, but the optimizer may fail to find a legitimate improvement that exists elsewhere in the finite deck.

Protection: after a package fails specifically for meaningful commander-strategy loss, subsequent candidate comparisons at that swap size protect only the outgoing cards whose pairing evidence caused the rejection. Incoming-card diversity continues independently, and both sets reset at the next bounded attempt size. A deterministic regression proves that safe cuts are not blocked and duplicate rejected names are handled case-insensitively.

Status: name-independent regression and the full 905/905 deterministic suite pass locally; exact-source Squirreled Away/family revalidation pending.

## KF-043 — Repeatable token and life-gain engines collapse into one-shot effects

Observed: the exact-source Food and Fellowship control at `f3c6f73...` was mechanically green but accepted Pristine Talisman → Reanimate and Merry, Warden of Isengard → Orcish Medicine. The replacements are playable cards, but they spend a repeatable mana/life-gain trigger and a repeatable artifact-entry lifelink-token engine from the deck's actual Food/lifegain and combat-token plan for off-plan recursion and one-shot protection/token production.

Risk: broad token production, protection, recursion and curve metrics can improve while a precon loses the repeatable bridges that turn its commander text and Food artifacts into a coherent engine. Whole-deck affinity can remain flat because one-shot and repeatable effects share the same coarse role.

Protection: activated/triggered repeatable life gain and activated/triggered repeatable token creation now have distinct semantic roles. They are exact components of substantive Food/lifegain and combat-token strategies respectively; one-shot life gain or token creation cannot replace them. Name-independent regressions cover both positive and negative wording forms.

Status: name-independent regressions and the full 905/905 deterministic suite pass locally; exact-source Food/family revalidation pending.

## KF-044 — Token-copy multipliers evade payoff protection

Observed: the current exact-source Squirreled Away candidate proposed `Second Harvest → Fake Your Own Death`, then the corrected rerun proposed `Academy Manufactor → Fake Your Own Death`. `Second Harvest` creates a copy for each token already controlled, while Academy Manufactor replaces one Clue, Food or Treasure with one of each. The shared role truth only recognized the more explicit “those tokens plus that many” and “twice as many” multiplication forms. Both candidates therefore exposed only generic token production, and per-swap preservation marked the cuts as safe.

Risk: semantically equivalent token-doubling text can be traded for generic protection, recursion or token production while the deck loses a board-scaling combat engine. Exact card names must not be needed to protect that component.

Protection: effective role truth now recognizes generic token-copy and token-conversion replacement patterns as `token multiplier`. The existing strategy-component gate then rejects an uncompensated cut, and unnamed role/affinity/preservation regressions cover both patterns.

Status: fixed in TypeScript; focused 65/65 and full 921/921 deterministic suites pass locally. The corrected exact-source Squirreled Away rerun completes with four swaps, no meaningful per-swap losses, preserved cumulative combat-token/aristocrats support and affinity, and no `Second Harvest` or `Academy Manufactor` cut. Full exact-source control-family revalidation remains pending.

## Adding a failure

Every new material failure should record:
- exact observed behavior;
- why it matters;
- the protection mechanism;
- regression/control path;
- status (`open`, `partially prevented`, `prevented`, `accepted limitation`).
