# Ultimate MTG — Project Handoff

_Last updated: 2026-08-19 NZST_

This is the persistent recovery point for future ChatGPT sessions. Read it together with `ULTIMATE_MTG_SPEC.md`: the spec is the north star; this file records the current validated implementation, release state, hard guarantees, CI discipline, and next engineering target.

## Fresh-chat resume instructions

1. Open `vt7dfbmh7b-droid/mtg-ultimate-mcp`.
2. Read `PROJECT_HANDOFF.md` and `ULTIMATE_MTG_SPEC.md` first.
3. Inspect `agent/package-probabilities`; do not assume `main` is the active development state.
4. Check the exact active-branch head and current GitHub Actions status before changing code.
5. Distinguish the validated implementation SHA from any later handoff-only documentation commit.
6. Keep deterministic CI separate from live external-source evidence.
7. Do not promote `server-current` merely because V0.15 experimental code exists.
8. Continue from **Next implementation target** unless a newer commit updates this handoff.

---

## Repository / release state

**Repository:** `vt7dfbmh7b-droid/mtg-ultimate-mcp`

**Visibility:** public. This was intentionally changed on 2026-08-18 so standard GitHub-hosted Actions could continue without private-repository hosted-minute billing. Public visibility is not a release decision.

**Active continuation branch:** `agent/package-probabilities`

**Latest fully validated implementation head:**

- `b0ccd7436fa0d27864a7ae66706faed34cc367b6` — neutral exact per-card budget + neutral free-form theme enforcement + process-wide Scryfall pacing + hardened serialized live validation.

The branch may be one documentation-only handoff commit ahead of this implementation SHA. If so, no runtime code changed after `b0ccd743...`; inspect the diff rather than treating the docs commit as a new implementation milestone.

### Validation on `b0ccd743...`

Deterministic:

- strict TypeScript/build: PASS;
- complete deterministic test suite: PASS;
- shared/global Scryfall pacing regression: PASS;
- DFC/modal theme identity regression: PASS;
- budget, theme, pipeline, legality, printing, package and planner regressions: PASS.

Isolated theme validation surface:

- temporary draft PR #9;
- exact head `b0ccd743...`;
- Commander Live Control Suite run `32196386215`: PASS;
- all nine live controls + final aggregate: PASS.

Post-fold active validation:

- branch fast-forwarded from `b38e7e30...` to exact `b0ccd743...`; no merge to `main`;
- deterministic CI run `32204713928`: PASS;
- active Commander Live Control Suite run `32204713921` attempt 1: aggregate failed only because the strict FF Najeela control exhausted five 25-second Commander Spellbook `/find-my-combos` attempts; the other eight controls passed;
- no code was changed in response to that source outage;
- same run, attempt 2, exact head `b0ccd743...`: PASS;
- attempt 2 started `2026-08-19T01:41:15Z` and completed with all nine live controls + final aggregate successful.

Temporary PR #9 is closed **unmerged** after the validated fold. PR #2 remains the open draft validation surface for the active experimental branch.

### Stable runtime remains V0.13

- `package.json` remains version `0.13.0`;
- `src/server-current.ts` deliberately returns `createMtgServerV13()`;
- V0.14/V0.15 remain experimental;
- `main` remains untouched by these milestones.

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

## Completed Commander/deckbuilding milestones

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

Budget is now a hard constraint, not a ranking suggestion.

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
- deep-print-history basics are handled through bounded physical-printing exhaustion rather than a newest-printings false negative;
- required nonbasic lands consume real land/nonbasic slots instead of disappearing;
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

Supported first-class single themes include:

- creature type / typal themes;
- supported mechanical themes (tokens, counters, equipment, sacrifice/aristocrats, graveyard, Treasure, proliferate, spellslinger and related mapped roles);
- selected card types;
- explicit Oracle-text phrase themes;
- Final Fantasy as a delegated exact physical-printing-family theme.

Safety/semantics:

- arbitrary user text is never passed directly into Scryfall grammar;
- unsafe query-like, vague or unsupported compound intent fails closed rather than being silently ignored;
- creature-type catalog outage is `verification-unavailable`, distinct from verified unsupported intent;
- theme discovery must exhaust within explicit bounds or fails closed;
- source ordering may be disclosed, but construction seed ranking uses strategy/role/curve/name logic rather than EDHREC popularity;
- theme-generated cards remain subject to legality, printing, optional-card budget and final independent audit;
- multi-face/DFC display names are normalized safely at the lookup boundary while canonical resolved identity is retained;
- Final Fantasy supplied only as `themeQuery: "Final Fantasy"` becomes an effective `final-fantasy` printing policy **before** winning-package discovery and remains active through inner builder and outer evaluator.

