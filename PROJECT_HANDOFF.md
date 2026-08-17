# Ultimate MTG — Project Handoff

_Last updated: 2026-08-17 NZST_

This file is the **persistent recovery point for future ChatGPT sessions**. Read it together with `ULTIMATE_MTG_SPEC.md`: the spec is the north star; this file records current implementation state and the next target.

## Fresh-chat resume instructions

1. Open `vt7dfbmh7b-droid/mtg-ultimate-mcp`.
2. Read `PROJECT_HANDOFF.md` and `ULTIMATE_MTG_SPEC.md` first.
3. Inspect the current head and recent commits of `agent/package-probabilities`.
4. Inspect CI for that exact head before changing code.
5. Do **not** assume `main` is the active development state.
6. Do **not** promote `server-current` merely because V0.14/V0.15 code exists.
7. Continue from **Next implementation target** unless a newer commit changes this handoff.

---

## Repository / release state

**Active continuation branch:** `agent/package-probabilities`

Important current/recent commits:

- `df318ce4e52ec858b39d3a87e80479194009ef2c` — bounded live TopDeck learning fetcher tests; CI succeeded.
- `9c48616a4c76532649a2d3427546d91dfd34e52e` — bounded single-request TopDeck V2 learning fetcher with explicit 429 handling.
- `4724a2b7f06968fc70c7d09bcfca2ce39661e370` — deterministic TopDeck V2 learning adapter tests.
- `b4da0294d05e196b19fc8e067eaa7bad10b8f03b` — deterministic TopDeck tournament-to-learning-candidate adapter.
- `0c0439e17b379dde5bff2c81bd2a10055b9842f0` — provenance-safe corpus ingestion + mixed-target safety final fix; CI succeeded.
- `afedc656c7cd914fdf36bc51eb9a3d085af9dd99` — mixed-learning-target temporal-evaluation safety tests.
- `02111539f93ac36b8b836643406e592a74e5719f` — temporal evaluator refuses to train one classifier across mixed outcome semantics.
- `e4610593624076026fe955a9914fe4ba0953889a` — provenance-safe learning-ingestion tests.
- `74fa7c43717878ef1b5a78f4685ba31203405355` — quarantine-first observed-outcome ingestion boundary.
- `85ca53545720790422907e92890b57257bf421bb` — explicit learning-target identity in the corpus.
- `87f74e6223a27b13bace8f201e1f396e11400ff1` — exact-oracle calibration tests against the existing V0.4 simulator; CI succeeded.
- `85029cdfbe12bd8ecb0b81cbb11b197bfe35128a` — exact turn/access-curve tests; CI succeeded.
- `2f45b1381d525bd2a3bdfaf719894f2c8d5d5c2e` — commander-zone exact availability hardened; CI succeeded.
- `17bcfcc6819fcf9ef43ed5a8d14bcd9dc371ee6a` — overlap-aware package solver exhaustive/adversarial tests; CI succeeded.
- `966bffac0a981f9aea5b828c94e6aa091de640ea` — V0.15 foundation baseline before the package branch.

The current learning-source implementation/test head `df318ce4e52ec858b39d3a87e80479194009ef2c` passed dependency install, strict TypeScript build, and the complete automated test suite.

Temporary branches `agent/package-probabilities-2` and `agent/package-probabilities-3` contain no unique work and are not active.

### Stable runtime remains V0.13

- `package.json` remains `0.13.0`.
- `src/server-current.ts` deliberately returns `createMtgServerV13()`.
- The draft PR remains intentionally unmerged.

Preserve this separation while V0.14/V0.15 intelligence is hardened.

---

## Permanent truth hierarchy

Machine learning, optimization, simulation, or external oracles may never override:

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

The branch already contains substantial infrastructure for:

- Commander legality, 100-card validation, color identity, partners/singleton rules;
- exact Oracle vs physical-printing identity and themed-printing restrictions;
- MTGJSON stock Commander precons;
- full-deck building, upgrades, protected/excluded/must-include cards and exact IN/OUT tracking;
- NZD-first pricing/budgets with source-value auditability;
- Scryfall, Commander Spellbook, tournament/deck evidence and source diagnostics;
- deterministic simulation and Commander E2E scenarios;
- V0.14 cEDH readiness, combo completion, competitive refinement and from-scratch competitive building;
- V0.15 bracket ceiling/evidence, research/learning, drift detection, neural shadow ranking, exact statistics and real-corpus ingestion foundations.

The neural model remains experimental/shadow-only. Real, independent, leakage-safe temporal outcome data is required before promotion beyond the transparent baseline.

---

## Exact statistics milestones

### Univariate hypergeometric — complete

File: `src/services/exact-statistics-v15.ts`

BigInt hypergeometric arithmetic, exact reduced fractions, complement, expectation, variance, physical support, malformed-request checks and population cap 1,000.

Pinned Commander fixture: 99-card library, 36 lands, draw 7, P(3+ lands) = `26,736,733 / 53,358,536 ≈ 50.1077%`.

Decimals are presentation only; exact fractions are the equality/proof surface.

### Disjoint package assembly — complete

Files:

- `src/services/exact-package-statistics-v15.ts`
- `src/services/exact-package-statistics-v15.test.ts`

Exact multivariate package assembly for disjoint physical role buckets. Pinned example: 99-card library, opening seven, two unique singleton pieces = exactly `1 / 231`.

### Overlap-aware physical package assembly — complete

Files:

- `src/services/exact-overlap-package-statistics-v15.ts`
- `src/services/exact-overlap-package-statistics-v15.test.ts`

Properties:

- physical-card categories grouped by capability;
- one physical card may qualify for several roles but satisfies only one simultaneous role;
- Pareto-frontier state prevents tutor/multi-role double counting;
- alternative package routes are unioned exactly;
- role-specific/universal tutors, interchangeable pieces and shared cards are representable;
- malformed inputs and pathological workloads fail closed.

Conservative ceilings: 16 roles, 32 routes, 64 categories, 512 frontier states, 20,000 DP states, 500,000 transitions.

Independent labeled-card exhaustive enumeration validates small populations. Permanent regression: one universal A/B tutor cannot satisfy both missing A and B by itself.

### Commander-zone exact availability — complete

Files:

- `src/services/exact-commander-zone-statistics-v15.ts`
- `src/services/exact-commander-zone-statistics-v15.test.ts`

Commander rules were verified against the Wizards Comprehensive Rules effective **2026-08-07** before encoding this layer.

Properties:

- command-zone cards are guaranteed known physical cards, not random draws;
- `libraryPopulation = deckSize - commandZoneCards.length`; no hard-coded 100 in the generic statistics API;
- legality of multi-commander configurations remains a separate hard gate;
- flexible command-zone cards preserve one-card/one-simultaneous-role semantics;
- guaranteed assignments reduce route requirements before library probability;
- category counts are checked against the derived library population so commanders cannot be counted twice.

Pinned examples:

- one commander, 100-card deck → 99-card library; unique payoff in opening seven = `7 / 99`;
- two commanders, 100-card deck → 98-card library; unique payoff in opening seven = `1 / 14`.

Independent brute-force matching validates small command-zone + library populations.

### Turn-by-turn exact access curves — complete

Files:

- `src/services/exact-access-curve-v15.ts`
- `src/services/exact-access-curve-v15.test.ts`

Explicit natural-draw contexts:

- `two-player-starting` — skip first-turn natural draw;
- `two-player-non-starting` — draw turn one;
- `multiplayer` — draw turn one.

Properties:

- opening hand is a distinct checkpoint;
- every turn reports exact cumulative package access;
- commander-zone/overlap solver is reused;
- pure cumulative access is checked for exact monotonicity;
- deterministic guaranteed extra draws may be supplied explicitly;
- conditional draw engines are not silently guaranteed;
- library exhaustion is explicit;
- repeated cumulative draw counts reuse cached results;
- maximum 16 distinct exact-solver evaluations per curve;
- this is access/visibility, not castability, mana, timing, or disruption.

