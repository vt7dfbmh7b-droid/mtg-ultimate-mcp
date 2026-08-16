import { config } from '../src/config.js';
import { fetchJson } from '../src/lib/http.js';

async function main(): Promise<void> {
  const queries = [
    'bracket:ruthless card<=2 is:winning legal:commander',
    'bracket:ruthless card<=3 is:winning legal:commander',
    'bracket:ruthless card<=3 result:"infinite damage" legal:commander',
    'bracket:ruthless card<=3 result:"infinite combat" legal:commander',
  ];
  for (const q of queries) {
    const url = `${config.commanderSpellbookApiBase}/variants/?q=${encodeURIComponent(q)}&limit=10&offset=0&ordering=-popularity`;
    const response = await fetchJson<unknown>(url);
    console.log(`\nQUERY ${q}`);
    console.log(JSON.stringify(response, null, 2));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
