# Counter Blitz frozen replay

This is an execution protocol, not an accepted deck-quality verdict.

Run the checked-in `scripts/bench01-counter-blitz-ff-only-v15.ts` on a clean, committed source tree with `SCRYFALL_RETAINED_RAW_PATH` and `SCRYFALL_RETAINED_MANIFEST_PATH` pointing to the existing verified retained Scryfall bytes and manifest. The manifest and compressed/decoded hashes are verified by the existing capture/replay architecture.

The supervisor starts two fresh worker processes. The first captures actual MTGJSON, Scryfall set/catalog, currency and Commander Spellbook responses; all card lookup/search/pagination uses the verified retained card snapshot. The second regenerates from untouched stock using only those captured inputs. It has no live network fallback. Both passes must agree on the complete deck, stock/final hashes, exact net changes, swap count and quality measurements.

The MTGJSON stock precon is resolved by the same production precon entry point used by refinement. The audit no longer reads stock from a replaceable benchmark-output directory or invents precon metadata. Captured responses are data inputs, not candidate decks. The historical Tidus upgrade is comparison-only and is not loaded by this workflow.

## Retained artifacts and resumption

- `bench01-counter-blitz-http-capture.json`: exact provider response bytes, request/response hashes, source SHA and Scryfall-manifest binding. Written as responses arrive; a failed capture resumes from this file only if its source and snapshot bindings match.
- `bench01-counter-blitz-*-trace.jsonl`: stage, provider and optimizer-candidate timing records. These identify whether time was spent acquiring data or evaluating candidates.
- `bench01-counter-blitz-first-pass.json`: first independent complete evaluation, if reached.
- `bench01-counter-blitz-result.json`: checked replay output; only the supervisor adds the successful determinism record after comparing both fresh processes.
- Failure record: explicit worker mode/deadline and error. Partial results are never an acceptance verdict.

For strict replay of an existing capture, set `BENCH01_HTTP_CAPTURE_PATH` to it. The supervisor performs two fresh offline replays. For acquisition resumption, restore the capture at its default filename and run without that environment variable. Wrong-source captures must be preserved separately, not edited to claim a new SHA.

The default outer deadline is 20 minutes per pass (`BENCH01_PASS_DEADLINE_MS`), enforced by a separate process that terminates stuck workers. The original 1,000 simulation iterations are restored. The existing generic optimizer permits at most 30 swaps; this benchmark now exposes that capacity (five rounds of up to six swaps) instead of silently capping the request at 20. No minimum number of swaps is forced and none establishes quality by itself.

## Acceptance boundary

Record exact executable SHA, total accepted and net swaps, full final list, all before/after metrics, counterspell/counter-engine/proliferate/combat/protection counts, combo verification, exactly 100 cards, singleton/Bant legality and eligible physical FF printings. Compare against the held-out historical quality target only after independent generation. A completed replay can still fail the product-quality objective.

Unsupported retained-search syntax, missing provider responses and malformed snapshots fail closed and remain visible even if a product caller catches an error. Do not hand-author missing provider facts, skip the full validation gates, merge PR #29, or promote main/stable V0.13.
