# BENCH-01 manual whole-deck verdict — 49ca828c

Frozen product source: `49ca828c3581c6992c270ade84012014a3c9d733`

Batch: Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire, Animated Army.

## Verdict

**REJECTED as the next accepted Commander product baseline.**

The aspirational generic-fallback gate is formally green, but the frozen five-deck replay does not materially improve the remaining Commander replacement-quality failures. The important problem decks retain substantially the same off-plan packages as the rejected `6686f289...` lineage.

## Fixture review

### Quick Draw — remains locally acceptable

Stella Lee retains the strong spellslinger/control upgrade package established by the prior lineage: Mental Misstep, Mystical Tutor, March of Swirling Mist, Pyroblast, Counterspell, Sanar, Eldritch Immunity and Red Elemental Blast. The deck remains coherent and the previous Equipment drift stays removed.

### Virtue and Valor — still mixed

Ellivere retains useful enchantment/Aura support such as Sterling Grove and Sigarda's Aid, but the same generic value/combat additions remain. This is not a material whole-deck improvement over the rejected predecessor.

### Explorers of the Deep — still rejected

Hakbal still contains Essence Flux, Teferi's Time Twist, Sword of Fire and Ice and Aberrant in the upgrade package. These satisfy structural labels but are weaker Commander-specialist choices than direct Merfolk/explore/counter-mechanism alternatives.

### Elven Empire — still rejected

Lathril retains useful Elf additions but also the same substantial non-Elf structural drift: Flaxen Intruder, Culling the Weak, Dokuchi Silencer, Sword of Hearth and Home, Grist and Sword of Fire and Ice remain. Typal identity is therefore not protected strongly enough at authoritative structural gates.

### Animated Army — clear failure remains

Bello still receives Sword of the Animist, Flaxen Intruder, Vexing Puzzlebox, Jet Medallion, Dreadmaw's Ire, Cool but Rude and Wayfarer's Bauble. `Jet Medallion` remains especially diagnostic: it is Commander-legal in Gruul, but its black-spell cost reduction cannot function meaningfully in a red-green deck. This proves that a nominal structural role can remain context-dead even when the aspirational fallback path is disabled.

## Cross-fixture conclusion

`49ca828c...` did not materially change the remaining failure family because generic fallback is intentionally still permitted for authoritative target gates. The next capability must therefore improve authoritative fallback **quality/applicability**, not simply suppress fallback.

Two generic requirements remain justified:

1. **Context-sensitive role applicability:** a candidate must not satisfy a structural role through text that cannot operate in the current deck context (for example color-specific cost reduction for colors outside the commander identity).
2. **Fallback identity quality:** among genuinely functional cards satisfying the same authoritative structural gate, requested/commander-compatible or identity-neutral candidates should outrank identity-damaging generic cards without weakening the target gate or making fallback unavailable.

The smallest next repair should begin with centralized context-sensitive role applicability because it is objectively false role truth, then validate whether broader fallback identity drift remains after that correction. Do not add commander/card/fixture exceptions.

## Acceptance state

- `49ca828c...`: formally validated and replay-complete, **manual whole-deck acceptance failed**.
- Accepted Commander baseline remains `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`.
- PR #29 remains unmerged.
- Stable/current remains V0.13.

## Exact next action

Implement the smallest generic context-sensitive structural-role applicability gate, initially covering color-restricted cost reduction against the deck's commander color identity while preserving ordinary mana acceleration and usable cost reduction. Add synthetic cross-color regressions, run focused and full immutable validation, and only then freeze a new source for contrasting replay if green.