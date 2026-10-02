// tests/test-supabase-geo.js
'use strict';
const assert = require('assert');
const {
  needsGeocoding,
  buildGeocodeQuery,
  buildNominatimQuery,
  extractRegionFromBanContext,
  jitterOffset,
  _stripToMetadata,
  geocodeInscriptions,
} = require('../js/supabase-geo.js');

// ── needsGeocoding ──
assert.strictEqual(needsGeocoding(null), false);
assert.strictEqual(needsGeocoding({}), false, 'sans ville ni code postal');
assert.strictEqual(needsGeocoding({ codePostal: '06600' }), true);
assert.strictEqual(needsGeocoding({ ville: 'Antibes' }), true);
assert.strictEqual(needsGeocoding({ ville: 'Antibes', geoLat: 43.58, geoLng: 7.12 }), false, 'déjà géocodé');
assert.strictEqual(needsGeocoding({ ville: 'Antibes', geoLat: 'x', geoLng: 7.12 }), true, 'geoLat non numérique ignoré');

// ── buildGeocodeQuery ──
assert.strictEqual(buildGeocodeQuery('06600', 'Antibes'), '06600 Antibes');
assert.strictEqual(buildGeocodeQuery('', 'Antibes'), 'Antibes');
assert.strictEqual(buildGeocodeQuery('06600', ''), '06600');
assert.strictEqual(buildGeocodeQuery('', ''), null, 'aucune info exploitable');
assert.strictEqual(buildGeocodeQuery(null, undefined), null);
assert.strictEqual(buildGeocodeQuery('06600', 'Antibes', 'France'), '06600 Antibes');
assert.strictEqual(buildGeocodeQuery('06600', 'Antibes', 'france'), '06600 Antibes', 'insensible à la casse');
assert.strictEqual(buildGeocodeQuery('06600', 'Antibes', '  France  '), '06600 Antibes', 'espaces ignorés');
assert.strictEqual(buildGeocodeQuery('06600', 'Antibes', 'Belgique'), null, 'hors France non géré par l’API BAN');

// ── jitterOffset ──
{
  const a1 = jitterOffset('insc-1');
  const a2 = jitterOffset('insc-1');
  assert.deepStrictEqual(a1, a2, 'déterministe pour un même id');
  const b = jitterOffset('insc-2');
  assert.ok(a1.dLat !== b.dLat || a1.dLng !== b.dLng, 'deux ids différents donnent des offsets différents');
  assert.ok(Math.abs(a1.dLat) <= 0.05 && Math.abs(a1.dLng) <= 0.05, 'offset borné (~5km max)');
}

// ── _stripToMetadata ──
{
  const insc = {
    id: 'x1', nom: 'Dupont', prenom: 'Jean', mail: 'j@d.fr', telephone: '0611',
    statut: 'valide', pass: { actif: true }, createdAt: 'a', updatedAt: 'b',
    ville: 'Antibes', codePostal: '06600', geoLat: 43.58, geoLng: 7.12,
  };
  const meta = _stripToMetadata(insc);
  assert.deepStrictEqual(meta, { ville: 'Antibes', codePostal: '06600', geoLat: 43.58, geoLng: 7.12 });
}

// ── geocodeInscriptions ──
(async () => {
  try {
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

  // Géocodage réussi → écrit lat/lng + geocodedAt, appelle updateFn avec metadata fusionnée
  {
    const insc = { id: '2', nom: 'Martin', codePostal: '06600', ville: 'Antibes', pays: 'France' };
    let updateArgs = null;
    const out = await geocodeInscriptions([insc], {
      delayMs: 0,
      fetchImpl: async (url) => {
        assert.ok(url.includes('06600'));
        return { ok: true, json: async () => ({ features: [{ geometry: { coordinates: [7.1256, 43.5808] } }] }) };
      },
      updateFn: async (id, partial) => { updateArgs = [id, partial]; },
    });
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].geoLat, 43.5808);
    assert.strictEqual(out[0].geoLng, 7.1256);
    assert.ok(out[0].geocodedAt);
    assert.strictEqual(updateArgs[0], '2');
    assert.strictEqual(updateArgs[1].metadata.geoLat, 43.5808);
    assert.strictEqual(updateArgs[1].metadata.nom, undefined, 'nom est une colonne structurée, absente de metadata');
    assert.strictEqual(updateArgs[1].metadata.codePostal, '06600', 'les autres champs metadata sont conservés');
  }

  // Pas d'adresse exploitable → ignoré silencieusement, pas planté
  {
    const insc = { id: '3' };
    const out = await geocodeInscriptions([insc], { delayMs: 0, fetchImpl: async () => { throw new Error('ne doit pas être appelé'); } });
    assert.strictEqual(out.length, 0);
  }

  // Échec réseau → ignoré, pas d'exception propagée
  {
    const insc = { id: '4', ville: 'Antibes' };
    const out = await geocodeInscriptions([insc], {
      delayMs: 0,
      fetchImpl: async () => { throw new Error('offline'); },
    });
    assert.strictEqual(out.length, 0);
  }

  // Réponse HTTP non-ok → ignoré
  {
    const insc = { id: '5', ville: 'Antibes' };
    const out = await geocodeInscriptions([insc], {
      delayMs: 0,
      fetchImpl: async () => ({ ok: false }),
    });
    assert.strictEqual(out.length, 0);
  }

  // Aucune feature trouvée par l'API → ignoré
  {
    const insc = { id: '6', ville: 'Villeimaginaire' };
    const out = await geocodeInscriptions([insc], {
      delayMs: 0,
      fetchImpl: async () => ({ ok: true, json: async () => ({ features: [] }) }),
    });
    assert.strictEqual(out.length, 0);
  }

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

    console.log('✓ supabase-geo.js — tous les tests passent');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
