// tests/test-supabase-inscriptions.js
'use strict';
const assert = require('assert');

// Évite le guard window.SUPABASE_CONFIG de supabase-client.js
// (supabase-inscriptions.js n'importe pas supabase-client.js, mais par sécurité)
global.window = undefined;
// supabaseClient est utilisé seulement dans les fonctions async — pas dans les pures
global.supabaseClient = null;

const {
  _rowToInscription,
  _inscriptionToRow,
} = require('../js/supabase-inscriptions.js');

// ── _rowToInscription ──

// 1. pass_actif: true → pass: { actif: true, activatedAt: '...' }
{
  const row = {
    id: 'uuid-1',
    nom: 'MARTIN',
    prenom: 'André',
    mail: 'a@b.com',
    telephone: '0600000000',
    statut: 'valide',
    pass_actif: true,
    pass_activated_at: '2026-07-01',
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
    metadata: {},
  };
  const obj = _rowToInscription(row);
  assert.deepStrictEqual(obj.pass, { actif: true, activatedAt: '2026-07-01' },
    '_rowToInscription: pass reconstruit quand pass_actif=true');
}

// 2. pass_actif: false → pass: null
{
  const row = {
    id: 'uuid-2',
    nom: 'DUPONT',
    prenom: 'Claire',
    mail: null,
    telephone: null,
    statut: 'en_attente',
    pass_actif: false,
    pass_activated_at: null,
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
    metadata: {},
  };
  const obj = _rowToInscription(row);
  assert.strictEqual(obj.pass, null,
    '_rowToInscription: pass null quand pass_actif=false');
}

// 3. metadata fields propagés au top-level
{
  const row = {
    id: 'uuid-3',
    nom: 'SIMON',
    prenom: 'Paul',
    mail: null,
    telephone: null,
    statut: 'en_attente',
    pass_actif: false,
    pass_activated_at: null,
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
    metadata: {
      adresse: '12 rue de la Paix',
      ville: 'Antibes',
      pays: 'France',
    },
  };
  const obj = _rowToInscription(row);
  assert.strictEqual(obj.adresse, '12 rue de la Paix',
    '_rowToInscription: metadata.adresse propagé au top-level');
  assert.strictEqual(obj.ville, 'Antibes',
    '_rowToInscription: metadata.ville propagé au top-level');
  assert.strictEqual(obj.pays, 'France',
    '_rowToInscription: metadata.pays propagé au top-level');
}

// 4. createdAt issu de created_at
{
  const row = {
    id: 'uuid-4',
    nom: 'TEST',
    prenom: 'User',
    mail: null,
    telephone: null,
    statut: 'en_attente',
    pass_actif: false,
    pass_activated_at: null,
    created_at: '2026-05-15T08:30:00Z',
    updated_at: '2026-05-15T08:30:00Z',
    metadata: {},
  };
  const obj = _rowToInscription(row);
  assert.strictEqual(obj.createdAt, '2026-05-15T08:30:00Z',
    '_rowToInscription: createdAt mappé depuis created_at');
  assert.strictEqual(obj.updatedAt, '2026-05-15T08:30:00Z',
    '_rowToInscription: updatedAt mappé depuis updated_at');
}

// ── _inscriptionToRow ──

// 5. Colonnes structurées extraites correctement
{
  const data = {
    id: 'uuid-5',
    nom: 'BERNARD',
    prenom: 'Sophie',
    mail: 's@b.com',
    telephone: '0611111111',
    statut: 'valide',
    pass: { actif: true, activatedAt: '2026-07-01' },
    createdAt: '2026-06-01T10:00:00Z',
    updatedAt: '2026-06-01T10:00:00Z',
    adresse: '5 av. de la Mer',
    ville: 'Nice',
  };
  const row = _inscriptionToRow(data);
  assert.strictEqual(row.nom, 'BERNARD', '_inscriptionToRow: nom extrait');
  assert.strictEqual(row.prenom, 'Sophie', '_inscriptionToRow: prenom extrait');
  assert.strictEqual(row.mail, 's@b.com', '_inscriptionToRow: mail extrait');
  assert.strictEqual(row.telephone, '0611111111', '_inscriptionToRow: telephone extrait');
  assert.strictEqual(row.statut, 'valide', '_inscriptionToRow: statut extrait');
}

