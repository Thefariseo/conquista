# Conquista — l'atlante di Vhaldor

Un gioco di strategia territoriale da tavolo, giocabile nel browser: una carta
disegnata a mano, armate, dadi, carte conquista e obiettivi segreti. Nessuna
installazione per chi gioca, nessun account, nessuna connessione necessaria.

<p align="center">
  <em>42 territori · 6 macro-regioni · da 2 a 6 giocatori · single player contro i bot, hot seat, predisposto per l'online</em>
</p>

---

## Opera originale

Mappa, nomi, regioni, illustrazioni, testi, interfaccia, identità visiva e
codice sono **interamente originali**. Non sono usati marchi, loghi, nomi
commerciali, immagini, testi, tabelloni o denominazioni geografiche provenienti
da prodotti esistenti. Il mondo di **Vhaldor** e le sue macro-regioni (Aurelia,
Norvenda, Kethra, Sarmenia, Meridiana, Ysmar) sono inventati per questo
progetto, e la geometria della carta è generata da uno script incluso nel
repository (`tools/`).

Quello che il progetto riprende è ciò che non appartiene a nessuno: la
*grammatica* dei giochi di conquista territoriale — territori confinanti,
armate, dadi contrapposti, bonus di regione, carte, obiettivi. Il regolamento
segue da vicino quello classico all'italiana: **il difensore lancia fino a tre
dadi**, le combinazioni di carte hanno valori fissi e lo spostamento
strategico avviene solo fra territori confinanti.

## Cosa c'è dentro

- **Carta interattiva in SVG** disegnata come un tabellone stampato: territori
  dai contorni organici (niente griglie), fondali digradanti attorno alle
  coste, grana della carta, cartigli delle macro-regioni con il bonus, rotte
  marittime, bussola, zoom e trascinamento a 60 fotogrammi al secondo.
- **Pedine con rilievo**: dischi sfaccettati che si impilano al crescere delle
  armate, con riflesso, ombra sul tabellone e stemma della casa.
- **Turno in tre fasi** — rinforzo, attacco, spostamento — scandite da una
  plancia sempre visibile.
- **Combattimento a dadi** all'italiana — fino a tre dadi anche in difesa —
  con probabilità di riuscita calcolata in modo esatto, dadi disegnati come
  oggetti fisici e perdite mostrate sulla carta.
- **Carte conquista** con la tabella classica delle combinazioni (4, 6, 8, 10,
  12 armate) e bonus sul territorio raffigurato.
- **Obiettivi segreti** (o modalità dominio totale), eliminazione dei giocatori
  con passaggio delle carte, condizioni di vittoria verificate a ogni azione.
- **Cronologia** completa della partita, riga per riga.
- **Tre caratteri di bot** (prudente, navigato, spietato) e velocità regolabile.
- **Hot seat** con schermata di passaggio del dispositivo, così gli obiettivi
  restano segreti.
- **Partita salvata** in automatico: si può chiudere la scheda e riprendere.
- **Accessibilità**: ogni casa ha colore, simbolo e trama; comandi raggiungibili
  da tastiera; rispetto di `prefers-reduced-motion`.

## Avvio rapido

```bash
npm install
npm run dev        # http://localhost:5173
```

Altri comandi:

```bash
npm run build      # controllo dei tipi + bundle di produzione in dist/
npm run preview    # serve il bundle già compilato
npm test           # motore di regole, mappa e combattimento
npm run genmap     # rigenera la carta da tools/world.config.mjs
```

Il risultato di `npm run build` è una cartella statica: si pubblica su
qualunque hosting di file, senza back-end.

## Come si gioca, in breve

Il regolamento completo è dentro l'applicazione (icona **?** in alto a destra).
In sintesi:

1. **Rinforzo** — ricevi un'armata ogni tre territori posseduti (minimo tre),
   più il bonus di ogni macro-regione controllata per intero. Le armate si
   posano toccando i propri territori sulla carta.
