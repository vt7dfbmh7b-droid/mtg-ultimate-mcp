import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import {
  captureTopDeckPreEventDecklistsV15,
  TopDeckProspectiveRateLimitErrorV15,
} from '../src/services/topdeck-prospective-capture-v15.js';

const RESULT_PATH = 'topdeck-upcoming-pre-event-visibility-v15.json';
const FAILURE_PATH = 'topdeck-upcoming-pre-event-visibility-v15-failure.txt';

const CANDIDATES = [
  { label: 'breach-bay', tournamentId: 'breach-the-bay-2' },
  { label: 'invitational', tournamentId: 'topdeck-invitational-2026' },
  { label: 'summer-storm', tournamentId: 'summer-storm-15k-cedh-open' },
  { label: 'forbes-qualifier', tournamentId: 'forbes-cedh-mox-diamond-qualifier-aug-2026' },
  { label: 'power9-september', tournamentId: 'september-cedh-event' },
  { label: 'card-wizards-cash', tournamentId: 'cedh-1k-cash-tournament' },
  { label: 'splash', tournamentId: 'the-splash-2026' },
  { label: 'card-wizards-mox', tournamentId: 'win-a-dual-land-cedh-tournament' },
  { label: 'space-coast-q3', tournamentId: 'space-coast-treasures-cedh-tournament-2-1778012169837' },
  { label: 'journeys-end', tournamentId: 'journeys-end-games-cedh-tournament-commander' },
] as const;

function eventFingerprint(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function failureClass(error: unknown): string {
  if (error instanceof TopDeckProspectiveRateLimitErrorV15) return 'provider-rate-limited';
  const message = error instanceof Error ? error.message : String(error);
  if (/status Not Started/i.test(message)) return 'event-not-pre-start';
  if (/identity .* does not match/i.test(message)) return 'slug-not-provider-tid';
  if (/HTTP 404/i.test(message)) return 'provider-not-found';
  if (/HTTP 401|HTTP 403/i.test(message)) return 'provider-auth-or-visibility';
  if (/Magic: The Gathering \/ EDH/i.test(message)) return 'wrong-game-or-format';
  if (/after tournament start/i.test(message)) return 'capture-finished-after-start';
  return 'provider-or-contract-failure';
}

async function main(): Promise<void> {
  const results: Array<Record<string, unknown>> = [];

  for (let index = 0; index < CANDIDATES.length; index += 1) {
    const candidate = CANDIDATES[index]!;
    try {
      const result = await captureTopDeckPreEventDecklistsV15({
        tournamentId: candidate.tournamentId,
        timeoutMs: 30_000,
      });
      if (result.status === 'captured') {
        results.push({
          label: candidate.label,
          providerEventFingerprint: eventFingerprint(candidate.tournamentId),
          apiStatus: 'captured',
          eventStartAt: result.eventStartAt,
          capturedAt: result.capturedAt,
          providerStatus: result.providerStatus,
          acceptedStrictDecks: result.decks.length,
          uniqueDeckFingerprints: new Set(result.decks.map((deck) => deck.deckFingerprint)).size,
          rejectedStandingRows: result.rejectedStandingRows,
          infoSourceContentHash: result.infoSourceContentHash,
          standingsSourceContentHash: result.standingsSourceContentHash,
          preEventCaptureUsable: result.decks.length > 0,
        });
      } else {
        results.push({
          label: candidate.label,
          providerEventFingerprint: eventFingerprint(candidate.tournamentId),
          apiStatus: 'unavailable',
          eventStartAt: result.eventStartAt,
          capturedAt: result.capturedAt,
          providerStatus: result.providerStatus,
          acceptedStrictDecks: 0,
          rejectedStandingRows: result.rejectedStandingRows,
          reason: result.reason,
          preEventCaptureUsable: false,
        });
      }
    } catch (error) {
      results.push({
        label: candidate.label,
        providerEventFingerprint: eventFingerprint(candidate.tournamentId),
        apiStatus: 'error',
        failureClass: failureClass(error),
        preEventCaptureUsable: false,
      });
    }
    if (index + 1 < CANDIDATES.length) {
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }

  const usable = results.filter((entry) => entry.preEventCaptureUsable === true);
  const audit = {
    schemaVersion: 'topdeck-upcoming-pre-event-visibility-v15.2',
    checkedAt: new Date().toISOString(),
    candidatesChecked: CANDIDATES.length,
    candidatesUsableNow: usable.length,
    totalVisibleStrictDecks: usable.reduce((sum, entry) => sum + Number(entry.acceptedStrictDecks ?? 0), 0),
    results,
    interpretation: usable.length > 0
      ? 'At least one known upcoming public TopDeck event currently exposes strict exact Commander deck objects before provider start. It can enter the existing prospective evidence pipeline now.'
      : 'None of the checked public upcoming events currently exposes a strict exact Commander deck object through the documented pre-event REST path. This is an availability result, not evidence that no decklists were submitted.',
    safeguards: {
      existingProspectiveCaptureServiceReused: true,
      eventMustBeProviderNotStarted: true,
      captureMustCompleteBeforeProviderStart: true,
      externalDeckUrlsFollowed: false,
      decklistsPersisted: false,
      cardNamesPersisted: false,
      playerIdentifiersPersisted: false,
      apiKeyPersisted: false,
      automaticRetries: 0,
      interEventDelayMs: 750,
    },
  } as const;

  await writeFile(RESULT_PATH, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(audit, null, 2));
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  await writeFile(
    FAILURE_PATH,
    `${JSON.stringify({ schemaVersion: 'topdeck-upcoming-pre-event-visibility-v15-failure-v15.1', message }, null, 2)}\n`,
    'utf8',
  ).catch(() => undefined);
  console.error(`[TopDeck upcoming pre-event visibility] ${message}`);
  process.exitCode = 1;
});
