# Ultimate MTG — Project Handoff

_Last updated: 2026-08-20 18:37 NZST_

This is the persistent recovery point for future ChatGPT sessions. Read it together with `ULTIMATE_MTG_SPEC.md`: the spec is the north star; this file records the current validated implementation, stable-release boundary, hard truth hierarchy, validation discipline, research findings, and the next work that is actually needed.

## Fresh-chat resume instructions

1. Open `vt7dfbmh7b-droid/mtg-ultimate-mcp`.
2. Read `PROJECT_HANDOFF.md` and `ULTIMATE_MTG_SPEC.md` first.
3. Inspect `agent/package-probabilities`; do not assume `main` is the active development state.
4. Check the exact active-branch head, PR state, and current GitHub Actions status **before changing anything**.
5. Distinguish the latest fully validated **implementation SHA** from any later documentation-only handoff commit.
6. Keep deterministic CI, Scryfall live, TopDeck live, and Commander live controls separate.
7. Do not merge PR #2, promote `server-current`, change the package version, or merge to `main` merely because V0.15 experimental code exists.
8. Do not repeat already-completed historical/upcoming-provider probes unless the provider state, event set, or evidence source has materially changed.
9. Continue from **Current blocker / next work** below unless a newer validated implementation or explicit user instruction supersedes it.

---

# Repository / release state

**Repository:** `vt7dfbmh7b-droid/mtg-ultimate-mcp`

**Active continuation branch:** `agent/package-probabilities`

## Latest fully validated implementation SHA

`935dfd6643fa5f37d3f527f3d868b6b3a8e24ac2`

Commit message:

`Fix tutor replacement portfolio compile warning`

This is the exact validated functional head for the completed V0.15 tutor-replacement milestone. `agent/v15-tutor-replacements` and `agent/package-probabilities` were identical at this SHA, and the isolated tutor-replacement validation surface was closed unmerged after validation.

### Exact-head validation at `935dfd6643fa5f37d3f527f3d868b6b3a8e24ac2`

All four required gates passed:

- deterministic CI `32339430944`: **PASS**;
- Scryfall Card Data Source Live `32339431037`: **PASS**;
- TopDeck Learning Source Live `32339430997`: **PASS**;
- Commander Live Control Suite `32339430947` / run #180: **PASS**.

The Commander suite passed the full control set, including:

- FF Najeela high-Bracket-4;
- FF neutral autonomous build;
- Final Fantasy Bracket 5;
- unrestricted cEDH;
- universal Commander pipeline;
- unrestricted neutral Commander;
- neutral free-form theme;
- neutral exact per-card budget;
- Final Fantasy exact-budget;
- final aggregate gate.

### Validation PRs

- PR #27 — **Validate V0.15 tutor replacement intelligence**: **closed, unmerged**. Its recorded validated final head is `935dfd6643fa5f37d3f527f3d868b6b3a8e24ac2`.
- PR #26 — tutor value-for-money validation: **closed, unmerged**.
- PR #25 — exact tutor-to-route access validation: **closed, unmerged**.
- PR #24 — setup/interruption intelligence validation: **closed, unmerged**.
- PR #23 — final win-route resilience validation: **closed, unmerged**.
- PR #22 — win-package verification validation: **closed, unmerged**.

PR #2 remains the long-lived open draft **DO NOT MERGE** validation/recovery surface for `agent/package-probabilities`.

A later handoff/documentation-only commit may sit ahead of `935dfd...`. Do not mistake that for a new validated implementation milestone.

## Stable runtime remains V0.13

- `package.json` remains version `0.13.0`;
- `src/server-current.ts` deliberately returns `createMtgServerV13()`;
- V0.14/V0.15 remain experimental;
- `main` remains untouched by these milestones.

Stable release remains a separate explicit user-approved decision. No model result, CI pass, or experimental feature may automatically rewrite `server-current`, bump the package version, or merge to `main`.

