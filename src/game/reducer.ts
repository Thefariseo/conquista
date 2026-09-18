/**
 * Motore di regole.
 *
 * `applyAction` è una funzione pura: dato uno stato e un'azione restituisce
 * il nuovo stato più la lista di eventi accaduti. Nessun accesso al DOM,
 * nessuna sorgente di casualita' esterna. Questo permette di far girare lo
 * stesso codice nel browser (partita locale) o su un server (partita online).
 */
import type {
  ApplyResult,
  Card,
  GameAction,
  GameEvent,
  GameState,
  Player,
  PlayerId,
  RollResult,
} from './types';
import { TERRITORY_IDS, type TerritoryId, territory } from './world';
import { createRng, shuffle } from './rng';
import { buildDeck, card, findSets, isValidSet, setValue, HAND_LIMIT } from './cards';
import { DOMINATION_OBJECTIVE, dealObjectives, isObjectiveComplete, ownedTerritories } from './objectives';
import { maxAttackDice, maxDefenceDice, resolveRoll } from './combat';
import {
  attackTargets,
  fortifyTargets,
  currentPlayerId,
  handOf,
  livingPlayers,
  player,
  reinforcementsFor,
} from './selectors';

export const STATE_VERSION = 1;

const STARTING_ARMIES: Record<number, number> = { 2: 40, 3: 35, 4: 30, 5: 25, 6: 20 };

export interface NewGameOptions {
  players: { name: string; kind: Player['kind']; botLevel?: Player['botLevel'] }[];
  victoryMode?: GameState['config']['victoryMode'];
  seed?: number;
  autoDistribute?: boolean;
  showOdds?: boolean;
}

export function createGame(options: NewGameOptions): GameState {
  const count = options.players.length;
  if (count < 2 || count > 6) throw new Error('Servono da 2 a 6 giocatori');

  const seed = options.seed ?? 1;
  let rng = createRng(seed);

  const players: Player[] = options.players.map((p, i) => ({
    id: `g${i + 1}`,
    name: p.name,
    seat: i,
    kind: p.kind,
    botLevel: p.botLevel ?? 'navigato',
    alive: true,
    cards: [],
    objective: DOMINATION_OBJECTIVE,
    conqueredThisTurn: false,
    eliminatedBy: null,
    eliminatedOnTurn: null,
  }));

  const victoryMode = options.victoryMode ?? 'obiettivi';
  if (victoryMode === 'obiettivi') {
    const [objectives, next] = dealObjectives(rng, players);
    rng = next;
    players.forEach((p) => (p.objective = objectives[p.id]));
  }

  // distribuzione dei territori: mescolati e assegnati a giro
  const [order, afterShuffle] = shuffle(rng, TERRITORY_IDS);
  rng = afterShuffle;
  const territories: Record<TerritoryId, { owner: PlayerId | null; armies: number }> = {};
  order.forEach((id, i) => {
    territories[id] = { owner: players[i % count].id, armies: 1 };
  });

  const [deck, afterDeck] = shuffle(rng, buildDeck());
  rng = afterDeck;

  const startingArmies = STARTING_ARMIES[count];
  const setupRemaining: Record<PlayerId, number> = {};
  for (const p of players) {
    setupRemaining[p.id] = startingArmies - ownedCount(territories, p.id);
  }

  const state: GameState = {
    version: STATE_VERSION,
    seed,
    rng,
    config: {
      startingArmies,
      victoryMode,
      autoDistribute: options.autoDistribute ?? true,
      showOdds: options.showOdds ?? true,
    },
    players,
    order: players.map((p) => p.id),
    currentIndex: 0,
    turn: 0,
    phase: 'schieramento',
    territories,
    pending: 0,
    placed: {},
    setupRemaining,
    deck,
    discard: [],
    tradesDone: 0,
    mustTrade: false,
    battle: null,
    fortifyUsed: false,
    winner: null,
    log: [],
  };

  return pushLog(state, null, { type: 'partita/iniziata', players: count, mode: victoryMode });
}

function ownedCount(territories: GameState['territories'], id: PlayerId): number {
  return Object.values(territories).filter((t) => t.owner === id).length;
}

