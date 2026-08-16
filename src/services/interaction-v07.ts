import type { ScryfallCard } from '../types/scryfall.js';
import { analyzeInteractionProfileV05, type InteractionProfileV05 } from './interaction-v05.js';
import { analyzeCommanderDependencyV05 } from './combat-v05.js';
import { getCardOracleText, inferCardRoles } from './scryfall.js';

export type ZoneV07 = 'stack' | 'battlefield';

export interface WardPaymentStateV07 {
  genericMana?: number;
  coloredMana?: Partial<Record<'W' | 'U' | 'B' | 'R' | 'G' | 'C', number>>;
  flexibleMana?: number;
  life?: number;
  cardsInHand?: number;
  sacrificePermanents?: number;
}

export interface WardRequirementV07 {
  raw: string;
  genericMana: number;
  coloredSymbols: string[];
  life: number;
  discardCards: number;
  sacrificePermanents: number;
  conditional: boolean;
}

export interface WardAssessmentV07 {
  hasWard: boolean;
  requirements: WardRequirementV07[];
  payable: boolean;
  reason: string;
}

export interface TargetCandidateV07 {
  card: ScryfallCard;
  isCommander?: boolean;
  knownComboPiece?: boolean;
  counters?: number;
  controllerLife?: number;
}

export interface RankedTargetV07 {
  name: string;
  score: number;
  legalTarget: boolean;
  ward: WardAssessmentV07;
  reasons: string[];
}

export interface StackActionV07 {
  player: string;
  card: ScryfallCard;
  role: 'primary' | 'answer' | 'protection';
}

export interface StackResolutionV07 {
  actions: Array<{
    player: string;
    card: string;
    role: StackActionV07['role'];
    status: 'resolves' | 'countered' | 'conditional';
    reason: string;
  }>;
  primarySpellResolves: boolean | null;
  summary: string;
  assumptions: string[];
}

const COLORS = ['W', 'U', 'B', 'R', 'G', 'C'] as const;

function numberWord(value: string | undefined): number {
  if (!value) return 1;
  const numeric = Number.parseInt(value, 10);
  if (Number.isFinite(numeric)) return numeric;
  const words: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 };
  return words[value.toLowerCase()] ?? 1;
}

function wardFragments(card: ScryfallCard): string[] {
  const text = getCardOracleText(card);
  const fragments: string[] = [];
  for (const line of text.split(/\n+/)) {
    const match = line.match(/\bWard(?:\s*[—–-]\s*|\s+)([^.\n]+)/i);
    if (match?.[1]) fragments.push(match[1].trim());
  }
  return fragments;
}

export function parseWardRequirementsV07(card: ScryfallCard): WardRequirementV07[] {
  return wardFragments(card).map((raw) => {
    const symbols = raw.match(/\{[^}]+\}/g) ?? [];
    let genericMana = 0;
    const coloredSymbols: string[] = [];
    for (const token of symbols) {
      const symbol = token.slice(1, -1).toUpperCase();
      if (/^\d+$/.test(symbol)) genericMana += Number.parseInt(symbol, 10);
      else if (COLORS.includes(symbol as (typeof COLORS)[number])) coloredSymbols.push(symbol);
      else coloredSymbols.push(symbol);
    }
    const lifeMatch = raw.match(/pay\s+(\d+)\s+life/i);
    const discardMatch = raw.match(/discard\s+(?:(a|an|one|two|three|four|five|\d+)\s+)?cards?/i);
    const sacrificeMatch = raw.match(/sacrifice\s+(?:(a|an|one|two|three|four|five|\d+)\s+)?(?:nonland\s+)?permanents?/i);
    const recognized = genericMana > 0 || coloredSymbols.length > 0 || Boolean(lifeMatch || discardMatch || sacrificeMatch);
    return {
      raw,
      genericMana,
      coloredSymbols,
      life: lifeMatch?.[1] ? Number.parseInt(lifeMatch[1], 10) : 0,
      discardCards: discardMatch ? numberWord(discardMatch[1]) : 0,
      sacrificePermanents: sacrificeMatch ? numberWord(sacrificeMatch[1]) : 0,
      conditional: !recognized || /unless|for each|equal to|chosen|that many/i.test(raw),
    };
  });
}

