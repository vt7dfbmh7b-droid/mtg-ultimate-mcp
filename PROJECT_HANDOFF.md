# Ultimate MTG — Project Handoff

_Last updated: 2026-08-18 NZST_

This is the persistent recovery point for future ChatGPT sessions. Read it together with `ULTIMATE_MTG_SPEC.md`: the spec is the north star; this file records the current implementation state, validated controls, hard guarantees, release state, and the next engineering target.

## Fresh-chat resume instructions

1. Open `vt7dfbmh7b-droid/mtg-ultimate-mcp`.
2. Read `PROJECT_HANDOFF.md` and `ULTIMATE_MTG_SPEC.md` first.
3. Inspect `agent/package-probabilities`; do not assume `main` is the active development state.
4. Check the exact active-branch head and its current GitHub Actions status before changing code.
5. Keep deterministic CI evidence separate from live external-source controls.
6. Do not promote `server-current` merely because V0.14/V0.15 code exists.
7. Continue from **Next implementation target** unless a newer commit changes this handoff.

---

## Repository / release state

**Repository:** `vt7dfbmh7b-droid/mtg-ultimate-mcp`

**Visibility:** public as of 2026-08-18. This was intentionally changed so standard GitHub-hosted Actions runners can continue without private-repository hosted-minute billing. No release/promotion decision is implied by public visibility.

**Active continuation branch:** `agent/package-probabilities`

**Latest fully validated implementation head before this handoff-only documentation update:**

- `16470a9af9f4d59985f47638a907dbbcd833c3b7` — folds the validated unrestricted-neutral candidate-pool adapter and its permanent live control into the active development branch.

Validation on that implementation head:

- strict TypeScript/build: PASS;
- complete deterministic CI suite: PASS;
- unrestricted-neutral live control: PASS;
- no bracket target was supplied or inferred;
- neutral lane used;
- exact legal 100-card Commander deck produced;
- unrestricted candidate provenance: `bounded-stratified-neutral-sample`;
- eligible sample retained **679 nonlands / 172 lands**;
- `popularityOrdered=false`;
- `edhrecOrdered=false`;
- post-build achieved result: **Bracket 3 / bracket-3-upgraded-range**;
- external post-build evidence completed successfully.

Permanent live-control artifact from the isolated validation run:

- workflow run `32124232445`;
- artifact ID `9319723186`;
- artifact ZIP SHA-256 `930f346f7f262b1855ef59c0b6f3494abbfce0daf6c7d9cdb5fdcd035d69e1f8`.

### Stable runtime remains V0.13

- `package.json` remains `0.13.0`.
- `src/server-current.ts` deliberately returns `createMtgServerV13()`.
- V0.14/V0.15 remain experimental.
- PR #2 remains an open draft validation surface, not a release/promotion PR.
- PR #6 was a temporary unrestricted-neutral validation surface and is closed/unmerged after the validated fold.

**Do not change the stable runtime without an explicit release/promotion decision from the user after the V1 quality gates are met.**

---

## GitHub Actions incident and recovery

On 2026-08-18, hosted Actions for this private repository began failing before step 1. Jobs were created and then ended within seconds with `steps: null`; checkout, install, TypeScript, and tests never ran. The same pattern affected active and isolated branches and multiple workflows together.

Important evidence:

- CI had run normally earlier the same day on the validated implementation.
- workflow YAML was unchanged and valid;
- no code/test failure was observed because code never executed;
- reruns while the repo was still private reproduced the pre-step failure;
- the connector did not expose a definitive billing/quota/runner-allocation reason, so do not invent one retrospectively.

Recovery:

- repository visibility was changed from private to public;
- immediately afterward, the exact previously blocked `76cc9e25ebdca6b197dd2dea082cbc405de40d0e` CI rerun acquired a hosted runner and passed checkout, install, build, full deterministic tests, and artifact upload;
- subsequent unrestricted-neutral and active-branch validation runs also acquired runners and passed.

Operational conclusion: the blocker was at the private GitHub-hosted Actions allocation/usage layer rather than the MTG code. Public standard hosted runners are now working. Exact private-account billing internals remain unproven because GitHub did not expose them through the available connector.

CI efficiency note: temporary validation PRs against the intentionally minimal `main` can match many historical workflow path filters at once. Public hosted minutes remove the billing blocker, but future workflow cleanup should still reduce redundant push+PR live controls and add cancellation/supersession where useful.

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

Key files include `src/lib/http.ts`, `src/config.ts`, `src/services/spellbook.ts`, and tests.

Behavior includes:

