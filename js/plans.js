// js/plans.js — écran « Plans » (responsable) : liste, duplication, mise en service, programmation
'use strict';

var _plansEtat = { plans: [], progs: [], idDuJour: null };

function _escP(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _dateFr(iso, opts) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', opts || { day: 'numeric', month: 'long' });
}
function _ajouterJours(iso, n) {
  var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return _dateLocaleISO(d);
}
function _periodeFr(g) {
  return g.date_debut === g.date_fin ? _dateFr(g.date_debut) : _dateFr(g.date_debut) + ' → ' + _dateFr(g.date_fin);
}

// Miniature du plan (places, tapis, douches, barnums) à l'échelle d'une carte
function miniPlanHtml(contenu, largeur) {
  var W = BEACH_CONFIG.mapWidth, H = BEACH_CONFIG.mapHeight, k = largeur / (W + 40);
  var h = '<div class="pl-mini" style="width:' + largeur + 'px;height:' + Math.round((H + 60) * k) + 'px"><div class="pl-mini-in" style="transform:scale(' + k + ');width:' + (W + 40) + 'px;height:' + (H + 60) + 'px">';
  (contenu.tapisH || []).forEach(function(t) { h += '<i class="pl-m-tapis" style="left:' + (t.x + 20) + 'px;top:' + (t.y + 14) + 'px;width:' + t.width + 'px;height:10px"></i>'; });
  (contenu.tapisV || []).forEach(function(t) { h += '<i class="pl-m-tapis" style="left:' + (t.x + 20) + 'px;top:' + ((t.top || 0) + 14) + 'px;width:10px;height:' + (t.height || H) + 'px"></i>'; });
  (contenu.spots || []).forEach(function(s) { h += '<i class="pl-m-place" style="left:' + (s.x + 5) + 'px;top:' + (s.y - 1) + 'px"></i>'; });
  (contenu.showers || []).forEach(function(d) { h += '<i class="pl-m-douche" style="left:' + (d.x + 20) + 'px;top:' + (d.y + 14) + 'px"></i>'; });
  (contenu.barnums || []).forEach(function(b) { h += '<i class="pl-m-barnum" style="left:' + (b.x + 20) + 'px;top:' + (b.y + 14) + 'px;width:' + (b.w || 100) + 'px;height:' + (b.h || 40) + 'px"></i>'; });
  return h + '</div></div>';
}

var PL_COULEURS = ['#2e7d32', '#1565c0', '#c2560a', '#6a1b9a', '#00838f', '#ad1457'];
function _couleurPlan(plans, p) {
  if (!p) return '#90a4ae';
  if (p.par_defaut) return '#78909c';
  var autres = plans.filter(function(x) { return !x.par_defaut; });
  return PL_COULEURS[Math.max(0, autres.findIndex(function(x) { return x.id === p.id; })) % PL_COULEURS.length];
}

function _resumePlan(c) {
  var n = (c.spots || []).length, d = (c.showers || []).length, b = (c.barnums || []).length;
  return n + ' place' + (n > 1 ? 's' : '') + ' · ' + d + ' douche' + (d > 1 ? 's' : '') + (b ? ' · ' + b + ' barnum' + (b > 1 ? 's' : '') : '');
}

// Prochain changement de plan dans l'année qui vient
function _prochainChangement(plans, progs, auj) {
  var actuel = planPourDate(plans, progs, auj);
  for (var i = 1; i <= 366; i++) {
    var d = _ajouterJours(auj, i), p = planPourDate(plans, progs, d);
    if ((p && p.id) !== (actuel && actuel.id)) return { date: d, plan: p };
  }
  return null;
}

async function renderPlansView(container) {
  container.innerHTML = '<div class="pl-wrap"><p class="pl-chargement">Chargement des plans…</p></div>';
  try {
    var res = await Promise.all([listerPlans(), listerProgrammations()]);
    _plansEtat.plans = res[0]; _plansEtat.progs = res[1];
  } catch (e) {
    container.innerHTML = '<div class="pl-wrap"><h1 class="pl-h1">Plans de la plage</h1><p class="pl-err">'
      + (/plans|schema cache|does not exist/i.test(e.message || '') ? 'La base n\'est pas encore prête : le script <b>supabase/migration-plans.sql</b> est à exécuter dans Supabase.' : 'Chargement impossible : ' + _escP(e.message || e))
      + '</p></div>';
    return;
  }
  _dessinerPlans(container);
}