---

# Permanent truth hierarchy

Machine learning, optimization, simulation, popularity, tournament prevalence, requested power, or convenience may never override:

- Commander legality;
- exact card count / command-zone count;
- singleton and color-identity rules;
- unresolved-card failures;
- current banned/legal facts;
- exact physical-printing existence and restrictions;
- exact required/must-exclude constraints;
- exact per-card hard budgets when requested;
- known rules facts;
- verified combo requirements;
- verified full-table win closure.

Requested bracket/power is a target, not a forced result.

A provider outage or unavailable field is **not evidence of absence**. Unavailable verification remains unavailable/incomplete evidence and never creates positive credit.

Historical/model evaluation has an additional permanent rule: later knowledge may not leak backward into an earlier predictor cutoff. Provider timestamps may not backdate evidence first observed later.

---

# Validated Commander / win-route foundations

The active experimental V0.15 line already contains and has validated:

- universal Commander build pipeline;
- one/two exact commander inputs with ordered pair semantics;
- printing/set/promo/special controls;
- exact per-card budget enforcement using exact physical printing/finish witnesses;
- free-form themes and exact Final Fantasy printing-family enforcement;
- excluded/must-include/land controls;
- strict game-ending / full-table closure semantics;
- independent, commander-coupled, and shared-core backup route distinctions;
- win-route setup/interruption intelligence;
- exact tutor-to-route access;
- exact tutor value-for-money;
- tutor replacement intelligence;
- exact probability/statistics and overlap-aware physical-card assignment;
- protocol-boundary E2E validation.

Permanent probability regression: one universal A/B tutor cannot simultaneously satisfy both missing A and B roles.

Classic exact control remains:

99-card library, 36 lands, 7-card opener, `P(3+ lands) = 26,736,733 / 53,358,536 ≈ 50.1077%`.

---

# Tutor replacement intelligence — COMPLETE

The tutor-replacement milestone is implemented and validated at `935dfd...`.

Experimental on-demand boundary:

`audit_verified_route_tutor_replacements_v15`

It is deliberately **not** injected as an expensive automatic search into every normal Commander build.

## Hard candidate requirements

A replacement candidate must survive the existing truth systems rather than parallel logic:

1. Commander legality;
2. Commander colour identity;
3. singleton / exact 100-card construction;
4. exclusions;
5. printing-family/theme policy;
6. exact allowed sets;
7. promo/special-release policy;
8. exact physical-printing availability;
9. exact requested per-card budget when supplied;
10. hardened tutor Oracle parser must prove access to a required route piece;
11. destination must be directly usable for route access (`hand` or supported `battlefield` path);
12. exact one-for-one replacement route maths must be recomputed.

Unknown/unsupported tutor text fails closed. Graveyard/top-deck-only effects do not masquerade as direct hand access.

## Exact counterfactual

The implementation physically removes one tutor slot, adds one exact eligible replacement printing, preserves the exact 100-card Commander population, re-runs Commander rules, and then re-runs exact route access.

Reported dimensions include:

- source tutor exact printing/finish price;
- replacement exact printing/finish price;
- exact USD saving/delta;
- opening-hand route access;
- turn-3 route access;
- turn-5 route access;
- exact percentage-point access loss/gain;
- pieces each tutor can find;
- tutor destination;
- exact selected printing evidence.

Classifications are transparent:

- `access-equivalent-cheaper`;
- `cheaper-no-access-loss`;
- `cheaper-within-requested-access-loss` only when the caller explicitly supplies a tolerance;
- `cheaper-with-access-loss`;
- `not-cheaper`;
- `price-unknown`.

There is no hidden fabricated “AI score” and no hidden universal threshold for “near-equivalent”.

## Candidate discovery

Scryfall discovery is bounded and EDHREC-ordered, currently capped at 50 search results. An empty bounded sample is **not proof** that the current tutor is globally optimal.

