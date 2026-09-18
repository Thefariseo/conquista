/** Regia della partita: mette in relazione la carta, la plancia e le regole. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameAction, GameState, PlayerId } from '../game/types';
import type { TerritoryId } from '../game/world';
import { TERRITORY_IDS, WORLD, region, territory } from '../game/world';
import { MapView, type TerritoryMood } from './MapView';
import { ActionTray } from './ActionTray';
import { PhaseTrack, Seats, Stemma } from './PlayerBoard';
import { LogPanel } from './LogPanel';
import { CardsTray } from './CardsTray';
import { ObjectiveCard, PassTheTable, RulesPanel, Tutorial, VictoryOverlay } from './Overlays';
import { Icona } from './Icons';
import { SEATS } from './palette';
import {
  attackSources,
  attackTargets,
  fortifyTargets,
  currentPlayer,
  fortifySources,
  reinforcementsFor,
} from '../game/selectors';
import { conquestProbability, maxAttackDice } from '../game/combat';
import { ownedTerritories } from '../game/objectives';
import type { GameApi } from './useGame';
import type { Preferences } from '../net/storage';

export interface GameScreenProps {
  api: GameApi;
  prefs: Preferences;
  onPrefs(prefs: Preferences): void;
  /** torna al menu conservando la partita in corso */
  onExit(): void;
  /** abbandona e sgombra il tavolo */
  onNewGame(): void;
}

