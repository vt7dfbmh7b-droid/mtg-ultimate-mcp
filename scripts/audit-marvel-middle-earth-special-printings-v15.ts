import { writeFile } from 'node:fs/promises';
import { getCardPrintings, getScryfallSets } from '../src/services/scryfall.js';

const DAY = 86_400_000;
function near(date: string | undefined, target: string, days = 10): boolean {
  if (!date) return false;
  return Math.abs(new Date(date).getTime() - new Date(target).getTime()) <= days * DAY;
}

const marvelDrops = [
  { date: '2024-11-04', names: [
    'Black Panther, Wakandan King','Secure the Wastes','Primal Vigor','Heroic Intervention',"Karn's Bastion",
    'Captain America, First Avenger',"Sigarda's Aid",'Flawless Maneuver','In the Trenches','Sword of War and Peace',
    'Iron Man, Titan of Innovation','Galvanic Blast',"Commander's Plate",'Sol Ring',"Inventors' Fair",
    'Storm, Force of Nature','Lightning Bolt',"Jeska's Will",'Ice Storm','Manamorphose',
    'Wolverine, Best There Is','Berserk','Rite of Passage','Rhythm of the Wild','The Ozolith','Arcane Signet',
  ]},
  { date: '2025-09-22', names: [
    'Fact or Fiction','Frantic Search','Scheming Symmetry','Blasphemous Act','Impact Tremors','Ephemerate','Three Visits','Lightning Greaves','Sol Ring','Command Tower',
    'Plains','Island','Swamp','Mountain','Forest','Damnation','Dark Ritual','Peer into the Abyss','Surgical Extraction','Tendrils of Agony','Deadly Dispute','Go for the Throat',
  ]},
  { date: '2026-07-17', names: ['Hammerhead, Maggia Boss','Undead Hand Ninja','Hex Magic','Tippy-Toe, Terrific Partner','Baxter Building'] },
];

const middleEarthDrops = [
  { date: '2026-08-17', names: [
    'Cloudshift',"Tocasia's Welcome",'Stony Silence',"Imp's Mischief",'Seize the Spoils',
    'Fellwar Stone','Lightning Greaves','Liquimetal Torque','Sol Ring','Thought Vessel',
    'Defile','Diabolic Intent','Dread Return','Mirkwood Bats','Read the Bones',
    'Arcane Heist','Contentious Plan','Curiosity','Solve the Equation','Windfall',
  ]},
];

async function resolveSpecials(drops: Array<{date:string; names:string[]}>) {
  const out: Array<Record<string, unknown>> = [];
  for (const drop of drops) {
    for (const name of drop.names) {
      const printings = await getCardPrintings(name, 250);
      const matches = printings.filter((card) => card.set.toLowerCase() === 'sld' && near(card.released_at, drop.date));
      for (const card of matches) {
        out.push({ name: card.name, set: card.set.toUpperCase(), collectorNumber: card.collector_number, releasedAt: card.released_at ?? null, flavorName: card.flavor_name ?? null, promo: Boolean(card.promo), promoTypes: card.promo_types ?? [] });
      }
    }
  }
  return [...new Map(out.map((x) => [`${x.set}|${x.collectorNumber}`, x])).values()];
}

async function main() {
  const sets = await getScryfallSets(true);
  const marvelSetCodes = sets.filter((s) => !s.digital && /marvel|spider-man/i.test(s.name)).map((s) => ({ code:s.code.toUpperCase(), name:s.name, type:s.set_type, releasedAt:s.released_at ?? null }));
  const middleEarthSetCodes = sets.filter((s) => !s.digital && /middle-earth|the hobbit/i.test(s.name)).map((s) => ({ code:s.code.toUpperCase(), name:s.name, type:s.set_type, releasedAt:s.released_at ?? null }));
  const marvelSpecials = await resolveSpecials(marvelDrops);
  const middleEarthSpecials = await resolveSpecials(middleEarthDrops);
  const result = { schema:'themed-special-printing-audit-v15.1', marvel:{ setCodes:marvelSetCodes, specials:marvelSpecials }, middleEarth:{ setCodes:middleEarthSetCodes, specials:middleEarthSpecials } };
  await writeFile('themed-special-printing-audit.json', JSON.stringify(result,null,2)+'\n','utf8');
  console.log(JSON.stringify({ marvelSets:marvelSetCodes.length, marvelSpecials:marvelSpecials.length, middleEarthSets:middleEarthSetCodes.length, middleEarthSpecials:middleEarthSpecials.length },null,2));
}
main().catch(async (e)=>{ const m=e instanceof Error?`${e.name}: ${e.message}\n${e.stack??''}`:String(e); await writeFile('themed-special-printing-audit-failure.txt',m+'\n').catch(()=>{}); console.error(m); process.exitCode=1; });
// retrigger: exact official themed SLD audit
