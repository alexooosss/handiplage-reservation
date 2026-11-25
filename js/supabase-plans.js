// js/supabase-plans.js — plans de la plage enregistrés en base
// Le plan écrit dans data.js reste le plan de secours : si la base ne répond pas ou si le
// plan reçu est invalide, la plage s'affiche avec lui. Elle ne se retrouve jamais sans plan.
'use strict';

var PLAN_SECOURS = null;      // copie du plan de data.js, prise avant toute modification
var PLAN_EN_SERVICE = null;   // { id, nom } du plan chargé, null = plan de secours

function _dateLocaleISO(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Un plan est utilisable s'il a au moins une place, avec des identifiants uniques et des coordonnées
function planValide(contenu) {
  if (!contenu || !Array.isArray(contenu.spots) || contenu.spots.length === 0) return false;
  var vus = {};
  for (var i = 0; i < contenu.spots.length; i++) {
    var s = contenu.spots[i];
    if (!s || typeof s.id !== 'string' || !s.id || vus[s.id]) return false;
    if (typeof s.x !== 'number' || typeof s.y !== 'number' || !isFinite(s.x) || !isFinite(s.y)) return false;
    vus[s.id] = true;
  }
  return ['tapisH', 'tapisV', 'showers', 'barnums'].every(function(k) {
    return contenu[k] == null || Array.isArray(contenu[k]);
  });
}

// Remplace les éléments modifiables du plan (places, tapis, douches, barnums) ; le décor fixe ne bouge pas
function appliquerPlan(config, contenu) {
  if (!PLAN_SECOURS) {
    PLAN_SECOURS = JSON.parse(JSON.stringify({
      spots: config.spots, tapisH: config.tapisH, tapisV: config.tapisV,
      showers: config.showers, barnums: config.barnums || [],
    }));
  }
  if (!planValide(contenu)) return false;
  config.spots   = contenu.spots.map(function(s) {
    return { id: s.id, label: s.label || ('Place ' + s.id.replace(/^P/, '')), x: s.x, y: s.y };
  });
  config.tapisH  = contenu.tapisH  || [];
  config.tapisV  = contenu.tapisV  || [];
  config.showers = contenu.showers || [];
  config.barnums = contenu.barnums || [];
  return true;
}

// Charge le plan en service aujourd'hui dans BEACH_CONFIG (à appeler avant renderMapStatic)
async function chargerPlanDuJour(dateISO) {
  PLAN_EN_SERVICE = null;
  try {
    var attente = new Promise(function(_, rej) { setTimeout(function() { rej(new Error('délai dépassé')); }, 5000); });
    var charge = (async function() {
      var r = await supabaseClient.rpc('plan_du_jour', { p_date: dateISO || _dateLocaleISO() });
      if (r.error) throw r.error;
      if (!r.data) return null;
      var p = await supabaseClient.from('plans').select('id, nom, contenu').eq('id', r.data).single();
      if (p.error) throw p.error;
      return p.data;
    })();
    var plan = await Promise.race([charge, attente]);
    if (plan && appliquerPlan(BEACH_CONFIG, plan.contenu)) {
      PLAN_EN_SERVICE = { id: plan.id, nom: plan.nom };
    } else if (plan) {
      console.warn('Plan « ' + plan.nom + ' » invalide : plan de secours utilisé.');
    }
  } catch (e) {
    // Table absente (migration non faite), hors ligne… : plan de secours
    console.warn('Plan de la plage : plan de secours utilisé (' + (e.message || e) + ').');
  }
  return PLAN_EN_SERVICE;
}

// ── Gestion des plans (écran « Plans », responsable) ──

async function listerPlans() {
  var r = await supabaseClient.from('plans').select('*').order('par_defaut', { ascending: false }).order('created_at');
  if (r.error) throw r.error;
  return r.data || [];
}

async function listerProgrammations() {
  var r = await supabaseClient.from('plans_programmation').select('*').order('date_debut');
  if (r.error) throw r.error;
  return r.data || [];
}

async function idPlanDuJour(dateISO) {
  var r = await supabaseClient.rpc('plan_du_jour', { p_date: dateISO || _dateLocaleISO() });
  if (r.error) throw r.error;
  return r.data || null;
}

async function dupliquerPlan(plan, nom) {
  var r = await supabaseClient.from('plans').insert({
    nom: nom, description: plan.description || null,
    contenu: plan.contenu, par_defaut: false, brouillon: false,
  }).select().single();
  if (r.error) throw r.error;
  return r.data;
}

async function renommerPlan(id, nom, description) {
  var r = await supabaseClient.from('plans')
    .update({ nom: nom, description: description || null, updated_at: new Date().toISOString() }).eq('id', id);
  if (r.error) throw r.error;
}

// Un seul plan par défaut : on retire l'ancien avant de poser le nouveau
async function definirPlanParDefaut(id) {
  var a = await supabaseClient.from('plans').update({ par_defaut: false }).eq('par_defaut', true).neq('id', id);
  if (a.error) throw a.error;
  var b = await supabaseClient.from('plans').update({ par_defaut: true, brouillon: false }).eq('id', id);
  if (b.error) throw b.error;
}

async function programmerPlan(planId, debutISO, finISO) {
  var r = await supabaseClient.from('plans_programmation').insert({ plan_id: planId, date_debut: debutISO, date_fin: finISO });
  if (r.error) throw r.error;
}

async function retirerProgrammation(id) {
  var r = await supabaseClient.from('plans_programmation').delete().eq('id', id);
  if (r.error) throw r.error;
}

async function supprimerPlan(id) {
  var r = await supabaseClient.from('plans').delete().eq('id', id).eq('par_defaut', false);
  if (r.error) throw r.error;
}

// Places occupées aujourd'hui (personne installée) : un changement de plan ne doit pas les faire disparaître
async function placesOccupeesAujourdhui() {
  var r = await supabaseClient.from('reservations').select('spot_id')
    .eq('date', _dateLocaleISO()).not('spot_id', 'is', null)
    .not('statut', 'in', '(annule,suspendu,parti,absent)');
  if (r.error) throw r.error;
  var ids = {};
  (r.data || []).forEach(function(x) { ids[x.spot_id] = true; });
  return Object.keys(ids);
}

// Places occupées qui n'existent pas dans le plan proposé
function placesManquantes(occupees, contenu) {
  var dans = {};
  ((contenu && contenu.spots) || []).forEach(function(s) { dans[s.id] = true; });
  return occupees.filter(function(id) { return !dans[id]; })
    .sort(function(a, b) { return (parseInt(a.slice(1), 10) || 0) - (parseInt(b.slice(1), 10) || 0); });
}

// Plan en service à une date, calculé côté navigateur (même règle que plan_du_jour en base)
function planPourDate(plans, progs, dateISO) {
  var actifs = {};
  plans.forEach(function(p) { if (!p.brouillon) actifs[p.id] = p; });
  var candidates = progs.filter(function(g) { return actifs[g.plan_id] && g.date_debut <= dateISO && dateISO <= g.date_fin; });
  candidates.sort(function(a, b) {
    var la = (new Date(a.date_fin) - new Date(a.date_debut)), lb = (new Date(b.date_fin) - new Date(b.date_debut));
    return la - lb || String(b.created_at).localeCompare(String(a.created_at));
  });
  if (candidates.length) return actifs[candidates[0].plan_id];
  return plans.find(function(p) { return p.par_defaut; }) || null;
}

if (typeof module !== 'undefined') {
  module.exports = { planValide, appliquerPlan, _dateLocaleISO, placesManquantes, planPourDate };
}
