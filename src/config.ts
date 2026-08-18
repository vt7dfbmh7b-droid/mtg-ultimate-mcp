const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseOptionalPositiveFloat = (value: string | undefined): number | null => {
  if (!value?.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const clampRetryAttempts = (value: string | undefined, fallback: number): number =>
  Math.max(1, Math.min(5, parsePositiveInt(value, fallback)));

const defaultHttpRetryAttempts = clampRetryAttempts(process.env.HTTP_RETRY_ATTEMPTS, 3);

export const config = {
  version: '0.13.0',
  port: parsePositiveInt(process.env.PORT, 3000),
  httpTimeoutMs: parsePositiveInt(process.env.HTTP_TIMEOUT_MS, 15_000),
  httpRetryAttempts: defaultHttpRetryAttempts,
  httpRetryBaseMs: Math.max(25, Math.min(5_000, parsePositiveInt(process.env.HTTP_RETRY_BASE_MS, 250))),
  httpRetryMaxMs: Math.max(250, Math.min(30_000, parsePositiveInt(process.env.HTTP_RETRY_MAX_MS, 3_000))),
  scryfallHttpTimeoutMs: parsePositiveInt(process.env.SCRYFALL_HTTP_TIMEOUT_MS, 12_000),
  scryfallHttpRetryAttempts: clampRetryAttempts(process.env.SCRYFALL_HTTP_RETRY_ATTEMPTS, defaultHttpRetryAttempts),
  scryfallMinRequestGapMs: Math.max(100, Math.min(2_000, parsePositiveInt(process.env.SCRYFALL_MIN_REQUEST_GAP_MS, 300))),
  commanderSpellbookHttpTimeoutMs: parsePositiveInt(process.env.COMMANDER_SPELLBOOK_HTTP_TIMEOUT_MS, 25_000),
  commanderSpellbookHttpRetryAttempts: clampRetryAttempts(process.env.COMMANDER_SPELLBOOK_HTTP_RETRY_ATTEMPTS, 2),
  scryfallApiBase: (process.env.SCRYFALL_API_BASE ?? 'https://api.scryfall.com').replace(/\/$/, ''),
  commanderSpellbookApiBase: (process.env.COMMANDER_SPELLBOOK_API_BASE ?? 'https://backend.commanderspellbook.com').replace(/\/$/, ''),
  topDeckApiBase: (process.env.TOPDECK_API_BASE ?? 'https://topdeck.gg/api').replace(/\/$/, ''),
  topDeckApiKey: process.env.TOPDECK_API_KEY?.trim() || '',
  mtgJsonApiBase: (process.env.MTGJSON_API_BASE ?? 'https://mtgjson.com/api/v5').replace(/\/$/, ''),
  preconCatalogCacheMs: parsePositiveInt(process.env.PRECON_CATALOG_CACHE_MS, 21_600_000),
  fxApiBase: (process.env.FX_API_BASE ?? 'https://api.frankfurter.dev').replace(/\/$/, ''),
  fxCacheMs: parsePositiveInt(process.env.FX_CACHE_MS, 21_600_000),
  usdToNzdFallback: parseOptionalPositiveFloat(process.env.USD_TO_NZD_FALLBACK),
  userAgent:
    process.env.MTG_USER_AGENT ??
    'mtg-ultimate-mcp/0.13 (+https://github.com/vt7dfbmh7b-droid/mtg-ultimate-mcp)',
} as const;
