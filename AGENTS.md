# Ultimate MTG Autonomous Agent Guardrails

This file supplements the repository's authoritative project state and the autonomous-run directive. It must not replace, weaken, reorder, collapse, or discard any existing benchmark, validation, truth-boundary, merge, promotion, or checkpoint rule.

## Hard workflow authority boundary

Scheduled and autonomous runs are **not authorized to create, update, delete, stage, or use any file under `.github/workflows/`**. That directory may only be changed during an explicit interactive user-requested repository maintenance action. Autonomous BENCH/product work must use direct repository file edits for product source and then let already-checked-in validation/replay workflows execute the exact committed tree.

Scheduled and autonomous runs are also **not authorized to modify `src/workflow-immutability.test.ts`, advance its `workflowPolicyEpochSha`, or weaken the full-history workflow freeze**. Those controls are part of the repository-maintenance boundary, not ordinary BENCH/product code.

If direct repository write capability is unavailable or a required operation cannot be completed with the currently available tools, record the blocker and stop that operation. Never bootstrap, patch, reconcile, or continue the work by creating a temporary GitHub Actions workflow. Execution limits or missing write tools do not create an exception to this rule.

For the existing five-fixture BENCH-01 strategy-anchor replay, request a frozen replay by creating or updating `.automation/bench01-strategy-anchor-replay.request` with exactly one 40-character validated product commit SHA. **Do not edit the replay workflow or its environment to change the frozen SHA.** The checked-in workflow resolves the request file, proves `src/**` is identical to that product SHA, then runs and persists the replay evidence.

## Single-flight autonomous execution

Before starting any branch-changing validation, replay request, evidence persistence, state reconciliation, or Commander product repair, inspect current/recent GitHub Actions and branch state for the active experimental branch.

If a relevant validation, BENCH replay, project-state integrity writer, or other branch-writing operation is still in progress, do **not** start another overlapping branch-changing operation. Prefer read-only analysis, manual deck review of already-persisted evidence, or simply resume after the active operation has completed on a later scheduled invocation.

A scheduled hourly invocation is a recovery opportunity, not permission to create overlapping work. Never trade branch consistency for activity.

## Durable manual-verdict boundary

Generated replay output under `test-results/bench01-strategy-anchor-replay/` may be replaced by later frozen replays. Manual acceptance/rejection evidence must therefore be persisted outside that replaceable generated-output directory.

Use `test-results/bench01-manual-verdicts/<product-sha>.md` for BENCH-01 manual whole-deck verdicts. Each verdict should identify the exact frozen product SHA, replay evidence, fixture-level conclusions, cross-fixture diagnosis, accept/reject decision, and next justified action. Do not treat a replay-generated directory as the only durable location of human/manual quality evidence.

## State reconciliation coordination

When `project-state.json` materially changes, keep `PROJECT_HANDOFF.md`, `docs/PROJECT-STATE.md`, `validation-index.json`, and `docs/VALIDATION-STATE.md` synchronized as one reconciliation package wherever the available GitHub tooling permits.

Do not intentionally leave a stale validation index or generated recovery surface behind merely because a state edit was completed first. If the repository's approved Project State Integrity writer must finalize self-consistent metadata, allow that existing writer to complete, re-read the resulting branch head, and only then begin a new branch-changing product/benchmark operation.

An intermediate CI failure caused solely by the state writer racing a still-stale generated validation index is a state-coordination/harness issue, not a Commander-product failure. It must not be "fixed" by weakening `validation:validate`, skipping project-state checks, or bypassing the approved integrity writer.

For every scheduled or autonomous development run:

1. Read `project-state.json` first and follow its recovery/handoff protocol before making development decisions.
2. Read this `AGENTS.md` before performing repository writes or changing validation/replay execution.
3. Treat validation as immutable execution of checked-in source and checked-in state.
4. Never create, commit, or use a temporary, one-shot, self-editing, or self-deleting GitHub Actions workflow to reconcile repository state, checkpoint progress, modify documentation, prepare validation, patch source, or work around execution limits.
5. Never patch or rewrite checked-in TypeScript, scripts, `project-state.json`, roadmap/handoff files, validation records, or other repository files from inside a validation workflow to prepare the source being validated.
6. When repository files need to change, edit them directly on the authorized active experimental branch, commit them normally, and validate that checked-in commit. Existing approved evidence-writer workflows may persist evidence only within the repository-integrity rules already enforced by tests.
7. Before adding or changing any workflow during an explicit interactive repository-maintenance action, inspect the repository-integrity tests and the relevant entries in `docs/KNOWN-FAILURES.md`, especially the protections against workflow-time mutation and source/validation SHA mismatch.
8. Classify a CI failure caused by a transient or self-editing workflow as a harness/automation failure, not a Commander-product failure. Remove the transient mechanism, preserve legitimate evidence, revalidate the clean checked-in tree, then return to the highest-value BENCH-01 Commander work.
9. Do not invent workflow activity, documentation churn, or reconciliation work merely to create a checkpoint. GitHub commits and persisted benchmark evidence are the durable checkpoint between scheduled invocations.
10. A later clean tree does not erase workflow provenance. The normal CI history guard must remain green from its policy epoch; **any** workflow-directory change after that epoch is a durable provenance failure until explicitly reviewed and reconciled by an interactive maintenance action.

When this file conflicts with newer explicit user authority or newer authoritative `project-state.json` evidence, follow the newer authority while preserving all safety and validation gates that remain applicable.
