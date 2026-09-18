/**
 * Avversari controllati dal computer.
 *
 * Il bot non ha accesso a informazioni nascoste (le carte altrui, gli
 * obiettivi altrui): legge lo stato come lo leggerebbe un giocatore e
 * restituisce una sola azione alla volta, esattamente come farebbe un
 * client umano. Questo tiene il motore di regole l'unica autorità.
 */
import type { BotLevel, GameAction, GameState, PlayerId } from '../game/types';
import { type TerritoryId, region, territory } from '../game/world';
import { conquestProbability, maxAttackDice } from '../game/combat';
import { findSets } from '../game/cards';
import {
  attackTargets,
  fortifyTargets,
  currentPlayer,
  enemyPressure,
  handOf,
  isFrontier,
} from '../game/selectors';
import { ownedTerritories } from '../game/objectives';

interface Profile {
  /** probabilità minima di conquista per iniziare uno scontro */
  attackThreshold: number;
  /** probabilità minima per proseguire uno scontro già avviato */
  pressThreshold: number;
  /** quanto pesa la difesa nello schieramento dei rinforzi */
  defensive: number;
  /** spinta extra verso il completamento delle macro-regioni */
  regionGreed: number;
}

// Con tre dadi in difesa conquistare e' molto piu' arduo: le soglie sono
// tarate sulle probabilita' reali di questo regolamento, non su quelle di
// uno scontro con due soli dadi difensivi.
const PROFILES: Record<BotLevel, Profile> = {
  prudente: { attackThreshold: 0.58, pressThreshold: 0.44, defensive: 1.3, regionGreed: 0.6 },
  navigato: { attackThreshold: 0.43, pressThreshold: 0.3, defensive: 1.0, regionGreed: 1.0 },
  spietato: { attackThreshold: 0.32, pressThreshold: 0.2, defensive: 0.75, regionGreed: 1.5 },
};

/** Prossima azione del giocatore di turno, oppure null se non è un bot. */
export function botAction(state: GameState): GameAction | null {
  if (state.phase === 'conclusa') return null;
  const me = currentPlayer(state);
  if (me.kind !== 'bot') return null;
  const profile = PROFILES[me.botLevel];

  switch (state.phase) {
    case 'schieramento':
      return { type: 'schieramento/auto', player: me.id };
    case 'rinforzo':
      return reinforceAction(state, me.id, profile);
    case 'attacco':
      return attackAction(state, me.id, profile);
    case 'spostamento':
      return fortifyAction(state, me.id);
    default:
      return null;
  }
}

// --- rinforzo -------------------------------------------------------------

function reinforceAction(state: GameState, id: PlayerId, profile: Profile): GameAction {
  const hand = handOf(state, id);
  const sets = findSets(hand);
  if (sets.length && (state.mustTrade || hand.length >= 4 || profile.regionGreed > 1.2)) {
    const [a, b, c] = sets[0];
    return { type: 'carte/gioca', player: id, cards: [a.id, b.id, c.id] };
  }
  if (state.pending > 0) {
    const target = bestDeployment(state, id, profile);
    const chunk = Math.max(1, Math.ceil(state.pending / 3));
    return { type: 'rinforzo/posa', player: id, territory: target, count: Math.min(chunk, state.pending) };
  }
  return { type: 'fase/avanza', player: id };
}

