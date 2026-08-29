import type { ScryfallCard } from '../types/scryfall.js';
import { deterministicTutorAccessV15 } from './combo-access-v15.js';
import { boundedComboSelectionAccessV15 } from './combo-selection-v15.js';
import { libraryTypeHasV15 } from './library-characteristics-v15.js';
import { getCardOracleText, inferCardRoles } from './scryfall.js';

export type CardPurposeStatusV15 = 'locked' | 'supported' | 'review' | 'challenge';

export interface CardPurposeContextV15 {
  deck: readonly ScryfallCard[];
  commander?: ScryfallCard;
  comboPieces?: readonly ScryfallCard[];
  protectedCardNames?: readonly string[];
}

export interface CardPurposeFindingV15 {
  cardName: string;
  status: CardPurposeStatusV15;
  roles: string[];
  purposes: string[];
  supportEvidence: string[];
  warnings: string[];
  deterministicComboHits: string[];
  boundedComboHits: string[];
  score: number;
}

export interface DeckPurposeAuditV15 {
  cards: CardPurposeFindingV15[];
  counts: Record<CardPurposeStatusV15, number>;
  challengeCards: string[];
  reviewCards: string[];
  note: string;
}

const ROLE_GROUPS: Array<{ label: string; roles: string[] }> = [
  { label: 'mana development', roles: ['mana acceleration', 'mana rock', 'mana dork', 'fast mana', 'early acceleration', 'land ramp', 'cost reduction', 'treasure', 'mana multiplier', 'persistent colored mana source'] },
  { label: 'interaction', roles: ['countermagic', 'free interaction', 'spot interaction', 'artifact/enchantment interaction', 'graveyard hate', 'board wipe', 'stax/control'] },
  { label: 'protection', roles: ['protection', 'board protection', 'conditional protection', 'combo protection'] },
  { label: 'card advantage/selection', roles: ['card draw', 'repeatable draw', 'card selection', 'wheel'] },
  { label: 'library access', roles: ['tutor', 'creature tutor', 'land tutor'] },
  { label: 'recursion/resilience', roles: ['graveyard recursion'] },
  { label: '+1/+1-counter plan', roles: ['counters', 'counter payoff'] },
  { label: 'combat conversion/access', roles: ['combat access', 'combat value engine', 'go-wide payoff'] },
  { label: 'token production', roles: ['token production'] },
  { label: 'sacrifice engine', roles: ['sacrifice synergy', 'sacrifice outlet', 'self sacrifice'] },
];

const COMMANDER_BRIDGE_ROLES = new Set([
  'counters',
  'counter payoff',
  '+1/+1 counters',
  'combat access',
  'combat value engine',
  'go-wide payoff',
  'token production',
  'sacrifice synergy',
  'sacrifice outlet',
  'graveyard recursion',
  'equipment',
  'aura',
]);

const COUNTER_PLAN_ROLES = new Set(['counters', 'counter payoff', '+1/+1 counters']);

function normalize(value: string): string { return value.trim().toLocaleLowerCase(); }

function typeContains(card: ScryfallCard, token: string): boolean {
  const type = [card.type_line, ...(card.card_faces ?? []).map((face) => face.type_line ?? '')]
    .join(' // ')
    .toLocaleLowerCase();
  return type.includes(token.toLocaleLowerCase());
}

function cardNameMatches(card: ScryfallCard, name: string): boolean {
  return normalize(card.name).split(' // ').some((part) => part.trim() === normalize(name));
}

function inferPurposeRoles(card: ScryfallCard): string[] {
  const text = getCardOracleText(card);
  const strippedDelveReminder = text.replace(/\bdelve\s*\([^)]*exile[^)]*graveyard[^)]*\)/gi, 'Delve');
  if (strippedDelveReminder === text) return inferCardRoles(card);
  return inferCardRoles({ ...card, oracle_text: strippedDelveReminder });
}

function explicitlyUsesPermanentCounters(card: ScryfallCard): boolean {
  const text = getCardOracleText(card).replace(/\s+/g, ' ').toLocaleLowerCase();
  return /\bproliferate\b/.test(text)
    || /\b(?:move|put|remove|double|distribute) (?:one or more |any number of |a |an )?counters?\b/.test(text)
    || /\b(?:creatures?|permanents?) (?:you control )?with counters? on them\b/.test(text)
    || /\bhas (?:one or more |a |an )?counters? on it\b/.test(text);
}

function countType(deck: readonly ScryfallCard[], type: string, excludeName?: string): number {
  return deck.filter((card) => (!excludeName || !cardNameMatches(card, excludeName)) && libraryTypeHasV15(card, type)).length;
}

function countRole(deck: readonly ScryfallCard[], role: string, excludeName?: string): number {
  return deck.filter((card) => (!excludeName || !cardNameMatches(card, excludeName)) && inferPurposeRoles(card).includes(role)).length;
}