export function GameScreen({ api, prefs, onPrefs, onExit, onNewGame }: GameScreenProps) {
  const { state, controlled, dispatch } = api;
  const me = currentPlayer(state);
  const mine = controlled.includes(me.id) && state.phase !== 'conclusa';

  const [origin, setOrigin] = useState<TerritoryId | null>(null);
  const [moveDraft, setMoveDraft] = useState<{ from: TerritoryId; to: TerritoryId } | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [objectiveOpen, setObjectiveOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [tutorial, setTutorial] = useState(!prefs.tutorialVisto);
  const [acknowledged, setAcknowledged] = useState<PlayerId | null>(null);
  const [rolling, setRolling] = useState(false);
  const [flash, setFlash] = useState<TerritoryId[]>([]);
  const [damage, setDamage] = useState<{ id: number; territory: TerritoryId; amount: number }[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const damageCounter = useRef(0);

  const humans = state.players.filter((p) => p.kind === 'umano' && p.alive);
  const hotSeat = humans.length > 1;

  // azzera la selezione quando cambia il contesto
  useEffect(() => {
    setOrigin(null);
    setMoveDraft(null);
  }, [state.phase, state.currentIndex, state.battle?.from, state.battle?.to, state.fortifyUsed]);

  useEffect(() => {
    if (!mine) setCardsOpen(false);
  }, [mine]);

  // --- animazioni guidate dagli eventi ---
  useEffect(() => {
    if (!api.batch.events.length) return;
    const conquests: TerritoryId[] = [];
    const hits: { id: number; territory: TerritoryId; amount: number }[] = [];
    let rolled = false;
    for (const event of api.batch.events) {
      if (event.type === 'attacco/risolto') {
        rolled = true;
        if (event.roll.attackerLosses)
          hits.push({ id: ++damageCounter.current, territory: event.from, amount: event.roll.attackerLosses });
        if (event.roll.defenderLosses)
          hits.push({ id: ++damageCounter.current, territory: event.to, amount: event.roll.defenderLosses });
      }
      if (event.type === 'territorio/conquistato') conquests.push(event.territory);
    }
    if (rolled && prefs.animazioni) {
      setRolling(true);
      const timer = window.setTimeout(() => setRolling(false), 520);
      return () => window.clearTimeout(timer);
    }
    if (conquests.length) setFlash(conquests);
    if (hits.length) setDamage((d) => [...d, ...hits]);
    return;
  }, [api.batch, prefs.animazioni]);

  useEffect(() => {
    if (!flash.length) return;
    const timer = window.setTimeout(() => setFlash([]), 1100);
    return () => window.clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    if (!damage.length) return;
    const timer = window.setTimeout(() => setDamage((d) => d.slice(1)), 900);
    return () => window.clearTimeout(timer);
  }, [damage]);

  // --- calcoli derivati ---
  const reinforcement = useMemo(
    () => (state.phase === 'rinforzo' ? reinforcementsFor(state, me.id) : null),
    [state, me.id],
  );

  const moods = useMemo<Record<TerritoryId, TerritoryMood>>(() => {
    const result: Record<TerritoryId, TerritoryMood> = {};
    const set = (ids: TerritoryId[], mood: TerritoryMood) => ids.forEach((id) => (result[id] = mood));
    const owned = ownedTerritories(state, me.id);

    if (!mine) {
      TERRITORY_IDS.forEach((id) => (result[id] = 'normale'));
      if (state.battle) {
        result[state.battle.from] = 'selezionato';
        result[state.battle.to] = 'bersaglio';
      }
      return result;
    }

    TERRITORY_IDS.forEach((id) => (result[id] = 'normale'));

    if (state.phase === 'schieramento' || state.phase === 'rinforzo') {
      set(owned, 'selezionabile');
      return result;
    }

    if (state.phase === 'attacco') {
      if (state.battle) {
        TERRITORY_IDS.forEach((id) => (result[id] = 'spento'));
        result[state.battle.from] = 'selezionato';
        result[state.battle.to] = 'bersaglio';
        return result;
      }
      if (origin) {
        TERRITORY_IDS.forEach((id) => (result[id] = 'spento'));
        result[origin] = 'selezionato';
        set(attackTargets(state, origin), 'bersaglio');
        return result;
      }
      set(attackSources(state, me.id), 'selezionabile');
      return result;
    }

    if (state.phase === 'spostamento') {
      if (moveDraft) {
        TERRITORY_IDS.forEach((id) => (result[id] = 'spento'));
        result[moveDraft.from] = 'selezionato';
        result[moveDraft.to] = 'bersaglio';
        return result;
      }
      if (origin) {
        TERRITORY_IDS.forEach((id) => (result[id] = 'spento'));
        result[origin] = 'selezionato';
        set(fortifyTargets(state, origin), 'collegato');
        return result;
      }
      if (!state.fortifyUsed) set(fortifySources(state, me.id), 'selezionabile');
      return result;
    }

    return result;
  }, [state, me.id, mine, origin, moveDraft]);

  const arrow = useMemo(() => {
    if (state.battle) return { from: state.battle.from, to: state.battle.to, tone: 'attacco' as const };
    if (moveDraft) return { from: moveDraft.from, to: moveDraft.to, tone: 'spostamento' as const };
    return null;
  }, [state.battle, moveDraft]);

  // --- interazione sulla carta ---
  const pick = useCallback(
    (id: TerritoryId, mods: { shift: boolean; alt: boolean }) => {
      if (!mine) return;
      const owner = state.territories[id].owner;

      if (state.phase === 'schieramento') {
        if (owner === me.id) dispatch({ type: 'schieramento/posa', player: me.id, territory: id });
        return;
      }

      if (state.phase === 'rinforzo') {
        if (owner !== me.id) return;
        if (mods.alt) dispatch({ type: 'rinforzo/ritira', player: me.id, territory: id });
        else dispatch({ type: 'rinforzo/posa', player: me.id, territory: id, count: mods.shift ? 5 : 1 });
        return;
      }

      if (state.phase === 'attacco') {
        if (state.battle) return;
        if (!origin) {
          if (owner === me.id && attackTargets(state, id).length) setOrigin(id);
          return;
        }
        if (id === origin) {
          setOrigin(null);
          return;
        }
        if (attackTargets(state, origin).includes(id)) {
          dispatch({ type: 'attacco/dichiara', player: me.id, from: origin, to: id });
          setOrigin(null);
          return;
        }
        if (owner === me.id && attackTargets(state, id).length) setOrigin(id);
        return;
      }

      if (state.phase === 'spostamento') {
        if (state.fortifyUsed || moveDraft) return;
        if (!origin) {
          if (owner === me.id && state.territories[id].armies >= 2 && fortifyTargets(state, id).length) setOrigin(id);
          return;
        }
        if (id === origin) {
          setOrigin(null);
          return;
        }
        if (fortifyTargets(state, origin).includes(id)) {
          setMoveDraft({ from: origin, to: id });
          setOrigin(null);
          return;
        }
        if (owner === me.id && state.territories[id].armies >= 2) setOrigin(id);
      }
    },
    [dispatch, me.id, mine, moveDraft, origin, state],
  );

  // --- comando principale ---
  const primary = useMemo(() => {
    if (state.phase === 'conclusa') return null;
    if (!mine) return null;
    if (state.phase === 'schieramento') {
      return {
        label: `Distribuisci le ultime ${state.setupRemaining[me.id]} armate`,
        action: { type: 'schieramento/auto', player: me.id } as GameAction,
        disabled: false,
      };
    }
    if (state.phase === 'rinforzo') {
      if (state.mustTrade)
        return { label: 'Devi giocare una combinazione', action: null, disabled: true };
      if (state.pending > 0)
        return { label: `Schiera ancora ${state.pending}`, action: null, disabled: true };
      return { label: 'Passa all’attacco', action: { type: 'fase/avanza', player: me.id } as GameAction, disabled: false };
    }
    if (state.phase === 'attacco') {
      // durante l'avanzata comanda il tavolino: nessun doppione nella plancia
      if (state.battle?.advance) return null;
      return {
        label: 'Passa agli spostamenti',
        action: { type: 'fase/avanza', player: me.id } as GameAction,
        disabled: false,
      };
    }
    return { label: 'Fine turno', action: { type: 'fase/avanza', player: me.id } as GameAction, disabled: false };
  }, [me.id, mine, state]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'TEXTAREA') return;
      if (primary?.action && !primary.disabled) dispatch(primary.action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, primary]);

  // --- suggerimento contestuale ---
  const hint = buildHint(state, mine, origin, moveDraft, reinforcement);

  // --- tavolino contestuale ---
  const tray = (() => {
    if (!mine) return null;
    if (state.battle?.advance) {
      return (
        <ActionTray
          kind="avanzata"
          from={state.battle.from}
          to={state.battle.to}
          min={state.battle.advance.min}
          max={state.battle.advance.max}
          onConfirm={(armies) => dispatch({ type: 'attacco/avanza', player: me.id, armies })}
        />
      );
    }
    if (state.battle) {
      const from = state.territories[state.battle.from];
      const to = state.territories[state.battle.to];
      return (
        <ActionTray
          kind="battaglia"
          from={state.battle.from}
          to={state.battle.to}
          attackerArmies={from.armies}
          defenderArmies={to.armies}
          maxDice={maxAttackDice(from.armies)}
          odds={state.config.showOdds ? conquestProbability(from.armies, to.armies) : null}
          lastRoll={state.battle.lastRoll}
          rolling={rolling}
          onRoll={(dice) => dispatch({ type: 'attacco/lancia', player: me.id, dice })}
          onCancel={() => dispatch({ type: 'attacco/annulla', player: me.id })}
        />
      );
    }
    if (moveDraft) {
      return (
        <ActionTray
          kind="spostamento"
          from={moveDraft.from}
          to={moveDraft.to}
          max={state.territories[moveDraft.from].armies - 1}
          onConfirm={(armies) => {
            dispatch({ type: 'spostamento/esegui', player: me.id, from: moveDraft.from, to: moveDraft.to, armies });
            setMoveDraft(null);
          }}
          onCancel={() => setMoveDraft(null)}
        />
      );
    }
    return null;
  })();

  const needsAcknowledge =
    hotSeat &&
    mine &&
    state.phase === 'rinforzo' &&
    state.pending === reinforcement?.total &&
    acknowledged !== me.id &&
    !tutorial;

  // il tavolino si accosta al lato opposto all'azione, per non coprirla
  const trayAnchor = state.battle ?? moveDraft;
  const traySide = (() => {
    if (!trayAnchor) return 'centro';
    const middle = (territory(trayAnchor.from).center.x + territory(trayAnchor.to).center.x) / 2;
    return middle < WORLD.viewBox.x + WORLD.viewBox.width / 2 ? 'destra' : 'sinistra';
  })();

  const seat = SEATS[me.seat];

  return (
    <div className="partita" style={{ ['--tinta-turno' as string]: seat.color }}>
      <header className="testata">
        <div className="testata__marchio">
          <span className="testata__titolo">Conquista</span>
          <span className="testata__sottotitolo">L’atlante di Vhaldor</span>
        </div>

        <Seats state={state} controlled={controlled} />

        <div className="testata__comandi">
          {api.botThinking && (
            <label className="velocita">
              <span>velocità</span>
              <select value={api.speed} onChange={(e) => api.setSpeed(Number(e.target.value))} aria-label="Velocità dei bot">
                <option value={0.5}>lenta</option>
                <option value={1}>normale</option>
                <option value={2}>rapida</option>
                <option value={6}>istantanea</option>
              </select>
            </label>
          )}
          <button type="button" className="bottone-icona" onClick={() => setRulesOpen(true)} aria-label="Regolamento">
            <Icona nome="aiuto" />
          </button>
          <button
            type="button"
            className={`bottone-icona${logOpen ? ' bottone-icona--attivo' : ''}`}
            onClick={() => setLogOpen((v) => !v)}
            aria-label="Cronologia"
          >
            <Icona nome="cronologia" />
          </button>
          <button
            type="button"
            className="bottone bottone--fantasma bottone--piccolo"
            onClick={onExit}
            title="Torna al menu: la partita resta salvata"
          >
            Esci
          </button>
        </div>
      </header>

      <main className="tavolo">
        <MapView
          state={state}
          moods={moods}
          onPick={pick}
          arrow={arrow}
          flash={flash}
          damage={damage}
          showPatterns={prefs.simboli}
          animate={prefs.animazioni}
        />

        {api.error && (
          <p className="avviso" role="alert" onAnimationEnd={api.dismissError}>
            {api.error}
          </p>
        )}

        <div className={`tavolo__tavolino tavolo__tavolino--${traySide}`}>{tray}</div>

        <LogPanel state={state} open={logOpen} onClose={() => setLogOpen(false)} />
        <RulesPanel open={rulesOpen} onClose={() => setRulesOpen(false)} prefs={prefs} onPrefs={onPrefs} />
        <ObjectiveCard state={state} player={me.id} open={objectiveOpen} onClose={() => setObjectiveOpen(false)} />
      </main>

      <footer className="plancia">
        <div className="plancia__lato">
          {!mine && state.phase !== 'conclusa' && (
            <p className="plancia__attesa">
              <span className="pulsante-attesa" /> {me.name} sta giocando…
            </p>
          )}
        </div>

        <div className="plancia__centro">
          <div className="plancia__fila">
            <span className="plancia__turno">
              <Stemma seat={me.seat} size={15} /> turno {Math.max(1, state.turn)}
            </span>
            <PhaseTrack phase={state.phase} />
          </div>
          <p className={`istruzione${api.botThinking ? ' istruzione--attesa' : ''}`} role="status">
            {hint}
          </p>
          {primary && (
            <button
              type="button"
              className="bottone bottone--principale"
              disabled={primary.disabled || !primary.action}
              onClick={() => primary.action && dispatch(primary.action)}
            >
              {primary.label}
            </button>
          )}
        </div>

        <div className="plancia__mano">
          <button
            type="button"
            className={`bottone bottone--mano${state.mustTrade ? ' bottone--urgente' : ''}`}
            onClick={() => setCardsOpen((v) => !v)}
            disabled={!mine}
          >
            <Icona nome="carte" /> Carte
            <span className="bottone__pallino">{state.players.find((p) => p.id === me.id)?.cards.length ?? 0}</span>
          </button>
          <button
            type="button"
            className="bottone bottone--mano"
            onClick={() => setObjectiveOpen((v) => !v)}
            disabled={!mine}
          >
            <Icona nome="obiettivo" /> Obiettivo
          </button>
        </div>
      </footer>

      <CardsTray
        state={state}
        player={me.id}
        open={cardsOpen && mine}
        canPlay={state.phase === 'rinforzo'}
        onPlay={(cards) => {
          dispatch({ type: 'carte/gioca', player: me.id, cards });
          setCardsOpen(false);
        }}
        onClose={() => setCardsOpen(false)}
      />

      {tutorial && (
        <Tutorial
          onClose={() => {
            setTutorial(false);
            onPrefs({ ...prefs, tutorialVisto: true });
          }}
        />
      )}

      {needsAcknowledge && (
        <PassTheTable player={{ id: me.id, name: me.name, seat: me.seat }} onReady={() => setAcknowledged(me.id)} />
      )}

      {state.phase === 'conclusa' && !reviewing && (
        <VictoryOverlay state={state} onRestart={onNewGame} onReview={() => setReviewing(true)} />
      )}
    </div>
  );
}

const regionName = (id: string) => region(id).name;

function buildHint(
  state: GameState,
  mine: boolean,
  origin: TerritoryId | null,
  moveDraft: { from: TerritoryId; to: TerritoryId } | null,
  reinforcement: { base: number; regions: { region: string; bonus: number }[] } | null,
): string {
  const me = currentPlayer(state);
  if (state.phase === 'conclusa') return 'Partita conclusa.';
  if (!mine) return `${me.name} sta giocando il proprio turno.`;

  switch (state.phase) {
    case 'schieramento':
      return `Schieramento iniziale: tocca i tuoi territori per posare le armate (ne restano ${state.setupRemaining[me.id]}).`;
    case 'rinforzo':
      if (state.mustTrade) return 'Hai troppe carte: gioca una combinazione prima di proseguire.';
      if (state.pending === 0) return 'Armate schierate: passa all’attacco.';
      {
        const bonus = reinforcement?.regions.length
          ? ` — ${reinforcement.base} dai territori più ${reinforcement.regions
              .map((r) => `${regionName(r.region)} +${r.bonus}`)
              .join(' e ')}`
          : '';
        return `Tocca i tuoi territori per schierare ${state.pending} armate${bonus}. Maiusc per cinque alla volta, Alt per riprenderne una.`;
      }
    case 'attacco':
      if (state.battle?.advance) return 'Decidi quante armate entrano nel territorio conquistato.';
      if (state.battle)
        return maxAttackDice(state.territories[state.battle.from].armies) < 1
          ? 'Lo scontro è esaurito: da quel territorio resta una sola armata. Chiudi e scegli un altro fronte.'
          : 'Lancia i dadi, oppure ritirati e scegli un altro fronte.';
      if (origin) return `Da ${territory(origin).name}: scegli uno dei territori evidenziati da attaccare.`;
      if (!attackSources(state, me.id).length)
        return 'Nessun attacco possibile: nessun tuo territorio di confine ha almeno due armate.';
      return 'Scegli un tuo territorio con almeno due armate per attaccare, oppure passa alla fase successiva.';
    case 'spostamento':
      if (moveDraft) return 'Scegli quante armate spostare.';
      if (state.fortifyUsed) return 'Hai già effettuato lo spostamento del turno: puoi chiudere il turno.';
      if (origin) return `Da ${territory(origin).name}: scegli dove spostare le armate.`;
      if (!fortifySources(state, me.id).length) return 'Nessuno spostamento possibile: puoi chiudere il turno.';
      return 'Puoi spostare armate fra due tuoi territori confinanti, poi chiudi il turno.';
    default:
      return '';
  }
}
