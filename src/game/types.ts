/** Modello di dominio: stato, azioni ed eventi della partita. */
import type { RegionId, TerritoryId } from './world';
import type { RngState } from './rng';

export type PlayerId = string;

/** I tre simboli delle carte conquista, più il sigillo jolly. */
export type CardSymbol = 'vessillo' | 'ariete' | 'falco' | 'sigillo';

export interface Card {
  id: string;
  symbol: CardSymbol;
  /** territorio raffigurato sulla carta (assente sui jolly) */
  territory: TerritoryId | null;
}

export type PlayerKind = 'umano' | 'bot';
export type BotLevel = 'prudente' | 'navigato' | 'spietato';

export interface Player {
  id: PlayerId;
  name: string;
  /** indice nella tavolozza dei colori (vedi ui/palette.ts) */
  seat: number;
  kind: PlayerKind;
  botLevel: BotLevel;
  alive: boolean;
  cards: string[];
  objective: Objective;
  /** vero se in questo turno ha conquistato almeno un territorio */
  conqueredThisTurn: boolean;
  eliminatedBy: PlayerId | null;
  eliminatedOnTurn: number | null;
}

export type ObjectiveKind =
  | 'territori'
  | 'territori-presidiati'
  | 'regioni'
  | 'eliminazione'
  | 'dominio';

export interface Objective {
  id: string;
  kind: ObjectiveKind;
  /** testo mostrato al giocatore */
  text: string;
  /** parametri di verifica */
  territories?: number;
  minArmies?: number;
  regions?: RegionId[];
  /** una regione libera a scelta oltre a quelle elencate */
  extraRegions?: number;
  target?: PlayerId;
  /** obiettivo di riserva se il bersaglio viene eliminato da altri */
  fallback?: Objective;
}

export type VictoryMode = 'obiettivi' | 'dominio';

export interface GameConfig {
  /** armate iniziali per giocatore, calcolate dal numero di partecipanti */
  startingArmies: number;
  victoryMode: VictoryMode;
  /** distribuzione iniziale automatica dei territori */
  autoDistribute: boolean;
  /** mostra la probabilità di vittoria prima di lanciare i dadi */
  showOdds: boolean;
}

export interface TerritoryState {
  owner: PlayerId | null;
  armies: number;
}

export interface RollResult {
  attack: number[];
  defence: number[];
  attackerLosses: number;
  defenderLosses: number;
  conquered: boolean;
}

export interface Battle {
  from: TerritoryId;
  to: TerritoryId;
  lastRoll: RollResult | null;
  /** numero di lanci in questo scontro */
  rolls: number;
  /** presente quando il territorio è stato conquistato e le armate devono avanzare */
  advance: { min: number; max: number } | null;
}

export type Phase = 'schieramento' | 'rinforzo' | 'attacco' | 'spostamento' | 'conclusa';

export interface GameState {
  version: number;
  seed: number;
  rng: RngState;
  config: GameConfig;
  players: Player[];
  /** ordine di gioco (id dei giocatori, anche eliminati) */
  order: PlayerId[];
  currentIndex: number;
  turn: number;
  phase: Phase;
  territories: Record<TerritoryId, TerritoryState>;
  /** armate ancora da schierare nella fase corrente */
  pending: number;
  /** armate posate in questa fase, per poterle riprendere */
  placed: Record<TerritoryId, number>;
  /** armate iniziali ancora da distribuire, per giocatore */
  setupRemaining: Record<PlayerId, number>;
  deck: Card[];
  discard: Card[];
  /** quante combinazioni sono già state giocate (scala i valori) */
  tradesDone: number;
  /** vero se il giocatore di turno deve giocare carte prima di proseguire */
  mustTrade: boolean;
  battle: Battle | null;
  fortifyUsed: boolean;
  winner: PlayerId | null;
  log: LogEntry[];
}

export interface LogEntry {
  id: number;
  turn: number;
  player: PlayerId | null;
  event: GameEvent;
}

// --- azioni ---------------------------------------------------------------

export type GameAction =
  | { type: 'schieramento/posa'; player: PlayerId; territory: TerritoryId }
  | { type: 'schieramento/auto'; player: PlayerId }
  | { type: 'rinforzo/posa'; player: PlayerId; territory: TerritoryId; count?: number }
  | { type: 'rinforzo/ritira'; player: PlayerId; territory: TerritoryId }
  | { type: 'carte/gioca'; player: PlayerId; cards: [string, string, string] }
  | { type: 'attacco/dichiara'; player: PlayerId; from: TerritoryId; to: TerritoryId }
  | { type: 'attacco/annulla'; player: PlayerId }
  | { type: 'attacco/lancia'; player: PlayerId; dice: number }
  | { type: 'attacco/avanza'; player: PlayerId; armies: number }
  | { type: 'spostamento/esegui'; player: PlayerId; from: TerritoryId; to: TerritoryId; armies: number }
  | { type: 'fase/avanza'; player: PlayerId };

// --- eventi (alimentano la cronologia e le animazioni) --------------------

export type GameEvent =
  | { type: 'partita/iniziata'; players: number; mode: VictoryMode }
  | { type: 'turno/iniziato'; player: PlayerId; turn: number }
  | { type: 'schieramento/posa'; player: PlayerId; territory: TerritoryId; armies: number }
  | { type: 'rinforzo/assegnato'; player: PlayerId; total: number; base: number; regions: { region: RegionId; bonus: number }[] }
  | { type: 'rinforzo/posa'; player: PlayerId; territory: TerritoryId; count: number }
  | { type: 'carte/giocate'; player: PlayerId; armies: number; symbols: CardSymbol[]; bonusTerritory: TerritoryId | null }
  | { type: 'carte/pescata'; player: PlayerId }
  | { type: 'attacco/dichiarato'; player: PlayerId; from: TerritoryId; to: TerritoryId }
  | { type: 'attacco/risolto'; player: PlayerId; defender: PlayerId; from: TerritoryId; to: TerritoryId; roll: RollResult }
  | { type: 'territorio/conquistato'; player: PlayerId; from: PlayerId; territory: TerritoryId }
  | { type: 'armate/avanzate'; player: PlayerId; from: TerritoryId; to: TerritoryId; armies: number }
  | { type: 'spostamento/eseguito'; player: PlayerId; from: TerritoryId; to: TerritoryId; armies: number }
  | { type: 'giocatore/eliminato'; player: PlayerId; by: PlayerId; cards: number }
  | { type: 'fase/cambiata'; player: PlayerId; phase: Phase }
  | { type: 'partita/conclusa'; winner: PlayerId; reason: 'obiettivo' | 'dominio' | 'ultimo-superstite' };

export interface ApplyOk {
  ok: true;
  state: GameState;
  events: GameEvent[];
}

export interface ApplyError {
  ok: false;
  reason: string;
}

export type ApplyResult = ApplyOk | ApplyError;