function unique(values: readonly string[]): string[] { return [...new Set(values)]; }

function narrowDependencyWarnings(card: ScryfallCard, context: CardPurposeContextV15): { warnings: string[]; severe: number; evidence: string[] } {
  const text = getCardOracleText(card).replace(/\s+/g, ' ').toLocaleLowerCase();
  const warnings: string[] = [];
  const evidence: string[] = [];
  let severe = 0;

  const vehicleSearch = /search your library for [^.]*\bvehicle card\b/.test(text);
  if (vehicleSearch) {
    const targets = countType(context.deck, 'vehicle', card.name);
    evidence.push(`vehicle-search target count: ${targets}`);
    if (targets <= 1) {
      warnings.push(`narrow Vehicle search has only ${targets} other target${targets === 1 ? '' : 's'} in the 99`);
      severe += 1;
    }
  }

  const equipmentSearch = /search your library for [^.]*\bequipment card\b/.test(text);
  if (equipmentSearch) {
    const targets = countType(context.deck, 'equipment', card.name);
    evidence.push(`equipment-search target count: ${targets}`);
    if (targets <= 1) {
      warnings.push(`narrow Equipment search has only ${targets} other target${targets === 1 ? '' : 's'} in the 99`);
      severe += 1;
    }
  }

  const sagaDependent = /\b(?:saga|sagas|lore counter|lore counters)\b/.test(text) && !typeContains(card, 'saga');
  if (sagaDependent) {
    const sagas = countType(context.deck, 'saga', card.name);
    evidence.push(`Saga support count: ${sagas}`);
    if (sagas <= 1) {
      warnings.push(`Saga/lore ability is weakly supported by only ${sagas} other Saga${sagas === 1 ? '' : 's'}`);
      severe += 1;
    }
  }

  const tokenDependent = /(?:whenever|if) [^.]{0,100}(?:create|created|enters?)[^.]{0,80}\btokens?\b/.test(text)
    || /\bfor each (?:creature )?token you control\b/.test(text);
  if (tokenDependent) {
    const tokenSources = countRole(context.deck, 'token production', card.name);
    evidence.push(`other token-production sources: ${tokenSources}`);
    if (tokenSources <= 2) {
      warnings.push(`token-dependent payoff has only ${tokenSources} other token-production source${tokenSources === 1 ? '' : 's'}`);
      severe += 1;
    }
  }

  const goWideThreshold = /(?:attack with|attacking with|control) (?:four|five|six|seven|eight|nine|ten|\d+) or more creatures/.test(text);
  if (goWideThreshold) {
    const tokenSources = countRole(context.deck, 'token production', card.name);
    evidence.push(`go-wide support via other token-production sources: ${tokenSources}`);
    if (tokenSources <= 3) {
      warnings.push(`go-wide threshold is weakly supported by only ${tokenSources} other token-production sources`);
      severe += 1;
    }
  }

  return { warnings, severe, evidence };
}

function supportedTutorPackages(card: ScryfallCard, context: CardPurposeContextV15): Array<{ purpose: string; evidence: string; score: number }> {
  const text = getCardOracleText(card).replace(/\s+/g, ' ').toLocaleLowerCase();
  const packages: Array<{ purpose: string; evidence: string; score: number }> = [];
  const checks: Array<{ pattern: RegExp; type: string; label: string }> = [
    { pattern: /search your library for [^.]*\bequipment card\b/, type: 'equipment', label: 'Equipment' },
    { pattern: /search your library for [^.]*\bvehicle card\b/, type: 'vehicle', label: 'Vehicle' },
  ];
  for (const check of checks) {
    if (!check.pattern.test(text)) continue;
    const targets = countType(context.deck, check.type, card.name);
    if (targets < 2) continue;
    packages.push({
      purpose: `${check.label} package access`,
      evidence: `${check.label} tutor has ${targets} legal library targets in this exact 99`,
      score: Math.min(3, 1 + Math.floor(targets / 4)),
    });
  }
  return packages;
}

/**
 * Audits whether a card has an identifiable job in this exact deck rather than merely being
 * generically playable. The service is deliberately conservative: it does not claim a card is
 * optimal, only whether its slot has evidence-backed purpose or deserves pressure/review.
 */
