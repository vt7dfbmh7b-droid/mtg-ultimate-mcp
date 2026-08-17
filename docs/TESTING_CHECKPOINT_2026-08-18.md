# Ultimate MTG — Testing Checkpoint — 2026-08-18 NZST

Active branch: `agent/package-probabilities`

Stable runtime remains V0.13. Do not promote `src/server-current.ts` as part of this checkpoint.

## Green checkpoint before this note

Exact implementation/control head before this note: `c06bf8c8622953b524534705a7db01304d4949f9`.

At that head:

- normal CI passed dependency install, strict TypeScript build, and the complete automated suite;
- Final Fantasy Bracket 5 E2E passed;
- unrestricted cEDH control passed.

## New hardening completed in this testing pass

### Historical Commander construction gate

Historical rich-feature extraction now reuses the project hard Commander validator rather than accepting any syntactically 100-card list.

Coverage includes:

- exact 100-card construction;
- one/two commander eligibility and legal pairing;
- Commander legality;
- color identity;
- singleton restrictions;
- basic-land exemptions;
- Oracle copy-count exceptions such as “any number of cards named …”.

`ProvenancedDeckFeatureSnapshotV15` now stores a `historicalCommanderValidation` summary. The runtime historical-snapshot guard requires that summary to be unequivocally legal and internally consistent.

### Historical card-data provenance hardening

Rich historical structural features remain blocked for retrospective current data. Safe modes remain contemporaneous capture or an archived/versioned source demonstrably published before the feature cutoff.

Additional regressions enforce:

- source availability exactly matches `cardDataObservedAt`;
- retrieval cannot precede source availability;
- eligible provenance cannot simultaneously contain failure reasons;
- source identity/hash/URI are revalidated;
- archive version/effective-time ordering is revalidated;
- historical TopDeck temporal-corpus materialization requires a provenanced snapshot rather than a plain low-level structural snapshot.

Historical name-only printing resolution is deterministic and uses only dated printings released by the feature cutoff. Exact set/collector requests stay exact. If pre-cutoff existence cannot be proved, extraction fails closed.

### Feature-contract safety for temporal ML

`neural-temporal-eval-v15.ts` now assesses feature-contract safety before model training/evaluation.

Training/evaluation is blocked when one corpus mixes:

- different `featureExtractorId` contracts;
- different frozen `featureNormalizerFitFingerprint` values;
- normalized feature records missing their normalizer-fit provenance;
- malformed normalizer-fit fingerprints;
- known feature-contract records with legacy/no-contract records.

All-legacy corpora remain backward-compatible as one legacy feature contract.

This is separate from the existing mixed-`learningTarget` guard: both label semantics and feature semantics must now be homogeneous before a classifier is evaluated.

Feature-contract safety commit: `0374644645dd5f50624b932ee723411351c81b04`; CI succeeded for that exact head.

### CI diagnostics

`.github/workflows/ci.yml` now captures `npm test` output with `tee` and uploads `test-output.log` using `actions/upload-artifact@v4` on every run.

This was used to isolate a real red run where the production guard was correct and one negative test regex was too narrow. The test expectation was corrected rather than weakening production logic.

### Permanent E2E control triggers

The FF Bracket 5 and unrestricted cEDH workflows now also trigger when current/historical Commander legality regression files change, not only when `commander-rules.ts` changes.

This ensures legality/provenance hardening cannot pass unit tests while silently regressing actual restricted or unrestricted deck-building workflows.

## Important unresolved historical-rules issue

Wizards’ current official Comprehensive Rules are the August 7, 2026 version, but the project’s Commander validator identifies itself generically as “current Commander policy” rather than carrying an as-of rules snapshot.

Do not claim that replaying the current validator over an older tournament is historically exact until a rules-version provenance contract exists.

Card-data provenance and historical printing resolution are now explicit; Commander-rules provenance should receive the same treatment before large historical backfills are treated as historically exact.

## Next testing targets

1. Add explicit Commander-ruleset provenance/as-of semantics for historical validation. Prefer false negatives / exclusion over silently applying future rule semantics to past events.
2. Harden generic observed-outcome ingestion so future provider adapters cannot enter rich structural learning records without hard construction-validation provenance.
3. After the above, build the manual/live TopDeck corpus refresh separate from deterministic CI. Preserve rate-limit/attribution rules and persist normalized records/manifests rather than raw provider payload dumps.
4. Keep neural promotion blocked until one explicit target has sufficient independent, balanced, temporally broad future holdout data and repeatedly beats the transparent baseline.

## Permanent quality rules

- legality/printing/rules truth remains outside ML;
- exact probability proof surfaces remain BigInt/fraction based;
- failed fixtures may be wrong—never corrupt correct production logic to satisfy a bad expectation;
- temporal split happens before normalization;
- mirrors/related outcomes are independence/leakage aware;
- current data must never be back-dated to fabricate historical availability;
- stable V0.13 remains unchanged without explicit release/promotion decision.
