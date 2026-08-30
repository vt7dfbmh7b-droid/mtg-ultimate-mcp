import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, inferCardRoles, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06, type PodPressureV06 } from '../src/services/simulation-v06.js';

type Swap={cut:string;add:string};
const STOCK='test-results/exploratory/scions-spellcraft-stock-deck.txt';
const AS_OF='2026-08-31';
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
const MOOGLE='1 Delivery Moogle (FIN) 15';
const oldPair:Swap[]=[{cut:'1 Ardbert, Warrior of Darkness (FIC) 77',add:WM},{cut:'1 Estinien Varlineau (FIC) 82',add:BALLISTA}];
const newPair:Swap[]=[{cut:'1 Ardbert, Warrior of Darkness (FIC) 77',add:WM},{cut:'1 Hraesvelgr of the First Brood (FIC) 37',add:BALLISTA}];
const V:Record<string,Swap[]>={
 old_pair_control:[...BASE,...oldPair],
 new_pair_hraesvelgr:[...BASE,...newPair],
 new_pair_plus_intent:[...BASE,...newPair,{cut:'1 Cut a Deal (FIC) 238',add:INTENT}],
 old_pair_plus_ranger:[...BASE,...oldPair,{cut:'1 Hraesvelgr of the First Brood (FIC) 37',add:RANGER}],
 old_pair_plus_moogle:[...BASE,...oldPair,{cut:'1 Hraesvelgr of the First Brood (FIC) 37',add:MOOGLE}],
 old_pair_intent_ranger:[...BASE,...oldPair,{cut:'1 Cut a Deal (FIC) 238',add:INTENT},{cut:'1 Hraesvelgr of the First Brood (FIC) 37',add:RANGER}],
 old_pair_intent_moogle:[...BASE,...oldPair,{cut:'1 Cut a Deal (FIC) 238',add:INTENT},{cut:'1 Hraesvelgr of the First Brood (FIC) 37',add:MOOGLE}],
};
const SCENARIOS:Array<{pressure:PodPressureV06;turns:number;seed:number}>=[
 {pressure:'upgraded',turns:5,seed:20260831},{pressure:'upgraded',turns:7,seed:20260911},
 {pressure:'optimized',turns:5,seed:20260929},{pressure:'optimized',turns:7,seed:20261023},
 {pressure:'cedh',turns:5,seed:20261117},{pressure:'cedh',turns:7,seed:20261229},{pressure:'cedh',turns:9,seed:20270211},
];
const norm=(v:string)=>v.trim().toLowerCase();
const rec=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:0;
const avg=(v:number[])=>v.reduce((a,b)=>a+b,0)/v.length;
interface Deck{parsed:ParsedDeck;cards:ScryfallCard[];text:string;}
function ids(p:ParsedDeck):CardIdentifierInput[]{return[...p.commanders,...p.main].map(e=>({name:e.name,...(e.set?{set:e.set}:{}),...(e.collectorNumber?{collectorNumber:e.collectorNumber}:{})}));}
async function resolve(text:string):Promise<Deck>{const parsed=parseDecklist(text);const r=await getCardsByIdentifiers(ids(parsed));if(r.notFound.length)throw new Error(`unresolved:${r.notFound.join('|')}`);return{parsed,cards:r.cards,text};}
function entryCard(e:{name:string;set?:string;collectorNumber?:string},cards:readonly ScryfallCard[]):ScryfallCard|undefined{if(e.set&&e.collectorNumber){const c=cards.find(x=>norm(x.set)===norm(e.set??'')&&norm(x.collector_number)===norm(e.collectorNumber??''));if(c)return c;}return cards.find(c=>norm(c.name)===norm(e.name)||norm(c.name.split(' // ')[0]??'')===norm(e.name));}
function synergy(d:Deck){let qualifying=0,instants=0,draw=0,interaction=0,protection=0,creatures=0,lifeGain=0;for(const e of d.parsed.main){const c=entryCard(e,d.cards);if(!c)continue;const t=c.type_line.toLowerCase(),cr=t.includes('creature'),roles=new Set(inferCardRoles(c));if(cr)creatures+=e.quantity;const q=!cr&&!t.includes('land')&&c.cmc>=3;if(q){qualifying+=e.quantity;if(t.includes('instant'))instants+=e.quantity;if(roles.has('countermagic')||roles.has('spot interaction')||roles.has('board wipe')||roles.has('free interaction'))interaction+=e.quantity;}if(roles.has('card draw')||roles.has('repeatable draw')||roles.has('card selection'))draw+=e.quantity;if(roles.has('protection')||roles.has('board protection'))protection+=e.quantity;const text=(c.oracle_text??'').toLowerCase();if(text.includes('you gain')||text.includes('lifelink'))lifeGain+=e.quantity;}return{qualifying,instants,draw,interaction,protection,creatures,lifeGain};}
interface Signal{keep:number;uptime:number;protection:number;spells:number;draws:number;}
function sig(r:Record<string,unknown>):Signal{const b=rec(r.baseline),a=rec(r.advanced);return{keep:num(rec(b.openingHands).functionalKeepRate),uptime:num(rec(a.commanderPressure).battlefieldUptimePercent),protection:num(rec(a.interactionPressure).protectionWinRateWhenChallenged),spells:num(rec(a.cardFlow).averageSpellsCast),draws:num(rec(a.cardFlow).averageCardsDrawnByEffects)};}
function diff(a:Signal,b:Signal):Signal{return{keep:b.keep-a.keep,uptime:b.uptime-a.uptime,protection:b.protection-a.protection,spells:b.spells-a.spells,draws:b.draws-a.draws};}
function mean(v:Signal[]):Signal{return{keep:avg(v.map(x=>x.keep)),uptime:avg(v.map(x=>x.uptime)),protection:avg(v.map(x=>x.protection)),spells:avg(v.map(x=>x.spells)),draws:avg(v.map(x=>x.draws))};}
function sim(d:Deck,s:{pressure:PodPressureV06;turns:number;seed:number}){return simulateDeckGameplayV06(d.parsed,d.cards,{iterations:1500,advancedIterations:1500,turns:s.turns,seed:s.seed,pressure:s.pressure}) as unknown as Record<string,unknown>;}
function apply(text:string,swaps:readonly Swap[]):string{let out=text;for(const s of swaps){if(!out.includes(s.cut))throw new Error(`missing cut ${s.cut}`);out=out.replace(s.cut,s.add);}return out;}
function lib(d:Deck):string[]{const out:string[]=[];for(const e of d.parsed.main)for(let i=0;i<e.quantity;i++)out.push(norm(e.name));if(out.length!==99)throw new Error(`library:${out.length}`);return out;}
function access(cards:readonly string[],visible:number,seed:number,iterations=120000){let h=0,x=seed>>>0;const rnd=()=>((x=(Math.imul(1664525,x)+1013904223)>>>0)/4294967296);for(let i=0;i<iterations;i++){const a=cards.slice();for(let j=a.length-1;j>=a.length-visible;j--){const k=Math.floor(rnd()*(j+1));[a[j],a[k]]=[a[k]!,a[j]!];}const seen=new Set(a.slice(a.length-visible));const w=seen.has(norm('The Destined White Mage')),ball=seen.has(norm('Walking Ballista')),r=seen.has(norm('Ranger-Captain of Eos')),m=seen.has(norm('Delivery Moogle')),intent=seen.has(norm('Diabolic Intent'));const ballAccess=ball||r||m;if((w&&ballAccess)||(intent&&(w||ballAccess)))h++;}return h/iterations;}
async function main(){const stock=await readFile(STOCK,'utf8'),base=await resolve(apply(stock,BASE));const policy=await resolvePrintingPolicyV08({printingFamily:'Final Fantasy',includePromos:true,includeSpecialReleases:true});const baseS=SCENARIOS.map(s=>sig(sim(base,s))),sy0=synergy(base);const results=[];for(const[id,swaps]of Object.entries(V)){const d=await resolve(apply(stock,swaps));const legal=validateCommanderDeck(d.parsed,d.cards).isLegal,ff=d.cards.every(c=>printingMatchesPolicyV08(c,policy,AS_OF)),sy=synergy(d),metrics=buildDeckMetrics(d.parsed,d.cards),ds=SCENARIOS.map((s,i)=>diff(baseS[i]!,sig(sim(d,s)))),md=mean(ds),library=lib(d);const ca={t5:access(library,12,20260831),t7:access(library,14,20260913),t9:access(library,16,20261007)};const pass=legal&&ff&&md.keep>=-2&&md.uptime>=-5&&md.protection>=-8&&md.spells>=-0.3&&md.draws>=-0.4&&sy.qualifying>=sy0.qualifying-1;results.push({id,pass,changes:swaps.slice(BASE.length).map(s=>({cut:s.cut.replace(/^1 /,''),add:s.add.replace(/^1 /,'')})),meanDelta:md,comboAccess:ca,synergyDelta:{qualifying:sy.qualifying-sy0.qualifying,instants:sy.instants-sy0.instants,draw:sy.draw-sy0.draw,interaction:sy.interaction-sy0.interaction,protection:sy.protection-sy0.protection,creatures:sy.creatures-sy0.creatures,lifeGain:sy.lifeGain-sy0.lifeGain},metrics:{mv:metrics.averageNonlandManaValue,ramp:metrics.rampCount,interaction:metrics.interactionCount,protection:metrics.protectionCount,early:metrics.earlyPlayCount}});}results.sort((a,b)=>Number(b.pass)-Number(a.pass)||b.comboAccess.t7-a.comboAccess.t7||b.meanDelta.draws-a.meanDelta.draws);const report={baseSynergy:sy0,results,boundary:'Access is full-99-card assembly visibility, not win rate. Delivery Moogle and Ranger-Captain count as Ballista access; Intent can find one missing half. Manual fair-plan integration remains authoritative.'};await writeFile('scions-spellcraft-a5-combo-support-refinement.json',JSON.stringify(report,null,2));const pct=(n:number)=>(n*100).toFixed(2)+'%';const md=['# Scions & Spellcraft A5 — Combo Support Refinement','',...results.map(r=>`## ${r.id}\n- Screen: **${r.pass?'PASS':'REVIEW'}**\n- Changes: ${r.changes.map(c=>`${c.cut} -> ${c.add}`).join('; ')}\n- Δ spells: ${r.meanDelta.spells.toFixed(3)}\n- Δ effect-draws: ${r.meanDelta.draws.toFixed(3)}\n- Δ commander uptime: ${r.meanDelta.uptime.toFixed(3)}\n- Δ protection: ${r.meanDelta.protection.toFixed(3)}\n- Δ qualifying Y'shtola spells: ${r.synergyDelta.qualifying}\n- Raw combo assembly access T5/T7/T9: ${pct(r.comboAccess.t5)} / ${pct(r.comboAccess.t7)} / ${pct(r.comboAccess.t9)}`),'','All probabilities use the full 99-card library including duplicate basics.',''].join('\n');await writeFile('scions-spellcraft-a5-combo-support-refinement.md',md);console.log(md);}
await main();
