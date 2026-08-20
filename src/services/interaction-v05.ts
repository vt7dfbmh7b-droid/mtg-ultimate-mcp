import type { ScryfallCard } from '../types/scryfall.js';
import { getCardOracleText } from './scryfall.js';

export type InteractionKind =
  | 'hard-counter'
  | 'soft-counter'
  | 'destroy'
  | 'exile'
  | 'bounce'
  | 'damage'
  | 'protection'
  | 'phase-out'
  | 'board-wipe'
  | 'other';

export interface InteractionProfileV05 {
  name: string;
  kinds: InteractionKind[];
  counterRestriction: string | null;
  softCounterTax: number | null;
  targetScopes: string[];
  grants: string[];
  timingNotes: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface InteractionExchangeV05 {
  threat: { name: string; zone: 'stack' | 'battlefield'; typeLine: string };
  answer: InteractionProfileV05;
  protector: InteractionProfileV05 | null;
  answerAssessment: {
    canInteract: boolean;
    certainty: 'definite' | 'conditional' | 'unlikely';
    reason: string;
  };
  protectorAssessment: {
    canProtect: boolean;
    certainty: 'definite' | 'conditional' | 'unlikely' | 'none';
    reason: string;
  };
  finalAssessment: string;
  caveats: string[];
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function sentenceContaining(text: string, pattern: RegExp): string | null {
  return text
    .split(/\n|(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .find((sentence) => pattern.test(sentence)) ?? null;
}

function typeMatchesScope(card: ScryfallCard, scope: string): boolean {
  const type = card.type_line.toLowerCase();
  if (scope === 'spell') return true;
  if (scope === 'permanent') return !/instant|sorcery/i.test(type);
  if (scope === 'nonland permanent') return !/land/i.test(type) && !/instant|sorcery/i.test(type);
  if (scope === 'creature') return type.includes('creature');
  if (scope === 'noncreature spell') return !type.includes('creature');
  if (scope === 'creature spell') return type.includes('creature');
  if (scope === 'instant or sorcery spell') return type.includes('instant') || type.includes('sorcery');
  if (scope === 'artifact') return type.includes('artifact');
  if (scope === 'enchantment') return type.includes('enchantment');
  if (scope === 'planeswalker') return type.includes('planeswalker');
  return false;
}

export function analyzeInteractionProfileV05(card: ScryfallCard): InteractionProfileV05 {
  const text = getCardOracleText(card);
  const kinds: InteractionKind[] = [];
  const scopes: string[] = [];
  const grants: string[] = [];
  const timingNotes: string[] = [];
  let counterRestriction: string | null = null;
  let softCounterTax: number | null = null;

  const counter = sentenceContaining(text, /counter target/i);
  if (counter) {
    const tax = counter.match(/unless (?:its controller|that spell['’]s controller|they) pays? \{(\d+)\}/i)?.[1];
    if (tax) {
      kinds.push('soft-counter');
      softCounterTax = Number.parseInt(tax, 10);
    } else {
      kinds.push('hard-counter');
    }
    counterRestriction = counter;
    if (/noncreature spell/i.test(counter)) scopes.push('noncreature spell');
    else if (/creature spell/i.test(counter)) scopes.push('creature spell');
    else if (/instant or sorcery spell/i.test(counter)) scopes.push('instant or sorcery spell');
    else if (/target spell/i.test(counter)) scopes.push('spell');
  }

  if (/destroy (?:all|each)/i.test(text)) kinds.push('board-wipe');
  if (/destroy target/i.test(text)) kinds.push('destroy');
  if (/exile target/i.test(text)) kinds.push('exile');
  if (/return target [^.]+ to (?:its owner['’]s|their) hand/i.test(text)) kinds.push('bounce');
  if (/deals? \d+ damage to target/i.test(text)) kinds.push('damage');
  if (/phases? out|phase out/i.test(text)) kinds.push('phase-out', 'protection');
  if (/gains? hexproof|gain hexproof/i.test(text)) grants.push('hexproof');
  if (/gains? indestructible|gain indestructible/i.test(text)) grants.push('indestructible');
  if (/gains? protection from|gain protection from/i.test(text)) grants.push('protection');
  if (/can['’]t be countered/i.test(text)) grants.push('uncounterable');
  if (grants.length > 0) kinds.push('protection');

  const targetPatterns: Array<[RegExp, string]> = [
    [/target nonland permanent/i, 'nonland permanent'],
    [/target permanent/i, 'permanent'],
    [/target creature/i, 'creature'],
    [/target artifact/i, 'artifact'],
    [/target enchantment/i, 'enchantment'],
    [/target planeswalker/i, 'planeswalker'],
  ];
  for (const [pattern, scope] of targetPatterns) if (pattern.test(text)) scopes.push(scope);

  if (/split second/i.test(text)) timingNotes.push('Split second materially constrains responses while this spell is on the stack.');
  if (/this spell can['’]t be countered/i.test(text)) timingNotes.push('This spell itself cannot be countered by normal counter effects.');
  if (/cast this spell only/i.test(text)) timingNotes.push('Card-specific casting timing restriction detected.');

  const normalizedKinds: InteractionKind[] = unique<InteractionKind>(kinds.length > 0 ? kinds : ['other']);
  const confidence: InteractionProfileV05['confidence'] =
    normalizedKinds.some((kind) => ['hard-counter', 'destroy', 'exile', 'bounce', 'phase-out'].includes(kind))
      ? 'high'
      : normalizedKinds.includes('other')
        ? 'low'
        : 'medium';

  return {
    name: card.name,
    kinds: normalizedKinds,
    counterRestriction,
    softCounterTax,
    targetScopes: unique(scopes),
    grants: unique(grants),
    timingNotes,
    confidence,
  };
}

function canCounterThreat(threat: ScryfallCard, answer: InteractionProfileV05): { can: boolean; conditional: boolean; reason: string } {
  if (!answer.kinds.includes('hard-counter') && !answer.kinds.includes('soft-counter')) {
    return { can: false, conditional: false, reason: 'The answer is not a counterspell.' };
  }
  const scope = answer.targetScopes.find((candidate) => candidate.includes('spell')) ?? 'spell';
  if (!typeMatchesScope(threat, scope)) {
    return { can: false, conditional: false, reason: `The counter restriction (${scope}) does not match the threat’s type.` };
  }
  if (answer.kinds.includes('soft-counter')) {
    return {
      can: true,
      conditional: true,
      reason: `The answer can target the spell, but it only counters unless the opposing player pays the required tax${answer.softCounterTax !== null ? ` of {${answer.softCounterTax}}` : ''}.`,
    };
  }
  return { can: true, conditional: false, reason: 'The answer is a matching hard counter for a spell on the stack.' };
}

function canAffectBattlefieldThreat(threat: ScryfallCard, answer: InteractionProfileV05): { can: boolean; conditional: boolean; reason: string } {
  const targeted = answer.kinds.some((kind) => ['destroy', 'exile', 'bounce', 'damage', 'phase-out'].includes(kind));
  if (!targeted && !answer.kinds.includes('board-wipe')) {
    return { can: false, conditional: false, reason: 'The answer has no detected battlefield-removal mode.' };
  }
  if (answer.kinds.includes('board-wipe')) {
    return { can: true, conditional: true, reason: 'A mass-removal effect was detected; exact inclusion depends on the wipe’s full type/restriction text.' };
  }
  if (answer.targetScopes.length === 0) {
    return { can: true, conditional: true, reason: 'Targeted interaction was detected, but its exact target restriction could not be fully normalized.' };
  }
  const matching = answer.targetScopes.some((scope) => typeMatchesScope(threat, scope));
  return matching
    ? { can: true, conditional: answer.kinds.includes('damage'), reason: 'The detected target restriction matches the battlefield threat.' }
    : { can: false, conditional: false, reason: 'The detected target restriction does not match the battlefield threat.' };
}

function protectionAgainst(answer: InteractionProfileV05, protector: InteractionProfileV05 | null, threatZone: 'stack' | 'battlefield') {
  if (!protector) return { can: false, certainty: 'none' as const, reason: 'No protection response was supplied.' };
  if (threatZone === 'stack' && protector.grants.includes('uncounterable') && answer.kinds.some((kind) => kind.includes('counter'))) {
    return { can: true, certainty: 'definite' as const, reason: 'The protection effect makes the relevant spell uncounterable.' };
  }
  if (threatZone === 'battlefield') {
    if (protector.kinds.includes('phase-out')) {
      return { can: true, certainty: 'definite' as const, reason: 'Phasing the threatened permanent out can make targeted removal lose its target.' };
    }
    if (protector.grants.includes('hexproof') && answer.kinds.some((kind) => ['destroy', 'exile', 'bounce', 'damage'].includes(kind))) {
      return { can: true, certainty: 'conditional' as const, reason: 'Hexproof can stop opposing targeted interaction if granted before that interaction resolves and the source is controlled by an opponent.' };
    }
    if (protector.grants.includes('indestructible') && answer.kinds.includes('destroy')) {
      return { can: true, certainty: 'definite' as const, reason: 'Indestructible stops a destroy effect, but not exile, sacrifice, bounce, -X/-X, or other removal modes.' };
    }
  }
  if (protector.kinds.includes('hard-counter') || protector.kinds.includes('soft-counter')) {
    return { can: true, certainty: protector.kinds.includes('soft-counter') ? 'conditional' as const : 'definite' as const, reason: 'The supplied protection card can counter the opposing interaction spell if its counter restriction matches.' };
  }
  return { can: false, certainty: 'unlikely' as const, reason: 'No directly matching protection mode was detected.' };
}

export function evaluateInteractionExchangeV05(
  threat: ScryfallCard,
  answerCard: ScryfallCard,
  threatZone: 'stack' | 'battlefield',
  protectorCard?: ScryfallCard,
): InteractionExchangeV05 {
  const answer = analyzeInteractionProfileV05(answerCard);
  const protector = protectorCard ? analyzeInteractionProfileV05(protectorCard) : null;
  const interaction = threatZone === 'stack' ? canCounterThreat(threat, answer) : canAffectBattlefieldThreat(threat, answer);
  const protection = protectionAgainst(answer, protector, threatZone);

  const answerCertainty: 'definite' | 'conditional' | 'unlikely' = !interaction.can
    ? 'unlikely'
    : interaction.conditional
      ? 'conditional'
      : 'definite';

  const finalAssessment = !interaction.can
    ? `${answerCard.name} is not detected as a valid answer to ${threat.name} in the supplied zone.`
    : protection.can
      ? `${answerCard.name} can interact with ${threat.name}, but ${protectorCard?.name ?? 'the protection effect'} has a detected line that can stop or invalidate that interaction${protection.certainty === 'conditional' ? ' depending on timing/state' : ''}.`
      : `${answerCard.name} has a detected ${interaction.conditional ? 'conditional' : 'direct'} interaction line against ${threat.name}; no supplied protection line clearly stops it.`;

  return {
    threat: { name: threat.name, zone: threatZone, typeLine: threat.type_line },
    answer,
    protector,
    answerAssessment: { canInteract: interaction.can, certainty: answerCertainty, reason: interaction.reason },
    protectorAssessment: { canProtect: protection.can, certainty: protection.certainty, reason: protection.reason },
    finalAssessment,
    caveats: [
      'This V0.5 exchange analyzer handles common counter/removal/protection patterns and does not claim to solve every replacement effect, ward payment, layer interaction, trigger, mode, or priority branch.',
      'Target legality can depend on controller, color, mana value, ward, protection qualities, chosen modes, and board state that are not supplied to this function.',
    ],
  };
}
