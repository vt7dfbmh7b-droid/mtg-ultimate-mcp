<!-- GENERATED FROM validation-registry.json + test-results + project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Validation State

Development checkpoint: `77a5383fa7490aa91360b8186a4bda890f632157`

| Control | Claim level | Outcome | Tested source | Matches checkpoint | Metadata |
|---|---|---|---|---|---|
| PM-STATE-INTEGRITY | engineering+truth | fail | `0087f90eeed8602cf1b56ccc98d6a0845418da70` | no | `test-results/project-management/integrity.txt` |
| INTEL-01-POSITIVE | scenario-intelligence | pass | `5829b37b686255ba35d419b37be17095e54fb696` | no | `test-results/intel01-positive/run-metadata.txt` |
| MARVEL-B5-REFINE | scenario-intelligence | fail | `5829b37b686255ba35d419b37be17095e54fb696` | no | `test-results/marvel-bracket5/refine-run-metadata.txt` |
| MARVEL-B5-BROAD | scenario-intelligence | fail | `5829b37b686255ba35d419b37be17095e54fb696` | no | `test-results/marvel-bracket5-broad/run-metadata.txt` |
| SCIONS-SPELLCRAFT-FF-ONLY | scenario-intelligence | pass | `5829b37b686255ba35d419b37be17095e54fb696` | no | `test-results/scions-spellcraft-ff-only/run-metadata.txt` |
| MIDDLE-EARTH-PRECON-REFINE | scenario-intelligence | pass | `5829b37b686255ba35d419b37be17095e54fb696` | no | `test-results/middle-earth-precon-refine/run-metadata.txt` |
| PRECON-GENERALIZATION | scenario-intelligence | pass | `5829b37b686255ba35d419b37be17095e54fb696` | no | `test-results/precon-generalization/run-metadata.txt` |
| STRATEGY-INFERENCE-GENERALIZATION | engineering+truth | pass | `5829b37b686255ba35d419b37be17095e54fb696` | no | `test-results/strategy-inference-generalization/run-metadata.txt` |
| SQUIRRELED-AWAY-GENERALIZATION | scenario-intelligence | pass | `5829b37b686255ba35d419b37be17095e54fb696` | no | `test-results/precon-generalization-squirrels/run-metadata.txt` |

## Interpretation

- **pass** means the registered pass conditions in that control's persisted metadata are satisfied.
- **fail** means persisted metadata exists but one or more registered pass conditions are not satisfied.
- **unknown** means the registered metadata file does not exist.
- A pass whose tested source does not match the current development checkpoint is historical evidence, not proof of the checkpoint.
- Scenario-intelligence controls must still be interpreted according to `docs/VALIDATION-MATRIX.md`; a passing process does not automatically prove broad Commander intelligence.
