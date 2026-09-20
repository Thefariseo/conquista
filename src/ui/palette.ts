/**
 * Identita' visiva dei giocatori.
 *
 * I colori sono pieni e decisi come quelli di un tabellone stampato: il
 * territorio si legge a colpo d'occhio anche da lontano. Ogni casa ha in piu'
 * un simbolo sulla pedina e una trama sul territorio, cosi' chi non distingue
 * bene i colori riconosce comunque il proprietario.
 */
export interface Seat {
  name: string;
  /** colore pieno della pedina */
  color: string;
  /** schiarita della pedina, per il rilievo */
  light: string;
  /** scurita della pedina, per il bordo e l'ombra */
  dark: string;
  /** tinta del territorio sulla carta */
  land: string;
  /** bordo del territorio */
  edge: string;
  /** colore del testo su fondo pieno */
  ink: string;
  symbol: SeatSymbol;
  pattern: SeatPattern;
}

export type SeatSymbol = 'rombo' | 'triangolo' | 'cerchio' | 'quadrato' | 'stella' | 'esagono';
export type SeatPattern = 'diagonale' | 'punti' | 'reticolo' | 'verticale' | 'onde' | 'pieno';

export const SEATS: Seat[] = [
  {
    name: 'Casa Vermiglia',
    color: '#C0392B',
    light: '#E4695A',
    dark: '#7E2118',
    land: '#D98274',
    edge: '#8E2B20',
    ink: '#FFF3EF',
    symbol: 'rombo',
    pattern: 'diagonale',
  },
  {
    name: 'Casa Cobalto',
    color: '#2472A8',
    light: '#57A3D6',
    dark: '#14405F',
    land: '#79AED2',
    edge: '#1B5480',
    ink: '#F1F8FD',
    symbol: 'triangolo',
    pattern: 'punti',
  },
  {
    name: 'Casa Alloro',
    color: '#2F8055',
    light: '#5FB184',
    dark: '#17462E',
    land: '#84BC9D',
    edge: '#245F40',
    ink: '#F0FAF4',
    symbol: 'cerchio',
    pattern: 'reticolo',
  },
  {
    name: 'Casa Vespro',
    color: '#7A4A9E',
    light: '#A97DC9',
    dark: '#452659',
    land: '#B195C9',
    edge: '#5B3577',
    ink: '#F9F3FD',
    symbol: 'quadrato',
    pattern: 'verticale',
  },
  {
    name: 'Casa Ambra',
    color: '#C98A16',
    light: '#EBB44D',
    dark: '#7C520A',
    land: '#E3B65F',
    edge: '#91620C',
    ink: '#FFF8E8',
    symbol: 'stella',
    pattern: 'onde',
  },
  {
    name: 'Casa Ardesia',
    color: '#4A5561',
    light: '#7C8896',
    dark: '#272E36',
    land: '#94A0AC',
    edge: '#374049',
    ink: '#F4F6F8',
    symbol: 'esagono',
    pattern: 'pieno',
  },
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

export const NEUTRAL_LAND = '#E4D8BC';
export const INK = '#2E2618';
