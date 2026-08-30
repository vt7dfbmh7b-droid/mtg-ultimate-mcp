import { readFile, writeFile } from 'node:fs/promises';
import { parseDecklist } from '../src/services/deck.js';

type Swap={cut:string;add:string};
const STOCK='test-results/exploratory/scions-spellcraft-stock-deck.txt';
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
 raw_pair:[...BASE,{cut:'1 Ardbert, Warrior of Darkness (FIC) 77',add:WM},{cut:'1 Estinien Varlineau (FIC) 82',add:BALLISTA}],
 pair_plus_ranger:[...BASE,{cut:'1 Ardbert, Warrior of Darkness (FIC) 77',add:WM},{cut:'1 Estinien Varlineau (FIC) 82',add:BALLISTA},{cut:'1 Tataru Taru (FIC) 30',add:RANGER}],
 pair_plus_intent:[...BASE,{cut:'1 Ardbert, Warrior of Darkness (FIC) 77',add:WM},{cut:'1 Estinien Varlineau (FIC) 82',add:BALLISTA},{cut:'1 Cut a Deal (FIC) 238',add:INTENT}],
 full_support:[...BASE,{cut:'1 Ardbert, Warrior of Darkness (FIC) 77',add:WM},{cut:'1 Estinien Varlineau (FIC) 82',add:BALLISTA},{cut:'1 Tataru Taru (FIC) 30',add:RANGER},{cut:'1 Cut a Deal (FIC) 238',add:INTENT}],
};
const norm=(v:string)=>v.trim().toLowerCase();
function apply(text:string,swaps:readonly Swap[]):string{let out=text;for(const s of swaps){if(!out.includes(s.cut))throw new Error(`missing cut ${s.cut}`);out=out.replace(s.cut,s.add);}return out;}
function library(text:string):string[]{const p=parseDecklist(text);const out:string[]=[];for(const e of p.main)for(let i=0;i<e.quantity;i++)out.push(norm(e.name));if(out.length!==99)throw new Error(`expected 99 library cards, got ${out.length}`);return out;}
function access(lib:readonly string[],visible:number,seed:number,iterations=200000){let hits=0;let x=seed>>>0;const rand=()=>((x=(Math.imul(1664525,x)+1013904223)>>>0)/4294967296);for(let i=0;i<iterations;i++){const arr=lib.slice();for(let j=arr.length-1;j>arr.length-1-visible;j--){const k=Math.floor(rand()*(j+1));[arr[j],arr[k]]=[arr[k]!,arr[j]!];}const seen=new Set(arr.slice(arr.length-visible));const w=seen.has(norm('The Destined White Mage'));const ballista=seen.has(norm('Walking Ballista'));const ranger=seen.has(norm('Ranger-Captain of Eos'));const intent=seen.has(norm('Diabolic Intent'));const ballistaAccess=ballista||ranger;const assembled=(w&&ballistaAccess)||(intent&&(w||ballistaAccess));if(assembled)hits++;}return hits/iterations;}
async function main(){const stock=await readFile(STOCK,'utf8');const results=[];for(const[id,swaps]of Object.entries(V)){const text=apply(stock,swaps);const lib=library(text);const raw={turn5:access(lib,12,20260831),turn7:access(lib,14,20260907),turn9:access(lib,16,20260919)};const plusTwoCards={turn5:access(lib,14,20261001),turn7:access(lib,16,20261003),turn9:access(lib,18,20261005)};results.push({id,libraryCards:lib.length,comboSupport:{whiteMage:true,ballista:true,ranger:lib.includes(norm('Ranger-Captain of Eos')),intent:lib.includes(norm('Diabolic Intent'))},rawVisibility:raw,heuristicPlusTwoExtraCardsSeen:plusTwoCards});}
 const report={iterationsPerPoint:200000,visibilityDefinition:'Raw visibility uses opening 7 plus one card per turn: T5=12, T7=14, T9=16. No mulligan, tutors are counted only when actually seen. Ranger-Captain counts as Walking Ballista access. Diabolic Intent counts as one missing combo half when seen alongside White Mage, Ballista, or Ranger-Captain.',heuristicDefinition:'Plus-two column is not a turn-exact win rate; it approximates seeing two additional cards from the deck’s draw engines.',results};await writeFile('scions-spellcraft-a4b-combo-access.json',JSON.stringify(report,null,2));const pc=(x:number)=>(x*100).toFixed(2)+'%';const md=['# Scions & Spellcraft A4b — Corrected White Mage / Ballista Access','',`- Monte Carlo iterations per point: ${report.iterationsPerPoint.toLocaleString()}`,'- Library model: full 99 cards including repeated basic lands.','- Raw visibility: T5=12, T7=14, T9=16 cards seen.','- Plus-two is a heuristic for two additional cards seen from draw effects, not a goldfish win rate.','',...results.map(r=>`## ${r.id}\n- Support: Ranger ${r.comboSupport.ranger?'yes':'no'}, Intent ${r.comboSupport.intent?'yes':'no'}\n- Raw T5 / T7 / T9: ${pc(r.rawVisibility.turn5)} / ${pc(r.rawVisibility.turn7)} / ${pc(r.rawVisibility.turn9)}\n- +2 cards T5 / T7 / T9: ${pc(r.heuristicPlusTwoExtraCardsSeen.turn5)} / ${pc(r.heuristicPlusTwoExtraCardsSeen.turn7)} / ${pc(r.heuristicPlusTwoExtraCardsSeen.turn9)}`),'','These are assembly-access proxies only. They do not model mana, summoning sickness, protection, sacrifice fodder for Intent, or opponent interaction.',''].join('\n');await writeFile('scions-spellcraft-a4b-combo-access.md',md);console.log(md);}
await main();
