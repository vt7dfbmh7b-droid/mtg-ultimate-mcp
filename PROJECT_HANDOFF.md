# Ultimate MTG — Project Handoff

_Last updated: 2026-08-19 NZST_

This is the persistent recovery point for future ChatGPT sessions. Read it together with `ULTIMATE_MTG_SPEC.md`: the spec is the north star; this file records the current validated implementation, release state, hard guarantees, validation discipline, and next engineering target.

## Fresh-chat resume instructions

1. Open `vt7dfbmh7b-droid/mtg-ultimate-mcp`.
2. Read `PROJECT_HANDOFF.md` and `ULTIMATE_MTG_SPEC.md` first.
3. Inspect `agent/package-probabilities`; do not assume `main` is the active development state.
4. Check the exact active-branch head and current GitHub Actions status before changing code.
5. Distinguish the latest fully validated **implementation SHA** from any later handoff-only documentation commit.
6. Keep deterministic CI, TopDeck/source validation, and Commander live controls separate.
7. Do not promote `server-current` merely because V0.15 experimental code exists.
8. Continue from **Next implementation target** unless a newer commit updates this handoff.

---

## Repository / release state

**Repository:** `vt7dfbmh7b-droid/mtg-ultimate-mcp`

**Active continuation branch:** `agent/package-probabilities`

**Latest fully validated implementation head:**

- `20c4c7d18d148c251b72a750b86336969f74f002` — real TopDeck outcome/deck acquisition plus strict real-corpus/future-model-evaluation infrastructure, folded into the active development lineage.

The active branch was fast-forwarded from the prior handoff head `ffe1e7e7e25658773387e36ea8c2c7f8f565116e` to `20c4c7d...` with `force=false`. No merge to `main` occurred.

The branch may be one documentation-only handoff commit ahead of `20c4c7d...`. If so, inspect the diff: `20c4c7d...` remains the validated runtime implementation milestone.

### Real-corpus milestone validation

Isolated implementation branch:

- branch `agent/v15-real-corpus-evaluation`, created from active handoff head `ffe1e7e7...`;
- final isolated implementation SHA `20c4c7d18d148c251b72a750b86336969f74f002`;
- temporary draft PR #12 used only as a validation surface;
- deterministic CI `32231162434`: **PASS**;
- TopDeck Learning Source Live `32231162439`: **PASS**;
- Commander Live Control Suite `32231162554`: **PASS**;
- every Commander live control + final aggregate passed;
- PR #12 closed **unmerged**.

Active fold and revalidation:

- `agent/package-probabilities` fast-forwarded to the exact same `20c4c7d...` object with no force;
- deterministic CI `32232204742`: **PASS**;
- TopDeck Learning Source Live `32232204861`: **PASS**;
- Commander Live Control Suite `32232204897`: **PASS**;
- every Commander live control + final aggregate passed;
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

## Previously completed foundations

### Universal Commander / V0.15 experimental MCP

Experimental tool:

- `build_commander_through_pipeline_v15`

Key guarantees already validated:

- one/two exact commander inputs with ordered pair semantics;
- true no-target behavior;
- printing/set/promo/special controls;
- exact per-card budget enforcement using exact printing/finish witnesses;
- safe free-form themes and exact Final Fantasy printing-family enforcement;
- excluded/must-include/land controls;
- verified win-package modes;
- exact final decklist/printing/audits/provenance/source state;
- finished deck assessed before requested-vs-achieved bracket comparison;
- actual protocol-boundary E2E control rather than service-only testing.

Neutral construction uses bounded stratified Scryfall sampling rather than popularity ordering. Source failures stay unavailable rather than becoming false negatives.

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

Strict historical work includes:

- `historical-carddata-provenance-v15.ts`;
- `historical-carddata-snapshot-validation-v15.ts`;
- `temporal-provenance-v15.ts`;
- `historical-learning-corpus-v15.ts`;
- `topdeck-temporal-corpus-v15.ts`;
- `historical-neural-temporal-eval-v15.ts`.

