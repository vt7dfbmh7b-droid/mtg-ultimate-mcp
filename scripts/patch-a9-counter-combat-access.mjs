import { readFile, writeFile } from 'node:fs/promises';

const scryfallPath = 'src/services/scryfall.ts';
const strategyPath = 'src/services/neutral-commander-selection-v15.ts';

let scryfall = await readFile(scryfallPath, 'utf8');
const scryfallNeedle = `  if (/haste/.test(text)) roles.add('haste');\n`;
if (!scryfall.includes(scryfallNeedle)) throw new Error('A9 scryfall insertion point not found');
const scryfallInsert = `  const counterPlacementPayoff = /whenever (?:you put one or more counters on|one or more counters? (?:are|is) put on) (?:a|one or more|target|another) creatures?/i.test(text);\n  if (counterPlacementPayoff) roles.add('counter payoff');\n  const combatAccess = /(?:that|target|equipped|enchanted|up to one target|up to two target|up to three target)?\\s*creatures?[^.]{0,100}can't be blocked|can't be blocked by creatures (?:your )?opponents control|can't be blocked this turn/i.test(text);\n  if (combatAccess) roles.add('combat access');\n`;
scryfall = scryfall.replace(scryfallNeedle, `${scryfallInsert}${scryfallNeedle}`);
await writeFile(scryfallPath, scryfall, 'utf8');

let strategy = await readFile(strategyPath, 'utf8');
const countersNeedle = `  addSignal(table, 'counters', roles.has('+1/+1 counters'), 9, '+1/+1 counters');\n`;
if (!strategy.includes(countersNeedle)) throw new Error('A9 counters strategy insertion point not found');
strategy = strategy.replace(countersNeedle, `${countersNeedle}  addSignal(table, 'counters', roles.has('counter payoff'), 7, 'counter-placement payoff');\n`);
const combatNeedle = `  addSignal(table, 'combat-tokens', roles.has('haste'), 2, 'haste');\n`;
if (!strategy.includes(combatNeedle)) throw new Error('A9 combat strategy insertion point not found');
strategy = strategy.replace(combatNeedle, `${combatNeedle}  addSignal(table, 'combat-tokens', roles.has('combat access'), 3, 'combat access/evasion');\n`);
await writeFile(strategyPath, strategy, 'utf8');

console.log('Applied generic A9 counter-payoff and combat-access semantics.');
