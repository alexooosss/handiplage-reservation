// js/usager-app.js
'use strict';

const UsagerApp = (() => {
  var _inscription = null;

  async function init() {
    var container = document.getElementById('usager-content');
    container.innerHTML = '<div class="usager-loading">Chargement de votre espace…</div>';

    try {
      _inscription = await getUserInscription();
    } catch (e) {
      container.innerHTML = '<div class="usager-error" style="margin:20px">Impossible de charger votre profil : ' + (e.message || e) + '<br>Veuillez vous reconnecter.</div>';
      return;
    }

    if (_inscription.statut !== 'valide') {
      container.innerHTML = '<div class="usager-card" style="text-align:center;padding:32px">'
        + '<div style="font-size:2rem;margin-bottom:12px">⏳</div>'
        + '<div style="font-weight:700;margin-bottom:8px">Votre demande est en cours de traitement</div>'
        + '<div style="color:#666;font-size:.9375rem">Vous recevrez un email dès que votre inscription sera validée par notre équipe.</div>'
        + '</div>';
      return;
    }

    showView('accueil');
  }

  function showView(view, params) {
    var container = document.getElementById('usager-content');
    if (!container || !_inscription) return;

    if (view === 'accueil')           renderAccueil(container, _inscription, showView);
    else if (view === 'reserver')     renderReserver(container, _inscription, showView);
    else if (view === 'reservations') renderReservations(container, _inscription, showView);
    else if (view === 'pass')         renderPass(container, _inscription, showView);
    else if (view === 'compte')       renderCompte(container, _inscription, showView);
  }

  return { init, showView };
})();
