/** Shared wording recognition, not an assessment of reliability or deck strength. */
export function hasTargetedSpellCounterV15(oracle: string): boolean {
  const text = oracle.toLowerCase().replace(/\([^)]*\)/g, '');
  // Bound the object to one clause: “counter” elsewhere is not a counterspell.
  return /\bcounter target (?:(?:non[a-z]+|creature|artifact|enchantment|instant|sorcery|planeswalker|battle|colored|colourless|colorless|white|blue|black|red|green|multicolored|monocolored|legendary|historic)\s+(?:(?:or|and)\s+)?)*spell\b/.test(text);
}

export interface LandSearchRecognitionV15 {
  searchesLand: boolean;
  putsSearchedLandOntoBattlefield: boolean;
}

export function landSearchRecognitionV15(oracle: string): LandSearchRecognitionV15 {
  const text = oracle.toLowerCase().replace(/\([^)]*\)/g, '');
  // Keep target and destination in the same search instruction. In particular,
  // “put it into your hand” followed by an unrelated battlefield ability is not ramp.
  const searches = [...text.matchAll(/\bsearch your library for ([^.\n]*?\bcards?\b)([^.\n]*)/g)];
  const landSearches = searches.filter(([, target = '']) =>
    /\b(?:land|plains|island|swamp|mountain|forest)\b/.test(target)
    && !/\b(?:creature|artifact|enchantment|instant|sorcery|planeswalker|battle)\b/.test(target));
  return {
    searchesLand: landSearches.length > 0,
    putsSearchedLandOntoBattlefield: landSearches.some(([, , destination = '']) =>
      /\bput (?:it|them|that card|those cards|one|one of them) onto the battlefield\b/.test(destination)),
  };
}