Pinned multiplayer singleton curve for a 99-card library: opening seven `7/99`, turn one `8/99`, turn two `1/11`, turn three `10/99`.

Validation includes closed-form singleton combinatorics and independent small-population labeled-card enumeration.

### Exact-as-oracle simulation calibration — complete

Files:

- `src/services/simulation-exact-calibration-v15.ts`
- `src/services/simulation-exact-calibration-v15.test.ts`

The milestone calibrates the **existing `simulateDeckConsistencyV04` path**, rather than adding a second competing Monte Carlo simulator.

For exact-comparable fixtures V0.4 uses mulligans disabled, no relevant tutors/draw engines, multiplayer natural draws, fixed seeds and explicit sample counts.

Acceptance is not a fixed arbitrary ±percentage. It uses a finite-sample two-sided Bernstein concentration bound for Bernoulli sample means with exact BigInt-oracle probability, default failure budget `1e-6`, explicit p=0/p=1 boundaries, and only the known reporting quantization allowance.

The integration fixture compares singleton and two-piece natural assembly at several turns using 12,000 seeded full V0.4 simulation iterations. CI succeeded at `87f74e6223a27b13bace8f201e1f396e11400ff1`.

---

## Real learning corpus foundation — milestone complete

### Core corpus target identity

File: `src/services/learning-corpus-v15.ts`

The corpus now records an explicit `LearningTargetV15` so different binary outcomes cannot silently become one semantic label. Current target identities include:

- `match-win`;
- `event-top-cut`;
- `deck-change-improvement`;
- `simulation-outcome`;
- `verified-package-success`;
- `recommendation-outcome`;
- `legacy-unspecified` for backward compatibility.

Deduplication keys include learning target + independent outcome group + outcome ID. Corpus audits now report target count and target identities.

### Quarantine-first observed-outcome ingestion

Files:

- `src/services/learning-corpus-ingestion-v15.ts`
- `src/services/learning-corpus-ingestion-v15.test.ts`

Properties:

- only registered `observed-results` sources can enter this outcome ingestion path;
- evidence class comes from the source registry, never caller claims;
- source URL hostname must match the registered provider;
- a training deck must parse as an exact 100-card Commander deck with one or two one-card commander entries;
- exact deck fingerprint is derived from the supplied complete decklist;
- `outcomeOccurredAt` is separate from `sourceObservedAt` and temporal splits use the actual outcome date;
- caller provides an explicit versioned `featureExtractorId` and normalized features, but ingestion validates their names/ranges;
- caller must provide cross-source `canonicalOutcomeId`, `independenceKey`, and `leakageKey` rather than treating one provider's local ID as independent truth;
- event-top-cut labels are derived from standing/field/top-cut values;
- match-win labels are derived from the observed win boolean;
- malformed rows are quarantined individually;
- repeated rows from one source are quarantined before corpus-level cross-source deduplication;
- mirror results from TopDeck and EDH Top 16 can share one underlying evidence group and therefore do not multiply independent evidence;
- event-related records remain together across temporal train/holdout boundaries.

### Mixed learning-target model safety

Files:

- `src/services/neural-temporal-eval-v15.ts`
- `src/services/neural-temporal-target-safety-v15.test.ts`

If a corpus contains more than one learning target, the temporal evaluator now refuses to train either neural or transparent candidate as one binary classifier. Readiness is forced to `not-ready` with guidance to split and evaluate each target independently. Legacy unspecified data remains backward-compatible as one target.

Final corpus-foundation head `0c0439e17b379dde5bff2c81bd2a10055b9842f0` passed install, strict build and the full test suite.

---

## TopDeck real-outcome source foundation — milestone complete

TopDeck's current V2 API documentation was re-checked before this work. It exposes completed Magic: The Gathering / EDH tournament search, stable tournament IDs, standings, optional decklists, top-cut information, and documented API-key/rate-limit/attribution requirements.

### Deterministic provider adapter

Files:

- `src/services/topdeck-learning-adapter-v15.ts`
- `src/services/topdeck-learning-adapter-v15.test.ts`

