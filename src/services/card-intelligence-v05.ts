import type { ScryfallCard } from '../types/scryfall.js';
import { analyzeCastingProfileV05 } from './casting-v05.js';
import { analyzeCommanderDependencyV05, toCombatCreatureV05 } from './combat-v05.js';
import { analyzeInteractionProfileV05 } from './interaction-v05.js';
import { getCardManaCost, getCardOracleText, inferCardRoles, summarizeCard } from './scryfall.js';

export interface CardIntelligenceV05 {
  card: ReturnType<typeof summarizeCard>;
  casting: ReturnType<typeof analyzeCastingProfileV05>;
  interaction: ReturnType<typeof analyzeInteractionProfileV05>;
  combat: ReturnType<typeof toCombatCreatureV05> | null;
  commanderDependency: ReturnType<typeof analyzeCommanderDependencyV05>;
  strategicRoles: string[];
  bestUseCases: string[];
  synergyHooks: string[];
  rulesAttention: string[];
  commanderFit?: {
    commanders: string[];
    combinedColorIdentity: string[];
    cardColorIdentity: string[];
    formatLegal: boolean;
    colorIdentityLegal: boolean;
    legalForCommanders: boolean;
    explanation: string;
  };
}

function addIf(output: string[], condition: boolean, note: string): void {
  if (condition) output.push(note);
}

function strategicNotes(card: ScryfallCard, roles: string[]): { bestUseCases: string[]; synergyHooks: string[]; rulesAttention: string[] } {
  const text = getCardOracleText(card);
  const type = card.type_line.toLowerCase();
  const bestUseCases: string[] = [];
  const synergyHooks: string[] = [];
  const rulesAttention: string[] = [];

  addIf(bestUseCases, roles.includes('mana acceleration'), 'Use early when accelerating into the commander or a high-impact turn is more valuable than holding the card for later.');
  addIf(bestUseCases, roles.includes('card draw') || roles.includes('repeatable draw'), 'Best in turns where converting spare mana/board presence into additional cards improves long-game consistency.');
  addIf(bestUseCases, roles.includes('countermagic'), 'Hold for the opposing spell that most threatens your win condition or protects an opponent’s winning line.');
  addIf(bestUseCases, roles.includes('spot interaction'), 'Prioritize targets that stop a win, disable your engine, or generate substantially more value than this card costs.');
  addIf(bestUseCases, roles.includes('board wipe'), 'Best when opponents are materially ahead on board or when your deck rebuilds more efficiently after the reset.');
  addIf(bestUseCases, roles.includes('protection'), 'Keep available when committing a commander, combo piece, or high-value engine into likely interaction.');
  addIf(bestUseCases, roles.includes('tutor'), 'Use when you know the role or exact piece the current game state requires rather than tutoring automatically for the same card every game.');
  addIf(bestUseCases, roles.includes('extra combat'), 'Maximize after establishing attack triggers, commander-damage pressure, or creatures that benefit from repeated combat steps.');
  addIf(bestUseCases, roles.includes('graveyard recursion'), 'Delay until the graveyard contains a target whose recovered value exceeds the opportunity cost of casting this card now.');
  addIf(bestUseCases, roles.includes('equipment'), 'Most effective when attached to a creature that already has evasion, double strike, attack triggers, or commander-damage relevance.');
  addIf(bestUseCases, roles.includes('life drain'), 'Scales best with repeatable sacrifice, token, spell-cast, or life-loss loops that trigger the drain effect multiple times.');

  addIf(synergyHooks, /whenever .*cast|whenever you cast/i.test(text), 'Spell-cast trigger');
  addIf(synergyHooks, /whenever .*enters|enters the battlefield/i.test(text), 'ETB/enter trigger');
  addIf(synergyHooks, /whenever .*attacks?|whenever you attack/i.test(text), 'Attack trigger');
  addIf(synergyHooks, /combat damage/i.test(text), 'Combat-damage trigger');
  addIf(synergyHooks, /sacrifice/i.test(text), 'Sacrifice interaction');
  addIf(synergyHooks, /graveyard/i.test(text), 'Graveyard interaction');
  addIf(synergyHooks, /\+1\/\+1 counter/i.test(text), '+1/+1 counter synergy');
  addIf(synergyHooks, /artifact/i.test(text), 'Artifact synergy');
  addIf(synergyHooks, /enchantment/i.test(text), 'Enchantment synergy');
  addIf(synergyHooks, /equipment|equip /i.test(text), 'Equipment synergy');
  addIf(synergyHooks, /token/i.test(text), 'Token synergy');
  addIf(synergyHooks, /Treasure/i.test(text), 'Treasure synergy');
  addIf(synergyHooks, /commander/i.test(text), 'Commander-dependent synergy');

  addIf(rulesAttention, card.name.includes('//'), 'Multi-face/split card: casting face, characteristics, and zone rules can matter.');
  addIf(rulesAttention, /without paying .* mana cost|rather than pay .* mana cost/i.test(text), 'Alternative/free casting does not automatically erase additional costs such as commander tax.');
  addIf(rulesAttention, /ward/i.test(text), 'Ward is a triggered ability; target legality and whether the ward cost is paid are separate from choosing the target.');
  addIf(rulesAttention, /protection from/i.test(text), 'Protection has multiple consequences (damage, enchanting/equipping, blocking, targeting) and is not the same as indestructible or hexproof.');
  addIf(rulesAttention, /indestructible/i.test(text), 'Indestructible prevents destruction but not exile, sacrifice, bounce, toughness reduction, or many other removal methods.');
  addIf(rulesAttention, /hexproof/i.test(text), 'Hexproof restricts opposing targeting; it does not stop untargeted effects such as many board wipes.');
  addIf(rulesAttention, /copy/i.test(text), 'Copy effects can differ depending on whether a spell or permanent was cast and which choices/values are copied.');
  addIf(rulesAttention, /you may cast/i.test(text) && /exile/i.test(text), 'Permission to cast from exile can have a duration/timing window; the exact Oracle sentence controls it.');
  addIf(rulesAttention, type.includes('creature') && (card.power === '*' || card.toughness === '*'), 'Power/toughness is characteristic- or state-dependent and requires the relevant game state for exact combat math.');

  if (bestUseCases.length === 0) {
    bestUseCases.push('Use according to its primary Oracle-text role; this card does not match one of the current high-confidence strategic role templates.');
  }

  return {
    bestUseCases: [...new Set(bestUseCases)],
    synergyHooks: [...new Set(synergyHooks)],
    rulesAttention: [...new Set(rulesAttention)],
  };
}

