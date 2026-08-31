import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06, type PodPressureV06 } from '../src/services/simulation-v06.js';

const A5='test-results/exploratory/scions-spellcraft-a5-deck.txt';
const A11='test-results/exploratory/scions-spellcraft-a11-control-deck.txt';
const AS_OF='2026-08-31';
const EXPECTED_SWAPS=[
  ["Reaper's Scythe",'Arcane Denial'],
  ['Tome of Legends',"Dovin's Veto"],
  ['Crux of Fate','Toxic Deluge'],
  ['Rite of Replication','Cyclonic Rift'],
] as const;
const LOCKED=[
  "Y'shtola, Night's Blessed",'The Destined White Mage','Walking Ballista','Diabolic Intent','Ranger-Captain of Eos',
  'Rhystic Study','Force of Negation','Clever Concealment','Akroma\'s Will','Exsanguinate',
  'Archmage Emeritus','Dig Through Time','Torrential Gearhulk','Sublime Epiphany','Papalymo Totolymo',
  'Alisaie Leveilleur','Alphinaud Leveilleur','Lyse Hext','Urianger Augurelt','Fandaniel, Telophoroi Ascian',
] as const;
const REVIEWED_KEEP=[
  {name:'Murderous Rider',reason:'Swift End is a three-mana instant Ystola trigger; Rider adds lifelink body and Intent fodder.'},
  {name:'Hypnotic Sprite',reason:'Mesmeric Glare is a three-mana instant counterspell Ystola trigger, then leaves a flyer.'},
  {name:'Authority of the Consuls',reason:'One-mana stax plus repeated lifegain now also seeds White Mage counters.'},
  {name:'Vindicate',reason:'Retained over Stroke of Midnight because land interaction is a unique axis; A10 showed no measurable gain from Stroke.'},
  {name:'Coveted Jewel',reason:'Retained over Bolas Citadel because the current simulator cannot faithfully value Citadel top-casting and Jewel supplies immediate draw plus mana.'},
  {name:'Blue Mage\'s Cane',reason:'Retained as an on-theme MV3 spell-copy engine rather than trimming Scions identity for generic interaction.'},
  {name:'Champions from Beyond',reason:'Retained as an X-cost Ystola trigger, board producer and conditional card-flow piece.'},
] as const;
const SCENARIOS:Array<{pressure:PodPressureV06;turns:number;seed:number}>=[
  {pressure:'upgraded',turns:5,seed:20260831},{pressure:'upgraded',turns:7,seed:20260913},
  {pressure:'optimized',turns:5,seed:20260929},{pressure:'optimized',turns:7,seed:20261029},
  {pressure:'cedh',turns:5,seed:20261123},{pressure:'cedh',turns:7,seed:20270103},{pressure:'cedh',turns:9,seed:20270213},
];
const norm=(v:string)=>v.trim().toLocaleLowerCase();
const rec=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:0;
const avg=(v:readonly number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;
interface Deck{parsed:ParsedDeck;cards:ScryfallCard[];text:string;notFound:string[];}
function ids(p:ParsedDeck):CardIdentifierInput[]{return [...p.commanders,...p.main].map(e=>({name:e.name,...(e.set?{set:e.set}:{}),...(e.collectorNumber?{collectorNumber:e.collectorNumber}:{})}));}
async function resolve(text:string):Promise<Deck>{const parsed=parseDecklist(text);const r=await getCardsByIdentifiers(ids(parsed));return{parsed,cards:r.cards,text,notFound:r.notFound};}
function cardByName(d:Deck,name:string){return d.cards.find(c=>norm(c.name)===norm(name)||norm(c.name.split(' // ')[0]??'')===norm(name));}
function manaValueFromCost(cost:string):number{let total=0;for(const m of cost.matchAll(/\{([^}]+)\}/g)){const s=(m[1]??'').toUpperCase();if(/^\d+$/.test(s))total+=Number(s);else if(/^[WUBRGC]$/.test(s))total+=1;else if(s.includes('/'))total+=1;}return total;}
function qualifiesFace(face:{type_line?:string;mana_cost?:string},fallback:number){const t=(face.type_line??'').toLowerCase();const mv=face.mana_cost?manaValueFromCost(face.mana_cost):fallback;return !t.includes('creature')&&!t.includes('land')&&mv>=3;}
function ystolaOffers(d:Deck){let count=0;for(const e of d.parsed.main){const c=cardByName(d,e.name);if(!c)continue;const faces=c.card_faces??[];const q=faces.length?faces.some(f=>qualifiesFace(f,c.cmc)):qualifiesFace({type_line:c.type_line,mana_cost:c.mana_cost},c.cmc);if(q)count+=e.quantity;}return count;}
function trueStack(d:Deck){const names=new Set(d.parsed.main.map(e=>norm(e.name)));return ['force of negation','arcane denial',"dovin's veto",'hypnotic sprite','sublime epiphany','ranger-captain of eos'].filter(n=>names.has(n)).length;}
function trueWipes(d:Deck){const names=new Set(d.parsed.main.map(e=>norm(e.name)));return ['cleansing nova','final judgment','toxic deluge'].filter(n=>names.has(n)).length;}
interface Signal{keep:number;uptime:number;protection:number;spells:number;draws:number;}
function signal(r:Record<string,unknown>):Signal{const b=rec(r.baseline),a=rec(r.advanced);return{keep:num(rec(b.openingHands).functionalKeepRate),uptime:num(rec(a.commanderPressure).battlefieldUptimePercent),protection:num(rec(a.interactionPressure).protectionWinRateWhenChallenged),spells:num(rec(a.cardFlow).averageSpellsCast),draws:num(rec(a.cardFlow).averageCardsDrawnByEffects)};}
function delta(a:Signal,b:Signal):Signal{return{keep:b.keep-a.keep,uptime:b.uptime-a.uptime,protection:b.protection-a.protection,spells:b.spells-a.spells,draws:b.draws-a.draws};}
function mean(v:Signal[]):Signal{return{keep:avg(v.map(x=>x.keep)),uptime:avg(v.map(x=>x.uptime)),protection:avg(v.map(x=>x.protection)),spells:avg(v.map(x=>x.spells)),draws:avg(v.map(x=>x.draws))};}
function sim(d:Deck,s:{pressure:PodPressureV06;turns:number;seed:number}){return simulateDeckGameplayV06(d.parsed,d.cards,{iterations:3200,advancedIterations:3200,turns:s.turns,seed:s.seed,pressure:s.pressure}) as unknown as Record<string,unknown>;}
function mainNames(d:Deck){return new Set(d.parsed.main.map(e=>norm(e.name)));}
async function main(){
 const [a5Text,a11Text]=await Promise.all([readFile(A5,'utf8'),readFile(A11,'utf8')]);const [a5,a11]=await Promise.all([resolve(a5Text),resolve(a11Text)]);const failures:string[]=[];const policy=await resolvePrintingPolicyV08({printingFamily:'Final Fantasy',includePromos:true,includeSpecialReleases:true});
 const legal=validateCommanderDeck(a11.parsed,a11.cards);if(a11.parsed.totalCards!==100)failures.push(`count:${a11.parsed.totalCards}`);if(a11.notFound.length)failures.push(`unresolved:${a11.notFound.join('|')}`);if(!legal.isLegal)failures.push(`commander:${legal.status}`);if(!a11.cards.every(c=>printingMatchesPolicyV08(c,policy,AS_OF)))failures.push('ff-printing-policy');
 const a5Names=mainNames(a5),a11Names=mainNames(a11);for(const[cut,add]of EXPECTED_SWAPS){if(!a5Names.has(norm(cut))||a11Names.has(norm(cut)))failures.push(`swap-cut:${cut}`);if(a5Names.has(norm(add))||!a11Names.has(norm(add)))failures.push(`swap-add:${add}`);}for(const n of LOCKED){if(norm(n)===norm("Y'shtola, Night's Blessed")){if(!a11.parsed.commanders.some(e=>norm(e.name)===norm(n)))failures.push(`locked:${n}`);}else if(!a11Names.has(norm(n)))failures.push(`locked:${n}`);}
 const comboLocked=['the destined white mage','walking ballista','diabolic intent','ranger-captain of eos'].every(n=>a11Names.has(n));if(!comboLocked)failures.push('combo-package');
 const m5=buildDeckMetrics(a5.parsed,a5.cards),m11=buildDeckMetrics(a11.parsed,a11.cards),y5=ystolaOffers(a5),y11=ystolaOffers(a11),stack5=trueStack(a5),stack11=trueStack(a11),w5=trueWipes(a5),w11=trueWipes(a11);
 if(y11<29)failures.push(`ystola-offers:${y11}`);if(stack11<6)failures.push(`stack:${stack11}`);if(w11<3)failures.push(`wipes:${w11}`);if(m11.landCount!==m5.landCount)failures.push('land-count-regression');if(m11.rampCount<m5.rampCount-1)failures.push('ramp-regression');
 const scenarioResults=[];const ds:Signal[]=[];for(const s of SCENARIOS){const b=signal(sim(a5,s)),n=signal(sim(a11,s)),d=delta(b,n);ds.push(d);scenarioResults.push({...s,a5:b,a11:n,delta:d});}const d=mean(ds);
 if(d.keep<-1.5)failures.push('sim:keep');if(d.uptime<-3)failures.push('sim:uptime');if(d.protection<3)failures.push('sim:protection-gain');if(d.spells<-0.22)failures.push('sim:spells');if(d.draws<-0.32)failures.push('sim:draws');
 const report={status:failures.length?'REVIEW':'PASS',failures,legal,expectedSwaps:EXPECTED_SWAPS.map(([cut,add])=>({cut,add})),lockedCombo:['The Destined White Mage','Walking Ballista','Diabolic Intent','Ranger-Captain of Eos'],reviewedKeep:REVIEWED_KEEP,a5:{metrics:m5,ystolaOffers:y5,trueStack:stack5,trueWipes:w5},a11:{metrics:m11,ystolaOffers:y11,trueStack:stack11,trueWipes:w11},meanDeltaVsA5:d,scenarioResults,boundary:'A11 final-product candidate only. Stable/current, PR #29, and Counter Blitz checkpoints are untouched.'};await writeFile('scions-spellcraft-a11-finalization.json',JSON.stringify(report,null,2));
 const md=['# Scions & Spellcraft A11 — Finalization Gate','',`- Result: **${report.status}**`,`- Failures: ${failures.length?failures.join('; '):'none'}`,`- Exact 100: ${a11.parsed.totalCards===100}`,`- Commander legal: ${legal.isLegal}`,`- FINAL FANTASY printing policy: ${a11.cards.every(c=>printingMatchesPolicyV08(c,policy,AS_OF))}`,`- Combo package locked: ${comboLocked}`,'',`- Y'shtola spell opportunities: ${y5} -> ${y11}`,`- True stack/combo-protection pieces: ${stack5} -> ${stack11}`,`- True wipes: ${w5} -> ${w11}`,`- Lands: ${m5.landCount} -> ${m11.landCount}`,`- Ramp: ${m5.rampCount} -> ${m11.rampCount}`,`- Avg nonland MV: ${m5.averageNonlandManaValue.toFixed(2)} -> ${m11.averageNonlandManaValue.toFixed(2)}`,'',`- Mean Δ functional keep vs A5: ${d.keep.toFixed(3)}`,`- Mean Δ commander uptime vs A5: ${d.uptime.toFixed(3)}`,`- Mean Δ protection vs A5: ${d.protection.toFixed(3)}`,`- Mean Δ spells cast vs A5: ${d.spells.toFixed(3)}`,`- Mean Δ effect-draws vs A5: ${d.draws.toFixed(3)}`,'','## Accepted A5 -> A11 changes',...EXPECTED_SWAPS.map(([cut,add])=>`- ${cut} -> ${add}`),'','## Manually reviewed keeps',...REVIEWED_KEEP.map(x=>`- **${x.name}** — ${x.reason}`),'','Boundary: this gate finalizes the deck candidate only; it does not promote stable/current or touch PR #29.',''].join('\n');await writeFile('scions-spellcraft-a11-finalization.md',md);console.log(md);if(failures.length)process.exitCode=1;
}
await main();
