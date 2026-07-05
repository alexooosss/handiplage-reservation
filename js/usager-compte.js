// js/usager-compte.js
'use strict';

function _escC(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function renderCompte(container, inscription, showView) {
  var accompLabels = { aucun: 'Aucun', transfert: 'Aide au transfert', entree_sortie: 'Entrée/sortie de l\'eau', baignade: 'Aide à la baignade' };
  var accomp = Array.isArray(inscription.accompagnement) ? inscription.accompagnement.map(function(a) { return accompLabels[a] || a; }).join(', ') : '—';

  container.innerHTML = '<button class="usager-back" id="back-compte">← Accueil</button>'
    + '<div class="usager-card">'
    +   '<div class="usager-card-title">Mes informations</div>'
    +   _infoRow('Nom',       inscription.nom)
    +   _infoRow('Prénom',    inscription.prenom)
    +   _infoRow('Email',     inscription.mail)
    +   _infoRow('Téléphone', inscription.telephone)
    +   _infoRow('Adresse',   inscription.adresse ? inscription.adresse + ', ' + inscription.codePostal + ' ' + inscription.ville : '—')
    +   _infoRow('Accompagnement', accomp)
    + '</div>'
    + '<div class="usager-card">'
    +   '<div class="usager-card-title">Sécurité</div>'
    +   '<button class="usager-btn usager-btn-ghost" id="btn-change-pwd">Changer mon mot de passe</button>'
    +   '<div id="pwd-form" style="display:none;margin-top:16px">'
    +     '<div style="margin-bottom:10px"><input type="password" id="new-pwd" placeholder="Nouveau mot de passe (8 car. min.)" style="width:100%;padding:12px;border:1.5px solid #ccc;border-radius:8px;font-size:1rem"></div>'
    +     '<div style="margin-bottom:10px"><input type="password" id="new-pwd2" placeholder="Confirmer le mot de passe" style="width:100%;padding:12px;border:1.5px solid #ccc;border-radius:8px;font-size:1rem"></div>'
    +     '<div id="pwd-msg" style="font-size:.875rem;margin-bottom:8px"></div>'
    +     '<button class="usager-btn usager-btn-primary" id="btn-save-pwd">Enregistrer</button>'
    +   '</div>'
    + '</div>';

  container.querySelector('#back-compte').addEventListener('click', function() { showView('accueil'); });

  var btnChangePwd = container.querySelector('#btn-change-pwd');
  var pwdForm      = container.querySelector('#pwd-form');
  btnChangePwd.addEventListener('click', function() {
    pwdForm.style.display = pwdForm.style.display === 'none' ? 'block' : 'none';
  });

  container.querySelector('#btn-save-pwd').addEventListener('click', async function() {
    var pwd  = container.querySelector('#new-pwd').value;
    var pwd2 = container.querySelector('#new-pwd2').value;
    var msgEl = container.querySelector('#pwd-msg');
    msgEl.style.color = '#c62828';
    if (pwd.length < 8) { msgEl.textContent = 'Minimum 8 caractères.'; return; }
    if (pwd !== pwd2)   { msgEl.textContent = 'Les mots de passe ne correspondent pas.'; return; }
    var btn = container.querySelector('#btn-save-pwd');
    btn.disabled = true;
    btn.textContent = 'Enregistrement…';
    try {
      var result = await supabaseClient.auth.updateUser({ password: pwd });
      if (result.error) throw result.error;
      msgEl.style.color = '#2e7d32';
      msgEl.textContent = 'Mot de passe mis à jour.';
      container.querySelector('#new-pwd').value  = '';
      container.querySelector('#new-pwd2').value = '';
      btn.disabled = false;
      btn.textContent = 'Enregistrer';
    } catch (e) {
      msgEl.textContent = 'Erreur : ' + e.message;
      btn.disabled = false;
      btn.textContent = 'Enregistrer';
    }
  });
}

function _infoRow(label, value) {
  return '<div class="usager-info-row"><span class="usager-info-key">' + label + '</span><span class="usager-info-val">' + _escC(value || '—') + '</span></div>';
}
