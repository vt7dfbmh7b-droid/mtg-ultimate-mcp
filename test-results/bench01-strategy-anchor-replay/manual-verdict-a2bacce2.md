# BENCH-01 manual verdict — a2bacce2

## Batch identity

- Frozen product source: `a2bacce2a70e3ccdf0faca5dd96501fa8f5adc31`
- Replay wrapper descendant: `6742683f74296813f9581e860ee2df9f1aea82dd`
- Persisted replay evidence commit: `22477f1bbf7a981ab6a234c3297e133c7bf3583f`
- Fixtures: Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire, Animated Army
- Source frozen within batch: yes; `src/**` was proved identical to the frozen product SHA before generation.
- Formal product validation before replay: green (focused regressions, full repository tests, production build, project-state validation, validation-index validation, recovery smoke).
- Manual product verdict: **REJECT**.

The component-first repair is not accepted as the Commander baseline. It fixes the previously diagnosed ordering defect, but complete-deck inspection shows a repeated strategy-preservation/replacement-priority weakness across contrasting precons.

## Target/constraint classification

All five fixtures remained Commander-legal, exact-size refinement outputs and preserved the controlled compound-theme floors enforced by the harness. All five were requested at Bracket 4 but remained assessed at Bracket 2 after refinement, so this batch is **target movement without target achievement**, not a Bracket-4 success.

No result in this batch is classified as an external-provider failure, printing uncertainty, restricted-pool ceiling, or formal validation failure. The rejection is a Commander deck-quality / strategy-preservation / replacement-priority result.

## Whole-deck review

### Quick Draw — Stella Lee, Wild Card

The output contains much better spell-based interaction and velocity than the earlier rejected lineage, including `Three Steps Ahead`, `Pact of Negation`, `Daze`, `Mystical Tutor`, `Solve the Equation`, `Artful Dodge`, and `Rona's Vortex`. However it still selects `Sword of Once and Future` and `Sword of Wealth and Power`. Those Equipment cards do have real spellslinger text, so this is no longer the clearest false-mechanism case, but the final package is still weaker than a Commander specialist should produce when ordinary instants/sorceries can fill the same protection/value needs while increasing Stella's cast-trigger density. Cheap interaction, fast mana, and tutors also remain below the requested Bracket-4 target gates. Verdict: **improved but not target-achieving; deck-quality weakness remains**.

### Virtue and Valor — Ellivere of the Wild Court

Accepted additions include `Eladamri's Call`, `Ranger-Captain of Eos`, `Skullclamp`, `Veil of Summer`, `Sram, Senior Edificer`, `Archivist of Oghma`, `Warping Wail`, `Battle Menu`, `Hour of Promise`, `Flowering of the White Tree`, `Sword of War and Peace`, and `Sword of the Animist`. Only a minority reinforce the deck's defining enchantment/Aura-combat engine. Broad secondary components such as card draw and combat are being treated as sufficient requested-theme affinity and can displace enchantment-mechanism candidates. Verdict: **strategy-preservation / replacement-priority failure**.

### Explorers of the Deep — Hakbal of the Surging Soul

Accepted additions include `Worldly Tutor`, `Eladamri's Call`, `Solve the Equation`, `Reenact the Crime`, `War of the Last Alliance`, `Counterspell`, `Muddle the Mixture`, `Mana Leak`, `Charge Through`, `Pixie Dust`, `Hunters' Blowgun`, and `Tear Asunder`. The package contains useful interaction and some counter/combat support, but too little Merfolk/explore identity for a specialist upgrade. Secondary `+1/+1 counters` / combat component matches can enter the preferred lane without preserving the typal anchor. Verdict: **strategy-preservation / replacement-priority failure**.

### Elven Empire — Lathril, Blade of the Elves

