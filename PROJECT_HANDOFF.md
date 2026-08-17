# Ultimate MTG — Project Handoff

_Last updated: 2026-08-17 NZST_

This file is the **persistent recovery point for future ChatGPT sessions**. Read it together with `ULTIMATE_MTG_SPEC.md`: the spec is the north star; this file records current implementation state and the next target.

## Fresh-chat resume instructions

1. Open `vt7dfbmh7b-droid/mtg-ultimate-mcp`.
2. Read `PROJECT_HANDOFF.md` and `ULTIMATE_MTG_SPEC.md` first.
3. Inspect the current head and recent commits of `agent/package-probabilities`.
4. Inspect CI for that exact head before changing code.
5. Do **not** assume `main` is the active development state.
6. Do **not** promote `server-current` merely because V0.14/V0.15 code exists.
7. Continue from **Next implementation target** unless a newer commit changes this handoff.

---

## Repository / release state

**Active continuation branch:** `agent/package-probabilities`

Important current/recent commits:

- `87f74e6223a27b13bace8f201e1f396e11400ff1` — exact-oracle calibration tests against the existing V0.4 simulator; CI succeeded.
- `3546cc66cb42139c224f5d0042cb3361caa3ee12` — finite-sample Bernoulli/Bernstein exact-oracle calibration layer.
- `8285ca8bebdf3234be5fa8cc5754b6f0fddedab8` — handoff after exact access curves.
- `85029cdfbe12bd8ecb0b81cbb11b197bfe35128a` — exact turn/access-curve tests; CI succeeded.
- `29cb99290467c26795e23fbb1c093336322d0271` — exact turn/access-curve implementation.
- `2f45b1381d525bd2a3bdfaf719894f2c8d5d5c2e` — commander-zone exact availability hardened; CI succeeded.
- `d529e326181cf0453eeb68568d51796fd6472293` — commander-zone exact implementation.
- `17bcfcc6819fcf9ef43ed5a8d14bcd9dc371ee6a` — overlap-aware package solver exhaustive/adversarial tests; CI succeeded.
- `e126bf436ae0b1c2cae1b9f2e0ec74127b6311fd` — overlap-aware exact package solver.
- `161d3d1acb1129381d9195d39360b7ce0812f610` — disjoint exact package probability + oracle normalization; CI succeeded.
- `966bffac0a981f9aea5b828c94e6aa091de640ea` — V0.15 foundation baseline before the package branch.

The exact-oracle implementation/test head `87f74e6223a27b13bace8f201e1f396e11400ff1` passed dependency install, strict TypeScript build, and the complete automated test suite.

Temporary branches `agent/package-probabilities-2` and `agent/package-probabilities-3` contain no unique work and are not active.

### Stable runtime remains V0.13

- `package.json` remains `0.13.0`.
- `src/server-current.ts` deliberately returns `createMtgServerV13()`.
- The draft PR remains intentionally unmerged.

Preserve this separation while V0.14/V0.15 intelligence is hardened.

---

## Permanent truth hierarchy

Machine learning, optimization, simulation, or external oracles may never override:

- Commander legality;
- unresolved-card failures;
- exact deck construction;
- color identity / singleton constraints;
- banned/legal facts;
- exact physical-printing existence and restrictions;
- known rules facts and verified combo requirements.

Requested power/bracket is a target, not a forced result.

---

## Existing project foundation

The branch already contains substantial infrastructure for:

- Commander legality, 100-card validation, color identity, partners/singleton rules;
- exact Oracle vs physical-printing identity and themed-printing restrictions;
- MTGJSON stock Commander precons;
- full-deck building, upgrades, protected/excluded/must-include cards and exact IN/OUT tracking;
- NZD-first pricing/budgets with source-value auditability;
- Scryfall, Commander Spellbook, tournament/deck evidence and source diagnostics;
- deterministic simulation and Commander E2E scenarios;
- V0.14 cEDH readiness, combo completion, competitive refinement and from-scratch competitive building;
- V0.15 bracket ceiling/evidence, research/learning, drift detection, neural shadow ranking and exact statistics.

The neural model remains experimental/shadow-only. Real, independent, leakage-safe temporal outcome data is required before promotion beyond the transparent baseline.

---

## Exact statistics milestones

### Univariate hypergeometric — complete

File: `src/services/exact-statistics-v15.ts`

BigInt hypergeometric arithmetic, exact reduced fractions, complement, expectation, variance, physical support, malformed-request checks and population cap 1,000.

Pinned Commander fixture: 99-card library, 36 lands, draw 7, P(3+ lands) = `26,736,733 / 53,358,536 ≈ 50.1077%`.

Decimals are presentation only; exact fractions are the equality/proof surface.

### Disjoint package assembly — complete

Files:

- `src/services/exact-package-statistics-v15.ts`
- `src/services/exact-package-statistics-v15.test.ts`

Exact multivariate package assembly for disjoint physical role buckets. Pinned example: 99-card library, opening seven, two unique singleton pieces = exactly `1 / 231`.

