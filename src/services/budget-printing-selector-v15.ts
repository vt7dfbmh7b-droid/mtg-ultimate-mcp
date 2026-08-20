import type { ScryfallCard, ScryfallList } from '../types/scryfall.js';
import { exactPrintingBudgetWitnessV15 } from './exact-printing-budget-v15.js';
import {
  printingMatchesPolicyV08,
  printingMatchReasonV08,
  type EligiblePrintingChoiceV08,
  type ResolvedPrintingPolicyV08,
} from './printing-policy-v08.js';
import { boundedScryfallSearchV15 } from './scryfall-paged-search-v15.js';

function escapeExactName(name: string): string {
  return name.trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Exact-printing budget selector for hard constraints. Unlike the legacy fast selector,
 * this exhausts physical printings inside explicit safety ceilings so very deeply printed
 * cards (notably basic lands) do not produce a false "no affordable printing" result.
 */
export async function selectBudgetEligiblePrintingV15(
  card: ScryfallCard,
  policy: ResolvedPrintingPolicyV08,
  maxUsdPerCard: number,
  options: {
    maxPrintings?: number;
    maxPages?: number;
    minRequestGapMs?: number;
    requestPage?: (url: string) => Promise<ScryfallList<ScryfallCard>>;
  } = {},
): Promise<EligiblePrintingChoiceV08 | null> {
  if (!Number.isFinite(maxUsdPerCard) || maxUsdPerCard <= 0) {
    throw new Error('maxUsdPerCard must be positive and finite for exact budget printing selection.');
  }
  const result = await boundedScryfallSearchV15(`!"${escapeExactName(card.name)}" game:paper`, {
    maxCards: options.maxPrintings ?? 2_000,
    maxPages: options.maxPages ?? 50,
    minRequestGapMs: options.minRequestGapMs ?? 300,
    unique: 'prints',
    ...(options.requestPage ? { requestPage: options.requestPage } : {}),
  });
  const choices = result.cards
    .filter((printing) => printing.name.toLocaleLowerCase() === card.name.toLocaleLowerCase())
    .filter((printing) => printingMatchesPolicyV08(printing, policy))
    .flatMap((printing) => {
      const witness = exactPrintingBudgetWitnessV15(printing, maxUsdPerCard);
      return witness.status === 'within-cap' && witness.finish && witness.priceUsd !== null
        ? [{
            card: printing,
            finish: witness.finish,
            priceUsd: witness.priceUsd,
            matchedBy: printingMatchReasonV08(printing, policy) ?? 'unrestricted',
          } satisfies EligiblePrintingChoiceV08]
        : [];
    })
    .sort((a, b) =>
      (a.priceUsd ?? Number.POSITIVE_INFINITY) - (b.priceUsd ?? Number.POSITIVE_INFINITY)
      || (b.card.released_at ?? '').localeCompare(a.card.released_at ?? '')
      || `${a.card.set}|${a.card.collector_number}`.localeCompare(`${b.card.set}|${b.card.collector_number}`));
  return choices[0] ?? null;
}
