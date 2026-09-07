<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project State

Generated from `project-state.json`. Last state update: **2026-09-07T23:40:00.000Z**.

## Current mode

- Repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`
- Active experimental branch: `agent/v15-native-deck-intelligence`
- Active PR: #29
- Active milestone: **BENCH-01**
- Intelligence development paused: **no**
- Reason: The 4a7bbf6 five-fixture manual review is complete and rejected the lineage. Cross-fixture evidence now localizes the dominant defect one layer earlier than preservation: outgoing Aura/enchantment, typal/counters and commander-specific permanent-shape cards are frequently not recognized as requested components/mechanisms before relative replacement scoring. The next justified product action is the smallest generic symmetric outgoing requested-component recognition repair, followed by focused regressions, full immutable validation and a source-frozen representative replay/manual review.

## Stable boundary

- Branch: `main`
- Version: `0.13.0`
- `server-current`: V0.13
- Stable promotion authorized: **yes**

## Experimental checkpoints

Development checkpoint at pause: `d246758f789e3595002a996e67576fb821afb592`

BENCH-01 frozen replay and mandatory manual whole-deck review are now complete for exact validated product source 4a7bbf616ac6826ec4ac979894f8752133af3bca. The lineage is manually REJECTED as a new accepted Commander baseline despite green formal validation and green frozen replay. Quick Draw remains a strong local control and Virtue and Valor remains mixed, while Explorers of the Deep, Elven Empire and Animated Army reproduce the dominant replacement-coherence weakness. The 4a7bbf6 exact-component preservation repair is technically correct but does not materially improve those failing decks because important outgoing cards frequently arrive at relative replacement scoring with empty or generic roles rather than explicit requested-component/commander-mechanism identity. The repeated generic defect is therefore upstream outgoing requested-component / commander-mechanism recognition, not a need for a stronger downstream veto. Durable manual verdict: test-results/bench01-manual-verdicts/4a7bbf616ac6826ec4ac979894f8752133af3bca.md.

Latest fully validated executable experimental baseline recorded by project state:

- Branch: `agent/v15-native-deck-intelligence`
- SHA: `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`
- Scope: Latest accepted fully validated Commander product baseline. Frozen candidates 00571713696977093fee717deecc2b26969e2643 and 4a7bbf616ac6826ec4ac979894f8752133af3bca are formally validated/replayed but manually rejected; neither replaces this baseline.

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

- Active branch status: **bench01-4a7bbf6-manual-reject-outgoing-requested-component-recognition-repair-justified**
- Last persisted Marvel control source: `5829b37b686255ba35d419b37be17095e54fb696`
- Last persisted Marvel control outcome: **expected-ceiling-fail-closed-zero-swap**
- Note: At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

Required before resuming broad INTEL-01/INTEL-02 claims:

- Keep e17b0a1cba659b229fd6f0b6e2df79c5e464a616 as the latest accepted Commander product baseline; 00571713696977093fee717deecc2b26969e2643 and 4a7bbf616ac6826ec4ac979894f8752133af3bca are formally validated/replayed but manually rejected.
- Use test-results/bench01-manual-verdicts/4a7bbf616ac6826ec4ac979894f8752133af3bca.md as the durable whole-deck verdict for the newest five-fixture lineage; do not infer acceptance from green CI, frozen replay success, swap-count movement or bracket movement.
- Retain useful local repair evidence from the rejected lineages: Jet Medallion-class context-dead low-curve utility is closed for the observed Gruul case, and 4a7bbf6 correctly preserves exact strategy components once they are already recognized.
- Treat the repeated generic weakness as outgoing requested-component / commander-mechanism recognition before relative replacement scoring. Ellivere Aura/enchantment cards, Hakbal Merfolk/counter pieces, Lathril Elf combat payoffs and Bello qualifying permanent-shape incentives can reach the pairing layer with empty or merely generic roles.
- The next repair must be generic and advisory: expose structured requested-component identity for OUT using the same already-resolved compound-theme evidence used for IN, compare component preservation rather than only boolean theme membership, and feed that evidence into existing relative replacement ranking/preservation. Do not freeze all theme/typal cards or simply raise hard theme minimums.
- Existing evidence in upgrade.ts already computes matchedComponentIds/component affinity for incoming candidates while candidate cuts currently retain only a boolean matchesControlledTheme signal. Treat this IN/OUT evidence asymmetry as the first centralized implementation target, subject to focused regression proof.
- Add generic focused regressions spanning Aura/enchantment, typal, counters/explore-style and artifact/enchantment/requested-shape identity, plus controls proving necessary structural cuts and genuine same-component replacements remain possible, before full immutable validation.
- After a green repair SHA, freeze exactly that source and replay representative failures plus contrasting controls before accepting any new Commander baseline. Manual complete-deck review remains mandatory.
- Do not claim a specialist-vs-general-AI win from the 4a7bbf6 replay: no new provider comparison was run for that repair batch. Resume strong-general-AI comparison when the repeated replacement-identity defect is resolved or bounded and BENCH-01 broadens.
- Scheduled/autonomous runs must obey AGENTS.md single-flight execution: do not start an overlapping branch-changing validation, replay, state writer or product repair while a relevant branch-writing operation is still active.
- Scheduled/autonomous runs must not create, edit, delete, stage, bypass or otherwise alter .github/workflows/**, src/workflow-immutability.test.ts, or workflowPolicyEpochSha. Use the checked-in .automation replay request interface.
- Keep the earlier Counter Blitz dense-countermagic allocation concern watch-only unless broader cross-fixture evidence reproduces it.
- Do not merge PR #29 or promote stable/current V0.13 until BENCH-01 is promotion-grade and all relevant formal and manual quality evidence are green.

## Next actions

1. Read project-state.json and AGENTS.md first; obey single-flight execution and do not overlap a still-running branch-changing validation, replay, integrity writer or product repair.
2. Implement the smallest generic symmetric requested-component recognition repair: preserve matched compound-theme component IDs (or equivalent structured request evidence) on outgoing cut candidates using the same resolved component searches already used for incoming candidates, then compare lost/preserved components within existing advisory relative replacement logic.
3. Do not make component cards uncuttable. A genuine same-component or stronger substantive Commander-strategy replacement must remain eligible, and necessary authoritative structural fallback must remain available when no credible on-plan alternative exists.
4. Add focused generic regressions spanning Aura/enchantment, typal, counters/explore-style and artifact/enchantment/requested-shape cases plus structural-fallback controls; do not encode fixture names, commander names or card-specific exceptions.
5. Run the complete immutable repository validation. Only if green, freeze the exact repair SHA and replay representative failures plus contrasting controls from that unchanged source, then persist a new durable manual whole-deck verdict.
6. Once the repeated replacement-identity defect is conclusively resolved or bounded, broaden BENCH-01 to fresh combo, hybrid, control, aristocrats, budget and unusual-commander fixtures with strong general-AI comparison rather than continuing to polish the same five precons.

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

Then: BENCH-01 remains active and the hourly autonomous Workday is enabled. Keep e17b0a1c... as the latest accepted Commander baseline. Frozen candidates 005717... and 4a7bbf6... are formally validated/replayed but manually REJECTED; newest durable verdict is test-results/bench01-manual-verdicts/4a7bbf616ac6826ec4ac979894f8752133af3bca.md. The repeated generic weakness is now localized upstream: outgoing requested-component / commander-mechanism recognition is too shallow, so identity-bearing cuts can reach relative scoring with empty/generic roles. upgrade.ts already carries structured matchedComponentIds for IN while candidate cuts keep only boolean theme membership. Next: make that evidence symmetric in the smallest generic advisory way, add cross-archetype regressions, validate fully, freeze the exact green SHA, replay representative failures plus controls, and manually review complete decks. Before any write read AGENTS.md, obey single-flight execution, and never alter .github/workflows/** during scheduled/autonomous development. Stable remains V0.13 and PR #29 remains unmerged.
