<!-- GENERATED FROM validation-registry.json + test-results + project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Validation State

Development checkpoint: `dfdb9663bd2394dfa620511d750501880b903770`

| Control | Claim level | Outcome | Tested source | Matches checkpoint | Metadata |
|---|---|---|---|---|---|
| PM-STATE-INTEGRITY | engineering+truth | fail | `dce929110b25c8338ca8930908cf413b261eaa0b` | no | `test-results/project-management/integrity.txt` |
| INTEL-01-POSITIVE | scenario-intelligence | pass | `ca6a40fe5766e22a905d9db6fbfd44e38ac3973e` | no | `test-results/intel01-positive/run-metadata.txt` |
| MARVEL-B5-REFINE | scenario-intelligence | fail | `5a94d1bc4b203398402ed160e4149cadb71b43b4` | no | `test-results/marvel-bracket5/refine-run-metadata.txt` |
| MARVEL-B5-BROAD | scenario-intelligence | fail | `5a94d1bc4b203398402ed160e4149cadb71b43b4` | no | `test-results/marvel-bracket5-broad/run-metadata.txt` |
| SCIONS-SPELLCRAFT-FF-ONLY | scenario-intelligence | fail | `5a94d1bc4b203398402ed160e4149cadb71b43b4` | no | `test-results/scions-spellcraft-ff-only/run-metadata.txt` |
| MIDDLE-EARTH-PRECON-REFINE | scenario-intelligence | fail | `5a94d1bc4b203398402ed160e4149cadb71b43b4` | no | `test-results/middle-earth-precon-refine/run-metadata.txt` |
| PRECON-GENERALIZATION | scenario-intelligence | fail | `5a94d1bc4b203398402ed160e4149cadb71b43b4` | no | `test-results/precon-generalization/run-metadata.txt` |
| STRATEGY-INFERENCE-GENERALIZATION | engineering+truth | pass | `5829b37b686255ba35d419b37be17095e54fb696` | no | `test-results/strategy-inference-generalization/run-metadata.txt` |
| SQUIRRELED-AWAY-GENERALIZATION | scenario-intelligence | pass | `ca6a40fe5766e22a905d9db6fbfd44e38ac3973e` | no | `test-results/precon-generalization-squirrels/run-metadata.txt` |

## Interpretation

- **pass** means the registered pass conditions in that control's persisted metadata are satisfied.
- **fail** means persisted metadata exists but one or more registered pass conditions are not satisfied.
- **unknown** means the registered metadata file does not exist.
- A pass whose tested source does not match the current development checkpoint is historical evidence, not proof of the checkpoint.
- Scenario-intelligence controls must still be interpreted according to `docs/VALIDATION-MATRIX.md`; a passing process does not automatically prove broad Commander intelligence.
