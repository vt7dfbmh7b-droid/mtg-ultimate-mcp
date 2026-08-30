import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, inferCardRoles, lookupPrinting, searchCards, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06, type PodPressureV06 } from '../src/services/simulation-v06.js';

const DECK='test-results/exploratory/scions-spellcraft-a5-deck.txt';
const AS_OF='2026-08-31';
const LOCKED=new Set([
  'the destined white mage','walking ballista','diabolic intent','ranger-captain of eos',
  "y\'shtola, night's blessed",'rhystic study','force of negation','clever concealment','swiftfoot boots',
  'papalymo totolymo','lyse hext','emet-selch of the third seat','transpose','circle of power',
  'archmage emeritus','dig through time','into the story','torrential gearhulk','propaganda','exsanguinate',
]);
const MANUAL_BONUS:Record<string,number>={
  'papalymo totolymo':9,'lyse hext':8,'emet-selch of the third seat':8,'transpose':8,'circle of power':7,
  'alisaaie leveilleur':5,'alisaie leveilleur':5,'alphinaud leveilleur':5,'hermes, overseer of elpis':4,
  'fandaniel, telophoroi ascian':5,'observed stasis':4,'urianger augurelt':4,'champions from beyond':4,
  "blue mage's cane":3,'tataru taru':2,'thancred waters':1,'krile baldesion':1,'reaper\'s scythe':0,
  'bastion of remembrance':2,'authority of the consuls':2,'baleful strix':3,'white auracite':1,
  'the destined white mage':8,'walking ballista':6,'diabolic intent':8,'ranger-captain of eos':8,
};
const norm=(v:string)=>v.trim().toLocaleLowerCase();
const rec=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:0;
const avg=(v:readonly number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;
interface Deck{parsed:ParsedDeck;cards:ScryfallCard[];text:string;}
function ids(p:ParsedDeck):CardIdentifierInput[]{return [...p.commanders,...p.main].map(e=>({name:e.name,...(e.set?{set:e.set}:{}),...(e.collectorNumber?{collectorNumber:e.collectorNumber}:{})}));}
async function resolve(text:string):Promise<Deck>{const parsed=parseDecklist(text);const r=await getCardsByIdentifiers(ids(parsed));if(r.notFound.length)throw new Error(`unresolved:${r.notFound.join('|')}`);return{parsed,cards:r.cards,text};}
function entryCard(e:{name:string;set?:string;collectorNumber?:string},cards:readonly ScryfallCard[]):ScryfallCard|undefined{if(e.set&&e.collectorNumber){const x=cards.find(c=>norm(c.set)===norm(e.set??'')&&norm(c.collector_number)===norm(e.collectorNumber??''));if(x)return x;}return cards.find(c=>norm(c.name)===norm(e.name)||norm(c.name.split(' // ')[0]??'')===norm(e.name));}
function typeFlags(c:ScryfallCard){const t=c.type_line.toLowerCase();return{land:t.includes('land'),creature:t.includes('creature'),instant:t.includes('instant'),artifact:t.includes('artifact'),equipment:t.includes('equipment')};}
function qualifies(c:ScryfallCard){const f=typeFlags(c);return !f.land&&!f.creature&&c.cmc>=3;}
function roleSet(c:ScryfallCard){return new Set(inferCardRoles(c));}
function strategicScore(c:ScryfallCard):number{
  const roles=roleSet(c),f=typeFlags(c),text=(c.oracle_text??c.card_faces?.map(x=>x.oracle_text??'').join('\n')??'').toLowerCase();let s=0;
  if(qualifies(c)){s+=6;if(f.instant)s+=2;}
  if(roles.has('card draw'))s+=4;if(roles.has('repeatable draw'))s+=3;if(roles.has('card selection'))s+=2;
  if(roles.has('countermagic'))s+=4;if(roles.has('free interaction'))s+=5;if(roles.has('spot interaction'))s+=3;if(roles.has('board wipe'))s+=3;
  if(roles.has('protection'))s+=4;if(roles.has('board protection'))s+=2;if(roles.has('combo protection'))s+=3;
  if(roles.has('ramp'))s+=3;if(roles.has('mana fixing'))s+=1;if(roles.has('stax/control'))s+=2;if(roles.has('life drain'))s+=3;
  if(text.includes('noncreature spell'))s+=4;if(text.includes('whenever you cast')&&text.includes('spell'))s+=2;
  if(text.includes('search your library for a card'))s+=5;else if(text.includes('search your library'))s+=2;
  if(text.includes('you gain')||text.includes('lifelink'))s+=1;
  if(text.includes('copy target')||text.includes('copy that spell')||text.includes('cast a copy'))s+=2;
  if((roles.has('countermagic')||roles.has('spot interaction')||roles.has('protection')||roles.has('combo protection'))&&c.cmc<=2)s+=2;
  if(f.equipment&&!roles.has('protection'))s-=1;
  if(f.creature&&!roles.has('card draw')&&!roles.has('repeatable draw')&&!roles.has('ramp')&&!roles.has('life drain')&&!text.includes('noncreature spell')&&!text.includes('search your library'))s-=1;
  if(c.cmc>=7&&!roles.has('board wipe')&&!roles.has('card draw')&&!roles.has('free interaction'))s-=1;
  s+=MANUAL_BONUS[norm(c.name)]??0;
  return s;
}
function synergy(d:Deck){let qualifying=0,instants=0,interaction=0,draw=0,protection=0,ramp=0,creatures=0;for(const e of d.parsed.main){const c=entryCard(e,d.cards);if(!c)continue;const roles=roleSet(c),f=typeFlags(c);if(f.creature)creatures+=e.quantity;if(qualifies(c)){qualifying+=e.quantity;if(f.instant)instants+=e.quantity;if(roles.has('countermagic')||roles.has('spot interaction')||roles.has('board wipe')||roles.has('free interaction'))interaction+=e.quantity;}if(roles.has('card draw')||roles.has('repeatable draw')||roles.has('card selection'))draw+=e.quantity;if(roles.has('protection')||roles.has('board protection')||roles.has('combo protection'))protection+=e.quantity;if(roles.has('ramp'))ramp+=e.quantity;}return{qualifying,instants,interaction,draw,protection,ramp,creatures};}
interface Signal{keep:number;uptime:number;protection:number;spells:number;draws:number;}
function signal(r:Record<string,unknown>):Signal{const b=rec(r.baseline),a=rec(r.advanced);return{keep:num(rec(b.openingHands).functionalKeepRate),uptime:num(rec(a.commanderPressure).battlefieldUptimePercent),protection:num(rec(a.interactionPressure).protectionWinRateWhenChallenged),spells:num(rec(a.cardFlow).averageSpellsCast),draws:num(rec(a.cardFlow).averageCardsDrawnByEffects)};}
function delta(a:Signal,b:Signal):Signal{return{keep:b.keep-a.keep,uptime:b.uptime-a.uptime,protection:b.protection-a.protection,spells:b.spells-a.spells,draws:b.draws-a.draws};}
function mean(v:Signal[]):Signal{return{keep:avg(v.map(x=>x.keep)),uptime:avg(v.map(x=>x.uptime)),protection:avg(v.map(x=>x.protection)),spells:avg(v.map(x=>x.spells)),draws:avg(v.map(x=>x.draws))};}
const SIMS:Array<{pressure:PodPressureV06;turns:number;seed:number}>=[
  {pressure:'upgraded',turns:6,seed:20260831},{pressure:'optimized',turns:6,seed:20260917},
  {pressure:'cedh',turns:6,seed:20261003},{pressure:'cedh',turns:8,seed:20261121},
];
function sim(d:Deck,s:{pressure:PodPressureV06;turns:number;seed:number}){return simulateDeckGameplayV06(d.parsed,d.cards,{iterations:650,advancedIterations:650,turns:s.turns,seed:s.seed,pressure:s.pressure}) as unknown as Record<string,unknown>;}
function replaceLine(text:string,cut:string,c:ScryfallCard):string{const lines=text.split('\n');const i=lines.findIndex(l=>/^\d+\s/.test(l)&&norm(l.replace(/^\d+\s+/,'').replace(/\s+\([A-Z0-9]+\)\s+\S+\s*$/,''))===norm(cut));if(i<0)throw new Error(`missing cut line:${cut}`);lines[i]=`1 ${c.name} (${c.set.toUpperCase()}) ${c.collector_number}`;return lines.join('\n');}
function legalCI(c:ScryfallCard){return c.color_identity.every(x=>['W','U','B'].includes(x));}
function auditLabel(name:string,score:number,land:boolean){if(land)return 'land';if(LOCKED.has(norm(name)))return 'locked';if(score>=10)return 'supported';if(score>=5)return 'review';return 'challenge';}

async function candidatePool(policy:Awaited<ReturnType<typeof resolvePrintingPolicyV08>>):Promise<ScryfallCard[]>{
  const q=policy.searchClause;const queries=[
    `${q} legal:commander id<=wub t:instant`,`${q} legal:commander id<=wub t:sorcery`,`${q} legal:commander id<=wub t:enchantment`,
    `${q} legal:commander id<=wub t:artifact`,`${q} legal:commander id<=wub t:creature`,`${q} legal:commander id<=wub t:land`,
    `${q} legal:commander id<=wub mv>=3 -t:creature -t:land`,`${q} legal:commander id<=wub o:"draw"`,
    `${q} legal:commander id<=wub o:"counter target"`,`${q} legal:commander id<=wub o:"each opponent"`,
    `${q} legal:commander id<=wub o:"search your library"`,`${q} legal:commander id<=wub (o:"phase out" OR o:indestructible)`,
  ];
  const found:ScryfallCard[]=[];
  for(const query of queries){try{found.push(...await searchCards(query,50));}catch{/* no-result search is not evidence of absence */}}
  for(const s of policy.exactSpecialPrintings){try{found.push(await lookupPrinting(s.set,s.collectorNumber));}catch{/* exact special unavailable fails out of candidate pool */}}
  const by=new Map<string,ScryfallCard>();for(const c of found){if(c.legalities.commander!=='legal'||!legalCI(c)||!printingMatchesPolicyV08(c,policy,AS_OF))continue;const key=c.oracle_id??norm(c.name);const old=by.get(key);if(!old||strategicScore(c)>strategicScore(old))by.set(key,c);}return [...by.values()];
}

async function main(){
  console.log('SCIONS & SPELLCRAFT A6 FULL SLOT AUDIT + FF-ONLY SATURATION SCREEN');
  const text=await readFile(DECK,'utf8'),base=await resolve(text),policy=await resolvePrintingPolicyV08({printingFamily:'Final Fantasy',includePromos:true,includeSpecialReleases:true});
  const legality=validateCommanderDeck(base.parsed,base.cards);if(base.parsed.totalCards!==100||!legality.isLegal||!base.cards.every(c=>printingMatchesPolicyV08(c,policy,AS_OF)))throw new Error(`hard truth failed count=${base.parsed.totalCards} legal=${legality.status}`);
  const m0=buildDeckMetrics(base.parsed,base.cards),s0=synergy(base),currentNames=new Set(base.parsed.main.map(e=>norm(e.name)));
  const audit=[] as Array<Record<string,unknown>>;
  for(const e of base.parsed.main){const c=entryCard(e,base.cards);if(!c)continue;const score=strategicScore(c),roles=inferCardRoles(c);audit.push({name:e.name,quantity:e.quantity,set:c.set.toUpperCase(),collectorNumber:c.collector_number,manaValue:c.cmc,type:c.type_line,qualifiesYstola:qualifies(c),score,label:auditLabel(e.name,score,typeFlags(c).land),roles});}
  const pool=(await candidatePool(policy)).filter(c=>!currentNames.has(norm(c.name)));
  const cuts=audit.filter(x=>x.label!=='locked'&&x.label!=='land').map(x=>String(x.name));
  const structural=[] as Array<any>;
  for(const cut of cuts){const cutEntry=base.parsed.main.find(e=>norm(e.name)===norm(cut));const cutCard=cutEntry?entryCard(cutEntry,base.cards):undefined;if(!cutCard)continue;for(const cand of pool){if(typeFlags(cand).land)continue;let variantText:string;try{variantText=replaceLine(text,cut,cand);}catch{continue;}const parsed=parseDecklist(variantText);const cards=base.cards.filter(c=>c.id!==cutCard.id).concat(cand);const d:Deck={parsed,cards,text:variantText};const m=buildDeckMetrics(parsed,cards),sy=synergy(d);const structuralPass=m.landCount===m0.landCount&&m.rampCount>=m0.rampCount-1&&m.interactionCount>=m0.interactionCount-1&&m.protectionCount>=m0.protectionCount&&m.earlyPlayCount>=m0.earlyPlayCount-1&&sy.qualifying>=s0.qualifying-1&&sy.draw>=s0.draw-1;const gain=strategicScore(cand)-strategicScore(cutCard)+2*(sy.qualifying-s0.qualifying)+1.5*(m.interactionCount-m0.interactionCount)+1.5*(m.protectionCount-m0.protectionCount)+(sy.draw-s0.draw)+(m.rampCount-m0.rampCount)+(cand.edhrec_rank?Math.max(0,2-Math.log10(Math.max(10,cand.edhrec_rank))/2):0);if(structuralPass&&gain>0.5)structural.push({cut,add:cand.name,addSet:cand.set.toUpperCase(),addCollector:cand.collector_number,gain,cutScore:strategicScore(cutCard),addScore:strategicScore(cand),metricsDelta:{mv:m.averageNonlandManaValue-m0.averageNonlandManaValue,ramp:m.rampCount-m0.rampCount,interaction:m.interactionCount-m0.interactionCount,protection:m.protectionCount-m0.protectionCount,early:m.earlyPlayCount-m0.earlyPlayCount},synergyDelta:{qualifying:sy.qualifying-s0.qualifying,instants:sy.instants-s0.instants,draw:sy.draw-s0.draw,interaction:sy.interaction-s0.interaction,protection:sy.protection-s0.protection},variantText,cand});}}
  structural.sort((a,b)=>b.gain-a.gain);
  const finalists=[] as typeof structural;const perAdd=new Map<string,number>(),perCut=new Map<string,number>();for(const x of structural){if(finalists.length>=24)break;const a=perAdd.get(norm(x.add))??0,c=perCut.get(norm(x.cut))??0;if(a>=3||c>=3)continue;finalists.push(x);perAdd.set(norm(x.add),a+1);perCut.set(norm(x.cut),c+1);}
  const baseSims=SIMS.map(s=>signal(sim(base,s)));const simulated=[] as Array<any>;
  for(const x of finalists){const d:Deck={parsed:parseDecklist(x.variantText),cards:base.cards.filter(c=>norm(c.name)!==norm(x.cut)).concat(x.cand),text:x.variantText};const ds=SIMS.map((s,i)=>delta(baseSims[i]!,signal(sim(d,s))));const md=mean(ds);const pass=md.keep>=-1.5&&md.uptime>=-4&&md.protection>=-6&&md.spells>=-0.18&&md.draws>=-0.28;const composite=x.gain+md.spells*4+md.draws*3+md.uptime*0.08+md.protection*0.05;simulated.push({cut:x.cut,add:x.add,addSet:x.addSet,addCollector:x.addCollector,structuralGain:x.gain,pass,meanDelta:md,metricsDelta:x.metricsDelta,synergyDelta:x.synergyDelta,composite});}
  simulated.sort((a,b)=>Number(b.pass)-Number(a.pass)||b.composite-a.composite);
  const counts=audit.reduce((acc:any,x:any)=>(acc[x.label]=(acc[x.label]??0)+Number(x.quantity??1),acc),{});
  const report={status:'exploratory-full-slot-audit',hardTruth:{exact100:base.parsed.totalCards===100,commanderLegal:legality.isLegal,ffPrintingPolicy:true},baseline:{metrics:m0,synergy:s0},auditCounts:counts,audit,candidatePoolSize:pool.length,structuralCandidates:structural.length,structuralTop:structural.slice(0,40).map(({variantText,cand,...x})=>x),simulatedFinalists:simulated,boundary:'Purpose labels and scores guide saturation search; they are not automatic optimality verdicts. Combo package and core Y\'shtola/Scions engines are locked for this pass. Manual card-text review is required before accepting any swap.'};
  await writeFile('scions-spellcraft-a6-full-slot-audit.json',JSON.stringify(report,null,2));
  const review=audit.filter((x:any)=>x.label==='review'||x.label==='challenge').sort((a:any,b:any)=>Number(a.score)-Number(b.score));
  const md=['# Scions & Spellcraft A6 — Full Slot Audit + FF-only Saturation','',`- Exact 100: **yes**`,`- Commander legal: **yes**`,`- FF-printing-only: **yes**`,`- Candidate pool inspected: **${pool.length}**`,`- Structurally viable positive one-card swaps: **${structural.length}**`,`- Simulated finalists: **${simulated.length}**`,'',`## Baseline`,`- Y'shtola-qualifying MV3+ noncreature spells: ${s0.qualifying}`,`- Qualifying instants: ${s0.instants}`,`- Detected draw/selection engines: ${s0.draw}`,`- Ramp: ${m0.rampCount}`,`- Interaction: ${m0.interactionCount}`,`- Protection: ${m0.protectionCount}`,`- Average nonland MV: ${m0.averageNonlandManaValue.toFixed(2)}`,'',`## Purpose audit counts`,`- Locked: ${counts.locked??0}`,`- Supported: ${counts.supported??0}`,`- Review: ${counts.review??0}`,`- Challenge: ${counts.challenge??0}`,`- Lands: ${counts.land??0}`,'','## Review / challenge slots',...review.map((x:any)=>`- **${x.name}** — ${x.label}, score ${Number(x.score).toFixed(1)}; ${x.qualifiesYstola?'qualifies Y\'shtola':'does not qualify Y\'shtola'}; roles: ${(x.roles as string[]).join(', ')||'none detected'}`),'','## Best simulated one-card finalists',...simulated.slice(0,16).map((x:any)=>`- **${x.cut} -> ${x.add} (${x.addSet}) ${x.addCollector}** — ${x.pass?'PASS':'REVIEW'}; structural ${x.structuralGain.toFixed(2)}; Δ spells ${x.meanDelta.spells.toFixed(3)}, draw ${x.meanDelta.draws.toFixed(3)}, uptime ${x.meanDelta.uptime.toFixed(3)}, protection ${x.meanDelta.protection.toFixed(3)}, Y'shtola qualifiers ${x.synergyDelta.qualifying>=0?'+':''}${x.synergyDelta.qualifying}`),'','Boundary: the machine screen is a regression guard and search aid. No swap is accepted until its actual card function and the lost card are manually audited.',''].join('\n');
  await writeFile('scions-spellcraft-a6-full-slot-audit.md',md);console.log(md);
}
await main();
