# Ultimate MTG — Project Handoff

_Last updated: 2026-08-19 NZST_

This is the persistent recovery point for future ChatGPT sessions. Read it together with `ULTIMATE_MTG_SPEC.md`: the spec is the north star; this file records the current validated implementation, release state, hard guarantees, validation discipline, and next engineering target.

## Fresh-chat resume instructions

1. Open `vt7dfbmh7b-droid/mtg-ultimate-mcp`.
2. Read `PROJECT_HANDOFF.md` and `ULTIMATE_MTG_SPEC.md` first.
3. Inspect `agent/package-probabilities`; do not assume `main` is the active development state.
4. Check the exact active-branch head and current GitHub Actions status before changing code.
5. Distinguish the latest fully validated **implementation SHA** from any later handoff-only documentation commit.
6. Keep deterministic CI separate from live external-source evidence.
7. Do not promote `server-current` merely because V0.15 experimental code exists.
8. Continue from **Next implementation target** unless a newer commit updates this handoff.

---

## Repository / release state

**Repository:** `vt7dfbmh7b-droid/mtg-ultimate-mcp`

**Active continuation branch:** `agent/package-probabilities`

**Latest fully validated implementation head:**

- `cd02df8faade60b7faa6c21e2cb04ef577e6f074` — historical/as-of provenance foundation integrated with the active development lineage.

This implementation is a normal descendant of the prior active handoff commit `e143693038d8b17cbd6b350d9fae1cad315c710a`; no force update was used. It preserves the previously validated V0.15 Commander MCP work and adds strict historical evidence/corpus/model provenance.

The branch may now be one handoff-only documentation commit ahead of `cd02df8...`. If so, inspect the diff: the documentation child is not a new runtime implementation milestone.

### Historical-provenance validation

Isolated implementation branch:

- branch `agent/v15-historical-provenance` from validated runtime `946e6c31cde4962cb37efb6a70487312467f7fcb`;
- final isolated code SHA `4bcc4531e50e92ebf378aad4e335ba5e63515e96`;
- temporary draft PR #11;
- deterministic CI run `32216740824`: PASS;
- strict TypeScript/build: PASS;
- complete deterministic test suite: PASS;
- Commander Live Control Suite run `32216740825`: PASS;
- all nine live controls + final aggregate: PASS.

Active fold:

- integration commit `cd02df8...` preserves the existing active handoff lineage while incorporating the validated isolated provenance tree;
- `agent/package-probabilities` fast-forwarded to `cd02df8...`; no force and no merge to `main`;
- deterministic CI run `32217585804`: PASS;
- active Commander Live Control Suite run `32217585811`: PASS;
- all nine live controls + final aggregate: PASS;
- temporary PR #11 closed **unmerged**;
- PR #2 remains the open draft validation surface for the active experimental branch.

### Stable runtime remains V0.13

- `package.json` remains version `0.13.0`;
- `src/server-current.ts` deliberately returns `createMtgServerV13()`;
- V0.14/V0.15 remain experimental;
- `main` remains untouched by these milestones.

**Do not change the stable runtime or merge the experimental branch to `main` without an explicit release/promotion decision from the user after the relevant quality gates are met.**

---

## Permanent truth hierarchy

Machine learning, optimization, simulation, popularity, requested power, or convenience may never override:

- Commander legality;
- exact card count / command-zone count;
- singleton and color-identity rules;
- unresolved-card failures;
- current banned/legal facts;
- exact physical-printing existence and restrictions;
- exact required/must-exclude constraints;
- exact per-card hard budgets when requested;
- known rules facts;
- verified combo requirements.

Requested bracket/power is a target, not a forced result.

A source outage is **not** evidence that a card/combo/property is absent. Unavailable verification must remain unavailable/incomplete evidence and never create positive credit.

Historical evaluation adds another permanent rule: **later knowledge may not leak backward into an earlier `asOf` claim.**

