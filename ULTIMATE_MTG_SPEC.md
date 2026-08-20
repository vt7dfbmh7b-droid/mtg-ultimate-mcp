# Ultimate MTG — Master Product & Engineering Specification

_Last updated: 2026-08-17 NZST_

This is the **north-star specification** for Ultimate MTG. It records the long-term product goals, engineering rules, benchmark philosophy, learning architecture, and V1 exit criteria.

- `ULTIMATE_MTG_SPEC.md` = what the project is meant to become.
- `PROJECT_HANDOFF.md` = where development currently is and exactly how to resume.

A future session should read both before making major architectural changes.

---

## 1. Product goal

Build a genuinely high-confidence **Ultimate Magic: The Gathering MCP/plugin** combining:

- card and rules knowledge;
- Commander legality and construction;
- exact physical printing identity;
- real stock precons;
- full-deck building and upgrading;
- combo and winning-package discovery;
- exact probability and simulation;
- bracket / cEDH assessment;
- collection-aware recommendations;
- NZD-first pricing and NZ availability;
- research and source-health tracking;
- evidence-aware machine learning;
- external differential testing;
- drift detection and long-term self-correction.

The central promise is:

> **Respect the user's constraints, build the strongest valid answer inside them, and report the honest ceiling with evidence.**

The system must never force the requested answer merely because the user asked for it.

---

## 2. Release philosophy

### Stable line

At the time of this specification:

- package version remains `0.13.0`;
- V0.13 is the stable runtime line;
- `src/server-current.ts` deliberately returns `createMtgServerV13()`;
- V0.14 and V0.15 functionality may exist and be extensively tested without becoming the default runtime.

This separation is intentional.

### Promotion rule

A new runtime is promoted only when its intelligence has survived meaningful legality, source, regression, control, and real-world benchmark tests.

**Code existing is not evidence that it is ready to become stable.**

---

## 3. Current foundation picture

A previous engineering judgement described the project as roughly **80–85% of the way to a strong V1 foundation**. This is not a measured metric and should not be treated as one.

### Strong foundations

- Commander legality, color identity, singleton rules, commander/partner handling, and exact 100-card validation.
- Exact physical-printing restrictions and themed-printing enforcement.
- MTGJSON-backed stock Commander precon retrieval.
- Full-deck construction and iterative refinement.
- Competing upgrade packages, protected cards, budgets, and exact IN/OUT tracking.
- NZD-first user-facing pricing with source currency retained where required.
- Unit tests, live-source tests, and real Commander E2E scenarios.
- Source diagnostics, freshness concepts, and conservative failure behavior.

### Intelligence still being hardened

- general winning-package discovery;
- honest bracket / ceiling assessment;
- cEDH construction and evidence quality;
- overlap-aware exact combo/tutor probability;
- simulation calibration against exact mathematical truth;
- real outcome learning and model promotion criteria.

### Deliberate V1 boundary

The internal simulator does **not** need to become a complete digital Magic rules engine before V1. It should be useful, deterministic where required, explicitly scoped, and testable against mature external engines for difficult rules/simulation cases.

---

## 4. Non-negotiable truth hierarchy

Ultimate MTG has a **hard truth layer** that machine learning and optimization may not override.

Hard facts include:

- Commander legality;
- color identity;
- banned/legal status from current authoritative data;
- exact 100-card construction;
- singleton requirements;
- unresolved card identities;
- exact physical-printing existence and user printing restrictions;
- known rules facts and verified combo requirements.

Learned systems may rank, estimate, prioritize, or recommend **only after** the hard gates pass.

A neural score must never turn an illegal deck into an eligible deck.

---

## 5. Core engineering principles

1. **Remove weaknesses before adding novelty.** Do not pile “AI” features on shaky foundations.
2. **Legality first.** No optimization may violate Commander rules or user restrictions.
3. **Physical cards are real objects.** One tutor or multi-role card cannot be credited twice in the same hand/line.
4. **Exact maths when possible.** Exact probability claims use integer/BigInt fractions.
5. **Simulation when necessary.** Monte Carlo is not a replacement for exact solvable cases.
6. **Exact cases become simulation oracles.**
7. **Research must track provenance, freshness, contradictions, and source independence.**
8. **External systems are differential oracles, not unquestioned truth.**
9. **Related evidence is lineage-deduplicated.** Shared underlying engines/data do not count as independent confirmation.
10. **Disagreements become investigations.** Resolved failures become permanent regression fixtures.
11. **Fail closed on facts.** Never invent a printing, rule, price, combo, or bracket justification.
12. **User constraints survive every stage.** Budget, theme, collection, protected/excluded cards, exact sets, preferred win routes, and playstyle are first-class.
13. **Do not optimize away deck identity.** A higher score is not automatically a better answer.
14. **Requested power is a target, not a forced label.**
15. **Experimental learned models remain shadow models until they repeatedly outperform simpler baselines on genuinely unseen real MTG data.**

