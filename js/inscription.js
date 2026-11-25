'use strict';

function _escI(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Justificatifs : aperçu dans la fiche staff ──
// Les fichiers viennent du formulaire public (contenu non fiable) : on n'affiche/ouvre que
// des images bitmap et des PDF en base64 strict. Pas de SVG ni de HTML, qui pourraient
// exécuter du script une fois ouverts dans un onglet du site.
var _DOC_IMG_RE = /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/;
var _DOC_PDF_RE = /^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/;

function _docKind(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  if (_DOC_IMG_RE.test(dataUrl)) return 'image';
  if (_DOC_PDF_RE.test(dataUrl)) return 'pdf';
  return null;
}

function _renderDocPreview(dataUrl, name, key, aVerifier) {
  if (!name) return '';
  var kind  = _docKind(dataUrl);
  var thumb = kind === 'image'
    ? '<img src="' + dataUrl + '" alt="Aperçu : ' + _escI(name) + '" class="insc-doc-thumb">'
    : '<span class="insc-doc-thumb insc-doc-thumb-file">' + (kind === 'pdf' ? 'PDF' : '?') + '</span>';
  return '<div class="insc-file-existing insc-doc-card" id="' + key + '-existing">'
    +   (kind ? '<button type="button" class="insc-doc-open insc-doc-thumb-btn" data-doc="' + key + '" title="Ouvrir en grand">' + thumb + '</button>' : thumb)
    +   '<div class="insc-doc-meta">'
    +     '<span class="insc-doc-name">' + _escI(name) + '</span>'
    +     (kind
          ? (aVerifier
              ? '<button type="button" class="insc-doc-open insc-doc-verify" data-doc="' + key + '">Vérifier le justificatif</button>'
              : '<button type="button" class="insc-doc-open insc-doc-open-link" data-doc="' + key + '">Ouvrir en grand</button>')
          : '<span class="insc-doc-unavailable">Aperçu indisponible (format non pris en charge)</span>')
    +   '</div>'
    +   '<button type="button" class="insc-file-del" id="del-' + key + '" title="Supprimer ce document">✕</button>'
    + '</div>';
}

// ── Statut du justificatif (stocké dans metadata.justificatifStatut) ──
// 'valide' | 'refuse' | absent (= à vérifier).
// Les inscriptions déjà validées avant cette règle sont considérées comme vérifiées.
function _justifStatut(v) {
  if (v.justificatifStatut === 'valide' || v.justificatifStatut === 'refuse') return v.justificatifStatut;
  if (!v.justificatifStatut && v.statut === 'valide' && (v.justificatif1Name || v.justificatif2Name)) return 'valide';
  return 'a_verifier';
}
function _hasJustif(v) { return !!(v.justificatif1Name || v.justificatif2Name); }

async function _saveJustifStatut(v, statut) {
  const newMeta = Object.assign({}, v);
  ['id','nom','prenom','mail','telephone','statut','pass','createdAt','updatedAt'].forEach(function(k) { delete newMeta[k]; });
  newMeta.justificatifStatut = statut;
  await updateInscription(v.id, { metadata: newMeta });
  v.justificatifStatut = statut;
  const light = (typeof _inscListe !== 'undefined' ? _inscListe : []).find(function(i) { return i.id === v.id; });
  if (light) light.justificatifStatut = statut;
}

// Temps réel : met à jour la liste (et le tableau de bord s'il est affiché) sans fermer la fiche ouverte
async function refreshInscriptionListe(container) {
  if (!container || !document.getElementById('insc-list')) return;
  await _refreshSidebar(container);
  const mainEl = document.getElementById('insc-main');
  if (mainEl && mainEl.querySelector('.idb')) {
    _showInscDashboard(container, _inscListe, await getSaisonCourante());
  }
}

// Données binaires d'un data: URL déjà vérifié → URL blob (pour le PDF dans la visionneuse)
function _docBlobUrl(dataUrl) {
  var comma = dataUrl.indexOf(',');
  var mime  = dataUrl.slice(5, dataUrl.indexOf(';'));
  var bin   = atob(dataUrl.slice(comma + 1));
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

// ── Visionneuse plein écran : lire le justificatif puis valider / refuser l'inscription ──
// opts : { v, key: 'doc1'|'doc2', onDecision(statut) }
function _openDocViewer(opts) {
  var v = opts.v;
  var docs = [
    { key: 'doc1', label: 'Document principal', data: v.justificatif1, name: v.justificatif1Name },
    { key: 'doc2', label: 'Deuxième document',  data: v.justificatif2, name: v.justificatif2Name },
  ].filter(function(d) { return d.name && _docKind(d.data); });
  if (!docs.length) return;
  var idx = Math.max(0, docs.findIndex(function(d) { return d.key === opts.key; }));
  var rot = 0, zoom = false, blobUrl = null;

  var js        = _justifStatut(v);
  var statutLbl = { valide: 'Valable', refuse: 'Refusé' }[js] || 'À vérifier';
  var statutCls = js === 'valide' ? 'ok' : js === 'refuse' ? 'ko' : 'wait';
  var personne  = ((v.nom || '').toUpperCase() + ' ' + (v.prenom || '')).trim();

  var dlg = document.createElement('dialog');
  dlg.className = 'doc-viewer';
  dlg.setAttribute('aria-label', 'Justificatif de ' + personne);
  dlg.innerHTML =
      '<div class="dv-bar">'
    +   '<div class="dv-titre">'
    +     '<b>' + _escI(personne) + '</b>'
    +     '<span class="dv-statut dv-statut-' + statutCls + '">Justificatif : ' + statutLbl + '</span>'
    +   '</div>'
    +   (docs.length > 1
          ? '<div class="dv-tabs" role="tablist">' + docs.map(function(d, i) {
              return '<button type="button" role="tab" class="dv-tab" data-i="' + i + '">' + d.label + '</button>';
            }).join('') + '</div>'
          : '')
    +   '<div class="dv-tools">'
    +     '<button type="button" class="dv-tool" id="dv-rot" title="Pivoter de 90°" aria-label="Pivoter de 90 degrés">⟳</button>'
    +     '<button type="button" class="dv-tool" id="dv-zoom" title="Taille réelle / ajuster" aria-label="Zoom">⤢</button>'
    +   '</div>'
    +   '<button type="button" class="dv-close" id="dv-close" aria-label="Fermer">✕</button>'
    + '</div>'
    + '<div class="dv-stage" id="dv-stage"></div>'
    + '<div class="dv-foot">'
    +   '<span class="dv-nom" id="dv-nom"></span>'
    +   '<div class="dv-actions">'
    +     '<button type="button" class="dv-btn dv-refuser" id="dv-refuser"' + (js === 'refuse' ? ' disabled' : '') + '>✗ Refuser le justificatif</button>'
    +     '<button type="button" class="dv-btn dv-valider" id="dv-valider"' + (js === 'valide' ? ' disabled' : '') + '>✓ Justificatif valable</button>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(dlg);

  var stage = dlg.querySelector('#dv-stage');
  function show() {
    var d = docs[idx];
    if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
    rot = 0; zoom = false;
    var kind = _docKind(d.data);
    dlg.querySelector('#dv-rot').hidden  = kind !== 'image';
    dlg.querySelector('#dv-zoom').hidden = kind !== 'image';
    if (kind === 'image') {
      stage.innerHTML = '<img class="dv-img" alt="' + _escI(d.label + ' — ' + d.name) + '">';
      var img = stage.querySelector('img');
      img.src = d.data;
      img.draggable = false;
      // Vue ajustée : un clic zoome sur le point cliqué. Vue zoomée : glisser déplace,
      // double-clic revient à la vue ajustée.
      img.addEventListener('click', function(e) { if (!zoom) zoomAt(e); });
    } else {
      blobUrl = _docBlobUrl(d.data);
      stage.innerHTML = '<iframe class="dv-pdf" title="' + _escI(d.label) + '"></iframe>';
      stage.querySelector('iframe').src = blobUrl;
    }
    applyView();
    dlg.querySelector('#dv-nom').textContent = d.label + ' · ' + d.name;
    dlg.querySelectorAll('.dv-tab').forEach(function(t) {
      var on = parseInt(t.dataset.i) === idx;
      t.classList.toggle('on', on);
      t.setAttribute('aria-selected', on);
    });
  }
  function applyView() {
    var img = stage.querySelector('.dv-img');
    if (!img) return;
    stage.classList.toggle('zoom', zoom);
    img.style.transform = rot ? 'rotate(' + rot + 'deg)' : '';
    img.classList.toggle('quart', rot % 180 !== 0);
  }
  function toggleZoom() { zoom = !zoom; applyView(); }

  // Zoom centré sur le point cliqué
  function zoomAt(e) {
    var img = stage.querySelector('.dv-img');
    var r = img.getBoundingClientRect();
    var fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    zoom = true; applyView();
    stage.scrollLeft = fx * stage.scrollWidth  - stage.clientWidth  / 2;
    stage.scrollTop  = fy * stage.scrollHeight - stage.clientHeight / 2;
  }

  // Outil « main » : glisser pour se déplacer dans l'image zoomée (souris, doigt, stylet)
  var drag = null;
  stage.addEventListener('pointerdown', function(e) {
    if (!zoom || e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, sl: stage.scrollLeft, st: stage.scrollTop };
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('grabbing');
    e.preventDefault();
  });
  stage.addEventListener('pointermove', function(e) {
    if (!drag) return;
    stage.scrollLeft = drag.sl - (e.clientX - drag.x);
    stage.scrollTop  = drag.st - (e.clientY - drag.y);
  });
  function endDrag() { drag = null; stage.classList.remove('grabbing'); }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('dblclick', function() { if (zoom) toggleZoom(); });
  function close() {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    if (dlg.open) dlg.close();
    dlg.remove();
  }

  dlg.querySelectorAll('.dv-tab').forEach(function(t) {
    t.addEventListener('click', function() { idx = parseInt(t.dataset.i); show(); });
  });
  dlg.querySelector('#dv-rot').addEventListener('click', function() { rot = (rot + 90) % 360; applyView(); });
  dlg.querySelector('#dv-zoom').addEventListener('click', toggleZoom);
  dlg.querySelector('#dv-close').addEventListener('click', close);
  dlg.addEventListener('cancel', function(e) { e.preventDefault(); close(); });   // Échap
  dlg.addEventListener('click', function(e) { if (e.target === dlg) close(); });  // clic sur le fond
  dlg.querySelector('#dv-valider').addEventListener('click', function() {
    close();
    if (opts.onDecision) opts.onDecision('valide');
  });
  dlg.querySelector('#dv-refuser').addEventListener('click', function() {
    close();
    if (opts.onDecision) opts.onDecision('refuse');
  });

  show();
  dlg.showModal();
  dlg.querySelector('#dv-close').focus();
}

// Liste légère (sans les justificatifs) partagée par la liste, la recherche et le tableau de bord
var _inscListe = [];

async function _loadInscListe() {
  _inscListe = (typeof getInscriptionsListe === 'function') ? await getInscriptionsListe() : await getInscriptions();
  return _inscListe;
}

// Ouvre la fiche : ne télécharge que CETTE inscription (avec ses justificatifs)
async function _openInscFiche(container, id) {
  const mainEl = document.getElementById('insc-main');
  if (mainEl) mainEl.innerHTML = '<div class="insc-loading" role="status">Chargement de la fiche…</div>';
  _openInscFiche._req = id;
  const insc = (typeof getInscriptionById === 'function')
    ? await getInscriptionById(id)
    : (await getInscriptions()).find(function(i) { return i.id === id; });
  if (_openInscFiche._req !== id) return null;   // un autre clic a eu lieu entre-temps
  if (insc) _showForm(container, insc);
  return insc;
}

// ── Vue principale ──
async function renderInscription(container, selectedId) {
  const [inscriptions, saisonCourante, saisonDates] = await Promise.all([_loadInscListe(), getSaisonCourante(), getSaisonDates()]);

  container.innerHTML = '<div class="insc-layout">'
    + '<div class="insc-sidebar">'
    +   '<div class="insc-sidebar-hd">'
    +     '<div class="insc-sidebar-top"><h2 class="insc-sidebar-title">Inscriptions</h2>'
    +       '<button type="button" class="insc-dash-link" id="insc-dash-btn" hidden>Vue d\'ensemble</button></div>'
    +     '<input type="search" id="insc-search" class="insc-search-inp" placeholder="Rechercher…">'
    +     '<button class="btn-primary" id="insc-new-btn">＋ Nouvelle inscription</button>'
    +     '<button class="btn-secondary" id="insc-open-season-btn" style="margin-top:8px">Ouvrir la saison ' + (saisonCourante + 1) + '</button>'
    +     '<div style="font-size:.8125rem;color:#666;margin-top:6px">Saison en cours : ' + saisonCourante + '</div>'
    +   '</div>'
    +   '<div id="insc-list" class="insc-list">' + _renderListItems(inscriptions, '') + '</div>'
    + '</div>'
    + '<div class="insc-main" id="insc-main"></div>'
    + '</div>';

  // Partie droite : tableau de bord tant qu'aucune inscription n'est ouverte
  _showInscDashboard(container, inscriptions, saisonCourante);

  document.getElementById('insc-search').addEventListener('input', async function() {
    const q = this.value.toLowerCase();
    document.getElementById('insc-list').innerHTML = _renderListItems(_inscListe, q);
    _bindListItems(container);
  });

  document.getElementById('insc-dash-btn').addEventListener('click', function() {
    _openInscFiche._req = null;
    _showInscDashboard(container, _inscListe, saisonCourante);
  });

  document.getElementById('insc-new-btn').addEventListener('click', function() {
    _showForm(container, null);
  });

  document.getElementById('insc-open-season-btn').addEventListener('click', function() {
    openOpenSeasonModal(saisonCourante, saisonDates, async function(dates) {
      try {
        await ouvrirNouvelleSaison(dates.debut, dates.fin);
        await renderInscription(container, selectedId);
      } catch (e) {
        alert('Erreur lors de l\'ouverture de la saison : ' + (e.message || e));
      }
    });
  });

  _bindListItems(container);

  if (selectedId) {
    var target = container.querySelector('.insc-list-item[data-id="' + selectedId + '"]');
    if (target) { target.click(); target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  }
}

// ── Tableau de bord (partie droite quand aucune fiche n'est ouverte) ──
function _fmtJM(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
}

async function _showInscDashboard(container, inscriptions, saison) {
  const mainEl = document.getElementById('insc-main');
  if (!mainEl) return;
  const dashBtn = document.getElementById('insc-dash-btn');
  if (dashBtn) dashBtn.hidden = true;
  container.querySelectorAll('.insc-list-item').forEach(function(e) { e.classList.remove('active'); });

  const nom   = i => _escI((i.nom || '').toUpperCase()) + ' ' + _escI(i.prenom || '');
  const nbDoc = i => (i.justificatif1Name ? 1 : 0) + (i.justificatif2Name ? 1 : 0);

  const attente  = inscriptions.filter(i => !i.statut || i.statut === 'en_attente');
  const valides  = inscriptions.filter(i => i.statut === 'valide');
  const refuses  = inscriptions.filter(i => i.statut === 'refuse');
  const aVerif   = attente.filter(i => _hasJustif(i) && _justifStatut(i) === 'a_verifier');
  const aValider = attente.filter(i => _justifStatut(i) === 'valide');
  const sansDoc  = attente.filter(i => !_hasJustif(i));
  const il7j     = Date.now() - 7 * 86400000;
  const nouvelles = inscriptions.filter(i => i.createdAt && new Date(i.createdAt).getTime() >= il7j);
  const recentes = inscriptions.slice()
    .filter(i => i.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  // Réponses d'usagers reçues après un refus (non lues), depuis Messages
  let reponses = [];
  if (typeof getMessages === 'function') {
    try {
      reponses = (await getMessages()).filter(m => m.contenu && !m.lu && !m.sujet);
    } catch (e) { reponses = []; }
  }

  const tagStatut = i => i.statut === 'valide' ? '<span class="insc-status insc-status-ok">Validé</span>'
                     : i.statut === 'refuse' ? '<span class="insc-status insc-status-ko">Refusé</span>'
                     : '<span class="insc-status insc-status-wait">En attente</span>';

  const ligne = (who, sub, btn) =>
      '<li class="idb-row">'
    +   '<div class="idb-who"><b>' + who + '</b><small>' + sub + '</small></div>'
    +   btn
    + '</li>';

  let groupes = '';
  if (aVerif.length) {
    groupes += '<h3 class="idb-grp">Justificatif à vérifier</h3><ul class="idb-list">'
      + aVerif.map(i => ligne(nom(i), 'Demande reçue le ' + _fmtJM(i.createdAt) + ' · ' + nbDoc(i) + ' document' + (nbDoc(i) > 1 ? 's' : ''),
          '<button type="button" class="idb-act idb-act-verif" data-id="' + i.id + '" data-verif="1">Vérifier le justificatif</button>')).join('')
      + '</ul>';
  }
  if (aValider.length) {
    groupes += '<h3 class="idb-grp">Justificatif valable — inscription à valider</h3><ul class="idb-list">'
      + aValider.map(i => ligne(nom(i), 'Demande reçue le ' + _fmtJM(i.createdAt),
          '<button type="button" class="idb-act idb-act-open" data-id="' + i.id + '">Ouvrir la fiche</button>')).join('')
      + '</ul>';
  }
  if (sansDoc.length) {
    groupes += '<h3 class="idb-grp">En attente sans justificatif</h3><ul class="idb-list">'
      + sansDoc.map(i => ligne(nom(i), 'Demande reçue le ' + _fmtJM(i.createdAt) + ' · aucun document joint',
          '<button type="button" class="idb-act idb-act-open" data-id="' + i.id + '">Ouvrir la fiche</button>')).join('')
      + '</ul>';
  }
  if (reponses.length) {
    groupes += '<h3 class="idb-grp">Réponse reçue après un refus</h3><ul class="idb-list">'
      + reponses.map(m => {
          const extrait = (m.contenu || '').replace(/\s+/g, ' ').slice(0, 60);
          return ligne(_escI((m.nom || '').toUpperCase()) + ' ' + _escI(m.prenom || ''),
            '« ' + _escI(extrait) + ((m.contenu || '').length > 60 ? '…' : '') + ' » · ' + _fmtJM(m.createdAt),
            '<button type="button" class="idb-act idb-act-msg" data-msg="1">Lire la réponse</button>');
        }).join('')
      + '</ul>';
  }
  const nbTraiter = aVerif.length + aValider.length + sansDoc.length + reponses.length;

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  mainEl.innerHTML = '<div class="idb">'
    + '<div class="idb-hd"><h2>Inscriptions — saison ' + saison + '</h2><p>' + today + ' · ce qu\'il reste à faire</p></div>'

    + '<div class="idb-kpis">'
    +   '<div class="idb-kpi k-wait"><span class="idb-kpi-n">' + attente.length + '</span><span class="idb-kpi-l">En attente</span>'
    +     '<span class="idb-kpi-s">' + (aVerif.length ? 'dont ' + aVerif.length + ' justificatif' + (aVerif.length > 1 ? 's' : '') + ' à vérifier' : 'aucun justificatif à vérifier') + '</span></div>'
    +   '<div class="idb-kpi k-ok"><span class="idb-kpi-n">' + valides.length + '</span><span class="idb-kpi-l">Validées</span>'
    +     '<span class="idb-kpi-s">pass actifs</span></div>'
    +   '<div class="idb-kpi k-ko"><span class="idb-kpi-n">' + refuses.length + '</span><span class="idb-kpi-l">Refusées</span>'
    +     '<span class="idb-kpi-s">' + (reponses.length ? reponses.length + ' réponse' + (reponses.length > 1 ? 's' : '') + ' reçue' + (reponses.length > 1 ? 's' : '') : 'aucune réponse en attente') + '</span></div>'
    +   '<div class="idb-kpi k-new"><span class="idb-kpi-n">' + nouvelles.length + '</span><span class="idb-kpi-l">Nouvelles demandes</span>'
    +     '<span class="idb-kpi-s">ces 7 derniers jours</span></div>'
    + '</div>'

    + '<div class="idb-cols">'
    +   '<section class="idb-card"><h2 class="idb-card-t">À traiter <span class="idb-count' + (nbTraiter ? '' : ' zero') + '">' + nbTraiter + '</span></h2>'
    +     (groupes || '<p class="idb-empty">Rien à traiter pour l\'instant. ✓</p>')
    +   '</section>'
    +   '<section class="idb-card"><h2 class="idb-card-t">Dernières demandes reçues</h2>'
    +     (recentes.length
            ? '<ul class="idb-list">' + recentes.map(i =>
                '<li class="idb-row idb-row-click" data-id="' + i.id + '" tabindex="0" role="button">'
              +   '<div class="idb-who"><b>' + nom(i) + '</b><small>' + nbDoc(i) + ' document' + (nbDoc(i) > 1 ? 's' : '') + ' joint' + (nbDoc(i) > 1 ? 's' : '') + '</small></div>'
              +   tagStatut(i) + '<span class="idb-when">' + _fmtJM(i.createdAt) + '</span>'
              + '</li>').join('') + '</ul>'
            : '<p class="idb-empty">Aucune demande pour l\'instant.</p>')
    +     '<button type="button" class="idb-maplink" id="idb-map">Voir la carte des usagers →</button>'
    +   '</section>'
    + '</div>'
    + '</div>';

  // Ouvrir une fiche (et éventuellement directement la visionneuse du justificatif)
  async function ouvrir(id, verif) {
    const item = container.querySelector('.insc-list-item[data-id="' + id + '"]');
    container.querySelectorAll('.insc-list-item').forEach(function(e) { e.classList.remove('active'); });
    if (item) { item.classList.add('active'); item.scrollIntoView({ block: 'nearest' }); }
    try {
      const insc = await _openInscFiche(container, id);
      if (insc && verif) {
        const b = document.querySelector('#insc-main .insc-doc-verify');
        if (b) b.click();
      }
    } catch (err) {
      mainEl.innerHTML = '<div class="insc-loading">Impossible d\'ouvrir la fiche : ' + _escI(err.message || String(err)) + '</div>';
    }
  }
  mainEl.querySelectorAll('.idb-act[data-id]').forEach(b => b.addEventListener('click', () => ouvrir(b.dataset.id, b.dataset.verif === '1')));
  mainEl.querySelectorAll('.idb-row-click').forEach(r => {
    r.addEventListener('click', () => ouvrir(r.dataset.id, false));
    r.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir(r.dataset.id, false); } });
  });
  mainEl.querySelectorAll('.idb-act-msg').forEach(b => b.addEventListener('click', () => { if (typeof App !== 'undefined') App.showView('messages'); }));
  const mapBtn = document.getElementById('idb-map');
  if (mapBtn) mapBtn.addEventListener('click', () => { if (typeof App !== 'undefined') App.showView('stats'); });
}

function _renderListItems(list, query) {
  const filtered = list
    .filter(i => (i.nom + ' ' + i.prenom).toLowerCase().includes(query))
    .sort((a, b) => a.nom.localeCompare(b.nom));

  if (filtered.length === 0) {
    return '<div class="insc-list-empty">Aucune inscription trouvée</div>';
  }

  return filtered.map(function(i) {
    const dob = i.dateNaissance
      ? String(i.dateNaissance.jour).padStart(2,'0') + '/' + String(i.dateNaissance.mois).padStart(2,'0') + '/' + i.dateNaissance.annee
      : '';
    const sCls = i.statut === 'valide' ? 'insc-status-ok' : i.statut === 'refuse' ? 'insc-status-ko' : 'insc-status-wait';
    const sLbl = i.statut === 'valide' ? 'Validé' : i.statut === 'refuse' ? 'Refusé' : 'En attente';
    return '<div class="insc-list-item" data-id="' + i.id + '">'
      + '<div class="insc-list-name">' + _escI(i.nom) + ' ' + _escI(i.prenom) + '</div>'
      + (dob ? '<div class="insc-list-meta">Né·e le ' + dob + '</div>' : '')
      + '<span class="insc-status ' + sCls + '">' + sLbl + '</span>'
      + '</div>';
  }).join('');
}

function _bindListItems(container) {
  container.querySelectorAll('.insc-list-item').forEach(function(el) {
    el.addEventListener('click', async function() {
      container.querySelectorAll('.insc-list-item').forEach(function(e) { e.classList.remove('active'); });
      el.classList.add('active');
      try {
        await _openInscFiche(container, el.dataset.id);
      } catch (err) {
        const mainEl = document.getElementById('insc-main');
        if (mainEl) mainEl.innerHTML = '<div class="insc-loading">Impossible d\'ouvrir la fiche : ' + _escI(err.message || String(err)) + '</div>';
      }
    });
  });
}

// ── Formulaire ──
function _showForm(container, insc) {
  const isNew = !insc;
  const v     = insc || {};
  const dob   = v.dateNaissance || {};
  const aides = v.aidesTechniques || [];
  const mainEl = document.getElementById('insc-main');
  if (!mainEl) return;
  // Une fiche est ouverte : proposer le retour à la vue d'ensemble
  const dashBtn = document.getElementById('insc-dash-btn');
  if (dashBtn) dashBtn.hidden = false;

  const currentYear = new Date().getFullYear();
  let yearOpts  = '<option value="">Année</option>';
  for (let y = currentYear - 5; y >= 1920; y--) yearOpts += '<option value="' + y + '"' + (dob.annee == y ? ' selected' : '') + '>' + y + '</option>';
  let monthOpts = '<option value="">Mois</option>';
  for (let m = 1; m <= 12; m++) monthOpts += '<option value="' + m + '"' + (dob.mois == m ? ' selected' : '') + '>' + String(m).padStart(2,'0') + '</option>';
  let dayOpts   = '<option value="">Jour</option>';
  for (let d = 1; d <= 31; d++) dayOpts += '<option value="' + d + '"' + (dob.jour == d ? ' selected' : '') + '>' + String(d).padStart(2,'0') + '</option>';

  const chk  = function(val, opt) { return val === opt ? ' checked' : ''; };
  // Pour les <option> : l'attribut est « selected » (« checked » est ignoré et la liste
  // affichait toujours sa 1re option, « En attente », même pour un dossier validé/refusé)
  const sel  = function(val, opt) { return val === opt ? ' selected' : ''; };
  const chkA = function(opt) { return aides.includes(opt) ? ' checked' : ''; };
  const chkB = function(b) { return b ? ' checked' : ''; };
  const noneAide   = aides.length === 0 || aides.includes('aucun');
  const contactPref = Array.isArray(v.contactPreference) ? v.contactPreference : (v.contactPreference ? [v.contactPreference] : []);
  const accompPref  = Array.isArray(v.accompagnement)    ? v.accompagnement    : (v.accompagnement    ? [v.accompagnement]    : ['aucun']);

  mainEl.innerHTML = '<div class="insc-form-wrap">'
    + '<div class="insc-form-header">'
    +   '<h2>' + (isNew ? 'Nouvelle inscription' : 'Inscription — ' + _escI(v.nom) + ' ' + _escI(v.prenom)) + '</h2>'
    +   (!isNew ? '<div class="insc-form-status-sel"><label>Statut :</label><select id="insc-statut"><option value="en_attente"' + ((!v.statut || v.statut === 'en_attente') ? ' selected' : '') + '>En attente</option><option value="valide"' + sel(v.statut,'valide') + ((_justifStatut(v) !== 'valide' && v.statut !== 'valide') ? ' disabled' : '') + '>Validé ✓</option><option value="refuse"' + sel(v.statut,'refuse') + '>Refusé ✗</option></select>'
    +   '<span class="insc-statut-hint" id="insc-statut-hint"' + ((_justifStatut(v) === 'valide' || v.statut === 'valide') ? ' hidden' : '') + '>'
    +     (_hasJustif(v)
            ? 'Validation possible après vérification du justificatif. <button type="button" class="insc-hint-link" id="insc-hint-verify">Vérifier maintenant</button>'
            : 'Aucun justificatif joint : validation impossible.')
    +   '</span></div>'
    + '<div id="refus-block" style="' + (v.statut === 'refuse' ? '' : 'display:none') + ';margin-top:10px"><textarea id="refus-motif" placeholder="Motif du refus (justificatif non valable, etc.)" rows="3" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:13px;resize:vertical"></textarea><button type="button" id="btn-send-refusal" style="margin-top:6px;padding:7px 14px;background:#e53935;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px">✉ Ouvrir le modèle d\'email de refus</button></div>'
    : '')
    +   '<div class="insc-invite-msg" style="display:none;color:green;font-size:12px;margin-top:4px"></div>'
    + '</div>'
    + (!isNew && v.statut === 'valide' ? _renderPassBlock(v) : '')
    + (!isNew && v.statut === 'valide' ? '<div id="absence-block-wrap"></div>' : '')
    + (!isNew ? '<div class="insc-history-section"><div class="insc-section-title">Historique des réservations</div><div id="insc-history-list" class="insc-history-list"><em class="insc-history-loading">Chargement…</em></div></div>' : '')
    + '<form id="insc-form" class="insc-form">'

    // IDENTITÉ
    + '<div class="insc-section">'
    +   '<div class="insc-section-title">Identité</div>'
    +   '<div class="insc-row">'
    +     '<div class="insc-field"><label>Nom <span class="req">*</span></label><input type="text" id="f-nom" value="' + _escI(v.nom) + '" placeholder="NOM" style="text-transform:uppercase"></div>'
    +     '<div class="insc-field"><label>Prénom <span class="req">*</span></label><input type="text" id="f-prenom" value="' + _escI(v.prenom) + '" placeholder="Prénom"></div>'
    +   '</div>'
    +   '<div class="insc-row">'
    +     '<div class="insc-field"><label>Date de naissance <span class="req">*</span></label><div class="insc-dob"><select id="f-dob-j">' + dayOpts + '</select><span>/</span><select id="f-dob-m">' + monthOpts + '</select><span>/</span><select id="f-dob-y">' + yearOpts + '</select></div></div>'
    +     '<div class="insc-field"><label>Téléphone <span class="req">*</span></label><input type="text" id="f-tel" value="' + _escI(v.telephone) + '" placeholder="Ex : 06 00 00 00 00, +39 …"></div>'
    +   '</div>'
    +   '<div class="insc-row">'
    +     '<div class="insc-field"><label>Adresse mail <span class="req">*</span></label><input type="email" id="f-mail" value="' + _escI(v.mail) + '" placeholder="adresse@mail.fr"></div>'
    +     '<div class="insc-field"><label>Confirmation du mail <span class="req">*</span></label><input type="email" id="f-mail2" value="' + _escI(v.mailConfirm) + '" placeholder="adresse@mail.fr"></div>'
    +   '</div>'
    +   '<div class="insc-field"><label>Modalité de contact préférée <span class="req">*</span></label>'
    +     '<div class="insc-check-group">'
    +       '<label class="insc-check"><input type="checkbox" name="contact" value="telephone"' + (contactPref.includes('telephone') ? ' checked' : '') + '> Téléphone</label>'
    +       '<label class="insc-check"><input type="checkbox" name="contact" value="mail"' + (contactPref.includes('mail') ? ' checked' : '') + '> Mail</label>'
    +     '</div></div>'
    + '</div>'

    // ADRESSE
    + '<div class="insc-section">'
    +   '<div class="insc-section-title">Adresse</div>'
    +   '<div class="insc-field"><label>Adresse <span class="req">*</span></label><input type="text" id="f-adresse" value="' + _escI(v.adresse) + '" placeholder="N° et nom de la voie"></div>'
    +   '<div class="insc-row">'
    +     '<div class="insc-field insc-field-sm"><label>Code postal <span class="req">*</span></label><input type="text" id="f-cp" value="' + _escI(v.codePostal) + '" placeholder="06600"></div>'
    +     '<div class="insc-field"><label>Ville <span class="req">*</span></label><input type="text" id="f-ville" value="' + _escI(v.ville) + '" placeholder="Antibes"></div>'
    +     '<div class="insc-field insc-field-sm"><label>Pays <span class="req">*</span></label><input type="text" id="f-pays" value="' + _escI(v.pays || 'France') + '" placeholder="France"></div>'
    +   '</div>'
    + '</div>'

    // URGENCE
    + '<div class="insc-section">'
    +   '<div class="insc-section-title">Contact d\'urgence</div>'
    +   '<div class="insc-row">'
    +     '<div class="insc-field"><label>Nom et prénom <span class="req">*</span></label><input type="text" id="f-urg-nom" value="' + _escI(v.urgenceNom) + '" placeholder="Prénom NOM"></div>'
    +     '<div class="insc-field"><label>Téléphone <span class="req">*</span></label><input type="text" id="f-urg-tel" value="' + _escI(v.urgenceTel) + '" placeholder="Ex : 06 00 00 00 00, +39 …"></div>'
    +   '</div>'
    + '</div>'

    // BESOINS
    + '<div class="insc-section">'
    +   '<div class="insc-section-title">Besoins d\'accompagnement par notre équipe d\'handiplagistes <span class="req">*</span></div>'
    +   '<div class="insc-check-group">'
    +     '<label class="insc-check"><input type="checkbox" name="accomp" value="aucun" id="accomp-aucun"' + (accompPref.includes('aucun') ? ' checked' : '') + '> Aucun besoin</label>'
    +     '<label class="insc-check"><input type="checkbox" name="accomp" value="transfert"' + (accompPref.includes('transfert') ? ' checked' : '') + '> Aide au transfert</label>'
    +     '<label class="insc-check"><input type="checkbox" name="accomp" value="entree_sortie"' + (accompPref.includes('entree_sortie') ? ' checked' : '') + '> Aide à l\'entrée et à la sortie de l\'eau</label>'
    +     '<label class="insc-check"><input type="checkbox" name="accomp" value="baignade"' + (accompPref.includes('baignade') ? ' checked' : '') + '> Aide à la baignade, maximum 30 minutes</label>'
    +   '</div>'
    +   '<div class="insc-section-title" style="margin-top:18px">Besoins d\'aides techniques <span class="req">*</span></div>'
    +   '<div class="insc-check-group">'
    +     '<label class="insc-check"><input type="checkbox" name="at" value="aucun" id="at-aucun"' + (noneAide ? ' checked' : '') + '> Aucun besoin</label>'
    +     '<label class="insc-check"><input type="checkbox" name="at" value="tiralo" id="at-tiralo"' + chkA('tiralo') + '> Tiralo <span class="insc-hint">(fauteuil amphibie équipé de flotteurs)</span></label>'
    +     '<label class="insc-check"><input type="checkbox" name="at" value="hippocampe" id="at-hippocampe"' + chkA('hippocampe') + '> Hippocampe <span class="insc-hint">(fauteuil tout terrain pour aller au bord de l\'eau)</span></label>'
    +     '<label class="insc-check"><input type="checkbox" name="at" value="audioplage" id="at-audioplage"' + chkA('audioplage') + '> Audioplage <span class="insc-hint">(balisage sonore en mer pour personnes déficientes visuelles)</span></label>'
    +   '</div>'
    + '</div>'

    // ENGAGEMENTS
    + '<div class="insc-section">'
    +   '<div class="insc-section-title">Engagements</div>'
    +   '<div class="insc-engage-block">'
    +     '<div class="insc-engage-label">Port du gilet de sauvetage <span class="req">*</span></div>'
    +     '<div class="insc-radio-group insc-radio-col">'
    +       '<label class="insc-radio"><input type="radio" name="gilet" value="oui"' + ((!v.gilet || v.gilet === 'oui') ? ' checked' : '') + '> J\'accepte le port du gilet de sauvetage, obligatoire dans le cadre de ma baignade</label>'
    +       '<label class="insc-radio"><input type="radio" name="gilet" value="non"' + chk(v.gilet,'non') + '> Je n\'accepte pas, et j\'atteste dégager le CCAS d\'Antibes Juan-les-Pins de toutes responsabilités</label>'
    +     '</div>'
    +   '</div>'
    +   '<div class="insc-engage-block">'
    +     '<div class="insc-engage-label">Traitement des données personnelles <span class="req">*</span></div>'
    +     '<label class="insc-check"><input type="checkbox" id="f-rgpd"' + chkB(v.rgpd) + '> J\'atteste avoir pris connaissance de l\'information relative au traitement des données personnelles</label>'
    +   '</div>'
    +   '<div class="insc-engage-block">'
    +     '<div class="insc-engage-label">Données de santé <span class="req">*</span></div>'
    +     '<label class="insc-check"><input type="checkbox" id="f-sante"' + chkB(v.sante) + '> Je consens expressément au traitement des données de santé (besoins d\'accompagnement et aides techniques — Art. 9 RGPD)</label>'
    +   '</div>'
    +   '<div class="insc-engage-block">'
    +     '<div class="insc-engage-label">Communications du CCAS <span class="req">*</span></div>'
    +     '<div class="insc-radio-group insc-radio-col">'
    +       '<label class="insc-radio"><input type="radio" name="ccas" value="accepte"' + ((!v.ccasCommunications || v.ccasCommunications === 'accepte') ? ' checked' : '') + '> J\'accepte de recevoir par mail des informations de la part du CCAS</label>'
    +       '<label class="insc-radio"><input type="radio" name="ccas" value="refuse"' + chk(v.ccasCommunications,'refuse') + '> Je refuse de recevoir par mail des informations de la part du CCAS</label>'
    +     '</div>'
    +   '</div>'
    +   '<div class="insc-engage-block">'
    +     '<div class="insc-engage-label">Règlement de fonctionnement <span class="req">*</span></div>'
    +     '<label class="insc-check"><input type="checkbox" id="f-reglement"' + chkB(v.reglement) + '> J\'ai lu et j\'accepte le règlement de fonctionnement Handiplage 2026 sans restriction</label>'
    +   '</div>'
    + '</div>'

    // DOCUMENTS
    + '<div class="insc-section">'
    +   '<div class="insc-section-title">Documents justificatifs'
    +     (!isNew && _hasJustif(v)
            ? ' <span class="insc-justif-statut js-' + _justifStatut(v) + '" id="insc-justif-statut">'
              + ({ valide: 'Justificatif valable ✓', refuse: 'Justificatif refusé ✗' }[_justifStatut(v)] || 'À vérifier') + '</span>'
            : '')
    +   '</div>'
    +   '<p class="insc-doc-info">Joindre le justificatif du handicap RECTO-VERSO, avec identité et date de validité lisible <span class="req">*</span><br><em>Carte Mobilité Inclusion (CMI) — les documents de l\'assurance maladie ne sont pas valables.</em></p>'
    +   '<div class="insc-field" style="margin-top:12px"><label>Document principal (recto-verso) <span class="req">*</span></label>'
    +     _renderDocPreview(v.justificatif1, v.justificatif1Name, 'doc1', !isNew && _justifStatut(v) !== 'valide')
    +     '<input type="file" id="f-doc1" accept="image/*,.pdf" class="insc-file-input"></div>'
    +   '<div class="insc-field" style="margin-top:8px"><label>Deuxième document <span class="insc-optional">(verso si le premier n\'est pas recto-verso)</span></label>'
    +     _renderDocPreview(v.justificatif2, v.justificatif2Name, 'doc2', !isNew && _justifStatut(v) !== 'valide')
    +     '<input type="file" id="f-doc2" accept="image/*,.pdf" class="insc-file-input"></div>'
    +   '<div class="insc-field" style="margin-top:16px"><label>Signature <span class="req">*</span> — <span class="insc-hint">La saisie de vos nom et prénom vaut signature</span></label><input type="text" id="f-signature" value="' + _escI(v.signature) + '" placeholder="Prénom NOM"></div>'
    + '</div>'

    // RGPD
    + '<div class="insc-rgpd-notice">'
    +   '<p>Les informations recueillies dans ce formulaire ne sont utilisées que par le service Autonomie et Adaptation du Cadre de Vie du CCAS d\'Antibes. Les données sont conservées pendant 2 ans à compter de la fermeture saisonnière de la Handiplage.</p>'
    +   '<ul><li>Remplir les obligations notamment statistiques du CCAS ;</li><li>Améliorer, si nécessaire, les actions proposées en vous demandant par mail de remplir le questionnaire de satisfaction.</li></ul>'
    +   '<p style="margin-top:8px">Vous disposez d\'un droit d\'accès, de rectification, d\'opposition, de limitation et de suppression de vos données en contactant le DPO du CCAS : <a href="mailto:rgpd@ccas-antibes.fr">rgpd@ccas-antibes.fr</a> — CCAS, 2 avenue de la Libération, BP 83, 06602 Antibes CEDEX.</p>'
    + '</div>'

    + '<div id="insc-form-err" class="insc-form-err"></div>'
    + '<div class="insc-form-actions">'
    +   (!isNew ? '<button type="button" class="btn-danger" id="insc-delete">🗑 Supprimer</button>' : '')
    +   '<button type="button" class="btn-ghost" id="insc-cancel">Annuler</button>'
    +   '<button type="submit" class="btn-primary insc-submit">' + (isNew ? 'VALIDER LA DEMANDE D\'INSCRIPTION' : 'ENREGISTRER LES MODIFICATIONS') + '</button>'
    + '</div>'
    + '</form>'
    + '</div>';

  if (!isNew && v.id) _loadHistory(v.id);

  // Exclusivité "aucun besoin" aides techniques
  const atAucun = document.getElementById('at-aucun');
  const atOthers = ['at-tiralo','at-hippocampe','at-audioplage'];
  if (atAucun) {
    atAucun.addEventListener('change', function() {
      if (atAucun.checked) atOthers.forEach(function(id) { const el=document.getElementById(id); if(el) el.checked=false; });
    });
    atOthers.forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', function() { if(el.checked) atAucun.checked=false; });
    });
  }

  // Exclusivité "aucun besoin" accompagnement
  const accompAucun = document.getElementById('accomp-aucun');
  if (accompAucun) {
    const accompOthers = document.querySelectorAll('input[name="accomp"]:not([value="aucun"])');
    accompAucun.addEventListener('change', function() {
      if (accompAucun.checked) accompOthers.forEach(function(el) { el.checked = false; });
    });
    accompOthers.forEach(function(el) {
      el.addEventListener('change', function() { if (el.checked) accompAucun.checked = false; });
    });
  }

  // Statut
  if (!isNew) {
    const statutEl = document.getElementById('insc-statut');
    if (statutEl) {
      statutEl.addEventListener('change', async function() {
        const newStatut = statutEl.value;
        // Afficher/masquer bloc refus
        var refusBlock = document.getElementById('refus-block');
        if (refusBlock) refusBlock.style.display = newStatut === 'refuse' ? 'block' : 'none';

        var patch = { statut: newStatut };
        if (newStatut === 'valide') {
          const saisonCourante = await getSaisonCourante();
          patch.pass_actif = true;
          patch.pass_activated_at = new Date().toISOString().slice(0, 10);
          patch.derniere_saison_validee = saisonCourante;
        }

        const updated = await updateInscription(v.id, patch);
        await _refreshSidebar(container);
        if (newStatut !== 'valide') {
          const existingBlock = mainEl.querySelector('.pass-block');
          if (existingBlock) existingBlock.remove();
        } else {
          _reRenderPassBlock(updated);
          if (updated.mail) {
            inviteUser(updated.mail, updated.id)
              .then(function() {
                const msgEl = mainEl.querySelector('.insc-invite-msg');
                if (msgEl) {
                  msgEl.textContent = 'Email d\'invitation envoyé à ' + updated.mail;
                  msgEl.style.display = 'block';
                }
              })
              .catch(function(err) {
                const msgEl = mainEl.querySelector('.insc-invite-msg');
                if (msgEl) {
                  msgEl.textContent = 'Erreur invitation : ' + (err && err.message ? err.message : JSON.stringify(err));
                  msgEl.style.display = 'block';
                  msgEl.style.color = 'red';
                }
              });
          }
        }
      });
    }
    // Supprimer
    const delBtn = document.getElementById('insc-delete');
    if (delBtn) {
      delBtn.addEventListener('click', async function() {
        if (!confirm('Supprimer cette inscription définitivement ?')) return;
        await deleteInscription(v.id);
        await renderInscription(container);
      });
    }
    // Supprimer fichiers
    const del1 = document.getElementById('del-doc1');
    if (del1) {
      del1.addEventListener('click', async function() {
        const newMeta = Object.assign({}, v);
        ['id','nom','prenom','mail','telephone','statut','pass','createdAt','updatedAt'].forEach(function(k) { delete newMeta[k]; });
        newMeta.justificatif1 = null;
        newMeta.justificatif1Name = '';
        newMeta.justificatifStatut = null;   // nouveau contrôle nécessaire
        await updateInscription(v.id, { metadata: newMeta });
        v.justificatif1 = null;
        v.justificatif1Name = '';
        v.justificatifStatut = null;
        const ex = document.getElementById('doc1-existing');
        if (ex) ex.remove(); _syncJustifUI();
      });
    }
    const del2 = document.getElementById('del-doc2');
    if (del2) {
      del2.addEventListener('click', async function() {
        const newMeta = Object.assign({}, v);
        ['id','nom','prenom','mail','telephone','statut','pass','createdAt','updatedAt'].forEach(function(k) { delete newMeta[k]; });
        newMeta.justificatif2 = null;
        newMeta.justificatif2Name = '';
        newMeta.justificatifStatut = null;   // nouveau contrôle nécessaire
        await updateInscription(v.id, { metadata: newMeta });
        v.justificatif2 = null;
        v.justificatif2Name = '';
        v.justificatifStatut = null;
        const ex = document.getElementById('doc2-existing');
        if (ex) ex.remove(); _syncJustifUI();
      });
    }
    // ── Justificatif : visionneuse plein écran → « valable » / « refusé » ──
    // Tant que le justificatif n'est pas valable, « Validé » est indisponible dans le menu Statut.
    function _syncJustifUI() {
      const js     = _justifStatut(v);
      const sEl    = document.getElementById('insc-statut');
      const hint   = document.getElementById('insc-statut-hint');
      const badge  = document.getElementById('insc-justif-statut');
      const optVal = sEl && sEl.querySelector('option[value="valide"]');
      if (optVal) optVal.disabled = js !== 'valide' && sEl.value !== 'valide';
      if (hint)   hint.hidden = js === 'valide' || (sEl && sEl.value === 'valide');
      if (badge) {
        badge.className = 'insc-justif-statut js-' + js;
        badge.textContent = { valide: 'Justificatif valable ✓', refuse: 'Justificatif refusé ✗' }[js] || 'À vérifier';
      }
      document.querySelectorAll('.insc-doc-verify, .insc-doc-open-link').forEach(function(b) {
        const aVerifier = js !== 'valide';
        b.className = 'insc-doc-open ' + (aVerifier ? 'insc-doc-verify' : 'insc-doc-open-link');
        b.textContent = aVerifier ? 'Vérifier le justificatif' : 'Ouvrir en grand';
      });
    }

    function _openViewer(key) {
      _openDocViewer({
        v: v,
        key: key,
        onDecision: async function(decision) {
          try {
            await _saveJustifStatut(v, decision);
          } catch (err) {
            alert('Erreur lors de l\'enregistrement : ' + (err.message || err));
            return;
          }
          _syncJustifUI();
          const sEl  = document.getElementById('insc-statut');
          const wrap = sEl ? (sEl.closest('.insc-form-status-sel') || sEl) : null;
          if (decision === 'valide') {
            // Justificatif valable : on amène l'utilisateur au menu Statut, désormais débloqué
            if (wrap) {
              wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
              wrap.classList.remove('insc-statut-pret'); void wrap.offsetWidth;
              wrap.classList.add('insc-statut-pret');
              setTimeout(function() { sEl.focus({ preventScroll: true }); }, 400);
            }
          } else if (sEl && sEl.value !== 'refuse') {
            // Justificatif refusé : l'inscription passe en « Refusé » et on propose le motif
            v.statut = 'refuse';
            sEl.value = 'refuse';
            sEl.dispatchEvent(new Event('change'));
            setTimeout(function() {
              const motif = document.getElementById('refus-motif');
              if (motif) { motif.scrollIntoView({ behavior: 'smooth', block: 'center' }); motif.focus({ preventScroll: true }); }
            }, 350);
          }
        },
      });
    }

    document.querySelectorAll('.insc-doc-open').forEach(function(btn) {
      btn.addEventListener('click', function() { _openViewer(btn.dataset.doc); });
    });
    const hintVerify = document.getElementById('insc-hint-verify');
    if (hintVerify) hintVerify.addEventListener('click', function() { _openViewer(v.justificatif1Name ? 'doc1' : 'doc2'); });

    // Garde-fou : « Validé » refusé si le justificatif n'est pas valable
    const statutGuard = document.getElementById('insc-statut');
    if (statutGuard) {
      statutGuard.addEventListener('change', function() { _syncJustifUI(); });
    }
  }

  // ── Pass ──
  function _reRenderPassBlock(updatedInsc) {
    const existing = mainEl.querySelector('.pass-block');
    const newHtml  = _renderPassBlock(updatedInsc);
    if (existing) {
      const tmp = document.createElement('div');
      tmp.innerHTML = newHtml;
      existing.replaceWith(tmp.firstElementChild || document.createElement('div'));
    } else if (newHtml) {
      const formHeader = mainEl.querySelector('.insc-form-header');
      if (formHeader) formHeader.insertAdjacentHTML('afterend', newHtml);
    }
    _bindPassButtons();
  }

  function _bindPassButtons() {
    const activateBtn   = document.getElementById('pass-activate');
    const deactivateBtn = document.getElementById('pass-deactivate');
    if (activateBtn) {
      activateBtn.addEventListener('click', async function() {
        const updated = await updateInscription(v.id, {
          pass_actif: true,
          pass_activated_at: new Date().toISOString().slice(0, 10),
        });
        _reRenderPassBlock(updated);
        await _refreshSidebar(container);
      });
    }
    if (deactivateBtn) {
      deactivateBtn.addEventListener('click', async function() {
        const updated = await updateInscription(v.id, { pass_actif: false });
        _reRenderPassBlock(updated);
        await _refreshSidebar(container);
      });
    }
  }

  if (!isNew) {
    _bindPassButtons();
    if (v.statut === 'valide') _loadAbsenceBlock(container, v);
  }

  // Wirer bouton refus
  var btnRefusal = document.getElementById('btn-send-refusal');
  if (btnRefusal && !isNew && v.id) {
    btnRefusal.addEventListener('click', function() { _sendRefusalEmail(v.id); });
  }

  document.getElementById('insc-cancel').addEventListener('click', async function() {
    await renderInscription(container);
  });
  document.getElementById('insc-form').addEventListener('submit', function(e) {
    e.preventDefault();
    _handleSubmit(container, isNew ? null : v.id, isNew ? null : v);
  });
}

