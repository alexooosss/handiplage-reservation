'use strict';

// Le rôle est lu dans app_metadata, que seule l'administration Supabase peut modifier
// (user_metadata, lui, est modifiable par l'utilisateur : il ne sert jamais à décider des droits).
function getUserRole(session) {
  if (!session || !session.user) return null;
  return (session.user.app_metadata && session.user.app_metadata.role) || null;
}

// Responsable : membre du staff autorisé à modifier les plans de la plage
function estResponsable(session) {
  return getUserRole(session) === 'staff' && !!(session.user.app_metadata && session.user.app_metadata.responsable);
}

async function signIn(email, password) {
  const result = await supabaseClient.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  return result.data;
}

async function signOut() {
  try { sessionStorage.removeItem('hp_intro_vue'); } catch (e) {}   // la prochaine connexion rejoue l'animation
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
}

async function getSession() {
  const result = await supabaseClient.auth.getSession();
  let session = result.data.session;
  // Session ouverte avant la mise à jour des rôles : on la rafraîchit pour obtenir le rôle sécurisé
  if (session && !getUserRole(session)) {
    try {
      const r = await supabaseClient.auth.refreshSession();
      if (r.data && r.data.session) session = r.data.session;
    } catch (e) { /* hors ligne : on garde la session telle quelle */ }
  }
  return session;
}

// Redirige vers login.html si pas de session, vers usager.html si rôle user
async function requireStaffAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  if (getUserRole(session) !== 'staff') {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

// Appelle l'Edge Function pour inviter un usager par email
async function inviteUser(email, inscriptionId) {
  const session = await getSession();
  if (!session) {
    throw new Error('Session requise pour inviter un usager');
  }
  const response = await fetch(window.SUPABASE_CONFIG.url + '/functions/v1/invite-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + session.access_token
    },
    body: JSON.stringify({ email, inscriptionId })
  });
  if (!response.ok) {
    let error = 'Erreur invitation';
    try {
      const body = await response.json();
      error = body.error || error;
    } catch (e) {
      // Réponse non-JSON, utiliser le message par défaut
    }
    throw new Error(error);
  }
}

if (typeof module !== 'undefined') {
  module.exports = { getUserRole, estResponsable, signIn, signOut, getSession, requireStaffAuth, inviteUser };
}