export function buildCardIntelligenceV05(card: ScryfallCard, commanders: ScryfallCard[] = []): CardIntelligenceV05 {
  const roles = inferCardRoles(card);
  const strategic = strategicNotes(card, roles);
  const combat = /\bcreature\b/i.test(card.type_line) ? toCombatCreatureV05(card) : null;
  const result: CardIntelligenceV05 = {
    card: summarizeCard(card),
    casting: analyzeCastingProfileV05(card),
    interaction: analyzeInteractionProfileV05(card),
    combat,
    commanderDependency: analyzeCommanderDependencyV05(card),
    strategicRoles: roles,
    ...strategic,
  };

  if (commanders.length > 0) {
    const identity = [...new Set(commanders.flatMap((commander) => commander.color_identity))].sort();
    const outside = card.color_identity.filter((color) => !identity.includes(color));
    const formatLegal = card.legalities.commander === 'legal';
    const colorIdentityLegal = outside.length === 0;
    result.commanderFit = {
      commanders: commanders.map((commander) => commander.name),
      combinedColorIdentity: identity,
      cardColorIdentity: card.color_identity,
      formatLegal,
      colorIdentityLegal,
      legalForCommanders: formatLegal && colorIdentityLegal,
      explanation: !formatLegal
        ? `${card.name} is not currently legal in Commander.`
        : !colorIdentityLegal
          ? `${card.name} contains color identity outside the supplied commanders’ combined identity: ${outside.join(', ')}.`
          : `${card.name} is Commander-legal and its color identity fits the supplied commanders.`,
    };
  }

  return result;
}
