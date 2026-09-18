/**
 * Risoluzione dello scontro e calcolo esatto delle probabilità.
 *
 * Regola: l'attaccante lancia fino a 3 dadi (uno in meno delle armate
 * presenti), il difensore fino a 2 (una per armata). I dadi si confrontano
 * in ordine decrescente, a parita' vince il difensore.
 */
import { rollDice, type RngState } from './rng';
import type { RollResult } from './types';

export const MAX_ATTACK_DICE = 3;
export const MAX_DEFENCE_DICE = 2;

export function maxAttackDice(armies: number): number {
  return Math.max(0, Math.min(MAX_ATTACK_DICE, armies - 1));
}

export function maxDefenceDice(armies: number): number {
  return Math.max(0, Math.min(MAX_DEFENCE_DICE, armies));
}

export function compareDice(attack: number[], defence: number[]): { attackerLosses: number; defenderLosses: number } {
  let attackerLosses = 0;
  let defenderLosses = 0;
  const pairs = Math.min(attack.length, defence.length);
  for (let i = 0; i < pairs; i++) {
    if (attack[i] > defence[i]) defenderLosses++;
    else attackerLosses++;
  }
  return { attackerLosses, defenderLosses };
}

export function resolveRoll(
  rng: RngState,
  attackDice: number,
  defenceDice: number,
  defenderArmies: number,
): [RollResult, RngState] {
  const [attack, afterAttack] = rollDice(rng, attackDice);
  const [defence, afterDefence] = rollDice(afterAttack, defenceDice);
  const { attackerLosses, defenderLosses } = compareDice(attack, defence);
  return [
    {
      attack,
      defence,
      attackerLosses,
      defenderLosses,
      conquered: defenderArmies - defenderLosses <= 0,
    },
    afterDefence,
  ];
}

// --- probabilità ---------------------------------------------------------

/** distribuzione delle perdite per un singolo lancio: chiave `a:d` */
const singleRollCache = new Map<string, { attackerLosses: number; defenderLosses: number; p: number }[]>();

function singleRollDistribution(attackDice: number, defenceDice: number) {
  const key = `${attackDice}:${defenceDice}`;
  const cached = singleRollCache.get(key);
  if (cached) return cached;

  const tally = new Map<string, number>();
  const faces = [1, 2, 3, 4, 5, 6];
  const enumerate = (n: number, acc: number[], cb: (dice: number[]) => void) => {
    if (n === 0) return cb(acc);
    for (const f of faces) enumerate(n - 1, [...acc, f], cb);
  };

  let total = 0;
  enumerate(attackDice, [], (a) => {
    const sortedA = [...a].sort((x, y) => y - x);
    enumerate(defenceDice, [], (d) => {
      const sortedD = [...d].sort((x, y) => y - x);
      const r = compareDice(sortedA, sortedD);
      const k = `${r.attackerLosses}:${r.defenderLosses}`;
      tally.set(k, (tally.get(k) ?? 0) + 1);
      total++;
    });
  });

  const dist = [...tally.entries()].map(([k, count]) => {
    const [al, dl] = k.split(':').map(Number);
    return { attackerLosses: al, defenderLosses: dl, p: count / total };
  });
  singleRollCache.set(key, dist);
  return dist;
}

const battleCache = new Map<string, number>();

/**
 * Probabilità che l'attaccante conquisti il territorio proseguendo lo
 * scontro fino in fondo (si ferma quando gli resta una sola armata).
 * `attackers` = armate presenti nel territorio di partenza.
 */
export function conquestProbability(attackers: number, defenders: number): number {
  if (defenders <= 0) return 1;
  if (attackers <= 1) return 0;
  const key = `${attackers}:${defenders}`;
  const cached = battleCache.get(key);
  if (cached !== undefined) return cached;

  const a = maxAttackDice(attackers);
  const d = maxDefenceDice(defenders);
  let p = 0;
  for (const outcome of singleRollDistribution(a, d)) {
    p += outcome.p * conquestProbability(attackers - outcome.attackerLosses, defenders - outcome.defenderLosses);
  }
  battleCache.set(key, p);
  return p;
}

/** Probabilità di successo di un singolo lancio (almeno una perdita inflitta). */
export function singleRollOdds(attackDice: number, defenceDice: number) {
  const dist = singleRollDistribution(attackDice, defenceDice);
  const expectedAttacker = dist.reduce((s, o) => s + o.p * o.attackerLosses, 0);
  const expectedDefender = dist.reduce((s, o) => s + o.p * o.defenderLosses, 0);
  return { expectedAttacker, expectedDefender };
}
