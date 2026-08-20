import { resolvePrintingPolicyV08, selectEligiblePrintingV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByNames } from '../src/services/scryfall.js';
import { findDeckCombos } from '../src/services/spellbook.js';

type Probe = { label: string; cards: string[] };

const probes: Probe[] = [
  { label: 'White Mage + Ballista', cards: ['The Destined White Mage', 'Walking Ballista'] },
  { label: 'Gatta/Luzzu + Scales + Ballista', cards: ['Gatta and Luzzu', 'Hardened Scales', 'Walking Ballista'] },
  { label: 'White Mage + Ballista + Scales', cards: ['The Destined White Mage', 'Walking Ballista', 'Hardened Scales'] },
];

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function main(): Promise<void> {
  const policy = await resolvePrintingPolicyV08({
    printingFamily: 'Final Fantasy',
    includePromos: true,
    includeSpecialReleases: true,
  });

  const allNames = [...new Set(probes.flatMap((probe) => probe.cards))];
  const resolved = await getCardsByNames(allNames);
  const byName = new Map(resolved.cards.map((card) => [card.name.toLocaleLowerCase(), card]));
  console.log(`UNRESOLVED ORACLE NAMES: ${JSON.stringify(resolved.notFound)}`);

  for (const probe of probes) {
    console.log(`\n=== ${probe.label} ===`);
    const lines: string[] = [];
    let eligible = true;
    for (const name of probe.cards) {
      const oracle = byName.get(name.toLocaleLowerCase());
      if (!oracle) {
        console.log(`${name}: ORACLE NOT FOUND`);
        eligible = false;
        continue;
      }
      const printing = await selectEligiblePrintingV08(oracle, policy);
      if (!printing) {
        console.log(`${name}: NO QUALIFYING FF PRINTING`);
        eligible = false;
        continue;
      }
      console.log(`${name}: ${printing.card.set.toUpperCase()} ${printing.card.collector_number} ${printing.finish ?? 'unpriced finish'} USD=${printing.priceUsd ?? 'n/a'}`);
      lines.push(`1 ${printing.card.name} (${printing.card.set.toUpperCase()}) ${printing.card.collector_number}`);
    }
    if (!eligible) {
      console.log('PACKAGE ELIGIBLE: NO');
      continue;
    }

    const decklist = ['// COMMANDER', '1 Najeela, the Blade-Blossom', '', '// MAIN', ...lines].join('\n');
    const combos = await findDeckCombos(decklist, 50);
    const counts = record(combos.counts);
    console.log(`PACKAGE ELIGIBLE: YES`);
    console.log(`SPELLBOOK INCLUDED COUNT: ${String(counts.included ?? 0)}`);
    console.log(`SPELLBOOK INCLUDED: ${JSON.stringify(combos.included ?? [], null, 2)}`);
    console.log(`SPELLBOOK ALMOST: ${JSON.stringify(combos.almostIncluded ?? [], null, 2)}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
