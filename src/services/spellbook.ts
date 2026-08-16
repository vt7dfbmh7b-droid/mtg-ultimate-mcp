import { config } from '../config.js';
import { fetchJson } from '../lib/http.js';

interface SpellbookPage {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: unknown;
  [key: string]: unknown;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

function arrayFrom(record: UnknownRecord, camel: string, snake: string): unknown[] {
  const value = record[camel] ?? record[snake];
  return Array.isArray(value) ? value : [];
}

function summarizeVariant(value: unknown): Record<string, unknown> {
  const variant = asRecord(value);
  const uses = Array.isArray(variant.uses) ? variant.uses : [];
  const produces = Array.isArray(variant.produces) ? variant.produces : [];
  const requires = Array.isArray(variant.requires) ? variant.requires : [];

  const cards = uses.map((use) => {
    const useRecord = asRecord(use);
    const card = asRecord(useRecord.card);
    return {
      name: card.name ?? card.oracleId ?? card.id ?? 'Unknown card',
      quantity: useRecord.quantity ?? 1,
      mustBeCommander: useRecord.mustBeCommander ?? useRecord.must_be_commander ?? false,
    };
  });

  const results = produces.map((produce) => {
    const produceRecord = asRecord(produce);
    const feature = asRecord(produceRecord.feature);
    return feature.name ?? feature.description ?? feature.id ?? produceRecord;
  });

  const requirements = requires.map((requirement) => {
    const requirementRecord = asRecord(requirement);
    const template = asRecord(requirementRecord.template);
    return {
      name: template.name ?? template.scryfallQuery ?? template.id ?? 'Template requirement',
      quantity: requirementRecord.quantity ?? 1,
    };
  });

  return {
    id: variant.id,
    identity: variant.identity,
    status: variant.status,
    bracketTag: variant.bracketTag ?? variant.bracket_tag ?? null,
    cards,
    results,
    requirements,
    description: variant.description,
    manaNeeded: variant.manaNeeded ?? variant.mana_needed,
    otherPrerequisites: variant.otherPrerequisites ?? variant.other_prerequisites,
  };
}

async function postDecklist(path: string, decklist: string, query = ''): Promise<SpellbookPage> {
  const url = `${config.commanderSpellbookApiBase}${path}${query}`;
  return fetchJson<SpellbookPage>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
    body: decklist,
  });
}

export async function findDeckCombos(decklist: string, maxResults = 20): Promise<Record<string, unknown>> {
  const raw = await postDecklist('/find-my-combos', decklist);
  const payload = asRecord(raw.results ?? raw);
  const safeLimit = Math.max(1, Math.min(maxResults, 100));

  const included = arrayFrom(payload, 'included', 'included').map(summarizeVariant);
  const almostIncluded = arrayFrom(payload, 'almostIncluded', 'almost_included').map(summarizeVariant);
  const includedByChangingCommanders = arrayFrom(
    payload,
    'includedByChangingCommanders',
    'included_by_changing_commanders',
  ).map(summarizeVariant);
  const almostByAddingColors = arrayFrom(
    payload,
    'almostIncludedByAddingColors',
    'almost_included_by_adding_colors',
  ).map(summarizeVariant);
  const almostByChangingCommanders = arrayFrom(
    payload,
    'almostIncludedByChangingCommanders',
    'almost_included_by_changing_commanders',
  ).map(summarizeVariant);

  return {
    identity: payload.identity,
    counts: {
      included: included.length,
      almostIncluded: almostIncluded.length,
      includedByChangingCommanders: includedByChangingCommanders.length,
      almostIncludedByAddingColors: almostByAddingColors.length,
      almostIncludedByChangingCommanders: almostByChangingCommanders.length,
    },
    included: included.slice(0, safeLimit),
    almostIncluded: almostIncluded.slice(0, safeLimit),
    includedByChangingCommanders: includedByChangingCommanders.slice(0, safeLimit),
    almostIncludedByAddingColors: almostByAddingColors.slice(0, safeLimit),
    almostIncludedByChangingCommanders: almostByChangingCommanders.slice(0, safeLimit),
    source: 'Commander Spellbook',
  };
}

export async function estimateCommanderBracket(
  decklist: string,
  unknownCommanders = false,
): Promise<Record<string, unknown>> {
  const query = unknownCommanders ? '?unknown_commanders=true' : '';
  const raw = asRecord(await postDecklist('/estimate-bracket', decklist, query));
  const bracketTag = raw.bracketTag ?? raw.bracket_tag;
  const cards = Array.isArray(raw.cards) ? raw.cards.map(asRecord) : [];
  const combos = Array.isArray(raw.combos) ? raw.combos.map(asRecord) : [];

  const flaggedCards = cards
    .filter(
      (entry) =>
        entry.banned === true ||
        entry.gameChanger === true ||
        entry.game_changer === true ||
        entry.massLandDenial === true ||
        entry.mass_land_denial === true ||
        entry.extraTurn === true ||
        entry.extra_turn === true,
    )
    .map((entry) => {
      const card = asRecord(entry.card);
      return {
        name: card.name ?? card.id ?? 'Unknown card',
        quantity: entry.quantity,
        banned: entry.banned ?? false,
        gameChanger: entry.gameChanger ?? entry.game_changer ?? false,
        massLandDenial: entry.massLandDenial ?? entry.mass_land_denial ?? false,
        extraTurn: entry.extraTurn ?? entry.extra_turn ?? false,
      };
    });

  const strategicallyRelevantCombos = combos
    .filter(
      (entry) =>
        entry.relevant === true ||
        entry.borderlineRelevant === true ||
        entry.borderline_relevant === true ||
        entry.definitelyTwoCard === true ||
        entry.definitely_two_card === true,
    )
    .slice(0, 25)
    .map((entry) => ({
      relevant: entry.relevant ?? false,
      borderlineRelevant: entry.borderlineRelevant ?? entry.borderline_relevant ?? false,
      arguablyTwoCard: entry.arguablyTwoCard ?? entry.arguably_two_card ?? false,
      definitelyTwoCard: entry.definitelyTwoCard ?? entry.definitely_two_card ?? false,
      speed: entry.speed,
      lock: entry.lock ?? false,
      combo: summarizeVariant(entry.combo),
    }));

  return {
    bracketTag,
    flaggedCards,
    comboCount: combos.length,
    strategicallyRelevantCombos,
    source: 'Commander Spellbook bracket estimator',
  };
}
