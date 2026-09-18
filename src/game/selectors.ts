/**
 * Letture derivate dallo stato: nessuna mutazione, solo calcoli.
 * Sono condivise da interfaccia, bot e regole.
 */
import type { Card, GameState, PlayerId } from './types';
import { REGIONS, TERRITORY_IDS, type TerritoryId, territory } from './world';
import { controlsRegion, ownedTerritories } from './objectives';
import { maxAttackDice } from './combat';
import { HAND_LIMIT, card, findSets } from './cards';

export const MIN_REINFORCEMENTS = 3;

export function currentPlayerId(state: GameState): PlayerId {
  return state.order[state.currentIndex];
}

export function player(state: GameState, id: PlayerId) {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new Error(`Giocatore sconosciuto: ${id}`);
  return p;
}

export function currentPlayer(state: GameState) {
  return player(state, currentPlayerId(state));
}

export function armiesOf(state: GameState, id: PlayerId): number {
  return TERRITORY_IDS.reduce((sum, t) => sum + (state.territories[t].owner === id ? state.territories[t].armies : 0), 0);
}

export function territoryCount(state: GameState, id: PlayerId): number {
  return ownedTerritories(state, id).length;
}

export interface ReinforcementBreakdown {
  base: number;
  regions: { region: string; bonus: number }[];
  total: number;
}

/** Armate di rinforzo a inizio turno: territori/3 (minimo 3) più i bonus regione. */
export function reinforcementsFor(state: GameState, id: PlayerId): ReinforcementBreakdown {
  const owned = territoryCount(state, id);
  const base = Math.max(MIN_REINFORCEMENTS, Math.floor(owned / 3));
  const regions = REGIONS.filter((r) => controlsRegion(state, id, r.id)).map((r) => ({
    region: r.id,
    bonus: r.bonus,
  }));
  return { base, regions, total: base + regions.reduce((s, r) => s + r.bonus, 0) };
}

export function handOf(state: GameState, id: PlayerId): Card[] {
  return player(state, id).cards.map(card);
}

/** territori dai quali il giocatore può attaccare (almeno 2 armate e un confine nemico) */
export function attackSources(state: GameState, id: PlayerId): TerritoryId[] {
  return ownedTerritories(state, id).filter(
    (t) => state.territories[t].armies >= 2 && attackTargets(state, t).length > 0,
  );
}

/** bersagli legali a partire da un territorio */
export function attackTargets(state: GameState, from: TerritoryId): TerritoryId[] {
  const src = state.territories[from];
  if (!src.owner || src.armies < 2) return [];
  return territory(from).neighbours.filter((n) => state.territories[n].owner !== src.owner);
}

/**
 * Destinazioni dello spostamento strategico: solo territori **confinanti**
 * dello stesso giocatore. Non esistono catene: si sposta da un territorio a
 * quello accanto, una volta per turno.
 */
export function fortifyTargets(state: GameState, from: TerritoryId): TerritoryId[] {
  const owner = state.territories[from].owner;
  if (!owner) return [];
  return territory(from).neighbours.filter((n) => state.territories[n].owner === owner);
}

export function fortifySources(state: GameState, id: PlayerId): TerritoryId[] {
  return ownedTerritories(state, id).filter(
    (t) => state.territories[t].armies >= 2 && fortifyTargets(state, t).length > 0,
  );
}

/** true se il territorio confina con almeno un nemico */
export function isFrontier(state: GameState, id: TerritoryId): boolean {
  const owner = state.territories[id].owner;
  return territory(id).neighbours.some((n) => state.territories[n].owner !== owner);
}

/** somma delle armate nemiche confinanti */
export function enemyPressure(state: GameState, id: TerritoryId): number {
  const owner = state.territories[id].owner;
  return territory(id).neighbours.reduce(
    (s, n) => s + (state.territories[n].owner !== owner ? state.territories[n].armies : 0),
    0,
  );
}

export function diceChoicesFor(state: GameState, from: TerritoryId, to: TerritoryId): number[] {
  const attackerArmies = state.territories[from].armies;
  const defenderArmies = state.territories[to].armies;
  const max = Math.min(maxAttackDice(attackerArmies), Math.max(1, defenderArmies + 2));
  return Array.from({ length: Math.max(0, max) }, (_, i) => i + 1);
}

export function mustTradeCards(state: GameState, id: PlayerId): boolean {
  const hand = player(state, id).cards.length;
  return hand >= HAND_LIMIT && findSets(handOf(state, id)).length > 0;
}

export function livingPlayers(state: GameState) {
  return state.players.filter((p) => p.alive);
}

export function isPlayersTurn(state: GameState, id: PlayerId): boolean {
  return state.phase !== 'conclusa' && currentPlayerId(state) === id;
}
