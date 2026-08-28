import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/services/scryfall.ts';
let source = await readFile(path, 'utf8');
const before = `const combatFreeCastEngine = /whenever [^.]{0,140}deals? combat damage to (?:a|one or more )players?[^.]{0,180}draw a card[^.]{0,220}cast a spell from your hand[^.]{0,120}without paying its mana cost/.test(text);`;
const after = `const combatFreeCastEngine = /whenever [^.]{0,140}deals? combat damage to (?:a |one or more )players?[^.]{0,180}draw a card[^.]{0,220}cast a spell from your hand[^.]{0,120}without paying its mana cost/.test(text);`;
if (!source.includes(before)) throw new Error('A5 Buster role v2 anchor not found');
source = source.replace(before, after);
await writeFile(path, source, 'utf8');
console.log('Applied A5 Buster Sword role v2 correction.');
