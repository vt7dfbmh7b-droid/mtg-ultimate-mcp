<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project State

Generated from `project-state.json`. Last state update: **2026-08-21T21:36:00+12:00**.

## Current mode

- Repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`
- Active experimental branch: `agent/v15-native-deck-intelligence`
- Active PR: #29
- Active milestone: **INTEL-02**
- Intelligence development paused: **no**
- Reason: Resume target-aware autonomous refinement at the exact pre-PM blocker: finish the zero-target-progress guard, then run the fresh checked-in-source Marvel Bracket 5 control before adding further intelligence features.

## Stable boundary

- Branch: `main`
- Version: `0.13.0`
- `server-current`: V0.13
- Stable promotion authorized: **no**

## Experimental checkpoints

Development checkpoint at pause: `303a474e4a1ec8cb80c9dc5babaafe42c1828472`

PM-01 and PM-02 are validated and Commander intelligence development has resumed from the deck-intelligence pause checkpoint. Later project-management/result commits do not replace this checkpoint as an executable deck-intelligence validation claim.

Latest fully validated executable experimental baseline recorded by project state:

- Branch: `agent/package-probabilities`
- SHA: `63bb7274004060eea507f7991a04b84921d0cd47`
- Scope: Latest fully validated executable experimental baseline documented by the prior authoritative handoff. Later V0.15 deck-intelligence work on PR #29 remains experimental until its own controls complete.

Always inspect the live active-branch head before editing. A later documentation/project-management commit is not automatically a new executable validation milestone.

## Milestones

| ID | Milestone | Status | Goal |
|---|---|---|---|
| PM-01 | Persistent Project State & Handoff Automation | validated | Make repository state authoritative so a fresh chat can recover exact project context with minimal rechecking. |
| PM-02 | Validation State Indexing | validated | Consolidate key persisted control metadata into one deterministic validation index so fresh chats can identify current, stale, passing and failing evidence immediately. |
| INTEL-01 | Win-package intelligence | implemented-validation-pending | Very-good verified full-table win-package discovery, feasibility, injection, and protection. |
| INTEL-02 | Actual autonomous deck improvement | active | Very-good target-aware autonomous refinement that repairs real deck weaknesses rather than cosmetic metrics. |
| BENCH-01 | Adversarial Commander benchmark suite | planned | Prove deck-building quality across combo, combat, control, aristocrats, typal, budget, theme-restricted, cEDH-ish, and hybrid decks. |
| INTEL-03 | Human-level strategic reasoning layer | planned | Model commander role, synergy networks, structural-card importance, cut consequences, primary/secondary plans, and coherent package trade-offs. |
| INTEL-04 | Counterfactual deck comparison & expert explanation | planned | Compare complete 100-card alternatives and explain why one deck state is stronger under the exact requested constraints. |

## Current validation status

- Active branch status: **incomplete**
- Last persisted Marvel control source: `a4a1450d34c337c97b76fbbec688dbcf0ac7388e`
- Last persisted Marvel control outcome: **skipped**
- Note: This is stale pre-hardening metadata and must not be used as proof of the current branch. The validation index independently marks it as failing and not matching the development checkpoint.

Required before resuming broad INTEL-01/INTEL-02 claims:

- Build and unit/regression suite pass on checked-in source
- Fresh Marvel Bracket 5 control executes on the post-hardening lineage
- Accepted deck changes repair or measurably advance actual failed target gates
- Verified full-table win-route claims independently agree with final evaluation
- Commander legality, exact 100 cards, printing-family/set restrictions, budgets, and meaningful deck strategy remain intact

## Next actions

1. Inspect the current checked-in INTEL-02 scorer/builder against the deck-intelligence pause checkpoint and confirm the hard zero-target-progress guard is still the next unresolved source change.
2. Implement the hard Bracket-5 zero-target-progress rejection with direct shared-scorer and iterative-refinement regressions, without weakening lower-bracket behavior.
3. Run project-management integrity, TypeScript/build, autonomous-refinement regressions and win-package regressions on checked-in source.
4. Run the fresh checked-in-source Marvel Bracket 5 refinement control and persist its exact tested source SHA plus before/after target-gate and verified full-table route evidence.
5. Use validation-index.json to decide whether INTEL-01/INTEL-02 can move to validated or whether the next blocker is discovery, injection, recognition or candidate selection; do not add unrelated features first.

## Permanent truth boundary

- Commander legality, exact card count, singleton and color identity outrank optimization scores.
- Exact physical-printing existence/restrictions and hard budgets are fail-closed truths.
- Provider unavailable is not evidence of absence.
- A generic infinite-damage statement is not a verified multiplayer full-table win unless opponent scope is proven.
- Pipeline execution is not proof of intelligent deck improvement.
- No merge, stable/current promotion, version bump, or release without explicit user approval.

## Fresh-chat recovery

Read in this order:

1. `project-state.json`
2. `docs/PROJECT-STATE.md`
3. `validation-index.json`
4. `docs/VALIDATION-STATE.md`
5. `ULTIMATE_MTG_SPEC.md`
6. `docs/ROADMAP.md`
7. `docs/DECISIONS.md`
8. `docs/VALIDATION-MATRIX.md`
9. `docs/KNOWN-FAILURES.md`

Then: Inspect the live active-branch head and PR state. Use the validation index to decide which persisted controls are current or stale, then continue only from the active milestone and nextActions.