Provider failure remains unknown availability rather than “no alternatives”.

## Multi-route portfolio safeguard

Every accepted primary-route replacement is cross-audited against the verified full-table win-route portfolio.

Key conservative signal:

`safeNoExactAccessLossAcrossPortfolio=true`

This is true only when the swap causes no exact selected-checkpoint access loss across every verified route included in the bounded portfolio audit.

The portfolio audit is bounded to 8 verified routes. Above that bound it fails closed rather than calling a partial route sample safe.

A candidate that preserves the selected route but weakens another verified route is **not** portfolio-safe.

Exact replacement-printing resolution failure remains incomplete/unknown and never becomes a safe claim.

## TopDeck role

Optional TopDeck tutor prevalence remains observational/advisory only. It may describe same-commander top-cut vs non-top-cut adoption but cannot override:

- legality;
- exact MTG truth;
- route verification;
- exact access;
- portfolio safety;
- exact printing/theme/budget constraints.

TopDeck failure does not invalidate the exact replacement maths.

---

# V0.15 model-promotion infrastructure — COMPLETE

The promotion infrastructure blocker has already been solved. Do not spend another implementation pass inventing a new “promotion flag”.

The fail-closed path includes:

1. promotion-readiness states: `blocked` or `eligible-for-human-review`;
2. retained Scryfall predictor truth with exact-byte hashing and immutable GHCR references;
3. prospective TopDeck pre-event / event-end / completed-event evidence;
4. deterministic promotion-evidence join;
5. strict corpus admission with lineage revalidation;
6. replay-before-seal;
7. frozen-normalizer genuine-future holdout;
8. promotion-aware sealed evaluation.

Manual workflows include:

- `.github/workflows/scryfall-carddata-retention-v15.yml`;
- `.github/workflows/topdeck-prospective-evidence-v15.yml`;
- `.github/workflows/topdeck-prospective-promotion-join-v15.yml`;
- `.github/workflows/topdeck-promotion-corpus-build-v15.yml`;
- `.github/workflows/topdeck-promotion-future-holdout-seal-v15.yml`;
- `.github/workflows/topdeck-sealed-future-holdout-build-v15.yml`;
- `.github/workflows/topdeck-promotion-future-evaluation-v15.yml`.

Sensitive deck/player/evidence material stays private. Public audit surfaces only aggregate diagnostics/hashes/metrics.

Even `eligible-for-human-review` keeps:

- legacy evaluator `promotionAuthorized: false`;
- `automaticStablePromotionAllowed: false`;
- `stablePromotionAuthorized: false`;
- `requiresExplicitUserApproval: true`.

## Locked future-review criteria

The existing precommitted criteria include:

- at least 200 genuine-future holdout records;
- minority-class share at least 0.20;
- neural balanced-accuracy gain over transparent baseline at least +0.02;
- neural AUROC gain over transparent baseline at least +0.01;
- no log-loss regression;
- system-clock-attested seal;
- exact feature contract / frozen training-normalizer match;
- disjoint events, pilots, exact decks and leakage groups;
- strict training and future corpus quality gates.

Passing can only earn a human release review. It does not promote V0.15 automatically.

---

# Provider / historical research status

Three older research PRs remain open draft surfaces. They are **not** the active development line and are **DO NOT MERGE** research branches.

## PR #19 — historical TopDeck deck-lock evidence

Branch: `agent/v15-historical-deck-lock-evidence`

The live lock-shape probe completed successfully.

Observed result on 2026-08-20:

- 476 completed tournaments returned;
- 12,059 standings rows;
- no candidate deck-lock/deadline/history field names in the documented completed-tournament response;
- account-owned tournament endpoint returned 0 tournaments;
- no candidate lock/deadline/history fields were found there either.

Interpretation: the documented endpoints did not expose a provider-versioned/signed historical deck-lock attestation that could safely upgrade retrospective decklists into promotion-grade pre-event evidence.

