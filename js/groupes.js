'use strict';

var _gpSelectedId = null;
var _gpMode       = 'view'; // 'view' | 'edit' | 'new'
var _gpSearch     = '';
var _gpContainer  = null;
var _gpSaison     = [];     // réservations de groupes de la saison (passées + à venir)
var _gpType       = '';     // filtre par type de structure ('' = tous)
var _gpTri        = 'nom';  // 'nom' | 'venue'
var _gpSaisonNum  = null;   // saison en cours (app_config)

// Venues d'un groupe : prochaine prévue, dernière effectuée, nombre de venues effectuées
function _gpSuiviGroupe(g) {
  var today  = _gpTodayISO();
  var venues = _gpVenues(_gpRowsDuGroupe(g, _gpSaison));
  var faites = venues.filter(function(v) { return v.etat === 'venu'; });
  return {
    venues: venues,
    nbVenues: faites.length,
    prochaine: venues.filter(function(v) { return v.etat === 'prevue'; }).sort(function(a, b) { return a.date.localeCompare(b.date); })[0] || null,
    derniere: faites.filter(function(v) { return v.date < today; }).sort(function(a, b) { return b.date.localeCompare(a.date); })[0] || null,
  };
}

// Ouvre le Planning, avec le groupe présélectionné si on en donne un
function _gpPlanifier(g) {
  window._hpGroupePreselect = g ? { id: g.id, nom: String(g.nom).toUpperCase() } : null;
  if (typeof App !== 'undefined') App.showView('planning');
}

