# Ultimate MTG — Project Handoff

_Last updated: 2026-08-18 NZST_

This is the persistent recovery point for future ChatGPT sessions. Read it together with `ULTIMATE_MTG_SPEC.md`: the spec is the north star; this file records the current implementation state, hard guarantees, validated controls, and next target.

## Fresh-chat resume instructions

1. Open `vt7dfbmh7b-droid/mtg-ultimate-mcp`.
2. Read `PROJECT_HANDOFF.md` and `ULTIMATE_MTG_SPEC.md` first.
3. Inspect `agent/package-probabilities`; do not assume `main` is the active development state.
4. Inspect deterministic CI for the exact active-branch head before changing code.
5. Keep live external controls separate from deterministic CI evidence.
6. Do not promote `server-current` merely because V0.14/V0.15 code exists.
7. Continue from **Next implementation target** unless a newer commit changes this handoff.

---

## Repository / release state

**Active continuation branch:** `agent/package-probabilities`

**Latest fully validated implementation head before this handoff-only documentation commit:**

- `8d6b8c99a1a9b9a453323af3b056d284fb19e4c0` — live-source reliability hardening, general winning-package discovery, shared post-build Commander evaluation, universal Commander build pipeline foundation, source-outage-aware evidence semantics, and requested-vs-achieved bracket comparison.

Validation on that exact implementation head:

- strict TypeScript build: PASS;
- complete deterministic automated tests: PASS;
- Universal Commander Build Pipeline live control: PASS;
- live control case: exact `Najeela, the Blade-Blossom (FCA) 42`, Final Fantasy physical printings only, requested Bracket 4, verified win packages preferred;
- result: exact legal 100-card deck, FF printing policy satisfied, achieved **Bracket 4 / bracket-4-optimized-range**, target status **reached**, target gap `0`;
- winning-package discovery completed and honestly returned **no verified FF-valid package**; no package was invented or forced;
- final external evidence completed successfully;
- live artifact from the exact-head control: GitHub Actions artifact ID `9313202187`, SHA-256 `16e46988d62f7d2390aae1a4b6910ab63708f3550e7aea7d67f3993f57307bd6`.

Important preceding reliability commit:

- `33a65f912155692e2c03c76b6d7022e2d830d203` — bounded provider-aware retries for known idempotent live read endpoints; all permanent live Commander controls subsequently completed successfully on the reliability implementation.

### Stable runtime remains V0.13

- `package.json` remains `0.13.0`.
- `src/server-current.ts` deliberately returns `createMtgServerV13()`.
- V0.14/V0.15 remain experimental.
- PR #2 remains a draft validation surface, not a release/promotion PR.

**Do not change the stable runtime without an explicit release/promotion decision from the user after the V1 quality gates are met.**

---

## Permanent truth hierarchy

Machine learning, optimization, simulation, external evidence, requested power, or popularity may never override:

- Commander legality;
- unresolved-card failures;
- exact deck construction;
- color identity / singleton constraints;
- current banned/legal facts;
- exact physical-printing existence and restrictions;
- known rules facts and verified combo requirements.

Requested power/bracket is a target, not a forced result.

A source outage is not evidence that a combo/card/property is absent. Missing verification must be reported as unavailable/incomplete evidence and must never create positive credit.

---

## Current Commander/deckbuilding foundation

The branch contains substantial infrastructure for:

- Commander legality, exact 100-card validation, partners, singleton and color identity;
- Oracle identity vs exact physical-printing identity and themed-printing restrictions;
- MTGJSON stock Commander precons;
- full-deck building/upgrading with protected, excluded and must-include cards plus exact IN/OUT tracking;
- NZD-first pricing/budgets with source auditability;
- Scryfall, Commander Spellbook, tournament/deck evidence and source diagnostics;
- deterministic simulation and Commander E2E scenarios;
- V0.14 competitive/cEDH workflows;
- V0.15 target-free bracket assessment, requested-vs-achieved ceiling comparison, research/learning, drift detection, exact statistics and real-corpus safety foundations.

### Neutral Commander selection/building

The neutral FF experiment remains a permanent anti-bias control:

- no commander supplied;
- no bracket/power target;
- no strongest/cEDH/high-power intent;
- no hidden `targetBracket=5` or V0.7 default-Bracket-4 fallback;
- commander ranking is semantic/strategy based rather than name, EDHREC rank, color count, mana value or reputation;
- the completed neutral Najeela build was honestly assessed **Bracket 3**.

