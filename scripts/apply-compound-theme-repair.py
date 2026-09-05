from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


theme_path = Path("src/services/neutral-theme-v15.ts")
theme = theme_path.read_text()

theme = replace_once(
    theme,
    "  | 'printing-family'\n  | 'unresolved'",
    "  | 'printing-family'\n  | 'compound'\n  | 'unresolved'",
    "theme kind",
)

theme = replace_once(
    theme,
    "  matchRule: NeutralThemeMatchRuleV15;\n  explanation: string;",
    "  matchRule: NeutralThemeMatchRuleV15;\n  components?: NeutralThemeIntentV15[];\n  explanation: string;",
    "intent components",
)

theme = replace_once(
    theme,
    "    aliases: ['graveyard', 'graveyard matters', 'reanimator', 'reanimation', 'self mill'],",
    "    aliases: ['graveyard', 'graveyard matters', 'graveyard recursion', 'recursion', 'reanimator', 'reanimation', 'self mill'],",
    "graveyard aliases",
)

theme = replace_once(
    theme,
    "  {\n    id: 'proliferate',",
    """  {
    id: 'combat',
    label: 'Combat / attacks',
    aliases: ['combat', 'combat matters', 'attack', 'attacks', 'attacking', 'combat damage'],
    queryClause: '(o:attack OR o:attacking OR o:\"combat damage\" OR o:\"additional combat\")',
    minimumMainMatches: 12,
    roles: [],
    oracleFallbacks: ['attack', 'attacking', 'combat damage', 'additional combat', 'double strike'],
  },
  {
    id: 'countermagic',
    label: 'Countermagic',
    aliases: ['countermagic', 'counter magic', 'counterspell', 'counterspells'],
    queryClause: '(o:\"counter target\" o:spell)',
    minimumMainMatches: 8,
    roles: ['countermagic'],
    oracleFallbacks: ['counter target spell', 'counter that spell', 'counter it'],
  },
  {
    id: 'proliferate',""",
    "combat/countermagic themes",
)

