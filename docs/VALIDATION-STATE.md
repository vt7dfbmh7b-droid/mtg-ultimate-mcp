<!-- GENERATED FROM validation-registry.json + test-results + project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Validation State

Development checkpoint: `77a5383fa7490aa91360b8186a4bda890f632157`

| Control | Claim level | Outcome | Tested source | Matches checkpoint | Metadata |
|---|---|---|---|---|---|
| PM-STATE-INTEGRITY | engineering+truth | pass | `0a872b11239b3b402ded5424d59e004756ca5acc` | no | `test-results/project-management/integrity.txt` |
| MARVEL-B5-REFINE | scenario-intelligence | fail | `c74b2b23f92efbf25d0c1cdfb051e88e1f98ef61` | no | `test-results/marvel-bracket5/refine-run-metadata.txt` |
| MARVEL-B5-BROAD | scenario-intelligence | fail | `7b84395191f27f29a438722c3b88af476ade5e9a` | no | `test-results/marvel-bracket5-broad/run-metadata.txt` |
| MIDDLE-EARTH-PRECON-REFINE | scenario-intelligence | pass | `b79dcae4278d1b5197bc0bbadea8d2ec6dabb2d3` | no | `test-results/middle-earth-precon-refine/run-metadata.txt` |
| PRECON-GENERALIZATION | scenario-intelligence | pass | `b79dcae4278d1b5197bc0bbadea8d2ec6dabb2d3` | no | `test-results/precon-generalization/run-metadata.txt` |
| STRATEGY-INFERENCE-GENERALIZATION | engineering+truth | pass | `0a872b11239b3b402ded5424d59e004756ca5acc` | no | `test-results/strategy-inference-generalization/run-metadata.txt` |
| SQUIRRELED-AWAY-GENERALIZATION | scenario-intelligence | fail | `97964ec19e215df48ed11865f946bd62e1b0d7d5` | no | `test-results/precon-generalization-squirrels/run-metadata.txt` |

## Interpretation

- **pass** means the registered pass conditions in that control's persisted metadata are satisfied.
- **fail** means persisted metadata exists but one or more registered pass conditions are not satisfied.
- **unknown** means the registered metadata file does not exist.
- A pass whose tested source does not match the current development checkpoint is historical evidence, not proof of the checkpoint.
- Scenario-intelligence controls must still be interpreted according to `docs/VALIDATION-MATRIX.md`; a passing process does not automatically prove broad Commander intelligence.
