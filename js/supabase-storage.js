'use strict';

function getTodayISO() {
  var d = new Date();
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
}

function _localStatusToDb(status) {
  if (status === 'departed') return 'parti';
  if (status === 'pas_venu') return 'absent';
  return status; // 'present', 'absent', 'annule', 'attente'
}

function _dbStatutToLocal(statut) {
  if (statut === 'parti') return 'departed';
  return statut; // 'present', 'absent', 'annule'
}

function _tsToMs(isoOrNull) {
  if (!isoOrNull) return null;
  return new Date(isoOrNull).getTime();
}

function _rowToSpotResa(row) {
  return {
    nom:           row.nom,
    prenom:        row.prenom,
    accompagnants: row.accompagnants,
    type:          row.type,
    status:        _dbStatutToLocal(row.statut),
    checkinTime:   _tsToMs(row.checkin_time),
    departTime:    _tsToMs(row.depart_time),
    inscriptionId: row.inscription_id || null,
    resaType:      row.resa_type || 'normal',
  };
}

function _rowToWaitingResa(row) {
  return {
    id:            row.id,
    nom:           row.nom,
    prenom:        row.prenom,
    accompagnants: row.accompagnants,
    status:        row.statut === 'attente' ? 'waiting' : _dbStatutToLocal(row.statut),
    inscriptionId: row.inscription_id || null,
    resaType:      row.resa_type || 'normal',
  };
}

async function getReservations(date, slotId) {
  var result = await supabaseClient.from('reservations').select('*')
    .eq('date', date).eq('creneau_id', slotId).not('spot_id', 'is', null);
  if (result.error) throw result.error;
  var map = {};
  (result.data || []).forEach(function(row) { map[row.spot_id] = _rowToSpotResa(row); });
  return map;
}

async function getReservationList(date, slotId) {
  var result = await supabaseClient.from('reservations').select('*')
    .eq('date', date).eq('creneau_id', slotId).is('spot_id', null)
    .order('created_at', { ascending: true });
  if (result.error) throw result.error;
  return (result.data || []).map(_rowToWaitingResa);
}

async function saveCheckin(date, slotId, spotId, data) {
  var row = {
    date:          date,
    creneau_id:    slotId,
    spot_id:       spotId,
    nom:           data.nom,
    prenom:        data.prenom,
    accompagnants: data.accompagnants,
    type:          data.type,
    statut:        _localStatusToDb(data.status || 'present'),
    checkin_time:  data.checkinTime ? new Date(data.checkinTime).toISOString() : null,
    depart_time:   data.departTime  ? new Date(data.departTime).toISOString()  : null,
    inscription_id: data.inscriptionId || null,
    resa_type:     data.resaType || 'normal',
  };
  var result = await supabaseClient.from('reservations').upsert(row,
    { onConflict: 'date,creneau_id,spot_id' });
  if (result.error) throw result.error;
}

async function updateStatus(date, slotId, spotId, status, extras) {
  var update = { statut: _localStatusToDb(status) };
  if (extras && extras.departTime) {
    update.depart_time = new Date(extras.departTime).toISOString();
  }
  if (extras && extras.checkinTime) {
    update.checkin_time = new Date(extras.checkinTime).toISOString();
  }
  var result = await supabaseClient.from('reservations').update(update)
    .eq('date', date).eq('creneau_id', slotId).eq('spot_id', spotId);
  if (result.error) throw result.error;
}

async function updateSpotField(date, slotId, spotId, field, value) {
  var col = field === 'accompagnants' ? 'accompagnants'
          : field === 'checkinTime'   ? 'checkin_time'
          : field === 'departTime'    ? 'depart_time'
          : field;
  var val = (col === 'checkin_time' || col === 'depart_time') && typeof value === 'number'
          ? new Date(value).toISOString() : value;
  var update = {};
  update[col] = val;
  var result = await supabaseClient.from('reservations').update(update)
    .eq('date', date).eq('creneau_id', slotId).eq('spot_id', spotId);
  if (result.error) throw result.error;
}