async function _refreshSidebar(container) {
  const insc = await _loadInscListe();
  const searchEl = document.getElementById('insc-search');
  const q = searchEl ? searchEl.value.toLowerCase() : '';
  const listEl = document.getElementById('insc-list');
  const actif  = listEl && listEl.querySelector('.insc-list-item.active');
  const actifId = actif ? actif.dataset.id : null;
  if (listEl) listEl.innerHTML = _renderListItems(insc, q);
  if (actifId) {
    const el = listEl.querySelector('.insc-list-item[data-id="' + actifId + '"]');
    if (el) el.classList.add('active');
  }
  _bindListItems(container);
}

async function _sendRefusalEmail(inscriptionId) {
  var motif = document.getElementById('refus-motif') && document.getElementById('refus-motif').value.trim();
  if (!motif) {
    alert('Veuillez saisir le motif du refus avant d\'envoyer l\'email.');
    return;
  }
  var btn = document.getElementById('btn-send-refusal');
  if (btn) { btn.disabled = true; btn.textContent = 'Envoi…'; }

  try {
    var session = await (typeof getSession === 'function' ? getSession() : Promise.resolve(null));
    var response = await fetch(window.SUPABASE_CONFIG.url + '/functions/v1/send-refusal-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (session ? session.access_token : ''),
      },
      body: JSON.stringify({ inscriptionId: inscriptionId, motif: motif }),
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Erreur serveur');
    window.location.href = data.mailtoLink;
    if (btn) { btn.disabled = false; btn.textContent = 'Ouvrir le modèle d\'email'; }
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Ouvrir le modèle d\'email'; }
    alert('Erreur : ' + err.message);
  }
}

