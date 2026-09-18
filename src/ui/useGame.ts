/**
 * Collega l'interfaccia al motore di regole attraverso il trasporto.
 *
 * L'interfaccia non tocca mai lo stato: invia azioni e riceve lo stato
 * aggiornato. Vale sia per la partita locale sia, domani, per quella online.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameAction, GameEvent, GameState, PlayerId } from '../game/types';
import { LocalTransport } from '../net/localTransport';
import type { ServerMessage } from '../net/protocol';
import { botAction } from '../ai/bot';
import { currentPlayer } from '../game/selectors';
import { saveGame } from '../net/storage';

export interface EventBatch {
  id: number;
  events: GameEvent[];
}

export interface GameApi {
  state: GameState;
  controlled: PlayerId[];
  error: string | null;
  dismissError(): void;
  dispatch(action: GameAction): void;
  /** ultimo gruppo di eventi ricevuto, per le animazioni */
  batch: EventBatch;
  botThinking: boolean;
  speed: number;
  setSpeed(value: number): void;
}

const BASE_DELAY: Record<string, number> = {
  'attacco/lancia': 850,
  'attacco/dichiara': 500,
  'attacco/avanza': 450,
  'rinforzo/posa': 320,
  'carte/gioca': 600,
  'spostamento/esegui': 450,
  'fase/avanza': 380,
  'schieramento/auto': 250,
};

export function useGame(initial: GameState, controlled: PlayerId[]): GameApi {
  const transport = useMemo(() => new LocalTransport(initial, controlled, saveGame), [initial, controlled]);
  const [state, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<EventBatch>({ id: 0, events: [] });
  const [speed, setSpeed] = useState(1);
  const counter = useRef(0);

  useEffect(() => {
    const listener = (message: ServerMessage) => {
      if (message.kind === 'errore') {
        setError(message.reason);
        return;
      }
      setState(message.state);
      if (message.kind === 'eventi' && message.events.length) {
        counter.current += 1;
        setBatch({ id: counter.current, events: message.events });
      }
    };
    transport.connect(listener);
    return () => transport.close();
  }, [transport]);

  const dispatch = useCallback(
    (action: GameAction) => {
      setError(null);
      transport.send({ kind: 'azione', action });
    },
    [transport],
  );

  // --- turni dei bot: una azione alla volta, con una pausa leggibile ---
  const isBotTurn = state.phase !== 'conclusa' && currentPlayer(state).kind === 'bot';
  useEffect(() => {
    if (!isBotTurn) return;
    const action = botAction(state);
    if (!action) return;
    const delay = Math.max(80, (BASE_DELAY[action.type] ?? 300) / speed);
    const timer = window.setTimeout(() => dispatch(action), delay);
    return () => window.clearTimeout(timer);
  }, [state, isBotTurn, speed, dispatch]);

  return {
    state,
    controlled,
    error,
    dismissError: () => setError(null),
    dispatch,
    batch,
    botThinking: isBotTurn,
    speed,
    setSpeed,
  };
}
