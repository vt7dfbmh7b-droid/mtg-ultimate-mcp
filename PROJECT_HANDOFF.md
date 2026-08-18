# Ultimate MTG — Project Handoff

_Last updated: 2026-08-18 NZST_

This is the persistent recovery point for future ChatGPT sessions. Read it together with `ULTIMATE_MTG_SPEC.md`: the spec is the north star; this file records the current implementation state, hard guarantees, validated controls, isolated in-progress work, and next target.

## Fresh-chat resume instructions

1. Open `vt7dfbmh7b-droid/mtg-ultimate-mcp`.
2. Read `PROJECT_HANDOFF.md` and `ULTIMATE_MTG_SPEC.md` first.
3. Inspect `agent/package-probabilities`; do not assume `main` is the active development state.
4. Inspect deterministic CI for the exact active-branch head before changing code.
5. Also inspect any isolated branch explicitly named in **In-progress isolated work**.
6. Keep live external controls separate from deterministic CI evidence.
7. Do not promote `server-current` merely because V0.14/V0.15 code exists.
8. Continue from **Next implementation target** unless a newer commit changes this handoff.

---

## Repository / release state

**Active continuation branch:** `agent/package-probabilities`

**Latest fully validated implementation head:**

- `8d6b8c99a1a9b9a453323af3b056d284fb19e4c0` — live-source reliability hardening, general winning-package discovery, shared post-build Commander evaluation, universal Commander build pipeline foundation, source-outage-aware evidence semantics, and requested-vs-achieved bracket comparison.

Validation on that exact implementation head:

- strict TypeScript build: PASS;
- complete deterministic automated tests: PASS;
- Universal Commander Build Pipeline live control: PASS;
- exact live case: `Najeela, the Blade-Blossom (FCA) 42`, Final Fantasy physical printings only, requested Bracket 4, verified win packages preferred;
- result: exact legal 100-card deck, FF printing policy satisfied, achieved **Bracket 4 / bracket-4-optimized-range**, target status **reached**, target gap `0`;
- winning-package discovery completed and honestly returned **no verified FF-valid package**; no package was invented or forced;
- final external evidence completed successfully;
- live artifact ID `9313202187`, SHA-256 `16e46988d62f7d2390aae1a4b6910ab63708f3550e7aea7d67f3993f57307bd6`.

Important reliability commit:

- `33a65f912155692e2c03c76b6d7022e2d830d203` — bounded provider-aware retries for known idempotent live read endpoints. The permanent live Commander controls subsequently completed successfully on that implementation.

### Stable runtime remains V0.13

- `package.json` remains `0.13.0`.
- `src/server-current.ts` deliberately returns `createMtgServerV13()`.
- V0.14/V0.15 remain experimental.
- PR #2 remains a draft validation surface, not a release/promotion PR.

**Do not change the stable runtime without an explicit release/promotion decision from the user after the V1 quality gates are met.**

---

## In-progress isolated work — DO NOT MERGE YET

**Branch:** `agent/neutral-unrestricted-pool`

**Current isolated head:**

- `76cc9e25ebdca6b197dd2dea082cbc405de40d0e` — unrestricted neutral candidate sampling wired into the existing neutral strategy-first deck builder, plus planner coverage allowing no-target/no-printing-restriction construction.

Implemented on this isolated branch:

- new `src/services/neutral-unrestricted-pool-v15.ts`;
- new `src/services/neutral-unrestricted-pool-v15.test.ts`;
- bounded stratified Scryfall candidate sampling across early/mid/late nonlands, lands, and archetype-relevant cards;
- deterministic views by name and release-date direction rather than EDHREC/popularity order;
- explicit sampled-vs-exhaustive provenance;
- hard minimum eligible nonland/land candidate counts;
- exact Commander legality, color identity and physical-printing checks;
- explicit basic-land completion, including `Wastes` for colorless;
- canonical WUBRG ordering and explicit Scryfall `id:c` colorless syntax;
- the existing neutral role/archetype selector consumes the sampled pool rather than creating a duplicate builder;
- restricted printing-family/set builds retain their existing exhaustive bounded-pool path;
- `candidatePoolProvenance` is emitted so an unrestricted sample cannot be mistaken for an exhaustive universe;
- the universal planner no longer rejects **unrestricted neutral card pool** by default;
- no target still never falls through to V0.7's historical hidden Bracket-4 default.

Still deliberately fail-closed on this branch:

- neutral exact per-card budget enforcement;
- neutral free-form theme query;
- experimental MCP tool-surface exposure.

### Current GitHub Actions blocker

Do **not** call `76cc9e25...` validated yet.

At the time of this handoff, GitHub Actions jobs for both the active and isolated branches are failing before any workflow step starts. Example exact isolated-head CI:

- workflow run `32115217276`;
- head `76cc9e25ebdca6b197dd2dea082cbc405de40d0e`;
- run created `2026-08-18T08:12:44Z` and failed by `08:12:49Z`;
- GitHub job result has `steps: null`;
- therefore `checkout`, dependency install, TypeScript build and tests never ran.

The same pre-step failure pattern affected all workflows together. This is not evidence of a source/test failure, but the connector exposes no billing/runner-allocation reason. Do not invent a cause.

**Hard gate:** keep the isolated branch unmerged until hosted CI can actually start and the exact head passes strict TypeScript + complete deterministic tests. After that, add a dedicated live unrestricted-neutral control before moving it to `agent/package-probabilities`.

Temporary validation PR #6 may be opened/closed to probe Actions, but must not be merged into `main`.

---

## Permanent truth hierarchy

Machine learning, optimization, simulation, external evidence, requested power, popularity, or convenience may never override:

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

## Completed Commander/deckbuilding milestones

### Milestone 1 — live-source reliability

Key files include `src/lib/http.ts`, `src/services/spellbook.ts` and tests.

Properties:

- retries only known idempotent read operations;
- Scryfall `POST /cards/collection` and Commander Spellbook read-only analysis POSTs may retry transient failures;
- arbitrary POSTs such as TopDeck ingestion remain one-shot;
- transient statuses include 408/425/429/500/502/503/504;
- `Retry-After` is respected;
- caller aborts are not retried;
- provider/method/attempt/timeout/cause telemetry is retained;
- advisory bracket-source outage returns unavailable evidence instead of crashing a legal build;
- combo assessment outage returns zero positive evidence with `verificationComplete: false`, not false combo absence;
- strict combo-completion paths remain strict where positive verification is required.

### Milestone 2 — universal Commander build pipeline foundation

Key files:

- `general-win-package-v15.ts`;
- `commander-build-evaluation-v15.ts`;
- `commander-build-pipeline-v15.ts`;
- associated tests and live control.

Pipeline order:

> constraints → commander/strategy → winning-package discovery → optional verified package seeding → construction → hard truth evaluation → target-free actual bracket → requested-vs-achieved comparison

Important rules:

- winning packages are deliberately searched before construction;
- non-winning outcomes do not receive winning-package credit;
- exact eligible physical printings are verified;
- exact selected Spellbook combo ID must survive final construction when a package is required/seeded;
- `winPackageMode` is `auto | prefer | require | forbid`;
- `prefer/auto` may continue through unavailable package discovery without inventing a package;
- `require` fails closed when verification is unavailable or no verified legal package exists;
- no target uses the neutral lane and never falls into legacy default Bracket 4.

### Milestone 3 — requested-vs-achieved bracket/ceiling layer

Key file: `bracket-target-comparison-v15.ts`.

Output includes requested bracket, achieved bracket/band, `reached | exceeded | under-target | unassessable`, target gap, confidence, evidence completeness, target-specific checks, known blockers, unverified evidence and concrete guidance.

Target-specific diagnostics are separate:

- B3 uses upgraded-deck criteria;
- B4 uses optimized-structure/win-plan criteria;
- B5 alone uses competitive/cEDH evidence gates;
- lower targets do not inherit irrelevant B5/cEDH failure reasons;
- source outage is marked unverified rather than converted into a deck weakness.

---

## Permanent Commander controls

1. **FF-only Bracket 5 challenge** — strongest legitimate FF physical-printing build; report honest ceiling.
2. **FF-only high-B4 Najeela calibration** — recognize a strong commander-centric combat plan without inventing cEDH certification.
3. **Neutral FF autonomous build** — no commander/power target; catches hidden reputation/bracket bias.
4. **Unrestricted cEDH Kinnan control** — separates builder weakness from restricted-card-pool ceiling.
5. **Universal pipeline live control** — validates ordering, exact printing, exact 100, package discovery semantics, post-build assessment and target comparison.
6. **Next control to add after CI recovery:** unrestricted no-target neutral Commander build using the new sampled-pool adapter.

---

## Exact probability/statistics foundation

Implemented and independently tested:

- BigInt exact hypergeometric fractions, complements, expectation and variance;
- disjoint and overlap-aware package assembly;
- one-physical-card/one-simultaneous-role semantics;
- commander-zone 99/98-card library handling;
- exact turn/access curves;
- seeded Monte Carlo calibrated against exact mathematical cases.

Permanent regression: one universal A/B tutor cannot satisfy both missing A and B by itself.

---

## Learning/research foundation

The neural model remains **experimental/shadow-only**.

Implemented foundations include:

- explicit learning-target identity and mixed-target rejection;
- quarantine-first observed-outcome ingestion;
- exact deck fingerprints and card-data snapshot fingerprints;
- deterministic duplicate/mirror handling;
- versioned structural feature snapshots (`deck-structural-v15.2`);
- training-only normalization (`deck-structural-minmax-v15.1`);
- pre-feature temporal/leakage partitioning;
- strict TopDeck materialization;
- integrated leakage-safe TopDeck temporal corpus workflow;
- content-addressed corpus manifests;
- bounded one-shot TopDeck live fetcher;
- conservative cross-source outcome linkage;
- evidence independence groups and source-health concepts.

A large independent, balanced, leakage-safe real outcome corpus has **not** been claimed.

---

## Next implementation target

### 1. Validate and land the unrestricted-neutral adapter

When GitHub Actions can actually start jobs:

1. reopen/refresh PR #6 against exact isolated head;
2. require dependency install + strict TypeScript build + complete deterministic tests;
3. fix any real compile/test failures on the isolated branch;
4. add a dedicated live unrestricted/no-target neutral build control;
5. verify legal exact 100, no hidden target bracket, sampled-pool provenance, post-build actual bracket and no EDHREC/popularity construction signal;
6. only then fast-forward the validated adapter into `agent/package-probabilities` and close PR #6.

### 2. Neutral exact per-card budget adapter

Do this **after unrestricted adapter validation**, on a fresh isolated branch.

Requirements:

- budget is a hard user constraint, not a score;
- exact physical printing/finish must satisfy the maximum;
- unknown price cannot silently pass a hard maximum;
- commander, must-includes, winning-package seeds and final selected cards all need enforcement;
- the post-build evaluator must independently verify the budget constraint rather than trusting construction alone;
- preserve price source/currency/reference-time provenance;
- do not make dozens of unnecessary Scryfall printing calls when a bounded query/batched approach can prove the same fact;
- keep NZD-first shopping/pricing concerns separate from the USD reference-cap mechanic where appropriate.

Only after independent construction + post-build budget verification should the planner remove `neutral per-card budget enforcement` from `unsupportedConstraints`.

### 3. Neutral free-form theme adapter

Do not pass arbitrary natural-language theme text straight into Scryfall grammar.

Requirements:

- preserve original user theme text for auditability;
- normalize into bounded semantic/query constraints;
- distinguish hard theme restriction from soft strategy preference;
- verify selected cards satisfy enforceable hard theme rules;
- ordinary support cards may be permitted only when the normalized policy explicitly allows off-theme infrastructure;
- fail closed when the theme cannot be represented reliably;
- add adversarial tests for ambiguous theme language and unsupported themes.

Only then remove `neutral free-form theme query` from planner fail-closed constraints.

### 4. Expose universal pipeline through experimental V0.15 MCP

After all neutral constraint adapters are stable:

- register a dedicated universal Commander build tool in `server-v15.ts`;
- preserve optional/no-target semantics;
- expose package mode, printing restrictions, budget/theme constraints and requested-vs-achieved result;
- add MCP input/output regressions;
- do **not** change `server-current`.

### 5. Retrospective/as-of card-data provenance

Then return to the learning-corpus blocker:

- distinguish genuine historical snapshots from retrospective reconstruction;
- never pretend current Scryfall/Oracle data was observed before an older outcome;
- avoid future printings for historical name-only decklists;
- separate reconstructible static fields from future-sensitive Oracle/rules fields;
- omit/quarantine predictors that cannot be reconstructed safely;
- preserve exact data fingerprints + reconstruction method;
- add deterministic fixtures before live backfill.

### 6. Real corpus refresh and model evaluation

Only after retrospective feature safety:

- live/manual corpus refresh outside deterministic CI;
- one explicit target at a time;
- transparent vs neural on the same genuinely future holdout;
- repeated independent neural wins required before promotion;
- drift/source degradation may revoke confidence.

---

## Quality gates before calling a milestone complete

- dependency install succeeds;
- strict TypeScript build succeeds;
- complete deterministic tests succeed;
- live controls remain separate from deterministic CI evidence;
- malformed/boundary requests fail closed;
- probability changes use independent exact/brute-force oracles where practical;
- hard legality/printing/rules/budget truth stays outside ML;
- requested bracket never raises actual assessment;
- no hidden bracket default for neutral construction;
- package discovery distinguishes verified absence from unavailable verification;
- positive combo credit requires verified winning outcomes;
- unavailable external evidence is reported, never fabricated;
- bounded candidate sampling is labeled sampled, not exhaustive;
- source independence and temporal leakage safety stay explicit;
- FF-only, neutral, high-B4 and unrestricted controls do not regress silently;
- stable `server-current` remains V0.13 until explicit release/promotion approval;
- update this file after every major milestone or active-target change.

A future session must be able to recover the project direction and current engineering state from GitHub alone without old chat history.