async function clearSlot(date, slotId) {
  var result = await supabaseClient.from('reservations').delete()
    .eq('date', date).eq('creneau_id', slotId);
  if (result.error) throw result.error;
}

async function addReservation(date, slotId, data) {
  var row = {
    date:          date,
    creneau_id:    slotId,
    nom:           data.nom,
    prenom:        data.prenom,
    accompagnants: data.accompagnants,
    type:          'reserved',
    statut:        'attente',
    spot_id:       null,
    inscription_id: data.inscriptionId || null,
    resa_type:     data.resaType || 'normal',
  };
  var result = await supabaseClient.from('reservations').insert(row).select().single();
  if (result.error) throw result.error;
  return _rowToWaitingResa(result.data);
}

async function removeReservation(reservationId) {
  var result = await supabaseClient.from('reservations').delete().eq('id', reservationId);
  if (result.error) throw result.error;
}

async function updateReservationStatus(reservationId, status) {
  var result = await supabaseClient.from('reservations')
    .update({ statut: _localStatusToDb(status) }).eq('id', reservationId);
  if (result.error) throw result.error;
}

async function updateReservationField(reservationId, field, value) {
  var col = field === 'accompagnants' ? 'accompagnants' : field;
  var update = {};
  update[col] = value;
  var result = await supabaseClient.from('reservations').update(update).eq('id', reservationId);
  if (result.error) throw result.error;
}

// Bulk query pour la vue planning (7j × 5 créneaux en une seule requête)
async function getWeekReservationCounts(weekStartISO, weekEndISO) {
  var result = await supabaseClient.from('reservations')
    .select('date, creneau_id, type, statut, resa_type, spot_id')
    .gte('date', weekStartISO).lte('date', weekEndISO);
  if (result.error) throw result.error;
  var counts = {};
  (result.data || []).forEach(function(row) {
    var d = row.date;
    if (!counts[d]) counts[d] = {};
    var s = row.creneau_id;
    if (!counts[d][s]) counts[d][s] = { waiting_normal:0, waiting_groupe:0, arrived_reserved:0, walkins:0 };
    var c = counts[d][s];
    if (row.spot_id === null) {
      if (row.resa_type === 'groupe') c.waiting_groupe++;
      else c.waiting_normal++;
    } else {
      if (row.type === 'walkin') c.walkins++;
      else c.arrived_reserved++;
    }
  });
  return counts;
}

// Compte les réservations liées à un inscriptionId dans un mois (pour pass quota)
async function getPassRemainingCount(inscriptionId, monthISO) {
  // monthISO : 'YYYY-MM'
  var start = monthISO + '-01';
  var end   = monthISO + '-31'; // Supabase gère les dates inexistantes
  var result = await supabaseClient.from('reservations')
    .select('id', { count: 'exact', head: true })
    .eq('inscription_id', inscriptionId)
    .gte('date', start).lte('date', end)
    .neq('statut', 'annule');
  if (result.error) throw result.error;
  return result.count || 0;
}

// Realtime
var _slotChannel = null;

function subscribeSlot(date, slotId, onUpdate) {
  if (_slotChannel) supabaseClient.removeChannel(_slotChannel);
  _slotChannel = supabaseClient.channel('slot-' + date + '-' + slotId)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'reservations',
      filter: 'date=eq.' + date,
    }, function(payload) {
      var changed = (payload.new && payload.new.creneau_id) || (payload.old && payload.old.creneau_id);
      if (changed == slotId) onUpdate(payload);
    })
    .subscribe();
}

function unsubscribeSlot() {
  if (_slotChannel) {
    supabaseClient.removeChannel(_slotChannel);
    _slotChannel = null;
  }
}

if (typeof module !== 'undefined') {
  module.exports = {
    _rowToSpotResa, _rowToWaitingResa, _localStatusToDb, _dbStatutToLocal,
    getTodayISO, getReservations, getReservationList, saveCheckin, updateStatus,
    updateSpotField, clearSlot, addReservation, removeReservation,
    updateReservationStatus, updateReservationField,
    getWeekReservationCounts, getPassRemainingCount,
    subscribeSlot, unsubscribeSlot,
  };
}