---

## 6. Card, printing, legality, and rules intelligence

Ultimate MTG should:

- distinguish Oracle identity from physical printing identity;
- verify exact set, collector number, finish, promos, special releases, and themed variants;
- enforce Commander color identity and construction rules;
- validate commander/partner/background relationships where applicable;
- explain exact legality failures;
- use current authoritative sources for bans and rules;
- reason about difficult interactions with external mature engines as differential references where appropriate.

Long-term adversarial rules fixtures should cover stack interactions, replacement effects, triggers, state-based actions, commander-zone decisions, combat, and combo interruption.

---

## 7. Commander precons

The precon system should:

- retrieve actual stock products from structured maintained sources such as MTGJSON;
- preserve untouched stock lists and exact printing identity;
- support stock analysis without upgrading;
- compare stock vs proposed/upgraded lists exactly;
- report explicit adds/removes;
- avoid maintaining a giant manual historical product list when a reliable maintained source exists.

---

## 8. Deck import, persistent identity, and comparison

The project should support:

- common decklist formats;
- exact 100-card parsing;
- commander identification;
- duplicate detection;
- Oracle-aware and exact-printing-aware comparisons;
- stock-vs-upgraded diffs;
- deck A vs deck B comparisons;
- easy-copy output plus structured machine-readable output.

Long-term state must distinguish:

- real owned decks;
- owned singles;
- hypothetical builds;
- cards allocated to other decks;
- proxy-allowed vs physical-only modes.

A hypothetical deck discussion must never silently become “the user's owned deck.”

---

## 9. General deck builder

From-scratch building is constraint-driven.

Possible constraints include:

- commander(s);
- requested bracket / competitive level;
- total budget and max-per-card budget;
- exact sets or printing family;
- collection-only / collection-preferred mode;
- theme, tribe, mechanic, franchise;
- must-include cards;
- protected cards;
- excluded cards;
- desired/forbidden combo styles;
- preferred win routes;
- land-count bounds;
- local pricing region.

The builder must output a complete legal list and preserve the constraints through all later refinement.

---

## 10. Upgrade engine

Upgrading should:

- start from the actual supplied or exact stock list;
- preserve protected cards and commander identity;
- enforce budget and printing restrictions;
- avoid category-breaking swaps such as cutting required lands for unrelated spells without a mana justification;
- compare competing packages rather than greedily accept the first candidate;
- track every IN and OUT;
- recalculate deck size and legality after changes;
- reassess mana, interaction, draw, curve, resilience, and winning routes;
- be able to conclude that no worthwhile legal upgrade exists inside the constraints.

---

## 11. General winning-package discovery

This is a major V1 intelligence requirement.

The builder should not merely hope its draft happens to contain most of a combo. It should deliberately discover and evaluate compact Commander-legal winning packages before filling the rest of the deck.

Required pipeline:

1. discover candidate win packages from trusted combo/rules sources and internal knowledge;
2. verify Commander legality;
3. verify every required physical printing under the user's restrictions;
4. verify that the package **actually wins or decisively achieves the claimed result**;
5. record setup, mana, commander dependence, zones, timing, and interruption points where practical;
6. evaluate compactness, tutorability, redundancy, dead-card burden, resilience, and color/mana requirements;
7. deliberately seed the best appropriate package(s);
8. preserve alternate combat/value/commander routes when the user's goal calls for them.

A prior FF test exposed an important regression principle: a Ruthless-tagged interaction that creates a huge amount of life is not automatically a win condition. Strength tags and popularity are not substitutes for verified outcomes.

---

## 12. Exact probability roadmap

### A. Univariate hypergeometric

Exact single-bucket events, expectation, variance, complement, and physical support bounds.

### B. Disjoint package assembly

Exact multivariate probability of meeting required minima across disjoint role buckets.

### C. Overlap-aware assembly

Physical cards may satisfy multiple roles, but each sampled physical card may be assigned only once to simultaneous requirements.

