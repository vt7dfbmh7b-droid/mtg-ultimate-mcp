# Ultimate MTG end-to-end system audit — 2026-09-02

## Executive result

The repository is structurally coherent and deterministic after the generic compound operational-component hardening at source `f0c3b9f82dca49f295e44175e517d992e6e5356e` (building on semantic/resource source `7265531610a7012f7940f591c99a2fc6ef3af06e`), with bounded-shutdown CI follow-up at `45f4cb9acb082d0bd4bb89310b90e9e63fbeb44d`. The audit removed four abandoned or misleading implementation paths, brought all automation scripts into the strict build, repaired validation-state reconciliation for all eleven evidence writers, fixed project-state validation ordering so it no longer persists a false index failure, aligned the environment template with runtime configuration, added generic role/engine regressions, added compound component-family preservation, and bounded runtime shutdown. No historical evidence was deleted, no stable/current server selection changed, and PR #29 remains experimental and unmerged.

The combined deterministic system passes the full direct Node test sweep (167 test files, 940 cases, zero failures) and all three TypeScript projects. Exact-source controls at `f0c3b9f82dca49f295e44175e517d992e6e5356e` pass the dependent Squirreled Away, Necron Dynasties, Food and Fellowship and Middle-earth lanes. Focused and broad Marvel execute and persist correctly but both fail closed with no-supported-improvement and zero swaps: the generic component-family guard rejects the six previously unsafe focused substitutions, while the restricted broad pool still cannot repair its fast-mana/tutor gates. Liliana's NZ$500 challenge passes as supplementary benchmark evidence. Runtime source `45f4cb9acb082d0bd4bb89310b90e9e63fbeb44d` passes pinned CI after fixing the shutdown timer race. This is engineering and bounded scenario evidence, not a new accepted INTEL-02 checkpoint.

## Scope and inventory

| Area | Audited inventory | Assessment |
|---|---:|---|
| Runtime and services | 155 non-test TypeScript modules | Every production module has a source, runtime, script or test dependency. No fully unreferenced production module was found. |
| Deterministic tests | 167 TypeScript test files / 940 cases | Green as one suite. Stable V0.13 and experimental V0.15 surfaces remain deliberately separated. |
| Automation and live controls | 46 TypeScript scripts / 39 workflows | All scripts now compile strictly; workflows parse and external actions use full commit pins. |
| Integrations | Scryfall, Commander Spellbook, TopDeck, MTGJSON and FX | Shared retry, pacing, provenance and unavailable-versus-absent behavior have deterministic coverage. Live-provider conclusions remain bounded by persisted controls. |
| Configuration | runtime env, npm, three TypeScript projects, Docker and GitHub Actions | `.env.example` now covers every variable consumed by `src/config.ts`; lockfile install and security audit are clean. |
| Persisted evidence | 70 tracked files, about 4.25 MB | Retained as historical truth, including failures and duplicate payloads. Every writer now reconciles branch races; registered writers also regenerate derived state. |
| Project recovery | machine state, generated handoff, validation registry/index | Local generation, validation and fresh-session resume pass. Exact-source project integrity also passed at `974f0f6...`, including the new automation-script compilation. |

The versioned V0.4–V0.15 modules are not dead copies: they form the explicit inheritance and compatibility chain. Removing them would break the documented basic-feature contract, so they were retained. Ten research-oriented services currently have test-only consumers; they remain bounded libraries for bracket research, competitive evidence, calibration and neural evaluation rather than proven abandoned code.

## Completed cleanup

