# Ultimate MTG — Project Handoff

_Last updated: 2026-08-20 NZST_

This is the persistent recovery point for future ChatGPT sessions. Read it with `NEW_CHAT_HANDOFF.md`, `ULTIMATE_MTG_SPEC.md`, and `BASIC_FEATURES.md`.

## Fresh-chat resume instructions

1. Open `vt7dfbmh7b-droid/mtg-ultimate-mcp`.
2. Read `NEW_CHAT_HANDOFF.md`, `PROJECT_HANDOFF.md`, `ULTIMATE_MTG_SPEC.md`, and `BASIC_FEATURES.md` first.
3. Inspect `agent/package-probabilities`; do not assume `main` is the active development state.
4. Inspect PR #2 and the exact branch head plus current GitHub Actions before changing code.
5. Distinguish the latest fully validated **implementation SHA** from any later handoff-only documentation commit.
6. Keep deterministic CI, Scryfall live source validation, TopDeck live source validation, and Commander live controls separate.
7. Continue from **Next implementation target** unless a newer commit changes this handoff.
8. Never promote `server-current`, merge to `main`, or call V0.15 stable without explicit user approval.

---

## Repository / release state

Repository:

- `vt7dfbmh7b-droid/mtg-ultimate-mcp`

Active development branch:

- `agent/package-probabilities`

Active validation PR:

- PR #2 — open, draft, base `main`, head `agent/package-probabilities`
- **DO NOT MERGE** as part of ordinary development/validation.

Current implementation candidate for this milestone:

- `ae113807c609c601de2717c08990f85c0238ee4d`

Validation already complete on that exact implementation object:

- deterministic CI `32296434358`: **PASS**
- Scryfall Card Data Source Live `32296434428`: **PASS**
- TopDeck Learning Source Live `32296434350`: **PASS**
- Commander Live Control Suite `32296434348`: **IN PROGRESS at handoff preparation — verify PASS before folding this documentation checkpoint**

The handoff/source-document branch `agent/historical-carddata-handoff` was created from the exact implementation object so documentation could be prepared without repeatedly cancelling the long Commander concurrency-controlled workflow. Any later documentation-only SHA must not be confused with a new runtime implementation milestone.

### Stable runtime remains V0.13

- package version remains `0.13.0`;
- `src/server-current.ts` remains V0.13;
- V0.14/V0.15 remain experimental;
- `main` remains untouched by the experimental development line.

**No stable promotion is authorized.**

---

## Permanent truth hierarchy

Machine learning, optimization, simulation, popularity, requested power, or convenience may never override:

- Commander legality;
- exact card count / command-zone count;
- singleton and color identity;
- unresolved-card failures;
- banned/current rules truth;
- exact physical-printing existence and printing-family/finish restrictions;
- must-include / must-exclude requirements;
- exact per-card hard budgets;
- known rules facts;
- verified combo requirements;
- source availability/evidence state.

A provider outage is **not** evidence of absence.

Historical evaluation adds a permanent rule: **later knowledge may not leak backward into an earlier prediction cutoff.**

---

## Previously completed foundations

### Universal Commander / V0.15 experimental pipeline

Experimental tool:

- `build_commander_through_pipeline_v15`

Validated foundations include:

- one/two commander configuration handling;
- exact Commander legality/construction checks;
- exact printing/set/promo/special controls;
- hard per-card budget witnesses;
- Final Fantasy printing-family constraints;
- must-include/must-exclude/land controls;
- verified combo/win-package modes;
- exact final deck/printing audits and provenance;
- requested-vs-achieved power assessment only after the finished deck is validated.

### Exact probability/statistics

Implemented and regression-tested:

- BigInt exact hypergeometric probability;
- complements, expectation and variance;
- disjoint and overlap-aware package probabilities;
- command-zone-aware 99/98-card libraries;
- opening-hand/turn access curves;
- seeded Monte Carlo calibration against exact truth.

### Historical / as-of provenance

Core historical services include:

- `historical-carddata-provenance-v15.ts`;
- `historical-carddata-snapshot-validation-v15.ts`;
- `temporal-provenance-v15.ts`;
- `historical-learning-corpus-v15.ts`;
- `topdeck-temporal-corpus-v15.ts`;
- `historical-neural-temporal-eval-v15.ts`.

Existing rules distinguish:

- current truth;
- contemporaneous capture;
- archived/versioned snapshots;
- retrospective-current reconstruction.

Retrospective current truth cannot satisfy strict historical rich-feature training. Archived evidence retrieved later is accepted only when independent publication/effective timing proves that exact version existed by the cutoff.

### Real corpus / future-evaluation infrastructure

Already present:

- real outcome source/lineage policy;
- real-corpus quality audit;
- event/pilot/exact-deck leakage linkage before normalization/fitting;
- genuine-future holdout sealing;
- transparent baseline versus neural shadow evaluation;
- promotion always left unauthorized by evaluation output.

ML remains shadow/advisory only and cannot override hard MTG truth.

---

## Real TopDeck outcome/deck acquisition — COMPLETE

TopDeck live acquisition is already provider-validated with a repository secret `TOPDECK_API_KEY`. Never reveal or persist the secret.

Current bounded audit established:

- 478 tournaments in the live 30-day/16+ player EDH batch;
- 12,121 standings rows;
- 5,257 structured `deckObj` rows with Commanders + Mainboard;
- 3,525 single-commander and 1,732 two-commander structured decks;
- **4,395 strict exact Commander deck/outcome candidates accepted**;
- **173 accepted events**;
- accepted field size 16–105;
- accepted outcome range 2026-07-21T22:00:00Z through 2026-08-18T22:00:00Z.

These are real exact outcome/deck candidates, **not automatically trustworthy historical training rows**.

