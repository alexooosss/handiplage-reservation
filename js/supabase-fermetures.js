// js/supabase-fermetures.js
// Fermetures ponctuelles de la plage (déclarées depuis la main courante).
// Table « fermetures » : lisible par tout utilisateur connecté (usagers compris),
// modifiable par le staff uniquement. Voir supabase/migration-fermetures.sql.
'use strict';

function _heureCourante() {
  var d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// Fermetures d'une période (pour bloquer les réservations / afficher les créneaux fermés)
async function getFermetures(fromISO, toISO) {
  var result = await supabaseClient.from('fermetures').select('*')
    .gte('date', fromISO).lte('date', toISO || fromISO)
    .order('date').order('heure_fermeture');
  if (result.error) throw result.error;
  return result.data || [];
}

// Fermeture encore en cours (sans réouverture) pour une date
async function getFermetureOuverte(dateISO) {
  var result = await supabaseClient.from('fermetures').select('*')
    .eq('date', dateISO).is('heure_reouverture', null)
    .order('heure_fermeture', { ascending: false }).limit(1);
  if (result.error) throw result.error;
  return (result.data || [])[0] || null;
}

// Ferme la plage : enregistre la fermeture puis suspend les réservations
// « en attente » des créneaux pas encore terminés à l'heure de fermeture.
async function fermerPlage(dateISO, heure, motif, precision) {
  var ins = await supabaseClient.from('fermetures').insert({
    date: dateISO, heure_fermeture: heure, motif: motif || null, precision: precision || null,
  }).select().single();
  if (ins.error) throw ins.error;

  var creneaux = creneauxNonTerminesA(heure);
  var nb = 0;
  if (creneaux.length) {
    var up = await supabaseClient.from('reservations')
      .update({ statut: 'suspendu' })
      .eq('date', dateISO).eq('statut', 'attente').in('creneau_id', creneaux)
      .select('id');
    if (up.error) {
      // Annule la fermeture enregistrée pour ne pas laisser un état incohérent
      await supabaseClient.from('fermetures').delete().eq('id', ins.data.id);
      throw up.error;
    }
    nb = (up.data || []).length;
  }
  return { fermeture: ins.data, suspendues: nb };
}

// Rouvre la plage : clôt la fermeture et rétablit les réservations suspendues
// des créneaux qui ne sont pas encore terminés. Celles des créneaux passés
// pendant la fermeture restent suspendues, donc recréditées.
async function rouvrirPlage(fermetureId, dateISO, heure) {
  if (fermetureId) {
    var up = await supabaseClient.from('fermetures').update({ heure_reouverture: heure }).eq('id', fermetureId);
    if (up.error) throw up.error;
  }
  var creneaux = creneauxNonTerminesA(heure);
  var nb = 0;
  if (creneaux.length) {
    var res = await supabaseClient.from('reservations')
      .update({ statut: 'attente' })
      .eq('date', dateISO).eq('statut', 'suspendu').in('creneau_id', creneaux)
      .select('id');
    if (res.error) throw res.error;
    nb = (res.data || []).length;
  }
  return { retablies: nb };
}

// Réservations suspendues d'une date (liste des usagers à prévenir)
async function getReservationsSuspendues(dateISO) {
  var result = await supabaseClient.from('reservations')
    .select('id, nom, prenom, creneau_id, resa_type, groupe_id, inscription_id, inscriptions(telephone)')
    .eq('date', dateISO).eq('statut', 'suspendu')
    .order('creneau_id');
  if (result.error) throw result.error;
  return result.data || [];
}

if (typeof module !== 'undefined') {
  module.exports = { getFermetures, getFermetureOuverte, fermerPlage, rouvrirPlage, getReservationsSuspendues, _heureCourante };
}
