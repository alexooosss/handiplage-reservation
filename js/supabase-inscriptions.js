'use strict';

// Colonnes structurées — ne vont PAS dans metadata
var STRUCTURED_COLS = [
  'id', 'user_id',
  'nom', 'prenom', 'mail', 'telephone',
  'statut',
  'pass_actif', 'pass_activated_at',
  'created_at', 'updated_at',
  // champs locaux gérés séparément
  'pass', 'createdAt', 'updatedAt',
];

var _inscriptionsCache = null;

// ── Transformations pures ──────────────────────────────────────────────────

/**
 * DB row → objet local inscription
 */
function _rowToInscription(row) {
  var obj = {
    id:        row.id,
    nom:       row.nom,
    prenom:    row.prenom,
    mail:      row.mail,
    telephone: row.telephone,
    statut:    row.statut,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pass: row.pass_actif
      ? { actif: true, activatedAt: row.pass_activated_at }
      : null,
  };

  // Étale les champs metadata au top-level
  if (row.metadata && typeof row.metadata === 'object') {
    var keys = Object.keys(row.metadata);
    for (var i = 0; i < keys.length; i++) {
      obj[keys[i]] = row.metadata[keys[i]];
    }
  }

  return obj;
}

/**
 * Objet local inscription → colonnes DB + metadata
 * N'inclut PAS id, createdAt, updatedAt (gérés par Supabase).
 */
function _inscriptionToRow(data) {
  var metadata = {};
  var keys = Object.keys(data);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (STRUCTURED_COLS.indexOf(k) === -1) {
      metadata[k] = data[k];
    }
  }

  var row = {
    nom:               data.nom       !== undefined ? data.nom       : null,
    prenom:            data.prenom    !== undefined ? data.prenom    : null,
    mail:              data.mail      !== undefined ? data.mail      : null,
    telephone:         data.telephone !== undefined ? data.telephone : null,
    statut:            data.statut    !== undefined ? data.statut    : 'en_attente',
    pass_actif:        data.pass ? Boolean(data.pass.actif) : false,
    pass_activated_at: data.pass ? (data.pass.activatedAt || null) : null,
    metadata:          metadata,
  };

  return row;
}

// ── Fonctions async Supabase ──────────────────────────────────────────────

/**
 * SELECT * FROM inscriptions ORDER BY nom
 * Peuple _inscriptionsCache et retourne le tableau.
 */
async function getInscriptions() {
  var result = await supabaseClient
    .from('inscriptions')
    .select('*')
    .order('nom');
  if (result.error) throw result.error;
  _inscriptionsCache = (result.data || []).map(_rowToInscription);
  return _inscriptionsCache;
}

/**
 * Retourne le cache synchrone (jamais null : [] si vide).
 */
function getCachedInscriptions() {
  return _inscriptionsCache || [];
}

/**
 * SELECT * FROM inscriptions WHERE id = id
 */
async function getInscriptionById(id) {
  var result = await supabaseClient
    .from('inscriptions')
    .select('*')
    .eq('id', id)
    .single();
  if (result.error) throw result.error;
  return _rowToInscription(result.data);
}

/**
 * INSERT INTO inscriptions
 * Met à jour le cache, retourne l'objet créé.
 */
async function createInscription(data) {
  var row = _inscriptionToRow(data);

  var result = await supabaseClient
    .from('inscriptions')
    .insert(row)
    .select()
    .single();
  if (result.error) throw result.error;
  var created = _rowToInscription(result.data);

  if (_inscriptionsCache !== null) {
    _inscriptionsCache.push(created);
    _inscriptionsCache.sort(function(a, b) {
      return (a.nom || '').localeCompare(b.nom || '', 'fr');
    });
  }

  return created;
}

/**
 * UPDATE inscriptions SET ... WHERE id = id
 * partial peut contenir n'importe quel champ local (statut, pass, nom, etc.)
 * Met à jour le cache, retourne l'objet mis à jour.
 */
async function updateInscription(id, partial) {
  var row = {};
  if (partial.statut            !== undefined) row.statut            = partial.statut;
  if (partial.pass_actif        !== undefined) row.pass_actif        = partial.pass_actif;
  if (partial.pass_activated_at !== undefined) row.pass_activated_at = partial.pass_activated_at;
  if (partial.nom               !== undefined) row.nom               = partial.nom;
  if (partial.prenom            !== undefined) row.prenom            = partial.prenom;
  if (partial.mail              !== undefined) row.mail              = partial.mail;
  if (partial.telephone         !== undefined) row.telephone         = partial.telephone;
  if (partial.metadata          !== undefined) row.metadata          = partial.metadata;
  row.updated_at = new Date().toISOString();

  var result = await supabaseClient
    .from('inscriptions')
    .update(row)
    .eq('id', id)
    .select()
    .single();
  if (result.error) throw result.error;
  var updated = _rowToInscription(result.data);

  if (_inscriptionsCache !== null) {
    var idx = _inscriptionsCache.findIndex(function(i) { return i.id === id; });
    if (idx !== -1) _inscriptionsCache[idx] = updated;
  }

  return updated;
}

/**
 * DELETE FROM inscriptions WHERE id = id
 * Met à jour le cache.
 */
async function deleteInscription(id) {
  var result = await supabaseClient
    .from('inscriptions')
    .delete()
    .eq('id', id);
  if (result.error) throw result.error;

  if (_inscriptionsCache !== null) {
    _inscriptionsCache = _inscriptionsCache.filter(function(insc) {
      return insc.id !== id;
    });
  }
}

// ── Realtime ──────────────────────────────────────────────────────────────

var _inscriptionsChannel = null;

/**
 * Abonnement Realtime sur la table inscriptions.
 * onUpdate(payload) est appelé à chaque changement.
 */
function subscribeInscriptions(onUpdate) {
  _inscriptionsChannel = supabaseClient
    .channel('inscriptions-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'inscriptions' },
      onUpdate
    )
    .subscribe();
}

/**
 * Désinscription du canal Realtime.
 */
function unsubscribeInscriptions() {
  if (_inscriptionsChannel) {
    supabaseClient.removeChannel(_inscriptionsChannel);
    _inscriptionsChannel = null;
  }
}

// ── Export (Node tests + browser global) ─────────────────────────────────

if (typeof module !== 'undefined') {
  module.exports = {
    _rowToInscription,
    _inscriptionToRow,
    getInscriptions,
    getCachedInscriptions,
    getInscriptionById,
    createInscription,
    updateInscription,
    deleteInscription,
    subscribeInscriptions,
    unsubscribeInscriptions,
  };
}
