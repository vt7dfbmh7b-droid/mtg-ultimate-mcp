<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project State

Generated from `project-state.json`. Last state update: **2026-09-09T09:07:12Z**.

## Current mode

- Repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`
- Active experimental branch: `agent/v15-native-deck-intelligence`
- Active PR: #29
- Active milestone: **BENCH-01**
- Intelligence development paused: **no**
- Reason: Eight-fixture execution is complete; no replay-interface blocker remains. Commander-product acceptance is rejected for repeated swap-selection/engine/role-effectiveness failures. Continue production-path reproduction and evidence-driven generic repair.

## Stable boundary

- Branch: `main`
- Version: `0.13.0`
- `server-current`: V0.13
- Stable promotion authorized: **yes**

## Experimental checkpoints

Development checkpoint at pause: `34cbc7843fcc936bd153a6516e1762ad2b5091e5`

Candidate 34cbc7843fcc936bd153a6516e1762ad2b5091e5 passed formal validation and the full eight-fixture replay (run 34330764487; evidence 069b700adf9329004791d52e3961aedd60d318b5). The durable manual verdict now rejects baseline acceptance: Revenant Recon and Deep Clue Sea still expose contextual swap/engine/role-effectiveness failures, while Endless Punishment retains its separate unsupported-theme defect. The five control decks are composition-identical to the prior reviewed replay. The replay-interface blocker is resolved via the checked-in TypeScript runner; do not repeat this completed batch. Accepted baseline remains e17b0a1cba659b229fd6f0b6e2df79c5e464a616.

Latest fully validated executable experimental baseline recorded by project state:

- Branch: `agent/v15-native-deck-intelligence`
- SHA: `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`
- Scope: Latest accepted Commander product baseline. Later formally validated 34cbc784 has completed eight-fixture execution and is manually rejected for residual whole-deck quality failures.

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

- Active branch status: **bench01-34cbc-eight-fixture-replay-complete-manual-reject-contextual-quality**
- Last persisted Marvel control source: `c2fa83b7ea4a81e18445aba3a54529cdb31d86cd`
- Last persisted Marvel control outcome: **execution-success-target-not-achieved**
- Note: Historical constrained control; do not convert provider uncertainty or construction ceiling into unrelated BENCH failure.

Required before resuming broad INTEL-01/INTEL-02 claims:

- Reuse the completed eight-fixture 34cbc784 replay and durable manual rejection at test-results/bench01-manual-verdicts/34cbc7843fcc936bd153a6516e1762ad2b5091e5.md. Exact evidence commit 069b700adf9329004791d52e3961aedd60d318b5. The interface blocker is resolved; actual result.json has eight fixtures although legacy workflow metadata lists five.
- Reproduce residual replacement-quality failures through buildSimulationBackedUpgradePlanV07/the actual production route using anonymous Oracle-shaped evidence. Trace contextual helper versus core planner wiring, outgoing engine recognition and incoming practical protection/tutor/interaction contribution.
- Run focused plus full required validation on the exact committed repair, then request frozen eight-fixture replay through .automation/bench01-strategy-anchor-replay.request. Do not modify protected workflows, workflow-immutability.test.ts or policy epoch.
- Manually review complete new affected decks and controls against 473edf47 and 34cbc784 evidence. Preserve qualitative comparison limits; promotion still requires real strong-general-AI comparison evidence and all validation gates.
- Keep Endless Punishment unsupported group-slug/punisher vocabulary as a separate open semantic-taxonomy failure. Do not count a contextual repair as fixing it without evidence.
- Keep accepted baseline e17b0a1cba659b229fd6f0b6e2df79c5e464a616, PR #29 unmerged and stable/current V0.13 unpromoted while product-quality gates remain open. Keep the hourly schedule unchanged.

## Next actions

1. Read project-state.json and AGENTS.md; inspect all branch writers, including earlier-commit validation/replay/integrity jobs, and refresh head before writes. Preserve single-flight execution.
2. Reuse the completed eight-fixture 34cbc784 replay and durable manual rejection at test-results/bench01-manual-verdicts/34cbc7843fcc936bd153a6516e1762ad2b5091e5.md. Exact evidence commit 069b700adf9329004791d52e3961aedd60d318b5. The interface blocker is resolved; actual result.json has eight fixtures although legacy workflow metadata lists five.
3. Reproduce residual replacement-quality failures through buildSimulationBackedUpgradePlanV07/the actual production route using anonymous Oracle-shaped evidence. Trace contextual helper versus core planner wiring, outgoing engine recognition and incoming practical protection/tutor/interaction contribution.
4. Implement only the smallest generic change supported by production-path failing regressions across contrasting cases; keep positive compatible-replacement controls and all existing truth/strategy/package gates.
5. Run focused plus full required validation on the exact committed repair, then request frozen eight-fixture replay through .automation/bench01-strategy-anchor-replay.request. Do not modify protected workflows, workflow-immutability.test.ts or policy epoch.
6. Manually review complete new affected decks and controls against 473edf47 and 34cbc784 evidence. Preserve qualitative comparison limits; promotion still requires real strong-general-AI comparison evidence and all validation gates.
7. Keep Endless Punishment unsupported group-slug/punisher vocabulary as a separate open semantic-taxonomy failure. Do not count a contextual repair as fixing it without evidence.
8. Keep accepted baseline e17b0a1cba659b229fd6f0b6e2df79c5e464a616, PR #29 unmerged and stable/current V0.13 unpromoted while product-quality gates remain open. Keep the hourly schedule unchanged.

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

Then: BENCH-01 active. Eight-fixture replay of 34cbc784 is complete and manually rejected; see test-results/bench01-manual-verdicts/34cbc7843fcc936bd153a6516e1762ad2b5091e5.md and immutable evidence 069b700adf9329004791d52e3961aedd60d318b5. Do not repeat it or report an execution-interface blocker. Reproduce residual outgoing-engine/incoming-role-effectiveness failures through the public production planner before a generic repair. Validate, freeze and replay a new repair through the existing request interface. Accepted baseline stays e17b0a1c; stable V0.13 and PR #29 remain unpromoted/unmerged.
