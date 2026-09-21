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

// Construit la requête envoyée à l'API adresse.data.gouv.fr (niveau commune,
// jamais l'adresse précise — on ne géocode pas le domicile exact d'un usager).
// Retourne null si rien d'exploitable, ou si le pays n'est pas la France
// (l'API BAN ne couvre que la France).
function buildGeocodeQuery(codePostal, ville, pays) {
  if (pays && String(pays).trim() && !/^france$/i.test(String(pays).trim())) return null;
  var parts = [codePostal, ville]
    .map(function(p) { return (p || '').toString().trim(); })
    .filter(Boolean);
  return parts.length ? parts.join(' ') : null;
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

// Géocode (niveau commune) les inscriptions qui n'ont pas encore de position,
// met en cache le résultat dans inscriptions.metadata (geoLat/geoLng/geocodedAt)
// et retourne toutes les inscriptions localisées (déjà géocodées + nouvelles).
// Les échecs individuels (adresse non reconnue, réseau indisponible) sont
// ignorés silencieusement : ils seront retentés au prochain appel.
async function geocodeInscriptions(inscriptions, opts) {
  opts = opts || {};
  var fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  var updateFn  = opts.updateFn  || (typeof updateInscription !== 'undefined' ? updateInscription : null);
  var delayMs   = opts.delayMs !== undefined ? opts.delayMs : 150;

  var results = [];
  for (var i = 0; i < inscriptions.length; i++) {
    var insc = inscriptions[i];

    if (typeof insc.geoLat === 'number' && typeof insc.geoLng === 'number') {
      results.push(insc);
      continue;
    }
    if (!needsGeocoding(insc) || !fetchImpl) continue;

    var query = buildGeocodeQuery(insc.codePostal, insc.ville, insc.pays);
    if (!query) continue;

    try {
      var res = await fetchImpl('https://api-adresse.data.gouv.fr/search/?type=municipality&limit=1&q=' + encodeURIComponent(query));
      if (!res || !res.ok) continue;
      var json = await res.json();
      var feature = json && json.features && json.features[0];
      var coords = feature && feature.geometry && feature.geometry.coordinates;
      if (!Array.isArray(coords) || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') continue;

      insc.geoLat = coords[1];
      insc.geoLng = coords[0];
      insc.geocodedAt = new Date().toISOString();

      if (updateFn) {
        await updateFn(insc.id, { metadata: _stripToMetadata(insc) });
      }
      results.push(insc);
    } catch (e) {
      // adresse non géocodable ou réseau indisponible — ignorée, retentée au prochain chargement
    }

    if (delayMs && i < inscriptions.length - 1) {
      await new Promise(function(r) { setTimeout(r, delayMs); });
    }
  }

  return results;
}

if (typeof module !== 'undefined') {
  module.exports = { needsGeocoding, buildGeocodeQuery, jitterOffset, _stripToMetadata, geocodeInscriptions };
}
