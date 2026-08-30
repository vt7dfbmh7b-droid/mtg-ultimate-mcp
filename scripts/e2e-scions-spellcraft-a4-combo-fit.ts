import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, inferCardRoles, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06, type PodPressureV06 } from '../src/services/simulation-v06.js';

const STOCK='test-results/exploratory/scions-spellcraft-stock-deck.txt';
const AS_OF='2026-08-31';
type Swap={cut:string;add:string};
const BASE:Swap[]=[
 {cut:"1 Sage's Nouliths (FIN) 70",add:'1 Rhystic Study (FCA) 31'},
 {cut:"1 Dancer's Chakrams (FIC) 17",add:"1 Akroma's Will (FCA) 21"},
 {cut:'1 Summon: Good King Mog XII (FIC) 26',add:'1 Force of Negation (RFIN) J1'},
 {cut:"1 Astrologian's Planisphere (FIN) 46",add:'1 Swiftfoot Boots (FIC) 361'},
 {cut:'1 Hildibrand Manderville (FIC) 83',add:'1 Swallowed by Leviathan (FIN) 79'},
 {cut:'1 Temple of the False God (FIC) 438',add:'1 Command Beacon (FCA) 64'},
 {cut:'1 Eye of Nidhogg (FIC) 44',add:'1 Clever Concealment (FIC) 236'},
];
const WM='1 The Destined White Mage (FIC) 444';
const BALLISTA='1 Walking Ballista (FIC) 371';
const RANGER='1 Ranger-Captain of Eos (FCA) 2';
const INTENT='1 Diabolic Intent (FCA) 34';
const V:Record<string,Swap[]>={
 pair_ardbert_estinien:[...BASE,{cut:'1 Ardbert, Warrior of Darkness (FIC) 77',add:WM},{cut:'1 Estinien Varlineau (FIC) 82',add:BALLISTA}],
 pair_ardbert_tataru:[...BASE,{cut:'1 Ardbert, Warrior of Darkness (FIC) 77',add:WM},{cut:'1 Tataru Taru (FIC) 30',add:BALLISTA}],
 pair_reaper_ardbert:[...BASE,{cut:"1 Reaper's Scythe (FIC) 48",add:WM},{cut:'1 Ardbert, Warrior of Darkness (FIC) 77',add:BALLISTA}],
 pair_estinien_ardbert:[...BASE,{cut:'1 Estinien Varlineau (FIC) 82',add:WM},{cut:'1 Ardbert, Warrior of Darkness (FIC) 77',add:BALLISTA}],
 pairA_plus_ranger:[...BASE,{cut:'1 Ardbert, Warrior of Darkness (FIC) 77',add:WM},{cut:'1 Estinien Varlineau (FIC) 82',add:BALLISTA},{cut:'1 Tataru Taru (FIC) 30',add:RANGER}],
 pairA_plus_intent:[...BASE,{cut:'1 Ardbert, Warrior of Darkness (FIC) 77',add:WM},{cut:'1 Estinien Varlineau (FIC) 82',add:BALLISTA},{cut:'1 Cut a Deal (FIC) 238',add:INTENT}],
 pairA_full_support:[...BASE,{cut:'1 Ardbert, Warrior of Darkness (FIC) 77',add:WM},{cut:'1 Estinien Varlineau (FIC) 82',add:BALLISTA},{cut:'1 Tataru Taru (FIC) 30',add:RANGER},{cut:'1 Cut a Deal (FIC) 238',add:INTENT}],
 pairB_full_support:[...BASE,{cut:'1 Ardbert, Warrior of Darkness (FIC) 77',add:WM},{cut:'1 Tataru Taru (FIC) 30',add:BALLISTA},{cut:'1 Estinien Varlineau (FIC) 82',add:RANGER},{cut:'1 Cut a Deal (FIC) 238',add:INTENT}],
};
const SCENARIOS:Array<{pressure:PodPressureV06;turns:number;seed:number}>=[
 {pressure:'upgraded',turns:5,seed:20260831},{pressure:'upgraded',turns:7,seed:20260909},
 {pressure:'optimized',turns:5,seed:20260923},{pressure:'optimized',turns:7,seed:20261019},
 {pressure:'cedh',turns:5,seed:20261113},{pressure:'cedh',turns:7,seed:20261221},{pressure:'cedh',turns:9,seed:20270202},
];
const norm=(v:string)=>v.trim().toLowerCase();
const rec=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:0;
const avg=(v:number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;
interface Deck{parsed:ParsedDeck;cards:ScryfallCard[];text:string;}
function ids(p:ParsedDeck):CardIdentifierInput[]{return [...p.commanders,...p.main].map(e=>({name:e.name,...(e.set?{set:e.set}:{}),...(e.collectorNumber?{collectorNumber:e.collectorNumber}:{})}));}
async function resolve(text:string):Promise<Deck>{const parsed=parseDecklist(text);const r=await getCardsByIdentifiers(ids(parsed));if(r.notFound.length)throw new Error(`unresolved:${r.notFound.join('|')}`);return{parsed,cards:r.cards,text};}
function entryCard(e:{name:string;set?:string;collectorNumber?:string},cards:readonly ScryfallCard[]):ScryfallCard|undefined{if(e.set&&e.collectorNumber){const x=cards.find(c=>norm(c.set)===norm(e.set??'')&&norm(c.collector_number)===norm(e.collectorNumber??''));if(x)return x;}return cards.find(c=>norm(c.name)===norm(e.name)||norm(c.name.split(' // ')[0]??'')===norm(e.name));}
function synergy(d:Deck){let qualifying=0,instants=0,interaction=0,draw=0,protection=0,creatures=0,lifeGain=0;for(const e of d.parsed.main){const c=entryCard(e,d.cards);if(!c)continue;const t=c.type_line.toLowerCase(),isCreature=t.includes('creature');if(isCreature)creatures+=e.quantity;const roles=new Set(inferCardRoles(c));const q=!isCreature&&!t.includes('land')&&c.cmc>=3;if(q){qualifying+=e.quantity;if(t.includes('instant'))instants+=e.quantity;if(roles.has('countermagic')||roles.has('spot interaction')||roles.has('board wipe')||roles.has('free interaction'))interaction+=e.quantity;}if(roles.has('card draw')||roles.has('repeatable draw')||roles.has('card selection'))draw+=e.quantity;if(roles.has('protection')||roles.has('board protection'))protection+=e.quantity;const text=(c.oracle_text??'').toLowerCase();if(text.includes('you gain')||text.includes('lifelink'))lifeGain+=e.quantity;}return{qualifying,instants,interaction,draw,protection,creatures,lifeGain};}
interface Signal{keep:number;uptime:number;protection:number;spells:number;draws:number;}
function signal(r:Record<string,unknown>):Signal{const b=rec(r.baseline),a=rec(r.advanced);return{keep:num(rec(b.openingHands).functionalKeepRate),uptime:num(rec(a.commanderPressure).battlefieldUptimePercent),protection:num(rec(a.interactionPressure).protectionWinRateWhenChallenged),spells:num(rec(a.cardFlow).averageSpellsCast),draws:num(rec(a.cardFlow).averageCardsDrawnByEffects)};}
function delta(a:Signal,b:Signal):Signal{return{keep:b.keep-a.keep,uptime:b.uptime-a.uptime,protection:b.protection-a.protection,spells:b.spells-a.spells,draws:b.draws-a.draws};}
function mean(v:Signal[]):Signal{return{keep:avg(v.map(x=>x.keep)),uptime:avg(v.map(x=>x.uptime)),protection:avg(v.map(x=>x.protection)),spells:avg(v.map(x=>x.spells)),draws:avg(v.map(x=>x.draws))};}
function sim(d:Deck,s:{pressure:PodPressureV06;turns:number;seed:number}){return simulateDeckGameplayV06(d.parsed,d.cards,{iterations:1100,advancedIterations:1100,turns:s.turns,seed:s.seed,pressure:s.pressure}) as unknown as Record<string,unknown>;}
function apply(text:string,swaps:readonly Swap[]):string{let out=text;for(const s of swaps){if(!out.includes(s.cut))throw new Error(`missing cut ${s.cut}`);out=out.replace(s.cut,s.add);}return out;}
function nameSet(d:Deck){return new Set(d.parsed.main.map(e=>norm(e.name)));}
function comboAccess(names:Set<string>,visible:number,seed:number):number{
 const deck=[...names]; const N=30000; let hit=0; let x=seed>>>0; const rand=()=>((x=(Math.imul(1664525,x)+1013904223)>>>0)/4294967296);
 for(let i=0;i<N;i++){
   const arr=deck.slice(); for(let j=arr.length-1;j>0;j--){const k=Math.floor(rand()*(j+1));[arr[j],arr[k]]=[arr[k]!,arr[j]!];}
   const seen=new Set(arr.slice(0,Math.min(visible,arr.length)));
   const w=seen.has(norm('The Destined White Mage'));
   const b=seen.has(norm('Walking Ballista'))||seen.has(norm('Ranger-Captain of Eos'));
   const intent=seen.has(norm('Diabolic Intent'));
   if((w&&b)||(intent&&(w||b))||(intent&&seen.has(norm('Ranger-Captain of Eos')))) hit++;
 }
 return hit/N;
}
async function main(){
 const stockText=await readFile(STOCK,'utf8');const base=await resolve(apply(stockText,BASE));const policy=await resolvePrintingPolicyV08({printingFamily:'Final Fantasy',includePromos:true,includeSpecialReleases:true});
 if(!validateCommanderDeck(base.parsed,base.cards).isLegal)throw new Error('base illegal');if(!base.cards.every(c=>printingMatchesPolicyV08(c,policy,AS_OF)))throw new Error('base FF policy');
 const baseSims=SCENARIOS.map(s=>signal(sim(base,s))),s0=synergy(base),m0=buildDeckMetrics(base.parsed,base.cards);const results=[];
 for(const [id,swaps] of Object.entries(V)){
   const d=await resolve(apply(stockText,swaps));const legal=validateCommanderDeck(d.parsed,d.cards).isLegal,ff=d.cards.every(c=>printingMatchesPolicyV08(c,policy,AS_OF));const sy=synergy(d),m=buildDeckMetrics(d.parsed,d.cards);const ds=SCENARIOS.map((s,i)=>delta(baseSims[i]!,signal(sim(d,s))));const md=mean(ds);const ns=nameSet(d);const pieces=ns.has(norm('The Destined White Mage'))&&ns.has(norm('Walking Ballista'));
   const access={turn5:comboAccess(ns,12,20260831),turn7:comboAccess(ns,14,20260907),turn9:comboAccess(ns,16,20260919)};
   const pass=legal&&ff&&pieces&&d.parsed.totalCards===100&&md.keep>=-2.0&&md.uptime>=-5&&md.protection>=-8&&md.spells>=-0.30&&md.draws>=-0.40&&(sy.qualifying>=s0.qualifying-1);
   results.push({id,pass,swaps:swaps.slice(BASE.length).map(s=>({cut:s.cut.replace(/^1 /,''),add:s.add.replace(/^1 /,'')})),meanDelta:md,comboAccess:access,synergyDelta:{qualifying:sy.qualifying-s0.qualifying,instants:sy.instants-s0.instants,interaction:sy.interaction-s0.interaction,draw:sy.draw-s0.draw,protection:sy.protection-s0.protection,creatures:sy.creatures-s0.creatures,lifeGain:sy.lifeGain-s0.lifeGain},metrics:{mv:m.averageNonlandManaValue,land:m.landCount,ramp:m.rampCount,interaction:m.interactionCount,protection:m.protectionCount,early:m.earlyPlayCount}});
 }
 results.sort((a,b)=>Number(b.pass)-Number(a.pass)||b.comboAccess.turn7-a.comboAccess.turn7||b.meanDelta.spells-a.meanDelta.spells);
 const report={base:{swaps:BASE.map(s=>({cut:s.cut.replace(/^1 /,''),add:s.add.replace(/^1 /,'')})),synergy:s0,metrics:m0},results,comboRules:{whiteMage:'Give Walking Ballista lifelink; each damage event gains life and replaces a removed +1/+1 counter.',ballistaRequirement:'Ballista must retain at least one counter after paying the first remove-a-counter cost, so the practical loop starts with at least two counters.',haste:'White Mage must be able to tap; Swiftfoot Boots in the base shell can enable a same-turn attempt.'},boundary:'Combo access is an assembly proxy, not a goldfish win-rate. Manual Scions spellcraft identity remains authoritative.'};
 await writeFile('scions-spellcraft-a4-combo-fit.json',JSON.stringify(report,null,2));
 const md=['# Scions & Spellcraft A4 — White Mage / Ballista Combo Fit','',`Base qualifying Y\'shtola spells: ${s0.qualifying}`,`Base creatures: ${s0.creatures}`,'',...results.map(r=>`## ${r.id}\n- Screen: **${r.pass?'PASS':'REVIEW'}**\n- Changes beyond A3 shell: ${r.swaps.map(s=>`${s.cut} -> ${s.add}`).join('; ')}\n- Δ spells: ${r.meanDelta.spells.toFixed(3)}\n- Δ effect-draws: ${r.meanDelta.draws.toFixed(3)}\n- Δ commander uptime: ${r.meanDelta.uptime.toFixed(3)}\n- Δ protection: ${r.meanDelta.protection.toFixed(3)}\n- Δ qualifying Y'shtola spells: ${r.synergyDelta.qualifying}\n- Combo access proxy T5/T7/T9: ${(r.comboAccess.turn5*100).toFixed(1)}% / ${(r.comboAccess.turn7*100).toFixed(1)}% / ${(r.comboAccess.turn9*100).toFixed(1)}%`),'','Combo-fit boundary: the combo must improve closing power without turning the deck into generic Esper combo or materially degrading normal spellcraft play.',''].join('\n');await writeFile('scions-spellcraft-a4-combo-fit.md',md);console.log(md);
}
await main();
