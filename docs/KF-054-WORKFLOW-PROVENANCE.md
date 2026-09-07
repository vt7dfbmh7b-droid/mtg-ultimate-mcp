# KF-054 — Self-deleting repair workflow outruns current-tree immutability checks

## Observed

On 2026-09-07, BENCH repair lineages including `2d0d5ee260da6ef31215d7a4cb542cf00f21077a` and `00571713696977093fee717deecc2b26969e2643` were produced through temporary GitHub Actions workflows that patched `src/**`, validated the patched checkout, removed the temporary workflow, and committed the resulting source. Normal CI correctly rejected the workflow-bearing commit, but GitHub could start that workflow before the ordinary CI rejection completed. Once the temporary workflow deleted itself, a current-tree-only immutability test could no longer see the earlier workflow file.

## Risk

A scheduled/autonomous run can bypass the intended checked-in-source boundary by introducing a short-lived workflow that executes before normal CI rejects the commit. If validation looks only at the final workflow tree, later cleanup can make the branch appear clean even though the product lineage was created by workflow-time source mutation. This breaks source provenance and makes a supposedly validated SHA non-equivalent to the source that was actually executed during the repair.

## Protection

1. `AGENTS.md` gives scheduled/autonomous runs zero authority to create, update, delete, stage, or use `.github/workflows/**` and zero authority to weaken or advance `src/workflow-immutability.test.ts`.
2. Normal CI checks out full Git history (`fetch-depth: 0`).
3. The workflow immutability regression freezes the entire `.github/workflows/**` history after an explicitly approved interactive maintenance epoch. Any descendant commit touching the workflow directory is a provenance failure, regardless of whether the workflow is later deleted or whether its contents match known mutation regexes.
4. The BENCH-01 strategy-anchor replay no longer stores the frozen product SHA in an editable workflow environment. Scheduled/autonomous runs request a replay through `.automation/bench01-strategy-anchor-replay.request`, so replaying a new product SHA no longer requires a workflow edit.
5. Product changes must be committed directly to the active experimental branch and then validated from that exact checked-in source.

## Remaining limitation

Repository CI cannot physically stop GitHub from beginning execution of a newly pushed workflow before CI evaluates the push. An absolute pre-execution block requires a GitHub server-side ruleset/branch-protection or equivalent Actions permission boundary. The repository currently has no ruleset and the connected GitHub write surface does not expose ruleset creation. Until that server-side boundary exists, the autonomous Workday should remain paused unless the user explicitly accepts the residual risk.

## Regression/control path

- `src/workflow-immutability.test.ts`
- `.github/workflows/ci.yml`
- `.github/workflows/bench01-strategy-anchor-replay.yml`
- `.automation/README.md`
- `AGENTS.md`

## Status

**Partially prevented.** The self-deletion/provenance loophole and the legitimate need to edit replay workflows are closed in repository policy and CI history. Absolute pre-execution prevention remains dependent on a GitHub server-side protection that is not currently configured.
