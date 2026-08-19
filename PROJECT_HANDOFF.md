# Ultimate MTG — Project Handoff

_Last updated: 2026-08-19 NZST_

This is the persistent recovery point for future ChatGPT sessions. Read it together with `ULTIMATE_MTG_SPEC.md`: the spec is the north star; this file records the current validated implementation, release state, hard guarantees, CI discipline, and next engineering target.

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

**Visibility:** public. This was intentionally changed on 2026-08-18 so standard GitHub-hosted Actions could continue without private-repository hosted-minute billing. Public visibility is not a release decision.

**Active continuation branch:** `agent/package-probabilities`

**Latest fully validated implementation head:**

- `946e6c31cde4962cb37efb6a70487312467f7fcb` — experimental V0.15 universal Commander MCP boundary, protocol-level boundary tests, live MCP-boundary validation, and a live-test client timeout allowance appropriate for real provider-backed deck construction.

The active branch may be one documentation-only handoff commit ahead of this implementation SHA. If so, no runtime code changed after `946e6c31...`; inspect the diff rather than treating the documentation commit as a new implementation milestone.

### Validation on `946e6c31...`

Isolated validation surface:

- temporary draft PR #10 on `agent/v15-mcp-pipeline-boundary`;
- deterministic CI run `32213544821`: PASS;
- strict TypeScript/build: PASS;
- complete deterministic test suite: PASS;
- Commander Live Control Suite run `32213544813`: PASS;
- all nine live controls + final aggregate: PASS.

A pre-fix live run on `19130e0bc97eec0dfe8a2b5d8456fa605fc6e287` exposed only a **test-client timeout**: the MCP SDK request hit its default 60-second client timeout while the real server-side build continued. The other eight live controls passed. The correction on `946e6c31...` changed only the live MCP test client's request allowance to five minutes; no deck-building logic, truth gate, source semantics, or stable runtime behavior was weakened.

The actual isolated universal MCP artifact was inspected, not merely the step summary. It proved:

- tool `build_commander_through_pipeline_v15` was crossed through the real MCP boundary;
- exact commander resolution passed for `Najeela, the Blade-Blossom (FCA) 42`;
- exact Commander legality passed;
- exact final card count was 100;
- Final Fantasy physical-printing policy passed;
- exact final decklist was retained;
- external evidence was complete;
- package discovery completed and reported `no-verified-win-package` rather than manufacturing a package;
- requested Bracket 4 was independently assessed after construction as Bracket 4 / `bracket-4-optimized-range` with high confidence.

Post-fold active validation:

- active branch fast-forwarded from `e0f647d95492a9d9f8b3d84006e2dbc6773308e9` to exact `946e6c31...`; no force and no merge to `main`;
- deterministic CI run `32214767803`: PASS;
- active Commander Live Control Suite run `32214767823`: PASS;
- all nine live controls + final aggregate: PASS;
- the active-run universal MCP artifact was also inspected and again showed exact Najeela FCA #42 resolution, legal exact 100, printing-policy compliance, exact decklist retention, complete external evidence, and requested/achieved Bracket 4 with high confidence.

Temporary PR #10 is closed **unmerged** after the validated fold. PR #2 remains the open draft validation surface for the active experimental branch.

Previous validated base `b0ccd7436fa0d27864a7ae66706faed34cc367b6` remains the milestone that established neutral exact per-card budgets, neutral free-form themes, process-wide Scryfall pacing, and hardened serialized live validation.

### Stable runtime remains V0.13

- `package.json` remains version `0.13.0`;
- `src/server-current.ts` deliberately returns `createMtgServerV13()`;
- V0.14/V0.15 remain experimental;
- no milestone in this handoff authorizes a merge to `main` or stable promotion.

**Do not change the stable runtime without an explicit release/promotion decision from the user after the relevant quality gates are met.**

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

---

## Completed Commander / deckbuilding milestones

### 1. Live-source reliability

Key files include `src/lib/http.ts`, `src/config.ts`, `src/services/spellbook.ts`, and tests.

Behavior includes:

- retries only known idempotent/read-safe operations;
- Scryfall `POST /cards/collection` and Commander Spellbook read-only POSTs may retry transient failures;
- arbitrary POSTs such as TopDeck ingestion remain one-shot;
- retryable statuses include 408/425/429/500/502/503/504;
- `Retry-After` is respected;
- caller aborts are not retried;
- provider/method/attempt/timeout/cause telemetry is preserved;
- advisory evidence outages return unavailable/incomplete rather than false absence;
- strict positive-verification paths stay strict.