function pushLog(state: GameState, actor: PlayerId | null, event: GameEvent): GameState {
  state.log = [...state.log, { id: state.log.length + 1, turn: state.turn, player: actor, event }];
  return state;
}

const clone = (state: GameState): GameState => structuredClone(state);
const fail = (reason: string): ApplyResult => ({ ok: false, reason });

/** Punto di ingresso unico: valida, applica, registra. */
export function applyAction(input: GameState, action: GameAction): ApplyResult {
  if (input.phase === 'conclusa') return fail('La partita è conclusa.');
  if (action.player !== currentPlayerId(input)) return fail('Non è il tuo turno.');

  const state = clone(input);
  const events: GameEvent[] = [];
  const emit = (e: GameEvent) => {
    events.push(e);
    pushLog(state, action.player, e);
  };

  const result = route(state, action, emit);
  if (result) return fail(result);

  checkVictory(state, emit);
  return { ok: true, state, events };
}

type Emit = (event: GameEvent) => void;

function route(state: GameState, action: GameAction, emit: Emit): string | null {
  switch (action.type) {
    case 'schieramento/posa':
      return setupPlace(state, action.player, action.territory, emit);
    case 'schieramento/auto':
      return setupAuto(state, action.player, emit);
    case 'rinforzo/posa':
      return reinforcePlace(state, action.player, action.territory, action.count ?? 1, emit);
    case 'rinforzo/ritira':
      return reinforceTakeBack(state, action.player, action.territory);
    case 'carte/gioca':
      return tradeCards(state, action.player, action.cards, emit);
    case 'attacco/dichiara':
      return declareAttack(state, action.player, action.from, action.to, emit);
    case 'attacco/annulla':
      if (state.battle?.advance) return 'Devi prima far avanzare le armate.';
      state.battle = null;
      return null;
    case 'attacco/lancia':
      return rollAttack(state, action.player, action.dice, emit);
    case 'attacco/avanza':
      return advanceArmies(state, action.player, action.armies, emit);
    case 'spostamento/esegui':
      return fortify(state, action.player, action.from, action.to, action.armies, emit);
    case 'fase/avanza':
      return advancePhase(state, action.player, emit);
    default:
      return 'Azione sconosciuta.';
  }
}

// --- schieramento iniziale -----------------------------------------------

function setupPlace(state: GameState, id: PlayerId, target: TerritoryId, emit: Emit): string | null {
  if (state.phase !== 'schieramento') return 'Non siamo nella fase di schieramento.';
  if (state.territories[target]?.owner !== id) return 'Il territorio non è tuo.';
  if (state.setupRemaining[id] <= 0) return 'Hai già schierato tutte le armate.';

  state.territories[target].armies += 1;
  state.setupRemaining[id] -= 1;
  emit({ type: 'schieramento/posa', player: id, territory: target, armies: state.territories[target].armies });
  return afterSetupStep(state, emit);
}

function setupAuto(state: GameState, id: PlayerId, emit: Emit): string | null {
  if (state.phase !== 'schieramento') return 'Non siamo nella fase di schieramento.';
  const owned = ownedTerritories(state, id);
  if (!owned.length) return 'Nessun territorio da presidiare.';
  let guard = 0;
  let last = owned[0];
  while (state.setupRemaining[id] > 0 && guard++ < 500) {
    // rinforza ogni volta il territorio di confine più esposto
    last = owned.reduce((best, t) => (pressureScore(state, t) > pressureScore(state, best) ? t : best), owned[0]);
    state.territories[last].armies += 1;
    state.setupRemaining[id] -= 1;
  }
  emit({ type: 'schieramento/posa', player: id, territory: last, armies: state.territories[last].armies });
  return afterSetupStep(state, emit);
}

function pressureScore(state: GameState, id: TerritoryId): number {
  const t = state.territories[id];
  const enemies = territory(id).neighbours.filter((n) => state.territories[n].owner !== t.owner);
  const enemyArmies = enemies.reduce((s, n) => s + state.territories[n].armies, 0);
  return enemyArmies - t.armies * 1.35 + enemies.length * 0.4;
}

