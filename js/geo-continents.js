// js/geo-continents.js
'use strict';

// Table de correspondance code pays ISO 3166-1 alpha-2 → continent.
// Couvre les codes usuels ; un code absent de la table retourne null
// (l'usager correspondant tombe alors dans le groupe "Non localisés" du
// panneau de la carte, même s'il a des coordonnées).
var CONTINENT_BY_COUNTRY_CODE = {
  // Europe
  AD: 'Europe', AL: 'Europe', AT: 'Europe', BA: 'Europe', BE: 'Europe', BG: 'Europe',
  BY: 'Europe', CH: 'Europe', CY: 'Europe', CZ: 'Europe', DE: 'Europe', DK: 'Europe',
  EE: 'Europe', ES: 'Europe', FI: 'Europe', FO: 'Europe', FR: 'Europe', GB: 'Europe',
  GG: 'Europe', GI: 'Europe', GR: 'Europe', HR: 'Europe', HU: 'Europe', IE: 'Europe',
  IM: 'Europe', IS: 'Europe', IT: 'Europe', JE: 'Europe', LI: 'Europe', LT: 'Europe',
  LU: 'Europe', LV: 'Europe', MC: 'Europe', MD: 'Europe', ME: 'Europe', MK: 'Europe',
  MT: 'Europe', NL: 'Europe', NO: 'Europe', PL: 'Europe', PT: 'Europe', RO: 'Europe',
  RS: 'Europe', RU: 'Europe', SE: 'Europe', SI: 'Europe', SK: 'Europe', SM: 'Europe',
  UA: 'Europe', VA: 'Europe', XK: 'Europe',
  // Amérique
  AG: 'Amérique', AI: 'Amérique', AR: 'Amérique', AW: 'Amérique', BB: 'Amérique',
  BL: 'Amérique', BM: 'Amérique', BO: 'Amérique', BQ: 'Amérique', BR: 'Amérique',
  BS: 'Amérique', BZ: 'Amérique', CA: 'Amérique', CL: 'Amérique', CO: 'Amérique',
  CR: 'Amérique', CU: 'Amérique', CW: 'Amérique', DM: 'Amérique', DO: 'Amérique',
  EC: 'Amérique', FK: 'Amérique', GD: 'Amérique', GF: 'Amérique', GL: 'Amérique',
  GP: 'Amérique', GT: 'Amérique', GY: 'Amérique', HN: 'Amérique', HT: 'Amérique',
  JM: 'Amérique', KN: 'Amérique', KY: 'Amérique', LC: 'Amérique', MF: 'Amérique',
  MQ: 'Amérique', MS: 'Amérique', MX: 'Amérique', NI: 'Amérique', PA: 'Amérique',
  PE: 'Amérique', PM: 'Amérique', PR: 'Amérique', PY: 'Amérique', SR: 'Amérique',
  SV: 'Amérique', SX: 'Amérique', TC: 'Amérique', TT: 'Amérique', US: 'Amérique',
  UY: 'Amérique', VC: 'Amérique', VE: 'Amérique', VG: 'Amérique', VI: 'Amérique',
  // Afrique
  AO: 'Afrique', BF: 'Afrique', BI: 'Afrique', BJ: 'Afrique', BW: 'Afrique',
  CD: 'Afrique', CF: 'Afrique', CG: 'Afrique', CI: 'Afrique', CM: 'Afrique',
  CV: 'Afrique', DJ: 'Afrique', DZ: 'Afrique', EG: 'Afrique', EH: 'Afrique',
  ER: 'Afrique', ET: 'Afrique', GA: 'Afrique', GH: 'Afrique', GM: 'Afrique',
  GN: 'Afrique', GQ: 'Afrique', GW: 'Afrique', KE: 'Afrique', KM: 'Afrique',
  LR: 'Afrique', LS: 'Afrique', LY: 'Afrique', MA: 'Afrique', MG: 'Afrique',
  ML: 'Afrique', MR: 'Afrique', MU: 'Afrique', MW: 'Afrique', MZ: 'Afrique',
  NA: 'Afrique', NE: 'Afrique', NG: 'Afrique', RE: 'Afrique', RW: 'Afrique',
  SC: 'Afrique', SD: 'Afrique', SH: 'Afrique', SL: 'Afrique', SN: 'Afrique',
  SO: 'Afrique', SS: 'Afrique', ST: 'Afrique', SZ: 'Afrique', TD: 'Afrique',
  TG: 'Afrique', TN: 'Afrique', TZ: 'Afrique', UG: 'Afrique', YT: 'Afrique',
  ZA: 'Afrique', ZM: 'Afrique', ZW: 'Afrique',
  // Asie
  AE: 'Asie', AF: 'Asie', AM: 'Asie', AZ: 'Asie', BD: 'Asie', BH: 'Asie',
  BN: 'Asie', BT: 'Asie', CN: 'Asie', GE: 'Asie', HK: 'Asie', ID: 'Asie',
  IL: 'Asie', IN: 'Asie', IQ: 'Asie', IR: 'Asie', JO: 'Asie', JP: 'Asie',
  KG: 'Asie', KH: 'Asie', KP: 'Asie', KR: 'Asie', KW: 'Asie', KZ: 'Asie',
  LA: 'Asie', LB: 'Asie', LK: 'Asie', MM: 'Asie', MN: 'Asie', MO: 'Asie',
  MV: 'Asie', MY: 'Asie', NP: 'Asie', OM: 'Asie', PH: 'Asie', PK: 'Asie',
  PS: 'Asie', QA: 'Asie', SA: 'Asie', SG: 'Asie', SY: 'Asie', TH: 'Asie',
  TJ: 'Asie', TL: 'Asie', TM: 'Asie', TR: 'Asie', TW: 'Asie', UZ: 'Asie',
  VN: 'Asie', YE: 'Asie',
  // Océanie
  AS: 'Océanie', AU: 'Océanie', CK: 'Océanie', FJ: 'Océanie', FM: 'Océanie',
  GU: 'Océanie', KI: 'Océanie', MH: 'Océanie', MP: 'Océanie', NC: 'Océanie',
  NF: 'Océanie', NR: 'Océanie', NU: 'Océanie', NZ: 'Océanie', PF: 'Océanie',
  PG: 'Océanie', PN: 'Océanie', PW: 'Océanie', SB: 'Océanie', TO: 'Océanie',
  TV: 'Océanie', VU: 'Océanie', WF: 'Océanie', WS: 'Océanie',
  // Antarctique
  AQ: 'Antarctique', BV: 'Antarctique', GS: 'Antarctique', HM: 'Antarctique', TF: 'Antarctique',
};

/**
 * Code pays ISO 3166-1 alpha-2 (insensible à la casse) → continent.
 * Retourne null si le code est absent/vide/non reconnu.
 */
function countryCodeToContinent(countryCode) {
  var code = String(countryCode || '').trim().toUpperCase();
  return CONTINENT_BY_COUNTRY_CODE[code] || null;
}

if (typeof module !== 'undefined') {
  module.exports = { CONTINENT_BY_COUNTRY_CODE: CONTINENT_BY_COUNTRY_CODE, countryCodeToContinent: countryCodeToContinent };
}
