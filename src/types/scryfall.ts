export type ScryfallLegalities = Record<string, 'legal' | 'not_legal' | 'restricted' | 'banned'>;

export interface ScryfallCardFace {
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  colors?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  image_uris?: Record<string, string>;
}

export interface ScryfallCard {
  id: string;
  oracle_id?: string;
  name: string;
  printed_name?: string;
  flavor_name?: string;
  lang: string;
  released_at?: string;
  layout?: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  color_identity: string[];
  keywords: string[];
  legalities: ScryfallLegalities;
  games?: string[];
  game_changer?: boolean;
  reserved?: boolean;
  foil?: boolean;
  nonfoil?: boolean;
  finishes?: string[];
  promo?: boolean;
  promo_types?: string[];
  digital?: boolean;
  full_art?: boolean;
  border_color?: string;
  frame?: string;
  frame_effects?: string[];
  produced_mana?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  defense?: string;
  edhrec_rank?: number;
  penny_rank?: number;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  tcgplayer_id?: number;
  cardmarket_id?: number;
  flavor_text?: string;
  artist?: string;
  prices?: Record<string, string | null>;
  purchase_uris?: Record<string, string>;
  related_uris?: Record<string, string>;
  scryfall_uri: string;
  image_uris?: Record<string, string>;
  card_faces?: ScryfallCardFace[];
}

export interface ScryfallSet {
  id: string;
  code: string;
  name: string;
  set_type: string;
  released_at?: string;
  block_code?: string;
  block?: string;
  parent_set_code?: string;
  card_count?: number;
  digital?: boolean;
  foil_only?: boolean;
  nonfoil_only?: boolean;
  scryfall_uri?: string;
  search_uri?: string;
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