function canPayOneWard(requirement: WardRequirementV07, state: WardPaymentStateV07): boolean {
  if (requirement.conditional) return false;
  let flexible = Math.max(0, Math.trunc(state.flexibleMana ?? 0));
  const colored = { ...(state.coloredMana ?? {}) } as Record<string, number | undefined>;
  for (const symbol of requirement.coloredSymbols) {
    if ((colored[symbol] ?? 0) > 0) colored[symbol] = (colored[symbol] ?? 0) - 1;
    else if (flexible > 0) flexible -= 1;
    else return false;
  }
  const ordinaryMana = Math.max(0, Math.trunc(state.genericMana ?? 0))
    + flexible
    + Object.values(colored).reduce((sum, value) => sum + Math.max(0, value ?? 0), 0);
  if (ordinaryMana < requirement.genericMana) return false;
  if ((state.life ?? 40) <= requirement.life) return false;
  if ((state.cardsInHand ?? 0) < requirement.discardCards) return false;
  if ((state.sacrificePermanents ?? 0) < requirement.sacrificePermanents) return false;
  return true;
}

export function assessWardV07(card: ScryfallCard, state: WardPaymentStateV07 = {}): WardAssessmentV07 {
  const requirements = parseWardRequirementsV07(card);
  if (requirements.length === 0) {
    return { hasWard: false, requirements: [], payable: true, reason: 'No Ward cost was detected.' };
  }
  const payable = requirements.every((requirement) => canPayOneWard(requirement, state));
  return {
    hasWard: true,
    requirements,
    payable,
    reason: payable
      ? 'The supplied resources can pay the supported Ward cost(s) after targeting.'
      : 'At least one Ward cost is not payable from the supplied resources or needs additional card-specific state.',
  };
}

function targetScopeMatches(card: ScryfallCard, profile: InteractionProfileV05): boolean {
  if (profile.targetScopes.length === 0) return profile.kinds.some((kind) => ['destroy', 'exile', 'bounce', 'damage', 'phase-out'].includes(kind));
  const type = card.type_line.toLowerCase();
  return profile.targetScopes.some((scope) => {
    if (scope === 'permanent') return !/instant|sorcery/.test(type);
    if (scope === 'nonland permanent') return !/land|instant|sorcery/.test(type);
    if (scope === 'creature') return type.includes('creature');
    if (scope === 'artifact') return type.includes('artifact');
    if (scope === 'enchantment') return type.includes('enchantment');
    if (scope === 'planeswalker') return type.includes('planeswalker');
    return false;
  });
}

function threatScore(candidate: TargetCandidateV07): { score: number; reasons: string[] } {
  const roles = new Set(inferCardRoles(candidate.card));
  const text = getCardOracleText(candidate.card);
  const reasons: string[] = [];
  let score = 10 + Math.min(12, candidate.card.cmc * 1.5);
  if (candidate.isCommander) { score += 8; reasons.push('commander'); }
  if (candidate.knownComboPiece) { score += 18; reasons.push('known combo piece'); }
  if (roles.has('tutor')) { score += 8; reasons.push('tutor'); }
  if (roles.has('repeatable draw') || roles.has('card draw')) { score += 7; reasons.push('card advantage'); }
  if (roles.has('stax/control')) { score += 8; reasons.push('restrictive/control effect'); }
  if (roles.has('mana acceleration') || roles.has('cost reduction')) { score += 4; reasons.push('mana engine'); }
  if (roles.has('alternate win condition') || /you win the game|loses the game/i.test(text)) { score += 15; reasons.push('win-condition text'); }
  if (/whenever|at the beginning|each opponent|for each/i.test(text)) { score += 3; reasons.push('repeatable/scaling text'); }
  if ((candidate.counters ?? 0) >= 3) { score += 3; reasons.push('developed permanent'); }
  return { score, reasons };
}