| Change | Reason | Residual-reference verification |
|---|---|---|
| Removed `v15-package-injection-integration.yml` | Obsolete self-mutating one-shot workflow contradicted KF-008 and could commit source before finishing validation. | No active workflow, script or source reference remains; this audit row is the retained historical mention. |
| Removed `marvel-middle-earth-full-family-bracket5.yml` | Superseded combined-family workflow patched its checkout and cited an unexecuted SHA. | Historical `test-results/full-themed-family-b5` evidence retained; no active reference remains beyond this audit record. |
| Removed `apply-themed-special-presets-from-audit.py` | Old audit-to-source patcher no longer matched checked-in V0.8 preset architecture and could inject duplicate policy data. | Production imports the checked-in `printing-family-specials-v08.ts`; no active helper reference remains beyond this audit record. |
| Removed `e2e-marvel-target-pressure-diagnostic-v15.ts` | Abandoned one-off diagnostic had no package, workflow, source, test or documentation consumer. | No active source/workflow/script consumer remains; historical outputs and this audit record remain. |
| Committed the Marvel four-card ceiling | Permanent workflows had been changing three to four cards after checkout. | Active Marvel controls now execute exact checked-in source; scenario-specific three-card controls remain intentional. |
| Removed all workflow-time TypeScript patching | A cited commit must be the code that ran. | Regression scans every workflow and rejects `src/` or `scripts/` mutation patterns. |
| Added `tsconfig.scripts.json` | Live scripts were outside the unified strict build. | All 46 scripts pass; CI, project integrity and `npm run check` require the result. |
| Repaired script contract errors | Strict compilation found one unused value, readonly option arrays passed to mutable interfaces and nullable bracket comparisons. | Controls now use the declared options contract and fail closed when assessment is unavailable. |
| Reconciled registered evidence writers | Three writers could update metadata without its generated index/docs. | Registry-derived test proves every registered writer rebuilds and stages both views. |
| Reconciled all evidence writers | Four unregistered legacy writers still used cancelling groups or a single push attempt. | The regression now discovers all eleven pushing workflows; each has a unique non-cancelling group and eight latest-head retries. |
| Completed `.env.example` | Six active retry/timeout/pacing variables were undocumented. | Regression compares the template with every `process.env` read in `src/config.ts`. |
| Preserved empty upgrade-lane diagnostics | Restricted-family refinement could report only `no-supported-swaps-found` while omitting which failed target lanes had no eligible or only already-present cards. | `suggestDeckUpgrades` now retains an availability reason and pre-exclusion role-match count for every target lane; provenance projection and regression coverage pass at `d5bc84d...`. |
| Prepared validation index before project-state integrity checks | The integrity workflow validated a stale index before rebuilding it after evidence updates, creating a false PM failure record. | The workflow now runs `npm run validation:index` before validation; run `33694684158` passed and persisted a self-consistent PM record at `6bdea9b...`. |
| Added generic semantic safety floors to upgrade pairing | Focused Marvel refinement could spend low-volume tutors, interaction, cost reduction or graveyard utility on cosmetic gains. | Role-level floors now protect non-surplus infrastructure across a multi-swap package; source `7265531...` no longer cuts the prior tutor/graveyard-utility examples. Manual review still blocks weaker interaction/resource substitutions. |
| Added compound resource-engine and component-family floors | A card/token/mana engine or another multi-role operational card could be numerically replaced by a narrower effect while coarse strategy affinity stayed green. | Two-axis engines retain every resource axis, three-axis engines retain at least two, and any outgoing card with multiple operational component families must retain all of them in the incoming replacement; anonymous regressions and exact-source focused/broad controls cover the boundary. |
| Added bounded graceful shutdown | `server.close()` and MCP close could hang indefinitely on active connections or stuck handlers. | `gracefulShutdown` stops intake, drains idle connections, force-closes HTTP after `SHUTDOWN_TIMEOUT_MS`, bounds MCP close to the same deadline and surfaces failures; lifecycle tests and CI source `45f4cb9...` pass. |

## Structural assessment

### Data flow and interface contracts

The runtime path is `HTTP -> MCP handler -> server-current (V0.13) -> versioned services -> external providers`. The experimental V0.15 factory is opt-in and does not replace `server-current`. Exact legality, card count, printing, budget and provider-completeness boundaries remain fail-closed. Shared configuration is parsed once, provider HTTP policy is centralized, and tests cover the MCP boundary as well as service contracts.

The project-management path is `project-state.json -> generated state/handoff`, while validation is `metadata -> validation-registry.json -> validation-index.json and docs/VALIDATION-STATE.md`. The audit closed the only discovered registered-writer gaps in that second path.

