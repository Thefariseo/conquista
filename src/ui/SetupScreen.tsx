/** Schermata di apertura: chi siede al tavolo e con quali regole. */
import { useState } from 'react';
import { SEATS } from './palette';
import { Stemma } from './PlayerBoard';
import { BOT_LEVELS } from '../ai/bot';
import type { BotLevel, PlayerKind, VictoryMode } from '../game/types';
import { REGIONS, TERRITORY_COUNT } from '../game/world';
import { Icona } from './Icons';

export interface SetupChoice {
  players: { name: string; kind: PlayerKind; botLevel: BotLevel }[];
  victoryMode: VictoryMode;
  autoDistribute: boolean;
  showOdds: boolean;
}

const DEFAULT_PLAYERS: SetupChoice['players'] = [
  { name: 'Tu', kind: 'umano', botLevel: 'navigato' },
  { name: SEATS[1].name, kind: 'bot', botLevel: 'navigato' },
  { name: SEATS[2].name, kind: 'bot', botLevel: 'prudente' },
  { name: SEATS[3].name, kind: 'bot', botLevel: 'spietato' },
];

export function SetupScreen({
  onStart,
  onResume,
  hasSave,
  onRules,
}: {
  onStart(choice: SetupChoice): void;
  onResume(): void;
  hasSave: boolean;
  onRules(): void;
}) {
  const [players, setPlayers] = useState(DEFAULT_PLAYERS);
  const [victoryMode, setVictoryMode] = useState<VictoryMode>('obiettivi');
  const [autoDistribute, setAutoDistribute] = useState(true);
  const [showOdds, setShowOdds] = useState(true);

  const update = (index: number, patch: Partial<SetupChoice['players'][number]>) =>
    setPlayers((list) => list.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  const add = () =>
    setPlayers((list) =>
      list.length >= 6 ? list : [...list, { name: SEATS[list.length].name, kind: 'bot', botLevel: 'navigato' }],
    );

  const remove = (index: number) => setPlayers((list) => (list.length <= 2 ? list : list.filter((_, i) => i !== index)));

  return (
    <div className="apertura">
      <div className="apertura__scheda">
        <header className="apertura__testa">
          <h1>
            Conquista
            <small>L’atlante di Vhaldor</small>
          </h1>
          <p className="apertura__occhiello">
            {TERRITORY_COUNT} territori, {REGIONS.length} macro-regioni, un tavolo solo. Rinforza, attacca, consolida.
          </p>
        </header>

        <section className="apertura__sezione">
          <h2>Al tavolo</h2>
          <ul className="giocatori">
            {players.map((p, i) => (
              <li key={i} className="giocatore" style={{ ['--tinta' as string]: SEATS[i].color }}>
                <Stemma seat={i} size={26} />
                <input
                  className="giocatore__nome"
                  value={p.name}
                  maxLength={18}
                  aria-label={`Nome del giocatore ${i + 1}`}
                  onChange={(e) => update(i, { name: e.target.value })}
                />
                <div className="giocatore__natura" role="group" aria-label="Tipo di giocatore">
                  <button
                    type="button"
                    className={p.kind === 'umano' ? 'attivo' : ''}
                    onClick={() => update(i, { kind: 'umano' })}
                  >
                    Umano
                  </button>
                  <button
                    type="button"
                    className={p.kind === 'bot' ? 'attivo' : ''}
                    onClick={() => update(i, { kind: 'bot' })}
                  >
                    Bot
                  </button>
                </div>
                <select
                  className="giocatore__livello"
                  value={p.botLevel}
                  disabled={p.kind !== 'bot'}
                  aria-label={`Carattere del bot ${p.name}`}
                  onChange={(e) => update(i, { botLevel: e.target.value as BotLevel })}
                >
                  {BOT_LEVELS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="bottone-icona"
                  onClick={() => remove(i)}
                  disabled={players.length <= 2}
                  aria-label={`Togli ${p.name} dal tavolo`}
                >
                  <Icona nome="chiudi" />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="bottone bottone--fantasma" onClick={add} disabled={players.length >= 6}>
            Aggiungi un posto
          </button>
          <p className="apertura__nota">
            Più giocatori umani allo stesso dispositivo? Si gioca a turni: la partita avvisa quando passare il tavolo.
          </p>
        </section>

        <section className="apertura__sezione">
          <h2>Come si vince</h2>
          <div className="scelte">
            <button
              type="button"
              className={`scelta${victoryMode === 'obiettivi' ? ' scelta--attiva' : ''}`}
              onClick={() => setVictoryMode('obiettivi')}
            >
              <strong>Obiettivi segreti</strong>
              <span>Ognuno riceve una carta obiettivo. Chi la completa per primo vince.</span>
            </button>
            <button
              type="button"
              className={`scelta${victoryMode === 'dominio' ? ' scelta--attiva' : ''}`}
              onClick={() => setVictoryMode('dominio')}
            >
              <strong>Dominio totale</strong>
              <span>Nessun segreto: vince chi conquista tutti i {TERRITORY_COUNT} territori.</span>
            </button>
          </div>
        </section>

        <section className="apertura__sezione">
          <h2>Dettagli</h2>
          <label className="interruttore">
            <input type="checkbox" checked={autoDistribute} onChange={(e) => setAutoDistribute(e.target.checked)} />
            <span>
              Schieramento iniziale rapido
              <em>Le armate di partenza vengono disposte automaticamente sui confini.</em>
            </span>
          </label>
          <label className="interruttore">
            <input type="checkbox" checked={showOdds} onChange={(e) => setShowOdds(e.target.checked)} />
            <span>
              Mostra la probabilità di riuscita
              <em>Prima di lanciare i dadi vedi quanto è plausibile conquistare il territorio.</em>
            </span>
          </label>
        </section>

        <div className="apertura__comandi">
          <button
            type="button"
            className="bottone bottone--principale"
            onClick={() => onStart({ players, victoryMode, autoDistribute, showOdds })}
          >
            Apri il tavolo
          </button>
          {hasSave && (
            <button type="button" className="bottone bottone--fantasma" onClick={onResume}>
              Riprendi la partita
            </button>
          )}
          <button type="button" className="bottone bottone--fantasma" onClick={onRules}>
            Regolamento
          </button>
        </div>
      </div>
    </div>
  );
}
