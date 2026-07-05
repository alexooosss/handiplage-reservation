// js/usager-accueil.js
'use strict';

function _escA(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function renderAccueil(container, inscription, showView) {
  container.innerHTML = '<div class="usager-loading">Chargement…</div>';

  try {
    var resas   = await getUserReservations(inscription.id);
    var today   = new Date().toISOString().slice(0, 10);

    var upcoming = resas.filter(function(r) { return r.date >= today && r.statut !== 'annule'; })
      .sort(function(a, b) { return a.date < b.date ? -1 : 1; });
    var next    = upcoming[0] || null;

    var balance = computePassBalance(resas, PASS_QUOTA_USAGER);

    var nextCard = next
      ? '<div class="usager-summary-card">'
      +   '<div class="usager-summary-label">Prochaine réservation</div>'
      +   '<div class="usager-summary-value">' + _formatDateShort(next.date) + '</div>'
      +   '<div class="usager-summary-sub">' + _creneauLabel(next.creneauId)
      +     (next.spotId ? ' · Empl. ' + _escA(next.spotId) : '') + '</div>'
      + '</div>'
      : '<div class="usager-summary-card">'
      +   '<div class="usager-summary-label">Prochaine réservation</div>'
      +   '<div class="usager-summary-value" style="font-size:.9rem;color:#aaa">Aucune prévue</div>'
      + '</div>';

    var pct      = balance.quota > 0 ? Math.round((balance.remaining / balance.quota) * 100) : 0;
    var fillCls  = balance.remaining === 0 ? 'empty' : balance.remaining <= 10 ? 'low' : '';
    var passCard = inscription.passActif
      ? '<div class="usager-summary-card usager-summary-pass">'
      +   '<div class="usager-summary-label">Pass ce mois</div>'
      +   '<div class="usager-summary-value">' + balance.remaining + ' / ' + balance.quota + '</div>'
      +   '<div class="usager-pass-bar-wrap" style="margin-top:8px">'
      +     '<div class="usager-pass-bar-fill ' + fillCls + '" style="width:' + pct + '%"></div>'
      +   '</div>'
      +   '<div class="usager-summary-sub">réservations restantes</div>'
      + '</div>'
      : '<div class="usager-summary-card">'
      +   '<div class="usager-summary-label">Pass</div>'
      +   '<div class="usager-summary-value" style="font-size:.9rem;color:#aaa">Non activé</div>'
      +   '<div class="usager-summary-sub">Contactez l\'équipe Handiplage</div>'
      + '</div>';

    container.innerHTML = ''
      + '<p style="font-size:.9375rem;color:#555;margin-bottom:14px">Bonjour, <strong>' + _escA(inscription.prenom) + '</strong></p>'
      + '<div class="usager-summary-row">' + nextCard + passCard + '</div>'
      + '<div class="usager-tiles">'
      +   '<div class="usager-tile usager-tile-primary" data-view="reserver"><div class="usager-tile-icon">🗓️</div><div class="usager-tile-label">Réserver</div></div>'
      +   '<div class="usager-tile" data-view="reservations"><div class="usager-tile-icon">📄</div><div class="usager-tile-label">Mes réservations</div></div>'
      +   '<div class="usager-tile" data-view="compte"><div class="usager-tile-icon">🪪</div><div class="usager-tile-label">Mon compte</div></div>'
      +   '<div class="usager-tile" data-view="infos"><div class="usager-tile-icon">💡</div><div class="usager-tile-label">Infos</div></div>'
      + '</div>';

    container.querySelectorAll('.usager-tile[data-view]').forEach(function(tile) {
      tile.addEventListener('click', function() { showView(tile.dataset.view); });
    });

  } catch (e) {
    container.innerHTML = '<div class="usager-error">Erreur de chargement : ' + _escA(e.message) + '</div>';
  }
}

function _formatDateShort(iso) {
  var d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
}

function _creneauLabel(id) {
  var labels = { 1: 'Matin', 2: 'Matin 2', 3: 'Après-midi', 4: 'Après-midi 2', 5: 'Soir' };
  return labels[id] || ('Créneau ' + id);
}
