import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06, type PodPressureV06 } from '../src/services/simulation-v06.js';
import { BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15, BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15, minimumPersistentColoredManaSourcesV15 } from '../src/services/upgrade.js';

const BASE='test-results/exploratory/counter-blitz-a22d-synergy-repair-deck.txt';
const ROUTES=[['The Destined White Mage','Walking Ballista'],['Gatta and Luzzu','Hardened Scales','Walking Ballista'],['Gatta and Luzzu','The Earth Crystal','Walking Ballista']] as const;
const ADDS={
 yuna:{name:'Yuna, Grand Summoner',line:'1 Yuna, Grand Summoner (FIC) 8'},
 defense:{name:'Resourceful Defense',line:'1 Resourceful Defense (FIC) 251'},
 apparition:{name:'Grateful Apparition',line:'1 Grateful Apparition (FIC) 244'},
 ixion:{name:'Summon: Ixion',line:'1 Summon: Ixion (FIC) 27'},
} as const;

const VARIANTS=[
 {key:'ixion-sidequest',swaps:[['Sidequest: Raise a Chocobo // Black Chocobo','ixion']] as const},
 {key:'apparition-sidequest',swaps:[['Sidequest: Raise a Chocobo // Black Chocobo','apparition']] as const},
 {key:'defense-key',swaps:[['Key to the City','defense']] as const},
 {key:'apparition-key',swaps:[['Key to the City','apparition']] as const},
 {key:'yuna-copter__ixion-sidequest',swaps:[["Smuggler's Copter",'yuna'],['Sidequest: Raise a Chocobo // Black Chocobo','ixion']] as const},
 {key:'defense-staff__ixion-sidequest',swaps:[['Staff of the Storyteller','defense'],['Sidequest: Raise a Chocobo // Black Chocobo','ixion']] as const},
 {key:'yuna-copter__apparition-sidequest',swaps:[["Smuggler's Copter",'yuna'],['Sidequest: Raise a Chocobo // Black Chocobo','apparition']] as const},
 {key:'defense-staff__apparition-sidequest',swaps:[['Staff of the Storyteller','defense'],['Sidequest: Raise a Chocobo // Black Chocobo','apparition']] as const},
 {key:'yuna-copter__defense-staff',swaps:[["Smuggler's Copter",'yuna'],['Staff of the Storyteller','defense']] as const},
 {key:'yuna-copter__defense-staff__ixion-sidequest',swaps:[["Smuggler's Copter",'yuna'],['Staff of the Storyteller','defense'],['Sidequest: Raise a Chocobo // Black Chocobo','ixion']] as const},
 {key:'yuna-copter__defense-staff__apparition-sidequest',swaps:[["Smuggler's Copter",'yuna'],['Staff of the Storyteller','defense'],['Sidequest: Raise a Chocobo // Black Chocobo','apparition']] as const},
] as const;

