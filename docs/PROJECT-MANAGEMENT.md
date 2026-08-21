# Ultimate MTG Project Management Protocol

This protocol exists to make long-term development independent of any single chat window.

## Authority order

When recovering the project, use this order:

1. `project-state.json` — machine-readable current-state authority.
2. `docs/PROJECT-STATE.md` — generated human snapshot.
3. `validation-index.json` — consolidated machine-readable status of registered high-value controls.
4. `docs/VALIDATION-STATE.md` — generated human validation snapshot.
5. live GitHub branch/PR/workflow state — confirms anything that may have changed after the snapshots.
6. `ULTIMATE_MTG_SPEC.md` — north-star system principles.
7. `docs/ROADMAP.md` — milestone sequence and exit criteria.
8. `docs/DECISIONS.md` — permanent architecture decisions.
9. `docs/VALIDATION-MATRIX.md` — what each control actually proves.
10. `docs/KNOWN-FAILURES.md` — failure modes that must remain prevented.
11. historical implementation docs and chat history — supporting context only.

`PROJECT_HANDOFF.md` remains the compatibility entry point but is generated from project state. It should never become an independently maintained second truth source again.

## Fresh-chat startup contract

A new development chat should perform only this recovery work before editing:

1. read `project-state.json` and `docs/PROJECT-STATE.md`;
2. read `validation-index.json` / `docs/VALIDATION-STATE.md` to identify current, stale, passing and failing registered evidence;
3. inspect the live head of `experimental.activeBranch` and its active PR;
4. inspect individual validation artifacts only when the index says they are relevant, ambiguous or stale;
5. read any `D-*` decisions and `KF-*` failures referenced by the active milestone;
6. continue from `nextActions`.

Do not re-audit the whole repository unless state integrity fails or a next action explicitly requires it.

For a deterministic repo-only recovery summary, run:

```bash
npm run project:resume
```

This command derives stable boundary, active milestone, pause/resume state, development checkpoint, registered passing/failing/stale evidence and next actions without reading chat history.

## Milestone IDs

Work is grouped into stable IDs (`PM-*`, `INTEL-*`, `BENCH-*`).

Every substantial commit should ideally mention the active milestone, for example:
- `feat(INTEL-03): add structural-card dependency graph`
- `test(BENCH-01): add aristocrats cut-quality adversary`
- `chore(PM-02): sync validation index`

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

Documentation-only or project-management commits after a validated deck-intelligence source do not create a new executable deck-intelligence validation claim.

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

Because the validation index records the project-state update timestamp/checkpoint, rebuild `validation-index.json` and `docs/VALIDATION-STATE.md` after a material project-state change.

## Validation registry/index rule

`validation-registry.json` contains only high-value controls needed to recover current milestone truth. It is not intended to list every GitHub workflow.

Each registered control must declare:
- stable control ID;
- claim level;
- milestone relevance;
- persisted metadata path;
- candidate source-SHA keys;
- explicit pass conditions.

`validation-index.json` is generated deterministically from:
- `validation-registry.json`;
- persisted `test-results/**` metadata;
- `project-state.json`.

It records whether the control metadata exists, pass/fail/unknown status, exact tested source SHA where available, and whether that SHA matches the current development checkpoint.

A pass from another SHA is historical evidence, not proof of the current checkpoint.

A workflow that changes registered persisted metadata must regenerate the validation index in the same logical result commit so successful validation cannot make the index stale.

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

PM-01 passed its initial self-reporting integrity control at source `73366cf57c055fc0ae7831209ad155b360bf036f`.

## PM-02 exit test

PM-02 is complete when the same fresh-chat recovery can also identify, without browsing individual result folders:
- which registered controls pass/fail/are unknown;
- exact tested source SHA for each available result;
- whether each result matches the current development checkpoint;
- which evidence is only historical/stale;
- which scenario-intelligence result blocks the next milestone.

The validation index and its generated human snapshot must be strict-CI checked and self-consistent after self-reporting workflow updates.

PM-02 passed at source `b920087e41d22a1575404620815c4882801cae9b`: project-management typecheck, generated-state validation, validation-index validation, fresh-session recovery smoke and normal MTG source build all succeeded, and the result was persisted together with the regenerated validation index.

After PM-02 validation, normal Commander-intelligence development may resume only from the active milestone recorded in `project-state.json`; the management layer does not itself authorize stable promotion.
