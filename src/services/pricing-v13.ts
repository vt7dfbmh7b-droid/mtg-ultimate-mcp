import { formatNzdV13, getUsdNzdRateV13, usdToNzdV13 } from './currency-v13.js';
import { lookupCard, lookupPrinting } from './scryfall.js';

export type PriceFinishV13 = 'nonfoil' | 'foil' | 'etched';

function parsePrice(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function priceCardNzdV13(options: {
  cardName?: string | undefined;
  set?: string | undefined;
  collectorNumber?: string | undefined;
}): Promise<Record<string, unknown>> {
  const card = options.set?.trim() && options.collectorNumber?.trim()
    ? await lookupPrinting(options.set, options.collectorNumber)
    : options.cardName?.trim()
      ? await lookupCard(options.cardName, false, options.set)
      : null;
  if (!card) throw new Error('Provide a card name or an exact set + collector number.');

  const rate = await getUsdNzdRateV13();
  const raw: Array<{ finish: PriceFinishV13; usd: number | null }> = [
    { finish: 'nonfoil', usd: parsePrice(card.prices?.usd) },
    { finish: 'foil', usd: parsePrice(card.prices?.usd_foil) },
    { finish: 'etched', usd: parsePrice(card.prices?.usd_etched) },
  ];
  const prices = raw
    .filter((entry) => entry.usd !== null)
    .map((entry) => {
      const nzd = usdToNzdV13(entry.usd as number, rate.rate);
      return {
        finish: entry.finish,
        priceNzd: nzd,
        displayPrice: formatNzdV13(nzd),
        priceUsdReference: entry.usd,
      };
    });

  return {
    currency: 'NZD',
    card: {
      name: card.name,
      set: card.set.toUpperCase(),
      setName: card.set_name,
      collectorNumber: card.collector_number,
      promo: Boolean(card.promo),
      finishes: card.finishes ?? [],
    },
    prices,
    fx: {
      usdToNzdRate: rate.rate,
      rateDate: rate.rateDate,
      source: rate.source,
      stale: rate.stale,
    },
    nzLocalPrice: {
      priority: 'preferred-when-directly-checked',
      source: 'TCGfind NZ / New Zealand retailer',
      query: card.name,
      note: 'A directly checked NZ listing for this exact printing should take priority over the converted Scryfall reference price.',
    },
    referencePriceNote: 'NZD values here are converted from Scryfall USD printing references. They are estimates and do not include NZ shipping or retailer-specific pricing.',
  };
}
