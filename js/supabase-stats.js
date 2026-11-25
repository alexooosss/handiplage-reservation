'use strict';

async function fetchStatsResas(startDate, endDate) {
  var result = await supabaseClient
    .from('reservations')
    .select('date, statut, creneau_id, inscription_id, nom, prenom, resa_type, groupe_id, spot_id')
    .gte('date', startDate)
    .lte('date', endDate);
  if (result.error) throw result.error;
  return result.data || [];
}

// Compteurs de la main courante (fréquentation réelle + matériel) sur une période
async function fetchMcStats(startDate, endDate) {
  var result = await supabaseClient
    .from('main_courante')
    .select('date, creneau_id, compteurs')
    .gte('date', startDate)
    .lte('date', endDate);
  if (result.error) throw result.error;
  return result.data || [];
}

async function fetchInscriptionsPhones(inscriptionIds) {
  if (!inscriptionIds.length) return {};
  var result = await supabaseClient
    .from('inscriptions')
    .select('id, telephone')
    .in('id', inscriptionIds);
  if (result.error) throw result.error;
  var map = {};
  (result.data || []).forEach(function(row) { map[row.id] = row.telephone || '—'; });
  return map;
}

async function fetchActiveInscriptionsCount() {
  var result = await supabaseClient
    .from('inscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('statut', 'valide');
  if (result.error) throw result.error;
  return result.count || 0;
}
