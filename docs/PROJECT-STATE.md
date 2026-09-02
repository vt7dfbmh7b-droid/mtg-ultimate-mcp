<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project State

Generated from `project-state.json`. Last state update: **2026-09-02T07:42:00Z**.

## Current mode

- Repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`
- Active experimental branch: `agent/v15-native-deck-intelligence`
- Active PR: #29
- Active milestone: **INTEL-02**
- Intelligence development paused: **no**
- Reason: INTEL-02 remains active, but the immediate task is consolidation and exact-source proof rather than adding new intelligence features. The latest registered scenario batch at b9ab88d... is mixed: Middle-earth, Necron, Squirreled Away and generic strategy inference passed their registered gates, while focused and broad Marvel failed. Subsequent fixes through executable source be72204... address graveyard directionality/actionable recursion, board-wipe preservation and token-copy/token-conversion multiplier truth, while KF-031 through KF-044 record further local/deterministic repairs for secondary-plan inference, strategy-support density, premium early infrastructure, go-wide card advantage and token-copy engine protection. Those newer repairs require one common exact-source revalidation and manual swap audit before any new INTEL-02 checkpoint is accepted.

## Stable boundary

- Branch: `main`
- Version: `0.13.0`
- `server-current`: V0.13
- Stable promotion authorized: **no**

## Experimental checkpoints

Development checkpoint at pause: `77a5383fa7490aa91360b8186a4bda890f632157`

Accepted INTEL-02 checkpoint remains 77a5383... because it is the last source explicitly accepted after exact-source testing and manual review. Focused Marvel and Food and Fellowship supplied useful restricted/precon evidence there, while broad Marvel remained red. Newer persisted controls at b9ab88d... are historical evidence only: Necron Dynasties, Squirreled Away, Middle-earth and generic strategy inference mechanically passed, but both Marvel lanes failed and later semantic/structural fixes changed executable behavior. Executable source was last changed at be72204... before this documentation-only state refresh; KF-044 records and fixes token-copy and token-conversion multiplier false negatives, but no exact-source CI/control batch is attached to the current source, so neither b9ab88d... nor be72204... is promoted to accepted checkpoint status.

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

- Active branch status: **accepted-checkpoint-77a-newer-evidence-stale-current-executable-revalidation-required**
- Last persisted Marvel control source: `b9ab88d3d56caa7d6744cc78e002dc17dfa8bac4`
- Last persisted Marvel control outcome: **focused-fail-broad-fail**
- Note: The latest registered Marvel batch is exact-source b9ab88d... and both lanes are red. Focused Marvel executed but failed its target-gate quality outcome. Broad Marvel executed but failed target quality and strategy preservation. Later fixes landed after this batch, so these failures are valuable regression evidence but are not a current-head verdict.

Required before resuming broad INTEL-01/INTEL-02 claims:

- Run one exact-source validation batch on the current executable candidate (be72204... plus documentation-only descendants) covering project integrity, deterministic tests, generic strategy inference, Necron Dynasties, Squirreled Away, Food and Fellowship, focused Marvel, broad Marvel and Middle-earth printing-family controls
- Manually audit every accepted IN→OUT package from that same source; mechanical green is not sufficient, especially for Necron, Squirreled Away, Food and Fellowship and both Marvel lanes
- Require focused Marvel and broad Marvel to pass target-quality and strategy-preservation gates on the same exact executable source before calling the restricted lane uniformly green
- Keep graveyard directionality/actionable recursion, explicit artifact engines, self-sacrifice versus repeatable outlets, secondary-plan inference, strategy-support density, premium early infrastructure, board wipes, token-death engines and board-scaling payoffs fail-closed
- Run a positive eligible verified full-table package scenario so INTEL-01 discovery, feasibility, atomic injection, protection and independent final recognition are proven end to end
- Commander legality, exact 100 cards, singleton/color identity, printing-family/set restrictions and hard budgets must remain intact in every expanded control

## Next actions

1. Exact-source validate the current executable candidate across the complete registered INTEL-02 control family and normal deterministic/project-integrity checks; do not accept a new checkpoint from partial or mixed-source evidence.
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

Then: Inspect the live active-branch head and PR state. Treat 77a5383... as the accepted INTEL-02 checkpoint, b9ab88d... as the latest registered historical scenario batch, and executable source be72204... (plus documentation-only descendants) as unvalidated until one exact-source control family and manual audit are complete. Continue only from the active milestone and nextActions.
