import type { ScryfallCard } from '../types/scryfall.js';
import { getCardOracleText } from './scryfall.js';

export type GameZoneV07 = 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'command' | 'library' | 'stack';

export interface ComboPieceStateV07 {
  card: ScryfallCard;
  currentZone: GameZoneV07;
  requiredZone?: GameZoneV07;
  isCommander?: boolean;
}

export interface ComboZoneProfileV07 {
  card: string;
  normalUseZones: GameZoneV07[];
  graveyardPermissions: string[];
  exilePermissions: string[];
  commandZoneRelevant: boolean;
  notes: string[];
}

export interface ComboZoneReadinessV07 {
  ready: boolean;
  readyPieces: number;
  totalPieces: number;
  pieces: Array<{
    card: string;
    currentZone: GameZoneV07;
    requiredZone: GameZoneV07 | null;
    zoneReady: boolean;
    reason: string;
    profile: ComboZoneProfileV07;
  }>;
  blockers: string[];
  caveats: string[];
}

function sentences(text: string): string[] {
  return text.split(/\n|(?<=[.!?])\s+/).map((value) => value.trim()).filter(Boolean);
}

export function inferComboZoneProfileV07(card: ScryfallCard): ComboZoneProfileV07 {
  const text = getCardOracleText(card);
  const type = card.type_line.toLowerCase();
  const keywords = new Set((card.keywords ?? []).map((keyword) => keyword.toLowerCase()));
  const graveyardPermissions = sentences(text).filter((sentence) =>
    /from your graveyard|from a graveyard|in your graveyard/i.test(sentence)
    || /flashback|escape|retrace|unearth|embalm|eternalize|disturb|jump-start|aftermath/i.test(sentence),
  );
  const exilePermissions = sentences(text).filter((sentence) =>
    /from exile|exiled with|you may cast .* exile|you may play .* exile/i.test(sentence)
    || /foretell|suspend|rebound|plot/i.test(sentence),
  );
  const normalUseZones = new Set<GameZoneV07>();

  if (/instant|sorcery/.test(type)) {
    normalUseZones.add('hand');
    normalUseZones.add('stack');
  } else if (/land/.test(type)) {
    normalUseZones.add('hand');
    normalUseZones.add('battlefield');
  } else {
    normalUseZones.add('hand');
    normalUseZones.add('battlefield');
  }

  if (graveyardPermissions.length > 0 || [...keywords].some((keyword) => ['flashback', 'escape', 'retrace', 'unearth', 'embalm', 'eternalize', 'disturb', 'jump-start', 'aftermath'].includes(keyword))) {
    normalUseZones.add('graveyard');
  }
  if (exilePermissions.length > 0 || [...keywords].some((keyword) => ['foretell', 'suspend', 'rebound', 'plot'].includes(keyword))) {
    normalUseZones.add('exile');
  }
  const commandZoneRelevant = /commander|command zone/i.test(text) || /legendary/.test(type);
  if (commandZoneRelevant) normalUseZones.add('command');

  const notes: string[] = [];
  if (graveyardPermissions.length > 0) notes.push('A graveyard permission/ability was detected; its exact cost and timing still matter.');
  if (exilePermissions.length > 0) notes.push('An exile permission/ability was detected; exile permissions are often tied to the effect that exiled the card.');
  if (/activate only|cast only|during your turn|sorcery/i.test(text)) notes.push('Timing/activation restrictions were detected and may still gate the combo.');

  return {
    card: card.name,
    normalUseZones: [...normalUseZones],
    graveyardPermissions,
    exilePermissions,
    commandZoneRelevant,
    notes,
  };
}

function defaultZoneReady(piece: ComboPieceStateV07, profile: ComboZoneProfileV07): { ready: boolean; reason: string } {
  if (piece.requiredZone) {
    return piece.currentZone === piece.requiredZone
      ? { ready: true, reason: `Piece is in the explicitly required ${piece.requiredZone} zone.` }
      : { ready: false, reason: `Piece needs to be in ${piece.requiredZone}, but is currently in ${piece.currentZone}.` };
  }
  if (piece.currentZone === 'library') return { ready: false, reason: 'A piece still in the library is not assembled without a tutor/search line.' };
  if (piece.currentZone === 'graveyard') {
    return profile.normalUseZones.includes('graveyard')
      ? { ready: true, reason: 'The card has a detected way to function/cast from the graveyard.' }
      : { ready: false, reason: 'The card is in the graveyard and no supported graveyard permission was detected.' };
  }
  if (piece.currentZone === 'exile') {
    return profile.normalUseZones.includes('exile')
      ? { ready: true, reason: 'The card has a detected exile permission/ability, subject to its exact permission.' }
      : { ready: false, reason: 'The card is exiled and no supported permission to use it from exile was detected.' };
  }
  if (piece.currentZone === 'command') {
    return piece.isCommander || profile.commandZoneRelevant
      ? { ready: true, reason: 'The card is command-zone relevant; casting/activation cost still has to be paid.' }
      : { ready: false, reason: 'The card is in the command zone without a detected reason it can function there.' };
  }
  return profile.normalUseZones.includes(piece.currentZone)
    ? { ready: true, reason: `The card can normally participate from ${piece.currentZone} in this abstraction.` }
    : { ready: false, reason: `No supported use from ${piece.currentZone} was detected.` };
}

export function evaluateComboZoneReadinessV07(pieces: ComboPieceStateV07[]): ComboZoneReadinessV07 {
  const safe = pieces.slice(0, 8);
  const evaluated = safe.map((piece) => {
    const profile = inferComboZoneProfileV07(piece.card);
    const assessment = defaultZoneReady(piece, profile);
    return {
      card: piece.card.name,
      currentZone: piece.currentZone,
      requiredZone: piece.requiredZone ?? null,
      zoneReady: assessment.ready,
      reason: assessment.reason,
      profile,
    };
  });
  const blockers = evaluated.filter((piece) => !piece.zoneReady).map((piece) => `${piece.card}: ${piece.reason}`);
  return {
    ready: evaluated.length >= 2 && blockers.length === 0,
    readyPieces: evaluated.filter((piece) => piece.zoneReady).length,
    totalPieces: evaluated.length,
    pieces: evaluated,
    blockers,
    caveats: [
      'Zone readiness is necessary but not sufficient: mana, priority, targets, summoning sickness, card-specific costs, once-per-turn limits, and opponent interaction may still stop the combo.',
      'Exile permissions are especially contextual; being in exile alone does not mean a card can be cast from exile.',
    ],
  };
}
