import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, inferCardRoles, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06, type PodPressureV06 } from '../src/services/simulation-v06.js';

const STOCK='test-results/exploratory/scions-spellcraft-stock-deck.txt';
const AS_OF='2026-08-30';
type Swap={cut:string;add:string};
const CORE6:Swap[]=[
 {cut:"1 Sage's Nouliths (FIN) 70",add:'1 Rhystic Study (FCA) 31'},
 {cut:"1 Dancer's Chakrams (FIC) 17",add:"1 Akroma's Will (FCA) 21"},
 {cut:'1 Summon: Good King Mog XII (FIC) 26',add:'1 Force of Negation (RFIN) J1'},
 {cut:"1 Astrologian's Planisphere (FIN) 46",add:'1 Swiftfoot Boots (FIC) 361'},
 {cut:'1 Hildibrand Manderville (FIC) 83',add:'1 Swallowed by Leviathan (FIN) 79'},
 {cut:'1 Temple of the False God (FIC) 438',add:'1 Command Beacon (FCA) 64'},
];
const V={
 core6: CORE6,
 mortify_cane:[...CORE6,{cut:"1 Blue Mage's Cane (FIC) 35",add:'1 Mortify (FIC) 327'}],
 mortify_eye:[...CORE6,{cut:'1 Eye of Nidhogg (FIC) 44',add:'1 Mortify (FIC) 327'}],
 mortify_strix:[...CORE6,{cut:'1 Baleful Strix (FIC) 318',add:'1 Mortify (FIC) 327'}],
 clever_cane:[...CORE6,{cut:"1 Blue Mage's Cane (FIC) 35",add:'1 Clever Concealment (FIC) 236'}],
 clever_eye:[...CORE6,{cut:'1 Eye of Nidhogg (FIC) 44',add:'1 Clever Concealment (FIC) 236'}],
 clever_bastion:[...CORE6,{cut:'1 Bastion of Remembrance (FIC) 274',add:'1 Clever Concealment (FIC) 236'}],
 mortify_cane_clever_eye:[...CORE6,{cut:"1 Blue Mage's Cane (FIC) 35",add:'1 Mortify (FIC) 327'},{cut:'1 Eye of Nidhogg (FIC) 44',add:'1 Clever Concealment (FIC) 236'}],
 mortify_eye_clever_cane:[...CORE6,{cut:'1 Eye of Nidhogg (FIC) 44',add:'1 Mortify (FIC) 327'},{cut:"1 Blue Mage's Cane (FIC) 35",add:'1 Clever Concealment (FIC) 236'}],
} as const;
const SCENARIOS:Array<{pressure:PodPressureV06;turns:number;seed:number}>=[
 {pressure:'upgraded',turns:5,seed:20260830},{pressure:'upgraded',turns:7,seed:20260907},
 {pressure:'optimized',turns:5,seed:20260921},{pressure:'optimized',turns:7,seed:20261017},
 {pressure:'cedh',turns:5,seed:20261111},{pressure:'cedh',turns:7,seed:20261219},{pressure:'cedh',turns:9,seed:20270131},
];
const norm=(v:string)=>v.trim().toLowerCase();
const rec=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:0;
const avg=(v:number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;
interface Deck{parsed:ParsedDeck;cards:ScryfallCard[];text:string;}
function ids(p:ParsedDeck):CardIdentifierInput[]{return [...p.commanders,...p.main].map(e=>({name:e.name,...(e.set?{set:e.set}:{}),...(e.collectorNumber?{collectorNumber:e.collectorNumber}:{})}));}
async function resolve(text:string):Promise<Deck>{const parsed=parseDecklist(text);const r=await getCardsByIdentifiers(ids(parsed));if(r.notFound.length)throw new Error(`unresolved:${r.notFound.join('|')}`);return{parsed,cards:r.cards,text};}
function entryCard(e:{name:string;set?:string;collectorNumber?:string},cards:readonly ScryfallCard[]):ScryfallCard|undefined{if(e.set&&e.collectorNumber){const x=cards.find(c=>norm(c.set)===norm(e.set??'')&&norm(c.collector_number)===norm(e.collectorNumber??''));if(x)return x;}return cards.find(c=>norm(c.name)===norm(e.name)||norm(c.name.split(' // ')[0]??'')===norm(e.name));}
function synergy(d:Deck){let qualifying=0,instants=0,interaction=0,draw=0,protection=0,creatures=0;for(const e of d.parsed.main){const c=entryCard(e,d.cards);if(!c)continue;const t=c.type_line.toLowerCase(),isCreature=t.includes('creature');if(isCreature)creatures+=e.quantity;const roles=new Set(inferCardRoles(c));const q=!isCreature&&!t.includes('land')&&c.cmc>=3;if(q){qualifying+=e.quantity;if(t.includes('instant'))instants+=e.quantity;if(roles.has('countermagic')||roles.has('spot interaction')||roles.has('board wipe')||roles.has('free interaction'))interaction+=e.quantity;}if(roles.has('card draw')||roles.has('repeatable draw')||roles.has('card selection'))draw+=e.quantity;if(roles.has('protection')||roles.has('board protection'))protection+=e.quantity;}return{qualifying,instants,interaction,draw,protection,creatures};}
interface Signal{keep:number;uptime:number;protection:number;spells:number;draws:number;}
function signal(r:Record<string,unknown>):Signal{const b=rec(r.baseline),a=rec(r.advanced);return{keep:num(rec(b.openingHands).functionalKeepRate),uptime:num(rec(a.commanderPressure).battlefieldUptimePercent),protection:num(rec(a.interactionPressure).protectionWinRateWhenChallenged),spells:num(rec(a.cardFlow).averageSpellsCast),draws:num(rec(a.cardFlow).averageCardsDrawnByEffects)};}
function delta(a:Signal,b:Signal):Signal{return{keep:b.keep-a.keep,uptime:b.uptime-a.uptime,protection:b.protection-a.protection,spells:b.spells-a.spells,draws:b.draws-a.draws};}
function mean(v:Signal[]):Signal{return{keep:avg(v.map(x=>x.keep)),uptime:avg(v.map(x=>x.uptime)),protection:avg(v.map(x=>x.protection)),spells:avg(v.map(x=>x.spells)),draws:avg(v.map(x=>x.draws))};}
function sim(d:Deck,s:{pressure:PodPressureV06;turns:number;seed:number}){return simulateDeckGameplayV06(d.parsed,d.cards,{iterations:1300,advancedIterations:1300,turns:s.turns,seed:s.seed,pressure:s.pressure}) as unknown as Record<string,unknown>;}
function apply(text:string,swaps:readonly Swap[]):string{let out=text;for(const s of swaps){if(!out.includes(s.cut))throw new Error(`missing cut ${s.cut}`);out=out.replace(s.cut,s.add);}return out;}

async function main(){
 const stockText=await readFile(STOCK,'utf8'),stock=await resolve(stockText);const policy=await resolvePrintingPolicyV08({printingFamily:'Final Fantasy',includePromos:true,includeSpecialReleases:true});
 if(!validateCommanderDeck(stock.parsed,stock.cards).isLegal)throw new Error('stock illegal');
 const baseSims=SCENARIOS.map(s=>signal(sim(stock,s))),s0=synergy(stock),m0=buildDeckMetrics(stock.parsed,stock.cards);const results=[];
 for(const [id,swaps] of Object.entries(V)){
   const d=await resolve(apply(stockText,swaps));const legal=validateCommanderDeck(d.parsed,d.cards).isLegal,ff=d.cards.every(c=>printingMatchesPolicyV08(c,policy,AS_OF));const sy=synergy(d),m=buildDeckMetrics(d.parsed,d.cards);const ds=SCENARIOS.map((s,i)=>delta(baseSims[i]!,signal(sim(d,s))));const md=mean(ds);
   const pass=legal&&ff&&d.parsed.totalCards===100&&md.keep>=-2.5&&md.uptime>=-5&&md.protection>=-8&&md.spells>=-0.35&&md.draws>=-0.5;
   results.push({id,pass,swaps:swaps.map(s=>({cut:s.cut.replace(/^1 /,''),add:s.add.replace(/^1 /,'')})),meanDelta:md,synergyDelta:{qualifying:sy.qualifying-s0.qualifying,instants:sy.instants-s0.instants,interaction:sy.interaction-s0.interaction,draw:sy.draw-s0.draw,protection:sy.protection-s0.protection,creatures:sy.creatures-s0.creatures},metrics:{mv:m.averageNonlandManaValue,land:m.landCount,ramp:m.rampCount,interaction:m.interactionCount,protection:m.protectionCount,early:m.earlyPlayCount}});
 }
 results.sort((a,b)=>Number(b.pass)-Number(a.pass)||b.meanDelta.protection-a.meanDelta.protection||b.meanDelta.spells-a.meanDelta.spells);
 const report={baseline:{synergy:s0,metrics:m0},results,boundary:'Package screen only. No infinite combo. Manual Y\'shtola identity and card-function review decides acceptance.'};await writeFile('scions-spellcraft-a3-package-pressure.json',JSON.stringify(report,null,2));
 const md=['# Scions & Spellcraft A3 — Repaired Package Pressure','',...results.map(r=>`## ${r.id}\n- Screen: **${r.pass?'PASS':'REVIEW'}**\n- Swaps: ${r.swaps.map(s=>`${s.cut} -> ${s.add}`).join('; ')}\n- Δ spells: ${r.meanDelta.spells.toFixed(3)}\n- Δ effect-draws: ${r.meanDelta.draws.toFixed(3)}\n- Δ commander uptime: ${r.meanDelta.uptime.toFixed(3)}\n- Δ protection: ${r.meanDelta.protection.toFixed(3)}\n- Δ qualifying Y'shtola spells: ${r.synergyDelta.qualifying}\n- Δ qualifying instants: ${r.synergyDelta.instants}\n- Δ qualifying interaction: ${r.synergyDelta.interaction}\n- Δ protection-role cards: ${r.synergyDelta.protection}`),'','No-infinite boundary remains authoritative.',''].join('\n');await writeFile('scions-spellcraft-a3-package-pressure.md',md);console.log(md);
}
await main();