---

## Completed Commander / deckbuilding milestones

### Live-source reliability

- bounded retries only for known read-safe/idempotent operations;
- transient status recovery includes 408/425/429/500/502/503/504;
- `Retry-After`, caller aborts, method/provider/attempt/timeout/cause telemetry preserved;
- source outages remain unavailable/incomplete evidence rather than false absence;
- process-wide Scryfall pacing prevents multi-path request stampedes.

### Universal Commander build pipeline

Pipeline order:

> constraints → commander/strategy → winning-package discovery → optional verified package seeding → construction → hard-truth evaluation → target-free actual bracket → requested-vs-achieved comparison

Key guarantees:

- explicit target uses targeted lane;
- no target is truly target-free;
- verified package modes are `auto | prefer | require | forbid`;
- `require` fails closed if positive verification is unavailable or absent;
- a seeded combo receives credit only if its exact Spellbook combo ID survives and verifies in the final 100.

### Requested-vs-achieved bracket layer

The finished deck is assessed first; the requested target is compared only afterward. Lower-target explanations do not leak Bracket-5/cEDH-only blockers.

### Neutral unrestricted construction

- bounded stratified Scryfall sampling rather than EDHREC construction ordering;
- deterministic Oracle-identity deduplication;
- exact legality/color/paper/printing gates;
- explicit basics including Wastes;
- auditable candidate-pool provenance.

Permanent neutral Najeela control remains exact legal 100 and post-build Bracket 3 when current evidence supports it.

### Exact per-card budget enforcement

- `maxUsdPerCard` is a hard cap;
- `candidateMaxUsdPerCard` can only tighten optional search;
- exact printing + finish is the price witness;
- unknown price is never treated as zero;
- commander, required cards, package pieces, optional cards and lands are audited;
- final deck receives an independent post-build budget audit;
- conflicts fail closed with named causes.

### Free-form theme enforcement

- controlled typed normalization; arbitrary user text is never passed directly into Scryfall grammar;
- unsupported/unsafe/vague compound themes fail closed;
- theme discovery is bounded and independently audited;
- Final Fantasy theme-only input becomes an exact `final-fantasy` physical-printing policy before package discovery and remains active throughout construction/evaluation.

### Provider-safe serialized live validation

- deterministic CI remains separate from live-provider calibration;
- one automatic serialized Commander live suite;
- ordinary cooldowns 30s; deep theme/budget cooldowns 60s;
- `continue-on-error` collects later evidence but final aggregate fails unless every core control succeeds;
- live validation uses bounded recovery settings without weakening assertion/legality/printing/budget/theme failures.

### Experimental V0.15 universal Commander MCP boundary

Experimental tool:

- `build_commander_through_pipeline_v15`

Boundary guarantees:

- one/two exact commander inputs with ordered pair semantics;
- true no-target behavior;
- printing/set/promo/special controls;
- exact per-card budget inputs;
- free-form themes;
- excluded/must-include/land controls;
- win-package mode;
- exact final decklist/printing/audits/provenance/source state;
- target-free achieved bracket and requested-vs-achieved comparison;
- backed by the existing universal service rather than duplicate builder logic.

The live MCP control crosses the actual protocol boundary. The five-minute test-client allowance is validation-harness-only; it does not relax server truth behavior.

---

## Exact probability / statistics foundation

Implemented and independently tested:

- BigInt exact hypergeometric probabilities, complements, expectation, variance;
- disjoint package assembly;
- overlap-aware physical-card assignment without double counting;
- command-zone-aware 99/98-card libraries;
- opening-hand + turn access curves;
- seeded Monte Carlo calibration against exact truth.

Permanent regression: one universal A/B tutor cannot simultaneously satisfy both missing A and B roles.

Classic control: 99-card library, 36 lands, 7-card opener, P(3+ lands) = `26,736,733 / 53,358,536 ≈ 50.1077%`.

