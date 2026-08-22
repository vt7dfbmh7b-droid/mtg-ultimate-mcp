# Ultimate MTG Validation Matrix

A passing workflow proves only the claim listed for that control. Do not generalize a narrow pass into a universal intelligence claim.

| Control / evidence | Primary claim | Hard assertions | Intelligence assertion | Current state |
|---|---|---|---|---|
| CI / TypeScript / unit tests | Source compiles and deterministic regressions pass | build, types, unit tests | none by itself | exact-head CI green at `3cfca39...`; local full suite 770/770 |
| active evidence-writer reconciliation | concurrent live controls execute and persist isolated evidence without cancelling or losing a non-fast-forward race | independent non-cancelling workflow groups; eight bounded latest-head recompute/push attempts; explicit persistence gate | none by itself | live-validated at `3cfca39...`: focused Marvel, broad Marvel, Middle-earth and project-state integrity all executed and persisted exact-source evidence; legacy KF-013 writers remain open |
| Scryfall live | Card/printing provider path works | live card data accessible | none | validated baseline green |
| TopDeck live | Tournament evidence path works when configured/available | provider integration/source health | none | validated baseline green |
| Commander live aggregate suite | Core Commander pipeline survives representative controls | legality, exact count, constraints, protocol boundary | bounded by included scenarios | validated at `63bb727...` on prior experimental baseline |
| FF Najeela high-Bracket-4 | constrained themed high-power construction | exact FF printing family, legality, target behavior | strategy/power behavior for this scenario | validated baseline green |
| FF neutral autonomous build | autonomous constrained construction from neutral input | FF family, legal 100 | basic autonomous build quality | validated baseline green |
| FF Bracket 5 | constrained B5 construction | legality/printing plus B5 evidence | B5 behavior in FF scenario | validated baseline green |
| unrestricted cEDH | unrestricted high-power path | legality and high-power construction | high-power behavior without themed restriction | validated baseline green |
| universal Commander pipeline | generic one/two commander path | command-zone semantics, legality, exact 100 | generic pipeline only | validated baseline green |
| unrestricted neutral Commander | no-theme construction | legal 100 | neutral autonomous construction | validated baseline green |
| neutral free-form theme | theme adapter/audit | requested theme density truth | theme-preserving construction | validated baseline green |
| exact per-card budget | every selected printing obeys hard cap | exact printing price truth | budget-aware construction | validated baseline green |
| FF exact budget | printing-family + exact budget combined | exact FF printing and cap | constrained budget behavior | validated baseline green |
| tutor value-for-money regressions | marginal route-access pricing logic | physical tutor probability, exact printing/finish price | Pareto comparison quality | implemented/validated on prior baseline |
| full-table win closure tests | multiplayer win semantics | no unscoped lethal false positives | win-route correctness boundary | implemented; current live integration proof pending |
| win-package pagination tests | bounded search truth | truncated/partial != absence | deeper package discovery | implemented |
| restricted physical-pool tests | early constrained package rejection | printing-family eligible pool truth | efficient constrained discovery | implemented |
| package ceiling regression | autonomous caller searches through four-card packages | caller policy matches discovery ceiling | expanded package coverage | implemented |
| target-gate improvement tests | real B5 construction gates drive progress scoring | threshold/progress/regression semantics | target-aware refinement | implemented; explicit hard rejection covered in V0.11/V0.12 and live-proven at `e11826c...` |
| target-aware candidate-generation tests | failed B5 gates drive candidate lanes before aspirational role deficits | average-nonland-mv additions only create positive curve reductions; the active curve lane can inspect bounded non-positive-pressure cuts; cumulative packages stop at the threshold; lower brackets unchanged | candidates can address the evaluator's real blocker without per-swap over-repair | deterministic regressions and both live Marvel lanes green at `3cfca39...`; the corrected package stopped at 2 swaps and 2.59 after `efcffc2...` exposed KF-018 and `a45c338...` exposed KF-020 |
| strategy-preservation / cut-impact tests | autonomous target repair does not silently erase a substantive commander strategy, freeze on weak overlap, or rank incidental utility protection above the main plan | per-swap cut roles and affinity; aggregate package audit; missing evidence and uncompensated meaningful loss fail closed; cut protection and meaningful status require substantive command-zone evidence | Aurelia-style combat affinity and core haste stay protected, weak four-point Najeela `big-mana` overlap does not shelter surplus ramp, and strategically matched replacement remains legal | deterministic regressions and live Marvel evidence green at `3cfca39...`; Lightning Greaves and all tutors were retained, while surplus Arcane Signet remained a legal curve cut |
| Food/lifegain identity and structural-floor tests | precon refinement preserves the commander's substantive engine and does not repair one role by opening another hole | semantic Food/lifegain affinity; recursion and board-wipe tracking; after-count stays at or above the lesser of the starting and target counts; no-safe-cut refusal; self-only protection rejection; mass-wipe recognition | generic metric gains cannot erase Food/lifegain payoffs, all wipes, recursion or real protection truth | deterministic regressions green locally; KF-021 exact failures covered |
| persistent colored-mana floor tests | autonomous refinement cannot disguise loss of multicolor access behind generic ramp density | semantic persistent-source role; one-shot filtering excluded; floor derived from command-zone color count; package-wide and per-swap evidence must be finite and at or above the floor | five-color curve repair may spend surplus fixing but cannot reduce 12 persistent colored sources below 8 | deterministic exact regression green; KF-022 broad Marvel false-green reproduced and exact-source live fix pending |
| shared refinement score tests | production scorer rewards first verified route over cosmetic tutor growth | route +24 target priority, tutor 8→9 zero target credit; lower brackets unchanged | better candidate ordering | implemented and green |
| injectable package selector tests | selected package can fit requested swap capacity | missing seeds <= capacity; R preference only among feasible | practical win-package selection | implemented |
| Marvel Bracket-5 live refinement | end-to-end constrained autonomous improvement | legal 100, Marvel exact physical printings, route verification, multicolor access floor | must actually repair/advance failed B5 gates without degrading whole-deck function | focused lane passed safely at `48a7c3f...` with Vanquish the Horde→Vandalblast and Arcane Signet→Ponder; the broad lane's nominal green eight-swap result is **rejected by audit** because persistent colored sources fell 12→5. KF-022 exact-source fix pending live revalidation |
| expanded Middle-earth live control | exact restricted construction and honest refusal when no supported package advances a failed gate | legal exact 100; HOB/HOC/LTC/LTR/SLD physical printings; passing speed, interaction and tutor gates | no scenario-improvement claim unless a package is accepted and improves the whole deck | **ENGINEERING + CONSTRAINT-TRUTH PASS at `48a7c3f...`**; 0 swaps and honest refusal persisted; this remains a constraint control rather than an INTEL-02 improvement pass |
| Food and Fellowship precon live refinement | exact restricted precon upgrade under hard budget and identity constraints | legal exact 100; HOB/HOC/LTC/LTR/SLD physical printings; NZ$35/card and NZ$200 package caps; complete negative route evidence; structural and persistent colored-mana floors | must accept a supported package that repairs or advances an independently evaluated Bracket-4 structure gate without reducing Food/lifegain affinity or meaningful strategy | **RESTRICTED SCENARIO PASS at `48a7c3f...`**: 4 swaps, NZ$28.74, average nonland MV 3.26→3.03, early plays 22→25, interaction 12→13, true protection 0→4, Food/lifegain affinity 232→232, recursion 3→3 and wipes 4→4 |
| BENCH-01 adversarial suite | cross-archetype autonomous intelligence | all scenario constraints | human/expert-level decision quality | planned |

## Claim levels

### Engineering pass

The code ran, compiled, fetched sources or persisted output. This is necessary but not an intelligence claim.

### Truth pass

A hard fact was independently validated: legality, printing, price, probability, route closure, exact count or constraint satisfaction.

### Scenario intelligence pass

The autonomous system made a demonstrably better decision for one controlled deck/scenario.

### General intelligence evidence

Multiple adversarial scenarios across materially different archetypes pass without scenario-specific tuning. This is required before broad statements such as `very good autonomous Commander builder`.

## Current promotion rule for INTEL-01 / INTEL-02

Do not mark either milestone `validated` from a workflow exit code alone. At minimum the post-PM resumed control must report:
- exact tested source SHA;
- control outcome success;
- before/after deck legality and exact card count;
- active printing/theme/budget compliance;
- before/after failed target gates;
- whether each accepted round repaired or measurably advanced a failed gate;
- verified full-table route count/status before and after;
- meaningful-strategy preservation evidence;
- source-completeness state for any negative win-package conclusion.

## Benchmark expansion rule

Every bug discovered during adversarial testing should add:
1. a `KF-*` entry in `KNOWN-FAILURES.md`;
2. a deterministic regression where possible;
3. a matrix row or scenario assertion showing which claim is protected.
