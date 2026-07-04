// js/supabase-messages.js
'use strict';

function _rowToMessage(row) {
  return {
    id:             row.id,
    inscriptionId:  row.inscription_id,
    motifRefus:     row.motif_refus,
    token:          row.token,
    tokenExpiresAt: row.token_expires_at,
    contenu:        row.contenu || null,
    lu:             !!row.lu,
    createdAt:      row.created_at,
    nom:            row.inscriptions ? row.inscriptions.nom    : null,
    prenom:         row.inscriptions ? row.inscriptions.prenom : null,
    mail:           row.inscriptions ? row.inscriptions.mail   : null,
    statut:         row.inscriptions ? row.inscriptions.statut : null,
  };
}

async function getMessages() {
  var result = await supabaseClient
    .from('messages')
    .select('*, inscriptions(nom, prenom, mail, statut)')
    .order('lu', { ascending: true })
    .order('created_at', { ascending: false });
  if (result.error) throw result.error;
  return (result.data || []).map(_rowToMessage);
}

async function getMessageById(id) {
  var result = await supabaseClient
    .from('messages')
    .select('*, inscriptions(nom, prenom, mail, statut)')
    .eq('id', id)
    .single();
  if (result.error) throw result.error;
  return _rowToMessage(result.data);
}

async function markMessageRead(id) {
  var result = await supabaseClient
    .from('messages')
    .update({ lu: true })
    .eq('id', id);
  if (result.error) throw result.error;
}

async function getUnreadCount() {
  var result = await supabaseClient
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('lu', false)
    .not('contenu', 'is', null);
  if (result.error) throw result.error;
  return result.count || 0;
}

if (typeof module !== 'undefined') {
  module.exports = { _rowToMessage, getMessages, getMessageById, markMessageRead, getUnreadCount };
}