This does **not** downgrade the separate optimized FF-only Najeela benchmark, which remains high Bracket 4.

DFC regression remains fixed: canonical double-faced commanders such as `Garland, Knight of Cornelia // Chaos, the Endless` use the front-face name only for Scryfall lookup and then revalidate the returned canonical card identity.

---

## Milestone 1 — live-source reliability complete

### Shared HTTP reliability

`src/lib/http.ts`, `src/lib/http.test.ts`, `src/config.ts`

Key behavior:

- retries only known idempotent read requests;
- Scryfall `POST /cards/collection` can retry transient failures;
- Commander Spellbook read-only analysis POSTs can retry transient failures;
- arbitrary POSTs such as TopDeck ingestion remain one-shot/no automatic retry;
- transient HTTP statuses include 408/425/429/500/502/503/504;
- `Retry-After` is respected;
- caller aborts are never retried;
- failures preserve provider, method, URL, attempts, timeout and cause telemetry;
- provider-specific timeout/retry budgets are configurable by environment.

### Evidence-safe Commander Spellbook semantics

`src/services/spellbook.ts`, `src/services/spellbook.test.ts`

Three distinct operations now exist intentionally:

1. strict operations when positive verification is required;
2. evidence-safe assessment wrappers that return zero positive evidence plus explicit unavailable provenance on transient failure;
3. advisory bracket evidence that may degrade to unavailable without crashing an otherwise legal build.

Important distinctions:

- `estimateCommanderBracket()` transient failure => `sourceStatus: unavailable`, no positive bracket/tag signal;
- `findDeckCombosEvidence()` transient failure => zero positive combo evidence, `verificationComplete: false`; this is **not** proof that no combo exists;
- `searchSpellbookVariantsEvidence()` transient failure => discovery incomplete/unavailable, not “no package exists”;
- non-transient client/input failures still throw;
- strict combo-completion paths remain strict where a verified combo is required.

---

## Milestone 2 — universal Commander build pipeline foundation complete

### General winning-package discovery

`src/services/general-win-package-v15.ts`
`src/services/general-win-package-v15.test.ts`

The system now deliberately searches winning packages before construction instead of hoping a draft happens to contain one.

Properties:

- searches Commander Spellbook `is:winning` variants without requiring Ruthless/cEDH tags;
- rejects impressive but non-winning outcomes such as infinite life when they do not actually win;
- obeys `mustBeCommander`, exclusions and Commander color identity;
- verifies exact eligible physical printings under the active printing policy;
- supports package-size bounds;
- ranks compactness, commander overlap, mana value, reusable utility roles and dead-piece risk;
- popularity is never a truth gate;
- exact printing and rejection audit is retained;
- canonical color identity is always WUBRG-ordered before Spellbook queries (`BGRUW` regression fixed);
- repeated exact-printing checks are cached inside one discovery run;
- returns three distinct outcomes: verified package found, completed search found no verified package, or verification unavailable/partial.

### Shared post-build truth/evaluation

`src/services/commander-build-evaluation-v15.ts`
`src/services/commander-build-evaluation-v15.test.ts`

Every pipeline build can now go through one common judge:

1. parse finished list;
2. resolve exact physical cards;
3. Commander legality and exact count;
4. printing-policy compliance;
5. structural metrics;
6. external combo/bracket evidence only after hard gates pass;
7. efficient commander-centric win-plan evidence;
8. target-free actual bracket assessment.

The evaluator preserves:

- exact winning combo IDs, not merely combo counts;
- bracket-source availability/failure;
- combo-source availability/failure;
- whether combo verification completed;
- whether external evidence was attempted and whether it was complete.

A selected seeded combo is considered preserved only when the **exact selected Spellbook combo ID** is verified in the final 100.

### Universal build orchestration

`src/services/commander-build-pipeline-v15.ts`
`src/services/commander-build-pipeline-v15.test.ts`

Current order:

> constraints → commander/strategy → winning-package discovery → optional verified package seeding → construction → hard truth evaluation → target-free actual bracket → requested-vs-achieved comparison

Key anti-bias/fail-closed rules:

- explicit bracket target uses the targeted construction lane;
- no target uses the neutral lane and never falls into V0.7's historical default Bracket 4;
- `winPackageMode` is `auto | prefer | require | forbid`;
- `prefer/auto` may continue when package discovery is unavailable, but may not invent a package;
- `require` fails closed when package verification is unavailable or no verified legal package exists;
- if a required selected package cannot be reverified in the final deck, the final result does not claim success.

---

