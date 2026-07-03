'use strict';

function _mcDefault() {
  var slots = {};
  SLOTS.forEach(function(s) {
    slots[s.id] = { resa:0, walkin:0, gpe_pers:0, gpe_acc:0, tiralos:0, hippocampes:0, audioplage:0, transferts:0 };
  });
  return {
    staff: { entretien_matin:'', entretien_aprem:'', accueil_matin:'', accueil_aprem:'', police:false, plage_nettoyee:false },
    slots: slots,
    notes: [],
    _isNew: true,
  };
}

function _rowsToMcData(rows) {
  var def = _mcDefault();
  if (!rows || rows.length === 0) return def;

  // Prendre staff et notes depuis la première ligne (ou slot 1)
  var refRow = rows.find(function(r) { return r.creneau_id === 1; }) || rows[0];
  var mc = {
    staff: refRow.staff || def.staff,
    notes: refRow.notes || [],
    slots: Object.assign({}, def.slots),
    _isNew: false,
  };

  rows.forEach(function(row) {
    mc.slots[row.creneau_id] = Object.assign({}, def.slots[row.creneau_id], row.compteurs || {});
  });

  return mc;
}

async function getMcData(date) {
  var result = await supabaseClient.from('main_courante').select('*').eq('date', date);
  if (result.error) throw result.error;
  return _rowsToMcData(result.data);
}

async function saveMcData(date, data) {
  var rows = SLOTS.map(function(s) {
    return {
      date:       date,
      creneau_id: s.id,
      staff:      data.staff || {},
      compteurs:  data.slots && data.slots[s.id] ? data.slots[s.id] : {},
      notes:      data.notes || [],
      updated_at: new Date().toISOString(),
    };
  });
  var result = await supabaseClient.from('main_courante').upsert(rows, { onConflict: 'date,creneau_id' });
  if (result.error) throw result.error;
}

async function getMcDates() {
  var result = await supabaseClient
    .from('main_courante')
    .select('date')
    .order('date', { ascending: false });
  if (result.error) throw result.error;
  // Dédupliquer (une ligne par creneau_id → plusieurs lignes par date)
  var seen = {};
  return (result.data || [])
    .map(function(r) { return r.date; })
    .filter(function(d) { if (seen[d]) return false; seen[d] = true; return true; });
}

// Abonnement Realtime main courante
var _mcChannel = null;

function subscribeMc(date, onUpdate) {
  if (_mcChannel) supabaseClient.removeChannel(_mcChannel);
  _mcChannel = supabaseClient.channel('mc-' + date)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'main_courante',
      filter: 'date=eq.' + date }, onUpdate)
    .subscribe();
}

function unsubscribeMc() {
  if (_mcChannel) {
    supabaseClient.removeChannel(_mcChannel);
    _mcChannel = null;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { _mcDefault, _rowsToMcData, getMcData, saveMcData, getMcDates,
    subscribeMc, unsubscribeMc };
}