// 6. id et createdAt absents du row retourné
{
  const data = {
    id: 'uuid-6',
    nom: 'LAMBERT',
    prenom: 'Jean',
    mail: null,
    telephone: null,
    statut: 'en_attente',
    createdAt: '2026-06-01T10:00:00Z',
    updatedAt: '2026-06-01T10:00:00Z',
    pass: null,
  };
  const row = _inscriptionToRow(data);
  assert.strictEqual(row.id, undefined,
    '_inscriptionToRow: id absent du row');
  assert.strictEqual(row.createdAt, undefined,
    '_inscriptionToRow: createdAt absent du row');
  assert.strictEqual(row.updatedAt, undefined,
    '_inscriptionToRow: updatedAt absent du row');
  assert.strictEqual(row.created_at, undefined,
    '_inscriptionToRow: created_at absent du row');
}

// 7. Champs extra mis dans metadata
{
  const data = {
    nom: 'PETIT',
    prenom: 'Marie',
    mail: null,
    telephone: null,
    statut: 'en_attente',
    pass: null,
    adresse: '10 bd Victor Hugo',
    codePostal: '06000',
    ville: 'Nice',
    pays: 'France',
    rgpd: true,
  };
  const row = _inscriptionToRow(data);
  assert.strictEqual(row.metadata.adresse, '10 bd Victor Hugo',
    '_inscriptionToRow: adresse dans metadata');
  assert.strictEqual(row.metadata.codePostal, '06000',
    '_inscriptionToRow: codePostal dans metadata');
  assert.strictEqual(row.metadata.rgpd, true,
    '_inscriptionToRow: rgpd dans metadata');
}

// 8. nom et statut absents de metadata
{
  const data = {
    nom: 'GARNIER',
    prenom: 'Louis',
    mail: null,
    telephone: null,
    statut: 'valide',
    pass: null,
    ville: 'Cannes',
  };
  const row = _inscriptionToRow(data);
  assert.strictEqual(row.metadata.nom, undefined,
    '_inscriptionToRow: nom absent de metadata');
  assert.strictEqual(row.metadata.statut, undefined,
    '_inscriptionToRow: statut absent de metadata');
  assert.strictEqual(row.metadata.prenom, undefined,
    '_inscriptionToRow: prenom absent de metadata');
}

// 9. pass reconstruit en pass_actif / pass_activated_at
{
  const dataWithPass = {
    nom: 'RENAUD',
    prenom: 'Alice',
    mail: null,
    telephone: null,
    statut: 'valide',
    pass: { actif: true, activatedAt: '2026-07-15' },
  };
  const row1 = _inscriptionToRow(dataWithPass);
  assert.strictEqual(row1.pass_actif, true,
    '_inscriptionToRow: pass_actif=true depuis pass.actif');
  assert.strictEqual(row1.pass_activated_at, '2026-07-15',
    '_inscriptionToRow: pass_activated_at depuis pass.activatedAt');

  const dataNoPass = {
    nom: 'RENAUD',
    prenom: 'Alice',
    mail: null,
    telephone: null,
    statut: 'en_attente',
    pass: null,
  };
  const row2 = _inscriptionToRow(dataNoPass);
  assert.strictEqual(row2.pass_actif, false,
    '_inscriptionToRow: pass_actif=false quand pass=null');
  assert.strictEqual(row2.pass_activated_at, null,
    '_inscriptionToRow: pass_activated_at=null quand pass=null');
}

console.log('✓ test-supabase-inscriptions.js OK');
