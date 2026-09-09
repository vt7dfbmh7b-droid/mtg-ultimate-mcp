<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project State

Generated from `project-state.json`. Last state update: **2026-09-09T20:27:00+12:00**.

## Current mode

- Repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`
- Active experimental branch: `agent/v15-native-deck-intelligence`
- Active PR: #29
- Active milestone: **BENCH-01**
- Intelligence development paused: **no**
- Reason: The contextual-effectiveness repair is validated and control-safe. Product acceptance is blocked only on the required affected-fixture replay interface; other safe BENCH analysis may continue, but no acceptance, merge or promotion claim may cross that gate.

## Stable boundary

- Branch: `main`
- Version: `0.13.0`
- `server-current`: V0.13
- Stable promotion authorized: **yes**

## Experimental checkpoints

Development checkpoint at pause: `34cbc7843fcc936bd153a6516e1762ad2b5091e5`

Contextual-effectiveness candidate 34cbc7843fcc936bd153a6516e1762ad2b5091e5 is focused/full/build validated and its exact-source five-fixture strategy-anchor control replay completed green. Durable manual control verdict: test-results/bench01-manual-verdicts/34cbc7843fcc936bd153a6516e1762ad2b5091e5.md (evidence commit 32980b70d8893c2497e3786cb258f1fe71f1a061). This control replay covered Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire and Animated Army and found no material repair-caused regression. It did NOT replay the three fresh failures that justified the repair. Affected-fixture acceptance remains unfinished because the currently authorized replay request interface is fixed to the five strategy-anchor controls; autonomous rules prohibit modifying .github/workflows/** to add Endless Punishment, Revenant Recon and Deep Clue Sea. This is an execution-interface blocker, not a Commander-product failure. Accepted Commander baseline remains e17b0a1cba659b229fd6f0b6e2df79c5e464a616.

Latest fully validated executable experimental baseline recorded by project state:

- Branch: `agent/v15-native-deck-intelligence`
- SHA: `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`
- Scope: Latest accepted fully validated Commander product baseline. 34cbc7843fcc936bd153a6516e1762ad2b5091e5 is a later formally validated candidate with green five-control replay, but remains provisional until affected-fixture replay and manual comparison are completed.

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

- Active branch status: **bench01-34cbc-validated-control-safe-affected-fixture-replay-interface-blocked**
- Last persisted Marvel control source: `c2fa83b7ea4a81e18445aba3a54529cdb31d86cd`
- Last persisted Marvel control outcome: **execution-success-target-not-achieved**
- Note: Historical constrained control; do not convert provider uncertainty or construction ceiling into unrelated BENCH failure.

Required before resuming broad INTEL-01/INTEL-02 claims:

- Keep e17b0a1cba659b229fd6f0b6e2df79c5e464a616 as the latest accepted Commander baseline.
- Treat 34cbc7843fcc936bd153a6516e1762ad2b5091e5 as formally validated and five-control-replay safe but provisional.
- Use test-results/bench01-manual-verdicts/34cbc7843fcc936bd153a6516e1762ad2b5091e5.md as the durable post-repair control verdict.
- Do not claim the contextual-effectiveness repair has generalized to Revenant Recon or Deep Clue Sea until exact-source affected-fixture replay and complete-deck review exist.
- Keep Endless Punishment's unsupported group-slug/punisher vocabulary failure separate from the contextual replacement-priority repair.
- The current absence of an authorized affected-fixture replay interface is an execution-interface blocker, not a product failure.
- Read AGENTS.md before writes and never alter protected workflow/policy surfaces during autonomous work.
- PR #29 and stable/current V0.13 remain unmerged/unpromoted until promotion-grade BENCH-01 evidence and all applicable formal/manual gates are satisfied.

## Next actions

1. Read project-state.json and AGENTS.md; inspect all relevant branch writers, including earlier-commit jobs. Do not overlap a running validation, replay, integrity writer or product repair.
2. Keep 34cbc7843fcc936bd153a6516e1762ad2b5091e5 frozen as the validated contextual-effectiveness candidate and do not repeat its completed five-fixture strategy-anchor control replay.
3. Complete the unfinished affected-fixture gate: run Endless Punishment, Revenant Recon and Deep Clue Sea plus at least one control from exact source 34cbc7843fcc936bd153a6516e1762ad2b5091e5, then manually inspect complete decks and compare against 473edf47 and the existing strong-general-AI verdicts.
4. Current blocker: no checked-in autonomous replay interface is available for that affected-fixture set; the authorized .automation/bench01-strategy-anchor-replay.request interface is fixed to Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire and Animated Army. Do not edit .github/workflows/**, src/workflow-immutability.test.ts or workflowPolicyEpochSha to work around this.
5. If an already-authorized non-workflow execution path for the affected fixtures is found, use it without changing Commander source. Otherwise defer only the blocked replay and continue safe read-only/manual analysis; do not infer acceptance from the five-control replay.
6. After affected-fixture evidence exists, accept or reject 34cbc784 based on actual whole-deck improvement. If the same contextual failures remain, reproduce them through the production path before another generic repair.
7. Endless Punishment's group-slug/punisher vocabulary failure remains a separate semantic-taxonomy issue unless affected replay evidence shows it has independently changed; do not conflate it with the contextual-effectiveness repair.
8. Keep PR #29 and stable/current V0.13 unmerged/unpromoted until promotion-grade BENCH-01 evidence exists.

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
- Stable/current promotion or PR merging requires complete validation, non-redundancy, safety and promotion-grade benchmark evidence. The user has granted standing authority to perform those actions once those gates are genuinely satisfied; no extra approval is required at that point.
- Abstract role-count or aggregate-theme gains are not proof of replacement quality; candidate effectiveness must account for deck-context setup/connectivity, commander-specific engine importance and per-component before/after movement.
- A green control replay does not substitute for the mandated affected-fixture replay after a generic repair; acceptance requires evidence on the failure family that justified the repair.

## Fresh-chat recovery

Read in this order:

1. `project-state.json`
2. `AGENTS.md`
3. `docs/PROJECT-STATE.md`
4. `validation-index.json`
5. `docs/VALIDATION-STATE.md`
6. `ULTIMATE_MTG_SPEC.md`
7. `docs/COMMANDER-SPECIALIST-OBJECTIVE.md`
8. `docs/ROADMAP.md`
9. `docs/DECISIONS.md`
10. `docs/VALIDATION-MATRIX.md`
11. `docs/KNOWN-FAILURES.md`

Then: BENCH-01 remains active. Accepted Commander baseline remains e17b0a1cba659b229fd6f0b6e2df79c5e464a616. Candidate 34cbc7843fcc936bd153a6516e1762ad2b5091e5 is formally validated and five-control-replay safe, with durable verdict at test-results/bench01-manual-verdicts/34cbc7843fcc936bd153a6516e1762ad2b5091e5.md. Do not repeat that control replay. The unfinished acceptance gate is exact-source replay of Endless Punishment, Revenant Recon and Deep Clue Sea plus a control, followed by complete-deck manual comparison against 473edf47 and strong general AI. The current authorized replay request only runs the five strategy-anchor controls and autonomous work may not modify .github/workflows/**. Treat this as an execution-interface blocker rather than a product failure. Stable remains V0.13 and PR #29 unmerged.
