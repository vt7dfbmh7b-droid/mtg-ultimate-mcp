import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardPrintings, inferCardRoles } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06, type PodPressureV06 } from '../src/services/simulation-v06.js';

const STOCK='test-results/exploratory/scions-spellcraft-stock-deck.txt';
const A1='test-results/exploratory/scions-spellcraft-a1-deck.txt';
const AS_OF='2026-08-30';
const SWAPS=[
  ['Champions from Beyond','Rhystic Study'],
  ["Dancer's Chakrams","Akroma's Will"],
  ['Summon: Good King Mog XII','Force of Negation'],
  ["Astrologian's Planisphere",'Swiftfoot Boots'],
  ['Hildibrand Manderville','Swallowed by Leviathan'],
  ['Baleful Strix','Mortify'],
  ['Temple of the False God','Command Beacon'],
] as const;
const CORE=[
  'Dig Through Time','Into the Story','Torrential Gearhulk','Archmage Emeritus','Hraesvelgr of the First Brood',
  'Alisaie Leveilleur','Exsanguinate','Propaganda','Cleansing Nova','Final Judgment','Crux of Fate','Emet-Selch of the Third Seat',
  'Tataru Taru','Eye of Nidhogg','Observed Stasis','Lyse Hext','Papalymo Totolymo',
] as const;
const FORBIDDEN_COMBO=['The Destined White Mage','Walking Ballista'] as const;
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

interface ResolvedDeck {parsed:ParsedDeck;cards:ScryfallCard[];printingChoices:Array<{name:string;set:string;collectorNumber:string}>;unresolved:string[];}
async function resolveDeck(text:string):Promise<ResolvedDeck>{
  const parsed=parseDecklist(text);
  const policy=await resolvePrintingPolicyV08({printingFamily:'Final Fantasy',includePromos:true,includeSpecialReleases:true});
  const unique=[...new Set([...parsed.commanders,...parsed.main].map(e=>e.name))];
  const cards:ScryfallCard[]=[];const printingChoices:ResolvedDeck['printingChoices']=[];const unresolved:string[]=[];
  const priority=['fic','fin','fca','rfin','sld'];
  for(const name of unique){
    const printings=await getCardPrintings(name,250);
    const eligible=printings.filter(c=>printingMatchesPolicyV08(c,policy,AS_OF));
    eligible.sort((a,b)=>{
      const pa=priority.indexOf(a.set.toLocaleLowerCase());const pb=priority.indexOf(b.set.toLocaleLowerCase());
      const aa=pa<0?99:pa,bb=pb<0?99:pb;
      if(aa!==bb)return aa-bb;
      return String(a.collector_number).localeCompare(String(b.collector_number),undefined,{numeric:true});
    });
    const chosen=eligible[0];
    if(!chosen){unresolved.push(name);continue;}
    cards.push(chosen);printingChoices.push({name,set:chosen.set.toUpperCase(),collectorNumber:chosen.collector_number});
  }
  return{parsed,cards,printingChoices,unresolved};
}
function cardMap(cards:readonly ScryfallCard[]):Map<string,ScryfallCard>{return new Map(cards.map(c=>[norm(c.name),c]));}
function synergy(p:ParsedDeck,cards:readonly ScryfallCard[]){
  const by=cardMap(cards);let qualifying=0,qualifyingInstants=0,noncreature=0,creatures=0,independentDraw=0,qualifyingInteraction=0;
  for(const e of p.main){const c=by.get(norm(e.name));if(!c)continue;const type=c.type_line.toLocaleLowerCase();const isCreature=type.includes('creature');if(isCreature)creatures+=e.quantity;else noncreature+=e.quantity;
    const qualifies=!isCreature&&!type.includes('land')&&c.cmc>=3;
    if(qualifies){qualifying+=e.quantity;if(type.includes('instant'))qualifyingInstants+=e.quantity;const roles=new Set(inferCardRoles(c));if(roles.has('countermagic')||roles.has('spot interaction')||roles.has('board wipe')||roles.has('free interaction'))qualifyingInteraction+=e.quantity;}
    const roles=new Set(inferCardRoles(c));if(roles.has('card draw')||roles.has('repeatable draw')||roles.has('card selection'))independentDraw+=e.quantity;
  }
  return{qualifyingYstolaSpells:qualifying,qualifyingInstants,qualifyingInteraction,noncreatureSpells:noncreature,creatures,independentDraw};
}
interface Signal{keep:number;uptime:number;protection:number;spells:number;draws:number;}
function signal(r:Record<string,unknown>):Signal{const b=rec(r.baseline),a=rec(r.advanced);return{keep:num(rec(b.openingHands).functionalKeepRate),uptime:num(rec(a.commanderPressure).battlefieldUptimePercent),protection:num(rec(a.interactionPressure).protectionWinRateWhenChallenged),spells:num(rec(a.cardFlow).averageSpellsCast),draws:num(rec(a.cardFlow).averageCardsDrawnByEffects)};}
function delta(b:Signal,a:Signal):Signal{return{keep:a.keep-b.keep,uptime:a.uptime-b.uptime,protection:a.protection-b.protection,spells:a.spells-b.spells,draws:a.draws-b.draws};}
function mean(v:readonly Signal[]):Signal{return{keep:avg(v.map(x=>x.keep)),uptime:avg(v.map(x=>x.uptime)),protection:avg(v.map(x=>x.protection)),spells:avg(v.map(x=>x.spells)),draws:avg(v.map(x=>x.draws))};}
function sim(d:ResolvedDeck,s:{pressure:PodPressureV06;turns:number;seed:number}):Record<string,unknown>{return simulateDeckGameplayV06(d.parsed,d.cards,{iterations:1600,advancedIterations:1600,turns:s.turns,seed:s.seed,pressure:s.pressure}) as unknown as Record<string,unknown>;}

