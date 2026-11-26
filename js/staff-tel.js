// js/staff-tel.js
// Interface staff sur téléphone (≤ 640 px) : barre d'onglets en bas, écrans adaptés.
// Couche d'affichage uniquement : toutes les actions passent par les fonctions habituelles
// du site (réserver, placer, fermer la plage…). Sur tablette et ordinateur, rien ne change.
'use strict';

var TEL_MQ = '(max-width: 640px)';
function estTelStaff() {
  return !!(window.matchMedia && window.matchMedia(TEL_MQ).matches);
}

function _telEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _telIso(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function _telSvg(d, t) {
  return '<svg viewBox="0 0 24 24" width="' + (t || 22) + '" height="' + (t || 22) + '" fill="none" stroke="currentColor" stroke-width="2" '
    + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
}
var TEL_ICO = {
  plage:    '<path d="M2 18c2 0 2-1.5 4-1.5S8 18 10 18s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5"/><circle cx="16" cy="7" r="3"/>',
  planning: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  mc:       '<path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7"/>',
  inscrits: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  messages: '<path d="M4 5h16v11H8l-4 4z"/>',
  tel:      '<path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  retour:   '<path d="m15 5-7 7 7 7"/>',
};

// ── Barre d'onglets du bas ─────────────────────────────────────────────────
var TEL_ONGLETS = [
  { vue: 'carte',       label: 'Plage',         ico: 'plage' },
  { vue: 'planning',    label: 'Planning',      ico: 'planning' },
  { vue: 'mc',          label: 'Main courante', ico: 'mc' },
  { vue: 'inscription', label: 'Inscrits',      ico: 'inscrits' },
  { vue: 'messages',    label: 'Messages',      ico: 'messages' },
];
var TEL_VUES_GRAND_ECRAN = ['groupes', 'stats', 'plans'];
var _telVue = 'carte';

function _telInstallerBarre() {
  if (document.getElementById('tel-barre')) return;
  var nav = document.createElement('nav');
  nav.id = 'tel-barre';
  nav.className = 'tel-barre';
  nav.setAttribute('aria-label', 'Sections');
  nav.innerHTML = TEL_ONGLETS.map(function(o) {
    return '<button type="button" class="tel-onglet" data-vue="' + o.vue + '">'
      + _telSvg(TEL_ICO[o.ico]) + '<span>' + o.label + '</span>'
      + (o.vue === 'messages' ? '<span class="tel-pastille" id="tel-pastille" hidden></span>' : '')
      + '</button>';
  }).join('');
  document.body.appendChild(nav);
  nav.addEventListener('click', function(e) {
    var b = e.target.closest('.tel-onglet');
    if (b && typeof App !== 'undefined') App.showView(b.dataset.vue);
  });
  // Pastille des messages : recopie celle de l'en-tête
  var src = document.getElementById('messages-badge');
  if (src) {
    var copier = function() {
      var p = document.getElementById('tel-pastille');
      if (!p) return;
      var visible = src.style.display !== 'none' && src.textContent.trim() !== '';
      p.hidden = !visible;
      p.textContent = src.textContent;
    };
    new MutationObserver(copier).observe(src, { attributes: true, childList: true, characterData: true, subtree: true });
    copier();
  }
  _telMajBarre();
}

function _telMajBarre() {
  document.querySelectorAll('#tel-barre .tel-onglet').forEach(function(b) {
    var on = b.dataset.vue === _telVue;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

document.addEventListener('hp:vue', function(e) {
  _telVue = e.detail;
  _telMajBarre();
  // Groupes, Stats et Plans n'existent pas sur téléphone : retour à la plage
  if (estTelStaff() && TEL_VUES_GRAND_ECRAN.indexOf(_telVue) >= 0 && typeof App !== 'undefined') App.showView('carte');
});

// Passage téléphone ↔ grand écran (rotation, fenêtre redimensionnée) : on redessine la vue
if (window.matchMedia) {
  var _telMq = window.matchMedia(TEL_MQ);
  var _telBascule = function() {
    if (typeof App === 'undefined') return;
    if (!estTelStaff()) { var s = document.getElementById('tel-placer'); if (s) s.remove(); }
    _telPlacerCreneaux();
    App.showView(_telVue);
  };
  if (_telMq.addEventListener) _telMq.addEventListener('change', _telBascule);
  else if (_telMq.addListener) _telMq.addListener(_telBascule);
}

function _telPlacerCreneaux() {
  var nav = document.getElementById('slots-nav');
  if (!nav) return;
  if (estTelStaff()) {
    var header = document.getElementById('app-header');
    if (header && nav.parentNode !== header) header.appendChild(nav);
  } else {
    var route = document.querySelector('#beach-panel .beach-road');
    var fermeture = document.getElementById('fermeture-plan');
    if (route && nav.parentNode !== route) route.insertBefore(nav, fermeture && fermeture.parentNode === route ? fermeture : null);
  }
}

// Hauteur de l'en-tête flottant (téléphone) : sert de marge en haut de chaque onglet
function _telMesurerEntete() {
  var h = document.getElementById('app-header');
  if (!h) return;
  var maj = function() { document.documentElement.style.setProperty('--tel-entete-h', Math.ceil(h.getBoundingClientRect().height) + 'px'); };
  maj();
  if (window.ResizeObserver) new ResizeObserver(maj).observe(h);
  else window.addEventListener('resize', maj);
}

document.addEventListener('DOMContentLoaded', function() {
  _telPlacerCreneaux();
  _telMesurerEntete();
  _telInstallerBarre();
  // Retour depuis le formulaire d'inscription ouvert par le staff : écran Inscrits
  if (location.hash === '#inscrits') {
    history.replaceState(null, '', location.pathname + location.search);
    var essai = 0;
    var ouvrir = setInterval(function() {
      if (typeof App !== 'undefined' && document.getElementById('insc-view')) {
        clearInterval(ouvrir);
        setTimeout(function() { App.showView('inscription'); }, 300);
      } else if (++essai > 40) clearInterval(ouvrir);
    }, 100);
  }
});

// ── Plage : placer quelqu'un sans le plan (feuille des places libres) ─────
// mode : _selectionMode de app.js ({ resa }) ou null ; onPick(spotId) ; onCancel()
function telPlacer(mode, reservations, onPick, onCancel) {
  var ancienne = document.getElementById('tel-placer');
  if (!mode || !estTelStaff() || typeof BEACH_CONFIG === 'undefined') { if (ancienne) ancienne.remove(); return; }
  var resa = mode.resa || {};
  var libre = function(id) { var r = reservations[id]; return !r || r.status === 'free' || r.status === 'departed'; };

  // Places rangée par rangée, comme sur le plan (de haut en bas, de gauche à droite)
  var spots = BEACH_CONFIG.spots.slice().sort(function(a, b) { return a.y - b.y || a.x - b.x; });
  var rangees = [];
  spots.forEach(function(s) {
    var r = rangees[rangees.length - 1];
    if (!r || Math.abs(s.y - r.y) > 20) { r = { y: s.y, spots: [] }; rangees.push(r); }
    r.spots.push(s);
  });
  rangees.forEach(function(r) { r.spots.sort(function(a, b) { return a.x - b.x; }); });
  var nbLibres = spots.filter(function(s) { return libre(s.id); }).length;
  var acc = resa.accompagnants;
  var sousTitre = (typeof acc === 'number' ? (acc === 0 ? 'Seul·e' : acc + ' accompagnant' + (acc > 1 ? 's' : '')) + ' · ' : '')
    + nbLibres + ' place' + (nbLibres > 1 ? 's' : '') + ' libre' + (nbLibres > 1 ? 's' : '');

  var html = '<div class="tel-voile" data-annuler="1"></div>'
    + '<div class="tel-feuille" role="dialog" aria-modal="true" aria-labelledby="tel-placer-t">'
    +   '<div class="tel-poignee" aria-hidden="true"></div>'
    +   '<div class="tel-feuille-hd"><div><h3 id="tel-placer-t">Placer ' + _telEsc((resa.nom || '') + ' ' + (resa.prenom || '')) + '</h3>'
    +     '<p>' + sousTitre + '</p></div>'
    +     '<button type="button" class="tel-feuille-x" data-annuler="1" aria-label="Annuler">✕</button></div>'
    +   '<div class="tel-rangees">'
    +     rangees.map(function(r, i) {
            return '<div class="tel-rangee-t">Rangée ' + (i + 1) + '</div><div class="tel-places">'
              + r.spots.map(function(s) {
                  return libre(s.id)
                    ? '<button type="button" class="tel-pl" data-spot="' + _telEsc(s.id) + '">' + _telEsc(s.id) + '</button>'
                    : '<span class="tel-pl pris" aria-label="' + _telEsc(s.id) + ' occupée">' + _telEsc(s.id) + '</span>';
                }).join('') + '</div>';
          }).join('')
    +   '</div>'
    +   '<button type="button" class="tel-valider" id="tel-placer-ok" disabled>Choisissez une place</button>'
    + '</div>';

  var el = ancienne || document.createElement('div');
  el.id = 'tel-placer';
  el.className = 'tel-placer';
  el.innerHTML = html;
  if (!ancienne) document.body.appendChild(el);

  var choisi = null;
  var ok = el.querySelector('#tel-placer-ok');
  el.querySelectorAll('.tel-pl[data-spot]').forEach(function(b) {
    b.addEventListener('click', function() {
      el.querySelectorAll('.tel-pl.choisi').forEach(function(x) { x.classList.remove('choisi'); });
      b.classList.add('choisi');
      choisi = b.dataset.spot;
      ok.disabled = false;
      ok.textContent = 'Placer en ' + choisi;
    });
  });
  ok.addEventListener('click', function() {
    if (!choisi) return;
    ok.disabled = true;
    el.remove();
    onPick(choisi);
  });
  el.querySelectorAll('[data-annuler]').forEach(function(b) {
    b.addEventListener('click', function() { el.remove(); onCancel(); });
  });
}

// ── Planning : une journée à la fois ───────────────────────────────────────
var _telJour = null;   // jour affiché (AAAA-MM-JJ)

// Changement de jour : les cartes des créneaux partent une à une, puis celles du nouveau jour
// arrivent de l'autre côté (même animation que le Planning sur tablette, voir planning.js)
var TEL_SORTIE = 320, TEL_ENTREE = 420, TEL_DECALAGE = 45;   // millisecondes
function _telReduit() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
function _telSortieJour(container, sens) {
  var cartes = container.querySelectorAll('.tel-cr');
  if (!cartes.length || _telReduit()) return Promise.resolve();
  container.classList.add('pl-anim');
  container.style.setProperty('--pl-dist', Math.round(container.clientWidth * 0.6) + 'px');
  cartes.forEach(function(c, i) { c.style.animationDelay = (i * TEL_DECALAGE) + 'ms'; c.classList.add('pl-sort-' + sens); });
  return new Promise(function(r) { setTimeout(r, TEL_SORTIE + cartes.length * TEL_DECALAGE); });
}
function _telEntreeJour(container, sens) {
  var cartes = container.querySelectorAll('.tel-cr');
  if (!cartes.length) return;
  if (_telReduit()) { container.classList.remove('pl-anim'); return; }
  container.classList.add('pl-anim');
  container.style.setProperty('--pl-dist', Math.round(container.clientWidth * 0.6) + 'px');
  cartes.forEach(function(c, i) { c.style.animationDelay = (i * TEL_DECALAGE) + 'ms'; c.classList.add('pl-entre-' + sens); });
  var id = (container._telAnimId || 0) + 1;
  container._telAnimId = id;
  setTimeout(function() {
    if (container._telAnimId !== id) return;
    container.classList.remove('pl-anim');
    cartes.forEach(function(c) { c.classList.remove('pl-entre-suiv', 'pl-entre-prec'); c.style.animationDelay = ''; });
  }, TEL_ENTREE + cartes.length * TEL_DECALAGE + 80);
}

// anim (facultatif) : { sortie: promesse de fin de sortie, sens: 'suiv' | 'prec' }
async function renderPlanningTel(container, onCellClick, anim) {
  var aujourdhui = _telIso(new Date());
  if (!_telJour) _telJour = aujourdhui;
  var jour = new Date(_telJour + 'T12:00:00');
  var lundi = new Date(jour); lundi.setDate(jour.getDate() - ((jour.getDay() + 6) % 7));
  var jours = [];
  for (var i = 0; i < 7; i++) { var d = new Date(lundi); d.setDate(lundi.getDate() + i); jours.push(d); }
  var debut = _telIso(jours[0]), fin = _telIso(jours[6]);

  var res = await Promise.all([
    getWeekReservationCounts(debut, fin),
    typeof getFermetures === 'function' ? getFermetures(debut, fin).catch(function() { return []; }) : Promise.resolve([]),
    typeof getCapacites === 'function' ? getCapacites(debut, fin).catch(function() { return []; }) : Promise.resolve([]),
  ]);
  var counts = res[0], fermetures = res[1];
  var capaIndex = typeof indexCapacites === 'function' ? indexCapacites(res[2]) : {};
  container._capaIndex = capaIndex;

  var titre = jour.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  titre = titre.charAt(0).toUpperCase() + titre.slice(1);
  var couleurs = typeof SLOT_COLORS !== 'undefined' ? SLOT_COLORS : [];

  var html = '<div class="tel-pl-page">'
    + '<div class="tel-jour"><button type="button" class="tel-fleche" data-dj="-1" aria-label="Jour précédent">‹</button>'
    +   '<b>' + titre + '</b>'
    +   '<button type="button" class="tel-fleche" data-dj="1" aria-label="Jour suivant">›</button></div>'
    + '<div class="tel-semaine">' + jours.map(function(d) {
        var iso = _telIso(d);
        return '<button type="button" class="tel-j' + (iso === _telJour ? ' on' : '') + (iso === aujourdhui ? ' auj' : '') + '" data-jour="' + iso + '">'
          + d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '') + '<b>' + d.getDate() + '</b></button>';
      }).join('') + '</div>'
    + '<div class="tel-auj-ligne">' + (_telJour === aujourdhui
        ? '<span class="tel-auj-tag">Aujourd\'hui</span>'
        : '<button type="button" class="tel-auj" data-jour="' + aujourdhui + '">↩ Revenir à aujourd\'hui</button>') + '</div>'
    // Réservation lancée depuis le profil d'un inscrit : la fenêtre du créneau la reprendra
    + (window._hpUsagerPreselect
        ? '<div class="tel-pour"><span>Réservation pour <b>' + _telEsc(String(window._hpUsagerPreselect.nom || '').toUpperCase() + ' ' + (window._hpUsagerPreselect.prenom || ''))
          + '</b><small>Choisissez le jour, puis touchez un créneau.</small></span>'
          + '<button type="button" class="tel-pour-x" id="tel-pour-x" aria-label="Annuler">✕</button></div>'
        : '');

  SLOTS.forEach(function(slot, idx) {
    var c = (counts[_telJour] && counts[_telJour][slot.id]) || {};
    var cntN = (c.waiting_normal || 0) + (c.arrived_reserved || 0);
    var cntG = (c.waiting_groupe || 0) + (c.arrived_groupe || 0);
    var cap = typeof capaciteDe === 'function' ? capaciteDe(capaIndex, _telJour, slot.id)
            : { usagers: typeof CAPACITY_NORMAL !== 'undefined' ? CAPACITY_NORMAL : 25, groupes: typeof CAPACITY_GROUPE !== 'undefined' ? CAPACITY_GROUPE : 10 };
    var ferme = typeof creneauFerme === 'function' ? creneauFerme(fermetures, _telJour, slot.id) : null;
    var pct = function(n, m) { return m > 0 ? Math.min(100, Math.round(n / m * 100)) : (n > 0 ? 100 : 0); };
    var plein = cap.usagers > 0 && cntN >= cap.usagers;
    html += '<div class="tel-cr' + (ferme ? ' ferme' : '') + '" style="--c:' + (couleurs[idx] || '#1565c0') + '" data-slot="' + slot.id + '" role="button" tabindex="0">'
      + '<div class="tel-cr-hd"><b>' + _telEsc(slot.label) + '</b>'
      +   '<button type="button" class="tel-cr-resa" data-slot="' + slot.id + '">＋ Réserver</button></div>'
      + '<div class="tel-jauges">'
      +   '<div><small>Usagers</small><b class="tel-n' + (plein ? ' plein' : '') + '">' + cntN + '<span>/' + cap.usagers + '</span></b>'
      +     '<div class="tel-piste"><span style="width:' + pct(cntN, cap.usagers) + '%' + (plein ? ';background:#c62828' : '') + '"></span></div></div>'
      +   '<div><small>Groupes</small><b class="tel-n">' + cntG + '<span>/' + cap.groupes + '</span></b>'
      +     '<div class="tel-piste"><span style="width:' + pct(cntG, cap.groupes) + '%"></span></div></div>'
      + '</div>'
      + (ferme ? '<div class="tel-cr-info rouge">Plage fermée' + (ferme.motif ? ' · ' + _telEsc(ferme.motif) : '') + '</div>'
         : plein ? '<div class="tel-cr-info rouge">Complet en ligne</div>' : '')
      + (c.walkins ? '<div class="tel-cr-info">' + c.walkins + ' sans réservation</div>' : '')
      + '</div>';
  });
  html += '<p class="tel-note">Touchez un créneau pour voir et gérer ses réservations.</p></div>';
  if (anim && anim.sortie) await anim.sortie;   // l'ancien jour a fini de partir
  container.innerHTML = html;
  if (anim && anim.sens) _telEntreeJour(container, anim.sens);

  var changerJour = function(iso) {
    if (iso === _telJour) return;
    var sens = iso > _telJour ? 'suiv' : 'prec';
    var sortie = _telSortieJour(container, sens);
    _telJour = iso;
    renderPlanningTel(container, onCellClick, { sortie: sortie, sens: sens }).catch(console.error);
  };
  container.querySelectorAll('[data-dj]').forEach(function(b) {
    b.addEventListener('click', function() {
      var d = new Date(_telJour + 'T12:00:00'); d.setDate(d.getDate() + parseInt(b.dataset.dj, 10));
      changerJour(_telIso(d));
    });
  });
  container.querySelectorAll('[data-jour]').forEach(function(b) {
    b.addEventListener('click', function() { changerJour(b.dataset.jour); });
  });
  var pourX = container.querySelector('#tel-pour-x');
  if (pourX) pourX.addEventListener('click', function() { window._hpUsagerPreselect = null; renderPlanningTel(container, onCellClick).catch(console.error); });
  var slotDe = function(id) { return SLOTS.find(function(s) { return String(s.id) === String(id); }); };
  container.querySelectorAll('.tel-cr').forEach(function(card) {
    var ouvrir = function() { onCellClick(_telJour, slotDe(card.dataset.slot)); };
    card.addEventListener('click', ouvrir);
    card.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir(); } });
  });
  // Glisser vers la gauche / la droite : jour suivant / précédent
  var x0 = null;
  container.ontouchstart = function(e) { x0 = e.touches[0].clientX; };
  container.ontouchend = function(e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) < 70) return;
    var d = new Date(_telJour + 'T12:00:00'); d.setDate(d.getDate() + (dx < 0 ? 1 : -1));
    changerJour(_telIso(d));
  };
}

