export type FullTableWinClosureKindV15 =
  | 'direct-game-win'
  | 'delayed-game-win'
  | 'all-opponents-lose'
  | 'all-opponents-damage'
  | 'all-opponents-life-loss'
  | 'single-opponent-kill'
  | 'unscoped-lethal-engine'
  | 'resource-engine-only'
  | 'non-winning';

export interface FullTableWinClosureAssessmentV15 {
  verifiedFullTableWin: boolean;
  kind: FullTableWinClosureKindV15;
  timing: 'immediate' | 'delayed' | 'not-proven';
  scope: 'self-win' | 'all-opponents' | 'single-opponent' | 'unscoped' | 'none';
  normalizedText: string;
  signals: string[];
  caveat: string;
}

function normalizeText(results: readonly string[]): string {
  return results
    .join(' ')
    .toLocaleLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasDirectGameWin(text: string): boolean {
  return /\b(?:you |controller )?(?:win|wins) the game\b/.test(text);
}

function hasDelayedWin(text: string): boolean {
  return /\b(?:win|wins) the game\b[^.!;]{0,90}\b(?:next|following)\b[^.!;]{0,60}\b(?:upkeep|end step|turn)\b/.test(text)
    || /\b(?:at|during) (?:the )?(?:beginning of )?(?:your )?next (?:upkeep|end step|turn)\b[^.!;]{0,90}\b(?:win|wins) the game\b/.test(text);
}

function hasAllOpponentLoss(text: string): boolean {
  return /\b(?:each|all) opponents? (?:lose|loses) the game\b/.test(text)
    || /\b(?:each|all) of your opponents? (?:lose|loses) the game\b/.test(text);
}

function hasSingleOpponentLoss(text: string): boolean {
  return /\b(?:target|an?) opponent (?:lose|loses) the game\b/.test(text)
    && !hasAllOpponentLoss(text);
}

function unboundedWord(): string {
  return '(?:infinite|unbounded|arbitrarily (?:large|high))';
}

function hasAllOpponentDamage(text: string): boolean {
  const amount = unboundedWord();
  return new RegExp(`\\b${amount} (?:amounts? of )?damage (?:to|for) (?:each|all) opponents?\\b`).test(text)
    || new RegExp(`\\bdeal(?:s|ing)? ${amount} (?:amounts? of )?damage to (?:each|all) opponents?\\b`).test(text)
    || new RegExp(`\\b(?:each|all) opponents? (?:take|takes|are dealt|is dealt) ${amount} (?:amounts? of )?damage\\b`).test(text);
}

function hasAllOpponentLifeLoss(text: string): boolean {
  const amount = unboundedWord();
  return new RegExp(`\\b${amount} (?:amounts? of )?(?:life ?loss|lifeloss|loss of life) (?:to|for) (?:each|all) opponents?\\b`).test(text)
    || new RegExp(`\\b(?:each|all) opponents? (?:lose|loses) ${amount} (?:amounts? of )?life\\b`).test(text);
}

function hasUnscopedLethalEngine(text: string): boolean {
  const amount = unboundedWord();
  return new RegExp(`\\b${amount} (?:amounts? of )?damage\\b`).test(text)
    || new RegExp(`\\b${amount} (?:amounts? of )?(?:life ?loss|lifeloss|loss of life)\\b`).test(text)
    || /\binfinite lifeloss\b/.test(text);
}

function hasResourceEngine(text: string): boolean {
  return /\b(?:infinite|unbounded|arbitrarily (?:large|high|many))\b/.test(text)
    || /\bnear-infinite\b/.test(text);
}

/**
 * Commander-specific table-closure classifier.
 *
 * The important boundary is multiplayer scope. Killing one target opponent, producing generic
 * infinite damage/life-loss, or producing an arbitrary resource is not promoted to a full-table
 * deterministic win. Explicit self-win text and explicit each/all-opponent loss remain sufficient.
 */
export function assessFullTableWinClosureV15(results: readonly string[]): FullTableWinClosureAssessmentV15 {
  const normalizedText = normalizeText(results);
  const signals: string[] = [];

  if (!normalizedText) {
    return {
      verifiedFullTableWin: false,
      kind: 'non-winning',
      timing: 'not-proven',
      scope: 'none',
      normalizedText,
      signals,
      caveat: 'No result text was supplied.',
    };
  }

  if (hasAllOpponentLoss(normalizedText)) {
    signals.push('all-opponents-lose');
    return {
      verifiedFullTableWin: true,
      kind: 'all-opponents-lose',
      timing: 'immediate',
      scope: 'all-opponents',
      normalizedText,
      signals,
      caveat: 'The verified result explicitly makes each/all opponents lose the game.',
    };
  }

  if (hasDirectGameWin(normalizedText)) {
    const delayed = hasDelayedWin(normalizedText);
    signals.push(delayed ? 'delayed-self-win' : 'self-win');
    return {
      verifiedFullTableWin: true,
      kind: delayed ? 'delayed-game-win' : 'direct-game-win',
      timing: delayed ? 'delayed' : 'immediate',
      scope: 'self-win',
      normalizedText,
      signals,
      caveat: delayed
        ? 'The result explicitly wins the game, but only after a stated future timing point; resilience/speed scoring should treat that as slower and more disruptable than an immediate closure.'
        : 'The verified result explicitly wins the game.',
    };
  }

  if (hasAllOpponentDamage(normalizedText)) {
    signals.push('unbounded-damage-to-all-opponents');
    return {
      verifiedFullTableWin: true,
      kind: 'all-opponents-damage',
      timing: 'immediate',
      scope: 'all-opponents',
      normalizedText,
      signals,
      caveat: 'The result explicitly scopes unbounded damage to each/all opponents.',
    };
  }

  if (hasAllOpponentLifeLoss(normalizedText)) {
    signals.push('unbounded-life-loss-to-all-opponents');
    return {
      verifiedFullTableWin: true,
      kind: 'all-opponents-life-loss',
      timing: 'immediate',
      scope: 'all-opponents',
      normalizedText,
      signals,
      caveat: 'The result explicitly scopes unbounded life loss to each/all opponents.',
    };
  }

  if (hasSingleOpponentLoss(normalizedText)) {
    signals.push('single-opponent-loss');
    return {
      verifiedFullTableWin: false,
      kind: 'single-opponent-kill',
      timing: 'not-proven',
      scope: 'single-opponent',
      normalizedText,
      signals,
      caveat: 'Eliminating one target opponent is not evidence that the same package deterministically closes a multiplayer Commander table.',
    };
  }

  if (hasUnscopedLethalEngine(normalizedText)) {
    signals.push('unscoped-lethal-engine');
    return {
      verifiedFullTableWin: false,
      kind: 'unscoped-lethal-engine',
      timing: 'not-proven',
      scope: 'unscoped',
      normalizedText,
      signals,
      caveat: 'The result produces a lethal-scale damage/life-loss engine, but its multiplayer target/scope is not proven by the result text.',
    };
  }

  if (hasResourceEngine(normalizedText)) {
    signals.push('resource-engine-without-table-closure');
    return {
      verifiedFullTableWin: false,
      kind: 'resource-engine-only',
      timing: 'not-proven',
      scope: 'unscoped',
      normalizedText,
      signals,
      caveat: 'The result is an infinite/near-infinite resource or engine without explicit full-table closure.',
    };
  }

  return {
    verifiedFullTableWin: false,
    kind: 'non-winning',
    timing: 'not-proven',
    scope: 'none',
    normalizedText,
    signals,
    caveat: 'No full-table Commander win signal was proven.',
  };
}

export function isStrictFullTableWinResultV15(results: readonly string[]): boolean {
  return assessFullTableWinClosureV15(results).verifiedFullTableWin;
}