### Overlap-aware physical package assembly — complete

Files:

- `src/services/exact-overlap-package-statistics-v15.ts`
- `src/services/exact-overlap-package-statistics-v15.test.ts`

Properties:

- physical-card categories grouped by capability;
- one physical card may qualify for several roles but satisfies only one simultaneous role;
- Pareto-frontier state prevents tutor/multi-role double counting;
- alternative package routes are unioned exactly;
- role-specific/universal tutors, interchangeable pieces and shared cards are representable;
- malformed inputs and pathological workloads fail closed.

Conservative ceilings: 16 roles, 32 routes, 64 categories, 512 frontier states, 20,000 DP states, 500,000 transitions.

Independent labeled-card exhaustive enumeration validates small populations. Permanent regression: one universal A/B tutor cannot satisfy both missing A and B by itself.

### Commander-zone exact availability — complete

Files:

- `src/services/exact-commander-zone-statistics-v15.ts`
- `src/services/exact-commander-zone-statistics-v15.test.ts`

Commander rules were verified against the Wizards Comprehensive Rules effective **2026-08-07** before encoding this layer.

Properties:

- command-zone cards are guaranteed known physical cards, not random draws;
- `libraryPopulation = deckSize - commandZoneCards.length`; no hard-coded 100 in the generic statistics API;
- legality of multi-commander configurations remains a separate hard gate;
- flexible command-zone cards preserve one-card/one-simultaneous-role semantics;
- guaranteed assignments reduce route requirements before library probability;
- category counts are checked against the derived library population so commanders cannot be counted twice.

Pinned examples:

- one commander, 100-card deck → 99-card library; unique payoff in opening seven = `7 / 99`;
- two commanders, 100-card deck → 98-card library; unique payoff in opening seven = `1 / 14`.

Independent brute-force matching validates small command-zone + library populations.

### Turn-by-turn exact access curves — complete

Files:

- `src/services/exact-access-curve-v15.ts`
- `src/services/exact-access-curve-v15.test.ts`

Current draw-step rules from the Wizards Comprehensive Rules effective **2026-08-07** are explicit:

- `two-player-starting` — skip first-turn natural draw;
- `two-player-non-starting` — draw turn one;
- `multiplayer` — draw turn one.

Properties:

- opening hand is a distinct checkpoint;
- every turn reports exact cumulative package access;
- commander-zone/overlap solver is reused;
- pure cumulative access is checked for exact monotonicity;
- deterministic guaranteed extra draws may be supplied explicitly;
- conditional draw engines are not silently guaranteed;
- library exhaustion is explicit;
- repeated cumulative draw counts reuse cached results;
- maximum 16 distinct exact-solver evaluations per curve;
- this is access/visibility, not castability, mana, timing, or disruption.

Pinned multiplayer singleton curve for a 99-card library: opening seven `7/99`, turn one `8/99`, turn two `1/11`, turn three `10/99`.

Validation includes closed-form singleton combinatorics and independent small-population labeled-card enumeration.

### Exact-as-oracle simulation calibration — complete

Files:

- `src/services/simulation-exact-calibration-v15.ts`
- `src/services/simulation-exact-calibration-v15.test.ts`

This milestone calibrates the **existing `simulateDeckConsistencyV04` path**, rather than adding a second competing Monte Carlo simulator.

For exact-comparable fixtures the V0.4 simulation is constrained to:

- mulligans disabled;
- no tutors or draw engines affecting the requested package;
- multiplayer natural-draw schedule, matching its current one-natural-draw-per-turn behavior;
- fixed seed and explicit sample count.

The tests use a 100-card Commander deck with a 99-card library and compare V0.4 `naturalAssemblyByTurn` against `calculateExactAccessCurveV15` for both:

- a singleton target;
- a two-unique-piece package;
- several cumulative turn checkpoints.

Acceptance is **not** a fixed arbitrary ±percentage. The calibration uses a finite-sample two-sided Bernstein concentration bound for a Bernoulli sample mean with exact probability `p` supplied by the BigInt oracle:

`P(|p_hat - p| > epsilon) <= 2 exp(-n epsilon^2 / (2 p(1-p) + 2 epsilon / 3))`

The implementation solves this bound for `epsilon` using a default failure budget of `1e-6`. The tolerance therefore shrinks with sample count and adapts to the exact Bernoulli variance. Exact `p=0` and `p=1` are deterministic zero-statistical-width boundaries.

The existing V0.4 output rounds cumulative percentages to 0.1 percentage point, so calibration adds only the explicitly known half-resolution allowance (`0.0005` probability) on top of the statistical band. Raw/unrounded future simulation outputs can use reporting resolution zero.

Additional regression tests verify:

- recomputation from exact numerator/denominator instead of trusting a display decimal;
- tolerance shrinkage with larger samples;
- rare-event probability-aware behavior;
- rejection of materially biased Monte Carlo output;
- deterministic p=0/p=1 handling;
- malformed calibration requests fail closed.