---

## Provenance-safe historical predictor/card-data acquisition — IMPLEMENTED

This is the milestone completed after the prior handoff target.

### 1. Generic acquisition boundary

New service:

- `src/services/historical-carddata-acquisition-v15.ts`

It provides:

- replay of a separately audited pinned archived snapshot;
- source URI/version/effective/publication timestamps;
- exact SHA-256 source content hash;
- optional exact byte length;
- bounded streaming even when `Content-Length` is absent;
- strict UTF-8/JSON/card-shape checks;
- provenance eligibility check before network access for historical archive pins;
- contemporaneous current capture with observation time assigned at capture;
- direct integration with `extractProvenancedDeckFeatureSnapshotV15`.

Current data cannot be given an old `availableAt` to make it historical.

### 2. Machine-readable source policy

New service:

- `src/services/historical-carddata-source-inventory-v15.ts`

Current policy:

- Scryfall `default_cards`: forward contemporaneous capture enabled; retrospective backfill blocked; `historicalArchiveVerified: false`.
- MTGJSON `AllPrintings`: current daily-build candidate; native adapter still required; retrospective backfill blocked; `historicalArchiveVerified: false`.

No verified replayable daily historical archive has been registered.

### 3. Current Scryfall provider contract discovered live

New services/workflow:

- `src/services/scryfall-bulk-carddata-source-v15.ts`
- `src/services/scryfall-forward-carddata-capture-v15.ts`
- `scripts/live-scryfall-carddata-source-v15.ts`
- `.github/workflows/scryfall-carddata-source-live.yml`

A first strict live control intentionally failed because it assumed an older `download_uri` JSON-array shape. A temporary safe manifest-shape probe then established the real 2026 provider contract from Scryfall itself.

Current `default_cards` fields used by the implementation:

- `id`;
- `type = default_cards`;
- `updated_at`;
- provider metadata `uri` on `api.scryfall.com/bulk-data/...`;
- positive `compressed_size`;
- `jsonl_download_uri` on HTTPS `*.scryfall.io`, ending `.jsonl.gz`.

The temporary shape probe was removed after the strict contract was encoded.

### 4. Scryfall forward capture safeguards

The Scryfall path now:

- accepts only HTTPS `*.scryfall.io` `.jsonl.gz` static files;
- enforces manifest `compressed_size`;
- bounds compressed bytes while streaming;
- hashes the **exact compressed source bytes** for provenance;
- rejects transport `Content-Encoding` that could make exact provider bytes ambiguous through automatic decoding;
- uses bounded gzip decompression with Node `maxOutputLength`;
- parses JSON Lines record-by-record;
- validates UTF-8, JSON and required Scryfall card shape;
- applies a per-record byte bound;
- stamps observation/retrieval time at capture;
- never converts provider `updated_at` into historical availability proof.

The dedicated live workflow downloads only the small Scryfall bulk manifest. It does **not** persist or audit card names, card data or the static bulk-file path.

### 5. Historical predictor integration remains strict

Verified archive replay and future retained captures still feed the existing historical printing resolver and dated Commander validator.

Therefore the existing 4,395 TopDeck candidates are **still not retrospectively trainable just because current Scryfall data exists**. A candidate needs predictor evidence that was genuinely available by its cutoff.

Detailed source notes live in:

- `docs/V0.15_HISTORICAL_CARD_DATA_SOURCES.md`

---

## NEXT IMPLEMENTATION TARGET

### Retained forward capture / content-addressed card-data snapshots

Because no adequate retrospective archive has been verified, the next safe target is to make today-and-future Scryfall captures replayable evidence rather than weakening historical requirements.

Required direction:

1. define an immutable retained snapshot manifest for each capture;
2. store or address the exact `.jsonl.gz` source bytes by SHA-256;
3. persist source ID, discovery/observation time, provider metadata identity, provider `updated_at`, compressed size, source URI identity and local content hash without treating provider time as proof before observation;
4. prevent a snapshot from being mutated/relabelled after capture;
5. add deterministic replay verification that bytes still match the retained SHA-256 and expected size before feature extraction;
6. define lookup semantics for “newest trusted capture available no later than cutoff”;
7. return explicit unavailable coverage when no retained snapshot existed by a cutoff;
8. keep snapshot retention/indexing bounded and content-addressed;
9. add a safe capture/retention workflow only after storage semantics are explicit;
10. continue searching for a genuine independently replayable historical archive in parallel.

After retained snapshots overlap real TopDeck candidates/future outcomes:

1. measure usable/rejected/unavailable predictor coverage;
2. materialize the first strict real historical/forward-observed corpus;
3. audit date/commander/field/source/outcome/leakage coverage;
4. do not fit neural models until corpus quality gates pass;
5. then seal a genuine future holdout before future outcomes are admitted.

Do **not** manufacture corpus scale using current-state historical substitution, synthetic outcomes, mirrored providers, or third-party deck scraping.

---

## Validation discipline

For every material milestone:

1. inspect the exact active head before changes;
2. isolate material work where useful;
3. strict TypeScript/build;
4. complete deterministic tests;
5. dedicated live provider control when external source shape matters;
6. inspect failed steps/artifacts rather than weakening truth gates;
7. distinguish provider outage, provider drift, rate limit, credentials, harness failure and code failure;
8. fold only with a non-force fast-forward when ancestry permits;
9. validate the exact active lineage after fold;
10. update handoff documents;
11. keep `main`, stable package version and `server-current` unchanged unless the user explicitly approves promotion.

---

## Maintenance rule

Update this file after every major milestone, blocker/recovery event, or active-target change.

A future session must be able to recover the project direction and current engineering state from GitHub alone without old chat history.