function _buildMetadata(data) {
  const structured = ['id', 'nom', 'prenom', 'mail', 'telephone', 'statut', 'pass', 'createdAt', 'updatedAt'];
  const meta = {};
  Object.keys(data).forEach(function(k) {
    if (structured.indexOf(k) === -1) meta[k] = data[k];
  });
  return meta;
}

function _handleSubmit(container, existingId, existingData) {
  const g  = function(id) { return document.getElementById(id); };
  const gv = function(id) { const el=g(id); return el ? el.value.trim() : ''; };
  const gr = function(name) { const el=document.querySelector('input[name="'+name+'"]:checked'); return el ? el.value : ''; };
  const ga = function(name) { return Array.from(document.querySelectorAll('input[name="'+name+'"]:checked')).map(function(el){return el.value;}); };

  const nom     = gv('f-nom').toUpperCase();
  const prenom  = gv('f-prenom');
  const dobJ    = gv('f-dob-j');
  const dobM    = gv('f-dob-m');
  const dobY    = gv('f-dob-y');
  const tel     = gv('f-tel');
  const mail    = gv('f-mail');
  const mail2   = gv('f-mail2');
  const contact = ga('contact');
  const adresse = gv('f-adresse');
  const cp      = gv('f-cp');
  const ville   = gv('f-ville');
  const pays    = gv('f-pays');
  const urgNom  = gv('f-urg-nom');
  const urgTel  = gv('f-urg-tel');
  const accomp  = ga('accomp');
  const gilet   = gr('gilet');
  const ccas    = gr('ccas');
  const rgpd    = g('f-rgpd') && g('f-rgpd').checked;
  const sante   = g('f-sante') && g('f-sante').checked;
  const regl    = g('f-reglement') && g('f-reglement').checked;
  const sig     = gv('f-signature');
  const errEl   = g('insc-form-err');

  const errors = [];
  if (!nom)               errors.push('Nom requis');
  if (!prenom)            errors.push('Prénom requis');
  if (!dobJ||!dobM||!dobY) errors.push('Date de naissance complète requise');
  if (!tel)               errors.push('Téléphone requis');
  if (!mail)              errors.push('Adresse mail requise');
  if (mail !== mail2)     errors.push('Les deux adresses mail ne correspondent pas');
  if (contact.length === 0) errors.push('Modalité de contact préférée requise');
  if (!adresse)           errors.push('Adresse requise');
  if (!cp)                errors.push('Code postal requis');
  if (!ville)             errors.push('Ville requise');
  if (!pays)              errors.push('Pays requis');
  if (!urgNom)            errors.push('Nom du contact d\'urgence requis');
  if (!urgTel)            errors.push('Téléphone du contact d\'urgence requis');
  if (accomp.length === 0)  errors.push('Besoin d\'accompagnement requis');
  if (!gilet)             errors.push('Réponse sur le gilet de sauvetage requise');
  if (!rgpd)              errors.push('Veuillez attester avoir pris connaissance du traitement des données');
  if (!sante)             errors.push('Consentement aux données de santé requis (Art. 9 RGPD)');
  if (!ccas)              errors.push('Réponse communications CCAS requise');
  if (!regl)              errors.push('Veuillez accepter le règlement de fonctionnement');
  if (!sig)               errors.push('Signature requise');

  if (errors.length > 0) {
    errEl.innerHTML = errors.map(function(e) { return '• ' + e; }).join('<br>');
    errEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  errEl.innerHTML = '';

  const atChecked = Array.from(document.querySelectorAll('input[name="at"]:checked')).map(function(el) { return el.value; });

  const inscData = {
    statut:            existingData ? existingData.statut : 'en_attente',
    nom, prenom,
    dateNaissance:     { jour: parseInt(dobJ), mois: parseInt(dobM), annee: parseInt(dobY) },
    telephone:         tel,
    mail,
    mailConfirm:       mail2,
    contactPreference: contact,
    adresse, codePostal: cp, ville, pays,
    urgenceNom:        urgNom,
    urgenceTel:        urgTel,
    accompagnement:    accomp,
    aidesTechniques:   atChecked,
    gilet,
    rgpd,
    sante,
    ccasCommunications: ccas,
    reglement:         regl,
    signature:         sig,
    justificatif1:     existingData ? existingData.justificatif1 : null,
    justificatif1Name: existingData ? existingData.justificatif1Name : '',
    justificatif2:     existingData ? existingData.justificatif2 : null,
    justificatif2Name: existingData ? existingData.justificatif2Name : '',
    justificatifStatut: existingData ? (existingData.justificatifStatut || null) : null,
  };

  _readFiles(g('f-doc1'), g('f-doc2'), inscData, async function(data) {
    // Nouveau document joint : il faut le vérifier à nouveau
    if (existingData && (data.justificatif1 !== existingData.justificatif1 || data.justificatif2 !== existingData.justificatif2)) {
      data.justificatifStatut = null;
    }
    try {
      if (existingId) {
        await updateInscription(existingId, {
          nom:       data.nom,
          prenom:    data.prenom,
          mail:      data.mail,
          telephone: data.telephone,
          metadata:  _buildMetadata(data),
        });
      } else {
        await createInscription(data);
      }
      await renderInscription(container);
    } catch (err) {
      const errEl2 = g('insc-form-err');
      if (errEl2) errEl2.textContent = 'Erreur lors de la sauvegarde : ' + (err.message || err);
    }
  });
}

function _readFiles(input1, input2, data, callback) {
  function readOne(input, cb) {
    if (!input || !input.files || input.files.length === 0) { cb(null, ''); return; }
    const file   = input.files[0];
    const reader = new FileReader();
    reader.onload = function(e) { cb(e.target.result, file.name); };
    reader.readAsDataURL(file);
  }
  readOne(input1, function(b64a, nameA) {
    if (b64a) { data.justificatif1 = b64a; data.justificatif1Name = nameA; }
    readOne(input2, function(b64b, nameB) {
      if (b64b) { data.justificatif2 = b64b; data.justificatif2Name = nameB; }
      callback(data);
    });
  });
}

function _loadHistory(inscriptionId) {
  if (typeof getReservationsForInscription !== 'function') return;
  getReservationsForInscription(inscriptionId).then(function(rows) {
    var histEl = document.getElementById('insc-history-list');
    if (!histEl) return;

    // Mettre à jour le solde pass depuis les vraies données Supabase
    if (typeof getPassMonthKey === 'function' && typeof PASS_QUOTA !== 'undefined') {
      var monthKey = getPassMonthKey();
      var usedThisMonth = rows.filter(function(r) {
        return r.date && r.date.startsWith(monthKey) && resaCompteDansQuota(r);
      }).length;
      var remaining = Math.max(0, PASS_QUOTA - usedThisMonth);
      var countEl = document.querySelector('.pass-remaining-count');
      if (countEl) {
        countEl.textContent = remaining;
        var fillEl = document.querySelector('.pass-bar-fill');
        if (fillEl) {
          fillEl.style.width = Math.round((remaining / PASS_QUOTA) * 100) + '%';
          fillEl.className = 'pass-bar-fill' + (remaining === 0 ? ' empty' : remaining <= 10 ? ' low' : '');
        }
      }
    }

    if (!rows.length) {
      histEl.innerHTML = '<em class="insc-history-empty">Aucune réservation enregistrée.</em>';
      return;
    }
    var statutLabel = { attente: 'Réservation', present: 'Présent·e', parti: 'Présent·e', absent: 'Absent·e', annule: 'Annulé', suspendu: 'Suspendue (plage fermée)' };
    var slotLabel = {};
    if (typeof SLOTS !== 'undefined') {
      SLOTS.forEach(function(s) { slotLabel[s.id] = s.label; });
    }
    function _histRow(r) {
      var d = new Date(r.date + 'T00:00:00');
      var dateStr = d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
      var statut  = statutLabel[r.statut] || r.statut;
      var slot    = slotLabel[r.creneau_id] || ('Créneau ' + r.creneau_id);
      var spot    = r.spot_id ? ' · Empl. ' + _escI(r.spot_id) : '';
      var acc     = r.accompagnants > 0 ? ' (' + r.accompagnants + ' acc.)' : '';
      return '<div class="insc-history-row">'
        + '<span class="insc-history-date">' + dateStr + '</span>'
        + '<span class="insc-history-slot">' + _escI(slot) + spot + acc + '</span>'
        + '<span class="insc-history-statut insc-hs-' + r.statut + '">' + statut + '</span>'
        + '</div>';
    }

    var monthMap = {};
    rows.forEach(function(r) {
      var key = r.date.slice(0, 7);
      if (!monthMap[key]) monthMap[key] = [];
      monthMap[key].push(r);
    });
    var monthKeys = Object.keys(monthMap).sort().reverse();
    var HIST_VISIBLE = 5;

    histEl.innerHTML = monthKeys.map(function(key, idx) {
      var items   = monthMap[key];
      var s       = new Date(key + '-02').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      var label   = s.charAt(0).toUpperCase() + s.slice(1);
      var isOpen  = idx === 0;
      var visible = items.slice(0, HIST_VISIBLE);
      var extra   = items.slice(HIST_VISIBLE);
      return '<div class="insc-hist-group">'
        + '<div class="insc-hist-header' + (isOpen ? ' open' : '') + '">'
        +   '<span class="insc-hist-label">' + label + '</span>'
        +   '<span class="insc-hist-meta">' + items.length + ' séance' + (items.length > 1 ? 's' : '') + '</span>'
        +   '<span class="insc-hist-chevron">' + (isOpen ? '▾' : '▸') + '</span>'
        + '</div>'
        + '<div class="insc-hist-body' + (isOpen ? ' open' : '') + '">'
        +   visible.map(_histRow).join('')
        +   (extra.length
            ? '<button class="insc-hist-more">▼ Voir les ' + extra.length + ' autre' + (extra.length > 1 ? 's' : '') + '</button>'
              + '<div class="insc-hist-extra">' + extra.map(_histRow).join('') + '</div>'
            : '')
        + '</div>'
        + '</div>';
    }).join('');

    histEl.querySelectorAll('.insc-hist-header').forEach(function(hdr) {
      hdr.addEventListener('click', function() {
        var body = hdr.nextElementSibling;
        var open = body.classList.toggle('open');
        hdr.classList.toggle('open', open);
        hdr.querySelector('.insc-hist-chevron').textContent = open ? '▾' : '▸';
      });
    });
    histEl.querySelectorAll('.insc-hist-more').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var extra = btn.nextElementSibling;
        var isOpen = extra.classList.toggle('open');
        btn.textContent = isOpen
          ? '▲ Replier'
          : btn.dataset.label;
      });
      btn.dataset.label = btn.textContent;
    });
  }).catch(function(e) {
    var histEl = document.getElementById('insc-history-list');
    if (histEl) histEl.innerHTML = '<em style="color:#c00;font-size:13px">Erreur de chargement.</em>';
    console.error(e);
  });
}

