# Ultimate MTG — Project Handoff

_Last updated: 2026-08-18 NZST_

This file is the persistent recovery point for future ChatGPT sessions. Read it together with `ULTIMATE_MTG_SPEC.md`: the spec is the north star; this file records current implementation state, hard guarantees, and the next target.

## Fresh-chat resume instructions

1. Open `vt7dfbmh7b-droid/mtg-ultimate-mcp`.
2. Read `PROJECT_HANDOFF.md` and `ULTIMATE_MTG_SPEC.md` first.
3. Inspect the current head and recent commits of `agent/package-probabilities`.
4. Inspect CI for that **exact head** before changing code.
5. Do **not** assume `main` is the active development state.
6. Do **not** promote `server-current` merely because V0.14/V0.15 code exists.
7. Continue from **Next implementation target** unless a newer commit changes this handoff.

---

## Repository / release state

**Active continuation branch:** `agent/package-probabilities`

**Current implementation/test head before this handoff update:**

- `34e51d7e74b89c9563b2983e397996c0b7c1ba87` — historical card-data content fingerprint persisted into feature/corpus provenance; dependency install, strict TypeScript build, and complete automated tests succeeded.

Important recent milestone commits:

- `d278f6ec7cbc7abf085a9637e6293675fdc013a9` — `deck-structural-v15.2` card-data snapshot fingerprint implementation.
- `6920e7debf87c38d3a3d7e43ea99f256bb31e258` — historical card-data fingerprint regression tests.
- `f057b64b75946c5aa3be58f047739279a75fa3f4` — conservative cross-source outcome linkage; full CI succeeded.
- `0b490b228793cc039ec91baff4209a275721c7ac` — adversarial cross-source linkage tests.
- `816106a8174b8c5979f7d08890e4ddb42b585b6c` — integrated TopDeck temporal corpus workflow final build fix; full CI succeeded.
- `a8a3352ca347b8162efaf677a6bbc0b2439b37ae` — split-before-normalization TopDeck temporal corpus workflow.
- `158081665885885563a405879250de1dd567b4d5` — deterministic pre-feature temporal leakage partition planner.
- `d331eff686017c442784a493d8ac59fd76f07059` — deterministic content-addressed learning-corpus manifest; full CI succeeded.
- `93bd86f1ad9e7c4fe2cc21c7b1c046df46d50792` — deterministic equal-strength duplicate/mirror tie-breaking; full CI succeeded.
- `567bd44172866730f4c0e6f56130ca21ea184422` — strict TopDeck feature materializer; full CI succeeded.
- `6f402bdbe199292b8279c7cffe7910f5726217b9` — leakage-safe structural feature snapshots/normalizer tests; full CI succeeded.
- `df318ce4e52ec858b39d3a87e80479194009ef2c` — bounded live TopDeck learning fetcher tests; full CI succeeded.
- `0c0439e17b379dde5bff2c81bd2a10055b9842f0` — quarantine-first corpus ingestion + mixed-target safety; full CI succeeded.
- `87f74e6223a27b13bace8f201e1f396e11400ff1` — exact-as-oracle V0.4 simulation calibration; full CI succeeded.
- `85029cdfbe12bd8ecb0b81cbb11b197bfe35128a` — exact turn/access curves; full CI succeeded.
- `2f45b1381d525bd2a3bdfaf719894f2c8d5d5c2e` — commander-zone exact availability; full CI succeeded.
- `17bcfcc6819fcf9ef43ed5a8d14bcd9dc371ee6a` — overlap-aware exact package solver adversarial/exhaustive tests; full CI succeeded.

Temporary branches `agent/package-probabilities-2` and `agent/package-probabilities-3` contain no unique work and are not active.

### Stable runtime remains V0.13

- `package.json` remains `0.13.0`.
- `src/server-current.ts` deliberately returns `createMtgServerV13()`.
- The draft PR remains intentionally unmerged.

Preserve this separation while V0.14/V0.15 intelligence is hardened.

---

## Permanent truth hierarchy

Machine learning, optimization, simulation, external evidence, or requested bracket may never override:

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

The branch contains substantial infrastructure for:

- Commander legality, 100-card validation, partners/singleton/color identity;
- exact Oracle vs physical-printing identity and themed-printing restrictions;
- MTGJSON stock Commander precons;
- full-deck building/upgrading with protected/excluded/must-include cards and exact IN/OUT tracking;
- NZD-first pricing/budgets with source auditability;
- Scryfall, Commander Spellbook, tournament/deck evidence and source diagnostics;
- deterministic simulation and Commander E2E scenarios;
- V0.14 cEDH readiness/combo completion/refinement/from-scratch competitive building;
- V0.15 bracket ceiling/evidence, research/learning, drift detection, neural shadow ranking, exact statistics, and real-corpus safety foundations.