Examples:

- universal tutor can find A or B;
- creature tutor can only find A;
- shared combo card appears in several alternative packages;
- one flexible card cannot satisfy two simultaneous slots by itself.

### D. Commander-zone awareness

Cards starting in the command zone are available by construction and are not ordinary draws from the 99/98-card library.

### E. Turn-by-turn access curves

Opening seven, natural draws, then simple deterministic draw effects where exact treatment is feasible.

### F. Resource/timing-aware access

Tutor mana, target availability, cast timing, commander dependence/tax, draw effects, and other stateful constraints.

Desired eventual query:

> What is the probability this Commander deck has access to at least one viable winning package by turn 4, accounting for tutors, interchangeable pieces, overlapping roles, natural draws, and the commander?

---

## 13. Simulation

Simulation complements exact maths for stateful problems.

Useful targets include:

- mulligans;
- mana/land development;
- commander deployment;
- interaction/protection access;
- win-package timing;
- combat clocks;
- recovery after disruption;
- selected matchup/game-state questions;
- alternative route selection.

Requirements:

- pinned seeds for reproducibility;
- explicit sample counts;
- statistical confidence / standard-error-aware tolerances;
- exact-solvable scenarios as simulator regression oracles;
- clear declaration of what the simulator does and does not model.

---

## 14. Competitive / cEDH layer

V0.14 contains dedicated competitive workflows for:

- cEDH readiness assessment;
- completing legal combo packages;
- competitive refinement;
- from-scratch competitive building.

Strong construction signals do **not** automatically certify Bracket 5/cEDH quality.

Competitive assessment should consider:

- verified deterministic winning packages;
- speed and compactness;
- fast mana;
- tutor quality/density;
- interaction and free interaction;
- protection;
- card advantage;
- commander value/dependence;
- mana-base quality;
- resilience/recovery;
- dead-card burden;
- current metagame evidence where available.

---

## 15. Honest bracket / ceiling framework

This must become a **plugin-wide result format**, not only a competitive feature.

Every build/upgrade workflow should be able to report something equivalent to:

```text
Requested: Bracket 5
Achieved: High Bracket 4
Confidence: High
Ceiling caused by:
- restriction A
- weakness B
- missing capability C

What would be needed to reach Bracket 5:
- specific change 1
- specific change 2
```

It should apply to:

- precon upgrades;
- budget builds;
- printing/theme-restricted builds;
- collection-only builds;
- unrestricted decks;
- competitive/cEDH builds.

The engine should distinguish whether the limiting factor is:

- the user's restriction;
- the commander/card pool;
- the current build algorithm;
- inadequate evidence to certify the target.

---

## 16. Permanent real-world control benchmarks

### A. Final Fantasy-only Bracket 5 challenge

> Build the strongest possible Commander deck using only legitimate Final Fantasy physical printings, targeting Bracket 5, and report the honest ceiling if Bracket 5 is not achievable.

This pressures printing verification, legality, color identity, 100-card construction, win discovery, combo correctness, tutors/redundancy, mana, interaction/protection, multiple win routes, exact probability, simulation, research, and bracket honesty.

**Failure to reach Bracket 5 is acceptable if the restriction genuinely causes the ceiling.**

FF builds should not automatically be reduced to one infinite line when combat/value/commander routes are part of the desired identity.

### B. Unrestricted cEDH / Bracket 5 control

> Build a genuine competitive deck without the FF printing restriction.

The existing Kinnan control verifies the engine can, under unrestricted conditions, produce a 100-card Commander-legal deck with a verified deterministic win, low curve, free interaction, fast mana, and strong competitive construction signals.

This control is essential: if the FF deck falls short but Kinnan succeeds, the restriction is a plausible ceiling. If both fail, the builder may still have an intelligence problem.

### Comparison rule

After meaningful builder/intelligence changes, run both controls and compare legality, win packages, speed, interaction, resilience, probability, and achieved ceiling — not just one scalar score.

---

## 17. Deep Research architecture

Research should combine evidence from appropriate sources such as:

- Scryfall/card/printing data;
- Commander Spellbook combo data;
- tournament/cEDH results;
- recorded games/outcomes;
- deck databases;
- community evidence;
- precon/product sources;
- market/NZ availability evidence.

Research records should track:

- freshness and observation time;
- source identity;
- evidence class;
- source quality;
- contradictions/conflicts;
- independence group;
- whether two apparent sources ultimately derive from the same underlying dataset or engine.

