# Filtres géographiques + panneau usagers sur la carte — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Étendre la carte des usagers (`js/usagers-map.js`) avec un géocodage international, une dérivation continent/région, et un panneau de droite à 4 filtres en cascade (Continent → Pays → Région → Ville) synchronisé avec le globe.

**Architecture:** Deux modules de données étendus (`js/supabase-geo.js` géocode aussi via Nominatim hors France ; nouveau `js/geo-continents.js` fait code pays → continent), une petite extension de l'API publique de `js/globe.js` (`focusOnMarker`), et 3 fonctions pures nouvelles dans `js/usagers-map.js` (séparation géolocalisés/non-localisés, calcul des options de filtre en cascade, filtrage) pilotant un nouveau panneau DOM.

**Tech Stack:** Vanilla JS, Supabase, API BAN (France, existant), API Nominatim/OpenStreetMap (nouveau, hors France), Node `assert` pour les tests (`tests/run-all.js`).

**Reference spec:** `docs/superpowers/specs/2026-10-02-carte-usagers-filtres-design.md`

---

## Conventions à respecter (lire avant de commencer)

- Seules les fonctions **pures et synchrones** sont testées unitairement dans cette codebase (mappers, calculateurs). Les wrappers async qui appellent Supabase/une API externe ne le sont pas, sauf quand ils acceptent déjà une injection `fetchImpl`/`updateFn` (c'est le cas de `geocodeInscriptions`, qui a déjà des tests — on les étend).
- `tests/run-all.js` liste chaque fichier de test explicitement — tout nouveau fichier doit y être ajouté.
- Les fichiers `.js` sont chargés via de simples balises `<script>` (pas de bundler) — l'ordre de chargement dans `index.html` compte pour toute fonction globale utilisée au chargement d'une autre.

---

### Task 1: `js/geo-continents.js` — table code pays → continent

**Files:**
- Create: `js/geo-continents.js`
- Create: `tests/test-geo-continents.js`
- Modify: `tests/run-all.js`

- [ ] **Step 1: Write the failing test**

Create `tests/test-geo-continents.js` :

```js
// tests/test-geo-continents.js
'use strict';
const assert = require('assert');
const { countryCodeToContinent } = require('../js/geo-continents.js');

assert.strictEqual(countryCodeToContinent('FR'), 'Europe', 'France → Europe');
assert.strictEqual(countryCodeToContinent('fr'), 'Europe', 'insensible à la casse');
assert.strictEqual(countryCodeToContinent('US'), 'Amérique', 'États-Unis → Amérique');
assert.strictEqual(countryCodeToContinent('MA'), 'Afrique', 'Maroc → Afrique');
assert.strictEqual(countryCodeToContinent('JP'), 'Asie', 'Japon → Asie');
assert.strictEqual(countryCodeToContinent('AU'), 'Océanie', 'Australie → Océanie');
assert.strictEqual(countryCodeToContinent('ZZ'), null, 'code inconnu → null');
assert.strictEqual(countryCodeToContinent(null), null, 'null → null');
assert.strictEqual(countryCodeToContinent(''), null, 'vide → null');
assert.strictEqual(countryCodeToContinent('  it  '), 'Europe', 'espaces ignorés');

console.log('✓ test-geo-continents.js OK');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/test-geo-continents.js`
Expected: `Error: Cannot find module '../js/geo-continents.js'`

- [ ] **Step 3: Create `js/geo-continents.js`**

```js
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/test-geo-continents.js`
Expected: `✓ test-geo-continents.js OK`

- [ ] **Step 5: Register the test in `tests/run-all.js`**

Read the current `tests` array in `tests/run-all.js` and append `'test-geo-continents.js'` to it (keep every existing entry).

- [ ] **Step 6: Run the full suite**

Run: `node tests/run-all.js`
Expected: `✅ Tous les tests passent.`

- [ ] **Step 7: Commit**

```bash
git add js/geo-continents.js tests/test-geo-continents.js tests/run-all.js
git commit -m "feat(geo): table code pays → continent"
```

---

### Task 2: Géocodage international dans `js/supabase-geo.js`

**Files:**
- Modify: `js/supabase-geo.js`
- Modify: `tests/test-supabase-geo.js`

**Important — lire avant de commencer :** `geocodeInscriptions` a aujourd'hui un raccourci : si `insc.geoLat`/`insc.geoLng` sont déjà des nombres, elle les considère "déjà géocodés" et ne fait rien (pas d'appel réseau, pas d'update). Mais après cette tâche, les usagers déjà géocodés AVANT cette fonctionnalité (donc forcément via l'API BAN, seule utilisée jusqu'ici) n'ont ni `continent`, ni `countryCode` en metadata. Il faut un **backfill silencieux** (pas de nouvel appel réseau — on sait que c'était forcément la France) : si `geoLat`/`geoLng` existent mais `continent` est absent, on complète `continent: 'Europe'` et `countryCode: 'FR'` et on réécrit la metadata, sans retélécharger quoi que ce soit. Sans ce backfill, tous les usagers déjà géolocalisés avant ce déploiement disparaîtraient dans le groupe "Non localisés" du nouveau panneau (régression silencieuse). Ce comportement casse délibérément le test existant n°1 (qui suppose qu'un usager déjà géocodé ne déclenche jamais `updateFn`) — ce test doit être **modifié**, pas juste complété (voir Step 1 ci-dessous, qui donne le nouveau contenu complet des tests à ajouter/modifier).

- [ ] **Step 1: Modifier le test existant n°1 et ajouter les nouveaux tests**

Dans `tests/test-supabase-geo.js`, repérer le premier bloc du groupe `// ── geocodeInscriptions ──` (commentaire `// Déjà géocodé → pas d'appel réseau, pas d'update`) et le remplacer entièrement par :

```js
  // Déjà géocodé ET continent déjà renseigné → pas d'appel réseau, pas d'update
  {
    let fetchCalls = 0;
    const insc = { id: '1', ville: 'Antibes', geoLat: 43.58, geoLng: 7.12, continent: 'Europe', countryCode: 'FR' };
    const out = await geocodeInscriptions([insc], {
      delayMs: 0,
      fetchImpl: async () => { fetchCalls++; return { ok: true, json: async () => ({}) }; },
      updateFn: async () => { throw new Error('ne doit pas être appelé'); },
    });
    assert.strictEqual(fetchCalls, 0);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].geoLat, 43.58);
  }

  // Déjà géocodé mais continent ABSENT (ancien format, géocodé avant cette
  // fonctionnalité — forcément via BAN/France) → backfill silencieux, sans
  // appel réseau, mais avec un update pour persister continent/countryCode
  {
    let fetchCalls = 0;
    let updateArgs = null;
    const insc = { id: '7', ville: 'Antibes', geoLat: 43.58, geoLng: 7.12 };
    const out = await geocodeInscriptions([insc], {
      delayMs: 0,
      fetchImpl: async () => { fetchCalls++; return { ok: true, json: async () => ({}) }; },
      updateFn: async (id, partial) => { updateArgs = [id, partial]; },
    });
    assert.strictEqual(fetchCalls, 0, 'backfill = aucun appel réseau');
    assert.strictEqual(out[0].continent, 'Europe');
    assert.strictEqual(out[0].countryCode, 'FR');
    assert.strictEqual(updateArgs[0], '7');
    assert.strictEqual(updateArgs[1].metadata.continent, 'Europe');
  }
```

Puis, juste avant la ligne `console.log('✓ supabase-geo.js — tous les tests passent');`, ajouter :

```js
  // Géocodage France (BAN) : region extraite du champ "context" de la réponse
  {
    const insc = { id: '10', ville: 'Antibes', codePostal: '06600', pays: 'France' };
    const out = await geocodeInscriptions([insc], {
      delayMs: 0,
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ features: [{
          geometry: { coordinates: [7.1256, 43.5808] },
          properties: { context: "06, Alpes-Maritimes, Provence-Alpes-Côte d'Azur" },
        }] }),
      }),
      updateFn: async () => {},
    });
    assert.strictEqual(out[0].continent, 'Europe');
    assert.strictEqual(out[0].countryCode, 'FR');
    assert.strictEqual(out[0].region, "Provence-Alpes-Côte d'Azur");
  }

  // Hors France → utilise Nominatim, dérive le continent via countryCodeToContinent injecté
  {
    const insc = { id: '8', nom: 'Smith', ville: 'Londres', pays: 'Royaume-Uni' };
    let calledUrl = null;
    const out = await geocodeInscriptions([insc], {
      delayMs: 0,
      nominatimDelayMs: 0,
      countryCodeToContinent: (cc) => (cc === 'GB' ? 'Europe' : null),
      fetchImpl: async (url) => {
        calledUrl = url;
        return { ok: true, json: async () => ([{ lat: '51.5074', lon: '-0.1278', address: { country_code: 'gb' } }]) };
      },
      updateFn: async () => {},
    });
    assert.ok(calledUrl.includes('nominatim.openstreetmap.org'), 'URL Nominatim utilisée');
    assert.ok(calledUrl.includes('Londres'), 'ville incluse dans la requête');
    assert.strictEqual(out[0].geoLat, 51.5074);
    assert.strictEqual(out[0].geoLng, -0.1278);
    assert.strictEqual(out[0].continent, 'Europe');
    assert.strictEqual(out[0].countryCode, 'GB', 'country_code normalisé en majuscules');
    assert.strictEqual(out[0].region, null, 'pas de région hors France');
  }

  // Nominatim : aucun résultat → ignoré, pas planté
  {
    const insc = { id: '9', ville: 'Villeimaginaire', pays: 'Narnia' };
    const out = await geocodeInscriptions([insc], {
      delayMs: 0, nominatimDelayMs: 0,
      fetchImpl: async () => ({ ok: true, json: async () => ([]) }),
    });
    assert.strictEqual(out.length, 0);
  }

  // ── extractRegionFromBanContext ──
  assert.strictEqual(extractRegionFromBanContext("06, Alpes-Maritimes, Provence-Alpes-Côte d'Azur"), "Provence-Alpes-Côte d'Azur");
  assert.strictEqual(extractRegionFromBanContext(null), null);
  assert.strictEqual(extractRegionFromBanContext(''), null);
  assert.strictEqual(extractRegionFromBanContext('UnSeulSegment'), 'UnSeulSegment');

  // ── buildNominatimQuery ──
  assert.strictEqual(buildNominatimQuery('', 'Londres', 'Royaume-Uni'), 'Londres Royaume-Uni');
  assert.strictEqual(buildNominatimQuery('SW1A', 'Londres', 'Royaume-Uni'), 'Londres SW1A Royaume-Uni');
  assert.strictEqual(buildNominatimQuery('', '', ''), null);
```

Et mettre à jour l'import en haut du fichier pour inclure les deux nouvelles fonctions :

```js
const {
  needsGeocoding,
  buildGeocodeQuery,
  buildNominatimQuery,
  extractRegionFromBanContext,
  jitterOffset,
  _stripToMetadata,
  geocodeInscriptions,
} = require('../js/supabase-geo.js');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/test-supabase-geo.js`
Expected: FAIL — `buildNominatimQuery is not a function` (n'existe pas encore).

- [ ] **Step 3: Implement**

Remplacer le contenu complet de `js/supabase-geo.js` par :

```js
// js/supabase-geo.js
'use strict';

// Colonnes structurées de `inscriptions` — ne vont jamais dans metadata
// (même liste que STRUCTURED_COLS dans supabase-inscriptions.js)
var GEO_STRUCTURED_COLS = ['id', 'nom', 'prenom', 'mail', 'telephone', 'statut', 'pass', 'createdAt', 'updatedAt'];

function _stripToMetadata(insc) {
  var meta = Object.assign({}, insc);
  GEO_STRUCTURED_COLS.forEach(function(k) { delete meta[k]; });
  return meta;
}

// true si l'inscription a de quoi être géocodée mais ne l'est pas encore
function needsGeocoding(insc) {
  if (!insc) return false;
  if (typeof insc.geoLat === 'number' && typeof insc.geoLng === 'number') return false;
  return !!(insc.codePostal || insc.ville);
}

function isFrancePays(pays) {
  return !pays || !String(pays).trim() || /^france$/i.test(String(pays).trim());
}

// Construit la requête envoyée à l'API adresse.data.gouv.fr (niveau commune,
// jamais l'adresse précise). Retourne null si rien d'exploitable, ou si le
// pays n'est pas la France (l'API BAN ne couvre que la France — ces cas
// passent par buildNominatimQuery / l'API Nominatim).
function buildGeocodeQuery(codePostal, ville, pays) {
  if (!isFrancePays(pays)) return null;
  var parts = [codePostal, ville]
    .map(function(p) { return (p || '').toString().trim(); })
    .filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

// Construit la requête envoyée à Nominatim (OpenStreetMap) pour les adresses
// hors France — couverture mondiale, gratuite, sans clé API.
function buildNominatimQuery(codePostal, ville, pays) {
  var parts = [ville, codePostal, pays]
    .map(function(p) { return (p || '').toString().trim(); })
    .filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

// Le champ `context` de l'API BAN (recherche type=municipality) a la forme
// "<code département>, <nom département>, <nom région>" — le dernier segment
// est le nom de la région administrative.
function extractRegionFromBanContext(context) {
  if (!context || typeof context !== 'string') return null;
  var parts = context.split(',').map(function(p) { return p.trim(); }).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

function _hashSeed(str) {
  var h = 5381;
  str = String(str || '');
  for (var i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) & 0xffffffff;
  }
  return h >>> 0;
}

// Décalage déterministe (quelques km max) pour éviter que plusieurs usagers
// d'une même commune se superposent exactement sur le globe.
function jitterOffset(seed) {
  var h = _hashSeed(seed);
  var a = ((h % 2000) / 1000) - 1;         // -1..1
  var b = (((h >>> 11) % 2000) / 1000) - 1; // -1..1
  var MAX_DEG = 0.05; // ~5 km à cette échelle
  return { dLat: a * MAX_DEG, dLng: b * MAX_DEG };
}

async function _geocodeViaBan(insc, fetchImpl) {
  var query = buildGeocodeQuery(insc.codePostal, insc.ville, insc.pays);
  if (!query) return null;
  try {
    var res = await fetchImpl('https://api-adresse.data.gouv.fr/search/?type=municipality&limit=1&q=' + encodeURIComponent(query));
    if (!res || !res.ok) return null;
    var json = await res.json();
    var feature = json && json.features && json.features[0];
    var coords = feature && feature.geometry && feature.geometry.coordinates;
    if (!Array.isArray(coords) || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') return null;
    var context = feature.properties && feature.properties.context;
    return {
      lat: coords[1],
      lng: coords[0],
      continent: 'Europe',
      region: extractRegionFromBanContext(context),
      countryCode: 'FR',
    };
  } catch (e) {
    return null;
  }
}

async function _geocodeViaNominatim(insc, fetchImpl, toContinent) {
  var query = buildNominatimQuery(insc.codePostal, insc.ville, insc.pays);
  if (!query) return null;
  try {
    var res = await fetchImpl('https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=' + encodeURIComponent(query));
    if (!res || !res.ok) return null;
    var json = await res.json();
    var feature = json && json[0];
    if (!feature) return null;
    var lat = parseFloat(feature.lat);
    var lng = parseFloat(feature.lon);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    var countryCode = (feature.address && feature.address.country_code)
      ? String(feature.address.country_code).toUpperCase()
      : null;
    return {
      lat: lat,
      lng: lng,
      continent: toContinent(countryCode),
      region: null,
      countryCode: countryCode,
    };
  } catch (e) {
    return null;
  }
}

// Géocode (niveau commune) les inscriptions qui n'ont pas encore de position,
// met en cache le résultat dans inscriptions.metadata (geoLat/geoLng/continent/
// region/countryCode/geocodedAt) et retourne toutes les inscriptions
// localisées (déjà géocodées + nouvelles). Les échecs individuels (adresse
// non reconnue, réseau indisponible) sont ignorés silencieusement : ils
// seront retentés au prochain appel.
//
// France (pays absent ou === "France") → API BAN. Tout autre pays → Nominatim
// (OpenStreetMap), avec un délai spécifique (nominatimDelayMs, défaut 1100ms)
// pour respecter leur politique d'usage (max 1 req/s).
async function geocodeInscriptions(inscriptions, opts) {
  opts = opts || {};
  var fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  var updateFn  = opts.updateFn  || (typeof updateInscription !== 'undefined' ? updateInscription : null);
  var delayMs   = opts.delayMs !== undefined ? opts.delayMs : 150;
  var nominatimDelayMs = opts.nominatimDelayMs !== undefined ? opts.nominatimDelayMs : 1100;
  var toContinent = opts.countryCodeToContinent
    || (typeof countryCodeToContinent !== 'undefined' ? countryCodeToContinent : function() { return null; });

  var results = [];
  for (var i = 0; i < inscriptions.length; i++) {
    var insc = inscriptions[i];

    if (typeof insc.geoLat === 'number' && typeof insc.geoLng === 'number') {
      // Backfill silencieux pour les lignes géocodées avant cette fonctionnalité
      // (forcément via BAN/France, seule API utilisée jusqu'ici) : pas d'appel
      // réseau, juste compléter continent/countryCode si absents.
      if (!insc.continent) {
        insc.continent   = 'Europe';
        insc.countryCode = insc.countryCode || 'FR';
        if (updateFn) {
          await updateFn(insc.id, { metadata: _stripToMetadata(insc) });
        }
      }
      results.push(insc);
      continue;
    }
    if (!needsGeocoding(insc) || !fetchImpl) continue;

    var france = isFrancePays(insc.pays);
    var geo = france
      ? await _geocodeViaBan(insc, fetchImpl)
      : await _geocodeViaNominatim(insc, fetchImpl, toContinent);

    if (geo) {
      insc.geoLat      = geo.lat;
      insc.geoLng      = geo.lng;
      insc.continent   = geo.continent;
      insc.region      = geo.region;
      insc.countryCode = geo.countryCode;
      insc.geocodedAt  = new Date().toISOString();

      if (updateFn) {
        await updateFn(insc.id, { metadata: _stripToMetadata(insc) });
      }
      results.push(insc);
    }

    if (i < inscriptions.length - 1) {
      var wait = france ? delayMs : nominatimDelayMs;
      if (wait) await new Promise(function(r) { setTimeout(r, wait); });
    }
  }

  return results;
}

if (typeof module !== 'undefined') {
  module.exports = {
    needsGeocoding, buildGeocodeQuery, buildNominatimQuery, extractRegionFromBanContext,
    jitterOffset, _stripToMetadata, geocodeInscriptions,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/test-supabase-geo.js`
Expected: `✓ supabase-geo.js — tous les tests passent`

- [ ] **Step 5: Run the full suite**

Run: `node tests/run-all.js`
Expected: `✅ Tous les tests passent.`

- [ ] **Step 6: Commit**

```bash
git add js/supabase-geo.js tests/test-supabase-geo.js
git commit -m "feat(geo): géocodage international via Nominatim + région/continent"
```

---

### Task 3: `js/globe.js` — exposer `focusOnMarker(marker)`

**Files:**
- Modify: `js/globe.js`

Pas de tests : ce fichier (module ES, Three.js/WebGL) n'a pas d'infrastructure de test dans cette codebase.

- [ ] **Step 1: Ajouter la fonction et l'exposer**

Dans `js/globe.js`, juste avant `return { destroy, setMarkers };` (actuellement la dernière ligne avant la fermeture de `export function create(...)`), ajouter :

```js
  // Centre/zoome le globe sur `marker` et déclenche onMarkerClick comme si
  // l'utilisateur avait cliqué directement sur son point — utilisé par le
  // panneau de filtres (clic sur une ligne de la liste) pour réutiliser
  // exactement la même bulle d'info qu'un clic sur le globe.
  function focusOnMarker(marker) {
    if (!marker) return;
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    focusOn(marker, Math.max(zoom, MAX_ZOOM * 0.9));
    if (onMarkerClick) onMarkerClick(marker, centerX, centerY);
  }

```

Puis modifier la ligne de retour juste en dessous :

```js
  return { destroy, setMarkers, focusOnMarker };
```

- [ ] **Step 2: Vérification statique**

Relire le fichier et confirmer : `focusOn` et `MAX_ZOOM`/`zoom`/`canvas`/`onMarkerClick` sont bien des variables/fonctions déjà déclarées plus haut dans la même fonction `create(...)` (donc dans la portée de `focusOnMarker`) — pas de nouvelle dépendance externe.

- [ ] **Step 3: Commit**

```bash
git add js/globe.js
git commit -m "feat(globe): exposer focusOnMarker() pour le panneau de filtres"
```

---

### Task 4: Fonctions pures de filtrage dans `js/usagers-map.js`

**Files:**
- Modify: `js/usagers-map.js`
- Create: `tests/test-usagers-map.js`
- Modify: `tests/run-all.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/test-usagers-map.js` :

```js
// tests/test-usagers-map.js
'use strict';
const assert = require('assert');
const { splitLocalisables, getFilterOptions, filterInscriptions } = require('../js/usagers-map.js');

// ── splitLocalisables ──
{
  const valid = [
    { id: '1', geoLat: 43.5, geoLng: 7.1, continent: 'Europe' },
    { id: '2', ville: 'Antibes' },           // jamais géocodé
    { id: '3', geoLat: 10, geoLng: 10 },      // géocodé mais continent manquant
  ];
  const { localized, unlocalized } = splitLocalisables(valid);
  assert.strictEqual(localized.length, 1);
  assert.strictEqual(localized[0].id, '1');
  assert.strictEqual(unlocalized.length, 2);
  assert.deepStrictEqual(unlocalized.map(i => i.id), ['2', '3']);
}

// ── getFilterOptions ──
{
  const localized = [
    { id: '1', continent: 'Europe',   pays: 'France',       region: 'PACA',          ville: 'Antibes' },
    { id: '2', continent: 'Europe',   pays: 'France',       region: 'Île-de-France', ville: 'Paris' },
    { id: '3', continent: 'Europe',   pays: 'Italie',       region: null,            ville: 'Milan' },
    { id: '4', continent: 'Amérique', pays: 'États-Unis',   region: null,            ville: 'New York' },
  ];

  let opts = getFilterOptions(localized, {});
  assert.deepStrictEqual(opts.continents, ['Amérique', 'Europe']);
  assert.deepStrictEqual(opts.pays, ['France', 'Italie', 'États-Unis'].sort((a, b) => a.localeCompare(b, 'fr')));

  opts = getFilterOptions(localized, { continent: 'Europe' });
  assert.deepStrictEqual(opts.pays, ['France', 'Italie']);
  assert.deepStrictEqual(opts.regions, ['PACA', 'Île-de-France'].sort((a, b) => a.localeCompare(b, 'fr')));

  opts = getFilterOptions(localized, { continent: 'Europe', pays: 'France' });
  assert.deepStrictEqual(opts.villes, ['Antibes', 'Paris'].sort((a, b) => a.localeCompare(b, 'fr')));
}

// ── filterInscriptions ──
{
  const localized = [
    { id: '1', continent: 'Europe',   pays: 'France',     region: 'PACA',          ville: 'Antibes' },
    { id: '2', continent: 'Europe',   pays: 'France',     region: 'Île-de-France', ville: 'Paris' },
    { id: '3', continent: 'Amérique', pays: 'États-Unis', region: null,            ville: 'New York' },
  ];

  assert.strictEqual(filterInscriptions(localized, {}).length, 3, 'aucun filtre = tout');
  assert.deepStrictEqual(filterInscriptions(localized, { continent: 'Europe' }).map(i => i.id), ['1', '2']);
  assert.deepStrictEqual(
    filterInscriptions(localized, { continent: 'Europe', pays: 'France', ville: 'Paris' }).map(i => i.id),
    ['2']
  );
  assert.strictEqual(
    filterInscriptions(localized, { pays: 'Allemagne' }).length,
    0,
    'filtre sur une valeur absente des données → liste vide'
  );
}

console.log('✓ test-usagers-map.js OK');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/test-usagers-map.js`
Expected: FAIL — `splitLocalisables is not a function` (le fichier n'exporte rien pour l'instant).

- [ ] **Step 3: Implement**

Lire d'abord `js/usagers-map.js` en entier (il doit encore être dans l'état laissé par le projet précédent — fonctions `_esc`, `_s`, `_computeAge`, `_popupHtml`, `destroy`, `render`, puis `return { render: render, destroy: destroy }; })();`).

Ajouter les 4 fonctions suivantes juste après `_popupHtml` (donc avant `destroy`) :

```js
  function _uniqueSorted(values) {
    var seen = {};
    var out = [];
    values.forEach(function(v) {
      if (!v || seen[v]) return;
      seen[v] = true;
      out.push(v);
    });
    out.sort(function(a, b) { return a.localeCompare(b, 'fr'); });
    return out;
  }

  // Sépare les usagers validés en géolocalisés (point possible sur le globe)
  // et non localisés (pas d'adresse, échec de géocodage, ou continent non résolu).
  function splitLocalisables(valid) {
    var localized = [];
    var unlocalized = [];
    valid.forEach(function(i) {
      if (typeof i.geoLat === 'number' && typeof i.geoLng === 'number' && i.continent) {
        localized.push(i);
      } else {
        unlocalized.push(i);
      }
    });
    return { localized: localized, unlocalized: unlocalized };
  }

  // Options disponibles pour chaque niveau de filtre, calculées à partir des
  // sélections des niveaux parents uniquement (continent → pays → région → ville).
  function getFilterOptions(localized, filters) {
    filters = filters || {};
    var afterContinent = filters.continent
      ? localized.filter(function(i) { return i.continent === filters.continent; })
      : localized;
    var afterPays = filters.pays
      ? afterContinent.filter(function(i) { return i.pays === filters.pays; })
      : afterContinent;
    var afterRegion = filters.region
      ? afterPays.filter(function(i) { return i.region === filters.region; })
      : afterPays;

    return {
      continents: _uniqueSorted(localized.map(function(i) { return i.continent; })),
      pays:       _uniqueSorted(afterContinent.map(function(i) { return i.pays; })),
      regions:    _uniqueSorted(afterPays.map(function(i) { return i.region; })),
      villes:     _uniqueSorted(afterRegion.map(function(i) { return i.ville; })),
    };
  }

  // Sous-ensemble des usagers géolocalisés correspondant à tous les filtres actifs.
  function filterInscriptions(localized, filters) {
    filters = filters || {};
    return localized.filter(function(i) {
      if (filters.continent && i.continent !== filters.continent) return false;
      if (filters.pays      && i.pays      !== filters.pays)      return false;
      if (filters.region    && i.region    !== filters.region)    return false;
      if (filters.ville     && i.ville     !== filters.ville)     return false;
      return true;
    });
  }
```

Puis, juste avant la ligne `return { render: render, destroy: destroy };` (dernière ligne de l'IIFE, avant `})();`), ajouter :

```js
  if (typeof module !== 'undefined') {
    module.exports = {
      splitLocalisables: splitLocalisables,
      getFilterOptions: getFilterOptions,
      filterInscriptions: filterInscriptions,
    };
  }

```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/test-usagers-map.js`
Expected: `✓ test-usagers-map.js OK`

- [ ] **Step 5: Register the test in `tests/run-all.js`**

Append `'test-usagers-map.js'` to the `tests` array (keep every existing entry, including `'test-geo-continents.js'` added in Task 1).

- [ ] **Step 6: Run the full suite**

Run: `node tests/run-all.js`
Expected: `✅ Tous les tests passent.`

- [ ] **Step 7: Commit**

```bash
git add js/usagers-map.js tests/test-usagers-map.js tests/run-all.js
git commit -m "feat(carte): fonctions pures de filtrage géographique en cascade"
```

---

### Task 5: Panneau de filtres + liste dans `js/usagers-map.js`

**Files:**
- Modify: `js/usagers-map.js`

Pas de TDD : DOM/rendu, comme le reste de ce fichier (`render`/`destroy` existants n'ont pas de tests).

**Important :** ce fichier change substantiellement. Lire la version actuelle en entier (après Task 4) avant d'éditer — ce step donne le contenu CIBLE complet des parties modifiées, mais il faut vérifier que les ancres (`_popupHtml`, les 4 fonctions pures de Task 4, `destroy`, l'ancienne fonction `render`) sont bien là où attendu plutôt que de deviner.

- [ ] **Step 1: Ajouter l'état de filtre + les fonctions de construction/rendu du panneau**

Juste après les 4 fonctions de Task 4 (donc toujours avant `destroy`), ajouter :

```js
  var _filters     = { continent: '', pays: '', region: '', ville: '' };
  var _localized    = [];
  var _unlocalized  = [];
  var _markersById  = {};

  function _buildMarkers(list) {
    var map = {};
    var markers = list.map(function(insc) {
      var j = jitterOffset(insc.id);
      var marker = {
        lat:   insc.geoLat + j.dLat,
        lng:   insc.geoLng + j.dLng,
        label: ((insc.prenom || '') + ' ' + (insc.nom || '')).trim() || 'Usager',
        insc:  insc,
      };
      map[insc.id] = marker;
      return marker;
    });
    return { markers: markers, map: map };
  }

  function _selectHtml(id, label, values, selected) {
    return '<label class="usagers-filter-label" for="' + id + '">' + label + '</label>'
      + '<select class="usagers-filter-select" id="' + id + '">'
      +   '<option value="">Tous</option>'
      +   values.map(function(v) {
            return '<option value="' + _esc(v) + '"' + (v === selected ? ' selected' : '') + '>' + _esc(v) + '</option>';
          }).join('')
      + '</select>';
  }

  function _renderPanelHtml(options, filters) {
    return '<div class="usagers-filter-selects">'
      +   _selectHtml('usagers-filter-continent', 'Continent', options.continents, filters.continent)
      +   _selectHtml('usagers-filter-pays',      'Pays',      options.pays,       filters.pays)
      +   _selectHtml('usagers-filter-region',    'Région',    options.regions,    filters.region)
      +   _selectHtml('usagers-filter-ville',     'Ville',     options.villes,     filters.ville)
      + '</div>'
      + '<div class="usagers-filter-list" id="usagers-filter-list"></div>';
  }

  function _rowHtml(insc, localized) {
    var name = ((insc.prenom || '') + ' ' + (insc.nom || '')).trim() || 'Usager';
    var sub  = localized ? (insc.ville || '') : '';
    return '<div class="usagers-filter-row" data-id="' + _esc(insc.id) + '" data-localized="' + (localized ? '1' : '0') + '">'
      + '🧍 ' + _esc(name) + (sub ? ' — ' + _esc(sub) : '')
      + '</div>';
  }

  function _renderListHtml(filtered, unlocalized) {
    var html = filtered.length
      ? filtered.map(function(i) { return _rowHtml(i, true); }).join('')
      : '<div class="usagers-filter-empty">Aucun usager pour ce filtre.</div>';
    if (unlocalized.length) {
      html += '<div class="usagers-filter-group-label">Non localisés</div>'
        + unlocalized.map(function(i) { return _rowHtml(i, false); }).join('');
    }
    return html;
  }

  function _bindPanelList(listEl) {
    listEl.querySelectorAll('.usagers-filter-row').forEach(function(rowEl) {
      rowEl.addEventListener('click', function() {
        var id = rowEl.dataset.id;
        if (rowEl.dataset.localized === '1') {
          var marker = _markersById[id];
          if (marker && _globe && typeof _globe.focusOnMarker === 'function') _globe.focusOnMarker(marker);
        } else if (typeof App !== 'undefined' && typeof App.navigateToInscription === 'function') {
          App.navigateToInscription(id);
        }
      });
    });
  }

  function _bindPanelSelects(panelEl) {
    var levels = [
      ['usagers-filter-continent', 'continent'],
      ['usagers-filter-pays',      'pays'],
      ['usagers-filter-region',    'region'],
      ['usagers-filter-ville',     'ville'],
    ];
    levels.forEach(function(pair, idx) {
      var selectEl = panelEl.querySelector('#' + pair[0]);
      if (!selectEl) return;
      selectEl.addEventListener('change', function() {
        _filters[pair[1]] = selectEl.value;
        for (var j = idx + 1; j < levels.length; j++) {
          _filters[levels[j][1]] = '';
        }
        _applyFilters(panelEl);
      });
    });
  }

  function _applyFilters(panelEl) {
    var filtered = filterInscriptions(_localized, _filters);
    var built = _buildMarkers(filtered);
    _markersById = built.map;

    if (_globe) _globe.setMarkers(built.markers);

    var options = getFilterOptions(_localized, _filters);
    panelEl.innerHTML = _renderPanelHtml(options, _filters);
    _bindPanelSelects(panelEl);

    var listEl = panelEl.querySelector('#usagers-filter-list');
    listEl.innerHTML = _renderListHtml(filtered, _unlocalized);
    _bindPanelList(listEl);
  }

```

- [ ] **Step 2: Remplacer `render`**

Remplacer la fonction `render` existante en entier par :

```js
  async function render(container) {
    destroy();
    container.innerHTML = ''
      + '<div class="stats-card usagers-map-card">'
      +   '<div class="stats-card-title">Localisation des usagers</div>'
      +   '<p class="usagers-map-hint" id="usagers-map-hint">Position approximative (ville / code postal), pas l\'adresse précise. Glisser pour tourner, molette pour zoomer, cliquer un point (ou une ligne de la liste) pour la fiche usager.</p>'
      +   '<div id="usagers-map-status" class="usagers-map-status">Chargement…</div>'
      +   '<div class="usagers-map-layout">'
      +     '<div id="usagers-globe" class="usagers-globe-wrap"></div>'
      +     '<div class="usagers-filter-panel" id="usagers-filter-panel"></div>'
      +   '</div>'
      + '</div>';

    var statusEl = container.querySelector('#usagers-map-status');
    var globeEl  = container.querySelector('#usagers-globe');
    var panelEl  = container.querySelector('#usagers-filter-panel');
    var hintEl   = container.querySelector('#usagers-map-hint');

    _filters = { continent: '', pays: '', region: '', ville: '' };

    try {
      var inscriptions = await getInscriptions();
      var valid    = inscriptions.filter(function(i) { return i.statut === 'valide'; });
      var withAddr = valid.filter(function(i) { return i.codePostal || i.ville; });

      if (!valid.length) {
        statusEl.textContent = 'Aucun usager validé pour le moment.';
        return;
      }

      var geocoded = await geocodeInscriptions(withAddr);
      var hasForeign = geocoded.some(function(i) { return i.countryCode && i.countryCode !== 'FR'; });
      if (hasForeign) {
        hintEl.textContent += ' Données pays hors France : © OpenStreetMap contributors.';
      }

      var split = splitLocalisables(valid);
      _localized   = split.localized;
      _unlocalized = split.unlocalized;

      if (!_localized.length) {
        statusEl.textContent = 'Aucun usager localisé pour le moment.';
        panelEl.innerHTML = _renderPanelHtml({ continents: [], pays: [], regions: [], villes: [] }, _filters);
        panelEl.querySelector('#usagers-filter-list').innerHTML = _renderListHtml([], _unlocalized);
        _bindPanelList(panelEl.querySelector('#usagers-filter-list'));
        return;
      }

      var missing = withAddr.length - geocoded.length;
      statusEl.textContent = _localized.length + ' usager' + _s(_localized.length) + ' localisé' + _s(_localized.length)
        + (missing > 0 ? ' — ' + missing + ' adresse' + _s(missing) + ' non reconnue' + _s(missing) : '');

      if (!window.HandiplageGlobe) {
        // Le module ES (js/globe.js) charge en parallèle — on retente sous peu.
        setTimeout(function() { if (container.isConnected) render(container); }, 500);
        return;
      }

      var tooltip = document.createElement('div');
      tooltip.className = 'usagers-globe-tooltip';
      globeEl.appendChild(tooltip);

      var popup = document.createElement('div');
      popup.className = 'usagers-globe-popup';
      globeEl.appendChild(popup);

      function showPopup(insc, x, y) {
        tooltip.classList.remove('visible');
        popup.innerHTML = _popupHtml(insc);
        var rect = globeEl.getBoundingClientRect();
        var left = x - rect.left + 16;
        var top  = y - rect.top + 16;
        left = Math.min(left, rect.width - 220);
        top  = Math.min(top, rect.height - 160);
        popup.style.left = Math.max(8, left) + 'px';
        popup.style.top  = Math.max(8, top) + 'px';
        popup.classList.add('visible');

        popup.querySelector('.usagers-popup-close').addEventListener('click', function() {
          popup.classList.remove('visible');
        });
        var linkBtn = popup.querySelector('.usagers-popup-link');
        if (linkBtn) {
          linkBtn.addEventListener('click', function() {
            App.navigateToInscription(linkBtn.dataset.id);
          });
        }
      }

      var initial = _buildMarkers(_localized);
      _markersById = initial.map;

      _globe = window.HandiplageGlobe.create(globeEl, {
        speed: 1.1,
        smoothing: 7,
        scale: 7,
        dots: { color: '#00b090', size: 3.5, density: 7, allDots: false },
        markerConfig: { markers: initial.markers, color: '#f0c93a', size: 55 },
        oceanColor: '#f8fafc',
        outlineColor: 'rgba(10,22,40,0.25)',
        graticuleColor: 'rgba(10,22,40,0.06)',
        initialLatitude: 20,
        initialLongitude: -10,
        onMarkerHover: function(marker, x, y) {
          if (!marker) { tooltip.classList.remove('visible'); return; }
          tooltip.textContent = marker.label;
          var rect = globeEl.getBoundingClientRect();
          tooltip.style.left = (x - rect.left + 14) + 'px';
          tooltip.style.top  = (y - rect.top + 14) + 'px';
          tooltip.classList.add('visible');
        },
        onMarkerClick: function(marker, x, y) {
          if (marker && marker.insc) showPopup(marker.insc, x, y);
        },
        onError: function() {
          statusEl.textContent = 'Le globe 3D n\'a pas pu être chargé (connexion indisponible ?).';
        },
      });

      _applyFilters(panelEl);
    } catch (e) {
      statusEl.textContent = 'Erreur : ' + _esc(e.message || String(e));
    }
  }
```

- [ ] **Step 3: Run the full suite (sanity check)**

Run: `node tests/run-all.js`
Expected: `✅ Tous les tests passent.`

- [ ] **Step 4: Vérification statique**

Relire le fichier final et confirmer :
- `_popupHtml`, `destroy`, et les 4 fonctions pures de Task 4 (et leur bloc `module.exports`) sont intacts.
- `render` est bien `async function render(container) { ... }` avec la même signature qu'avant.
- Le `return { render: render, destroy: destroy };` final de l'IIFE n'a pas changé (l'API publique `UsagersMap.render`/`UsagersMap.destroy` reste identique — seul l'intérieur de `render` change).
- Aucune référence à une fonction/variable qui n'existe pas (`jitterOffset`, `geocodeInscriptions`, `splitLocalisables`, `getFilterOptions`, `filterInscriptions` sont bien dans la portée par closure ou via les scripts globaux déjà chargés avant `usagers-map.js` dans `index.html`).

- [ ] **Step 5: Commit**

```bash
git add js/usagers-map.js
git commit -m "feat(carte): panneau de filtres en cascade + liste synchronisée avec le globe"
```

---

### Task 6: Styles CSS du panneau

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: Ajouter les styles**

Dans `css/style.css`, juste après la ligne `.usagers-popup-link:hover { background: #00b090; }` (juste avant le bloc `@media (max-width: 1100px) { ... }` existant), ajouter :

```css
.usagers-map-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.usagers-map-layout .usagers-globe-wrap { flex: 1; min-width: 0; }

.usagers-filter-panel {
  width: 300px;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--panel-bg);
  display: flex;
  flex-direction: column;
  max-height: 460px;
  overflow: hidden;
}
.usagers-filter-selects {
  padding: 12px;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.usagers-filter-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-bottom: 2px;
}
.usagers-filter-select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
}
.usagers-filter-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
.usagers-filter-row {
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
}
.usagers-filter-row:hover { background: rgba(0,212,170,.06); }
.usagers-filter-empty {
  padding: 12px;
  font-size: 12px;
  color: var(--text-muted);
}
.usagers-filter-group-label {
  padding: 8px 12px 4px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  background: var(--panel-bg);
  position: sticky;
  top: 0;
}

@media (max-width: 900px) {
  .usagers-map-layout { flex-direction: column; }
  .usagers-filter-panel { width: 100%; max-height: 280px; }
}
```

- [ ] **Step 2: Commit**

```bash
git add css/style.css
git commit -m "style(carte): panneau de filtres géographiques"
```

---

### Task 7: Charger `js/geo-continents.js` dans `index.html`

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Ajouter la balise script**

Dans `index.html`, insérer juste avant la ligne `<script src="js/supabase-geo.js"></script>` (actuellement ligne 105, juste après `js/supabase-config.js`) :

```html
  <script src="js/geo-continents.js"></script>
```

Le fichier doit charger AVANT `js/supabase-geo.js` (qui utilise `countryCodeToContinent` comme fallback global) et avant `js/usagers-map.js` (plus loin dans le fichier).

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: charger geo-continents.js dans le panel staff"
```

---

### Task 8: Vérification finale

**Files:** aucun (vérification uniquement)

- [ ] **Step 1: Run the full test suite one last time**

Run: `node tests/run-all.js`
Expected: `✅ Tous les tests passent.`

- [ ] **Step 2: Smoke test manuel**

Pas d'environnement Supabase/navigateur disponible dans ce plan — demander à l'utilisateur de vérifier manuellement, ou le faire soi-même si un accès est disponible :
1. Ouvrir l'onglet Stats → sous-vue Carte des usagers.
2. Confirmer que le panneau à droite du globe affiche 4 menus déroulants (Continent/Pays/Région/Ville) + une liste.
3. Changer le filtre Continent → confirmer que les points du globe se réduisent en même temps que la liste, et que les menus Pays/Région/Ville se réinitialisent et ne proposent que des valeurs cohérentes avec le continent choisi.
4. Cliquer une ligne de la liste (usager localisé) → confirmer que le globe centre/zoome sur le point et que la bulle d'info s'ouvre avec le bouton "Voir la fiche →".
5. Si des usagers n'ont pas d'adresse ou n'ont jamais pu être géocodés, confirmer qu'ils apparaissent sous "Non localisés" en bas de la liste, et qu'un clic ouvre directement leur fiche.
6. Si des usagers ont un pays ≠ France, confirmer qu'ils apparaissent maintenant sur le globe (géocodage Nominatim) et que la mention OpenStreetMap apparaît dans le texte d'aide sous le titre.

- [ ] **Step 3: Ne pas pousser**

Comme pour le reste du projet, les changements sont commités localement mais **pas poussés** vers le remote avant une demande explicite.

---

## Hors périmètre (per spec)

- Région administrative pour les pays hors France.
- Mise à jour temps réel du panneau pendant qu'il est ouvert si un géocodage se termine en arrière-plan.
- Recherche texte libre dans le panneau.
- Export/impression de la liste filtrée.