The neural model remains experimental/shadow-only. Real, independent, balanced, leakage-safe future outcome data is required before promotion beyond the transparent baseline.

---

## Exact statistics milestones — complete foundation

### Univariate exact hypergeometric

`src/services/exact-statistics-v15.ts`

- BigInt exact fractions, complement, expectation, variance, boundaries and population cap.
- Pinned Commander fixture: 99-card library, 36 lands, opening seven, P(3+ lands) = `26,736,733 / 53,358,536 ≈ 50.1077%`.
- Fractions, not display decimals, are the proof surface.

### Disjoint + overlap-aware package assembly

- `src/services/exact-package-statistics-v15.ts`
- `src/services/exact-overlap-package-statistics-v15.ts`

The overlap solver preserves one-physical-card/one-simultaneous-role semantics, supports alternative routes and role-specific/universal tutors, uses a Pareto frontier to prevent double counting, and has independent brute-force small-population validation. Permanent regression: one universal A/B tutor cannot satisfy both missing A and B by itself.

### Commander-zone exact availability

- `src/services/exact-commander-zone-statistics-v15.ts`
- `src/services/exact-commander-zone-statistics-v15.test.ts`

Command-zone cards are guaranteed physical cards outside the random library. The generic solver derives library population from deck size minus command-zone card count, so normal one-commander and two-commander 100-card configurations produce 99- and 98-card libraries respectively.

### Turn-by-turn exact access

- `src/services/exact-access-curve-v15.ts`
- `src/services/exact-access-curve-v15.test.ts`

Explicit draw contexts:

- `two-player-starting` — skips first-turn natural draw;
- `two-player-non-starting` — draws turn one;
- `multiplayer` — draws turn one.

Opening hand, cumulative natural access, optional explicitly guaranteed extra draws, monotonicity, library exhaustion and evaluation caps are tested. This is access/visibility, not a pretend full rules engine.

### Exact-as-oracle simulation calibration

- `src/services/simulation-exact-calibration-v15.ts`
- `src/services/simulation-exact-calibration-v15.test.ts`

The existing seeded V0.4 Monte Carlo path is calibrated against exact singleton and two-piece access probabilities. Acceptance uses a finite-sample Bernstein bound plus only the simulator’s known reporting quantization, not an arbitrary fixed ±percentage.

---

## Real learning corpus safety — current state

### Explicit learning target identity

`src/services/learning-corpus-v15.ts`

Different binary semantics cannot silently become one classifier. Current targets include `match-win`, `event-top-cut`, `deck-change-improvement`, `simulation-outcome`, `verified-package-success`, `recommendation-outcome`, and legacy compatibility.

`neural-temporal-eval-v15.ts` refuses to train one model across mixed target semantics.

### Quarantine-first observed-outcome ingestion

- `src/services/learning-corpus-ingestion-v15.ts`
- `src/services/learning-corpus-ingestion-v15.test.ts`

Hard properties:

- only registered observed-result sources can enter this path;
- source URL/provider identity is validated;
- complete exact 100-card Commander lists are required;
- exact deck fingerprint is derived internally;
- outcome time is separate from source observation time;
- event/top-cut or match-win labels are derived from objective outcome facts, not caller labels;
- malformed rows are quarantined individually;
- cross-source `canonicalOutcomeId`, independence and leakage identity are explicit;
- mirrored data is not automatically independent evidence.

### Deterministic corpus core

`src/services/learning-corpus-v15.ts` now has deterministic tie-breaking for equal-strength duplicate/mirror records. Reversing input order cannot change the surviving record or equal-timestamp temporal split membership.

### Versioned leakage-safe deck feature snapshots

- `src/services/deck-feature-snapshot-v15.ts`
- `src/services/deck-feature-snapshot-v15.test.ts`
- `src/services/deck-feature-carddata-fingerprint-v15.test.ts`

Current extractor contract: **`deck-structural-v15.2`**.

Raw auditable structural facts include:

- total/main/commander counts;
- land/nonland density;
- average nonland mana value;
- early plays;
- fast mana/ramp;
- draw/tutors;
- interaction/cheap interaction;
- protection/recursion/board wipes.

Safety properties:

- exactly 100 cards and one/two one-card commanders required;
- every deck entry must resolve;
- exact set/collector number is enforced when supplied;
- future physical printings relative to feature `availableAt` are rejected;
- `cardDataObservedAt > availableAt` is rejected;
- standing/result/popularity/price inputs are not accepted by the structural extractor;
- a SHA-256 `cardDataSnapshotFingerprint` hashes only card-data records actually used by the deck;
- card-array ordering and unrelated supplied cards do not change that fingerprint;
- relevant Oracle/card-data changes do change the fingerprint even when normalized structural metrics happen to remain numerically equal.

