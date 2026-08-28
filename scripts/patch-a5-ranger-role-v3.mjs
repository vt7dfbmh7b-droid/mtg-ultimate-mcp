import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/services/scryfall.ts';
let source = await readFile(path, 'utf8');
const before = `const proactiveSpellLock = /(?:your )?opponents? can't cast spells? (?:this turn|during your turn)/.test(text)\n    || /players? can't cast spells? (?:this turn|during your turn)/.test(text);`;
const after = `const proactiveSpellLock = /(?:your )?opponents? can't cast (?:noncreature )?spells? (?:this turn|during your turn)/.test(text)\n    || /players? can't cast (?:noncreature )?spells? (?:this turn|during your turn)/.test(text);`;
if (!source.includes(before)) throw new Error('A5 Ranger role v3 anchor not found');
source = source.replace(before, after);
await writeFile(path, source, 'utf8');
console.log('Applied A5 Ranger-Captain combo-protection role v3 correction.');
