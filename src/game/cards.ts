/**
 * Carte conquista.
 *
 * Il mazzo contiene una carta per territorio (simbolo assegnato in modo
 * stabile) più due sigilli jolly. Tre carte formano una combinazione se
 * mostrano tre simboli uguali oppure tre simboli diversi; i sigilli valgono
 * come qualunque simbolo.
 */
import type { Card, CardSymbol } from './types';
import { TERRITORIES } from './world';

export const SYMBOLS: CardSymbol[] = ['vessillo', 'ariete', 'falco'];

export const SYMBOL_LABEL: Record<CardSymbol, string> = {
  vessillo: 'Vessillo',
  ariete: 'Ariete',
  falco: 'Falco',
  sigillo: 'Sigillo',
};

/** valore in armate della n-esima combinazione giocata nella partita */
const LADDER = [4, 6, 8, 10, 12, 15];

export function tradeValue(tradesDone: number): number {
  return tradesDone < LADDER.length ? LADDER[tradesDone] : 15 + (tradesDone - LADDER.length + 1) * 5;
}

export function buildDeck(): Card[] {
  const cards: Card[] = TERRITORIES.map((t, i) => ({
    id: `carta-${t.id}`,
    symbol: SYMBOLS[i % SYMBOLS.length],
    territory: t.id,
  }));
  cards.push({ id: 'carta-sigillo-1', symbol: 'sigillo', territory: null });
  cards.push({ id: 'carta-sigillo-2', symbol: 'sigillo', territory: null });
  return cards;
}

export function isValidSet(cards: Card[]): boolean {
  if (cards.length !== 3) return false;
  const wilds = cards.filter((c) => c.symbol === 'sigillo').length;
  const rest = cards.filter((c) => c.symbol !== 'sigillo').map((c) => c.symbol);
  const unique = new Set(rest).size;
  if (wilds >= 2) return true;
  if (wilds === 1) return unique === 2 || unique === 1;
  return unique === 1 || unique === 3;
}

/** tutte le combinazioni giocabili con le carte in mano */
export function findSets(hand: Card[]): Card[][] {
  const sets: Card[][] = [];
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      for (let k = j + 1; k < hand.length; k++) {
        const trio = [hand[i], hand[j], hand[k]];
        if (isValidSet(trio)) sets.push(trio);
      }
    }
  }
  return sets;
}

export const HAND_LIMIT = 5;

/** indice statico: il mazzo dipende solo dalla mappa, non dalla partita */
const CARD_INDEX = new Map(buildDeck().map((c) => [c.id, c]));

export function card(id: string): Card {
  const c = CARD_INDEX.get(id);
  if (!c) throw new Error(`Carta sconosciuta: ${id}`);
  return c;
}
