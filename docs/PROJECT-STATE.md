<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project State

Generated from `project-state.json`. Last state update: **2026-09-07T22:24:00.000Z**.

## Current mode

- Repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`
- Active experimental branch: `agent/v15-native-deck-intelligence`
- Active PR: #29
- Active milestone: **BENCH-01**
- Intelligence development paused: **no**
- Reason: The 005717 five-fixture manual review is complete and rejected the lineage. A repeated generic Commander-intelligence weakness is now established across Ellivere, Hakbal, Lathril and Bello: relative IN-vs-OUT requested-component/commander-mechanism value is too weak, especially outgoing-card importance. The next justified product action is the smallest generic mechanism-aware relative replacement/cut-priority repair, followed by focused regressions, full immutable validation and one frozen multi-fixture replay before broader BENCH-01 expansion.

## Stable boundary

- Branch: `main`
- Version: `0.13.0`
- `server-current`: V0.13
- Stable promotion authorized: **yes**

## Experimental checkpoints

Development checkpoint at pause: `ff34b8d85412f56ac48144de9beec6c7503c3eb5`

BENCH-01 manual whole-deck review is now persisted for frozen product candidate 00571713696977093fee717deecc2b26969e2643 at test-results/bench01-manual-verdicts/00571713696977093fee717deecc2b26969e2643.md. The lineage is manually REJECTED as a new accepted Commander baseline despite formal validation and successful frozen replay. Quick Draw is a local success, Virtue and Valor remains mixed, and Explorers of the Deep, Elven Empire and Animated Army fail specialist replacement-coherence expectations. The repeated cross-fixture defect is mechanism-aware relative replacement value, especially on the OUT/cut side: identity-bearing Aura, typal, counter/explore and high-MV artifact/enchantment mechanism pieces are frequently assigned weak/zero strategic importance and displaced by generic structural role cards. The context-dead low-curve utility repair itself remains useful evidence because Jet Medallion no longer survives in Gruul Bello. Repository schedule guardrails now also require single-flight branch-changing execution and durable manual verdicts outside replaceable replay output.

Latest fully validated executable experimental baseline recorded by project state:

- Branch: `agent/v15-native-deck-intelligence`
- SHA: `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`
- Scope: Latest accepted fully validated Commander product baseline. Frozen candidate 00571713696977093fee717deecc2b26969e2643 is formally validated and replayed but manually rejected; it must not replace this baseline.

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

- Active branch status: **bench01-005717-manual-reject-mechanism-aware-relative-replacement-repair-justified**
- Last persisted Marvel control source: `5829b37b686255ba35d419b37be17095e54fb696`
- Last persisted Marvel control outcome: **expected-ceiling-fail-closed-zero-swap**
- Note: At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

Required before resuming broad INTEL-01/INTEL-02 claims:

- Keep e17b0a1cba659b229fd6f0b6e2df79c5e464a616 as the latest accepted Commander product baseline; 00571713696977093fee717deecc2b26969e2643 is formally validated/replayed but manually rejected.
- Use test-results/bench01-manual-verdicts/00571713696977093fee717deecc2b26969e2643.md as the durable manual whole-deck verdict for the latest five-fixture lineage; do not infer acceptance from green CI, replay success, swap-count movement or bracket movement.
- Retain the useful local 005717 repair evidence: the context-dead low-curve utility defect is closed for the observed Bello case and Jet Medallion no longer survives in Gruul through generic low-curve lanes.
- Treat the repeated cross-fixture weakness as mechanism-aware relative replacement value, especially outgoing-card requested-component/commander-mechanism importance. Ellivere, Hakbal, Lathril and Bello all show identity-bearing OUT cards being undervalued relative to generic structural IN cards.
- The next repair must be generic and advisory: compare direct requested-component/commander-mechanism value of IN versus OUT while preserving necessary structural fallback. Do not freeze all theme/typal cards or simply raise hard theme minimums.
- Add generic focused regressions spanning Aura/enchantment, typal, counters/explore-style, token/combat and high-MV artifact/enchantment mechanism cases before full immutable validation.
- After a green repair SHA, freeze exactly that source and replay representative failures plus contrasting controls before accepting any new Commander baseline. Manual complete-deck review remains mandatory.
- Scheduled/autonomous runs must obey AGENTS.md single-flight execution: do not start an overlapping branch-changing validation, replay, state writer or product repair while a relevant branch-writing operation is still active.
- Scheduled/autonomous runs must not create, edit, delete, stage, bypass or otherwise alter .github/workflows/**, src/workflow-immutability.test.ts, or workflowPolicyEpochSha. Use the checked-in .automation replay request interface.
- Keep the earlier Counter Blitz dense-countermagic allocation concern watch-only unless broader cross-fixture evidence reproduces it.
- Do not merge PR #29 or promote stable/current V0.13 until BENCH-01 is promotion-grade and all relevant formal and manual quality evidence are green.

## Next actions

1. Read project-state.json and AGENTS.md first; obey single-flight execution and do not overlap a still-running branch-changing validation, replay, integrity writer or product repair.
2. Implement the smallest generic mechanism-aware relative replacement repair: score direct requested-component/commander-mechanism importance for OUT as well as IN, compare them within structurally valid replacements, and apply only an advisory identity-preservation preference with structural fallback.
3. Add focused generic regressions spanning Aura/enchantment, typal, counters/explore-style, token/combat and high-MV artifact/enchantment mechanism cases; do not encode fixture names, commander names or card-specific exceptions.
4. Run the complete immutable repository validation. Only if green, freeze the exact repair SHA and replay representative 005717 failures plus contrasting controls from that unchanged source, then persist a new durable manual whole-deck verdict.
5. Once the repeated replacement-value defect is conclusively resolved or bounded, broaden BENCH-01 to fresh combo, hybrid, control, aristocrats, budget and unusual-commander fixtures with strong general-AI comparison rather than continuing to polish the same five precons.

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

Then: BENCH-01 remains active and the hourly autonomous Workday is enabled. Keep e17b0a1c... as the latest accepted Commander baseline. Frozen candidate 00571713696977093fee717deecc2b26969e2643 is formally validated/replayed but manually REJECTED; durable verdict is test-results/bench01-manual-verdicts/00571713696977093fee717deecc2b26969e2643.md. The repeated generic weakness is mechanism-aware relative replacement value, especially outgoing-card requested-component/commander-mechanism importance across Ellivere, Hakbal, Lathril and Bello. Next: implement only the smallest generic advisory IN-vs-OUT mechanism-value repair, validate fully, freeze the exact green SHA, replay representative failures plus controls, and manually review complete decks. Before any write read AGENTS.md, obey single-flight execution, and never alter .github/workflows/** during scheduled/autonomous development. Stable remains V0.13 and PR #29 remains unmerged.
