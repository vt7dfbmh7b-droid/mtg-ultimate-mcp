import { writeFileSync } from 'node:fs';
import { getUsdNzdRateV13, nzdToUsdV13, withNzdPricingV13 } from '../src/services/currency-v13.js';
import { buildCommanderDeckUnderWholeBudgetV15 } from '../src/services/deck-whole-budget-v15.js';
import { getCardsByNames } from '../src/services/scryfall.js';

async function main(): Promise<void> {
  const commanderLookupName = 'Liliana, Heretical Healer';
  const commanderName = 'Liliana, Heretical Healer // Liliana, Defiant Necromancer';
  const maxDeckNzd = 500;
  const targetBracket = 5;
  const excludedCards = [
    'Doomsday Excruciator',
    'Shared Trauma',
    'Cryptbreaker',
    'Undead Augur',
    'Dreadmalkin',
    'Hungry Ghoul',
    'Sepulcher Ghoul',
    'Headless Rider',
    'Plague Belcher',
    'Plague of Vermin',
    "Commander's Sphere",
    'Staff of Compleation',
    'Diabolic Tutor',
    'Sword of Forge and Frontier',
    "Champion's Helm",
    'Darksteel Plate',
    'Myr Retriever',
    'Scrap Trawler',
  ];
  const mustInclude = [
    'Warren Soultrader',
    'Gravecrawler',
    'Blood Artist',
    'Entomb',
    'Diabolic Intent',
    'Yawgmoth, Thran Physician',
    'Animate Dead',
    'Cabal Ritual',
    'Jet Medallion',
    'Accursed Marauder',
  ];

  const rate = await getUsdNzdRateV13();
  const maxDeckUsdReference = nzdToUsdV13(maxDeckNzd, rate.rate);
  const commanderResolution = await getCardsByNames([commanderLookupName]);
  if (commanderResolution.notFound.length > 0 || commanderResolution.cards.length !== 1) {
    throw new Error('Liliana candidate capture could not resolve the commander.');
  }

  const result = await buildCommanderDeckUnderWholeBudgetV15(commanderResolution.cards, {
    targetBracket,
    maxDeckUsd: maxDeckUsdReference,
    landCount: 30,
    excludedCards,
    mustInclude,
  });
  const nzdBuild = withNzdPricingV13(result, rate, { maxDeckNzd });
  const decklist = String(result.decklist ?? '').trim();

  writeFileSync('liliana-budget-500-result.json', `${JSON.stringify({
    capturePurpose: 'raw candidate preservation before benchmark assertions',
    commanderName,
    maxDeckNzd,
    maxDeckUsdReference,
    targetBracket,
    excludedCards,
    mustInclude,
    currencyPolicy: nzdBuild.currencyPolicy,
    build: nzdBuild,
  }, null, 2)}\n`);
  if (decklist) writeFileSync('liliana-budget-500-deck.txt', `${decklist}\n`);

  console.log(`RAW LILIANA CANDIDATE CAPTURED: status=${String(result.status)} decklist=${decklist ? 'present' : 'absent'}`);
}

main().catch((error) => {
  console.error('RAW LILIANA CANDIDATE CAPTURE: FAIL');
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
