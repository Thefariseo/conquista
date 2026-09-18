/**
 * Configurazione dell'atlante di VHALDOR — mondo interamente originale.
 *
 * Ogni macro-regione è disegnata come una silhouette ASCII su un reticolo
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
    origin: { col: 2, row: 1 },
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
    id: 'norvenda',
    name: 'Norvenda',
    bonus: 7,
    accent: '#5E7C8A',
    origin: { col: 26, row: 0 },
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
    id: 'sarmenia',
    name: 'Sarmenia',
    bonus: 3,
    accent: '#9A6B7B',
    origin: { col: 33, row: 12 },
    territories: ['Nadira', 'Olvenna', 'Pirenne', 'Quassar', 'Rovinal', 'Sulmera'],
    art: [
      '...#####..',
      '..#######.',
      '.########.',
      '.########.',
      '..######..',
      '...####...',
    ],
  },
  {
    id: 'meridiana',
    name: 'Meridiana',
    bonus: 4,
    accent: '#6F8C57',
    origin: { col: 5, row: 15 },
    territories: ['Talcora', 'Umbrasi', 'Velmora', 'Xanto', 'Yrrena', 'Zalvar', 'Adunis'],
    art: [
      '...#####...',
      '..#######..',
      '.########..',
      '.#######...',
      '..######...',
      '..######...',
      '...####....',
      '...###.....',
      '....##.....',
    ],
  },
  {
    id: 'ysmar',
    name: 'Ysmar',
    bonus: 2,
    accent: '#7E8AA6',
    origin: { col: 37, row: 22 },
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
 * macro-regioni diverse. Vengono disegnate come linee tratteggiate.
 */
export const SEA_ROUTES = [
  ['numira', 'talcora'],      // Aurelia  -> Meridiana
  ['brantera', 'arkhald'],    // Aurelia  -> Norvenda
  ['zalvar', 'baltora'],      // Meridiana -> Kethra
  ['garrun', 'pirenne'],      // Kethra   -> Sarmenia
  ['myrrad', 'cendra'],       // Norvenda -> Kethra
  ['lemska', 'nadira'],       // Norvenda -> Sarmenia
  ['sulmera', 'halvin'],      // Sarmenia -> Ysmar
  ['rovinal', 'inuska'],      // Sarmenia -> Ysmar
];
