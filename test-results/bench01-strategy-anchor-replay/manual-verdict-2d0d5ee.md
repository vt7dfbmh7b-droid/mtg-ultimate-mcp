# BENCH-01 manual whole-deck verdict — 2d0d5ee

Frozen Commander product source: `2d0d5ee260da6ef31215d7a4cb542cf00f21077a`

Batch: Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire, Animated Army. The replay completed from one unchanged source and remained legal/exact-size/resolved. Formal validation was green before replay.

## Verdict

**Reject this lineage as an accepted Commander product baseline.** The context-sensitive color-restricted cost-reducer repair is locally correct, but whole-deck output proves it is not applied broadly enough to prevent context-dead structural additions.

### Quick Draw — specialist-quality local success
Stella remains materially improved: Mental Misstep, Mystical Tutor, March of Swirling Mist, Pyroblast, Counterspell, Eldritch Immunity and Red Elemental Blast are coherent spellslinger/control additions. The earlier Equipment drift remains absent. No regression attributable to the repair is visible.

### Virtue and Valor — generally coherent, still mixed replacement quality
Ellivere preserves the enchantment/Aura identity and includes strong direct mechanisms such as Sterling Grove and Sigarda's Aid. Some generic/token-combat additions remain weaker than specialist-quality enchantment alternatives, so this is improvement/maintenance rather than a decisive specialist win.

### Explorers of the Deep — target movement, not specialist acceptance
Hakbal preserves the Merfolk/counters core but still accepts weakly aligned generic utility such as Sword of Fire and Ice and a package whose whole-deck coherence is not clearly better than a strong general-purpose AI upgrade. This remains replacement-quality weakness rather than legality or harness failure.

### Elven Empire — typal core survives but generic drift remains
Lathril keeps a strong Elf core and gains useful Elf pieces, but Culling the Weak plus multiple off-typal utility cards/Swords still displace tribal density. This is target movement, not target achievement, and remains a strategy-preservation/replacement-priority weakness.

### Animated Army — decisive reproduction of context-dead utility
Bello still ends with `Jet Medallion`. In Gruul, `Black spells you cast cost {1} less to cast` is functionally dead. The new helper correctly rejects such a reducer when evaluating a `ramp` role, but source inspection shows `cardRoleApplicableToDeckContextV15` returns true immediately for every role other than `ramp`. Therefore the same blank card remains eligible through authoritative `average-nonland-mv` / `early` candidate generation.

## Generic diagnosis

The defect is broader than ramp classification: **candidate usefulness must remain context-valid independent of which structural gate happened to discover the card.** A context-dead mechanic cannot become acceptable merely because its mana value advances a curve target.

The smallest justified generic repair is to make color-restricted cost-reducer applicability a card-level candidate validity check for low-curve/early structural lanes as well as ramp, while preserving cards that have another independently useful role. Do not add a Jet Medallion/card/commander exception.

## Next required sequence

1. Implement the generic context-validity extension with focused positive/negative regressions.
2. Run full immutable repository validation.
3. Freeze the exact green product SHA.
4. Replay contrasting fixtures unchanged and manually inspect complete decks.
5. Accept only if Bello loses context-dead utility without regressing Stella/Ellivere/Hakbal/Lathril.

Accepted Commander baseline remains `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`; PR #29 and stable/current V0.13 remain unchanged pending promotion-grade BENCH evidence.
