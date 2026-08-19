import type { ScryfallCard } from '../types/scryfall.js';
import { analyzeCastingProfileV05 } from './casting-v05.js';
import { analyzeCommanderDependencyV05, toCombatCreatureV05 } from './combat-v05.js';
import { assessCommanderConfiguration } from './commander-configuration.js';
import { analyzeInteractionProfileV05 } from './interaction-v05.js';
import { getCardOracleText, inferCardRoles, summarizeCard } from './scryfall.js';

export type CardIntelligenceDetailV05 = 'simple' | 'standard' | 'detailed';

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
    commanderConfigurationLegal: boolean;
    commanderPairing: Record<string, unknown>;
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

  addIf(bestUseCases, roles.includes('mana acceleration'), 'Use it early when getting ahead on mana matters more than saving it for later.');
  addIf(bestUseCases, roles.includes('card draw') || roles.includes('repeatable draw'), 'Use it to keep cards flowing so the deck does not run out of gas.');
  addIf(bestUseCases, roles.includes('countermagic'), 'Usually save it for a spell that can stop your plan or win the game for an opponent.');
  addIf(bestUseCases, roles.includes('spot interaction'), 'Use it on the threat that matters most, rather than the first legal target.');
  addIf(bestUseCases, roles.includes('board wipe'), 'Best when opponents are further ahead on board than you are.');
  addIf(bestUseCases, roles.includes('protection'), 'Keep it available when you are committing an important commander, engine, or combo piece.');
  addIf(bestUseCases, roles.includes('tutor'), 'Use it to find the card or role the current game actually needs.');
  addIf(bestUseCases, roles.includes('extra combat'), 'Best when you already have useful attackers, attack triggers, or commander-damage pressure.');
  addIf(bestUseCases, roles.includes('graveyard recursion'), 'Use it when your graveyard contains something worth getting back.');
  addIf(bestUseCases, roles.includes('equipment'), 'Put it on a creature that already attacks well, has evasion, or matters for commander damage.');
  addIf(bestUseCases, roles.includes('life drain'), 'Gets stronger when your deck can trigger the life-loss effect repeatedly.');

  addIf(synergyHooks, /whenever .*cast|whenever you cast/i.test(text), 'spell-cast effects');
  addIf(synergyHooks, /whenever .*enters|enters the battlefield/i.test(text), 'ETB/enter effects');
  addIf(synergyHooks, /whenever .*attacks?|whenever you attack/i.test(text), 'attack triggers');
  addIf(synergyHooks, /combat damage/i.test(text), 'combat-damage triggers');
  addIf(synergyHooks, /sacrifice/i.test(text), 'sacrifice effects');
  addIf(synergyHooks, /graveyard/i.test(text), 'graveyard cards');
  addIf(synergyHooks, /\+1\/\+1 counter/i.test(text), '+1/+1 counters');
  addIf(synergyHooks, /artifact/i.test(text), 'artifacts');
  addIf(synergyHooks, /enchantment/i.test(text), 'enchantments');
  addIf(synergyHooks, /equipment|equip /i.test(text), 'Equipment');
  addIf(synergyHooks, /token/i.test(text), 'tokens');
  addIf(synergyHooks, /Treasure/i.test(text), 'Treasures');
  addIf(synergyHooks, /commander/i.test(text), 'commander-focused effects');

  addIf(rulesAttention, card.name.includes('//'), 'This is a multi-face/split card, so which face or zone it is in can matter.');
  addIf(rulesAttention, /without paying .* mana cost|rather than pay .* mana cost/i.test(text), 'Free or alternative casting can still leave extra costs such as commander tax to pay.');
  addIf(rulesAttention, /ward/i.test(text), 'Ward does not stop targeting; it makes the opponent pay after targeting or lose the spell/ability.');
  addIf(rulesAttention, /protection from/i.test(text), 'Protection affects damage, enchanting/equipping, blocking, and targeting; it is not the same as hexproof or indestructible.');
  addIf(rulesAttention, /indestructible/i.test(text), 'Indestructible stops destroy effects, but not exile, sacrifice, bounce, or toughness reduction.');
  addIf(rulesAttention, /hexproof/i.test(text), 'Hexproof stops opponents from targeting it, but many board wipes do not target.');
  addIf(rulesAttention, /copy/i.test(text), 'Copy effects can depend on exactly what is being copied and which choices were made.');
  addIf(rulesAttention, /you may cast/i.test(text) && /exile/i.test(text), 'If it lets you cast from exile, check how long that permission lasts.');
  addIf(rulesAttention, type.includes('creature') && (card.power === '*' || card.toughness === '*'), 'Its exact power/toughness depends on the game state.');

  if (bestUseCases.length === 0) {
    bestUseCases.push('Use it for the main job described by its Oracle text; this card does not match one of the current simple role templates.');
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
    const configuration = assessCommanderConfiguration(commanders);
    const identity = configuration.combinedColorIdentity;
    const outside = card.color_identity.filter((color) => !identity.includes(color));
    const formatLegal = card.legalities.commander === 'legal';
    const colorIdentityLegal = outside.length === 0;
    result.commanderFit = {
      commanders: configuration.commanders,
      combinedColorIdentity: identity,
      cardColorIdentity: card.color_identity,
      commanderConfigurationLegal: configuration.legal,
      commanderPairing: configuration.pairing,
      formatLegal,
      colorIdentityLegal,
      legalForCommanders: configuration.legal && formatLegal && colorIdentityLegal,
      explanation: !configuration.legal
        ? 'The supplied commander or commander pair is not a legal current Commander configuration.'
        : !formatLegal
          ? `${card.name} is not currently legal in Commander.`
          : !colorIdentityLegal
            ? `${card.name} has color identity outside the supplied commanders: ${outside.join(', ')}.`
            : `${card.name} is Commander-legal with the supplied commander(s).`,
    };
  }

  return result;
}

export function formatCardIntelligenceV05(report: CardIntelligenceV05, detail: CardIntelligenceDetailV05 = 'simple'): unknown {
  if (detail === 'detailed') return { detail, ...report };

  const base = {
    detail,
    card: {
      name: report.card.name,
      manaCost: report.card.manaCost,
      typeLine: report.card.typeLine,
      oracleText: report.card.oracleText,
      colorIdentity: report.card.colorIdentity,
      set: report.card.set,
      collectorNumber: report.card.collectorNumber,
    },
    mainJobs: report.strategicRoles.slice(0, detail === 'simple' ? 3 : 6),
    bestUse: report.bestUseCases.slice(0, detail === 'simple' ? 2 : 4),
    worksWellWith: report.synergyHooks.slice(0, detail === 'simple' ? 3 : 6),
    importantRules: report.rulesAttention.slice(0, detail === 'simple' ? 1 : 3),
    ...(report.commanderFit
      ? {
          commanderFit: {
            legal: report.commanderFit.legalForCommanders,
            explanation: report.commanderFit.explanation,
          },
        }
      : {}),
  };

  if (detail === 'simple') {
    return {
      ...base,
      responseGuidance: 'Explain this card in plain language. Keep the normal answer short: what it does, why it is useful, and at most one important rule or interaction. Only go deeper if the user asks or the card is genuinely tricky.',
    };
  }

  return {
    ...base,
    casting: report.casting,
    interaction: report.interaction,
    combat: report.combat,
    commanderDependency: report.commanderDependency,
    responseGuidance: 'Give a clear practical explanation first. Put deeper rules/mechanics after the simple explanation rather than leading with them.',
  };
}
