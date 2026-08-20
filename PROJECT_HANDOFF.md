# Ultimate MTG — Project Handoff

_Last updated: 2026-08-20 19:37 NZST_

This is the authoritative current-state recovery document for `vt7dfbmh7b-droid/mtg-ultimate-mcp`.

Read this together with `ULTIMATE_MTG_SPEC.md`:

- `PROJECT_HANDOFF.md` = **where the project actually is now**;
- `ULTIMATE_MTG_SPEC.md` = **north-star principles and intended system**.

If progress wording in the spec is stale, this handoff wins for current implementation status. The permanent truth rules in the spec still apply.

---

# Fresh-chat resume instructions

1. Open `vt7dfbmh7b-droid/mtg-ultimate-mcp`.
2. Read this file and `ULTIMATE_MTG_SPEC.md` first.
3. Inspect `agent/package-probabilities`; do not assume `main` is the active development state.
4. Check the exact active-branch head, PR #2, and current GitHub Actions state **before changing anything**.
5. Distinguish the latest fully validated **functional SHA** from any later documentation/cleanup-only commit.
6. Keep deterministic CI, Scryfall live, TopDeck live, and Commander live controls separate.
7. Do not merge PR #2, change the package version, promote `src/server-current.ts`, or merge to `main` without explicit user approval.
8. Do not repeat completed provider/history probes unless provider state, event set, or evidence source materially changed.
9. Provider outage/unavailable evidence is never proof of absence.
10. Continue from **Cleanup / next work** below unless a newer validated functional milestone or explicit user instruction supersedes it.

---

# Repository / release state

**Repository:** `vt7dfbmh7b-droid/mtg-ultimate-mcp`

**Active continuation branch:** `agent/package-probabilities`

**Only intended open recovery PR:** PR #2 — **V0.15 experimental recovery / validation — DO NOT MERGE**

## Latest fully validated functional implementation

`935dfd6643fa5f37d3f527f3d868b6b3a8e24ac2`

Commit message:

`Fix tutor replacement portfolio compile warning`

This remains the last fully validated **functional** milestone. Later handoff/cleanup commits do not become new functional milestones merely because they are newer.

## Validation at the functional milestone

All four required gates passed for the validated source tree:

- CI `32339430944`: **PASS**;
- Scryfall Card Data Source Live `32339431037`: **PASS**;
- TopDeck Learning Source Live `32339430997`: **PASS**;
- Commander Live Control Suite `32339430947` / run #180: **PASS**.

The Commander suite passed:

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

The pull-request validation checkout used GitHub's synthetic PR merge commit, but the tested tree was verified to have zero file differences from `935dfd...`. Treat the milestone as source-tree validated; do not overstate it as literal commit-object checkout.

## Completed validation surfaces

Closed and unmerged validation PRs include:

- #22 — win-package verification;
- #23 — final win-route resilience;
- #24 — setup/interruption intelligence;
- #25 — exact tutor-to-route access;
- #26 — tutor value-for-money;
- #27 — tutor replacement intelligence.

## Stable boundary

Stable remains **V0.13**:

- `package.json` remains `0.13.0`;
- `src/server-current.ts` deliberately returns V0.13;
- V0.14/V0.15 remain experimental;
- `main` remains outside the experimental promotion path until explicit approval.

No model result, CI pass, evidence state, or experimental feature may automatically:

- rewrite `server-current`;
- bump the stable version;
- merge to `main`;
- authorize stable promotion.

---

# Repository cleanup checkpoint — 2026-08-20

A complete ancestry audit classified all **41 `agent/*` branches** relative to `agent/package-probabilities`.

## Active — KEEP

- `agent/package-probabilities`

## Proven redundant — SAFE TO RETIRE

The following **33 branch refs have zero unique commits** relative to the active branch. Their history is already contained in `agent/package-probabilities` and their recorded commit objects remain addressable by SHA.

