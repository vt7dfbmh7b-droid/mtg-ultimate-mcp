# Ultimate MTG — Project Handoff

_Last updated: 2026-08-20 NZST_

This is the authoritative current-state recovery document for `vt7dfbmh7b-droid/mtg-ultimate-mcp`.

Read it with `ULTIMATE_MTG_SPEC.md`:

- `PROJECT_HANDOFF.md` = where the project actually is now;
- `ULTIMATE_MTG_SPEC.md` = north-star principles and intended system.

If progress wording in the spec is stale, this handoff wins for current implementation state. Permanent truth rules in the spec still apply.

---

## Fresh-chat resume

1. Open `vt7dfbmh7b-droid/mtg-ultimate-mcp`.
2. Read this file and `ULTIMATE_MTG_SPEC.md` first.
3. Continue from `agent/package-probabilities`; do not assume `main` is the development state.
4. Inspect the exact branch head, PR #2, and GitHub Actions state before changing anything.
5. Keep three concepts separate:
   - latest validated feature-functional SHA;
   - latest validated maintenance/reproducibility SHA;
   - any later documentation-only head.
6. Do not merge PR #2, merge to `main`, bump the package version, or promote `src/server-current.ts` without explicit user approval.
7. Do not repeat completed provider/history probes unless provider state, event set, or evidence source materially changes.
8. Provider outage/unavailability is never proof of absence.
9. Continue from **Next work** below unless a newer validated milestone or explicit instruction supersedes it.

---

# Repository / release state

**Active branch:** `agent/package-probabilities`

**Only intended open recovery PR:** PR #2 — `V0.15 experimental recovery / validation — DO NOT MERGE`

## Latest validated feature-functional implementation

`935dfd6643fa5f37d3f527f3d868b6b3a8e24ac2`

This remains the latest feature-functional milestone. It includes completed tutor replacement intelligence and all earlier Commander/win-route work.

Functional validation:

- CI `32339430944` — PASS
- Scryfall Card Data Source Live `32339431037` — PASS
- TopDeck Learning Source Live `32339430997` — PASS
- Commander Live Control Suite `32339430947` / run #180 — PASS

## Latest validated maintenance / reproducibility implementation

`7a4e1a7291dd5f84b6ad6945f944994dafb4a0ea`

This is the completed reproducibility-cleanup checkpoint. It is functionally based on `935dfd...`; the compare from `935dfd...` to `7a4e1a...` contains **no `src/**`, `scripts/**`, or test-data changes**. Changes are repository/docs cleanup plus workflow, dependency-lock, Node, and Docker reproducibility only.

Required gates on the maintenance head all passed:

- CI `32348788055` / run #1584 — PASS
- Scryfall Card Data Source Live `32348787893` / run #132 — PASS
- TopDeck Learning Source Live `32348788026` / run #171 — PASS
- Commander Live Control Suite `32348788098` / run #216 — PASS

Commander #216 passed all core controls:

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

GitHub validated a synthetic PR merge commit for this head. The synthetic merge tree was explicitly compared with `7a4e1a...` and had **zero file differences**, so it is accurate to call this a tree-identical PR-merge validation of the maintenance head.

A later handoff/documentation commit may be newer than `7a4e1a...`; that does not create a new functional or maintenance validation milestone by itself.

## Stable boundary

Stable remains **V0.13**:

- `package.json` remains `0.13.0`;
- `src/server-current.ts` deliberately remains V0.13;
- V0.14/V0.15 remain experimental;
- `main` remains outside the experimental promotion path until explicit approval.

No model result, validation pass, evidence state, or experimental feature may automatically rewrite `server-current`, bump stable, merge to `main`, or authorize stable promotion.

---

# Reproducibility cleanup — COMPLETE

The major reproducibility debt identified in the 2026-08-20 audit has been closed without changing MTG behavior.

Implemented:

- committed npm `package-lock.json` generated on Node 22.23.2 / npm 10.9.8;
- lockfile SHA-256: `672130a435a172bafbd1150138293ab1129a257ab6ec42546b1d1636a319e223`;
- `.node-version` = `22.23.2`;
- workflows use `ubuntu-24.04` rather than floating `ubuntu-latest`;
- dependency installs use `npm ci`;
- package-manager cache is explicitly disabled in setup-node;
- GitHub Actions are pinned by full commit SHA rather than mutable major tags;
- Docker uses exact Node/Alpine version plus multi-platform image-index digest:
  `node:22.23.2-alpine3.24@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32`;
- Docker copies `package-lock.json` and uses `npm ci`;
- all normal/live Commander controls were migrated;
- all seven promotion/evidence workflows were migrated;
- temporary reproducibility-preview workflow was removed.

Pinned action sources include:

- checkout `3d3c42e5aac5ba805825da76410c181273ba90b1`;
- setup-node `820762786026740c76f36085b0efc47a31fe5020`;
- upload-artifact `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`;
- download-artifact `37930b1c2abaa49bbe596cd826c3c89aef350131` where used;
- setup-oras `22ce207df3b08e061f537244349aac6ae1d214f6`, with ORAS CLI still explicitly requested as `1.3.3`.

Residual reality: GitHub-hosted runner image revisions remain platform-managed, and the pinned setup-oras action still has runner-mediated JavaScript runtime behavior. Do not describe the environment as perfectly hermetic. It is materially more reproducible and supply-chain constrained than before.

The sensitive evidence-workflow migration changed only runner/action/install environment lines. Privacy checks, immutable digest requirements, evidence admission, temporal gates, system-clock sealing, frozen normalizer behavior, and private-artifact cleanup were intentionally preserved.

---

# Repository / PR cleanup checkpoint

