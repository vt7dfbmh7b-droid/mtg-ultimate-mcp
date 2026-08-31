import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06, type PodPressureV06 } from '../src/services/simulation-v06.js';

const BASE='test-results/exploratory/scions-spellcraft-a11-control-deck.txt';
const AS_OF='2026-08-31';
const BLACK_MAGE={name:'The Destined Black Mage',set:'FIC',collector:'447'};
const CUTS=[
  "G'raha Tia, Scion Reborn",
  'Alisaie Leveilleur',
  'Tataru Taru',
  'Thancred Waters',
  'Alphinaud Leveilleur',
  'Hermes, Overseer of Elpis',
  'Fandaniel, Telophoroi Ascian',
  'Krile Baldesion',
  'Lyse Hext',
  'Baleful Strix',
];
const SCENARIOS:Array<{pressure:PodPressureV06;turns:number;seed:number}>=[
 {pressure:'upgraded',turns:5,seed:20260831},{pressure:'upgraded',turns:7,seed:20260917},
 {pressure:'optimized',turns:5,seed:20261001},{pressure:'optimized',turns:7,seed:20261101},
 {pressure:'cedh',turns:5,seed:20261201},{pressure:'cedh',turns:7,seed:20270111},{pressure:'cedh',turns:9,seed:20270219},
];
const norm=(v:string)=>v.trim().toLowerCase();
const rec=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:0;
const avg=(v:readonly number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;
interface Deck{parsed:ParsedDeck;cards:ScryfallCard[];text:string;notFound:string[];}
function ids(p:ParsedDeck):CardIdentifierInput[]{return [...p.commanders,...p.main].map(e=>({name:e.name,...(e.set?{set:e.set}:{}),...(e.collectorNumber?{collectorNumber:e.collectorNumber}:{})}));}
async function resolve(text:string):Promise<Deck>{const parsed=parseDecklist(text);const r=await getCardsByIdentifiers(ids(parsed));return{parsed,cards:r.cards,text,notFound:r.notFound};}
function replaceOne(text:string,cut:string){const lines=text.split('\n');const i=lines.findIndex(l=>l.startsWith('1 ')&&norm(l.replace(/^1\s+/, '').replace(/\s+\([A-Z0-9]+\)\s+\S+\s*$/, ''))===norm(cut));if(i<0)throw new Error(`missing cut ${cut}`);lines[i]=`1 ${BLACK_MAGE.name} (${BLACK_MAGE.set}) ${BLACK_MAGE.collector}`;return lines.join('\n');}
function card(d:Deck,name:string){return d.cards.find(c=>norm(c.name)===norm(name)||norm(c.name.split(' // ')[0]??'')===norm(name));}
function names(d:Deck){return new Set(d.parsed.main.map(e=>norm(e.name)));}
interface Signal{keep:number;uptime:number;protection:number;spells:number;draws:number;}
function signal(r:Record<string,unknown>):Signal{const b=rec(r.baseline),a=rec(r.advanced);return{keep:num(rec(b.openingHands).functionalKeepRate),uptime:num(rec(a.commanderPressure).battlefieldUptimePercent),protection:num(rec(a.interactionPressure).protectionWinRateWhenChallenged),spells:num(rec(a.cardFlow).averageSpellsCast),draws:num(rec(a.cardFlow).averageCardsDrawnByEffects)};}
function delta(a:Signal,b:Signal):Signal{return{keep:b.keep-a.keep,uptime:b.uptime-a.uptime,protection:b.protection-a.protection,spells:b.spells-a.spells,draws:b.draws-a.draws};}
function mean(v:Signal[]):Signal{return{keep:avg(v.map(x=>x.keep)),uptime:avg(v.map(x=>x.uptime)),protection:avg(v.map(x=>x.protection)),spells:avg(v.map(x=>x.spells)),draws:avg(v.map(x=>x.draws))};}
function sim(d:Deck,s:{pressure:PodPressureV06;turns:number;seed:number}){return simulateDeckGameplayV06(d.parsed,d.cards,{iterations:1800,advancedIterations:1800,turns:s.turns,seed:s.seed,pressure:s.pressure}) as unknown as Record<string,unknown>;}
function partyMap(d:Deck){const out:Record<string,string[]>={Cleric:[],Rogue:[],Warrior:[],Wizard:[]};for(const e of d.parsed.main){const c=card(d,e.name);if(!c||!c.type_line.toLowerCase().includes('creature'))continue;for(const type of Object.keys(out)){if(new RegExp(`\\b${type}\\b`,'i').test(c.type_line))out[type]!.push(e.name);}}return out;}
function engineState(d:Deck){const n=names(d);return{
 yshNoncreatureDrainCommander:true,
 papalymo:n.has('papalymo totolymo'),
 blackMage:n.has('the destined black mage'),
 circleOfPower:n.has('circle of power'),
 transpose:n.has('transpose'),
 singleQualifyingSpellHitsFourWithPapalymoAndBlackMage:n.has('papalymo totolymo')&&n.has('the destined black mage'),
};}
async function main(){
 const text=await readFile(BASE,'utf8'),base=await resolve(text);const policy=await resolvePrintingPolicyV08({printingFamily:'Final Fantasy',includePromos:true,includeSpecialReleases:true});
 if(base.parsed.totalCards!==100||base.notFound.length||!validateCommanderDeck(base.parsed,base.cards).isLegal||!base.cards.every(c=>printingMatchesPolicyV08(c,policy,AS_OF)))throw new Error('A11 hard truth failed');
 const baseSims=SCENARIOS.map(s=>signal(sim(base,s)));const m0=buildDeckMetrics(base.parsed,base.cards);const locked=['the destined white mage','walking ballista','diabolic intent','ranger-captain of eos','papalymo totolymo'];
 const results=[];
 for(const cut of CUTS){
  const d=await resolve(replaceOne(text,cut));const m=buildDeckMetrics(d.parsed,d.cards);const legal=validateCommanderDeck(d.parsed,d.cards).isLegal,ff=d.cards.every(c=>printingMatchesPolicyV08(c,policy,AS_OF));const md=mean(SCENARIOS.map((s,i)=>delta(baseSims[i]!,signal(sim(d,s)))));const ns=names(d);const combo=locked.every(x=>ns.has(x));const pass=legal&&ff&&combo&&d.parsed.totalCards===100&&m.landCount===m0.landCount&&m.rampCount>=m0.rampCount-1&&md.keep>=-1.0&&md.uptime>=-2.5&&md.protection>=-4.0&&md.spells>=-0.16&&md.draws>=-0.22;
  results.push({cut,pass,meanDelta:md,metricsDelta:{mv:m.averageNonlandManaValue-m0.averageNonlandManaValue,ramp:m.rampCount-m0.rampCount,interaction:m.interactionCount-m0.interactionCount,protection:m.protectionCount-m0.protectionCount,early:m.earlyPlayCount-m0.earlyPlayCount},party:partyMap(d),engine:engineState(d)});
 }
 results.sort((a,b)=>Number(b.pass)-Number(a.pass)||b.meanDelta.spells-a.meanDelta.spells||b.meanDelta.draws-a.meanDelta.draws||b.meanDelta.protection-a.meanDelta.protection);
 const report={status:'exploratory-black-mage-isolation',base:{metrics:m0,party:partyMap(base),engine:engineState(base)},blackMage:{oracleSummary:'{2}{B} 3/2 legendary Human Wizard, deathtouch; whenever you cast a noncreature spell it deals 1 to each opponent, or 3 with a full party.'},results,manualBoundary:'V0.6 does not fully model Y\'shtola end-step 4-life threshold or The Destined Black Mage damage triggers. Mean deltas primarily measure the opportunity cost of each cut. Black Mage synergy must be manually credited after regression screening.'};
 await writeFile('scions-spellcraft-a13-black-mage.json',JSON.stringify(report,null,2));
 const md=['# Scions & Spellcraft A13 — The Destined Black Mage','',`Baseline party types: ${JSON.stringify(report.base.party)}`,'',...results.map(r=>`## ${r.cut} -> The Destined Black Mage\n- Screen: **${r.pass?'PASS':'REVIEW'}**\n- Δ spells: ${r.meanDelta.spells.toFixed(3)}\n- Δ effect-draws: ${r.meanDelta.draws.toFixed(3)}\n- Δ commander uptime: ${r.meanDelta.uptime.toFixed(3)}\n- Δ protection: ${r.meanDelta.protection.toFixed(3)}\n- Party Cleric/Rogue/Warrior/Wizard: ${r.party.Cleric.length}/${r.party.Rogue.length}/${r.party.Warrior.length}/${r.party.Wizard.length}`),'','Manual synergy credit: with Y\'shtola + Papalymo + Black Mage, one MV3+ noncreature spell makes each opponent lose 4 life (2+1+1), turning on Y\'shtola\'s end-step draw threshold from a single qualifying cast. With a full party, Black Mage deals 3 instead, so Y\'shtola + Black Mage alone reaches 5.',''].join('\n');
 await writeFile('scions-spellcraft-a13-black-mage.md',md);console.log(md);
}
await main();