function afterSetupStep(state: GameState, emit: Emit): string | null {
  const everyoneDone = state.order.every((id) => state.setupRemaining[id] <= 0);
  if (everyoneDone) {
    state.currentIndex = -1; // beginTurn passa al primo giocatore
    beginTurn(state, emit);
    return null;
  }
  // passa al prossimo giocatore che ha ancora armate da schierare
  let index = state.currentIndex;
  for (let i = 0; i < state.order.length; i++) {
    index = (index + 1) % state.order.length;
    if (state.setupRemaining[state.order[index]] > 0) break;
  }
  state.currentIndex = index;
  return null;
}

// --- rinforzo -------------------------------------------------------------

function reinforcePlace(state: GameState, id: PlayerId, target: TerritoryId, count: number, emit: Emit): string | null {
  if (state.phase !== 'rinforzo') return 'Non siamo nella fase di rinforzo.';
  if (state.mustTrade) return 'Devi prima giocare una combinazione di carte.';
  if (state.territories[target]?.owner !== id) return 'Il territorio non è tuo.';
  const n = Math.max(1, Math.min(count, state.pending));
  if (state.pending <= 0) return 'Non hai altre armate da schierare.';

  state.territories[target].armies += n;
  state.pending -= n;
  state.placed[target] = (state.placed[target] ?? 0) + n;
  emit({ type: 'rinforzo/posa', player: id, territory: target, count: n });
  return null;
}

function reinforceTakeBack(state: GameState, id: PlayerId, target: TerritoryId): string | null {
  if (state.phase !== 'rinforzo') return 'Non siamo nella fase di rinforzo.';
  if (state.territories[target]?.owner !== id) return 'Il territorio non è tuo.';
  if (!state.placed[target]) return 'Qui non hai schierato nulla in questo turno.';
  state.territories[target].armies -= 1;
  state.placed[target] -= 1;
  if (!state.placed[target]) delete state.placed[target];
  state.pending += 1;
  return null;
}

function tradeCards(state: GameState, id: PlayerId, ids: [string, string, string], emit: Emit): string | null {
  if (state.phase !== 'rinforzo') return 'Le carte si giocano durante il rinforzo.';
  const p = player(state, id);
  if (new Set(ids).size !== 3) return 'Servono tre carte diverse.';
  if (!ids.every((c) => p.cards.includes(c))) return 'Non hai queste carte.';
  const cards = ids.map(card);
  if (!isValidSet(cards)) return 'Combinazione non valida.';

  const armies = setValue(cards);
  state.tradesDone += 1;
  p.cards = p.cards.filter((c) => !ids.includes(c));
  state.discard.push(...cards);
  state.pending += armies;

  // bonus: due armate su un territorio raffigurato e posseduto
  let bonusTerritory: TerritoryId | null = null;
  for (const c of cards) {
    if (c.territory && state.territories[c.territory].owner === id) {
      bonusTerritory = c.territory;
      break;
    }
  }
  if (bonusTerritory) {
    state.territories[bonusTerritory].armies += 2;
  }

  emit({
    type: 'carte/giocate',
    player: id,
    armies,
    symbols: cards.map((c) => c.symbol),
    bonusTerritory,
  });
  state.mustTrade = computeMustTrade(state, id);
  return null;
}

function computeMustTrade(state: GameState, id: PlayerId): boolean {
  const p = player(state, id);
  return p.cards.length >= HAND_LIMIT && findSets(handOf(state, id)).length > 0;
}

// --- attacco --------------------------------------------------------------

function declareAttack(state: GameState, id: PlayerId, from: TerritoryId, to: TerritoryId, emit: Emit): string | null {
  if (state.phase !== 'attacco') return 'Non siamo nella fase di attacco.';
  if (state.battle?.advance) return 'Devi prima far avanzare le armate.';
  if (state.territories[from]?.owner !== id) return 'Il territorio di partenza non è tuo.';
  if (state.territories[from].armies < 2) return 'Servono almeno 2 armate per attaccare.';
  if (!attackTargets(state, from).includes(to)) return 'Bersaglio non raggiungibile da qui.';

  state.battle = { from, to, lastRoll: null, rolls: 0, advance: null };
  emit({ type: 'attacco/dichiarato', player: id, from, to });
  return null;
}

