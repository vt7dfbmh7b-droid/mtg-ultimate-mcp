<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project State

Generated from `project-state.json`. Last state update: **2026-09-07T22:06:00.000Z**.

## Current mode

- Repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`
- Active experimental branch: `agent/v15-native-deck-intelligence`
- Active PR: #29
- Active milestone: **BENCH-01**
- Intelligence development paused: **no**
- Reason: The autonomous hourly Workday is enabled. Schedule reliability is protected by the repository authority boundary in AGENTS.md and the workflow-provenance freeze. The next product step is not another repair: manually review the complete frozen 005717... five-fixture replay, persist the verdict, and only then accept the lineage or diagnose the next repeated generic weakness.

## Stable boundary

- Branch: `main`
- Version: `0.13.0`
- `server-current`: V0.13
- Stable promotion authorized: **yes**

## Experimental checkpoints

Development checkpoint at pause: `2f93c9ec1a171775500e7c7cfd9cb7d0c11bc5ea`

The repository is in BENCH-01 with the autonomous schedule re-enabled. The latest accepted Commander product baseline remains e17b0a1cba659b229fd6f0b6e2df79c5e464a616. Product candidate 00571713696977093fee717deecc2b26969e2643 passed focused/full/build validation and was replayed from frozen src/** across Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire and Animated Army; persisted replay metadata confirms source equality and bench execution success. No manual whole-deck verdict for this 005717 lineage is currently persisted, so it is not an accepted Commander product checkpoint. Repository-maintenance hardening is now in place: AGENTS.md forbids scheduled/autonomous workflow writes, the strategy-anchor replay accepts an external .automation request SHA, and normal CI freezes workflow provenance after policy epoch 4a7f308e04de33eb2b68c461925a2360579971d4.

Latest fully validated executable experimental baseline recorded by project state:

- Branch: `agent/v15-native-deck-intelligence`
- SHA: `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`
- Scope: Latest accepted fully validated Commander product baseline. Later candidates, including formally validated frozen product candidate 00571713696977093fee717deecc2b26969e2643, are not accepted until mandatory manual whole-deck BENCH review is persisted and passes.

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

- Active branch status: **bench01-005717-frozen-replay-manual-review-pending**
- Last persisted Marvel control source: `5829b37b686255ba35d419b37be17095e54fb696`
- Last persisted Marvel control outcome: **expected-ceiling-fail-closed-zero-swap**
- Note: At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

Required before resuming broad INTEL-01/INTEL-02 claims:

- Keep e17b0a1cba659b229fd6f0b6e2df79c5e464a616 as the latest accepted Commander product baseline until a later lineage passes both formal validation and mandatory manual whole-deck BENCH acceptance.
- Treat 00571713696977093fee717deecc2b26969e2643 as the latest frozen formally validated product candidate for the five-fixture strategy-anchor replay. Replay metadata confirms frozen src/** equality and successful execution, but no persisted manual whole-deck verdict currently exists.
- Before changing Commander product logic again, manually inspect the complete 005717... outputs for Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire and Animated Army; persist an explicit accept/reject verdict with cross-fixture reasoning.
- Do not infer product acceptance from green CI, successful replay execution, swap count movement, bracket movement, or generated evidence alone.
- If the 005717... lineage is rejected, identify a repeated cross-fixture generic weakness before making another product repair. Preserve legality, printing, budget, compound-component preservation, strategy-preservation, target-progress and win-route truth gates.
- Scheduled/autonomous runs must read AGENTS.md before repository writes and must not create, edit, delete, stage, bypass or otherwise alter .github/workflows/**, src/workflow-immutability.test.ts, or workflowPolicyEpochSha.
- For strategy-anchor replays, use .automation/bench01-strategy-anchor-replay.request with one exact validated 40-character product SHA; never edit the replay workflow to change its frozen SHA.
- A workflow-provenance CI failure is a repository-integrity/harness failure. Do not repair it by advancing the epoch, weakening the immutability test, rewriting history, or adding another workflow.
- Keep the earlier Counter Blitz dense-countermagic allocation concern watch-only unless broader cross-fixture evidence reproduces it.
- Do not merge PR #29 or promote stable/current V0.13 until BENCH-01 is promotion-grade and all relevant formal and manual quality evidence are green.

## Next actions

1. Read AGENTS.md before any scheduled/autonomous repository write and preserve the hard workflow authority boundary; do not touch .github/workflows/** or the workflow-policy epoch.
2. Manually inspect the complete frozen 00571713696977093fee717deecc2b26969e2643 five-fixture replay outputs and persist one explicit whole-deck BENCH verdict covering Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire and Animated Army.
3. If manual review accepts the lineage, record 005717... as the new accepted Commander product checkpoint only with the exact supporting evidence. If it rejects the lineage, isolate the repeated generic cross-fixture weakness before any further product repair.
4. After the current five-fixture lineage is conclusively accepted or rejected, broaden BENCH-01 to fresh combo, hybrid, control, aristocrats, budget and unusual-commander fixtures with strong general-AI comparison rather than continuing to polish the same precons.

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
- A frozen-source replay is product evidence only when src/** is proven equal to the validated product SHA used for that batch.
- Scheduled/autonomous development has no authority to modify .github/workflows/**, src/workflow-immutability.test.ts, or the approved workflow-policy epoch; those are explicit interactive-maintenance-only surfaces.
- Never treat an unvalidated or manually unreviewed/rejected head as an accepted Commander checkpoint.
- No scenario-specific, card-name or benchmark-specific hacks; product changes require generic evidence.
- Stable/current promotion or PR merging requires complete validation, non-redundancy, safety and promotion-grade benchmark evidence. The user has granted standing authority to perform those actions once those gates are genuinely satisfied; no extra approval is required at that point.

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

Then: BENCH-01 remains active and the hourly autonomous Workday is enabled. Keep e17b0a1c... as the latest accepted Commander baseline. The newest frozen formally validated five-fixture product candidate is 00571713696977093fee717deecc2b26969e2643; replay metadata confirms src/** equality and successful execution, but no manual whole-deck verdict is currently persisted, so do not change product logic again before reviewing those complete decks. Before any repository write read AGENTS.md and obey its hard workflow authority boundary. Use .automation/bench01-strategy-anchor-replay.request for future frozen replay requests; never edit .github/workflows/** during scheduled/autonomous development. Stable remains V0.13 and PR #29 remains unmerged.
