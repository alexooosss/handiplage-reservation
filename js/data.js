'use strict';

// 54 spots : 4 carrés + ligne de fond
// Carrés 2 et 3 : colonne centrale décalée en biais
const BEACH_SPOTS = [
  // Carré 1 (3×3 = 9 spots)
  { id:'P1',  label:'Place 1',  x:40,  y:40  },
  { id:'P2',  label:'Place 2',  x:90,  y:40  },
  { id:'P3',  label:'Place 3',  x:140, y:40  },
  { id:'P4',  label:'Place 4',  x:40,  y:90  },
  { id:'P5',  label:'Place 5',  x:90,  y:90  },
  { id:'P6',  label:'Place 6',  x:140, y:90  },
  { id:'P7',  label:'Place 7',  x:40,  y:140 },
  { id:'P8',  label:'Place 8',  x:90,  y:140 },
  { id:'P9',  label:'Place 9',  x:140, y:140 },
  // Carré 2 (staggered : 3+2+3 = 8 spots)
  { id:'P10', label:'Place 10', x:210, y:40  },
  { id:'P11', label:'Place 11', x:210, y:90  },
  { id:'P12', label:'Place 12', x:210, y:140 },
  { id:'P13', label:'Place 13', x:260, y:65  },
  { id:'P14', label:'Place 14', x:260, y:115 },
  { id:'P15', label:'Place 15', x:310, y:40  },
  { id:'P16', label:'Place 16', x:310, y:90  },
  { id:'P17', label:'Place 17', x:310, y:140 },
  // Carré 3 (staggered : 3+2+3 = 8 spots)
  { id:'P18', label:'Place 18', x:380, y:40  },
  { id:'P19', label:'Place 19', x:380, y:90  },
  { id:'P20', label:'Place 20', x:380, y:140 },
  { id:'P21', label:'Place 21', x:430, y:65  },
  { id:'P22', label:'Place 22', x:430, y:115 },
  { id:'P23', label:'Place 23', x:480, y:40  },
  { id:'P24', label:'Place 24', x:480, y:90  },
  { id:'P25', label:'Place 25', x:480, y:140 },
  // Carré 4 (5×3 = 15 spots)
  { id:'P26', label:'Place 26', x:550, y:40  },
  { id:'P27', label:'Place 27', x:600, y:40  },
  { id:'P28', label:'Place 28', x:650, y:40  },
  { id:'P29', label:'Place 29', x:700, y:40  },
  { id:'P30', label:'Place 30', x:750, y:40  },
  { id:'P31', label:'Place 31', x:550, y:90  },
  { id:'P32', label:'Place 32', x:600, y:90  },
  { id:'P33', label:'Place 33', x:650, y:90  },
  { id:'P34', label:'Place 34', x:700, y:90  },
  { id:'P35', label:'Place 35', x:750, y:90  },
  { id:'P36', label:'Place 36', x:550, y:140 },
  { id:'P37', label:'Place 37', x:600, y:140 },
  { id:'P38', label:'Place 38', x:650, y:140 },
  { id:'P39', label:'Place 39', x:700, y:140 },
  { id:'P40', label:'Place 40', x:750, y:140 },
  // Ligne de fond (14 spots, y=210)
  { id:'P41', label:'Place 41', x:40,  y:210 },
  { id:'P42', label:'Place 42', x:90,  y:210 },
  { id:'P43', label:'Place 43', x:140, y:210 },
  { id:'P44', label:'Place 44', x:210, y:210 },
  { id:'P45', label:'Place 45', x:260, y:210 },
  { id:'P46', label:'Place 46', x:310, y:210 },
  { id:'P47', label:'Place 47', x:380, y:210 },
  { id:'P48', label:'Place 48', x:430, y:210 },
  { id:'P49', label:'Place 49', x:480, y:210 },
  { id:'P50', label:'Place 50', x:550, y:210 },
  { id:'P51', label:'Place 51', x:600, y:210 },
  { id:'P52', label:'Place 52', x:650, y:210 },
  { id:'P53', label:'Place 53', x:700, y:210 },
  { id:'P54', label:'Place 54', x:750, y:210 },
];

const BEACH_CONFIG = {
  mapWidth:  780,
  mapHeight: 240,
  spotSize:  34,
  spots:     BEACH_SPOTS,
  tapisV:    [], // supprimés — allées visuelles par espacement
  tapisH:    [],
  showers:   [],
};

if (typeof module !== 'undefined') {
  module.exports = { BEACH_CONFIG };
}
