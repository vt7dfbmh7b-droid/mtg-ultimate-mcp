# Ultimate MTG — Project Handoff

_Last updated: 2026-08-17 NZST_

This file is the **persistent recovery point for future ChatGPT sessions**. If a chat becomes too long or loses context, start here before making changes.

## How to resume in a new chat

1. Open this repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`.
2. Read this file first.
3. Inspect the current head of branch `agent/package-probabilities` and recent commits before changing code.
4. Do **not** assume `main` is the current development state; it is behind the active V0.15 work.
5. Run/inspect CI before claiming a milestone is complete.
6. Continue from the **Next implementation target** below unless a newer commit or handoff update says otherwise.

Suggested user prompt for a fresh chat:

> Continue the Ultimate MTG project from `PROJECT_HANDOFF.md` in `vt7dfbmh7b-droid/mtg-ultimate-mcp`. Inspect the current branch/head and CI first, then continue from the next implementation target.

---

## Project goal

Build a genuinely high-confidence **Ultimate Magic: The Gathering MCP/plugin** that combines card knowledge, Commander deck building, combo analysis, legality, exact physical printings, precons, pricing, NZ availability, constrained upgrades, probability, simulation, research, bracket assessment, learning, drift detection, and adversarial/external testing.

The system must prefer **grounded, cross-checked conclusions** over confident guesses.

Core philosophy:

- exact maths when exact maths is available;
- simulation when the state space requires it;
- external/reference systems as differential test oracles, not unquestioned truth;
- disagreements become investigations and then regression fixtures;
- related oracle projects are deduplicated by independence family;
- Commander legality, exact deck construction, printing restrictions, and honest bracket ceilings remain hard gates;
- requested bracket/power must never force the engine to invent evidence or overstate a deck.

---

## Active development branch

**Primary active branch:** `agent/package-probabilities`

**Implementation baseline before this handoff file:** `161d3d1acb1129381d9195d39360b7ce0812f610`

That head passed the normal GitHub Actions quality gate after the package-probability work and oracle-normalization tests.

Important earlier milestones:

- `0a4fda12c9b44374bc8f58f5b07ec2da886ea993` — documented the V0.15 external-oracle benchmark strategy.
- `966bffac0a981f9aea5b828c94e6aa091de640ea` — exact hypergeometric engine + resource-boundary tests.
- `f23c206b08dd0b0f58f3ba9a122112dce1f68c77` — first exact package-assembly implementation.
- `161d3d1acb1129381d9195d39360b7ce0812f610` — package-order parity normalization; CI succeeded.

Temporary branches `agent/package-probabilities-2` and `agent/package-probabilities-3` were accidentally created while reconnecting write actions. They contain no unique implementation work and should not be treated as active development branches.

---

## Current exact statistics foundation

### Exact univariate hypergeometric engine

File: `src/services/exact-statistics-v15.ts`

Current behavior includes:

- BigInt combination arithmetic;
- reduced exact fractions;
- decimal presentation only, never used as proof/equality;
- event forms: exactly / at least / at most / range / zero;
- exact complement;
- expectation;
- variance;
- physical support bounds;
- hard population cap = **1,000**;
- malformed requests fail closed.

Pinned Commander fixture:

- 99-card library
- 36 lands
- 7-card opener
- probability of 3+ lands = `26,736,733 / 53,358,536 ≈ 50.1077%`

Independent brute-force enumeration covers small populations through 8 cards.

A prior variance test expected the wrong answer (`28/75`). The implementation correctly produced `14/25`; the test fixture was corrected instead of changing valid maths. Preserve this testing principle.

---

## Current exact package/combo probability layer

Files:

- `src/services/exact-package-statistics-v15.ts`
- `src/services/exact-package-statistics-v15.test.ts`

Current supported model:

- exact probability of satisfying minimum hits from multiple **disjoint** card-role buckets;
- interchangeable cards within a role;
- neutral/untracked cards in the rest of the library;
- reduced probability and complement fractions;
- favorable-hand / total-hand counts;
- per-package expectations;
- maximum package requirement count;
- explicit dynamic-programming work ceiling;
- malformed or overlapping-count requests fail closed;
- exhaustive independent labeled-card enumeration for small two-package populations through 8 cards.

Pinned example:

- 99-card library
- 7 cards drawn
- two unique singleton combo pieces
- exact probability of both = `1 / 231 ≈ 0.4329004329%`
- favorable hands = `64,446,024`
- total hands = `14,887,031,544`

### Critical limitation

The current package solver assumes the package buckets are **disjoint physical-card sets**.

It deliberately does **not** double-count tutors or cards that can satisfy multiple roles.

Example of what is not yet fully modeled:

- Walking Ballista
- The Destined White Mage
- Demonic Tutor
- Imperial Seal
- tutors that can find either piece
- tutors that can only find one piece
- alternative combo packages sharing cards

A tutor that can satisfy either role cannot simply be counted as an extra copy in both roles.

---

## External oracle / benchmark layer

Key V0.15 files include:

- `src/services/external-oracles-v15.ts`
- `src/services/external-oracle-adapters-v15.ts`
- `src/services/external-oracle-pins-v15.ts`
- corresponding tests
- `docs/V0.15_EXTERNAL_ORACLE_BENCHMARKS.md`

Initial oracle/reference families:

### `j4th/mtg-mcp-server`

- MIT
- independent MCP / Commander / deck-workflow comparison target
- useful for card/deck/rules/workflow behavior

### `nccurry/mtg-mcp`

- AGPL-3.0-or-later
- statistics/evidence/provenance/reproducibility architecture reference
- use primarily as behavioral/architecture reference unless licensing is deliberately reconsidered

### `Card-Forge/forge`

- GPL-3.0
- mature rules/simulation reference engine

### `witchesofthehill/manabrew`

- AGPL/GPL-derived
- parity-harness methodology reference
- uses Forge as its reference, therefore **Forge + Manabrew count as one `forge-family`**, not two independent confirmations

External mismatch policy:

1. Same input/scenario/version/seed where possible.
2. Normalize semantic outputs.
3. Compare exact paths.
4. A disagreement means **investigate**, not “obey the oracle.”
5. Determine whether Ultimate MTG, the external system, adapter, normalization, version pin, or fixture is wrong.
6. Once understood, save the scenario as a permanent regression fixture.

Long-term target: hundreds or thousands of known tricky MTG situations accumulated as permanent regression cases.

Package-probability normalization now removes presentation decimals and compares exact numerator/denominator semantics. Package order is canonicalized so equivalent role order cannot cause a false mismatch.

---

## Permanent real-world benchmark: Final Fantasy-only Bracket 5 challenge

This test must remain part of development.

Challenge:

> Build the strongest possible Commander deck using **only legitimate Final Fantasy physical printings**, while targeting Bracket 5, and report the honest ceiling if the restriction cannot truly support Bracket 5.

Why this benchmark matters:

It pressures many systems simultaneously:

- exact physical printing verification;
- Final Fantasy-only restriction enforcement;
- Commander color identity;
- 100-card legality and singleton construction;
- combo discovery and verification;
- tutors / functional redundancy;
- mana consistency;
- interaction and protection density;
- multiple win routes;
- exact package probabilities;
- simulation;
- research/oracle comparisons;
- honest bracket ceiling.

The engine must **not** call a deck Bracket 5 merely because the user asked for Bracket 5.

Keep a second control benchmark as well:

> Build the strongest unrestricted Bracket 5 / cEDH Commander deck.

Comparing the constrained FF-only deck with the unrestricted deck helps detect optimizer shortcuts, illegal printings, bracket inflation, and restriction leakage.

User preference for FF builds: do not reduce them to a single infinite combo. Preserve viable combat/value/commander routes when they materially improve the deck.

---

## Next implementation target

### 1. Overlap-aware exact package solver

Add an exact model for physical cards that can satisfy more than one role without double-counting.

High-priority cases:

- generic tutors that can find either combo piece;
- role-specific tutors;
- one physical card shared across multiple alternative packages;
- redundant pieces;
- “at least one viable package” across multiple win lines;
- Commander-zone pieces that are always available rather than drawn;
- cards beginning in command zone vs library population.

The representation must make physical-card identity explicit enough that the same card cannot be credited twice in one hand.

### 2. Turn-by-turn access curves

After exact overlap-aware assembly is reliable:

- opening 7;
- after draw steps;
- by turns 1/2/3/4/5;
- commander-aware availability;
- simple deterministic draw effects where exact treatment is possible.

Desired future query:

> What is the probability this 99-card Commander deck has access to a viable Cloud/FF win package by turn 4, accounting for tutors, interchangeable pieces and the commander?

### 3. Exact-as-oracle simulation validation

Use exact solvable cases to test the Monte Carlo simulator automatically.

For a scenario with an exact answer:

- exact engine provides truth fixture;
- simulation runs a pinned seed/sample count;
- result must fall inside a justified tolerance/confidence interval;
- meaningful drift becomes a regression failure/investigation.

### 4. External snapshot parity for statistics

Add normalized package-probability benchmark snapshots using the existing external-oracle layer, with `nccurry-mtg-mcp` as the independent statistics-methodology reference where appropriate.

Do not copy AGPL implementation into the Ultimate MTG core.

---

## Quality gates

Before declaring a new milestone complete:

- dependency install succeeds;
- strict TypeScript build succeeds;
- complete automated test suite succeeds;
- new probability logic has an independent test/oracle where practical;
- malformed/boundary requests fail closed;
- exact equality uses fractions/BigInt, not floating-point decimals;
- a failed test fixture is allowed to be wrong — never change correct implementation merely to satisfy an incorrect fixture;
- external agreement is corroboration only;
- related external projects are lineage-deduplicated;
- permanent FF-only and unrestricted Commander benchmark behavior is not allowed to regress silently.

---

## Handoff maintenance rule

**Update this file after every major project milestone or whenever the active branch/next target changes.**

A future ChatGPT session should be able to recover the project with only:

- repository access;
- this file;
- current branch/commit history;
- CI results.

Do not rely on old chat history being available.
