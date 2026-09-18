/** Sovrapposizioni: passaggio del tavolo, obiettivo, regolamento, vittoria. */
import { useEffect, useState } from 'react';
import type { GameState, PlayerId } from '../game/types';
import { SEATS } from './palette';
import { Stemma } from './PlayerBoard';
import { Icona } from './Icons';
import { objectiveProgress } from '../game/objectives';
import { territoryCount, armiesOf } from '../game/selectors';
import { REGIONS, TERRITORY_COUNT } from '../game/world';
import type { Preferences } from '../net/storage';

export function PassTheTable({ player, onReady }: { player: { id: PlayerId; name: string; seat: number }; onReady(): void }) {
  return (
    <div className="velo" role="dialog" aria-modal="true" aria-label="Passaggio del tavolo">
      <div className="velo__scheda velo__scheda--passaggio" style={{ ['--tinta' as string]: SEATS[player.seat].color }}>
        <Stemma seat={player.seat} size={54} />
        <h2>Tocca a {player.name}</h2>
        <p>Passa il dispositivo. Gli altri giocatori non devono vedere l’obiettivo segreto né le carte.</p>
        <button type="button" className="bottone bottone--primario" onClick={onReady} autoFocus>
          Sono pronto
        </button>
      </div>
    </div>
  );
}

export function ObjectiveCard({
  state,
  player,
  open,
  onClose,
}: {
  state: GameState;
  player: PlayerId;
  open: boolean;
  onClose(): void;
}) {
  const p = state.players.find((x) => x.id === player);
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(onClose, 12000);
    return () => window.clearTimeout(timer);
  }, [open, onClose]);
  if (!p) return null;
  return (
    <section className={`obiettivo${open ? ' obiettivo--aperto' : ''}`} aria-hidden={!open}>
      <header>
        <Icona nome="obiettivo" />
        <h2>Obiettivo segreto</h2>
        <button type="button" className="bottone-icona" onClick={onClose} aria-label="Nascondi l’obiettivo">
          <Icona nome="chiudi" />
        </button>
      </header>
      <p className="obiettivo__testo">{p.objective.text}</p>
      <p className="obiettivo__progresso">{objectiveProgress(state, player)}</p>
      <p className="obiettivo__nota">Nessun altro deve leggerlo: si nasconde da solo.</p>
    </section>
  );
}

export function VictoryOverlay({ state, onRestart, onReview }: { state: GameState; onRestart(): void; onReview(): void }) {
  const winner = state.players.find((p) => p.id === state.winner);
  if (!winner) return null;
  const classifica = [...state.players].sort(
    (a, b) => territoryCount(state, b.id) - territoryCount(state, a.id) || armiesOf(state, b.id) - armiesOf(state, a.id),
  );
  return (
    <div className="velo" role="dialog" aria-modal="true" aria-label="Partita conclusa">
      <div className="velo__scheda velo__scheda--vittoria" style={{ ['--tinta' as string]: SEATS[winner.seat].color }}>
        <Stemma seat={winner.seat} size={64} />
        <h2>{winner.name} vince la partita</h2>
        <p className="velo__obiettivo">{winner.objective.text}</p>
        <ol className="classifica">
          {classifica.map((p) => (
            <li key={p.id} className={p.alive ? '' : 'classifica__fuori'}>
              <Stemma seat={p.seat} size={16} />
              <span>{p.name}</span>
              <em>
                {territoryCount(state, p.id)} territori · {armiesOf(state, p.id)} armate
              </em>
            </li>
          ))}
        </ol>
        <p className="velo__durata">Conclusa al turno {state.turn}.</p>
        <div className="velo__comandi">
          <button type="button" className="bottone bottone--primario" onClick={onRestart}>
            Nuova partita
          </button>
          <button type="button" className="bottone bottone--fantasma" onClick={onReview}>
            Resta a guardare la carta
          </button>
        </div>
      </div>
    </div>
  );
}