// ── Inscrits : profil d'une personne ───────────────────────────────────────
var TEL_ACCOMP = { aucun: 'Aucune', transfert: 'Transfert', entree_sortie: 'Entrée et sortie de l\'eau', baignade: 'Baignade (30 min max)' };
var TEL_AIDES  = { tiralo: 'Tiralo', hippocampe: 'Hippocampe', audioplage: 'Audioplage' };

function _telAge(dn) {
  if (!dn || !dn.annee) return null;
  var now = new Date();
  var age = now.getFullYear() - dn.annee;
  if (now.getMonth() + 1 < dn.mois || (now.getMonth() + 1 === Number(dn.mois) && now.getDate() < dn.jour)) age--;
  return age;
}
function _telTelLien(t) { return 'tel:' + String(t || '').replace(/[^0-9+]/g, ''); }
function _telTelAffiche(t) {
  var d = String(t || '').replace(/\D/g, '');
  return d.length === 10 ? d.replace(/(\d{2})(?=\d)/g, '$1 ') : String(t || '');
}

async function telProfil(container, id) {
  var ancien = container.querySelector('.tel-profil');
  if (ancien) ancien.remove();
  var el = document.createElement('div');
  el.className = 'tel-profil';
  el.innerHTML = '<div class="tel-profil-hd"><button type="button" class="tel-retour">' + _telSvg(TEL_ICO.retour, 18) + 'Inscrits</button></div>'
    + '<div class="tel-profil-corps"><p class="tel-note">Chargement…</p></div>';
  container.appendChild(el);
  el.querySelector('.tel-retour').addEventListener('click', function() { el.remove(); });

  var insc, rows, saison;
  try {
    var r = await Promise.all([
      getInscriptionById(id),
      typeof getReservationsForInscription === 'function' ? getReservationsForInscription(id) : Promise.resolve([]),
      typeof getSaisonCourante === 'function' ? getSaisonCourante().catch(function() { return null; }) : Promise.resolve(null),
    ]);
    insc = r[0]; rows = r[1] || []; saison = r[2];
  } catch (err) {
    el.querySelector('.tel-profil-corps').innerHTML = '<p class="tel-note">Impossible d\'ouvrir la fiche : ' + _telEsc(err.message || err) + '</p>';
    return;
  }
  if (!el.isConnected) return;

  var aujourdhui = _telIso(new Date());
  // Statut et pass
  var badge = insc.statut === 'refuse' ? '<span class="tel-badge ko">Refusée</span>'
    : insc.statut !== 'valide' ? '<span class="tel-badge att">En attente</span>'
    : (saison && Number(insc.derniereSaisonValidee) !== Number(saison)) ? '<span class="tel-badge att">À renouveler</span>'
    : '<span class="tel-badge ok">Validée' + (saison ? ' ' + saison : '') + '</span>';
  var passTxt = '';
  if (insc.pass && insc.pass.actif) {
    passTxt = (typeof PASS_QUOTA !== 'undefined' && typeof passUtilise === 'function')
      ? 'Pass ' + Math.max(0, PASS_QUOTA - passUtilise(rows)) + ' / ' + PASS_QUOTA : 'Pass actif';
  }
  // Infos utiles sur la plage
  var dn = insc.dateNaissance;
  var age = _telAge(dn);
  var naissance = dn && dn.annee ? String(dn.jour).padStart(2, '0') + '/' + String(dn.mois).padStart(2, '0') + '/' + dn.annee : '';
  var accomp = (Array.isArray(insc.accompagnement) ? insc.accompagnement : (insc.accompagnement ? [insc.accompagnement] : []))
    .map(function(a) { return TEL_ACCOMP[a] || a; });
  var aides = (Array.isArray(insc.aidesTechniques) ? insc.aidesTechniques : [])
    .filter(function(a) { return a && a !== 'aucun'; }).map(function(a) { return TEL_AIDES[a] || a; });
  var kv = [];
  if (naissance) kv.push(['Naissance', _telEsc(naissance) + (age != null ? ' <em>' + age + ' ans</em>' : '')]);
  if (insc.ville) kv.push(['Ville', _telEsc(insc.ville)]);
  kv.push(['Aide', _telEsc(accomp.length ? accomp.join(', ') : 'Non précisée')]);
  kv.push(['Matériel', _telEsc(aides.length ? aides.join(', ') : 'Aucun')]);
  if (insc.gilet) kv.push(['Gilet', insc.gilet === 'non' ? '<strong class="rouge">Refusé</strong>' : 'Accepté']);

  // Venues de la saison
  var annee = saison ? String(saison) : String(new Date().getFullYear());
  var saisonRows = rows.filter(function(x) { return String(x.date || '').slice(0, 4) === annee; });
  var venues = saisonRows.filter(function(x) { return x.statut === 'present' || x.statut === 'parti'; });
  var absences = saisonRows.filter(function(x) { return x.statut === 'absent'; });
  var aVenir = rows.filter(function(x) { return x.date >= aujourdhui && x.statut === 'attente'; })
    .sort(function(a, b) { return (a.date + a.creneau_id).localeCompare(b.date + b.creneau_id); });
  var passees = rows.filter(function(x) { return x.date < aujourdhui && (x.statut === 'present' || x.statut === 'parti' || x.statut === 'absent'); })
    .sort(function(a, b) { return b.date.localeCompare(a.date); });
  var slotLabel = function(cid) { var s = SLOTS.find(function(z) { return z.id === cid; }); return s ? s.label : ''; };
  var dateCourte = function(iso) { var t = new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }); return t.charAt(0).toUpperCase() + t.slice(1); };

  var initiales = ((insc.prenom || '').charAt(0) + (insc.nom || '').charAt(0)).toUpperCase();
  var html = '<div class="tel-carte tel-fiche">'
    + '<div class="tel-fiche-hd"><span class="tel-av">' + _telEsc(initiales) + '</span><div>'
    +   '<b>' + _telEsc((insc.nom || '').toUpperCase()) + ' ' + _telEsc(insc.prenom || '') + '</b>'
    +   '<div class="tel-badges">' + badge + (passTxt ? '<span class="tel-badge bleu">' + passTxt + '</span>' : '') + '</div></div></div>'
    + (insc.telephone
        ? '<a class="tel-appel" href="' + _telTelLien(insc.telephone) + '">' + _telSvg(TEL_ICO.tel, 18)
          + '<span><b>' + _telEsc(_telTelAffiche(insc.telephone)) + '</b><small>Appeler ' + _telEsc(insc.prenom || '') + '</small></span></a>'
        : '')
    + '<dl class="tel-kv">' + kv.map(function(p) { return '<dt>' + p[0] + '</dt><dd>' + p[1] + '</dd>'; }).join('') + '</dl>'
    + (insc.urgenceNom || insc.urgenceTel
        ? '<div class="tel-urgence"><span><small>Contact d\'urgence</small>' + _telEsc(insc.urgenceNom || '—') + '</span>'
          + (insc.urgenceTel ? '<a class="tel-urg-appel" href="' + _telTelLien(insc.urgenceTel) + '" aria-label="Appeler le contact d\'urgence">' + _telSvg(TEL_ICO.tel, 16) + '</a>' : '')
          + '</div>'
        : '')
    + (insc.statut === 'valide' ? '<button type="button" class="tel-reserver" id="tel-reserver">＋ Réserver pour ' + _telEsc(insc.prenom || 'cette personne') + '</button>' : '')
    + '</div>'
    + '<div class="tel-stats3"><div><b>' + venues.length + '</b><small>venue' + (venues.length > 1 ? 's' : '') + ' cette saison</small></div>'
    +   '<div><b>' + absences.length + '</b><small>absence' + (absences.length > 1 ? 's' : '') + '</small></div>'
    +   '<div><b>' + aVenir.length + '</b><small>à venir</small></div></div>'
    + (aVenir.length
        ? '<div class="tel-titre-sec">À venir</div><div class="tel-carte"><ul class="tel-histo">'
          + aVenir.slice(0, 3).map(function(x) { return '<li><span><b>' + dateCourte(x.date) + '</b> · ' + _telEsc(slotLabel(x.creneau_id)) + '</span></li>'; }).join('')
          + '</ul></div>'
        : '')
    + (passees.length
        ? '<div class="tel-titre-sec">Dernières venues</div><div class="tel-carte"><ul class="tel-histo">'
          + passees.slice(0, 3).map(function(x) {
              var ok = x.statut !== 'absent';
              return '<li><span>' + dateCourte(x.date) + ' · ' + _telEsc(slotLabel(x.creneau_id)) + (x.spot_id ? ' · ' + _telEsc(x.spot_id) : '') + '</span>'
                + '<em class="' + (ok ? '' : 'ko') + '">' + (ok ? 'Présent·e' : 'Absent·e') + '</em></li>';
            }).join('')
          + '</ul></div>'
        : '')
    + '<p class="tel-note">Validation des dossiers et justificatifs : sur la tablette ou l\'ordinateur.</p>';
  el.querySelector('.tel-profil-corps').innerHTML = html;

  var bResa = el.querySelector('#tel-reserver');
  if (bResa) bResa.addEventListener('click', function() {
    // Le Planning s'ouvre ; la fenêtre de réservation reprend cette personne (voir modal.js)
    window._hpUsagerPreselect = { id: insc.id, nom: insc.nom || '', prenom: insc.prenom || '' };
    if (typeof App !== 'undefined') App.showView('planning');
  });
}

if (typeof module !== 'undefined') {
  module.exports = { estTelStaff: estTelStaff, _telAge: _telAge, _telTelAffiche: _telTelAffiche };
}