### Concurrency and state management

All evidence writers use distinct non-cancelling concurrency groups, preserve their scoped result, reset to the latest branch head and retry a bounded push. Registered writers also regenerate shared derived state. Deterministic tests discover writers from their actual push behavior and enforce those properties. The design still creates many bot commits and branch races across 39 workflows; correctness is guarded, but consolidation would reduce cost and operational noise.

Runtime state is process-local: configuration and HTTP pacing are shared intentionally, while MCP server instances are created through the handler factory. Tests verify process-wide Scryfall pacing and isolated protocol/server construction. No unguarded shared mutable deck state was found.

### Initialization, shutdown and recovery

Lockfile install, configuration load, TypeScript build, server construction, `/`, `/health`, 404 handling and idle `SIGTERM` shutdown were smoke-tested successfully. The runtime now uses a reusable bounded lifecycle: it stops accepting work, drops idle keep-alives, awaits HTTP/MCP cleanup within `SHUTDOWN_TIMEOUT_MS` (default 10s), force-closes stuck HTTP connections and reports close errors through the process exit code. Lifecycle regressions cover normal drain, already-closed servers, forced HTTP close, stuck MCP close and surfaced failures; CI source `45f4cb9...` passed.

Project recovery passes machine-state validation, generated-document validation and a fresh-session resume smoke locally. Exact-source project-integrity run `33611526036` passed and published a self-consistent record for `974f0f6...`.

## Historical diagnostics and live evidence

- The latest 100 active-branch Action runs inspected contain 82 successes, 18 failures and no cancellations. The two current Marvel failures are intentional fail-closed intelligence results (zero swaps with target-quality/strategy gates still red), while dependent controls and CI pass; historical failures remain retained adversarial evidence rather than regressions in the stable server.
- Source `f0c3b9f82dca49f295e44175e517d992e6e5356e` passed the exact-source dependent Squirreled Away, Necron, Food and Fellowship and Middle-earth controls. Focused Marvel run `33796139065` and broad Marvel run `33796139031` both executed and persisted no-supported-improvement with zero swaps. The generic compound operational-component guard now rejects the six historical focused substitutions when a cut's interaction, land/mana, treasure, sacrifice, card-advantage, token or cost-reduction families are not retained like-for-like; the broad lane still exhausts its restricted fast-mana/tutor pool. The prior source `7265531...` six-swap package remains historical/manual-review evidence only. CI run `33796139072` passed the component-guard source; Liliana run `33796139075` passed legality, budget and all measured construction gates with three verified win-oriented combos; it remains supplementary evidence, not the positive INTEL-01 full-table proof. Project State Integrity run `33798707547` and CI run `33798707663` passed the synchronized documentation/state commit. Runtime CI source `45f4cb9acb082d0bd4bb89310b90e9e63fbeb44d` passed after the timer-race fix.
- The isolated FF32 Scions & Spellcraft control on PR #32 executed from source `a079090...` in workflow `33813323027`. Build, direct commander-mechanic regressions and evidence persistence passed, but the behavioral gate failed honestly: five locally preserved swaps reduced whole-deck Y'shtola spells-control affinity from 425 to 421 and trigger-spell density from 29 to 27. The corrected workflow metadata, stale-artifact cleanup and bounded persistence retry are healthy; this is a branch-local cumulative strategy-retention finding that must be reproduced on the current active source before it can affect checkpoint review. The detailed record is `docs/FF32-SCIONS-SPELLCRAFT-AUDIT-2026-09-03.md`.
- The unchanged FF32 control was also replayed diagnostically against active source `7a2a80f...` in a disposable worktree. That current architecture accepted ten swaps and raised coarse spells-control affinity 222→242 and support 21→23, but reduced independently counted trigger-eligible noncreature spells 29→21, total noncreature spells 77→75 and board wipes 3→2. The replay stopped at the trigger-density assertion and was not persisted as a validation result. This confirms a separate generic coverage gap: aggregate affinity/support retention does not represent every caller-required strategy-fuel or structural-floor invariant.
- Middle-earth run `33611526105` passed its build and live-control steps but failed its single-attempt evidence push. That operational failure exposed four remaining legacy writers, all repaired at `c543502...`.
- CI run `33606486408` and project-state run `33606486359` exposed a stale validation index. KF-045 records the cause; the ordering fix was validated by project-state run `33694684158`, which passed and persisted `validation_index_outcome=success` at `6bdea9b...`.
- The documentation/state reconciliation commit `432d020...` briefly reproduced the same race (CI `33704306217` saw the pre-writer index), while project-state integrity run `33704306215` repaired and persisted the self-consistent state at `3578ffe...`. The latest branch state is therefore valid; this remains an operational race characteristic of concurrent evidence writers, not a runtime defect.
- The exact-source state refresh commit `2705e585...` reproduced the same ordering hazard once: CI `33799209500` checked the pre-reconciliation PM metadata and failed only its validation-index step, while project-state integrity run `33799209460` rebuilt and persisted the self-consistent PM record at `f51bfe7...`. A retry against the original event SHA cannot repair that stale checkout; the current branch head is `f51bfe7...` and the next CI event must validate that reconciled tree. This remains an evidence-writer race, not a source or runtime defect.
- Older build and target-pressure diagnostic failures are covered by the now-green deterministic suite. `test-results/intel02-shared-truth-repair/failure-context.txt` remains the only non-empty archived failure-context file and was intentionally retained.
- The issue tracker currently has four open items: #29 (this experimental branch), #30 (temporary INTEL-02 zero-progress harness), #32 (temporary Final Fantasy Scions & Spellcraft no-infinite upgrade harness), and #2 (legacy package-probabilities recovery surface). All are validation/recovery surfaces marked DO NOT MERGE; #32 is the unresolved materially different FF-only benchmark and its current isolated run fails package-wide strategy retention even though per-swap checks pass. Closed history includes #3 unused-code audit, #13 cleanup validation and #28 audit-follow-up hardening. The draft PR #29 remains explicitly marked DO NOT MERGE.
- `npm audit --audit-level=low` reports zero vulnerabilities. Installed direct dependencies satisfy the lockfile and declared ranges.