Core guarantees:

- explicit temporal modes distinguish current truth, contemporaneous snapshot, archived/versioned snapshot and retrospective reconstruction;
- verified absence is distinct from unavailable truth;
- current truth cannot silently become historical proof;
- later printing/Oracle/Commander-legality/rules/outcome/source evidence cannot leak backward through an earlier cutoff;
- archived evidence retrieved later is only accepted when independent version/publication timing proves it existed by the cutoff;
- retrospective-current/present-day proxy evidence is advisory-only and cannot satisfy strict historical rich-feature training;
- trusted historical rows bind predictor provenance separately from target/outcome provenance;
- source version + SHA-256 content hash are required for replayable trusted training evidence;
- runtime assertions re-check eligibility instead of trusting serialized booleans;
- historical manifests content-address predictor and target provenance;
- historical neural evaluation filters by evidence availability before generic temporal evaluation.

Current live Commander/deckbuilding evaluation remains **current-truth by default**. Historical semantics are opt-in through strict provenance APIs.

---

## Real corpus / model evaluation milestone — PROVIDER FOUNDATION COMPLETE

This milestone turns the previous ML scaffolding into a real-data-capable evaluation boundary without claiming that a trustworthy historical training corpus already exists.

### 1. Real source inventory and independence policy

`real-outcome-source-inventory-v15.ts` classifies provider lineage, target population, replayability and training eligibility.

Current policy:

- **TopDeck**: strict historical `event-top-cut` provider when evidence passes the provenance boundary;
- **EDHTop16**: competitive reference/mirror in the TopDeck tournament-results lineage and therefore **not independent corroboration** of the same underlying TopDeck events;
- **Playgroup**: separate casual tracked-game population/reference and not silently mixed into the competitive event-top-cut target.

Source diversity remains a future requirement; mirrors/reposts may never manufacture independent evidence count.

### 2. Real corpus quality audit

`real-corpus-quality-v15.ts` audits real historical records across:

- date/temporal coverage;
- learning target and outcome class;
- source and lineage family;
- commander coverage;
- event field-size buckets;
- provider event identity;
- pilot identity;
- exact deck fingerprints;
- leakage groups;
- region when provider metadata exists;
- archetype when explicit metadata exists;
- class balance and replayability.

Quality blockers/warnings remain separate from model performance.

### 3. Leakage grouping before normalization/fitting

`topdeck-leakage-linkage-v15.ts` constructs transitive connected components before the temporal split using:

- same tournament/event;
- same provider pilot identity;
- identical exact deck fingerprint.

If A shares an event with B, B shares a pilot with C, and C shares a deck with D, all four stay in one leakage component. The grouping is input-order invariant and happens before normalization/model fitting.

### 4. Genuine future holdout precommitment

`future-holdout-seal-v15.ts` content-addresses and freezes:

- training historical manifest/corpus identity;
- training outcome IDs and leakage-group digest;
- learning target;
- feature extractor contract;
- training-fitted normalizer fingerprint;
- neural hyperparameters/seed;
- transparent baseline hyperparameters;
- decision threshold;
- calibration bins;
- minimum future sample/class-balance requirements;
- precommitted improvement criteria.

A real-clock attestation prevents injected test-clock seals from being represented as genuine future precommitments.

### 5. Sealed baseline-vs-neural future evaluation

`sealed-future-model-eval-v15.ts` compares on the same locked genuine-future holdout:

- prevalence baseline;
- transparent logistic/ranker baseline;
- neural/shadow model.

Reported metrics include:

- accuracy;
- balanced accuracy;
- log loss;
- Brier score;
- AUROC;
- expected calibration error + calibration bins;
- Wilson 95% accuracy interval;
- source/commander/field-size subgroup results.

Training/future overlap in leakage group, provider event, pilot or exact deck fingerprint fails closed. Output always keeps `promotionAuthorized: false`; even observed neural gain is evidence for continued shadow testing, not stable promotion.