Do **not** infer that no locks existed. This is an availability/schema result.

## PR #20 — archived Scryfall history probe

Branch: `agent/v15-scryfall-webarchive-probe`

The Wayback metadata probe completed successfully for the July 1–August 20, 2026 target window.

Observed result:

- archived `https://api.scryfall.com/bulk-data` manifest captures found: **0**;
- unique archived manifest digests: **0**;
- therefore no archived `default_cards` payload could be established through that path.

Interpretation: the tested Wayback route does not currently provide replayable July–August 2026 Scryfall historical bulk truth. Do not treat this as proof that no archive exists anywhere else.

## PR #21 — upcoming TopDeck pre-event visibility

Branch: `agent/v15-upcoming-topdeck-visibility`

The privacy-safe upcoming-event probe completed successfully.

Observed result on 2026-08-20:

- upcoming candidates checked: **10**;
- candidates usable now: **0**;
- strict exact pre-event decks visible: **0**;
- several events were confirmed `Not Started`, but their standings exposed no strict exact deck objects before start;
- other checked candidates were no longer pre-start.

Interpretation: none of the checked public upcoming events currently exposes a strict exact Commander `deckObj` through the documented pre-event REST path.

This is an **availability result**, not evidence that decklists were never submitted.

### Consequence of the three research probes

There is currently no validated retrospective shortcut around the predictor-timing requirement, and the tested public upcoming events did not expose promotion-usable exact decks before start.

Therefore the current bottleneck is **real promotion-grade evidence availability/quantity**, not missing promotion infrastructure and not tutor-replacement code.

Do not weaken the evidence gate to make the dataset easier to obtain.

---

# Current blocker / next work

## Immediate status

The functional implementation through tutor replacement is green and integrated on `agent/package-probabilities` at validated implementation SHA `935dfd...`.

The next large phase is real prospective evidence collection, but the 2026-08-20 visibility probe found zero usable pre-event exact decks among the 10 checked upcoming events.

## What the next chat should do first

Before any write:

1. read this handoff and `ULTIMATE_MTG_SPEC.md`;
2. inspect the exact current head of `agent/package-probabilities`;
3. inspect current CI / Scryfall / TopDeck / Commander state;
4. inspect PRs #19, #20 and #21 and determine whether their provider/event state has materially changed since the recorded probes;
5. do not repeat the same probes merely to reproduce the same result.

## Highest-value next route

### If a known upcoming TopDeck EDH/cEDH event exposes strict exact decks before start

1. ensure retained Scryfall predictor truth exists before the predictor cutoff;
2. run promotion-grade `pre-event` TopDeck capture before provider start;
3. retain immutable private evidence references;
4. after event completion, run strict completed-event capture;
5. run the digest-pinned promotion join;
6. keep changed/late/unavailable rows rejected rather than weakening the gate.

### If no upcoming event exposes strict exact decks

Do **not** fabricate evidence and do not reinterpret retrospective lists as pre-event truth.

The useful engineering options are then:

- design a **bounded, privacy-safe, rate-limit-aware event discovery/access strategy** that can identify genuinely available pre-event exact deck evidence without manufacturing a global feed; or
- re-probe specific known events only when their provider state or deck-submission visibility could reasonably have changed; or
- identify another independently timestamped/provider-versioned pre-event evidence source and subject it to the same fail-closed historical/provenance requirements before trusting it.

Any new discovery mechanism must preserve the existing truth hierarchy and privacy constraints.

## Once enough strict joined evidence exists

1. build the first real strict promotion corpus;
2. inspect coverage, rejections, dates, commanders, field sizes, regions, pilots, events, exact deck reuse, class balance and leakage-component concentration;
3. do not seal unless the existing corpus quality gate passes;
4. replay every joined artifact before sealing;
5. create the first real system-clock future-holdout seal only with adequate strict training evidence;
6. collect genuinely later, disjoint future events;
7. use the exact sealed training normalizer for the future holdout;
8. evaluate only against the immutable seal/corpus/holdout chain;
9. if `blocked`, collect more evidence or start a newly precommitted experiment;
10. if `eligible-for-human-review`, present the evidence to the user and request an explicit release decision.

