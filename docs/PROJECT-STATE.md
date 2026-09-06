<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project State

Generated from `project-state.json`. Last state update: **2026-09-06T08:24:54.000Z**.

## Current mode

- Repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`
- Active experimental branch: `agent/v15-native-deck-intelligence`
- Active PR: #29
- Active milestone: **BENCH-01**
- Intelligence development paused: **no**
- Reason: BENCH-01 remains active. Cross-family breadth generalization has completed: Animated Army independently reproduces the Explorers bounded-search sensitivity while Elven Empire is unchanged. Together with unchanged Quick Draw and Virtue controls, this establishes a generic candidate-discovery/ranking defect signal. The next gate is architectural diagnosis of pre-truncation discovery/ranking; no product change is accepted yet.

## Stable boundary

- Branch: `main`
- Version: `0.13.0`
- `server-current`: V0.13
- Stable promotion authorized: **yes**

## Experimental checkpoints

Development checkpoint at pause: `77a5383fa7490aa91360b8186a4bda890f632157`

The formal accepted development checkpoint remains 77a5383.... The latest fully validated executable Commander product remains e17b0a1cba659b229fd6f0b6e2df79c5e464a616. Candidate-breadth sensitivity now reproduces across two unrelated families from that unchanged frozen product: Explorers of the Deep improves from 4 swaps/Bracket 2 at breadth 4 to 9 swaps/Bracket 3 at breadth 6, and Animated Army improves from 9 swaps/Bracket 2 to 12 swaps/Bracket 3. Quick Draw, Virtue and Valor, and Elven Empire remain unchanged controls. This satisfies the cross-fixture evidence threshold for a generic bounded candidate-discovery/ranking defect signal, but does not authorize simply raising candidatePackagesPerRound. Diagnose the shared pre-truncation discovery/ranking mechanism and preserve downstream correctness gates before any product repair.

Latest fully validated executable experimental baseline recorded by project state:

- Branch: `agent/v15-native-deck-intelligence`
- SHA: `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`
- Scope: Fully validated generic neutral-theme taxonomy bridge for shared card-draw and lifegain semantics. Product code change is commit 387709983880fa2fd10c7f0aa50cd8b1524852f5; e17b0a1cba659b229fd6f0b6e2df79c5e464a616 differs only by persisted BENCH evidence documentation. Focused regressions cover standalone resolution/matching, unrelated compound decomposition and unchanged fail-closed unknown leftovers. Normal CI run 34006676470 passed project/state/index/recovery checks, build/type-check and the full repository test suite. Subsequent BENCH wrappers/evidence descendants are not newer formally validated product baselines.

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

- Active branch status: **bench01-candidate-discovery-ranking-diagnosis-active**
- Last persisted Marvel control source: `5829b37b686255ba35d419b37be17095e54fb696`
- Last persisted Marvel control outcome: **expected-ceiling-fail-closed-zero-swap**
- Note: At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

Required before resuming broad INTEL-01/INTEL-02 claims:

- Keep the latest fully validated executable Commander baseline e17b0a1cba659b229fd6f0b6e2df79c5e464a616 frozen while the shared candidate-discovery/ranking mechanism is diagnosed.
- Treat cross-family breadth reproduction as established: Explorers of the Deep and Animated Army improve at breadth 6, while Quick Draw, Virtue and Valor, and Elven Empire are unchanged controls.
- Do not equate the reproduced defect signal with authorization to raise candidatePackagesPerRound globally. Inspect pre-truncation candidate sources, ordering, deduplication, diversity, target coverage, and ranking; prefer benchmark-only diagnostics before product edits when mechanism evidence is incomplete.
- Do not weaken compound-theme/component preservation, legality, budget, printing, strategy-preservation, or simulation gates to manufacture target achievement.
- Keep the earlier Counter Blitz dense-countermagic allocation concern watch-only unless a broader cross-fixture batch reproduces it.
- Do not merge PR #29 or promote stable/current V0.13 until BENCH-01 becomes promotion-grade and all relevant validation evidence is green.

## Next actions

1. Inspect the shared bounded candidate-discovery/ranking implementation at frozen source e17b0a1c..., specifically the pre-truncation candidate sources, ordering, deduplication, target/component coverage, diversity and top-N selection used by candidatePackagesPerRound.
2. Instrument benchmark-only pre-truncation diagnostics on Explorers of the Deep and Animated Army, with at least one unchanged control, if source inspection alone cannot prove why breadth positions 5-6 expose viable accepted packages.
3. Only after the repeated mechanism is demonstrated, implement the smallest generic discovery/ranking repair; do not simply increase the global breadth cap and do not weaken downstream correctness gates.
4. Validate any exact repair SHA with focused regressions, full repository CI/build/state-integrity checks, then replay the positive fixtures and controls from one unchanged validated source before accepting it.
5. Keep PR #29 unmerged and stable/current V0.13 unchanged until BENCH-01 is promotion-grade.

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
- Repeated candidate-breadth sensitivity across unrelated benchmark fixtures is a generic candidate-discovery/ranking defect signal, but it does not by itself prove that a higher global breadth cap is the correct repair.
- Common Commander vocabulary must only become enforceable when it maps to generic measurable card semantics; never silently accept unknown leftovers.
- Never treat an unvalidated head or staged repair as an accepted checkpoint.
- No scenario-specific, card-name or benchmark-specific hacks; product changes require generic evidence.
- Stable/current promotion or PR merging requires complete validation, non-redundancy, safety and promotion-grade benchmark evidence. The user has granted standing authority to perform those actions once those gates are genuinely satisfied; no extra approval is required at that point.

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

Then: BENCH-01 remains active on frozen validated product e17b0a1c.... Cross-family breadth sensitivity now reproduces in Explorers of the Deep and Animated Army, while Quick Draw, Virtue and Valor, and Elven Empire remain unchanged controls. This is sufficient evidence of a generic bounded candidate-discovery/ranking defect signal, but not evidence that globally raising candidatePackagesPerRound is the right repair. Diagnose/instrument the shared pre-truncation mechanism first, preserve all downstream correctness gates, and only then consider a generic product repair. Stable remains V0.13 and PR #29 remains unmerged.
