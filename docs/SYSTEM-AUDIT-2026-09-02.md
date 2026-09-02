# Ultimate MTG end-to-end system audit — 2026-09-02

## Executive result

The repository is structurally coherent and deterministic at cleanup source `d70cfe8050c1108db0cd4e6de11a7e929d011a9a`. The audit removed four abandoned or misleading implementation paths, brought all automation scripts into the strict build, repaired validation-state reconciliation, aligned the environment template with runtime configuration, and added regressions for repository-level invariants. No historical evidence was deleted, no stable/current server selection changed, and PR #29 remains experimental and unmerged.

The combined deterministic system passes 924/924 tests and all three TypeScript projects. This is engineering validation, not a new accepted INTEL-02 checkpoint: the latest common exact-source live batch at `ec4f4d1...` passed focused Marvel, Food and Fellowship, Necron Dynasties, Squirreled Away, generic strategy inference and expanded Middle-earth controls, but broad Marvel still failed target-quality and strategy-preservation gates.

## Scope and inventory

| Area | Audited inventory | Assessment |
|---|---:|---|
| Runtime and services | 154 non-test TypeScript modules | Every production module has a source, runtime, script or test dependency. No fully unreferenced production module was found. |
| Deterministic tests | 166 TypeScript test files / 924 cases | Green as one suite. Stable V0.13 and experimental V0.15 surfaces remain deliberately separated. |
| Automation and live controls | 46 TypeScript scripts / 39 workflows | All scripts now compile strictly; workflows parse and external actions use full commit pins. |
| Integrations | Scryfall, Commander Spellbook, TopDeck, MTGJSON and FX | Shared retry, pacing, provenance and unavailable-versus-absent behavior have deterministic coverage. Live-provider conclusions remain bounded by persisted controls. |
| Configuration | runtime env, npm, three TypeScript projects, Docker and GitHub Actions | `.env.example` now covers every variable consumed by `src/config.ts`; lockfile install and security audit are clean. |
| Persisted evidence | 64 files, about 3.84 MB | Retained as historical truth, including failures and duplicate payloads. Generated state is now reconciled by every registered writer. |
| Project recovery | machine state, generated handoff, validation registry/index | Local generation, validation and fresh-session resume pass. The last persisted PM workflow record is red because it correctly detected a formerly stale index; a fresh workflow run is required. |

The versioned V0.4–V0.15 modules are not dead copies: they form the explicit inheritance and compatibility chain. Removing them would break the documented basic-feature contract, so they were retained. Ten research-oriented services currently have test-only consumers; they remain bounded libraries for bracket research, competitive evidence, calibration and neural evaluation rather than proven abandoned code.

## Completed cleanup

| Change | Reason | Residual-reference verification |
|---|---|---|
| Removed `v15-package-injection-integration.yml` | Obsolete self-mutating one-shot workflow contradicted KF-008 and could commit source before finishing validation. | No workflow, script or documentation reference remains. |
| Removed `marvel-middle-earth-full-family-bracket5.yml` | Superseded combined-family workflow patched its checkout and cited an unexecuted SHA. | Historical `test-results/full-themed-family-b5` evidence retained; no active reference remains. |
| Removed `apply-themed-special-presets-from-audit.py` | Old audit-to-source patcher no longer matched checked-in V0.8 preset architecture and could inject duplicate policy data. | Production imports the checked-in `printing-family-specials-v08.ts`; no helper reference remains. |
| Removed `e2e-marvel-target-pressure-diagnostic-v15.ts` | Abandoned one-off diagnostic had no package, workflow, source, test or documentation consumer. | Repository-wide reference scan is empty; historical outputs remain. |
| Committed the Marvel four-card ceiling | Permanent workflows had been changing three to four cards after checkout. | Active Marvel controls now execute exact checked-in source; scenario-specific three-card controls remain intentional. |
| Removed all workflow-time TypeScript patching | A cited commit must be the code that ran. | Regression scans every workflow and rejects `src/` or `scripts/` mutation patterns. |
| Added `tsconfig.scripts.json` | Live scripts were outside the unified strict build. | All 46 scripts pass; CI, project integrity and `npm run check` require the result. |
| Repaired script contract errors | Strict compilation found one unused value, readonly option arrays passed to mutable interfaces and nullable bracket comparisons. | Controls now use the declared options contract and fail closed when assessment is unavailable. |
| Reconciled registered evidence writers | Three writers could update metadata without its generated index/docs. | Registry-derived test proves every registered writer rebuilds and stages both views. |
| Completed `.env.example` | Six active retry/timeout/pacing variables were undocumented. | Regression compares the template with every `process.env` read in `src/config.ts`. |

## Structural assessment

### Data flow and interface contracts

The runtime path is `HTTP -> MCP handler -> server-current (V0.13) -> versioned services -> external providers`. The experimental V0.15 factory is opt-in and does not replace `server-current`. Exact legality, card count, printing, budget and provider-completeness boundaries remain fail-closed. Shared configuration is parsed once, provider HTTP policy is centralized, and tests cover the MCP boundary as well as service contracts.

The project-management path is `project-state.json -> generated state/handoff`, while validation is `metadata -> validation-registry.json -> validation-index.json and docs/VALIDATION-STATE.md`. The audit closed the only discovered registered-writer gaps in that second path.

### Concurrency and state management

Registered evidence writers use distinct non-cancelling concurrency groups, reset to the latest branch head, recompute their scoped result, regenerate shared derived state and retry a bounded push. Deterministic tests enforce those properties. The design still creates many bot commits and branch races across 39 workflows; correctness is guarded, but consolidation would reduce cost and operational noise.

