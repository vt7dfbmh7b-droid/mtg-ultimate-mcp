<!-- GENERATED FROM validation-registry.json + test-results + project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Validation State

Development checkpoint: `77a5383fa7490aa91360b8186a4bda890f632157`

| Control | Claim level | Outcome | Tested source | Matches checkpoint | Metadata |
|---|---|---|---|---|---|
| PM-STATE-INTEGRITY | engineering+truth | pass | `e181d35d7e858e621456d5f720ff73dfa45180b5` | no | `test-results/project-management/integrity.txt` |
| INTEL-01-POSITIVE | scenario-intelligence | pass | `50e5d19344d060c008abc13b37672cd06717095a` | no | `test-results/intel01-positive/run-metadata.txt` |
| MARVEL-B5-REFINE | scenario-intelligence | fail | `f0c3b9f82dca49f295e44175e517d992e6e5356e` | no | `test-results/marvel-bracket5/refine-run-metadata.txt` |
| MARVEL-B5-BROAD | scenario-intelligence | fail | `f0c3b9f82dca49f295e44175e517d992e6e5356e` | no | `test-results/marvel-bracket5-broad/run-metadata.txt` |
| MIDDLE-EARTH-PRECON-REFINE | scenario-intelligence | pass | `fe40cde70c111f16019a34cdb70c263aaa503f11` | no | `test-results/middle-earth-precon-refine/run-metadata.txt` |
| PRECON-GENERALIZATION | scenario-intelligence | pass | `f0c3b9f82dca49f295e44175e517d992e6e5356e` | no | `test-results/precon-generalization/run-metadata.txt` |
| STRATEGY-INFERENCE-GENERALIZATION | engineering+truth | pass | `3d675105fb15742740d67442b2dea9b86b063d01` | no | `test-results/strategy-inference-generalization/run-metadata.txt` |
| SQUIRRELED-AWAY-GENERALIZATION | scenario-intelligence | pass | `f0c3b9f82dca49f295e44175e517d992e6e5356e` | no | `test-results/precon-generalization-squirrels/run-metadata.txt` |

## Interpretation

- **pass** means the registered pass conditions in that control's persisted metadata are satisfied.
- **fail** means persisted metadata exists but one or more registered pass conditions are not satisfied.
- **unknown** means the registered metadata file does not exist.
- A pass whose tested source does not match the current development checkpoint is historical evidence, not proof of the checkpoint.
- Scenario-intelligence controls must still be interpreted according to `docs/VALIDATION-MATRIX.md`; a passing process does not automatically prove broad Commander intelligence.