export function rankInteractionTargetsV07(
  answerCard: ScryfallCard,
  candidates: TargetCandidateV07[],
  wardState: WardPaymentStateV07 = {},
): RankedTargetV07[] {
  const answer = analyzeInteractionProfileV05(answerCard);
  return candidates.map((candidate) => {
    const legalTarget = targetScopeMatches(candidate.card, answer);
    const ward = assessWardV07(candidate.card, wardState);
    const threat = threatScore(candidate);
    let score = legalTarget ? threat.score : -1000;
    const reasons = [...threat.reasons];
    if (!legalTarget) reasons.push('not a detected legal target for this answer');
    if (legalTarget && ward.hasWard && !ward.payable) {
      score -= 40;
      reasons.push('Ward cost is not currently payable');
    } else if (legalTarget && ward.hasWard) {
      score -= 3;
      reasons.push('Ward is payable but consumes extra resources');
    }
    return {
      name: candidate.card.name,
      score: Number(score.toFixed(1)),
      legalTarget,
      ward,
      reasons,
    };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function isCounter(profile: InteractionProfileV05): boolean {
  return profile.kinds.includes('hard-counter') || profile.kinds.includes('soft-counter');
}

export function resolveMultiplayerStackV07(actions: StackActionV07[]): StackResolutionV07 {
  if (actions.length === 0) {
    return { actions: [], primarySpellResolves: null, summary: 'No stack actions were supplied.', assumptions: [] };
  }
  const normalized = actions.slice(0, 12).map((action, index) => ({
    ...action,
    index,
    profile: analyzeInteractionProfileV05(action.card),
    status: 'resolves' as 'resolves' | 'countered' | 'conditional',
    reason: index === 0 ? 'Primary spell.' : 'No counter interaction has changed this action yet.',
  }));

  for (let index = normalized.length - 1; index >= 1; index -= 1) {
    const current = normalized[index];
    if (!current || current.status === 'countered' || !isCounter(current.profile)) continue;
    let targetIndex = index - 1;
    while (targetIndex >= 0 && normalized[targetIndex]?.status === 'countered') targetIndex -= 1;
    const target = targetIndex >= 0 ? normalized[targetIndex] : undefined;
    if (!target) continue;
    if (target.profile.grants.includes('uncounterable') || /can['’]t be countered/i.test(getCardOracleText(target.card))) {
      current.status = 'resolves';
      current.reason = `${current.card.name} resolves, but ${target.card.name} is detected as uncounterable.`;
      continue;
    }
    if (current.profile.kinds.includes('soft-counter')) {
      target.status = 'conditional';
      target.reason = `${current.card.name} is a tax/soft counter; whether ${target.card.name} is countered depends on available payment.`;
      current.reason = `Attempts to tax-counter ${target.card.name}.`;
    } else {
      target.status = 'countered';
      target.reason = `Countered by ${current.card.name}.`;
      current.reason = `Counters ${target.card.name}.`;
    }
  }

  const primary = normalized[0];
  const primarySpellResolves = !primary
    ? null
    : primary.status === 'countered'
      ? false
      : primary.status === 'conditional'
        ? null
        : true;
  const summary = primarySpellResolves === true
    ? `${primary?.card.name ?? 'The primary spell'} is projected to resolve in this simplified response chain.`
    : primarySpellResolves === false
      ? `${primary?.card.name ?? 'The primary spell'} is projected to be countered in this simplified response chain.`
      : `${primary?.card.name ?? 'The primary spell'} has a conditional outcome because a tax/permission decision remains unresolved.`;

  return {
    actions: normalized.map((action) => ({
      player: action.player,
      card: action.card.name,
      role: action.role,
      status: action.status,
      reason: action.reason,
    })),
    primarySpellResolves,
    summary,
    assumptions: [
      'Actions are supplied in cast order; later actions resolve first.',
      'A detected counterspell is assumed to target the nearest earlier unresolved spell unless the supplied sequence implies otherwise.',
      'This model handles common counter chains and uncounterable text; modes, split second, copies, Deflecting Swat-style retargeting, Ward on abilities, and arbitrary priority branches still need explicit state.',
    ],
  };
}
