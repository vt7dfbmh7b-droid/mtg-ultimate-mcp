# BENCH-01 component-aware theme-affinity replay — manual whole-deck verdict

Frozen product source: `27a2fab9561d3aa89e9306d07e15c248106988eb`
Replay metadata: `test-results/bench01-strategy-anchor-replay/run-metadata.txt`
Fixtures: Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire, Animated Army
Formal replay outcome: harness success from one unchanged source.
Manual product verdict: **REJECT lineage; do not promote over `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`.**

## Why the formal success is insufficient

The component-aware affinity is a useful generic ordering signal, but the complete upgraded decks still show a repeated cross-fixture defect: structural-role pressure can admit cards that satisfy draw/protection/tutor/interaction labels while having weak commander/requested-identity fit. The bounded component affinity is not strong enough to prevent identity-poor structural replacements once those candidates pass the role gate.

This is not a request to hard-freeze theme cards, raise theme minimums, or add fixture/card exceptions. The next capability should be a **generic strategic-role compatibility / identity floor for incoming structural candidates**: when several legal candidates satisfy the same failed structural role, prefer candidates that also advance the commander/requested strategy; reject clearly off-plan candidates when compatible alternatives exist. Structural fallback must remain possible when no identity-compatible candidate can satisfy a real deficit.

## Fixture review

### Quick Draw — Stella Lee / spellslinger + draw + countermagic

Legality / size: appears intact in persisted replay.
Strategy preservation: **failed manual quality acceptance.** The final deck adds multiple Equipment cards (`Sword of Once and Future`, `Sword of Wealth and Power`, `Sword of Forge and Frontier`) to a Stella Lee spellslinger shell. Some of these can technically provide protection/value, but three swords materially dilute spell density and do not represent a strong Commander-specialist answer to a spellslinger-control request. The deck also adds `Archmage Ascension`, a slow generic value card, while the core commander incentives reward cheap repeated instants/sorceries.
Verdict vs strong general-purpose AI: **general-AI clear/slight win** on whole-deck coherence; a competent general build should preserve a substantially higher instant/sorcery density while filling protection, interaction, and card-advantage roles.

### Virtue and Valor — Ellivere / enchantments + combat + draw

Legality / size: appears intact.
Strategy preservation: **failed manual quality acceptance.** `Sram, Senior Edificer` is a good identity-aligned addition, but the final package also contains low-affinity structural/value cards such as `Mind Stone`, `Skullclamp`, `Mangara's Tome`, `Prosperous Innkeeper`, `Ephemerate`, `Hour of Promise`, and `Insidious Fungus`. Several are individually playable Commander cards, but they do not collectively improve the requested enchantment-combat identity as efficiently as enchantment/aura creatures, enchantress engines, aura-based removal/protection, or combat enchantments would.
Verdict vs strong general-purpose AI: **general-AI slight win** on replacement coherence despite some useful additions.

### Explorers of the Deep — Hakbal / Merfolk + counters

Legality / size: appears intact.
Strategy preservation: **failed manual quality acceptance.** The final package contains `Curiosity`, `Mind Stone`, `Jace, Vryn's Prodigy`, `Archmage Ascension`, `Essence Flux`, `Worldly Tutor`, `Sword of Fire and Ice`, `District Mascot`, `Origin of Metalbending`, and `Padeem, Consul of Innovation`. `Worldly Tutor` can support the creature plan, but the overall set includes several generic artifact/value/protection cards that neither preserve Merfolk density nor strongly support Hakbal's explore/+1/+1-counter engine.
Verdict vs strong general-purpose AI: **general-AI clear win** on typal and commander-specific cohesion.

### Elven Empire — Lathril / Elf typal

Legality / size: appears intact.
Strategy preservation: **failed manual quality acceptance.** `Valley Rotcaller` is an excellent typal addition and `The Meathook Massacre` is strong generally, but the package also includes `Warping Wail`, `Culling the Weak`, `Not Dead After All`, `Haywire Mite`, `Transmutation Font`, `Campsite Cuisine`, `Savor`, `Kura, the Boundless Sky`, `Gyome, Master Chef`, and `Dina, Soul Steeper`. Too many incoming cards are generic aristocrats/value/interaction pieces rather than Elf bodies, Elf payoffs, tribal tutors, mass untap, token multiplication, or Lathril-specific support. The specialist is still willing to reduce typal density to satisfy broad structural labels.
Verdict vs strong general-purpose AI: **general-AI clear win** on Lathril/Elf coherence.

### Animated Army — Bello / high-MV artifact-enchantment permanents

Legality / size: appears intact.
Strategy preservation: **not a sufficient acceptance win.** The replay accepts only a very small package (`Mask of Memory`, `You Find Some Prisoners`, `Cool but Rude` in the persisted final deck). These cards may improve generic draw/value, but they do not materially exploit Bello's defining incentive to play artifacts/enchantments with mana value 4 or greater. This avoids the previous zero-swap regression but does not demonstrate that the replacement system understands the commander-specific permanent profile well enough.
Verdict vs strong general-purpose AI: **general-AI slight/clear win** on commander-specific upgrade selection.

## Cross-fixture conclusion

The repeated defect is now more specific than compound-theme parsing or component weighting:

1. Compound components are being resolved and the new component affinity can distinguish relative component representation.
2. Nevertheless, candidate generation/ranking still treats broad structural-role satisfaction as sufficient even when the incoming candidate has weak commander/request identity.
3. This produces generic-staple/role-card drift across spellslinger, enchantment-combat, Merfolk typal, Elf typal, and Bello permanent-profile decks.
4. Therefore the `27a2fab...` lineage is formally green but **manually rejected** and must not replace the accepted `e17b0a1c...` Commander baseline.

## Next safe product action

Implement the smallest generic **role-compatible strategic affinity gate/ranker** for incoming candidates. For each structural deficit, rank candidates that satisfy the same role by commander/requested-strategy affinity before generic role-only candidates. If at least one adequately role-satisfying, identity-compatible candidate exists, identity-poor alternatives should not win purely from generic structural score. If no compatible candidate exists, preserve the existing structural fallback rather than failing the deck or hard-freezing theme identity.

Focused regressions should span at minimum spellslinger, enchantment-combat, Merfolk typal, Elf typal, and high-MV artifact/enchantment commander incentives. No card names, fixture names, commander-specific branches, or benchmark labels may enter product logic.

After focused + full immutable validation is green, freeze the exact repair SHA and replay several contrasting fixtures from that unchanged source. Do not repeatedly polish only these five; include fresh combo/control/aristocrats/budget/unusual-commander fixtures once the repeated replacement-quality defect is shown resolved.