// ── Utilitaires ──
function _gpEsc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _gpTodayISO() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function _gpDateLong(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function _gpDateCourt(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}
function _gpSlotLabel(id) {
  var s = typeof SLOTS !== 'undefined' ? SLOTS.find(function(x) { return x.id == id; }) : null;
  return s ? s.label : String(id);
}
function _gpInitiales(nom) {
  return String(nom || '').trim().split(/\s+/).slice(0, 2).map(function(w) { return w.charAt(0).toUpperCase(); }).join('') || '?';
}
function _gpTel(t) {
  var d = String(t || '').replace(/\D/g, '');
  return d.length === 10 ? d.replace(/(\d{2})(?=\d)/g, '$1 ') : t;
}

// Réservations brutes → une entrée par venue (date + créneau)
function _gpVenues(rows) {
  var map = {};
  rows.forEach(function(r) {
    if (r.statut === 'annule') return;
    var k = r.date + '_' + r.creneau_id;
    if (!map[k]) map[k] = { date: r.date, creneauId: r.creneau_id, spots: 0, nb: r.nb_usagers || 0, statuts: [] };
    if (r.spot_id) map[k].spots++;
    map[k].statuts.push(r.statut);
  });
  var today = _gpTodayISO();
  return Object.values(map).map(function(v) {
    v.places = v.spots > 0 ? v.spots : (v.nb || 0);
    var aVenir = v.date >= today && v.statuts.every(function(s) { return s === 'attente'; });
    if (aVenir) v.etat = 'prevue';
    else if (v.statuts.some(function(s) { return s === 'present' || s === 'parti'; })) v.etat = 'venu';
    else if (v.statuts.length && v.statuts.every(function(s) { return s === 'absent'; })) v.etat = 'absent';
    else v.etat = 'nonpointe';
    return v;
  });
}

// Réservations d'un groupe : par identifiant, ou par nom pour les anciennes réservations sans lien
function _gpRowsDuGroupe(g, rows) {
  var nom = String(g.nom || '').toLowerCase();
  return rows.filter(function(r) {
    return r.groupe_id === g.id || (!r.groupe_id && String(r.nom || '').toLowerCase() === nom);
  });
}

function _gpEtatTag(etat) {
  return {
    prevue:    '<span class="gp-st gp-st-up">Prévue</span>',
    venu:      '<span class="gp-st gp-st-ok">Venu</span>',
    absent:    '<span class="gp-st gp-st-ko">Absent</span>',
    nonpointe: '<span class="gp-st gp-st-na">Non pointé</span>',
  }[etat] || '';
}

function _gpVenueRow(v, avecNom) {
  return '<li class="gp-venue' + (v.etat === 'prevue' ? ' gp-venue-up' : '') + '">'
    + '<b class="gp-v-date">' + _gpDateLong(v.date) + '</b>'
    + '<span class="gp-v-slot">' + _gpEsc(_gpSlotLabel(v.creneauId)) + '</span>'
    + '<span class="gp-v-info">' + (avecNom ? '<b>' + _gpEsc(avecNom) + '</b> · ' : '')
    +   (v.places ? v.places + ' place' + (v.places > 1 ? 's' : '') : '—') + '</span>'
    + _gpEtatTag(v.etat)
    + '</li>';
}

// ── Rendu principal ──
async function renderGroupes(container, selectedId) {
  _gpContainer  = container;
  _gpSelectedId = selectedId || null;
  _gpMode       = 'view';
  _gpSearch     = '';

  container.innerHTML = `
    <div class="groupes-wrap">
      <div class="groupes-sidebar">
        <div class="groupes-sidebar-top">
          <div class="gp-sidebar-hd">
            <h2 class="gp-sidebar-title">Groupes</h2>
            <button type="button" class="gp-dash-link" id="gp-dash-btn" hidden>Vue d'ensemble</button>
          </div>
          <button id="gp-new-btn" class="btn-primary gp-new-btn">＋ Nouveau groupe</button>
          <input type="search" id="gp-search" class="gp-search-input" placeholder="Nom, commune, type…" aria-label="Rechercher un groupe">
          <div class="gp-liste-barre">
            <span class="insc-nb" id="gp-nb" aria-live="polite"></span>
            <label class="insc-tri"><span class="sr-only">Type de structure</span><select id="gp-type"></select></label>
            <label class="insc-tri"><span class="sr-only">Trier</span><select id="gp-tri">
              <option value="nom">Nom A → Z</option><option value="venue">Dernière venue</option></select></label>
          </div>
        </div>
        <div id="gp-list" class="gp-list"></div>
      </div>
      <div id="gp-detail" class="groupes-detail"></div>
    </div>
  `;

  document.getElementById('gp-search').addEventListener('input', function(e) {
    _gpSearch = e.target.value;
    _gpRenderList();
  });
  document.getElementById('gp-tri').value = _gpTri;
  document.getElementById('gp-tri').addEventListener('change', function(e) { _gpTri = e.target.value; _gpRenderList(); });
  document.getElementById('gp-type').addEventListener('change', function(e) { _gpType = e.target.value; _gpRenderList(); });
  if (typeof getSaisonCourante === 'function') {
    getSaisonCourante().then(function(s) {
      _gpSaisonNum = s;
      if (_gpContainer === container && !_gpSelectedId && _gpMode === 'view') _gpRenderDetail(null);
    }).catch(function() {});
  }
  document.getElementById('gp-new-btn').addEventListener('click', function() {
    _gpSelectedId = null;
    _gpMode = 'new';
    _gpRenderList();
    _gpRenderDetail(null);
  });
  document.getElementById('gp-dash-btn').addEventListener('click', function() {
    _gpSelectedId = null;
    _gpMode = 'view';
    _gpRenderList();
    _gpRenderDetail(null);
  });

  _gpRenderList();
  _gpRenderDetail(_gpSelectedId ? getCachedGroupes().find(function(x) { return x.id === _gpSelectedId; }) : null);

  // Venues de la saison (liste de gauche + vue d'ensemble), chargées en arrière-plan
  if (typeof getGroupeReservationsSaison === 'function') {
    try { _gpSaison = await getGroupeReservationsSaison(); } catch (e) { _gpSaison = []; }
    if (_gpContainer !== container) return;
    _gpRenderList();
    if (!_gpSelectedId && _gpMode === 'view') _gpRenderDetail(null);
  }
}

function _gpRenderList() {
  var listEl = document.getElementById('gp-list');
  if (!listEl) return;
  var tous    = getCachedGroupes();
  var groupes = tous;
  var search  = _gpSearch.toLowerCase().trim();

  // Liste des types présents (menu « Tous les types »)
  var typeSel = document.getElementById('gp-type');
  if (typeSel) {
    var types = Array.from(new Set(tous.map(function(g) { return g.typeStructure; }))).sort();
    if (_gpType && types.indexOf(_gpType) < 0) _gpType = '';
    typeSel.innerHTML = '<option value="">Tous les types</option>'
      + types.map(function(t) { return '<option value="' + _gpEsc(t) + '"' + (t === _gpType ? ' selected' : '') + '>' + _gpEsc(t) + '</option>'; }).join('');
  }
  if (_gpType) groupes = groupes.filter(function(g) { return g.typeStructure === _gpType; });
  if (search) {
    groupes = groupes.filter(function(g) {
      return g.nom.toLowerCase().includes(search)
        || g.typeStructure.toLowerCase().includes(search)
        || g.commune.toLowerCase().includes(search)
        || g.referentNom.toLowerCase().includes(search);
    });
  }
  var dashBtn = document.getElementById('gp-dash-btn');
  if (dashBtn) dashBtn.hidden = !(_gpSelectedId || _gpMode === 'new');

  var nbEl = document.getElementById('gp-nb');
  if (nbEl) nbEl.textContent = groupes.length + ' groupe' + (groupes.length > 1 ? 's' : '');

  if (groupes.length === 0) {
    listEl.innerHTML = '<div class="gp-list-empty">' + (search || _gpType ? 'Aucun résultat' : 'Aucun groupe inscrit') + '</div>';
    return;
  }
  var suivis = {};
  groupes.forEach(function(g) { suivis[g.id] = _gpSuiviGroupe(g); });
  groupes = groupes.slice().sort(_gpTri === 'venue'
    ? function(a, b) {
        var da = suivis[a.id].derniere ? suivis[a.id].derniere.date : '', db = suivis[b.id].derniere ? suivis[b.id].derniere.date : '';
        return db.localeCompare(da) || String(a.nom).localeCompare(String(b.nom), 'fr');
      }
    : function(a, b) { return String(a.nom).localeCompare(String(b.nom), 'fr'); });
  listEl.innerHTML = groupes.map(function(g) {
    var s = suivis[g.id], proch = s.prochaine, derniere = s.derniere;
    var nb = s.nbVenues ? s.nbVenues + ' venue' + (s.nbVenues > 1 ? 's' : '') + ' · ' : '';
    var suivi = proch
      ? nb + '<span class="gp-list-next">Prochaine : ' + _gpDateCourt(proch.date) + '</span>'
      : derniere ? nb + 'Dernière : ' + _gpDateCourt(derniere.date)
      : 'Aucune venue cette saison';
    var active = g.id === _gpSelectedId ? ' active' : '';
    return '<div class="gp-list-item' + active + '" data-id="' + _gpEsc(g.id) + '" tabindex="0" role="button">'
      + '<div class="gp-list-nom">' + _gpEsc(g.nom) + '</div>'
      + '<div class="gp-list-meta"><span class="gp-type-pill">' + _gpEsc(g.typeStructure) + '</span>'
      +   (g.commune ? '<span class="gp-cap">' + _gpEsc(g.commune) + '</span>' : '') + '</div>'
      + '<div class="gp-list-suivi">' + suivi + '</div>'
      + '</div>';
  }).join('');

  listEl.querySelectorAll('.gp-list-item').forEach(function(el) {
    function ouvrir() {
      _gpSelectedId = el.dataset.id;
      _gpMode = 'view';
      _gpRenderList();
      _gpRenderDetail(getCachedGroupes().find(function(x) { return x.id === _gpSelectedId; }));
    }
    el.addEventListener('click', ouvrir);
    el.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir(); } });
  });
}

