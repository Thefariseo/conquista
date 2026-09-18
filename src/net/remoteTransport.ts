/**
 * Partita online (predisposizione).
 *
 * Il client è già scritto per un server autoritativo: invia azioni e
 * applica solo ciò che il server conferma. Manca unicamente il server, che
 * può riusare `applyAction` di src/game/reducer.ts senza modifiche:
 *
 *   socket.on('message', (raw) => {
 *     const msg = JSON.parse(raw) as ClientMessage;
 *     if (msg.kind !== 'azione') return;
 *     const result = applyAction(room.state, msg.action);   // stesse regole
 *     if (!result.ok) return send({ kind: 'errore', reason: result.reason });
 *     room.state = result.state;
 *     broadcast({ kind: 'eventi', state: result.state, events: result.events });
 *   });
 *
 * Poiché i dadi derivano dal seme contenuto nello stato, client e server
 * calcolano sempre lo stesso risultato: il replay di una partita è esatto.
 */
import type { ClientMessage, ServerListener, ServerMessage, Transport } from './protocol';

export class RemoteTransport implements Transport {
  readonly kind = 'remoto' as const;
  private socket: WebSocket | null = null;
  private queue: ClientMessage[] = [];

  constructor(
    private readonly url: string,
    private readonly room: string,
    private readonly seat?: string,
  ) {}

  connect(listener: ServerListener): void {
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.addEventListener('open', () => {
      this.send({ kind: 'entra', room: this.room, seat: this.seat });
      this.queue.splice(0).forEach((m) => this.send(m));
    });
    socket.addEventListener('message', (event) => {
      try {
        listener(JSON.parse(String(event.data)) as ServerMessage);
      } catch {
        listener({ kind: 'errore', reason: 'Messaggio del server non leggibile.' });
      }
    });
    socket.addEventListener('close', () => {
      listener({ kind: 'errore', reason: 'Connessione interrotta.' });
    });
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
    else this.queue.push(message);
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
  }
}