function _renderAbsenceBlock(insc, absentsCount) {
  var today    = new Date();
  var monthKey = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  var monthLbl = today.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  var blocked  = absentsCount >= 3 && insc.absenceOverrideMonth !== monthKey;

  var inner = blocked
    ? '<div class="absence-block-hd">⚠️ Absences — <span style="color:#c00">' + absentsCount + '/3 ce mois · Réservations suspendues</span></div>'
      + '<p class="pass-meta">L\'usager ne peut plus réserver ce mois (' + monthLbl + '). Il peut venir sans réservation.</p>'
      + '<div class="pass-actions"><button type="button" class="btn-primary" id="absence-reactivate">✓ Réactiver les réservations</button></div>'
    : '<div class="absence-block-hd">Absences — <span style="color:' + (absentsCount >= 2 ? '#e65100' : '#2e7d32') + '">' + absentsCount + '/3 ce mois</span></div>'
      + '<p class="pass-meta">' + (absentsCount === 0 ? 'Aucune absence ce mois.' : absentsCount === 1 ? '1 absence ce mois — 2 restantes avant suspension.' : '2 absences ce mois — 1 restante avant suspension.') + '</p>'
      + (insc.absenceOverrideMonth === monthKey ? '<p class="pass-meta" style="color:#1565c0">Réactivation staff en vigueur ce mois.</p>' : '');

  return '<div class="pass-block absence-block">' + inner + '</div>';
}

