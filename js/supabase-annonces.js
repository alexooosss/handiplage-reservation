// js/supabase-annonces.js
'use strict';

function _rowToAnnonce(row) {
  return {
    id:        row.id,
    contenu:   row.contenu,
    actif:     !!row.actif,
    createdAt: row.created_at,
  };
}

/**
 * SELECT * FROM annonces WHERE actif = true (au plus une ligne)
 * Retourne null si aucune annonce active. Accessible usager + staff.
 */
async function getActiveAnnonce() {
  var result = await supabaseClient
    .from('annonces')
    .select('*')
    .eq('actif', true)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data ? _rowToAnnonce(result.data) : null;
}

/**
 * Historique complet, le plus récent d'abord. Réservé au staff (RLS
 * staff_full_annonces) — non consommé par l'UI en v1, prévu pour un futur
 * écran d'historique.
 */
async function getAnnonces() {
  var result = await supabaseClient
    .from('annonces')
    .select('*')
    .order('created_at', { ascending: false });
  if (result.error) throw result.error;
  return (result.data || []).map(_rowToAnnonce);
}

/**
 * Désactive l'annonce active existante (s'il y en a une), puis crée la
 * nouvelle ligne active. Deux requêtes séquentielles, pas de transaction :
 * en cas d'échec de l'insertion après la désactivation, aucune annonce ne
 * reste active (le staff republie). Réservé au staff (RLS).
 */
async function createAnnonce(contenu) {
  var deactivate = await supabaseClient
    .from('annonces')
    .update({ actif: false })
    .eq('actif', true);
  if (deactivate.error) throw deactivate.error;

  var result = await supabaseClient
    .from('annonces')
    .insert({ contenu: contenu, actif: true })
    .select('*')
    .single();
  if (result.error) throw result.error;
  return _rowToAnnonce(result.data);
}

/**
 * Désactive une annonce par id. Réservé au staff (RLS).
 */
async function deactivateAnnonce(id) {
  var result = await supabaseClient
    .from('annonces')
    .update({ actif: false })
    .eq('id', id);
  if (result.error) throw result.error;
}

if (typeof module !== 'undefined') {
  module.exports = { _rowToAnnonce, getActiveAnnonce, getAnnonces, createAnnonce, deactivateAnnonce };
}