const PASSI = [
  {
    titolo: 'La carta è il tavolo',
    testo:
      'Ogni sagoma è un territorio: la pedina mostra quante armate lo presidiano e di chi sono. Trascina per spostare la carta, usa la rotellina per avvicinarti.',
  },
  {
    titolo: '1 · Rinforzo',
    testo:
      'A inizio turno ricevi armate in base ai territori posseduti (uno ogni tre, minimo tre) più il bonus di ogni macro-regione controllata per intero. Tocca i tuoi territori per schierarle.',
  },
  {
    titolo: '2 · Attacco',
    testo:
      'Scegli un tuo territorio con almeno due armate, poi un territorio confinante avversario: si illuminano da soli. Tu lanci fino a tre dadi, chi difende ne lancia uno per armata fino a tre: a parità vince sempre la difesa, quindi serve una netta superiorità.',
  },
  {
    titolo: '3 · Spostamento',
    testo:
      'Una volta per turno puoi spostare armate fra due tuoi territori confinanti, lasciandone almeno una di presidio. Poi il turno passa.',
  },
  {
    titolo: 'Carte e obiettivo',
    testo:
      'Ogni turno in cui conquisti almeno un territorio ricevi una carta. Tre simboli uguali o tre diversi formano una combinazione e valgono armate extra. Vinci completando il tuo obiettivo segreto.',
  },
];

