from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one replacement target, found {count}')
    p.write_text(text.replace(old, new, 1))


path = 'src/services/upgrade.ts'
replace_once(path, '''export function compoundComponentCandidateLanesV15<T>(
  candidates: readonly T[],
  isComponentAligned: (candidate: T) => boolean,
  isStrategyCompatible: (candidate: T) => boolean,
): T[][] {
  const component = candidates.filter(isComponentAligned);
  const componentSet = new Set(component);
  const strategy = candidates.filter((candidate) => !componentSet.has(candidate) && isStrategyCompatible(candidate));
  const strategySet = new Set(strategy);
  const generic = candidates.filter((candidate) => !componentSet.has(candidate) && !strategySet.has(candidate));
  return [component, strategy, generic].filter((lane) => lane.length > 0);
}

export function upgradeThemeComponentAffinityScoreV15(''', '''export function compoundComponentCandidateLanesV15<T>(
  candidates: readonly T[],
  isComponentAligned: (candidate: T) => boolean,
  isStrategyCompatible: (candidate: T) => boolean,
  isAnchorAligned?: (candidate: T) => boolean,
): T[][] {
  const anchor = isAnchorAligned ? candidates.filter(isAnchorAligned) : [];
  const anchorSet = new Set(anchor);
  const component = candidates.filter((candidate) => !anchorSet.has(candidate) && isComponentAligned(candidate));
  const componentSet = new Set(component);
  const strategy = candidates.filter((candidate) => !anchorSet.has(candidate) && !componentSet.has(candidate) && isStrategyCompatible(candidate));
  const strategySet = new Set(strategy);
  const generic = candidates.filter((candidate) => !anchorSet.has(candidate) && !componentSet.has(candidate) && !strategySet.has(candidate));
  return [anchor, component, strategy, generic].filter((lane) => lane.length > 0);
}

/**
 * Treat the most-represented requested component in the resolved starting deck as the identity
 * anchor. Deficit/scarcity remains useful for balancing secondary components, but cannot invert
 * the deck's established mechanism. Exact ties remain co-anchors rather than inventing priority.
 */
export function upgradeThemeAnchorComponentIdsV15(
  components: readonly UpgradeThemeComponentSignalV15[],
): string[] {
  const represented = components.filter((component) => component.currentMainMatches > 0);
  if (represented.length === 0) return [];
  const maximum = Math.max(...represented.map((component) => component.currentMainMatches));
  return represented
    .filter((component) => component.currentMainMatches === maximum)
    .map((component) => component.id)
    .sort((left, right) => left.localeCompare(right));
}

export function upgradeThemeComponentAffinityScoreV15(''')

replace_once(path, '''  const componentAwareThemeRanking = themeComponents.length > 1 && themeComponentCandidateNames.size > 0;

  const existing = new Set''', '''  const componentAwareThemeRanking = themeComponents.length > 1 && themeComponentCandidateNames.size > 0;
  const anchorComponentIds = new Set(upgradeThemeAnchorComponentIdsV15(themeComponents));
  const anchorAffinityForCard = (card: ScryfallCard): number => componentAffinityForCard(card).matchedComponentIds
    .filter((id) => anchorComponentIds.has(id)).length;

  const existing = new Set''')

replace_once(path, '''        if (componentAwareThemeRanking) {
          const aComponent = componentAffinityForCard(a).score;
          const bComponent = componentAffinityForCard(b).score;
          // The explicit resolved request is the strongest positive signal among structurally
          // eligible candidates. Inferred strategy remains the secondary tie-break/fallback.
          if (aComponent !== bComponent) return bComponent - aComponent;
          if (aStrategy.substantive !== bStrategy.substantive) return bStrategy.substantive ? 1 : -1;
          if (aStrategy.substantive && aStrategy.score !== bStrategy.score) return bStrategy.score - aStrategy.score;
        } else {''', '''        if (componentAwareThemeRanking) {
          const aAnchor = anchorAffinityForCard(a);
          const bAnchor = anchorAffinityForCard(b);
          const aComponent = componentAffinityForCard(a).score;
          const bComponent = componentAffinityForCard(b).score;
          // Preserve the established requested mechanism before balancing secondary requested
          // components. Scarcity affinity remains a secondary within-component signal.
          if (aAnchor !== bAnchor) return bAnchor - aAnchor;
          if (aComponent !== bComponent) return bComponent - aComponent;
          if (aStrategy.substantive !== bStrategy.substantive) return bStrategy.substantive ? 1 : -1;
          if (aStrategy.substantive && aStrategy.score !== bStrategy.score) return bStrategy.score - aStrategy.score;
        } else {''')

replace_once(path, '''      ? compoundComponentCandidateLanesV15(
          rankedForPrinting,
          (card) => componentAffinityForCard(card).score >= 4,
          (card) => candidateStrategyPriorityV15(card, strategyContext).substantive,
        )''', '''      ? compoundComponentCandidateLanesV15(
          rankedForPrinting,
          (card) => componentAffinityForCard(card).score >= 4,
          (card) => candidateStrategyPriorityV15(card, strategyContext).substantive,
          (card) => anchorAffinityForCard(card) > 0,
        )''')

