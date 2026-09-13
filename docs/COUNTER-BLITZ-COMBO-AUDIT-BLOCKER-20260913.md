# Counter Blitz combo-audit repair checkpoint — 2026-09-13

## Source and boundaries

- Published candidate source: `123b571182ef1fd4daa61b833cbe3233f6595a10`.
- Candidate: `agent/counter-blitz-generic-mechanism-floor-20260911`.
- This additional repair is local only, based on that exact published source.
- Main, stable V0.13, PR #29, and the accepted baseline remain unchanged.
- No historical target deck was used as generation input or a card-selection rule.

## Evidence and generic repair

CI run `34734723342`, job `103663954638`, on the published source completed with 1,103 tests: 1,101 passed, one failed, one skipped. The remaining failure is `BENCH-01 Counter Blitz full-pipeline historical capability regression`, with `required-win-package-not-verified-in-final-deck`.

Package discovery passes provider mechanism descriptions to the full-table closure classifier. Final evaluation previously passed only result labels to that same classifier, dropping the instructions needed to verify repeatable opponent-targetable damage. Final evaluation now also passes the string description, without weakening the classifier or introducing any card-name exception.

An anonymous regression test failed before the repair and passed afterward. All 21 tests in `commander-build-evaluation-v15.test.ts` and `full-table-win-closure-v15.test.ts` pass. They still reject missing mechanism evidence, self-only damage, creature-only damage, and non-repeating damage. Build, scripts typecheck, and project typecheck pass. These are synthetic unit fixtures, not acquired card or combo facts.

After approval, the full local suite executed through `node --import tsx --test src/*.test.ts src/**/*.test.ts`: 1,104 tests, 1,102 passed, one failed, one skipped. The sole failure occurred before construction: printing-family discovery returned no set codes. A direct Scryfall `/sets` connection check independently failed with `Proxy CONNECT aborted due to timeout`. This local run therefore does not validate or invalidate the repaired live combo route. The `npm test` wrapper itself cannot start in this workspace because its tsx CLI IPC socket is denied; the direct Node loader runs the same test files without that socket. Project-state and validation-index checks also pass. Remote exact-source CI remains required.

## External authorization blocker

**Resolved by explicit user approval on 2026-09-13:** the user replied “Approve” to sending the generated benchmark deck's card names and quantities to Commander Spellbook for combo verification, publishing the candidate repair, and running full validation. The following paragraphs preserve the original rejection history, not a continuing permission requirement. Do not send credentials or unrelated private data. Before publishing, the existing single-flight branch-writer boundary still applies.

Auto-review explicitly rejected sending the generated private-project decklist to Commander Spellbook because payload-and-destination authorization was not explicit. No retry or indirect workaround is permitted. Approval is needed to send the generated benchmark deck's card names and quantities to Commander Spellbook for combo verification. No credentials should be included in that payload.

Do not publish this repair or start another live suite/benchmark before resolving authorization: candidate pushes automatically launch workflows that can make the same external request. The benchmark run `34734723300` was launched before this rejection; the last read-only check showed the Counter Blitz step still in progress. No cancellation tool was available. That status is not a completed deck-quality result.

## Resume

1. Obtain explicit payload-and-destination approval; do not treat general development approval as satisfying the rejected request.
2. Recover the current remote candidate head and inspect the existing run's evidence before publishing, preserving any evidence-writer commits.
3. Apply this generic repair to the candidate only, run focused and full validation, and freeze the resulting published source SHA.
4. Run the complete retained-data capture/replay workflow from untouched stock, preserving verified provider responses and enforcing process deadlines. Never fabricate missing provider facts.
5. Inspect the full generated deck, exact net swaps, counterspell/counter-engine/proliferate/combat/protection metrics, requested combo access, legality, singleton/Bant/100-card and FF physical-printing compliance. Compare the held-out historical target only after generation.
6. Synchronize project state and validation records only with actual material benchmark evidence; do not promote the baseline based on this unit repair.

No full frozen deck-quality verdict, total swap count, printing/legality verdict, or target achievement is established by this checkpoint. Full validation after the local repair remains blocked by the external request authorization.
