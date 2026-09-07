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
    '''function themedRoleSearchQuery(\n  role: string,\n  identity: string[],\n  themeClause: string,\n  printingPolicy: ResolvedPrintingPolicyV08,\n  targetGate: UpgradeTargetGateV15 | null = null,\n): string {\n  return ['f:commander', identityQuery(identity), '-t:land', roleClause(role, targetGate), themeClause, printingPolicy.searchClause]\n    .filter(Boolean)\n    .join(' ');\n}\n''',
    '''function themedRoleSearchQuery(\n  role: string,\n  identity: string[],\n  themeClause: string,\n  printingPolicy: ResolvedPrintingPolicyV08,\n  targetGate: UpgradeTargetGateV15 | null = null,\n): string {\n  return ['f:commander', identityQuery(identity), '-t:land', roleClause(role, targetGate), themeClause, printingPolicy.searchClause]\n    .filter(Boolean)\n    .join(' ');\n}\n\n/**\n * An explicit controlled/requested identity remains useful candidate-discovery evidence after its\n * minimum density is satisfied. Minimums are preservation gates, not a signal to stop searching\n * for role-compatible on-plan replacements.\n */\nexport function requestedIdentityRoleSearchEnabledV15(themeClause: string): boolean {\n  return themeClause.trim().length > 0;\n}\n''',
)

replace_once(
    upgrade,
    '''    let themedQuery: string | null = null;\n    let themedResults: ScryfallCard[] = [];\n    if (themeDeficit > 0 && themeClause) {\n      themedQuery = themedRoleSearchQuery(deficit.role, allowedIdentity, themeClause, printingPolicy, deficit.targetGate);\n      try {\n        themedResults = await searchCards(themedQuery, 40);\n        for (const card of themedResults) themeCandidateNames.add(card.name.toLocaleLowerCase());\n      } catch {}\n    }\n''',
    '''    let themedQuery: string | null = null;\n    let themedResults: ScryfallCard[] = [];\n    if (requestedIdentityRoleSearchEnabledV15(themeClause)) {\n      themedQuery = themedRoleSearchQuery(deficit.role, allowedIdentity, themeClause, printingPolicy, deficit.targetGate);\n      try {\n        themedResults = await searchCards(themedQuery, 40);\n        for (const card of themedResults) themeCandidateNames.add(card.name.toLocaleLowerCase());\n      } catch {}\n    }\n''',
)

replace_once(
    upgrade,
    '''      discoveredThemeCandidateNames: themeCandidateNames.size, supplementalRoleSearchesEnabled: themeDeficit > 0 && Boolean(themeClause),\n''',
    '''      discoveredThemeCandidateNames: themeCandidateNames.size, supplementalRoleSearchesEnabled: requestedIdentityRoleSearchEnabledV15(themeClause),\n''',
)

replace_once(
    upgrade,
    '''      'When a V0.15 controlled theme is below its minimum density, the engine uses the controlled theme query as a positive membership/ranking signal. Under a printing restriction, only cards already admitted by the exhaustive shared eligible pool can become candidates.',\n''',
    '''      'A V0.15 controlled/requested theme remains an advisory role-candidate discovery and ranking signal even after its minimum density is satisfied; the minimum remains a preservation gate rather than a switch that disables on-plan replacement search. Under a printing restriction, only cards already admitted by the exhaustive shared eligible pool can become candidates.',\n''',
)

test_path = Path('src/services/upgrade-strategy-compatible-lane-v15.test.ts')
test_text = test_path.read_text()
test_text = test_text.replace(
    '''  strategyCompatibleCandidateLanesV15,\n  upgradeStrategySearchClausesV15,\n''',
    '''  requestedIdentityRoleSearchEnabledV15,\n  strategyCompatibleCandidateLanesV15,\n  upgradeStrategySearchClausesV15,\n''',
    1,
)
append = '''\n\ntest('requested identity role discovery stays enabled after a theme minimum is already satisfied', () => {\n  // Density satisfaction must not disable discovery of on-plan role replacements.\n  assert.equal(requestedIdentityRoleSearchEnabledV15('t:elf'), true);\n  assert.equal(requestedIdentityRoleSearchEnabledV15('t:instant OR t:sorcery'), true);\n  assert.equal(requestedIdentityRoleSearchEnabledV15('t:enchantment'), true);\n  assert.equal(requestedIdentityRoleSearchEnabledV15('(t:artifact OR t:enchantment) mv>=4'), true);\n});\n\ntest('requested identity role discovery remains disabled when no explicit controlled identity exists', () => {\n  assert.equal(requestedIdentityRoleSearchEnabledV15(''), false);\n  assert.equal(requestedIdentityRoleSearchEnabledV15('   '), false);\n});\n'''
if "requested identity role discovery stays enabled" in test_text:
    raise SystemExit('tests already patched')
test_path.write_text(test_text + append)
