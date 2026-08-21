# Ultimate MTG — Commander Specialist Objective

This document makes the project's long-term intelligence target explicit. It complements `ULTIMATE_MTG_SPEC.md` and is part of fresh-chat recovery because this objective must survive individual conversations, handoffs, and implementation phases.

## Primary objective

Ultimate MTG is not intended to be a broad general-purpose Magic assistant.

Its primary product objective is:

> **Become a Commander-specialist system that consistently outperforms strong general-purpose AI at Commander deck construction and analysis, then prove that advantage with evidence.**

The specialization itself is the opportunity. A general AI can know a great deal about Magic, but Ultimate MTG should go deeper on Commander-specific deck construction, multiplayer win conditions, strategy preservation, exact constraints, probability, simulation, card/printing truth, and repeatable counterfactual testing.

“Better” is not a marketing label. It is a benchmark claim that must be earned.

## The expertise target

The reasoning target is the strategic understanding of a strong human Commander deck builder, combined with machine-level consistency and verification.

The system should understand the deck as a whole rather than score cards in isolation. That includes:

- what the commander contributes and what the deck depends on the commander to do;
- the primary, secondary, and fallback game plans;
- archetype, theme, play pattern, and intended player experience;
- synergy clusters and cards that connect multiple parts of the deck;
- structural cards whose removal damages several other relationships;
- real win routes, setup requirements, interruption points, resilience, and recovery;
- the difference between a technically valid combo and a strategically appropriate win package;
- the consequences of every proposed cut, not only the attraction of every proposed addition;
- mana, curve, interaction, protection, draw, tutors, recursion, and other support in the context of this particular deck;
- the requested bracket, budget, printing family, collection, protected/excluded cards, theme, and playstyle as first-class constraints;
- when a deck is already doing something well and should not be changed merely to increase a generic metric;
- when no supported improvement exists and the correct autonomous answer is to keep the deck unchanged.

Human-level understanding is therefore not “knowing many cards.” It is understanding why a deck works, why it fails, what can be changed safely, and which trade-offs matter for that exact deck.

## Autonomous deck-improvement standard

For a requested deck and target, Ultimate MTG should be able to:

1. understand the existing deck and its identity;
2. diagnose the actual blocker between the current deck and the requested target;
3. distinguish authoritative requirements from aspirational role counts or generic heuristics;
4. generate several coherent solutions to the real blocker;
5. choose complete IN→OUT packages rather than disconnected card suggestions;
6. protect cards and routes whose removal would damage the deck's core plan;
7. compare resulting legal 100-card deck states under the same evidence and simulation conditions;
8. reject changes that improve a score but not the requested deck;
9. prefer the smallest coherent improvement when it solves the problem;
10. explain both accepted and rejected changes in Commander terms a knowledgeable player can audit.

A successful autonomous optimizer must be able to say, in effect:

> “This swap raises a generic score, but I am rejecting it because your real target gate already passes and the cut damages an existing route.”

It must also be able to say:

> “I cannot find a supported improvement under these constraints, so keep the deck as-is.”

That behavior is a sign of intelligence, not failure.

## Win-package intelligence standard

Winning-package intelligence is a core part of the specialist advantage.

A proposed route must not be accepted merely because a database calls it a combo, because it is popular, or because it produces an unbounded resource.

The system should:

- verify Commander legality and color identity;
- verify every required physical printing under the active set/family/budget constraints;
- verify deterministic multiplayer full-table closure where a win is claimed;
- distinguish unavailable evidence from evidence of absence;
- account for commander dependence, required zones, setup, timing, and practical package size;
- evaluate tutorability, redundancy, compactness, resilience, dead-card burden, and overlap with cards already in the deck;
- ensure the package can actually be injected within the available swap capacity;
- preserve existing pieces needed by the selected route;
- independently re-evaluate the final deck rather than trusting the planner's own claim.

A deck should not be collapsed into an all-in combo shell solely because combo density is easy to measure. Combat, commander damage, control, aristocrats, value, extra-combat, or other meaningful routes should remain real when they are part of the requested identity.

## Machine-level advantages

Ultimate MTG should aim to exceed what a human can reasonably do manually by combining strategic reasoning with repeatable computation.

Its advantages should include:

- exhaustive or deeply bounded candidate search;
- exact Commander legality and physical-printing verification;
- exact or rigorously bounded probability where mathematically possible;
- reproducible simulation for stateful questions;
- counterfactual comparison of multiple complete 100-card configurations;
- current price, printing, combo, and competitive evidence;
- source provenance and source-health awareness;
- persistent knowledge of prior failures and regression fixtures;
- consistent application of the same truth boundaries every time.

No individual data source, popularity score, simulation number, model score, bracket heuristic, or tournament statistic is allowed to become the whole definition of deck quality.

## Comparative proof standard

The project should eventually be able to defend the statement that it is better than general-purpose AI at Commander.

`BENCH-01` and later benchmark work should therefore include comparative evaluation against strong general-purpose AI baselines and, where practical, knowledgeable human review.

Comparisons should use the same input deck, commander, constraints, target, and available evidence.

Important scored dimensions include:

- Commander legality and exact 100-card correctness;
- exact printing/theme/budget truth;
- correct diagnosis of the deck's real weaknesses;
- full-table win-route correctness;
- quality and feasibility of proposed packages;
- quality of cuts and preservation of structural cards;
- preservation of primary/secondary strategy and deck identity;
- probability/simulation improvement where relevant;
- resilience and practical playability;
- spend efficiency;
- quality of “no change” decisions;
- explanation quality and auditability.

A single scalar score is not enough. A system that wins a metric while making strategically worse decks has not met the objective.

The standing benchmark question is:

> **Given the same Commander problem and evidence, can a strong general-purpose AI or knowledgeable Commander specialist reliably produce a better legal deck decision?**

If the answer is yes, Ultimate MTG is not finished.

The target state is the reverse: alternatives may exist, but Ultimate MTG should be able to show, with verified evidence and coherent Commander reasoning, why its chosen deck state is at least as strong and usually stronger for the exact request.

## Development philosophy

Until this objective is met:

**Commander expertise first. Verification second. Automation third. Additional features only when they materially improve those three or improve our ability to prove them.**

Development should not chase feature count, novelty, or superficial “AI” behavior.

The system earns trust by being correct, strategically coherent, conservative when evidence is incomplete, and measurably better across diverse Commander problems.

## Relationship to current milestones

- `INTEL-01` builds trustworthy winning-package intelligence.
- `INTEL-02` builds actual autonomous deck improvement rather than score chasing.
- `BENCH-01` proves whether the resulting intelligence generalizes across diverse Commander archetypes and constraints and whether it beats strong general-purpose baselines.
- `INTEL-03` deepens strategic understanding toward strong human/expert Commander reasoning.
- `INTEL-04` compares complete deck states and produces expert-level explanations.

None of these milestones by itself proves the product objective. The objective is met only when the complete system performs consistently across adversarial, unseen, and meaningfully different Commander cases.
