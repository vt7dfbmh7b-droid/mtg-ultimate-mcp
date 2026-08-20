import { config } from '../config.js';
import { fetchJson } from '../lib/http.js';

export interface UsdNzdRateV13 {
  base: 'USD';
  quote: 'NZD';
  rate: number;
  rateDate: string;
  fetchedAt: string;
  source: 'Frankfurter' | 'configured-fallback' | 'cached-stale';
  sourceUrl: string;
  stale: boolean;
}

interface FrankfurterRateResponseV13 {
  date?: string;
  base?: string;
  quote?: string;
  rate?: number;
}

interface RateCacheV13 {
  loadedAt: number;
  rate: UsdNzdRateV13;
}

let rateCache: RateCacheV13 | null = null;

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

export function usdToNzdV13(usd: number, rate: number): number {
  if (!Number.isFinite(usd) || !Number.isFinite(rate) || rate <= 0) throw new Error('USD and USD→NZD rate must be finite positive values.');
  return roundMoney(usd * rate);
}

export function nzdToUsdV13(nzd: number, rate: number): number {
  if (!Number.isFinite(nzd) || !Number.isFinite(rate) || rate <= 0) throw new Error('NZD and USD→NZD rate must be finite positive values.');
  return roundMoney(nzd / rate);
}

export function formatNzdV13(value: number): string {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function fallbackRate(): UsdNzdRateV13 | null {
  const rate = config.usdToNzdFallback;
  if (rate === null) return null;
  const now = new Date().toISOString();
  return {
    base: 'USD',
    quote: 'NZD',
    rate,
    rateDate: now.slice(0, 10),
    fetchedAt: now,
    source: 'configured-fallback',
    sourceUrl: 'environment:USD_TO_NZD_FALLBACK',
    stale: true,
  };
}

export async function getUsdNzdRateV13(forceRefresh = false): Promise<UsdNzdRateV13> {
  const now = Date.now();
  if (!forceRefresh && rateCache && now - rateCache.loadedAt < config.fxCacheMs) return rateCache.rate;

  const sourceUrl = `${config.fxApiBase}/v2/rate/USD/NZD`;
  try {
    const response = await fetchJson<FrankfurterRateResponseV13>(sourceUrl);
    const rate = response.rate;
    if (!Number.isFinite(rate) || Number(rate) <= 0) throw new Error('FX provider returned an invalid USD/NZD rate.');
    const fetchedAt = new Date().toISOString();
    const resolved: UsdNzdRateV13 = {
      base: 'USD',
      quote: 'NZD',
      rate: Number(rate),
      rateDate: typeof response.date === 'string' && response.date ? response.date : fetchedAt.slice(0, 10),
      fetchedAt,
      source: 'Frankfurter',
      sourceUrl,
      stale: false,
    };
    rateCache = { loadedAt: now, rate: resolved };
    return resolved;
  } catch (error) {
    if (rateCache) {
      return {
        ...rateCache.rate,
        source: 'cached-stale',
        stale: true,
      };
    }
    const fallback = fallbackRate();
    if (fallback) return fallback;
    throw new Error(`NZD conversion is unavailable and no fallback rate is configured: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nzdKeyForUsdKey(key: string): string | null {
  if (!key.includes('Usd')) return null;
  return key.replace('Usd', 'Nzd');
}

/**
 * Convert user-facing USD monetary fields emitted by legacy/internal services into NZD-first fields.
 * The original number remains available with a `Reference` suffix for traceability to Scryfall/USD sources.
 */
export function annotatePricingNzdV13(value: unknown, rate: number): unknown {
  if (Array.isArray(value)) return value.map((entry) => annotatePricingNzdV13(entry, rate));
  if (!isRecord(value)) return value;

  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    const nzdKey = nzdKeyForUsdKey(key);
    if (nzdKey && (typeof raw === 'number' || raw === null)) {
      output[nzdKey] = typeof raw === 'number' && Number.isFinite(raw) ? usdToNzdV13(raw, rate) : raw;
      output[`${key}Reference`] = raw;
      continue;
    }
    output[key] = annotatePricingNzdV13(raw, rate);
  }
  return output;
}

export function nzCurrencyPolicyV13(rate: UsdNzdRateV13): Record<string, unknown> {
  return {
    primaryCurrency: 'NZD',
    displaySymbol: 'NZ$',
    usdToNzdRate: rate.rate,
    rateDate: rate.rateDate,
    rateSource: rate.source,
    rateSourceUrl: rate.sourceUrl,
    staleRate: rate.stale,
    localPricePriority: [
      'Use a directly checked New Zealand seller/TCGfind NZ price when one is available for the exact printing.',
      'Otherwise show the Scryfall USD printing reference converted to NZD with this FX rate.',
      'Converted reference prices are estimates, not guaranteed New Zealand checkout prices or landed costs.',
    ],
  };
}

export function withNzdPricingV13(value: unknown, rate: UsdNzdRateV13, requestedBudgets: Record<string, unknown> = {}): Record<string, unknown> {
  const converted = annotatePricingNzdV13(value, rate.rate);
  return {
    currency: 'NZD',
    currencyPolicy: nzCurrencyPolicyV13(rate),
    requestedBudgets,
    result: converted,
  };
}
