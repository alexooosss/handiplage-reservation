// tests/test-supabase-geo.js
'use strict';
const assert = require('assert');
const {
  needsGeocoding,
  buildGeocodeQuery,
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
  // Déjà géocodé → pas d'appel réseau, pas d'update
  {
    let fetchCalls = 0;
    const insc = { id: '1', ville: 'Antibes', geoLat: 43.58, geoLng: 7.12 };
    const out = await geocodeInscriptions([insc], {
      delayMs: 0,
      fetchImpl: async () => { fetchCalls++; return { ok: true, json: async () => ({}) }; },
      updateFn: async () => { throw new Error('ne doit pas être appelé'); },
    });
    assert.strictEqual(fetchCalls, 0);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].geoLat, 43.58);
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

    console.log('✓ supabase-geo.js — tous les tests passent');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