---

## Historical / as-of provenance milestone — COMPLETE

Historical/as-of work builds on the pre-existing historical card-data provenance foundation rather than replacing it.

Key files now include:

- `src/services/historical-carddata-provenance-v15.ts`;
- `src/services/historical-carddata-snapshot-validation-v15.ts`;
- `src/services/temporal-provenance-v15.ts`;
- `src/services/historical-learning-corpus-v15.ts`;
- `src/services/topdeck-temporal-corpus-v15.ts`;
- `src/services/historical-neural-temporal-eval-v15.ts`;
- related deterministic tests.

### 1. Generic typed temporal evidence envelope

`temporal-provenance-v15` explicitly distinguishes:

- `current-truth`;
- `contemporaneous-snapshot`;
- `archived-versioned-snapshot`;
- `retrospective-reconstruction`.

Evidence domains include printing, Oracle/card identity, Commander legality, rules, tournament outcomes, recorded games and source snapshots.

Truth status distinguishes:

- `verified-present`;
- `verified-absent`;
- `unavailable`;
- `present-day-proxy`.

The envelope preserves source ID/URI, optional record/version/content hash, observation/retrieval time, validity interval and archive/reconstruction metadata.

Historical assessment rules:

- current truth remains the default when no `asOf` is requested;
- current truth cannot establish earlier historical state;
- evidence unavailable until after `asOf` is excluded;
- facts outside their validity window are excluded;
- an archived snapshot may be retrieved later only when its independent archive publication/effective timing proves it existed for the requested historical date;
- retrospective reconstruction is advisory-only and disclosed separately from contemporaneous truth;
- present-day proxies never satisfy a strict historical truth gate;
- verified historical absence remains distinct from unavailable truth.

### 2. No-future-leakage deterministic controls

Synthetic regressions prove that later information cannot leak backward through:

- physical printings/release timing;
- Oracle/card-identity facts;
- Commander legality;
- rules evidence;
- tournament outcomes;
- source snapshots/version timing.

Tests also cover invalid timestamp ordering, validity windows, source URLs, content hashes and archive publication timing.

### 3. Strict historical learning records and manifests

A generic `LearningOutcomeRecordV15` is not automatically historical evidence.

`HistoricalLearningRecordV15` binds separately:

- a provenanced historical predictor snapshot;
- predictor availability time;
- historical card-data method/source/content hash;
- historical Commander legality state;
- raw outcome-source provenance;
- normalized outcome-source provenance;
- target-only safeguards and eligibility reasons.

Hard requirements for trusted historical training include:

- predictor snapshot available no later than the outcome;
- predictor card data cannot be retrospective current-data masquerading as historical truth;
- historical Commander legality must be verified legal;
- outcome source cannot claim availability before the event happened;
- outcome evidence must be contemporaneous or independently versioned archived evidence;
- observed labels require `verified-present` evidence;
- source version + SHA-256 content hash are required for replayable trusted training evidence;
- raw and normalized provenance must agree at runtime.

Runtime assertions deliberately re-check the record rather than trusting a serialized `eligibleForHistoricalTraining: true` flag.

Historical corpus manifests content-address both predictor and outcome provenance. Changing only source version/content provenance changes the corpus hash.

### 4. TopDeck temporal corpus provenance

TopDeck temporal materialization now requires explicit `sourceRetrievedAt` in addition to source observation time.

Each accepted outcome receives:

- deterministic historical source version;
- deterministic content hash over the materialized outcome identity/result/deck fingerprint/commander/provider facts;
- replayable tournament-outcome temporal provenance;
- a strict historical learning record;
- a strict historical corpus manifest alongside the existing generic manifest.

This preserves outcome evidence as a target/label source without allowing it to become predictor information.

### 5. Strict historical model-evaluation gate

`evaluateNeuralOnHistoricalCorpusAsOfV15` is intentionally stricter than the existing generic temporal evaluator.

