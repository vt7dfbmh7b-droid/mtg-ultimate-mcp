# Ultimate MTG Project Management Protocol

This protocol exists to make long-term development independent of any single chat window.

## Authority order

When recovering the project, use this order:

1. `project-state.json` — machine-readable current-state authority.
2. `docs/PROJECT-STATE.md` — generated human snapshot.
3. live GitHub branch/PR/workflow state — confirms anything that may have changed after the snapshot.
4. `ULTIMATE_MTG_SPEC.md` — north-star system principles.
5. `docs/ROADMAP.md` — milestone sequence and exit criteria.
6. `docs/DECISIONS.md` — permanent architecture decisions.
7. `docs/VALIDATION-MATRIX.md` — what each control actually proves.
8. `docs/KNOWN-FAILURES.md` — failure modes that must remain prevented.
9. historical implementation docs and chat history — supporting context only.

`PROJECT_HANDOFF.md` remains the compatibility entry point but is generated from project state. It should never become an independently maintained second truth source again.

## Fresh-chat startup contract

A new development chat should perform only this recovery work before editing:

1. read `project-state.json` and `docs/PROJECT-STATE.md`;
2. inspect the live head of `experimental.activeBranch` and its active PR;
3. check only validation artifacts relevant to the active milestone;
4. read any `D-*` decisions and `KF-*` failures referenced by that milestone;
5. continue from `nextActions`.

Do not re-audit the whole repository unless state integrity fails or a next action explicitly requires it.

## Milestone IDs

Work is grouped into stable IDs (`PM-*`, `INTEL-*`, `BENCH-*`).

Every substantial commit should ideally mention the active milestone, for example:
- `feat(INTEL-03): add structural-card dependency graph`
- `test(BENCH-01): add aristocrats cut-quality adversary`
- `chore(PM-01): sync generated project handoff`

A milestone can be:
- `planned`;
- `active`;
- `paused` or `paused-validation-pending`;
- `blocked`;
- `implemented-validation-pending`;
- `validated`;
- `superseded`.

Only one milestone should normally be `active` unless there is a deliberate parallel workstream.

## Checkpoints vs validation milestones

Never use one SHA field for both.

A **development checkpoint** says where work paused or where the current implementation lineage was observed.

A **validated milestone SHA** says a specific source revision passed a defined validation matrix.

Documentation-only commits after a validated source do not create a new executable validation claim.

## State update rule

Update `project-state.json` when any of these materially changes:
- active milestone;
- active branch/PR;
- pause/resume state;
- validated SHA or validation status;
- blocker;
- next actions;
- stable boundary;
- a significant known failure or architectural decision.

After changing machine state, run the generator and commit the generated `docs/PROJECT-STATE.md` and `PROJECT_HANDOFF.md` in the same logical change.

## Validation result rule

A workflow may update project state only when it can bind:
- exact tested source SHA;
- exact control name;
- outcome;
- claim level;
- required deck/truth metrics for that control.

A stale artifact whose source SHA does not match the intended lineage is not current validation.

## Decision rule

Add a `D-*` entry when reversing the choice later would require rediscovering non-obvious reasoning or could reintroduce a known correctness failure.

Do not turn ordinary implementation details into decisions.

## Known-failure rule

Add a `KF-*` entry for any material observed or strongly demonstrated failure mode that can make a deck result wrong, misleading or strategically poor.

Fixed failures remain documented so future refactors know why the regression exists.

## Handoff size rule

The generated handoff should be short enough to read at the start of every chat. Detailed rationale lives in the roadmap/decisions/failures/matrix, not in the handoff itself.

## Stable safety rule

Project-management automation has no authority to:
- merge a PR;
- promote experimental runtime to `main`;
- change `src/server-current.ts` away from V0.13;
- bump stable version;
- create a release.

Those actions always require explicit user approval.

## PM-01 exit test

PM-01 is complete when a fresh chat can receive only `Continue Ultimate MTG`, read the project-management files plus live head, and accurately state:
- where development is paused/active;
- stable boundary;
- latest validated executable baseline;
- current experimental checkpoint;
- active milestone;
- unresolved validation/blockers;
- next actions;
without reconstructing previous chats.
