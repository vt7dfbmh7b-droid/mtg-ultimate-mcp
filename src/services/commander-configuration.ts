import type { ScryfallCard } from '../types/scryfall.js';
import { validateCommanderDeck } from './commander-rules.js';
import { parseDecklist } from './deck.js';

export interface CommanderConfigurationAssessment {
  commanders: string[];
  combinedColorIdentity: string[];
  pairing: Record<string, unknown>;
  commanderChecks: Array<Record<string, unknown>>;
  pairingLegal: boolean;
  eligibilityAndFormatLegal: boolean;
  legal: boolean;
}

/**
 * Validate only the supplied command-zone configuration. Deck-size failure is
 * deliberately ignored here because callers such as card-fit/intelligence tools
 * are asking whether the designated commander(s) themselves form a legal current
 * Commander configuration, not validating a complete 100-card deck.
 */
export function assessCommanderConfiguration(
  commanders: ScryfallCard[],
): CommanderConfigurationAssessment {
  if (!Array.isArray(commanders) || commanders.length < 1 || commanders.length > 2) {
    throw new Error('Commander configuration requires one or two resolved commander cards.');
  }

  const parsed = parseDecklist([
    '// COMMANDER',
    ...commanders.map((card) => `1 ${card.name}`),
  ].join('\n'));
  const rules = validateCommanderDeck(parsed, commanders);
  const pairingLegal = commanders.length === 1 || rules.pairing.legal === true;
  const eligibilityAndFormatLegal = rules.commanderChecks.every((check) =>
    check.resolved === true
    && check.eligible === true
    && check.commanderFormatLegality === 'legal');

  return {
    commanders: commanders.map((card) => card.name),
    combinedColorIdentity: [...new Set(commanders.flatMap((card) => card.color_identity))].sort(),
    pairing: rules.pairing,
    commanderChecks: rules.commanderChecks,
    pairingLegal,
    eligibilityAndFormatLegal,
    legal: pairingLegal && eligibilityAndFormatLegal,
  };
}
