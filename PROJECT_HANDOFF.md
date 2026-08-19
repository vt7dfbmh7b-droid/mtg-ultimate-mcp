# Ultimate MTG — Project Handoff

_Last updated: 2026-08-20 NZST_

This is the persistent recovery point for future ChatGPT sessions. Read it together with `ULTIMATE_MTG_SPEC.md`: the spec is the north star; this file records the current validated implementation, release state, hard guarantees, validation discipline, and next engineering target.

## Fresh-chat resume instructions

1. Open `vt7dfbmh7b-droid/mtg-ultimate-mcp`.
2. Read `PROJECT_HANDOFF.md` and `ULTIMATE_MTG_SPEC.md` first.
3. Inspect `agent/package-probabilities`; do not assume `main` is the active development state.
4. Check the exact active-branch head and current GitHub Actions status before changing code.
5. Distinguish the latest fully validated **implementation SHA** from any later handoff/documentation-only commit.
6. Keep deterministic CI, Scryfall live, TopDeck live, and Commander live controls separate.
7. Do not merge PR #2, promote `server-current`, change the package version, or merge to `main` merely because V0.15 experimental code exists.
8. Continue from **Next implementation target** unless a newer commit updates this handoff.

---

## Repository / release state

**Repository:** `vt7dfbmh7b-droid/mtg-ultimate-mcp`

**Active continuation branch:** `agent/package-probabilities`

**Latest fully validated implementation SHA:**

- `ee8df38c3a6e6fa90394933acbcc758f4f8089cc`

It was fast-forwarded into `agent/package-probabilities` from `7688c47320eec486796f6e003b680138208f8224` with `force=false` after isolated exact-head validation.

Exact-head validation before integration:

- deterministic CI `32306415926`: **PASS**;
- Scryfall Card Data Source Live `32306415977`: **PASS**;
- TopDeck Learning Source Live `32306415933`: **PASS**;
- Commander Live Control Suite `32306415937`: **PASS**;
- every Commander control and the final aggregate passed, including FF Najeela, FF neutral, FF Bracket 5, unrestricted cEDH, universal pipeline, unrestricted neutral, neutral theme, neutral exact-budget and FF exact-budget controls.

Active-branch revalidation on the same implementation object began immediately after the fast-forward. At the handoff refresh:

- Scryfall `32307449061`: **PASS**;
- CI `32307449092`: running;
- TopDeck `32307449050`: running;
- Commander `32307449121`: running.

PR #2 remains the open draft **DO NOT MERGE** validation/recovery surface for the active experimental branch. Its body contains the current implementation and promotion-route summary.

### Stable runtime remains V0.13

- `package.json` remains version `0.13.0`;
- `src/server-current.ts` deliberately returns `createMtgServerV13()`;
- V0.14/V0.15 remain experimental;
- `main` remains untouched by these milestones.

**Stable release remains a separate explicit user-approved action.** A successful model evaluation may only become eligible for human review; it may not rewrite `server-current`, change the package version, or merge to `main` automatically.

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

A source outage is **not** evidence that a card/combo/property is absent. Unavailable verification remains unavailable/incomplete evidence and never creates positive credit.

Historical/model evaluation adds another permanent rule: **later knowledge may not leak backward into an earlier predictor cutoff.** Provider timestamps may not backdate data first observed later.

---

## Previously validated foundations

### Universal Commander / V0.15 experimental MCP

Experimental tool:

- `build_commander_through_pipeline_v15`

Validated guarantees include:

- one/two exact commander inputs with ordered pair semantics;
- true no-target behavior;
- printing/set/promo/special controls;
- exact per-card budget enforcement using exact printing/finish witnesses;
- free-form themes and exact Final Fantasy printing-family enforcement;
- excluded/must-include/land controls;
- verified win-package modes;
- exact final decklist/printing/audits/provenance/source state;
- finished deck assessed before requested-vs-achieved bracket comparison;
- protocol-boundary E2E validation rather than service-only tests.

