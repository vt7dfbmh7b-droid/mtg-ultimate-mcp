import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/services/scryfall.ts';
let source = await readFile(path, 'utf8');

const manaAnchor = `  if (card.cmc <= 1 && addsMana && !isLand && !requiresPaidManaSetup) roles.add('fast mana');\n`;
const manaReplacement = `${manaAnchor}  const nonlandManaMultiplier = /whenever you tap a nonland permanent for mana, add [^.]*mana/.test(text)\n    || /if you tap (?:a|an|another) nonland permanent for mana[^.]*add [^.]*additional mana/.test(text)\n    || /nonland permanents? you tap for mana produce [^.]*additional mana/.test(text);\n  if (nonlandManaMultiplier) {\n    roles.add('mana acceleration');\n    roles.add('mana multiplier');\n  }\n  if (card.cmc <= 1 && (roles.has('fast mana') || roles.has('mana dork'))) roles.add('early acceleration');\n`;
if (!source.includes(manaAnchor)) throw new Error('A5 mana-role anchor not found');
source = source.replace(manaAnchor, manaReplacement);

const protectionAnchor = `  if (boardProtection) roles.add('board protection');\n  if (/haste/.test(text)) roles.add('haste');\n  if (/can't cast|can't activate|players can't|opponents can't|doesn't untap|enter the battlefield tapped/.test(text)) roles.add('stax/control');\n`;
const protectionReplacement = `  if (boardProtection) roles.add('board protection');\n  const proactiveSpellLock = /(?:your )?opponents? can't cast spells? (?:this turn|during your turn)/.test(text)\n    || /players? can't cast spells? (?:this turn|during your turn)/.test(text);\n  if (proactiveSpellLock) {\n    roles.add('stax/control');\n    roles.add('combo protection');\n  }\n  const combatFreeCastEngine = /whenever [^.]{0,140}deals? combat damage to (?:a|one or more )players?[^.]{0,180}draw a card[^.]{0,220}cast a spell from your hand[^.]{0,120}without paying its mana cost/.test(text);\n  if (combatFreeCastEngine) {\n    roles.add('repeatable draw');\n    roles.add('free-cast engine');\n    roles.add('combat value engine');\n  }\n  if (/haste/.test(text)) roles.add('haste');\n  if (/can't cast|can't activate|players can't|opponents can't|doesn't untap|enter the battlefield tapped/.test(text)) roles.add('stax/control');\n`;
if (!source.includes(protectionAnchor)) throw new Error('A5 protection-role anchor not found');
source = source.replace(protectionAnchor, protectionReplacement);

await writeFile(path, source, 'utf8');
console.log('Applied A5 strategic-role semantics patch.');