function bestDeployment(state: GameState, id: PlayerId, profile: Profile): TerritoryId {
  const owned = ownedTerritories(state, id);
  const frontier = owned.filter((t) => isFrontier(state, t));
  const pool = frontier.length ? frontier : owned;
  let best = pool[0];
  let bestScore = -Infinity;
  for (const t of pool) {
    const mine = state.territories[t].armies;
    const pressure = enemyPressure(state, t);
    // difesa: quanto sono sotto pressione rispetto alle mie forze
    let score = (pressure - mine) * profile.defensive;
    // offesa: un vicino debole vale un investimento
    const weakest = Math.min(
      ...territory(t)
        .neighbours.filter((n) => state.territories[n].owner !== id)
        .map((n) => state.territories[n].armies),
    );
    if (Number.isFinite(weakest)) score += (mine - weakest) * 0.5 + 2;
    // ambizione: rifinire una macro-regione quasi completa
    score += regionAmbition(state, id, t) * profile.regionGreed;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

function regionAmbition(state: GameState, id: PlayerId, t: TerritoryId): number {
  const r = region(territory(t).region);
  const owned = r.territories.filter((x) => state.territories[x].owner === id).length;
  const missing = r.territories.length - owned;
  if (missing === 0) return r.bonus * 0.4; // difendi ciò che rende
  return (r.bonus / Math.max(1, missing)) * 1.2;
}

// --- attacco --------------------------------------------------------------

function attackAction(state: GameState, id: PlayerId, profile: Profile): GameAction {
  const battle = state.battle;

  if (battle?.advance) {
    const { min, max } = battle.advance;
    const sourceStillExposed = territory(battle.from).neighbours.some(
      (n) => state.territories[n].owner !== id,
    );
    const keepBack = sourceStillExposed ? 1 : 0;
    return { type: 'attacco/avanza', player: id, armies: Math.max(min, max - keepBack) };
  }

  if (battle) {
    const from = state.territories[battle.from];
    const to = state.territories[battle.to];
    const odds = conquestProbability(from.armies, to.armies);
    if (maxAttackDice(from.armies) >= 1 && odds >= profile.pressThreshold) {
      return { type: 'attacco/lancia', player: id, dice: maxAttackDice(from.armies) };
    }
    return { type: 'attacco/annulla', player: id };
  }

  const plan = bestAttack(state, id, profile);
  if (plan) return { type: 'attacco/dichiara', player: id, from: plan.from, to: plan.to };
  return { type: 'fase/avanza', player: id };
}

interface AttackPlan {
  from: TerritoryId;
  to: TerritoryId;
  score: number;
}

function bestAttack(state: GameState, id: PlayerId, profile: Profile): AttackPlan | null {
  const me = state.players.find((p) => p.id === id);
  const needsCard = me ? !me.conqueredThisTurn : false;
  let best: AttackPlan | null = null;

  for (const from of ownedTerritories(state, id)) {
    const armies = state.territories[from].armies;
    if (armies < 2) continue;
    for (const to of attackTargets(state, from)) {
      const defenders = state.territories[to].armies;
      const odds = conquestProbability(armies, defenders);
      let threshold = profile.attackThreshold;
      // la prima conquista del turno vale una carta: vale la pena osare
      if (needsCard) threshold -= 0.1;
      if (odds < threshold) continue;

      let value = 1;
      value += regionAmbition(state, id, to) * profile.regionGreed;
      // togliere l'ultimo territorio a un avversario ne raccoglie le carte
      const victim = state.territories[to].owner;
      if (victim && ownedTerritories(state, victim).length === 1) value += 6;
      // preferisci bersagli che non ti espongono
      value += Math.max(0, 3 - defenders) * 0.5;
      if (needsCard) value += 1.5;

      const score = odds * value;
      if (!best || score > best.score) best = { from, to, score };
    }
  }
  return best;
}

// --- spostamento ----------------------------------------------------------

function fortifyAction(state: GameState, id: PlayerId): GameAction {
  if (!state.fortifyUsed) {
    const owned = ownedTerritories(state, id);
    let best: { from: TerritoryId; to: TerritoryId; gain: number } | null = null;
    for (const from of owned) {
      const armies = state.territories[from].armies;
      if (armies < 2) continue;
      const rear = !isFrontier(state, from);
      for (const to of fortifyTargets(state, from)) {
        if (!isFrontier(state, to)) continue;
        const need = enemyPressure(state, to) - state.territories[to].armies;
        const gain = need + (rear ? 6 : 0) - (isFrontier(state, from) ? enemyPressure(state, from) * 0.4 : 0);
        if (gain > 0 && (!best || gain > best.gain)) best = { from, to, gain };
      }
    }
    if (best) {
      return {
        type: 'spostamento/esegui',
        player: id,
        from: best.from,
        to: best.to,
        armies: state.territories[best.from].armies - 1,
      };
    }
  }
  return { type: 'fase/avanza', player: id };
}

/** Etichette mostrate nell'interfaccia. */
export const BOT_LEVELS: { id: BotLevel; name: string; hint: string }[] = [
  { id: 'prudente', name: 'Prudente', hint: 'Attacca solo a colpo sicuro e presidia i confini.' },
  { id: 'navigato', name: 'Navigato', hint: 'Bilancia rischio e conquista, punta alle macro-regioni.' },
  { id: 'spietato', name: 'Spietato', hint: 'Osa, incatena gli attacchi e caccia i giocatori deboli.' },
];
