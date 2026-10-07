// js/usager-accueil.js
'use strict';

function _escA(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function renderAccueil(container, inscription, showView) {
  container.innerHTML = '<div class="usager-loading">Chargement…</div>';

  try {
    var resas   = await getUserReservations(inscription.id);

    var annonce = null;
    try {
      annonce = await getActiveAnnonce();
    } catch (e) {
      console.error('Erreur chargement annonce:', e);
    }
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

    var balance = computePassBalance(resas, PASS_QUOTA);
    var saisonDates = await getSaisonDates();
    var seasonOver = today > saisonDates.fin;

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
    var passCard;
    if (seasonOver) {
      var seasonCount = resas.filter(function(r) { return r.statut !== 'annule'; }).length;
      var seasonYear  = saisonDates.fin.slice(0, 4);
      passCard = '<div class="usager-summary-card">'
        +   '<div class="usager-summary-label">Saison ' + seasonYear + '</div>'
        +   '<div class="usager-summary-value">' + seasonCount + '</div>'
        +   '<div class="usager-summary-sub">réservation' + (seasonCount > 1 ? 's' : '') + ' effectuée' + (seasonCount > 1 ? 's' : '') + ' cette saison</div>'
        + '</div>';
    } else if (inscription.passActif) {
      passCard = '<div class="usager-summary-card usager-summary-pass">'
        +   '<div class="usager-summary-label">Pass ce mois</div>'
        +   '<div class="usager-summary-value">' + balance.remaining + ' / ' + balance.quota + '</div>'
        +   '<div class="usager-pass-bar-wrap" style="margin-top:8px">'
        +     '<div class="usager-pass-bar-fill ' + fillCls + '" style="width:' + pct + '%"></div>'
        +   '</div>'
        +   '<div class="usager-summary-sub">réservations restantes</div>'
        + '</div>';
    } else {
      passCard = '<div class="usager-summary-card">'
        +   '<div class="usager-summary-label">Pass</div>'
        +   '<div class="usager-summary-value" style="font-size:.9rem;color:#aaa">Non activé</div>'
        +   '<div class="usager-summary-sub">Contactez l\'équipe Handiplage</div>'
        + '</div>';
    }

    var demoBanner = inscription.isDemo
      ? '<div class="usager-demo-banner"><img src="icone%20demo.svg" alt="" style="height:16px;vertical-align:middle;margin-right:7px;filter:brightness(0)invert(1)">Compte démo — vos actions ne seront pas enregistrées</div>'
      : '';

    var annonceHtml = annonce ? _annonceBannerHtml(annonce) : '';

    container.innerHTML = demoBanner
      + annonceHtml
      + '<p style="font-size:.9375rem;color:#555;margin-bottom:14px">Bonjour, <strong>' + _escA(inscription.prenom) + '</strong></p>'
      + '<div class="usager-summary-row">' + nextCard + passCard + '</div>'
      + '<div class="usager-tiles">'
      +   '<div class="usager-tile usager-tile-primary' + (inscription.passActif && !seasonOver ? '' : ' usager-tile-pass-off') + '" data-view="reserver"><div class="usager-tile-icon"><img src="icone%20r%C3%A9server.svg" alt="Réserver"></div><div class="usager-tile-label">Réserver</div>' + (inscription.passActif && !seasonOver ? '' : '<span class="usager-tile-lock">🔒</span>') + '</div>'
      +   '<div class="usager-tile" data-view="reservations"><div class="usager-tile-icon"><img src="icone%20mes%20r%C3%A9servations.svg" alt="Mes réservations"></div><div class="usager-tile-label">Mes réservations</div></div>'
      +   '<div class="usager-tile" data-view="compte"><div class="usager-tile-icon"><img src="icone%20mon%20compte.svg" alt="Mon compte"></div><div class="usager-tile-label">Mon compte</div></div>'
      +   '<div class="usager-tile" data-view="infos"><div class="usager-tile-icon"><img src="icone%20infos.svg" alt="Infos"></div><div class="usager-tile-label">Infos</div></div>'
      +   '<div class="usager-tile" data-view="contact"><div class="usager-tile-icon"><img src="icone%20contact.svg" alt="Contact"></div><div class="usager-tile-label">Contact</div></div>'
      + '</div>';

    var annonceToggle = container.querySelector('.usager-annonce-toggle');
    if (annonceToggle) {
      annonceToggle.addEventListener('click', function() {
        var section   = annonceToggle.closest('.usager-annonce');
        var collapsed = section.classList.toggle('is-collapsed');
        _annonceSetCollapsed(annonce.id, collapsed);
        annonceToggle.setAttribute('aria-expanded', String(!collapsed));
        annonceToggle.querySelector('.usager-annonce-toggle-label').textContent = collapsed ? 'Afficher' : 'Réduire';
      });
    }

    container.querySelectorAll('.usager-tile[data-view]').forEach(function(tile) {
      tile.addEventListener('click', function() { showView(tile.dataset.view); });
    });

  } catch (e) {
    container.innerHTML = '<div class="usager-error">Erreur de chargement : ' + _escA(e.message) + '</div>';
  }
}

var ANNONCE_VUE_KEY = 'handiplage_annonce_vue';
var _annonceNewCache = {};

// "Nouveau" tant que cet appareil n'a pas encore affiché cette annonce ; figé
// pour toute la session de page pour que le badge ne disparaisse pas au
// premier retour sur l'accueil.
function _annonceIsNew(id) {
  if (id in _annonceNewCache) return _annonceNewCache[id];
  var isNew = false;
  try {
    isNew = localStorage.getItem(ANNONCE_VUE_KEY) !== id;
    localStorage.setItem(ANNONCE_VUE_KEY, id);
  } catch (e) { /* stockage indisponible : pas de badge */ }
  _annonceNewCache[id] = isNew;
  return isNew;
}

var ANNONCE_REDUITE_KEY = 'handiplage_annonce_reduite';

// Mémorise la réduction pour CETTE annonce uniquement : une nouvelle annonce
// s'affiche toujours dépliée.
function _annonceIsCollapsed(id) {
  try { return localStorage.getItem(ANNONCE_REDUITE_KEY) === id; } catch (e) { return false; }
}

function _annonceSetCollapsed(id, collapsed) {
  try {
    if (collapsed) localStorage.setItem(ANNONCE_REDUITE_KEY, id);
    else localStorage.removeItem(ANNONCE_REDUITE_KEY);
  } catch (e) { /* stockage indisponible : réduction non mémorisée */ }
}

function _annonceBannerHtml(annonce) {
  var d = new Date(annonce.createdAt);
  var dateCourte  = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  var dateLongue  = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  var collapsed   = _annonceIsCollapsed(annonce.id);
  return '<section class="usager-annonce' + (collapsed ? ' is-collapsed' : '') + '" aria-labelledby="usager-annonce-title">'
    +   '<div class="usager-annonce-aside">'
    +     '<span class="usager-annonce-icon" aria-hidden="true">'
    +       '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    +         '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>'
    +       '</svg>'
    +     '</span>'
    +     '<time class="usager-annonce-date" datetime="' + _escA(annonce.createdAt) + '" aria-label="Publiée le ' + dateLongue + '">' + dateCourte + '</time>'
    +   '</div>'
    +   '<div class="usager-annonce-body">'
    +     '<div class="usager-annonce-hd">'
    +       '<p class="usager-annonce-title" id="usager-annonce-title">Annonce de l\'équipe Handiplage</p>'
    +       (_annonceIsNew(annonce.id) ? '<span class="usager-annonce-new">Nouveau</span>' : '')
    +       '<button type="button" class="usager-annonce-toggle" aria-expanded="' + !collapsed + '" aria-controls="usager-annonce-text">'
    +         '<span class="usager-annonce-toggle-label">' + (collapsed ? 'Afficher' : 'Réduire') + '</span>'
    +         '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>'
    +       '</button>'
    +     '</div>'
    +     '<p class="usager-annonce-text" id="usager-annonce-text">' + _escA(annonce.contenu).replace(/\n/g, '<br>') + '</p>'
    +   '</div>'
    + '</section>';
}

function _formatDateShort(iso) {
  var d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
}

function _creneauLabel(id) {
  var slot = (typeof getSlotById === 'function') ? getSlotById(id) : null;
  return slot ? slot.label : ('Créneau ' + id);
}
