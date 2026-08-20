from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}\n--- OLD ---\n{old}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    'src/services/neutral-deck-builder-v15.ts',
    'async function discoverEligiblePool(colors: readonly string[], policy: ResolvedPrintingPolicyV08, candidateCap: number | undefined): Promise<ScryfallCard[]> {',
    'export async function discoverEligiblePoolV15(colors: readonly string[], policy: ResolvedPrintingPolicyV08, candidateCap: number | undefined): Promise<ScryfallCard[]> {',
)
replace_once(
    'src/services/neutral-deck-builder-v15.ts',
    '  const pool = unrestrictedPool?.cards ?? await discoverEligiblePool(colors, policy, candidateCap);',
    '  const pool = unrestrictedPool?.cards ?? await discoverEligiblePoolV15(colors, policy, candidateCap);',
)

replace_once(
    'src/services/deck-builder-v07.ts',
    "import { discoverGeneralWinPackagesV15 } from './general-win-package-v15.js';\nimport {",
    "import { discoverGeneralWinPackagesV15 } from './general-win-package-v15.js';\nimport { discoverEligiblePoolV15 } from './neutral-deck-builder-v15.js';\nimport {",
)

old = '''  const candidateMap = new Map<string, ScryfallCard>();
  const themeCandidateNames = new Set<string>();

  const searchRoles: Array<keyof RoleTargetsV07 | 'theme' | 'general'> = [
    'ramp', 'draw', 'interaction', 'freeInteraction', 'protection', 'tutors', 'recursion', 'boardWipes', 'early', 'theme', 'general',
  ];
  for (const role of searchRoles) {
    const results = await searchPool(colors, options, printingPolicy, printingCache, role, role === 'general' ? 50 : 35);
    for (const card of results) {
      const key = card.name.toLocaleLowerCase();
      if (commanderNames.has(key) || excluded.has(key) || card.type_line.toLowerCase().includes('land')) continue;
      if (!legalIdentity(card, colors)) continue;
      if (role === 'theme') themeCandidateNames.add(key);
      if (!candidateMap.has(key)) candidateMap.set(key, card);
    }
  }
'''
new = '''  const candidateMap = new Map<string, ScryfallCard>();
  const themeCandidateNames = new Set<string>();

  // The existing V0.15 neutral builder already exhausts bounded printing-family/set pools before
  // strategy scoring. Reuse that same pool here so a constrained targeted build does not hide
  // on-plan cards behind the first 35-50 EDHREC-ordered role-search results.
  const restrictedPool = hasPrintingRestriction(printingPolicy)
    ? await discoverEligiblePoolV15(colors, printingPolicy, candidatePriceCapV07(options))
    : null;
  if (restrictedPool) {
    for (const card of restrictedPool) {
      const key = card.name.toLocaleLowerCase();
      if (commanderNames.has(key) || excluded.has(key) || card.type_line.toLowerCase().includes('land')) continue;
      if (!legalIdentity(card, colors)) continue;
      if (!candidateMap.has(key)) candidateMap.set(key, card);
    }
  }

  const searchRoles: Array<keyof RoleTargetsV07 | 'theme' | 'general'> = restrictedPool
    ? (options.themeQuery?.trim() ? ['theme'] : [])
    : ['ramp', 'draw', 'interaction', 'freeInteraction', 'protection', 'tutors', 'recursion', 'boardWipes', 'early', 'theme', 'general'];
  for (const role of searchRoles) {
    const results = await searchPool(colors, options, printingPolicy, printingCache, role, role === 'general' ? 50 : 35);
    for (const card of results) {
      const key = card.name.toLocaleLowerCase();
      if (commanderNames.has(key) || excluded.has(key) || card.type_line.toLowerCase().includes('land')) continue;
      if (!legalIdentity(card, colors)) continue;
      if (role === 'theme') themeCandidateNames.add(key);
      if (!candidateMap.has(key)) candidateMap.set(key, card);
    }
  }
'''
replace_once('src/services/deck-builder-v07.ts', old, new)

replace_once(
    'src/services/deck-builder-v07.ts',
    "      hasPrintingRestriction(printingPolicy)\n        ? 'If the printing family does not contain enough suitable legal cards or basics under the requested price cap, the builder returns an incomplete draft instead of leaking cards from outside the family.'",
    "      hasPrintingRestriction(printingPolicy)\n        ? 'For bounded printing-family/set builds, the targeted builder now reuses the existing V0.15 exhaustive eligible physical pool before applying its existing role and commander-strategy scores; if that pool does not contain enough suitable legal cards or basics, it returns an incomplete draft instead of leaking cards from outside the family.'",
)

print('Applied V0.15 restricted-pool integration pass.')