2. **Attacco** — scegli un tuo territorio con almeno due armate: i bersagli
   possibili si illuminano da soli. L'attaccante lancia fino a **tre** dadi,
   sempre uno in meno delle armate presenti; il difensore ne lancia **uno per
   armata, fino a tre**. Si confrontano i dadi più alti a coppie e **a parità
   perde l'attaccante**: difendere conviene, e per conquistare serve una netta
   superiorità. Caduta l'ultima armata difensiva il territorio cambia
   proprietario, vi entra subito un'armata e decidi tu quante altre farne
   avanzare.
3. **Spostamento** — un solo trasferimento per turno fra due tuoi territori
   **confinanti**, lasciando almeno un'armata di presidio.

Ogni turno in cui conquisti almeno un territorio ricevi una carta. Il valore
delle combinazioni è fisso: tre vessilli 4, tre arieti 6, tre falchi 8, uno di
ogni simbolo 10, sigillo più due uguali 12. Se possiedi un territorio
raffigurato su una carta giocata ricevi due armate extra proprio lì. Con cinque
carte in mano sei obbligato a giocare una combinazione.

Si vince completando il proprio obiettivo segreto, oppure restando l'unico in
gioco (nella modalità *dominio totale*, conquistando tutti i territori).

## La carta di Vhaldor

La geometria non è disegnata a mano né copiata: è **generata**. Le silhouette
dei continenti sono descritte come disegni ASCII su un reticolo esagonale in
[`tools/world.config.mjs`](tools/world.config.mjs); il generatore
[`tools/generate-map.mjs`](tools/generate-map.mjs) le suddivide in territori con
una crescita bilanciata a partire da semi distanti, ne ricava i contorni
deformandoli in modo deterministico, calcola baricentri e confini e scrive
`src/game/world.data.ts`.

Questo significa che **cambiare mondo è una modifica di configurazione**:
modifica le silhouette o i nomi, lancia `npm run genmap`, e mappa, adiacenze e
bonus si aggiornano da soli. Il generatore verifica che il grafo dei confini sia
simmetrico e connesso, e si rifiuta di scrivere una carta mal formata.

```
Territori: 42  Regioni: 6
  Aurelia    bonus 5   9 territori     3 collegamenti esterni
  Sarmenia   bonus 5   7 territori     5 collegamenti esterni
  Norvenda   bonus 7  12 territori     6 collegamenti esterni
  Kethra     bonus 3   6 territori     4 collegamenti esterni
  Meridiana  bonus 2   4 territori     2 collegamenti esterni
  Ysmar      bonus 2   4 territori     2 collegamenti esterni
```

Dimensioni, bonus e numero di strozzature ricalcano quelli di un tabellone
classico: l'arcipelago è piccolo e difendibile, la grande regione orientale
rende molto ma è esposta su sei fronti.

## Come resta fluida

Una carta con quarantadue territori, altrettante pedine, fondali e ornamenti e'
facile da rendere pesante. Tre scelte la tengono a pieno regime:

- **La telecamera non passa da React.** Posizione e ingrandimento vivono in un
  riferimento e vengono scritti direttamente sul nodo SVG dentro un
  `requestAnimationFrame` (`src/ui/useCamera.ts`): trascinare la carta non
  ridisegna nulla.
- **Niente filtri SVG sulle superfici grandi.** Ombre e rilievi sono
  approssimati con geometria (cornici concentriche, copie scure sfalsate):
  un `feDropShadow` su tutto il tabellone costringerebbe il browser a
  rigenerare la sfocatura a ogni fotogramma della panoramica.
- **I dettagli si sospendono mentre la carta si muove.** Nomi, grana e reticolo
  spariscono durante il trascinamento e tornano da soli un attimo dopo.

Misurato con il browser vero, trascinando la carta: si e' passati da 15 a 60
fotogrammi al secondo.

I nomi dei territori non si sovrappongono mai perche' la loro posizione e'
calcolata una volta sola dal generatore, provando per ciascuno una serie di
collocazioni e tenendo la prima libera da pedine e da altri nomi.