Permanent two-case live control:

**Warrior typal:** exact Najeela, no target, no seed package → **22/99** matching main-deck cards, 1,238 bounded candidates, 20 selected theme seeds, exact legal 100, achieved **Bracket 3 / bracket-3-upgraded-range**.

**Final Fantasy theme-only:** exact Najeela, no explicit `printingFamily` → inner builder policy `final-fantasy`, package-discovery policy `final-fantasy`, outer evaluator policy `final-fantasy`, exact legal 100, achieved **Bracket 3 / bracket-3-upgraded-range**.

### 7. Provider-safe serialized live validation

The live suite was hardened after reproducing real Scryfall 429 and Commander Spellbook 502/timeout behavior.

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

- one process-wide HTTP-layer request-attempt clock now covers all Scryfall traffic, including card lookups, catalogs, paged physical-printing searches, unrestricted samples, collection POSTs and retries;
- normal runtime default remains **300 ms** minimum start-to-start gap;
- live validation uses **750 ms** via environment override;
- shared-clock behavior has deterministic regression coverage.

Retry policy:

- normal runtime remains conservative;
- live validation uses bounded 5-attempt recovery for Scryfall and Commander Spellbook;
- live suite uses 5s retry base and 15s retry ceiling;
- real assertion/legality/printing/budget/theme failures are not retried as if they were network failures.

The active post-fold run proved source-outage semantics: attempt 1 failed only because Commander Spellbook timed out five times on strict Najeela; no code was changed; attempt 2 on the identical SHA passed all nine controls and aggregate.

---

## Exact probability/statistics foundation

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

### 1. Expose the real universal Commander pipeline through experimental V0.15 MCP

This is the immediate target for the next chat.

Current `src/server-v15.ts` extends V0.14 and exposes bracket/research/learning surfaces, but it **does not yet register the real universal Commander build pipeline**.

Add an experimental MCP tool backed by `buildCommanderThroughPipelineV15` rather than duplicating builder logic.

The MCP schema/result must preserve, where supported by the service contract:

- one or two commander inputs / exact commander resolution semantics;
- optional `targetBracket` including true no-target behavior;
- printing family;
- allowed set codes;
- promo/special-printing controls;
- `maxUsdPerCard` hard cap;
- `candidateMaxUsdPerCard` optional tighter candidate cap;
- free-form `themeQuery` with typed fail-closed semantics;
- excluded cards;
- must-include cards;
- land/nonbasic controls;
- `winPackageMode`;
- exact final decklist / exact printings;
- hard constraint audit;
- theme audit when applicable;
- budget audit when applicable;
- candidate-pool provenance when applicable;
- winning-package discovery/verification state;
- source completeness/health;
- target-free achieved bracket;
- requested-vs-achieved comparison when a target exists.

MCP-level validation requirements:

1. add schema/registration deterministic tests;
2. invoke the actual MCP tool boundary rather than only calling the service directly;
3. test no-target unrestricted neutral build;
4. test Final Fantasy theme-only derivation;
5. test exact per-card budget input propagation;
6. test unsupported/unavailable theme and hard constraint failure surfaces;
7. confirm MCP output retains exact decklist and audit/provenance fields;
8. add a dedicated live MCP-boundary control only after deterministic tests are green;
9. keep `server-current.ts` on V0.13.

Do **not** promote the experimental server merely because the MCP tool works.

### 2. Historical / as-of provenance

After the MCP boundary is stable, distinguish contemporaneous snapshots from retrospective reconstruction. Historical evaluation must not silently use future printings, later Oracle facts, later rules state, or later legal/banned information.

### 3. Real corpus / model evaluation

Only after provenance is safe. Promotion must depend on trustworthy future holdout, drift and real-outcome evidence—not feature count or synthetic success.

---

## CI / validation discipline

For every implementation milestone:

1. isolate material work when useful;
2. strict TypeScript/build;
3. complete deterministic tests;
4. dedicated live control when external data is part of the feature;
5. inspect actual live output, not only a green-looking step summary;
6. remember `continue-on-error` can hide a failed underlying step until the aggregate;
7. distinguish source outage from a code/assertion failure;
8. fold into `agent/package-probabilities` only after validation;
9. revalidate the active branch after the fold;
10. keep `main` and `server-current` unchanged unless the user explicitly approves release promotion.

Never weaken a truth gate just to make CI green.

---

## Maintenance rule

Update this file after every major milestone, blocker/recovery event, or active-target change.

A future session must be able to recover the project direction and current engineering state from GitHub alone without old chat history.
