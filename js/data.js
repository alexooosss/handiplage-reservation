'use strict';

// Positions x des centres des 14 colonnes (px)
// 4 sections séparées par 3 tapis PMR verticaux
const _COL_X = [20, 58, 96, 134,    // section 1 (cols 1-4)
                176, 214, 252, 290,  // section 2 (cols 5-8)
                332, 370, 408, 446,  // section 3 (cols 9-12)
                488, 526];           // section 4 (cols 13-14)

// Positions y des centres des 4 rangées (px)
const _ROW_Y = [20, 98, 176, 254];

// Positions des tapis PMR (en px dans la beach-map)
const TAPIS_V = [
  { x: 150, label: 'Allée A' },
  { x: 308, label: 'Allée B' },
  { x: 464, label: 'Allée C' },
];

const TAPIS_H = [
  { y: 54,  label: 'Allée 1-2' },
  { y: 132, label: 'Allée 2-3' },
  { y: 210, label: 'Allée 3-4' },
];

// Positions des douches sur la carte
const SHOWERS = [
  { x: 148, y: 125, label: 'Douche 1' },
  { x: 306, y: 125, label: 'Douche 2' },
];

// Génère les 55 spots : P1–P55
function _generateSpots() {
  const spots = [];
  let id = 1;
  const rowCounts = [14, 14, 14, 13]; // row 4 has 13 spots
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < rowCounts[row]; col++) {
      spots.push({
        id:    `P${id}`,
        label: `Place ${id}`,
        row:   row + 1,
        col:   col + 1,
        x:     _COL_X[col],
        y:     _ROW_Y[row],
      });
      id++;
    }
  }
  return spots; // 14+14+14+13 = 55
}

const BEACH_CONFIG = {
  mapWidth:  560,
  mapHeight: 294,
  spotSize:  34,
  spots:     _generateSpots(),
  tapisV:    TAPIS_V,
  tapisH:    TAPIS_H,
  showers:   SHOWERS,
};

if (typeof module !== 'undefined') {
  module.exports = { BEACH_CONFIG };
}