A complete ancestry audit classified all 41 `agent/*` branches relative to the active branch.

- Active: `agent/package-probabilities`.
- 33 historical branch refs have zero unique commits relative to the active branch and are proven safe to retire when a branch-delete-capable interface is available.
- 7 branches contain unique commits and must not be deleted blindly:
  - `agent/code-cleanup-audit`
  - `agent/historical-carddata-handoff`
  - `agent/v15-historical-deck-lock-evidence`
  - `agent/v15-historical-provenance-integration`
  - `agent/v15-scryfall-one-shot-retention`
  - `agent/v15-scryfall-webarchive-probe`
  - `agent/v15-upcoming-topdeck-visibility`

Do not simulate branch deletion by force-moving refs.

Archived closed and unmerged during cleanup:

- PR #1 — historical V0.13 development surface;
- PR #19 — historical TopDeck deck-lock research;
- PR #20 — archived Scryfall / Wayback research;
- PR #21 — upcoming TopDeck visibility research.

PR #2 remains the single long-lived draft recovery/validation surface.

---

# Validated Commander / win-route foundations

The experimental V0.15 line already contains validated support for:

- universal Commander build pipeline;
- one/two commander inputs with ordered partner semantics;
- Commander legality, singleton, color identity and exact population;
- printing/set/promo/special restrictions;
- exact physical-printing and requested-finish budget witnesses;
- exact per-card hard budgets;
- free-form themes and exact Final Fantasy printing-family enforcement;
- excluded/must-include/land controls;
- strict game-ending / full-table win closure;
- independent, commander-coupled and shared-core backup-route distinctions;
- setup/interruption intelligence;
- exact tutor-to-route access at opening hand / turn 3 / turn 5;
- tutor value-for-money;
- tutor replacement intelligence with one-slot counterfactuals and portfolio safety;
- exact probability/statistics and overlap-aware physical-card assignment;
- protocol-boundary E2E validation.

Permanent regression rule: one universal A/B tutor cannot simultaneously satisfy both missing A and B roles.

Classic exact control remains:

99-card library, 36 lands, 7-card opener, `P(3+ lands) = 26,736,733 / 53,358,536 ≈ 50.1077%`.

Hybrid/multi-route deck philosophy remains permanent: do not collapse meaningful combat or alternate win routes merely to raise a score.

---

# Promotion evidence infrastructure — COMPLETE, evidence quantity still blocked

Do not build another promotion flag. The fail-closed V0.15 infrastructure already includes:

1. retained Scryfall predictor truth with exact-byte hashing and immutable references;
2. prospective TopDeck pre-event capture;
3. completed-event capture;
4. deterministic exact-deck/timing evidence join;
5. strict corpus admission with lineage replay;
6. private corpus build;
7. replay-before-seal;
8. system-clock genuine-future seal;
9. frozen training normalizer;
10. sealed future holdout with disjoint leakage groups/events/pilots/exact decks;
11. future evaluation restricted to `blocked` or `eligible-for-human-review`.

Sensitive player/deck/evidence material stays private. Public artifacts may expose aggregate diagnostics, hashes, and metrics only.

Even `eligible-for-human-review` cannot automatically promote stable.

## Current blocker

The remaining promotion blocker is genuine promotion-grade prospective evidence availability/quantity—especially exact Commander deck state observed before provider start with temporally valid predictor truth.

Do not weaken this gate. Provider unavailability is not absence, and retrospective decklists may not be reinterpreted as pre-event truth.

## Completed availability research

- PR #19: 476 completed tournaments / 12,059 standings rows; no usable historical provider lock/deadline/history attestation found in the tested documented response surface. Availability/schema result only.
- PR #20: zero Wayback Scryfall bulk-manifest captures found through the tested July 1–August 20, 2026 route. Availability result only.
- PR #21: ten tested upcoming candidates produced zero promotion-usable strict exact pre-event decks at the recorded probe. Availability result only.

Do not repeat those exact probes without a material provider/event/evidence-source change.

---

# Permanent truth hierarchy

Machine learning, tournament prevalence, optimization, simulation, popularity, requested power, or convenience may never override:

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

# Next work — ML precommitment before any genuine future seal

Reproducibility is no longer the next blocker. The next maintenance milestone is to strengthen the promotion experiment contract **before observing any genuine future holdout**.

Required decisions/work:

1. **Absolute predictive-quality floors**
   - Current gates are mostly relative improvement over the transparent model.
   - Add precommitted absolute AUROC and balanced-accuracy floors.
   - Add an explicit simple/trivial prevalence-baseline comparison.
   - Define these before future outcomes are observed so thresholds cannot move after seeing results.

2. **Feature-contract decision**
   - The Commander snapshot computes many features, but promotion-grade real rows currently effectively populate only `manaEfficiency` and `interactionEfficiency`; missing contract values default to zero.
   - Either expand the promotion-grade feature projection before serious evaluation, or explicitly precommit that the current experiment is intentionally a narrow two-feature experiment.

3. **Corpus-diversity contract**
   - Source-lineage, region/archetype, event and pilot concentration are currently mostly warnings.
   - Decide which must become hard promotion blockers, or explicitly scope any claim to the available TopDeck population.

After those rules are frozen and validated, resume bounded, privacy-safe prospective evidence discovery/collection. Do not start a genuine future seal first and decide these thresholds later.

---

# Do not do without explicit approval

- merge PR #2;
- merge to `main`;
- change `src/server-current.ts` away from V0.13;
- bump stable version;
- call an ML result a release decision;
- weaken legality/printing/budget/full-table truth;
- treat unavailable provider evidence as absence;
- backfill future evidence using later knowledge.