Runtime state is process-local: configuration and HTTP pacing are shared intentionally, while MCP server instances are created through the handler factory. Tests verify process-wide Scryfall pacing and isolated protocol/server construction. No unguarded shared mutable deck state was found.

### Initialization, shutdown and recovery

Lockfile install, configuration load, TypeScript build, server construction, `/`, `/health`, 404 handling and idle `SIGTERM` shutdown were smoke-tested successfully. The shutdown handler calls `httpServer.close()` without awaiting closure or enforcing a drain timeout; a stuck keep-alive or active request can therefore prolong termination indefinitely. This remains a medium operational follow-up because hardening the stable runtime entry point should be done with lifecycle tests and an explicit deployment timeout contract.

Project recovery passes machine-state validation, generated-document validation and a fresh-session resume smoke locally. The persisted project-integrity record currently describes the earlier stale-index failure accurately; the updated workflow will replace it only after an exact-source GitHub run.

## Historical diagnostics and live evidence

- The 100 most recent active-branch Action runs inspected contained 69 successes, 28 failures and 3 cancellations. Many failures are retained adversarial evidence rather than regressions in the stable server.
- The latest common exact-source scenario batch, `ec4f4d1...`, passed focused Marvel, Food and Fellowship, Necron Dynasties, Squirreled Away, generic strategy inference and expanded Middle-earth controls. Broad Marvel executed but accepted no supported package, so target-quality and strategy-preservation outcomes failed.
- CI run `33606486408` and project-state run `33606486359` exposed a stale validation index. KF-045 records the cause and the completed prevention.
- Older build and target-pressure diagnostic failures are covered by the now-green deterministic suite. `test-results/intel02-shared-truth-repair/failure-context.txt` remains the only non-empty archived failure-context file and was intentionally retained.
- GitHub had no open or closed repository issues at audit time. The draft PR #29 is the issue/history surface and remains explicitly marked “DO NOT MERGE.”
- `npm audit --audit-level=low` reports zero vulnerabilities. Installed direct dependencies satisfy the lockfile and declared ranges.

## Findings by severity

| Severity | Finding | Impact | State / required follow-up |
|---|---|---|---|
| High | Broad Marvel is red at the latest exact-source live batch. | Prevents a uniform constrained-family INTEL-02 quality claim. | Open: diagnose generic candidate/preservation behavior and rerun the entire common-source family. |
| High | Cleanup source `d70cfe8...` has deterministic but not live exact-source evidence. | Local green cannot establish provider-backed behavior or a new accepted checkpoint. | Open: run CI, PM integrity and all registered live controls; manually audit accepted swaps. |
| High | The main-branch dependency-security workflow still targets legacy `agent/package-probabilities`. | Security automation may inspect an obsolete development line rather than the active candidate. | Open outside this branch's authority: correct on `main` under explicit release/governance approval. |
| Medium | Runtime shutdown has no awaited drain or forced-close deadline. | Active connections can delay deployment termination. | Open: extract a testable lifecycle, stop accepting work, await close, force-close after a configured deadline. |
| Medium | Thirty-nine workflows and independent evidence commits create avoidable cost/race pressure. | Slow feedback and noisy history despite bounded reconciliation. | Open: consolidate related live controls into reusable workflows or one result aggregator without weakening exact-source isolation. |
| Medium | Ten research services have test-only consumers. | They add maintenance surface and can drift without a product entry point. | Review at BENCH-01/INTEL-03; retain until the research roadmap decides promotion or archival. |
| Low | Persisted evidence contains duplicate deck/result payloads. | Repository growth and review noise; no runtime impact at the current 3.84 MB. | Introduce a manifest/content-addressed archive policy for future evidence; do not rewrite historical truth. |
| Low | Local Node was 24.19.0 while the reproducible baseline is 22.23.2. | Small risk that a local-only pass uses newer runtime behavior. | GitHub remains pinned; reproduce final acceptance on the pinned runner. |

No critical security, legality, data-loss or stable-interface defect was found.

## Verification record

| Check | Result |
|---|---|
| Locked dependency install | Pass |
| Runtime TypeScript build | Pass |
| Project-management TypeScript build | Pass |
| All automation/E2E TypeScript build | Pass, 46 scripts |
| Deterministic suite | Pass, 924/924 |
| Workflow YAML parse | Pass, 39 files |
| Immutable action references | Pass, all external actions pinned to 40-character SHAs |
| Runtime environment-template coverage | Pass |
| Production dependency graph | Pass, no fully unreferenced production module |
| Project-state validation / fresh-session recovery | Pass locally |
| Validation-index generation / validation | Pass locally, 7 registered controls |
| Stable runtime endpoint and idle shutdown smoke | Pass |
| Dependency vulnerability audit | Pass, 0 vulnerabilities |
| Residual references to removed paths | None |

## Prioritized remediation plan

1. Publish cleanup/state commits and require exact-source CI plus project-state integrity to pass on the pinned Node 22.23.2 runner.
2. Run one common-source registered live-control batch. Treat broad Marvel as blocking; preserve every failed artifact and do not accept a checkpoint from partial green evidence.
3. Manually review every accepted IN->OUT package from that batch for strategy, infrastructure, mana, legality, printing and budget truth.
4. Fix broad Marvel through generic semantic or selection logic, then repeat the full affected family rather than tuning a named card or commander.
5. Add and test bounded graceful shutdown before changing the stable runtime lifecycle.
6. Correct main-branch dependency-security targeting under explicit main/release authority.
7. Consolidate live-control orchestration and define a non-destructive evidence-retention manifest before repository growth becomes material.
8. At BENCH-01/INTEL-03, decide which test-only research libraries receive a product surface and which should be archived with their evidence.