The adapter intentionally performs **no network access** and produces provider candidates rather than trusted learning records.

Properties:

- accepts only Magic: The Gathering / `EDH` tournament payloads;
- rejects team-event standings for this one-deck-per-standing learning target;
- requires a positive physically possible top-cut value;
- requires stable provider player IDs and does not fall back to mutable display names;
- converts documented TopDeck text headings such as `~~Commanders~~` / `~~Mainboard~~` into parser section markers without changing card identities or quantities;
- requires a complete exact 100-card Commander deck before producing a candidate;
- does not fetch an external deck URL during deterministic adaptation;
- does not guess the internal shape of optional `deckObj` when inline text is absent;
- does not assign cross-source independence/leakage identity, features, or a training label;
- explicit enrichment is required before generic corpus ingestion;
- required attribution is preserved as `Data provided by TopDeck.gg`.

Important separation: existing `references.ts` contains a more permissive TopDeck/Archidekt human-facing analysis path, including heuristic `deckObj` interpretation. **Do not use that permissive reference-analysis parser as the trusted learning-ingestion path.** Training data stays on the stricter adapter.

### Bounded live TopDeck fetcher

Files:

- `src/services/topdeck-learning-live-v15.ts`
- `src/services/topdeck-learning-live-v15.test.ts`

Properties:

- uses the existing `TOPDECK_API_KEY` configuration;
- makes exactly one bounded POST to `/v2/tournaments` per refresh call;
- requests Magic: The Gathering / EDH standings with stable IDs and inline decklists;
- applies date/participant bounds and rejects oversized bulk responses instead of silently truncating them;
- sends the documented authorization header and visible attribution is retained downstream;
- performs **no automatic retry of the POST**;
- HTTP 429 becomes a typed error carrying parsed `Retry-After` when present, allowing the caller/scheduler to respect the source rate limit without request amplification;
- provider-level malformed rows are quarantined while usable rows survive;
- network fetching still does not assign cross-source identity, features, or training labels.

Current source head `df318ce4e52ec858b39d3a87e80479194009ef2c` passed install, strict build and the full automated suite.

A live corpus refresh has **not** been claimed yet: actual training records still require outcome-safe feature extraction/versioning and explicit cross-source identity/leakage enrichment. The API-key value is not stored in source control and should remain secret.

EDH Top 16 remains useful as a documented legacy API/reference and possible mirror/corroboration source, but it must not automatically be counted as independent evidence when it reflects the same underlying tournament result.

---

## Permanent benchmark controls

### Control A — Final Fantasy-only Bracket 5 attempt

Keep permanently:

> Build the strongest possible Commander deck using only legitimate Final Fantasy physical printings, target Bracket 5, and report the honest ceiling if the restriction cannot support Bracket 5.

This exercises printing enforcement, legality, deck construction, winning packages, tutor/redundancy reasoning, mana, interaction/protection, multiple win routes, probability, simulation and bracket honesty. Do not automatically collapse FF builds into one infinite line when combat/value/commander routes materially belong to the intended identity.

Relevant files include `scripts/e2e-ff-bracket5.ts`, `scripts/e2e-ff-cedh-refine.ts`, and `scripts/probe-ff-win-packages.ts`.

### Control B — unrestricted cEDH

Keep permanently:

> Build a genuine competitive Commander deck without the FF printing restriction.

`scripts/e2e-unrestricted-cedh-v15.ts` uses **Kinnan, Bonder Prodigy** and guards complete legality, exact resolution, deterministic win packages, low curve, free interaction, fast mana, strong competitive construction signals and no practical fallback to the clunky Leveler line.

The FF vs unrestricted comparison helps distinguish a user/card-pool ceiling from a builder weakness.

---

## External oracle / evidence strategy

Reference families remain:

- `j4th-mtg-mcp` — independent MCP/deck workflow reference;
- `nccurry-mtg-mcp` — statistics/evidence/reproducibility reference;
- `forge` — mature rules/simulation reference;
- `manabrew` — Forge-family parity methodology.

Observed-result sources currently include TopDeck and EDH Top 16 in the evidence registry. A second website that republishes the same event is not a second independent result.

