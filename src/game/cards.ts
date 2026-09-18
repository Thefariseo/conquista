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

/**
 * Valore in armate di una combinazione. E' una tabella fissa, non una scala
 * che cresce con la partita: conta solo che cosa hai in mano.
 *
 *   tre vessilli ............  4      uno di ogni simbolo ....  10
 *   tre arieti ..............  6      sigillo + due uguali ...  12
 *   tre falchi ..............  8
 */
export const SYMBOL_VALUE: Record<Exclude<CardSymbol, 'sigillo'>, number> = {
  vessillo: 4,
  ariete: 6,
  falco: 8,
};

export const MIXED_VALUE = 10;
export const WILD_VALUE = 12;

/** valore della combinazione, nella lettura piu' favorevole al giocatore */
export function setValue(cards: Card[]): number {
  if (!isValidSet(cards)) return 0;
  const wilds = cards.filter((c) => c.symbol === 'sigillo').length;
  const rest = cards.filter((c) => c.symbol !== 'sigillo').map((c) => c.symbol as keyof typeof SYMBOL_VALUE);
  if (wilds >= 2) return WILD_VALUE;
  if (wilds === 1) return new Set(rest).size === 1 ? WILD_VALUE : MIXED_VALUE;
  return new Set(rest).size === 1 ? SYMBOL_VALUE[rest[0]] : MIXED_VALUE;
}

/** la combinazione piu' redditizia fra quelle giocabili, se ce n'e' una */
export function bestSet(hand: Card[]): Card[] | null {
  const sets = findSets(hand);
  if (!sets.length) return null;
  return sets.reduce((best, s) => (setValue(s) > setValue(best) ? s : best));
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
