# START HERE — Ultimate MTG

**Stage 1/2 complete. Justin authorized bounded Stage 3 on 29 September 2026. Recognition candidate in progress; not accepted. STOP after Stage 3 review.**

Read `project-state.json`, `AGENTS.md`, this checklist, then `docs/STAGED-RECOVERY-CONTRACT.md`. Do not treat an old “continue autonomously” instruction or a successful workflow as new permission.

## Current task

Implement only shared restricted-counterspell and land-type-search recognition. Read `docs/STAGE-3-RECOGNITION-CRITERIA.md` for the prospective claim, required evidence and recovery steps. Necessary tests, existing CI, experimental publication and affected/contrasting whole-deck review are authorized. Stage 1/2 are complete; do not repeat them. Routine work inside Stage 3 does not need repeated permission.

30 September checkpoint: first candidate `5e1163d8` passed CI `36534622262` and Batch A `36534622136`; evidence writer `e3265b1a` preserves its results. It is rejected for multi-sentence land-search false negatives; read `test-results/bench01-manual-verdicts/5e1163d8c57a92d64dcd2dec14ca0326e56636dc.md`. The second bounded attempt repairs the search/destination association and adds per-card audit evidence. Validate its exact source and review the frozen decks; do not accept candidate 1 or rerun it. Stop for design review after two unsuccessful substantive attempts.

## What is known

- Broad accepted Commander baseline: `1ef10cec8c50d3d576cb1c3ae3c2566a4f632aa7`.
- Accepted narrow compound-progress repair: `43e9c1c80dadfea4d53ed1a2affebd90131e362f`.
- Latest recorded executable benchmark source: `8606761c4d2e29cebb980bb06520b6aced459a1b`. This is not a new accepted broad baseline.
- Existing B4 trial: legal 100, 15 swaps, engine-assessed B3, protection 7/8, countermagic 6/8. Target missed.
- Existing B5 challenge: legal 100, 28 swaps, engine-assessed B3, protection 7/8. Target missed.
- Existing anonymous evidence reproduces missed restricted counterspells and Forest-search ramp. A shared recognition candidate is being implemented; no new accepted repair or target result yet.

## Allowed now

- Implement bounded Stage 3 recognition, run necessary tests and existing CI/frozen affected and contrasting controls.
- Publish directly to the active experimental branch after checking head and active writers.
- Preserve evidence and update coordinated handoff documents; report gaps honestly.

## Not allowed now

- Ranking/package expansion, conditional-ability/contextual-tutor follow-up or bracket-threshold changes outside Stage 3.
- Schedule resumption, repository permission changes or a new automation platform.
- Main/stable V0.13 changes, PR #29 merging, workflow/guard/policy-epoch changes.
- Seeding generation with the supplied or historical Tidus comparison deck.

## Current stage and next boundary

The bounded acceptance gate and baseline-transition checks passed verification and review. Stage 3 is authorized; STOP after its review. Protected maintenance and schedule resumption need separate approval. Branch-local checks cannot establish tamper-proof unattended enforcement: trusted server policy ownership and shared run ownership remain open.

## Stop immediately if

- Authority is unclear, another writer is active, or the expected branch head changed.
- Evidence is missing, mismatched or incomplete.
- The task requires relaxing a constraint or changing a protected surface.
- The agreed task is finished; report its result before starting the next stage.

## Completion report

State **ready / blocked / incomplete**, list supporting evidence, unresolved limits and the exact next approval. Separate engineering, truth, deck quality and target achievement.

Evidence inventory: `docs/STAGE-1-EVIDENCE.md`. Current implementation and limits: `docs/STAGE-2-SAFEGUARDS.md`. Historical B4/B5 summaries remain under `test-results/bench01-stage1-records/`, separate from automated-writer controls. No Commander baseline or target has advanced.
