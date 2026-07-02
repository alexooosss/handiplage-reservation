'use strict';

function getUserRole(session) {
  if (!session || !session.user) return null;
  return (session.user.user_metadata && session.user.user_metadata.role) || null;
}

async function signIn(email, password) {
  const result = await supabase.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  return result.data;
}

async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/login.html';
}

async function getSession() {
  const result = await supabase.auth.getSession();
  return result.data.session;
}

// Redirige vers login.html si pas de session, vers usager.html si rôle user
async function requireStaffAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = '/login.html';
    return null;
  }
  if (getUserRole(session) !== 'staff') {
    window.location.href = '/usager.html';
    return null;
  }
  return session;
}

// Appelle l'Edge Function pour inviter un usager par email
async function inviteUser(email, inscriptionId) {
  const session = await getSession();
  const response = await fetch(window.SUPABASE_CONFIG.url + '/functions/v1/invite-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + session.access_token
    },
    body: JSON.stringify({ email, inscriptionId })
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error || 'Erreur invitation');
  }
}

if (typeof module !== 'undefined') {
  module.exports = { getUserRole, signIn, signOut, getSession, requireStaffAuth, inviteUser };
}