A caller cannot pass today's generic corpus plus an old date and call the result historical.

Flow:

> runtime-validate historical records → filter outcome evidence independently available by `asOf` → exclude unavailable/advisory/future evidence → pass only verified historical rows into the existing leakage-safe temporal evaluator

Permanent synthetic regression:

- a corpus may contain future rows;
- changing only those future rows' features/cards/labels cannot change an earlier `asOf` model evaluation because those rows are removed before the existing evaluator sees them.

Unavailable evidence is reported separately and is never counted as negative evidence.

### Current historical scope

The strict historical provenance APIs now make retrospective corpus/model evaluation safe to attempt, but **a large, balanced, independently sourced, leakage-safe real historical outcome corpus is still not claimed**.

Current live Commander/deckbuilding evaluation remains **current-truth by default**. Historical semantics are opt-in through the strict historical/provenance APIs; present-day truth is not silently reinterpreted as past truth.

---

## Learning / ML standing rules

Neural/ML remains experimental and shadow-only.

It may never override legality, rules, printing, budget, theme, combo or other hard truth.

Promotion may not be justified by feature count, synthetic fixtures, retrospective data contaminated by future information, or popularity alone.

---

## Next implementation target

### 1. Real corpus / model evaluation

This is the immediate target for the next chat.

Historical/as-of provenance is now safe enough to begin collecting and evaluating real outcome evidence, but the project must not claim a strong learned model until the corpus itself is trustworthy.

Next work should focus on a **real, independently sourced, leakage-safe corpus and honest shadow-model evaluation**.

Required direction:

1. inventory the real sources currently available to the project and classify their independence, temporal coverage, replayability and licensing/usage constraints;
2. materialize real records only through the strict historical provenance boundary when retrospective claims are involved;
3. keep contemporaneous/current observations distinct from retrospective reconstructions;
4. expand source diversity beyond a single provider where feasible; conservative linkage must prevent mirrors/reposts from masquerading as independent evidence;
5. quantify corpus coverage by date, commander/archetype, event size, competitive tier, region/provider and outcome class;
6. detect duplicate/mirrored decklists, repeated pilots/events and leakage groups before any fitting;
7. establish a genuinely future holdout that is never used for normalization, feature selection, hyperparameter choice or threshold tuning;
8. benchmark transparent baselines against the neural/shadow model on the same holdout;
9. report calibration, discrimination/ranking quality, uncertainty, sample sizes and subgroup/drift behavior rather than a single headline score;
10. require meaningful out-of-sample improvement over transparent baselines before treating ML as useful;
11. preserve source-health/drift reporting so provider changes or stale feeds cannot silently corrupt evaluation;
12. keep all learned outputs advisory/shadow-only unless a later explicit promotion decision is supported by real future evidence.

Do **not** manufacture corpus scale with synthetic outcomes or retrospective current-state substitutions.

### 2. Promotion remains a later decision

Even a successful real-corpus evaluation does not automatically promote V0.15 or any model into stable runtime. Stable promotion requires a separate explicit user-approved release decision after quality gates are satisfied.

---

## CI / validation discipline

For every implementation milestone:

1. isolate material work when useful;
2. strict TypeScript/build;
3. complete deterministic tests;
4. dedicated live control when external data is part of the feature;
5. inspect underlying live outcomes rather than only a green-looking aggregate;
6. remember `continue-on-error` can hide an underlying failed step until aggregate time;
7. distinguish source outage, harness failure and code/assertion failure;
8. fold into `agent/package-probabilities` only after validation;
9. revalidate the exact active branch after the fold;
10. keep `main` and `server-current` unchanged unless the user explicitly approves release promotion.

Never weaken a truth gate just to make CI green.

---

## Maintenance rule

Update this file after every major milestone, blocker/recovery event, or active-target change.

A future session must be able to recover the project direction and current engineering state from GitHub alone without old chat history.
