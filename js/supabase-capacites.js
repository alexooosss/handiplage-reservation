// js/supabase-capacites.js
// Capacités ajustables par créneau (voir supabase/migration-capacites.sql).
// Sans réglage : 35 places = 25 usagers + 10 groupes. Places usagers = capacité − places groupes.
'use strict';

var CAPA_DEFAUT = { totale: 35, groupes: 10 };
var DEMI_JOURNEES = { matin: [1, 2], apresmidi: [3, 4, 5] };   // 12h30 rattaché à l'après-midi

async function getCapacites(fromISO, toISO) {
  var result = await supabaseClient.from('capacites').select('*')
    .gte('date', fromISO).lte('date', toISO || fromISO);
  if (result.error) throw result.error;
  return result.data || [];
}

// Index « date_creneau » → ligne
function indexCapacites(rows) {
  var m = {};
  (rows || []).forEach(function(r) { m[r.date + '_' + r.creneau_id] = r; });
  return m;
}

function capaciteDe(index, dateISO, creneauId) {
  var r = index && index[dateISO + '_' + creneauId];
  var totale  = r ? r.capacite_totale : CAPA_DEFAUT.totale;
  var groupes = r ? r.places_groupes  : CAPA_DEFAUT.groupes;
  return {
    totale: totale,
    groupes: groupes,
    usagers: Math.max(0, totale - groupes),
    groupeId: r ? r.groupe_id || null : null,
    modifie: !!r,
  };
}

// Applique un réglage à plusieurs dates × créneaux
async function enregistrerCapacites(dates, creneauIds, totale, groupes, groupeId) {
  var rows = [];
  dates.forEach(function(d) {
    creneauIds.forEach(function(c) {
      rows.push({ date: d, creneau_id: c, capacite_totale: totale, places_groupes: groupes,
        groupe_id: groupeId || null, updated_at: new Date().toISOString() });
    });
  });
  if (!rows.length) return;
  var result = await supabaseClient.from('capacites').upsert(rows, { onConflict: 'date,creneau_id' });
  if (result.error) throw result.error;
}

// « Revenir à la normale » : supprime les réglages
async function retablirCapacites(dates, creneauIds) {
  if (!dates.length || !creneauIds.length) return;
  var result = await supabaseClient.from('capacites').delete()
    .in('date', dates).in('creneau_id', creneauIds);
  if (result.error) throw result.error;
}

// Liste des dates ISO entre deux bornes incluses
function datesEntre(debutISO, finISO) {
  var out = [];
  var d = new Date(debutISO + 'T12:00:00'), fin = new Date(finISO + 'T12:00:00');
  while (d <= fin && out.length < 400) {
    out.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

if (typeof module !== 'undefined') {
  module.exports = { CAPA_DEFAUT, DEMI_JOURNEES, getCapacites, indexCapacites, capaciteDe,
    enregistrerCapacites, retablirCapacites, datesEntre };
}
