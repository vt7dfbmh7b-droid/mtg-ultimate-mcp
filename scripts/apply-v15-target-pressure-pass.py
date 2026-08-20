from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}\n--- OLD ---\n{old}")
    p.write_text(text.replace(old, new, 1))


# upgrade.ts: make the existing Bracket-5 free-interaction gate visible to candidate selection.
replace_once(
    'src/services/upgrade.ts',
    "} from './commander-strategy-affinity-v15.js';\nimport { buildDeckMetrics, type ParsedDeck } from './deck.js';",
    "} from './commander-strategy-affinity-v15.js';\nimport { commanderTargetPressureV15 } from './commander-target-pressure-v15.js';\nimport { buildDeckMetrics, type ParsedDeck } from './deck.js';",
)
replace_once(
    'src/services/upgrade.ts',
    "interface StructuralTarget {\n  ramp: number;\n  draw: number;\n  interaction: number;\n  protection: number;\n  tutors: number;\n  earlyPlays: number;\n}\n\nconst TARGETS: Record<number, StructuralTarget> = {\n  1: { ramp: 6, draw: 6, interaction: 5, protection: 2, tutors: 0, earlyPlays: 8 },\n  2: { ramp: 8, draw: 8, interaction: 8, protection: 3, tutors: 1, earlyPlays: 10 },\n  3: { ramp: 10, draw: 10, interaction: 10, protection: 4, tutors: 3, earlyPlays: 12 },\n  4: { ramp: 12, draw: 12, interaction: 14, protection: 6, tutors: 6, earlyPlays: 16 },\n  5: { ramp: 14, draw: 14, interaction: 18, protection: 8, tutors: 10, earlyPlays: 20 },\n};",
    "interface StructuralTarget {\n  ramp: number;\n  draw: number;\n  interaction: number;\n  freeInteraction: number;\n  protection: number;\n  tutors: number;\n  earlyPlays: number;\n}\n\nconst TARGETS: Record<number, StructuralTarget> = {\n  1: { ramp: 6, draw: 6, interaction: 5, freeInteraction: 0, protection: 2, tutors: 0, earlyPlays: 8 },\n  2: { ramp: 8, draw: 8, interaction: 8, freeInteraction: 0, protection: 3, tutors: 1, earlyPlays: 10 },\n  3: { ramp: 10, draw: 10, interaction: 10, freeInteraction: 0, protection: 4, tutors: 3, earlyPlays: 12 },\n  4: { ramp: 12, draw: 12, interaction: 14, freeInteraction: 0, protection: 6, tutors: 6, earlyPlays: 16 },\n  5: { ramp: 14, draw: 14, interaction: 18, freeInteraction: 0, protection: 8, tutors: 10, earlyPlays: 20 },\n};",
)
replace_once(
    'src/services/upgrade.ts',
    "    interaction: '(o:\"counter target spell\" OR o:\"destroy target\" OR o:\"exile target\" OR o:\"return target\")',\n    protection:",
    "    interaction: '(o:\"counter target spell\" OR o:\"destroy target\" OR o:\"exile target\" OR o:\"return target\")',\n    'free-interaction': '((mv=0 OR o:\"rather than pay\") (o:\"counter target\" OR o:\"destroy target\" OR o:\"exile target\"))',\n    protection:",
)
replace_once(
    'src/services/upgrade.ts',
    "  if (role === 'interaction') return roles.has('spot interaction') || roles.has('countermagic') || roles.has('board wipe') || roles.has('free interaction');\n  if (role === 'protection')",
    "  if (role === 'interaction') return roles.has('spot interaction') || roles.has('countermagic') || roles.has('board wipe') || roles.has('free interaction');\n  if (role === 'free-interaction') return roles.has('free interaction');\n  if (role === 'protection')",
)
replace_once(
    'src/services/upgrade.ts',
    "  const targetBracket = clampBracket(options.targetBracket);\n  const targets = TARGETS[targetBracket] as StructuralTarget;\n  const metrics = buildDeckMetrics(parsed, cards);",
    "  const targetBracket = clampBracket(options.targetBracket);\n  const targetPressure = commanderTargetPressureV15(targetBracket);\n  const targets: StructuralTarget = {\n    ...(TARGETS[targetBracket] as StructuralTarget),\n    freeInteraction: targetPressure.minimumFreeInteraction,\n  };\n  const metrics = buildDeckMetrics(parsed, cards);",
)
replace_once(
    'src/services/upgrade.ts',
    "    { role: 'interaction', current: metrics.interactionCount, target: targets.interaction },\n    { role: 'protection', current: metrics.protectionCount, target: targets.protection },",
    "    { role: 'interaction', current: metrics.interactionCount, target: targets.interaction },\n    { role: 'free-interaction', current: Number(metrics.roleCounts['free interaction'] ?? 0), target: targets.freeInteraction },\n    { role: 'protection', current: metrics.protectionCount, target: targets.protection },",
)
replace_once(
    'src/services/upgrade.ts',
    "  return {\n    targetBracket,\n    currentMetrics: metrics,",
    "  return {\n    targetBracket,\n    targetPressure,\n    currentMetrics: metrics,",
)
replace_once(
    'src/services/upgrade.ts',
    "      'These role-count targets are engineering heuristics for deck consistency and are not the official Commander bracket definitions.',",
    "      'These role-count targets are engineering heuristics for deck consistency and are not the official Commander bracket definitions. The Bracket-5 free-interaction minimum is bridged directly from the existing V0.15 target pressure instead of being hidden inside generic interaction.',",
)

