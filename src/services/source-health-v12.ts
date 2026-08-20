import { config } from '../config.js';
import { fetchJson, HttpError } from '../lib/http.js';

export type SourceHealthStateV12 = 'healthy' | 'degraded' | 'not-configured' | 'reference-only';

export interface SourceHealthCheckV12 {
  id: string;
  name: string;
  state: SourceHealthStateV12;
  configured: boolean;
  checkedLive: boolean;
  latencyMs: number | null;
  detail: string;
  statusCode?: number;
}

async function timedProbe(
  id: string,
  name: string,
  probe: () => Promise<unknown>,
  configured = true,
): Promise<SourceHealthCheckV12> {
  if (!configured) {
    return {
      id,
      name,
      state: 'not-configured',
      configured: false,
      checkedLive: false,
      latencyMs: null,
      detail: 'This structured source requires configuration before it can be queried.',
    };
  }
  const started = Date.now();
  try {
    await probe();
    return {
      id,
      name,
      state: 'healthy',
      configured: true,
      checkedLive: true,
      latencyMs: Date.now() - started,
      detail: 'Live probe completed successfully.',
    };
  } catch (error) {
    return {
      id,
      name,
      state: 'degraded',
      configured: true,
      checkedLive: true,
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error),
      ...(error instanceof HttpError ? { statusCode: error.status } : {}),
    };
  }
}

function referenceOnly(id: string, name: string, detail: string): SourceHealthCheckV12 {
  return {
    id,
    name,
    state: 'reference-only',
    configured: true,
    checkedLive: false,
    latencyMs: null,
    detail,
  };
}

export async function sourceHealthDiagnosticsV12(options: {
  includeReferenceSources?: boolean;
} = {}): Promise<Record<string, unknown>> {
  const checks: SourceHealthCheckV12[] = await Promise.all([
    timedProbe(
      'scryfall',
      'Scryfall',
      () => fetchJson(`${config.scryfallApiBase}/cards/named?exact=${encodeURIComponent('Sol Ring')}`),
    ),
    timedProbe(
      'commander-spellbook',
      'Commander Spellbook',
      () => fetchJson(`${config.commanderSpellbookApiBase}/variants/?limit=1`),
    ),
    timedProbe(
      'mtgjson',
      'MTGJSON',
      () => fetchJson(`${config.mtgJsonApiBase}/Meta.json`),
    ),
    timedProbe(
      'topdeck',
      'TopDeck.gg',
      () => fetchJson(`${config.topDeckApiBase}/v2/tournaments`, {
        method: 'POST',
        headers: {
          Authorization: config.topDeckApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          game: 'Magic: The Gathering',
          format: 'EDH',
          last: 1,
          participantMin: 500,
          columns: ['name'],
        }),
      }),
      Boolean(config.topDeckApiKey),
    ),
  ]);

  // EDHTop16 remains useful as an attributed competitive reference. August 2026
  // live tests found its legacy filtered POST routes redirecting to website HTML,
  // so it is intentionally not counted as a healthy/degraded structured dependency.
  checks.push(referenceOnly(
    'edhtop16',
    'EDHTop16',
    'Public competitive-reference source. The legacy filtered POST API is not treated as a current structured dependency because live tests returned website HTML instead of JSON.',
  ));

  if (options.includeReferenceSources ?? true) {
    checks.push(
      referenceOnly('wizards', 'Wizards of the Coast', 'Used as an official rules/product reference rather than a health-dependent structured deck API.'),
      referenceOnly('edhrec', 'EDHREC', 'Used as attributed community/reference evidence; V0.12 does not depend on an undocumented private API.'),
      referenceOnly('moxfield', 'Moxfield', 'Used as an attributed deck/primer reference unless a stable supported integration is explicitly added.'),
      referenceOnly('deckcheck', 'DeckCheck', 'Used as an independent analysis reference rather than a required backend dependency.'),
      referenceOnly('tcgfind-nz', 'TCGfind NZ', 'Used for NZ price/availability reference work; exact live inventory should be verified at query/purchase time.'),
    );
  }

  const live = checks.filter((check) => check.checkedLive);
  const healthy = live.filter((check) => check.state === 'healthy').length;
  const degraded = live.filter((check) => check.state === 'degraded').length;
  const notConfigured = checks.filter((check) => check.state === 'not-configured').length;

  return {
    status: degraded === 0 ? 'healthy' : healthy > 0 ? 'partially-degraded' : 'degraded',
    checkedAt: new Date().toISOString(),
    summary: {
      liveSourcesChecked: live.length,
      healthy,
      degraded,
      notConfigured,
      referenceOnly: checks.filter((check) => check.state === 'reference-only').length,
    },
    sources: checks,
    retryPolicy: {
      safeReadRetries: config.httpRetryAttempts,
      baseDelayMs: config.httpRetryBaseMs,
      note: 'Shared HTTP retries apply only to safe GET/HEAD requests. Read-oriented POST APIs are probed once so diagnostics do not hide repeated endpoint failures.',
    },
    guidance: 'A degraded structured source should reduce confidence or trigger a fallback; a reference-only source should be used as attributed context rather than fabricated structured data. Rules/legality and exact printing claims should remain grounded in the authoritative source class available for that claim.',
  };
}