export function Tutorial({ onClose }: { onClose(): void }) {
  const [step, setStep] = useState(0);
  const last = step === PASSI.length - 1;
  return (
    <div className="velo" role="dialog" aria-modal="true" aria-label="Come si gioca">
      <div className="velo__scheda velo__scheda--tutorial">
        <span className="velo__passo">
          {step + 1} / {PASSI.length}
        </span>
        <h2>{PASSI[step].titolo}</h2>
        <p>{PASSI[step].testo}</p>
        <div className="velo__comandi">
          {step > 0 && (
            <button type="button" className="bottone bottone--fantasma" onClick={() => setStep((s) => s - 1)}>
              Indietro
            </button>
          )}
          <button
            type="button"
            className="bottone bottone--primario"
            onClick={() => (last ? onClose() : setStep((s) => s + 1))}
          >
            {last ? 'Inizia a giocare' : 'Avanti'}
          </button>
          {!last && (
            <button type="button" className="bottone bottone--fantasma" onClick={onClose}>
              Salta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function RulesPanel({
  open,
  onClose,
  prefs,
  onPrefs,
}: {
  open: boolean;
  onClose(): void;
  prefs?: Preferences;
  onPrefs?(prefs: Preferences): void;
}) {
  return (
    <aside className={`regolamento${open ? ' regolamento--aperto' : ''}`} aria-hidden={!open}>
      <header className="regolamento__testa">
        <h2>Regolamento</h2>
        <button type="button" className="bottone-icona" onClick={onClose} aria-label="Chiudi il regolamento">
          <Icona nome="chiudi" />
        </button>
      </header>
      <div className="regolamento__corpo">
        {prefs && onPrefs && (
          <>
            <h3>Preferenze</h3>
            <label className="interruttore">
              <input
                type="checkbox"
                checked={prefs.simboli}
                onChange={(e) => onPrefs({ ...prefs, simboli: e.target.checked })}
              />
              <span>
                Trame sui territori
                <em>Oltre al colore, ogni casa ha una trama diversa: utile se i colori si confondono.</em>
              </span>
            </label>
            <label className="interruttore">
              <input
                type="checkbox"
                checked={prefs.animazioni}
                onChange={(e) => onPrefs({ ...prefs, animazioni: e.target.checked })}
              />
              <span>
                Animazioni
                <em>Lancio dei dadi e lampeggio delle conquiste.</em>
              </span>
            </label>
            <label className="interruttore">
              <input
                type="checkbox"
                checked={!prefs.tutorialVisto}
                onChange={(e) => onPrefs({ ...prefs, tutorialVisto: !e.target.checked })}
              />
              <span>
                Mostra la guida rapida a inizio partita
                <em>Le cinque schede che spiegano il giro del turno.</em>
              </span>
            </label>
          </>
        )}

        <h3>Scopo</h3>
        <p>
          Completare il proprio obiettivo segreto oppure restare l’unico in gioco. Nella modalità <em>dominio</em> vince
          chi conquista tutti i {TERRITORY_COUNT} territori.
        </p>

        <h3>Preparazione</h3>
        <p>
          I territori vengono distribuiti fra i giocatori con un’armata ciascuno; le armate rimanenti si schierano a
          turno sui propri territori.
        </p>

        <h3>Il turno</h3>
        <ol>
          <li>
            <strong>Rinforzo</strong> — ricevi un’armata ogni tre territori posseduti (minimo tre), più il bonus delle
            macro-regioni controllate per intero. Puoi giocare combinazioni di carte.
          </li>
          <li>
            <strong>Attacco</strong> — attacchi un territorio confinante partendo da un tuo territorio con almeno due
            armate. L’attaccante lancia fino a <strong>tre</strong> dadi, sempre uno in meno delle armate presenti; il
            difensore ne lancia uno per ogni armata che presidia il territorio, fino a <strong>tre</strong>. Si
            confrontano i dadi più alti a coppie e <strong>a parità perde l’attaccante</strong>: difendere conviene, e
            per conquistare serve una netta superiorità numerica. Quando cade l’ultima armata difensiva il territorio
            passa di mano: vi entra subito un’armata e tu decidi quante altre farne avanzare. Puoi attaccare quante
            volte vuoi, anche ripartendo dal territorio appena conquistato.
          </li>
          <li>
            <strong>Spostamento</strong> — un solo trasferimento di armate fra due tuoi territori
            <strong> confinanti</strong>, alla fine del turno. Deve restare almeno un’armata di presidio.
          </li>
        </ol>

        <h3>Carte conquista</h3>
        <p>
          Ogni turno in cui conquisti almeno un territorio peschi una carta. Tre simboli uguali o tre simboli diversi
          formano una combinazione; il sigillo vale come qualunque simbolo. Il valore è fisso e dipende solo dalla
          combinazione:
        </p>
        <ul className="regolamento__tris">
          <li>
            <span>Tre vessilli</span>
            <em>4 armate</em>
          </li>
          <li>
            <span>Tre arieti</span>
            <em>6 armate</em>
          </li>
          <li>
            <span>Tre falchi</span>
            <em>8 armate</em>
          </li>
          <li>
            <span>Uno di ogni simbolo</span>
            <em>10 armate</em>
          </li>
          <li>
            <span>Sigillo più due simboli uguali</span>
            <em>12 armate</em>
          </li>
        </ul>
        <p>
          Se possiedi un territorio raffigurato su una carta giocata, ricevi due armate extra proprio lì. Con cinque
          carte in mano sei obbligato a giocare una combinazione all’inizio del rinforzo.
        </p>

        <h3>Macro-regioni</h3>
        <ul className="regolamento__regioni">
          {REGIONS.map((r) => (
            <li key={r.id}>
              <span>{r.name}</span>
              <em>
                {r.territories.length} territori · +{r.bonus} armate
              </em>
            </li>
          ))}
        </ul>

        <h3>Eliminazione</h3>
        <p>
          Chi perde l’ultimo territorio esce dalla partita: le sue carte passano a chi lo ha eliminato. Se il tuo
          obiettivo era eliminare un giocatore tolto di mezzo da altri, vale l’obiettivo di riserva indicato sulla carta.
        </p>

        <h3>Leggere la carta</h3>
        <p>
          Colore, trama del territorio e simbolo sulla pedina indicano sempre lo stesso proprietario: l’informazione non
          è mai affidata al solo colore. Le linee tratteggiate sono rotte marittime: collegano territori lontani come se
          fossero confinanti.
        </p>
      </div>
    </aside>
  );
}
