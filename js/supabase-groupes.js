'use strict';

var _groupesCache = null;

function _rowToGroupe(row) {
  return {
    id:            row.id,
    nom:           row.nom,
    typeStructure: row.type_structure || 'Autre',
    referentNom:   row.referent_nom   || '',
    referentTel:   row.referent_tel   || '',
    referentEmail: row.referent_email || '',
    commune:       row.commune        || '',
    notes:         row.notes          || '',
    createdAt:     row.created_at,
  };
}

async function getGroupes() {
  var result = await supabaseClient.from('groupes').select('*').order('nom');
  if (result.error) throw result.error;
  _groupesCache = (result.data || []).map(_rowToGroupe);
  return _groupesCache;
}

function getCachedGroupes() {
  return _groupesCache || [];
}

async function createGroupe(data) {
  var row = {
    nom:            data.nom,
    type_structure: data.typeStructure,
    referent_nom:   data.referentNom   || null,
    referent_tel:   data.referentTel   || null,
    referent_email: data.referentEmail || null,
    commune:        data.commune       || null,
    notes:          data.notes         || null,
  };
  var result = await supabaseClient.from('groupes').insert(row).select().single();
  if (result.error) throw result.error;
  var g = _rowToGroupe(result.data);
  if (_groupesCache) {
    _groupesCache = [..._groupesCache, g].sort(function(a, b) { return a.nom.localeCompare(b.nom, 'fr'); });
  }
  return g;
}

async function updateGroupe(id, data) {
  var update = {
    nom:            data.nom,
    type_structure: data.typeStructure,
    referent_nom:   data.referentNom   || null,
    referent_tel:   data.referentTel   || null,
    referent_email: data.referentEmail || null,
    commune:        data.commune       || null,
    notes:          data.notes         || null,
  };
  var result = await supabaseClient.from('groupes').update(update).eq('id', id).select().single();
  if (result.error) throw result.error;
  var g = _rowToGroupe(result.data);
  if (_groupesCache) {
    _groupesCache = _groupesCache.map(function(x) { return x.id === id ? g : x; })
      .sort(function(a, b) { return a.nom.localeCompare(b.nom, 'fr'); });
  }
  return g;
}

async function deleteGroupe(id) {
  var result = await supabaseClient.from('groupes').delete().eq('id', id);
  if (result.error) throw result.error;
  if (_groupesCache) _groupesCache = _groupesCache.filter(function(x) { return x.id !== id; });
}

function subscribeGroupes(onUpdate) {
  return supabaseClient.channel('groupes-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'groupes' }, async function() {
      await getGroupes();
      onUpdate();
    })
    .subscribe();
}

if (typeof module !== 'undefined') {
  module.exports = { getGroupes, getCachedGroupes, createGroupe, updateGroupe, deleteGroupe, subscribeGroupes };
}
