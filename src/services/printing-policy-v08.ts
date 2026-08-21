import type { ScryfallCard } from '../types/scryfall.js';
import {
  MARVEL_SPECIAL_COVERAGE_V08,
  MARVEL_SPECIALS_V08,
  MIDDLE_EARTH_SPECIAL_COVERAGE_V08,
  MIDDLE_EARTH_SPECIALS_V08,
  type ThemedSpecialCoverageV08,
  type ThemedSpecialPrintingV08,
} from './printing-family-specials-v08.js';
import { getCardPrintings, getScryfallSets } from './scryfall.js';

export interface PrintingPolicyInputV08 {
  allowedSets?: string[];
  printingFamily?: string;
  includePromos?: boolean;
  includeSpecialReleases?: boolean;
}

type ExactPrintingSelectorV08 = ThemedSpecialPrintingV08;

interface PrintingFamilyPresetV08 {
  id: string;
  aliases: string[];
  setNamePatterns: string[];
  exactSpecialPrintings: ExactPrintingSelectorV08[];
  specialReleaseCoverage?: ThemedSpecialCoverageV08;
}

export interface ResolvedPrintingPolicyV08 {
  family: string | null;
  familyPreset: string | null;
  allowedSetCodes: string[];
  familyMatchedSetCodes: string[];
  includePromos: boolean;
  includeSpecialReleases: boolean;
  exactSpecialPrintings: ExactPrintingSelectorV08[];
  specialOracleNames: string[];
  specialReleaseCoverageAsOf: string | null;
  specialReleaseCoverageNote: string | null;
  searchClause: string;
  explanation: string;
}

export interface PrintingFamilyPresetInspectionV08 {
  id: string;
  setNamePatterns: string[];
  specialPrintingCount: number;
  specialPrintingSelectors: Array<{
    set: string;
    collectorNumber: string;
    oracleName: string;
  }>;
  specialReleaseCoverageAsOf: string | null;
  specialReleaseCoverageNote: string | null;
}

export interface EligiblePrintingChoiceV08 {
  card: ScryfallCard;
  finish: 'nonfoil' | 'foil' | 'etched' | null;
  priceUsd: number | null;
  matchedBy: 'family-set' | 'explicit-set' | 'special-printing' | 'unrestricted';
}

const FINAL_FANTASY_SPECIALS: ExactPrintingSelectorV08[] = [
  { set: 'sld', collectorNumber: '1858', oracleName: 'Day of Judgment', label: 'Secret Lair x FINAL FANTASY: Game Over' },
  { set: 'sld', collectorNumber: '1859', oracleName: 'Temporal Extortion', label: 'Secret Lair x FINAL FANTASY: Game Over' },
  { set: 'sld', collectorNumber: '1860', oracleName: 'Toxic Deluge', label: 'Secret Lair x FINAL FANTASY: Game Over' },
  { set: 'sld', collectorNumber: '1861', oracleName: "Praetor's Grasp", label: 'Secret Lair x FINAL FANTASY: Game Over' },
  { set: 'sld', collectorNumber: '1862', oracleName: 'Star of Extinction', label: 'Secret Lair x FINAL FANTASY: Game Over' },
  { set: 'sld', collectorNumber: '1863', oracleName: 'Staff of the Storyteller', label: 'Secret Lair x FINAL FANTASY: Weapons' },
  { set: 'sld', collectorNumber: '1864', oracleName: 'Blade of Selves', label: 'Secret Lair x FINAL FANTASY: Weapons' },
  { set: 'sld', collectorNumber: '1865', oracleName: "Umezawa's Jitte", label: 'Secret Lair x FINAL FANTASY: Weapons' },
  { set: 'sld', collectorNumber: '1866', oracleName: 'Colossus Hammer', label: 'Secret Lair x FINAL FANTASY: Weapons' },
  { set: 'sld', collectorNumber: '1867', oracleName: 'Sword of Truth and Justice', label: 'Secret Lair x FINAL FANTASY: Weapons' },
  { set: 'sld', collectorNumber: '1868', oracleName: 'Prismatic Ending', label: 'Secret Lair x FINAL FANTASY: Grimoire' },
  { set: 'sld', collectorNumber: '1869', oracleName: 'Cyclonic Rift', label: 'Secret Lair x FINAL FANTASY: Grimoire' },
  { set: 'sld', collectorNumber: '1870', oracleName: 'Damn', label: 'Secret Lair x FINAL FANTASY: Grimoire' },
  { set: 'sld', collectorNumber: '1871', oracleName: 'Lightning Bolt', label: 'Secret Lair x FINAL FANTASY: Grimoire' },
  { set: 'sld', collectorNumber: '1872', oracleName: 'Heroic Intervention', label: 'Secret Lair x FINAL FANTASY: Grimoire' },
  { set: 'sld', collectorNumber: '0909', oracleName: 'Gilded Lotus', label: 'FINAL FANTASY bundle promo' },
  { set: 'sld', collectorNumber: '909', oracleName: 'Gilded Lotus', label: 'FINAL FANTASY bundle promo' },
  { set: 'sld', collectorNumber: '7001', oracleName: 'Feed the Swarm', label: 'FINAL FANTASY Secret Lair bonus card' },
  { set: 'sld', collectorNumber: '7002', oracleName: 'Forge Anew', label: 'FINAL FANTASY Secret Lair bonus card' },
  { set: 'sld', collectorNumber: '7003', oracleName: 'Silence', label: 'FINAL FANTASY Secret Lair bonus card' },
  { set: 'sld', collectorNumber: '7004', oracleName: 'Solitude', label: 'FINAL FANTASY Secret Lair chase bonus' },
  { set: 'sld', collectorNumber: '7005', oracleName: 'Subtlety', label: 'FINAL FANTASY Secret Lair chase bonus' },
  { set: 'sld', collectorNumber: '7006', oracleName: 'Grief', label: 'FINAL FANTASY Secret Lair chase bonus' },
  { set: 'sld', collectorNumber: '7007', oracleName: 'Fury', label: 'FINAL FANTASY Secret Lair chase bonus' },
  { set: 'sld', collectorNumber: '7008', oracleName: 'Endurance', label: 'FINAL FANTASY Secret Lair chase bonus' },
];