The goal is **research → cross-check**, not “ask one popular database what cards are common.”

---

## 18. Deep Learning architecture

V0.15 contains a real experimental neural ranking layer rather than a renamed scoring formula.

Current architectural intent:

1. **Transparent model first.** A simpler interpretable model is always the baseline.
2. **Neural shadow model second.** Current neural implementation is a deterministic two-hidden-layer MLP with backpropagation and L2 regularisation.
3. **Same-data comparison.** Neural and transparent models are evaluated on the same holdout.
4. **Leakage-safe temporal evaluation.** A later unseen holdout is required for meaningful evaluation.
5. **Hard MTG gates remain outside learning.** Legality, unresolved cards, exact card count, and printing-policy compliance cannot be overridden by a neural prediction.
6. **Promotion must be earned repeatedly.** The neural system should only influence normal recommendations after repeatedly beating the transparent baseline on genuinely unseen real MTG data and passing readiness/drift checks.
7. **Metagame drift can revoke confidence.** Severe drift blocks neural promotion until retraining and fresh temporal validation succeed.

Synthetic success is not sufficient evidence of production usefulness.

---

## 19. Learning corpus and leakage prevention

The learning corpus is a first-class engineering system, not just an array of training examples.

Records should preserve:

- outcome identity;
- observation time;
- source/evidence class;
- independent evidence group;
- leakage group;
- exact deck fingerprint;
- commander identity;
- normalized learning features;
- label/outcome;
- importance and metadata where justified.

### Exact deck fingerprinting

Fingerprint the exact deck using zone, quantity, normalized card name, set, collector number, and finish. The same Oracle list with different physical printings may therefore remain distinguishable when that distinction matters.

### Deduplication

Repeated reporting of the same underlying outcome must not artificially multiply evidence.

Do not incorrectly merge the same deck appearing at genuinely separate events/outcomes merely because its deck fingerprint is identical.

### Evidence independence

Track how many genuinely independent evidence groups and evidence classes support the corpus.

### Leakage grouping

Related records that could leak information across time splits must remain in one leakage group.

### Temporal split

Use later observations as the holdout. If any leakage group would appear on both sides of the split, keep the group together and treat overlap as a failed leakage check.

The neural and transparent models must be compared on the **same genuinely future holdout**.

---

## 20. Learning targets

Once a sufficiently independent real corpus exists, learned systems may help estimate/rank things such as:

- which swaps actually improve deck outcomes;
- which compact win packages perform best in practice;
- which protection/interaction packages correlate with success;
- which recommendations repeatedly fail;
- which mana-base choices improve real consistency;
- how archetype/metagame performance shifts over time;
- which recommendations are sensitive to pod/meta context;
- confidence that an upgrade materially improves a deck.

Learning should influence **ranking and prediction**, never hard legality/rules truth.

---

## 21. Self-correction loop

The intended whole-system loop is:

> **research → cross-check → build → simulate → test → observe outcome → learn → retest**

Live tests are specifically intended to discover bad assumptions rather than merely prove the system works.

When a bad assumption is found:

1. reproduce it;
2. identify whether the fault is code, data, source interpretation, rule assumption, ranker, or fixture;
3. fix the underlying issue rather than hiding it;
4. add a regression test/fixture;
5. rerun relevant controls.

A known example is the Kinnan seed-ranker case where a Leveler/Jace-style line was caught as an undesirable practical fallback and the unrestricted control now explicitly guards against it.

---

## 22. Pricing and New Zealand availability

NZD is the primary user-facing currency.

The pricing layer should:

- retain original source values/currency for auditability where useful;
- support exact-printing price identity;
- support max-per-card and total budgets;
- prefer current New Zealand availability when the task is NZ-local;
- distinguish converted reference value from an actual NZ landed/checkout price;
- report stale or unavailable listings honestly;
- never let price substitute for legality or deck quality.

---

## 23. Collection-aware intelligence

Long-term support should include:

- owned singles;
- real owned decks;
- hypothetical decks separately;
- cross-deck card allocation;
- proxy-allowed vs real-card-only mode;
- “use what I own first” optimization;
- purchase lists;
- NZD upgrade cost;
- missing-card prioritization by marginal improvement.

---

## 24. External differential oracles

Current/reference families include:

- `j4th/mtg-mcp-server` — independent MCP/deck-workflow comparison target;
- `nccurry/mtg-mcp` — statistics/evidence/reproducibility architecture reference;
- `Card-Forge/forge` — mature rules/simulation reference;
- `witchesofthehill/manabrew` — parity-harness methodology using Forge.

Forge and Manabrew count as one **`forge-family`** independence group.

Benchmark phases:

1. deterministic pinned snapshot comparisons;
2. optional live external benchmarks separate from deterministic CI;
3. generated/adversarial scenarios;
4. failing-case shrinking/minimization;
5. resolved disagreements saved as permanent regressions.

Licensing boundaries must be respected. Behavioral/reference comparison does not grant permission to copy implementation.

---

## 25. Adversarial and generated testing

Deliberately generate difficult scenarios including:

- randomized combat boards;
- stack interactions;
- commander-zone choices;
- combo interruption;
- overlapping tutors/roles;
- alternative packages sharing cards;
- mana/probability boundaries;
- exact-printing and theme restrictions;
- budgets and protected/excluded cards;
- malformed input;
- stale/missing source data;
- resource ceilings.

Shrink discovered failures to the smallest useful reproducer and keep them permanently.

---

## 26. Explainability and provenance

Important outputs should explain, without exposing private chain-of-thought:

- hard constraints applied;
- legality/printing findings;
- why a package/card was selected;
- exact adds/removes;
- price/currency source semantics;
- verified win package and interruption assumptions;
- exact probability fraction where applicable;
- simulation sample/confidence information;
- requested vs achieved bracket;
- ceiling causes;
- source freshness/health;
- uncertainty and unresolved contradictions;
- whether a learned model was used and its status/confidence.

---

## 27. User-facing workflows

The finished MCP/plugin should make requests such as these straightforward:

- What does this card do?
- Is this card/legal printing usable with my commander?
- Show me the untouched precon.
- Upgrade this precon for NZ$200 without removing these cards.
- Build the strongest FF-only Tidus/Cloud/etc deck you can.
- Target Bracket 5 but tell me if it cannot actually reach it.
- Give me a complete 100-card copy-ready list and exact IN/OUT changes.
- What verified combos are in this deck, and do they actually win?
- What is my probability of a viable line by turn 4?
- Compare this build with the previous version.
- Which upgrade should I buy first?
- Find a current NZ price/availability option.
- Explain why the deck ceiling is lower than requested.

---

## 28. V1 foundation exit criteria

Do not call the project a serious V1 foundation until all of these are satisfied:

1. legality, printing, precon, and NZD pricing foundations remain green;
2. winning-package discovery is deliberate rather than accidental;
3. claimed winning packages are verified to actually produce the claimed win/outcome;
4. honest requested-vs-achieved bracket/ceiling reporting is shared across major build/upgrade workflows;
5. the FF-only benchmark builds the strongest legal constrained result and honestly reports its ceiling;
6. the unrestricted cEDH control can produce genuinely strong competitive construction;
7. exact probability handles overlapping roles/tutors without double-counting;
8. simulation is calibrated against exact solvable cases;
9. the research layer tracks source independence/freshness/conflicts;
10. the learning corpus is sufficiently large, independent, balanced, leakage-safe, and temporally broad before learned promotion;
11. the neural model repeatedly beats the transparent model on genuinely unseen future MTG data before it is promoted beyond shadow use;
12. metagame drift and source degradation can reduce/revoke confidence rather than being ignored;
13. CI/build/tests are green on the candidate promoted runtime;
14. V0.14/V0.15 functionality is not promoted to `server-current` merely because it exists.

---

## 29. Development priority

Current priority order:

1. **Trustworthiness of deck-building intelligence**, not feature count.
2. General winning-package discovery and verification.
3. Honest bracket/ceiling assessment across workflows.
4. Overlap-aware exact probability for tutors/functional redundancy.
5. Exact-vs-simulation validation.
6. Build a substantial real, independently sourced, leakage-safe Commander/cEDH outcome corpus.
7. Evaluate transparent vs neural models on future unseen records.
8. Continue permanent FF-only and unrestricted controls after meaningful changes.
9. Promote experimental runtime/model components only when their quality gates are genuinely met.

---

## 30. Maintenance rule

Update this specification when the **long-term goal or architectural standard changes**.

Update `PROJECT_HANDOFF.md` after each **major implementation milestone, branch change, CI result, discovered limitation, or next-step change**.

A fresh session should be able to reconstruct the project direction and implementation state from GitHub without relying on old chat history.
