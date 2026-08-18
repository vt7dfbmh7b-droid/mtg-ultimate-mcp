import { config } from '../config.js';
import { fetchJson, HttpError, HttpRequestError, isRetryableHttpStatus } from '../lib/http.js';

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

export function isTransientSpellbookFailure(error: unknown): boolean {
  if (error instanceof HttpRequestError) return true;
  return error instanceof HttpError && isRetryableHttpStatus(error.status);
}

function sourceFailure(error: unknown): Record<string, unknown> | null {
  if (error instanceof HttpRequestError) {
    return {
      kind: 'request-failed',
      provider: error.provider,
      method: error.method,
      attempts: error.attempts,
      timeoutMs: error.timeoutMs,
      causeName: error.causeName,
    };
  }
  if (error instanceof HttpError) {
    return {
      kind: 'http-status',
      status: error.status,
    };
  }
  return null;
}

function advisoryFailure(error: unknown): Record<string, unknown> {
  const failure = sourceFailure(error);
  return {
    bracketTag: null,
    flaggedCards: [],
    comboCount: 0,
    strategicallyRelevantCombos: [],
    source: 'Commander Spellbook bracket estimator',
    sourceStatus: 'unavailable',
    ...(failure ? { sourceFailure: failure } : {}),
  };
}

function unavailableComboEvidence(error: unknown): Record<string, unknown> {
  const failure = sourceFailure(error);
  return {
    identity: null,
    counts: {
      included: 0,
      almostIncluded: 0,
      includedByChangingCommanders: 0,
      almostIncludedByAddingColors: 0,
      almostIncludedByChangingCommanders: 0,
    },
    included: [],
    almostIncluded: [],
    includedByChangingCommanders: [],
    almostIncludedByAddingColors: [],
    almostIncludedByChangingCommanders: [],
    source: 'Commander Spellbook',
    sourceStatus: 'unavailable',
    verificationComplete: false,
    ...(failure ? { sourceFailure: failure } : {}),
  };
}

export function summarizeSpellbookVariant(value: unknown): Record<string, unknown> {
  const variant = asRecord(value);
  const uses = Array.isArray(variant.uses) ? variant.uses : Array.isArray(variant.cards) ? variant.cards : [];
  const produces = Array.isArray(variant.produces) ? variant.produces : [];
  const requires = Array.isArray(variant.requires) ? variant.requires : Array.isArray(variant.requirements) ? variant.requirements : [];

  const cards = uses.map((use) => {
    const useRecord = asRecord(use);
    const card = asRecord(useRecord.card);
    const fallbackName = typeof useRecord.name === 'string' ? useRecord.name : undefined;
    return {
      name: card.name ?? fallbackName ?? card.oracleId ?? card.id ?? 'Unknown card',
      quantity: useRecord.quantity ?? 1,
      mustBeCommander: useRecord.mustBeCommander ?? useRecord.must_be_commander ?? false,
    };
  });

  const results = produces.length > 0
    ? produces.map((produce) => {
        const produceRecord = asRecord(produce);
        const feature = asRecord(produceRecord.feature);
        return feature.name ?? feature.description ?? feature.id ?? produceRecord;
      })
    : Array.isArray(variant.results)
      ? variant.results
      : [];

  const requirements = requires.map((requirement) => {
    const requirementRecord = asRecord(requirement);
    const template = asRecord(requirementRecord.template);
    return {
      name: template.name ?? template.scryfallQuery ?? requirementRecord.name ?? template.id ?? 'Template requirement',
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
    popularity: variant.popularity ?? null,
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

export async function searchSpellbookVariants(
  query: string,
  options: { limit?: number; offset?: number; ordering?: string } = {},
): Promise<Record<string, unknown>> {
  const limit = Math.max(1, Math.min(100, Math.trunc(options.limit ?? 25)));
  const offset = Math.max(0, Math.trunc(options.offset ?? 0));
  const ordering = options.ordering?.trim() || '-popularity';
  const url = `${config.commanderSpellbookApiBase}/variants/?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&ordering=${encodeURIComponent(ordering)}`;
  const raw = await fetchJson<SpellbookPage>(url);
  const results = Array.isArray(raw.results) ? raw.results.map(summarizeSpellbookVariant) : [];
  return {
    query,
    count: typeof raw.count === 'number' ? raw.count : results.length,
    next: raw.next ?? null,
    previous: raw.previous ?? null,
    results,
    source: 'Commander Spellbook variants search',
  };
}

export async function findDeckCombos(decklist: string, maxResults = 20): Promise<Record<string, unknown>> {
  const raw = await postDecklist('/find-my-combos', decklist);
  const payload = asRecord(raw.results ?? raw);
  const safeLimit = Math.max(1, Math.min(maxResults, 100));

  const included = arrayFrom(payload, 'included', 'included').map(summarizeSpellbookVariant);
  const almostIncluded = arrayFrom(payload, 'almostIncluded', 'almost_included').map(summarizeSpellbookVariant);
  const includedByChangingCommanders = arrayFrom(
    payload,
    'includedByChangingCommanders',
    'included_by_changing_commanders',
  ).map(summarizeSpellbookVariant);
  const almostByAddingColors = arrayFrom(
    payload,
    'almostIncludedByAddingColors',
    'almost_included_by_adding_colors',
  ).map(summarizeSpellbookVariant);
  const almostByChangingCommanders = arrayFrom(
    payload,
    'almostIncludedByChangingCommanders',
    'almost_included_by_changing_commanders',
  ).map(summarizeSpellbookVariant);

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

/**
 * Fail-closed combo evidence wrapper. A transient provider failure returns zero positive combo
 * evidence plus explicit unavailable provenance. This must never be interpreted as proof that
 * the deck contains no combo; it means verification could not be completed. Non-transient errors
 * still throw. Callers that require a positively verified package must reject unavailable evidence.
 */
export async function findDeckCombosEvidence(
  decklist: string,
  maxResults = 20,
): Promise<Record<string, unknown>> {
  try {
    return {
      ...(await findDeckCombos(decklist, maxResults)),
      sourceStatus: 'available',
      verificationComplete: true,
    };
  } catch (error) {
    if (!isTransientSpellbookFailure(error)) throw error;
    return unavailableComboEvidence(error);
  }
}

/**
 * Commander Spellbook's bracket estimator is advisory evidence, not a hard legality/rules gate.
 * Transient network/429/5xx failures therefore return an explicit unavailable record instead of
 * crashing an otherwise legal build. Callers must treat the absent tag/strategic signals as
 * unavailable evidence, never as positive evidence. Non-transient errors still throw.
 */
export async function estimateCommanderBracket(
  decklist: string,
  unknownCommanders = false,
): Promise<Record<string, unknown>> {
  const query = unknownCommanders ? '?unknown_commanders=true' : '';
  let raw: UnknownRecord;
  try {
    raw = asRecord(await postDecklist('/estimate-bracket', decklist, query));
  } catch (error) {
    if (!isTransientSpellbookFailure(error)) throw error;
    return advisoryFailure(error);
  }
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
      combo: summarizeSpellbookVariant(entry.combo),
    }));

  return {
    bracketTag,
    flaggedCards,
    comboCount: combos.length,
    strategicallyRelevantCombos,
    source: 'Commander Spellbook bracket estimator',
    sourceStatus: 'available',
  };
}
