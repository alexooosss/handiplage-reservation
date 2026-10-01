// js/supabase-config.js
'use strict';

/**
 * SELECT saison_courante FROM app_config WHERE id = 1
 */
async function getSaisonCourante() {
  var result = await supabaseClient
    .from('app_config')
    .select('saison_courante')
    .eq('id', 1)
    .single();
  if (result.error) throw result.error;
  return result.data.saison_courante;
}

/**
 * Incrémente saison_courante de 1. Réservé au staff (RLS app_config_staff_write).
 * Retourne la nouvelle valeur.
 */
async function ouvrirNouvelleSaison() {
  var courante = await getSaisonCourante();
  var result = await supabaseClient
    .from('app_config')
    .update({ saison_courante: courante + 1 })
    .eq('id', 1)
    .select('saison_courante')
    .single();
  if (result.error) throw result.error;
  return result.data.saison_courante;
}

if (typeof module !== 'undefined') {
  module.exports = { getSaisonCourante, ouvrirNouvelleSaison };
}
