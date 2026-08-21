export interface BoundedSpellbookVariantSearchV15 {
  query: string;
  rows: unknown[];
  totalMatching: number | null;
  pagesFetched: number;
  rowsFetched: number;
  exhausted: boolean;
  truncated: boolean;
  sourceStatus: 'available' | 'partial' | 'unavailable';
  verificationComplete: boolean;
  sourceFailure: unknown | null;
}

export interface BoundedSpellbookVariantSearchOptionsV15 {
  pageSize?: number;
  maxRows?: number;
  ordering?: string;
}

type SpellbookPageFetcherV15 = (
  query: string,
  options: { limit: number; offset: number; ordering: string },
) => Promise<Record<string, unknown>>;

/**
 * Collect a bounded, paginated Spellbook search without turning a scan cap or later-page outage
 * into false proof of absence. Positive rows from completed pages remain usable evidence, while
 * verificationComplete is true only when the provider result set was actually exhausted.
 */
export async function collectBoundedSpellbookVariantsV15(
  query: string,
  fetchPage: SpellbookPageFetcherV15,
  options: BoundedSpellbookVariantSearchOptionsV15 = {},
): Promise<BoundedSpellbookVariantSearchV15> {
  const pageSize = Math.max(1, Math.min(100, Math.trunc(options.pageSize ?? 100)));
  const maxRows = Math.max(pageSize, Math.min(2_000, Math.trunc(options.maxRows ?? 400)));
  const ordering = options.ordering?.trim() || '-popularity';
  const rows: unknown[] = [];
  let totalMatching: number | null = null;
  let pagesFetched = 0;
  let exhausted = false;
  let sourceFailure: unknown | null = null;

  while (rows.length < maxRows && !exhausted) {
    const limit = Math.min(pageSize, maxRows - rows.length);
    const offset = rows.length;
    const page = await fetchPage(query, { limit, offset, ordering });
    pagesFetched += 1;
    const pageRows = Array.isArray(page.results) ? page.results : [];
    const pageAvailable = page.sourceStatus === 'available' && page.verificationComplete === true;
    if (!pageAvailable) {
      sourceFailure = page.sourceFailure ?? null;
      break;
    }

    if (typeof page.count === 'number' && Number.isFinite(page.count)) {
      totalMatching = Math.max(0, Math.trunc(page.count));
    }
    rows.push(...pageRows);

    if (pageRows.length === 0 || pageRows.length < limit) {
      exhausted = true;
    } else if (totalMatching !== null && rows.length >= totalMatching) {
      exhausted = true;
    }
  }

  const truncated = !exhausted && rows.length >= maxRows;
  const verificationComplete = exhausted && sourceFailure === null;
  const sourceStatus: BoundedSpellbookVariantSearchV15['sourceStatus'] = verificationComplete
    ? 'available'
    : rows.length > 0
      ? 'partial'
      : 'unavailable';

  return {
    query,
    rows,
    totalMatching,
    pagesFetched,
    rowsFetched: rows.length,
    exhausted,
    truncated,
    sourceStatus,
    verificationComplete,
    sourceFailure,
  };
}
