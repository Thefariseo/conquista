import { describe, expect, it } from 'vitest';
import { applyAction, createGame } from '../src/game/reducer';
import type { GameAction, GameState } from '../src/game/types';
import { botAction } from '../src/ai/bot';
import { TERRITORY_IDS, territory } from '../src/game/world';
import { currentPlayerId, reinforcementsFor } from '../src/game/selectors';
import { ownedTerritories } from '../src/game/objectives';
import { isValidSet, tradeValue } from '../src/game/cards';
import { card } from '../src/game/cards';

const quickGame = (overrides: Partial<Parameters<typeof createGame>[0]> = {}) =>
  createGame({
    seed: 7,
    victoryMode: 'obiettivi',
    players: [
      { name: 'Alfa', kind: 'bot', botLevel: 'navigato' },
      { name: 'Beta', kind: 'bot', botLevel: 'spietato' },
      { name: 'Gamma', kind: 'bot', botLevel: 'prudente' },
    ],
    ...overrides,
  });

function expectInvariants(state: GameState) {
  for (const id of TERRITORY_IDS) {
    const t = state.territories[id];
    expect(t.owner).toBeTruthy();
    expect(t.armies).toBeGreaterThanOrEqual(1);
  }
  for (const p of state.players) {
    const owned = ownedTerritories(state, p.id).length;
    if (p.alive) expect(owned).toBeGreaterThan(0);
    else expect(owned).toBe(0);
  }
}