function _dessinerPlans(container) {
  var plans = _plansEtat.plans, progs = _plansEtat.progs, auj = _dateLocaleISO();
  var duJour = planPourDate(plans, progs, auj);
  var suite = _prochainChangement(plans, progs, auj);
  var progsAVenir = progs.filter(function(g) { return g.date_fin >= auj; });

  var h = '<div class="pl-wrap">'
    + '<h1 class="pl-h1">Plans de la plage <span class="pl-lock">Responsable</span></h1>'
    + '<p class="pl-sub">Le plan en service est celui de la vue Plage. On ne modifie jamais un plan en service : on travaille sur une copie.</p>'
    + '<div class="pl-now"><span class="pl-dot" aria-hidden="true"></span><p><b>En service aujourd\'hui : ' + _escP(duJour ? duJour.nom : 'plan intégré au site') + '</b><br><small>'
    + (suite ? 'À partir du ' + _dateFr(suite.date, { weekday: 'long', day: 'numeric', month: 'long' }) + ' : « ' + _escP(suite.plan ? suite.plan.nom : 'plan intégré') + ' ».' : 'Aucun changement programmé.')
    + '</small></p></div>'
    + '<div class="pl-grid">';

  plans.forEach(function(p) {
    var mesProgs = progsAVenir.filter(function(g) { return g.plan_id === p.id; });
    var tags = '';
    if (duJour && duJour.id === p.id) tags += '<span class="pl-tag pl-t-on">En service</span>';
    if (p.par_defaut) tags += '<span class="pl-tag pl-t-def">Plan par défaut</span>';
    if (p.brouillon) tags += '<span class="pl-tag pl-t-br">Brouillon</span>';
    mesProgs.forEach(function(g) { tags += '<span class="pl-tag pl-t-prog">' + _periodeFr(g) + '</span>'; });
    var maj = p.updated_at ? 'modifié le ' + new Date(p.updated_at).toLocaleDateString('fr-FR') : '';
    h += '<article class="pl-card' + (duJour && duJour.id === p.id ? ' pl-actif' : '') + '">'
      + '<div class="pl-thumb">' + miniPlanHtml(p.contenu || {}, 340) + '</div>'
      + '<div class="pl-bd"><h2>' + _escP(p.nom) + '</h2>'
      + (tags ? '<div class="pl-tags">' + tags + '</div>' : '')
      + '<p class="pl-meta">' + _resumePlan(p.contenu || {}) + (maj ? ' · ' + maj : '') + '</p>'
      + (p.description ? '<p class="pl-desc">' + _escP(p.description) + '</p>' : '')
      + '</div>'
      + '<div class="pl-acts">'
      + '<button type="button" class="pl-btn pl-btn-out" data-a="utiliser" data-id="' + p.id + '">Utiliser…</button>'
      + '<button type="button" class="pl-btn" data-a="dupliquer" data-id="' + p.id + '">Dupliquer</button>'
      + '<button type="button" class="pl-btn" data-a="renommer" data-id="' + p.id + '">Renommer</button>'
      + (p.par_defaut ? '' : '<button type="button" class="pl-btn pl-btn-del" data-a="supprimer" data-id="' + p.id + '" aria-label="Supprimer « ' + _escP(p.nom) + ' »" title="Supprimer">Supprimer</button>')
      + '</div></article>';
  });
  h += '</div>';

  // Programmation : frise des 4 prochains mois + liste
  var fin = _ajouterJours(auj, 120), total = 121;
  var pos = function(iso) { return Math.max(0, Math.min(100, (new Date(iso + 'T12:00:00') - new Date(auj + 'T12:00:00')) / 864e5 / total * 100)); };
  var segs = '', courant = null, debutSeg = auj;
  for (var i = 0; i <= 121; i++) {
    var d = _ajouterJours(auj, i), p = i < 121 ? planPourDate(plans, progs, d) : { id: '__fin' };
    if (courant === null) { courant = p; debutSeg = d; continue; }
    if ((p && p.id) !== (courant && courant.id)) {
      var gauche = pos(debutSeg), larg = pos(d) - gauche;
      var nomSeg = courant ? courant.nom : 'Plan intégré';
      segs += '<div class="pl-seg" style="background:' + _couleurPlan(plans, courant) + ';left:' + gauche + '%;width:' + larg + '%" title="' + _escP(nomSeg + ' : ' + _dateFr(debutSeg) + ' → ' + _dateFr(_ajouterJours(d, -1))) + '">' + (larg > 9 ? _escP(nomSeg) : '') + '</div>';
      courant = p; debutSeg = d;
    }
  }
  var mois = '';
  for (var m = 0; m < 5; m++) {
    var dm = new Date(auj + 'T12:00:00'); dm.setMonth(dm.getMonth() + m, 1);
    var iso = _dateLocaleISO(dm);
    if (iso >= auj && iso <= fin && pos(iso) > 9) mois += '<span style="left:' + pos(iso) + '%">' + dm.toLocaleDateString('fr-FR', { month: 'short' }) + '</span>';
  }
  h += '<section class="pl-cal"><div class="pl-cal-hd"><h2>Programmation</h2><button type="button" class="pl-btn pl-btn-out" id="pl-prog-new">+ Programmer un plan</button></div>'
    + '<div class="pl-tl" aria-hidden="true">' + segs + '</div><div class="pl-mois" aria-hidden="true"><span style="left:0">Aujourd\'hui</span>' + mois + '</div>'
    + (progsAVenir.length
      ? '<ul class="pl-progs">' + progsAVenir.map(function(g) {
          var pp = plans.find(function(x) { return x.id === g.plan_id; });
          return '<li><span><i class="pl-pastille" style="background:' + _couleurPlan(plans, pp) + '"></i><b>' + _periodeFr(g) + '</b> : ' + _escP(pp ? pp.nom : '?') + '</span><button type="button" class="pl-btn pl-btn-del" data-a="retirer" data-id="' + g.id + '">Retirer</button></li>';
        }).join('') + '</ul>'
      : '<p class="pl-vide">Aucune programmation : le plan par défaut s\'applique tous les jours.</p>')
    + '<p class="pl-note">Si deux programmations se chevauchent, la plus courte l\'emporte : une journée événement passe devant un plan de saison.</p>'
    + '</section></div>';

  container.innerHTML = h;
  container.querySelectorAll('[data-a]').forEach(function(b) {
    b.addEventListener('click', function() { _actionPlan(container, b.dataset.a, b.dataset.id); });
  });
  var nouv = container.querySelector('#pl-prog-new');
  if (nouv) nouv.addEventListener('click', function() { _dialogUtiliser(container, null, 'dates'); });
}

