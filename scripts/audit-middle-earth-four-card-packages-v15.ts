import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { discoverGeneralWinPackagesV15 } from '../src/services/general-win-package-v15.js';
import { neutralCommanderLookupNameV15 } from '../src/services/neutral-deck-builder-v15.js';
import { resolvePrintingPolicyV08, selectEligiblePrintingV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByNames } from '../src/services/scryfall.js';
import type { ScryfallCard } from '../src/types/scryfall.js';

const SETS = ['LTR', 'LTC', 'HOB', 'HOC'] as const;
const CANDIDATES: Array<{ label: string; commanderNames: string[] }> = [
  { label: 'Tom Bombadil', commanderNames: ['Tom Bombadil'] },
  { label: 'Aragorn, the Uniter', commanderNames: ['Aragorn, the Uniter'] },
  { label: 'Sauron, the Dark Lord', commanderNames: ['Sauron, the Dark Lord'] },
  { label: 'Frodo + Sam', commanderNames: ['Frodo, Adventurous Hobbit', 'Sam, Loyal Attendant'] },
  { label: 'Galadriel, Light of Valinor', commanderNames: ['Galadriel, Light of Valinor'] },
  { label: 'Éowyn, Shieldmaiden', commanderNames: ['Éowyn, Shieldmaiden'] },
  { label: 'Bilbo, Birthday Celebrant', commanderNames: ['Bilbo, Birthday Celebrant'] },
  { label: 'Saruman of Many Colors', commanderNames: ['Saruman of Many Colors'] },
  { label: 'Bilbo, Luckwearer // Burglar\'s Plot', commanderNames: ['Bilbo, Luckwearer // Burglar\'s Plot'] },
  { label: 'Denethor, Ruling Steward', commanderNames: ['Denethor, Ruling Steward'] },
  { label: 'Sauron, Lord of the Rings', commanderNames: ['Sauron, Lord of the Rings'] },
  { label: 'Gandalf the Grey', commanderNames: ['Gandalf the Grey'] },
];

async function resolveCommanders(names: string[]): Promise<ScryfallCard[]> {
  const policy = await resolvePrintingPolicyV08({ allowedSets: [...SETS], includePromos: true, includeSpecialReleases: true });
  const lookupNames = names.map(neutralCommanderLookupNameV15);
  const lookup = await getCardsByNames(lookupNames);
  assert.deepEqual(lookup.notFound, [], `commander lookup failed for ${names.join(' + ')}`);
  const output: ScryfallCard[] = [];
  for (const requested of names) {
    const normalized = neutralCommanderLookupNameV15(requested).toLocaleLowerCase();
    const oracle = lookup.cards.find((card) => neutralCommanderLookupNameV15(card.name).toLocaleLowerCase() === normalized);
    assert.ok(oracle, `${requested} did not bind to Oracle data`);
    const printing = await selectEligiblePrintingV08(oracle, policy);
    assert.ok(printing, `${requested} has no eligible Middle-earth printing`);
    output.push(printing.card);
  }
  return output;
}

async function main(): Promise<void> {
  const results: Array<Record<string, unknown>> = [];
  for (const candidate of CANDIDATES) {
    console.log(`AUDIT ${candidate.label}`);
    try {
      const commanders = await resolveCommanders(candidate.commanderNames);
      const discovery = await discoverGeneralWinPackagesV15(commanders, {
        allowedSets: [...SETS],
        includePromos: true,
        includeSpecialReleases: true,
        maxPackageCards: 4,
        maxCandidatesToVerify: 20,
      });
      results.push({
        candidate: candidate.label,
        commanderNames: commanders.map((card) => card.name),
        colorIdentity: [...new Set(commanders.flatMap((card) => card.color_identity))].sort(),
        status: discovery.status,
        sourceCompleteness: discovery.sourceCompleteness,
        selected: discovery.selected,
        candidates: discovery.candidates,
        portfolio: discovery.portfolio,
        queryAudit: discovery.queryAudit,
        rejectionAudit: discovery.rejectionAudit,
      });
      console.log(`${candidate.label}: ${discovery.status}; verified=${discovery.candidates.length}; selected=${discovery.selected?.comboId ?? 'none'}`);
    } catch (error) {
      results.push({ candidate: candidate.label, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const withPackages = results.filter((item) => Array.isArray(item.candidates) && item.candidates.length > 0);
  await writeFile('middle-earth-four-card-package-audit.json', `${JSON.stringify({
    schema: 'middle-earth-four-card-package-audit-v15.1',
    allowedSets: [...SETS],
    maxPackageCards: 4,
    commandersAudited: CANDIDATES.length,
    commandersWithVerifiedPackages: withPackages.length,
    results,
  }, null, 2)}\n`);
  console.log(`COMMANDERS WITH VERIFIED <=4-CARD WIN PACKAGES: ${withPackages.length}`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(message);
  await writeFile('middle-earth-four-card-package-audit-failure.txt', `${message}\n`).catch(() => undefined);
  process.exitCode = 1;
});