## Findings by severity

| Severity | Finding | Impact | State / required follow-up |
|---|---|---|---|
| High | Broad Marvel remains red at exact-source live validation. | Prevents a uniform constrained-family INTEL-02 quality claim. | At `f0c3b9f...`, execution and persistence pass but refinement accepts zero swaps; exhaustive restricted discovery still has no supported fast-mana/tutor repair. Open: decide whether the family should have an explicit construction ceiling or whether a generic cross-family candidate policy can be broadened; do not add card-name hacks. |
| High | The prior focused Marvel package is correctly rejected by generic component preservation. | The six historical swaps lowered average nonland MV but spent interaction, land/mana infrastructure, persistent colored mana, mana-rock, treasure, sacrifice and compound card/token/mana-engine roles. | The `f0c3b9f...` guard fails closed on all six classes with zero swaps. Keep checkpoint `77a5383...` unchanged; any future package still needs independent surplus and like-for-like evidence. |
| High | FF32 exposes cumulative strategy drift across a locally preserved package. | Five swaps improved curve/early/ramp metrics but reduced Y'shtola spells-control affinity 425→421 and trigger-spell density 29→27; a coarse per-swap pass would overstate deck quality. | Isolated source `a079090...` / workflow `33813323027` failed the aggregate gate and persisted exact evidence. Reproduce on the active source, add generic package-level strategy/trigger-density non-regression, and keep the family blocked until it passes. |
| High | Current-source FF32 replay still permits strategy-fuel and wipe-floor loss. | Coarse affinity/support rose, but trigger-eligible spells fell 29→21, noncreature spells 77→75 and board wipes 3→2; the caller caught the regression only after the optimizer accepted ten swaps. | Diagnostic source `7a2a80f...` replay is not persisted acceptance evidence. Add generic caller-declared component/floor preservation with name-independent tests, then rerun FF32 and the dependent family. |
| High | The main-branch dependency-security workflow still targets legacy `agent/package-probabilities`. | Security automation may inspect an obsolete development line rather than the active candidate. | Open outside this branch's authority: correct on `main` under explicit release/governance approval. |
| Medium | Thirty-nine workflows and independent evidence commits create avoidable cost/race pressure. | Slow feedback and noisy history remain even though latest-head reconciliation protects correctness. | Open: consolidate related live controls or add a result aggregator without weakening exact-source isolation. |
| Medium | Ten research services have test-only consumers. | They add maintenance surface and can drift without a product entry point. | Review at BENCH-01/INTEL-03; retain until the research roadmap decides promotion or archival. |
| Low | Persisted evidence contains duplicate deck/result payloads. | Repository growth and review noise; no runtime impact at the current repository size. | Introduce a manifest/content-addressed archive policy for future evidence; do not rewrite historical truth. |
| Low | Local Node is newer than the pinned runner. | A local-only pass can use newer runtime behavior. | GitHub CI remains the acceptance authority; reproduce promotion candidates on the pinned runner. |

