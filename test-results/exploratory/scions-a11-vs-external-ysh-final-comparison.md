# Scions A11 vs External Y'shtola — Strategic Comparison

Status: **comparison-only — no deck change accepted**

Clean strategic source: `fd4b0c2056d79dc49aa299b2642254bb5a209416`
Workflow run: `33371731811`
Accepted A11 baseline remains: `91142485993eb4087ec792757325e407b0f7c78f`

## Structural comparison

| Metric | A11 | External |
|---|---:|---:|
| Cards | 100 | 100 |
| Lands | 37 | 33 |
| Avg nonland MV (Oracle-name resolver) | 3.23 | 2.39 |
| Ramp | 21 | 18 |
| Early plays | 21 | 43 |
| Y'shtola MV3+ noncreature opportunities | 29 | 10 |
| Instant-speed Y'shtola opportunities | 13 | 6 |
| Stock Scions cards retained | 76 | 35 |
| Interaction-role cards | 18 | 15 |
| Cheap interaction | 7 | 12 |
| Protection / stack-role cards | 11 | 15 |
| Draw / selection roles | 19 | 16 |
| Detected tutors / search engines | 2 | 7 |

A11 type mix (library): 37 land, 20 creature, 15 instant, 9 sorcery, 12 artifact, 6 enchantment.
External type mix (library): 33 land, 23 creature, 17 instant, 9 sorcery, 15 artifact, 2 enchantment.

## Matched simulation: External minus A11

Across seven matched upgraded / optimized / cEDH-pressure scenarios at 2,600 iterations each:
- Functional keep: **+0.229**
- Commander uptime: **+3.729**
- Protection metric: **+23.414**
- Spells cast: **+1.593**
- Effect-draws: **+0.036** overall

At turn 9 under cEDH pressure, A11 drew about **0.91 more cards by effects**, while the external list still cast about **1.17 more spells**. This illustrates the strategic split: external is faster/leaner; A11 is a denser value engine.

## Important caveats

1. The external list's free-evoke cards (Grief, Solitude, Subtlety) are overstated by the current simulator because the alternative-cost model does not fully remove the matching-color card pitched from hand. A12 already showed these cards do not beat A11 when substituted directly.
2. Brainstorm-style raw effect-draw can be overstated because the model counts the draw event more readily than the cards put back.
3. The A11 Oracle-name Commander validator reports Murderous Rider and Hypnotic Sprite as unresolved because of Adventure/full-name matching. The exact-printing A11 finalization gate already proved A11 is Commander legal and exact 100; this is a resolver artifact, not a legality regression.
4. This strategic comparison intentionally does not certify the external list as FINAL FANTASY-printing-only. As pasted, most exact set codes are non-FF. A separate all-printings sweep was attempted twice but Scryfall rate-limited the bulk requests (HTTP 429). Oracle-level conversion to FF printings must therefore remain fail-closed until individually verified.

## Strategic judgment

### External list
A faster, lower-curve, more cEDH-like Esper combo/control shell. It gives Y'shtola only 10 direct MV3+ noncreature opportunities but compensates with 43 early plays, more cheap interaction/protection, more search redundancy, cantrips, recursion, and fast mana. It is better positioned to assemble and force through White Mage + Walking Ballista quickly.

### A11
A high-power Scions & Spellcraft upgrade that still uses Y'shtola as a primary engine rather than merely a commander for Esper combo. It keeps 29 Y'shtola opportunities, 76 stock cards, more land/ramp stability, more persistent draw/selection roles, and the same deterministic White Mage/Ballista finish with Intent/Ranger support.

## Best ideas from the external list to pressure-test against A11

1. **The Destined Black Mage** — highest-priority synergy candidate. Together with Y'shtola and Papalymo, one qualifying noncreature spell can reach four life lost per opponent in a turn (Y'shtola 2 + Black Mage 1 + Papalymo 1), enabling Y'shtola's end-step draw threshold from one spell.
2. **Silence** — very strong combo-turn protection, though Ranger-Captain already supplies a similar table-wide noncreature lock and Silence does not trigger Y'shtola.
3. **Louisoix's Sacrifice** — flexible cheap counter to activated/triggered abilities or noncreature spells, but mana value 1 means no Y'shtola trigger.
4. **Search for Dagger** — repeated legendary-creature selection that can help locate The Destined White Mage, but it is MV2 and relies on commander ETB/attacks.
5. **Delivery Moogle** — finds/recovers Walking Ballista, but earlier A5 combo-support testing found Ranger-Captain was the better single support slot. Running both would need to prove the extra redundancy is worth the slot.

## Current verdict

If the objective were **raw cEDH-style Y'shtola with no concern for precon identity**, the external philosophy is faster and deserves respect.

Under the actual project objective — **strongest FINAL FANTASY-only Scions & Spellcraft upgrade while preserving Y'shtola spellcraft/control as a real primary engine** — A11 remains the preferred baseline. The correct next move is not to replace A11 with the external list, but to selectively pressure-test the external list's best on-theme innovations, starting with The Destined Black Mage.

Boundary: no stable/current promotion, no PR #29 action, no Counter Blitz change, and no A11 replacement is made by this comparison.