const SCENARIOS:Array<{pressure:PodPressureV06;turns:number;seed:number}>=[
 {pressure:'upgraded',turns:5,seed:20260831},{pressure:'upgraded',turns:7,seed:20260907},{pressure:'optimized',turns:5,seed:20260921},{pressure:'optimized',turns:7,seed:20261013},{pressure:'cedh',turns:5,seed:20261109},{pressure:'cedh',turns:7,seed:20261215},{pressure:'cedh',turns:9,seed:20270125},
];
const norm=(v:string)=>v.trim().toLocaleLowerCase();
const rec=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:0;
const avg=(v:readonly number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;
function ids(p:ParsedDeck):CardIdentifierInput[]{return[...p.commanders,...p.main].map(e=>({name:e.name,...(e.set?{set:e.set}:{}),...(e.collectorNumber?{collectorNumber:e.collectorNumber}:{})}));}
function identity(p:ParsedDeck,c:readonly ScryfallCard[]):string[]{const n=new Set(p.commanders.map(e=>norm(e.name)));return[...new Set(c.filter(x=>n.has(norm(x.name))).flatMap(x=>x.color_identity))].sort();}
function addId(line:string,name:string):CardIdentifierInput{const m=line.match(/^1 (.+) \(([^)]+)\) (.+)$/);if(!m)throw new Error(`Bad line ${line}`);return{name,set:m[2],collectorNumber:m[3]};}
function apply(text:string,swaps:readonly(readonly [string,keyof typeof ADDS])[]):string{const lines=text.split(/\r?\n/);for(const[cut,key]of swaps){const i=lines.findIndex(l=>l.startsWith(`1 ${cut} (`));if(i<0)throw new Error(`Missing cut ${cut}`);lines[i]=ADDS[key].line;}return lines.join('\n');}
interface Signal{keep:number;uptime:number;protection:number;spells:number;draws:number;white:number;gattaScales:number;gattaCrystal:number;}
function signal(r:Record<string,unknown>,turns:number):Signal{const b=rec(r.baseline),a=rec(r.advanced),cs=Array.isArray(a.combos)?a.combos.map(rec):[],k=`turn${turns}`,ready=cs.map(c=>num(rec(c.allNamedPiecesInHandOrBattlefieldByTurn)[k]));return{keep:num(rec(b.openingHands).functionalKeepRate),uptime:num(rec(a.commanderPressure).battlefieldUptimePercent),protection:num(rec(a.interactionPressure).protectionWinRateWhenChallenged),spells:num(rec(a.cardFlow).averageSpellsCast),draws:num(rec(a.cardFlow).averageCardsDrawnByEffects),white:ready[0]??0,gattaScales:ready[1]??0,gattaCrystal:ready[2]??0};}
function delta(b:Signal,a:Signal):Signal{return{keep:a.keep-b.keep,uptime:a.uptime-b.uptime,protection:a.protection-b.protection,spells:a.spells-b.spells,draws:a.draws-b.draws,white:a.white-b.white,gattaScales:a.gattaScales-b.gattaScales,gattaCrystal:a.gattaCrystal-b.gattaCrystal};}
function mean(v:readonly Signal[]):Signal{return{keep:avg(v.map(x=>x.keep)),uptime:avg(v.map(x=>x.uptime)),protection:avg(v.map(x=>x.protection)),spells:avg(v.map(x=>x.spells)),draws:avg(v.map(x=>x.draws)),white:avg(v.map(x=>x.white)),gattaScales:avg(v.map(x=>x.gattaScales)),gattaCrystal:avg(v.map(x=>x.gattaCrystal))};}
function sim(p:ParsedDeck,c:ScryfallCard[],s:{pressure:PodPressureV06;turns:number;seed:number}):Record<string,unknown>{return simulateDeckGameplayV06(p,c,{iterations:900,advancedIterations:900,turns:s.turns,seed:s.seed,pressure:s.pressure,comboPieces:ROUTES}) as unknown as Record<string,unknown>;}