helper = r'''interface ControlledThemeAtomV15 {
  key: string;
  aliasTokens: string[];
  intent: NeutralThemeIntentV15;
}

function creatureTypeIntentV15(
  original: string,
  normalizedInput: string,
  creatureType: string,
): NeutralThemeIntentV15 {
  return {
    original,
    normalizedInput,
    kind: 'creature-type',
    enforceability: 'full',
    canonicalLabel: `${creatureType} typal`,
    queryClause: `t:"${escapeScryfallLiteral(creatureType)}"`,
    minimumMainMatches: 20,
    printingFamily: null,
    matchRule: { type: 'creature-type', creatureType },
    explanation: `The requested typal theme is verified against Scryfall's creature-type catalog as ${creatureType}. Discovery uses a generated quoted type clause and the final audit checks resolved type/rules data, including Changeling.`,
  };
}

function controlledThemeAtomsV15(creatureTypes: string[]): ControlledThemeAtomV15[] {
  const atoms: ControlledThemeAtomV15[] = [];
  for (const definition of MECHANICAL_THEMES) {
    for (const alias of definition.aliases) {
      const normalizedAlias = normalize(alias);
      const aliasTokens = stripThemeWrappers(normalizedAlias).split(' ').filter(Boolean);
      const intent = mechanicIntent(alias, normalizedAlias, normalizedAlias);
      if (!intent || aliasTokens.length === 0) continue;
      atoms.push({ key: `mechanic:${definition.id}`, aliasTokens, intent });
    }
  }
  for (const definition of CARD_TYPE_THEMES) {
    for (const alias of definition.aliases) {
      const normalizedAlias = normalize(alias);
      const aliasTokens = stripThemeWrappers(normalizedAlias).split(' ').filter(Boolean);
      const intent = cardTypeIntent(alias, normalizedAlias, normalizedAlias);
      if (!intent || aliasTokens.length === 0) continue;
      atoms.push({ key: `card-type:${definition.id}`, aliasTokens, intent });
    }
  }
  for (const rawCreatureType of creatureTypes) {
    const creatureType = rawCreatureType.trim();
    if (!creatureType) continue;
    const normalizedType = normalize(creatureType);
    for (const alias of new Set([normalizedType, pluralizeCreatureType(normalizedType)])) {
      const aliasTokens = alias.split(' ').filter(Boolean);
      if (aliasTokens.length === 0) continue;
      atoms.push({
        key: `creature-type:${normalizedType}`,
        aliasTokens,
        intent: creatureTypeIntentV15(alias, normalize(alias), creatureType),
      });
    }
  }
  return atoms.sort((left, right) => (
    right.aliasTokens.length - left.aliasTokens.length
    || right.aliasTokens.join(' ').length - left.aliasTokens.join(' ').length
    || left.key.localeCompare(right.key)
  ));
}

function decomposeControlledThemeV15(
  cleaned: string,
  creatureTypes: string[],
): { components: NeutralThemeIntentV15[]; unknownTokens: string[] } {
  const tokens = cleaned.split(' ').filter(Boolean);
  const connectors = new Set(['and', 'with', 'plus', '+']);
  const atoms = controlledThemeAtomsV15(creatureTypes);
  const components: NeutralThemeIntentV15[] = [];
  const seen = new Set<string>();
  const unknownTokens: string[] = [];

  for (let index = 0; index < tokens.length;) {
    const token = tokens[index]!;
    const atom = atoms.find((candidate) => candidate.aliasTokens.every(
      (aliasToken, offset) => tokens[index + offset] === aliasToken,
    ));
    if (atom) {
      if (!seen.has(atom.key)) {
        components.push(atom.intent);
        seen.add(atom.key);
      }
      index += atom.aliasTokens.length;
      continue;
    }
    if (connectors.has(token)) {
      index += 1;
      continue;
    }
    unknownTokens.push(token);
    index += 1;
  }
  return { components, unknownTokens };
}

function composedThemeIntentV15(
  original: string,
  normalizedInput: string,
  components: NeutralThemeIntentV15[],
): NeutralThemeIntentV15 {
  if (components.length === 1) return { ...components[0]!, original, normalizedInput };
  const clauses = [...new Set(components
    .map((component) => component.queryClause)
    .filter((value): value is string => Boolean(value)))];
  const labels = components
    .map((component) => component.canonicalLabel)
    .filter((value): value is string => Boolean(value));
  return {
    original,
    normalizedInput,
    kind: 'compound',
    enforceability: 'full',
    canonicalLabel: labels.join(' + '),
    queryClause: `(${clauses.join(' OR ')})`,
    minimumMainMatches: Math.max(...components.map((component) => component.minimumMainMatches)),
    printingFamily: null,
    matchRule: { type: 'none' },
    components,
    explanation: `The compound request decomposes completely into controlled facets: ${labels.join(', ')}. Candidate discovery uses only generated bounded clauses joined with OR; the original user text is never executed as Scryfall grammar. Aggregate theme density means a card matches at least one requested facet; individual facet achievement remains independent evidence and is not inferred from this aggregate gate.`,
  };
}

async function resolveControlledCompoundThemeV15(
  original: string,
  normalizedInput: string,
  cleaned: string,
  options: { creatureTypes?: string[]; creatureTypeProvider?: () => Promise<string[]> },
): Promise<NeutralThemeIntentV15 | null> {
  const controlledOnly = decomposeControlledThemeV15(cleaned, []);
  if (controlledOnly.unknownTokens.length === 0 && controlledOnly.components.length > 1) {
    return composedThemeIntentV15(original, normalizedInput, controlledOnly.components);
  }
  if (controlledOnly.unknownTokens.length === 0) return null;
  if (controlledOnly.components.length === 0 && controlledOnly.unknownTokens.length === 1) return null;

  let creatureTypes: string[];
  try {
    creatureTypes = await loadCreatureTypes(options);
  } catch (error) {
    return unavailableTheme(
      original,
      normalizedInput,
      `Creature-type verification is currently unavailable while resolving a compound theme: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const decomposed = decomposeControlledThemeV15(cleaned, creatureTypes);
  if (decomposed.unknownTokens.length > 0) {
    return unsupportedTheme(
      original,
      normalizedInput,
      `The free-form theme contains unrecognized or unenforceable terms: ${[...new Set(decomposed.unknownTokens)].join(', ')}. Known facets are not silently accepted while unknown leftovers are dropped.`,
    );
  }
  if (decomposed.components.length === 0) return null;
  return composedThemeIntentV15(original, normalizedInput, decomposed.components);
}

'''

