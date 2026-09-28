# START HERE — Ultimate MTG

**Stage 1 published. Bounded Stage 2 safeguards authorized; exact-commit verification/review pending.**

Read `project-state.json`, `AGENTS.md`, this checklist, then `docs/STAGED-RECOVERY-CONTRACT.md`. Do not treat an old “continue autonomously” instruction or a successful workflow as new permission.

## Current task

Justin approved Stage 1 publication and bounded Stage 2 safeguards, necessary tests and existing CI. Stage 1 is published at `e91b8877aa4823bab03e8b5c616e535307824314`. Complete Stage 2 and stop after its review, before recognition repair. Read `docs/STAGE-2-SAFEGUARDS.md`. Routine work inside this approval does not need repeated permission.

## What is known

- Broad accepted Commander baseline: `1ef10cec8c50d3d576cb1c3ae3c2566a4f632aa7`.
- Accepted narrow compound-progress repair: `43e9c1c80dadfea4d53ed1a2affebd90131e362f`.
- Latest recorded executable benchmark source: `8606761c4d2e29cebb980bb06520b6aced459a1b`. This is not a new accepted broad baseline.
- Existing B4 trial: legal 100, 15 swaps, engine-assessed B3, protection 7/8, countermagic 6/8. Target missed.
- Existing B5 challenge: legal 100, 28 swaps, engine-assessed B3, protection 7/8. Target missed.
- Existing anonymous evidence reproduces missed restricted counterspells and Forest-search ramp. No recognition repair is implemented.

## Allowed now

- Implement bounded acceptance/state safeguards, run necessary tests and existing CI.
- Publish directly to the active experimental branch after checking head and active writers.
- Preserve evidence and update coordinated handoff documents; report gaps honestly.

## Not allowed now

- Recognition/ranking repair, fresh deck-generation benchmarks or archived reproducer execution.
- Schedule resumption, repository permission changes or a new automation platform.
- Main/stable V0.13 changes, PR #29 merging, workflow/guard/policy-epoch changes.
- Seeding generation with the supplied or historical Tidus comparison deck.

## Current stage and next boundary

Complete the bounded acceptance gate and baseline-transition checks, verify and review them, then STOP. Protected maintenance and schedule resumption need separate approval. Recognition repair needs Stage 3 approval. Branch-local checks cannot establish tamper-proof unattended enforcement: trusted server policy ownership and shared run ownership remain open.

## Stop immediately if

- Authority is unclear, another writer is active, or the expected branch head changed.
- Evidence is missing, mismatched or incomplete.
- The task requires relaxing a constraint or changing a protected surface.
- The agreed task is finished; report its result before starting the next stage.

## Completion report

State **ready / blocked / incomplete**, list supporting evidence, unresolved limits and the exact next approval. Separate engineering, truth, deck quality and target achievement.

Evidence inventory: `docs/STAGE-1-EVIDENCE.md`. Current implementation and limits: `docs/STAGE-2-SAFEGUARDS.md`. Historical B4/B5 summaries remain under `test-results/bench01-stage1-records/`, separate from automated-writer controls. No Commander baseline or target has advanced.