async function main(){
  console.log('SCIONS & SPELLCRAFT A1 WHOLE-DECK BASELINE AUDIT');
  const [stockText,a1Text]=await Promise.all([readFile(STOCK,'utf8'),readFile(A1,'utf8')]);
  const stock=await resolveDeck(stockText);const a1=await resolveDeck(a1Text);const failures:string[]=[];
  const policy=await resolvePrintingPolicyV08({printingFamily:'Final Fantasy',includePromos:true,includeSpecialReleases:true});
  for(const [label,d] of [['stock',stock],['a1',a1]] as const){
    if(d.parsed.totalCards!==100)failures.push(`${label}:count-${d.parsed.totalCards}`);
    if(d.unresolved.length)failures.push(`${label}:unresolved-${d.unresolved.join('|')}`);
    if(!validateCommanderDeck(d.parsed,d.cards).isLegal)failures.push(`${label}:commander-illegal`);
    if(!d.cards.every(c=>printingMatchesPolicyV08(c,policy,AS_OF)))failures.push(`${label}:ff-printing-policy`);
  }
  const stockSet=new Set(stock.parsed.main.map(e=>norm(e.name))),a1Set=new Set(a1.parsed.main.map(e=>norm(e.name)));
  for(const[cut,add]of SWAPS){if(!stockSet.has(norm(cut))||a1Set.has(norm(cut)))failures.push(`swap-cut:${cut}`);if(stockSet.has(norm(add))||!a1Set.has(norm(add)))failures.push(`swap-add:${add}`);}
  for(const name of CORE)if(!a1Set.has(norm(name)))failures.push(`core-lost:${name}`);
  if(FORBIDDEN_COMBO.every(n=>a1Set.has(norm(n))))failures.push('infinite-combo:white-mage-ballista');
  const m0=buildDeckMetrics(stock.parsed,stock.cards),m1=buildDeckMetrics(a1.parsed,a1.cards),s0=synergy(stock.parsed,stock.cards),s1=synergy(a1.parsed,a1.cards);
  if(s1.qualifyingYstolaSpells<s0.qualifyingYstolaSpells)failures.push('synergy:qualifying-spells-regressed');
  if(s1.qualifyingInstants<s0.qualifyingInstants)failures.push('synergy:qualifying-instants-regressed');
  if(!a1Set.has(norm('Exsanguinate')))failures.push('finish:exsanguinate-lost');
  if(!a1Set.has(norm("Akroma's Will")))failures.push('finish:akromas-will-missing');
  const deltas:Signal[]=[];const scenarios:Array<Record<string,unknown>>=[];
  for(const sc of SCENARIOS){const b=signal(sim(stock,sc)),a=signal(sim(a1,sc)),d=delta(b,a);deltas.push(d);scenarios.push({...sc,stock:b,a1:a,delta:d});}
  const d=mean(deltas);
  if(d.keep<-2.5)failures.push('sim:keep');if(d.uptime<-5)failures.push('sim:uptime');if(d.protection<-8)failures.push('sim:protection');if(d.spells<-0.3)failures.push('sim:spells');if(d.draws<-0.5)failures.push('sim:draws');
  const report={status:failures.length?'REVIEW':'PASS',failures,swaps:SWAPS.map(([cut,add])=>({cut,add})),stock:{metrics:m0,synergy:s0,printingChoices:stock.printingChoices},a1:{metrics:m1,synergy:s1,printingChoices:a1.printingChoices},meanDelta:d,scenarios,boundary:'Simulation is a regression guard. Manual Y\'shtola/Scions identity audit remains authoritative; no infinite combo is permitted.'};
  await writeFile('scions-spellcraft-a1-baseline.json',JSON.stringify(report,null,2));
  const md=['# Scions & Spellcraft A1 — Whole-Deck Baseline Audit','',`- Result: **${report.status}**`,`- Failures: ${failures.length?failures.join('; '):'none'}`,'',`- Stock qualifying Y\'shtola spells: ${s0.qualifyingYstolaSpells}`,`- A1 qualifying Y\'shtola spells: ${s1.qualifyingYstolaSpells}`,`- Stock qualifying instants: ${s0.qualifyingInstants}`,`- A1 qualifying instants: ${s1.qualifyingInstants}`,`- Stock qualifying interaction: ${s0.qualifyingInteraction}`,`- A1 qualifying interaction: ${s1.qualifyingInteraction}`,`- Stock creatures: ${s0.creatures}`,`- A1 creatures: ${s1.creatures}`,`- Stock independent draw/selection count: ${s0.independentDraw}`,`- A1 independent draw/selection count: ${s1.independentDraw}`,'',`- Land count: ${m0.landCount} -> ${m1.landCount}`,`- Average nonland MV: ${m0.averageNonlandManaValue.toFixed(2)} -> ${m1.averageNonlandManaValue.toFixed(2)}`,`- Ramp: ${m0.rampCount} -> ${m1.rampCount}`,`- Interaction: ${m0.interactionCount} -> ${m1.interactionCount}`,`- Protection: ${m0.protectionCount} -> ${m1.protectionCount}`,'',`- Mean Δ functional keep: ${d.keep.toFixed(3)}`,`- Mean Δ commander uptime: ${d.uptime.toFixed(3)}`,`- Mean Δ protection when challenged: ${d.protection.toFixed(3)}`,`- Mean Δ spells cast: ${d.spells.toFixed(3)}`,`- Mean Δ effect-draws: ${d.draws.toFixed(3)}`,'','No-infinite boundary: White Mage + Walking Ballista is not present as a package. Finite closes are Y\'shtola attrition, Exsanguinate, and Akroma\'s Will combat.',''].join('\n');
  await writeFile('scions-spellcraft-a1-baseline.md',md);console.log(md);if(failures.length)process.exitCode=1;
}
await main();
