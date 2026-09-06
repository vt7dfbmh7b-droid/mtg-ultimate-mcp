<!-- GENERATED FROM validation-registry.json + test-results + project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Validation State

Development checkpoint: `90eae44f0fca63f51d82f2e05c1e656492a9b768`

| Control | Claim level | Outcome | Tested source | Matches checkpoint | Metadata |
|---|---|---|---|---|---|
| PM-STATE-INTEGRITY | engineering+truth | pass | `2636a81aea764f3e5f5960a6f5c107431620fa41` | no | `test-results/project-management/integrity.txt` |
| INTEL-01-POSITIVE | scenario-intelligence | pass | `5829b37b686255ba35d419b37be17095e54fb696` | no | `test-results/intel01-positive/run-metadata.txt` |
| MARVEL-B5-REFINE | scenario-intelligence | fail | `53a18a65f51c3c023ccee35c126164729d522dba` | no | `test-results/marvel-bracket5/refine-run-metadata.txt` |
| MARVEL-B5-BROAD | scenario-intelligence | fail | `53a18a65f51c3c023ccee35c126164729d522dba` | no | `test-results/marvel-bracket5-broad/run-metadata.txt` |
| SCIONS-SPELLCRAFT-FF-ONLY | scenario-intelligence | pass | `e24c4ed73a9227c71c11f22ab9cd146f2f9efaa9` | no | `test-results/scions-spellcraft-ff-only/run-metadata.txt` |
| MIDDLE-EARTH-PRECON-REFINE | scenario-intelligence | pass | `556787e7864293ecdbd29a37a5761d80fe8af50e` | no | `test-results/middle-earth-precon-refine/run-metadata.txt` |
| PRECON-GENERALIZATION | scenario-intelligence | pass | `bafc023828fadafa811757e0e04e56a70beecdeb` | no | `test-results/precon-generalization/run-metadata.txt` |
| STRATEGY-INFERENCE-GENERALIZATION | engineering+truth | pass | `5829b37b686255ba35d419b37be17095e54fb696` | no | `test-results/strategy-inference-generalization/run-metadata.txt` |
| SQUIRRELED-AWAY-GENERALIZATION | scenario-intelligence | pass | `bafc023828fadafa811757e0e04e56a70beecdeb` | no | `test-results/precon-generalization-squirrels/run-metadata.txt` |

## Interpretation

- **pass** means the registered pass conditions in that control's persisted metadata are satisfied.
- **fail** means persisted metadata exists but one or more registered pass conditions are not satisfied.
- **unknown** means the registered metadata file does not exist.
- A pass whose tested source does not match the current development checkpoint is historical evidence, not proof of the checkpoint.
- Scenario-intelligence controls must still be interpreted according to `docs/VALIDATION-MATRIX.md`; a passing process does not automatically prove broad Commander intelligence.
