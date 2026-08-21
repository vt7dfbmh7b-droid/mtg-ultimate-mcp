<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project State

Generated from `project-state.json`. Last state update: **2026-08-21T22:10:11+12:00**.

## Current mode

- Repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`
- Active experimental branch: `agent/v15-native-deck-intelligence`
- Active PR: #29
- Active milestone: **INTEL-02**
- Intelligence development paused: **no**
- Reason: The hard Bracket-5 zero-target-progress guard is implemented and live-proven. Continue INTEL-02 at the now-observed candidate-generation/selection blocker: the Marvel control generated five candidates, accepted none, and retained the original deck because no package repaired or advanced average mana value or the missing verified win route.

## Stable boundary

- Branch: `main`
- Version: `0.13.0`
- `server-current`: V0.13
- Stable promotion authorized: **no**

## Experimental checkpoints

Development checkpoint at pause: `e11826caa0c758c3c637828e71e8782ade8a8532`

Exact checked-in INTEL-02 source with the explicit Bracket-5 zero-target-progress rejection and persisted per-candidate diagnostics. TypeScript/project integrity, 751 deterministic tests, focused regressions and exact-head CI passed. The Marvel control executed successfully but failed scenario intelligence because every candidate made zero target progress; this checkpoint is executable and current, not a validated intelligence milestone. Later result or documentation commits do not replace this tested source SHA.

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
- Last persisted Marvel control source: `e11826caa0c758c3c637828e71e8782ade8a8532`
- Last persisted Marvel control outcome: **failure**
- Note: Current checked-in-source control: execution succeeded, the hard guard rejected the old Aurelia -> The Masters of Evil cosmetic tutor swap, and target-quality correctly failed because the deck stayed unchanged. Candidate diagnostics show five final one-swap comparisons: one positive-scoring tutor-only package rejected for zero target progress and four no-supported-swap results. The current blocker is target-aware candidate generation/selection, not guard enforcement.

Required before resuming broad INTEL-01/INTEL-02 claims:

- Build and unit/regression suite pass on checked-in source
- Fresh Marvel Bracket 5 control executes on the post-hardening lineage
- Accepted deck changes repair or measurably advance actual failed target gates
- Verified full-table win-route claims independently agree with final evaluation
- Commander legality, exact 100 cards, printing-family/set restrictions, budgets, and meaningful deck strategy remain intact

## Next actions

1. Inspect the persisted e11826c candidate comparisons and the V0.7/V0.12 plan provenance to distinguish two observed paths: the surviving tutor-only package ignores already-passing real tutor pressure, while the other candidates produce no supported swaps.
2. Make Bracket-5 candidate generation prioritize currently failed authoritative gates before aspirational role deficits: first average-nonland-mv progress or a verified full-table package, without weakening lower-bracket behavior or the zero-progress rejection.
3. Persist win-package discovery/injection provenance and candidate comparisons across every attempted swap size, not only the final one-swap fallback, so completed absence, provider unavailability and selection failure remain distinguishable.
4. Add deterministic regressions for the diagnosed generation/selection root cause, then rerun project integrity, TypeScript/build, the full regression suite and exact-head CI.
5. Rerun the checked-in-source Marvel Bracket 5 control and require a legal constrained deck that repairs or measurably advances a failed gate; keep INTEL-01/INTEL-02 unvalidated if it again returns honest no-supported-improvement.

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
