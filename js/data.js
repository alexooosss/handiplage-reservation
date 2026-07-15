'use strict';

const BEACH_SPOTS = [
  // Ligne de fond (haut) — 14 spots à y=30
  { id:'P1',  label:'Place 1',  x:40,  y:30 },
  { id:'P2',  label:'Place 2',  x:90,  y:30 },
  { id:'P3',  label:'Place 3',  x:140, y:30 },
  { id:'P4',  label:'Place 4',  x:210, y:30 },
  { id:'P5',  label:'Place 5',  x:260, y:30 },
  { id:'P6',  label:'Place 6',  x:310, y:30 },
  { id:'P7',  label:'Place 7',  x:380, y:30 },
  { id:'P8',  label:'Place 8',  x:430, y:30 },
  { id:'P9',  label:'Place 9',  x:480, y:30 },
  { id:'P10', label:'Place 10', x:550, y:30 },
  { id:'P11', label:'Place 11', x:600, y:30 },
  { id:'P12', label:'Place 12', x:650, y:30 },
  { id:'P13', label:'Place 13', x:700, y:30 },
  { id:'P14', label:'Place 14', x:750, y:30 },
  // Carré 1 (3×3 = 9 spots)
  { id:'P15', label:'Place 15', x:40,  y:100 },
  { id:'P16', label:'Place 16', x:90,  y:100 },
  { id:'P17', label:'Place 17', x:140, y:100 },
  { id:'P18', label:'Place 18', x:40,  y:150 },
  { id:'P19', label:'Place 19', x:90,  y:150 },
  { id:'P20', label:'Place 20', x:140, y:150 },
  { id:'P21', label:'Place 21', x:40,  y:200 },
  { id:'P22', label:'Place 22', x:90,  y:200 },
  { id:'P23', label:'Place 23', x:140, y:200 },
  // Carré 2 (staggered : 3+2+3 = 8 spots)
  { id:'P24', label:'Place 24', x:210, y:100 },
  { id:'P25', label:'Place 25', x:210, y:150 },
  { id:'P26', label:'Place 26', x:210, y:200 },
  { id:'P27', label:'Place 27', x:260, y:125 },
  { id:'P28', label:'Place 28', x:260, y:175 },
  { id:'P29', label:'Place 29', x:310, y:100 },
  { id:'P30', label:'Place 30', x:310, y:150 },
  { id:'P31', label:'Place 31', x:310, y:200 },
  // Carré 3 (staggered : 3+2+3 = 8 spots)
  { id:'P32', label:'Place 32', x:380, y:100 },
  { id:'P33', label:'Place 33', x:380, y:150 },
  { id:'P34', label:'Place 34', x:380, y:200 },
  { id:'P35', label:'Place 35', x:430, y:125 },
  { id:'P36', label:'Place 36', x:430, y:175 },
  { id:'P37', label:'Place 37', x:480, y:100 },
  { id:'P38', label:'Place 38', x:480, y:150 },
  { id:'P39', label:'Place 39', x:480, y:200 },
  // Carré 4 (5×3 = 15 spots)
  { id:'P40', label:'Place 40', x:550, y:100 },
  { id:'P41', label:'Place 41', x:600, y:100 },
  { id:'P42', label:'Place 42', x:650, y:100 },
  { id:'P43', label:'Place 43', x:700, y:100 },
  { id:'P44', label:'Place 44', x:750, y:100 },
  { id:'P45', label:'Place 45', x:550, y:150 },
  { id:'P46', label:'Place 46', x:600, y:150 },
  { id:'P47', label:'Place 47', x:650, y:150 },
  { id:'P48', label:'Place 48', x:700, y:150 },
  { id:'P49', label:'Place 49', x:750, y:150 },
  { id:'P50', label:'Place 50', x:550, y:200 },
  { id:'P51', label:'Place 51', x:600, y:200 },
  { id:'P52', label:'Place 52', x:650, y:200 },
  { id:'P53', label:'Place 53', x:700, y:200 },
  { id:'P54', label:'Place 54', x:750, y:200 },
];

// Tapis PMR horizontaux (pleine largeur)
const TAPIS_H = [
  { y: 56,  x: 30, width: 750, label: 'Allée fond' },
  { y: 232, x: 130, width: 650, label: 'Allée avant' },
];

// Tapis PMR verticaux (croisent les tapis horizontaux aux deux extrémités)
const TAPIS_V = [
  { x: 169, top: 19, height: 257, label: 'Allée 1-2' },
  { x: 339, top: 19, height: 277, label: 'Allée 2-3' },
  { x: 509, top: 19, height: 277, label: 'Allée 3-4' },
];

// Barrières blanches : type 'h' = horizontale (x, y, width) | type 'v' = verticale (x, y, height)
const BARRIERS = [
  { type: 'h', x: 0, y: -20, width: 780, label: 'Barrière haut' },
  { type: 'v', x: 0, y: -20, height: 290, label: 'Barrière gauche' },
  { type: 'v', x: 780, y: -20, height: 30, label: 'Barrière droite' },

];

const BEACH_SHOWERS = [
  { x: 196, y: 260, label: 'Douche 1' },
  { x: 366, y: 260, label: 'Douche 2' },
  { x: 536, y: 260, label: 'Douche 3' },
];

// Zone rocheuse — 5 points définissent le contour du clipPath SVG
const ROCKS = {
  points: [
    {id:'A', x:650, y:357},
    {id:'B', x:765, y:357},
    {id:'C', x:785, y:449},
    {id:'D', x:660, y:449},
    {id:'E', x:620, y:400},
  ],
};

// Bâtiment — 9 points configurables (polygone SVG)
const BATIMENT = {
  points: [
    {id:'A', x:820, y:200},
    {id:'A', x:827, y:140},
    {id:'B', x:850, y:70},
    {id:'C', x:860, y:60},
    {id:'J', x:940, y:60},
    {id:'D', x:960, y:140},
    {id:'E', x:880, y:140},
    {id:'F', x:862, y:202},
    {id:'G', x:920, y:202},
    {id:'H', x:865, y:405},
    {id:'I', x:825, y:422},

  ],
};

// Tapis PMR diagonal (4 coins du parallelogramme)
const TAPIS_PMR = {
  points: [[740,246],[765,246],[650,350],[640,335]],
  label: 'Tapis diagonal PMR',
};

// Rampe métallique vers la mer (continue là où le tapis s'arrête)
const RAMPE_METAL = {
  points: [[640,335],[650,350],[585,415],[564,410]],
  label: 'Rampe métal',
};

const BEACH_CONFIG = {
  mapWidth:   780,
  mapHeight:  340,
  spotSize:   34,
  spots:      BEACH_SPOTS,
  tapisV:     TAPIS_V,
  tapisH:     TAPIS_H,
  showers:    BEACH_SHOWERS,
  barriers:   BARRIERS,
  rocks:      ROCKS,
  batiment:   BATIMENT,
  tapisPMR:   TAPIS_PMR,
  rampeMetal: RAMPE_METAL,
};

// Capacités maximales par créneau dans le planning
const CAPACITY_NORMAL = 25; // usagers individuels
const CAPACITY_GROUPE = 10; // groupes

if (typeof module !== 'undefined') {
  module.exports = { BEACH_CONFIG, CAPACITY_NORMAL, CAPACITY_GROUPE };
}
