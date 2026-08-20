from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}\n--- OLD ---\n{old}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    'src/services/deck-builder-v07.ts',
    "interface UpgradeStructuralCountsV15 {\n  ramp: number;\n  draw: number;\n  interaction: number;\n  freeInteraction: number;\n  protection: number;",
    "interface UpgradeStructuralCountsV15 {\n  ramp: number;\n  draw: number;\n  interaction: number;\n  'free-interaction': number;\n  protection: number;",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "      interaction: recordNumber(currentMetrics.interactionCount),\n      freeInteraction: currentRoleCountV15(currentMetrics, 'free interaction'),\n      protection: recordNumber(currentMetrics.protectionCount),",
    "      interaction: recordNumber(currentMetrics.interactionCount),\n      'free-interaction': currentRoleCountV15(currentMetrics, 'free interaction'),\n      protection: recordNumber(currentMetrics.protectionCount),",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "      interaction: recordNumber(structuralTargets.interaction),\n      freeInteraction: recordNumber(structuralTargets.freeInteraction),\n      protection: recordNumber(structuralTargets.protection),",
    "      interaction: recordNumber(structuralTargets.interaction),\n      'free-interaction': recordNumber(structuralTargets.freeInteraction),\n      protection: recordNumber(structuralTargets.protection),",
)

print('Fixed target-pressure structural role key mapping.')
# Touch-only validation retrigger after the regression-test assertion fix; removed on success.