async function _recharger(container) {
  try {
    var res = await Promise.all([listerPlans(), listerProgrammations()]);
    _plansEtat.plans = res[0]; _plansEtat.progs = res[1];
  } catch (e) { /* on garde l'état précédent */ }
  _dessinerPlans(container);
}

async function _actionPlan(container, a, id) {
  var plan = _plansEtat.plans.find(function(p) { return p.id === id; });
  try {
    if (a === 'dupliquer') {
      var nom = prompt('Nom de la copie :', plan.nom + ' (copie)');
      if (!nom || !nom.trim()) return;
      await dupliquerPlan(plan, nom.trim().slice(0, 80));
      await _recharger(container);
    } else if (a === 'renommer') {
      _dialogRenommer(container, plan);
    } else if (a === 'supprimer') {
      var n = _plansEtat.progs.filter(function(g) { return g.plan_id === id; }).length;
      var enService = planPourDate(_plansEtat.plans, _plansEtat.progs, _dateLocaleISO());
      if (enService && enService.id === id) { alert('Ce plan est en service aujourd\'hui : il ne peut pas être supprimé.'); return; }
      if (!confirm('Supprimer le plan « ' + plan.nom + ' » ?' + (n ? '\n\nSes ' + n + ' programmation(s) seront aussi retirées.' : '') + '\n\nCette action est définitive.')) return;
      await supprimerPlan(id);
      await _recharger(container);
    } else if (a === 'retirer') {
      var g = _plansEtat.progs.find(function(x) { return x.id === id; });
      var auj = _dateLocaleISO();
      var toucheAuj = g.date_debut <= auj && auj <= g.date_fin;
      if (toucheAuj) {
        // Retirer une programmation en cours change le plan d'aujourd'hui
        var reste = _plansEtat.progs.filter(function(x) { return x.id !== id; });
        var apres = planPourDate(_plansEtat.plans, reste, auj);
        if (!(await _verifierPlaces(apres))) return;
      }
      if (!confirm('Retirer cette programmation (' + _periodeFr(g) + ') ?')) return;
      await retirerProgrammation(id);
      if (toucheAuj) return _rechargerPage();
      await _recharger(container);
    } else if (a === 'utiliser') {
      _dialogUtiliser(container, plan, 'defaut');
    }
  } catch (e) {
    alert('Action impossible : ' + (e.message || e));
  }
}