function _gpRenderDetail(groupe) {
  var detailEl = document.getElementById('gp-detail');
  if (!detailEl) return;
  if (_gpMode === 'new' || _gpMode === 'edit') {
    _gpRenderForm(detailEl, groupe);
  } else if (groupe) {
    _gpRenderView(detailEl, groupe);
  } else {
    _gpRenderOverview(detailEl);
  }
}

// ── Vue d'ensemble (aucun groupe sélectionné) ──
function _gpRenderOverview(el) {
  var groupes = getCachedGroupes();
  var today   = _gpTodayISO();
  var dans14  = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

  // Une venue par groupe + date + créneau
  var toutes = [];
  groupes.forEach(function(g) {
    _gpVenues(_gpRowsDuGroupe(g, _gpSaison)).forEach(function(v) { v.groupe = g; toutes.push(v); });
  });
  // Réservations de groupes non rattachées à un groupe inscrit
  var rattachees = new Set();
  groupes.forEach(function(g) { _gpRowsDuGroupe(g, _gpSaison).forEach(function(r) { rattachees.add(r); }); });
  var orphelines = _gpSaison.filter(function(r) { return !rattachees.has(r); });
  var parNom = {};
  orphelines.forEach(function(r) { (parNom[r.nom || '—'] = parNom[r.nom || '—'] || []).push(r); });
  Object.keys(parNom).forEach(function(n) {
    _gpVenues(parNom[n]).forEach(function(v) { v.groupe = { nom: n }; toutes.push(v); });
  });

  var passees  = toutes.filter(function(v) { return v.etat === 'venu'; });
  var places   = passees.reduce(function(s, v) { return s + (v.places || 0); }, 0);
  var aVenir   = toutes.filter(function(v) { return v.etat === 'prevue'; }).sort(function(a, b) { return (a.date + a.creneauId).localeCompare(b.date + b.creneauId); });
  var recentes = passees.filter(function(v) { return v.date < today; }).sort(function(a, b) { return b.date.localeCompare(a.date); });

  // Suivi par groupe inscrit : venus au moins une fois, à relancer
  var suivis = groupes.map(function(g) { var s = _gpSuiviGroupe(g); s.groupe = g; return s; });
  var venus  = suivis.filter(function(s) { return s.nbVenues > 0; }).length;
  var il30j  = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  var aRelancer = suivis.filter(function(s) { return !s.prochaine && (!s.derniere || s.derniere.date < il30j); })
    .sort(function(a, b) { return (a.derniere ? a.derniere.date : '').localeCompare(b.derniere ? b.derniere.date : ''); });

  // Chiffres clés : une rangée compacte, même présentation que l'onglet Inscription
  var kpi = function(cls, n, l, s) {
    return '<div class="idb-kpi ' + cls + '"><span class="idb-kpi-n">' + n + '</span><span class="idb-kpi-l">' + l + '</span><span class="idb-kpi-s">' + s + '</span></div>';
  };
  var types = Array.from(new Set(groupes.map(function(g) { return g.typeStructure; }))).slice(0, 4).join(', ');
  var proch = aVenir[0];
  var btnPlanif = '<button type="button" class="gp-btn-pri gp-planif" data-planif="">＋ Planifier une venue</button>';
  var saison = _gpSaisonNum || new Date().getFullYear();

  el.innerHTML = '<div class="gp-page">'
    + '<div class="gp-page-hd"><h2>Groupes — saison ' + saison + '</h2><p>Vue d\'ensemble des structures et de leurs venues</p></div>'
    + '<div class="idb-kpis">'
    +   kpi('k-new', groupes.length, 'Groupes inscrits', _gpEsc(types) || '—')
    +   kpi('k-ok', venus + '<small>/' + groupes.length + '</small>', 'Groupes déjà venus', 'au moins une fois cette saison')
    +   kpi('k-ok', passees.length, 'Venues cette saison', places + ' place' + (places > 1 ? 's' : '') + ' occupée' + (places > 1 ? 's' : ''))
    +   kpi('k-wait', proch ? '<span class="gp-kpi-jour">' + new Date(proch.date + 'T12:00:00').getDate() + '</span>' : '—', 'Prochaine venue',
          proch ? _gpEsc(_gpDateCourt(proch.date)) + ' · ' + _gpEsc(proch.groupe.nom) : 'aucune prévue')
    + '</div>'
    + '<section class="gp-card"><div class="gp-card-hd"><h2 class="gp-card-t">Prochaines venues de groupes</h2>' + btnPlanif + '</div>'
    +   (aVenir.length
          ? '<ul class="gp-venues">' + aVenir.slice(0, 12).map(function(v) { return _gpVenueRow(v, v.groupe.nom); }).join('') + '</ul>'
          : '<p class="gp-empty">Aucune venue de groupe prévue pour l\'instant.</p>')
    + '</section>'
    + '<div class="idb-cols">'
    +   '<section class="gp-card"><h2 class="gp-card-t">À relancer</h2>'
    +     '<p class="gp-card-sub">Pas de venue prévue, et pas venus depuis plus d\'un mois</p>'
    +     (aRelancer.length
            ? '<ul class="gp-relance">' + aRelancer.slice(0, 8).map(function(s) {
                var g = s.groupe;
                return '<li class="gp-relance-row">'
                  + '<button type="button" class="gp-relance-who" data-ouvrir="' + _gpEsc(g.id) + '"><b>' + _gpEsc(g.nom) + '</b>'
                  +   '<small>' + _gpEsc(g.typeStructure) + ' · ' + (s.derniere ? 'Dernière venue : ' + _gpEsc(_gpDateCourt(s.derniere.date)) : 'Aucune venue cette saison') + '</small></button>'
                  + (g.referentTel ? '<a class="gp-relance-tel" href="tel:' + _gpEsc(g.referentTel.replace(/\s/g, '')) + '" title="Appeler ' + _gpEsc(g.referentNom || g.nom) + '">' + _gpEsc(_gpTel(g.referentTel)) + '</a>' : '')
                  + '<button type="button" class="gp-relance-planif" data-planif="' + _gpEsc(g.id) + '">Planifier</button>'
                  + '</li>';
              }).join('') + '</ul>'
              + (aRelancer.length > 8 ? '<p class="gp-empty">et ' + (aRelancer.length - 8) + ' autre' + (aRelancer.length - 8 > 1 ? 's' : '') + '</p>' : '')
            : '<p class="gp-empty">Aucun groupe à relancer : tous sont venus récemment ou ont une venue prévue. ✓</p>')
    +   '</section>'
    +   '<section class="gp-card"><h2 class="gp-card-t">Dernières venues</h2>'
    +     (recentes.length
            ? '<ul class="gp-venues">' + recentes.slice(0, 6).map(function(v) { return _gpVenueRow(v, v.groupe.nom); }).join('') + '</ul>'
            : '<p class="gp-empty">Aucune venue de groupe cette saison.</p>')
    +   '</section>'
    + '</div>'
    + '</div>';

  el.querySelectorAll('[data-planif]').forEach(function(b) {
    b.addEventListener('click', function() {
      _gpPlanifier(b.dataset.planif ? groupes.find(function(g) { return g.id === b.dataset.planif; }) : null);
    });
  });
  el.querySelectorAll('[data-ouvrir]').forEach(function(b) {
    b.addEventListener('click', function() {
      _gpSelectedId = b.dataset.ouvrir;
      _gpMode = 'view';
      _gpRenderList();
      _gpRenderDetail(groupes.find(function(g) { return g.id === _gpSelectedId; }));
    });
  });
}

