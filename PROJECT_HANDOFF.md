# Ultimate MTG — Project Handoff

_Last updated: 2026-08-17 NZST_

This file is the **persistent recovery point for future ChatGPT sessions**. If a chat becomes too long or loses context, start here.

For the complete long-term product/engineering goals, also read **`ULTIMATE_MTG_SPEC.md`**. The spec is the north star; this file is the current implementation handoff.

## Fresh-chat resume instructions

1. Open `vt7dfbmh7b-droid/mtg-ultimate-mcp`.
2. Read `PROJECT_HANDOFF.md` and `ULTIMATE_MTG_SPEC.md` first.
3. Inspect the current head and recent commits of `agent/package-probabilities` before making changes.
4. Inspect CI for that exact head.
5. Do **not** assume `main` is the current development state.
6. Do **not** promote `server-current` merely because V0.14/V0.15 code exists.
7. Continue from **Next implementation target** unless newer commits update this handoff.

Suggested fresh-chat prompt:

> Continue the Ultimate MTG project from `PROJECT_HANDOFF.md` and `ULTIMATE_MTG_SPEC.md` in `vt7dfbmh7b-droid/mtg-ultimate-mcp`. Inspect the active branch/head and CI first, then continue from the next implementation target.

---

## Repository / release state

**Active continuation branch:** `agent/package-probabilities`

Important current/recent commits:

- `2f45b1381d525bd2a3bdfaf719894f2c8d5d5c2e` — commander-zone exact availability hardened for impossible alternative routes; CI succeeded.
- `f5b2c4121655b407d0f78bc85c1ae4b8ef368fb6` — strict TypeScript callback typing fix during commander-zone work.
- `c33d8a47d732b6aff09758133d8379678e084d2b` — commander-zone exact availability tests, including independent exhaustive enumeration.
- `d529e326181cf0453eeb68568d51796fd6472293` — added commander-zone exact package availability implementation.
- `7ccc34b11ad2a0ba5f2fb77b2bb825fbdc0162ea` — advanced the handoff after the overlap-aware exact milestone; CI succeeded.
- `17bcfcc6819fcf9ef43ed5a8d14bcd9dc371ee6a` — overlap-aware exact package solver exhaustive/adversarial tests; CI succeeded.
- `e126bf436ae0b1c2cae1b9f2e0ec74127b6311fd` — added the overlap-aware exact physical-card package solver.
- `161d3d1acb1129381d9195d39360b7ce0812f610` — exact disjoint package probability + oracle package-order normalization; CI succeeded.
- `966bffac0a981f9aea5b828c94e6aa091de640ea` — V0.15 foundation baseline before the package branch.
- `0a4fda12c9b44374bc8f58f5b07ec2da886ea993` — V0.15 external-oracle benchmark documentation.

The commander-zone implementation head `2f45b1381d525bd2a3bdfaf719894f2c8d5d5c2e` passed the normal CI quality gate: dependency install, strict TypeScript build and the complete automated test suite all succeeded.

Temporary accidental branches `agent/package-probabilities-2` and `agent/package-probabilities-3` contain no unique work and are not active.

### Stable runtime remains V0.13

Verified repository facts:

- `package.json` version is `0.13.0`.
- `src/server-current.ts` returns `createMtgServerV13()`.
- The draft PR remains intentionally unmerged.

Preserve this separation while V0.14/V0.15 intelligence is hardened.

---

## Foundation already present

The project already has substantial infrastructure for:

- Commander legality, 100-card validation, color identity, partners/singleton rules;
- exact Oracle vs physical-printing identity and themed printing restrictions;
- MTGJSON stock Commander precons;
- full-deck building and iterative refinement;
- competing upgrade packages, protected/excluded/must-include cards, exact IN/OUT tracking;
- NZD-first pricing/budgets with source-value auditability;
- Scryfall, Commander Spellbook, tournament/deck evidence and source diagnostics;
- deterministic simulations and real E2E Commander tests;
- V0.14 cEDH readiness, combo completion, competitive refinement and from-scratch competitive building;
- V0.15 bracket ceiling/evidence, research/learning, metagame drift, neural ranking, exact statistics and external-oracle work.

Previous engineering judgement put this at roughly **80–85% toward a strong V1 foundation**, but that is not a measured project metric.

---

## Permanent truth hierarchy

Machine learning and optimization **may never override**:

- Commander legality;
- unresolved-card failures;
- exact 100-card construction;
- color identity/singleton constraints;
- banned/legal facts;
- exact physical-printing existence/restrictions;
- known rules facts and verified combo requirements.

Requested power/bracket is a target, not a forced result.

---

## V0.14 competitive / winning-package state

Relevant files include:

- `src/server-v14.ts`
- `src/services/cedh-workflow-v14.ts`
- `src/services/cedh-workflow-nzd-v14.ts`
- `src/services/cedh-combo-completion-v14.ts`
- `src/services/cedh-win-package-v14.ts`
- `src/services/cedh-seed-package-v14.ts`
- `src/services/cedh-refinement-v14.ts`
- `src/services/cedh-manabase-v14.ts`
- `src/services/cedh-efficiency-v14.ts`

V0.14 explicitly distinguishes **strong competitive construction signals** from automatic Bracket 5 certification.

General product requirement still stands: deliberate winning-package discovery should find compact Commander-legal packages, verify every component against user restrictions, verify the line actually wins/achieves its claimed result, then seed the best appropriate package before filling the rest of the deck.

A past FF test caught a Ruthless-tagged interaction that generated huge life rather than a true win. Preserve this as a regression principle: popularity/tags/strength signals are not proof of an actual win.

---

## V0.15 research + learning state

Real V0.15 learning code exists on the inherited foundation and therefore in the package continuation branch.

Key files:

- `src/services/research-learning-v15.ts`
- `src/services/research-learning-v15-quality.test.ts`
- `src/services/learning-corpus-v15.ts`
- `src/services/learning-corpus-v15.test.ts`
- `src/services/neural-ranker-v15.ts`
- `src/services/neural-ranker-v15.test.ts`
- `src/services/neural-temporal-eval-v15.ts`
- `src/services/neural-temporal-eval-v15.test.ts`
- `src/services/metagame-drift-v15.ts`

### Neural model

Current implementation is a deterministic **two-hidden-layer MLP** with backpropagation and L2 regularisation.

It is a **shadow/experimental model**. It must not be promoted merely because synthetic tests work.

The transparent model remains the baseline. Neural promotion requires meaningful unseen holdout data and repeated evidence that the neural candidate outperforms the transparent model.

### Leakage prevention / corpus

`learning-corpus-v15.ts`:

- fingerprints exact decks using zone, quantity, normalized name, set, collector number and finish;
- tracks `independentGroup` and `leakageGroup` separately;
- deduplicates repeated underlying outcomes without treating every identical deck appearance as the same event;
- detects malformed/conflicting records;
- performs time-based train/holdout splits while keeping leakage groups together;
- exposes leakage-check results.

`neural-temporal-eval-v15.ts` evaluates neural and transparent models on the same later temporal holdout and includes metagame-drift gating.

### Intended learning loop

**research → cross-check → build → simulate → test → observe outcome → learn → retest**

Next major ML step is **not a larger neural network**. It is building a real, independently sourced, leakage-safe Commander/cEDH outcome corpus so recommendations can learn from actual deck changes, matches/events, simulations, verified win packages and repeated failures.

---

## Exact statistics foundation

### Univariate exact engine

File: `src/services/exact-statistics-v15.ts`

Includes BigInt hypergeometric arithmetic, reduced exact fractions, complement, expectation, variance, physical support, malformed-request checks and population cap 1,000.

Pinned Commander fixture:

- population/library: 99
- lands: 36
- draw: 7
- P(3+ lands) = `26,736,733 / 53,358,536 ≈ 50.1077%`

Decimals are presentation only; exact fractions are the proof/equality surface.

### Disjoint package engine

Files:

- `src/services/exact-package-statistics-v15.ts`
- `src/services/exact-package-statistics-v15.test.ts`

Supports exact multivariate package assembly for **disjoint physical role buckets**.

Pinned example:

- 99-card library
- draw 7
- two unique singleton pieces
- probability both appear = `1 / 231 ≈ 0.4329004329%`
- favorable hands = `64,446,024`
- total hands = `14,887,031,544`

The implementation intentionally does **not** double-count tutors/multi-role physical cards.

Oracle normalization in `external-oracle-adapters-v15.ts` compares exact semantic values, strips presentation decimals, and canonicalizes package order.

### Overlap-aware package engine — milestone complete

Files:

- `src/services/exact-overlap-package-statistics-v15.ts`
- `src/services/exact-overlap-package-statistics-v15.test.ts`

The solver models disjoint **physical-card categories by capability**, allowing a physical card to be capable of several roles while assigning that card to at most one role in any simultaneous package fulfillment.

Implementation properties:

- exact BigInt hand combinatorics;
- saturated role-requirement vectors;
- a canonical Pareto frontier of attainable role assignments so physical-card identity remains matching-safe;
- exact union across several alternative winning/package routes without double-counting the same sampled hand;
- role-specific tutors, universal tutors, interchangeable pieces and shared cards are representable;
- irrelevant capability categories collapse into neutral cards for the exact sample-space count;
- malformed inputs fail closed;
- explicit role/route/category/frontier/DP-state/work ceilings prevent uncontrolled combinatorial growth.

Current conservative ceilings:

- maximum roles: 16;
- maximum routes: 32;
- maximum physical-card categories: 64;
- maximum frontier states: 512;
- maximum DP states: 20,000;
- maximum transition work: 500,000.

The role ceiling was selected from synthetic 99-card / draw-7 workload benchmarking rather than assuming arbitrary unbounded overlap complexity. The independent state/frontier/work ceilings remain the authoritative safety stops.

Validation includes an **independent labeled-card exhaustive brute-force matching enumerator** for small overlapping populations. The exhaustive fixture spans A-only, B-only and A-or-B physical cards across populations 2–6 and all draw counts, comparing exact reduced fractions against the production solver.

Permanent adversarial regressions include:

- one universal A/B tutor by itself cannot satisfy both A and B simultaneously;
- a universal tutor can satisfy exactly one missing role next to a real piece;
- alternative routes that share a physical role are unioned without hand double-counting;
- role-specific and universal tutors remain matching-safe with redundant pieces;
- impossible package requirements return exact zero;
- pathological broad-overlap requests stop at the explicit work ceiling.

CI succeeded for implementation/test head `17bcfcc6819fcf9ef43ed5a8d14bcd9dc371ee6a`.

### Commander-zone exact availability — milestone complete

Files:

- `src/services/exact-commander-zone-statistics-v15.ts`
- `src/services/exact-commander-zone-statistics-v15.test.ts`

Current Commander rules were verified against the Wizards Comprehensive Rules effective **2026-08-07** before encoding this layer. Relevant rules include:

- 903.5a — a normal Commander deck contains exactly 100 cards including its commander;
- 103.2c / 903.6 — commander cards are moved from the deck to the command zone before the remaining deck becomes the library;
- 103.5 / 903.7 — normal starting hand size is seven;
- configurations with two legal commanders therefore leave 98 physical cards in a normal 100-card Commander library after both commanders begin in the command zone.

The statistical service intentionally does **not** hard-code a 100-card deck. `deckSize` is supplied by the caller and `libraryPopulation` is derived by subtracting the known physical command-zone cards. Commander legality and whether a multi-commander configuration is actually legal remain separate hard-truth concerns.

Implementation properties:

- command-zone cards are guaranteed known physical cards, not random draws;
- one command-zone physical card may be capable of several roles but can be assigned to at most one simultaneous role;
- a Pareto-maximal command-zone assignment frontier reduces already-satisfied route requirements before library probability is calculated;
- residual alternative routes are Pareto-pruned under OR semantics before being passed to the existing overlap-aware library solver;
- one flexible commander cannot satisfy two missing simultaneous roles by itself;
- two separate flexible commanders may satisfy two roles separately;
- impossible alternative routes collapse to exact zero rather than invalidating an otherwise valid OR-query;
- category counts are checked against the **derived library population**, preventing a commander from being counted both as guaranteed availability and as a fictitious library copy;
- command-zone frontier and work ceilings fail closed on pathological requests;
- exact BigInt/fraction results remain the proof surface.

Pinned standard Commander examples:

- one commander, 100-card deck → 99-card library; drawing a unique required payoff in the opening seven is exactly `7 / 99`;
- two commanders, 100-card deck → 98-card library; drawing a unique required payoff in the opening seven is exactly `1 / 14`.

Validation includes an **independent labeled-card brute-force matcher** combining guaranteed command-zone physical cards with all small sampled library hands. It checks one- and two-commander configurations, A-only/B-only/A-or-B cards, alternative routes and all supported draw counts in the small fixture space.

The first commander-zone CI pass exposed strict callback typing, which was fixed without weakening TypeScript. A later full-test pass exposed two fixture/boundary assumptions; the implementation was hardened so impossible alternative routes are exact-zero cases while truly malformed library populations still fail closed. Final implementation head `2f45b1381d525bd2a3bdfaf719894f2c8d5d5c2e` passed dependency install, strict build and the complete test suite.

---

## Permanent benchmark controls

### Control A — Final Fantasy-only Bracket 5 attempt

Keep this forever:

> Build the strongest possible Commander deck using only legitimate Final Fantasy physical printings, target Bracket 5, and report the honest ceiling if the restriction cannot support Bracket 5.

This tests printing enforcement, legality, color identity, exact deck construction, winning packages, tutor/redundancy reasoning, mana, interaction/protection, multiple win routes, probability, simulation and bracket honesty.

For FF builds, do not automatically collapse the deck into only one infinite line when combat/value/commander routes materially belong to the deck identity.

Relevant E2E/probe files already include:

- `scripts/e2e-ff-bracket5.ts`
- `scripts/e2e-ff-cedh-refine.ts`
- `scripts/probe-ff-win-packages.ts`

### Control B — unrestricted cEDH

Keep this forever:

> Build a genuine competitive Commander deck without the FF printing restriction.

`scripts/e2e-unrestricted-cedh-v15.ts` uses **Kinnan, Bonder Prodigy** and asserts:

- complete 100-card deck;
- Commander legality;
- every exact identifier resolves;
- at least one verified deterministic Commander Spellbook winning combo;
- low curve;
- free interaction;
- fast mana;
- strong competitive construction signals;
- no practical fallback to the clunky Leveler line.

The FF vs unrestricted comparison helps tell whether a ceiling comes from the user's restriction or from the builder itself.

---

## External oracle strategy

Registered/reference families:

- `j4th-mtg-mcp` — independent MCP/deck workflow reference, MIT;
- `nccurry-mtg-mcp` — statistics/evidence/reproducibility architecture reference, AGPL;
- `forge` — mature rules/simulation reference, GPL;
- `manabrew` — parity methodology using Forge, therefore the same `forge-family` independence group.

Rules:

- external mismatches trigger investigation, not obedience;
- deduplicate related projects by independence group;
- pin versions/snapshots for deterministic comparisons;
- live external benchmarks remain separate from deterministic CI where appropriate;
- shrink generated failures and save resolved cases as permanent regressions;
- respect licenses; behavioral comparison is not permission to copy implementation.

---

## General honest bracket result format

This should become common across precon upgrades, budgets, themes, collection builds and cEDH:

```text
Requested: Bracket 5
Achieved: High Bracket 4
Confidence: High
Ceiling caused by:
- specific restriction/weaknesses
What would be needed to reach 5:
- specific changes
```

The engine must distinguish user/card-pool ceiling from builder failure or insufficient evidence.

---

## Next implementation target

### 1. Turn-by-turn exact access curves

The commander-zone exact availability milestone is complete and trustworthy enough to build on.

Next, expose exact access probability at ordered game checkpoints: opening hand, then natural draws by turn, then selected deterministic draw effects where exact treatment remains tractable.

Current rules nuance verified from the Wizards Comprehensive Rules effective **2026-08-07**:

- rule 103.8a — in a two-player game, the starting player skips the draw step of their first turn;
- rule 103.8c — in other multiplayer games, no player skips the draw step of their first turn.

Therefore **do not hard-code “opening seven + one card every turn” for every Commander game**. Commander can be played in different player-count/starting-player contexts. The exact curve API should make the natural-draw schedule explicit or derive it from an explicit game context.

Implementation direction:

- keep the opening hand checkpoint distinct from turn draw checkpoints;
- support at least: two-player starting player, two-player non-starting player, and ordinary multiplayer Commander natural-draw schedules, or an equivalent explicit schedule input;
- reuse the commander-zone/overlap exact solver at each cumulative-draw checkpoint rather than reimplement package matching;
- return exact fractions per checkpoint, with decimals only for presentation;
- preserve monotonicity for pure cumulative-access curves: additional natural draws cannot reduce probability of having access to an already-defined package;
- make the library-exhaustion boundary explicit;
- add independent closed-form/brute-force fixtures for singleton access and small overlapping packages;
- distinguish “seen/accessed by this turn” from castability/mana/timing — those resource-aware constraints remain a later layer;
- after natural draws are solid, add only simple deterministic extra-draw effects whose timing and card-count semantics are explicit; do not silently model conditional engines as guaranteed draws.

### 2. Exact-as-oracle simulation testing

For solvable scenarios, use the exact answer as truth and require Monte Carlo results to fall within statistically justified confidence/tolerance, not an arbitrary fixed margin.

### 3. Real learning corpus

Parallel/next major intelligence work: assemble independently sourced real Commander/cEDH outcomes with exact deck fingerprints, temporal coverage, evidence independence and leakage groups. Do not promote the neural ranker until it repeatedly wins against the transparent baseline on genuinely unseen future records.

---

## Quality gates before calling a milestone complete

- dependency install succeeds;
- strict TypeScript build succeeds;
- complete automated tests succeed;
- probability changes have independent brute-force/oracle validation where practical;
- malformed/boundary requests fail closed;
- exact probability equality uses BigInt/fractions, not float decimals;
- failed fixtures are allowed to be wrong — do not corrupt correct math to satisfy a bad test;
- hard legality/printing truth remains outside ML;
- model evaluation is leakage-safe;
- external evidence is independence-aware;
- FF-only and unrestricted controls do not regress silently;
- stable `server-current` is not changed without an explicit release/promotion decision;
- update this file after the milestone.

---

## Handoff maintenance rule

**Update `PROJECT_HANDOFF.md` after every major implementation milestone or active-branch/next-target change.**

**Update `ULTIMATE_MTG_SPEC.md` whenever the long-term product or architectural goals change.**

A future session must be able to recover the project from GitHub alone without needing old chat history.