// Changement qui touche aujourd'hui : aucune personne installée ne doit perdre sa place
async function _verifierPlaces(nouveauPlan) {
  if (!nouveauPlan) return true;
  var occ = await placesOccupeesAujourdhui();
  var manq = placesManquantes(occ, nouveauPlan.contenu);
  if (!manq.length) return true;
  alert('Changement impossible aujourd\'hui : des personnes sont installées sur des places absentes de « '
    + nouveauPlan.nom + ' » (' + manq.join(', ') + ').\n\nLibérez ces places, ou programmez le plan à partir de demain.');
  return false;
}

function _rechargerPage() {
  alert('Le plan de la plage a changé pour aujourd\'hui : la page va se recharger.\n\nSur les autres tablettes, rechargez la page pour voir le nouveau plan.');
  window.location.reload();
}

function _dialogBase(titre, corps, libelleOk) {
  var old = document.getElementById('pl-dlg'); if (old) old.remove();
  var dlg = document.createElement('dialog');
  dlg.id = 'pl-dlg'; dlg.className = 'cap-dlg';
  dlg.setAttribute('aria-labelledby', 'pl-dlg-t');
  dlg.innerHTML = '<form method="dialog">'
    + '<div class="cap-hd"><h2 id="pl-dlg-t">' + titre + '</h2><button type="button" class="cap-x" data-x aria-label="Fermer">✕</button></div>'
    + '<div class="cap-bd">' + corps + '<p class="cap-err" id="pl-err" role="alert"></p></div>'
    + '<div class="cap-acts"><button type="button" class="cap-reset pl-annuler" data-x>Annuler</button><button type="button" class="cap-ok" id="pl-ok">' + libelleOk + '</button></div>'
    + '</form>';
  document.body.appendChild(dlg);
  var fermer = function() { if (dlg.open) dlg.close(); dlg.remove(); };
  dlg.querySelectorAll('[data-x]').forEach(function(b) { b.addEventListener('click', fermer); });
  dlg.addEventListener('cancel', function(e) { e.preventDefault(); fermer(); });
  dlg.showModal();
  return { dlg: dlg, fermer: fermer, err: dlg.querySelector('#pl-err'), ok: dlg.querySelector('#pl-ok') };
}

function _dialogRenommer(container, plan) {
  var d = _dialogBase('Renommer le plan',
    '<label class="pl-f">Nom<input id="pl-nom" maxlength="80" value="' + _escP(plan.nom) + '"></label>'
    + '<label class="pl-f">Description <small>(facultatif)</small><textarea id="pl-desc" rows="2" maxlength="300">' + _escP(plan.description || '') + '</textarea></label>',
    'Enregistrer');
  d.ok.addEventListener('click', async function() {
    var nom = d.dlg.querySelector('#pl-nom').value.trim();
    if (!nom) { d.err.textContent = 'Le nom est obligatoire.'; return; }
    d.ok.disabled = true;
    try { await renommerPlan(plan.id, nom, d.dlg.querySelector('#pl-desc').value.trim()); d.fermer(); await _recharger(container); }
    catch (e) { d.ok.disabled = false; d.err.textContent = e.message || String(e); }
  });
}