// ── Fiche d'un groupe ──
function _gpRenderView(el, g) {
  el.innerHTML = `
    <div class="gp-page">
      <div class="gp-fiche-hd">
        <h2 class="gp-detail-nom">${_gpEsc(g.nom)}</h2>
        <span class="gp-type-pill gp-type-pill-lg">${_gpEsc(g.typeStructure)}</span>
        <span class="gp-sp"></span>
        <button type="button" class="gp-btn-sec" id="gp-edit-btn">Modifier</button>
        <button type="button" class="gp-btn-pri" id="gp-book-btn">＋ Réserver un créneau</button>
      </div>
      <div class="gp-fiche-grid">
        <section class="gp-card">
          <h2 class="gp-card-t">Contact</h2>
          ${g.referentNom ? `
          <div class="gp-ref">
            <span class="gp-avatar" aria-hidden="true">${_gpEsc(_gpInitiales(g.referentNom))}</span>
            <div><b class="gp-cap">${_gpEsc(g.referentNom)}</b><small>Référent du groupe</small></div>
          </div>` : '<p class="gp-empty">Aucun référent renseigné.</p>'}
          ${(g.referentTel || g.referentEmail) ? `<div class="gp-ctas">
            ${g.referentTel ? `<a class="gp-cta" href="tel:${_gpEsc(g.referentTel.replace(/\s/g, ''))}"><span aria-hidden="true">📞</span> ${_gpEsc(_gpTel(g.referentTel))}</a>` : ''}
            ${g.referentEmail ? `<a class="gp-cta" href="mailto:${_gpEsc(g.referentEmail)}" title="${_gpEsc(g.referentEmail)}"><span aria-hidden="true">✉</span> Écrire un e-mail</a>` : ''}
          </div>` : ''}
          <dl class="gp-kv">
            ${g.commune ? `<dt>Commune</dt><dd class="gp-cap">${_gpEsc(g.commune)}</dd>` : ''}
            ${g.referentEmail ? `<dt>E-mail</dt><dd>${_gpEsc(g.referentEmail)}</dd>` : ''}
            ${g.createdAt ? `<dt>Inscrit depuis</dt><dd>${new Date(g.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</dd>` : ''}
          </dl>
          ${g.notes ? `<div class="gp-notes"><b>Notes :</b> ${_gpEsc(g.notes)}</div>` : ''}
          <button type="button" class="gp-del-link" id="gp-delete-btn">Supprimer ce groupe</button>
        </section>
        <section class="gp-card">
          <h2 class="gp-card-t">Venues</h2>
          <div id="gp-history" class="gp-history"><div class="gp-empty">Chargement…</div></div>
        </section>
      </div>
    </div>
  `;

  document.getElementById('gp-edit-btn').addEventListener('click', function() {
    _gpMode = 'edit';
    _gpRenderList();
    _gpRenderForm(el, g);
  });

  document.getElementById('gp-book-btn').addEventListener('click', function() {
    // Le Planning s'ouvre avec ce groupe présélectionné dans la fenêtre de réservation
    window._hpGroupePreselect = { id: g.id, nom: String(g.nom).toUpperCase() };
    if (typeof App !== 'undefined') App.showView('planning');
  });

  document.getElementById('gp-delete-btn').addEventListener('click', async function() {
    if (!confirm('Supprimer le groupe « ' + g.nom + ' » ? Cette action est irréversible.')) return;
    try {
      await deleteGroupe(g.id);
      _gpSelectedId = null;
      _gpMode = 'view';
      _gpRenderList();
      _gpRenderDetail(null);
    } catch (e) {
      alert('Erreur : ' + (e.message || 'inconnue'));
    }
  });

  _gpLoadHistory(g);
}

async function _gpLoadHistory(g) {
  var histEl = document.getElementById('gp-history');
  if (!histEl) return;
  try {
    var rows    = await getReservationsForGroupe(g.id, g.nom);
    if (_gpSelectedId !== g.id) return;
    var venues  = _gpVenues(rows);
    var annee   = String(new Date().getFullYear());
    var saison  = venues.filter(function(v) { return v.date.slice(0, 4) === annee; });
    var venus   = saison.filter(function(v) { return v.etat === 'venu'; });
    var places  = venus.reduce(function(s, v) { return s + (v.places || 0); }, 0);
    var aVenir  = venues.filter(function(v) { return v.etat === 'prevue'; }).sort(function(a, b) { return (a.date + a.creneauId).localeCompare(b.date + b.creneauId); });
    var passees = venues.filter(function(v) { return v.etat !== 'prevue'; }).sort(function(a, b) { return (b.date + b.creneauId).localeCompare(a.date + a.creneauId); });
    var proch   = aVenir[0];

    histEl.innerHTML = '<div class="gp-kpis">'
      +   '<div class="gp-kpi"><span class="gp-kpi-n k-blue">' + venus.length + '</span><span class="gp-kpi-l">Venues</span><span class="gp-kpi-s">cette saison</span></div>'
      +   '<div class="gp-kpi"><span class="gp-kpi-n k-green">' + places + '</span><span class="gp-kpi-l">Places occupées</span><span class="gp-kpi-s">cette saison</span></div>'
      +   '<div class="gp-kpi"><span class="gp-kpi-n k-orange gp-kpi-date">' + (proch ? new Date(proch.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '—') + '</span>'
      +     '<span class="gp-kpi-l">Prochaine venue</span><span class="gp-kpi-s">' + (proch ? _gpEsc(_gpSlotLabel(proch.creneauId)) : 'aucune prévue') + '</span></div>'
      + '</div>'
      + (aVenir.length ? '<h3 class="gp-grp">À venir</h3><ul class="gp-venues">' + aVenir.map(function(v) { return _gpVenueRow(v); }).join('') + '</ul>' : '')
      + '<h3 class="gp-grp">Passées</h3>'
      + (passees.length
          ? '<ul class="gp-venues">' + passees.map(function(v) { return _gpVenueRow(v); }).join('') + '</ul>'
          : '<p class="gp-empty">Aucune venue enregistrée.</p>');
  } catch (e) {
    if (histEl) histEl.innerHTML = '<p class="gp-empty">Erreur de chargement des venues.</p>';
  }
}

// ── Formulaire création / modification ──
function _gpRenderForm(el, g) {
  var isNew = !g;
  var types = ['FAM', 'EHPAD', 'ESAT', 'Association', 'École', 'Autre'];
  el.innerHTML = `
    <div class="gp-page">
      <h2 class="gp-form-title">${isNew ? 'Nouveau groupe' : 'Modifier · ' + _gpEsc(g.nom)}</h2>
      <div class="gp-card gp-form">
        <div class="gf-row">
          <div class="gf-group" style="flex:2">
            <label for="gf-nom">Nom du groupe <span class="req">*</span></label>
            <input type="text" id="gf-nom" value="${g ? _gpEsc(g.nom) : ''}" placeholder="Ex : FAM Les Hauts d'Antibes">
          </div>
          <div class="gf-group">
            <label for="gf-type">Type de structure <span class="req">*</span></label>
            <select id="gf-type">
              ${types.map(function(t) {
                return '<option value="' + t + '"' + (g && g.typeStructure === t ? ' selected' : (!g && t === 'Autre' ? ' selected' : '')) + '>' + t + '</option>';
              }).join('')}
            </select>
          </div>
        </div>
        <div class="gf-row">
          <div class="gf-group">
            <label for="gf-referent-nom">Référent (nom)</label>
            <input type="text" id="gf-referent-nom" value="${g ? _gpEsc(g.referentNom) : ''}" autocomplete="off">
          </div>
          <div class="gf-group">
            <label for="gf-referent-tel">Référent (téléphone)</label>
            <input type="tel" id="gf-referent-tel" value="${g ? _gpEsc(g.referentTel) : ''}" inputmode="tel">
          </div>
          <div class="gf-group">
            <label for="gf-referent-email">Référent (e-mail)</label>
            <input type="email" id="gf-referent-email" value="${g ? _gpEsc(g.referentEmail) : ''}" inputmode="email">
          </div>
        </div>
        <div class="gf-row">
          <div class="gf-group">
            <label for="gf-commune">Commune</label>
            <input type="text" id="gf-commune" value="${g ? _gpEsc(g.commune) : ''}">
          </div>
        </div>
        <div class="gf-row">
          <div class="gf-group" style="flex:1">
            <label for="gf-notes">Notes</label>
            <textarea id="gf-notes" rows="3" placeholder="Besoins spécifiques, créneaux préférentiels…">${g ? _gpEsc(g.notes) : ''}</textarea>
          </div>
        </div>
        <div id="gf-error" class="gf-error" role="alert"></div>
        <div class="gf-actions">
          <button type="button" id="gf-cancel" class="gp-btn-sec">Annuler</button>
          <button type="button" id="gf-save" class="gp-btn-pri">Enregistrer</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('gf-cancel').addEventListener('click', function() {
    _gpMode = 'view';
    if (isNew) _gpSelectedId = null;
    _gpRenderList();
    _gpRenderDetail(isNew ? null : g);
  });

  document.getElementById('gf-save').addEventListener('click', async function() {
    var nom   = document.getElementById('gf-nom').value.trim();
    var errEl = document.getElementById('gf-error');
    if (!nom) { errEl.textContent = 'Le nom du groupe est obligatoire.'; return; }

    var data = {
      nom:           nom,
      typeStructure: document.getElementById('gf-type').value,
      referentNom:   document.getElementById('gf-referent-nom').value.trim(),
      referentTel:   document.getElementById('gf-referent-tel').value.trim(),
      referentEmail: document.getElementById('gf-referent-email').value.trim(),
      commune:       document.getElementById('gf-commune').value.trim(),
      notes:         document.getElementById('gf-notes').value.trim(),
    };

    try {
      var saved;
      if (isNew) {
        saved = await createGroupe(data);
        _gpSelectedId = saved.id;
      } else {
        saved = await updateGroupe(g.id, data);
      }
      _gpMode = 'view';
      _gpRenderList();
      _gpRenderDetail(saved);
    } catch (e) {
      errEl.textContent = 'Erreur : ' + (e.message || 'inconnue');
    }
  });
}

if (typeof module !== 'undefined') {
  module.exports = { renderGroupes };
}
