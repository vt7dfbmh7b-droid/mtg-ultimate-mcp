import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { parseDecklist } from '../src/services/deck.js';
import { buildNeutralCommanderDeckV15 } from '../src/services/neutral-deck-builder-v15.js';
import {
  describePrintingPolicyV08,
  printingMatchesPolicyV08,
  resolvePrintingPolicyV08,
  selectEligiblePrintingV08,
} from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, getCardsByNames } from '../src/services/scryfall.js';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function exact(set: string, collectorNumber: string, name: string) {
  const result = await getCardsByIdentifiers([{ set, collectorNumber, name }]);
  assert.deepEqual(result.notFound, [], `${name} (${set.toUpperCase()}) ${collectorNumber} must resolve exactly`);
  assert.equal(result.cards.length, 1, `${name} (${set.toUpperCase()}) ${collectorNumber} must resolve to one printing`);
  return result.cards[0]!;
}

async function main(): Promise<void> {
  const marvel = await resolvePrintingPolicyV08({
    printingFamily: 'Marvel',
    includePromos: true,
    includeSpecialReleases: true,
  });
  const middleEarth = await resolvePrintingPolicyV08({
    printingFamily: 'Middle-earth',
    includePromos: true,
    includeSpecialReleases: true,
  });

  assert.equal(marvel.familyPreset, 'marvel');
  assert.equal(middleEarth.familyPreset, 'middle-earth');
  assert.equal(marvel.specialReleaseCoverageAsOf, '2026-08-21');
  assert.equal(middleEarth.specialReleaseCoverageAsOf, '2026-08-21');

  for (const code of ['spm', 'pspm', 'mar', 'msh', 'msc', 'lmar']) {
    assert.ok(marvel.familyMatchedSetCodes.includes(code), `Marvel family must include playable/card-bearing set ${code.toUpperCase()}`);
  }
  for (const code of ['tmsh', 'amsh', 'fmsh', 'fmsc', 'tmsc', 'aspm', 'tspm']) {
    assert.equal(marvel.familyMatchedSetCodes.includes(code), false, `Marvel family must exclude non-playable product set ${code.toUpperCase()}`);
  }
  for (const code of ['ltr', 'ltc', 'pltr', 'pltc', 'hob', 'hoc']) {
    assert.ok(middleEarth.familyMatchedSetCodes.includes(code), `Middle-earth family must include playable/card-bearing set ${code.toUpperCase()}`);
  }
  for (const code of ['thob', 'altc', 'altr', 'tltc', 'tltr', 'mltr', 'fltr']) {
    assert.equal(middleEarth.familyMatchedSetCodes.includes(code), false, `Middle-earth family must exclude non-playable product set ${code.toUpperCase()}`);
  }

  const marvelDeadlyRollick = await exact('sld', '1754', 'Deadly Rollick');
  const marvelBrainstorm = await exact('sld', '7013', 'Brainstorm');
  const unrelatedBrainstorm = await exact('sld', '1162', 'Brainstorm');
  const marvelPurchasePromo = await exact('sld', '908', 'Arcane Signet');
  const marvelCounterspell = await exact('sld', '7117', 'Counterspell');
  const middleIntent = await exact('sld', '2563', 'Diabolic Intent');
  const middleGrima = await exact('sld', '734', 'Gríma Wormtongue');
  const middlePurchasePromo = await exact('sld', '916', 'Arcane Signet');

  assert.equal(printingMatchesPolicyV08(marvelDeadlyRollick, marvel), true);
  assert.equal(printingMatchesPolicyV08(marvelBrainstorm, marvel), true);
  assert.equal(printingMatchesPolicyV08(marvelCounterspell, marvel), true);
  assert.equal(printingMatchesPolicyV08(marvelPurchasePromo, marvel), true);
  assert.equal(printingMatchesPolicyV08(unrelatedBrainstorm, marvel), false);
  assert.equal(printingMatchesPolicyV08(middleIntent, middleEarth), true);
  assert.equal(printingMatchesPolicyV08(middleGrima, middleEarth), true);
  assert.equal(printingMatchesPolicyV08(middlePurchasePromo, middleEarth), true);

  const marvelNoPromos = await resolvePrintingPolicyV08({
    printingFamily: 'Marvel',
    includePromos: false,
    includeSpecialReleases: true,
  });
  assert.equal(printingMatchesPolicyV08(marvelPurchasePromo, marvelNoPromos), false, 'Marvel purchase promo must obey includePromos=false');

  const deadlyRollickOracle = (await getCardsByNames(['Deadly Rollick'])).cards[0];
  assert.ok(deadlyRollickOracle);
  const selectedMarvelSpecial = await selectEligiblePrintingV08(deadlyRollickOracle, marvel);
  assert.ok(selectedMarvelSpecial, 'normal Marvel printing selection must find an eligible Deadly Rollick printing');
  assert.equal(selectedMarvelSpecial.card.set.toLowerCase(), 'sld');
  assert.equal(selectedMarvelSpecial.card.collector_number, '1754');

  const intentOracle = (await getCardsByNames(['Diabolic Intent'])).cards[0];
  assert.ok(intentOracle);
  const selectedMiddleSpecial = await selectEligiblePrintingV08(intentOracle, middleEarth);
  assert.ok(selectedMiddleSpecial, 'normal Middle-earth printing selection must find an eligible Diabolic Intent printing');
  assert.equal(selectedMiddleSpecial.card.set.toLowerCase(), 'sld');
  assert.equal(selectedMiddleSpecial.card.collector_number, '2563');

  const marvelBuild = await buildNeutralCommanderDeckV15(['Najeela, the Blade-Blossom'], {
    archetype: 'combat-tokens',
    printingFamily: 'Marvel',
    includePromos: true,
    includeSpecialReleases: true,
    mustInclude: ['Deadly Rollick'],
  });
  assert.equal(marvelBuild.status, 'complete-neutral-draft');
  assert.equal(marvelBuild.printingPolicySatisfied, true);
  const marvelDecklist = String(marvelBuild.decklist ?? '');
  assert.match(marvelDecklist, /1 Deadly Rollick \(SLD\) 1754/);
  assert.equal(parseDecklist(marvelDecklist).totalCards, 100);
  const marvelBuildPolicy = record(marvelBuild.printingPolicy);
  assert.equal(marvelBuildPolicy.familyPreset, 'marvel');
  assert.equal(marvelBuildPolicy.specialReleaseCoverageAsOf, '2026-08-21');

  const middleBuild = await buildNeutralCommanderDeckV15(['Sauron, the Dark Lord'], {
    archetype: 'graveyard-reanimator',
    printingFamily: 'Middle-earth',
    includePromos: true,
    includeSpecialReleases: true,
    mustInclude: ['Diabolic Intent'],
  });
  assert.equal(middleBuild.status, 'complete-neutral-draft');
  assert.equal(middleBuild.printingPolicySatisfied, true);
  const middleDecklist = String(middleBuild.decklist ?? '');
  assert.match(middleDecklist, /1 Diabolic Intent \(SLD\) 2563/);
  assert.equal(parseDecklist(middleDecklist).totalCards, 100);
  const middleBuildPolicy = record(middleBuild.printingPolicy);
  assert.equal(middleBuildPolicy.familyPreset, 'middle-earth');
  assert.equal(middleBuildPolicy.specialReleaseCoverageAsOf, '2026-08-21');

  const result = {
    schema: 'printing-family-production-proof-v15.1',
    marvel: {
      policy: describePrintingPolicyV08(marvel),
      exactSpecialChecks: {
        deadlyRollick1754: true,
        brainstorm7013: true,
        counterspell7117: true,
        purchasePromoArcaneSignet908: true,
        unrelatedBrainstorm1162Rejected: true,
      },
      selectedSpecial: {
        name: selectedMarvelSpecial.card.name,
        set: selectedMarvelSpecial.card.set.toUpperCase(),
        collectorNumber: selectedMarvelSpecial.card.collector_number,
        matchedBy: selectedMarvelSpecial.matchedBy,
      },
      build: {
        status: marvelBuild.status,
        cardCount: parseDecklist(marvelDecklist).totalCards,
        printingPolicySatisfied: marvelBuild.printingPolicySatisfied,
        mustIncludeExactLine: '1 Deadly Rollick (SLD) 1754',
      },
    },
    middleEarth: {
      policy: describePrintingPolicyV08(middleEarth),
      exactSpecialChecks: {
        diabolicIntent2563: true,
        grima734: true,
        purchasePromoArcaneSignet916: true,
      },
      selectedSpecial: {
        name: selectedMiddleSpecial.card.name,
        set: selectedMiddleSpecial.card.set.toUpperCase(),
        collectorNumber: selectedMiddleSpecial.card.collector_number,
        matchedBy: selectedMiddleSpecial.matchedBy,
      },
      build: {
        status: middleBuild.status,
        cardCount: parseDecklist(middleDecklist).totalCards,
        printingPolicySatisfied: middleBuild.printingPolicySatisfied,
        mustIncludeExactLine: '1 Diabolic Intent (SLD) 2563',
      },
    },
  };

  await writeFile('printing-family-production-proof.json', `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(async (error) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  await writeFile('printing-family-production-proof-failure.txt', `${message}\n`, 'utf8').catch(() => undefined);
  console.error(message);
  process.exitCode = 1;
});
