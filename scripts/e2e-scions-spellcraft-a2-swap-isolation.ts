import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, inferCardRoles, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06, type PodPressureV06 } from '../src/services/simulation-v06.js';

const STOCK='test-results/exploratory/scions-spellcraft-stock-deck.txt';
const AS_OF='2026-08-30';
const SWAPS=[
  {id:'rhystic',cut:'1 Champions from Beyond (FIC) 11',add:'1 Rhystic Study (FCA) 31'},
  {id:'akromas-will',cut:"1 Dancer's Chakrams (FIC) 17",add:"1 Akroma's Will (FCA) 21"},
  {id:'force',cut:'1 Summon: Good King Mog XII (FIC) 26',add:'1 Force of Negation (RFIN) J1'},
  {id:'boots',cut:"1 Astrologian's Planisphere (FIN) 46",add:'1 Swiftfoot Boots (FIC) 361'},
  {id:'leviathan',cut:'1 Hildibrand Manderville (FIC) 83',add:'1 Swallowed by Leviathan (FIN) 79'},
  {id:'mortify',cut:'1 Baleful Strix (FIC) 318',add:'1 Mortify (FIC) 327'},
  {id:'beacon',cut:'1 Temple of the False God (FIC) 438',add:'1 Command Beacon (FCA) 64'},
] as const;
const SCENARIOS:Array<{pressure:PodPressureV06;turns:number;seed:number}>=[
  {pressure:'upgraded',turns:5,seed:20260830},
  {pressure:'upgraded',turns:7,seed:20260907},
  {pressure:'optimized',turns:5,seed:20260921},
  {pressure:'optimized',turns:7,seed:20261017},
  {pressure:'cedh',turns:5,seed:20261111},
  {pressure:'cedh',turns:7,seed:20261219},
  {pressure:'cedh',turns:9,seed:20270131},
];
const norm=(v:string)=>v.trim().toLocaleLowerCase();
const rec=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:0;
const avg=(v:readonly number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;
interface Deck{parsed:ParsedDeck;cards:ScryfallCard[];text:string;}
function ids(p:ParsedDeck):CardIdentifierInput[]{return[...p.commanders,...p.main].map(e=>({name:e.name,...(e.set?{set:e.set}:{}),...(e.collectorNumber?{collectorNumber:e.collectorNumber}:{})}));}
async function resolve(text:string):Promise<Deck>{const parsed=parseDecklist(text);const r=await getCardsByIdentifiers(ids(parsed));if(r.notFound.length)throw new Error(`unresolved:${r.notFound.join('|')}`);return{parsed,cards:r.cards,text};}
function entryCard(e:{name:string;set?:string;collectorNumber?:string},cards:readonly ScryfallCard[]):ScryfallCard|undefined{if(e.set&&e.collectorNumber){const x=cards.find(c=>norm(c.set)===norm(e.set??'')&&norm(c.collector_number)===norm(e.collectorNumber??''));if(x)return x;}return cards.find(c=>norm(c.name)===norm(e.name)||norm(c.name.split(' // ')[0]??'')===norm(e.name));}
function synergy(d:Deck){let qualifying=0,instants=0,qualInteraction=0,draw=0,creatures=0;for(const e of d.parsed.main){const c=entryCard(e,d.cards);if(!c)continue;const t=c.type_line.toLowerCase(),isCreature=t.includes('creature');if(isCreature)creatures+=e.quantity;const roles=new Set(inferCardRoles(c));const q=!isCreature&&!t.includes('land')&&c.cmc>=3;if(q){qualifying+=e.quantity;if(t.includes('instant'))instants+=e.quantity;if(roles.has('countermagic')||roles.has('spot interaction')||roles.has('board wipe')||roles.has('free interaction'))qualInteraction+=e.quantity;}if(roles.has('card draw')||roles.has('repeatable draw')||roles.has('card selection'))draw+=e.quantity;}return{qualifying,instants,qualInteraction,draw,creatures};}
interface Signal{keep:number;uptime:number;protection:number;spells:number;draws:number;}
function signal(r:Record<string,unknown>):Signal{const b=rec(r.baseline),a=rec(r.advanced);return{keep:num(rec(b.openingHands).functionalKeepRate),uptime:num(rec(a.commanderPressure).battlefieldUptimePercent),protection:num(rec(a.interactionPressure).protectionWinRateWhenChallenged),spells:num(rec(a.cardFlow).averageSpellsCast),draws:num(rec(a.cardFlow).averageCardsDrawnByEffects)};}
function delta(a:Signal,b:Signal):Signal{return{keep:b.keep-a.keep,uptime:b.uptime-a.uptime,protection:b.protection-a.protection,spells:b.spells-a.spells,draws:b.draws-a.draws};}
function mean(v:Signal[]):Signal{return{keep:avg(v.map(x=>x.keep)),uptime:avg(v.map(x=>x.uptime)),protection:avg(v.map(x=>x.protection)),spells:avg(v.map(x=>x.spells)),draws:avg(v.map(x=>x.draws))};}
function sim(d:Deck,s:{pressure:PodPressureV06;turns:number;seed:number}){return simulateDeckGameplayV06(d.parsed,d.cards,{iterations:1200,advancedIterations:1200,turns:s.turns,seed:s.seed,pressure:s.pressure}) as unknown as Record<string,unknown>;}
function replaceOnce(text:string,cut:string,add:string):string{if(!text.includes(cut))throw new Error(`missing cut ${cut}`);return text.replace(cut,add);}

async function main(){
 const stockText=await readFile(STOCK,'utf8');const stock=await resolve(stockText);const policy=await resolvePrintingPolicyV08({printingFamily:'Final Fantasy',includePromos:true,includeSpecialReleases:true});
 if(!validateCommanderDeck(stock.parsed,stock.cards).isLegal)throw new Error('stock illegal');if(!stock.cards.every(c=>printingMatchesPolicyV08(c,policy,AS_OF)))throw new Error('stock FF policy');
 const baseSims=SCENARIOS.map(s=>signal(sim(stock,s)));const s0=synergy(stock),m0=buildDeckMetrics(stock.parsed,stock.cards);const results=[];
 for(const swap of SWAPS){const variant=await resolve(replaceOnce(stockText,swap.cut,swap.add));const legal=validateCommanderDeck(variant.parsed,variant.cards).isLegal;const ff=variant.cards.every(c=>printingMatchesPolicyV08(c,policy,AS_OF));const ds=SCENARIOS.map((s,i)=>delta(baseSims[i]!,signal(sim(variant,s))));const d=mean(ds);const sy=synergy(variant),m=buildDeckMetrics(variant.parsed,variant.cards);const pass=legal&&ff&&d.keep>=-2.0&&d.uptime>=-4&&d.protection>=-6&&d.spells>=-0.25&&d.draws>=-0.35;results.push({id:swap.id,cut:swap.cut.replace(/^1 /,''),add:swap.add.replace(/^1 /,''),pass,legal,ff,meanDelta:d,synergyDelta:{qualifying:sy.qualifying-s0.qualifying,instants:sy.instants-s0.instants,qualInteraction:sy.qualInteraction-s0.qualInteraction,draw:sy.draw-s0.draw,creatures:sy.creatures-s0.creatures},structuralDelta:{mv:m.averageNonlandManaValue-m0.averageNonlandManaValue,ramp:m.rampCount-m0.rampCount,interaction:m.interactionCount-m0.interactionCount,protection:m.protectionCount-m0.protectionCount,early:m.earlyPlayCount-m0.earlyPlayCount}});}
 results.sort((a,b)=>Number(b.pass)-Number(a.pass)||b.meanDelta.spells-a.meanDelta.spells||b.meanDelta.draws-a.meanDelta.draws);
 const report={baseline:{synergy:s0,metrics:m0},results,boundary:'Single-swap isolation is evidence, not automatic acceptance. Manual Y\'shtola/Scions synergy review remains authoritative.'};await writeFile('scions-spellcraft-a2-swap-isolation.json',JSON.stringify(report,null,2));
 const md=['# Scions & Spellcraft A2 — Seven-Swap Isolation','',...results.map(r=>`## ${r.id}: ${r.cut} -> ${r.add}\n- Screen: **${r.pass?'PASS':'REVIEW'}**\n- Δ spells: ${r.meanDelta.spells.toFixed(3)}\n- Δ effect-draws: ${r.meanDelta.draws.toFixed(3)}\n- Δ commander uptime: ${r.meanDelta.uptime.toFixed(3)}\n- Δ protection: ${r.meanDelta.protection.toFixed(3)}\n- Δ qualifying Y'shtola spells: ${r.synergyDelta.qualifying}\n- Δ qualifying instants: ${r.synergyDelta.instants}\n- Δ qualifying interaction: ${r.synergyDelta.qualInteraction}\n- Δ detected draw/selection roles: ${r.synergyDelta.draw}`),'','Screening boundary: simulation is a regression guard; final acceptance requires strategic review.',''].join('\n');await writeFile('scions-spellcraft-a2-swap-isolation.md',md);console.log(md);
}
await main();
