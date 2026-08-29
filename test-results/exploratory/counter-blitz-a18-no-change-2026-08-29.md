# Counter Blitz A18 — land-slot pressure result

Status: **exploratory no-change evidence**. No stable/current promotion. PR #29 remains unmerged.

## Baseline
A17 exploratory Tidus champion:
- From Father to Son → Commune with Beavers
- Mangara, the Diplomat → Summon: Fenrir

## Result
**No land swap accepted.**

The A17 mana base was pressure-tested against the complete FF-legal Bant land pool while preserving:
- exact 100 cards;
- exactly 31 physical lands;
- Commander legality;
- Final Fantasy printing policy;
- persistent colored-mana floor;
- real combo access;
- construction floors.

The audit continued to flag three ETB-tapped lands for review:
- Starting Town
- Path of Ancestry
- Balamb Garden, SeeD Academy // Balamb Garden, Airborne

However, no candidate land passed the combined structural and five-seed gameplay acceptance gate. The structural alternatives were mostly additional tapped tri-color lands such as Seaside Citadel / Crossroads Village, and their simulated deck states were not better enough to justify replacement. Balamb Garden's detected draw/mana utility also outweighed the simple fixing gain in the tested alternatives.

## Intelligence repair
During A18 the physical-land audit was corrected so the generic role label `land` no longer counts as a non-mana utility role. Ordinary mana-base slots must now earn utility credit from actual additional functions.

Regression coverage was added to ensure a plain tapped land has no fake utility role.

## Validation
Exact-head A18 workflow run: `33239340890`
Outcome: success
- build: success
- full regression suite: success
- A18 land pressure: success
- evidence upload: success

## Decision
Keep the A17 mana base unchanged. This is a positive no-change decision: the reviewed lands have real tempo costs, but no verified FF-legal replacement produced a stronger complete deck under the current evidence and simulator.