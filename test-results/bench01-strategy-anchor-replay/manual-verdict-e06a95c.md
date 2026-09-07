# BENCH-01 whole-deck verdict — e06a95cb

Frozen product source: `e06a95cb03d03a3dcce1adeee8339e0e6625efa4`

Fixtures: Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire, Animated Army.

## Verdict

**Rejected as a Commander product lineage.** Formal validation and frozen-source execution were green, but complete-deck quality did not clear the mandatory manual gate.

## Cross-fixture evidence

- **Quick Draw / Stella Lee:** spell quality improved in parts, but `Sword of Once and Future` and `Sword of Wealth and Power` remain off-plan Equipment additions in a spellslinger shell. The system still accepts generic structural utility ahead of better spell-mechanism alternatives.
- **Virtue and Valor / Ellivere:** the core enchantment/Aura identity survives, but additions such as `Sidequest: Raise a Chocobo`, `Springheart Nantuko`, `Spirited Companion`, `Personify`, `Hour of Promise`, and `Battle Menu` show that structural-role completion is still insufficiently biased toward enchantment-compatible replacements.
- **Explorers of the Deep / Hakbal:** the final list still adds several weakly aligned generic cards, including `Wizard Class`, `Titania's Command`, `Planar Incision`, `Origin of Metalbending`, `Sword of Fire and Ice`, `Teferi's Time Twist`, and `District Mascot`, rather than consistently choosing Merfolk/explore/counter-compatible cards for the same roles.
- **Elven Empire / Lathril:** the regression is especially clear. Multiple non-Elf additions (`Bloodforged Battle-Axe`, `Savor`, `Not Dead After All`, `Bone Shards`, `Transmutation Font`, `Sword of Hearth and Home`, `Dreadhorde Invasion`, `The Witch's Vanity`, `Kura, the Boundless Sky`, `Sword of Fire and Ice`, `Gilded Goose`) dilute typal identity despite many role-compatible Elf options existing in Commander generally.
- **Animated Army / Bello:** only `Swiftfoot Boots` is added, so the engine still fails to discover/choose meaningful mana-value-4+ artifact/enchantment upgrades that exploit Bello's commander text.

## Generic diagnosis

The preference/lane logic cannot choose an identity-bearing card that never enters the role candidate pool. In unrestricted Upgrade, the explicit requested-theme role search currently runs only while `themeDeficit > 0`. Once the minimum theme density is satisfied, role discovery falls back to generic role search plus inferred-strategy supplementation. This creates a repeated discovery-quality failure across spellslinger, enchantment, typal and unusual commander-incentive decks even though downstream ranking prefers requested/theme identity when those candidates are present.

## Justified next repair

Keep the role-specific requested/theme search active whenever a controlled explicit theme exists, even when its minimum density is already satisfied. Treat it as advisory candidate discovery/quality evidence, not as a new hard preservation floor. Preserve legality, printing, price, structural-role and fallback behavior unchanged.

After the smallest generic repair: run focused regressions, complete immutable validation, freeze the exact green source, replay contrasting fixtures unchanged, and manually inspect the full decks before acceptance.