### Training-only feature normalization

`deck-structural-minmax-v15.1`

Current directly projected learning features are deliberately narrow:

- `manaEfficiency` from average nonland mana value, lower-is-better;
- `interactionEfficiency` from cheap-interaction count, higher-is-better.

The normalizer is fitted only from supplied training snapshots, clamps future outliers to [-1,1], returns zero for constant fields, has a deterministic fit fingerprint, and rejects mixed extractor contracts.

Tests prove an extreme future holdout cannot change earlier fitted ranges or training projections.

### Pre-feature temporal partition

- `src/services/learning-temporal-partition-v15.ts`
- `src/services/learning-temporal-partition-v15.test.ts`

The planner sees only ID, timestamp and leakage group. It does not inspect labels, deck metrics, normalized features or model outputs. Whole leakage groups are assigned together. This allows train/holdout membership to be decided **before** fitting normalization.

### Strict TopDeck materialization

- `src/services/topdeck-learning-materializer-v15.ts`
- `src/services/topdeck-learning-materializer-v15.test.ts`

The materializer accepts no caller-supplied model feature vector. It verifies exact deck fingerprint, commander identity and `featureSnapshot.availableAt <= outcomeOccurredAt`, projects from the frozen normalizer, and stores feature/card-data/normalizer provenance.

Regression: the same deck given a winning/top-cut result and a missed-cut result has identical predictors; only generic ingestion derives different labels.

### Integrated leakage-safe TopDeck temporal corpus

- `src/services/topdeck-temporal-corpus-v15.ts`
- `src/services/topdeck-temporal-corpus-v15.test.ts`

Required order is now enforced:

1. validate candidate/snapshot/linkage provenance;
2. decide temporal/leakage partition without features/labels;
3. fit normalization on planned training snapshots only;
4. transform training + future holdout with the frozen fit;
5. derive outcome labels through generic ingestion;
6. build the deterministic corpus manifest.

Tests prove changing the future holdout deck from ordinary to an extreme structural outlier does not change the partition, normalizer, or materialized training records. If leakage grouping leaves no historical training records, the workflow fails closed.

### Content-addressed corpus manifest

- `src/services/learning-corpus-manifest-v15.ts`
- `src/services/learning-corpus-manifest-v15.test.ts`

Manifest schema: `learning-corpus-manifest-v15.1`.

It records deterministic content/manifest hashes, usable record digests, duplicate/conflict/malformed audit, temporal range, source/evidence/target/extractor coverage, normalizer fit fingerprints, and refresh counts. It does not persist raw provider payloads/decklists/provider-player identifiers in the manifest.

---

## TopDeck source foundation

### Deterministic provider adapter

- `src/services/topdeck-learning-adapter-v15.ts`
- `src/services/topdeck-learning-adapter-v15.test.ts`

The adapter produces provider candidates, not trusted learning records. It requires MTG/EDH, valid top cut, stable provider player ID and complete 100-card Commander text. It does not guess undocumented `deckObj` shapes, assign cross-source identity, create model features or derive training labels.

The existing `references.ts` TopDeck/Archidekt path is intentionally more permissive for human-facing analysis. **Do not use that permissive parser as the trusted training path.**

### Bounded live fetcher

- `src/services/topdeck-learning-live-v15.ts`
- `src/services/topdeck-learning-live-v15.test.ts`

One bounded POST per refresh, API key from environment, explicit response-size bounds, no automatic POST retry, typed 429/`Retry-After`, malformed-row quarantine, and attribution retained downstream.

A large live training corpus has **not** been claimed yet.

---

## Conservative cross-source outcome linkage — foundation complete

- `src/services/learning-outcome-linkage-v15.ts`
- `src/services/learning-outcome-linkage-v15.test.ts`

The linker deliberately prefers false negatives to false-positive merges.

Event grouping is exact:

- explicit event identity when supplied; otherwise
- normalized event name + exact UTC event date + exact field size.

Within the same event standing, cross-source rows are linked only if commander identity agrees **and** every mirror shares one strong proof:

- exact full-deck SHA-256 fingerprint; or
- explicit cross-source entrant identity.

Safety regressions cover:

- exact TopDeck/other-source mirror linking;
- explicit entrant identity fallback when deck fingerprint is unavailable;
- ambiguous same-event/same-standing records quarantined when strong proof is missing;
- conflicting commander/deck/entrant identity quarantined;
- same-source duplicate standing quarantined rather than counted as corroboration;
- field-size/event identity mismatch prevents automatic collapse;
- different standings remain distinct outcomes while sharing event independence/leakage identity;
- deterministic output regardless provider input order.

