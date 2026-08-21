<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project State

Generated from `project-state.json`. Last state update: **2026-08-21T22:58:13+12:00**.

## Current mode

- Repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`
- Active experimental branch: `agent/v15-native-deck-intelligence`
- Active PR: #29
- Active milestone: **INTEL-02**
- Intelligence development paused: **no**
- Reason: INTEL-02 cleared the observed target-aware candidate-generation blocker in the Marvel control. Continue at the narrower proof gaps: explicitly audit cut/strategy preservation and reproduce whole-deck improvement across fresh constrained and unrestricted controls, while INTEL-01's missing verified full-table route remains validation-pending.

## Stable boundary

- Branch: `main`
- Version: `0.13.0`
- `server-current`: V0.13
- Stable promotion authorized: **no**

## Experimental checkpoints

Development checkpoint at pause: `758c5658e1f10a961c15a330ee9b5832ea7005b3`

Exact checked-in INTEL-02 source for authoritative target-gate candidate priority and full per-attempt candidate provenance. Project integrity, TypeScript/build, 757 deterministic tests, focused regressions and exact-head CI passed. The fresh Marvel control executed on this SHA and earned a scenario-intelligence pass: two legal Marvel swaps repaired average nonland mana value from 2.71 to 2.54 without regressing a previously passing construction gate; exact 100 and printing policy remained true. This is still one constrained scenario with zero verified winning combos, so INTEL-01/INTEL-02 remain unvalidated. Later evidence or state commits do not replace this tested source SHA.

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

- Active branch status: **scenario-pass-broader-validation-pending**
- Last persisted Marvel control source: `758c5658e1f10a961c15a330ee9b5832ea7005b3`
- Last persisted Marvel control outcome: **success**
- Note: Current checked-in-source scenario control: execution and target quality passed. Vanquish the Horde -> Skullclamp and Aurelia, the Warleader -> Reanimate moved average nonland mana value 2.71 -> 2.54, removed that failed construction gate, added no failed gate, preserved legal exact-100 Marvel printings, and retained per-attempt provenance distinguishing completed no-verified-package discovery. The workflow artifact was recovered after KF-013 rejected only the concurrent result push. The final deck remains Bracket 4 with zero verified winning combos, and strategy preservation is not yet independently audited, so this is not broad milestone validation.

Required before resuming broad INTEL-01/INTEL-02 claims:

- Fresh constrained and unrestricted controls reproduce whole-deck target improvement beyond the single Marvel scenario
- Every accepted package includes an explicit cut-impact and meaningful-strategy preservation audit, not only aggregate role counts
- Verified full-table win-route discovery, injection and final evaluation agree in a scenario where an eligible route exists
- Negative win-package conclusions distinguish completed bounded absence from provider unavailability or selection failure
- Commander legality, exact 100 cards, printing-family/set restrictions and budgets remain intact across the expanded controls

## Next actions

1. Add explicit strategy-preservation and cut-impact evidence to candidate comparison, beginning with the accepted Marvel cuts against Najeela's primary combat and secondary extra-combat plans; do not treat curve repair alone as proof of whole-deck improvement.
2. Add deterministic regressions that reject a target-gate repair when its structural-card or route damage outweighs the gain, while retaining the current legal average-mana-value repair and lower-bracket behavior.
3. Run fresh constrained and unrestricted INTEL-02 controls on materially different archetypes and persist exact source, before/after gates, strategy evidence and per-attempt candidate provenance.
4. Run an eligible verified full-table package scenario to validate INTEL-01 discovery, feasibility, atomic injection, protection and independent final recognition end to end; Marvel's completed no-package result cannot prove injection.
5. Before relying on concurrent live controls again, harden KF-013 result persistence with isolated evidence paths plus fetch/reconcile/retry or a single consolidated writer.

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
