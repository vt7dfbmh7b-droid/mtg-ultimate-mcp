# Ultimate MTG Roadmap

This roadmap converts the north-star specification into bounded development milestones. `project-state.json` is authoritative for which milestone is active now and for the exact next actions. Scheduled/autonomous work must read that state first, reconcile it against newer committed evidence and live GitHub status, execute forward work, then update state/roadmap/handoff/validation records in the same run whenever a material milestone, blocker, accepted source, benchmark verdict or next action changes. Do not allow stale roadmap wording to recreate completed work.

## North star

Build the best evidence-backed autonomous Commander deck-building intelligence we can, then prove it deserves to be trusted.

The intended end state is a Commander specialist that can outperform a strong general-purpose AI on Commander deck construction through deeper domain focus, structured evidence, exhaustive checking, counterfactual comparison, and consistent verification.

## PM-01 — Persistent Project State & Handoff Automation — VALIDATED

Goal: stop treating chat history as project memory.

Delivered:
- `project-state.json` is the machine-readable current-state authority;
- `docs/PROJECT-STATE.md` and `PROJECT_HANDOFF.md` are generated from it;
- architecture decisions, known failures, roadmap and validation matrix are committed;
- CI detects state/handoff drift;
- a self-reporting integrity control binds project-management typecheck/state validation/source build to an exact source SHA;
- scheduled/autonomous recovery is expected to reconcile stale state against newer GitHub evidence before continuing and to persist material state changes before ending a run.

Initial validated control:
- `test-results/project-management/integrity.txt`
- source `73366cf57c055fc0ae7831209ad155b360bf036f`
- project-management typecheck: success
- state validation: success
- normal source build: success

## PM-02 — Validation State Indexing — VALIDATED

Goal: stop making fresh chats hunt through individual result directories to determine what is current, stale, passing or failing.

Delivered:
- `validation-registry.json` registers high-value controls needed for recovery and milestone claims;
- `validation-index.json` is deterministically generated from registry + persisted metadata + project state;
- `docs/VALIDATION-STATE.md` is the generated human snapshot;
- index records bind tested source SHA, pass/fail/unknown state, claim level and checkpoint match;
- CI fails on a stale validation index;
- the self-reporting PM integrity control regenerates the index whenever it updates its own persisted result;
- `npm run project:resume` derives a fresh-session recovery brief without old chat history or individual result-folder inspection.

## INTEL-01 — Win-package intelligence — VALIDATED

Goal: very-good verified win-package reasoning.

Validated direction includes:
- bounded but deep Commander Spellbook discovery with honest incomplete-evidence semantics;
- exact commander legality/color/printing/budget filtering;
- multiplayer full-table closure aligned with final evaluation semantics;
- package feasibility against swap capacity;
- atomic package injection;
- protection of already-present package pieces;
- R/competitive preference among feasible verified packages;
- no false absence when discovery is truncated or unavailable;
- final route recognition, alternate-route retention, route setup/interruption and exact tutor/access auditing.

The exact-source positive control at `5829b37b686255ba35d419b37be17095e54fb696` is green and retains four verified full-table routes with two distinct library routes. BENCH-01 still tests whether this intelligence translates into better complete decks across adversarial archetypes.

## INTEL-02 — Actual autonomous deck improvement — IMPLEMENTED / BENCHMARK VALIDATION PENDING

Goal: improve the deck that exists, not an abstract score.

The role-truth, structural-floor and package-preservation hardening is implemented far enough for adversarial benchmarking. The complete dependent family was replayed from one frozen executable source, `5829b37b686255ba35d419b37be17095e54fb696`.

On that replay:
- Food and Fellowship, Necron Dynasties, Squirreled Away and Scions & Spellcraft are mechanically green and manually acceptable with recorded watch items;
- the earlier Food false green that spent `Well of Lost Dreams` on one-shot interaction did not recur;
- generic strategy/resource/component guards remained active;
- Marvel focused and broad fail closed with zero swaps because the restricted pool cannot satisfy the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure;
- that Marvel result is an expected construction ceiling, not target achievement and not a reason to relax standards;
- the themed special-printing audit is provider-unknown after Scryfall HTTP 429, not evidence of absence and not a BENCH-01 blocker.