### Exact probability / statistics

Implemented and independently tested:

- BigInt exact hypergeometric probabilities, complements, expectation and variance;
- disjoint package assembly;
- overlap-aware physical-card assignment without double counting;
- command-zone-aware 99/98-card libraries;
- opening-hand + turn access curves;
- seeded Monte Carlo calibration against exact truth.

Permanent regression: one universal A/B tutor cannot simultaneously satisfy both missing A and B roles.

Classic control: 99-card library, 36 lands, 7-card opener, `P(3+ lands) = 26,736,733 / 53,358,536 ≈ 50.1077%`.

### Historical / as-of provenance

Strict historical work includes explicit temporal provenance, historical card-data assessment, historical Commander legality, historical learning records/manifests, leakage-aware TopDeck materialization and sealed future evaluation.

Core guarantees:

- current truth cannot silently become historical proof;
- verified absence is distinct from unavailable truth;
- later printing/Oracle/rules/outcome evidence cannot leak backward;
- trusted rows bind predictor provenance separately from target provenance;
- source version + SHA-256 content hash are required for replayable trusted evidence;
- runtime assertions re-check eligibility instead of trusting serialized booleans.

---

# V0.15 promotion route — INFRASTRUCTURE COMPLETE

The old promotion problem was **not CI**. Two architectural issues were blocking a trustworthy promotion story:

1. the sealed evaluator deliberately returned `promotionAuthorized: false` and had no intermediate state meaning “the evidence passed and is ready for explicit review”;
2. completed-event TopDeck decklists and provider `startDate` did not prove that the predictor state existed before the event outcome, creating a potential backward-leakage path.

The active branch now implements the complete fail-closed route below.

## 1. Promotion-readiness state

`promotion-readiness-v15.ts` and `promotion-aware-future-model-eval-v15.ts` add:

- `blocked`;
- `eligible-for-human-review`.

They deliberately preserve:

- legacy sealed evaluator `promotionAuthorized: false`;
- `automaticStablePromotionAllowed: false`;
- `stablePromotionAuthorized: false`;
- `requiresExplicitUserApproval: true`.

The older transparent ranker field named `promotable` is a **legacy local deterministic-holdout concept only**. It is not stable/model release authorization.

## 2. Retained Scryfall predictor truth

The retained Scryfall path provides:

- exact gzip JSONL capture;
- SHA-256 over exact provider bytes;
- immutable GHCR OCI digest references;
- retained snapshot manifests;
- cutoff resolver based on our own observation time, never provider `updated_at` backdating;
- exact-byte replay through the same bounded Scryfall parser used for live capture;
- decoded-content hash verification.

Manual workflow:

- `.github/workflows/scryfall-carddata-retention-v15.yml`

This workflow is `workflow_dispatch` only. It has not been dispatched during implementation.

## 3. Prospective TopDeck predictor/target evidence

The safe prospective route uses known TopDeck events rather than pretending completed-event decklists were pre-event evidence.

TopDeck evidence phases:

- `pre-event`: capture exact strict `deckObj` decklists only while provider status is still `Not Started` and observation finishes no later than event start;
- `event-end`: capture provider `Complete` plus `endDate`;
- `completed-event`: capture the exact final TID tournament response after completion and hash its exact bytes.

The completed response must agree with the independently captured event identity and `startDate`.

Manual workflow:

- `.github/workflows/topdeck-prospective-evidence-v15.yml`

Sensitive player/deck evidence is written only to a private GHCR package. Public Actions artifacts contain aggregate diagnostics only.

## 4. Deterministic promotion evidence join

`topdeck-prospective-promotion-join-v15.ts` joins:

- pre-event exact deck evidence;
- retained Scryfall predictor truth;
- completed-event TopDeck result/evidence.

It requires:

- matching event/player/record identity;
- final deck fingerprint exactly equals the pre-event deck fingerprint;
- feature availability is the later of deck capture and card-data observation;
- combined predictor state exists no later than event start;
- structural features are reconstructed from retained Scryfall truth;
- final top-cut outcome timing is provider-verified event end, not legacy `startDate`.

