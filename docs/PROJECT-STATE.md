<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project State

Generated from `project-state.json`. Last state update: **2026-08-21T21:15:00+12:00**.

## Current mode

- Repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`
- Active experimental branch: `agent/v15-native-deck-intelligence`
- Active PR: #29
- Active milestone: **PM-01**
- Intelligence development paused: **yes**
- Reason: Build persistent repo-backed project memory, generated handoffs, validation tracking, and decision history before resuming intelligence development.

## Stable boundary

- Branch: `main`
- Version: `0.13.0`
- `server-current`: V0.13
- Stable promotion authorized: **no**

## Experimental checkpoints

Development checkpoint at pause: `303a474e4a1ec8cb80c9dc5babaafe42c1828472`

Intelligence development paused while PM-01 project-management infrastructure is built. Always inspect the live branch head before editing; this SHA is the pause checkpoint, not a claim that later documentation commits are source-validation milestones.

Latest fully validated executable experimental baseline recorded by project state:

- Branch: `agent/package-probabilities`
- SHA: `63bb7274004060eea507f7991a04b84921d0cd47`
- Scope: Latest fully validated executable experimental baseline documented by the prior authoritative handoff. Later V0.15 deck-intelligence work on PR #29 remains experimental until its own controls complete.

Always inspect the live active-branch head before editing. A later documentation/project-management commit is not automatically a new executable validation milestone.

## Milestones

| ID | Milestone | Status | Goal |
|---|---|---|---|
| PM-01 | Persistent Project State & Handoff Automation | active | Make repository state authoritative so a fresh chat can recover exact project context with minimal rechecking. |
| INTEL-01 | Win-package intelligence | paused-validation-pending | Very-good verified full-table win-package discovery, feasibility, injection, and protection. |
| INTEL-02 | Actual autonomous deck improvement | paused-validation-pending | Very-good target-aware autonomous refinement that repairs real deck weaknesses rather than cosmetic metrics. |
| BENCH-01 | Adversarial Commander benchmark suite | planned | Prove deck-building quality across combo, combat, control, aristocrats, typal, budget, theme-restricted, cEDH-ish, and hybrid decks. |
| INTEL-03 | Human-level strategic reasoning layer | planned | Model commander role, synergy networks, structural-card importance, cut consequences, primary/secondary plans, and coherent package trade-offs. |
| INTEL-04 | Counterfactual deck comparison & expert explanation | planned | Compare complete 100-card alternatives and explain why one deck state is stronger under the exact requested constraints. |

## Current validation status

- Active branch status: **incomplete**
- Last persisted Marvel control source: `a4a1450d34c337c97b76fbbec688dbcf0ac7388e`
- Last persisted Marvel control outcome: **skipped**
- Note: This is stale pre-hardening metadata and must not be used as proof of the current branch.

Required before resuming broad INTEL-01/INTEL-02 claims:

- Build and unit/regression suite pass on checked-in source
- Fresh Marvel Bracket 5 control executes on the post-hardening lineage
- Accepted deck changes repair or measurably advance actual failed target gates
- Verified full-table win-route claims independently agree with final evaluation
- Commander legality, exact 100 cards, printing-family/set restrictions, budgets, and meaningful deck strategy remain intact

## Next actions

1. Complete PM-01 authoritative project-state files and generated handoff tooling.
2. Add project-state validation to CI so stale handoffs fail fast.
3. Record permanent architecture decisions and known failure regressions.
4. Build a validation matrix mapping every control to the claim it proves.
5. After PM-01 is validated, resume INTEL-01/INTEL-02 from the pause checkpoint and run the fresh Marvel control before further feature work.

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
3. `ULTIMATE_MTG_SPEC.md`
4. `docs/ROADMAP.md`
5. `docs/DECISIONS.md`
6. `docs/VALIDATION-MATRIX.md`
7. `docs/KNOWN-FAILURES.md`

Then: Inspect the live active-branch head, PR state, and validation outputs. Continue only from the active milestone and nextActions.