### 2. Universal Commander build pipeline

Key files:

- `src/services/general-win-package-v15.ts`;
- `src/services/commander-build-evaluation-v15.ts`;
- `src/services/commander-build-pipeline-v15.ts`;
- related tests and live controls.

Pipeline order:

> constraints → commander/strategy → winning-package discovery → optional verified package seeding → construction → hard-truth evaluation → target-free actual bracket → requested-vs-achieved comparison

Rules:

- explicit bracket target uses the targeted lane;
- no target uses the neutral lane and never inherits the old hidden Bracket-4 default;
- `winPackageMode = auto | prefer | require | forbid`;
- `prefer/auto` may continue when package evidence is unavailable but may not invent a package;
- `require` fails closed when positive package verification is unavailable or no valid package survives;
- a seeded combo only receives credit if its exact Spellbook combo ID survives and verifies in the final 100.

Permanent universal FF control: Najeela + Final Fantasy physical printings + requested B4 + package preference produces an exact legal 100 and honestly assesses B4 when supported; no unavailable/invalid package is forced.

### 3. Requested-vs-achieved bracket layer

`src/services/bracket-target-comparison-v15.ts` compares the requested target only after target-free assessment of the finished deck.

Output distinguishes requested bracket, achieved bracket/band, reached/exceeded/under-target/unassessable, target gap, confidence, source completeness, relevant blockers and guidance. B5/cEDH diagnostics do not leak into lower-target explanations.

### 4. Unrestricted neutral Commander candidate pool

Key files include:

- `src/services/neutral-unrestricted-pool-v15.ts`;
- `src/services/neutral-deck-builder-v15.ts`;
- related tests;
- `scripts/e2e-unrestricted-neutral-build-v15.ts`.

Behavior:

- no printing restriction uses a bounded stratified Scryfall sample rather than EDHREC construction ordering;
- early/mid/late nonlands, lands and archetype strata are sampled deterministically;
- Oracle identities are deduplicated;
- exact legality/color/paper/printing policy is enforced;
- basics are explicit, including Wastes for colorless;
- candidate minimums fail closed;
- provenance is auditable and reports whether construction used popularity ordering.

Permanent live case on Najeela with no target/restriction/package seed:

- exact legal 100;
- candidate pool `bounded-stratified-neutral-sample`;
- **679 eligible nonlands / 172 lands**;
- `popularityOrdered=false`;
- `edhrecOrdered=false`;
- post-build achieved **Bracket 3 / bracket-3-upgraded-range**;
- external evidence complete.

### 5. Neutral exact per-card budget enforcement

Budget is a hard constraint, not a ranking suggestion.

Behavior:

- `maxUsdPerCard` is the user hard cap;
- `candidateMaxUsdPerCard` may tighten optional search but can never loosen the hard cap;
- exact physical printing and finish are used as the price witness;
- missing/unknown price does not count as zero or under-cap;
- exact accepted printing, finish and observed USD price remain auditable;
- commander, required cards, seeded package pieces, optional cards and lands are validated under the appropriate cap;
- hard-cap conflicts fail closed and name the conflict;
- final deck receives an independent post-build budget audit;
- restricted FF/set pools inspect physical printings when a budget is active;
- deep-print-history basics use bounded physical-printing exhaustion rather than a newest-printings false negative;
- required nonbasic lands consume real land/nonbasic slots;
- must-include/excluded conflicts and impossible must-include counts fail closed.

Permanent live controls:

**Unrestricted:** Najeela, no target, US$20 hard / US$5 optional, exact legal 100, finish-aware budget compliant, achieved **Bracket 2 / bracket-2-core-range**.

**Final Fantasy composition:** Najeela, no target, FF physical printings, US$100 hard / US$20 optional, `Command Tower` required, exact legal 100, printing policy true, post-build budget compliant, achieved **Bracket 3 / bracket-3-upgraded-range**.

NZD affordability remains a separate user-facing concern unless an input explicitly defines the hard cap in NZD.

### 6. Neutral free-form theme enforcement

Key files:

- `src/services/neutral-theme-v15.ts`;
- `src/services/neutral-themed-deck-builder-v15.ts`;
- pipeline integration + deterministic tests;
- `scripts/e2e-neutral-theme-v15.ts`.

Flow:

> original user text → typed normalized intent → controlled bounded query/semantic rule → verified theme seeds → normal hard-truth construction → independent final theme audit

Supported first-class single themes include creature types, mapped mechanics, selected card types, explicit Oracle-text phrases, and Final Fantasy as a delegated exact physical-printing-family theme.

Safety/semantics:

- arbitrary user text is never passed directly into Scryfall grammar;
- unsafe query-like, vague or unsupported compound intent fails closed rather than being silently ignored;
- creature-type catalog outage is `verification-unavailable`, distinct from verified unsupported intent;
- theme discovery must exhaust within explicit bounds or fails closed;
- source ordering may be disclosed, but construction seed ranking uses strategy/role/curve/name logic rather than EDHREC popularity;
- theme-generated cards remain subject to legality, printing, optional-card budget and final independent audit;
- multi-face/DFC display names normalize safely while canonical resolved identity is retained;
- Final Fantasy supplied only as `themeQuery: "Final Fantasy"` becomes an effective `final-fantasy` printing policy before package discovery and remains active through inner builder and outer evaluator.

Permanent live controls:

**Warrior typal:** exact Najeela, no target, no seed package → **22/99** matching main-deck cards, 1,238 bounded candidates, 20 selected theme seeds, exact legal 100, achieved **Bracket 3 / bracket-3-upgraded-range**.

**Final Fantasy theme-only:** exact Najeela, no explicit `printingFamily` → effective `final-fantasy` policy through package discovery, builder and evaluator, exact legal 100, achieved **Bracket 3 / bracket-3-upgraded-range**.

### 7. Provider-safe serialized live validation

Architecture:

- deterministic CI remains separate;
- one automatic `Commander Live Control Suite` runs live-provider benchmarks sequentially on one runner;
- individual controls remain available for diagnosis/manual execution;
- no automatic multi-workflow provider stampede;
- ordinary cooldowns are 30s;
- deep theme/budget controls receive 60s cooling windows;
- cancelled superseded suites skip unnecessary cooldown sleeps;
- `continue-on-error` allows later evidence collection, but a final aggregate fails unless every underlying core control outcome is success.

Scryfall pacing:

- one process-wide HTTP-layer request-attempt clock covers card lookups, catalogs, paged physical-printing searches, unrestricted samples, collection POSTs and retries;
- normal runtime default remains **300 ms** minimum start-to-start gap;
- live validation uses **750 ms** via environment override;
- shared-clock behavior has deterministic regression coverage.

Retry policy:

- normal runtime remains conservative;
- live validation uses bounded 5-attempt recovery for Scryfall and Commander Spellbook;
- live suite uses 5s retry base and 15s retry ceiling;
- assertion/legality/printing/budget/theme failures are not retried as network failures.

A prior post-fold run proved source-outage semantics: one attempt failed only because Commander Spellbook timed out five times; no code was changed; the same SHA passed all controls on retry.

### 8. Experimental V0.15 universal Commander MCP boundary

Key files:

- `src/server-v15-commander-pipeline.ts`;
- `src/server-v15-commander-pipeline.test.ts`;
- `src/server-v15.ts`;
- `scripts/e2e-universal-build-pipeline-v15.ts`.

Experimental MCP tool:

- `build_commander_through_pipeline_v15`.

Boundary behavior:

- resolves one or two exact commander inputs through existing Scryfall identifier resolution;
- preserves caller order for paired commanders;
- duplicate exact inputs or unresolved commanders fail before construction;
- absence of `targetBracket` remains a true no-target request;
- passes printing family, allowed sets, promo/special controls, hard and candidate per-card budgets, free-form theme, excluded/must-include cards, land controls, win-package mode, and competitive-intent/evidence flags into the existing universal pipeline;
- does **not** duplicate deck-builder logic;
- returns the pipeline result unabridged, adding only MCP-boundary and exact resolved-commander provenance;
- therefore retains exact final decklist, hard audits, theme/budget audits, candidate-pool provenance, package verification state, source health/completeness, achieved bracket, and requested-vs-achieved comparison;
- remains V0.15-only and does not leak into `server-current` V0.13.

Deterministic MCP tests cover:

- schema/registration;
- stable runtime non-leak;
- exact commander identity and pair ordering;
- true no-target behavior;
- exact budget and other option propagation;
- Final Fantasy theme-only derivation without boundary-side invention of a printing family;
- unsupported theme, verification-unavailable theme, hard-gate failure, duplicate input and unresolved-input fail-closed behavior;
- exact decklist/audit/provenance/source evidence retention.