EDH Top 16 currently remains an attributed public-reference source because its legacy filtered structured endpoints were found to redirect rather than return a stable documented dataset. Do not invent structured EDH Top 16 rows merely to exercise the linker.

---

## Permanent benchmark controls

### Control A — Final Fantasy-only Bracket 5 attempt

Keep permanently:

> Build the strongest possible Commander deck using only legitimate Final Fantasy physical printings, target Bracket 5, and report the honest ceiling if the restriction cannot support Bracket 5.

This must exercise printing enforcement, legality, exact construction, win packages, tutor/redundancy reasoning, mana, interaction/protection, multiple win routes, probability/simulation and honest bracket ceiling. Do not automatically collapse FF builds into one infinite line when combat/value/commander routes materially belong to the intended identity.

Relevant scripts include `scripts/e2e-ff-bracket5.ts`, `scripts/e2e-ff-cedh-refine.ts`, and `scripts/probe-ff-win-packages.ts`.

### Control B — unrestricted cEDH

Keep permanently:

> Build a genuine competitive Commander deck without the FF printing restriction.

`scripts/e2e-unrestricted-cedh-v15.ts` uses Kinnan, Bonder Prodigy and guards complete legality/resolution, deterministic win packages, low curve, free interaction, fast mana and competitive construction signals.

The FF vs unrestricted comparison helps distinguish a user/card-pool ceiling from a builder weakness.

---

## External oracle / evidence strategy

Reference families remain:

- `j4th-mtg-mcp` — independent MCP/deck-workflow reference;
- `nccurry-mtg-mcp` — statistics/evidence/reproducibility reference;
- `forge` — mature rules/simulation reference;
- `manabrew` — Forge-family parity methodology.

Observed-result sources include TopDeck and public-reference EDH Top 16 in the evidence registry. A second website that republishes the same event is not a second independent result.

External mismatches trigger investigation, not obedience. Related systems are deduplicated by independence group. Pin deterministic snapshots where appropriate, keep live external tests separate from deterministic CI, shrink failures, retain fixed regressions, and respect source terms/licenses.

---

## Next implementation target

### 1. Retrospective card-data provenance / as-of feature construction

This is now the main blocker before a meaningful historical live-corpus backfill.

Important unresolved fact: the current extractor correctly requires `cardDataObservedAt <= feature availableAt`. That is safe for contemporaneously captured feature snapshots, but a **2026 refresh of a 2025 tournament cannot truthfully pretend current Scryfall data was observed before the 2025 result**.

The new `cardDataSnapshotFingerprint` makes input drift auditable, but it does not by itself solve retrospective time provenance.

Do not bypass this by fabricating an old observation timestamp.

Next work should:

- define an explicit provenance model distinguishing genuinely historical/contemporaneous card snapshots from retrospective reconstruction;
- investigate what historical/as-of card identity data can be reconstructed reliably from public structured sources;
- for name-only historical decklists, do not blindly use a current/default printing whose release may post-date the tournament;
- separate static/reconstructible fields from Oracle/rules-derived fields that may contain post-event errata or rules knowledge;
- if a predictor cannot be reconstructed without future knowledge, omit it or mark the record unsuitable for that feature contract rather than silently leaking future information;
- add deterministic fixture tests before any live implementation;
- preserve exact card-data content fingerprints and observation/reconstruction method in corpus provenance.

### 2. Apply conservative linkage to future multi-source normalized records

The generic linkage engine is ready, but live EDH Top 16 structured ingestion is not currently justified. When another structured source is added, use linkage assignments to derive canonical outcome/event identities; ambiguous/conflicting groups should be quarantined rather than guessed.

### 3. Manual/live TopDeck corpus refresh only after retrospective feature safety

Once retrospective feature construction is honest:

- add a live/manual refresh workflow separate from deterministic CI;
- require `TOPDECK_API_KEY` from environment/secret store;
- respect TopDeck 429 / `Retry-After` and attribution;
- persist normalized allowed corpus records/manifests, not raw provider payload dumps;
- output accepted/quarantined/duplicate/conflict/target/temporal/source coverage audits;
- do not let live-source failures break deterministic CI.

### 4. Model evaluation remains blocked pending real data quality

Neural promotion remains blocked until **one explicit target** has enough independent, balanced, temporally broad, leakage-safe records and the neural candidate repeatedly beats the transparent baseline on genuinely future holdouts.

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
- learning targets are not semantically mixed;
- training features cannot see future outcomes or future normalization distribution;
- cross-source evidence is independence-aware and conservative;
- raw structural/provenance facts remain auditable;
- retrospective feature reconstruction must not fake historical observation time;
- FF-only and unrestricted controls do not regress silently;
- stable `server-current` is not changed without an explicit release/promotion decision;
- update this file after every major milestone or active-target change.

A future session must be able to recover the project from GitHub alone without needing old chat history.
