/**
 * Protocollo di partita.
 *
 * Lo stesso vocabolario vale per la partita locale (dove il "server" è un
 * oggetto in memoria) e per una futura partita online (dove il server è
 * remoto). L'interfaccia non sa quale delle due sta usando.
 */
import type { GameAction, GameEvent, GameState, PlayerId } from '../game/types';

export interface RoomInfo {
  id: string;
  /** posti che questo client può muovere (hot seat: più di uno) */
  controlled: PlayerId[];
}

export type ClientMessage =
  | { kind: 'entra'; room: string; seat?: PlayerId }
  | { kind: 'azione'; action: GameAction }
  | { kind: 'sincronizza' };

export type ServerMessage =
  | { kind: 'stato'; state: GameState; room: RoomInfo }
  | { kind: 'eventi'; state: GameState; events: GameEvent[] }
  | { kind: 'errore'; reason: string };

export type ServerListener = (message: ServerMessage) => void;

export interface Transport {
  readonly kind: 'locale' | 'remoto';
  connect(listener: ServerListener): void;
  send(message: ClientMessage): void;
  close(): void;
}