Implementation/test head `87f74e6223a27b13bace8f201e1f396e11400ff1` passed install, strict build and the full test suite, including 12,000 seeded full V0.4 iterations for the exact-oracle integration fixture.

---

## Permanent benchmark controls

### Control A — Final Fantasy-only Bracket 5 attempt

Keep permanently:

> Build the strongest possible Commander deck using only legitimate Final Fantasy physical printings, target Bracket 5, and report the honest ceiling if the restriction cannot support Bracket 5.

This exercises printing enforcement, legality, deck construction, winning packages, tutor/redundancy reasoning, mana, interaction/protection, multiple win routes, probability, simulation and bracket honesty. Do not automatically collapse FF builds into one infinite line when combat/value/commander routes materially belong to the intended identity.

Relevant files include `scripts/e2e-ff-bracket5.ts`, `scripts/e2e-ff-cedh-refine.ts`, and `scripts/probe-ff-win-packages.ts`.

### Control B — unrestricted cEDH

Keep permanently:

> Build a genuine competitive Commander deck without the FF printing restriction.

`scripts/e2e-unrestricted-cedh-v15.ts` uses **Kinnan, Bonder Prodigy** and guards complete legality, exact resolution, deterministic win packages, low curve, free interaction, fast mana, strong competitive construction signals and no practical fallback to the clunky Leveler line.

The FF vs unrestricted comparison helps distinguish a user/card-pool ceiling from a builder weakness.

---

## External oracle strategy

Reference families remain:

- `j4th-mtg-mcp` — independent MCP/deck workflow reference;
- `nccurry-mtg-mcp` — statistics/evidence/reproducibility reference;
- `forge` — mature rules/simulation reference;
- `manabrew` — Forge-family parity methodology.

External mismatches trigger investigation, not obedience. Related systems are deduplicated by independence group. Pin snapshots for deterministic comparisons, keep live external tests separate where appropriate, shrink failures, retain resolved regressions, and respect licenses.

---

## Honest bracket result shape

Major build/upgrade workflows should converge on:

```text
Requested: Bracket 5
Achieved: High Bracket 4
Confidence: High
Ceiling caused by:
- specific restrictions / weaknesses
What would be needed to reach 5:
- specific changes
```

The engine must distinguish a user/card-pool ceiling from builder failure or insufficient evidence.

---

## Next implementation target

### 1. Real learning corpus

The next major intelligence bottleneck is **data, not a larger neural network**.

Build a substantial real, independently sourced, leakage-safe Commander/cEDH outcome corpus that can support honest future temporal evaluation of the transparent and neural rankers.

Implementation direction:

- inspect `learning-corpus-v15.ts`, `research-learning-v15.ts`, `neural-temporal-eval-v15.ts`, and current source/evidence abstractions first;
- define explicit ingestion/provenance contracts before collecting large amounts of data;
- prefer public structured outcome/deck sources with stable identifiers and clear timestamps;
- distinguish decklist appearances from actual match/event outcomes;
- preserve exact deck fingerprints when full lists are available;
- record event/outcome identity so one result mirrored by several sites is not multiplied as independent evidence;
- track `independentGroup` separately from `leakageGroup`;
- assign related records to common leakage groups when information could leak across temporal splits;
- preserve source URL/identifier, observation time, event date, evidence class and freshness metadata;
- validate malformed/conflicting records and fail closed;
- keep raw/source facts separate from derived learning features and labels;
- do not scrape or redistribute source material in ways incompatible with source terms/licensing;
- add deterministic fixture-based ingestion tests first, then a live/refresh workflow separate from deterministic CI where appropriate;
- require meaningful source diversity and temporal breadth before model-promotion claims;
- neural promotion remains blocked until repeated future holdouts show genuine improvement over the transparent baseline.

Potential evidence classes include tournament/event outcomes, deck-change outcomes, independently recorded games, exact-simulation observations, verified winning-package observations and repeated recommendation failures, but they must not be treated as interchangeable labels without an explicit learning target.

### 2. Later probability / gameplay extensions

After the real corpus foundation, useful exact/statistical extensions include resource/timing-aware access (tutor mana, cast timing, commander tax/dependence) and broader simulator calibration cases. Do not expand these by silently pretending a full Magic rules engine exists.

---

## Quality gates before calling a milestone complete

- dependency install succeeds;
- strict TypeScript build succeeds;
- complete automated tests succeed;
- probability changes have independent brute-force/oracle validation where practical;
- malformed/boundary requests fail closed;
- exact probability equality uses BigInt/fractions, never display decimals;
- failed fixtures are allowed to be wrong — do not corrupt correct math to satisfy a bad test;
- hard legality/printing truth remains outside ML;
- model evaluation is leakage-safe;
- external evidence is independence-aware;
- FF-only and unrestricted controls do not regress silently;
- stable `server-current` is not changed without an explicit release/promotion decision;
- update this file after every major milestone or active-target change.

A future session must be able to recover the project from GitHub alone without needing old chat history.
