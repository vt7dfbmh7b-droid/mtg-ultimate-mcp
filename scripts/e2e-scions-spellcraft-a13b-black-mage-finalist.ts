import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06, type PodPressureV06 } from '../src/services/simulation-v06.js';

const A11='test-results/exploratory/scions-spellcraft-a11-control-deck.txt';
const A13='test-results/exploratory/scions-spellcraft-a13-black-mage-deck.txt';
const AS_OF='2026-08-31';
const SCENARIOS:Array<{pressure:PodPressureV06;turns:number;seed:number}>=[
 {pressure:'upgraded',turns:5,seed:20260831},{pressure:'upgraded',turns:7,seed:20260917},
 {pressure:'optimized',turns:5,seed:20261001},{pressure:'optimized',turns:7,seed:20261101},
 {pressure:'cedh',turns:5,seed:20261201},{pressure:'cedh',turns:7,seed:20270111},{pressure:'cedh',turns:9,seed:20270219},
];
const norm=(v:string)=>v.trim().toLowerCase();
const rec=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:0;
const avg=(v:readonly number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;
interface Deck{parsed:ParsedDeck;cards:ScryfallCard[];notFound:string[];}
function ids(p:ParsedDeck):CardIdentifierInput[]{return [...p.commanders,...p.main].map(e=>({name:e.name,...(e.set?{set:e.set}:{}),...(e.collectorNumber?{collectorNumber:e.collectorNumber}:{})}));}
async function resolve(path:string):Promise<Deck>{const text=await readFile(path,'utf8');const parsed=parseDecklist(text);const r=await getCardsByIdentifiers(ids(parsed));return{parsed,cards:r.cards,notFound:r.notFound};}
interface Signal{keep:number;uptime:number;protection:number;spells:number;draws:number;}
function signal(r:Record<string,unknown>):Signal{const b=rec(r.baseline),a=rec(r.advanced);return{keep:num(rec(b.openingHands).functionalKeepRate),uptime:num(rec(a.commanderPressure).battlefieldUptimePercent),protection:num(rec(a.interactionPressure).protectionWinRateWhenChallenged),spells:num(rec(a.cardFlow).averageSpellsCast),draws:num(rec(a.cardFlow).averageCardsDrawnByEffects)};}
function delta(a:Signal,b:Signal):Signal{return{keep:b.keep-a.keep,uptime:b.uptime-a.uptime,protection:b.protection-a.protection,spells:b.spells-a.spells,draws:b.draws-a.draws};}
function mean(v:Signal[]):Signal{return{keep:avg(v.map(x=>x.keep)),uptime:avg(v.map(x=>x.uptime)),protection:avg(v.map(x=>x.protection)),spells:avg(v.map(x=>x.spells)),draws:avg(v.map(x=>x.draws))};}
function sim(d:Deck,s:{pressure:PodPressureV06;turns:number;seed:number}){return simulateDeckGameplayV06(d.parsed,d.cards,{iterations:3600,advancedIterations:3600,turns:s.turns,seed:s.seed,pressure:s.pressure}) as unknown as Record<string,unknown>;}
function names(d:Deck){return new Set(d.parsed.main.map(e=>norm(e.name)));}
async function main(){
 const [a11,a13]=await Promise.all([resolve(A11),resolve(A13)]);const policy=await resolvePrintingPolicyV08({printingFamily:'Final Fantasy',includePromos:true,includeSpecialReleases:true});
 const hard=(d:Deck)=>({count:d.parsed.totalCards,notFound:d.notFound,legal:validateCommanderDeck(d.parsed,d.cards).isLegal,ff:d.cards.every(c=>printingMatchesPolicyV08(c,policy,AS_OF))});
 const h11=hard(a11),h13=hard(a13);if(h11.count!==100||h11.notFound.length||!h11.legal||!h11.ff||h13.count!==100||h13.notFound.length||!h13.legal||!h13.ff)throw new Error(`hard truth failed ${JSON.stringify({h11,h13})}`);
 const n13=names(a13);for(const x of ['the destined white mage','walking ballista','diabolic intent','ranger-captain of eos','papalymo totolymo','the destined black mage'])if(!n13.has(x))throw new Error(`missing locked ${x}`);
 const runs=[],ds:Signal[]=[];for(const sc of SCENARIOS){const a=signal(sim(a11,sc)),b=signal(sim(a13,sc)),d=delta(a,b);ds.push(d);runs.push({...sc,a11:a,a13:b,deltaA13MinusA11:d});}
 const md=mean(ds),m11=buildDeckMetrics(a11.parsed,a11.cards),m13=buildDeckMetrics(a13.parsed,a13.cards);
 const pass=md.keep>=-0.8&&md.uptime>=-1.5&&md.protection>=-2.0&&md.spells>=-0.10&&md.draws>=-0.12&&m13.landCount===m11.landCount&&m13.rampCount>=m11.rampCount-1;
 const report={status:pass?'PASS':'REVIEW',swap:'Thancred Waters -> The Destined Black Mage',hard:{a11:h11,a13:h13},metrics:{a11:m11,a13:m13},meanDeltaA13MinusA11:md,runs,manualSynergy:{singleQualifyingSpellWithYshPapalymoBlackMage:'2 + 1 + 1 = 4 life lost to each opponent, enabling Y\'shtola end-step draw threshold from one MV3+ noncreature spell',fullParty:'A11/A13 currently has no Rogue, so full-party 3-damage mode is not naturally available and receives no acceptance credit'},caveat:'Generic simulator does not model Black Mage drain or Y\'shtola threshold; simulation is a regression guard for replacing Thancred, while the drain synergy is manually credited.'};
 await writeFile('scions-spellcraft-a13b-black-mage-finalist.json',JSON.stringify(report,null,2));
 const text=['# Scions & Spellcraft A13b — Black Mage Finalist','',`Status: **${report.status}**`,`Swap: ${report.swap}`,'',`Δ functional keep: ${md.keep.toFixed(3)}`,`Δ commander uptime: ${md.uptime.toFixed(3)}`,`Δ protection: ${md.protection.toFixed(3)}`,`Δ spells cast: ${md.spells.toFixed(3)}`,`Δ effect-draws: ${md.draws.toFixed(3)}`,'',`A11/A13 lands: ${m11.landCount}/${m13.landCount}`,`A11/A13 ramp: ${m11.rampCount}/${m13.rampCount}`,`A11/A13 avg nonland MV: ${m11.averageNonlandManaValue.toFixed(2)}/${m13.averageNonlandManaValue.toFixed(2)}`,'','Manual synergy: Y\'shtola + Papalymo + Black Mage turns one qualifying MV3+ noncreature spell into 4 life lost per opponent (2+1+1), enabling Y\'shtola\'s end-step draw threshold from one spell.','Full-party clause is not credited because the current deck has no Rogue.',''].join('\n');
 await writeFile('scions-spellcraft-a13b-black-mage-finalist.md',text);console.log(text);
}
await main();