## Milestone 3 — requested-vs-achieved bracket/ceiling layer complete

`src/services/bracket-target-comparison-v15.ts`
`src/services/bracket-target-comparison-v15.test.ts`

Actual bracket assessment remains target-free. The requested target is compared **after** the deck exists and has been independently assessed.

Output includes:

- requested bracket;
- achieved bracket/band;
- `reached | exceeded | under-target | unassessable`;
- target gap;
- assessment confidence;
- evidence completeness;
- target-relevant checks;
- known blockers;
- unverified evidence checks;
- concrete “what would reach target” guidance;
- restriction observations.

Target-specific diagnostics prevent misleading leakage:

- a Bracket 3 request uses upgraded-deck criteria;
- a Bracket 4 request uses optimized-structure/win-plan criteria;
- Bracket 5 alone uses the competitive/cEDH evidence gates;
- a B4 result cannot be described as missing B5 metagame evidence merely because B5 gates exist;
- external B5 evidence outage is marked **unverified**, not converted into a false deck weakness or false combo-absence claim.

Permanent regressions cover B3/B4/B5 target-specific explanations, source outages, reached targets and hard-gate failure.

---

## Permanent Commander benchmark controls

### A. Final Fantasy-only Bracket 5 challenge

> Build the strongest possible Commander deck using only legitimate Final Fantasy physical printings, target Bracket 5, and report the honest ceiling if the restriction cannot support Bracket 5.

Failure to reach B5 is acceptable when the card pool/restriction genuinely causes the ceiling. Do not collapse an FF deck into one infinite line when combat/value/commander routes materially belong to its identity.

### B. FF-only high-Bracket-4 Najeela calibration

The optimized FF-only Najeela benchmark remains a high-B4 proof that the assessor can recognize a strong commander-centric combat plan without inventing B5/cEDH certification.

### C. Neutral FF autonomous build

No commander/power target. Used to catch hidden commander reputation, hidden bracket targets and accidental optimization-to-power bias.

### D. Unrestricted cEDH control

`scripts/e2e-unrestricted-cedh-v15.ts` uses Kinnan, Bonder Prodigy and guards complete legality/resolution, deterministic win packages, low curve, free interaction, fast mana and strong competitive construction signals.

The FF vs unrestricted comparison distinguishes a card-pool/user restriction ceiling from a builder weakness.

### E. Universal pipeline live control

`scripts/e2e-universal-build-pipeline-v15.ts`

Current permanent case verifies:

- exact FF Najeela printing;
- B4 requested;
- winning-package discovery attempted before construction;
- legal exact 100 and FF printing policy;
- actual bracket assessed after construction;
- target comparison happens after actual assessment;
- completed package search vs unavailable package search are distinct;
- exact selected combo identity must survive when one is seeded and verification completes;
- B4 explanations contain no cEDH/metagame leakage.

---

## Exact statistics foundation complete

Implemented and independently tested:

- `exact-statistics-v15.ts` — BigInt hypergeometric fractions, complements, expectation, variance and bounded populations;
- `exact-package-statistics-v15.ts` — disjoint package assembly;
- `exact-overlap-package-statistics-v15.ts` — overlap-aware physical-card assignment without double counting;
- `exact-commander-zone-statistics-v15.ts` — command-zone availability and correct 99/98-card library sizes;
- `exact-access-curve-v15.ts` — opening hand + turn-by-turn natural/explicit guaranteed draws;
- `simulation-exact-calibration-v15.ts` — seeded Monte Carlo calibrated against exact mathematical truth.

Permanent overlap regression: one universal A/B tutor cannot satisfy both missing A and B by itself.

---

## Real learning/research foundation

The neural model remains **experimental/shadow-only**. It may not influence hard legality/rules truth and may not be promoted merely because synthetic tests succeed.

Implemented foundations include:

- explicit learning-target identity; mixed target semantics are rejected;
- quarantine-first observed-outcome ingestion;
- exact deck fingerprints;
- deterministic duplicate/mirror handling;
- versioned structural feature snapshots (`deck-structural-v15.2`);
- exact card-data snapshot fingerprints;
- training-only normalization (`deck-structural-minmax-v15.1`);
- pre-feature temporal/leakage partitioning;
- strict TopDeck materialization;
- integrated leakage-safe TopDeck temporal corpus workflow;
- content-addressed corpus manifests;
- bounded TopDeck live fetcher with one-shot POST semantics;
- conservative cross-source outcome linkage that prefers false negatives to false-positive merges;
- evidence independence groups and source-health concepts.

