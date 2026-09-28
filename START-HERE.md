# START HERE — Ultimate MTG

**Stage 1 handoff proposal. Execution is PAUSED.**

Read `project-state.json`, `AGENTS.md`, this checklist, then `docs/STAGED-RECOVERY-CONTRACT.md`. Do not treat an old “continue autonomously” instruction or a successful workflow as new permission.

## Current task

Stage 1 prepares instructions and preserves existing evidence. It does not repair the plugin or prove the proposed safeguards. This package was prepared locally against remote head `34109290ba41693d9184ec21768fa65079302409`; publication requires approval because a push may trigger existing CI.

## What is known

- Broad accepted Commander baseline: `1ef10cec8c50d3d576cb1c3ae3c2566a4f632aa7`.
- Accepted narrow compound-progress repair: `43e9c1c80dadfea4d53ed1a2affebd90131e362f`.
- Latest recorded executable benchmark source: `8606761c4d2e29cebb980bb06520b6aced459a1b`. This is not a new accepted broad baseline.
- Existing B4 trial: legal 100, 15 swaps, engine-assessed B3, protection 7/8, countermagic 6/8. Target missed.
- Existing B5 challenge: legal 100, 28 swaps, engine-assessed B3, protection 7/8. Target missed.
- Existing anonymous evidence reproduces missed restricted counterspells and Forest-search ramp. No recognition repair is implemented.

## Allowed now

- Read existing evidence and prepare/review handoff documents.
- Preserve files and record checksums without running the saved reproducer.
- Report gaps or conflicting instructions honestly.

## Not allowed now

- Tests, builds, benchmarks, reproducer execution, new CI or replay requests.
- Product-code changes, pushes or schedule resumption.
- Main/stable V0.13 changes, PR #29 merging, workflow/guard/policy-epoch changes.
- Seeding generation with the supplied or historical Tidus comparison deck.

## Next stage, only after explicit approval

Implement the bounded acceptance gate and baseline-transition checks described in `docs/STAGED-RECOVERY-CONTRACT.md`, then perform the specifically authorized verification. Keep protected maintenance and schedule resumption separately authorized. The first product repair afterwards is shared counterspell/land-search recognition.

## Stop immediately if

- Authority is unclear, another writer is active, or the expected branch head changed.
- Evidence is missing, mismatched or incomplete.
- The task requires relaxing a constraint or changing a protected surface.
- The agreed task is finished; report its result before starting the next stage.

## Completion report

State **ready / blocked / incomplete**, list supporting evidence, unresolved limits and the exact next approval. Separate engineering, truth, deck quality and target achievement.

Evidence inventory and recovery locations: `docs/STAGE-1-EVIDENCE.md`. Detailed current findings: `docs/COUNTER-BLITZ-RECOVERY-STATUS.md`. These instructions are procedural; the proposed new acceptance controls are not yet implemented.