function rollAttack(state: GameState, id: PlayerId, dice: number, emit: Emit): string | null {
  if (state.phase !== 'attacco') return 'Non siamo nella fase di attacco.';
  const battle = state.battle;
  if (!battle) return 'Nessuno scontro in corso.';
  if (battle.advance) return 'Devi prima far avanzare le armate.';

  const from = state.territories[battle.from];
  const to = state.territories[battle.to];
  if (from.owner !== id) return 'Il territorio di partenza non è più tuo.';
  if (maxAttackDice(from.armies) < 1)
    return 'Nel territorio di partenza è rimasta una sola armata: lo scontro è esaurito.';
  const attackDice = Math.max(1, Math.min(dice, maxAttackDice(from.armies)));
  const defenceDice = maxDefenceDice(to.armies);
  const defender = to.owner as PlayerId;

  const [roll, rng] = resolveRoll(state.rng, attackDice, defenceDice, to.armies);
  state.rng = rng;
  from.armies -= roll.attackerLosses;
  to.armies -= roll.defenderLosses;
  battle.lastRoll = roll;
  battle.rolls += 1;

  emit({ type: 'attacco/risolto', player: id, defender, from: battle.from, to: battle.to, roll });

  if (to.armies <= 0) {
    to.owner = id;
    player(state, id).conqueredThisTurn = true;
    // le armate che hanno vinto entrano subito nel territorio: sul tavolo
    // nessuna casella resta mai sguarnita
    const movable = from.armies - 1;
    const minMove = 1;
    from.armies -= minMove;
    to.armies = minMove;
    emit({ type: 'territorio/conquistato', player: id, from: defender, territory: battle.to });
    handleElimination(state, defender, id, emit);
    if (movable > minMove) {
      // il giocatore può decidere di spingere altre armate oltre il confine
      battle.advance = { min: minMove, max: movable };
    } else {
      emit({ type: 'armate/avanzate', player: id, from: battle.from, to: battle.to, armies: minMove });
      state.battle = null;
    }
  } else if (maxAttackDice(from.armies) < 1) {
    // niente più armate per proseguire: lo scontro si chiude
    state.battle = null;
  }
  return null;
}

function advanceArmies(state: GameState, id: PlayerId, armies: number, emit: Emit): string | null {
  const battle = state.battle;
  if (!battle?.advance) return 'Nessuna conquista da consolidare.';
  const { min, max } = battle.advance;
  const total = Math.max(min, Math.min(armies, max));
  const extra = total - state.territories[battle.to].armies;
  state.territories[battle.from].armies -= extra;
  state.territories[battle.to].armies += extra;
  emit({ type: 'armate/avanzate', player: id, from: battle.from, to: battle.to, armies: total });
  state.battle = null;
  return null;
}

function handleElimination(state: GameState, victim: PlayerId, by: PlayerId, emit: Emit): void {
  if (ownedTerritories(state, victim).length > 0) return;
  const loser = player(state, victim);
  if (!loser.alive) return;
  loser.alive = false;
  loser.eliminatedBy = by;
  loser.eliminatedOnTurn = state.turn;
  const taken = loser.cards;
  loser.cards = [];
  player(state, by).cards.push(...taken);
  emit({ type: 'giocatore/eliminato', player: victim, by, cards: taken.length });
}

// --- spostamento ----------------------------------------------------------

function fortify(
  state: GameState,
  id: PlayerId,
  from: TerritoryId,
  to: TerritoryId,
  armies: number,
  emit: Emit,
): string | null {
  if (state.phase !== 'spostamento') return 'Non siamo nella fase di spostamento.';
  if (state.fortifyUsed) return 'Hai già effettuato uno spostamento.';
  if (state.territories[from]?.owner !== id || state.territories[to]?.owner !== id)
    return 'Entrambi i territori devono essere tuoi.';
  if (from === to) return 'Scegli due territori diversi.';
  if (!fortifyTargets(state, from).includes(to)) return 'Lo spostamento avviene solo fra territori confinanti.';
  const max = state.territories[from].armies - 1;
  const n = Math.max(1, Math.min(armies, max));
  if (max < 1) return 'Deve restare almeno un’armata di presidio.';

  state.territories[from].armies -= n;
  state.territories[to].armies += n;
  state.fortifyUsed = true;
  emit({ type: 'spostamento/eseguito', player: id, from, to, armies: n });
  return null;
}

