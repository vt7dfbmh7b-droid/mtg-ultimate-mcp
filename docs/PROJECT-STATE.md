<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project State

Generated from `project-state.json`. Last state update: **2026-09-24T00:00:00.000Z**.

## Current mode

- Repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`
- Active experimental branch: `agent/counter-blitz-generic-mechanism-floor-20260911`
- Active PR: none
- Active milestone: **BENCH-01**
- Intelligence development paused: **no**
- Reason: Interactive Counter Blitz recovery remains active. Narrow self-reference repair accepted; protection and bracket targets remain unmet. Scheduled development was observed paused on 2026-09-22 and was not changed.

## Stable boundary

- Branch: `main`
- Version: `0.13.0`
- `server-current`: V0.13
- Stable promotion authorized: **no**

## Experimental checkpoints

Development checkpoint at pause: `4f84101920cad7840cf539cacadde44a3f11052e`

Narrow Oracle self-reference repair passed exact CI 35701235891 (1126 passed, 1 skipped) and frozen Batch A 35701236039, evidence 6a742e117bb4b3c9e4c35182ed1775c4be372132. Counter Blitz is legal 100 with eligible FF printings, 25 swaps and White Mage/Ballista restored; protection 6/8 and assessed bracket 3/5 remain unmet. Accept the narrow repair, not full recovery or a new broad Commander baseline. Accepted baseline remains 1ef10cec; PR #29 unmerged, stable V0.13 unchanged.

Latest fully validated executable experimental baseline recorded by project state:

- Branch: `agent/v15-native-deck-intelligence`
- SHA: `1ef10cec8c50d3d576cb1c3ae3c2566a4f632aa7`
- Scope: Latest accepted Commander product baseline. Exact CI green, frozen affected/control replay successful with src/** equality proven, and durable manual whole-deck verdict accepted the repaired Aura-recursion role inference after Revenant Recon retained Animate Dead without a material control regression.

Always inspect the live active-branch head before editing. A later documentation/project-management commit is not automatically a new executable validation milestone.

## Milestones

| ID | Milestone | Status | Goal |
|---|---|---|---|
| PM-01 | Persistent Project State & Handoff Automation | validated | Make repository state authoritative so a fresh chat can recover exact project context with minimal rechecking. |
| PM-02 | Validation State Indexing | validated | Consolidate key persisted control metadata into one deterministic validation index so fresh chats can identify current, stale, passing and failing evidence immediately. |
| INTEL-01 | Win-package intelligence | validated | Very-good verified full-table win-package discovery, feasibility, injection, and protection. |
| INTEL-02 | Actual autonomous deck improvement | implemented-validation-pending | Very-good target-aware autonomous refinement that repairs real deck weaknesses rather than cosmetic metrics. |
| BENCH-01 | Adversarial Commander benchmark suite | active | Prove deck-building quality across combo, combat, control, aristocrats, typal, budget, theme-restricted, cEDH-ish, and hybrid decks. |
| INTEL-03 | Human-level strategic reasoning layer | planned | Model commander role, synergy networks, structural-card importance, cut consequences, primary/secondary plans, and coherent package trade-offs. |
| INTEL-04 | Counterfactual deck comparison & expert explanation | planned | Compare complete 100-card alternatives and explain why one deck state is stronger under the exact requested constraints. |

## Current validation status

- Active branch status: **counter-blitz-narrow-repair-validated-full-targets-unmet**
- Last persisted Marvel control source: `1d6b73aae4edc72d80a2ebc945a160506a13c71e`
- Last persisted Marvel control outcome: **execution-success-target-not-achieved**
- Note: Focused and broad source-1d6b73a controls execute successfully but fail target-quality gates. Retain this unresolved result; other scenario passes do not establish promotion readiness.

Required before resuming broad INTEL-01/INTEL-02 claims:

- Reuse exact source 4f84101920cad7840cf539cacadde44a3f11052e, CI 35701235891, Batch A 35701236039 and evidence 6a742e117bb4b3c9e4c35182ed1775c4be372132. Do not reacquire snapshots or repeat the fixed self-reference family without a regression.
- Investigate the remaining protection 6/8 and bracket 3/5 deficits through retained candidate/rejection traces. Current stop is all-competing-packages-below-improvement-threshold, not the prior strategy-density stop. Distinguish discovery/ranking weaknesses from a proven constrained card-pool ceiling before changing gates.
- Reproduce any further generic defect through the public planner with anonymous regressions; preserve exact legality, FF printing restrictions, component floors and verified mechanisms. Start from untouched stock, never the held-out historical Tidus deck.
- After a justified repair, require focused/full exact-source validation, frozen affected/contrasting controls, complete-deck review and durable verdict. No independently executed general-AI comparator exists for this repair; broad superiority is unproven.
- Keep accepted Commander baseline 1ef10cec8c50d3d576cb1c3ae3c2566a4f632aa7. Do not change main/stable V0.13, merge PR #29, modify workflows/guard/policy epoch or resume paused schedules.

## Next actions

1. Read state, AGENTS.md and recovery status; check current/recent writers and refresh candidate head before any write. Development schedules were observed paused on 2026-09-22; do not resume them without user direction.
2. Reuse exact source 4f84101920cad7840cf539cacadde44a3f11052e, CI 35701235891, Batch A 35701236039 and evidence 6a742e117bb4b3c9e4c35182ed1775c4be372132. Do not reacquire snapshots or repeat the fixed self-reference family without a regression.
3. Investigate the remaining protection 6/8 and bracket 3/5 deficits through retained candidate/rejection traces. Current stop is all-competing-packages-below-improvement-threshold, not the prior strategy-density stop. Distinguish discovery/ranking weaknesses from a proven constrained card-pool ceiling before changing gates.
4. Reproduce any further generic defect through the public planner with anonymous regressions; preserve exact legality, FF printing restrictions, component floors and verified mechanisms. Start from untouched stock, never the held-out historical Tidus deck.
5. After a justified repair, require focused/full exact-source validation, frozen affected/contrasting controls, complete-deck review and durable verdict. No independently executed general-AI comparator exists for this repair; broad superiority is unproven.
6. Keep accepted Commander baseline 1ef10cec8c50d3d576cb1c3ae3c2566a4f632aa7. Do not change main/stable V0.13, merge PR #29, modify workflows/guard/policy epoch or resume paused schedules.
7. Return to Deep Clue Sea and wider BENCH-01 breadth after the current recovery objective; keep Endless Punishment taxonomy and Marvel target failures separately open.

## Permanent truth boundary

- Commander legality, exact card count, singleton and color identity outrank optimization scores.
- Exact physical-printing existence/restrictions and hard budgets are fail-closed truths.
- Provider unavailable is not evidence of absence.
- A generic infinite-damage statement is not a verified multiplayer full-table win unless opponent scope is proven.
- Pipeline execution or a green harness is not proof of intelligent deck improvement.
- Expected construction-ceiling behaviour is not the same as target achievement.
- A compound aggregate theme-density pass does not prove that every explicitly requested component was preserved or improved.
- For a controlled compound request, candidate acceptance must preserve every already-satisfied component and must not move any below-target component backward while gains elsewhere compensate.
- A downstream preservation veto does not by itself prove the guard is too strict; distinguish lack of compatible candidates from candidate-discovery/ranking failure before changing product behavior.
- Correct strategy labels or structurally valid replacements do not by themselves prove whole-deck Commander quality; manual complete-deck review remains mandatory.
- Relative requested-component and commander-mechanism value must consider the outgoing card as well as the incoming card; hard theme floors alone do not prove above-floor identity preservation.
- Boolean controlled-theme membership is insufficient to prove component preservation in a compound request; preserve and compare structured component identity symmetrically for outgoing and incoming cards.
- Broad requested-component membership is not proof of strategic equivalence. Relative replacement quality must also account for payoff/engine importance, mechanism specificity and commander-conditioned card-shape relationships where evidence supports them.
- Typed requested-mechanism evidence is ineffective if a weaker legacy affinity tie-break removes the card before replacement identity is compared; cut-ranking precedence is part of Commander strategy preservation.
- Shared Aura/enchantment type or relationship-family membership is not proof of commander-compatible Enchant target shape; distinguish creature-enchanting support from artifact-, land- or other-target Auras through generic evidence.
- A frozen-source replay is product evidence only when src/** is proven equal to the validated product SHA used for that batch.
- Scheduled/autonomous development has no authority to modify .github/workflows/**, src/workflow-immutability.test.ts, or the approved workflow-policy epoch; those are explicit interactive-maintenance-only surfaces.
- Never treat an unvalidated or manually unreviewed/rejected head as an accepted Commander checkpoint.
- No scenario-specific, card-name or benchmark-specific hacks; product changes require generic evidence.
- Current Counter Blitz recovery does not authorize stable/current promotion, PR #29 merging, main changes, workflow/guard/policy-epoch changes or schedule resumption. Historical standing authority does not override this task boundary.
- Abstract role-count or aggregate-theme gains are not proof of replacement quality; candidate effectiveness must account for deck-context setup/connectivity, commander-specific engine importance and per-component before/after movement.
- A green control replay does not substitute for the mandated affected-fixture replay after a generic repair; acceptance requires evidence on the failure family that justified the repair.
- Held-out historical Tidus builds must never be generation inputs, seeds, must-include lists or card-name-specific acceptance shortcuts.

## Fresh-chat recovery

Read in this order:

1. `project-state.json`
2. `AGENTS.md`
3. `docs/COUNTER-BLITZ-RECOVERY-STATUS.md`
4. `docs/PROJECT-STATE.md`
5. `validation-index.json`
6. `docs/VALIDATION-STATE.md`
7. `ULTIMATE_MTG_SPEC.md`
8. `docs/COMMANDER-SPECIALIST-OBJECTIVE.md`
9. `docs/ROADMAP.md`
10. `docs/DECISIONS.md`
11. `docs/VALIDATION-MATRIX.md`
12. `docs/KNOWN-FAILURES.md`

Then: Resume Counter Blitz recovery from source 4f84101920cad7840cf539cacadde44a3f11052e and completed evidence 6a742e117bb4b3c9e4c35182ed1775c4be372132. Read its durable manual verdict. Snapshot/replay and Oracle self-reference blockers are resolved; remaining failures are protection and bracket quality. Do not repeat completed work absent a regression.