async function main():Promise<void>{
 console.log('COUNTER BLITZ A23 CLEAN-CUT PRESSURE');
 const baseText=await readFile(BASE,'utf8');const baseParsed=parseDecklist(baseText);const baseResolved=await getCardsByIdentifiers(ids(baseParsed));if(baseResolved.notFound.length)throw new Error(`A22d unresolved: ${JSON.stringify(baseResolved.notFound)}`);const baseCards=baseResolved.cards;const baseMetrics=buildDeckMetrics(baseParsed,baseCards);const colors=identity(baseParsed,baseCards).length;
 const addEntries=Object.entries(ADDS) as Array<[keyof typeof ADDS,(typeof ADDS)[keyof typeof ADDS]]>;const addResolved=await getCardsByIdentifiers(addEntries.map(([,v])=>addId(v.line,v.name)));if(addResolved.notFound.length)throw new Error(`Adds unresolved: ${JSON.stringify(addResolved.notFound)}`);const addMap=new Map(addResolved.cards.map(c=>[norm(c.name),c]));
 const policy=await resolvePrintingPolicyV08({printingFamily:'Final Fantasy',includePromos:true,includeSpecialReleases:true});
 const baseSignals=new Map<string,Signal>();for(const s of SCENARIOS){baseSignals.set(`${s.pressure}-${s.turns}-${s.seed}`,signal(sim(baseParsed,baseCards,s),s.turns));}
 const results:Array<Record<string,unknown>>=[];
 for(const variant of VARIANTS){const text=apply(baseText,variant.swaps);const parsed=parseDecklist(text);let cards=[...baseCards];for(const[cut,key]of variant.swaps){cards=cards.filter(c=>norm(c.name)!==norm(cut));const a=addMap.get(norm(ADDS[key].name));if(!a)throw new Error(`Missing add ${key}`);cards.push(a);}const failures:string[]=[];if(parsed.totalCards!==100)failures.push('count');if(!validateCommanderDeck(parsed,cards).isLegal)failures.push('illegal');if(!cards.every(c=>printingMatchesPolicyV08(c,policy)))failures.push('FF-policy');const m=buildDeckMetrics(parsed,cards);if(m.averageNonlandManaValue>BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15)failures.push('structural:mv');if(m.earlyPlayCount<BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.earlyPlays)failures.push('structural:early');if(m.fastManaCount<BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.fastMana)failures.push('structural:fast-mana');if(Number(m.roleCounts['free interaction']??0)<BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.freeInteraction)failures.push('structural:free-interaction');if(m.persistentColoredManaSourceCount<minimumPersistentColoredManaSourcesV15(colors))failures.push('structural:colored-mana');if(m.rampCount<baseMetrics.rampCount)failures.push('ramp-regression');const corrected=m.cheapInteractionCount+(parsed.main.some(e=>norm(e.name)===norm("Dovin's Veto"))?1:0);if(corrected<BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.cheapInteraction)failures.push('structural:cheap-interaction');const ds:Signal[]=[];const scenarioRows:Array<Record<string,unknown>>=[];for(const s of SCENARIOS){const k=`${s.pressure}-${s.turns}-${s.seed}`,b=baseSignals.get(k);if(!b)throw new Error('Missing baseline');const n=signal(sim(parsed,cards,s),s.turns),d=delta(b,n);ds.push(d);scenarioRows.push({...s,before:b,after:n,delta:d});}const d=mean(ds);if(d.keep<-2.25)failures.push('sim:keep');if(d.uptime<-3.5)failures.push('sim:uptime');if(d.protection<-8)failures.push('sim:protection');if(d.spells<-0.24)failures.push('sim:spells');if(d.draws<-0.45)failures.push('sim:draws');if(d.white<-3.5||d.gattaScales<-3.5||d.gattaCrystal<-3.5)failures.push('sim:combo-route');results.push({variant:variant.key,swaps:variant.swaps.map(([cut,key])=>({cut,add:ADDS[key].name})),status:failures.length?'REVIEW':'PASS',failures,metrics:{mv:m.averageNonlandManaValue,early:m.earlyPlayCount,ramp:m.rampCount,correctedCheapInteraction:corrected,colored:m.persistentColoredManaSourceCount},meanDelta:d,scenarios:scenarioRows});}
 const passes=results.filter(r=>r.status==='PASS');const report={baseline:'A22d accepted exploratory checkpoint',variantCount:results.length,passCount:passes.length,results,boundary:'PASS means bounded regression safety only. Manual Tidus/counter/lore/card-flow synergy remains authoritative.'};await writeFile('counter-blitz-a23-clean-cut-pressure.json',JSON.stringify(report,null,2));const md=['# Counter Blitz A23 — Clean-Cut Pressure','',`- Variants tested: ${results.length}`,`- Variants passing regression guard: ${passes.length}`,'','| Variant | Result | Δ spells | Δ draws | Δ uptime | Δ protection |','|---|---:|---:|---:|---:|---:|',...results.map(r=>{const d=r.meanDelta as Signal;return`| ${r.variant} | ${r.status} | ${d.spells.toFixed(3)} | ${d.draws.toFixed(3)} | ${d.uptime.toFixed(3)} | ${d.protection.toFixed(3)} |`;}),'','PASS is not automatic acceptance; human Counter Blitz synergy review remains required.',''].join('\n');await writeFile('counter-blitz-a23-clean-cut-pressure.md',md);console.log(md);
}
await main();