No critical security, legality, data-loss or stable-interface defect was found.

## Verification record

| Check | Result |
|---|---|
| Locked dependency install | Pass |
| Runtime TypeScript build | Pass |
| Project-management TypeScript build | Pass |
| All automation/E2E TypeScript build | Pass, 46 scripts |
| Deterministic suite | Pass, 167 test files / 940 cases in the direct Node sweep |
| Workflow YAML parse | Pass, 39 files |
| Immutable action references | Pass, all external actions pinned to 40-character SHAs |
| Runtime environment-template coverage | Pass |
| Production dependency graph | Pass, no fully unreferenced production module |
| Project-state validation / fresh-session recovery | Pass locally; generated docs and resume checks agree with `project-state.json` |
| Validation-index generation / validation | Pass locally, 7 registered controls |
| FF32 Scions & Spellcraft isolated refinement | Build, direct mechanic regressions and persistence pass; intelligence gate fails as expected on cumulative strategy retention; no stale success artifact remains |
| FF32 current-source diagnostic replay | Active-source disposable replay reaches refinement but fails trigger-density preservation; no persisted branch result or promotion signal |
| Stable runtime endpoint and bounded idle shutdown smoke | Pass; CI source `45f4cb9...` also passed |
| Dependency vulnerability audit | Pass, 0 vulnerabilities in the last successful pinned CI audit |
| Residual references to removed paths | None |

## Prioritized remediation plan

1. Keep semantic source `7265531610a7012f7940f591c99a2fc6ef3af06e`, component-guard source `f0c3b9f82dca49f295e44175e517d992e6e5356e` and runtime follow-up `45f4cb9acb082d0bd4bb89310b90e9e63fbeb44d` as experimental evidence only; do not promote checkpoint `77a5383...`.
2. Retain the six source-`7265531...` focused-Marvel packages as historical manual-review evidence; the generic `f0c3b9f...` guard now rejects their component losses and both exact-source Marvel lanes fail closed with zero swaps.
3. Decide whether the Marvel family should have an explicit constrained ceiling or whether a generic semantic candidate expansion is justified; rerun both focused and broad lanes from one exact source after any policy change.
4. Reproduce the FF32 cumulative strategy-retention failure on the current active source, add a generic aggregate affinity/trigger-density regression and rerun the dependent control family before any INTEL-02 checkpoint review.
5. Extend the package acceptance contract with generic caller-declared strategy-fuel and structural-floor components, preserve them alongside aggregate strategy retention, add anonymous regressions, and rerun FF32 plus the dependent family.
6. Keep bounded shutdown covered by lifecycle tests and add deployment-level abort telemetry before altering the stable runtime entry point.
7. Correct main-branch dependency-security targeting under explicit main/release authority.
8. Consolidate live-control orchestration and define a non-destructive evidence-retention manifest before repository growth becomes material.
9. Resolve or close temporary validation surfaces #30 and #32 after current-source evidence capture; keep the legacy recovery surface #2 separate from PR #29 and decide its archival path.
10. At BENCH-01/INTEL-03, decide which test-only research libraries receive a product surface and which should be archived with their evidence.
