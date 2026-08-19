import { writeFile } from 'node:fs/promises';
import {
  fetchTopDeckLearningCandidatesV15,
  TopDeckRateLimitErrorV15,
} from '../src/services/topdeck-learning-live-v15.js';
import {
  realOutcomeSourceByIdV15,
  sourceCanTrainTargetV15,
} from '../src/services/real-outcome-source-inventory-v15.js';

const RESULT_PATH = 'topdeck-learning-source-live-result.json';
const FAILURE_PATH = 'topdeck-learning-source-live-failure.txt';

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asIsoRange(values: string[]): { earliest: string | null; latest: string | null } {
  const milliseconds = values
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));
  if (milliseconds.length === 0) return { earliest: null, latest: null };
  return {
    earliest: new Date(Math.min(...milliseconds)).toISOString(),
    latest: new Date(Math.max(...milliseconds)).toISOString(),
  };
}

function safeCommanderFailureClass(reason: string): string {
  const cardCount = reason.match(/exactly 100 cards; found (\d+)/i)?.[1];
  if (cardCount) return `card-count-found:${cardCount}`;
  const commanderCount = reason.match(/one or two commander entries; found (\d+)/i)?.[1];
  if (commanderCount) return `commander-count-found:${commanderCount}`;
  if (/each TopDeck commander entry must represent exactly one physical card/i.test(reason)) return 'commander-quantity-invalid';
  return 'other-invalid-commander-deck';
}

async function main(): Promise<void> {
  const source = realOutcomeSourceByIdV15('topdeck');
  requireCondition(source, 'TopDeck must exist in the real-outcome source inventory.');
  requireCondition(source.trainingStatus === 'enabled-strict-historical', 'TopDeck source policy must remain strict-historical enabled.');
  requireCondition(source.lineageFamily === 'topdeck-tournament-results', 'Unexpected TopDeck lineage family.');
  requireCondition(source.attributionRequired === true, 'TopDeck attribution must remain mandatory.');
  requireCondition(sourceCanTrainTargetV15('topdeck', 'event-top-cut'), 'TopDeck must be enabled for event-top-cut evidence.');

  const result = await fetchTopDeckLearningCandidatesV15({
    lastDays: 30,
    participantMin: 16,
    timeoutMs: 30_000,
  });

  requireCondition(result.source === 'topdeck-v2', `Unexpected live learning source: ${result.source}.`);
  requireCondition(result.rateLimitPolicy === 'single-request-no-automatic-retry', 'TopDeck live learning control must remain a single-request/no-retry probe.');
  requireCondition(result.attribution === 'Data provided by TopDeck.gg', 'Unexpected or missing TopDeck attribution.');

  const rejectionCounts = Object.fromEntries(
    [...new Set(result.rejected.map((item) => item.code))]
      .sort()
      .map((code) => [code, result.rejected.filter((item) => item.code === code).length]),
  );
  const invalidCommanderClasses = result.rejected
    .filter((item) => item.code === 'invalid-commander-deck')
    .map((item) => safeCommanderFailureClass(item.reason));
  const invalidCommanderDiagnostics = Object.fromEntries(
    [...new Set(invalidCommanderClasses)]
      .sort()
      .map((classification) => [classification, invalidCommanderClasses.filter((item) => item === classification).length]),
  );
  const uniqueEvents = new Set(result.candidates.map((candidate) => candidate.providerEventId)).size;
  const fieldSizes = result.candidates.map((candidate) => candidate.fieldSize);
  const outcomeRange = asIsoRange(result.candidates.map((candidate) => candidate.outcomeOccurredAt));

  const audit = {
    schemaVersion: 'topdeck-learning-source-live-control-v15.4',
    checkedAt: result.fetchedAt,
    provider: result.source,
    requestUrl: result.requestUrl,
    query: result.query,
    tournamentsReturned: result.tournamentsReturned,
    providerShapeAudit: result.providerShapeAudit,
    usableCandidates: result.candidates.length,
    rejectedRows: result.rejected.length,
    rejectionCounts,
    invalidCommanderDiagnostics,
    uniqueCandidateEvents: uniqueEvents,
    fieldSize: {
      minimum: fieldSizes.length > 0 ? Math.min(...fieldSizes) : null,
      maximum: fieldSizes.length > 0 ? Math.max(...fieldSizes) : null,
    },
    outcomeRange,
    attribution: result.attribution,
    rateLimitPolicy: result.rateLimitPolicy,
    sourcePolicy: {
      sourceId: source.sourceId,
      lineageFamily: source.lineageFamily,
      population: source.population,
      trainingStatus: source.trainingStatus,
      historicalReplayability: source.historicalReplayability,
      eventTopCutEnabled: sourceCanTrainTargetV15('topdeck', 'event-top-cut'),
    },
    privacy: {
      decklistsPersisted: false,
      playerIdentifiersPersisted: false,
      apiKeyPersisted: false,
      cardNamesPersisted: false,
      rawRejectionReasonsPersisted: false,
      aggregateRejectionDiagnosticsOnly: true,
    },
  } as const;

  // Persist safe aggregate diagnostics even when the strict usable-candidate gate
  // fails. This lets provider/schema problems be diagnosed without retaining
  // player identifiers, card names, raw rejection messages, URLs, or deck contents.
  await writeFile(RESULT_PATH, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(audit, null, 2));

  requireCondition(result.tournamentsReturned > 0, 'TopDeck returned no tournaments for the bounded 30-day, 16+ participant EDH probe.');
  requireCondition(
    result.candidates.length > 0,
    `TopDeck returned tournaments but no usable exact Commander learning candidates. Aggregate rejection counts: ${JSON.stringify(rejectionCounts)}.`,
  );
  requireCondition(result.candidates.every((candidate) => candidate.sourceId === 'topdeck'), 'A live TopDeck candidate carried an unexpected source ID.');
  requireCondition(result.candidates.every((candidate) => candidate.commanderNames.length >= 1 && candidate.commanderNames.length <= 2), 'A live TopDeck candidate violated the one/two-commander boundary.');
  requireCondition(result.candidates.every((candidate) => candidate.fieldSize >= 16), 'A live TopDeck candidate violated the requested minimum field size.');
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const classification = error instanceof TopDeckRateLimitErrorV15
    ? 'provider-rate-limited'
    : /TOPDECK_API_KEY is not configured/i.test(message)
      ? 'credential-unavailable'
      : 'provider-or-control-failure';
  await writeFile(
    FAILURE_PATH,
    `${JSON.stringify({ schemaVersion: 'topdeck-learning-source-live-failure-v15.1', classification, message }, null, 2)}\n`,
    'utf8',
  ).catch(() => undefined);
  console.error(`[TopDeck learning source live] ${classification}: ${message}`);
  process.exitCode = 1;
});
