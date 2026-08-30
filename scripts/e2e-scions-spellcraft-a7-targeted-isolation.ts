import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06, type PodPressureV06 } from '../src/services/simulation-v06.js';

const DECK='test-results/exploratory/scions-spellcraft-a5-deck.txt';
const AS_OF='2026-08-31';
type Candidate={name:string;set:string;collector:string};
type Test={id:string;cut:string;add:Candidate;manualClass:string};
const C={
 stroke:{name:'Stroke of Midnight',set:'FCA',collector:'26'},
 seph:{name:"Sephiroth's Intervention",set:'FIN',collector:'116'},
 veto:{name:"Dovin's Veto",set:'FCA',collector:'51'},
 counter:{name:'Counterspell',set:'FCA',collector:'4'},
 denial:{name:'Arcane Denial',set:'RFIN',collector:'J2'},
 silence:{name:'Silence',set:'SLD',collector:'7003'},
 offer:{name:"An Offer You Can't Refuse",set:'FIC',collector:'267'},
 rift:{name:'Cyclonic Rift',set:'SLD',collector:'1869'},
 cryptic:{name:'Cryptic Command',set:'FCA',collector:'29'},
 damn:{name:'Damn',set:'SLD',collector:'1870'},
 brainstorm:{name:'Brainstorm',set:'FCA',collector:'28'},
} as const;
const TESTS:Test[]=[
 {id:'rider_to_stroke',cut:'Murderous Rider',add:C.stroke,manualClass:'broader MV3 instant removal; Swift End baseline already qualifies Ystola'},
 {id:'rider_to_seph',cut:'Murderous Rider',add:C.seph,manualClass:'MV4 instant creature removal + lifegain/White Mage trigger'},
 {id:'scythe_to_stroke',cut:"Reaper's Scythe",add:C.stroke,manualClass:'replace combat-only MV3 trigger with MV3 broad instant interaction'},
 {id:'scythe_to_seph',cut:"Reaper's Scythe",add:C.seph,manualClass:'replace combat-only MV3 trigger with MV4 instant + lifegain'},
 {id:'scythe_to_veto',cut:"Reaper's Scythe",add:C.veto,manualClass:'lose one Ystola trigger; gain efficient uncounterable combo/control protection'},
 {id:'scythe_to_counterspell',cut:"Reaper's Scythe",add:C.counter,manualClass:'lose one Ystola trigger; gain universal two-mana counter'},
 {id:'scythe_to_denial',cut:"Reaper's Scythe",add:C.denial,manualClass:'lose one Ystola trigger; gain flexible two-mana counter'},
 {id:'scythe_to_silence',cut:"Reaper's Scythe",add:C.silence,manualClass:'lose one Ystola trigger; gain one-mana proactive combo protection'},
 {id:'scythe_to_offer',cut:"Reaper's Scythe",add:C.offer,manualClass:'lose one Ystola trigger; gain one-mana noncreature counter'},
 {id:'scythe_to_rift',cut:"Reaper's Scythe",add:C.rift,manualClass:'lose one Ystola trigger; gain premium bounce/overload reset'},
 {id:'scythe_to_cryptic',cut:"Reaper's Scythe",add:C.cryptic,manualClass:'retain Ystola trigger; gain flexible MV4 instant'},
 {id:'scythe_to_brainstorm',cut:"Reaper's Scythe",add:C.brainstorm,manualClass:'lose one trigger; gain one-mana selection/combo smoothing'},
 {id:'tome_to_veto',cut:'Tome of Legends',add:C.veto,manualClass:'trade slow commander-page draw for combo/control protection'},
 {id:'tome_to_counterspell',cut:'Tome of Legends',add:C.counter,manualClass:'trade slow draw for universal stack interaction'},
 {id:'tome_to_denial',cut:'Tome of Legends',add:C.denial,manualClass:'trade slow draw for flexible counter'},
 {id:'tome_to_silence',cut:'Tome of Legends',add:C.silence,manualClass:'trade slow draw for proactive combo protection'},
 {id:'tome_to_offer',cut:'Tome of Legends',add:C.offer,manualClass:'trade slow draw for one-mana stack interaction'},
 {id:'tome_to_rift',cut:'Tome of Legends',add:C.rift,manualClass:'trade slow draw for premium reset'},
 {id:'tome_to_brainstorm',cut:'Tome of Legends',add:C.brainstorm,manualClass:'trade slow commander-page draw for immediate selection'},
 {id:'thancred_to_veto',cut:'Thancred Waters',add:C.veto,manualClass:'trade five-mana persistent legendary protection for cheap stack protection'},
 {id:'thancred_to_silence',cut:'Thancred Waters',add:C.silence,manualClass:'trade five-mana protection body for proactive combo protection'},
 {id:'final_judgment_to_damn',cut:'Final Judgment',add:C.damn,manualClass:'trade exile wipe/Ystola trigger for cheaper flexible wipe'},
 {id:'cleansing_nova_to_damn',cut:'Cleansing Nova',add:C.damn,manualClass:'trade modal MV5 wipe/Ystola trigger for cheaper flexible wipe'},
];
const SCENARIOS:Array<{pressure:PodPressureV06;turns:number;seed:number}>=[
 {pressure:'upgraded',turns:5,seed:20260831},{pressure:'upgraded',turns:7,seed:20260911},
 {pressure:'optimized',turns:5,seed:20260927},{pressure:'optimized',turns:7,seed:20261023},
 {pressure:'cedh',turns:5,seed:20261117},{pressure:'cedh',turns:7,seed:20261227},{pressure:'cedh',turns:9,seed:20270207},
];
const norm=(v:string)=>v.trim().toLocaleLowerCase();
const rec=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:0;
const avg=(v:readonly number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;
interface Deck{parsed:ParsedDeck;cards:ScryfallCard[];text:string;}
function ids(p:ParsedDeck):CardIdentifierInput[]{return [...p.commanders,...p.main].map(e=>({name:e.name,...(e.set?{set:e.set}:{}),...(e.collectorNumber?{collectorNumber:e.collectorNumber}:{})}));}
async function resolve(text:string):Promise<Deck>{const parsed=parseDecklist(text);const r=await getCardsByIdentifiers(ids(parsed));if(r.notFound.length)throw new Error(`unresolved:${r.notFound.join('|')}`);return{parsed,cards:r.cards,text};}
function lineFor(c:Candidate){return `1 ${c.name} (${c.set}) ${c.collector}`;}
function replaceCard(text:string,cut:string,add:Candidate):string{const lines=text.split('\n');const idx=lines.findIndex(line=>line.startsWith('1 ')&&norm(line.replace(/^1\s+/, '').replace(/\s+\([A-Z0-9]+\)\s+\S+\s*$/, ''))===norm(cut));if(idx<0)throw new Error(`missing cut ${cut}`);lines[idx]=lineFor(add);return lines.join('\n');}
function cardByName(d:Deck,name:string){return d.cards.find(c=>norm(c.name)===norm(name)||norm(c.name.split(' // ')[0]??'')===norm(name));}
function manaValueFromCost(cost:string):number{
 let total=0;
 for(const m of cost.matchAll(/\{([^}]+)\}/g)){
   const sym=(m[1]??'').toUpperCase();
   if(/^\d+$/.test(sym)){total+=Number(sym);continue;}
   if(sym==='X')continue;
   if(sym.includes('/')){const nums=sym.split('/').filter(x=>/^\d+$/.test(x)).map(Number);total+=nums.length?Math.max(...nums):1;continue;}
   total+=1;
 }
 return total;
}
function hasQualifyingSpellFace(c:ScryfallCard|undefined):boolean{
 if(!c)return false;
 const faces=c.card_faces??[];
 if(faces.length>0){return faces.some(f=>{const t=(f.type_line??'').toLowerCase();return !t.includes('creature')&&!t.includes('land')&&manaValueFromCost(f.mana_cost??'')>=3;});}
 const t=c.type_line.toLowerCase();return !t.includes('creature')&&!t.includes('land')&&c.cmc>=3;
}
function ystolaOfferCount(d:Deck){let count=0;for(const e of d.parsed.main){if(hasQualifyingSpellFace(cardByName(d,e.name)))count+=e.quantity;}return count;}
interface Signal{keep:number;uptime:number;protection:number;spells:number;draws:number;}
function signal(r:Record<string,unknown>):Signal{const b=rec(r.baseline),a=rec(r.advanced);return{keep:num(rec(b.openingHands).functionalKeepRate),uptime:num(rec(a.commanderPressure).battlefieldUptimePercent),protection:num(rec(a.interactionPressure).protectionWinRateWhenChallenged),spells:num(rec(a.cardFlow).averageSpellsCast),draws:num(rec(a.cardFlow).averageCardsDrawnByEffects)};}
function delta(a:Signal,b:Signal):Signal{return{keep:b.keep-a.keep,uptime:b.uptime-a.uptime,protection:b.protection-a.protection,spells:b.spells-a.spells,draws:b.draws-a.draws};}
function mean(v:Signal[]):Signal{return{keep:avg(v.map(x=>x.keep)),uptime:avg(v.map(x=>x.uptime)),protection:avg(v.map(x=>x.protection)),spells:avg(v.map(x=>x.spells)),draws:avg(v.map(x=>x.draws))};}
function sim(d:Deck,s:{pressure:PodPressureV06;turns:number;seed:number}){return simulateDeckGameplayV06(d.parsed,d.cards,{iterations:1100,advancedIterations:1100,turns:s.turns,seed:s.seed,pressure:s.pressure}) as unknown as Record<string,unknown>;}
function comboLocked(d:Deck){const n=new Set(d.parsed.main.map(e=>norm(e.name)));return ['the destined white mage','walking ballista','diabolic intent','ranger-captain of eos'].every(x=>n.has(x));}
async function main(){
 const text=await readFile(DECK,'utf8'),base=await resolve(text),policy=await resolvePrintingPolicyV08({printingFamily:'Final Fantasy',includePromos:true,includeSpecialReleases:true});
 if(base.parsed.totalCards!==100||!validateCommanderDeck(base.parsed,base.cards).isLegal||!base.cards.every(c=>printingMatchesPolicyV08(c,policy,AS_OF)))throw new Error('A5 hard truth failed');
 const baseSims=SCENARIOS.map(s=>signal(sim(base,s))),m0=buildDeckMetrics(base.parsed,base.cards),y0=ystolaOfferCount(base);const results=[];
 for(const t of TESTS){
   const d=await resolve(replaceCard(text,t.cut,t.add));const legal=validateCommanderDeck(d.parsed,d.cards).isLegal,ff=d.cards.every(c=>printingMatchesPolicyV08(c,policy,AS_OF));const m=buildDeckMetrics(d.parsed,d.cards),y=ystolaOfferCount(d);const md=mean(SCENARIOS.map((s,i)=>delta(baseSims[i]!,signal(sim(d,s)))));
   const pass=legal&&ff&&comboLocked(d)&&d.parsed.totalCards===100&&m.landCount===m0.landCount&&m.rampCount>=m0.rampCount-1&&m.protectionCount>=m0.protectionCount-1&&md.keep>=-1.5&&md.uptime>=-4&&md.protection>=-7&&md.spells>=-0.22&&md.draws>=-0.32&&y>=y0-1;
   results.push({id:t.id,cut:t.cut,add:t.add,manualClass:t.manualClass,pass,meanDelta:md,ystolaOfferDelta:y-y0,metricsDelta:{mv:m.averageNonlandManaValue-m0.averageNonlandManaValue,ramp:m.rampCount-m0.rampCount,interaction:m.interactionCount-m0.interactionCount,protection:m.protectionCount-m0.protectionCount,early:m.earlyPlayCount-m0.earlyPlayCount}});
 }
 results.sort((a,b)=>Number(b.pass)-Number(a.pass)||b.meanDelta.protection-a.meanDelta.protection||b.meanDelta.spells-a.meanDelta.spells||b.meanDelta.draws-a.meanDelta.draws);
 const report={status:'exploratory-targeted-isolation-corrected-adventure-mv',base:{metrics:m0,ystolaSpellOffers:y0},results,boundary:'Simulation is a regression guard. Adventure spell-face mana values are explicitly reconstructed from mana costs for Ystola opportunity accounting. Combo package remains locked. No result is accepted without card-text/manual lost-slot review.'};
 await writeFile('scions-spellcraft-a7-targeted-isolation.json',JSON.stringify(report,null,2));
 const md=['# Scions & Spellcraft A7 — Targeted Interaction Isolation (Corrected Adventure MV)','',`- Base Y\'shtola spell-offer count (Adventure-aware): ${y0}`,`- Combo package locked: White Mage + Ballista + Intent + Ranger`,'',...results.map(r=>`## ${r.id}: ${r.cut} -> ${r.add.name} (${r.add.set}) ${r.add.collector}\n- Screen: **${r.pass?'PASS':'REVIEW'}**\n- Manual class: ${r.manualClass}\n- Δ spells: ${r.meanDelta.spells.toFixed(3)}\n- Δ effect-draws: ${r.meanDelta.draws.toFixed(3)}\n- Δ commander uptime: ${r.meanDelta.uptime.toFixed(3)}\n- Δ protection: ${r.meanDelta.protection.toFixed(3)}\n- Δ Y'shtola spell-offers: ${r.ystolaOfferDelta>=0?'+':''}${r.ystolaOfferDelta}\n- Δ ramp / interaction / protection: ${r.metricsDelta.ramp>=0?'+':''}${r.metricsDelta.ramp} / ${r.metricsDelta.interaction>=0?'+':''}${r.metricsDelta.interaction} / ${r.metricsDelta.protection>=0?'+':''}${r.metricsDelta.protection}`),'','Boundary: a PASS means the variant survived regression screening, not that the swap is automatically strategically correct.',''].join('\n');await writeFile('scions-spellcraft-a7-targeted-isolation.md',md);console.log(md);
}
await main();
