import type { ScryfallCard } from '../types/scryfall.js';
import { getCardOracleText } from './scryfall.js';

type TokenV15 =
  | { type: 'lparen' | 'rparen' | 'or' }
  | { type: 'atom'; field: 'o' | 't'; value: string; quoted: boolean };

function tokenizeControlledThemeClauseV15(clause: string): TokenV15[] | null {
  const tokens: TokenV15[] = [];
  let index = 0;
  while (index < clause.length) {
    const character = clause[index]!;
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (character === '(') {
      tokens.push({ type: 'lparen' });
      index += 1;
      continue;
    }
    if (character === ')') {
      tokens.push({ type: 'rparen' });
      index += 1;
      continue;
    }
    if (clause.slice(index, index + 2).toLocaleUpperCase() === 'OR'
      && (index + 2 === clause.length || /[\s)]/.test(clause[index + 2]!))) {
      tokens.push({ type: 'or' });
      index += 2;
      continue;
    }

    const field = clause[index];
    if ((field !== 'o' && field !== 't') || clause[index + 1] !== ':') return null;
    index += 2;
    let value = '';
    let quoted = false;
    if (clause[index] === '"') {
      quoted = true;
      index += 1;
      let closed = false;
      while (index < clause.length) {
        const next = clause[index]!;
        if (next === '\\' && index + 1 < clause.length) {
          value += clause[index + 1]!;
          index += 2;
          continue;
        }
        if (next === '"') {
          closed = true;
          index += 1;
          break;
        }
        value += next;
        index += 1;
      }
      if (!closed) return null;
    } else {
      const start = index;
      while (index < clause.length && !/[\s()]/.test(clause[index]!)) index += 1;
      value = clause.slice(start, index);
    }
    if (!value.trim()) return null;
    tokens.push({ type: 'atom', field, value: value.toLocaleLowerCase(), quoted });
  }
  return tokens;
}

function typeContainsWordV15(typeLine: string, needle: string): boolean {
  return typeLine.toLocaleLowerCase().split(/[^a-z0-9]+/).filter(Boolean).includes(needle.toLocaleLowerCase());
}

function cardMatchesAtomV15(card: ScryfallCard, atom: Extract<TokenV15, { type: 'atom' }>): boolean {
  if (atom.field === 'o') return getCardOracleText(card).toLocaleLowerCase().includes(atom.value);
  if (typeContainsWordV15(card.type_line, atom.value)) return true;

  // The controlled resolver emits verified creature types as quoted t:"Type" atoms, while
  // card/permanent types and mechanical subtypes use unquoted t:artifact/t:enchantment/t:aura/
  // t:equipment atoms. Changeling grants every creature type, not every Magic card type or
  // noncreature subtype, so only the resolver's verified quoted typal atoms may use this fallback.
  if (!atom.quoted) return false;
  const keywords = new Set((card.keywords ?? []).map((value) => value.toLocaleLowerCase()));
  return keywords.has('changeling') || /this card is every creature type/i.test(getCardOracleText(card));
}

class ControlledThemeParserV15 {
  private position = 0;

  constructor(private readonly tokens: TokenV15[], private readonly card: ScryfallCard) {}

  evaluate(): boolean | null {
    if (this.tokens.length === 0) return null;
    const value = this.parseOr();
    return value !== null && this.position === this.tokens.length ? value : null;
  }

  private parseOr(): boolean | null {
    let value = this.parseAnd();
    if (value === null) return null;
    while (this.tokens[this.position]?.type === 'or') {
      this.position += 1;
      const right = this.parseAnd();
      if (right === null) return null;
      value = value || right;
    }
    return value;
  }

  private parseAnd(): boolean | null {
    let value = this.parsePrimary();
    if (value === null) return null;
    while (this.position < this.tokens.length) {
      const next = this.tokens[this.position];
      if (!next || next.type === 'or' || next.type === 'rparen') break;
      const right = this.parsePrimary();
      if (right === null) return null;
      value = value && right;
    }
    return value;
  }

  private parsePrimary(): boolean | null {
    const token = this.tokens[this.position];
    if (!token) return null;
    if (token.type === 'atom') {
      this.position += 1;
      return cardMatchesAtomV15(this.card, token);
    }
    if (token.type !== 'lparen') return null;
    this.position += 1;
    const value = this.parseOr();
    if (value === null || this.tokens[this.position]?.type !== 'rparen') return null;
    this.position += 1;
    return value;
  }
}

/**
 * Evaluate only the tiny fail-closed Scryfall-clause subset emitted by the controlled V0.15
 * theme resolver: Oracle-text atoms, type atoms, parentheses, implicit AND, and OR. This is
 * semantic classification of an already-resolved card; it is deliberately independent of
 * bounded candidate-search membership and rejects every other Scryfall operator/grammar form.
 */
export function cardMatchesControlledThemeClauseV15(card: ScryfallCard, clause: string): boolean {
  const tokens = tokenizeControlledThemeClauseV15(clause.trim());
  if (!tokens) return false;
  return new ControlledThemeParserV15(tokens, card).evaluate() === true;
}