function _bindAbsenceButtons(container, insc) {
  var btn = document.getElementById('absence-reactivate');
  if (!btn) return;
  btn.addEventListener('click', async function() {
    btn.disabled = true;
    btn.textContent = 'Réactivation…';
    var today    = new Date();
    var monthKey = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
    var newMeta  = Object.assign({}, insc);
    ['id','nom','prenom','mail','telephone','statut','pass','createdAt','updatedAt'].forEach(function(k) { delete newMeta[k]; });
    newMeta.absenceOverrideMonth = monthKey;
    var updated = await updateInscription(insc.id, { metadata: newMeta });
    // re-render le bloc
    var wrap = document.getElementById('absence-block-wrap');
    if (wrap) {
      var absentsCount = parseInt(btn.closest('.absence-block').querySelector('.absence-block-hd span').textContent) || 3;
      wrap.innerHTML = _renderAbsenceBlock(updated, absentsCount);
      _bindAbsenceButtons(container, updated);
    }
  });
}

async function _loadAbsenceBlock(container, insc) {
  var wrap = document.getElementById('absence-block-wrap');
  if (!wrap || typeof getAbsentsThisMonthCount !== 'function') return;
  try {
    var count = await getAbsentsThisMonthCount(insc.id);
    wrap.innerHTML = _renderAbsenceBlock(insc, count);
    _bindAbsenceButtons(container, insc);
  } catch (e) { /* silencieux */ }
}

