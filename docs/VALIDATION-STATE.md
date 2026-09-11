<!-- GENERATED FROM validation-registry.json + test-results + project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Validation State

Development checkpoint: `1ef10cec8c50d3d576cb1c3ae3c2566a4f632aa7`

| Control | Claim level | Outcome | Tested source | Matches checkpoint | Metadata |
|---|---|---|---|---|---|
| PM-STATE-INTEGRITY | engineering+truth | pass | `d3c6b0b3ea15ffc04891ec1e282756174f423891` | no | `test-results/project-management/integrity.txt` |
| INTEL-01-POSITIVE | scenario-intelligence | pass | `c91569d14f79b0b0763d0090289035f6f70ef3ab` | no | `test-results/intel01-positive/run-metadata.txt` |
| MARVEL-B5-REFINE | scenario-intelligence | fail | `1907c4cf629124a141478b34ea8a5fb5fcd31e8d` | no | `test-results/marvel-bracket5/refine-run-metadata.txt` |
| MARVEL-B5-BROAD | scenario-intelligence | fail | `f7c88d190fc331954ad30d940536c752c58c620e` | no | `test-results/marvel-bracket5-broad/run-metadata.txt` |
| SCIONS-SPELLCRAFT-FF-ONLY | scenario-intelligence | pass | `580b1c1a739b139bc745d39fb661f83da9afa9fd` | no | `test-results/scions-spellcraft-ff-only/run-metadata.txt` |
| MIDDLE-EARTH-PRECON-REFINE | scenario-intelligence | pass | `f13772d3c414185db658d3f55a20ee45f68c5bc6` | no | `test-results/middle-earth-precon-refine/run-metadata.txt` |
| PRECON-GENERALIZATION | scenario-intelligence | pass | `f13772d3c414185db658d3f55a20ee45f68c5bc6` | no | `test-results/precon-generalization/run-metadata.txt` |
| STRATEGY-INFERENCE-GENERALIZATION | engineering+truth | pass | `9c75d8fce791d02169c64e4a3d5357badc892ba9` | no | `test-results/strategy-inference-generalization/run-metadata.txt` |
| SQUIRRELED-AWAY-GENERALIZATION | scenario-intelligence | pass | `f13772d3c414185db658d3f55a20ee45f68c5bc6` | no | `test-results/precon-generalization-squirrels/run-metadata.txt` |

## Interpretation

- **pass** means the registered pass conditions in that control's persisted metadata are satisfied.
- **fail** means persisted metadata exists but one or more registered pass conditions are not satisfied.
- **unknown** means the registered metadata file does not exist.
- A pass whose tested source does not match the current development checkpoint is historical evidence, not proof of the checkpoint.
- Scenario-intelligence controls must still be interpreted according to `docs/VALIDATION-MATRIX.md`; a passing process does not automatically prove broad Commander intelligence.
