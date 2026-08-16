import assert from 'node:assert/strict';
import { buildDeepResearchPlanV15 } from '../src/services/research-learning-v15.js';
import { discoverCedhSeedWinPackageV14 } from '../src/services/cedh-seed-package-v14.js';
import { getCardsByNames } from '../src/services/scryfall.js';
import { sourceHealthDiagnosticsV12 } from '../src/services/source-health-v12.js';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function main(): Promise<void> {
  console.log('V0.15 LIVE RESEARCH: checking structured source health...');
  const health = await sourceHealthDiagnosticsV12({ includeReferenceSources: false });
  const sources = Array.isArray(health.sources) ? health.sources.map(record) : [];
  for (const required of ['scryfall', 'commander-spellbook', 'mtgjson']) {
    const source = sources.find((entry) => entry.id === required);
    assert.ok(source, `${required} must appear in live source diagnostics`);
    assert.equal(source.state, 'healthy', `${required} must answer the live probe`);
  }

  console.log('V0.15 LIVE RESEARCH: resolving unrestricted cEDH control commander...');
  const commanderLookup = await getCardsByNames(['Kinnan, Bonder Prodigy']);
  assert.deepEqual(commanderLookup.notFound, []);
  assert.equal(commanderLookup.cards.length, 1);
  const commander = commanderLookup.cards[0];
  assert.ok(commander);
  assert.equal(commander.name, 'Kinnan, Bonder Prodigy');
  assert.equal(commander.legalities.commander, 'legal');
  assert.deepEqual([...commander.color_identity].sort(), ['G', 'U']);

  console.log('V0.15 LIVE RESEARCH: checking evidence-class research plan...');
  const plan = buildDeepResearchPlanV15(['competitive', 'decklists', 'combos']);
  assert.ok(plan.evidenceClasses.includes('observed-results'));
  assert.ok(plan.evidenceClasses.includes('curated'));
  assert.ok(plan.evidenceClasses.includes('community'));

  console.log('V0.15 LIVE RESEARCH: discovering a real unrestricted Ruthless win seed...');
  const seed = await discoverCedhSeedWinPackageV14([commander], {
    maxPackageCards: 3,
    maxCandidatesToVerify: 12,
  });
  console.log(`SEED STATUS: ${String(seed.status)}`);
  console.log(`SEED: ${JSON.stringify(seed, null, 2)}`);
  assert.equal(seed.status, 'eligible-winning-seed-package-found', 'unrestricted cEDH control must discover at least one legal compact win-oriented seed package');
  assert.equal(seed.bracketTag, 'R', 'control seed must be Commander Spellbook Ruthless evidence');
  assert.ok(Array.isArray(seed.seedNames) && seed.seedNames.length >= 1, 'seed must contain at least one non-commander card');
  assert.ok(Array.isArray(seed.exactPrintings) && seed.exactPrintings.length >= 1, 'seed cards must resolve to exact eligible physical printings');

  console.log('V0.15 LIVE RESEARCH: PASS');
}

main().catch((error) => {
  console.error('V0.15 LIVE RESEARCH: FAIL');
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
});
