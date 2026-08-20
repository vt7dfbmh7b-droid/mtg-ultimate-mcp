# Ultimate MTG — Project Handoff

_Last updated: 2026-08-20 NZST_

This is the authoritative current-state recovery document for `vt7dfbmh7b-droid/mtg-ultimate-mcp`.

Read it with `ULTIMATE_MTG_SPEC.md`:

- `PROJECT_HANDOFF.md` = where the project actually is now;
- `ULTIMATE_MTG_SPEC.md` = north-star principles and intended system.

If progress wording elsewhere is stale, this handoff wins for current implementation state. Permanent hard-truth rules still apply.

---

## Fresh-chat resume

1. Open `vt7dfbmh7b-droid/mtg-ultimate-mcp`.
2. Read this file and `ULTIMATE_MTG_SPEC.md` first.
3. Continue from `agent/package-probabilities`; do not assume `main` contains the experimental runtime.
4. Inspect the exact active-branch head, PR #2, and current Actions state before changing anything.
5. Keep the validated milestones below separate from later documentation-only commits.
6. Do not merge PR #2, promote `src/server-current.ts`, bump stable, or make a stable release without explicit user approval.
7. Do not repeat completed provider/history probes unless provider state, event set, or evidence source materially changes.
8. Provider outage/unavailability is never proof of absence.
9. The next real blocker is prospective promotion-grade evidence quantity/availability, not another promotion flag or another ML threshold redesign.

---

# Repository / release state

**Active experimental branch:** `agent/package-probabilities`

**Long-lived recovery PR:** PR #2 — `V0.15 experimental recovery / validation — DO NOT MERGE`

**Default branch:** `main`

`main` now contains only the stable-era tree plus default-branch GitHub workflow registration/bootstrap commit:

`2ddce88bbe0a21eaa1584f25a6e6c6df5cccd8a4` — `Register manual workflows on default branch`

That commit changed only `.github/workflows/**`: registration stubs for experimental manual workflows plus a weekly dependency-security audit. It did not copy V0.15 source/runtime code onto `main`.

Stable remains **V0.13**:

- `package.json` remains `0.13.0`;
- `src/server-current.ts` deliberately remains V0.13;
- V0.14/V0.15 remain experimental;
- no model/evidence result can automatically promote stable.

---

# Validated milestones

## 1. Latest feature-functional MTG milestone

`935dfd6643fa5f37d3f527f3d868b6b3a8e24ac2`

Includes completed tutor replacement intelligence and all earlier Commander/win-route work.

Validation:

- CI `32339430944` — PASS
- Scryfall `32339431037` — PASS
- TopDeck `32339430997` — PASS
- Commander Live Control Suite `32339430947` / #180 — PASS

## 2. Reproducibility / dependency milestone

`7a4e1a7291dd5f84b6ad6945f944994dafb4a0ea`

Validation:

- CI `32348788055` / #1584 — PASS
- Scryfall `32348787893` / #132 — PASS
- TopDeck `32348788026` / #171 — PASS
- Commander Live Control Suite `32348788098` / #216 — PASS

This checkpoint added the real lockfile, pinned Node/actions/runner/Docker environment and `npm ci` migration without changing MTG construction logic.

## 3. Promotion-precommitment / privacy / runtime-identity milestone

`63bb7274004060eea507f7991a04b84921d0cd47`

Commit: `Harden future promotion precommitment and privacy`

This is the latest validated executable experimental head before the documentation-only refresh that follows it.

Validation on temporary draft PR #28:

- CI `32352852309` / #1589 — PASS
- Scryfall `32352852291` / #134 — PASS
- TopDeck `32352852360` / #173 — PASS
- Commander Live Control Suite `32352852295` / #218 — PASS

Commander #218 passed every core control and final aggregate gate:

- FF Najeela high-Bracket-4
- FF neutral autonomous build
- Final Fantasy Bracket 5
- unrestricted cEDH
- universal Commander pipeline
- unrestricted neutral Commander
- neutral free-form theme
- neutral exact per-card budget
- Final Fantasy exact-budget
- final aggregate gate

Temporary PR #28 was then closed **unmerged**. `agent/package-probabilities` was fast-forwarded non-force from the prior docs head `7223db...` to `63bb727...`.

---

# Promotion precommitment — FROZEN BEFORE GENUINE FUTURE HOLDOUT

Do not redesign these thresholds after seeing genuine future holdout outcomes. The detailed contract is in `docs/V0.15_PROMOTION_PRECOMMITMENT.md` and implemented in code.

## Claim scope

Current production experiment:

**Predict strict TopDeck event-top-cut outcomes from promotion-grade prospective evidence using exactly two structural features.**

Frozen promotion projection:

- `manaEfficiency`
- `interactionEfficiency`

This is not a universal Commander deck-strength model or a pilot-skill model.

## Production training minimums

A system-clock production seal requires:

- at least 200 strict records;
- minority class share at least 0.20;
- at least 10 unique provider events;
- at least 20 unique provider pilots;
- no single leakage group above 0.25 of records;
- complete provider event and pilot identity;
- all existing strict temporal/source/deck/provenance gates.

Injected-clock test seals may remain small, but can never support a genuine promotion claim.

## Future holdout minimums

Before human promotion review is possible:

- at least 200 genuinely post-seal records;
- minority share at least 0.20;
- at least 10 unique events;
- at least 20 unique pilots;
- no single leakage group above 0.25;
- complete event/pilot identity;
- no training overlap in leakage groups, provider events, pilots or exact deck fingerprints;
- exact sealed extractor + frozen training normalizer.

## Model-quality gates

Absolute neural floors:

- balanced accuracy >= 0.60;
- AUROC >= 0.65.

Versus transparent model:

- balanced-accuracy gain >= 0.02;
- AUROC gain >= 0.01;
- no log-loss regression;
- no Brier-score regression.

Versus prevalence baseline:

- balanced-accuracy gain >= 0.05;
- no log-loss regression.

Calibration:

- expected calibration error <= 0.15.

The older evaluator's relative `shadow-gain-observed` signal is diagnostic only. It is not enough for review eligibility by itself.

## Exact application/dependency identity

A genuine production seal freezes:

- repository full name;
- exact 40-character Git SHA;
- SHA-256 of `package-lock.json`;
- `.node-version`;
- evaluator-contract version;
- training evidence/normalizer/model plan already required by the prior seal.

Future holdout build and evaluation first read the immutable seal and then checkout **that exact sealed Git revision** before `npm ci`, build, materialization or evaluation. Runtime identity is recomputed and must match the seal.

This closes accidental post-seal code/model/dependency drift. It does not replace repository governance against a deliberately malicious authorized rewrite.

---

# Reproducibility / supply-chain state

Current constrained development baseline:

- `package-lock.json` lockfileVersion 3;
- lockfile SHA-256 `672130a435a172bafbd1150138293ab1129a257ab6ec42546b1d1636a319e223`;
- `.node-version` = `22.23.2`;
- workflows use `ubuntu-24.04`;
- installs use `npm ci`;
- GitHub actions use full source SHAs;
- Docker uses `node:22.23.2-alpine3.24@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32`;
- final Docker runtime now runs as the unprivileged built-in `node` user;
- private local evidence filenames/workdirs are ignored by Git;
- default branch runs a weekly high/critical `npm audit` against the active experimental branch's exact lockfile.

Pinned actions include:

- checkout `3d3c42e5aac5ba805825da76410c181273ba90b1`;
- setup-node `820762786026740c76f36085b0efc47a31fe5020`;
- upload-artifact `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`;
- download-artifact `37930b1c2abaa49bbe596cd826c3c89aef350131` where used;
- setup-oras `22ce207df3b08e061f537244349aac6ae1d214f6`, with ORAS CLI `1.3.3`.

Residual reality: GitHub-hosted runner image revisions and some runner-mediated JavaScript runtime behavior remain platform-managed. Do not claim the environment is perfectly hermetic.

---

# Manual workflow registration — COMPLETE

GitHub manual dispatch requires the workflow definition to exist on the default branch.

`main` now contains registration stubs for the experimental manual workflows. To execute the real implementation, dispatch the workflow with ref `agent/package-probabilities`. Running a registration stub on `main` intentionally fails with an explanatory message.

The bootstrap commit is `2ddce88bbe0a21eaa1584f25a6e6c6df5cccd8a4` and contains workflow files only.

---

# Branch / PR cleanup state

Current `agent/*` refs: **43**.

- 1 active: `agent/package-probabilities`.
- 42 historical/temporary refs are now classified safe to retire when a branch-delete-capable interface is available.

The earlier 33 zero-unique-commit refs remain retireable. The seven formerly review-required refs have now been dispositioned:

- `agent/code-cleanup-audit` — unique effect is deletion of historical cEDH compatibility modules; this cleanup is not desired for the active line.
- `agent/historical-carddata-handoff` — documentation-only divergence superseded by the current handoff / historical-source documentation.
- `agent/v15-historical-deck-lock-evidence` — completed bounded research probe; result is recorded, PR #19 closed, rerun only on material provider change.
- `agent/v15-historical-provenance-integration` — no remaining file effect versus active tree.
- `agent/v15-scryfall-one-shot-retention` — obsolete one-shot workflow superseded by the integrated/pinned retention path.
- `agent/v15-scryfall-webarchive-probe` — completed bounded research probe; result recorded, PR #20 closed.
- `agent/v15-upcoming-topdeck-visibility` — completed bounded availability probe; result recorded, PR #21 closed.

Two branches created for this hardening pass are also retireable because their content is now represented by long-lived refs:

- `agent/audit-followup-hardening` -> validated commit now on `agent/package-probabilities`;
- `agent/default-dispatch-bootstrap` -> bootstrap commit now on `main`.

Branch deletion is not available through the current connector. Do not simulate deletion by force-moving refs.

