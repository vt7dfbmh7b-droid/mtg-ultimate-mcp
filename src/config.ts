const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const config = {
  version: '0.12.0',
  port: parsePositiveInt(process.env.PORT, 3000),
  httpTimeoutMs: parsePositiveInt(process.env.HTTP_TIMEOUT_MS, 15_000),
  httpRetryAttempts: Math.max(1, Math.min(5, parsePositiveInt(process.env.HTTP_RETRY_ATTEMPTS, 3))),
  httpRetryBaseMs: Math.max(25, Math.min(5_000, parsePositiveInt(process.env.HTTP_RETRY_BASE_MS, 250))),
  scryfallApiBase: (process.env.SCRYFALL_API_BASE ?? 'https://api.scryfall.com').replace(/\/$/, ''),
  commanderSpellbookApiBase: (process.env.COMMANDER_SPELLBOOK_API_BASE ?? 'https://backend.commanderspellbook.com').replace(/\/$/, ''),
  topDeckApiBase: (process.env.TOPDECK_API_BASE ?? 'https://topdeck.gg/api').replace(/\/$/, ''),
  topDeckApiKey: process.env.TOPDECK_API_KEY?.trim() || '',
  edhTop16ApiBase: (process.env.EDHTOP16_API_BASE ?? 'https://edhtop16.com/api').replace(/\/$/, ''),
  mtgJsonApiBase: (process.env.MTGJSON_API_BASE ?? 'https://mtgjson.com/api/v5').replace(/\/$/, ''),
  preconCatalogCacheMs: parsePositiveInt(process.env.PRECON_CATALOG_CACHE_MS, 21_600_000),
  userAgent:
    process.env.MTG_USER_AGENT ??
    'mtg-ultimate-mcp/0.12 (+https://github.com/vt7dfbmh7b-droid/mtg-ultimate-mcp)',
} as const;