---

## Real TopDeck acquisition milestone — COMPLETE

A repository Actions secret named `TOPDECK_API_KEY` is now configured and working. Never expose, print or persist its value.

Dedicated workflow:

- `.github/workflows/topdeck-learning-source-live.yml`
- `scripts/live-topdeck-learning-source-v15.ts`

Network policy:

- bounded one-request bulk EDH query;
- no automatic POST retry;
- typed rate-limit handling;
- required TopDeck attribution;
- provider/source failures do not become absence evidence;
- live artifacts contain aggregate diagnostics only.

### Current live TopDeck bulk contract

Live validation discovered and then codified the actual current provider shape rather than guessing it:

- bulk `standing` is not requested as a selectable column; when absent, the documented standings-array order provides rank `index + 1`;
- an explicit valid standing is still preferred when provided;
- a malformed explicit standing fails closed;
- provenance records `standingSource = provider-field | bulk-array-order`;
- current returned `decklist` values are often one-line provider references rather than multiline deck text;
- when structured deck data exists, current live `deckObj` exposes `Commanders` and `Mainboard` sections;
- live aggregate schema auditing established each observed card-name key mapped exactly to an object containing `id` plus numeric `count`;
- commander sections contained exactly one or two entries in the observed batch.

`materializeTopDeckDeckObjectV15` therefore accepts only the narrow observed contract:

> `Commanders/Mainboard -> card-name key -> { id, count }`

Hard checks:

- each structured entry must contain exactly `id` + `count`;
- `id` must be non-empty;
- count must be an integer 1–100;
- exactly one or two commanders;
- each commander count exactly 1;
- total physical card count exactly 100;
- final text is revalidated through the existing Commander parser;
- unknown future provider shapes fail closed;
- third-party deck URLs/references are **never fetched or scraped** to fill gaps.

Candidate metadata records:

- `deckSource = inline-text | topdeck-deckobj`;
- `deckObjectSchemaVersion` when structured materialization is used;
- standing source;
- provider event/player identities;
- event city/state only when provider supplied them.

TopDeck historical outcome source version is now:

- `topdeck-v2-materialized-outcome-v15.2`

Its replayable SHA-256 binds exact deck fingerprint and commander identity plus provider event/player/record IDs, outcome timing/result, standing/field/top-cut, standing source, deck source, structured schema version, location and W/D/L metadata.

### Final real live audit at validated implementation

Bounded query:

- last 30 days;
- Magic: The Gathering / EDH;
- minimum 16 participants;
- one bulk POST, no automatic retry.

Observed live batch:

- **478 tournaments**;
- **12,121 standings rows**;
- **5,257** rows with structured `deckObj` containing Commanders + Mainboard;
- commander-section distribution: **3,525** single-commander and **1,732** two-commander structured decks;
- **4,395 strict exact Commander deck/outcome candidates accepted**;
- **173 accepted events**;
- accepted field size: **16–105 players**;
- accepted outcome range: **2026-07-21T22:00:00Z to 2026-08-18T22:00:00Z**;
- rejected: **1,632** standings without usable deck data plus **279** tournaments without a positive usable top cut;
- no remaining malformed structured-deck rejection in the final live batch.

Privacy-safe audit artifacts persist **no API key, player identifiers, card names, decklists, third-party deck references, or raw rejection reasons**.

### Critical interpretation

This is **real exact outcome/deck candidate acquisition**, not yet a trustworthy historical ML training corpus.

The historical feature gate still requires predictor card/Oracle/legality data that was independently available no later than the prediction cutoff. Present-day Scryfall/MTGJSON/current Oracle truth may not be assigned an old timestamp or silently used as historical proof.

---

## Learning / ML standing rules

Neural/ML remains experimental and shadow-only.

It may never override legality, rules, printing, budget, theme, combo or other hard truth.

Promotion may not be justified by feature count, synthetic fixtures, retrospective current-state substitution, provider popularity, or a single headline metric.

