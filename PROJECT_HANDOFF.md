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

- `85029cdfbe12bd8ecb0b81cbb11b197bfe35128a` — exact turn/access-curve tests; CI succeeded.
- `29cb99290467c26795e23fbb1c093336322d0271` — exact turn/access-curve implementation.
- `5cd526b5e918db337c9b012a30d58c6a2e3900cf` — handoff after commander-zone milestone; CI succeeded.
- `2f45b1381d525bd2a3bdfaf719894f2c8d5d5c2e` — commander-zone exact availability hardened for impossible alternative routes; CI succeeded.
- `c33d8a47d732b6aff09758133d8379678e084d2b` — commander-zone exact tests with independent enumeration.
- `d529e326181cf0453eeb68568d51796fd6472293` — commander-zone exact implementation.
- `17bcfcc6819fcf9ef43ed5a8d14bcd9dc371ee6a` — overlap-aware package solver exhaustive/adversarial tests; CI succeeded.
- `e126bf436ae0b1c2cae1b9f2e0ec74127b6311fd` — overlap-aware exact package solver.
- `161d3d1acb1129381d9195d39360b7ce0812f610` — disjoint exact package probability + oracle normalization; CI succeeded.
- `966bffac0a981f9aea5b828c94e6aa091de640ea` — V0.15 foundation baseline before the package branch.

The access-curve implementation/test head `85029cdfbe12bd8ecb0b81cbb11b197bfe35128a` passed dependency install, strict TypeScript build, and the complete automated test suite.

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

Pinned Commander fixture:

- library 99;
- 36 lands;
- draw 7;
- P(3+ lands) = `26,736,733 / 53,358,536 ≈ 50.1077%`.

Decimals are presentation only; exact fractions are the equality/proof surface.

### Disjoint package assembly — complete

Files:

- `src/services/exact-package-statistics-v15.ts`
- `src/services/exact-package-statistics-v15.test.ts`

Exact multivariate package assembly for disjoint physical role buckets.

Pinned example: in a 99-card library, opening seven containing two unique singleton pieces is exactly `1 / 231`.

### Overlap-aware physical package assembly — complete

Files:

- `src/services/exact-overlap-package-statistics-v15.ts`
- `src/services/exact-overlap-package-statistics-v15.test.ts`

Properties:

- physical-card categories are grouped by capability mask;
- one physical card may qualify for several roles but can satisfy only one simultaneous role;
- Pareto-frontier matching state prevents tutor/multi-role double counting;
- alternative package routes are unioned exactly without double-counting sampled hands;
- role-specific and universal tutors, interchangeable pieces and shared cards are representable;
- malformed inputs and pathological workloads fail closed.

Conservative ceilings: 16 roles, 32 routes, 64 categories, 512 frontier states, 20,000 DP states, 500,000 transitions.

Independent labeled-card exhaustive enumeration validates small populations. Permanent regressions include the rule that one universal A/B tutor cannot satisfy both missing A and B by itself.

### Commander-zone exact availability — complete

Files:

- `src/services/exact-commander-zone-statistics-v15.ts`
- `src/services/exact-commander-zone-statistics-v15.test.ts`

Commander rules were verified against the Wizards Comprehensive Rules effective **2026-08-07** before encoding this layer.

Properties:

- command-zone cards are guaranteed known physical cards, not random draws;
- `libraryPopulation = deckSize - commandZoneCards.length`; the statistics API does not hard-code 100;
- legality of a multi-commander configuration remains a separate hard gate;
- flexible command-zone cards preserve one-physical-card/one-simultaneous-role semantics;
- guaranteed assignments reduce route requirements before library probability is evaluated;
- residual OR-routes are Pareto-pruned;
- impossible alternatives become exact-zero alternatives rather than poisoning an otherwise valid OR-query;
- category counts are checked against the derived library population so commanders cannot be counted twice.

Pinned standard Commander examples:

- one commander, 100-card deck → 99-card library; unique payoff in opening seven = `7 / 99`;
- two commanders, 100-card deck → 98-card library; unique payoff in opening seven = `1 / 14`.

Independent brute-force matching validates small command-zone + library populations.

### Turn-by-turn exact access curves — complete

Files:

- `src/services/exact-access-curve-v15.ts`
- `src/services/exact-access-curve-v15.test.ts`

Current rules nuance from the Wizards Comprehensive Rules effective **2026-08-07** is encoded explicitly:

- two-player starting player skips the first draw step;
- two-player non-starting player draws on turn one;
- ordinary multiplayer players do not skip their first draw step.

Supported natural-draw contexts:

- `two-player-starting`;
- `two-player-non-starting`;
- `multiplayer`.

Properties:

- opening hand is a distinct checkpoint;
- every turn reports exact cumulative package-access probability;
- the commander-zone/overlap solver is reused rather than reimplementing matching;
- exact fractions are retained at every checkpoint;
- pure cumulative access is checked for monotonicity with exact BigInt cross-multiplication;
- explicit guaranteed extra-draw events may be supplied by turn;
- conditional draw engines are **not** silently treated as guaranteed draws;
- attempted draws beyond library exhaustion are flagged while the physical seen-card count is capped at the library size;
- identical cumulative draw counts reuse cached exact results;
- at most 16 distinct exact-solver evaluations are allowed per curve to prevent multiplying expensive exact work without bound;
- this remains an **access/visibility** curve, not a castability, mana, timing, or disruption model.

Pinned examples:

- multiplayer, one commander, singleton target in 99-card library: opening seven `7/99`, turn one `8/99`, turn two `1/11`, turn three `10/99`;
- two-player starting player: cumulative counts opening/T1/T2 = `7, 7, 8`;
- two-player non-starting player: `7, 8, 9`.

Validation includes closed-form singleton combinatorics, monotonicity, library-exhaustion fixtures and an independent labeled-card brute-force enumerator for a flexible A/B commander with overlapping package roles.

Implementation/test head `85029cdfbe12bd8ecb0b81cbb11b197bfe35128a` passed normal CI.

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

### 1. Exact-as-oracle simulation testing

Use exact-solvable probability scenarios as truth for Monte Carlo validation.

Implementation direction:

- inspect the existing simulation services before adding a parallel simulator;
- identify simulation events that have an exact equivalent in the univariate/package/commander-zone/access-curve engines;
- use fixed seeds and explicit sample counts;
- compare simulated Bernoulli success rates with exact probability using a statistically justified binomial confidence/tolerance calculation rather than a fixed arbitrary percentage margin;
- handle p=0 and p=1 boundaries explicitly;
- make the false-failure level / confidence rule explicit and testable;
- test several probability regimes, including rare events and mid-probability events;
- preserve exact fractions as the oracle surface;
- if a deterministic seeded simulation falls outside the justified band, investigate simulator bias, event-definition mismatch, seed/pathology, or the statistical test before changing the exact engine;
- keep this calibration layer separate from full Magic rules-engine ambitions.

### 2. Real learning corpus

Parallel/next major intelligence work: assemble independently sourced real Commander/cEDH outcomes with exact deck fingerprints, temporal coverage, evidence independence and leakage groups. Do not promote the neural ranker until it repeatedly beats the transparent baseline on genuinely unseen future records.

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