This is the strongest regression signal. Of the 12 accepted additions, `Elves of Deep Shadow` is the clearest direct Elf addition, while the package also adds `Dreadhorde Invasion`, `Pawpatch Recruit`, `Culling the Weak`, `Font of Mythos`, `Deadly Dispute`, `The Witch's Vanity`, `Kura, the Boundless Sky`, three Swords, and `Chocobo Racetrack`. The preceding `e6850c8f...` replay had materially reduced non-Elf drift; component-first ordering re-opened that problem because `Tokens` and `Combat` are treated as interchangeable with `Elf Typal`. Verdict: **clear replacement-coherence regression**.

### Animated Army — Bello, Bard of the Brambles

Accepted additions are `Tireless Provisioner`, `Woody, Fearless Ranger`, `Magda, Brazen Outlaw`, `Burning-Tree Emissary`, `Fellwar Stone`, `Recruiter of the Guard`, `Imperial Recruiter`, `Sword of the Animist`, and `Exploration`. The package does not meaningfully optimize Bello's defining incentive for mana-value-4+ non-Aura enchantments and artifacts. `Artifacts`, `Tokens`, and `Combat` are too coarse to represent the commander-specific mechanism, and generic component matches therefore still crowd out the actual payoff structure. Verdict: **commander-specific synergy / replacement-priority failure**.

## Cross-fixture diagnosis

The previous defect was: inferred strategy could outrank the user's explicit compound components. `a2bacce2...` corrected that ordering, but revealed the deeper generic defect:

> **Compound-theme components are currently treated as interchangeable positive identity evidence instead of distinguishing a deck-defining anchor mechanism from secondary/supporting components.**

`upgradeThemeComponentAffinityScoreV15` deliberately rewards deficit/scarcity. That is useful for balancing requested components, but it can invert identity: a saturated defining component such as Elf Typal, Merfolk, Enchantments, or Spellslinger receives less marginal affinity than an underrepresented broad component such as Tokens, Combat, or Card Draw. The component-first lane then accepts any component-aligned card, so the supporting component can displace the defining mechanism.

This repeated across typal, enchantment, spellslinger and commander-specific permanent-engine fixtures. It therefore meets the generic-repair threshold.

## General-AI comparison

No fresh independent general-purpose-AI build was executed for all five fixtures in this replay, so a new specialist-vs-general-AI verdict would be unsupported. The comparison for this batch remains **inconclusive / not freshly executed**. Historical benchmark comparisons remain separate evidence and are not promoted into this batch.

## Required next repair

The next generic capability to repair is **compound-theme anchor preservation / component hierarchy**.

The smallest acceptable direction is to distinguish the starting deck's dominant requested component evidence from secondary components, then use that anchor as the first replacement/candidate lane. Secondary components remain useful, and generic structural cards must remain available when no anchor-compatible option exists. The solution must not hardcode commanders, card names, typal names, fixture labels, or individual theme phrases.

A plausible generic signal is the already-audited starting-deck component density: the component with the strongest actual main-deck representation is evidence of the deck's existing identity anchor. Any implementation must be tested across contrasting synthetic component profiles, must preserve secondary-component fallback when no anchor-compatible printing exists, and must keep hard structural/target/printing gates authoritative.

Bello additionally demonstrates that explicit user theme labels do not always fully encode commander-text incentives. Do not solve that single fixture with a Bello-specific exception; after the generic anchor repair, re-evaluate whether commander-mechanism affinity remains an independent repeated weakness.

## Acceptance boundary

- `a2bacce2a70e3ccdf0faca5dd96501fa8f5adc31`: formally validated, **BENCH-01 manual rejection**.
- Accepted Commander baseline remains `e17b0a1c...`.
- PR #29: do not merge on this evidence.
- Stable/current V0.13: do not promote on this evidence.

Next sequence: generic anchor-preservation repair → focused cross-archetype regressions → complete immutable validation → freeze exact green SHA → replay several contrasting fixtures from that unchanged source → inspect complete decks before acceptance.
