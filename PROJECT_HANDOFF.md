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

- `d40957ab2d7fd1f7ff758384efbd50c5db561770` — added `ULTIMATE_MTG_SPEC.md` master specification.
- `75d021932a13fe706ecf7881dc3e9372788c9983` — added initial persistent handoff file.
- `161d3d1acb1129381d9195d39360b7ce0812f610` — exact package probability + oracle package-order normalization; CI succeeded.
- `966bffac0a981f9aea5b828c94e6aa091de640ea` — V0.15 foundation baseline before the package branch.
- `0a4fda12c9b44374bc8f58f5b07ec2da886ea993` — V0.15 external-oracle benchmark documentation.

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

### 1. Overlap-aware exact package solver

Continue from the successful disjoint solver.

Need an exact physical-card model where a card may satisfy several possible roles but can only be assigned once in the sampled hand/line.

High-priority cases:

- universal tutor can find A or B but cannot count as both simultaneously;
- role-specific tutors;
- cards shared between alternative winning packages;
- interchangeable/redundant pieces;
- “at least one viable package” across several win routes.

Implementation direction:

- aggregate physical cards/categories by capability mask;
- exact BigInt combinatorics/DP;
- saturated requirement-state vector or equivalent matching-safe state representation;
- explicit state/work ceiling;
- choose role-count limits based on benchmarked exact workload rather than arbitrary optimism.

Tests must include an **independent exhaustive brute-force enumerator** for small overlapping-card populations.

Adversarial fixtures must prove that one universal tutor/dual-role physical card cannot satisfy two simultaneous missing roles by itself.

### 2. Commander-zone exact availability

After overlap-aware assembly is trustworthy, model commander(s) as starting outside the library rather than pretending they are normal cards in the 99/98.

Verify current Commander draw/library rules before encoding them.

### 3. Turn-by-turn exact access curves

Opening seven + natural draws, then exact/simple deterministic draw effects where feasible.

### 4. Exact-as-oracle simulation testing

For solvable scenarios, use the exact answer as truth and require Monte Carlo results to fall within statistically justified confidence/tolerance, not an arbitrary fixed margin.

### 5. Real learning corpus

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