Explicit rejection states include missing pre-event deck, changed final deck, late predictor truth, snapshot failure and promotion-evidence failure.

Manual workflow:

- `.github/workflows/topdeck-prospective-promotion-join-v15.yml`

It accepts only expected-package `@sha256:<digest>` references. Sensitive joined evidence remains private.

## 5. Strict promotion corpus admission

`topdeck-promotion-corpus-admission-v15.ts` does **not** trust a serialized eligibility flag.

For every immutable joined artifact it re-checks:

- promotion assessment and safeguards;
- provider identities;
- exact deck fingerprint;
- predictor/outcome timing;
- evidence hashes;
- immutable private GHCR digest reference.

It then uses the existing real TopDeck corpus materializer for leakage grouping, temporal partitioning, normalization and labels, but re-creates historical records with immutable promotion-evidence lineage in metadata before rebuilding manifests.

Changing an underlying joined-evidence artifact changes the historical manifest/corpus hash; tests enforce this.

Manual workflow:

- `.github/workflows/topdeck-promotion-corpus-build-v15.yml`

The full corpus remains private. Public audit exposes only counts/hashes.

## 6. Replay-before-seal

Before a production future-holdout seal can be created, the system:

- pulls the private corpus;
- extracts every immutable joined-evidence reference;
- re-pulls every joined artifact;
- rebuilds the strict corpus from source evidence;
- compares evidence-lineage hash, record count, learning/historical manifest hashes, corpus content hash, normalizer fingerprint, observation time and artifact set.

Only then can `createFutureHoldoutSealV15` run.

Production sealing requires:

- real system-clock attestation;
- existing strict corpus quality gate;
- at least 20 strict training records.

Manual workflow:

- `.github/workflows/topdeck-promotion-future-holdout-seal-v15.yml`

The private seal binds the immutable corpus artifact plus all existing sealed training identities/hashes/normalizer/hyperparameters/thresholds.

## 7. Frozen-normalizer genuine-future holdout

`topdeck-sealed-future-holdout-v15.ts` fixes the major future-evaluation leakage risk: **future data never fits a new normalizer**.

The future materializer requires:

- exact training corpus still matches the seal;
- supplied training normalizer fingerprint exactly matches the seal;
- future prediction cutoff and feature snapshot are strictly after the seal;
- future outcomes and outcome evidence are strictly after the seal;
- training/future provider events are disjoint;
- training/future pilots are disjoint;
- training/future exact deck fingerprints are disjoint;
- training/future leakage groups are disjoint;
- future rows are projected through the frozen sealed training normalizer;
- no future temporal repartitioning occurs.

Regression tests build a 20-row sealed training corpus and explicitly reject wrong normalizers, pre-seal predictor evidence, reused pilots and reused exact decks.

Manual workflow:

- `.github/workflows/topdeck-sealed-future-holdout-build-v15.yml`

## 8. Promotion-aware sealed evaluation

`topdeck-promotion-future-evaluation-v15.yml` pulls immutable:

- future-holdout seal;
- bound training corpus;
- sealed future holdout.

Before evaluation it re-checks:

- seal/corpus/holdout artifact bindings;
- training historical manifest and corpus hashes;
- frozen normalizer fingerprint;
- reconstructed future historical manifest;
- every future record’s seal/training-hash/normalizer metadata.

Then it calls `evaluatePromotionAwareSealedFutureHoldoutV15`.

Possible public readiness status:

- `blocked`;
- `eligible-for-human-review`.

Even `eligible-for-human-review` keeps stable-runtime authorization false.

All full evaluation material stays private; public audit exposes aggregate model metrics/readiness only and excludes commander subgroup keys, player IDs, decklists and card names.

---

## Locked genuine-future review criteria

The future seal freezes the current precommitted requirements, including:

- at least **200** genuine-future holdout records;
- minority-class share at least **0.20**;
- neural balanced-accuracy gain over transparent baseline at least **+0.02**;
- neural AUROC gain over transparent baseline at least **+0.01**;
- **no log-loss regression** versus the transparent baseline;
- system-clock-attested seal;
- exact feature-extractor contract and training-normalizer fingerprint match;
- disjoint leakage groups, provider events, pilots and exact decks;
- strict training and future corpus quality gates.

Passing those criteria can only earn an explicit promotion review. It does not alter stable V0.13.

---

## Real TopDeck source standing

A repository Actions secret named `TOPDECK_API_KEY` is configured and working. Never expose, print or persist its value.

The completed-tournament bulk path remains useful for provider/schema/live controls and research, but **completed historical decklists are not silently upgraded into pre-event promotion evidence**.

The current safe promotion source route is prospective and event-specific: exact deck observed before event start, then exact completion evidence after event end.

TopDeck account/staff event routes and webhooks do not provide a general public upcoming-event feed; do not manufacture a global upcoming-event poller from them.

---

# Next implementation target

The **promotion infrastructure blocker is solved**. The remaining blocker is real evidence quantity and diversity.

## 1. Begin real prospective evidence collection

Use the manual evidence workflows only for known TopDeck events where exact deck data is actually available before start.

For each qualifying event:

1. ensure retained Scryfall predictor truth exists before the intended predictor cutoff;
2. run the TopDeck `pre-event` capture before start;
3. after completion run `completed-event` (event-end timing is captured as part of the strict completion path; the standalone `event-end` phase remains useful for audit/debugging);
4. run the digest-pinned promotion join;
5. keep unavailable/changed/late rows rejected rather than weakening the gate.

Do not schedule broad automatic collection until event discovery/access/privacy/rate-limit policy is explicitly designed and validated.

## 2. Build the first real strict promotion corpus

Once enough joined artifacts exist:

1. run the manual corpus build;
2. inspect accepted/rejected coverage, class balance, dates, commanders, field sizes, regions, pilots, events, exact deck reuse and leakage-component concentration;
3. do not seal if the real corpus quality gate fails;
4. do not count EDHTop16 mirrors as independent TopDeck lineage evidence.

## 3. Create the first real system-clock seal

Only when the strict corpus is adequate:

1. run replay-before-seal;
2. preserve the immutable corpus and seal digest references;
3. do not alter the training corpus/model thresholds after the seal.

## 4. Accumulate genuinely later holdout evidence

Collect disjoint prospective events after the seal until the locked minimum sample and class balance are reached.

Future holdout rows must use the exact sealed training normalizer. Never refit it with future data.

## 5. Evaluate and request review only if earned

Run the sealed future evaluation only against the immutable seal/training corpus/future holdout chain.

- If `blocked`: continue evidence collection or start a **new precommitted experiment**; do not tune retrospectively against the sealed holdout and then reuse the same seal.
- If `eligible-for-human-review`: present the evidence to the user and request an explicit release decision.

Only a later explicit user-approved release may change `server-current`, package version or `main`.

---

## Validation discipline

For functional implementation folds, require all four on the exact head:

1. deterministic CI;
2. Scryfall Card Data Source Live;
3. TopDeck Learning Source Live;
4. Commander Live Control Suite, including final aggregate.

Use an isolated branch + temporary draft PR as a validation surface. Integrate only by clean non-force fast-forward after confirming zero divergence. Close temporary PRs unmerged.

Documentation-only handoff commits may sit ahead of the fully validated implementation SHA, but must never be confused with a new runtime implementation milestone.

---

## Fresh-chat prompt

> Continue the Ultimate MTG project in `vt7dfbmh7b-droid/mtg-ultimate-mcp`. Read `PROJECT_HANDOFF.md` and `ULTIMATE_MTG_SPEC.md` first. Inspect `agent/package-probabilities`, the latest validated implementation SHA, and current CI before changing code. Continue from the Next implementation target. Do not promote `server-current` or merge to `main` without an explicit user-approved release decision.
