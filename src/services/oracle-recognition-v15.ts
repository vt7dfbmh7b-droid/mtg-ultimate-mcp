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
  // A search can reveal cards in one sentence and place them in the next.
  // Keep that referent within its ability, ending at shuffle, a new search or
  // a new paragraph; do not join unrelated abilities across the entire card.
  const searches = [...text.matchAll(/\bsearch your library for ([^.\n]*?\bcards?\b)/g)];
  const landSearches = searches.filter(([, target = '']) =>
    /\b(?:land|plains|island|swamp|mountain|forest)\b/.test(target));
  return {
    searchesLand: landSearches.length > 0,
    putsSearchedLandOntoBattlefield: landSearches.some((search) => {
      const continuation = text.slice(search.index + search[0].length).split('\n')[0] ?? '';
      const instruction = continuation.split(/\b(?:shuffle|search your library|whenever|at the beginning)\b|\.\s*when\b/)[0] ?? '';
      const movement = /\bput (?:it|them|that card|those cards|both cards|the rest|(?:one|two|three)(?: of (?:them|those cards))?) (onto the battlefield|into (?:your|its owner's|their owners') hand|into (?:your|a|the) graveyard|on top of your library)\b/.exec(instruction);
      if (!movement || movement[1] !== 'onto the battlefield') return false;
      // A newly introduced target/token is not the searched card's referent.
      const beforeMovement = instruction.slice(0, movement.index);
      return !/\b(?:target (?:creature|artifact|permanent)|create |exile (?:it|them|that card|those cards))/.test(beforeMovement);
    }),
  };
}
