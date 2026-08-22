<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project State

Generated from `project-state.json`. Last state update: **2026-08-22T03:57:49Z**.

## Current mode

- Repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`
- Active experimental branch: `agent/v15-native-deck-intelligence`
- Active PR: #29
- Active milestone: **INTEL-02**
- Intelligence development paused: **no**
- Reason: INTEL-02 remains active. Restricted focused Marvel and Food and Fellowship have accepted scenario evidence, while broad Marvel is still red. Manual audit rejected the nominal Necron and Squirreled Away greens: generic artifact/graveyard labels concealed cuts to real graveyard engines, and aggregate combat-token retention concealed cuts to Chatterfang, Squirrel Sovereign, Beastmaster Ascension and other core payoffs. Repair and exact-source revalidation must finish before conditions broaden further. INTEL-01 still lacks a positive eligible verified full-table route control.

## Stable boundary

- Branch: `main`
- Version: `0.13.0`
- `server-current`: V0.13
- Stable promotion authorized: **no**

## Experimental checkpoints

Development checkpoint at pause: `77a5383fa7490aa91360b8186a4bda890f632157`

Last accepted exact-source INTEL-02 checkpoint before the unrestricted precon false-greens. TypeScript and 785 deterministic tests passed; project integrity, focused Marvel, Food and Fellowship, and expanded Middle-earth controls passed. Focused Marvel made a legal two-swap curve repair, Food and Fellowship made four supported swaps while preserving identity and structural floors, and expanded Middle-earth honestly refused unsupported change. The broad Marvel control at this same source failed its target-quality and strategy-preservation gates, so restricted-theme validation is not yet uniformly green. Later Necron and Squirreled Away workflow exits are retained as regression evidence but are not accepted intelligence passes because manual swap audit found semantic engine loss.

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

- Active branch status: **restricted-partial-pass-precon-false-greens-under-repair**
- Last persisted Marvel control source: `77a5383fa7490aa91360b8186a4bda890f632157`
- Last persisted Marvel control outcome: **focused-pass-broad-fail**
- Note: At exact source 77a5383..., focused Marvel passed with Vanquish the Horde -> Reanimate and Arcane Signet -> Brainstorm, moving average nonland mana value 2.71 -> 2.59 while preserving legal exact-100 Marvel printings and substantive strategy. The independently persisted broad Marvel control at the same source failed target-quality and strategy-preservation gates. This is restricted focused-scenario evidence, not a broad Marvel pass.

Required before resuming broad INTEL-01/INTEL-02 claims:

- Revalidate the semantic repair on exact-source Necron and Squirreled Away controls and manually audit every accepted swap before either workflow may count as scenario intelligence
- Make graveyard hate and generic artifacts non-substantive replacements for own-graveyard/artifact engines, and make token multipliers plus team-wide combat payoffs structurally protected rather than recoverable by aggregate ratios
- Obtain a broad Marvel pass at the same restricted-theme quality standard as focused Marvel and Food and Fellowship before claiming the restricted lane is uniformly green
- Verified full-table win-route discovery, injection and final evaluation agree in a scenario where an eligible route exists
- Negative win-package conclusions distinguish completed bounded absence from provider unavailability or selection failure
- Commander legality, exact 100 cards, printing-family/set restrictions and budgets remain intact across the expanded controls

## Next actions

1. Publish and exact-source validate the generic semantic repair: own-graveyard engines must outrank graveyard hate, explicit artifact engines must outrank generic artifacts, and token multipliers/team-wide payoffs must receive maximum cut protection.
2. Rerun and manually audit Necron Dynasties and Squirreled Away. Reject any package that still cuts Trazyn/Resurrection Orb-style graveyard engines or Chatterfang/anthem/overrun-style token engines for generic role-count gains.
3. Keep Marvel and Middle-earth restricted controls active during the repair. Broad Marvel must pass its whole-deck target and strategy gates; Food and Fellowship must retain its exact four-swap quality or improve honestly.
4. Only after those controls meet the same high standard should budget, card-pool and new-archetype conditions broaden further.
5. Run an eligible verified full-table package scenario to validate INTEL-01 discovery, feasibility, atomic injection, protection and independent final recognition end to end; current Marvel, Middle-earth, Food and Necron controls do not provide that positive win-route proof.
6. Migrate legacy KF-013 evidence writers to isolated paths plus bounded latest-head reconciliation before treating concurrent persistence as globally closed.

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

Then: Inspect the live active-branch head and PR state. Use the validation index to decide which persisted controls are current or stale, then continue only from the active milestone and nextActions.