// mode : 'defaut' (plan par défaut) ou 'dates' (programmation)
function _dialogUtiliser(container, plan, mode) {
  var auj = _dateLocaleISO(), demain = _ajouterJours(auj, 1);
  var choixPlan = plan ? '' : '<label class="pl-f">Plan<select id="pl-plan">'
    + _plansEtat.plans.filter(function(p) { return !p.brouillon; }).map(function(p) { return '<option value="' + p.id + '">' + _escP(p.nom) + '</option>'; }).join('')
    + '</select></label>';
  var d = _dialogBase(plan ? 'Utiliser « ' + _escP(plan.nom) + ' »' : 'Programmer un plan',
    choixPlan
    + '<div class="cap-chips pl-modes" role="radiogroup" aria-label="Mise en service">'
    +   '<label class="cap-chip"><input type="radio" name="pl-mode" value="defaut"' + (mode === 'defaut' ? ' checked' : '') + '><span>Plan par défaut</span></label>'
    +   '<label class="cap-chip"><input type="radio" name="pl-mode" value="dates"' + (mode === 'dates' ? ' checked' : '') + '><span>Sur des dates</span></label>'
    + '</div>'
    + '<p class="cap-hint" id="pl-mode-aide"></p>'
    + '<div class="pl-dates" id="pl-dates"><label class="pl-f">Du<input type="date" id="pl-debut" value="' + demain + '" min="' + auj + '"></label>'
    + '<label class="pl-f">Au <small>(même date = une seule journée)</small><input type="date" id="pl-fin" value="' + demain + '" min="' + auj + '"></label></div>',
    'Valider');
  var q = function(s) { return d.dlg.querySelector(s); };
  function maj() {
    var m = (q('input[name="pl-mode"]:checked') || {}).value;
    q('#pl-dates').hidden = m !== 'dates';
    q('#pl-mode-aide').textContent = m === 'defaut'
      ? 'S\'applique tous les jours qui n\'ont pas de programmation. Prend effet tout de suite.'
      : 'S\'applique uniquement sur ces dates, puis on revient au plan par défaut.';
  }
  d.dlg.addEventListener('change', function(e) {
    if (e.target.id === 'pl-debut' && q('#pl-fin').value < e.target.value) q('#pl-fin').value = e.target.value;
    maj();
  });
  maj();
  d.ok.addEventListener('click', async function() {
    d.err.textContent = '';
    var cible = plan || _plansEtat.plans.find(function(p) { return p.id === q('#pl-plan').value; });
    if (!cible) { d.err.textContent = 'Choisissez un plan.'; return; }
    var m = q('input[name="pl-mode"]:checked').value;
    var plans = _plansEtat.plans, progs = _plansEtat.progs;
    var avant = planPourDate(plans, progs, auj), apres;
    var debut, fin;
    if (m === 'defaut') {
      if (cible.par_defaut) { d.err.textContent = 'C\'est déjà le plan par défaut.'; return; }
      apres = planPourDate(plans.map(function(p) { return Object.assign({}, p, { par_defaut: p.id === cible.id }); }), progs, auj);
    } else {
      debut = q('#pl-debut').value; fin = q('#pl-fin').value;
      if (!debut || !fin || fin < debut) { d.err.textContent = 'Choisissez des dates valides.'; return; }
      if (debut < auj) { d.err.textContent = 'La date de début ne peut pas être passée.'; return; }
      apres = planPourDate(plans, progs.concat([{ plan_id: cible.id, date_debut: debut, date_fin: fin, created_at: new Date().toISOString() }]), auj);
    }
    var changeAuj = (avant && avant.id) !== (apres && apres.id);
    d.ok.disabled = true;
    try {
      if (changeAuj && !(await _verifierPlaces(apres))) { d.ok.disabled = false; return; }
      if (m === 'defaut') await definirPlanParDefaut(cible.id);
      else await programmerPlan(cible.id, debut, fin);
      d.fermer();
      if (changeAuj) return _rechargerPage();
      await _recharger(container);
    } catch (e) {
      d.ok.disabled = false;
      d.err.textContent = e.message || String(e);
    }
  });
}
