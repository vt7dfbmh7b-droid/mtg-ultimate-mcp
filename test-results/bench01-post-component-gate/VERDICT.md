# BENCH-01 paired post-component-gate verdict

Frozen product source: `dd085caf4e47f6f5e1976667dc90de2db46c00a1`
Executed benchmark wrapper source: `9d4776c5ffe250127282fc4923b5dbea568176a3`
Persisted evidence commit: `bc44b8b271788259c88a2b6d728116ca7ea5310f`

## Hard-truth execution

- frozen `src/**` guard: success
- focused compound-component regressions: success
- build: success
- Counter Blitz replay: success
- Cavalry Charge replay: success
- source remained frozen within the paired batch
- historical Batch A evidence was not overwritten

## Counter Blitz

Post-repair refinement executes with 10 swaps and remains Bracket 3.

Controlled request axes:
- countermagic: `1 -> 1`, target 8 — **still unsatisfied and no forward movement**
- counter engine: `52 -> 48`, target 16 — remains satisfied
- proliferate: `4 -> 4`, target 3 — remains satisfied; the earlier `4 -> 2` regression is closed
- combat references: `12 -> 11`, target 8 — remains satisfied
- hybrid creature floor: remains satisfied

Interpretation: the generic component-preservation repair closes the demonstrated compensation defect on Counter Blitz. However, the specialist still does not address the deck's explicit dense-c countermagic deficit despite spending 10 swaps. That is a substantive quality watch item and prevents treating this replay as proof that the specialist now beats the locked 18-swap general-AI baseline. It is currently one-fixture evidence for target-priority/upgrade-allocation weakness, not enough by itself to authorize another Commander-intelligence repair.

## Cavalry Charge

Post-repair refinement executes with 5 swaps and moves Bracket 2 -> 3.

Requested axes:
- Knight creatures: `32 -> 29`
- combat references: `21 -> 19`
- graveyard references: `5 -> 10`
- recursion/reanimation: `3 -> 8`

Interpretation: compared with the parser-only replay (`32 -> 27` Knights and `21 -> 17` combat), the component gate materially reduces collateral regression while allowing strong recursion/graveyard improvement. The controlled Knight/combat facets remain above their component floors. This closes the demonstrated aggregate-compensation correctness defect on Cavalry. Bracket 4 is still not achieved, so this is target movement rather than target achievement.

## Combined verdict

**The specific BENCH-01 compound-component compensation correctness blocker is CLOSED on the two fixtures that established it.** The validated generic component gate behaves as intended under frozen-source replay: previously satisfied components do not fall below their controlled targets and below-target components are not allowed to move backward while other facets compensate.

This does **not** make V0.15 promotion-ready and does **not** relabel historical Batch A. The original Batch A remains specialist 1 / general AI 1.

The next evidence question is broader deck-building quality, not another component-gate repair. In particular, Counter Blitz exposes a target-priority concern: an explicit unsatisfied countermagic target remained `1 -> 1` after 10 swaps. Per BENCH-01 rules, do not patch this from one fixture. Run several unseen contrasting fixtures from the same validated product source and record whether explicit unsatisfied high-priority targets are repeatedly ignored while swaps are spent elsewhere. Only repeated cross-fixture evidence should authorize a generic target-priority/allocation repair.

## Next actions

1. Keep `dd085caf...` frozen as the currently validated product baseline while gathering the next contrasting BENCH-01 evidence.
2. Add unseen fixtures from materially different families (for example control, aristocrats, combat/commander-damage, compact combo or another hard theme/budget constraint).
3. For each fixture, record hard truth, requested target movement/achievement, swap allocation, structural preservation and whole-deck quality.
4. Specifically watch whether an explicit unsatisfied target receives no meaningful improvement despite available swap capacity while lower-priority/cosmetic changes are accepted.
5. Do not change Commander intelligence unless that target-priority/allocation weakness repeats across unrelated fixtures or another clear generic correctness defect emerges.
6. Keep PR #29 and stable V0.13 unchanged until broad BENCH-01 evidence is promotion-grade; standing authorization remains sufficient once those gates are genuinely met.