# deck-builder-v07.ts: use the same pressure in Build and in the structural pairing layer.
replace_once(
    'src/services/deck-builder-v07.ts',
    "} from './commander-strategy-affinity-v15.js';\nimport { buildDeckMetrics, parseDecklist, type DeckEntry, type ParsedDeck } from './deck.js';",
    "} from './commander-strategy-affinity-v15.js';\nimport { commanderTargetPressureV15, selectTargetAwareWinPackageV15 } from './commander-target-pressure-v15.js';\nimport { buildDeckMetrics, parseDecklist, type DeckEntry, type ParsedDeck } from './deck.js';\nimport { discoverGeneralWinPackagesV15 } from './general-win-package-v15.js';",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "export interface UpgradePlanOptionsV07 extends UpgradeOptions {\n  maxSwaps?: number;\n  protectedCards?: string[];\n  simulationIterations?: number;",
    "export interface UpgradePlanOptionsV07 extends UpgradeOptions {\n  maxSwaps?: number;\n  protectedCards?: string[];\n  winRouteVerificationStatus?: 'protected' | 'no-verified-route' | 'verification-unavailable';\n  simulationIterations?: number;",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "interface RoleTargetsV07 {\n  ramp: number;\n  draw: number;\n  interaction: number;\n  protection: number;",
    "interface RoleTargetsV07 {\n  ramp: number;\n  draw: number;\n  interaction: number;\n  freeInteraction: number;\n  protection: number;",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "const ROLE_TARGETS: Record<number, RoleTargetsV07> = {\n  1: { ramp: 7, draw: 7, interaction: 6, protection: 2, tutors: 0, recursion: 2, boardWipes: 1, early: 8 },\n  2: { ramp: 9, draw: 9, interaction: 8, protection: 3, tutors: 1, recursion: 2, boardWipes: 2, early: 10 },\n  3: { ramp: 10, draw: 10, interaction: 10, protection: 4, tutors: 3, recursion: 3, boardWipes: 2, early: 13 },\n  4: { ramp: 12, draw: 12, interaction: 14, protection: 6, tutors: 6, recursion: 3, boardWipes: 2, early: 16 },\n  5: { ramp: 14, draw: 14, interaction: 18, protection: 8, tutors: 10, recursion: 4, boardWipes: 2, early: 20 },\n};",
    "const ROLE_TARGETS: Record<number, RoleTargetsV07> = {\n  1: { ramp: 7, draw: 7, interaction: 6, freeInteraction: 0, protection: 2, tutors: 0, recursion: 2, boardWipes: 1, early: 8 },\n  2: { ramp: 9, draw: 9, interaction: 8, freeInteraction: 0, protection: 3, tutors: 1, recursion: 2, boardWipes: 2, early: 10 },\n  3: { ramp: 10, draw: 10, interaction: 10, freeInteraction: 0, protection: 4, tutors: 3, recursion: 3, boardWipes: 2, early: 13 },\n  4: { ramp: 12, draw: 12, interaction: 14, freeInteraction: 0, protection: 6, tutors: 6, recursion: 3, boardWipes: 2, early: 16 },\n  5: { ramp: 14, draw: 14, interaction: 18, freeInteraction: 0, protection: 8, tutors: 10, recursion: 4, boardWipes: 2, early: 20 },\n};",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "  if (roles.has('spot interaction') || roles.has('countermagic') || roles.has('board wipe') || roles.has('free interaction')) output.interaction = 1;\n  if (roles.has('protection')",
    "  if (roles.has('spot interaction') || roles.has('countermagic') || roles.has('board wipe') || roles.has('free interaction')) output.interaction = 1;\n  if (roles.has('free interaction')) output.freeInteraction = 1;\n  if (roles.has('protection')",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "    interaction: '(o:\"counter target\" OR o:\"destroy target\" OR o:\"exile target\" OR o:\"return target\")',\n    protection:",
    "    interaction: '(o:\"counter target\" OR o:\"destroy target\" OR o:\"exile target\" OR o:\"return target\")',\n    freeInteraction: '((mv=0 OR o:\"rather than pay\") (o:\"counter target\" OR o:\"destroy target\" OR o:\"exile target\"))',\n    protection:",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "function emptyCounts(): RoleTargetsV07 {\n  return { ramp: 0, draw: 0, interaction: 0, protection: 0, tutors: 0, recursion: 0, boardWipes: 0, early: 0 };\n}",
    "function emptyCounts(): RoleTargetsV07 {\n  return { ramp: 0, draw: 0, interaction: 0, freeInteraction: 0, protection: 0, tutors: 0, recursion: 0, boardWipes: 0, early: 0 };\n}",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "  const bracket = clampBracket(options.targetBracket);\n  const targets = ROLE_TARGETS[bracket] as RoleTargetsV07;\n  const landsWanted = targetLands(bracket, options.landCount);",
    "  const bracket = clampBracket(options.targetBracket);\n  const targetPressure = commanderTargetPressureV15(bracket);\n  const targets: RoleTargetsV07 = {\n    ...(ROLE_TARGETS[bracket] as RoleTargetsV07),\n    freeInteraction: targetPressure.minimumFreeInteraction,\n  };\n  const landsWanted = targetLands(bracket, options.landCount);",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "    'ramp', 'draw', 'interaction', 'protection', 'tutors', 'recursion', 'boardWipes', 'early', 'theme', 'general',",
    "    'ramp', 'draw', 'interaction', 'freeInteraction', 'protection', 'tutors', 'recursion', 'boardWipes', 'early', 'theme', 'general',",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "    targetBracket: bracket,\n    commanders: eligibleCommanders.map(summarizeCard),",
    "    targetBracket: bracket,\n    targetPressure,\n    commanders: eligibleCommanders.map(summarizeCard),",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "type UpgradeStructuralRoleV15 = 'ramp' | 'draw' | 'interaction' | 'protection' | 'tutor' | 'early';\n\ninterface UpgradeAddSelectionV15 {\n  candidate: Record<string, unknown>;\n  role: UpgradeStructuralRoleV15;\n}",
    "type UpgradeStructuralRoleV15 = 'ramp' | 'draw' | 'interaction' | 'free-interaction' | 'protection' | 'tutor' | 'early';\ntype UpgradeAddressedRoleV15 = UpgradeStructuralRoleV15 | 'win-package';\n\ninterface UpgradeAddSelectionV15 {\n  candidate: Record<string, unknown>;\n  role: UpgradeAddressedRoleV15;\n}",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "interface UpgradeStructuralCountsV15 {\n  ramp: number;\n  draw: number;\n  interaction: number;\n  protection: number;",
    "interface UpgradeStructuralCountsV15 {\n  ramp: number;\n  draw: number;\n  interaction: number;\n  freeInteraction: number;\n  protection: number;",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "  addressedRole: UpgradeStructuralRoleV15;",
    "  addressedRole: UpgradeAddressedRoleV15;",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "const UPGRADE_STRUCTURAL_ROLES_V15: UpgradeStructuralRoleV15[] = [\n  'ramp', 'draw', 'interaction', 'protection', 'tutor', 'early',\n];",
    "const UPGRADE_STRUCTURAL_ROLES_V15: UpgradeStructuralRoleV15[] = [\n  'ramp', 'draw', 'interaction', 'free-interaction', 'protection', 'tutor', 'early',\n];",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "  if (role === 'interaction') return roles.has('spot interaction') || roles.has('countermagic') || roles.has('board wipe') || roles.has('free interaction');\n  if (role === 'protection')",
    "  if (role === 'interaction') return roles.has('spot interaction') || roles.has('countermagic') || roles.has('board wipe') || roles.has('free interaction');\n  if (role === 'free-interaction') return roles.has('free interaction');\n  if (role === 'protection')",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "function upgradeStructuralStateV15(\n  currentMetrics: Record<string, unknown>,\n  structuralTargets: Record<string, unknown>,\n): { counts: UpgradeStructuralCountsV15; targets: UpgradeStructuralTargetsV15 } {\n  return {\n    counts: {\n      ramp: recordNumber(currentMetrics.rampCount),\n      draw: recordNumber(currentMetrics.drawCount),\n      interaction: recordNumber(currentMetrics.interactionCount),\n      protection: recordNumber(currentMetrics.protectionCount),",
    "function currentRoleCountV15(currentMetrics: Record<string, unknown>, role: string): number {\n  const roleCounts = currentMetrics.roleCounts;\n  if (!roleCounts || typeof roleCounts !== 'object' || Array.isArray(roleCounts)) return 0;\n  return recordNumber((roleCounts as Record<string, unknown>)[role]);\n}\n\nfunction upgradeStructuralStateV15(\n  currentMetrics: Record<string, unknown>,\n  structuralTargets: Record<string, unknown>,\n): { counts: UpgradeStructuralCountsV15; targets: UpgradeStructuralTargetsV15 } {\n  return {\n    counts: {\n      ramp: recordNumber(currentMetrics.rampCount),\n      draw: recordNumber(currentMetrics.drawCount),\n      interaction: recordNumber(currentMetrics.interactionCount),\n      freeInteraction: currentRoleCountV15(currentMetrics, 'free interaction'),\n      protection: recordNumber(currentMetrics.protectionCount),",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "      interaction: recordNumber(structuralTargets.interaction),\n      protection: recordNumber(structuralTargets.protection),",
    "      interaction: recordNumber(structuralTargets.interaction),\n      freeInteraction: recordNumber(structuralTargets.freeInteraction),\n      protection: recordNumber(structuralTargets.protection),",
)