Live MCP control crosses the actual protocol boundary and uses a five-minute **test-client** request allowance because the provider-backed construction can legitimately exceed the MCP SDK client's default 60-second request timeout. This is a validation-harness allowance, not a server-side relaxation.

---

## Exact probability / statistics foundation

Implemented and independently tested:

- `exact-statistics-v15.ts` — BigInt hypergeometric fractions, complements, expectation and variance;
- `exact-package-statistics-v15.ts` — disjoint package assembly;
- `exact-overlap-package-statistics-v15.ts` — overlap-aware physical-card assignment without double counting;
- `exact-commander-zone-statistics-v15.ts` — correct command-zone availability and 99/98-card libraries;
- `exact-access-curve-v15.ts` — opening hand + turn access;
- `simulation-exact-calibration-v15.ts` — seeded Monte Carlo calibration against exact truth.

Permanent regression: one universal A/B tutor cannot simultaneously satisfy both missing A and B roles.

Classic control: 99-card library, 36 lands, 7-card opener, P(3+ lands) = `26,736,733 / 53,358,536 ≈ 50.1077%`.

---

## Learning / corpus foundation

Neural/ML remains experimental and shadow-only. It may never override legality/rules/printing/budget/theme truth.

Foundations include target identity, quarantine-first observed outcomes, exact deck fingerprints, duplicate/mirror handling, versioned structural snapshots, training-only normalization, temporal/leakage partition before fitting, TopDeck materialization, content-addressed manifests, conservative cross-source linkage, and source-health/drift semantics.

A large, balanced, independently sourced, leakage-safe historical outcome corpus is **not** yet claimed.

---

## Next implementation target

### 1. Historical / as-of provenance

This is the immediate target for the next chat.

The project can now build and evaluate through the real experimental MCP boundary, but historical evaluation must not silently apply present-day truth to a past date.

Design and implement explicit temporal provenance that distinguishes contemporaneous snapshots from retrospective reconstruction.

At minimum, historical/as-of work must prevent future information from leaking backward through:

- physical printings and release dates;
- Oracle text / card identity changes;
- Commander legality and banned-list state;
- rules facts / rules versions;
- tournament or recorded-game evidence;
- source snapshots and materialized corpus records.

Required semantics:

- an explicit `asOf` or equivalent evaluation time must be carried where historical claims are made;
- evidence should record retrieval/observation time and, where the source supports it, the period for which the fact was valid;
- distinguish `contemporaneous-snapshot` from `retrospective-reconstruction` rather than presenting them as equivalent;
- a reconstruction must disclose which facts are truly historical and which are present-day proxies;
- missing historical state must fail closed or reduce confidence instead of silently substituting newer information;
- future printings, later Oracle changes, later rules/legal changes, and later tournament outcomes must not become evidence for an earlier date;
- current live Commander evaluation should remain current-truth by default unless the caller explicitly requests historical/as-of evaluation.

Validation requirements:

1. define typed temporal/provenance envelopes before broad integration;
2. add synthetic deterministic fixtures proving future printings and later facts cannot leak backward;
3. test unavailable historical truth separately from verified historical absence;
4. preserve source/version/timestamp provenance through structural corpus records;
5. integrate historical provenance before trusting retrospective corpus/model evaluation;
6. keep historical reconstruction from overriding current hard-truth semantics;
7. keep `server-current` on V0.13 and do not merge to `main`.

### 2. Real corpus / model evaluation

Only after historical/as-of provenance is safe. Promotion must depend on trustworthy future holdout, drift and real-outcome evidence—not feature count, synthetic success, or retrospective data contaminated by future knowledge.

---

## CI / validation discipline

For every implementation milestone:

1. isolate material work when useful;
2. strict TypeScript/build;
3. complete deterministic tests;
4. dedicated live control when external data is part of the feature;
5. inspect actual live output, not only a green-looking step summary;
6. remember `continue-on-error` can hide a failed underlying step until the aggregate;
7. distinguish source outage, harness failure and code/assertion failure;
8. fold into `agent/package-probabilities` only after validation;
9. revalidate the active branch after the fold;
10. keep `main` and `server-current` unchanged unless the user explicitly approves release promotion.

Never weaken a truth gate just to make CI green.

---

## Maintenance rule

Update this file after every major milestone, blocker/recovery event, or active-target change.

A future session must be able to recover the project direction and current engineering state from GitHub alone without old chat history.
