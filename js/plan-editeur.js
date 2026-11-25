// js/plan-editeur.js — éditeur du plan de la plage (responsable)
// Places, rangées, douches et tapis. Le décor fixe (bâtiment, rochers, rampe, barrières) est affiché
// en fond mais ne se modifie pas. Coordonnées identiques à la vue Plage (data.js / map.js).
'use strict';

// Cadrage identique à la vue Plage sur la tablette de référence (Galaxy Tab A9+) : même zone visible,
// même zoom sur la zone utile. Ce qui dépasse est caché sur la tablette (panneau des réservations à droite).
// (valeurs de secours quand data.js n'est pas chargé, par exemple dans les tests)
var _PE_CFG = typeof BEACH_CONFIG !== 'undefined' ? BEACH_CONFIG : { cadrage: { x: -44, y: -51, w: 914, h: 501 }, merFinX: 700, merDefaut: 400 };
var _PE_ECRAN = typeof ECRAN_TABLETTE !== 'undefined' ? ECRAN_TABLETTE : { largeur: 995, hauteur: 565, route: 32, marge: 0 };
var PE_MONDE = (function() {
  var v = _PE_CFG.cadrage, e = _PE_ECRAN;
  var hz = e.hauteur - e.route;                                  // hauteur de la zone du plan (sous la bande Parking)
  var s = Math.min((e.largeur - 2 * e.marge) / v.w, (hz - 2 * e.marge) / v.h, 2.5);
  var w = e.largeur / s, hv = hz / s, route = e.route / s;
  var dy = Math.min((hv - v.h) / 2, e.marge / s);                // zone calée en haut, le surplus va vers la mer
  return { x0: Math.round(v.x + v.w / 2 - w / 2), y0: Math.round(v.y - dy - route), w: Math.round(w), h: Math.round(hv + route), echelle: s };
})();
var PE_ROUTE = Math.round(_PE_ECRAN.route / PE_MONDE.echelle);   // bande « Parking »
var PE_MER_LARGEUR = _PE_CFG.merFinX - PE_MONDE.x0;              // la mer s'étend jusque sous les rochers
var PE_AIMANT = 5;                                    // grille aimantée (px du plan)
var PE_TAILLE = 34;                                   // côté d'une place
var PE_TAPIS = 14;                                    // largeur d'un tapis
var PE_BARNUM_MIN = 30;
// Rotation (degrés, sens horaire) : ramenée entre -180 et 180, aimantée par pas
function peAngle(deg, pas) {
  var a = pas ? Math.round(deg / pas) * pas : deg;
  a = ((a % 360) + 540) % 360 - 180;
  return Math.abs(a) < 1e-9 ? 0 : Math.round(a * 10) / 10;
}
// Style CSS de rotation d'un élément (rien si l'angle est nul)
function peRotStyle(o, base) {
  var r = o && o.rot ? 'rotate(' + o.rot + 'deg)' : '';
  var t = [base || '', r].join(' ').trim();
  return t ? 'transform:' + t + ';' : '';
}

var PE_MER_DEFAUT = _PE_CFG.merDefaut;                              // front de mer habituel : haut de la mer sur la tablette (px du plan)
var PE_MER_MIN = 150, PE_MER_MAX = 470;

// Places dont le centre est trop près de l'eau (la place déborde dans la mer)
function pePlacesDansLaMer(spots, frontMer) {
  return spots.filter(function(s) { return s.y + PE_TAILLE / 2 > frontMer; }).map(function(s) { return s.id; });
}                               // côté minimal d'un barnum
var PE_COULEURS_BARNUM = [['orange', 'Orange'], ['bleu', 'Bleu'], ['blanc', 'Blanc'], ['vert', 'Vert'], ['rouge', 'Rouge']];

