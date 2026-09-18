/**
 * Configurazione dell'atlante di VHALDOR — mondo interamente originale.
 *
 * La struttura ricalca quella di un tabellone classico da gioco di conquista:
 * sei macro-regioni di 9, 4, 7, 6, 12 e 4 territori (42 in tutto) con bonus
 * 5, 2, 5, 3, 7, 2, e una rete di rotte marittime che riproduce le stesse
 * strozzature strategiche. Nomi, forme e grafica restano inventati.
 *
 * Ogni macro-regione e' disegnata come una silhouette ASCII su un reticolo
 * esagonale condiviso ('#' = terra emersa, tutto il resto = oceano).
 * Il generatore suddivide poi ogni silhouette in territori organici.
 */

export const GRID = {
  hexSize: 30,      // raggio dell'esagono (punta in alto)
  jitter: 0.17,     // deformazione deterministica dei vertici (0 = poligoni regolari)
  margin: 70,
};

export const REGIONS = [
  {
    id: 'aurelia',
    name: 'Aurelia',
    bonus: 5,
    accent: '#B4763C',
    origin: { col: 1, row: 1 },
    territories: [
      'Valdoria', 'Corveno', 'Brantera', 'Osmara', 'Lindaro',
      'Tarvena', 'Sepria', 'Numira', 'Calvera',
    ],
    art: [
      '....#####.....',
      '..#########...',
      '.############.',
      '.#############',
      '..############',
      '...##########.',
      '....########..',
      '....#####.....',
      '.....###......',
      '......##......',
    ],
  },
  {
    id: 'sarmenia',
    name: 'Sarmenia',
    bonus: 5,
    accent: '#9A6B7B',
    origin: { col: 18, row: 4 },
    territories: ['Nadira', 'Olvenna', 'Pirenne', 'Quassar', 'Rovinal', 'Sulmera', 'Umbrasi'],
    art: [
      '...#####...',
      '..########.',
      '.##########',
      '.#########.',
      '..#######..',
      '...#####...',
    ],
  },
  {
    id: 'norvenda',
    name: 'Norvenda',
    bonus: 7,
    accent: '#5E7C8A',
    origin: { col: 30, row: 0 },
    territories: [
      'Arkhald', 'Belgora', 'Cirvask', 'Drossen', 'Ezimar', 'Fenvard',
      'Gholmir', 'Irunta', 'Jarnok', 'Kovarn', 'Lemska', 'Myrrad',
    ],
    art: [
      '......########....',
      '...#############..',
      '..################',
      '.#################',
      '.#################',
      '..###############.',
      '...#############..',
      '....####.######...',
      '.....##...####....',
      '..........###.....',
    ],
  },
  {
    id: 'kethra',
    name: 'Kethra',
    bonus: 3,
    accent: '#A8894B',
    origin: { col: 19, row: 13 },
    territories: ['Baltora', 'Cendra', 'Dusmar', 'Ephira', 'Fonteral', 'Garrun'],
    art: [
      '..######..',
      '.########.',
      '.########.',
      '..#######.',
      '..######..',
      '...####...',
      '...###....',
    ],
  },
  {
    id: 'meridiana',
    name: 'Meridiana',
    bonus: 2,
    accent: '#6F8C57',
    origin: { col: 5, row: 14 },
    territories: ['Talcora', 'Velmora', 'Yrrena', 'Zalvar'],
    art: [
      '..#####..',
      '.#######.',
      '.######..',
      '..#####..',
      '..####...',
      '...###...',
      '...##....',
    ],
  },
  {
    id: 'ysmar',
    name: 'Ysmar',
    bonus: 2,
    accent: '#7E8AA6',
    origin: { col: 36, row: 17 },
    territories: ['Halvin', 'Inuska', 'Jaraq', 'Kolmen'],
    art: [
      '..####..',
      '.######.',
      '.######.',
      '..####..',
    ],
  },
];

/**
 * Rotte marittime: collegamenti espliciti fra territori costieri di
 * macro-regioni diverse. Riproducono le strozzature classiche del tabellone
 * (il ponte fra i due continenti occidentali, i due passaggi fra la regione
 * centrale e quella meridionale, l'isolamento relativo dell'arcipelago).
 */
export const SEA_ROUTES = [
  ['valdoria', 'belgora'],    // rotta polare: Aurelia -> Norvenda
  ['tarvena', 'quassar'],     // Aurelia   -> Sarmenia
  ['calvera', 'talcora'],     // Aurelia   -> Meridiana
  ['yrrena', 'ephira'],       // Meridiana -> Kethra
  ['sulmera', 'cendra'],      // Sarmenia  -> Kethra (passaggio occidentale)
  ['umbrasi', 'baltora'],     // Sarmenia  -> Kethra (passaggio orientale)
  ['pirenne', 'ezimar'],      // Sarmenia  -> Norvenda
  ['rovinal', 'lemska'],      // Sarmenia  -> Norvenda
  ['dusmar', 'lemska'],       // Kethra    -> Norvenda
  ['myrrad', 'halvin'],       // Norvenda  -> Ysmar
  ['myrrad', 'inuska'],       // Norvenda  -> Ysmar
];
