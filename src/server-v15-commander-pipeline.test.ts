import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler, type McpServer } from '@modelcontextprotocol/server';
import { createCurrentMtgServer } from './server-current.js';
import { createMtgServerV14 } from './server-v14.js';
import { createMtgServerV15 } from './server-v15.js';
import {
  registerUniversalCommanderPipelineToolV15,
  type UniversalCommanderPipelineToolDependenciesV15,
} from './server-v15-commander-pipeline.js';
import type { CommanderBuildPipelineOptionsV15 } from './services/commander-build-pipeline-v15.js';
import type { CardIdentifierInput } from './services/scryfall.js';
import type { ScryfallCard } from './types/scryfall.js';

type ToolJson = Record<string, unknown>;

type ListedTool = {
  name: string;
  inputSchema?: {
    properties?: Record<string, unknown>;
    required?: string[];
  };
};

async function withClient<T>(factory: () => McpServer, action: (client: Client) => Promise<T>): Promise<T> {
  const handler = createMcpHandler(factory);
  const client = new Client(
    { name: 'mtg-ultimate-v15-pipeline-test', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  const transport = new StreamableHTTPClientTransport(new URL('http://test.local/mcp'), {
    fetch: (url, init) => handler.fetch(new Request(url, init)),
  });

  try {
    await client.connect(transport);
    return await action(client);
  } finally {
    await client.close();
    await handler.close();
  }
}

async function callToolJson(client: Client, args: Record<string, unknown>): Promise<ToolJson> {
  const result = await client.callTool({
    name: 'build_commander_through_pipeline_v15',
    arguments: args,
  }) as unknown as {
    content: Array<{ type: string; text?: string }>;
    isError?: boolean;
  };
  assert.notEqual(result.isError, true, 'universal pipeline should return typed fail-closed statuses as JSON, not MCP transport errors');
  const text = result.content.find((item) => item.type === 'text' && typeof item.text === 'string')?.text;
  assert.ok(text, 'universal pipeline should return JSON text content');
  return JSON.parse(text) as ToolJson;
}

function commander(name = 'Najeela, the Blade-Blossom', set = 'fca', collectorNumber = '42'): ScryfallCard {
  return {
    id: `${set}-${collectorNumber}`,
    lang: 'en',
    oracle_id: `${name}-oracle`,
    name,
    set,
    set_name: 'FINAL FANTASY Through the Ages',
    collector_number: collectorNumber,
    released_at: '2025-06-13',
    type_line: 'Legendary Creature — Human Warrior',
    oracle_text: 'Whenever a Warrior attacks, you may have its controller create a 1/1 white Warrior creature token that is tapped and attacking.',
    mana_cost: '{2}{R}',
    cmc: 3,
    colors: ['R'],
    color_identity: ['W', 'U', 'B', 'R', 'G'],
    keywords: [],
    legalities: { commander: 'legal' },
    rarity: 'mythic',
    prices: { usd: '8.00', usd_foil: null, usd_etched: null, eur: null, eur_foil: null, tix: null },
    finishes: ['nonfoil'],
    foil: false,
    nonfoil: true,
    promo: false,
    digital: false,
    full_art: false,
    scryfall_uri: `https://scryfall.com/card/${set}/${collectorNumber}`,
  } as ScryfallCard;
}

function fixtureBuildResult(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: 'complete-evaluated-build',
    constructionIntent: 'universal-pipeline-v15',
    plan: {
      lane: 'neutral-themed',
      requestedTargetBracket: null,
      archetype: 'combat-tokens',
    },
    stages: {
      deckConstructed: true,
      hardTruthEvaluationCompleted: true,
      exactPerCardBudgetVerified: true,
      actualBracketAssessedAfterConstruction: true,
    },
    packageDiscovery: {
      status: 'complete',
      sourceCompleteness: 'complete',
    },
    built: {
      decklist: '// COMMANDER\n1 Najeela, the Blade-Blossom (FCA) 42\n\n// MAIN\n99 Plains (M21) 260',
      candidatePoolProvenance: {
        source: 'bounded-stratified-neutral-sample',
        popularityOrdered: false,
        edhrecOrdered: false,
      },
    },
    evaluation: {
      hardGatesPassed: true,
      hardConstraintAudit: {
        satisfied: true,
        exactCardCount: true,
        commanderLegal: true,
        printingPolicyCompliant: true,
      },
      postBuildEvidence: {
        sourceCompleteness: 'complete',
        sourceHealth: { scryfall: 'available', commanderSpellbook: 'available' },
      },
    },
    perCardBudgetAudit: {
      satisfied: true,
      maxUsdPerCard: 20,
    },
    themeAudit: null,
    requestedTargetBracket: null,
    achievedBracket: 3,
    achievedBand: 'bracket-3-upgraded-range',
    targetComparison: null,
    ...overrides,
  };
}

function stubbedFactory(dependencies: UniversalCommanderPipelineToolDependenciesV15): () => McpServer {
  return () => registerUniversalCommanderPipelineToolV15(createMtgServerV14(), dependencies);
}

test('experimental V0.15 registers the universal pipeline schema while stable current remains V0.13', async () => {
  await withClient(createMtgServerV15, async (client) => {
    const { tools } = await client.listTools();
    const tool = (tools as ListedTool[]).find((candidate) => candidate.name === 'build_commander_through_pipeline_v15');
    assert.ok(tool, 'experimental V0.15 must advertise the universal Commander pipeline');
    const properties = tool.inputSchema?.properties ?? {};
    for (const field of [
      'commanders',
      'targetBracket',
      'printingFamily',
      'allowedSets',
      'includePromos',
      'includeSpecialReleases',
      'maxUsdPerCard',
      'candidateMaxUsdPerCard',
      'themeQuery',
      'excludedCards',
      'mustInclude',
      'landCount',
      'maxNonbasicLands',
      'winPackageMode',
      'minimumDistinctLibraryRoutes',
    ]) {
      assert.ok(field in properties, `schema should expose ${field}`);
    }
    assert.ok(tool.inputSchema?.required?.includes('commanders'));
    assert.equal(tool.inputSchema?.required?.includes('targetBracket'), false, 'no-target must be representable at the MCP schema boundary');
  });

  await withClient(createCurrentMtgServer, async (client) => {
    const { tools } = await client.listTools();
    assert.equal(
      tools.some((tool) => tool.name === 'build_commander_through_pipeline_v15'),
      false,
      'experimental universal pipeline must not leak into server-current V0.13',
    );
  });
});

test('MCP boundary preserves exact commander identity, true no-target behavior, budgets, decklist, audits, provenance and source evidence', async () => {
  const exactCommander = commander();
  let capturedIdentifiers: CardIdentifierInput[] = [];
  let capturedOptions: CommanderBuildPipelineOptionsV15 | undefined;
  const dependencies: UniversalCommanderPipelineToolDependenciesV15 = {
    resolveCards: async (identifiers) => {
      capturedIdentifiers = identifiers;
      return { cards: [exactCommander], notFound: [] };
    },
    buildPipeline: async (_commanders, options = {}) => {
      capturedOptions = options;
      return fixtureBuildResult();
    },
  };

  await withClient(stubbedFactory(dependencies), async (client) => {
    const result = await callToolJson(client, {
      commanders: [{ name: exactCommander.name, set: 'FCA', collectorNumber: '42' }],
      maxUsdPerCard: 20,
      candidateMaxUsdPerCard: 5,
      allowedSets: ['FCA'],
      includePromos: false,
      includeSpecialReleases: true,
      excludedCards: ['Dockside Extortionist'],
      mustInclude: ['Command Tower'],
      landCount: 36,
      maxNonbasicLands: 30,
      winPackageMode: 'auto',
      minimumDistinctLibraryRoutes: 2,
    });

    assert.deepEqual(capturedIdentifiers, [{ name: exactCommander.name, set: 'FCA', collectorNumber: '42' }]);
    assert.equal(Object.hasOwn(capturedOptions ?? {}, 'targetBracket'), false, 'omitting targetBracket must remain a true no-target request');
    assert.equal(capturedOptions?.maxUsdPerCard, 20);
    assert.equal(capturedOptions?.candidateMaxUsdPerCard, 5);
    assert.deepEqual(capturedOptions?.allowedSets, ['FCA']);
    assert.equal(capturedOptions?.includePromos, false);
    assert.equal(capturedOptions?.includeSpecialReleases, true);
    assert.deepEqual(capturedOptions?.mustInclude, ['Command Tower']);
    assert.deepEqual(capturedOptions?.excludedCards, ['Dockside Extortionist']);
    assert.equal(capturedOptions?.landCount, 36);
    assert.equal(capturedOptions?.maxNonbasicLands, 30);
    assert.equal(capturedOptions?.winPackageMode, 'auto');
    assert.equal(capturedOptions?.minimumDistinctLibraryRoutes, 2);

    assert.equal(result.status, 'complete-evaluated-build');
    const built = result.built as Record<string, unknown>;
    assert.equal(typeof built.decklist, 'string');
    assert.ok((built.decklist as string).includes('(FCA) 42'));
    assert.deepEqual(built.candidatePoolProvenance, {
      source: 'bounded-stratified-neutral-sample',
      popularityOrdered: false,
      edhrecOrdered: false,
    });
    const evaluation = result.evaluation as Record<string, unknown>;
    assert.deepEqual(evaluation.hardConstraintAudit, {
      satisfied: true,
      exactCardCount: true,
      commanderLegal: true,
      printingPolicyCompliant: true,
    });
    assert.deepEqual(result.perCardBudgetAudit, { satisfied: true, maxUsdPerCard: 20 });
    assert.equal((result.packageDiscovery as Record<string, unknown>).sourceCompleteness, 'complete');
    assert.deepEqual((evaluation.postBuildEvidence as Record<string, unknown>).sourceHealth, {
      scryfall: 'available',
      commanderSpellbook: 'available',
    });
    assert.equal(result.achievedBracket, 3);
    assert.equal(result.targetComparison, null);
    const boundary = result.mcpBoundary as Record<string, unknown>;
    assert.equal(boundary.exactCommanderResolutionPassed, true);
    assert.equal(boundary.resolvedCommanderCount, 1);
  });
});

test('Final Fantasy theme-only request reaches the real pipeline contract without an invented printingFamily and preserves derived theme evidence', async () => {
  const exactCommander = commander();
  let capturedOptions: CommanderBuildPipelineOptionsV15 | undefined;
  const dependencies: UniversalCommanderPipelineToolDependenciesV15 = {
    resolveCards: async () => ({ cards: [exactCommander], notFound: [] }),
    buildPipeline: async (_commanders, options = {}) => {
      capturedOptions = options;
      return fixtureBuildResult({
        effectivePrintingFamily: 'final-fantasy',
        themeIntent: {
          original: 'Final Fantasy',
          kind: 'printing-family',
          enforceability: 'supported',
          printingFamily: 'final-fantasy',
        },
        themeAudit: {
          status: 'satisfied',
          satisfied: true,
          printingFamily: 'final-fantasy',
        },
        themeConstraintSatisfied: true,
      });
    },
  };

  await withClient(stubbedFactory(dependencies), async (client) => {
    const result = await callToolJson(client, {
      commanders: [{ name: exactCommander.name, set: 'FCA', collectorNumber: '42' }],
      themeQuery: 'Final Fantasy',
    });

    assert.equal(capturedOptions?.themeQuery, 'Final Fantasy');
    assert.equal(capturedOptions?.printingFamily, undefined, 'the MCP adapter must not invent a family before the pipeline performs typed theme derivation');
    assert.equal(result.effectivePrintingFamily, 'final-fantasy');
    assert.equal((result.themeAudit as Record<string, unknown>).satisfied, true);
    assert.equal(result.themeConstraintSatisfied, true);
  });
});

test('MCP boundary preserves unsupported, verification-unavailable and hard-constraint failure surfaces', async () => {
  const exactCommander = commander();
  const dependencies: UniversalCommanderPipelineToolDependenciesV15 = {
    resolveCards: async () => ({ cards: [exactCommander], notFound: [] }),
    buildPipeline: async (_commanders, options = {}) => {
      if (options.themeQuery === 'unsupported compound theme') {
        return {
          status: 'unsupported-neutral-theme',
          constructionIntent: 'universal-pipeline-v15',
          guidance: 'Unsupported compound theme fails closed.',
          themeIntent: { enforceability: 'unsupported' },
        };
      }
      if (options.themeQuery === 'creature type source unavailable') {
        return {
          status: 'neutral-theme-verification-unavailable',
          constructionIntent: 'universal-pipeline-v15',
          guidance: 'Creature-type verification source unavailable.',
          themeIntent: { enforceability: 'verification-unavailable' },
        };
      }
      return fixtureBuildResult({
        status: 'built-but-hard-gates-failed',
        evaluation: {
          hardGatesPassed: false,
          hardConstraintAudit: {
            satisfied: false,
            failures: ['must-include card violates exact hard constraint'],
          },
          postBuildEvidence: { sourceCompleteness: 'complete' },
        },
      });
    },
  };

  await withClient(stubbedFactory(dependencies), async (client) => {
    const unsupported = await callToolJson(client, {
      commanders: [{ name: exactCommander.name }],
      themeQuery: 'unsupported compound theme',
    });
    assert.equal(unsupported.status, 'unsupported-neutral-theme');
    assert.match(String(unsupported.guidance), /fails closed/i);

    const unavailable = await callToolJson(client, {
      commanders: [{ name: exactCommander.name }],
      themeQuery: 'creature type source unavailable',
    });
    assert.equal(unavailable.status, 'neutral-theme-verification-unavailable');
    assert.equal((unavailable.themeIntent as Record<string, unknown>).enforceability, 'verification-unavailable');

    const hardFailure = await callToolJson(client, {
      commanders: [{ name: exactCommander.name }],
      mustInclude: ['Impossible Card'],
    });
    assert.equal(hardFailure.status, 'built-but-hard-gates-failed');
    const hardEvaluation = hardFailure.evaluation as Record<string, unknown>;
    assert.equal(hardEvaluation.hardGatesPassed, false);
    assert.deepEqual((hardEvaluation.hardConstraintAudit as Record<string, unknown>).failures, [
      'must-include card violates exact hard constraint',
    ]);
  });
});

test('unresolved or duplicate commander input fails before construction', async () => {
  let buildCalls = 0;
  const missingDependencies: UniversalCommanderPipelineToolDependenciesV15 = {
    resolveCards: async () => ({ cards: [], notFound: ['Missing Commander'] }),
    buildPipeline: async () => {
      buildCalls += 1;
      return fixtureBuildResult();
    },
  };

  await withClient(stubbedFactory(missingDependencies), async (client) => {
    const missing = await callToolJson(client, {
      commanders: [{ name: 'Missing Commander', set: 'TST', collectorNumber: '1' }],
    });
    assert.equal(missing.status, 'commander-resolution-failed');
    assert.equal(buildCalls, 0);
  });

  const exactCommander = commander();
  const duplicateDependencies: UniversalCommanderPipelineToolDependenciesV15 = {
    resolveCards: async () => ({ cards: [exactCommander], notFound: [] }),
    buildPipeline: async () => {
      buildCalls += 1;
      return fixtureBuildResult();
    },
  };
  await withClient(stubbedFactory(duplicateDependencies), async (client) => {
    const duplicate = await callToolJson(client, {
      commanders: [
        { name: exactCommander.name, set: 'FCA', collectorNumber: '42' },
        { name: exactCommander.name, set: 'FCA', collectorNumber: '42' },
      ],
    });
    assert.equal(duplicate.status, 'duplicate-commander-input');
    assert.equal(buildCalls, 0);
  });
});

test('two exact commander refs preserve caller order at the MCP boundary', async () => {
  const first = commander('Tymna the Weaver', 'cmr', '384');
  const second = commander("Kraum, Ludevic's Opus", 'cmr', '282');
  let seenCommanderNames: string[] = [];
  const dependencies: UniversalCommanderPipelineToolDependenciesV15 = {
    resolveCards: async () => ({ cards: [second, first], notFound: [] }),
    buildPipeline: async (commanders) => {
      seenCommanderNames = commanders.map((card) => card.name);
      return fixtureBuildResult();
    },
  };

  await withClient(stubbedFactory(dependencies), async (client) => {
    const result = await callToolJson(client, {
      commanders: [
        { name: first.name, set: 'CMR', collectorNumber: '384' },
        { name: second.name, set: 'CMR', collectorNumber: '282' },
      ],
      targetBracket: 5,
      winPackageMode: 'prefer',
    });
    assert.deepEqual(seenCommanderNames, [first.name, second.name]);
    assert.equal((result.mcpBoundary as Record<string, unknown>).requestedCommanderCount, 2);
  });
});