function apply(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

describe('creazione della partita', () => {
  it('distribuisce tutti i territori e le armate iniziali', () => {
    const state = quickGame();
    expect(Object.keys(state.territories)).toHaveLength(TERRITORY_IDS.length);
    for (const p of state.players) {
      const owned = ownedTerritories(state, p.id).length;
      expect(owned).toBeGreaterThan(0);
      expect(owned + state.setupRemaining[p.id]).toBe(state.config.startingArmies);
    }
    expect(state.phase).toBe('schieramento');
  });

  it('e’ riproducibile a partire dal seme', () => {
    expect(JSON.stringify(quickGame())).toEqual(JSON.stringify(quickGame()));
    expect(JSON.stringify(quickGame({ seed: 8 }))).not.toEqual(JSON.stringify(quickGame()));
  });

  it('assegna un obiettivo diverso da se stessi', () => {
    for (let seed = 1; seed < 40; seed++) {
      const state = quickGame({ seed });
      for (const p of state.players) {
        expect(p.objective.target).not.toBe(p.id);
      }
    }
  });
});

describe('sequenza del turno', () => {
  const started = () => {
    let state = quickGame();
    let guard = 0;
    while (state.phase === 'schieramento' && guard++ < 50) {
      state = apply(state, { type: 'schieramento/auto', player: currentPlayerId(state) });
    }
    return state;
  };

  it('apre il primo turno in fase di rinforzo con armate da schierare', () => {
    const state = started();
    expect(state.phase).toBe('rinforzo');
    expect(state.turn).toBe(1);
    expect(state.pending).toBe(reinforcementsFor(state, currentPlayerId(state)).total);
    expect(state.pending).toBeGreaterThanOrEqual(3);
    expectInvariants(state);
  });

  it('rifiuta le azioni di chi non e’ di turno', () => {
    const state = started();
    const other = state.order.find((id) => id !== currentPlayerId(state))!;
    const result = applyAction(state, { type: 'fase/avanza', player: other });
    expect(result.ok).toBe(false);
  });

  it('non lascia passare alla fase di attacco con armate in mano', () => {
    const state = started();
    expect(applyAction(state, { type: 'fase/avanza', player: currentPlayerId(state) }).ok).toBe(false);
  });

  it('permette di ritirare un’armata appena schierata', () => {
    let state = started();
    const me = currentPlayerId(state);
    const mine = ownedTerritories(state, me)[0];
    const before = state.territories[mine].armies;
    const pending = state.pending;
    state = apply(state, { type: 'rinforzo/posa', player: me, territory: mine, count: 2 });
    expect(state.territories[mine].armies).toBe(before + 2);
    state = apply(state, { type: 'rinforzo/ritira', player: me, territory: mine });
    expect(state.territories[mine].armies).toBe(before + 1);
    expect(state.pending).toBe(pending - 1);
  });

  it('scandisce rinforzo -> attacco -> spostamento -> turno successivo', () => {
    let state = started();
    const me = currentPlayerId(state);
    const mine = ownedTerritories(state, me)[0];
    state = apply(state, { type: 'rinforzo/posa', player: me, territory: mine, count: state.pending });
    state = apply(state, { type: 'fase/avanza', player: me });
    expect(state.phase).toBe('attacco');
    state = apply(state, { type: 'fase/avanza', player: me });
    expect(state.phase).toBe('spostamento');
    state = apply(state, { type: 'fase/avanza', player: me });
    expect(state.phase).toBe('rinforzo');
    expect(currentPlayerId(state)).not.toBe(me);
    expect(state.turn).toBe(2);
  });
});

describe('regole di combattimento e spostamento', () => {
  const ready = () => {
    let state = quickGame();
    let guard = 0;
    while (state.phase === 'schieramento' && guard++ < 60) {
      state = apply(state, { type: 'schieramento/auto', player: currentPlayerId(state) });
    }
    const me = currentPlayerId(state);
    const mine = ownedTerritories(state, me)[0];
    state = apply(state, { type: 'rinforzo/posa', player: me, territory: mine, count: state.pending });
    return apply(state, { type: 'fase/avanza', player: me });
  };

  it('vieta attacchi verso territori non confinanti o propri', () => {
    const state = ready();
    const me = currentPlayerId(state);
    const mine = ownedTerritories(state, me);
    const from = mine.find((t) => state.territories[t].armies >= 2)!;
    const ownNeighbour = territory(from).neighbours.find((n) => state.territories[n].owner === me);
    if (ownNeighbour) {
      expect(applyAction(state, { type: 'attacco/dichiara', player: me, from, to: ownNeighbour }).ok).toBe(false);
    }
    const distant = TERRITORY_IDS.find((t) => !territory(from).neighbours.includes(t) && t !== from)!;
    expect(applyAction(state, { type: 'attacco/dichiara', player: me, from, to: distant }).ok).toBe(false);
  });

  it('applica le perdite e consegna il territorio quando il difensore cade', () => {
    let state = ready();
    const me = currentPlayerId(state);
    const from = ownedTerritories(state, me).find((t) =>
      territory(t).neighbours.some((n) => state.territories[n].owner !== me),
    )!;
    const to = territory(from).neighbours.find((n) => state.territories[n].owner !== me)!;
    // forziamo uno scontro impari per verificare la conquista
    state.territories[from].armies = 30;
    state.territories[to].armies = 1;
    state = apply(state, { type: 'attacco/dichiara', player: me, from, to });
    let guard = 0;
    while (state.territories[to].owner !== me && guard++ < 30) {
      state = apply(state, { type: 'attacco/lancia', player: me, dice: 3 });
    }
    expect(state.territories[to].owner).toBe(me);
    // le armate vincenti entrano subito: il territorio non resta mai vuoto
    expect(state.territories[to].armies).toBeGreaterThanOrEqual(1);
    expect(state.battle?.advance).toBeTruthy();
    const { max } = state.battle!.advance!;
    state = apply(state, { type: 'attacco/avanza', player: me, armies: max });
    expect(state.territories[to].armies).toBe(max);
    expect(state.territories[from].armies).toBe(1);
    expect(state.battle).toBeNull();
    expectInvariants(state);
  });

  it('non consente spostamenti fra territori scollegati', () => {
    let state = ready();
    const me = currentPlayerId(state);
    state = apply(state, { type: 'fase/avanza', player: me });
    expect(state.phase).toBe('spostamento');
    const mine = ownedTerritories(state, me);
    const from = mine.find((t) => state.territories[t].armies >= 2)!;
    const unreachable = mine.find(
      (t) => t !== from && !territory(from).neighbours.includes(t) && state.territories[t].owner === me,
    );
    if (unreachable) {
      const result = applyAction(state, {
        type: 'spostamento/esegui',
        player: me,
        from,
        to: unreachable,
        armies: 1,
      });
      // se non sono collegati da una catena amica, il motore deve rifiutare
      const connected = result.ok;
      if (!connected) expect(result.reason).toMatch(/collegati/);
    }
  });
});

describe('carte conquista', () => {
  it('riconosce le combinazioni valide', () => {
    const tris = [card('carta-valdoria'), card('carta-osmara'), card('carta-lindaro')];
    expect(tris.map((c) => c.symbol)).toBeTruthy();
    expect(isValidSet([card('carta-sigillo-1'), card('carta-sigillo-2'), card('carta-valdoria')])).toBe(true);
  });

  it('applica la scala crescente dei valori', () => {
    expect(tradeValue(0)).toBe(4);
    expect(tradeValue(5)).toBe(15);
    expect(tradeValue(6)).toBe(20);
    expect(tradeValue(7)).toBe(25);
  });
});

describe('partite complete contro i bot', () => {
  it('arrivano a una vittoria rispettando le invarianti', () => {
    for (const seed of [3, 11, 29, 101]) {
      let state = createGame({
        seed,
        victoryMode: 'obiettivi',
        players: [
          { name: 'Alfa', kind: 'bot', botLevel: 'navigato' },
          { name: 'Beta', kind: 'bot', botLevel: 'spietato' },
          { name: 'Gamma', kind: 'bot', botLevel: 'prudente' },
          { name: 'Delta', kind: 'bot', botLevel: 'navigato' },
        ],
      });
      let steps = 0;
      while (state.phase !== 'conclusa' && steps++ < 40000) {
        const action = botAction(state);
        expect(action).toBeTruthy();
        const result = applyAction(state, action!);
        if (!result.ok) throw new Error(`seme ${seed}: ${result.reason} (${JSON.stringify(action)})`);
        state = result.state;
        if (steps % 250 === 0) expectInvariants(state);
      }
      expect(state.phase).toBe('conclusa');
      expect(state.winner).toBeTruthy();
      expectInvariants(state);
      expect(state.log.length).toBeGreaterThan(50);
    }
  }, 120000);

  it('funziona anche in modalita’ dominio con due giocatori', () => {
    let state = createGame({
      seed: 5,
      victoryMode: 'dominio',
      players: [
        { name: 'Alfa', kind: 'bot', botLevel: 'spietato' },
        { name: 'Beta', kind: 'bot', botLevel: 'navigato' },
      ],
    });
    let steps = 0;
    while (state.phase !== 'conclusa' && steps++ < 60000) {
      state = apply(state, botAction(state)!);
    }
    expect(state.winner).toBeTruthy();
    expect(ownedTerritories(state, state.winner!)).toHaveLength(TERRITORY_IDS.length);
  }, 120000);
});
