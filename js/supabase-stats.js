'use strict';

async function fetchStatsResas(startDate, endDate) {
  var result = await supabaseClient
    .from('reservations')
    .select('date, statut, creneau_id, inscription_id, nom, prenom')
    .gte('date', startDate)
    .lte('date', endDate);
  if (result.error) throw result.error;
  return result.data || [];
}

async function fetchActiveInscriptionsCount() {
  var result = await supabaseClient
    .from('inscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('statut', 'valide');
  if (result.error) throw result.error;
  return result.count || 0;
}
