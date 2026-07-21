// js/usager-accueil.js
'use strict';

function _escA(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function renderAccueil(container, inscription, showView) {
  container.innerHTML = '<div class="usager-loading">Chargement…</div>';

  try {
    var resas   = await getUserReservations(inscription.id);
    var now     = new Date();
    var today   = now.getFullYear() + '-'
      + String(now.getMonth() + 1).padStart(2, '0') + '-'
      + String(now.getDate()).padStart(2, '0');
    var nowMin  = now.getHours() * 60 + now.getMinutes();

    var upcoming = resas.filter(function(r) {
      if (r.statut === 'annule') return false;
      if (r.date < today) return false;
      if (r.date === today && typeof getSlotById === 'function') {
        var slot = getSlotById(r.creneauId);
        if (slot) {
          var ep = slot.end.split(':').map(Number);
          if (nowMin >= ep[0] * 60 + ep[1]) return false;
        }
      }
      return true;
    }).sort(function(a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.creneauId || 0) - (b.creneauId || 0);
    });
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
      +   '<div class="usager-tile usager-tile-primary" data-view="reserver"><div class="usager-tile-icon"><img src="icone%20r%C3%A9server.svg" alt="Réserver"></div><div class="usager-tile-label">Réserver</div></div>'
      +   '<div class="usager-tile" data-view="reservations"><div class="usager-tile-icon"><img src="icone%20mes%20r%C3%A9servations.svg" alt="Mes réservations"></div><div class="usager-tile-label">Mes réservations</div></div>'
      +   '<div class="usager-tile" data-view="compte"><div class="usager-tile-icon"><img src="icone%20mon%20compte.svg" alt="Mon compte"></div><div class="usager-tile-label">Mon compte</div></div>'
      +   '<div class="usager-tile" data-view="infos"><div class="usager-tile-icon"><img src="icone%20infos.svg" alt="Infos"></div><div class="usager-tile-label">Infos</div></div>'
      +   '<div class="usager-tile" data-view="contact"><div class="usager-tile-icon"><img src="icone%20contact.svg" alt="Contact"></div><div class="usager-tile-label">Contact</div></div>'
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
  var slot = (typeof getSlotById === 'function') ? getSlotById(id) : null;
  return slot ? slot.label : ('Créneau ' + id);
}