- `agent/historical-carddata-acquisition`
- `agent/live-control-orchestration`
- `agent/live-source-reliability`
- `agent/neutral-budget`
- `agent/neutral-theme`
- `agent/neutral-unrestricted-pool`
- `agent/package-probabilities-2`
- `agent/package-probabilities-3`
- `agent/scryfall-jsonl-gzip`
- `agent/universal-build-pipeline`
- `agent/v1-foundation`
- `agent/v15-basic-feature-cleanup`
- `agent/v15-basic-feature-cleanup-validation`
- `agent/v15-exact-tutor-access`
- `agent/v15-final-win-route-resilience`
- `agent/v15-historical-provenance`
- `agent/v15-historical-provenance-ready`
- `agent/v15-mcp-pipeline-boundary`
- `agent/v15-promotion-corpus-admission`
- `agent/v15-promotion-evidence-join`
- `agent/v15-promotion-evidence-join-backup`
- `agent/v15-promotion-readiness`
- `agent/v15-real-corpus-evaluation`
- `agent/v15-retained-carddata`
- `agent/v15-sealed-future-holdout`
- `agent/v15-tutor-replacements`
- `agent/v15-tutor-replacements-final`
- `agent/v15-tutor-replacements-impl`
- `agent/v15-tutor-replacements-v2`
- `agent/v15-tutor-replacements-work`
- `agent/v15-tutor-value-for-money`
- `agent/v15-win-package-verification`
- `agent/v15-win-route-setup-interruption`

These refs are safe to delete through a branch-delete-capable GitHub interface. The current ChatGPT GitHub connection does not expose branch deletion. **Do not simulate deletion by force-moving refs.**

## Unique history — PRESERVE / REVIEW

The following **7 branches contain unique commits** relative to the active branch and must not be deleted blindly:

- `agent/code-cleanup-audit` — 8 unique commits;
- `agent/historical-carddata-handoff` — 3 unique commits;
- `agent/v15-historical-deck-lock-evidence` — 6 unique commits;
- `agent/v15-historical-provenance-integration` — 1 unique commit;
- `agent/v15-scryfall-one-shot-retention` — 1 unique commit;
- `agent/v15-scryfall-webarchive-probe` — 3 unique commits;
- `agent/v15-upcoming-topdeck-visibility` — 3 unique commits.

The three research branches tied to PRs #19/#20/#21 are deliberately preserved even though those PRs are now closed.

The other four unique-history branches should be inspected before any later retirement decision. Their unique commits are not automatically desirable; they are simply not proven redundant yet.

---

# PR cleanup checkpoint — 2026-08-20

The repository no longer needs five simultaneously open draft surfaces.

Archived **closed and unmerged** during cleanup:

- PR #1 — historical V0.13 NZD-first development surface;
- PR #19 — historical TopDeck deck-lock evidence research;
- PR #20 — archived Scryfall / Wayback research;
- PR #21 — upcoming TopDeck pre-event visibility research.

PR #2 remains the single long-lived open draft recovery/validation surface and has been refreshed to match this handoff.

Closing those PRs does not delete their commits, discussion, or research branches.

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

Provider outage, missing fields, missing indexed pages, or unavailable verification are **not evidence of absence**.

Historical/model evaluation additionally requires temporal validity: later knowledge may not leak backward into an earlier predictor cutoff, and a provider timestamp may not backdate evidence first observed later.

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
- independent, commander-coupled, and shared-core backup-route distinctions;
- win-route setup/interruption intelligence;
- exact tutor-to-route access at opening hand / turn 3 / turn 5;
- exact tutor value-for-money;
- tutor replacement intelligence;
- exact probability/statistics and overlap-aware physical-card assignment;
- protocol-boundary E2E validation.

Permanent probability regression: one universal A/B tutor cannot simultaneously satisfy both missing A and B roles.

Classic exact control remains:

99-card library, 36 lands, 7-card opener, `P(3+ lands) = 26,736,733 / 53,358,536 ≈ 50.1077%`.

Hybrid/multi-route deck philosophy remains permanent: do not collapse a deck into one infinite-combo route merely to raise a score when meaningful combat or alternate win routes are part of the intended design.

---

# Tutor replacement intelligence — COMPLETE

Validated experimental boundary:

`audit_verified_route_tutor_replacements_v15`

It remains on-demand rather than an expensive automatic search on every build.

A proposed replacement must survive the existing hard truth systems, including:

- Commander legality / color identity / exact deck population;
- exclusions and must-include constraints;
- printing-family / allowed-set / promo policy;
- exact physical printing and requested finish;
- exact requested per-card budget;
- hardened tutor Oracle parsing proving access to a required route piece;
- supported direct destination semantics;
- exact one-for-one route access recomputation.

Unknown/unsupported tutor text fails closed.

The implementation physically removes one tutor slot, adds one exact eligible replacement printing, preserves the exact Commander population, re-runs Commander rules, and recomputes exact route access.

Every accepted primary-route replacement is also cross-audited against the verified full-table win-route portfolio. `safeNoExactAccessLossAcrossPortfolio=true` is only allowed when there is no selected-checkpoint exact-access loss across every verified route inside the bounded audit. The portfolio audit is bounded to 8 verified routes and fails closed above that bound rather than calling a partial sample safe.

Optional TopDeck tutor prevalence is advisory only and can never override legality, exact access, route verification, printing/theme/budget constraints, or portfolio safety.

---

# V0.15 promotion evidence infrastructure — COMPLETE

Do not build another promotion flag. The fail-closed promotion infrastructure already exists:

1. retained Scryfall predictor truth with exact-byte hashing / immutable private references;
2. prospective TopDeck pre-event capture;
3. completed-event capture;
4. deterministic evidence join requiring exact deck identity and valid timing;
5. strict corpus admission with lineage revalidation;
6. private corpus build;
7. replay-before-seal;
8. system-clock genuine-future seal;
9. frozen training normalizer for future evaluation;
10. sealed future holdout with disjoint leakage groups/events/pilots/exact decks;
11. promotion readiness restricted to `blocked` or `eligible-for-human-review`.

Manual workflows include:

- `.github/workflows/scryfall-carddata-retention-v15.yml`;
- `.github/workflows/topdeck-prospective-evidence-v15.yml`;
- `.github/workflows/topdeck-prospective-promotion-join-v15.yml`;
- `.github/workflows/topdeck-promotion-corpus-build-v15.yml`;
- `.github/workflows/topdeck-promotion-future-holdout-seal-v15.yml`;
- `.github/workflows/topdeck-sealed-future-holdout-build-v15.yml`;
- `.github/workflows/topdeck-promotion-future-evaluation-v15.yml`.

Sensitive player/deck/evidence material remains private. Public artifacts may expose aggregate diagnostics/hashes/metrics only.

Even `eligible-for-human-review` keeps automatic stable promotion disabled and requires explicit user approval.

## Existing precommitted future-review criteria

Current criteria include:

- at least 200 genuine-future holdout records;
- minority-class share at least 0.20;
- neural balanced-accuracy gain over transparent baseline at least +0.02;
- neural AUROC gain over transparent baseline at least +0.01;
- no log-loss regression;
- system-clock-attested seal;
- exact feature-contract / frozen training-normalizer match;
- disjoint events, pilots, exact decks and leakage groups;
- strict training/future corpus quality gates.

Passing can only earn human review; it cannot promote the stable runtime.

---

# Completed provider / history research

## PR #19 — historical TopDeck deck-lock evidence — CLOSED / UNMERGED

Branch preserved: `agent/v15-historical-deck-lock-evidence`

Observed on 2026-08-20:

- 476 completed tournaments;
- 12,059 standings rows;
- no usable lock/deadline/history field names in the tested documented completed-tournament responses;
- account-owned tournament endpoint returned 0 tournaments and no usable lock fields.

Interpretation: the tested documented response surface did not provide a provider-versioned/signed historical deck-lock attestation suitable for upgrading retrospective decklists to promotion-grade pre-event evidence.

This is an availability/schema finding, **not proof that locks never existed**.

## PR #20 — archived Scryfall history — CLOSED / UNMERGED

Branch preserved: `agent/v15-scryfall-webarchive-probe`

Wayback probe for July 1–August 20, 2026 found:

- archived Scryfall bulk-manifest captures through the tested route: **0**;
- unique archived manifest digests: **0**;
- no historical `default_cards` payload could therefore be established through that route.

This is not proof that no archive exists anywhere else.

## PR #21 — upcoming TopDeck visibility — CLOSED / UNMERGED