export function auditCardPurposeV15(card: ScryfallCard, context: CardPurposeContextV15): CardPurposeFindingV15 {
  const roles = inferPurposeRoles(card);
  const purposes: string[] = [];
  const supportEvidence: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  const comboPieces = context.comboPieces ?? [];
  const isComboPiece = comboPieces.some((piece) => cardNameMatches(card, piece.name));
  const isProtected = (context.protectedCardNames ?? []).some((name) => cardNameMatches(card, name));

  if (isComboPiece) {
    purposes.push('verified win-package piece');
    supportEvidence.push('explicitly supplied as a combo/win piece');
    score += 6;
  }
  if (isProtected) {
    purposes.push('explicitly protected structural slot');
    supportEvidence.push('caller marked this card as structurally protected');
    score += 4;
  }

  if (typeContains(card, 'land')) {
    purposes.push('mana-base slot');
    supportEvidence.push('land slots provide required mana infrastructure; quality is a separate optimization question');
    score += 2;
  }

  for (const group of ROLE_GROUPS) {
    const matches = group.roles.filter((role) => roles.includes(role));
    if (matches.length > 0) {
      purposes.push(group.label);
      supportEvidence.push(`${group.label}: ${matches.join(', ')}`);
      score += 1;
    }
  }

  const commanderRoles = context.commander ? inferPurposeRoles(context.commander) : [];
  const bridgeRoles = unique(roles.filter((role) => COMMANDER_BRIDGE_ROLES.has(role) && commanderRoles.includes(role)));
  const specificCounterBridge = Boolean(context.commander)
    && explicitlyUsesPermanentCounters(context.commander as ScryfallCard)
    && roles.some((role) => COUNTER_PLAN_ROLES.has(role));
  const bridgeEvidence = [...bridgeRoles];
  if (specificCounterBridge && !bridgeEvidence.some((role) => COUNTER_PLAN_ROLES.has(role))) {
    bridgeEvidence.push('+1/+1-counter engine → counter-matters commander');
  }
  if (bridgeEvidence.length > 0) {
    purposes.push('commander-plan bridge');
    supportEvidence.push(`shares strategic role with commander: ${bridgeEvidence.join(', ')}`);
    score += 2;
  }

  const deterministicComboHits = roles.includes('tutor')
    ? comboPieces.filter((piece) => deterministicTutorAccessV15(card, piece).deterministic).map((piece) => piece.name)
    : [];
  if (deterministicComboHits.length > 0) {
    purposes.push('deterministic win-piece access');
    supportEvidence.push(`deterministically finds: ${deterministicComboHits.join(', ')}`);
    score += 3;
  } else if (roles.includes('tutor') && comboPieces.length > 0) {
    warnings.push('tutor does not deterministically access any supplied win piece; evaluate it against its intended package rather than counting it as combo access');
  }

  const packageSupport = supportedTutorPackages(card, context);
  for (const supported of packageSupport) {
    purposes.push(supported.purpose);
    supportEvidence.push(supported.evidence);
    score += supported.score;
  }

  const boundedComboAccess = comboPieces.map((piece) => boundedComboSelectionAccessV15(card, piece));
  const boundedComboHits = boundedComboAccess.filter((access) => access.matched).map((access) => access.pieceName);
  if (boundedComboHits.length > 0) {
    purposes.push('bounded win-piece selection');
    const depth = Math.max(...boundedComboAccess.filter((access) => access.matched).map((access) => access.depth ?? 0));
    supportEvidence.push(`top-${depth} selection reaches: ${boundedComboHits.join(', ')}`);
    score += 2;
  }

  const dependency = narrowDependencyWarnings(card, context);
  warnings.push(...dependency.warnings);
  supportEvidence.push(...dependency.evidence);
  score -= dependency.severe * 2;

  const uniquePurposes = unique(purposes);
  const nonNarrowPurpose = uniquePurposes.some((purpose) => !['library access', 'card advantage/selection', 'token production'].includes(purpose));

  let status: CardPurposeStatusV15;
  if (isComboPiece || isProtected) {
    status = 'locked';
  } else if (uniquePurposes.length === 0) {
    status = 'challenge';
    warnings.push('no evidence-backed deck function was identified');
  } else if (dependency.severe > 0 && !nonNarrowPurpose) {
    status = 'challenge';
    warnings.push('identified purpose is mostly dependent on a weakly supported narrow package');
  } else if (dependency.severe > 0) {
    status = 'review';
  } else {
    status = 'supported';
  }

  return {
    cardName: card.name,
    status,
    roles,
    purposes: uniquePurposes,
    supportEvidence: unique(supportEvidence),
    warnings: unique(warnings),
    deterministicComboHits,
    boundedComboHits,
    score,
  };
}

export function auditDeckPurposeV15(context: CardPurposeContextV15): DeckPurposeAuditV15 {
  const cards = context.deck.map((card) => auditCardPurposeV15(card, context));
  const counts: Record<CardPurposeStatusV15, number> = { locked: 0, supported: 0, review: 0, challenge: 0 };
  for (const card of cards) counts[card.status] += 1;
  return {
    cards,
    counts,
    challengeCards: cards.filter((card) => card.status === 'challenge').map((card) => card.cardName),
    reviewCards: cards.filter((card) => card.status === 'review').map((card) => card.cardName),
    note: 'Purpose status is not an optimality verdict. Supported means the card has an identifiable evidence-backed job; review/challenge means the slot deserves pressure from alternatives.',
  };
}