The formal accepted development checkpoint remains `77a5383fa7490aa91360b8186a4bda890f632157`. The current fully validated executable BENCH product source is `dd085caf4e47f6f5e1976667dc90de2db46c00a1`, which contains the generic compound-component preservation repair. It is a validated experimental replay baseline, not a stable promotion or proof of benchmark superiority.

## BENCH-01 — Adversarial Commander benchmark suite — ACTIVE

Goal: measure intelligence rather than anecdotes and determine whether the specialist actually beats strong general-purpose AI on complete Commander deck decisions.

Operating rules:
- freeze executable source for each benchmark batch;
- run several unseen, contrasting fixtures before changing Commander intelligence;
- never add card-name or scenario-specific hacks merely to pass a fixture;
- score hard truth before subjective quality;
- compare complete 100-card outputs under identical commander, budget, theme/printing and bracket constraints;
- record concrete expert-review wins, losses and ambiguous trade-offs;
- distinguish provider/harness failure, expected construction ceiling, target movement, target achievement and formal validation;
- only convert repeated cross-fixture weaknesses into generic remediation work;
- a green workflow is not enough: inspect the resulting legal 100-card deck and whether the requested strategy actually improved.

### Batch A — COMPLETE — pre-repair product baseline `5829b37...`

#### Counter Blitz / Tidus, Yuna's Guardian
Constraint family: FINAL FANTASY printings only; Bant +1/+1 counters/proliferate; dense countermagic; hybrid combat/combo identity.

Specialist outcome:
- exact 100, Commander legal and FF-printing compliant;
- natural compound request `+1/+1 counters proliferate countermagic combat` was rejected as `unsupported-theme`;
- zero swaps, leaving the stock deck unchanged;
- specialist therefore failed the substantive improvement request despite hard-truth compliance.

Locked strong general-AI baseline:
- 18 legal FF-only swaps;
- materially improved countermagic/protection/access and added verified combo routes;
- remained Bracket 3 rather than reaching the requested aspirational ceiling.

Verdict: **decisive general-AI win**. This is permanent pre-repair evidence and must not be relabelled after later repairs.

#### Liliana, Heretical Healer // Liliana, Defiant Necromancer — NZ$500 whole-deck budget
Specialist outcome:
- exact 100 and legal mono-black construction;
- audited total NZ$443.21, leaving NZ$56.79 headroom;
- strong graveyard/reanimator + aristocrats identity;
- three verified winning combos sharing one Warren Soultrader + Gravecrawler core;
- strong competitive-construction signals and Bracket 4 assessment.

Locked strong general-AI baseline:
- exact 100 and legal;
- much greater raw combo diversity;
- NZ$960.79 whole-deck cost, exceeding the NZ$500 hard limit by NZ$460.79.

Verdict: **decisive specialist win** because central hard-budget truth outranks raw power gained by violating the request.

### Batch A aggregate pre-repair verdict

**Specialist 1 — General AI 1. `split-not-promotion-grade`.**

This result is permanent benchmark evidence. Do not regenerate the locked baselines after seeing specialist outputs and do not relabel either outcome because later repairs improve the system.

### Batch B first unseen fixture — Cavalry Charge — PRE-REPAIR DEFECT REPRODUCTION COMPLETE

Constraint family: Knights typal + combat + graveyard recursion/reanimation, target Bracket 4 assessment, NZ$35 maximum per added card, NZ$200 total upgrade budget, maximum 12 swaps.

Pre-repair outcome:
- exact 100 and Commander legal;
- natural request `Knights typal combat graveyard recursion reanimation` was rejected as `unsupported-theme`;
- zero swaps;
- same centralized compound free-form theme rejection as Counter Blitz.

Verdict: **independent cross-fixture reproduction of the compound-theme parsing defect**. Together with Counter Blitz, it justified one generic controlled repair.

### Controlled compound-theme parsing repair — VALIDATED

Root cause was centralized in the neutral-theme resolver: compound free-form requests were intentionally fail-closed before controlled decomposition.

