const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const config = {
  port: parsePositiveInt(process.env.PORT, 3000),
  httpTimeoutMs: parsePositiveInt(process.env.HTTP_TIMEOUT_MS, 15_000),
  scryfallApiBase: (process.env.SCRYFALL_API_BASE ?? 'https://api.scryfall.com').replace(/\/$/, ''),
  commanderSpellbookApiBase: (process.env.COMMANDER_SPELLBOOK_API_BASE ?? 'https://backend.commanderspellbook.com').replace(/\/$/, ''),
  topDeckApiBase: (process.env.TOPDECK_API_BASE ?? 'https://topdeck.gg/api').replace(/\/$/, ''),
  topDeckApiKey: process.env.TOPDECK_API_KEY?.trim() || '',
  userAgent:
    process.env.MTG_USER_AGENT ??
    'mtg-ultimate-mcp/0.2 (+https://github.com/vt7dfbmh7b-droid/mtg-ultimate-mcp)',
} as const;
