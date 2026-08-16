import { config } from '../src/config.js';
import { fetchJson } from '../src/lib/http.js';

async function main(): Promise<void> {
  const queries = [
    'bracket:ruthless cards<=3 result:"infinite damage" legal:commander',
    'bracket:ruthless cards<=3 result:"win the game" legal:commander',
    'bracket:ruthless cards<=3 result:"infinite combat" legal:commander',
    'bracket:ruthless cards<=3 result:"infinite mill" legal:commander',
  ];
  for (const q of queries) {
    const url = `${config.commanderSpellbookApiBase}/variants/?q=${encodeURIComponent(q)}&limit=5&offset=0&ordering=-popularity`;
    const response = await fetchJson<unknown>(url);
    console.log(`\nQUERY ${q}`);
    console.log(JSON.stringify(response, null, 2));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
