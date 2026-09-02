# Ultimate MTG — Seven-Day Autonomous Commander Intelligence Plan

Execution window: **3–9 September 2026 (NZST)**  
Owner: **Codex / future development sessions**  
Active milestone: **INTEL-02 — Actual autonomous deck improvement**

This is an execution plan, not permission to merge or release. GitHub remains the source of truth. At the start of every session, read `project-state.json`, `validation-index.json`, the live experimental head, and PR #29 before following this file.

## Starting truth

- Stable remains `main` / V0.13. No stable promotion, version bump, release, or PR #29 merge is authorized.
- Active experimental branch: `agent/v15-native-deck-intelligence`.
- Accepted development checkpoint: `77a5383fa7490aa91360b8186a4bda890f632157`.
- Current executable evidence source at plan creation: `4d4287d19c0768db51cbfb72bf797931ccbbfeb5`; later `test-results` descendants do not create a newer executable source.
- CI, generic strategy inference, Necron Dynasties, Squirreled Away, Food and Fellowship, focused Marvel, Liliana NZ$500, and printing-family proof executed successfully at that source.
- Broad permanent-family Marvel remained red with no supported swaps and unchanged Bracket-5 blockers.
- Mechanical green is not accepted intelligence evidence until every IN→OUT package is manually defensible.
- The current Squirreled Away result still contains `Second Harvest` OUT despite the new token-multiplier role, and Food and Fellowship still contains `Chromatic Lantern` OUT. This proves the semantic protection has not yet propagated through every summary/affinity/pairing stage.

If live GitHub disagrees with this snapshot, GitHub wins. Update the working diagnosis, not history.

## Justin's standing quality rules

1. Improve the actual deck, not a generic score or role count.
2. Preserve the commander's plan, supported secondary plans, important engines, finishers, interaction, recursion, board wipes, coloured mana, and premium early acceleration.
3. Do not turn recognisable precon upgrades into generic good-stuff decks.
4. Do not collapse a multi-route deck into one infinite combo unless the request explicitly asks for that.
5. Never add a card-name, commander-name, product-name, or benchmark-specific exception to force a pass.
6. Fix Oracle-semantic classification, whole-deck reasoning, candidate generation, pairing, or evidence flow generically.
7. A workflow exit code proves execution. It does not prove the deck became better.
8. Treat unavailable, partial, truncated, stale, or conflicting provider evidence as unknown—not absence.
9. Prefer an honest no-change result over a weak or identity-damaging swap.
10. Do not repeatedly ask for routine direction. Ask Justin only for a merge/promotion/release, a genuinely contradictory deck objective, an irreversible action, or a choice that would materially change the intended play experience.

## Autonomous development loop

Use this loop for every work item:

1. **Synchronise:** fetch the live branch, read project state, identify the latest executable SHA separately from evidence-only descendants, and inspect active workflows.
2. **Reproduce:** prove the problem from persisted evidence or a focused deterministic test before changing source.
3. **Shrink:** reduce the failure to a name-independent Oracle-text fixture whenever possible.
4. **Diagnose the layer:** card truth → effective roles → strategy inference → candidate summary → cut pairing → package audit → final whole-deck evaluation.
5. **Fix generically:** make the smallest rule change that addresses the demonstrated class of failure.
6. **Challenge the fix:** add positive, negative, renamed-card, and boundary cases so the new rule cannot become an over-broad protection blanket.
7. **Validate locally:** focused tests, full deterministic suite, TypeScript build, project-state validation, and validation-index validation.
8. **Commit one executable source:** do not mutate source again while an exact-source family validation is being assembled.
9. **Run affected live controls:** preserve exact `source_sha`, legality, exact 100, budget, printing policy, provider state, target movement, and strategy evidence.
10. **Manually audit every accepted swap:** Oracle function, deck role, reason for cutting it, replacement equivalence, package interaction, and final deck consequences.
11. **Record the lesson:** add or update a `KF-*` entry and validation-matrix protection for every material false green.
12. **Accept or reject honestly:** only a mechanically green and manually acceptable same-source family may support a new checkpoint.

## Upgrade acceptance checklist

Every accepted package must answer **yes** to all applicable questions:

- Is the final command zone legal, colour-identity legal, singleton legal, and exactly 100 cards?
- Are exact physical-printing, family/set, protected/excluded card, combo-style, and hard-budget constraints still satisfied?
- Does the package repair or measurably advance a real failed target gate?
- Does it avoid regressing every previously passing authoritative gate?
- Is every outgoing card genuinely more cuttable than the incoming card is valuable in this exact deck?
- Are primary and supported secondary strategies preserved at whole-deck and per-swap levels?
- Are unique engines/payoffs replaced by equivalent functions rather than merely equal archetype points?
- Are coloured mana, early acceleration, interaction, wipes, recursion, card advantage, and route resilience still practically usable?
- Does independent final evaluation recognise any claimed winning package?
- Would a knowledgeable Commander player prefer the complete post-swap deck, not just the metric report?

If any answer is no or unsupported, reject the package and keep the original deck.

## Day 1 — Reconcile current evidence and complete the human audit

Goal: establish one honest verdict for every result produced from executable source `4d4287d...`.

Tasks:

- Let already-running source-bound workflows finish; do not start duplicate runs while their state is knowable.
- Rebuild the validation index from current persisted metadata and identify mixed/stale results.
- Audit all accepted swaps in Necron Dynasties, Squirreled Away, Food and Fellowship, focused Marvel, and any accepted full-family package.
- For each swap, record: outgoing Oracle role, incoming Oracle role, target-gate movement, strategy component lost/replaced, mana/interaction consequences, and verdict.
- Explicitly recheck these observed concerns:
  - `Second Harvest` → `Fake Your Own Death`;
  - `Chromatic Lantern` → `Weathered Wayfarer`;
  - `Venom's Hunger` → `Quicksilver, Brash Blur`;
  - `Fantastic Bounce` → `Sword of Fire and Ice`;
  - `Shard of the Nightbringer` → `Myr Retriever`.
- Distinguish acceptable contextual trades from false-green engine replacement. Do not create rules from names.

Exit gate: every accepted package has an explicit human verdict; any rejected mechanical green is recorded as a current blocker.

## Day 2 — Make semantic protection reach the actual selector

Goal: close the gap between a correct helper-level role and the live package decision.

Experiments:

- Trace token-multiplier truth through `effectiveCardRolesV15`, candidate summarisation, commander-strategy affinity, cut pressure, per-swap component preservation, and aggregate package audit.
- Use synthetic renamed cards with text such as “create a token that's a copy of each token you control” and token-replacement wording.
- Prove a substantive token multiplier cannot be exchanged for one-shot protection, recursion, a tutor, or generic token creation in a supported token deck.
- Prove a low-value one-shot token maker remains cuttable; the protection must not freeze every card containing the word “token.”
- Replace the blanket colour-source count model with quality-aware tests where needed:
  - universal fixing rock versus conditional land-to-hand tutor;
  - three-, four-, and five-colour command zones;
  - healthy fixing surplus versus fragile colour access;
  - equivalent persistent fixing replacement versus unrelated upgrade.
- Prefer a measured colour-access/casting regression check over permanent protection of every three-mana rock.

Exit gate: name-independent regressions fail before the repair and pass afterward; Squirrels and Food no longer repeat the rejected swap class unless a whole-deck counterfactual demonstrates it is genuinely safe.

## Day 3 — Produce one common exact-source INTEL-02 family

Goal: remove mixed-source ambiguity.

Run from one frozen executable SHA:

1. project integrity and validation-index checks;
2. full deterministic suite and TypeScript build;
3. generic strategy-inference regression;
4. Necron Dynasties unrestricted precon refinement;
5. Squirreled Away unrestricted precon refinement;
6. Food and Fellowship Middle-earth refinement;
7. focused Marvel refinement;
8. broad permanent-family Marvel refinement;
9. Marvel + Middle-earth full-family printing control.

Rules:

- No source edits during the batch.
- Provider outages remain `verification-unavailable`; retry once after the normal cooldown, then move to offline work.
- Evidence writers may add result-only descendants, but every metadata file must retain the same executable `source_sha`.
- Manually audit every accepted package from this exact source before changing checkpoint state.

