/**
 * Obiettivi segreti.
 *
 * Ogni giocatore riceve una carta obiettivo a inizio partita. Chi lo
 * completa vince immediatamente. Nella modalità "dominio" l'obiettivo è
 * uguale per tutti: conquistare l'intera mappa.
 */
import type { GameState, Objective, PlayerId } from './types';
import { REGIONS, TERRITORY_COUNT, region } from './world';
import { shuffle, type RngState } from './rng';

const regionName = (id: string) => region(id).name;

function regionsObjective(id: string, ids: string[], extra = 0): Objective {
  const list = ids.map(regionName);
  const base = list.length === 2 ? `${list[0]} e ${list[1]}` : list.join(', ');
  return {
    id,
    kind: 'regioni',
    regions: ids,
    extraRegions: extra,
    text: extra
      ? `Conquista ${base} e un'altra macro-regione a tua scelta.`
      : `Conquista per intero ${base}.`,
  };
}

export const TERRITORY_GOAL = 24;
export const GARRISON_GOAL = 18;

export function buildObjectiveDeck(players: { id: PlayerId; name: string }[]): Objective[] {
  const deck: Objective[] = [
    regionsObjective('obj-aurelia-kethra', ['aurelia', 'kethra']),
    regionsObjective('obj-aurelia-sarmenia', ['aurelia', 'sarmenia']),
    regionsObjective('obj-norvenda-ysmar', ['norvenda', 'ysmar']),
    regionsObjective('obj-norvenda-meridiana', ['norvenda', 'meridiana']),
    regionsObjective('obj-kethra-meridiana', ['kethra', 'meridiana'], 1),
    regionsObjective('obj-sarmenia-ysmar', ['sarmenia', 'ysmar'], 1),
    {
      id: 'obj-territori',
      kind: 'territori',
      territories: TERRITORY_GOAL,
      text: `Conquista ${TERRITORY_GOAL} territori qualsiasi.`,
    },
    {
      id: 'obj-presidi',
      kind: 'territori-presidiati',
      territories: GARRISON_GOAL,
      minArmies: 2,
      text: `Conquista ${GARRISON_GOAL} territori presidiati da almeno 2 armate ciascuno.`,
    },
  ];

  for (const p of players) {
    deck.push({
      id: `obj-elimina-${p.id}`,
      kind: 'eliminazione',
      target: p.id,
      text: `Elimina dalla mappa ${p.name}.`,
      fallback: {
        id: 'obj-territori-riserva',
        kind: 'territori',
        territories: TERRITORY_GOAL,
        text: `Conquista ${TERRITORY_GOAL} territori qualsiasi.`,
      },
    });
  }
  return deck;
}

export const DOMINATION_OBJECTIVE: Objective = {
  id: 'obj-dominio',
  kind: 'dominio',
  text: 'Conquista tutti i territori della mappa.',
};

/** distribuisce un obiettivo per giocatore evitando di assegnare se stessi come bersaglio */
export function dealObjectives(
  rng: RngState,
  players: { id: PlayerId; name: string }[],
): [Record<PlayerId, Objective>, RngState] {
  const [deck, next] = shuffle(rng, buildObjectiveDeck(players));
  const assigned: Record<PlayerId, Objective> = {};
  const pool = [...deck];
  for (const p of players) {
    let index = pool.findIndex((o) => o.target !== p.id);
    if (index < 0) index = 0;
    const [objective] = pool.splice(index, 1);
    assigned[p.id] = objective;
  }
  return [assigned, next];
}

export function ownedTerritories(state: GameState, player: PlayerId): string[] {
  return Object.entries(state.territories)
    .filter(([, t]) => t.owner === player)
    .map(([id]) => id);
}

export function controlsRegion(state: GameState, player: PlayerId, regionId: string): boolean {
  return region(regionId).territories.every((t) => state.territories[t].owner === player);
}

export function controlledRegions(state: GameState, player: PlayerId): string[] {
  return REGIONS.filter((r) => controlsRegion(state, player, r.id)).map((r) => r.id);
}

/** Verifica se l'obiettivo è completato. */
export function isObjectiveComplete(state: GameState, player: PlayerId): boolean {
  const p = state.players.find((x) => x.id === player);
  if (!p || !p.alive) return false;
  return evaluate(state, player, p.objective);
}

function evaluate(state: GameState, player: PlayerId, objective: Objective): boolean {
  const owned = ownedTerritories(state, player);
  switch (objective.kind) {
    case 'dominio':
      return owned.length === TERRITORY_COUNT;
    case 'territori':
      return owned.length >= (objective.territories ?? TERRITORY_GOAL);
    case 'territori-presidiati':
      return (
        owned.filter((t) => state.territories[t].armies >= (objective.minArmies ?? 2)).length >=
        (objective.territories ?? GARRISON_GOAL)
      );
    case 'regioni': {
      const required = objective.regions ?? [];
      if (!required.every((r) => controlsRegion(state, player, r))) return false;
      const extra = objective.extraRegions ?? 0;
      if (!extra) return true;
      const others = controlledRegions(state, player).filter((r) => !required.includes(r));
      return others.length >= extra;
    }
    case 'eliminazione': {
      const target = state.players.find((x) => x.id === objective.target);
      if (!target) return false;
      if (target.alive) return false;
      // se è stato eliminato da qualcun altro, vale l'obiettivo di riserva
      if (target.eliminatedBy === player) return true;
      return objective.fallback ? evaluate(state, player, objective.fallback) : false;
    }
    default:
      return false;
  }
}

/** Descrizione dei progressi, mostrata al giocatore sul retro della carta. */
export function objectiveProgress(state: GameState, player: PlayerId): string {
  const p = state.players.find((x) => x.id === player);
  if (!p) return '';
  const o = p.objective;
  const owned = ownedTerritories(state, player);
  switch (o.kind) {
    case 'dominio':
      return `${owned.length} / ${TERRITORY_COUNT} territori`;
    case 'territori':
      return `${owned.length} / ${o.territories} territori`;
    case 'territori-presidiati':
      return `${owned.filter((t) => state.territories[t].armies >= (o.minArmies ?? 2)).length} / ${o.territories} presidi`;
    case 'regioni': {
      const req = o.regions ?? [];
      const done = req.filter((r) => controlsRegion(state, player, r)).length;
      const extraDone = Math.min(
        o.extraRegions ?? 0,
        controlledRegions(state, player).filter((r) => !req.includes(r)).length,
      );
      return `${done + extraDone} / ${req.length + (o.extraRegions ?? 0)} macro-regioni`;
    }
    case 'eliminazione': {
      const target = state.players.find((x) => x.id === o.target);
      if (!target) return '';
      return target.alive ? `${target.name} è ancora in gioco` : `${target.name} è fuori gioco`;
    }
    default:
      return '';
  }
}
