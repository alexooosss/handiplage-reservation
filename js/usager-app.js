// js/usager-app.js
'use strict';

const DEMO_EMAIL = 'utilisateur.handiplage@gmail.com';

// Démo uniquement : remplace getSaisonDates() (js/supabase-config.js) par une saison
// fictive allant de J-7 à J+60. Toutes les vérifications de l'espace usager (accueil,
// réserver, mes réservations) passent par cette fonction : elles voient la saison ouverte.
// Sans effet sur la base : la démo ne fait que lire, ses réservations sont simulées.
function activerSaisonDemo() {
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  var debut = new Date(); debut.setDate(debut.getDate() - 7);
  var fin   = new Date(); fin.setDate(fin.getDate() + 60);
  var dates = { debut: iso(debut), fin: iso(fin) };
  window.getSaisonDates = function() { return Promise.resolve(dates); };
}

const UsagerApp = (() => {
  var _inscription = null;

  async function init() {
    var container = document.getElementById('usager-content');
    container.innerHTML = '<div class="usager-loading">Chargement de votre espace…</div>';

    var saisonCourante;
    try {
      var results = await Promise.all([getUserInscription(), getSaisonCourante()]);
      _inscription = results[0];
      _inscription.isDemo = (_inscription.mail === DEMO_EMAIL);
      saisonCourante = results[1];
    } catch (e) {
      container.innerHTML = '<div class="usager-error" style="margin:20px">Impossible de charger votre profil : ' + (e.message || e) + '<br>Veuillez vous reconnecter.</div>';
      return;
    }

    // Amélioration progressive : le texte en dur dans le HTML reste affiché
    // si cette requête échoue ou n'a pas encore répondu — pas critique.
    getSaisonDates().then(function(dates) {
      var seasonEl = document.getElementById('usager-sidebar-season');
      if (!seasonEl || !dates.debut || !dates.fin) return;
      var debutLabel = new Date(dates.debut + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
      var finLabel   = new Date(dates.fin   + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
      seasonEl.textContent = debutLabel + ' – ' + finLabel;
    }).catch(function(e) { console.error('getSaisonDates (sidebar):', e); /* repli : texte en dur déjà affiché */ });

    // Compte démo : on montre toujours le site « saison ouverte », quelle que soit la date
    // réelle, et sans étape de renouvellement. Activé APRÈS l'appel du bandeau gauche,
    // qui garde donc les vraies dates de saison.
    if (_inscription.isDemo) activerSaisonDemo();
    var state = _inscription.isDemo ? 'actif' : computeUsagerAccessState(_inscription, saisonCourante);

    if (state === 'refuse' || state === 'premiere_demande') {
      container.innerHTML = '<div class="usager-card" style="text-align:center;padding:32px">'
        + '<div style="font-size:2rem;margin-bottom:12px">⏳</div>'
        + '<div style="font-weight:700;margin-bottom:8px">Votre demande est en cours de traitement</div>'
        + '<div style="color:#666;font-size:.9375rem">Vous recevrez un email dès que votre inscription sera validée par notre équipe.</div>'
        + '</div>';
      return;
    }

    if (state === 'renouvellement_attente') {
      container.innerHTML = '<div class="usager-card" style="text-align:center;padding:32px">'
        + '<div style="font-size:2rem;margin-bottom:12px">⏳</div>'
        + '<div style="font-weight:700;margin-bottom:8px">Votre demande de renouvellement est en cours de traitement</div>'
        + '<div style="color:#666;font-size:.9375rem">Vous recevrez un email dès que votre inscription sera validée par notre équipe.</div>'
        + '</div>';
      return;
    }

    if (state === 'a_renouveler') {
      container.innerHTML = '<div class="usager-card" style="text-align:center;padding:32px">'
        + '<div style="font-size:2rem;margin-bottom:12px">🔄</div>'
        + '<div style="font-weight:700;margin-bottom:8px">Votre inscription doit être renouvelée pour la saison ' + saisonCourante + '</div>'
        + '<div style="color:#666;font-size:.9375rem;margin-bottom:20px">Vos informations restent enregistrées — cliquez ci-dessous pour soumettre votre demande de renouvellement.</div>'
        + '<button class="btn-primary" id="usager-renew-btn">Renouveler mon inscription</button>'
        + '</div>';
      var renewBtn = document.getElementById('usager-renew-btn');
      if (renewBtn) {
        renewBtn.addEventListener('click', async function() {
          renewBtn.disabled = true;
          renewBtn.textContent = 'Envoi en cours…';
          try {
            await requestRenewal();
            await init();
          } catch (e) {
            renewBtn.disabled = false;
            renewBtn.textContent = 'Renouveler mon inscription';
            alert('Erreur : ' + (e.message || e));
          }
        });
      }
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
    else if (view === 'compte')       renderCompte(container, _inscription, showView);
    else if (view === 'infos')        renderInfos(container, _inscription, showView);
    else if (view === 'equipements')  renderEquipements(container, _inscription, showView);
    else if (view === 'contact')      renderContact(container, _inscription, showView);
  }

  return { init, showView };
})();
