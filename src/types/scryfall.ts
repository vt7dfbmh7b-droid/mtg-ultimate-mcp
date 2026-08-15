export type ScryfallLegalities = Record<string, 'legal' | 'not_legal' | 'restricted' | 'banned'>;

export interface ScryfallCardFace {
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  colors?: string[];
  image_uris?: Record<string, string>;
}

export interface ScryfallCard {
  id: string;
  oracle_id?: string;
  name: string;
  lang: string;
  released_at?: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  color_identity: string[];
  keywords: string[];
  legalities: ScryfallLegalities;
  games?: string[];
  reserved?: boolean;
  foil?: boolean;
  nonfoil?: boolean;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  flavor_text?: string;
  artist?: string;
  prices?: Record<string, string | null>;
  related_uris?: Record<string, string>;
  scryfall_uri: string;
  image_uris?: Record<string, string>;
  card_faces?: ScryfallCardFace[];
}

export interface ScryfallList<T> {
  object: 'list';
  total_cards?: number;
  has_more: boolean;
  next_page?: string;
  data: T[];
}

export interface ScryfallCollectionResult {
  object: 'list';
  not_found: Array<Record<string, string>>;
  data: ScryfallCard[];
}