win_helper = r'''
interface UpgradeWinPackagePriorityV15 {
  attempted: boolean;
  sourceStatus: string;
  selectedComboId: string | null;
  selectedBracketTag: string | null;
  missingSeedNames: string[];
  selections: UpgradeAddSelectionV15[];
  reason: string;
}

function commanderCardsForUpgradeV15(parsed: ParsedDeck, cards: ScryfallCard[]): ScryfallCard[] {
  return parsed.commanders
    .map((entry) => cards.find((card) => card.name.toLocaleLowerCase() === entry.name.toLocaleLowerCase()))
    .filter((card): card is ScryfallCard => Boolean(card));
}

async function buildWinPackagePriorityV15(
  parsed: ParsedDeck,
  cards: ScryfallCard[],
  options: UpgradePlanOptionsV07,
): Promise<UpgradeWinPackagePriorityV15> {
  const pressure = commanderTargetPressureV15(options.targetBracket);
  const verificationStatus = options.winRouteVerificationStatus ?? 'verification-unavailable';
  if (!pressure.verifiedWinningPackageRequired) {
    return {
      attempted: false,
      sourceStatus: 'not-required-below-bracket-5',
      selectedComboId: null,
      selectedBracketTag: null,
      missingSeedNames: [],
      selections: [],
      reason: 'The requested target does not require a verified winning package.',
    };
  }
  if (verificationStatus !== 'no-verified-route') {
    return {
      attempted: false,
      sourceStatus: verificationStatus,
      selectedComboId: null,
      selectedBracketTag: null,
      missingSeedNames: [],
      selections: [],
      reason: verificationStatus === 'protected'
        ? 'The existing V0.15 route audit already found a verified route, so refinement preserves it instead of adding another package by default.'
        : 'Win-route verification was unavailable, so refinement does not convert missing evidence into a claim that a package is absent.',
    };
  }

  const commanders = commanderCardsForUpgradeV15(parsed, cards);
  if (commanders.length !== parsed.commanders.length) {
    return {
      attempted: false,
      sourceStatus: 'commander-resolution-incomplete',
      selectedComboId: null,
      selectedBracketTag: null,
      missingSeedNames: [],
      selections: [],
      reason: 'The resolved commander cards were incomplete, so package discovery was not attempted.',
    };
  }

  const discovery = await discoverGeneralWinPackagesV15(commanders, {
    ...(options.printingFamily ? { printingFamily: options.printingFamily } : {}),
    ...(options.allowedSets ? { allowedSets: options.allowedSets } : {}),
    ...(options.includePromos !== undefined ? { includePromos: options.includePromos } : {}),
    ...(options.includeSpecialReleases !== undefined ? { includeSpecialReleases: options.includeSpecialReleases } : {}),
    ...(options.maxUsdPerCard !== undefined ? { maxUsdPerCard: options.maxUsdPerCard } : {}),
    ...(options.excludedCards ? { excludedCards: options.excludedCards } : {}),
    maxPackageCards: 3,
  });
  const selected = selectTargetAwareWinPackageV15(options.targetBracket, discovery.candidates, discovery.selected);
  if (!selected) {
    return {
      attempted: true,
      sourceStatus: discovery.status,
      selectedComboId: null,
      selectedBracketTag: null,
      missingSeedNames: [],
      selections: [],
      reason: discovery.status === 'verification-unavailable'
        ? 'Verified package discovery was unavailable/incomplete; no package was invented.'
        : 'Completed verified package discovery found no legal package satisfying the active printing/budget/exclusion constraints.',
    };
  }

  const existing = new Set([...parsed.commanders, ...parsed.main].map((entry) => entry.name.toLocaleLowerCase()));
  const missingSeedNames = selected.seedNames.filter((name) => !existing.has(name.toLocaleLowerCase()));
  if (missingSeedNames.length === 0) {
    return {
      attempted: true,
      sourceStatus: discovery.status,
      selectedComboId: selected.comboId,
      selectedBracketTag: selected.bracketTag,
      missingSeedNames: [],
      selections: [],
      reason: 'The target-aware verified package has no missing seed cards to add.',
    };
  }

  const lookup = await getCardsByNames(missingSeedNames);
  if (lookup.notFound.length > 0) {
    return {
      attempted: true,
      sourceStatus: 'package-card-resolution-incomplete',
      selectedComboId: selected.comboId,
      selectedBracketTag: selected.bracketTag,
      missingSeedNames,
      selections: [],
      reason: `A verified package was selected, but one or more seed cards could not be resolved: ${lookup.notFound.join(', ')}.`,
    };
  }
  const byName = new Map(lookup.cards.map((card) => [card.name.toLocaleLowerCase(), card]));
  const printings = new Map(selected.exactPrintings.map((printing) => [printing.name.toLocaleLowerCase(), printing]));
  const selections: UpgradeAddSelectionV15[] = [];
  for (const name of missingSeedNames) {
    const card = byName.get(name.toLocaleLowerCase());
    const printing = printings.get(name.toLocaleLowerCase());
    if (!card || !printing) {
      return {
        attempted: true,
        sourceStatus: 'package-printing-resolution-incomplete',
        selectedComboId: selected.comboId,
        selectedBracketTag: selected.bracketTag,
        missingSeedNames,
        selections: [],
        reason: `The selected verified package did not retain an exact eligible physical printing for ${name}.`,
      };
    }
    selections.push({
      role: 'win-package',
      candidate: {
        card: summarizeCard(card),
        score: selected.score,
        recommendedPrinting: {
          set: printing.set,
          collectorNumber: printing.collectorNumber,
          finish: printing.finish,
          priceUsd: printing.priceUsd,
          familyMatch: 'verified-win-package',
        },
        whyItFits: `Adds the verified ${selected.bracketTag === 'R' ? 'R-tagged competitive ' : ''}winning package ${selected.comboId} because the existing V0.15 route audit found no verified route under a Bracket-5 target.`,
      },
    });
  }
  return {
    attempted: true,
    sourceStatus: discovery.status,
    selectedComboId: selected.comboId,
    selectedBracketTag: selected.bracketTag,
    missingSeedNames,
    selections,
    reason: selected.bracketTag === 'R'
      ? 'Bracket-5 target pressure preferred an existing verified R-tagged package.'
      : 'No verified R-tagged package survived the active constraints, so the existing verified portfolio selection is used as the fallback winning package.',
  };
}

'''
replace_once(
    'src/services/deck-builder-v07.ts',
    "export async function buildSimulationBackedUpgradePlanV07(\n",
    win_helper + "export async function buildSimulationBackedUpgradePlanV07(\n",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "  const suggestions = await suggestDeckUpgrades(parsed, cards, allowedIdentity, options);\n  const groups = (suggestions.candidateAddsByDeficit ?? []) as Array<Record<string, unknown>>;\n  const cutPool = ((suggestions.candidateCuts ?? []) as Array<Record<string, unknown>>)\n    .filter((cut) => {\n      const card = cut.card as Record<string, unknown> | undefined;\n      return typeof card?.name !== 'string' || !protectedNames.has(card.name.toLocaleLowerCase());\n    });\n\n  const chosenAdds: UpgradeAddSelectionV15[] = [];\n  const addNames = new Set<string>();",
    "  const suggestions = await suggestDeckUpgrades(parsed, cards, allowedIdentity, options);\n  const groups = (suggestions.candidateAddsByDeficit ?? []) as Array<Record<string, unknown>>;\n  const cutPool = ((suggestions.candidateCuts ?? []) as Array<Record<string, unknown>>)\n    .filter((cut) => {\n      const card = cut.card as Record<string, unknown> | undefined;\n      return typeof card?.name !== 'string' || !protectedNames.has(card.name.toLocaleLowerCase());\n    });\n  const targetPressure = commanderTargetPressureV15(options.targetBracket);\n  const winPackagePriority = await buildWinPackagePriorityV15(parsed, cards, options);\n  const swapCapacity = Math.min(maxSwaps, cutPool.length);\n\n  const chosenAdds: UpgradeAddSelectionV15[] = [];\n  const addNames = new Set<string>();\n  const atomicWinPackageFits = winPackagePriority.selections.length > 0\n    && winPackagePriority.selections.length <= swapCapacity;\n  if (atomicWinPackageFits) {\n    for (const selection of winPackagePriority.selections) {\n      const name = candidateName(selection.candidate);\n      if (!name || addNames.has(name.toLocaleLowerCase())) continue;\n      addNames.add(name.toLocaleLowerCase());\n      chosenAdds.push(selection);\n    }\n  }",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "    const role = recordString(group.role) as UpgradeStructuralRoleV15;\n    if (!UPGRADE_STRUCTURAL_ROLES_V15.includes(role)) continue;\n    for (const candidate of (group.candidates ?? []) as Array<Record<string, unknown>>) {\n      if (chosenAdds.length >= maxSwaps) break;",
    "    const role = recordString(group.role) as UpgradeStructuralRoleV15;\n    if (!UPGRADE_STRUCTURAL_ROLES_V15.includes(role)) continue;\n    for (const candidate of (group.candidates ?? []) as Array<Record<string, unknown>>) {\n      if (chosenAdds.length >= swapCapacity) break;",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "    if (chosenAdds.length >= maxSwaps) break;",
    "    if (chosenAdds.length >= swapCapacity) break;",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "    status: afterSimulation ? 'simulated-candidate-plan' : 'candidate-plan-not-simulated',\n    swaps:",
    "    status: afterSimulation ? 'simulated-candidate-plan' : 'candidate-plan-not-simulated',\n    v15TargetPressure: {\n      targetPressure,\n      winRouteVerificationStatus: options.winRouteVerificationStatus ?? 'verification-unavailable',\n      winPackageDiscoveryAttempted: winPackagePriority.attempted,\n      winPackageSourceStatus: winPackagePriority.sourceStatus,\n      selectedComboId: winPackagePriority.selectedComboId,\n      selectedBracketTag: winPackagePriority.selectedBracketTag,\n      missingSeedNames: winPackagePriority.missingSeedNames,\n      atomicWinPackageInjected: atomicWinPackageFits,\n      reason: winPackagePriority.reason,\n    },\n    swaps:",
)
replace_once(
    'src/services/deck-builder-v07.ts',
    "      'IN/OUT pairing now minimizes damage to the existing structural role targets before using cut pressure as a tie-breaker; candidate generation, budgets, printing constraints, commander-strategy protection, and same-seed simulation remain unchanged.',",
    "      'IN/OUT pairing now minimizes damage to the existing structural role targets before using cut pressure as a tie-breaker; Bracket-5 free interaction is treated as its own existing target pressure, and an already-verified missing win package is injected atomically when one survives the current hard constraints.',",
)

