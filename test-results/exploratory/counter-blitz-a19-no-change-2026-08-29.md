# Counter Blitz A19 — iterative single-slot pressure result

Status: **exploratory no-change evidence**. No stable/current promotion. PR #29 remains unmerged.

## Baseline
A17 exploratory Tidus champion:
- From Father to Son → Commune with Beavers
- Mangara, the Diplomat → Summon: Fenrir

## Result
**No additional single-card swap accepted.**

A19 pressure-tested the lowest-purpose nonland slots against the complete FF-legal Bant nonland pool while preserving exact deck truth, both verified Ballista packages, real combo-access quality, critical strategic roles, Commander legality, Final Fantasy printing policy, and construction floors.

Exact-source workflow run: `33239471752`
Source SHA: `7ed3c1cc7207ba65f2579aba6cc761607741d75c`
Outcome: success
- build: success
- full regression suite: success
- A19 iterative slot pressure: success
- evidence upload: success

## Search evidence
- physical 99 audit: 24 locked / 72 supported / 3 review / 0 challenge
- eligible FF Bant pool: 429
- open nonland candidates: 305
- structurally legal candidates after hard gates: 968
- simulated finalists: 24
- review leader: none

Real combo access remained:
- Ranger-Captain of Eos → Walking Ballista (deterministic)
- Commune with Beavers → Gatta and Luzzu / Walking Ballista / The Earth Crystal (bounded top-3)
- weighted access score: 7.9

## Representative rejected candidate
`Puresteel Paladin → Dig Through Time` looked structurally attractive because Dig added deep bounded access to all supplied combo pieces. It was rejected by the five-seed gameplay comparison:
- simulation mean: -0.473
- positive seeds: 2/5
- minimum: -3.812

Other Dig Through Time and Ashe, Princess of Dalmasca swaps similarly failed to produce robust whole-deck improvement.

## Decision
Keep A17 unchanged after single-slot pressure. This is evidence of a local optimum for isolated one-for-one nonland changes under the current FF-only pool and model, not proof that no stronger multi-card package exists.

Next appropriate test: coherent two-card package pressure, because package-level improvements can cross a local optimum that no isolated swap can.