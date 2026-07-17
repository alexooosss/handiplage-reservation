'use strict';

async function renderStaffProfil(container) {
  var session = await getSession();
  var email   = session && session.user ? (session.user.email || '—') : '—';

  container.innerHTML =
    '<div class="profil-wrap">'
    + '<div class="profil-card">'
    +   '<div class="profil-card-title">Mon compte</div>'
    +   '<div class="profil-info-row"><span class="profil-info-key">Rôle</span><span class="profil-info-val">Staff Handiplage</span></div>'
    +   '<div class="profil-info-row"><span class="profil-info-key">Email</span><span class="profil-info-val">' + email + '</span></div>'
    + '</div>'
    + '<div class="profil-card">'
    +   '<div class="profil-card-title">Sécurité</div>'
    +   '<button class="profil-btn profil-btn-ghost" id="btn-toggle-pwd">Changer mon mot de passe</button>'
    +   '<div id="pwd-form" style="display:none;margin-top:16px">'
    +     '<input type="password" id="new-pwd"  class="profil-input" placeholder="Nouveau mot de passe (8 car. min.)">'
    +     '<input type="password" id="new-pwd2" class="profil-input" placeholder="Confirmer le mot de passe">'
    +     '<div id="pwd-msg" class="profil-msg"></div>'
    +     '<button class="profil-btn profil-btn-primary" id="btn-save-pwd">Enregistrer</button>'
    +   '</div>'
    + '</div>'
    + '</div>';

  container.querySelector('#btn-toggle-pwd').addEventListener('click', function() {
    var form = container.querySelector('#pwd-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  });

  container.querySelector('#btn-save-pwd').addEventListener('click', async function() {
    var pwd   = container.querySelector('#new-pwd').value;
    var pwd2  = container.querySelector('#new-pwd2').value;
    var msgEl = container.querySelector('#pwd-msg');
    var btn   = container.querySelector('#btn-save-pwd');
    msgEl.className = 'profil-msg profil-msg-err';
    if (pwd.length < 8) { msgEl.textContent = 'Minimum 8 caractères.'; return; }
    if (pwd !== pwd2)   { msgEl.textContent = 'Les mots de passe ne correspondent pas.'; return; }
    btn.disabled = true; btn.textContent = 'Enregistrement…';
    try {
      var result = await supabaseClient.auth.updateUser({ password: pwd });
      if (result.error) throw result.error;
      msgEl.className = 'profil-msg profil-msg-ok';
      msgEl.textContent = '✓ Mot de passe mis à jour.';
      container.querySelector('#new-pwd').value  = '';
      container.querySelector('#new-pwd2').value = '';
      btn.disabled = false; btn.textContent = 'Enregistrer';
    } catch (e) {
      msgEl.textContent = 'Erreur : ' + e.message;
      btn.disabled = false; btn.textContent = 'Enregistrer';
    }
  });
}