Branch preserved: `agent/v15-upcoming-topdeck-visibility`

Recorded 2026-08-20 probe:

- candidates checked: **10**;
- usable candidates: **0**;
- visible strict exact pre-event decks: **0**.

Several events were `Not Started` but exposed no strict exact `deckObj` in the tested standings response. This is an availability result, not evidence that decklists were never submitted.

Do not rerun the same fixed ten-event probe merely to reproduce the same answer. Re-probe only when event/provider visibility could materially have changed.

Public TopDeck event/circuit pages may be used for bounded **advisory discovery** of candidates. Promotion evidence must still come through the strict existing capture path and its timing/provenance requirements.

---

# Cleanup audit — loose ends found before new feature work

The 2026-08-20 full audit did **not** identify a major new Commander legality, construction, tutor-math, printing, budget, or full-table closure defect.

The strongest remaining maintenance issues are outside core MTG truth.

## 1. Build/dependency reproducibility — HIGH PRIORITY

Current project reproducibility is weaker than the word “deterministic CI” implies:

- no committed `package-lock.json` was present at audit time;
- dependency versions include semver ranges;
- workflows use `npm install` rather than `npm ci`;
- GitHub Actions use mutable major tags such as `@v4`;
- Node/container references are not fully digest/patch pinned.

This should be hardened before promotion-grade evidence collection becomes operationally important. The goal is infrastructure reproducibility **without changing MTG behavior**.

## 2. ML precommitment needs absolute quality floors before the first real seal

The current future-review criteria are mainly relative improvements over the transparent model. A weak baseline could theoretically make a weak neural model look eligible by relative gain alone.

Before any genuine future holdout is observed/sealed, define precommitted absolute predictive-quality floors and a simple baseline comparison. Do this **before seeing future results** so the evaluation contract cannot be accused of moving after observation.

## 3. Promotion-grade model signal is narrower than the available Commander feature snapshot

The deck feature snapshot computes many useful Commander dimensions, but the current promotion-grade learning projection effectively populates only two model signals: mana efficiency and cheap-interaction efficiency. The neural model exposes eight named input slots, leaving the other inputs zero for those records.

Before the first real seal, explicitly choose one of two honest paths:

- keep and document a deliberately narrow two-feature experiment; or
- precommit a richer feature contract using already-available leakage-safe structural features, then validate it before future evaluation.

Do not expand features after seeing a sealed future holdout and reuse that holdout.

## 4. Corpus diversity is measured more strongly than it is enforced

Source-lineage diversity, regional coverage, archetype coverage and event/pilot concentration are currently more warning-oriented than hard promotion blockers.

Decide before sealing whether the product claim is narrowly “predict TopDeck top-cut outcomes from TopDeck evidence” or broadly “generalize Commander deck strength.” A broader claim requires stronger diversity/generalization evidence.

## 5. NZ pricing is NZD-first, not yet fully NZ-market-aware

Current stable V0.13 pricing can convert exact Scryfall USD printing prices to NZD and clearly label the reference, but direct NZ retailer/TCGfind stock and price retrieval is not yet a hard integrated source of truth.

Keep this as a later capability gap; do not mix it into the current cleanup/evidence milestone.

---

# Current blocker

The current blocker remains **real promotion-grade evidence availability/quantity**, not missing Commander logic and not missing promotion infrastructure.

However, the project is deliberately in a **cleanup-before-expansion** phase now. Do not start another large MTG feature until the maintenance loose ends below are resolved or consciously deferred.

---

# Cleanup / next work

## Phase A — repository hygiene — IN PROGRESS

Completed:

- full branch ancestry audit;
- 33 zero-unique-commit branches proven safe to retire;
- 7 unique-history branches preserved;
- PR #1 archived closed/unmerged;
- PRs #19/#20/#21 archived closed/unmerged;
- PR #2 refreshed as the single open recovery surface;
- this handoff consolidated as the authoritative current-state document.

Remaining:

- physically delete the 33 safe branch refs using a branch-delete-capable GitHub interface;
- inspect the four non-research unique-history branches before deciding whether they should be integrated, archived or retired:
  - `agent/code-cleanup-audit`;
  - `agent/historical-carddata-handoff`;
  - `agent/v15-historical-provenance-integration`;
  - `agent/v15-scryfall-one-shot-retention`.

