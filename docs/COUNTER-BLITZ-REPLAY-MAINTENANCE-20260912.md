# Interactive replay maintenance review — 2026-09-12

Scope: the user's interactive request to fix the replay and validation defects identified in the preceding review. This is repository maintenance on the dedicated candidate branch; it is not baseline acceptance, stable promotion, or PR #29 merge authority.

Reviewed AGENTS.md, src/workflow-immutability.test.ts, src/repository-integrity.test.ts, and KNOWN-FAILURES KF-046/KF-047 before editing workflows. The history since policy epoch b1f84be4368b4fbe5367efc276a25ecc1758ec87 contains two workflow changes:

- 31b69b62dd32ea9284d81abc3477fb856b5f633c: pin the retention setup action to the ORAS release that supports its requested CLI version.
- e304dc9cb28f2cbe86ac8d3d147c6974a7a117d5: add the candidate branch and verified immutable snapshot pulls to Batch A.

Both changes are now explicitly reviewed. The history failure was valid and was not a product-intelligence failure. No historical run is retroactively declared successful.

This maintenance package keeps immutable action pins and checked-in source execution, adds script typechecking, retains the provider capture/trace and exact Scryfall snapshot as downloadable artifacts, and corrects the false old-source label in Batch A metadata. The supervisor runs fresh processes from the checkout SHA and compares complete decks and quality measurements before recording deterministic replay.

The two Marvel controls retain their tests, target gates and manual dispatch. Their automatic push triggers exclude this dedicated Counter Blitz candidate, which already has Batch A as its evidence writer. This prevents the same source push from launching three competing branch writers; it does not establish Marvel validation or waive its promotion gates. CI and the Batch A contrasting Liliana control remain enabled.

After committing this reviewed workflow tree, the next ordinary source commit pins workflowPolicyEpochSha to this maintenance commit. The full-history freeze and workflow-tree equality assertions remain unchanged. No workflow may mutate product source during validation.

Prior run 34721595427 at 429916c0d7328d8482722b874cd383358ae629f9 timed out at 22:32:23Z and did not exit until 23:18:05Z. Its Counter Blitz outcome was failure despite the step-level continue-on-error display. The new supervisor addresses that leaked execution; no deck-quality recovery is yet claimed.
