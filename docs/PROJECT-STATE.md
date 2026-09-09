<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project State

Generated from `project-state.json`. Last state update: **2026-09-09T19:27:27.098Z**.

## Current mode

- Repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`
- Active experimental branch: `agent/v15-native-deck-intelligence`
- Active PR: #29
- Active milestone: **BENCH-01**
- Intelligence development paused: **no**
- Reason: Latest eight-fixture execution and manual rejection are complete. Requested-mechanism pairing tests already pass after a test-only correction; the remaining task is a faithful failing public-planner reproduction of mechanism importance, not another unchanged replay or an unproven repair.

## Stable boundary

- Branch: `main`
- Version: `0.13.0`
- `server-current`: V0.13
- Stable promotion authorized: **yes**

## Experimental checkpoints

Development checkpoint at pause: `1d6b73aae4edc72d80a2ebc945a160506a13c71e`

Operational-equivalence product 1d6b73aae4edc72d80a2ebc945a160506a13c71e passed exact CI 34365017686 and frozen eight-fixture replay 34370124608 (evidence ce854778d280eed76ea290767361cdd7af038130). Durable verdict rejects baseline acceptance: Deep Clue Sea and Revenant Recon retain engine/mechanism losses; Endless Punishment remains independently unsupported. Subsequent 1e06aaf/3bc7e2b commits add/correct only a requested-mechanism test; head 3bc7e2b5e5c895705d6813093c712d09e012afc0 passed CI 34377710210, not a new product repair. Accepted baseline stays e17b0a1cba659b229fd6f0b6e2df79c5e464a616.

Latest fully validated executable experimental baseline recorded by project state:

- Branch: `agent/v15-native-deck-intelligence`
- SHA: `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`
- Scope: Latest accepted Commander product baseline. Later formally validated 1d6b73a completed eight-fixture execution and has a persisted manual baseline rejection.

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

- Active branch status: **bench01-1d6b73-eight-fixture-manual-reject-3bc7e2b-test-only-ci-green**
- Last persisted Marvel control source: `1d6b73aae4edc72d80a2ebc945a160506a13c71e`
- Last persisted Marvel control outcome: **execution-success-target-not-achieved**
- Note: Focused and broad source-1d6b73a controls execute successfully but fail target-quality gates. Retain this unresolved result; other scenario passes do not establish promotion readiness.

Required before resuming broad INTEL-01/INTEL-02 claims:

- Do not recreate the requested-mechanism tests: src/services/upgrade-requested-mechanism-importance-v15.test.ts was added at 1e06aaf and its fallback control corrected at 3bc7e2b. CI 34377710210 passes; these are test-only changes, not a new product repair or proof of a remaining failing production case.
- Reproduce the residual OUT-card mechanism loss through buildSimulationBackedUpgradePlanV07/the actual precon production route using anonymous Oracle-shaped cards and realistic generated summaries. Trace role serialization, requested relationships and commander/request mechanism importance; include a safer filler cut and a compatible same-mechanism positive control. A passing hand-authored pairing witness is insufficient to justify another patch.
- Only after a genuine failing production regression, implement the smallest generic repair. Keep existing legality, exact-printing/budget, role truth, strategy and package gates; no card, commander or fixture exceptions.
- Require focused and full exact-commit validation, then request a new frozen affected/control replay through .automation/bench01-strategy-anchor-replay.request. Preserve the protected workflows, workflow-immutability test and policy epoch; do not replay unchanged 1d6b73a.
- Review complete new decks against retained 473edf47/34cbc784/63b9d75c/1d6b73a evidence. Existing general-AI verdicts are analytical assessments, not independently executed alternative-build or matchup evidence. Keep Endless Punishment's unsupported group-slug/punisher taxonomy defect separate.
- Keep accepted baseline e17b0a1cba659b229fd6f0b6e2df79c5e464a616, PR #29 unmerged and stable/current V0.13 unpromoted. Marvel focused/broad still execute without a supported improvement and fail quality gates; do not convert execution success into target achievement. Reconcile synchronized state after material progress.

## Next actions

1. Read project-state.json and AGENTS.md; inspect all current/recent branch writers, including earlier-commit jobs, then refresh head before writes. The enabled hourly Chat Fast Path already requires reconciliation; preserve its full prompt and schedule.
2. Reuse completed frozen eight-fixture replay 34370124608 of product 1d6b73aae4edc72d80a2ebc945a160506a13c71e, evidence ce854778d280eed76ea290767361cdd7af038130 and its durable manual rejection. Earlier 34cbc784 and 63b9d75c verdicts remain historical comparisons, not unfinished replay requests.
3. Do not recreate the requested-mechanism tests: src/services/upgrade-requested-mechanism-importance-v15.test.ts was added at 1e06aaf and its fallback control corrected at 3bc7e2b. CI 34377710210 passes; these are test-only changes, not a new product repair or proof of a remaining failing production case.
4. Reproduce the residual OUT-card mechanism loss through buildSimulationBackedUpgradePlanV07/the actual precon production route using anonymous Oracle-shaped cards and realistic generated summaries. Trace role serialization, requested relationships and commander/request mechanism importance; include a safer filler cut and a compatible same-mechanism positive control. A passing hand-authored pairing witness is insufficient to justify another patch.
5. Only after a genuine failing production regression, implement the smallest generic repair. Keep existing legality, exact-printing/budget, role truth, strategy and package gates; no card, commander or fixture exceptions.
6. Require focused and full exact-commit validation, then request a new frozen affected/control replay through .automation/bench01-strategy-anchor-replay.request. Preserve the protected workflows, workflow-immutability test and policy epoch; do not replay unchanged 1d6b73a.
7. Review complete new decks against retained 473edf47/34cbc784/63b9d75c/1d6b73a evidence. Existing general-AI verdicts are analytical assessments, not independently executed alternative-build or matchup evidence. Keep Endless Punishment's unsupported group-slug/punisher taxonomy defect separate.
8. Keep accepted baseline e17b0a1cba659b229fd6f0b6e2df79c5e464a616, PR #29 unmerged and stable/current V0.13 unpromoted. Marvel focused/broad still execute without a supported improvement and fail quality gates; do not convert execution success into target achievement. Reconcile synchronized state after material progress.

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

Then: BENCH-01 active. Reuse completed 34cbc784, 63b9d75c and 1d6b73a replay/verdict evidence; do not repeat those batches. Latest durable verdict: test-results/bench01-manual-verdicts/1d6b73aae4edc72d80a2ebc945a160506a13c71e.md. Requested-mechanism pairing tests already exist and pass at 3bc7e2b; no new production repair followed 1d6b73a. Next prove the residual mechanism-importance defect through the actual public planner/precon path, including the real serialized OUT/IN evidence. Keep accepted e17b0a1c and stable V0.13 unchanged.
