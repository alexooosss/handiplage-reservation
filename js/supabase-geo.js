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
      if (!insc.continent && !insc.countryCode) {
        insc.continent   = 'Europe';
        insc.countryCode = 'FR';
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