A large, independently sourced, balanced, leakage-safe real outcome corpus has **not** yet been claimed.

---

## Next implementation target

### 1. Finish neutral universal-build constraint adapters

The universal pipeline deliberately still fails closed on these no-target combinations rather than silently ignoring them:

1. unrestricted neutral card pool;
2. neutral exact per-card budget enforcement;
3. neutral free-form theme query.

#### Unrestricted neutral card-pool adapter

Do **not** route this through `searchCards()` as currently implemented because that helper orders by EDHREC and would silently reintroduce popularity/power bias into a neutral build.

Implement a bounded, provenance-reported candidate discovery service that:

- uses multiple archetype/functional role query families;
- has explicit page/card/request ceilings;
- is not presented as exhaustive when it is sampled/bounded;
- does not score by EDHREC, famous name, commander reputation, color count or bracket;
- produces enough candidates for a legal 100-card build or fails closed;
- preserves exact Scryfall identity and legality;
- feeds the existing neutral role-based selector;
- is permanently tested for ordering/reputation invariance where practical.

#### Neutral per-card budget adapter

Budget enforcement must be exact-printing/finish aware. A default Oracle-card price is not sufficient. Candidate acceptance must verify an eligible physical printing under the active policy and hard max-per-card budget.

#### Neutral free-form theme adapter

Do not silently treat arbitrary user language as raw Scryfall query grammar. Normalize theme intent into bounded semantic/query constraints, preserve the original user constraint for auditability, and fail closed when the theme cannot be enforced reliably.

After these adapters are safe, remove only the corresponding `unsupportedConstraints` entries from the universal planner and add live controls.

### 2. Expose the universal pipeline through the experimental V0.15 MCP tool surface

`server-v15.ts` currently inherits V0.14 and exposes V0.15 research/bracket tools but does not yet register the new universal Commander build pipeline as its own tool.

Do this only after the neutral adapter semantics above are stable. The tool schema must preserve optional/no-target semantics, package mode, printing/budget/theme constraints, and the common requested-vs-achieved result. Do not change `server-current`.

### 3. Retrospective/as-of card-data provenance

This remains the main blocker before a meaningful historical live-corpus backfill.

A 2026 refresh of a 2025 tournament may not pretend current Scryfall/Oracle data was observed before the 2025 outcome.

Next data work must:

- distinguish genuine historical/contemporaneous snapshots from retrospective reconstruction;
- investigate reconstructible historical/as-of card identity data from public structured sources;
- avoid selecting a physical printing released after the historical event for a name-only decklist;
- separate static/reconstructible fields from Oracle/rules-derived fields that may contain future errata/knowledge;
- omit or quarantine predictors that cannot be reconstructed without future knowledge;
- preserve exact data fingerprints and reconstruction method;
- add deterministic fixtures before live backfill.

### 4. Real corpus refresh and model evaluation

Only after retrospective feature safety:

- run live/manual corpus refresh separately from deterministic CI;
- respect TopDeck attribution, 429/Retry-After and secret-key handling;
- persist normalized allowed records/manifests, not raw provider dumps;
- report accepted/quarantined/duplicate/conflict/temporal/source coverage;
- train one explicit target at a time;
- compare transparent and neural models on the same genuinely future holdout;
- require repeated neural wins on independent unseen data before any promotion;
- allow metagame drift/source degradation to revoke confidence.

---

## Quality gates before calling a milestone complete

- dependency install succeeds;
- strict TypeScript build succeeds;
- complete deterministic tests succeed;
- live controls used as evidence remain separate from deterministic CI;
- malformed/boundary requests fail closed;
- probability changes use independent exact/brute-force oracles where practical;
- exact probability equality uses BigInt/fractions, never display decimals;
- failed fixtures are allowed to be wrong — do not corrupt correct code/math to satisfy a bad test;
- hard legality/printing/rules truth remains outside ML;
- requested bracket never raises actual assessment;
- no hidden bracket default is allowed for neutral construction;
- package discovery distinguishes verified absence from unavailable verification;
- positive combo credit requires actual verified winning outcomes;
- unavailable external evidence is reported, not fabricated or converted into absence;
- source independence and temporal leakage safety remain explicit;
- FF-only, neutral, high-B4 and unrestricted controls do not regress silently;
- stable `server-current` remains V0.13 until an explicit release/promotion decision;
- update this file after every major milestone or active-target change.

A future session must be able to recover the project direction and current engineering state from GitHub alone without old chat history.
