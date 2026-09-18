/**
 * Identità visiva dei giocatori.
 *
 * Ogni posto al tavolo ha colore, simbolo e trama: chi non distingue bene i
 * colori riconosce comunque il proprietario di un territorio dal simbolo
 * sulla pedina e dalla trama del territorio.
 */
export interface Seat {
  name: string;
  /** colore pieno della pedina */
  color: string;
  /** tinta del territorio sulla carta */
  land: string;
  /** colore del testo su fondo pieno */
  ink: string;
  symbol: SeatSymbol;
  pattern: SeatPattern;
}

export type SeatSymbol = 'rombo' | 'triangolo' | 'cerchio' | 'quadrato' | 'stella' | 'esagono';
export type SeatPattern = 'diagonale' | 'punti' | 'reticolo' | 'verticale' | 'onde' | 'pieno';

export const SEATS: Seat[] = [
  { name: 'Casa Vermiglia', color: '#B3402C', land: '#E6BAA9', ink: '#FFF4EE', symbol: 'rombo', pattern: 'diagonale' },
  { name: 'Casa Cobalto', color: '#2A6A96', land: '#AFC8DA', ink: '#F2F8FC', symbol: 'triangolo', pattern: 'punti' },
  { name: 'Casa Alloro', color: '#3E7A55', land: '#B6CFBB', ink: '#F1F9F2', symbol: 'cerchio', pattern: 'reticolo' },
  { name: 'Casa Vespro', color: '#774C94', land: '#CFBDDC', ink: '#F9F2FD', symbol: 'quadrato', pattern: 'verticale' },
  { name: 'Casa Ambra', color: '#B9750C', land: '#EFC078', ink: '#FFF8E9', symbol: 'stella', pattern: 'onde' },
  { name: 'Casa Ardesia', color: '#4B545E', land: '#BFC4CA', ink: '#F4F6F8', symbol: 'esagono', pattern: 'pieno' },
];

/** Contorno del simbolo, disegnato in un riquadro centrato sull'origine. */
export function symbolPath(symbol: SeatSymbol, r: number): string {
  switch (symbol) {
    case 'rombo':
      return `M0 ${-r} L${r} 0 L0 ${r} L${-r} 0 Z`;
    case 'triangolo':
      return `M0 ${-r} L${r * 0.92} ${r * 0.7} L${-r * 0.92} ${r * 0.7} Z`;
    case 'quadrato':
      return `M${-r * 0.8} ${-r * 0.8} H${r * 0.8} V${r * 0.8} H${-r * 0.8} Z`;
    case 'stella': {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 ? r * 0.45 : r;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        pts.push(`${(Math.cos(a) * radius).toFixed(2)} ${(Math.sin(a) * radius).toFixed(2)}`);
      }
      return `M${pts.join('L')}Z`;
    }
    case 'esagono': {
      const pts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        pts.push(`${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`);
      }
      return `M${pts.join('L')}Z`;
    }
    case 'cerchio':
    default:
      return `M0 ${-r} A${r} ${r} 0 1 0 0.01 ${-r} Z`;
  }
}

export const NEUTRAL_LAND = '#F0E7D5';
export const INK = '#33291F';