# optimizer-v12.ts: hand the already-computed V0.15 route status into the old planner.
replace_once(
    'src/services/optimizer-v12.ts',
    "          { ...roundOptions, minimumImprovementScore: minScore },",
    "          { ...roundOptions, minimumImprovementScore: minScore, winRouteVerificationStatus: winRouteProtection.status },",
)

# commander-build-pipeline-v15.ts: for Bracket 5, prefer an R-tagged package already found by existing discovery.
replace_once(
    'src/services/commander-build-pipeline-v15.ts',
    "import { evaluateCommanderBuildV15 } from './commander-build-evaluation-v15.js';\nimport { buildCommanderDeckDraftV07, type DeckBuildOptionsV07 } from './deck-builder-v07.js';",
    "import { evaluateCommanderBuildV15 } from './commander-build-evaluation-v15.js';\nimport { selectTargetAwareWinPackageV15 } from './commander-target-pressure-v15.js';\nimport { buildCommanderDeckDraftV07, type DeckBuildOptionsV07 } from './deck-builder-v07.js';",
)
replace_once(
    'src/services/commander-build-pipeline-v15.ts',
    "  const selectedPackage = packageDiscovery?.selected ?? null;",
    "  const selectedPackage = packageDiscovery\n    ? selectTargetAwareWinPackageV15(plan.requestedTargetBracket, packageDiscovery.candidates, packageDiscovery.selected)\n    : null;",
)

print('Applied V0.15 target-pressure integration pass.')