The generic repair now:
- preserves exact single-theme behavior;
- accepts a compound request only when the entire request decomposes into known controlled facets;
- preserves explicit component metadata;
- keeps unknown leftovers fail-closed rather than silently dropping them;
- never executes raw user text as Scryfall/provider query grammar;
- preserves the bounded combat discovery contract `(o:attack OR o:"combat damage")`;
- contains no Counter Blitz, Cavalry Charge or card-name special cases.

Accepted parser-repair source: `ce4c9eba59617be2cf57718408b40252230bccf4`.

Validation evidence:
- dedicated run `33958162827` passed the focused neutral-theme regression suite;
- the same clean locally committed product tree passed the full repository test suite;
- the same tree passed build;
- temporary one-shot repair workflow/script surfaces were absent from the accepted product commit before validation/publish.

This closed the parser-validation gate. It did **not** establish benchmark superiority.

### Repaired Cavalry Charge replay on `ce4c9eba...` — COMPLETE — component regression found

Result:
- compound request resolves rather than failing closed;
- refinement executes and accepts 8 swaps;
- exact 100 and Commander legality remain true;
- about NZ$32.12 total upgrade spend, within the NZ$200 total limit and NZ$35 per-added-card cap;
- 8 swaps remain within the 12-swap limit;
- assessed bracket moves 2 → 3, but target Bracket 4 is not achieved;
- average nonland MV improves 3.34 → 2.97;
- early plays improve 19 → 26;
- cheap interaction improves 3 → 6;
- tutors improve 0 → 2;
- recursion improves by 3;
- graveyard-reference count improves by 2;
- Knight creature count falls **32 → 27**;
- combat-reference count falls **21 → 17**.

Verdict: meaningful target movement but not a benchmark pass. Aggregate OR-style theme satisfaction remained compatible with regression in explicit components.

### Repaired Counter Blitz replay on `ce4c9eba...` — COMPLETE — same component defect reproduced

Workflow run `33958274005` completed successfully from the same frozen parser-repair source.

Persisted paired evidence shows:
- aggregate themed cards **53 → 55**;
- instant/sorcery references **37 → 40**;
- counter-related references **51 → 53**;
- proliferate **4 → 2**;
- aggregate theme density **86 → 88** and aggregate target remains green;
- proliferate target fails.

Verdict: **independent cross-fixture reproduction of the same component-compensation defect**. Cavalry and Counter together established a generic correctness blocker and authorized one narrow component-level repair.

### Generic compound-component preservation repair — VALIDATED

Root cause: compound matching is intentionally OR-style for aggregate discovery/audit, while `candidateThemeGateV15()` previously compared only aggregate before/after counts. That let improvement in one controlled component compensate for loss in another.

The generic candidate-acceptance repair now:
- operates only on controlled `components[]` metadata;
- independently audits every component before and after a candidate package;
- prevents any previously satisfied component from being pushed below its own controlled target;
- prevents any below-target component from moving backward while gains elsewhere compensate;
- fails closed when component evidence is missing, inconsistent or cannot be bound exactly;
- preserves existing aggregate theme gating after component checks;
- leaves single-theme behavior unchanged;
- retains legality, budget, printing, strategy-retention, package-acceptance and bracket-target gates unchanged;
- contains no deck, commander or card-name special cases.

Implementation commit: `d0e40cadee555468b9b5574234d1b63b477f8b55`.
Focused regression commit / final combined product source: `dd085caf4e47f6f5e1976667dc90de2db46c00a1`.

Validation evidence:
- focused deterministic tests cover satisfied-component preservation, below-target non-regression, fail-closed missing/inconsistent evidence and unchanged single-theme aggregate behavior;
- normal CI run `33972639473` on exact final SHA `dd085caf...` passed project-management tooling checks, state validation, validation-index validation, fresh-session recovery smoke test, type-check/build and the full repository test suite;
- therefore `dd085caf...` is the frozen validated product source for the paired post-repair replay.

This validates the generic repair mechanically. It does **not** prove the benchmark blocker is closed until the two affected fixtures are replayed from this exact unchanged source.

### Paired post-repair replay — NEXT

Freeze `dd085caf4e47f6f5e1976667dc90de2db46c00a1`. Do not change `src/**` between these fixtures.