function _renderPassBlock(insc) {
  const today    = new Date();
  const inSeason = (typeof isPassSeason === 'function') ? isPassSeason() : [6,7,8,9].includes(today.getMonth() + 1);
  const pass     = insc.pass || null;
  const actif    = !!(pass && pass.actif);

  if (!inSeason && !pass) return ''; // hors saison, jamais activé

  let inner = '';
  if (!actif) {
    const badgeCls = inSeason ? 'pass-badge-inactive' : 'pass-badge-season';
    const badgeLbl = inSeason ? 'Inactif' : 'Hors saison';
    inner = `
      <div class="pass-block-hd">🎫 Pass Handiplage
        <span class="pass-badge ${badgeCls}">${badgeLbl}</span>
      </div>
      <p class="pass-meta">${inSeason ? 'Ce pass donne accès à 40 réservations par mois (juin–septembre).' : 'Le pass est valide de juin à septembre.'}</p>
      ${inSeason ? '<div class="pass-actions"><button type="button" class="btn-primary" id="pass-activate">Activer le pass</button></div>' : ''}
    `;
  } else {
    const remaining  = (typeof getPassRemaining === 'function') ? getPassRemaining(insc.id) : 0;
    const pct        = Math.round((remaining / 40) * 100);
    const fillCls    = remaining === 0 ? 'empty' : remaining <= 10 ? 'low' : '';
    const monthLabel = (typeof getPassMonthLabel === 'function') ? getPassMonthLabel() : '';
    const resetDate  = (typeof getPassResetDate  === 'function') ? getPassResetDate()  : '';
    const sinceDate  = pass.activatedAt
      ? new Date(pass.activatedAt + 'T12:00:00').toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' })
      : '';
    inner = `
      <div class="pass-block-hd">🎫 Pass Handiplage
        <span class="pass-badge pass-badge-active">● Actif${sinceDate ? ' depuis le ' + sinceDate : ''}</span>
      </div>
      <p class="pass-meta">Saison : juin → septembre ${today.getFullYear()}</p>
      <div class="pass-remaining-row">
        <span class="pass-remaining-count">${remaining}</span>
        <span class="pass-remaining-label">/ 40 réservations restantes${monthLabel ? ' (' + monthLabel + ')' : ''}</span>
      </div>
      <div class="pass-bar-wrap">
        <div class="pass-bar-fill ${fillCls}" style="width:${pct}%"></div>
      </div>
      <p class="pass-meta">Réinitialisation le ${resetDate}</p>
      <div class="pass-actions">
        <button type="button" class="btn-ghost" id="pass-deactivate">Désactiver le pass</button>
      </div>
    `;
  }
  return `<div class="pass-block">${inner}</div>`;
}

if (typeof module !== 'undefined') {
  module.exports = { renderInscription };
}