theme = replace_once(
    theme,
    "function explicitOraclePhrase(original: string): string | null {",
    helper + "function explicitOraclePhrase(original: string): string | null {",
    "compound helpers",
)

theme = replace_once(
    theme,
    "  const cardType = cardTypeIntent(original, normalizedInput, cleaned);\n  if (cardType) return cardType;\n\n  if (/\\b(?:and|with)\\b|[&+]/.test(cleaned)) {",
    "  const cardType = cardTypeIntent(original, normalizedInput, cleaned);\n  if (cardType) return cardType;\n\n  const compound = await resolveControlledCompoundThemeV15(original, normalizedInput, cleaned, options);\n  if (compound) return compound;\n\n  if (/\\b(?:and|with)\\b|[&+]/.test(cleaned)) {",
    "resolver compound hook",
)

theme = replace_once(
    theme,
    "export function cardMatchesNeutralThemeV15(card: ScryfallCard, intent: NeutralThemeIntentV15): boolean {\n  switch (intent.matchRule.type) {",
    "export function cardMatchesNeutralThemeV15(card: ScryfallCard, intent: NeutralThemeIntentV15): boolean {\n  if ((intent.components?.length ?? 0) > 0) {\n    return intent.components!.some((component) => cardMatchesNeutralThemeV15(card, component));\n  }\n  switch (intent.matchRule.type) {",
    "compound matcher",
)

theme_path.write_text(theme)


test_path = Path("src/services/neutral-theme-v15.test.ts")
tests = test_path.read_text()
old_test = """test('compound free-form themes fail closed instead of silently choosing one half', async () => {
  const compound = await resolveNeutralThemeIntentV15('Vampires and sacrifice', { creatureTypes: ['Vampire'] });
  assert.equal(compound.kind, 'unsupported');
  assert.match(compound.explanation, /compound/i);
});"""
new_tests = """test('compound controlled themes decompose completely instead of silently choosing one half', async () => {
  const compound = await resolveNeutralThemeIntentV15('Vampires and sacrifice', { creatureTypes: ['Vampire'] });
  assert.equal(compound.kind, 'compound');
  assert.equal(compound.enforceability, 'full');
  assert.deepEqual(compound.components?.map((component) => component.canonicalLabel), ['Vampire typal', 'Sacrifice / aristocrats']);
  assert.match(compound.queryClause ?? '', /t:\\"Vampire\\"/);
  assert.match(compound.queryClause ?? '', /o:sacrifice/);
});

test('compound parser recognizes counters, proliferate, countermagic and combat without creature-type lookup', async () => {
  const compound = await resolveNeutralThemeIntentV15('+1/+1 counters proliferate countermagic combat', {
    creatureTypeProvider: async () => { throw new Error('creature catalog should not be needed'); },
  });
  assert.equal(compound.kind, 'compound');
  assert.deepEqual(compound.components?.map((component) => component.canonicalLabel), [
    '+1/+1 counters',
    'Proliferate',
    'Countermagic',
    'Combat / attacks',
  ]);
  assert.match(compound.queryClause ?? '', /counter target/);
  assert.match(compound.queryClause ?? '', /combat damage/);
});

test('compound parser recognizes typal plus combat and graveyard synonyms as distinct controlled facets', async () => {
  const compound = await resolveNeutralThemeIntentV15('Knights typal combat graveyard recursion reanimation', { creatureTypes: ['Knight'] });
  assert.equal(compound.kind, 'compound');
  assert.deepEqual(compound.components?.map((component) => component.canonicalLabel), [
    'Knight typal',
    'Combat / attacks',
    'Graveyard / reanimator',
  ]);
});

test('compound themes still fail closed when any leftover term is unknown', async () => {
  const compound = await resolveNeutralThemeIntentV15('tokens and banana', { creatureTypes: [] });
  assert.equal(compound.kind, 'unsupported');
  assert.equal(compound.enforceability, 'unsupported');
  assert.match(compound.explanation, /banana/);
  assert.equal(compound.queryClause, null);
});"""
tests = replace_once(tests, old_test, new_tests, "compound regression tests")
test_path.write_text(tests)