Never tune retrospectively against a sealed holdout and then reuse that same seal.

---

# Validation discipline for future functional work

For any new functional implementation fold, require all four on the **exact functional head**:

1. deterministic CI;
2. Scryfall Card Data Source Live;
3. TopDeck Learning Source Live;
4. Commander Live Control Suite including final aggregate.

Use an isolated branch and temporary draft validation PR. Integrate only by clean non-force fast-forward after confirming zero divergence. Close temporary validation PRs unmerged.

Documentation-only handoff commits may sit ahead of the validated implementation SHA. Record them as documentation-only and do not treat them as runtime validation milestones.

---

# Non-negotiable project constraints

- Do not merge to `main` without explicit user approval.
- Do not modify/promote `src/server-current.ts` without explicit user approval.
- Stable remains V0.13 / `0.13.0` until a separate release decision.
- Do not promote V0.15 merely because experimental controls pass.
- Provider outage/unavailable field ≠ absence.
- ML, tournament prevalence and advisory evidence cannot override legality or exact MTG truth.
- Keep hybrid/multi-route decks intact.
- Exact budgets and exact physical printings remain hard constraints.
- Historical evidence must be temporally valid and replayable; no later-knowledge leakage.
- TopDeck evidence remains observational unless the strict prospective/promotion evidence chain proves its timing and lineage.
- Do not expose/persist provider secrets or sensitive player/deck evidence in public artifacts.

---

# Copy/paste next-chat prompt

> Continue the Ultimate MTG project in `vt7dfbmh7b-droid/mtg-ultimate-mcp`. First read `PROJECT_HANDOFF.md` and `ULTIMATE_MTG_SPEC.md`, then do a read-only live status check before changing anything. The active development branch is `agent/package-probabilities`. The latest fully validated **functional implementation** is `935dfd6643fa5f37d3f527f3d868b6b3a8e24ac2`; a later handoff-only commit may be ahead of it. That functional SHA passed deterministic CI `32339430944`, Scryfall live `32339431037`, TopDeck live `32339430997`, and the full Commander Live Control Suite `32339430947` / run #180. Tutor replacement intelligence is complete and integrated; PR #27 was closed unmerged. Stable remains V0.13 / `0.13.0`, `src/server-current.ts` still points to V0.13, and `main` must remain untouched unless I explicitly approve a release.
>
> The current blocker is promotion-grade evidence availability, not missing implementation. Three open draft research PRs are separate **DO NOT MERGE** probes: #19 found no usable historical TopDeck deck-lock/deadline/history fields in 476 tournaments / 12,059 standings; #20 found zero Wayback captures of the Scryfall bulk-data manifest in the July 1–August 20, 2026 target window; #21 checked 10 upcoming TopDeck events and found 0 promotion-usable pre-event exact decks / 0 visible strict deck objects. Treat all three as availability findings, not proof of absence.
>
> Before doing new work, verify whether the live branch, CI, those PRs, or provider/event visibility have changed. Do not repeat the same probes unless something material changed. If a known upcoming TopDeck EDH/cEDH event now exposes strict exact decks before provider start, use the existing retained-Scryfall + pre-event capture + completed-event + digest-pinned join path. If none does, do not weaken the evidence gate or treat retrospective decklists as pre-event truth; the next useful engineering task is a bounded privacy-safe event-discovery/access strategy or another independently timestamped pre-event evidence source. Keep provider outage ≠ absence, ML/advisory evidence subordinate to exact MTG truth, exact printing/budget constraints hard, and all V0.15 work experimental until I explicitly approve promotion.
