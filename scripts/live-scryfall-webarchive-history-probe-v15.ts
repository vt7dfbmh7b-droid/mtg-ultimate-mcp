import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const RESULT_PATH = 'scryfall-webarchive-history-probe-result.json';
const FAILURE_PATH = 'scryfall-webarchive-history-probe-failure.txt';
const USER_AGENT = 'mtg-ultimate-mcp/0.13 historical-provenance research (bounded metadata probe)';
const MANIFEST_URL = 'https://api.scryfall.com/bulk-data';
const FROM = '20260701';
const TO = '20260820';
const MAX_MANIFEST_SAMPLES = 12;

interface CdxRow {
  timestamp: string;
  original: string;
  digest: string;
  statuscode: string;
  mimetype: string;
  length: string;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function fetchJson(url: string, timeoutMs = 20_000): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}.`);
  }
  return response.json();
}

function cdxUrl(target: string, options: { from?: string; to?: string; limit?: number } = {}): string {
  const query = new URLSearchParams({
    url: target,
    output: 'json',
    fl: 'timestamp,original,digest,statuscode,mimetype,length',
    filter: 'statuscode:200',
    collapse: 'digest',
    ...(options.from ? { from: options.from } : {}),
    ...(options.to ? { to: options.to } : {}),
    ...(options.limit ? { limit: String(options.limit) } : {}),
  });
  return `https://web.archive.org/cdx/search/cdx?${query.toString()}`;
}

function parseCdx(value: unknown): CdxRow[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  const rows = value as unknown[][];
  const header = rows[0];
  if (!Array.isArray(header)) throw new Error('Wayback CDX header is malformed.');
  const expected = ['timestamp', 'original', 'digest', 'statuscode', 'mimetype', 'length'];
  requireCondition(expected.every((name, index) => header[index] === name), 'Wayback CDX returned an unexpected column contract.');
  return rows.slice(1).map((row) => {
    if (!Array.isArray(row) || row.length < expected.length) throw new Error('Wayback CDX returned a malformed row.');
    return {
      timestamp: String(row[0]),
      original: String(row[1]),
      digest: String(row[2]),
      statuscode: String(row[3]),
      mimetype: String(row[4]),
      length: String(row[5]),
    };
  });
}

function evenlySample<T>(values: T[], maximum: number): T[] {
  if (values.length <= maximum) return [...values];
  if (maximum <= 1) return [values[values.length - 1]!];
  const sampled: T[] = [];
  for (let index = 0; index < maximum; index += 1) {
    const position = Math.round((index * (values.length - 1)) / (maximum - 1));
    const value = values[position];
    if (value !== undefined && !sampled.includes(value)) sampled.push(value);
  }
  return sampled;
}

function defaultCardsEntry(manifest: unknown): Record<string, unknown> | null {
  const object = manifest && typeof manifest === 'object' && !Array.isArray(manifest)
    ? manifest as Record<string, unknown>
    : null;
  const data = object?.data;
  if (!Array.isArray(data)) return null;
  const matches = data.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
    && (entry as Record<string, unknown>).type === 'default_cards');
  if (matches.length !== 1) return null;
  return matches[0] as Record<string, unknown>;
}

function downloadUri(entry: Record<string, unknown>): string | null {
  for (const key of ['jsonl_download_uri', 'download_uri']) {
    const value = entry[key];
    if (typeof value === 'string' && value.startsWith('https://')) return value;
  }
  return null;
}

function safeHost(value: string): string {
  try {
    return new URL(value).hostname.toLocaleLowerCase();
  } catch {
    return 'invalid';
  }
}