const PRESETS: PrintingFamilyPresetV08[] = [
  {
    id: 'final-fantasy',
    aliases: ['final fantasy', 'final-fantasy', 'ff', 'mtg final fantasy', 'magic final fantasy'],
    setNamePatterns: ['final fantasy'],
    exactSpecialPrintings: FINAL_FANTASY_SPECIALS,
  },
  {
    id: 'marvel',
    aliases: ['marvel', 'mtg marvel', 'magic marvel', 'marvel universe'],
    setNamePatterns: ['marvel'],
    exactSpecialPrintings: MARVEL_SPECIALS_V08,
    specialReleaseCoverage: MARVEL_SPECIAL_COVERAGE_V08,
  },
  {
    id: 'middle-earth',
    aliases: ['middle-earth', 'middle earth', 'the lord of the rings', 'lord of the rings', 'lotr', 'tolkien'],
    setNamePatterns: ['middle-earth', 'the hobbit'],
    exactSpecialPrintings: MIDDLE_EARTH_SPECIALS_V08,
    specialReleaseCoverage: MIDDLE_EARTH_SPECIAL_COVERAGE_V08,
  },
];

const NON_PLAYABLE_FAMILY_SET_TYPES = new Set(['token', 'memorabilia', 'minigame']);

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[™®]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeSetCodes(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim().toLocaleLowerCase()).filter(Boolean))];
}

function findPreset(family: string | undefined): PrintingFamilyPresetV08 | null {
  if (!family?.trim()) return null;
  const needle = normalize(family);
  return PRESETS.find((preset) => normalize(preset.id) === needle || preset.aliases.some((alias) => normalize(alias) === needle)) ?? null;
}

export function inspectPrintingFamilyPresetV08(family: string | undefined): PrintingFamilyPresetInspectionV08 | null {
  const preset = findPreset(family);
  if (!preset) return null;
  return {
    id: preset.id,
    setNamePatterns: [...preset.setNamePatterns],
    specialPrintingCount: preset.exactSpecialPrintings.length,
    specialPrintingSelectors: preset.exactSpecialPrintings.map(({ set, collectorNumber, oracleName }) => ({
      set,
      collectorNumber,
      oracleName,
    })),
    specialReleaseCoverageAsOf: preset.specialReleaseCoverage?.asOf ?? null,
    specialReleaseCoverageNote: preset.specialReleaseCoverage?.note ?? null,
  };
}

export function familySetTypeEligibleV08(setType: string, digital = false): boolean {
  return !digital && !NON_PLAYABLE_FAMILY_SET_TYPES.has(setType.toLocaleLowerCase());
}

