// js/usager-storage.js
'use strict';

var PASS_QUOTA_USAGER = 40;

function _rowToUsagerInscription(row) {
  var obj = {
    id:              row.id,
    nom:             row.nom,
    prenom:          row.prenom,
    mail:            row.mail,
    telephone:       row.telephone,
    statut:          row.statut,
    passActif:       !!row.pass_actif,
    passActivatedAt: row.pass_activated_at || null,
  };
  if (row.metadata && typeof row.metadata === 'object') {
    Object.assign(obj, row.metadata);
  }
  return obj;
}

function _rowToUsagerReservation(row) {
  return {
    id:            row.id,
    date:          row.date,
    creneauId:     row.creneau_id,
    statut:        row.statut,
    accompagnants: row.accompagnants,
    spotId:        row.spot_id || null,
    createdAt:     row.created_at,
    heureFin:      (row.creneaux && row.creneaux.heure_fin) || null,
  };
}

function computePassBalance(reservations, quota) {
  var today    = new Date();
  var monthKey = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  var used = reservations.filter(function(r) {
    return r.statut !== 'annule' && r.date && r.date.startsWith(monthKey);
  }).length;
  return { used: used, remaining: Math.max(0, quota - used), quota: quota, monthKey: monthKey };
}

function canCancelReservation(dateISO) {
  var resaDate = new Date(dateISO + 'T00:00:00');
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  return resaDate >= today;
}

async function getAbsentsThisMonth(inscriptionId) {
  var today    = new Date();
  var monthKey = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  var result = await supabaseClient.from('reservations')
    .select('id', { count: 'exact', head: true })
    .eq('inscription_id', inscriptionId)
    .gte('date', monthKey + '-01')
    .lte('date', monthKey + '-31')
    .eq('statut', 'absent');
  if (result.error) throw result.error;
  return result.count || 0;
}

function isAbsenceBlocked(inscription, absentsCount) {
  if (absentsCount < 3) return false;
  var today    = new Date();
  var monthKey = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  return inscription.absenceOverrideMonth !== monthKey;
}

async function getUserInscription() {
  var sessionResult = await supabaseClient.auth.getSession();
  var session = sessionResult.data.session;
  if (!session) throw new Error('Non connecté');
  var result = await supabaseClient
    .from('inscriptions')
    .select('*')
    .eq('user_id', session.user.id)
    .single();
  if (result.error) throw result.error;
  return _rowToUsagerInscription(result.data);
}

async function getAvailableDays(fromISO, toISO, inscriptionId) {
  var crRes  = await supabaseClient.from('creneaux').select('id, label, heure_debut, heure_fin, capacite_resa').order('id');
  var resaRes = await supabaseClient.from('reservations')
    .select('id, date, creneau_id, inscription_id, statut')
    .gte('date', fromISO).lte('date', toISO).neq('statut', 'annule');

  if (crRes.error)   throw crRes.error;
  if (resaRes.error) throw resaRes.error;

  var creneaux = crRes.data || [];
  var resas    = resaRes.data || [];

  var counts        = {};
  var userBooked    = {};
  var userResaId    = {};
  var userDayCounts = {};
  resas.forEach(function(r) {
    var key = r.date + '_' + r.creneau_id;
    counts[key] = (counts[key] || 0) + 1;
    if (inscriptionId && r.inscription_id === inscriptionId) {
      userBooked[key] = true;
      userResaId[key] = r.id;
      userDayCounts[r.date] = (userDayCounts[r.date] || 0) + 1;
    }
  });

  var days = {};
  var from = new Date(fromISO + 'T00:00:00');
  var to   = new Date(toISO   + 'T00:00:00');
  for (var d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    var dateISO = d.toISOString().slice(0, 10);
    days[dateISO] = creneaux.map(function(c) {
      var key            = dateISO + '_' + c.id;
      var count          = counts[key] || 0;
      var booked         = !!userBooked[key];
      var dayLimitReached = !booked && (userDayCounts[dateISO] || 0) >= 2;
      return {
        creneauId:  c.id,
        label:      c.label,
        heureDebut: c.heure_debut,
        heureFin:   c.heure_fin,
        capacity:   c.capacite_resa,
        count:      count,
        remaining:  Math.max(0, c.capacite_resa - count),
        available:  !booked && !dayLimitReached && count < c.capacite_resa,
        userBooked: booked,
        resaId:     userResaId[key] || null,
        dayLimit:   dayLimitReached,
      };
    });
  }
  return days;
}

async function getUserReservations(inscriptionId) {
  var result = await supabaseClient
    .from('reservations')
    .select('id, date, creneau_id, statut, accompagnants, spot_id, created_at, creneaux(heure_fin)')
    .eq('inscription_id', inscriptionId)
    .order('date', { ascending: false });
  if (result.error) throw result.error;
  return (result.data || []).map(_rowToUsagerReservation);
}

async function createUserReservation(inscription, dateISO, creneauId) {
  // Vérification blocage absences (3 absences non justifiées ce mois)
  var absents = await getAbsentsThisMonth(inscription.id);
  if (isAbsenceBlocked(inscription, absents)) {
    throw new Error('Réservations suspendues ce mois suite à ' + absents + ' absences non justifiées. Contactez le staff Handiplage.');
  }

  // Vérification limite journalière (2 par jour)
  var dayRes = await supabaseClient.from('reservations')
    .select('id', { count: 'exact', head: true })
    .eq('inscription_id', inscription.id)
    .eq('date', dateISO)
    .neq('statut', 'annule');
  if (dayRes.error) throw dayRes.error;
  if ((dayRes.count || 0) >= 2) throw new Error('Limite de 2 réservations par jour atteinte.');

  // Vérification quota mensuel (40 par mois)
  var monthKey = dateISO.slice(0, 7);
  var monthRes = await supabaseClient.from('reservations')
    .select('id', { count: 'exact', head: true })
    .eq('inscription_id', inscription.id)
    .gte('date', monthKey + '-01')
    .lte('date', monthKey + '-31')
    .neq('statut', 'annule');
  if (monthRes.error) throw monthRes.error;
  if ((monthRes.count || 0) >= PASS_QUOTA_USAGER) throw new Error('Quota mensuel de ' + PASS_QUOTA_USAGER + ' réservations atteint.');

  var result = await supabaseClient.from('reservations').insert({
    date:           dateISO,
    creneau_id:     creneauId,
    inscription_id: inscription.id,
    nom:            inscription.nom,
    prenom:         inscription.prenom,
    accompagnants:  0,
    type:           'reserved',
    statut:         'attente',
    spot_id:        null,
    resa_type:      'normal',
  }).select().single();
  if (result.error) throw result.error;
  return _rowToUsagerReservation(result.data);
}

async function cancelUserReservation(reservationId) {
  var result = await supabaseClient.from('reservations')
    .update({ statut: 'annule' })
    .eq('id', reservationId);
  if (result.error) throw result.error;
}

async function sendUsagerMessage(inscriptionId, sujet, text) {
  var result = await supabaseClient.from('messages').insert({
    inscription_id: inscriptionId,
    motif_refus:    '[USAGER] ' + sujet,
    contenu:        text,
    lu:             false,
  });
  if (result.error) throw result.error;
}

if (typeof module !== 'undefined') {
  module.exports = { _rowToUsagerInscription, _rowToUsagerReservation, computePassBalance, canCancelReservation, getAbsentsThisMonth, isAbsenceBlocked, sendUsagerMessage };
}