- retry only known idempotent/read-safe operations;
- Scryfall `POST /cards/collection` and Commander Spellbook read-only analysis POSTs may retry transient failures;
- arbitrary POSTs such as TopDeck ingestion remain one-shot;
- transient statuses include 408/425/429/500/502/503/504;
- `Retry-After` is respected;
- caller aborts are not retried;
- provider/method/attempt/timeout/cause telemetry is retained;
- advisory evidence outages return unavailable/incomplete evidence rather than false absence;
- strict positive-verification paths remain strict.

Important reliability commit:

- `33a65f912155692e2c03c76b6d7022e2d830d203`.

### Milestone 2 — universal Commander build pipeline foundation

Key files:

- `src/services/general-win-package-v15.ts`;
- `src/services/commander-build-evaluation-v15.ts`;
- `src/services/commander-build-pipeline-v15.ts`;
- associated tests and live control.

Pipeline order:

> constraints → commander/strategy → winning-package discovery → optional verified package seeding → construction → hard truth evaluation → target-free actual bracket → requested-vs-achieved comparison

Important rules:

- explicit bracket target uses the targeted construction lane;
- no target uses the neutral lane and never falls into V0.7's historical hidden Bracket-4 default;
- `winPackageMode` is `auto | prefer | require | forbid`;
- `prefer/auto` may continue when package verification is unavailable but may not invent a package;
- `require` fails closed when verified package evidence is unavailable or no valid package survives;
- selected seeded combo identity is preserved only when the exact selected Spellbook combo ID is verified in the final 100.

Previously validated universal FF control:

- exact `Najeela, the Blade-Blossom (FCA) 42`;
- Final Fantasy physical printings only;
- requested Bracket 4;
- verified win packages preferred;
- exact legal 100;
- achieved **Bracket 4 / bracket-4-optimized-range**;
- target reached, gap 0;
- no verified FF-valid deterministic package found, and no package was forced;
- final external evidence completed successfully.

Validated implementation for that milestone: `8d6b8c99a1a9b9a453323af3b056d284fb19e4c0`.

### Milestone 3 — requested-vs-achieved bracket layer

`src/services/bracket-target-comparison-v15.ts` and tests.

Actual bracket remains target-free. Requested target is compared only after the finished deck is independently assessed.

Output distinguishes:

- requested bracket;
- achieved bracket/band;
- `reached | exceeded | under-target | unassessable`;
- target gap;
- confidence/evidence completeness;
- target-relevant blockers/checks;
- unverified source-dependent checks;
- concrete guidance.

Target-specific diagnostics prevent B5/cEDH evidence from leaking into lower-target explanations.

### Milestone 4 — unrestricted neutral Commander candidate pool

Validated and folded into `agent/package-probabilities`.

Key files:

- `src/services/neutral-unrestricted-pool-v15.ts`;
- `src/services/neutral-unrestricted-pool-v15.test.ts`;
- `src/services/neutral-deck-builder-v15.ts`;
- `src/services/commander-build-pipeline-v15.ts` + planner tests;
- `scripts/e2e-unrestricted-neutral-build-v15.ts`;
- `.github/workflows/unrestricted-neutral-build-control.yml`.

Behavior:

- no printing-family/set restriction uses a dedicated bounded stratified Scryfall sample rather than EDHREC-ordered `searchCards()`;
- strata cover early/mid/late nonlands, lands, and archetype-relevant candidates;
- deterministic views use name/release ordering rather than popularity;
- provenance reports sampled/exhaustive state, stratum audit, totals, and retained eligible counts;
- Oracle identities are deduplicated;
- exact Commander legality, color identity, paper-game legality, and physical-printing policy are enforced;
- basic lands are supplied explicitly, including `Wastes` for colorless;
- minimum eligible candidate counts fail closed;
- restricted FF/family/set builds keep the existing bounded/exhaustive restricted path;
- no-target planning remains neutral strategy-first;
- unrestricted neutral planning no longer fails merely because the card pool is unrestricted;
- neutral exact per-card budgets and free-form theme queries still deliberately fail closed.

Permanent live anti-bias case:

- exact Najeela commander input;
- no target bracket;
- no printing family/set restriction;
- winning-package seeding forbidden to isolate construction;
- neutral archetype inferred as combat/tokens;
- result achieved Bracket 3 after construction;
- candidate pool 679 eligible nonlands / 172 eligible lands;
- popularity and EDHREC ordering both false;
- hard gates and exact 100 passed;
- external evidence complete.

---

## Exact probability/statistics foundation

Implemented and independently tested:

- `exact-statistics-v15.ts` — BigInt hypergeometric fractions, complements, expectation, variance, bounded populations;
- `exact-package-statistics-v15.ts` — disjoint package assembly;
- `exact-overlap-package-statistics-v15.ts` — overlap-aware physical-card assignment without double counting;
- `exact-commander-zone-statistics-v15.ts` — correct command-zone availability and 99/98-card library sizes;
- `exact-access-curve-v15.ts` — opening hand + turn-by-turn access;
- `simulation-exact-calibration-v15.ts` — seeded Monte Carlo calibration against exact truth.

Permanent regression: one universal A/B tutor cannot simultaneously satisfy both missing A and B roles.

Classic control: 99-card library, 36 lands, 7-card opener, P(3+ lands) = `26,736,733 / 53,358,536 ≈ 50.1077%`.

---

## Learning/research foundation

Neural/ML remains experimental and shadow-only. It may not override legality/rules/printing truth.

Implemented foundations include:

- explicit learning-target identity;
- quarantine-first observed-outcome ingestion;
- exact deck fingerprints;
- duplicate/mirror handling;
- versioned structural feature snapshots;
- exact card-data snapshot fingerprints;
- training-only normalization;
- temporal/leakage partition before feature fitting;
- TopDeck materialization and bounded live fetch;
- leakage-safe temporal corpus workflow;
- content-addressed manifests;
- conservative cross-source outcome linkage;
- source health/drift semantics.

A large, independently sourced, balanced, leakage-safe historical outcome corpus is **not** yet claimed.

---

## Next implementation target

### 1. Neutral exact per-card budget enforcement

This is now the immediate implementation target.

Budget semantics must be hard truth, not a ranking preference.

Requirements:

- exact-printing aware;
- finish aware where price data distinguishes finishes;
- printing-policy aware;
- `maxUsdPerCard` is a hard candidate constraint, never a soft score;
- a candidate is acceptable only if at least one eligible physical printing under the active policy is verifiably at or below the cap;
- the exact accepted printing/price source and observed price must be auditable;
- unrestricted neutral builds must support the cap;
- FF-only / printing-family builds must support the cap;
- allowed-set builds must support the cap;
- must-includes and seeded win-package cards must be revalidated against the same cap;
- conflicts such as a required card with no eligible under-cap printing must fail closed and name the exact conflicting card/constraint;
- post-build evaluation must independently verify that every emitted exact printing satisfies the cap;
- source outage/incomplete pricing must not be treated as “under budget”;
- avoid unbounded per-printing network calls; use bounded queries/caching/batching where possible;
- user-facing NZD affordability is separate from the reference per-card USD hard cap unless the request explicitly defines the cap in NZD.

After this is implemented:

- remove only the neutral per-card budget entry from `unsupportedConstraints`;
- add deterministic tests for under-cap, over-cap, missing-price, must-include conflict, printing-family/set interaction, seeded package interaction, and independent post-build verification;
- add a dedicated live budget control before calling the milestone complete.

### 2. Neutral free-form theme adapter

After budget validation.

Required flow:

> original user theme → normalized intent → bounded semantic/search constraints → candidate enforcement → auditability

Distinguish creature type, mechanical theme, franchise/printing theme, card-text theme, and vague flavor intent.

Do not pass arbitrary user text directly into Scryfall grammar. If the theme cannot be enforced reliably, fail closed or report explicit partial enforceability; never silently ignore it.

### 3. Expose universal pipeline through experimental V0.15 MCP surface

Only after neutral budget/theme semantics are stable.

`server-v15.ts` should expose the real universal Commander tool preserving:

- optional target/no-target semantics;
- printing family / sets / promos;
- budget/theme;
- excluded/must-include cards;
- land/nonbasic controls;
- `winPackageMode`;
- exact decklist;
- requested-vs-achieved result;
- source health/completeness.

Do not change `server-current`.

### 4. Historical/as-of provenance

Distinguish contemporaneous snapshots from retrospective reconstruction. No future printings, current Oracle facts, or later rules state may silently leak into historical training/evaluation.

### 5. Real corpus/model evaluation

Only after provenance is safe. Promotion must depend on trustworthy future holdout/drift/real-outcome evidence, not feature count or synthetic success.

---

## CI / validation discipline

For implementation milestones:

1. strict TypeScript/build;
2. complete deterministic tests;
3. dedicated live control where external data is part of the feature;
4. inspect actual live output, not only the green status;
5. fold isolated work into `agent/package-probabilities` only after validation;
6. revalidate the active branch after the fold;
7. keep `main` and `server-current` unchanged unless the user explicitly approves release promotion.

Do not weaken truth gates to make CI green.

---

## Maintenance rule

Update this file after every major milestone, blocker/recovery event, or active-target change.

A future session must be able to recover the project direction and current engineering state from GitHub alone without old chat history.
