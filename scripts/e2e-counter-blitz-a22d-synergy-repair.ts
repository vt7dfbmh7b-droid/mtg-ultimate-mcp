import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { comboAccessQualityV15 } from '../src/services/combo-access-quality-v15.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06, type PodPressureV06 } from '../src/services/simulation-v06.js';
import { BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15, BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15, minimumPersistentColoredManaSourcesV15 } from '../src/services/upgrade.js';

const A21='test-results/exploratory/counter-blitz-a21-final-deck.txt';
const A22D='test-results/exploratory/counter-blitz-a22d-synergy-repair-deck.txt';
const SWAPS=[
 ['Sram, Senior Edificer','The Destined White Mage'],
 ['Puresteel Paladin',"Tromell, Seymour's Butler"],
 ['Lunatic Pandora','Rikku, Resourceful Guardian'],
 ["Summoner's Sending","Dovin's Veto"],
] as const;
const LEGACY=[['Gatta and Luzzu','Hardened Scales','Walking Ballista'],['Gatta and Luzzu','The Earth Crystal','Walking Ballista']] as const;
const ALL=[['The Destined White Mage','Walking Ballista'],...LEGACY] as const;
const PIECES=['The Destined White Mage','Walking Ballista','Gatta and Luzzu','Hardened Scales','The Earth Crystal'] as const;
const SCENARIOS:Array<{pressure:PodPressureV06;turns:number;seed:number}>=[
 {pressure:'upgraded',turns:5,seed:20260830},{pressure:'upgraded',turns:7,seed:20260905},{pressure:'optimized',turns:5,seed:20260919},{pressure:'optimized',turns:7,seed:20261011},{pressure:'cedh',turns:5,seed:20261107},{pressure:'cedh',turns:7,seed:20261213},{pressure:'cedh',turns:9,seed:20270123},
];
const norm=(v:string)=>v.trim().toLocaleLowerCase();
const rec=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:0;
const avg=(v:readonly number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;
function ids(p:ParsedDeck):CardIdentifierInput[]{return [...p.commanders,...p.main].map(e=>({name:e.name,...(e.set?{set:e.set}:{}),...(e.collectorNumber?{collectorNumber:e.collectorNumber}:{})}));}
async function resolve(text:string){const parsed=parseDecklist(text);const r=await getCardsByIdentifiers(ids(parsed));return{parsed,cards:r.cards,notFound:r.notFound};}
function identity(p:ParsedDeck,c:readonly ScryfallCard[]):string[]{const n=new Set(p.commanders.map(e=>norm(e.name)));return[...new Set(c.filter(x=>n.has(norm(x.name))).flatMap(x=>x.color_identity))].sort();}
interface Signal{keep:number;uptime:number;protection:number;spells:number;draws:number;route1:number;route2:number;}
function signal(r:Record<string,unknown>,turns:number):Signal{const b=rec(r.baseline),a=rec(r.advanced),cs=Array.isArray(a.combos)?a.combos.map(rec):[],k=`turn${turns}`,ready=cs.map(c=>num(rec(c.allNamedPiecesInHandOrBattlefieldByTurn)[k]));return{keep:num(rec(b.openingHands).functionalKeepRate),uptime:num(rec(a.commanderPressure).battlefieldUptimePercent),protection:num(rec(a.interactionPressure).protectionWinRateWhenChallenged),spells:num(rec(a.cardFlow).averageSpellsCast),draws:num(rec(a.cardFlow).averageCardsDrawnByEffects),route1:ready[0]??0,route2:ready[1]??0};}
function delta(b:Signal,a:Signal):Signal{return{keep:a.keep-b.keep,uptime:a.uptime-b.uptime,protection:a.protection-b.protection,spells:a.spells-b.spells,draws:a.draws-b.draws,route1:a.route1-b.route1,route2:a.route2-b.route2};}
function mean(rs:readonly Signal[]):Signal{return{keep:avg(rs.map(r=>r.keep)),uptime:avg(rs.map(r=>r.uptime)),protection:avg(rs.map(r=>r.protection)),spells:avg(rs.map(r=>r.spells)),draws:avg(rs.map(r=>r.draws)),route1:avg(rs.map(r=>r.route1)),route2:avg(rs.map(r=>r.route2))};}
function sim(p:ParsedDeck,c:ScryfallCard[],s:{pressure:PodPressureV06;turns:number;seed:number},combos:readonly(readonly string[])[]):Record<string,unknown>{return simulateDeckGameplayV06(p,c,{iterations:1400,advancedIterations:1400,turns:s.turns,seed:s.seed,pressure:s.pressure,comboPieces:combos}) as unknown as Record<string,unknown>;}

async function main():Promise<void>{
 console.log('COUNTER BLITZ A22D SYNERGY REPAIR');
 const [bt,nt]=await Promise.all([readFile(A21,'utf8'),readFile(A22D,'utf8')]);const [base,next]=await Promise.all([resolve(bt),resolve(nt)]);
 const policy=await resolvePrintingPolicyV08({printingFamily:'Final Fantasy',includePromos:true,includeSpecialReleases:true});const failures:string[]=[];
 for(const [label,state] of [['A21',base],['A22d',next]] as const){if(state.notFound.length)failures.push(`${label}:unresolved`);if(state.parsed.totalCards!==100)failures.push(`${label}:count`);if(!validateCommanderDeck(state.parsed,state.cards).isLegal)failures.push(`${label}:illegal`);if(!state.cards.every(c=>printingMatchesPolicyV08(c,policy)))failures.push(`${label}:FF-policy`);}
 const before=new Set(base.parsed.main.map(e=>norm(e.name))),after=new Set(next.parsed.main.map(e=>norm(e.name)));
 for(const[cut,add]of SWAPS){if(!before.has(norm(cut))||after.has(norm(cut)))failures.push(`bad-cut:${cut}`);if(before.has(norm(add))||!after.has(norm(add)))failures.push(`bad-add:${add}`);}
 const m0=buildDeckMetrics(base.parsed,base.cards),m1=buildDeckMetrics(next.parsed,next.cards),colors=identity(next.parsed,next.cards).length;
 if(m1.averageNonlandManaValue>BRACKET_FIVE_AVERAGE_NONLAND_MV_MAX_V15)failures.push('structural:mv');
 if(m1.earlyPlayCount<BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.earlyPlays)failures.push('structural:early');
 if(m1.fastManaCount<BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.fastMana)failures.push('structural:fast-mana');
 if(Number(m1.roleCounts['free interaction']??0)<BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.freeInteraction)failures.push('structural:free-interaction');
 if(m1.persistentColoredManaSourceCount<minimumPersistentColoredManaSourcesV15(colors))failures.push('structural:colored-mana');
 if(m1.rampCount<m0.rampCount)failures.push('ramp-regression');
 const hasVeto=after.has(norm("Dovin's Veto"));
 const correctedCheapInteraction=m1.cheapInteractionCount+(hasVeto?1:0);
 if(correctedCheapInteraction<BRACKET_FIVE_AUTHORITATIVE_TARGETS_V15.cheapInteraction)failures.push(`structural:corrected-cheap-interaction-${correctedCheapInteraction}`);
 const pieces=PIECES.map(n=>next.cards.find(c=>norm(c.name)===norm(n))).filter((c):c is ScryfallCard=>Boolean(c));assert.equal(pieces.length,PIECES.length);const comboAccess=comboAccessQualityV15(next.cards,pieces);
 const ds:Signal[]=[];const scenarios:Array<Record<string,unknown>>=[];const white:Array<Record<string,unknown>>=[];
 for(const s of SCENARIOS){const b=signal(sim(base.parsed,base.cards,s,LEGACY),s.turns),a=signal(sim(next.parsed,next.cards,s,LEGACY),s.turns),d=delta(b,a);ds.push(d);scenarios.push({...s,before:b,after:a,delta:d});const ar=rec(sim(next.parsed,next.cards,s,ALL).advanced),cs=Array.isArray(ar.combos)?ar.combos.map(rec):[],w=cs[0]??{},k=`turn${s.turns}`;white.push({...s,ready:num(rec(w.allNamedPiecesInHandOrBattlefieldByTurn)[k]),seen:num(rec(w.allNamedPiecesSeenByTurn)[k])});}
 const d=mean(ds);if(d.keep<-2.5)failures.push('sim:keep');if(d.uptime<-4)failures.push('sim:uptime');if(d.protection<-8)failures.push('sim:protection');if(d.spells<-0.25)failures.push('sim:spells');if(d.draws<-0.45)failures.push('sim:draws');if(d.route1<-3.5||d.route2<-3.5)failures.push('sim:legacy-combo');
 const report={status:failures.length?'REVIEW':'PASS',swaps:SWAPS.map(([cut,add])=>({cut,add})),failures,metrics:{a21:{mv:m0.averageNonlandManaValue,early:m0.earlyPlayCount,ramp:m0.rampCount,rawCheapInteraction:m0.cheapInteractionCount,colored:m0.persistentColoredManaSourceCount},a22d:{mv:m1.averageNonlandManaValue,early:m1.earlyPlayCount,ramp:m1.rampCount,rawCheapInteraction:m1.cheapInteractionCount,correctedCheapInteraction,colored:m1.persistentColoredManaSourceCount}},comboAccess,meanDelta:d,scenarios,whiteMageRoute:white,metricCorrections:["Lunatic Pandora was a false cheap-interaction positive because the deck metric used card CMC instead of its six-mana activation cost.","Dovin's Veto is a false countermagic negative because role inference matches 'counter target spell' but not 'counter target noncreature spell'."],boundary:'Simulation is a regression guard; manual Tidus/counter synergy audit remains authoritative.'};
 await writeFile('counter-blitz-a22d-synergy-repair.json',JSON.stringify(report,null,2));
 const md=['# Counter Blitz A22d — Synergy Repair','',...SWAPS.map(([c,a])=>`- ${c} -> ${a}`),'',`- Result: **${report.status}**`,`- Failures: ${failures.length?failures.join('; '):'none'}`,`- Average nonland MV: ${m0.averageNonlandManaValue.toFixed(3)} -> ${m1.averageNonlandManaValue.toFixed(3)}`,`- Early plays: ${m0.earlyPlayCount} -> ${m1.earlyPlayCount}`,`- Ramp: ${m0.rampCount} -> ${m1.rampCount}`,`- Raw cheap interaction: ${m0.cheapInteractionCount} -> ${m1.cheapInteractionCount}`,`- Corrected A22d cheap interaction: ${correctedCheapInteraction}`,`- Persistent colored mana: ${m0.persistentColoredManaSourceCount} -> ${m1.persistentColoredManaSourceCount}`,`- Combo access score: ${comboAccess.weightedScore}`,`- Mean Δ spells: ${d.spells.toFixed(3)}`,`- Mean Δ draws: ${d.draws.toFixed(3)}`,`- Mean Δ commander uptime: ${d.uptime.toFixed(3)}`,`- Mean Δ protection: ${d.protection.toFixed(3)}`,'','Metric correction: Pandora was a false cheap-interaction positive; Dovin\'s Veto is a false countermagic negative in the current regex.',''].join('\n');await writeFile('counter-blitz-a22d-synergy-repair.md',md);console.log(md);if(failures.length)process.exitCode=1;
}
await main();