External mismatches trigger investigation, not obedience. Related systems are deduplicated by independence group. Pin snapshots for deterministic comparisons, keep live external tests separate where appropriate, shrink failures, retain resolved regressions, and respect licenses/source terms.

---

## Honest bracket result shape

Major build/upgrade workflows should converge on:

```text
Requested: Bracket 5
Achieved: High Bracket 4
Confidence: High
Ceiling caused by:
- specific restrictions / weaknesses
What would be needed to reach 5:
- specific changes
```

The engine must distinguish a user/card-pool ceiling from builder failure or insufficient evidence.

---

## Next implementation target

### 1. Outcome-safe feature extraction and corpus materialization

The source plumbing and ingestion safety boundary are now in place. The next bottleneck is converting complete historical decks into **versioned predictor features without leaking the result being predicted**.

Do this before scheduling a large live TopDeck refresh or claiming the project has a meaningful real training corpus.

Implementation direction:

- define a raw, versioned deck-feature snapshot separate from labels/outcomes;
- prefer deck-intrinsic facts that can be recomputed from the exact historical list and historical card/rules identity;
- reuse deterministic deck metrics where appropriate (curve, fast mana, tutors, interaction, protection, draw/ramp density), but do not hand-wave them into arbitrary normalized scores;
- if normalized/scaled features are learned from corpus statistics, fit the transformation on the **training split only** and apply it to future holdout records; never use future holdout distribution to normalize training data;
- do not derive `tournamentSupport`, `communitySupport`, or similar predictors from the same event/result being used as the label;
- any time-sensitive external predictor must have an evidence snapshot timestamp at or before `outcomeOccurredAt`;
- version the extractor contract so old records remain reproducible when feature logic changes;
- fail closed when a required card cannot be resolved or a complete historical feature snapshot cannot be constructed;
- keep raw structural features/source facts alongside derived normalized model features for auditability;
- add fixture tests proving that changing standing/win result does not change deck-intrinsic predictors;
- add temporal-leakage tests proving future outcomes cannot affect earlier normalization/feature snapshots;
- after the extractor is trustworthy, enrich bounded TopDeck candidates into actual `LearningOutcomeRecordV15` records and persist a deterministic corpus snapshot/manifest with audit counts;
- keep raw provider payload redistribution/licensing concerns separate; persist only what the source terms allow plus normalized provenance/fingerprint metadata needed for reproducibility.

### 2. Cross-source outcome linkage / EDH Top 16 corroboration

Add an explicit conservative linkage layer for determining when TopDeck and EDH Top 16 records refer to the same underlying tournament/entrant outcome. Prefer false negatives (two unlinked records) over false-positive merging unless identity evidence is strong. Once linked, mirrors must share one `canonicalOutcomeId`, `independenceKey`, and appropriate leakage group.

### 3. Live refresh workflow after feature/linkage readiness

Only after feature extraction and linkage are safe:

- add a live/manual refresh script or workflow separate from deterministic CI;
- require `TOPDECK_API_KEY` from the environment/secret store, never source control;
- respect TopDeck 429 / `Retry-After` and attribution requirements;
- keep live-source failures from breaking deterministic CI;
- produce corpus audit output: accepted, quarantined, duplicates, conflicts, targets, temporal coverage, evidence groups and source coverage;
- do not promote the neural model merely because corpus volume increases.

### 4. Model evaluation remains blocked pending real data quality

Neural promotion remains blocked until one explicit learning target has enough independent, balanced, temporally broad, leakage-safe records and the neural candidate repeatedly beats the transparent baseline on genuinely future holdouts.

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
- model evaluation is leakage-safe;
- learning targets are not semantically mixed;
- external evidence is independence-aware;
- training features cannot see future outcomes;
- raw source/provenance facts remain auditable;
- FF-only and unrestricted controls do not regress silently;
- stable `server-current` is not changed without an explicit release/promotion decision;
- update this file after every major milestone or active-target change.

A future session must be able to recover the project from GitHub alone without needing old chat history.
