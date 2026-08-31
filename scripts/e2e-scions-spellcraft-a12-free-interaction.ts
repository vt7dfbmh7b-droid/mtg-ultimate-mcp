import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06, type PodPressureV06 } from '../src/services/simulation-v06.js';

const BASE='test-results/exploratory/scions-spellcraft-a11-control-deck.txt';
const AS_OF='2026-08-31';
type Add={name:string;set:string;collector:string;color:'W'|'U'|'B'};
type Swap={cut:string;add:Add};
const SUBTLETY:Add={name:'Subtlety',set:'SLD',collector:'7005',color:'U'};
const SOLITUDE:Add={name:'Solitude',set:'SLD',collector:'7004',color:'W'};
const GRIEF:Add={name:'Grief',set:'SLD',collector:'7006',color:'B'};
const V:Record<string,Swap[]>={
  subtlety_thancred:[{cut:'Thancred Waters',add:SUBTLETY}],
  subtlety_tataru:[{cut:'Tataru Taru',add:SUBTLETY}],
  subtlety_krile:[{cut:'Krile Baldesion',add:SUBTLETY}],
  subtlety_hermes:[{cut:'Hermes, Overseer of Elpis',add:SUBTLETY}],
  solitude_thancred:[{cut:'Thancred Waters',add:SOLITUDE}],
  solitude_tataru:[{cut:'Tataru Taru',add:SOLITUDE}],
  solitude_krile:[{cut:'Krile Baldesion',add:SOLITUDE}],
  solitude_hermes:[{cut:'Hermes, Overseer of Elpis',add:SOLITUDE}],
  grief_thancred:[{cut:'Thancred Waters',add:GRIEF}],
  grief_tataru:[{cut:'Tataru Taru',add:GRIEF}],
  subtlety_solitude_thancred_tataru:[{cut:'Thancred Waters',add:SUBTLETY},{cut:'Tataru Taru',add:SOLITUDE}],
  subtlety_solitude_thancred_krile:[{cut:'Thancred Waters',add:SUBTLETY},{cut:'Krile Baldesion',add:SOLITUDE}],
  subtlety_solitude_thancred_hermes:[{cut:'Thancred Waters',add:SUBTLETY},{cut:'Hermes, Overseer of Elpis',add:SOLITUDE}],
  all_three_thancred_tataru_krile:[{cut:'Thancred Waters',add:SUBTLETY},{cut:'Tataru Taru',add:SOLITUDE},{cut:'Krile Baldesion',add:GRIEF}],
};
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
function lineFor(a:Add){return `1 ${a.name} (${a.set}) ${a.collector}`;}
function replaceOne(text:string,cut:string,add:Add){const lines=text.split('\n');const i=lines.findIndex(l=>l.startsWith('1 ')&&norm(l.replace(/^1\s+/, '').replace(/\s+\([A-Z0-9]+\)\s+\S+\s*$/, ''))===norm(cut));if(i<0)throw new Error(`missing cut ${cut}`);lines[i]=lineFor(add);return lines.join('\n');}
function apply(text:string,swaps:Swap[]){let out=text;for(const s of swaps)out=replaceOne(out,s.cut,s.add);return out;}
function names(d:Deck){return new Set(d.parsed.main.map(e=>norm(e.name)));}
function colorPitchCount(d:Deck,color:'W'|'U'|'B'){let n=0;for(const e of d.parsed.main){const card=d.cards.find(c=>norm(c.name)===norm(e.name)||norm(c.name.split(' // ')[0]??'')===norm(e.name));if(card?.colors?.includes(color))n+=e.quantity;}return n;}
function freeInteractionCount(d:Deck){const n=names(d);return ['force of negation','snuff out','subtlety','solitude','grief','clever concealment','lethal scheme'].filter(x=>n.has(x)).length;}
interface Signal{keep:number;uptime:number;protection:number;spells:number;draws:number;}
function signal(r:Record<string,unknown>):Signal{const b=rec(r.baseline),a=rec(r.advanced);return{keep:num(rec(b.openingHands).functionalKeepRate),uptime:num(rec(a.commanderPressure).battlefieldUptimePercent),protection:num(rec(a.interactionPressure).protectionWinRateWhenChallenged),spells:num(rec(a.cardFlow).averageSpellsCast),draws:num(rec(a.cardFlow).averageCardsDrawnByEffects)};}
function delta(a:Signal,b:Signal):Signal{return{keep:b.keep-a.keep,uptime:b.uptime-a.uptime,protection:b.protection-a.protection,spells:b.spells-a.spells,draws:b.draws-a.draws};}
function mean(v:Signal[]):Signal{return{keep:avg(v.map(x=>x.keep)),uptime:avg(v.map(x=>x.uptime)),protection:avg(v.map(x=>x.protection)),spells:avg(v.map(x=>x.spells)),draws:avg(v.map(x=>x.draws))};}
function sim(d:Deck,s:{pressure:PodPressureV06;turns:number;seed:number}){return simulateDeckGameplayV06(d.parsed,d.cards,{iterations:1500,advancedIterations:1500,turns:s.turns,seed:s.seed,pressure:s.pressure}) as unknown as Record<string,unknown>;}
async function main(){
 const text=await readFile(BASE,'utf8'),base=await resolve(text);const policy=await resolvePrintingPolicyV08({printingFamily:'Final Fantasy',includePromos:true,includeSpecialReleases:true});
 if(base.parsed.totalCards!==100||base.notFound.length||!validateCommanderDeck(base.parsed,base.cards).isLegal||!base.cards.every(c=>printingMatchesPolicyV08(c,policy,AS_OF)))throw new Error('A11 hard truth failed');
 const baseSims=SCENARIOS.map(s=>signal(sim(base,s)));const m0=buildDeckMetrics(base.parsed,base.cards);const locked=['the destined white mage','walking ballista','diabolic intent','ranger-captain of eos'];const results=[];
 for(const [id,swaps] of Object.entries(V)){
  const d=await resolve(apply(text,swaps));const legal=validateCommanderDeck(d.parsed,d.cards).isLegal,ff=d.cards.every(c=>printingMatchesPolicyV08(c,policy,AS_OF));const m=buildDeckMetrics(d.parsed,d.cards);const md=mean(SCENARIOS.map((s,i)=>delta(baseSims[i]!,signal(sim(d,s)))));const ns=names(d);const combo=locked.every(x=>ns.has(x));
  const pitch={W:colorPitchCount(d,'W'),U:colorPitchCount(d,'U'),B:colorPitchCount(d,'B')};const free=freeInteractionCount(d);
  const pass=legal&&ff&&combo&&d.parsed.totalCards===100&&m.landCount===m0.landCount&&m.rampCount>=m0.rampCount-1&&md.keep>=-1.5&&md.uptime>=-4&&md.protection>=-7&&md.spells>=-0.22&&md.draws>=-0.32;
  results.push({id,pass,swaps:swaps.map(s=>({cut:s.cut,add:s.add.name})),meanDelta:md,pitchableCards:pitch,freeInteractionCount:free,metricsDelta:{mv:m.averageNonlandManaValue-m0.averageNonlandManaValue,ramp:m.rampCount-m0.rampCount,interaction:m.interactionCount-m0.interactionCount,protection:m.protectionCount-m0.protectionCount,early:m.earlyPlayCount-m0.earlyPlayCount}});
 }
 results.sort((a,b)=>Number(b.pass)-Number(a.pass)||b.meanDelta.protection-a.meanDelta.protection||b.meanDelta.spells-a.meanDelta.spells||b.meanDelta.draws-a.meanDelta.draws);
 const report={status:'exploratory-free-interaction-isolation',base:{metrics:m0,pitchableCards:{W:colorPitchCount(base,'W'),U:colorPitchCount(base,'U'),B:colorPitchCount(base,'B')},freeInteractionCount:freeInteractionCount(base)},results,manualBoundary:'The gameplay simulator may under-model evoke alternative costs. Results are regression guards for the cut cost; free-interaction utility must be manually credited. Subtlety is creature/planeswalker-stack interaction; Solitude is creature removal; Grief is one-opponent hand disruption.'};
 await writeFile('scions-spellcraft-a12-free-interaction.json',JSON.stringify(report,null,2));
 const md=['# Scions & Spellcraft A12 — Free Interaction Isolation','',`- A11 free/near-free interaction count: ${report.base.freeInteractionCount}`,`- A11 pitch density W/U/B: ${report.base.pitchableCards.W}/${report.base.pitchableCards.U}/${report.base.pitchableCards.B}`,'',...results.map(r=>`## ${r.id}\n- Screen: **${r.pass?'PASS':'REVIEW'}**\n- Swaps: ${r.swaps.map(s=>`${s.cut} -> ${s.add}`).join('; ')}\n- Δ spells: ${r.meanDelta.spells.toFixed(3)}\n- Δ effect-draws: ${r.meanDelta.draws.toFixed(3)}\n- Δ commander uptime: ${r.meanDelta.uptime.toFixed(3)}\n- Δ protection: ${r.meanDelta.protection.toFixed(3)}\n- Pitch density W/U/B: ${r.pitchableCards.W}/${r.pitchableCards.U}/${r.pitchableCards.B}\n- Free/near-free interaction count: ${r.freeInteractionCount}`),'','Boundary: simulator does not receive automatic authority over evoke value; final choice requires manual card-function review.',''].join('\n');
 await writeFile('scions-spellcraft-a12-free-interaction.md',md);console.log(md);
}
await main();