---

## Next implementation target

### 1. Provenance-safe historical predictor/card-data acquisition

This is now the immediate blocker to turning the 4,395 real TopDeck candidates into a trustworthy historical training corpus.

Required direction:

1. inventory candidate **primary/versioned card-data sources** for historical Oracle/type/mana/printing/Commander-legality features;
2. distinguish a current daily feed from an independently archived/versioned snapshot — a current feed alone is not historical proof;
3. verify source publication/effective timestamps and preserve source URI, version and SHA-256 content hash;
4. use `archived-versioned-snapshot` only when the archive was independently published/effective by the requested feature cutoff;
5. if no adequate historical archive exists, prefer a new **forward contemporaneous-capture pipeline** rather than weakening the historical gate;
6. never assign an old `availableAt` to data first observed today;
7. resolve only printings that actually existed by the cutoff and run the existing historical Commander legality/construction validator;
8. materialize `ProvenancedDeckFeatureSnapshotV15` only after the source passes the existing historical card-data assessment;
9. join those snapshots to real TopDeck candidates through `topdeck-real-corpus-materializer-v15` and the leakage grouping boundary;
10. report what fraction of real TopDeck candidates can actually receive trusted predictor snapshots; rejected/unavailable rows must remain visible.

Current research note: MTGJSON provides a current daily build and is MIT-licensed, but **do not assume the current file server is a historical archive**. Verify a replayable archived/versioned data path before using it for retrospective rich features. Sparse software/release tags are not automatically equivalent to daily historical data snapshots.

TopDeck's completed-tournament bulk API provides the outcome/deck side. A genuine future-capture design may also be investigated, but decklists are only exposed before tournament end when the organizer has enabled deck visibility, so do not assume pre-event public deck availability for every event.

### 2. Then materialize and audit the first real historical corpus

Once trusted predictor snapshots exist:

1. build the strict historical TopDeck corpus;
2. measure usable/rejected coverage by date, commander, field size, region, provider and outcome class;
3. inspect repeated events/pilots/decks and leakage component sizes;
4. keep source/provider drift reporting active;
5. do not fit the neural model until corpus quality gates pass.

### 3. Then seal a genuinely future holdout and evaluate

After a trustworthy historical training corpus exists:

1. create a real-clock `FutureHoldoutSealV15` before future outcomes are admitted;
2. never use future holdout rows for normalizer fitting, feature selection, hyperparameters or threshold tuning;
3. compare prevalence, transparent baseline and neural shadow model on the same future holdout;
4. require the precommitted sample size/class-balance and improvement criteria;
5. report calibration, discrimination, uncertainty and subgroups/drift;
6. learned outputs remain shadow/advisory-only even if gain is observed.

Do **not** manufacture corpus scale with synthetic outcomes, current-state historical substitutions, mirrored providers, or third-party deck scraping.

### 4. Promotion remains a later decision

Even successful real-corpus/future evaluation does not automatically promote V0.15 or any learned model. Stable promotion requires a separate explicit user-approved release decision after all quality gates are satisfied.

---

## CI / validation discipline

For every implementation milestone:

1. isolate material work when useful;
2. strict TypeScript/build;
3. complete deterministic tests;
4. dedicated live source control when external data is part of the feature;
5. inspect underlying live outcomes rather than only a green aggregate;
6. remember `continue-on-error` can hide an underlying failed step until aggregate time;
7. distinguish source outage, credential/configuration failure, provider-shape drift, harness failure and code/assertion failure;
8. fold into `agent/package-probabilities` only after validation;
9. revalidate the exact active branch after the fold;
10. keep `main`, `package.json` stable version and `server-current` unchanged unless the user explicitly approves release promotion.

Never weaken a truth gate just to make CI green.

---

## Maintenance rule

Update this file after every major milestone, blocker/recovery event, or active-target change.

A future session must be able to recover the project direction and current engineering state from GitHub alone without old chat history.
