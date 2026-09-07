from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one replacement target, found {count}')
    p.write_text(text.replace(old, new, 1))

upgrade = 'src/services/upgrade.ts'

replace_once(
    upgrade,
    '''export function compoundComponentCandidateLanesV15<T>(\n  candidates: readonly T[],\n  isComponentAligned: (candidate: T) => boolean,\n  isStrategyCompatible: (candidate: T) => boolean,\n  isAnchorAligned?: (candidate: T) => boolean,\n): T[][] {\n  const anchor = isAnchorAligned ? candidates.filter(isAnchorAligned) : [];\n  const anchorSet = new Set(anchor);\n  const component = candidates.filter((candidate) => !anchorSet.has(candidate) && isComponentAligned(candidate));\n  const componentSet = new Set(component);\n  const strategy = candidates.filter((candidate) => !anchorSet.has(candidate) && !componentSet.has(candidate) && isStrategyCompatible(candidate));\n  const strategySet = new Set(strategy);\n  const generic = candidates.filter((candidate) => !anchorSet.has(candidate) && !componentSet.has(candidate) && !strategySet.has(candidate));\n  return [anchor, component, strategy, generic].filter((lane) => lane.length > 0);\n}\n''',
    '''export function compoundComponentCandidateLanesV15<T>(\n  candidates: readonly T[],\n  isComponentAligned: (candidate: T) => boolean,\n  isStrategyCompatible: (candidate: T) => boolean,\n  isAnchorAligned?: (candidate: T) => boolean,\n  isRequestedRoleAligned?: (candidate: T) => boolean,\n): T[][] {\n  const anchor = isAnchorAligned ? candidates.filter(isAnchorAligned) : [];\n  const anchorSet = new Set(anchor);\n  const component = candidates.filter((candidate) => !anchorSet.has(candidate) && isComponentAligned(candidate));\n  const componentSet = new Set(component);\n  // Role-specific requested-theme discovery is stronger evidence than broad inferred-strategy\n  // overlap. Keep it in its own lane so cards discovered by the exact requested mechanism +\n  // structural-role query cannot be demoted merely because they fell outside a bounded global\n  // component search window.\n  const requestedRole = isRequestedRoleAligned\n    ? candidates.filter((candidate) => !anchorSet.has(candidate) && !componentSet.has(candidate) && isRequestedRoleAligned(candidate))\n    : [];\n  const requestedRoleSet = new Set(requestedRole);\n  const strategy = candidates.filter((candidate) => !anchorSet.has(candidate) && !componentSet.has(candidate) && !requestedRoleSet.has(candidate) && isStrategyCompatible(candidate));\n  const strategySet = new Set(strategy);\n  const generic = candidates.filter((candidate) => !anchorSet.has(candidate) && !componentSet.has(candidate) && !requestedRoleSet.has(candidate) && !strategySet.has(candidate));\n  return [anchor, component, requestedRole, strategy, generic].filter((lane) => lane.length > 0);\n}\n''',
)

replace_once(
    upgrade,
    '''      ? compoundComponentCandidateLanesV15(\n          rankedForPrinting,\n          (card) => componentAffinityForCard(card).score >= 4,\n          (card) => candidateStrategyPriorityV15(card, strategyContext).substantive,\n          (card) => anchorAffinityForCard(card) > 0,\n        )\n''',
    '''      ? compoundComponentCandidateLanesV15(\n          rankedForPrinting,\n          (card) => componentAffinityForCard(card).score >= 4,\n          (card) => candidateStrategyPriorityV15(card, strategyContext).substantive,\n          (card) => anchorAffinityForCard(card) > 0,\n          (card) => themeCandidateNames.has(card.name.toLocaleLowerCase()),\n        )\n''',
)

replace_once(
    upgrade,
    '''      'Within an already-required structural role or target gate, an explicit compound request preserves the starting deck’s dominant requested component first, then considers other requested components, substantive inferred commander strategy, and finally generic structural fallback. A later lane is considered only when the earlier lane yields zero eligible printings after printing/price policy checks.',\n''',
    '''      'Within an already-required structural role or target gate, an explicit compound request preserves the starting deck’s dominant requested component first, then considers globally recognized requested components, exact role-specific requested-theme discoveries, substantive inferred commander strategy, and finally generic structural fallback. A later lane is considered only when the earlier lane yields zero eligible printings after printing/price policy checks.',\n''',
)

test_path = Path('src/services/upgrade-strategy-compatible-lane-v15.test.ts')
text = test_path.read_text()
text = text.replace(
    '''  anchorFit?: boolean;\n};\n''',
    '''  anchorFit?: boolean;\n  requestedRoleFit?: boolean;\n};\n''',
    1,
)
append = '''\n\ntest('role-specific requested-theme discovery outranks inferred strategy and generic fallback when global component recall misses it', () => {\n  const requestedRole: Candidate = { name: 'Role-specific requested mechanism', identityFit: true, requestedRoleFit: true, strategyFit: false };\n  const strategy: Candidate = { name: 'Broad inferred strategy', identityFit: true, strategyFit: true };\n  const generic: Candidate = { name: 'Generic structural utility', identityFit: false };\n  assert.deepEqual(compoundComponentCandidateLanesV15(\n    [generic, strategy, requestedRole],\n    (candidate) => Boolean(candidate.componentFit),\n    (candidate) => Boolean(candidate.strategyFit),\n    (candidate) => Boolean(candidate.anchorFit),\n    (candidate) => Boolean(candidate.requestedRoleFit),\n  ), [[requestedRole], [strategy], [generic]]);\n});\n\ntest('role-specific requested-theme lane preserves generic fallback when its printings are unavailable', () => {\n  const requestedRole: Candidate = { name: 'Unavailable requested role card', identityFit: true, requestedRoleFit: true, printingEligible: false };\n  const generic: Candidate = { name: 'Available generic structural utility', identityFit: false, printingEligible: true };\n  const chosen: Candidate[] = [];\n  for (const lane of compoundComponentCandidateLanesV15(\n    [generic, requestedRole],\n    (candidate) => Boolean(candidate.componentFit),\n    (candidate) => Boolean(candidate.strategyFit),\n    (candidate) => Boolean(candidate.anchorFit),\n    (candidate) => Boolean(candidate.requestedRoleFit),\n  )) {\n    const before = chosen.length;\n    chosen.push(...lane.filter((candidate) => candidate.printingEligible));\n    if (chosen.length > before) break;\n  }\n  assert.deepEqual(chosen, [generic]);\n});\n'''
if 'role-specific requested-theme discovery outranks inferred strategy' in text:
    raise SystemExit('tests already patched')
test_path.write_text(text + append)