replace_once(path, '''            deficitBeforeSwap: themeDeficit, componentAffinityScore: componentAffinity.score,
            matchedComponentIds: componentAffinity.matchedComponentIds,
          },''', '''            deficitBeforeSwap: themeDeficit, componentAffinityScore: componentAffinity.score,
            matchedComponentIds: componentAffinity.matchedComponentIds,
            matchesAnchorComponent: componentAffinity.matchedComponentIds.some((id) => anchorComponentIds.has(id)),
          },''')

replace_once(path, '''      componentAwareRanking: componentAwareThemeRanking, componentSignals: themeComponents, componentSearchQueries: themeComponentSearchQueries,
    },''', '''      componentAwareRanking: componentAwareThemeRanking, anchorComponentIds: [...anchorComponentIds], componentSignals: themeComponents, componentSearchQueries: themeComponentSearchQueries,
    },''')

replace_once(path, '''      'Within an already-required structural role or target gate, an explicit compound request now gets a distinct component-aligned first lane, followed by substantive inferred commander strategy and finally generic structural fallback. A later lane is considered only when the earlier lane yields zero eligible printings after printing/price policy checks.',
''', '''      'Within an already-required structural role or target gate, an explicit compound request preserves the starting deck’s dominant requested component first, then considers other requested components, substantive inferred commander strategy, and finally generic structural fallback. A later lane is considered only when the earlier lane yields zero eligible printings after printing/price policy checks.',
''')

affinity_test = Path('src/services/upgrade-theme-component-affinity-v15.test.ts')
text = affinity_test.read_text()
if 'upgradeThemeAnchorComponentIdsV15' in text:
    raise SystemExit('affinity test already contains anchor helper')
text = text.replace('  upgradeThemeComponentAffinityScoreV15,\n', '  upgradeThemeAnchorComponentIdsV15,\n  upgradeThemeComponentAffinityScoreV15,\n', 1)
text += '''\n
test('dominant starting-deck representation identifies the compound-theme anchor independently of scarcity', () => {
  const signals = components({ broad: { currentMainMatches: 12, requiredMainMatches: 12 }, anchor: { currentMainMatches: 28, requiredMainMatches: 15 } });
  assert.deepEqual(upgradeThemeAnchorComponentIdsV15(signals), ['anchor']);
});

test('equal dominant evidence stays as co-anchors instead of inventing arbitrary priority', () => {
  const signals = components({ broad: { currentMainMatches: 24 }, anchor: { currentMainMatches: 24 } });
  assert.deepEqual(upgradeThemeAnchorComponentIdsV15(signals), ['anchor', 'broad']);
});

test('zero starting-deck component evidence does not manufacture an anchor', () => {
  const signals = components({ broad: { currentMainMatches: 0 }, anchor: { currentMainMatches: 0 } });
  assert.deepEqual(upgradeThemeAnchorComponentIdsV15(signals), []);
});
'''
affinity_test.write_text(text)

lane_test = Path('src/services/upgrade-strategy-compatible-lane-v15.test.ts')
text = lane_test.read_text()
marker = '  printingEligible?: boolean;\n};\n'
if text.count(marker) != 1:
    raise SystemExit('lane test candidate marker mismatch')
text = text.replace(marker, '  printingEligible?: boolean;\n  anchorFit?: boolean;\n};\n', 1)
text += '''\n
test('dominant compound anchor lane outranks secondary requested components without removing fallback', () => {
  const anchor: Candidate = { name: 'Identity anchor', identityFit: true, componentFit: true, anchorFit: true };
  const secondary: Candidate = { name: 'Secondary requested support', identityFit: true, componentFit: true, anchorFit: false };
  const strategy: Candidate = { name: 'Inferred strategy support', identityFit: true, componentFit: false, strategyFit: true };
  const generic: Candidate = { name: 'Generic role support', identityFit: false, componentFit: false };
  assert.deepEqual(compoundComponentCandidateLanesV15(
    [secondary, strategy, generic, anchor],
    (candidate) => Boolean(candidate.componentFit),
    (candidate) => Boolean(candidate.strategyFit),
    (candidate) => Boolean(candidate.anchorFit),
  ), [[anchor], [secondary], [strategy], [generic]]);
});

test('secondary requested component remains reachable when dominant anchor has no eligible printing', () => {
  const anchor: Candidate = { name: 'Unavailable anchor', identityFit: true, componentFit: true, anchorFit: true, printingEligible: false };
  const secondary: Candidate = { name: 'Available secondary', identityFit: true, componentFit: true, anchorFit: false, printingEligible: true };
  const generic: Candidate = { name: 'Available generic', identityFit: false, componentFit: false, printingEligible: true };
  const chosen: Candidate[] = [];
  for (const lane of compoundComponentCandidateLanesV15(
    [anchor, secondary, generic],
    (candidate) => Boolean(candidate.componentFit),
    (candidate) => Boolean(candidate.strategyFit),
    (candidate) => Boolean(candidate.anchorFit),
  )) {
    const before = chosen.length;
    chosen.push(...lane.filter((candidate) => candidate.printingEligible));
    if (chosen.length > before) break;
  }
  assert.deepEqual(chosen, [secondary]);
});
'''
lane_test.write_text(text)
