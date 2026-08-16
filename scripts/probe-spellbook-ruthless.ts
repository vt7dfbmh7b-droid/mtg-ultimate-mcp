import { buildCedhSeedQueriesV14 } from '../src/services/cedh-seed-package-v14.js';
import { searchSpellbookVariants } from '../src/services/spellbook.js';

async function main(): Promise<void> {
  const queries = buildCedhSeedQueriesV14(3, 'WUBRG');
  let totalReturned = 0;

  for (const query of queries) {
    const response = await searchSpellbookVariants(query, {
      limit: 8,
      offset: 0,
      ordering: '-popularity',
    });
    const results = Array.isArray(response.results) ? response.results : [];
    totalReturned += results.length;

    console.log(`\nQUERY ${query}`);
    console.log(JSON.stringify({
      totalMatching: response.count ?? null,
      returned: results.length,
      sample: results.slice(0, 3).map((entry) => {
        const variant = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry as Record<string, unknown> : {};
        return {
          id: variant.id ?? null,
          bracketTag: variant.bracketTag ?? null,
          cards: variant.cards ?? [],
          results: variant.results ?? [],
        };
      }),
    }, null, 2));
  }

  if (queries.length < 2) throw new Error('Expected compact two-card and three-card cEDH seed queries.');
  if (totalReturned < 1) throw new Error('Commander Spellbook returned no Ruthless winning seed variants through the production search helper.');
}

main().catch((error) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