1. **Counter Blitz** — rerun the same FF-only Bant +1/+1 counters/proliferate/countermagic/combat request. Confirm proliferate no longer regresses, then judge legality, FF printing truth, counters, countermagic, combat identity, protection/access, verified routes, curve, bracket truth and the complete deck against the locked 18-swap general-AI baseline.
2. **Cavalry Charge** — rerun the same Knights typal + combat + graveyard recursion/reanimation request with NZ$35 per-card, NZ$200 total and 12-swap caps. Confirm Knight/combat components are preserved while recursion/structural improvements, legality, budget and whole-deck coherence remain acceptable.
3. Interpret both together. Record every controlled component before/after. Aggregate theme density alone cannot close the blocker.

If both fixtures show the compensation defect closed without unacceptable strategy/quality regression, close this correctness blocker and move to several unseen contrasting BENCH-01 fixtures before any further intelligence edit. If the pair exposes another repeated generic defect, localize it from cross-fixture evidence and authorize only the smallest generic repair that addresses it.

### After the compound-quality blocker

Continue several unseen fixtures before making another product change. Remaining benchmark families include:
- combat/commander-damage;
- compact combo;
- hybrid combat-combo;
- aristocrats;
- control;
- typal/tribal;
- graveyard/reanimator;
- counters;
- spellslinger;
- equipment;
- budget constrained;
- exact printing-family/theme constrained;
- unusual partner pairs;
- high Bracket 4;
- Bracket 5 / cEDH-ish construction.

Scored dimensions:
- Commander legality, exact 100, singleton/color identity;
- exact printing-family/theme restrictions and hard budgets;
- target-gate movement and bracket truth;
- win-route correctness, closure and resilience;
- primary/secondary strategy preservation;
- cut quality and structural-card losses;
- mana, interaction, card advantage and resource-engine structure;
- probability/simulation improvement where the claim is supported;
- spend efficiency;
- complete-deck coherence;
- explanation quality;
- expert manual comparison against the strong general-AI baseline.

### Promotion gate

V0.15 is **not promotion-ready today**. The parser repair and component-preservation repair are both mechanically validated, but the post-repair paired benchmark replays and broader superiority evidence are still required. PR #29 and stable V0.13 remain unchanged for now.

The user has granted standing authority for autonomous merge/promotion once the evidence genuinely supports it. No additional approval is required when all relevant work is fully validated, non-redundant, safe, blocker-free and broad BENCH-01 evidence shows the Commander specialist consistently deserves promotion. Merge/promotion must never be done merely to tidy branches or because experimental work exists; persist the validating evidence and update project state in the same run.

## INTEL-03 — Human-level strategic reasoning layer — PLANNED

Goal: represent why cards and packages matter to this deck.

Planned concepts:
- commander role and dependency graph;
- primary, secondary and fallback game plans;
- synergy clusters and shared-core cards;
- structural-card importance / cut blast radius;
- setup cost, interruption exposure and recovery;
- dead-piece risk and card-role reuse;
- package overlap and redundancy;
- meta-sensitive interaction needs;
- deck identity / theme preservation.

Do not start broad INTEL-03 feature development merely because it is planned. BENCH-01 evidence must demonstrate a repeated generic strategic-reasoning need first.

## INTEL-04 — Counterfactual deck comparison & expert explanation — PLANNED

Goal: compare whole legal deck states, not isolated card grades.

Expected behavior:
- original deck vs candidate A/B/C under identical seeds/evidence;
- explicit hard-gate deltas;
- route-access and resilience deltas;
- mana/curve/interaction effects;
- price and printing truth;
- strategy trade-offs;
- smallest coherent improvement preference;
- expert-quality explanation of both accepted and rejected swaps.

Do not start broad INTEL-04 feature development until BENCH-01 shows that missing counterfactual reasoning is a repeated product weakness rather than a benchmark-specific symptom.

## Later phases

Potential later work is intentionally subordinate to demonstrated Commander intelligence:
- richer tournament/meta learning;
- historical model evidence;
- personalized pilot preferences;
- additional formats;
- UI polish and convenience features.

Do not add breadth merely because it is possible. New work should either improve Commander expertise, verification, autonomous decision quality, or the evidence used to prove those qualities.