Closed and unmerged historical/temporary PRs include #1, #19, #20, #21 and #28.

PR #2 remains the single intended long-lived draft recovery/validation surface.

---

# Validated Commander / win-route foundations

The experimental V0.15 line already supports:

- universal Commander build pipeline;
- one/two exact commander inputs with ordered pair semantics;
- legality, color identity, singleton and exact 100-card population;
- printing/set/promo/special controls;
- exact physical printing/finish and hard per-card budgets;
- free-form themes and exact Final Fantasy printing-family enforcement;
- exclusions / must-include / land controls;
- strict game-ending/full-table closure;
- independent/commander-coupled/shared-core backup route distinctions;
- setup/interruption intelligence;
- exact tutor route access at opening hand / turn 3 / turn 5;
- tutor value-for-money and one-slot neutral replacements;
- verified portfolio no-access-loss gating;
- exact probability/statistics and overlap-aware physical-card assignment;
- protocol-boundary E2E validation.

Permanent regression: one universal A/B tutor cannot simultaneously satisfy both missing A and B roles.

Classic exact control:

99-card library, 36 lands, 7-card opener, `P(3+ lands) = 26,736,733 / 53,358,536 ≈ 50.1077%`.

Hybrid/multi-route philosophy remains permanent: do not collapse meaningful combat or alternate routes merely to raise a score.

---

# Promotion evidence infrastructure — COMPLETE; evidence quantity remains blocked

Do not build another promotion flag. Existing fail-closed path includes:

1. retained Scryfall predictor truth with exact-byte hashing / immutable references;
2. prospective TopDeck pre-event capture;
3. completed-event capture;
4. deterministic exact-deck/timing evidence join;
5. strict corpus admission + lineage replay;
6. private corpus build;
7. replay-before-seal;
8. system-clock genuine-future seal;
9. frozen training normalizer;
10. sealed future holdout with disjoint leakage groups/events/pilots/exact decks;
11. exact application/dependency identity frozen into the seal;
12. future evaluation using the exact sealed Git revision;
13. promotion readiness restricted to `blocked` or `eligible-for-human-review` under the stronger precommitted contract.

Sensitive player/deck/evidence material remains private. Public artifacts may expose privacy-safe aggregates, hashes, metrics and references only.

Even `eligible-for-human-review` cannot automatically promote stable.

## Current external blocker

The real blocker remains genuine promotion-grade prospective evidence availability/quantity — especially exact Commander deck state observed before provider start, paired with temporally valid predictor truth.

Do not weaken this gate.

Provider unavailable != absent.
Retrospective decklist != pre-event truth.

Completed bounded investigations:

- PR #19: 476 completed tournaments / 12,059 standings rows; no usable historical provider lock/deadline/history attestation found in the tested documented surface.
- PR #20: zero usable Scryfall Wayback bulk-manifest captures found in the tested July 1–August 20, 2026 route.
- PR #21: ten upcoming candidates, zero promotion-usable strict exact pre-event decks at probe time.

These are availability results only, not universal non-existence claims. Do not rerun the exact probes without material state change.

---

# Permanent truth hierarchy

Machine learning, tournament prevalence, optimization, simulation, popularity, requested power or convenience may never override:

- Commander legality;
- exact card/command-zone count;
- singleton/color identity;
- unresolved-card failures;
- banned/legal facts;
- exact physical-printing existence/restrictions;
- exact must-include/exclude constraints;
- exact hard budgets when requested;
- known rules facts;
- verified combo requirements;
- verified full-table closure.

Historical/model evidence must also be temporally valid. Later knowledge may not leak backward into an earlier predictor cutoff, and a provider timestamp may not backdate evidence first observed later.

---

# Next work

The ML precommitment decision is complete. Do **not** tune thresholds or expand the feature projection after observing genuine future outcomes.

Next phase:

1. Use the now-registered manual workflow surface to continue bounded, privacy-safe prospective evidence collection on `agent/package-probabilities`.
2. Admit only evidence that passes strict pre-event timing, exact-deck, predictor-provenance and source-target checks.
3. Accumulate enough production-grade training evidence to meet the frozen 200-record / 20% minority / event/pilot diversity contract.
4. Only then create a genuine system-clock future holdout seal.
5. After the seal, collect genuinely later disjoint evidence and evaluate only with the exact sealed code/dependency identity.
6. If evidence remains unavailable, keep the model blocked; do not loosen gates to manufacture sample size.
7. Separately monitor dependency/security advisories through the default-branch weekly audit.

No stable promotion work is authorized by this handoff.

---

# Do not do without explicit approval

- merge PR #2;
- merge experimental runtime to `main`;
- change `src/server-current.ts` away from V0.13;
- bump stable version;
- call an ML result a release decision;
- weaken legality/printing/budget/full-table truth;
- treat unavailable provider evidence as absence;
- backfill future evidence using later knowledge;
- retune the frozen promotion contract after observing the genuine future holdout.
