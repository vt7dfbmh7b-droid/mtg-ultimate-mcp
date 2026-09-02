<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project State

Generated from `project-state.json`. Last state update: **2026-09-02T09:10:27Z**.

## Current mode

- Repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`
- Active experimental branch: `agent/v15-native-deck-intelligence`
- Active PR: #29
- Active milestone: **INTEL-02**
- Intelligence development paused: **no**
- Reason: INTEL-02 remains active, but the immediate task is exact-source proof after structural consolidation rather than new intelligence breadth. Cleanup source c543502... passes all three strict TypeScript projects and 924/924 deterministic tests locally. Audit-triggered source 974f0f6... passed pinned CI, project integrity and four registered scenario lanes, but broad Marvel remains red and focused Marvel was not retriggered. The latest writer-reconciliation fix at c543502... also requires pinned CI and affected live-workflow proof before any checkpoint decision.

## Stable boundary

- Branch: `main`
- Version: `0.13.0`
- `server-current`: V0.13
- Stable promotion authorized: **no**

## Experimental checkpoints

Development checkpoint at pause: `77a5383fa7490aa91360b8186a4bda890f632157`

Accepted INTEL-02 checkpoint remains 77a5383... because it is the last source explicitly accepted after exact-source testing and manual review. The latest audit-triggered exact-source evidence at 974f0f6... passes pinned CI, project integrity, generic strategy inference, Food and Fellowship, Necron Dynasties and Squirreled Away; broad Marvel still fails target quality and strategy preservation, while focused Marvel's latest pass remains ec4f4d1.... The 2026-09-02 cleanup now extends through c543502..., which removes self-mutating validation paths, compiles every automation script and gives every evidence writer bounded latest-head reconciliation. It is not promoted to accepted checkpoint status.

Latest fully validated executable experimental baseline recorded by project state:

- Branch: `agent/package-probabilities`
- SHA: `63bb7274004060eea507f7991a04b84921d0cd47`
- Scope: Latest fully validated executable experimental baseline documented by the prior authoritative handoff. Later V0.15 deck-intelligence work on PR #29 remains experimental until milestone controls complete.

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

- Active branch status: **accepted-checkpoint-77a-audit-cleanup-c543-mixed-live-validation**
- Last persisted Marvel control source: `974f0f67c23ec4768f4ccc5ec9f3a2867b6d2f5f`
- Last persisted Marvel control outcome: **focused-pass-broad-fail**
- Note: Broad Marvel at audit-triggered source 974f0f6... built and refined but accepted no supported package, so target-quality and strategy-preservation outcomes failed. Focused Marvel was not triggered by the structural cleanup; its latest passing evidence remains ec4f4d1.... Broad Marvel therefore remains blocking evidence for a common-source checkpoint.

Required before resuming broad INTEL-01/INTEL-02 claims:

- Complete pinned CI and affected evidence-writer controls for cleanup source c543502... plus documentation-only descendants, then run focused Marvel so every required lane has one common-source verdict
- Manually audit every accepted IN→OUT package from that same source; mechanical green is not sufficient, especially for Necron, Squirreled Away, Food and Fellowship and both Marvel lanes
- Require focused Marvel and broad Marvel to pass target-quality and strategy-preservation gates on the same exact executable source before calling the restricted lane uniformly green
- Keep graveyard directionality/actionable recursion, explicit artifact engines, self-sacrifice versus repeatable outlets, secondary-plan inference, strategy-support density, premium early infrastructure, board wipes, token-death engines and board-scaling payoffs fail-closed
- Run a positive eligible verified full-table package scenario so INTEL-01 discovery, feasibility, atomic injection, protection and independent final recognition are proven end to end
- Commander legality, exact 100 cards, singleton/color identity, printing-family/set restrictions and hard budgets must remain intact in every expanded control

## Next actions

1. Complete pinned CI and affected evidence-writer controls for cleanup candidate c543502... plus documentation-only descendants, then run focused Marvel so every required lane has one common-source verdict.
2. Manually audit every accepted swap from Necron Dynasties, Squirreled Away, Food and Fellowship, focused Marvel and broad Marvel. Reject any package that weakens a primary/secondary engine, meaningful wipe/interaction infrastructure, premium early mana, recursion, token-death/card-advantage engines or persistent colored mana merely to satisfy generic role counts.
3. If any control or manual audit fails, fix the generic semantic/selection rule rather than adding name-specific exceptions, then rerun the whole affected family from one exact executable source.
4. When the full INTEL-02 family is mechanically green and manually acceptable, update project-state.json and validation-index.json together and record that exact executable SHA as the new accepted development checkpoint.
5. Then run an eligible verified full-table win-package scenario to close the main INTEL-01 proof gap.
6. Only after the consolidated checkpoint and positive INTEL-01 proof should BENCH-01 broaden to materially different cases such as FF-only Counter Blitz and the NZ$500 Liliana, Heretical Healer challenge.
7. Keep PR #29 as experimental/evidence history. Do not merge or promote it automatically; when V0.15 is genuinely accepted, prepare a clean promotion candidate rather than treating the current 1,000+ commit evidence branch as release-ready.

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
6. `docs/COMMANDER-SPECIALIST-OBJECTIVE.md`
7. `docs/ROADMAP.md`
8. `docs/DECISIONS.md`
9. `docs/VALIDATION-MATRIX.md`
10. `docs/KNOWN-FAILURES.md`

Then: Inspect the live active-branch head and PR state. Treat 77a5383... as the accepted INTEL-02 checkpoint. Audit-triggered source 974f0f6... passes CI, project integrity, Food and Fellowship, Necron, Squirrels and generic inference but fails broad Marvel; focused Marvel's latest pass remains ec4f4d1.... Treat writer-reconciliation source c543502... plus documentation-only descendants as the current candidate and continue only from nextActions.
