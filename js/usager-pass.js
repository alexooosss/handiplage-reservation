// js/usager-pass.js
'use strict';

async function renderPass(container, inscription, showView) {
  container.innerHTML = '<div class="usager-loading">Chargement…</div>';

  if (!inscription.passActif) {
    container.innerHTML = '<button class="usager-back" id="back-pass">← Accueil</button>'
      + '<div class="usager-card">'
      +   '<div class="usager-card-title">Mon pass</div>'
      +   '<div class="usager-empty">Votre pass n\'est pas encore activé.<br>Contactez l\'équipe Handiplage.</div>'
      + '</div>';
    container.querySelector('#back-pass').addEventListener('click', function() { showView('accueil'); });
    return;
  }

  try {
    var resas   = await getUserReservations(inscription.id);
    var balance = computePassBalance(resas, PASS_QUOTA_USAGER);
    var pct     = balance.quota > 0 ? Math.round((balance.remaining / balance.quota) * 100) : 0;
    var fillCls = balance.remaining === 0 ? 'empty' : balance.remaining <= 10 ? 'low' : '';

    var today    = new Date();
    var monthKey = balance.monthKey;
    var thisMonthResas = resas.filter(function(r) {
      return r.statut !== 'annule' && r.date && r.date.startsWith(monthKey);
    }).sort(function(a, b) { return a.date < b.date ? 1 : -1; });

    var nextReset  = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    var resetLabel = nextReset.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    var CRENEAU_LABELS_PASS = { 1: 'Matin', 2: 'Matin 2', 3: 'Après-midi', 4: 'Après-midi 2', 5: 'Soir' };

    container.innerHTML = '<button class="usager-back" id="back-pass">← Accueil</button>'
      + '<div class="usager-card">'
      +   '<div class="usager-card-title">Mon pass Handiplage</div>'
      +   '<div class="usager-pass-count">'
      +     '<div class="usager-pass-num">' + balance.remaining + '</div>'
      +     '<div class="usager-pass-denom">/ ' + balance.quota + ' réservations restantes ce mois</div>'
      +   '</div>'
      +   '<div class="usager-pass-bar-wrap"><div class="usager-pass-bar-fill ' + fillCls + '" style="width:' + pct + '%"></div></div>'
      +   '<div class="usager-pass-meta">Réinitialisation le ' + resetLabel + '</div>'
      + '</div>'
      + '<div class="usager-card">'
      +   '<div class="usager-card-title">Utilisées ce mois (' + balance.used + ')</div>'
      +   (thisMonthResas.length === 0
          ? '<div class="usager-empty">Aucune réservation ce mois.</div>'
          : thisMonthResas.map(function(r) {
              var d = new Date(r.date + 'T00:00:00');
              var dateStr = d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' });
              return '<div class="usager-info-row">'
                + '<span class="usager-info-key">' + dateStr + '</span>'
                + '<span class="usager-info-val">' + (CRENEAU_LABELS_PASS[r.creneauId] || 'Créneau ' + r.creneauId) + '</span>'
                + '</div>';
            }).join('')
      )
      + '</div>';

    container.querySelector('#back-pass').addEventListener('click', function() { showView('accueil'); });
  } catch (e) {
    container.innerHTML = '<div class="usager-error">Erreur : ' + e.message + '</div>';
  }
}
