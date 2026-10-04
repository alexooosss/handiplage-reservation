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

var _saisonDatesCache = null;

/**
 * SELECT saison_debut, saison_fin FROM app_config WHERE id = 1
 * Résultat mis en cache en mémoire (une requête par session de page) —
 * invalidé/rafraîchi par ouvrirNouvelleSaison().
 */
async function getSaisonDates() {
  if (_saisonDatesCache) return _saisonDatesCache;
  var result = await supabaseClient
    .from('app_config')
    .select('saison_debut, saison_fin')
    .eq('id', 1)
    .single();
  if (result.error) throw result.error;
  _saisonDatesCache = { debut: result.data.saison_debut, fin: result.data.saison_fin };
  return _saisonDatesCache;
}

/**
 * Incrémente saison_courante de 1 et écrit les nouvelles dates de saison.
 * Réservé au staff (RLS app_config_staff_write). Retourne la nouvelle
 * saison_courante.
 */
async function ouvrirNouvelleSaison(saisonDebut, saisonFin) {
  var courante = await getSaisonCourante();
  var result = await supabaseClient
    .from('app_config')
    .update({ saison_courante: courante + 1, saison_debut: saisonDebut, saison_fin: saisonFin })
    .eq('id', 1)
    .select('saison_courante, saison_debut, saison_fin')
    .single();
  if (result.error) throw result.error;
  _saisonDatesCache = { debut: result.data.saison_debut, fin: result.data.saison_fin };
  return result.data.saison_courante;
}

if (typeof module !== 'undefined') {
  module.exports = { getSaisonCourante, getSaisonDates, ouvrirNouvelleSaison };
}
