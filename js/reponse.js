// js/reponse.js
'use strict';

function initReponsePage() {
  var params  = new URLSearchParams(window.location.search);
  var token   = params.get('token');
  var form    = document.getElementById('reponse-form');
  var errEl   = document.getElementById('reponse-errors');
  var succEl  = document.getElementById('reponse-success');
  var submitBtn = document.getElementById('reponse-submit');

  if (!token) {
    document.getElementById('reponse-content').innerHTML =
      '<p style="color:#c62828;padding:20px">Lien invalide. Vérifiez l\'URL dans votre email.</p>';
    return;
  }

  if (!form) return;

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    var contenu = document.getElementById('f-contenu').value.trim();

    errEl.innerHTML = '';
    errEl.classList.remove('visible');

    if (contenu.length < 10) {
      errEl.innerHTML = '<p>• Votre message doit contenir au moins 10 caractères.</p>';
      errEl.classList.add('visible');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours…';

    try {
      var response = await fetch(window.SUPABASE_CONFIG.url + '/functions/v1/submit-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token, contenu: contenu }),
      });
      var data = await response.json();

      if (!response.ok) {
        errEl.innerHTML = '<p>' + (data.error || 'Erreur lors de l\'envoi.') + '</p>';
        errEl.classList.add('visible');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Envoyer ma réponse';
        return;
      }

      form.style.display = 'none';
      succEl.style.display = 'block';
    } catch (err) {
      errEl.innerHTML = '<p>Erreur réseau. Réessayez.</p>';
      errEl.classList.add('visible');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Envoyer ma réponse';
    }
  });
}