Exit gate: either the complete family is mechanically green and manually acceptable, or the exact failing capability becomes the next work item.

## Day 4 — Resolve broad Marvel without forcing Bracket 5

Goal: determine whether broad Marvel is blocked by the legal card pool, evidence, or algorithm.

Investigations:

- Inspect why the current run has no eligible package despite deficits in fast mana, tutor consistency, verified winning route, and competitive evidence.
- Separate four causes: no legal physical printing, package exceeds swap capacity, candidate discovery/ranking misses an eligible card, or no safe cut exists.
- Verify that restricted-pool enumeration is exhaustive within declared ceilings and that candidate ordering cannot hide eligible cards.
- Test whether incremental fast-mana/tutor progress is independently worthwhile when no verified route can be injected.
- Compare “no change” against every candidate package as a real alternative.
- If the family restriction genuinely cannot support Bracket 5, return the strongest honest lower ceiling with exact blockers instead of weakening standards.

Exit gate: broad Marvel either accepts a manually defensible target-improving package or produces complete evidence for an honest no-change/under-target ceiling. A forced green is a failure.

## Day 5 — Close the positive INTEL-01 proof gap

Goal: prove deliberate win-package intelligence end to end.

Build one positive scenario where a legal two- to four-card verified full-table route exists and is feasible under the active constraints. Prefer an unrestricted or naturally eligible test case; do not choose cards because their names make the test easy.

The control must prove:

- bounded discovery finds the route;
- every card and printing is legal and affordable;
- full-table closure is independently verified;
- missing pieces fit available swap capacity;
- the package is injected atomically;
- existing pieces are protected from cuts;
- the final 100-card evaluator independently recognises the route;
- the surrounding deck remains coherent and retains meaningful alternate routes.

Companion negative tests:

- single-target or unscoped “infinite damage” is rejected;
- unavailable/truncated Spellbook evidence remains unknown;
- an oversized preferred package cannot hide a smaller feasible package;
- a package with unacceptable dead-card burden or strategy damage loses to no change.

Exit gate: one exact-source positive integration result plus all negative boundaries. Do not mark INTEL-01 validated from unit tests alone.

## Day 6 — Begin BENCH-01 only if Days 3 and 5 pass

If the consolidated INTEL-02 family and positive INTEL-01 proof are not complete, use this day for deterministic adversaries, manual audits, and whole-deck counterfactual tooling instead. Do not skip the gates merely to reach a more interesting deck.

### Pilot A — Final Fantasy-only Counter Blitz

Required identity:

- Tidus, Yuna's Guardian remains commander;
- Bant legality with no red mana or off-colour cards;
- Final Fantasy physical printings only;
- +1/+1 counter movement, proliferate, counter payoffs, and dense countermagic remain central;
- preserve a meaningful counters/combat plan rather than reducing the deck to Walking Ballista plus one line;
- compare against the exact stock precon and show all IN→OUT changes.

### Pilot B — Liliana, Heretical Healer under NZ$500

Required identity:

- preserve the Zombie/aristocrats and graveyard plan;
- retain important pieces already identified by Justin, including Buried Alive, Warren Soultrader, Gravecrawler, Blood Artist, Mirkwood Bats, and Plague of Vermin when legal under the exact benchmark input;
- target roughly six to eight quality sacrifice outlets rather than counting self-sacrificing utility;
- spend budget headroom only when it improves the whole deck;
- reject generic equipment/artifact packages that displace the actual engine;
- report exact NZD price provenance and an honest achieved ceiling.

For both pilots, save stock/input, complete candidate output, exact diff, rejected packages, constraints, and manual review. One strong result cannot erase a failure in the other archetype.

Exit gate: reusable benchmark fixtures exist; intelligence claims remain limited to what each scenario proves.

## Day 7 — Counterfactual review, consolidation, and next queue

Goal: leave the repository easier to resume and harder to fool.

Tasks:

- Compare original versus final legal 100-card states for at least three materially different scenarios under identical seeds/evidence.
- Report target-gate deltas, mana and colour access, interaction/protection, recursion, route access, strategy support/density, price, and simulation limitations.
- Confirm every new material failure has a `KF-*` entry, deterministic regression where possible, and validation-matrix mapping.
- Remove no evidence and do not rewrite failed history as success.
- If and only if the complete same-source INTEL-02 family is green and manually accepted, update `project-state.json`, generated project/handoff docs, validation index, and validation snapshot together.
- If and only if the positive INTEL-01 integration also passes, record that proof without promoting stable.
- Prepare the next ordered queue from unresolved evidence.
- Produce a short weekly report: accepted improvements, rejected false greens, remaining blockers, exact source SHAs, and recommended next experiment.

Exit gate: a fresh session can recover the exact truth in under five minutes and immediately continue the highest-priority unresolved item.

## Background experiment queue

Use these while live workflows run or providers cool down:

1. **Metamorphic renaming:** rename commanders/cards while preserving Oracle text and prove decisions do not change.
2. **Oracle-text mutation:** vary punctuation, sentence order, DFC faces, pluralisation, delayed triggers, and conditional clauses.
3. **Role-boundary pairs:** create near-identical positive/negative cards for ramp versus filtering, tutor versus narrow search, recursion versus graveyard movement, outlet versus self-sacrifice, and repeatable versus one-shot engines.
4. **Identity ablation:** remove one bridge/engine at a time and verify the inferred primary/secondary plan changes for the right reason.
5. **Safe-cut reachability:** fill top heuristic slots with protected cards and prove finite search still reaches a lower-ranked safe cut.
6. **No-change oracle:** generate decks where every legal swap is neutral or harmful and require the optimizer to stop.
7. **Constraint fuzzing:** combine protected/excluded cards, exact sets, family restrictions, DFC commanders, partners, singleton, and hard budget boundaries.
8. **Package overlap:** test routes sharing pieces and tutors without double-counting one physical card.
9. **Interruption/resilience:** compare fragile one-shot lines with recoverable or overlapping routes; record what the simulator actually models.
10. **Exact-versus-simulation calibration:** use mathematically solvable opening-hand/package cases as Monte Carlo oracles.
11. **Counterfactual A/B/C:** compare several complete legal packages plus no change under the same deck fingerprint and seed.
12. **Explanation audit:** ensure accepted and rejected swaps name the real deck reason, not generic “synergy” language.

## Priority and interruption rules

Work in this order:

1. hard legality, printing, budget, or source-truth defect;
2. false-green deck-quality or strategy-preservation defect;
3. exact-source validation blocker;
4. broad Marvel / target-aware candidate gap;
5. positive INTEL-01 package proof;
6. BENCH-01 expansion;
7. later simulation, learning, UI, or feature breadth.

When blocked:

- **Workflow running:** perform manual audit or deterministic experiment design; do not mutate the source being validated.
- **Provider unavailable:** preserve unknown status, retry once after cooldown, then switch lanes.
- **Evidence writer advances the branch:** keep the executable source separate from result-only descendants and never combine mixed-source claims.
- **A fix helps one scenario but harms another:** revert its claim, add the counterexample, and redesign the abstraction.
- **Two repeated failures in the same layer:** stop patching symptoms and write a layer-level invariant before more code.
- **No supported improvement exists:** accept no change and document the ceiling.

## End-of-week success standard

The week is successful if it produces truthful reusable evidence, even if every benchmark does not turn green. The strongest target outcome is:

- one frozen executable SHA with green CI and a complete same-source INTEL-02 control family;
- every accepted swap manually approved;
- broad Marvel either genuinely improved or honestly proven constrained;
- one positive end-to-end verified full-table package proof;
- Counter Blitz and Liliana benchmark fixtures started only after their prerequisites;
- all discovered false greens converted into permanent generic regressions;
- no card-name hacks, stale-evidence claims, automatic stable promotion, or PR merge.

## Required final handoff format

At the end of each session, record:

```text
Observed branch head:
Executable source under test:
Accepted development checkpoint:
Changes made:
Focused tests:
Full suite/build/state checks:
Live controls started/completed:
Manual swap verdicts:
New or updated KF entries:
Current blocker:
Exact next action:
Stable/PR status:
```

This format is mandatory for autonomous continuity; never substitute “tests passed” for the exact source, scope, and remaining blocker.