## Architettura

Tre strati che non si mescolano mai:

```
src/game    regole pure        stato + azione -> nuovo stato + eventi
src/net     trasporto          locale oggi, WebSocket domani
src/ui      interfaccia        disegna lo stato, invia azioni
src/ai      avversari          leggono lo stato, propongono azioni
```

- **`src/game/reducer.ts` è l'unica autorità sulle regole.** `applyAction` è una
  funzione pura: nessun accesso al DOM, nessuna casualità esterna. Restituisce
  il nuovo stato e la lista degli eventi accaduti, oppure il motivo del rifiuto.
- **I dadi sono deterministici.** Il generatore pseudo-casuale
  (`src/game/rng.ts`) vive dentro lo stato: stesso seme e stessa sequenza di
  azioni producono la stessa partita. Da qui arrivano i test riproducibili e,
  domani, il replay esatto lato server.
- **L'interfaccia non modifica lo stato.** Invia azioni al trasporto e disegna
  ciò che torna indietro. Anche i bot passano di lì: propongono un'azione alla
  volta, esattamente come farebbe una persona.

### Multiplayer online: cosa manca davvero

Il client è già scritto per un server autoritativo. `src/net/protocol.ts`
definisce i messaggi, `LocalTransport` è il "server" in memoria della partita
locale e `RemoteTransport` è lo stesso client su WebSocket. Un server può
riusare il motore così com'è:

```ts
import { applyAction } from './game/reducer';

socket.on('message', (raw) => {
  const msg = JSON.parse(raw) as ClientMessage;
  if (msg.kind !== 'azione') return;
  const result = applyAction(stanza.stato, msg.action);       // stesse regole
  if (!result.ok) return rispondi({ kind: 'errore', reason: result.reason });
  stanza.stato = result.state;
  broadcast({ kind: 'eventi', state: result.state, events: result.events });
});
```

Il motore valida già che l'azione arrivi dal giocatore di turno e rifiuta tutto
ciò che non è legale, quindi un client manomesso non può barare. Restano da
scrivere il server vero e proprio, le stanze e l'autenticazione: nessuna
modifica alle regole, all'interfaccia o ai bot.

## Accessibilità

- Il proprietario di un territorio non è mai affidato al solo colore: ogni casa
  ha un **simbolo** sulla pedina e una **trama** sul territorio (disattivabili
  dalle preferenze, nel pannello del regolamento).
- La carta è navigabile da tastiera: i territori su cui si può agire sono
  raggiungibili con Tab e si attivano con Invio o barra spaziatrice; Invio
  conferma anche l'azione principale della fase.
- Ogni territorio espone un'etichetta parlata del tipo *"Lindaro, Casa Ambra,
  4 armate"*; il suggerimento di fase è un `role="status"`.
- Con `prefers-reduced-motion` le animazioni si spengono.

## Test

```bash
npm test
```

Coprono la geometria della carta (confini simmetrici, grafo connesso, nomi
unici), il combattimento (parità al difensore, tre dadi in difesa, monotonia
delle probabilità, determinismo del seme), la sequenza del turno, lo
spostamento fra soli confinanti, la tabella delle combinazioni e — come prova
d'insieme — **partite complete fra bot** che devono concludersi con un
vincitore senza mai violare le invarianti (ogni territorio presidiato da almeno
un'armata, chi è vivo possiede territori, chi è eliminato non ne possiede).

## Struttura

```
src/
  game/       regole, mappa, carte, obiettivi, combattimento, cronologia
    world.data.ts   carta generata (non modificare a mano)
  ai/         bot e loro caratteri
  net/        protocollo, trasporto locale, trasporto remoto, salvataggi
  ui/         schermate, carta SVG, plancia, pannelli
  styles.css  foglio di stile unico
tools/        configurazione del mondo e generatore della carta
tests/        prove del motore
```

## Note

Progetto didattico e ricreativo, senza scopo di lucro e senza alcun legame con
prodotti commerciali esistenti.