function currentEvaluationDateV08(): string {
  return new Date().toISOString().slice(0, 10);
}

function canonicalCalendarDateV08(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === trimmed ? trimmed : null;
}

/** Hard current-physical-printing truth. Missing/invalid release dates fail closed. */
export function printingReleasedByV08(
  card: Pick<ScryfallCard, 'released_at'>,
  evaluationDate = currentEvaluationDateV08(),
): boolean {
  const releasedAt = canonicalCalendarDateV08(card.released_at);
  const asOf = canonicalCalendarDateV08(evaluationDate);
  return releasedAt !== null && asOf !== null && releasedAt <= asOf;
}

function exactPrintingKey(set: string, collectorNumber: string): string {
  return `${set.toLocaleLowerCase()}|${collectorNumber.replace(/^0+/, '') || '0'}`;
}

function escapeScryfallName(name: string): string {
  return name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildSearchClause(setCodes: string[], specialNames: string[]): string {
  const parts = [
    ...setCodes.map((set) => `set:${set}`),
    ...specialNames.map((name) => `!"${escapeScryfallName(name)}"`),
  ];
  return parts.length > 0 ? `(${parts.join(' OR ')})` : '';
}

export async function resolvePrintingPolicyV08(input: PrintingPolicyInputV08 = {}): Promise<ResolvedPrintingPolicyV08> {
  const explicitSets = normalizeSetCodes(input.allowedSets);
  const preset = findPreset(input.printingFamily);
  const rawFamily = input.printingFamily?.trim() || null;
  const familyPatterns = preset?.setNamePatterns ?? (rawFamily ? [normalize(rawFamily)] : []);
  const includePromos = input.includePromos ?? true;
  const includeSpecialReleases = input.includeSpecialReleases ?? true;

  let familyMatchedSetCodes: string[] = [];
  if (familyPatterns.length > 0) {
    try {
      const sets = await getScryfallSets();
      familyMatchedSetCodes = sets
        .filter((set) => familySetTypeEligibleV08(set.set_type, Boolean(set.digital)))
        .filter((set) => {
          const name = normalize(set.name);
          return familyPatterns.some((pattern) => name.includes(normalize(pattern)));
        })
        .map((set) => set.code.toLocaleLowerCase());
    } catch {
      familyMatchedSetCodes = [];
    }
  }

  const allowedSetCodes = [...new Set([...explicitSets, ...familyMatchedSetCodes])];
  const exactSpecialPrintings = includeSpecialReleases ? preset?.exactSpecialPrintings ?? [] : [];
  const specialOracleNames = [...new Set(exactSpecialPrintings.map((entry) => entry.oracleName))];
  const searchClause = buildSearchClause(allowedSetCodes, specialOracleNames);
  const specialReleaseCoverageAsOf = preset?.specialReleaseCoverage?.asOf ?? null;
  const specialReleaseCoverageNote = preset?.specialReleaseCoverage?.note ?? null;
  const coverageSuffix = specialReleaseCoverageAsOf
    ? ` Curated special-release coverage is verified through ${specialReleaseCoverageAsOf}.${specialReleaseCoverageNote ? ` ${specialReleaseCoverageNote}` : ''}`
    : '';

  return {
    family: rawFamily,
    familyPreset: preset?.id ?? null,
    allowedSetCodes,
    familyMatchedSetCodes,
    includePromos,
    includeSpecialReleases,
    exactSpecialPrintings,
    specialOracleNames,
    specialReleaseCoverageAsOf,
    specialReleaseCoverageNote,
    searchClause,
    explanation: rawFamily
      ? `Only physical printings belonging to the ${rawFamily} printing family are eligible. Matching playable family sets${includePromos ? ', promos' : ''}${includeSpecialReleases ? ', and curated special releases' : ''} qualify; an unrelated printing of the same Oracle card does not.${coverageSuffix}`
      : explicitSets.length > 0
        ? `Only physical printings from the allowed set codes are eligible${includePromos ? ', including promos inside those sets' : ', excluding promo-marked printings'}.`
        : 'No themed printing-family restriction is active.',
  };
}

export function printingMatchesPolicyV08(
  card: ScryfallCard,
  policy: ResolvedPrintingPolicyV08,
  evaluationDate = currentEvaluationDateV08(),
): boolean {
  if (card.digital) return false;
  if (!printingReleasedByV08(card, evaluationDate)) return false;
  if (!policy.includePromos && card.promo) return false;

  const hasRestriction = Boolean(policy.family) || policy.allowedSetCodes.length > 0 || policy.exactSpecialPrintings.length > 0;
  if (!hasRestriction) return true;

  const set = card.set.toLocaleLowerCase();
  if (policy.allowedSetCodes.includes(set)) return true;
  if (!policy.includeSpecialReleases) return false;

  const key = exactPrintingKey(set, card.collector_number);
  return policy.exactSpecialPrintings.some((entry) => exactPrintingKey(entry.set, entry.collectorNumber) === key);
}

export function printingMatchReasonV08(
  card: ScryfallCard,
  policy: ResolvedPrintingPolicyV08,
  evaluationDate = currentEvaluationDateV08(),
): EligiblePrintingChoiceV08['matchedBy'] | null {
  if (!printingMatchesPolicyV08(card, policy, evaluationDate)) return null;
  if (!policy.family && policy.allowedSetCodes.length === 0 && policy.exactSpecialPrintings.length === 0) return 'unrestricted';
  const set = card.set.toLocaleLowerCase();
  const key = exactPrintingKey(set, card.collector_number);
  if (policy.exactSpecialPrintings.some((entry) => exactPrintingKey(entry.set, entry.collectorNumber) === key)) return 'special-printing';
  if (policy.familyMatchedSetCodes.includes(set)) return 'family-set';
  return 'explicit-set';
}

function numericPrice(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function choicesForPrinting(card: ScryfallCard): EligiblePrintingChoiceV08[] {
  const reason: EligiblePrintingChoiceV08['matchedBy'] = 'unrestricted';
  const values: Array<{ finish: 'nonfoil' | 'foil' | 'etched'; price: number | null }> = [
    { finish: 'nonfoil', price: numericPrice(card.prices?.usd) },
    { finish: 'foil', price: numericPrice(card.prices?.usd_foil) },
    { finish: 'etched', price: numericPrice(card.prices?.usd_etched) },
  ];
  const priced = values.filter((entry): entry is { finish: 'nonfoil' | 'foil' | 'etched'; price: number } => entry.price !== null);
  if (priced.length === 0) return [{ card, finish: null, priceUsd: null, matchedBy: reason }];
  return priced.map((entry) => ({ card, finish: entry.finish, priceUsd: entry.price, matchedBy: reason }));
}

export async function selectEligiblePrintingV08(
  card: ScryfallCard,
  policy: ResolvedPrintingPolicyV08,
  maxUsdPerCard?: number,
): Promise<EligiblePrintingChoiceV08 | null> {
  let printings: ScryfallCard[];
  try {
    printings = await getCardPrintings(card.name, 250);
  } catch {
    printings = [card];
  }

  const evaluationDate = currentEvaluationDateV08();
  const choices = printings
    .filter((printing) => printingMatchesPolicyV08(printing, policy, evaluationDate))
    .flatMap((printing) => choicesForPrinting(printing).map((choice) => ({
      ...choice,
      matchedBy: printingMatchReasonV08(printing, policy, evaluationDate) ?? 'unrestricted',
    })))
    .filter((choice) => maxUsdPerCard === undefined || (choice.priceUsd !== null && choice.priceUsd <= maxUsdPerCard))
    .sort((a, b) => {
      if (a.priceUsd === null && b.priceUsd !== null) return 1;
      if (a.priceUsd !== null && b.priceUsd === null) return -1;
      if (a.priceUsd !== null && b.priceUsd !== null && a.priceUsd !== b.priceUsd) return a.priceUsd - b.priceUsd;
      return (b.card.released_at ?? '').localeCompare(a.card.released_at ?? '');
    });

  return choices[0] ?? null;
}

export function describePrintingPolicyV08(policy: ResolvedPrintingPolicyV08): Record<string, unknown> {
  return {
    family: policy.family,
    familyPreset: policy.familyPreset,
    allowedSetCodes: policy.allowedSetCodes.map((set) => set.toUpperCase()),
    includePromos: policy.includePromos,
    includeSpecialReleases: policy.includeSpecialReleases,
    specialPrintingCount: policy.exactSpecialPrintings.length,
    specialOracleNames: policy.specialOracleNames,
    specialReleaseCoverageAsOf: policy.specialReleaseCoverageAsOf,
    specialReleaseCoverageNote: policy.specialReleaseCoverageNote,
    explanation: policy.explanation,
  };
}
