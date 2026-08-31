import { readFile, writeFile } from 'node:fs/promises';
import type { ScryfallCard } from '../src/types/scryfall.js';
import { validateCommanderDeck } from '../src/services/commander-rules.js';
import { buildDeckMetrics, parseDecklist, type ParsedDeck } from '../src/services/deck.js';
import { printingMatchesPolicyV08, resolvePrintingPolicyV08 } from '../src/services/printing-policy-v08.js';
import { getCardsByIdentifiers, type CardIdentifierInput } from '../src/services/scryfall.js';
import { simulateDeckGameplayV06, type PodPressureV06 } from '../src/services/simulation-v06.js';

const DECK='test-results/exploratory/scions-spellcraft-a5-deck.txt';
const AS_OF='2026-08-31';
type Swap={cut:string;line:string};
const S={
 denial:{cut:"Reaper's Scythe",line:'1 Arcane Denial (RFIN) J2'},
 veto:{cut:'Tome of Legends',line:"1 Dovin's Veto (FCA) 51"},
 deluge:{cut:'Crux of Fate',line:'1 Toxic Deluge (SLD) 1860'},
 rift:{cut:'Rite of Replication',line:'1 Cyclonic Rift (SLD) 1869'},
 stroke:{cut:'Vindicate',line:'1 Stroke of Midnight (FCA) 26'},
 brainstorm:{cut:'Tome of Legends',line:'1 Brainstorm (FCA) 28'},
} satisfies Record<string,Swap>;
const VARIANTS={
 a5:[],
 conservative:[S.denial,S.veto,S.deluge],
 control:[S.denial,S.veto,S.deluge,S.rift],
 control_stroke:[S.denial,S.veto,S.deluge,S.rift,S.stroke],
 velocity:[S.denial,S.brainstorm,S.deluge],
} satisfies Record<string,Swap[]>;
const SCENARIOS:Array<{pressure:PodPressureV06;turns:number;seed:number}>=[
 {pressure:'upgraded',turns:5,seed:20260831},{pressure:'upgraded',turns:7,seed:20260913},
 {pressure:'optimized',turns:5,seed:20260929},{pressure:'optimized',turns:7,seed:20261029},
 {pressure:'cedh',turns:5,seed:20261123},{pressure:'cedh',turns:7,seed:20261231},{pressure:'cedh',turns:9,seed:20270213},
];
const norm=(v:string)=>v.trim().toLocaleLowerCase();
const rec=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:0;
const avg=(v:readonly number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;
interface Deck{parsed:ParsedDeck;cards:ScryfallCard[];text:string;}
function ids(p:ParsedDeck):CardIdentifierInput[]{return [...p.commanders,...p.main].map(e=>({name:e.name,...(e.set?{set:e.set}:{}),...(e.collectorNumber?{collectorNumber:e.collectorNumber}:{})}));}
async function resolve(text:string):Promise<Deck>{const parsed=parseDecklist(text);const r=await getCardsByIdentifiers(ids(parsed));if(r.notFound.length)throw new Error(`unresolved:${r.notFound.join('|')}`);return{parsed,cards:r.cards,text};}
function cardNameFromLine(line:string){return line.replace(/^1\s+/,'').replace(/\s+\([A-Z0-9]+\)\s+\S+\s*$/,'');}
function apply(text:string,swaps:Swap[]){let lines=text.split('\n');for(const s of swaps){const idx=lines.findIndex(l=>l.startsWith('1 ')&&norm(cardNameFromLine(l))===norm(s.cut));if(idx<0)throw new Error(`missing cut ${s.cut}`);lines[idx]=s.line;}return lines.join('\n');}
function faceMv(manaCost:string|undefined):number{if(!manaCost)return 0;let total=0;for(const m of manaCost.matchAll(/\{([^}]+)\}/g)){const sym=(m[1]??'').toUpperCase();if(/^\d+$/.test(sym))total+=Number(sym);else if(sym==='X')total+=0;else total+=1;}return total;}
function cardFor(d:Deck,name:string){return d.cards.find(c=>norm(c.name)===norm(name)||norm(c.name.split(' // ')[0]??'')===norm(name));}
function ystolaOffers(d:Deck){let count=0;for(const e of d.parsed.main){const c=cardFor(d,e.name);if(!c)continue;const faces=c.card_faces??[];if(faces.length){const q=faces.some(f=>{const t=(f.type_line??'').toLowerCase();return !t.includes('creature')&&!t.includes('land')&&faceMv(f.mana_cost)>=3;});if(q)count+=e.quantity;}else{const t=c.type_line.toLowerCase();if(!t.includes('creature')&&!t.includes('land')&&c.cmc>=3)count+=e.quantity;}}return count;}
function comboLocked(d:Deck){const n=new Set(d.parsed.main.map(e=>norm(e.name)));return ['the destined white mage','walking ballista','diabolic intent','ranger-captain of eos'].every(x=>n.has(x));}
function trueStackCount(d:Deck){const names=new Set(d.parsed.main.map(e=>norm(e.name)));const known=['force of negation','hypnotic sprite','sublime epiphany','arcane denial',"dovin's veto",'counterspell','silence',"an offer you can't refuse",'ranger-captain of eos'];return known.filter(n=>names.has(n)).length;}
function trueBoardWipes(d:Deck){const names=new Set(d.parsed.main.map(e=>norm(e.name)));return ['cleansing nova','final judgment','toxic deluge','crux of fate','damn'].filter(n=>names.has(n)).length;}
interface Signal{keep:number;uptime:number;protection:number;spells:number;draws:number;}
function signal(r:Record<string,unknown>):Signal{const b=rec(r.baseline),a=rec(r.advanced);return{keep:num(rec(b.openingHands).functionalKeepRate),uptime:num(rec(a.commanderPressure).battlefieldUptimePercent),protection:num(rec(a.interactionPressure).protectionWinRateWhenChallenged),spells:num(rec(a.cardFlow).averageSpellsCast),draws:num(rec(a.cardFlow).averageCardsDrawnByEffects)};}
function delta(a:Signal,b:Signal):Signal{return{keep:b.keep-a.keep,uptime:b.uptime-a.uptime,protection:b.protection-a.protection,spells:b.spells-a.spells,draws:b.draws-a.draws};}
function mean(v:Signal[]):Signal{return{keep:avg(v.map(x=>x.keep)),uptime:avg(v.map(x=>x.uptime)),protection:avg(v.map(x=>x.protection)),spells:avg(v.map(x=>x.spells)),draws:avg(v.map(x=>x.draws))};}
function sim(d:Deck,s:{pressure:PodPressureV06;turns:number;seed:number}){return simulateDeckGameplayV06(d.parsed,d.cards,{iterations:2600,advancedIterations:2600,turns:s.turns,seed:s.seed,pressure:s.pressure}) as unknown as Record<string,unknown>;}
async function main(){
 const text=await readFile(DECK,'utf8'),policy=await resolvePrintingPolicyV08({printingFamily:'Final Fantasy',includePromos:true,includeSpecialReleases:true});
 const decks:Record<string,Deck>={};for(const[id,swaps]of Object.entries(VARIANTS))decks[id]=await resolve(apply(text,swaps));
 for(const[id,d]of Object.entries(decks)){if(d.parsed.totalCards!==100)throw new Error(`${id}:count`);if(!validateCommanderDeck(d.parsed,d.cards).isLegal)throw new Error(`${id}:illegal`);if(!d.cards.every(c=>printingMatchesPolicyV08(c,policy,AS_OF)))throw new Error(`${id}:ff-policy`);if(!comboLocked(d))throw new Error(`${id}:combo-unlocked`);}
 const base=decks.a5!;const baseSignals=SCENARIOS.map(s=>signal(sim(base,s)));const m0=buildDeckMetrics(base.parsed,base.cards);const y0=ystolaOffers(base);const results=[];
 for(const[id,d]of Object.entries(decks)){const signals=SCENARIOS.map(s=>signal(sim(d,s)));const md=id==='a5'?{keep:0,uptime:0,protection:0,spells:0,draws:0}:mean(signals.map((x,i)=>delta(baseSignals[i]!,x)));const m=buildDeckMetrics(d.parsed,d.cards);results.push({id,swaps:VARIANTS[id as keyof typeof VARIANTS].map(s=>({cut:s.cut,add:cardNameFromLine(s.line)})),meanDeltaVsA5:md,ystolaOffers:ystolaOffers(d),ystolaDelta:ystolaOffers(d)-y0,trueStackCount:trueStackCount(d),trueBoardWipes:trueBoardWipes(d),metrics:{land:m.landCount,ramp:m.rampCount,interaction:m.interactionCount,protection:m.protectionCount,early:m.earlyPlayCount,averageNonlandMV:m.averageNonlandManaValue},signals});}
 const score=(r:any)=>r.meanDeltaVsA5.protection*0.35+r.meanDeltaVsA5.uptime*0.15+r.meanDeltaVsA5.spells*5+r.meanDeltaVsA5.draws*2+r.ystolaDelta*0.6+(r.trueStackCount-trueStackCount(base))*0.8+(r.trueBoardWipes-trueBoardWipes(base))*0.5;
 for(const r of results)(r as any).comparisonScore=score(r);
 results.sort((a:any,b:any)=>b.comparisonScore-a.comparisonScore);
 const report={status:'finalist-comparison',source:'A5 accepted combo-fit checkpoint',base:{metrics:m0,ystolaOffers:y0,trueStackCount:trueStackCount(base),trueBoardWipes:trueBoardWipes(base)},results,boundary:'Higher-sample matched simulation is a regression/pressure comparison, not a literal win-rate model. Brainstorm simulator draw output is treated as card-selection rather than true net card advantage in manual judgment. Adventure spell faces are counted manually for Ystola opportunities.'};
 await writeFile('scions-spellcraft-a10-finalist-pressure.json',JSON.stringify(report,null,2));
 const md=['# Scions & Spellcraft A10 — Finalist Comparison','',`Baseline A5: ${y0} Y'shtola spell opportunities, ${trueStackCount(base)} true stack/protection pieces, ${trueBoardWipes(base)} true wipes.`,'',...results.map((r:any)=>`## ${r.id}\n- Swaps: ${r.swaps.length?r.swaps.map((s:any)=>`${s.cut} -> ${s.add}`).join('; '):'none (A5 baseline)'}\n- Comparison score: ${r.comparisonScore.toFixed(3)}\n- Δ spells: ${r.meanDeltaVsA5.spells.toFixed(3)}\n- Δ effect-draws: ${r.meanDeltaVsA5.draws.toFixed(3)}\n- Δ commander uptime: ${r.meanDeltaVsA5.uptime.toFixed(3)}\n- Δ protection: ${r.meanDeltaVsA5.protection.toFixed(3)}\n- Y'shtola opportunities: ${r.ystolaOffers} (${r.ystolaDelta>=0?'+':''}${r.ystolaDelta})\n- True stack/protection: ${r.trueStackCount}\n- True wipes: ${r.trueBoardWipes}\n- Avg nonland MV: ${r.metrics.averageNonlandMV.toFixed(2)}`),'','Boundary: choose the winner by simulation + manual card-function/identity review; score is only an ordering aid.',''].join('\n');
 await writeFile('scions-spellcraft-a10-finalist-pressure.md',md);console.log(md);
}
await main();