// --- avanzamento di fase --------------------------------------------------

function advancePhase(state: GameState, id: PlayerId, emit: Emit): string | null {
  switch (state.phase) {
    case 'schieramento':
      return 'Completa prima lo schieramento.';
    case 'rinforzo':
      if (state.mustTrade) return 'Devi giocare una combinazione di carte.';
      if (state.pending > 0) return 'Hai ancora armate da schierare.';
      state.phase = 'attacco';
      state.placed = {};
      emit({ type: 'fase/cambiata', player: id, phase: 'attacco' });
      return null;
    case 'attacco':
      if (state.battle?.advance) return 'Devi prima far avanzare le armate.';
      state.battle = null;
      state.phase = 'spostamento';
      emit({ type: 'fase/cambiata', player: id, phase: 'spostamento' });
      return null;
    case 'spostamento':
      endTurn(state, emit);
      return null;
    default:
      return 'Azione non consentita.';
  }
}

function endTurn(state: GameState, emit: Emit): void {
  const id = currentPlayerId(state);
  const p = player(state, id);
  if (p.conqueredThisTurn) {
    drawCard(state, id, emit);
    p.conqueredThisTurn = false;
  }
  state.battle = null;
  state.fortifyUsed = false;
  state.placed = {};
  beginTurn(state, emit);
}

function drawCard(state: GameState, id: PlayerId, emit: Emit): void {
  if (!state.deck.length) {
    if (!state.discard.length) return;
    const [reshuffled, rng] = shuffle(state.rng, state.discard);
    state.deck = reshuffled as Card[];
    state.discard = [];
    state.rng = rng;
  }
  const drawn = state.deck.pop();
  if (!drawn) return;
  player(state, id).cards.push(drawn.id);
  emit({ type: 'carte/pescata', player: id });
}

function beginTurn(state: GameState, emit: Emit): void {
  const alive = livingPlayers(state);
  if (alive.length <= 1) {
    if (alive.length === 1) declareWinner(state, alive[0].id, 'ultimo-superstite', emit);
    return;
  }
  let index = state.currentIndex;
  for (let i = 0; i < state.order.length + 1; i++) {
    index = (index + 1) % state.order.length;
    if (player(state, state.order[index]).alive) break;
  }
  state.currentIndex = index;
  state.turn += 1;
  state.phase = 'rinforzo';
  const id = state.order[index];
  emit({ type: 'turno/iniziato', player: id, turn: state.turn });

  const breakdown = reinforcementsFor(state, id);
  state.pending = breakdown.total;
  state.placed = {};
  state.mustTrade = computeMustTrade(state, id);
  emit({
    type: 'rinforzo/assegnato',
    player: id,
    total: breakdown.total,
    base: breakdown.base,
    regions: breakdown.regions,
  });
}

function declareWinner(state: GameState, id: PlayerId, reason: 'obiettivo' | 'dominio' | 'ultimo-superstite', emit: Emit): void {
  state.winner = id;
  state.phase = 'conclusa';
  state.battle = null;
  emit({ type: 'partita/conclusa', winner: id, reason });
}

function checkVictory(state: GameState, emit: Emit): void {
  if (state.winner || state.phase === 'conclusa') return;
  const alive = livingPlayers(state);
  if (alive.length === 1) {
    declareWinner(state, alive[0].id, 'ultimo-superstite', emit);
    return;
  }
  for (const p of alive) {
    if (state.config.victoryMode === 'dominio') {
      if (ownedTerritories(state, p.id).length === TERRITORY_IDS.length) {
        declareWinner(state, p.id, 'dominio', emit);
        return;
      }
    } else if (isObjectiveComplete(state, p.id)) {
      declareWinner(state, p.id, 'obiettivo', emit);
      return;
    }
  }
}

/** Convalida senza applicare: utile all'interfaccia per abilitare i comandi. */
export function canApply(state: GameState, action: GameAction): boolean {
  return applyAction(state, action).ok;
}

export type { RollResult };
