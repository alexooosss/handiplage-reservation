# App Usager — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer l'interface mobile-first pour les usagers Handiplage : accueil, réservation, mes réservations, mon pass, mon compte.

**Architecture:** `usager.html` est une page dédiée (séparée de `index.html`). `js/usager-app.js` est un IIFE contrôleur de routing. Chaque vue est un module JS indépendant. `js/usager-storage.js` centralise les requêtes Supabase. `login.html` redirige déjà vers `/usager.html` pour le rôle `user` (Plan A Task 9 gère l'invite flow).

**Tech Stack:** Vanilla JS ES6, Supabase JS SDK v2, CSS mobile-first (`css/usager.css`).

---

## Structure des fichiers

| Fichier | Rôle |
|---------|------|
| `js/usager-storage.js` | Requêtes Supabase (inscription, réservations, pass, créneaux) |
| `css/usager.css` | Styles mobile-first pour toute l'app usager |
| `js/usager-accueil.js` | Vue accueil (double carte + 4 tuiles) |
| `js/usager-reserver.js` | Vue réserver (barre semaine + créneaux + confirmation) |
| `js/usager-reservations.js` | Vue mes réservations (à venir + passées + annulation) |
| `js/usager-pass.js` | Vue mon pass (solde + historique mois) |
| `js/usager-compte.js` | Vue mon compte (infos lecture seule + changement mot de passe) |
| `js/usager-app.js` | Contrôleur de routing IIFE |
| `usager.html` | Page HTML principale + auth check |
| `tests/test-usager-storage.js` | Tests fonctions pures (transformations, calculs) |
| `tests/run-all.js` *(modifié)* | Ajouter le nouveau test |

---

### Task 1 : `js/usager-storage.js` + tests

**Files:**
- Create: `tests/test-usager-storage.js`
- Create: `js/usager-storage.js`
- Modify: `tests/run-all.js`

- [ ] **Étape 1 : Écrire le test**

```js
// tests/test-usager-storage.js
'use strict';
const assert = require('assert');

// ── Fonctions pures testables ─────────────────────────────────────

function _rowToUsagerInscription(row) {
  var obj = {
    id:              row.id,
    nom:             row.nom,
    prenom:          row.prenom,
    mail:            row.mail,
    telephone:       row.telephone,
    statut:          row.statut,
    passActif:       !!row.pass_actif,
    passActivatedAt: row.pass_activated_at || null,
  };
  if (row.metadata && typeof row.metadata === 'object') {
    Object.assign(obj, row.metadata);
  }
  return obj;
}

function _rowToUsagerReservation(row) {
  return {
    id:           row.id,
    date:         row.date,
    creneauId:    row.creneau_id,
    statut:       row.statut,
    accompagnants: row.accompagnants,
    spotId:       row.spot_id || null,
    createdAt:    row.created_at,
  };
}

function computePassBalance(reservations, quota) {
  var today = new Date();
  var monthKey = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  var used = reservations.filter(function(r) {
    return r.statut !== 'annule' && r.date && r.date.startsWith(monthKey);
  }).length;
  return { used: used, remaining: Math.max(0, quota - used), quota: quota, monthKey: monthKey };
}

function canCancelReservation(dateISO) {
  var resaDate = new Date(dateISO + 'T00:00:00');
  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return resaDate >= tomorrow;
}

// ── Tests ────────────────────────────────────────────────────────

// Test 1 : _rowToUsagerInscription aplatit les metadata
var row1 = {
  id: 'insc-1', nom: 'DUPONT', prenom: 'Marie', mail: 'marie@test.fr',
  telephone: '0600000000', statut: 'valide', pass_actif: true,
  pass_activated_at: '2026-06-01', created_at: '2026-05-01T00:00:00Z',
  metadata: { adresse: '12 rue de la Mer', ville: 'Antibes', accompagnement: ['aucun'] },
};
var insc1 = _rowToUsagerInscription(row1);
assert.strictEqual(insc1.nom, 'DUPONT', 'nom mappé');
assert.strictEqual(insc1.passActif, true, 'passActif mappé');
assert.strictEqual(insc1.adresse, '12 rue de la Mer', 'metadata aplatie');
assert.strictEqual(insc1.ville, 'Antibes', 'ville depuis metadata');
console.log('✓ _rowToUsagerInscription OK');

// Test 2 : _rowToUsagerReservation
var row2 = { id: 'resa-1', date: '2026-07-09', creneau_id: 1, statut: 'attente', accompagnants: 0, spot_id: null, created_at: '2026-07-01T10:00:00Z' };
var resa1 = _rowToUsagerReservation(row2);
assert.strictEqual(resa1.creneauId, 1, 'creneauId mappé');
assert.strictEqual(resa1.spotId, null, 'spotId null');
console.log('✓ _rowToUsagerReservation OK');

// Test 3 : computePassBalance avec 3 réservations ce mois
var today = new Date();
var thisMonth = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
var resas = [
  { statut: 'attente', date: thisMonth + '-05' },
  { statut: 'present', date: thisMonth + '-08' },
  { statut: 'annule',  date: thisMonth + '-10' },  // ne compte pas
  { statut: 'attente', date: '2025-06-01' },         // mois passé, ne compte pas
];
var balance = computePassBalance(resas, 40);
assert.strictEqual(balance.used, 2, 'seules les non-annulées du mois comptent');
assert.strictEqual(balance.remaining, 38, 'remaining = 40 - 2');
assert.strictEqual(balance.quota, 40, 'quota = 40');
console.log('✓ computePassBalance OK');

// Test 4 : computePassBalance quota épuisé
var resas2 = Array.from({ length: 40 }, function(_, i) {
  return { statut: 'present', date: thisMonth + '-' + String(i % 28 + 1).padStart(2, '0') };
});
var balance2 = computePassBalance(resas2, 40);
assert.strictEqual(balance2.remaining, 0, 'remaining = 0 quand quota épuisé');
console.log('✓ computePassBalance épuisé OK');

// Test 5 : canCancelReservation
var tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
var tomorrowISO = tomorrow.toISOString().slice(0, 10);
var yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
var yesterdayISO = yesterday.toISOString().slice(0, 10);
assert.strictEqual(canCancelReservation(tomorrowISO), true,  'peut annuler pour demain');
assert.strictEqual(canCancelReservation(yesterdayISO), false, 'ne peut pas annuler pour hier');
console.log('✓ canCancelReservation OK');

console.log('✓ test-usager-storage.js OK');
```

- [ ] **Étape 2 : Lancer le test — doit passer directement (tout est inline)**

```bash
node tests/test-usager-storage.js
```

Expected: `✓ test-usager-storage.js OK`

- [ ] **Étape 3 : Écrire js/usager-storage.js**

```js
// js/usager-storage.js
'use strict';

var PASS_QUOTA_USAGER = 40;

function _rowToUsagerInscription(row) {
  var obj = {
    id:              row.id,
    nom:             row.nom,
    prenom:          row.prenom,
    mail:            row.mail,
    telephone:       row.telephone,
    statut:          row.statut,
    passActif:       !!row.pass_actif,
    passActivatedAt: row.pass_activated_at || null,
  };
  if (row.metadata && typeof row.metadata === 'object') {
    Object.assign(obj, row.metadata);
  }
  return obj;
}

function _rowToUsagerReservation(row) {
  return {
    id:            row.id,
    date:          row.date,
    creneauId:     row.creneau_id,
    statut:        row.statut,
    accompagnants: row.accompagnants,
    spotId:        row.spot_id || null,
    createdAt:     row.created_at,
  };
}

function computePassBalance(reservations, quota) {
  var today    = new Date();
  var monthKey = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  var used = reservations.filter(function(r) {
    return r.statut !== 'annule' && r.date && r.date.startsWith(monthKey);
  }).length;
  return { used: used, remaining: Math.max(0, quota - used), quota: quota, monthKey: monthKey };
}

function canCancelReservation(dateISO) {
  var resaDate = new Date(dateISO + 'T00:00:00');
  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return resaDate >= tomorrow;
}

async function getUserInscription() {
  var sessionResult = await supabaseClient.auth.getSession();
  var session = sessionResult.data.session;
  if (!session) throw new Error('Non connecté');
  var result = await supabaseClient
    .from('inscriptions')
    .select('*')
    .eq('user_id', session.user.id)
    .single();
  if (result.error) throw result.error;
  return _rowToUsagerInscription(result.data);
}

async function getAvailableDays(fromISO, toISO, inscriptionId) {
  var crRes  = await supabaseClient.from('creneaux').select('id, label, heure_debut, heure_fin, capacite_resa').order('id');
  var resaRes = await supabaseClient.from('reservations')
    .select('date, creneau_id, inscription_id, statut')
    .gte('date', fromISO).lte('date', toISO).neq('statut', 'annule');

  if (crRes.error)   throw crRes.error;
  if (resaRes.error) throw resaRes.error;

  var creneaux = crRes.data || [];
  var resas    = resaRes.data || [];

  var counts     = {};
  var userBooked = {};
  resas.forEach(function(r) {
    var key = r.date + '_' + r.creneau_id;
    counts[key] = (counts[key] || 0) + 1;
    if (inscriptionId && r.inscription_id === inscriptionId) userBooked[key] = true;
  });

  var days = {};
  var from = new Date(fromISO + 'T00:00:00');
  var to   = new Date(toISO   + 'T00:00:00');
  for (var d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    var dateISO = d.toISOString().slice(0, 10);
    days[dateISO] = creneaux.map(function(c) {
      var key   = dateISO + '_' + c.id;
      var count = counts[key] || 0;
      var booked = !!userBooked[key];
      return {
        creneauId:  c.id,
        label:      c.label,
        heureDebut: c.heure_debut,
        heureFin:   c.heure_fin,
        capacity:   c.capacite_resa,
        count:      count,
        remaining:  Math.max(0, c.capacite_resa - count),
        available:  !booked && count < c.capacite_resa,
        userBooked: booked,
      };
    });
  }
  return days;
}

async function getUserReservations(inscriptionId) {
  var result = await supabaseClient
    .from('reservations')
    .select('id, date, creneau_id, statut, accompagnants, spot_id, created_at')
    .eq('inscription_id', inscriptionId)
    .order('date', { ascending: false });
  if (result.error) throw result.error;
  return (result.data || []).map(_rowToUsagerReservation);
}

async function createUserReservation(inscription, dateISO, creneauId) {
  var result = await supabaseClient.from('reservations').insert({
    date:           dateISO,
    creneau_id:     creneauId,
    inscription_id: inscription.id,
    nom:            inscription.nom,
    prenom:         inscription.prenom,
    accompagnants:  0,
    type:           'reserved',
    statut:         'attente',
    spot_id:        null,
    resa_type:      'normal',
  }).select().single();
  if (result.error) throw result.error;
  return _rowToUsagerReservation(result.data);
}

async function cancelUserReservation(reservationId) {
  var result = await supabaseClient.from('reservations')
    .update({ statut: 'annule' })
    .eq('id', reservationId);
  if (result.error) throw result.error;
}

if (typeof module !== 'undefined') {
  module.exports = { _rowToUsagerInscription, _rowToUsagerReservation, computePassBalance, canCancelReservation };
}
```

- [ ] **Étape 4 : Ajouter à run-all.js**

```js
const tests = ['test-slots.js', 'test-timer.js', 'test-storage.js', 'test-pass.js', 'test-auth.js', 'test-supabase-inscriptions.js', 'test-supabase-mc.js', 'test-supabase-storage.js', 'test-inscription-publique.js', 'test-supabase-messages.js', 'test-usager-storage.js'];
```

- [ ] **Étape 5 : Vérifier suite complète**

```bash
node tests/run-all.js
```

Expected: `✅ Tous les tests passent.`

- [ ] **Étape 6 : Commit**

```bash
git add js/usager-storage.js tests/test-usager-storage.js tests/run-all.js
git commit -m "feat: usager-storage.js + tests (getUserInscription, getAvailableDays, reservations, pass)"
```

---

### Task 2 : `css/usager.css`

**Files:**
- Create: `css/usager.css`

- [ ] **Étape 1 : Écrire usager.css**

```css
/* css/usager.css — App usager mobile-first */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --blue:       #1565c0;
  --blue-dark:  #0d47a1;
  --blue-light: #e3f2fd;
  --green:      #2e7d32;
  --green-light:#e8f5e9;
  --red:        #c62828;
  --red-light:  #ffebee;
  --grey:       #f5f5f5;
  --border:     #e0e0e0;
  --text:       #222;
  --text-muted: #666;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 16px;
  background: var(--grey);
  color: var(--text);
  min-height: 100vh;
}

/* ── Header ────────────────────────────────────────────────────── */
#usager-header {
  background: var(--blue);
  color: white;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 10;
}
.usager-logo { font-size: 1.1rem; font-weight: 700; }
#btn-logout-usager {
  background: rgba(255,255,255,.15);
  color: white;
  border: 1px solid rgba(255,255,255,.3);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: .8125rem;
  cursor: pointer;
}
#btn-logout-usager:hover { background: rgba(255,255,255,.25); }

/* ── Contenu principal ─────────────────────────────────────────── */
#usager-content {
  max-width: 600px;
  margin: 0 auto;
  padding: 16px;
  padding-bottom: 32px;
}

/* ── Navigation retour ─────────────────────────────────────────── */
.usager-back {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--blue);
  font-weight: 600;
  font-size: .9375rem;
  cursor: pointer;
  padding: 4px 0 16px;
  background: none;
  border: none;
}
.usager-back:hover { text-decoration: underline; }

/* ── Carte ─────────────────────────────────────────────────────── */
.usager-card {
  background: white;
  border-radius: 14px;
  padding: 18px;
  margin-bottom: 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,.07);
}
.usager-card-title {
  font-size: .875rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: .05em;
  margin-bottom: 6px;
}

/* ── Accueil : double carte résumé ─────────────────────────────── */
.usager-summary-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 14px;
}
.usager-summary-card {
  background: white;
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,.07);
}
.usager-summary-label {
  font-size: .75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: .06em;
  margin-bottom: 8px;
}
.usager-summary-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--blue);
  line-height: 1.2;
}
.usager-summary-sub {
  font-size: .8125rem;
  color: var(--text-muted);
  margin-top: 4px;
}
.usager-summary-pass .usager-summary-value { color: var(--green); }

/* ── Accueil : tuiles ──────────────────────────────────────────── */
.usager-tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 14px;
}
.usager-tile {
  background: white;
  border-radius: 14px;
  padding: 20px 12px;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,.07);
  border: 2px solid transparent;
  transition: border-color .15s, background .15s;
}
.usager-tile:hover   { background: var(--blue-light); border-color: var(--blue); }
.usager-tile-primary { background: var(--blue); color: white; }
.usager-tile-primary:hover { background: var(--blue-dark); border-color: var(--blue-dark); }
.usager-tile-icon  { font-size: 1.75rem; margin-bottom: 8px; }
.usager-tile-label { font-size: .9375rem; font-weight: 700; }

/* ── Réserver : barre de jours ─────────────────────────────────── */
.usager-week-bar {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 8px;
  margin-bottom: 16px;
  scrollbar-width: none;
}
.usager-week-bar::-webkit-scrollbar { display: none; }
.usager-day-btn {
  flex-shrink: 0;
  text-align: center;
  padding: 10px 14px;
  border-radius: 12px;
  cursor: pointer;
  background: white;
  border: 2px solid var(--border);
  transition: background .15s, border-color .15s;
  min-width: 52px;
}
.usager-day-btn.available   { background: var(--green-light); border-color: #a5d6a7; }
.usager-day-btn.selected    { background: var(--blue); border-color: var(--blue); color: white; }
.usager-day-btn.full        { opacity: .5; cursor: default; }
.usager-day-btn.past        { opacity: .35; cursor: default; }
.usager-day-letter          { font-size: .75rem; font-weight: 700; text-transform: uppercase; }
.usager-day-num             { font-size: 1.1rem; font-weight: 700; margin-top: 2px; }
.usager-day-dot             { width: 6px; height: 6px; border-radius: 50%; background: var(--green); margin: 4px auto 0; }

/* ── Créneaux ──────────────────────────────────────────────────── */
.usager-slot-card {
  background: white;
  border-radius: 14px;
  padding: 16px 18px;
  margin-bottom: 10px;
  cursor: pointer;
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  gap: 14px;
  transition: border-color .15s, background .15s;
}
.usager-slot-card:hover        { border-color: var(--blue); background: var(--blue-light); }
.usager-slot-card.full         { opacity: .5; cursor: default; }
.usager-slot-card.full:hover   { border-color: var(--border); background: white; }
.usager-slot-card.booked       { background: var(--green-light); border-color: #a5d6a7; cursor: default; }
.usager-slot-icon              { font-size: 1.5rem; }
.usager-slot-body              { flex: 1; }
.usager-slot-label             { font-weight: 700; font-size: 1rem; }
.usager-slot-hours             { font-size: .875rem; color: var(--text-muted); margin-top: 2px; }
.usager-slot-badge             { font-size: .8125rem; font-weight: 600; color: var(--green); }
.usager-slot-badge.full-badge  { color: var(--text-muted); }
.usager-slot-badge.booked-badge{ color: var(--green); }

/* ── Confirmation ──────────────────────────────────────────────── */
.usager-recap-icon   { font-size: 2.5rem; text-align: center; margin: 16px 0 20px; }
.usager-recap-title  { text-align: center; font-size: 1.1rem; font-weight: 700; color: var(--blue); margin-bottom: 24px; }
.usager-recap-row    { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: .9375rem; }
.usager-recap-row:last-child { border-bottom: none; }
.usager-recap-key   { color: var(--text-muted); }
.usager-recap-val   { font-weight: 700; }
.usager-recap-val.pass-impact { color: var(--blue); }

/* ── Boutons ────────────────────────────────────────────────────── */
.usager-btn {
  width: 100%;
  padding: 16px;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  margin-top: 12px;
  transition: background .15s;
}
.usager-btn-primary  { background: var(--blue);  color: white; }
.usager-btn-primary:hover { background: var(--blue-dark); }
.usager-btn-primary:disabled { background: #90a4ae; cursor: not-allowed; }
.usager-btn-confirm  { background: var(--green); color: white; }
.usager-btn-confirm:hover { background: #1b5e20; }
.usager-btn-danger   { background: var(--red-light); color: var(--red); border: 1px solid #ef9a9a; }
.usager-btn-ghost    { background: var(--grey); color: #444; }
.usager-btn-ghost:hover { background: #e0e0e0; }

/* ── Mes réservations ───────────────────────────────────────────── */
.usager-resa-section-title { font-size: .875rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: .05em; margin: 20px 0 10px; }
.usager-resa-card {
  background: white;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
  display: flex;
  align-items: center;
  gap: 14px;
}
.usager-resa-info   { flex: 1; }
.usager-resa-date   { font-weight: 700; font-size: .9375rem; color: var(--text); }
.usager-resa-slot   { font-size: .875rem; color: var(--text-muted); margin-top: 3px; }
.usager-resa-spot   { font-size: .8125rem; color: var(--blue); margin-top: 2px; }
.usager-resa-statut { font-size: .75rem; font-weight: 700; padding: 3px 8px; border-radius: 10px; }
.resa-s-attente  { background: #fff9c4; color: #f57f17; }
.resa-s-present  { background: var(--green-light); color: var(--green); }
.resa-s-parti    { background: var(--blue-light); color: var(--blue); }
.resa-s-absent   { background: var(--red-light); color: var(--red); }
.resa-s-annule   { background: #f5f5f5; color: #999; }
.usager-cancel-btn {
  background: none;
  border: 1px solid #ef9a9a;
  color: var(--red);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: .8125rem;
  cursor: pointer;
  white-space: nowrap;
}
.usager-cancel-btn:hover { background: var(--red-light); }
.usager-empty { text-align: center; color: var(--text-muted); padding: 32px 16px; font-size: .9375rem; }

/* ── Mon pass ───────────────────────────────────────────────────── */
.usager-pass-count { text-align: center; margin: 20px 0; }
.usager-pass-num   { font-size: 3.5rem; font-weight: 700; color: var(--green); line-height: 1; }
.usager-pass-denom { font-size: 1.1rem; color: var(--text-muted); }
.usager-pass-bar-wrap { background: #e0e0e0; border-radius: 8px; height: 12px; margin: 12px 0; overflow: hidden; }
.usager-pass-bar-fill { height: 100%; border-radius: 8px; background: var(--green); transition: width .3s; }
.usager-pass-bar-fill.low   { background: #f57f17; }
.usager-pass-bar-fill.empty { background: var(--red); }
.usager-pass-meta  { font-size: .875rem; color: var(--text-muted); text-align: center; }

/* ── Mon compte ─────────────────────────────────────────────────── */
.usager-info-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  font-size: .9375rem;
}
.usager-info-row:last-child { border-bottom: none; }
.usager-info-key  { color: var(--text-muted); }
.usager-info-val  { font-weight: 600; text-align: right; max-width: 60%; }

/* ── Loading / erreur ───────────────────────────────────────────── */
.usager-loading { text-align: center; color: var(--text-muted); padding: 40px; }
.usager-error   { background: var(--red-light); border-radius: 10px; padding: 14px; color: var(--red); font-size: .9rem; margin-bottom: 12px; }
.usager-success { background: var(--green-light); border: 1px solid #a5d6a7; border-radius: 10px; padding: 14px; color: var(--green); text-align: center; }
```

- [ ] **Étape 2 : Commit**

```bash
git add css/usager.css
git commit -m "feat: usager.css — styles mobile-first app usager"
```

---

### Task 3 : `js/usager-accueil.js`

**Files:**
- Create: `js/usager-accueil.js`

- [ ] **Étape 1 : Écrire usager-accueil.js**

```js
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
      +   '<div class="usager-tile usager-tile-primary" data-view="reserver"><div class="usager-tile-icon">📅</div><div class="usager-tile-label">Réserver</div></div>'
      +   '<div class="usager-tile" data-view="reservations"><div class="usager-tile-icon">📋</div><div class="usager-tile-label">Mes résa.</div></div>'
      +   '<div class="usager-tile" data-view="pass"><div class="usager-tile-icon">🎫</div><div class="usager-tile-label">Mon pass</div></div>'
      +   '<div class="usager-tile" data-view="compte"><div class="usager-tile-icon">👤</div><div class="usager-tile-label">Mon compte</div></div>'
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
```

- [ ] **Étape 2 : Commit**

```bash
git add js/usager-accueil.js
git commit -m "feat: usager-accueil.js — vue accueil avec double carte et tuiles"
```

---

### Task 4 : `js/usager-reserver.js`

**Files:**
- Create: `js/usager-reserver.js`

Vue en deux états : sélection date+créneau, puis confirmation.

- [ ] **Étape 1 : Écrire usager-reserver.js**

```js
// js/usager-reserver.js
'use strict';

function _escR(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function renderReserver(container, inscription, showView) {
  container.innerHTML = '<div class="usager-loading">Chargement des disponibilités…</div>';

  try {
    var today   = new Date();
    var fromISO = today.toISOString().slice(0, 10);
    var toDate  = new Date(today);
    toDate.setDate(toDate.getDate() + 29);
    var toISO   = toDate.toISOString().slice(0, 10);

    var days = await getAvailableDays(fromISO, toISO, inscription.id);
    var dateKeys = Object.keys(days).sort();

    var selectedDate = dateKeys[0];
    _renderReserverContent(container, inscription, showView, days, dateKeys, selectedDate);

  } catch (e) {
    container.innerHTML = '<div class="usager-error">Erreur : ' + _escR(e.message) + '</div>';
  }
}

function _renderReserverContent(container, inscription, showView, days, dateKeys, selectedDate) {
  var dayFr = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  var monthsFr = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];

  var weekBar = '<div class="usager-week-bar">';
  dateKeys.forEach(function(dateISO) {
    var d        = new Date(dateISO + 'T00:00:00');
    var slots    = days[dateISO];
    var hasAvail = slots.some(function(s) { return s.available; });
    var isPast   = dateISO < new Date().toISOString().slice(0, 10);
    var cls      = isPast ? 'past' : hasAvail ? (dateISO === selectedDate ? 'selected available' : 'available') : 'full';
    if (dateISO === selectedDate && !isPast) cls = hasAvail ? 'selected available' : 'selected full';
    weekBar += '<div class="usager-day-btn ' + cls + '" data-date="' + dateISO + '">'
      + '<div class="usager-day-letter">' + dayFr[d.getDay()] + '</div>'
      + '<div class="usager-day-num">' + d.getDate() + '</div>'
      + (hasAvail && !isPast ? '<div class="usager-day-dot"></div>' : '<div style="height:10px"></div>')
      + '</div>';
  });
  weekBar += '</div>';

  var slotsHtml = _renderSlots(days[selectedDate] || [], selectedDate);

  var selD = new Date(selectedDate + 'T00:00:00');
  var selLabel = selD.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });

  container.innerHTML = '<button class="usager-back" id="back-accueil">← Accueil</button>'
    + weekBar
    + '<div class="usager-card-title">' + selLabel.charAt(0).toUpperCase() + selLabel.slice(1) + '</div>'
    + '<div id="slots-list">' + slotsHtml + '</div>';

  // Retour accueil
  container.querySelector('#back-accueil').addEventListener('click', function() { showView('accueil'); });

  // Navigation jours
  container.querySelectorAll('.usager-day-btn:not(.past)').forEach(function(btn) {
    btn.addEventListener('click', function() {
      selectedDate = btn.dataset.date;
      _renderReserverContent(container, inscription, showView, days, dateKeys, selectedDate);
    });
  });

  // Sélection créneau
  container.querySelectorAll('.usager-slot-card:not(.full):not(.booked)').forEach(function(card) {
    card.addEventListener('click', function() {
      var creneauId  = parseInt(card.dataset.creneauId);
      var creneauObj = (days[selectedDate] || []).find(function(s) { return s.creneauId === creneauId; });
      if (!creneauObj) return;
      renderConfirmation(container, inscription, showView, {
        dateISO:    selectedDate,
        creneauId:  creneauId,
        label:      creneauObj.label,
        heureDebut: creneauObj.heureDebut,
        heureFin:   creneauObj.heureFin,
      });
    });
  });
}

function _renderSlots(slots, dateISO) {
  if (!slots || slots.length === 0) {
    return '<div class="usager-empty">Aucun créneau disponible pour cette journée.</div>';
  }
  var icons = { 1: '🕘', 2: '🕙', 3: '🕑', 4: '🕒', 5: '🌅' };
  return slots.map(function(s) {
    var cls    = s.userBooked ? 'booked' : !s.available ? 'full' : '';
    var badge  = s.userBooked
      ? '<div class="usager-slot-badge booked-badge">✓ Déjà réservé</div>'
      : !s.available
        ? '<div class="usager-slot-badge full-badge">Complet</div>'
        : '<div class="usager-slot-badge">' + s.remaining + ' place' + (s.remaining > 1 ? 's' : '') + '</div>';
    return '<div class="usager-slot-card ' + cls + '" data-creneau-id="' + s.creneauId + '">'
      + '<div class="usager-slot-icon">' + (icons[s.creneauId] || '🕐') + '</div>'
      + '<div class="usager-slot-body">'
      +   '<div class="usager-slot-label">' + _escR(s.label) + '</div>'
      +   '<div class="usager-slot-hours">' + (s.heureDebut || '').slice(0, 5) + ' – ' + (s.heureFin || '').slice(0, 5) + '</div>'
      +   badge
      + '</div>'
      + '</div>';
  }).join('');
}

async function renderConfirmation(container, inscription, showView, params) {
  var d = new Date(params.dateISO + 'T00:00:00');
  var dateLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  // Calculer l'impact pass
  var passImpactHtml = '';
  if (inscription.passActif) {
    try {
      var resas   = await getUserReservations(inscription.id);
      var balance = computePassBalance(resas, PASS_QUOTA_USAGER);
      if (balance.remaining === 0) {
        container.innerHTML = '<button class="usager-back" id="back-reserver">← Retour</button>'
          + '<div class="usager-error" style="margin-top:12px">Pass épuisé pour ce mois. Aucune réservation possible.</div>';
        container.querySelector('#back-reserver').addEventListener('click', function() { renderReserver(container, inscription, showView); });
        return;
      }
      passImpactHtml = '<div class="usager-recap-row"><span class="usager-recap-key">Pass</span>'
        + '<span class="usager-recap-val pass-impact">' + balance.remaining + ' → ' + (balance.remaining - 1) + '</span></div>';
    } catch (e) { /* silencieux */ }
  }

  container.innerHTML = '<button class="usager-back" id="back-reserver">← Retour</button>'
    + '<div class="usager-card">'
    +   '<div class="usager-recap-icon">📋</div>'
    +   '<div class="usager-recap-title">Votre réservation</div>'
    +   '<div class="usager-recap-row"><span class="usager-recap-key">Date</span><span class="usager-recap-val">' + dateLabel + '</span></div>'
    +   '<div class="usager-recap-row"><span class="usager-recap-key">Créneau</span><span class="usager-recap-val">' + _escR(params.label) + ' (' + (params.heureDebut || '').slice(0, 5) + '–' + (params.heureFin || '').slice(0, 5) + ')</span></div>'
    +   passImpactHtml
    + '</div>'
    + '<div id="confirm-error" class="usager-error" style="display:none"></div>'
    + '<button class="usager-btn usager-btn-confirm" id="btn-confirm">✓ Confirmer cette réservation</button>'
    + '<button class="usager-btn usager-btn-ghost" id="btn-cancel-confirm" style="margin-top:8px">Annuler</button>';

  container.querySelector('#back-reserver').addEventListener('click', function() {
    renderReserver(container, inscription, showView);
  });
  container.querySelector('#btn-cancel-confirm').addEventListener('click', function() {
    renderReserver(container, inscription, showView);
  });
  container.querySelector('#btn-confirm').addEventListener('click', async function() {
    var btn = container.querySelector('#btn-confirm');
    var errEl = container.querySelector('#confirm-error');
    btn.disabled = true;
    btn.textContent = 'Réservation en cours…';
    errEl.style.display = 'none';
    try {
      await createUserReservation(inscription, params.dateISO, params.creneauId);
      container.innerHTML = '<div class="usager-success" style="margin-top:20px">'
        + '<div style="font-size:2rem;margin-bottom:10px">✅</div>'
        + '<div style="font-weight:700;font-size:1.1rem;margin-bottom:8px">Réservation confirmée !</div>'
        + '<div style="font-size:.9375rem;color:#555">' + dateLabel + ' — ' + _escR(params.label) + '</div>'
        + '<button class="usager-btn usager-btn-primary" style="margin-top:20px" id="btn-retour-accueil">Retour à l\'accueil</button>'
        + '</div>';
      container.querySelector('#btn-retour-accueil').addEventListener('click', function() { showView('accueil'); });
    } catch (e) {
      btn.disabled = false;
      btn.textContent = '✓ Confirmer cette réservation';
      errEl.textContent = 'Erreur : ' + (e.message || 'Réservation impossible.');
      errEl.style.display = 'block';
    }
  });
}
```

- [ ] **Étape 2 : Commit**

```bash
git add js/usager-reserver.js
git commit -m "feat: usager-reserver.js — barre semaine, créneaux, confirmation réservation"
```

---

### Task 5 : `js/usager-reservations.js`

**Files:**
- Create: `js/usager-reservations.js`

- [ ] **Étape 1 : Écrire usager-reservations.js**

```js
// js/usager-reservations.js
'use strict';

function _escRes(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

var STATUT_LABELS = { attente: 'En attente', present: 'Présent·e', parti: 'Parti·e', absent: 'Absent·e', annule: 'Annulé' };
var STATUT_CLS    = { attente: 'resa-s-attente', present: 'resa-s-present', parti: 'resa-s-parti', absent: 'resa-s-absent', annule: 'resa-s-annule' };
var CRENEAU_LABELS = { 1: 'Matin', 2: 'Matin 2', 3: 'Après-midi', 4: 'Après-midi 2', 5: 'Soir' };

async function renderReservations(container, inscription, showView) {
  container.innerHTML = '<div class="usager-loading">Chargement…</div>';

  try {
    var resas  = await getUserReservations(inscription.id);
    var today  = new Date().toISOString().slice(0, 10);
    var upcoming = resas.filter(function(r) { return r.date >= today && r.statut !== 'annule'; }).sort(function(a,b){ return a.date<b.date?-1:1; });
    var past     = resas.filter(function(r) { return r.date < today || r.statut === 'annule'; }).sort(function(a,b){ return a.date>b.date?-1:1; });

    container.innerHTML = '<button class="usager-back" id="back-accueil-resa">← Accueil</button>'
      + '<div class="usager-resa-section-title">À venir (' + upcoming.length + ')</div>'
      + (upcoming.length ? upcoming.map(function(r) { return _resaCard(r, true); }).join('') : '<div class="usager-empty">Aucune réservation à venir.</div>')
      + '<div class="usager-resa-section-title" style="margin-top:24px">Passées</div>'
      + (past.length ? past.slice(0, 20).map(function(r) { return _resaCard(r, false); }).join('') : '<div class="usager-empty">Aucune réservation passée.</div>');

    container.querySelector('#back-accueil-resa').addEventListener('click', function() { showView('accueil'); });

    container.querySelectorAll('.usager-cancel-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var id = btn.dataset.resaId;
        if (!confirm('Annuler cette réservation ?')) return;
        btn.disabled = true;
        btn.textContent = 'Annulation…';
        try {
          await cancelUserReservation(id);
          renderReservations(container, inscription, showView);
        } catch (e) {
          btn.disabled = false;
          btn.textContent = 'Annuler';
          alert('Erreur : ' + e.message);
        }
      });
    });

  } catch (e) {
    container.innerHTML = '<div class="usager-error">Erreur : ' + _escRes(e.message) + '</div>';
  }
}

function _resaCard(r, isUpcoming) {
  var d = new Date(r.date + 'T00:00:00');
  var dateStr  = d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  var slotLbl  = CRENEAU_LABELS[r.creneauId] || ('Créneau ' + r.creneauId);
  var statutLbl = STATUT_LABELS[r.statut] || r.statut;
  var statutCls = STATUT_CLS[r.statut] || '';
  var canCancel = isUpcoming && r.statut === 'attente' && canCancelReservation(r.date);

  return '<div class="usager-resa-card">'
    + '<div class="usager-resa-info">'
    +   '<div class="usager-resa-date">' + dateStr + '</div>'
    +   '<div class="usager-resa-slot">' + _escRes(slotLbl) + (r.accompagnants > 0 ? ' · ' + r.accompagnants + ' acc.' : '') + '</div>'
    +   (r.spotId ? '<div class="usager-resa-spot">Emplacement ' + _escRes(r.spotId) + '</div>' : '')
    + '</div>'
    + '<span class="usager-resa-statut ' + statutCls + '">' + statutLbl + '</span>'
    + (canCancel ? '<button class="usager-cancel-btn" data-resa-id="' + r.id + '">Annuler</button>' : '')
    + '</div>';
}
```

- [ ] **Étape 2 : Commit**

```bash
git add js/usager-reservations.js
git commit -m "feat: usager-reservations.js — liste à venir et passées avec annulation"
```

---

### Task 6 : `js/usager-pass.js`

**Files:**
- Create: `js/usager-pass.js`

- [ ] **Étape 1 : Écrire usager-pass.js**

```js
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

    var today   = new Date();
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
```

- [ ] **Étape 2 : Commit**

```bash
git add js/usager-pass.js
git commit -m "feat: usager-pass.js — solde pass + historique du mois"
```

---

### Task 7 : `js/usager-compte.js`

**Files:**
- Create: `js/usager-compte.js`

- [ ] **Étape 1 : Écrire usager-compte.js**

```js
// js/usager-compte.js
'use strict';

function _escC(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function renderCompte(container, inscription, showView) {
  var accompLabels = { aucun: 'Aucun', transfert: 'Aide au transfert', entree_sortie: 'Entrée/sortie de l\'eau', baignade: 'Aide à la baignade' };
  var accomp = Array.isArray(inscription.accompagnement) ? inscription.accompagnement.map(function(a) { return accompLabels[a] || a; }).join(', ') : '—';

  container.innerHTML = '<button class="usager-back" id="back-compte">← Accueil</button>'
    + '<div class="usager-card">'
    +   '<div class="usager-card-title">Mes informations</div>'
    +   _infoRow('Nom',       inscription.nom)
    +   _infoRow('Prénom',    inscription.prenom)
    +   _infoRow('Email',     inscription.mail)
    +   _infoRow('Téléphone', inscription.telephone)
    +   _infoRow('Adresse',   inscription.adresse ? inscription.adresse + ', ' + inscription.codePostal + ' ' + inscription.ville : '—')
    +   _infoRow('Accompagnement', accomp)
    + '</div>'
    + '<div class="usager-card">'
    +   '<div class="usager-card-title">Sécurité</div>'
    +   '<button class="usager-btn usager-btn-ghost" id="btn-change-pwd">Changer mon mot de passe</button>'
    +   '<div id="pwd-form" style="display:none;margin-top:16px">'
    +     '<div style="margin-bottom:10px"><input type="password" id="new-pwd" placeholder="Nouveau mot de passe (8 car. min.)" style="width:100%;padding:12px;border:1.5px solid #ccc;border-radius:8px;font-size:1rem"></div>'
    +     '<div style="margin-bottom:10px"><input type="password" id="new-pwd2" placeholder="Confirmer le mot de passe" style="width:100%;padding:12px;border:1.5px solid #ccc;border-radius:8px;font-size:1rem"></div>'
    +     '<div id="pwd-msg" style="font-size:.875rem;margin-bottom:8px"></div>'
    +     '<button class="usager-btn usager-btn-primary" id="btn-save-pwd">Enregistrer</button>'
    +   '</div>'
    + '</div>';

  container.querySelector('#back-compte').addEventListener('click', function() { showView('accueil'); });

  var btnChangePwd = container.querySelector('#btn-change-pwd');
  var pwdForm      = container.querySelector('#pwd-form');
  btnChangePwd.addEventListener('click', function() {
    pwdForm.style.display = pwdForm.style.display === 'none' ? 'block' : 'none';
  });

  container.querySelector('#btn-save-pwd').addEventListener('click', async function() {
    var pwd  = container.querySelector('#new-pwd').value;
    var pwd2 = container.querySelector('#new-pwd2').value;
    var msgEl = container.querySelector('#pwd-msg');
    msgEl.style.color = '#c62828';
    if (pwd.length < 8) { msgEl.textContent = 'Minimum 8 caractères.'; return; }
    if (pwd !== pwd2)   { msgEl.textContent = 'Les mots de passe ne correspondent pas.'; return; }
    var btn = container.querySelector('#btn-save-pwd');
    btn.disabled = true;
    btn.textContent = 'Enregistrement…';
    try {
      var result = await supabaseClient.auth.updateUser({ password: pwd });
      if (result.error) throw result.error;
      msgEl.style.color = '#2e7d32';
      msgEl.textContent = 'Mot de passe mis à jour.';
      container.querySelector('#new-pwd').value  = '';
      container.querySelector('#new-pwd2').value = '';
      btn.disabled = false;
      btn.textContent = 'Enregistrer';
    } catch (e) {
      msgEl.textContent = 'Erreur : ' + e.message;
      btn.disabled = false;
      btn.textContent = 'Enregistrer';
    }
  });
}

function _infoRow(label, value) {
  return '<div class="usager-info-row"><span class="usager-info-key">' + label + '</span><span class="usager-info-val">' + _escC(value || '—') + '</span></div>';
}
```

- [ ] **Étape 2 : Commit**

```bash
git add js/usager-compte.js
git commit -m "feat: usager-compte.js — infos lecture seule + changement mot de passe"
```

---

### Task 8 : `js/usager-app.js`

**Files:**
- Create: `js/usager-app.js`

- [ ] **Étape 1 : Écrire usager-app.js**

```js
// js/usager-app.js
'use strict';

const UsagerApp = (() => {
  var _inscription = null;

  async function init() {
    var container = document.getElementById('usager-content');
    container.innerHTML = '<div class="usager-loading">Chargement de votre espace…</div>';

    try {
      _inscription = await getUserInscription();
    } catch (e) {
      container.innerHTML = '<div class="usager-error" style="margin:20px">Impossible de charger votre profil : ' + (e.message || e) + '<br>Veuillez vous reconnecter.</div>';
      return;
    }

    if (_inscription.statut !== 'valide') {
      container.innerHTML = '<div class="usager-card" style="text-align:center;padding:32px">'
        + '<div style="font-size:2rem;margin-bottom:12px">⏳</div>'
        + '<div style="font-weight:700;margin-bottom:8px">Votre demande est en cours de traitement</div>'
        + '<div style="color:#666;font-size:.9375rem">Vous recevrez un email dès que votre inscription sera validée par notre équipe.</div>'
        + '</div>';
      return;
    }

    showView('accueil');
  }

  function showView(view, params) {
    var container = document.getElementById('usager-content');
    if (!container || !_inscription) return;

    if (view === 'accueil')       renderAccueil(container, _inscription, showView);
    else if (view === 'reserver') renderReserver(container, _inscription, showView);
    else if (view === 'reservations') renderReservations(container, _inscription, showView);
    else if (view === 'pass')     renderPass(container, _inscription, showView);
    else if (view === 'compte')   renderCompte(container, _inscription, showView);
  }

  return { init, showView };
})();
```

- [ ] **Étape 2 : Commit**

```bash
git add js/usager-app.js
git commit -m "feat: usager-app.js — contrôleur de routing IIFE"
```

---

### Task 9 : `usager.html`

**Files:**
- Create: `usager.html`

- [ ] **Étape 1 : Écrire usager.html**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>Handiplage — Mon espace</title>
  <link rel="stylesheet" href="css/usager.css">
</head>
<body>

<header id="usager-header">
  <div class="usager-logo">🏖 Handiplage</div>
  <button id="btn-logout-usager">Déconnexion</button>
</header>

<main id="usager-content">
  <!-- Injecté par usager-app.js -->
</main>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/env.js"></script>
<script src="js/supabase-client.js"></script>
<script src="js/auth.js"></script>
<script src="js/usager-storage.js"></script>
<script src="js/usager-accueil.js"></script>
<script src="js/usager-reserver.js"></script>
<script src="js/usager-reservations.js"></script>
<script src="js/usager-pass.js"></script>
<script src="js/usager-compte.js"></script>
<script src="js/usager-app.js"></script>
<script>
  (async function () {
    try {
      var session = await getSession();
      if (!session || getUserRole(session) !== 'user') {
        window.location.href = '/login.html';
        return;
      }
      document.getElementById('btn-logout-usager').addEventListener('click', signOut);
      UsagerApp.init();
    } catch (err) {
      console.error('Auth check failed:', err);
      window.location.href = '/login.html';
    }
  })();
</script>
</body>
</html>
```

- [ ] **Étape 2 : Test manuel complet**

1. Depuis `login.html`, se connecter avec un compte `role = 'user'` → doit rediriger vers `usager.html`
2. Vérifier l'écran d'accueil : double carte (prochaine résa + pass) + 4 tuiles
3. Tuile "Réserver" → barre de jours → taper un créneau → écran confirmation → Confirmer → message succès
4. Tuile "Mes résa." → liste à venir + passées → bouton Annuler sur une résa à venir → confirmation
5. Tuile "Mon pass" → solde + historique du mois
6. Tuile "Mon compte" → infos + changer mot de passe
7. Déconnexion → redirige vers `login.html`

- [ ] **Étape 3 : Commit final**

```bash
git add usager.html
git commit -m "feat: usager.html — page principale app usager avec auth check"
```

---

## Vérification finale

```bash
node tests/run-all.js
```

Expected: `✅ Tous les tests passent.`

Flux complet à tester :
1. Login en tant qu'usager → `usager.html`
2. Accueil → Réserver → choisir date + créneau → confirmer → vérifier dans Supabase Studio
3. Accueil → Mes résa. → annuler une réservation → statut passe à `annule` dans Supabase
4. Accueil → Mon pass → solde correct (40 - nombre de résa non annulées ce mois)
5. Accueil → Mon compte → changer mot de passe → se reconnecter avec le nouveau
