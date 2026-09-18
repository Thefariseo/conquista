/**
 * Partita locale: il "server" vive nella stessa scheda del browser.
 *
 * È comunque l'unica autorità sulle regole — l'interfaccia non modifica
 * mai lo stato direttamente, invia azioni e riceve eventi. Passare a una
 * partita online significa sostituire questa classe, non riscrivere il gioco.
 */
import { applyAction } from '../game/reducer';
import type { GameState } from '../game/types';
import type { ClientMessage, ServerListener, Transport } from './protocol';

export class LocalTransport implements Transport {
  readonly kind = 'locale' as const;
  private listener: ServerListener | null = null;

  constructor(
    private state: GameState,
    /** posti giocabili da questo client (tutti gli umani, in hot seat) */
    private readonly controlled: string[],
    private readonly onPersist?: (state: GameState) => void,
  ) {}

  connect(listener: ServerListener): void {
    this.listener = listener;
    this.emitState();
  }

  send(message: ClientMessage): void {
    if (message.kind === 'sincronizza' || message.kind === 'entra') {
      this.emitState();
      return;
    }
    const result = applyAction(this.state, message.action);
    if (!result.ok) {
      this.listener?.({ kind: 'errore', reason: result.reason });
      return;
    }
    this.state = result.state;
    this.onPersist?.(this.state);
    this.listener?.({ kind: 'eventi', state: this.state, events: result.events });
  }

  close(): void {
    this.listener = null;
  }

  snapshot(): GameState {
    return this.state;
  }

  private emitState() {
    this.listener?.({
      kind: 'stato',
      state: this.state,
      room: { id: 'locale', controlled: this.controlled },
    });
  }
}