// Barnum (vu du dessus) : même rendu dans l'éditeur et sur la vue Plage
function barnumHtml(b, attrs) {
  return '<div class="barnum-plage' + (attrs && attrs.cls ? ' ' + attrs.cls : '') + '" data-couleur="' + _escBarnum(b.couleur || 'orange') + '"'
    + (attrs && attrs.k ? ' data-k="' + attrs.k + '"' : '')
    + ' style="left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.w + 'px;height:' + b.h + 'px;' + (b.rot ? 'transform:rotate(' + b.rot + 'deg);' : '') + '" title="' + _escBarnum(b.nom || 'Barnum') + '">'
    + '<span>' + _escBarnum(b.nom || 'Barnum') + '</span></div>';
}
function _escBarnum(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Fonctions pures (testées) ──

function peNumero(id) { var n = parseInt(String(id).replace(/^P/, ''), 10); return isFinite(n) ? n : 0; }

// Numéro de la prochaine place : jamais un numéro déjà utilisé dans un plan (l'historique reste juste)
function peProchainNumero(plans, contenu) {
  var max = 54;
  (plans || []).concat([{ contenu: contenu }]).forEach(function(p) {
    var c = (p && p.contenu) || {};
    if (c.dernierNumero > max) max = c.dernierNumero;
    (c.spots || []).forEach(function(s) { max = Math.max(max, peNumero(s.id)); });
  });
  return max + 1;
}

// Places qui se chevauchent (moins d'une place d'écart sur les deux axes)
function peChevauchements(spots, taille) {
  var t = taille || PE_TAILLE, ids = {};
  for (var i = 0; i < spots.length; i++) {
    for (var j = i + 1; j < spots.length; j++) {
      if (Math.abs(spots[i].x - spots[j].x) < t && Math.abs(spots[i].y - spots[j].y) < t) {
        ids[spots[i].id] = true; ids[spots[j].id] = true;
      }
    }
  }
  return Object.keys(ids);
}

function peAimanter(v) { return Math.round(v / PE_AIMANT) * PE_AIMANT; }

// Alignement automatique : parmi les coordonnées qui bougent, trouve celle qui tombe le plus près
// (moins de `seuil`) d'une coordonnée fixe. Renvoie la correction à appliquer et la ligne de repère.
function peAlignement(mobiles, fixes, seuil) {
  var best = null;
  mobiles.forEach(function(m) {
    fixes.forEach(function(f) {
      var d = f - m;
      if (Math.abs(d) <= seuil && (!best || Math.abs(d) < Math.abs(best.correction))) best = { correction: d, ligne: f };
    });
  });
  return best;
}

// Rangée tracée en glissant : une place tous les `ecart` px, dans le sens dominant du tracé (30 places max)
function pePositionsRangee(p0, p, ecart) {
  var dx = p.x - p0.x, dy = p.y - p0.y, horiz = Math.abs(dx) >= Math.abs(dy);
  var long = Math.abs(horiz ? dx : dy), sens = (horiz ? dx : dy) < 0 ? -1 : 1;
  var n = Math.min(30, Math.floor(long / ecart) + 1), res = [];
  for (var i = 0; i < n; i++) res.push(horiz ? { x: p0.x + sens * i * ecart, y: p0.y } : { x: p0.x, y: p0.y + sens * i * ecart });
  return res;
}

var PE_SEUIL_ALIGN = 8; // px du plan : distance à laquelle un élément « s'accroche » à l'alignement

// Répartit des valeurs régulièrement entre la plus petite et la plus grande (ordre conservé)
function peRepartir(valeurs) {
  if (valeurs.length < 3) return valeurs.slice();
  var ordre = valeurs.map(function(v, i) { return { v: v, i: i }; }).sort(function(a, b) { return a.v - b.v; });
  var min = ordre[0].v, pas = (ordre[ordre.length - 1].v - min) / (ordre.length - 1), res = valeurs.slice();
  ordre.forEach(function(o, k) { res[o.i] = Math.round(min + pas * k); });
  return res;
}

// ── Accès aux éléments par clé : S:P12 (place), H:0 / V:1 (tapis), D:2 (douche), B:0 (barnum) ──

function _peElements(c) {
  var els = [];
  c.spots.forEach(function(s) { els.push({ k: 'S:' + s.id, o: s, type: 'S' }); });
  c.tapisH.forEach(function(t, i) { els.push({ k: 'H:' + i, o: t, type: 'H' }); });
  c.tapisV.forEach(function(t, i) { els.push({ k: 'V:' + i, o: t, type: 'V' }); });
  c.showers.forEach(function(d, i) { els.push({ k: 'D:' + i, o: d, type: 'D' }); });
  c.barnums.forEach(function(b, i) { els.push({ k: 'B:' + i, o: b, type: 'B' }); });
  (c.barriers || []).forEach(function(g, i) { els.push({ k: 'G:' + i, o: g, type: 'G' }); });
  return els;
}
// Point de référence d'un élément (centre pour les places/douches, coin pour les tapis)
function _peRef(e) {
  if (e.type === 'V') return { x: e.o.x, y: e.o.top || 0 };
  return { x: e.o.x, y: e.o.y };
}
function _peSetRef(e, x, y) {
  if (e.type === 'V') { e.o.x = x; e.o.top = y; } else { e.o.x = x; e.o.y = y; }
}
function _peCentre(e) {
  if (e.type === 'H') return { x: e.o.x + e.o.width / 2, y: e.o.y + PE_TAPIS / 2 };
  if (e.type === 'V') return { x: e.o.x + PE_TAPIS / 2, y: (e.o.top || 0) + e.o.height / 2 };
  if (e.type === 'B') return { x: e.o.x + e.o.w / 2, y: e.o.y + e.o.h / 2 };
  if (e.type === 'G') return e.o.type === 'h' ? { x: e.o.x + e.o.width / 2, y: e.o.y } : { x: e.o.x, y: e.o.y + e.o.height / 2 };
  return { x: e.o.x, y: e.o.y };
}

// Coordonnées sur lesquelles un élément peut s'aligner (centres, et extrémités des tapis)
function _peReperes(e) {
  if (e.type === 'H') return { xs: [e.o.x, e.o.x + e.o.width], ys: [e.o.y + PE_TAPIS / 2] };
  if (e.type === 'V') return { xs: [e.o.x + PE_TAPIS / 2], ys: [e.o.top || 0, (e.o.top || 0) + e.o.height] };
  if (e.type === 'B') return { xs: [e.o.x, e.o.x + e.o.w / 2, e.o.x + e.o.w], ys: [e.o.y, e.o.y + e.o.h / 2, e.o.y + e.o.h] };
  if (e.type === 'G') return e.o.type === 'h' ? { xs: [e.o.x, e.o.x + e.o.width], ys: [e.o.y] } : { xs: [e.o.x], ys: [e.o.y, e.o.y + e.o.height] };
  return { xs: [e.o.x], ys: [e.o.y] };
}

// Éléments qui peuvent pivoter : tapis, barrières, douches, barnums (pas les places)
var TOURNABLES = { H: true, V: true, G: true, D: true, B: true };
function _peDemiHauteur(e) {
  if (e.type === 'H') return PE_TAPIS / 2;
  if (e.type === 'V') return e.o.height / 2;
  if (e.type === 'G') return e.o.type === 'h' ? 3 : e.o.height / 2;
  if (e.type === 'B') return e.o.h / 2;
  return 14;
}

// Icônes au trait, homogènes (24×24, trait 1,8, couleur du bouton)
function peIcone(nom, taille) {
  var t = taille || 20;
  var d = {
    sel:      '<path d="M6 3.5v15.2l4.1-4 2.8 6.1 2.6-1.2-2.8-6h5.6z"/>',
    place:    '<circle cx="5.5" cy="12" r="3"/><circle cx="12" cy="12" r="3"/><circle cx="18.5" cy="12" r="3"/>',
    tapis:    '<rect x="3" y="8.5" width="18" height="7" rx="1.6"/><path d="M8 8.5v7M12 8.5v7M16 8.5v7"/>',
    barriere: '<path d="M3 9.5h18M3 14.5h18"/><path d="M6 6v12M12 6v12M18 6v12"/>',
    douche:   '<path d="M5 20.5V8.5a4 4 0 0 1 4-4h1.5a4 4 0 0 1 4 4"/><path d="M11 9h7"/><path d="M12 12.5v1.2M15 12.5v1.2M18 12.5v1.2M13.5 16.5v1.2M16.5 16.5v1.2"/>',
    barnum:   '<path d="M2.5 10 12 4l9.5 6"/><path d="M2.5 10h19"/><path d="M4.5 10a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0"/><path d="M5 12v8.5M19 12v8.5"/>',
    annuler:  '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    retablir: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    pivoter:  '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>',
    vertical: '<path d="M12 4v16"/><path d="m8 7.5 4-4 4 4M8 16.5l4 4 4-4"/>',
    retour:   '<path d="m14.5 18-6-6 6-6"/>',
  }[nom] || '';
  return '<svg class="pe-svg" width="' + t + '" height="' + t + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + d + '</svg>';
}

// ── Éditeur ──

function ouvrirEditeurPlan(container, plan, opts) {
  opts = opts || {};
  var c = JSON.parse(JSON.stringify(plan.contenu || {}));
  ['spots', 'tapisH', 'tapisV', 'showers', 'barnums'].forEach(function(k) { if (!Array.isArray(c[k])) c[k] = []; });
  if (!Array.isArray(c.barriers)) {
    var barrDefaut = (typeof PLAN_SECOURS !== 'undefined' && PLAN_SECOURS && PLAN_SECOURS.barriers) || BEACH_CONFIG.barriers || [];
    c.barriers = JSON.parse(JSON.stringify(barrDefaut));
  }
  var st = {
    nom: opts.nomInitial || (opts.copie ? plan.nom + ' (modifié)' : plan.nom),
    outil: 'sel', sel: {}, undo: [], redo: [], modifie: false,
    ecart: 50, echelle: 1,
    multi: false,                                        // tablette : « Sélection multiple » remplace Maj + clic
    tactile: !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches),
  };
  var tousPlans = opts.plans || [];

  container.classList.add('pe-mode');
  container.innerHTML = '<div class="pe">'
    + '<div class="pe-top">'
    +   '<button type="button" class="pl-btn" id="pe-retour">' + peIcone('retour', 16) + 'Plans</button>'
    +   '<input id="pe-nom" class="pe-nom" maxlength="80" aria-label="Nom du plan" value="' + _escP(st.nom) + '">'
    +   (opts.nouveau ? '<span class="pe-copie pe-nouveau" title="Le plan sera créé à l\'enregistrement.">Nouveau</span>' : opts.copie ? '<span class="pe-copie" title="Ce plan est en service aujourd\'hui : vos modifications seront enregistrées dans un nouveau plan.">Copie</span>' : '')
    +   '<button type="button" class="pl-btn pe-ic" id="pe-undo" title="Annuler (Ctrl+Z)" aria-label="Annuler">' + peIcone('annuler', 18) + '</button>'
    +   '<button type="button" class="pl-btn pe-ic" id="pe-redo" title="Rétablir (Ctrl+Y)" aria-label="Rétablir">' + peIcone('retablir', 18) + '</button>'
    +   '<span class="pe-sp"></span>'
    +   '<span class="pe-compte" id="pe-compte"></span>'
    +   '<span class="pe-verif" id="pe-verif"></span>'
    +   '<button type="button" class="pl-btn" id="pe-brouillon">Brouillon</button>'
    +   '<button type="button" class="cap-ok" id="pe-ok">Enregistrer</button>'
    + '</div>'
    + '<div class="pe-main">'
    +   '<div class="pe-outils" role="toolbar" aria-label="Outils">'
    +     _peOutil('sel', '↖', 'Sélection') + _peOutil('place', '▢', 'Places')
    +     '<hr>' + _peOutil('tapis', '▬', 'Tapis') + _peOutil('barriere', '┅', 'Barrière') + _peOutil('douche', '▦', 'Douche') + _peOutil('barnum', '⛺', 'Barnum')
    +   '</div>'
    +   '<div class="pe-zone" id="pe-zone"><div class="pe-feuille" id="pe-feuille"><div class="pe-monde" id="pe-monde"></div></div>'
    +     '<p class="pe-aide" id="pe-aide"></p></div>'
    +   '<aside class="pe-props" id="pe-props"></aside>'
    + '</div></div>';

  var $ = function(id) { return container.querySelector('#' + id); };
  var monde = $('pe-monde'), feuille = $('pe-feuille'), zone = $('pe-zone');

  // Décor fixe en fond (dessiné une fois)
  var decor = document.createElement('div');
  decor.className = 'pe-decor';
  decor.style.cssText = 'position:absolute;left:' + (-PE_MONDE.x0) + 'px;top:' + (-PE_MONDE.y0) + 'px;width:' + BEACH_CONFIG.mapWidth + 'px;height:' + BEACH_CONFIG.mapHeight + 'px;pointer-events:none';
  if (typeof _renderDecor === 'function') _renderDecor(decor, BEACH_CONFIG);
  monde.style.width = PE_MONDE.w + 'px'; monde.style.height = PE_MONDE.h + 'px';
  var calque = document.createElement('div');
  calque.className = 'pe-calque';
  calque.style.cssText = 'position:absolute;left:' + (-PE_MONDE.x0) + 'px;top:' + (-PE_MONDE.y0) + 'px';
  // Mer (repère visuel, comme sur la vue Plage)
  var mer = document.createElement('div');
  mer.className = 'pe-mer';
  mer.style.cssText = 'left:0;width:' + PE_MER_LARGEUR + 'px;border-radius:0 ' + Math.round(70 / PE_MONDE.echelle) + 'px 0 0';
  // Bande « Parking » (haut du panneau, comme sur la tablette)
  var route = document.createElement('div');
  route.className = 'pe-route';
  route.style.cssText = 'left:0;top:0;width:' + PE_MONDE.w + 'px;height:' + PE_ROUTE + 'px';
  route.innerHTML = '<span>Parking</span>';
  monde.appendChild(route);
  mer.innerHTML = '<span>Mer</span>';
  monde.appendChild(mer);
  monde.appendChild(decor);
  monde.appendChild(calque);
  var cadre = document.createElement('div');
  cadre.className = 'pe-cadre';
  monde.appendChild(cadre);

  function ajuster() {
    var r = zone.getBoundingClientRect();
    var e = Math.min((r.width - 32) / PE_MONDE.w, (r.height - 48) / PE_MONDE.h);
    st.echelle = Math.max(0.3, Math.min(1.6, e));
    feuille.style.width = Math.round(PE_MONDE.w * st.echelle) + 'px';
    feuille.style.height = Math.round(PE_MONDE.h * st.echelle) + 'px';
    monde.style.transform = 'scale(' + st.echelle + ')';
  }
  var ro = typeof ResizeObserver === 'function' ? new ResizeObserver(ajuster) : null;
  if (ro) ro.observe(zone); else window.addEventListener('resize', ajuster);

  // ── Historique ──
  function memoriser() {
    st.undo.push(JSON.stringify(c)); if (st.undo.length > 60) st.undo.shift();
    st.redo = []; st.modifie = true;
  }
  function annuler() {
    if (!st.undo.length) return;
    st.redo.push(JSON.stringify(c)); c = JSON.parse(st.undo.pop()); st.sel = {}; st.modifie = true; dessiner();
  }
  function retablir() {
    if (!st.redo.length) return;
    st.undo.push(JSON.stringify(c)); c = JSON.parse(st.redo.pop()); st.sel = {}; st.modifie = true; dessiner();
  }

  // ── Dessin ──
  function merY() { return typeof c.frontMer === 'number' ? c.frontMer : PE_MER_DEFAUT; }

  function dessiner() {
    var chev = {}, fm = merY(), chevIds = peChevauchements(c.spots);
    chevIds.forEach(function(id) { chev[id] = true; });
    var mouilles = pePlacesDansLaMer(c.spots, fm);
    mouilles.forEach(function(id) { chev[id] = true; });
    mer.style.top = (fm - PE_MONDE.y0) + 'px';
    mer.style.height = (PE_MONDE.h - (fm - PE_MONDE.y0)) + 'px';
    var h = '';
    c.barriers.forEach(function(g, i) {
      h += '<div class="' + (g.type === 'h' ? 'barrier-h' : 'barrier-v') + ' pe-el pe-barriere' + (st.sel['G:' + i] ? ' pe-sel' : '') + '" data-k="G:' + i + '"'
        + ' style="left:' + g.x + 'px;top:' + g.y + 'px;' + (g.type === 'h' ? 'width:' + g.width : 'height:' + g.height) + 'px;' + peRotStyle(g) + '" title="' + _escP(g.label || 'Barrière') + '"></div>';
    });
    c.tapisH.forEach(function(t, i) {
      h += '<div class="tapis-h pe-el' + (st.sel['H:' + i] ? ' pe-sel' : '') + '" data-k="H:' + i + '" style="left:' + t.x + 'px;top:' + t.y + 'px;width:' + t.width + 'px;' + peRotStyle(t) + '" title="' + _escP(t.label || 'Tapis') + '"></div>';
    });
    c.tapisV.forEach(function(t, i) {
      h += '<div class="tapis-v pe-el' + (st.sel['V:' + i] ? ' pe-sel' : '') + '" data-k="V:' + i + '" style="left:' + t.x + 'px;top:' + (t.top || 0) + 'px;bottom:auto;height:' + t.height + 'px;' + peRotStyle(t) + '" title="' + _escP(t.label || 'Tapis') + '"></div>';
    });
    c.showers.forEach(function(d, i) {
      h += '<div class="shower-cabin pe-el' + (st.sel['D:' + i] ? ' pe-sel' : '') + '" data-k="D:' + i + '" style="left:' + d.x + 'px;top:' + d.y + 'px;' + peRotStyle(d, 'translate(-50%, -50%)') + '" title="' + _escP(d.label || 'Douche') + '"></div>';
    });
    c.barnums.forEach(function(b, i) {
      h += barnumHtml(b, { k: 'B:' + i, cls: 'pe-el' + (st.sel['B:' + i] ? ' pe-sel' : '') });
    });
    c.spots.forEach(function(s) {
      h += '<div class="spot pe-el pe-place' + (st.sel['S:' + s.id] ? ' pe-sel' : '') + (chev[s.id] ? ' pe-chev' : '') + '" data-state="free" data-k="S:' + s.id + '"'
        + ' style="left:' + (s.x - PE_TAILLE / 2) + 'px;top:' + (s.y - PE_TAILLE / 2) + 'px;width:' + PE_TAILLE + 'px;height:' + PE_TAILLE + 'px">'
        + '<span style="position:relative;z-index:1">' + _escP(s.id) + '</span></div>';
    });
    // Poignées d'étirement d'un tapis sélectionné seul
    var selT = selection();
    if (selT.length === 1 && TOURNABLES[selT[0].type]) {
      var ce0 = _peCentre(selT[0]), dist = _peDemiHauteur(selT[0]) + 26, ar = (selT[0].o.rot || 0) * Math.PI / 180;
      var hx = ce0.x + Math.sin(ar) * dist, hy = ce0.y - Math.cos(ar) * dist;
      h += '<div class="pe-rot-tige" style="left:' + ce0.x + 'px;top:' + (ce0.y - dist) + 'px;height:' + dist + 'px;transform:rotate(' + (selT[0].o.rot || 0) + 'deg)"></div>'
        + '<div class="pe-rot" data-rot="1" style="left:' + hx + 'px;top:' + hy + 'px" title="Glisser pour faire pivoter (Maj : par 45°)">' + peIcone('pivoter', 14) + '</div>';
    }
    if (selT.length === 1 && !selT[0].o.rot && (selT[0].type === 'H' || selT[0].type === 'V' || selT[0].type === 'B' || selT[0].type === 'G')) {
      var t = selT[0].o, ends = selT[0].type === 'H'
        ? [[t.x, t.y + PE_TAPIS / 2], [t.x + t.width, t.y + PE_TAPIS / 2]]
        : selT[0].type === 'V'
        ? [[t.x + PE_TAPIS / 2, t.top || 0], [t.x + PE_TAPIS / 2, (t.top || 0) + t.height]]
        : selT[0].type === 'G'
        ? (t.type === 'h' ? [[t.x, t.y + 2], [t.x + t.width, t.y + 2]] : [[t.x + 3, t.y], [t.x + 3, t.y + t.height]])
        : [[t.x, t.y], [t.x + t.w, t.y + t.h]];
      ['a', 'b'].forEach(function(p, i) {
        h += '<div class="pe-poignee pe-poignee-' + selT[0].type + '" data-p="' + p + '" style="left:' + ends[i][0] + 'px;top:' + ends[i][1] + 'px" title="Glisser pour ' + (selT[0].type === 'B' ? 'agrandir ou réduire' : 'allonger ou raccourcir') + '"></div>';
      });
    }
    // Rangée en cours de tracé : places fantômes
    (st.fantomes || []).forEach(function(f, i, tab) {
      h += '<div class="pe-fantome" style="left:' + (f.x - PE_TAILLE / 2) + 'px;top:' + (f.y - PE_TAILLE / 2) + 'px;width:' + PE_TAILLE + 'px;height:' + PE_TAILLE + 'px"></div>';
      if (i === tab.length - 1) h += '<div class="pe-fantome-nb" style="left:' + (f.x + PE_TAILLE / 2 + 6) + 'px;top:' + (f.y - 12) + 'px">' + tab.length + ' place' + (tab.length > 1 ? 's' : '') + '</div>';
    });
    // Lignes de repère de l'alignement automatique
    (st.guides || []).forEach(function(g) {
      h += g.axe === 'x'
        ? '<div class="pe-guide pe-guide-v" style="left:' + g.v + 'px;top:' + PE_MONDE.y0 + 'px;height:' + PE_MONDE.h + 'px"></div>'
        : '<div class="pe-guide pe-guide-h" style="top:' + g.v + 'px;left:' + PE_MONDE.x0 + 'px;width:' + PE_MONDE.w + 'px"></div>';
    });
    // Poignée du front de mer
    h += '<div class="pe-mer-ligne' + (geste && geste.type === 'mer' ? ' on' : '') + '" style="top:' + fm + 'px;left:' + PE_MONDE.x0 + 'px;width:' + PE_MER_LARGEUR + 'px"></div>'
      + '<button type="button" class="pe-mer-poignee" data-mer="1" style="left:' + (PE_MONDE.x0 + PE_MER_LARGEUR - 130) + 'px;top:' + fm + 'px" title="Glisser pour déplacer le front de mer">' + peIcone('vertical', 14) + 'Front de mer</button>';
    calque.innerHTML = h;
    majBarre(chevIds.length, mouilles.length);
    majProps();
  }

  function majBarre(nbChev, nbMer) {
    var n = c.spots.length;
    $('pe-compte').innerHTML = '<b>' + n + '</b> place' + (n > 1 ? 's' : '') + ' · ' + c.showers.length + ' douche' + (c.showers.length > 1 ? 's' : '') + ' · ' + (c.tapisH.length + c.tapisV.length) + ' tapis' + (c.barnums.length ? ' · ' + c.barnums.length + ' barnum' + (c.barnums.length > 1 ? 's' : '') : '');
    var capa = (typeof CAPA_DEFAUT !== 'undefined') ? CAPA_DEFAUT.totale : 35;
    var v = $('pe-verif');
    if (nbChev) { v.className = 'pe-verif pe-ko'; v.textContent = '⚠ ' + nbChev + ' places se chevauchent'; }
    else if (nbMer) { v.className = 'pe-verif pe-ko'; v.textContent = '⚠ ' + nbMer + ' place' + (nbMer > 1 ? 's' : '') + ' dans la mer'; }
    else if (n < capa) { v.className = 'pe-verif pe-ko'; v.textContent = '⚠ ' + n + ' places pour ' + capa + ' personnes'; }
    else { v.className = 'pe-verif pe-okv'; v.textContent = '✓ Assez de places pour ' + capa + ' personnes'; }
    $('pe-undo').disabled = !st.undo.length;
    $('pe-redo').disabled = !st.redo.length;
    container.querySelectorAll('.pe-outil[data-o]').forEach(function(b) {
      var on = b.dataset.o === st.outil; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
    });
    $('pe-aide').textContent = {
      sel: st.tactile
        ? 'Toucher pour sélectionner · glisser pour déplacer · glisser dans le vide pour encadrer plusieurs éléments · appui long : copier, coller, dupliquer, supprimer'
        : 'Glisser pour déplacer · Maj + glisser : horizontal ou vertical seulement · Alt + glisser : dupliquer · Maj + clic : ajouter à la sélection · clic droit : copier, coller, dupliquer, supprimer',
      place: 'Cliquer pour poser une place · glisser du premier au dernier emplacement pour tracer une rangée (dans n’importe quel sens)',
      tapis: 'Glisser pour tracer un tapis (horizontal ou vertical selon le sens du tracé)',
      barriere: 'Glisser pour tracer une barrière blanche (horizontale ou verticale selon le sens du tracé)',
      barnum: 'Glisser pour tracer un barnum (vu du dessus) · un simple clic pose un barnum de taille moyenne',
      douche: 'Cliquer sur le plan pour poser une douche',
    }[st.outil];
  }

  function selection() {
    return _peElements(c).filter(function(e) { return st.sel[e.k]; });
  }

  function majProps() {
    var sel = selection(), p = $('pe-props'), h;
    if (!sel.length) {
      h = '<h3>' + { sel: 'Sélection', place: 'Places', tapis: 'Tapis', douche: 'Douche', barnum: 'Barnum', barriere: 'Barrière' }[st.outil] + '</h3>';
      if (st.outil === 'place') {
        h += '<p class="pe-hint"><b>Un clic</b> : une place.<br><b>Glisser</b> du premier au dernier emplacement : une rangée, les places apparaissent pendant le tracé.</p>'
          + '<label class="pl-f">Écart entre deux places (px)<input type="number" id="pe-re" min="36" max="120" step="5" value="' + st.ecart + '"></label>'
          + '<p class="pe-hint">50 px = l’écart des rangées actuelles.</p>';
      } else {
        h += '<p class="pe-hint">Aucun élément sélectionné.</p>'
          + (st.tactile ? '<details class="pe-rac"><summary>Gestes</summary><dl>'
            + '<dt>Toucher</dt><dd>Sélectionner un élément</dd>'
            + '<dt>Glisser</dt><dd>Déplacer · dans le vide : encadrer plusieurs éléments</dd>'
            + '<dt>Appui long</dt><dd>Copier, coller, dupliquer, supprimer</dd>'
            + '<dt>Sélection multiple</dt><dd>Toucher plusieurs éléments un par un</dd>'
            + '</dl></details>' : '')
          + (st.tactile ? '' : '<details class="pe-rac"><summary>Raccourcis clavier</summary><dl>'
          + '<dt>A · E · R · D · F · G</dt><dd>Sélection · Places · Tapis · Douche · Barnum · Barrière</dd>'
          + '<dt>Maj + glisser</dt><dd>Déplacer à l’horizontale ou à la verticale seulement</dd>'
          + '<dt>Alt + glisser</dt><dd>Dupliquer en déplaçant (l’original reste)</dd>'
          + '<dt>Maj + clic</dt><dd>Ajouter ou retirer de la sélection</dd>'
          + '<dt>Ctrl + A</dt><dd>Tout sélectionner</dd>'
          + '<dt>Ctrl + C · V · D</dt><dd>Copier · Coller · Dupliquer</dd>'
          + '<dt>Ctrl + Z · Y</dt><dd>Annuler · Rétablir</dd>'
          + '<dt>Flèches</dt><dd>Ajuster de 1 px (Maj : 10 px)</dd>'
          + '<dt>Suppr</dt><dd>Supprimer</dd>'
          + '<dt>Échap</dt><dd>Tout désélectionner</dd>'
          + '</dl></details>');
      }
      h += '<div class="pe-sec"><label class="pl-f">Front de mer (px depuis le haut)<input type="number" id="pe-mer" min="' + PE_MER_MIN + '" max="' + PE_MER_MAX + '" step="5" value="' + merY() + '"></label>'
        + (typeof c.frontMer === 'number' && c.frontMer !== PE_MER_DEFAUT ? '<button type="button" class="pl-btn" id="pe-mer-raz">Position habituelle (' + PE_MER_DEFAUT + ')</button>' : '')
        + '<p class="pe-hint">Glissez la poignée « Front de mer » sur le plan, ou saisissez une valeur.</p></div>';
      h += '<div class="pe-sec"><p class="pe-hint">Les places gardent toujours leur numéro. Une nouvelle place prend le numéro suivant, jamais un ancien : l\'historique et les statistiques restent justes.</p></div>';
      p.innerHTML = h;
      var re = p.querySelector('#pe-re'), mi = p.querySelector('#pe-mer'), mr = p.querySelector('#pe-mer-raz');
      if (mi) mi.addEventListener('change', function() {
        memoriser(); c.frontMer = Math.max(PE_MER_MIN, Math.min(PE_MER_MAX, peAimanter(parseInt(mi.value, 10) || PE_MER_DEFAUT))); dessiner();
      });
      if (mr) mr.addEventListener('click', function() { memoriser(); delete c.frontMer; dessiner(); });
      if (re) re.addEventListener('change', function() { st.ecart = Math.max(36, Math.min(120, parseInt(re.value, 10) || 50)); });
      basculeMulti(p);
      return;
    }
    var places = sel.filter(function(e) { return e.type === 'S'; });
    h = '<h3>' + sel.length + ' élément' + (sel.length > 1 ? 's' : '') + ' sélectionné' + (sel.length > 1 ? 's' : '') + '</h3>';
    if (places.length) h += '<p class="pe-hint">' + places.map(function(e) { return e.o.id; }).sort(function(a, b) { return peNumero(a) - peNumero(b); }).join(', ') + '</p>';
    if (sel.length > 1) {
      h += '<div class="pe-alg">'
        + '<button type="button" class="pl-btn" data-al="haut" title="Aligner sur la même ligne">⤒ Même ligne</button>'
        + '<button type="button" class="pl-btn" data-al="gauche" title="Aligner sur la même colonne">⇤ Même colonne</button>'
        + (sel.length > 2 ? '<button type="button" class="pl-btn" data-al="rh" title="Répartir régulièrement en largeur">⇹ Répartir ↔</button>'
          + '<button type="button" class="pl-btn" data-al="rv" title="Répartir régulièrement en hauteur">⇳ Répartir ↕</button>' : '')
        + '</div>';
    }
    if (sel.length === 1 && (sel[0].type === 'H' || sel[0].type === 'V')) {
      var lg = sel[0].type === 'H' ? sel[0].o.width : sel[0].o.height;
      h += '<label class="pl-f">Longueur du tapis (px)<input type="number" id="pe-lg" min="30" max="1000" step="5" value="' + lg + '"></label>';
    }
    var tournables = sel.filter(function(e) { return TOURNABLES[e.type]; });
    if (tournables.length) {
      h += '<div class="pl-f">Rotation'
        + (tournables.length === 1 ? '<div class="pe-angle"><input type="number" id="pe-rot" min="-180" max="180" step="1" value="' + (tournables[0].o.rot || 0) + '" aria-label="Angle en degrés"><span>°</span></div>' : '')
        + '<div class="pe-rot-btns">'
        + [-90, -15, 0, 15, 90].map(function(d) {
            return '<button type="button" class="pl-btn" data-rd="' + d + '">' + (d === 0 ? '0°' : (d > 0 ? '+' : '−') + Math.abs(d) + '°') + '</button>';
          }).join('')
        + '</div></div>';
    }
    if (sel.length === 1 && sel[0].type === 'G') {
      h += '<label class="pl-f">Longueur de la barrière (px)<input type="number" id="pe-gl" min="20" max="1100" step="5" value="' + (sel[0].o.type === 'h' ? sel[0].o.width : sel[0].o.height) + '"></label>';
    }
    if (sel.length === 1 && sel[0].type === 'B') {
      var bo = sel[0].o;
      h += '<label class="pl-f">Nom<input id="pe-bn" maxlength="40" value="' + _escBarnum(bo.nom || '') + '" placeholder="Ex. Accueil, Ombre, Animation"></label>'
        + '<div class="pl-f">Couleur<div class="pe-couleurs" role="radiogroup" aria-label="Couleur du barnum">'
        + PE_COULEURS_BARNUM.map(function(cl) {
            return '<button type="button" class="pe-couleur" data-couleur="' + cl[0] + '" role="radio" aria-checked="' + ((bo.couleur || 'orange') === cl[0]) + '" title="' + cl[1] + '" aria-label="' + cl[1] + '"></button>';
          }).join('') + '</div></div>'
        + '<div class="pe-alg"><label class="pl-f">Largeur (px)<input type="number" id="pe-bw" min="30" max="600" step="5" value="' + bo.w + '"></label>'
        + '<label class="pl-f">Profondeur (px)<input type="number" id="pe-bh" min="30" max="400" step="5" value="' + bo.h + '"></label></div>'
        + '<p class="pe-hint">Repère : une place mesure 34 px. Les places peuvent rester sous un barnum (ombre).</p>';
    }
    h += '<div class="pe-sec"><button type="button" class="pl-btn pl-btn-del" id="pe-suppr2">Supprimer</button></div>';
    p.innerHTML = h;
    // Rotation : chaque élément pivote sur son centre
    function tourner(fn) {
      memoriser();
      sel.forEach(function(e) {
        if (!TOURNABLES[e.type]) return;
        var r = peAngle(fn(e.o.rot || 0), 0);
        if (r) e.o.rot = r; else delete e.o.rot;
      });
      dessiner();
    }
    p.querySelectorAll('[data-rd]').forEach(function(b) {
      b.addEventListener('click', function() {
        var d = parseInt(b.dataset.rd, 10);
        tourner(function(r) { return d === 0 ? 0 : r + d; });
      });
    });
    var roti = p.querySelector('#pe-rot');
    if (roti) roti.addEventListener('change', function() { var v = parseFloat(roti.value) || 0; tourner(function() { return v; }); });
    var gli = p.querySelector('#pe-gl');
    if (gli) gli.addEventListener('change', function() {
      var v = Math.max(20, Math.min(1100, peAimanter(parseInt(gli.value, 10) || 20)));
      memoriser();
      if (sel[0].o.type === 'h') sel[0].o.width = v; else sel[0].o.height = v;
      dessiner();
    });
    if (sel.length === 1 && sel[0].type === 'B') {
      var bb = sel[0].o;
      p.querySelector('#pe-bn').addEventListener('change', function(ev) { memoriser(); bb.nom = ev.target.value.trim(); dessiner(); });
      p.querySelectorAll('.pe-couleur').forEach(function(btn) {
        btn.addEventListener('click', function() { memoriser(); bb.couleur = btn.dataset.couleur; dessiner(); });
      });
      ['bw', 'bh'].forEach(function(id) {
        p.querySelector('#pe-' + id).addEventListener('change', function(ev) {
          var v = Math.max(PE_BARNUM_MIN, Math.min(id === 'bw' ? 600 : 400, peAimanter(parseInt(ev.target.value, 10) || PE_BARNUM_MIN)));
          memoriser(); bb[id === 'bw' ? 'w' : 'h'] = v; dessiner();
        });
      });
    }
    p.querySelectorAll('[data-al]').forEach(function(b) { b.addEventListener('click', function() { aligner(b.dataset.al); }); });
    var lgi = p.querySelector('#pe-lg');
    if (lgi) lgi.addEventListener('change', function() {
      var v = Math.max(30, Math.min(1000, peAimanter(parseInt(lgi.value, 10) || 30)));
      memoriser();
      if (sel[0].type === 'H') sel[0].o.width = v; else sel[0].o.height = v;
      dessiner();
    });
    p.querySelector('#pe-suppr2').addEventListener('click', supprimer);
    basculeMulti(p);
  }

  function basculeMulti(p) {
    if (!st.tactile || st.outil !== 'sel') return;
    var n = selection().length;
    var b = document.createElement('div');
    b.className = 'pe-multi';
    b.innerHTML = '<button type="button" class="pe-multi-btn' + (st.multi ? ' on' : '') + '" aria-pressed="' + st.multi + '">'
      + '<span class="pe-multi-coche" aria-hidden="true"></span>Sélection multiple</button>'
      + (n ? '<button type="button" class="pl-btn pe-multi-aucun">Tout désélectionner</button>' : '<button type="button" class="pl-btn pe-multi-tout">Tout sélectionner</button>');
    p.insertBefore(b, p.firstChild);
    b.querySelector('.pe-multi-btn').addEventListener('click', function() { st.multi = !st.multi; dessiner(); });
    var aucun = b.querySelector('.pe-multi-aucun'), tout = b.querySelector('.pe-multi-tout');
    if (aucun) aucun.addEventListener('click', function() { st.sel = {}; dessiner(); });
    if (tout) tout.addEventListener('click', function() { _peElements(c).forEach(function(e) { st.sel[e.k] = true; }); dessiner(); });
  }

  function aligner(mode) {
    var sel = selection(); if (sel.length < 2) return;
    memoriser();
    var centres = sel.map(_peCentre);
    if (mode === 'haut') {
      var y = Math.min.apply(null, centres.map(function(p) { return p.y; }));
      sel.forEach(function(e, i) { var r = _peRef(e); _peSetRef(e, r.x, r.y + (y - centres[i].y)); });
    } else if (mode === 'gauche') {
      var x = Math.min.apply(null, centres.map(function(p) { return p.x; }));
      sel.forEach(function(e, i) { var r = _peRef(e); _peSetRef(e, r.x + (x - centres[i].x), r.y); });
    } else {
      var axe = mode === 'rh' ? 'x' : 'y', cibles = peRepartir(centres.map(function(p) { return p[axe]; }));
      sel.forEach(function(e, i) {
        var r = _peRef(e), d = cibles[i] - centres[i][axe];
        _peSetRef(e, r.x + (axe === 'x' ? d : 0), r.y + (axe === 'y' ? d : 0));
      });
    }
    dessiner();
  }

  function supprimer() {
    var sel = selection(); if (!sel.length) return;
    memoriser();
    var morts = {}; sel.forEach(function(e) { morts[e.k] = true; });
    c.spots = c.spots.filter(function(s) { return !morts['S:' + s.id]; });
    c.tapisH = c.tapisH.filter(function(t, i) { return !morts['H:' + i]; });
    c.tapisV = c.tapisV.filter(function(t, i) { return !morts['V:' + i]; });
    c.showers = c.showers.filter(function(d, i) { return !morts['D:' + i]; });
    c.barnums = c.barnums.filter(function(b, i) { return !morts['B:' + i]; });
    c.barriers = c.barriers.filter(function(g, i) { return !morts['G:' + i]; });
    st.sel = {};
    dessiner();
  }

  // ── Copier / coller / dupliquer ──
  function copieSelection() {
    return selection().map(function(e) { return { type: e.type, o: JSON.parse(JSON.stringify(e.o)) }; });
  }
  function copier() {
    var items = copieSelection();
    if (items.length) { st.presse = items; st.collages = 0; }
  }
  // Pose une copie des éléments : à l'endroit visé (`at`), sinon juste en dessous
  function poser(items, at, decalage) {
    if (!items || !items.length) return;
    var centres = items.map(function(it) { return _peCentre({ type: it.type, o: it.o }); });
    var minX = Math.min.apply(null, centres.map(function(p) { return p.x; }));
    var minY = Math.min.apply(null, centres.map(function(p) { return p.y; }));
    // Sans point visé : copie posée juste en dessous (une rangée = 50 px), sans chevaucher l'original
    var dx = at ? peAimanter(at.x - minX) : 0, dy = at ? peAimanter(at.y - minY) : decalage;
    memoriser();
    st.sel = {};
    items.forEach(function(it) {
      var o = JSON.parse(JSON.stringify(it.o)), e = { type: it.type, o: o }, r = _peRef(e);
      _peSetRef(e, r.x + dx, r.y + dy);
      if (it.type === 'S') st.sel[nouvellePlace(o.x, o.y)] = true;          // nouvelle place = nouveau numéro
      else if (it.type === 'H') { c.tapisH.push(o); st.sel['H:' + (c.tapisH.length - 1)] = true; }
      else if (it.type === 'V') { c.tapisV.push(o); st.sel['V:' + (c.tapisV.length - 1)] = true; }
      else if (it.type === 'G') { c.barriers.push(o); st.sel['G:' + (c.barriers.length - 1)] = true; }
      else if (it.type === 'D') { o.label = 'Douche ' + (c.showers.length + 1); c.showers.push(o); st.sel['D:' + (c.showers.length - 1)] = true; }
      else if (it.type === 'B') {
        o.id = 'B' + (c.barnums.reduce(function(m, x) { return Math.max(m, parseInt(String(x.id || '').slice(1), 10) || 0); }, 0) + 1);
        c.barnums.push(o); st.sel['B:' + (c.barnums.length - 1)] = true;
      }
    });
    st.outil = 'sel';
    dessiner();
  }
  function coller(at) {
    if (!st.presse || !st.presse.length) return;
    st.collages = (st.collages || 0) + 1;
    poser(st.presse, at, 50 * st.collages);
  }
  function dupliquer() { poser(copieSelection(), null, 50); }

  // ── Menu du clic droit (appui long sur tablette) ──
  function fermerMenu() {
    var m = document.getElementById('pe-menu');
    if (m) m.remove();
    document.removeEventListener('pointerdown', menuDehors, true);
  }
  function menuDehors(ev) { var m = document.getElementById('pe-menu'); if (m && !m.contains(ev.target)) fermerMenu(); }
  function ouvrirMenu(clientX, clientY, cibleEl) {
    fermerMenu();
    var p = point({ clientX: clientX, clientY: clientY });
    var cible = cibleEl && cibleEl.closest ? cibleEl.closest('[data-k]') : null, k = cible && cible.dataset.k;
    if (k && !st.sel[k]) { st.sel = {}; st.sel[k] = true; }
    if (k && st.outil !== 'sel') st.outil = 'sel';
    dessiner();
    var n = selection().length, peutColler = !!(st.presse && st.presse.length);
    var quoi = n > 1 ? n + ' éléments' : n === 1 ? ({ S: 'la place', H: 'le tapis', V: 'le tapis', D: 'la douche', B: 'le barnum', G: 'la barrière' })[selection()[0].type] : '';
    var m = document.createElement('div');
    m.id = 'pe-menu'; m.className = 'cap-menu pe-menu'; m.setAttribute('role', 'menu');
    m.innerHTML = (quoi ? '<p class="cap-menu-t">' + quoi + '</p>' : '')
      + '<button type="button" role="menuitem" data-m="copier"' + (n ? '' : ' disabled') + '>Copier<kbd>Ctrl+C</kbd></button>'
      + '<button type="button" role="menuitem" data-m="coller"' + (peutColler ? '' : ' disabled') + '>Coller ici<kbd>Ctrl+V</kbd></button>'
      + '<button type="button" role="menuitem" data-m="dupliquer"' + (n ? '' : ' disabled') + '>Dupliquer<kbd>Ctrl+D</kbd></button>'
      + '<hr>'
      + '<button type="button" role="menuitem" data-m="supprimer" class="cap-menu-danger"' + (n ? '' : ' disabled') + '>Supprimer<kbd>Suppr</kbd></button>';
    document.body.appendChild(m);
    m.style.position = 'fixed';
    m.style.left = Math.max(8, Math.min(clientX, window.innerWidth - m.offsetWidth - 8)) + 'px';
    m.style.top = Math.max(8, Math.min(clientY, window.innerHeight - m.offsetHeight - 8)) + 'px';
    m.querySelectorAll('button').forEach(function(b) {
      b.addEventListener('click', function() {
        var a = b.dataset.m;
        fermerMenu();
        if (a === 'copier') copier();
        else if (a === 'coller') coller(p);
        else if (a === 'dupliquer') dupliquer();
        else if (a === 'supprimer') supprimer();
      });
    });
    setTimeout(function() { document.addEventListener('pointerdown', menuDehors, true); }, 0);
    var premier = m.querySelector('button:not([disabled])');
    if (premier) premier.focus();
  }
  monde.addEventListener('contextmenu', function(ev) {
    ev.preventDefault();
    geste = null; st.fantomes = []; st.guides = []; cadre.className = 'pe-cadre';
    ouvrirMenu(ev.clientX, ev.clientY, ev.target);
  });
  // Appui long au doigt (tablette) : même menu
  var appuiLong = null;
  function annulerAppuiLong() { if (appuiLong) { clearTimeout(appuiLong.t); appuiLong = null; } }
  monde.addEventListener('pointerdown', function(ev) {
    annulerAppuiLong();
    if (ev.pointerType !== 'touch') return;
    var cx = ev.clientX, cy = ev.clientY, cibleEl = ev.target;
    appuiLong = { x: cx, y: cy, t: setTimeout(function() {
      appuiLong = null;
      if (geste && geste.avant && geste.bouge) return;                // un déplacement est en cours
      geste = null; st.fantomes = []; st.guides = []; cadre.className = 'pe-cadre';
      ouvrirMenu(cx, cy, cibleEl);
    }, 550) };
  });
  monde.addEventListener('pointermove', function(ev) {
    if (appuiLong && Math.hypot(ev.clientX - appuiLong.x, ev.clientY - appuiLong.y) > 10) annulerAppuiLong();
  });
  monde.addEventListener('pointerup', annulerAppuiLong);
  monde.addEventListener('pointercancel', annulerAppuiLong);

  function nouvellePlace(x, y) {
    var n = peProchainNumero(tousPlans, c);
    c.spots.push({ id: 'P' + n, label: 'Place ' + n, x: x, y: y });
    c.dernierNumero = n;
    return 'S:P' + n;
  }

  // Repères fixes : tout ce qui n'est pas en train de bouger
  function reperesFixes(exclus) {
    var r = { xs: [], ys: [] };
    _peElements(c).forEach(function(e) {
      if (exclus[e.k]) return;
      var q = _peReperes(e); r.xs = r.xs.concat(q.xs); r.ys = r.ys.concat(q.ys);
    });
    return r;
  }
  // Position d'un nouvel élément : accrochée à l'alignement des autres, sinon à la grille
  function caler(x, y) {
    var f = reperesFixes({}), ax = peAlignement([x], f.xs, PE_SEUIL_ALIGN), ay = peAlignement([y], f.ys, PE_SEUIL_ALIGN);
    return { x: ax ? ax.ligne : peAimanter(x), y: ay ? ay.ligne : peAimanter(y) };
  }

  // ── Souris / doigt ──
  function point(ev) {
    var r = monde.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / st.echelle + PE_MONDE.x0, y: (ev.clientY - r.top) / st.echelle + PE_MONDE.y0 };
  }
  var geste = null;

  monde.addEventListener('pointerdown', function(ev) {
    if (ev.button > 0) return;
    var p = point(ev), cible = ev.target.closest('[data-k]'), k = cible && cible.dataset.k;
    var multi = ev.shiftKey || ev.ctrlKey || ev.metaKey;
    monde.setPointerCapture(ev.pointerId);
    // Poignée de rotation
    if (ev.target.closest('[data-rot]')) {
      var er = selection()[0], cr = _peCentre(er);
      geste = { type: 'rotation', e: er, c: cr, rot0: er.o.rot || 0, a0: Math.atan2(p.y - cr.y, p.x - cr.x) * 180 / Math.PI, avant: JSON.stringify(c), bouge: false };
      return;
    }
    // Poignée du front de mer
    if (ev.target.closest('[data-mer]')) {
      geste = { type: 'mer', avant: JSON.stringify(c), bouge: false };
      dessiner();
      return;
    }
    // Poignée d'un tapis : allonger / raccourcir
    var poignee = ev.target.closest('[data-p]');
    if (poignee) {
      var tsel = selection()[0];
      geste = { type: 'taille', e: tsel, bout: poignee.dataset.p, avant: JSON.stringify(c), orig: JSON.parse(JSON.stringify(tsel.o)), fixes: reperesFixes(st.sel), bouge: false };
      return;
    }
    if (k && st.outil === 'sel') {
      var avantClic = JSON.stringify(c), basculer = null;
      if (ev.ctrlKey || ev.metaKey) { if (st.sel[k]) delete st.sel[k]; else st.sel[k] = true; }
      else if (st.multi) { if (st.sel[k]) basculer = k; else st.sel[k] = true; }   // retiré si on relâche sans bouger
      else if (ev.shiftKey) { if (st.sel[k]) basculer = k; else st.sel[k] = true; }   // Maj + clic : ajoute (retire si on relâche sans bouger)
      else if (!st.sel[k]) { st.sel = {}; st.sel[k] = true; }
      // Alt + glisser : on emporte une copie, l'original reste en place (comme Illustrator / Photoshop)
      var copieAlt = null;
      if (ev.altKey && selection().length) {
        copieAlt = { selAvant: Object.assign({}, st.sel) };
        poser(copieSelection(), null, 0);
        st.undo.pop();                                   // copie + déplacement = une seule étape d'annulation
      }
      var sel = selection();
      var mob = { xs: [], ys: [] };
      sel.forEach(function(e) { var q = _peReperes(e); mob.xs = mob.xs.concat(q.xs); mob.ys = mob.ys.concat(q.ys); });
      geste = { type: 'deplacer', p0: p, avant: avantClic, refs: sel.map(function(e) { return { e: e, r: _peRef(e) }; }),
        mob: mob, fixes: reperesFixes(st.sel), bouge: false, basculer: basculer, copieAlt: copieAlt };
      dessiner();
      return;
    }
    if (st.outil === 'sel') {
      if (!multi && !st.multi) st.sel = {};
      geste = { type: 'cadre', p0: p, multi: multi };
      dessiner();
      return;
    }
    if (st.outil === 'tapis') { geste = { type: 'tapis', p0: { x: peAimanter(p.x), y: peAimanter(p.y) } }; return; }
    if (st.outil === 'barriere') { var g0 = caler(p.x, p.y); geste = { type: 'barriere', p0: g0 }; return; }
    if (st.outil === 'barnum') { geste = { type: 'barnum', p0: caler(p.x, p.y) }; return; }
    if (st.outil === 'place') {
      var d0 = caler(p.x, p.y);
      geste = { type: 'rangee', p0: d0 };
      st.sel = {}; st.fantomes = [d0];
      dessiner();
      return;
    }
    var pos = caler(p.x, p.y), x = pos.x, y = pos.y;
    memoriser();
    st.sel = {};

    if (st.outil === 'douche') { c.showers.push({ x: x, y: y, label: 'Douche ' + (c.showers.length + 1) }); st.sel['D:' + (c.showers.length - 1)] = true; }
    dessiner();
  });

  monde.addEventListener('pointermove', function(ev) {
    if (!geste) return;
    var p = point(ev);
    if (geste.type === 'deplacer') {
      var rx = p.x - geste.p0.x, ry = p.y - geste.p0.y;
      if (!geste.bouge && Math.abs(rx) < 3 && Math.abs(ry) < 3) return;
      geste.bouge = true;
      // Maj enfoncée : déplacement uniquement horizontal ou vertical (selon le sens dominant)
      var bloqueX = false, bloqueY = false;
      if (ev.shiftKey) { if (Math.abs(rx) >= Math.abs(ry)) { ry = 0; bloqueY = true; } else { rx = 0; bloqueX = true; } }
      // Alignement automatique sur les autres éléments, sinon grille aimantée
      var ax = bloqueX ? null : peAlignement(geste.mob.xs.map(function(v) { return v + rx; }), geste.fixes.xs, PE_SEUIL_ALIGN);
      var ay = bloqueY ? null : peAlignement(geste.mob.ys.map(function(v) { return v + ry; }), geste.fixes.ys, PE_SEUIL_ALIGN);
      var dx = ax ? rx + ax.correction : peAimanter(rx), dy = ay ? ry + ay.correction : peAimanter(ry);
      st.guides = [];
      if (ax) st.guides.push({ axe: 'x', v: ax.ligne });
      if (ay) st.guides.push({ axe: 'y', v: ay.ligne });
      geste.refs.forEach(function(o) { _peSetRef(o.e, Math.round(o.r.x + dx), Math.round(o.r.y + dy)); });
      dessiner();
    } else if (geste.type === 'rotation') {
      var a1 = Math.atan2(p.y - geste.c.y, p.x - geste.c.x) * 180 / Math.PI;
      var rot = peAngle(geste.rot0 + (a1 - geste.a0), ev.shiftKey ? 45 : 5);
      if (rot) geste.e.o.rot = rot; else delete geste.e.o.rot;
      geste.bouge = true;
      dessiner();
    } else if (geste.type === 'mer') {
      c.frontMer = Math.max(PE_MER_MIN, Math.min(PE_MER_MAX, peAimanter(p.y)));
      geste.bouge = true;
      dessiner();
    } else if (geste.type === 'rangee') {
      st.fantomes = pePositionsRangee(geste.p0, p, st.ecart);
      dessiner();
    } else if (geste.type === 'taille' && geste.e.type === 'B') {
      // Agrandir / réduire le barnum par un coin, en s'accrochant aux autres éléments
      var ob = geste.orig, tb = geste.e.o;
      var axb = peAlignement([p.x], geste.fixes.xs, PE_SEUIL_ALIGN), ayb = peAlignement([p.y], geste.fixes.ys, PE_SEUIL_ALIGN);
      var vx = axb ? axb.ligne : peAimanter(p.x), vy = ayb ? ayb.ligne : peAimanter(p.y);
      st.guides = [];
      if (axb) st.guides.push({ axe: 'x', v: axb.ligne });
      if (ayb) st.guides.push({ axe: 'y', v: ayb.ligne });
      if (geste.bout === 'b') {
        tb.w = Math.max(PE_BARNUM_MIN, vx - ob.x); tb.h = Math.max(PE_BARNUM_MIN, vy - ob.y);
      } else {
        var fx = ob.x + ob.w, fy = ob.y + ob.h;
        tb.x = Math.min(vx, fx - PE_BARNUM_MIN); tb.y = Math.min(vy, fy - PE_BARNUM_MIN);
        tb.w = fx - tb.x; tb.h = fy - tb.y;
      }
      geste.bouge = true;
      dessiner();
    } else if (geste.type === 'taille' && geste.e.type === 'G') {
      var og = geste.orig, tg = geste.e.o, hz = og.type === 'h';
      var bg = hz ? p.x : p.y, ag = peAlignement([bg], hz ? geste.fixes.xs : geste.fixes.ys, PE_SEUIL_ALIGN);
      var vg = ag ? ag.ligne : peAimanter(bg);
      st.guides = ag ? [{ axe: hz ? 'x' : 'y', v: ag.ligne }] : [];
      var deb = hz ? og.x : og.y, lng = hz ? og.width : og.height, nd = deb, nl = lng;
      if (geste.bout === 'b') nl = Math.max(20, vg - deb);
      else { nd = Math.min(vg, deb + lng - 20); nl = deb + lng - nd; }
      if (hz) { tg.x = nd; tg.width = nl; } else { tg.y = nd; tg.height = nl; }
      geste.bouge = true;
      dessiner();
    } else if (geste.type === 'taille') {
      // Étirer le tapis par l'extrémité saisie (30 px minimum), en s'accrochant aux autres éléments
      var o = geste.orig, t = geste.e.o, horiz = geste.e.type === 'H';
      var brut = horiz ? p.x : p.y, a = peAlignement([brut], horiz ? geste.fixes.xs : geste.fixes.ys, PE_SEUIL_ALIGN);
      var v = a ? a.ligne : peAimanter(brut);
      st.guides = a ? [{ axe: horiz ? 'x' : 'y', v: a.ligne }] : [];
      if (horiz) {
        if (geste.bout === 'b') t.width = Math.max(30, v - o.x);
        else { var finH = o.x + o.width; t.x = Math.min(v, finH - 30); t.width = finH - t.x; }
      } else {
        var top0 = o.top || 0;
        if (geste.bout === 'b') t.height = Math.max(30, v - top0);
        else { var finV = top0 + o.height; t.top = Math.min(v, finV - 30); t.height = finV - t.top; }
      }
      geste.bouge = true;
      dessiner();
    } else {
      var x1 = Math.min(geste.p0.x, p.x), y1 = Math.min(geste.p0.y, p.y);
      var w = Math.abs(p.x - geste.p0.x), hh = Math.abs(p.y - geste.p0.y);
      if (geste.type === 'tapis' || geste.type === 'barriere') {
        // Aperçu dans le sens dominant
        var ep = geste.type === 'tapis' ? PE_TAPIS : 6;
        if (w >= hh) { x1 = Math.min(geste.p0.x, peAimanter(p.x)); w = Math.abs(peAimanter(p.x) - geste.p0.x); hh = ep; y1 = geste.p0.y; }
        else { y1 = Math.min(geste.p0.y, peAimanter(p.y)); hh = Math.abs(peAimanter(p.y) - geste.p0.y); w = ep; x1 = geste.p0.x; }
      }
      if (geste.type === 'barnum') {
        var bx = peAimanter(p.x), by = peAimanter(p.y);
        x1 = Math.min(geste.p0.x, bx); y1 = Math.min(geste.p0.y, by);
        w = Math.abs(bx - geste.p0.x); hh = Math.abs(by - geste.p0.y);
      }
      cadre.className = 'pe-cadre on' + (geste.type === 'tapis' ? ' pe-cadre-tapis' : geste.type === 'barnum' ? ' pe-cadre-barnum' : geste.type === 'barriere' ? ' pe-cadre-barriere' : '');
      cadre.style.cssText = 'left:' + (x1 - PE_MONDE.x0) + 'px;top:' + (y1 - PE_MONDE.y0) + 'px;width:' + w + 'px;height:' + hh + 'px';
      geste.p1 = p;
    }
  });

  function finGeste(ev) {
    if (!geste) return;
    var g = geste; geste = null;
    cadre.className = 'pe-cadre';
    var avaitGuides = st.guides && st.guides.length;
    st.guides = [];
    if (g.type === 'rotation') {
      if (g.bouge) { st.undo.push(g.avant); st.redo = []; st.modifie = true; }
      dessiner();
      return;
    }
    if (g.type === 'mer') {
      if (g.bouge) { st.undo.push(g.avant); st.redo = []; st.modifie = true; }
      dessiner();
      return;
    }
    if (g.type === 'rangee') {
      var fantomes = st.fantomes || [];
      st.fantomes = [];
      if (fantomes.length) {
        memoriser(); st.sel = {};
        fantomes.forEach(function(f) { st.sel[nouvellePlace(f.x, f.y)] = true; });
      }
      dessiner();
      return;
    }
    if (g.type === 'barnum') {
      var b;
      if (g.p1 && Math.abs(peAimanter(g.p1.x) - g.p0.x) >= PE_BARNUM_MIN && Math.abs(peAimanter(g.p1.y) - g.p0.y) >= PE_BARNUM_MIN) {
        var bx2 = peAimanter(g.p1.x), by2 = peAimanter(g.p1.y);
        b = { x: Math.min(g.p0.x, bx2), y: Math.min(g.p0.y, by2), w: Math.abs(bx2 - g.p0.x), h: Math.abs(by2 - g.p0.y) };
      } else {
        b = { x: g.p0.x - 50, y: g.p0.y - 30, w: 100, h: 60 };   // simple clic : taille moyenne centrée
      }
      memoriser(); st.sel = {};
      b.id = 'B' + (c.barnums.reduce(function(m, x) { return Math.max(m, parseInt(String(x.id || '').slice(1), 10) || 0); }, 0) + 1);
      b.nom = 'Barnum'; b.couleur = 'orange';
      c.barnums.push(b);
      st.outil = 'sel';                                          // on enchaîne sur le réglage du barnum
      st.sel['B:' + (c.barnums.length - 1)] = true;
      dessiner();
      return;
    }
    if (g.type === 'taille') {
      if (g.bouge) { st.undo.push(g.avant); st.redo = []; st.modifie = true; }
      dessiner();
      return;
    }
    if (g.type === 'deplacer' && !g.bouge) {
      if (g.copieAlt) { c = JSON.parse(g.avant); st.sel = g.copieAlt.selAvant; dessiner(); return; }
      if (g.basculer) { delete st.sel[g.basculer]; dessiner(); return; }
    }
    if (avaitGuides && !(g.type === 'deplacer' && g.bouge)) dessiner();
    if (g.type === 'deplacer' && g.bouge) {
      st.undo.push(g.avant); st.redo = []; st.modifie = true;
      // Garder dans la zone du plan
      g.refs.forEach(function(o) {
        var r = _peRef(o.e);
        _peSetRef(o.e, Math.max(PE_MONDE.x0, Math.min(PE_MONDE.x0 + PE_MONDE.w - 20, r.x)), Math.max(PE_MONDE.y0, Math.min(PE_MONDE.y0 + PE_MONDE.h - 20, r.y)));
      });
      dessiner();
    } else if (g.type === 'cadre' && g.p1) {
      var x1 = Math.min(g.p0.x, g.p1.x), x2 = Math.max(g.p0.x, g.p1.x), y1 = Math.min(g.p0.y, g.p1.y), y2 = Math.max(g.p0.y, g.p1.y);
      _peElements(c).forEach(function(e) {
        var ce = _peCentre(e);
        if (ce.x >= x1 && ce.x <= x2 && ce.y >= y1 && ce.y <= y2) st.sel[e.k] = true;
      });
      dessiner();
    } else if (g.type === 'barriere' && g.p1) {
      var bdx = peAimanter(g.p1.x) - g.p0.x, bdy = peAimanter(g.p1.y) - g.p0.y;
      if (Math.max(Math.abs(bdx), Math.abs(bdy)) < 20) return;
      memoriser(); st.sel = {};
      if (Math.abs(bdx) >= Math.abs(bdy)) c.barriers.push({ type: 'h', x: Math.min(g.p0.x, g.p0.x + bdx), y: g.p0.y, width: Math.abs(bdx), label: 'Barrière' });
      else c.barriers.push({ type: 'v', x: g.p0.x, y: Math.min(g.p0.y, g.p0.y + bdy), height: Math.abs(bdy), label: 'Barrière' });
      st.sel['G:' + (c.barriers.length - 1)] = true;
      dessiner();
    } else if (g.type === 'tapis' && g.p1) {
      var dx = peAimanter(g.p1.x) - g.p0.x, dy = peAimanter(g.p1.y) - g.p0.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
      memoriser(); st.sel = {};
      if (Math.abs(dx) >= Math.abs(dy)) {
        c.tapisH.push({ x: Math.min(g.p0.x, g.p0.x + dx), y: g.p0.y, width: Math.abs(dx), label: 'Allée' });
        st.sel['H:' + (c.tapisH.length - 1)] = true;
      } else {
        c.tapisV.push({ x: g.p0.x, top: Math.min(g.p0.y, g.p0.y + dy), height: Math.abs(dy), label: 'Allée' });
        st.sel['V:' + (c.tapisV.length - 1)] = true;
      }
      dessiner();
    }
  }
  monde.addEventListener('pointerup', finGeste);
  monde.addEventListener('pointercancel', function() { geste = null; st.fantomes = []; st.guides = []; cadre.className = 'pe-cadre'; dessiner(); });

  // ── Clavier ──
  function clavier(ev) {
    if (!document.body.contains(container) || !container.classList.contains('pe-mode')) return;
    var tag = (ev.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || document.querySelector('dialog[open]')) return;
    var k = ev.key;
    if ((ev.ctrlKey || ev.metaKey) && k.toLowerCase() === 'z') { ev.preventDefault(); if (ev.shiftKey) retablir(); else annuler(); return; }
    if ((ev.ctrlKey || ev.metaKey) && k.toLowerCase() === 'y') { ev.preventDefault(); retablir(); return; }
    if (k === 'Delete' || k === 'Backspace') { ev.preventDefault(); fermerMenu(); supprimer(); return; }
    if ((ev.ctrlKey || ev.metaKey) && k.toLowerCase() === 'c') { if (selection().length) { ev.preventDefault(); copier(); } return; }
    if ((ev.ctrlKey || ev.metaKey) && k.toLowerCase() === 'v') { if (st.presse && st.presse.length) { ev.preventDefault(); coller(null); } return; }
    if ((ev.ctrlKey || ev.metaKey) && k.toLowerCase() === 'd') { ev.preventDefault(); if (selection().length) dupliquer(); return; }
    if (k === 'Escape' && document.getElementById('pe-menu')) { fermerMenu(); return; }
    if (k === 'Escape') { st.sel = {}; dessiner(); return; }
    if ((ev.ctrlKey || ev.metaKey) && k.toLowerCase() === 'a') {
      ev.preventDefault(); st.outil = 'sel'; st.sel = {};
      _peElements(c).forEach(function(e) { st.sel[e.k] = true; });
      dessiner(); return;
    }
    if (k === 'Alt') { ev.preventDefault(); monde.classList.add('pe-alt'); return; }
    if (!ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      var outil = { a: 'sel', e: 'place', r: 'tapis', d: 'douche', f: 'barnum', g: 'barriere' }[k.toLowerCase()];
      if (outil) { st.outil = outil; if (outil !== 'sel') st.sel = {}; dessiner(); return; }
    }
    var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
    if (d && selection().length) {
      ev.preventDefault();
      var pas = ev.shiftKey ? 10 : 1;
      memoriser();
      selection().forEach(function(e) { var r = _peRef(e); _peSetRef(e, r.x + d[0] * pas, r.y + d[1] * pas); });
      dessiner();
    }
  }
  document.addEventListener('keydown', clavier);
  function relacheAlt(ev) { if (!ev || ev.key === 'Alt' || ev.type === 'blur') monde.classList.remove('pe-alt'); }
  document.addEventListener('keyup', relacheAlt);
  window.addEventListener('blur', relacheAlt);

  // ── Barre d'outils et boutons ──
  container.querySelectorAll('.pe-outil[data-o]').forEach(function(b) {
    b.addEventListener('click', function() { st.outil = b.dataset.o; if (st.outil !== 'sel') st.sel = {}; dessiner(); });
  });

  $('pe-undo').addEventListener('click', annuler);
  $('pe-redo').addEventListener('click', retablir);
  $('pe-nom').addEventListener('input', function() { st.modifie = true; });

  function quitter() {
    document.removeEventListener('keydown', clavier);
    document.removeEventListener('keyup', relacheAlt);
    window.removeEventListener('blur', relacheAlt);
    fermerMenu();
    if (ro) ro.disconnect(); else window.removeEventListener('resize', ajuster);
    container.classList.remove('pe-mode');
    if (opts.onFin) opts.onFin();
  }
  $('pe-retour').addEventListener('click', function() {
    if (st.modifie && !confirm('Quitter sans enregistrer ? Les modifications seront perdues.')) return;
    quitter();
  });

  // Brouillon : seulement pour un plan qui n'est ni par défaut ni programmé (sinon il sortirait du service)
  var auj = _dateLocaleISO();
  var programme = (opts.progs || []).some(function(g) { return g.plan_id === plan.id && g.date_fin >= auj; });
  var brouillonPossible = opts.copie || (!plan.par_defaut && !programme);
  if (!brouillonPossible) {
    $('pe-brouillon').disabled = true;
    $('pe-brouillon').title = 'Ce plan est utilisé (par défaut ou programmé) : il ne peut pas repasser en brouillon.';
  }

  async function enregistrer(brouillon) {
    var nom = $('pe-nom').value.trim();
    if (!nom) { alert('Donnez un nom au plan.'); $('pe-nom').focus(); return; }
    if (!c.spots.length) { alert('Le plan doit contenir au moins une place.'); return; }
    var chev = peChevauchements(c.spots);
    if (!brouillon && chev.length && !confirm(chev.length + ' places se chevauchent (' + chev.slice(0, 8).join(', ') + (chev.length > 8 ? '…' : '') + ').\n\nEnregistrer quand même ?')) return;
    c.version = 1;
    c.dernierNumero = Math.max(c.dernierNumero || 0, peProchainNumero(tousPlans, c) - 1);
    var boutons = container.querySelectorAll('#pe-ok, #pe-brouillon');
    boutons.forEach(function(b) { b.disabled = true; });
    try {
      if (opts.copie) await creerPlan({ nom: nom, description: plan.description, contenu: c, brouillon: !!brouillon });
      else await enregistrerPlan(plan.id, { nom: nom, contenu: c, brouillon: !!brouillon });
      st.modifie = false;
      quitter();
    } catch (e) {
      boutons.forEach(function(b) { b.disabled = false; });
      if (!brouillonPossible) $('pe-brouillon').disabled = true;
      alert('Enregistrement impossible : ' + (e.message || e));
    }
  }
  $('pe-ok').addEventListener('click', function() { enregistrer(false); });
  $('pe-brouillon').addEventListener('click', function() { enregistrer(true); });

  ajuster();
  dessiner();
}

function _peOutil(id, ic, txt) {
  var lettre = { sel: 'A', place: 'E', tapis: 'R', douche: 'D', barnum: 'F', barriere: 'G' }[id];
  return '<button type="button" class="pe-outil" data-o="' + id + '" aria-pressed="false" title="' + txt + ' (' + lettre + ')" aria-keyshortcuts="' + lettre + '"><i aria-hidden="true">' + (peIcone(id) || ic) + '</i>' + txt + '</button>';
}

if (typeof module !== 'undefined') {
  module.exports = { peAngle, pePlacesDansLaMer, peProchainNumero, peChevauchements, peAimanter, peRepartir, peNumero, peAlignement, pePositionsRangee };
}
