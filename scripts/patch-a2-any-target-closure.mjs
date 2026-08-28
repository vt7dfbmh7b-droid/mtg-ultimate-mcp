import { readFile, writeFile } from 'node:fs/promises';

const closurePath = 'src/services/full-table-win-closure-v15.ts';
const evaluationPath = 'src/services/commander-build-evaluation-v15.ts';

let closure = await readFile(closurePath, 'utf8');
let evaluation = await readFile(evaluationPath, 'utf8');

const closureNeedle = `function hasResourceEngine(text: string): boolean {\n  return /\\b(?:infinite|unbounded|arbitrarily (?:large|high|many))\\b/.test(text)\n    || /\\bnear-infinite\\b/.test(text);\n}\n`;
const closureReplacement = `function hasRepeatableAnyTargetDamageContext(context: string): boolean {\n  const text = normalizeText([context]);\n  if (!text) return false;\n  const anyTargetDamage = /\\b(?:deal|deals|dealing)\\b[^.!;]{0,120}\\bdamage\\b[^.!;]{0,120}\\bany target\\b/.test(text)\n    || /\\bany target\\b[^.!;]{0,120}\\bdamage\\b/.test(text);\n  const repeated = /\\b(?:repeat|repeats|repeating|repeatable|any number of times|arbitrarily many times)\\b/.test(text);\n  return anyTargetDamage && repeated;\n}\n\nfunction hasResourceEngine(text: string): boolean {\n  return /\\b(?:infinite|unbounded|arbitrarily (?:large|high|many))\\b/.test(text)\n    || /\\bnear-infinite\\b/.test(text);\n}\n`;

if (!closure.includes('function hasRepeatableAnyTargetDamageContext(')) {
  if (!closure.includes(closureNeedle)) throw new Error('closure insertion point not found');
  closure = closure.replace(closureNeedle, closureReplacement);
}

const signatureNeedle = `export function assessFullTableWinClosureV15(results: readonly string[]): FullTableWinClosureAssessmentV15 {\n  const normalizedText = normalizeText(results);\n`;
const signatureReplacement = `export function assessFullTableWinClosureV15(\n  results: readonly string[],\n  context = '',\n): FullTableWinClosureAssessmentV15 {\n  const normalizedText = normalizeText(results);\n`;
if (closure.includes(signatureNeedle)) {
  closure = closure.replace(signatureNeedle, signatureReplacement);
} else if (!closure.includes("context = '',")) {
  throw new Error('closure signature insertion point not found');
}

const lethalNeedle = `  if (hasUnscopedLethalEngine(normalizedText)) {\n    signals.push('unscoped-lethal-engine');\n`;
const lethalReplacement = `  if (hasUnscopedLethalEngine(normalizedText) && hasRepeatableAnyTargetDamageContext(context)) {\n    signals.push('repeatable-any-target-unbounded-damage');\n    return {\n      verifiedFullTableWin: true,\n      kind: 'all-opponents-damage',\n      timing: 'immediate',\n      scope: 'all-opponents',\n      normalizedText,\n      signals,\n      caveat: 'The result reports unbounded damage and the verified combo sequence explicitly repeats a damage-to-any-target activation, so the controller can distribute lethal damage across a multiplayer table.',\n    };\n  }\n\n  if (hasUnscopedLethalEngine(normalizedText)) {\n    signals.push('unscoped-lethal-engine');\n`;
if (!closure.includes("repeatable-any-target-unbounded-damage")) {
  if (!closure.includes(lethalNeedle)) throw new Error('closure lethal-engine insertion point not found');
  closure = closure.replace(lethalNeedle, lethalReplacement);
}

const evaluationNeedle = `  const results = Array.isArray(combo.results) ? combo.results.map(String) : [];\n  const closure = assessFullTableWinClosureV15(results);\n`;
const evaluationReplacement = `  const results = Array.isArray(combo.results) ? combo.results.map(String) : [];\n  const description = typeof combo.description === 'string' ? combo.description : '';\n  const closure = assessFullTableWinClosureV15(results, description);\n`;
if (evaluation.includes(evaluationNeedle)) {
  evaluation = evaluation.replace(evaluationNeedle, evaluationReplacement);
} else if (!evaluation.includes('assessFullTableWinClosureV15(results, description)')) {
  throw new Error('commander evaluation closure call insertion point not found');
}

await writeFile(closurePath, closure, 'utf8');
await writeFile(evaluationPath, evaluation, 'utf8');
console.log('Applied A2 repeatable-any-target full-table closure patch.');
