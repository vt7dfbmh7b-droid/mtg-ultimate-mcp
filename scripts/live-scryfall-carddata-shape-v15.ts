import { config } from '../src/config.js';

async function main(): Promise<void> {
  const response = await fetch(`${config.scryfallApiBase}/bulk-data`, {
    method: 'GET',
    headers: {
      'User-Agent': config.userAgent,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Scryfall bulk manifest returned HTTP ${response.status} ${response.statusText}.`);
  const payload = await response.json() as unknown;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Scryfall bulk manifest root is not an object.');
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.data)) throw new Error('Scryfall bulk manifest data is not an array.');
  const entry = record.data.find((value) => value && typeof value === 'object' && !Array.isArray(value) && (value as Record<string, unknown>).type === 'default_cards');
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Scryfall bulk manifest has no default_cards entry.');
  const defaultCards = entry as Record<string, unknown>;
  const safeShape = {
    schemaVersion: 'scryfall-carddata-shape-probe-v15.1',
    rootKeys: Object.keys(record).sort(),
    defaultCardsKeys: Object.keys(defaultCards).sort(),
    uriFields: Object.fromEntries(
      Object.entries(defaultCards)
        .filter(([key, value]) => /uri|url|download/i.test(key) && typeof value === 'string')
        .map(([key, value]) => {
          const parsed = new URL(value as string);
          return [key, { protocol: parsed.protocol, hostname: parsed.hostname, pathname: parsed.pathname, search: parsed.search }];
        }),
    ),
  };
  console.log(JSON.stringify(safeShape, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