## Phase B — reproducibility cleanup

After Phase A:

1. create a dependency lockfile;
2. move CI/evidence workflows to reproducible dependency installation;
3. pin Actions/runtime/container identities more tightly;
4. validate that no MTG/runtime behavior changed;
5. run the normal four validation gates on the resulting functional cleanup head.

Do not promote stable V0.13 as part of this work.

## Phase C — ML/evaluation contract cleanup

Before the first genuine future seal:

1. precommit absolute quality floors / trivial-baseline requirements;
2. decide and freeze the intended feature contract;
3. decide which diversity/concentration conditions must be hard blockers;
4. test the contract without using future sealed outcomes;
5. create a new validation milestone only after the four normal gates pass.

## Phase D — resume prospective evidence work

Only after cleanup:

- use bounded, privacy-safe, rate-limit-aware public TopDeck discovery as advisory candidate discovery;
- spend strict API checks only on materially warranted candidates;
- if strict exact decks are visible before provider start, use the existing retained-Scryfall + pre-event + completed-event + digest-pinned join path;
- if they are unavailable, keep them unavailable rather than weakening the evidence gate;
- never reinterpret retrospective lists as pre-event truth.

---

# Validation discipline for future functional work

For any new functional implementation fold, require all four on the functional source tree:

1. CI;
2. Scryfall Card Data Source Live;
3. TopDeck Learning Source Live;
4. Commander Live Control Suite including final aggregate.

Preferred workflow:

- isolated implementation/validation branch;
- temporary draft validation PR;
- verify the tested source tree matches the intended functional head;
- clean non-force fast-forward integration only after validation;
- close temporary validation PR unmerged;
- record the exact functional SHA and run IDs here.

Documentation-only commits may sit ahead of the functional SHA. They are not runtime milestones.

---

# Non-negotiable project constraints

- Do not merge to `main` without explicit user approval.
- Do not modify/promote `src/server-current.ts` without explicit user approval.
- Stable remains V0.13 / `0.13.0` until a separate release decision.
- Do not promote V0.15 merely because experimental controls pass.
- Provider outage/unavailable field ≠ absence.
- ML and tournament prevalence remain advisory beneath exact MTG truth.
- Keep hybrid/multi-route decks intact.
- Exact budgets and exact physical-printing constraints remain hard.
- Historical evidence must be temporally valid and replayable; no later-knowledge leakage.
- Do not expose provider secrets or sensitive player/deck evidence in public artifacts.
- Do not delete a branch with unique commits merely because its PR is closed.
- Do not call a docs/cleanup SHA a validated functional milestone.

---

# Copy/paste next-chat prompt

> Continue the Ultimate MTG project in `vt7dfbmh7b-droid/mtg-ultimate-mcp`. Read `PROJECT_HANDOFF.md` and `ULTIMATE_MTG_SPEC.md` first, then do a read-only status check before changing anything. The active branch is `agent/package-probabilities`; PR #2 is the only intended open recovery/validation PR and is **DO NOT MERGE**. The latest fully validated functional implementation remains `935dfd6643fa5f37d3f527f3d868b6b3a8e24ac2`, which passed CI `32339430944`, Scryfall live `32339431037`, TopDeck live `32339430997`, and Commander Live Control Suite `32339430947` / #180. Later docs/cleanup commits are not functional milestones. Stable remains V0.13 / `0.13.0`; do not change `server-current`, package version or `main` without explicit approval. Tutor replacement and promotion infrastructure are complete. PRs #1, #19, #20 and #21 are closed unmerged; the research branches for #19/#20/#21 are intentionally preserved. A 2026-08-20 branch audit found 33 zero-unique-commit branches safe to retire and 7 branches with unique history that must be preserved/reviewed. The project is in cleanup-before-expansion mode: finish branch/recovery hygiene, then harden dependency/build reproducibility, then precommit ML absolute quality/feature/diversity rules before the first genuine future seal, and only then resume bounded prospective TopDeck evidence discovery. Never weaken exact MTG truth or temporal provenance to make evidence easier to obtain.