async function main(): Promise<void> {
  const manifestCdx = parseCdx(await fetchJson(cdxUrl(MANIFEST_URL, { from: FROM, to: TO })));
  const samples = evenlySample(manifestCdx, MAX_MANIFEST_SAMPLES);
  const sampledResults: Array<{
    manifestTimestamp: string;
    manifestDigest: string;
    archivedManifestParsed: boolean;
    defaultCardsFound: boolean;
    defaultCardsFields: string[];
    downloadHost: string | null;
    downloadUriHash: string | null;
    archivedPayloadCaptures: number;
    archivedPayloadDigests: string[];
    archivedPayloadEarliest: string | null;
    archivedPayloadLatest: string | null;
  }> = [];

  for (const row of samples) {
    let manifest: unknown;
    try {
      manifest = await fetchJson(`https://web.archive.org/web/${encodeURIComponent(row.timestamp)}id_/${MANIFEST_URL}`);
    } catch {
      sampledResults.push({
        manifestTimestamp: row.timestamp,
        manifestDigest: row.digest,
        archivedManifestParsed: false,
        defaultCardsFound: false,
        defaultCardsFields: [],
        downloadHost: null,
        downloadUriHash: null,
        archivedPayloadCaptures: 0,
        archivedPayloadDigests: [],
        archivedPayloadEarliest: null,
        archivedPayloadLatest: null,
      });
      continue;
    }

    const entry = defaultCardsEntry(manifest);
    const uri = entry ? downloadUri(entry) : null;
    let payloadRows: CdxRow[] = [];
    if (uri) {
      try {
        payloadRows = parseCdx(await fetchJson(cdxUrl(uri, { limit: 20 })));
      } catch {
        payloadRows = [];
      }
    }
    const timestamps = payloadRows.map((payload) => payload.timestamp).sort();
    sampledResults.push({
      manifestTimestamp: row.timestamp,
      manifestDigest: row.digest,
      archivedManifestParsed: true,
      defaultCardsFound: Boolean(entry),
      defaultCardsFields: entry ? Object.keys(entry).sort() : [],
      downloadHost: uri ? safeHost(uri) : null,
      downloadUriHash: uri ? sha256(uri) : null,
      archivedPayloadCaptures: payloadRows.length,
      archivedPayloadDigests: [...new Set(payloadRows.map((payload) => payload.digest))].sort(),
      archivedPayloadEarliest: timestamps[0] ?? null,
      archivedPayloadLatest: timestamps[timestamps.length - 1] ?? null,
    });
  }

  const parseable = sampledResults.filter((entry) => entry.archivedManifestParsed);
  const withDefaultCards = sampledResults.filter((entry) => entry.defaultCardsFound);
  const withArchivedPayload = sampledResults.filter((entry) => entry.archivedPayloadCaptures > 0);
  const manifestTimestamps = manifestCdx.map((row) => row.timestamp).sort();
  const audit = {
    schemaVersion: 'scryfall-webarchive-history-probe-v15.1',
    checkedAt: new Date().toISOString(),
    targetHistoricalWindow: {
      from: FROM,
      to: TO,
      reason: 'Covers the July-August 2026 TopDeck candidate window already observed by the project.',
    },
    manifestIndex: {
      target: MANIFEST_URL,
      captures: manifestCdx.length,
      uniqueDigests: new Set(manifestCdx.map((row) => row.digest)).size,
      earliest: manifestTimestamps[0] ?? null,
      latest: manifestTimestamps[manifestTimestamps.length - 1] ?? null,
    },
    sampleAudit: {
      requestedMaximum: MAX_MANIFEST_SAMPLES,
      sampled: sampledResults.length,
      archivedManifestsParsed: parseable.length,
      defaultCardsEntriesFound: withDefaultCards.length,
      samplesWithArchivedDefaultCardsPayload: withArchivedPayload.length,
      samplesWithoutArchivedPayload: sampledResults.length - withArchivedPayload.length,
    },
    samples: sampledResults,
    interpretation: manifestCdx.length === 0
      ? 'The Wayback CDX index returned no archived Scryfall bulk-data manifests in the target window.'
      : withArchivedPayload.length > 0
        ? 'At least one archived Scryfall manifest sample also has archived default_cards payload evidence. This route merits a strict historical replay adapter.'
        : 'Archived Scryfall bulk-data manifests exist, but sampled default_cards payload URLs were not themselves found in the Wayback CDX index.',
    safeguards: {
      bulkPayloadDownloaded: false,
      scryfallLiveBulkDownloaded: false,
      archivePayloadDownloaded: false,
      manifestSamplesMaximum: MAX_MANIFEST_SAMPLES,
      cdxMetadataOnlyForBulkPayloads: true,
      providerSecretsUsed: false,
    },
  } as const;

  await writeFile(RESULT_PATH, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(audit, null, 2));
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  await writeFile(
    FAILURE_PATH,
    `${JSON.stringify({ schemaVersion: 'scryfall-webarchive-history-probe-failure-v15.1', message }, null, 2)}\n`,
    'utf8',
  ).catch(() => undefined);
  console.error(`[Scryfall web-archive history probe] ${message}`);
  process.exitCode = 1;
});
