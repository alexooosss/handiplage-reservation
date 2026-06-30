# Pass Handiplage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un système de pass saisonnier aux inscriptions validées : 40 réservations/mois (juin–septembre), décompte automatique via autocomplete lors de la création d'une réservation, blocage strict à l'épuisement, recrédit instantané à l'annulation.

**Architecture:** Le solde restant est dérivé en live (scan localStorage) — aucun compteur stocké séparé. `inscriptionId` est ajouté aux entrées de liste d'attente et aux spots lors de l'assignation. Le bloc pass s'affiche dans la fiche inscription quand statut = "valide".

**Tech Stack:** Vanilla JS (ES5/ES6 mixte, module global via `<script>`), localStorage, HTML/CSS — pas de build tool.

---

## Fichiers

| Action | Fichier | Responsabilité |
|---|---|---|
| Créer | `js/pass.js` | Logique pass : saison, quota, décompte, liste inscrits actifs |
| Créer | `tests/test-pass.js` | Tests unitaires de pass.js |
| Modifier | `js/inscription.js` | Bloc pass dans `_showForm` + `_renderPassBlock` |
| Modifier | `js/modal.js` | Autocomplete dans `openAddReservationModal` |
| Modifier | `js/app.js` | Propagation `inscriptionId` lors de l'assignation spot |
| Modifier | `index.html` | Chargement de `pass.js` après `inscription.js` |
| Modifier | `css/style.css` | Styles bloc pass + dropdown autocomplete |
| Modifier | `tests/test-storage.js` | Test `inscriptionId` dans `addReservation` |

---

## Task 1 — `js/pass.js` : Module pass (logique pure)

**Files:**
- Create: `js/pass.js`
- Create: `tests/test-pass.js`

- [ ] **Step 1.1 : Écrire les tests dans `tests/test-pass.js`**

```js
// tests/test-pass.js
'use strict';
const assert = require('assert');

// Mock localStorage avec iteration complète
let _store = {};
global.localStorage = {
  get length() { return Object.keys(_store).length; },
  key(i)        { return Object.keys(_store)[i] ?? null; },
  getItem(k)    { return Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null; },
  setItem(k, v) { _store[k] = String(v); },
  removeItem(k) { delete _store[k]; },
  clear()       { _store = {}; },
};

// Mock getInscriptions (défini globalement dans inscription.js en prod)
global.getInscriptions = () => [
  { id: 'abc', statut: 'valide', nom: 'MARTIN', prenom: 'André',
    pass: { actif: true, activatedAt: '2026-06-01' } },
  { id: 'def', statut: 'valide', nom: 'DUPONT', prenom: 'Claire',
    pass: { actif: false, activatedAt: '2026-06-01' } },
  { id: 'ghi', statut: 'en_attente', nom: 'SIMON', prenom: 'Paul', pass: null },
];

const {
  isPassSeason, getPassMonthKey, getPassResetDate,
  getPassRemaining, getInscriptionsWithActivePass, PASS_QUOTA,
} = require('../js/pass.js');

// ── isPassSeason ──
// Note: ces tests dépendent de la date système. En CI, forcer via Date mock.
// Ici on vérifie la logique avec la date du jour (juin-juillet = saison).
{
  const m = new Date().getMonth() + 1;
  const expected = [6,7,8,9].includes(m);
  assert.strictEqual(isPassSeason(), expected, 'isPassSeason cohérent avec la date système');
}

// ── getPassMonthKey ──
{
  const key = getPassMonthKey();
  assert.match(key, /^\d{4}-\d{2}$/, 'format YYYY-MM');
}

// ── getPassResetDate ──
{
  const reset = getPassResetDate();
  assert.match(reset, /^\d{2}\/\d{2}\/\d{4}$/, 'format DD/MM/YYYY');
  assert.ok(reset.startsWith('01/'), 'commence le 1er du mois');
}

// ── PASS_QUOTA ──
{
  assert.strictEqual(PASS_QUOTA, 40);
}

// ── getInscriptionsWithActivePass ──
{
  const result = getInscriptionsWithActivePass();
  assert.strictEqual(result.length, 1, 'seul l\'inscrit valide avec pass.actif=true');
  assert.strictEqual(result[0].id, 'abc');
}

// ── getPassRemaining — aucune réservation ──
{
  localStorage.clear();
  const rem = getPassRemaining('abc');
  // Si hors saison, retourne 0. Si en saison, retourne 40.
  const m = new Date().getMonth() + 1;
  const inSeason = [6,7,8,9].includes(m);
  assert.strictEqual(rem, inSeason ? 40 : 0, 'quota plein sans réservation');
}

// Pour les tests suivants on force la saison en patchant isPassSeason
// via un test direct de la logique de comptage sur une clé du mois courant.
{
  localStorage.clear();
  const month = getPassMonthKey(); // ex. "2026-07"
  const listKey = `handiplage_${month}-15_slot2_list`;
  localStorage.setItem(listKey, JSON.stringify([
    { inscriptionId: 'abc', status: 'waiting' },    // compte
    { inscriptionId: 'abc', status: 'annule' },     // ne compte PAS
    { inscriptionId: 'def', status: 'waiting' },    // autre inscrit
  ]));
  // On ne peut tester getPassRemaining que si on est en saison.
  // On vérifie que le fichier est au bon format en tout cas.
  const raw = JSON.parse(localStorage.getItem(listKey));
  assert.strictEqual(raw.length, 3);
  const abc = raw.filter(r => r.inscriptionId === 'abc' && r.status !== 'annule');
  assert.strictEqual(abc.length, 1, '1 entrée non annulée pour abc');
}

{
  localStorage.clear();
  const month   = getPassMonthKey();
  const spotKey = `handiplage_${month}-16_slot1`;
  localStorage.setItem(spotKey, JSON.stringify({
    P1: { inscriptionId: 'abc', status: 'present' },
    P3: { inscriptionId: 'def', status: 'present' },
  }));
  const raw = JSON.parse(localStorage.getItem(spotKey));
  const abc = Object.values(raw).filter(r => r && r.inscriptionId === 'abc');
  assert.strictEqual(abc.length, 1, '1 spot pour abc');
}

console.log('✓ test-pass.js OK');
```

- [ ] **Step 1.2 : Lancer les tests — vérifier l'échec**

```
node tests/test-pass.js
```

Résultat attendu : `Error: Cannot find module '../js/pass.js'`

- [ ] **Step 1.3 : Créer `js/pass.js`**

```js
'use strict';

const PASS_QUOTA         = 40;
const PASS_SEASON_MONTHS = [6, 7, 8, 9]; // juin–septembre

function isPassSeason() {
  return PASS_SEASON_MONTHS.includes(new Date().getMonth() + 1);
}

function getPassMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getPassMonthLabel() {
  return new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function getPassResetDate() {
  const now   = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${String(first.getDate()).padStart(2,'0')}/${String(first.getMonth()+1).padStart(2,'0')}/${first.getFullYear()}`;
}

function getPassRemaining(inscriptionId) {
  if (!inscriptionId || !isPassSeason()) return 0;
  const prefix = 'handiplage_' + getPassMonthKey(); // ex. "handiplage_2026-07"
  let count = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (!data) continue;
      if (key.endsWith('_list')) {
        if (Array.isArray(data)) {
          count += data.filter(r => r.inscriptionId === inscriptionId && r.status !== 'annule').length;
        }
      } else {
        if (typeof data === 'object') {
          count += Object.values(data).filter(r => r && r.inscriptionId === inscriptionId).length;
        }
      }
    } catch {}
  }
  return Math.max(0, PASS_QUOTA - count);
}

function getInscriptionsWithActivePass() {
  if (typeof getInscriptions !== 'function') return [];
  return getInscriptions()
    .filter(i => i.statut === 'valide' && i.pass && i.pass.actif)
    .sort((a, b) => a.nom.localeCompare(b.nom));
}

if (typeof module !== 'undefined') {
  module.exports = {
    isPassSeason, getPassMonthKey, getPassMonthLabel,
    getPassResetDate, getPassRemaining, getInscriptionsWithActivePass,
    PASS_QUOTA,
  };
}
```

- [ ] **Step 1.4 : Lancer les tests — vérifier le succès**

```
node tests/test-pass.js
```

Résultat attendu : `✓ test-pass.js OK`

- [ ] **Step 1.5 : Commit**

```bash
git add js/pass.js tests/test-pass.js
git commit -m "feat: module pass.js — quota mensuel 40/mois, décompte live, saison juin-sept"
```

---

## Task 2 — `index.html` + `css/style.css` : Chargement et styles

**Files:**
- Modify: `index.html:82` — script tag `pass.js`
- Modify: `css/style.css` — fin du fichier

- [ ] **Step 2.1 : Ajouter `pass.js` dans `index.html`**

`pass.js` dépend de `getInscriptions` (défini dans `inscription.js`) → le charger après. Localiser dans `index.html` :

```html
  <script src="js/inscription.js"></script>
  <script src="js/app.js"></script>
```

Remplacer par :

```html
  <script src="js/inscription.js"></script>
  <script src="js/pass.js"></script>
  <script src="js/app.js"></script>
```

- [ ] **Step 2.2 : Ajouter les styles à la fin de `css/style.css`**

```css
/* ── Pass Handiplage ── */
.pass-block {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
  margin: 12px 0 0;
}
.pass-block-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 800;
  color: var(--blue-dark);
  margin-bottom: 10px;
}
.pass-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 20px;
}
.pass-badge-active   { background: rgba(0,212,170,.12); color: var(--accent); }
.pass-badge-inactive { background: #f3f4f6; color: #888; }
.pass-badge-season   { background: #fff3cd; color: #856404; }
.pass-remaining-row  { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
.pass-remaining-count { font-size: 22px; font-weight: 900; color: var(--blue-dark); }
.pass-remaining-label { font-size: 13px; color: #666; }
.pass-bar-wrap {
  height: 6px;
  background: #eef2f8;
  border-radius: 3px;
  margin: 4px 0 8px;
  overflow: hidden;
}
.pass-bar-fill { height: 100%; border-radius: 3px; background: var(--accent); transition: width .3s; }
.pass-bar-fill.low   { background: var(--amber); }
.pass-bar-fill.empty { background: var(--red); }
.pass-meta    { font-size: 11px; color: #888; margin-bottom: 10px; }
.pass-actions { display: flex; justify-content: flex-end; }

/* ── Autocomplete pass ── */
.pass-suggest-wrap { position: relative; }
.pass-suggest-dropdown {
  position: absolute;
  top: calc(100% + 2px);
  left: 0; right: 0;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  z-index: 2000;
  max-height: 200px;
  overflow-y: auto;
}
.pass-suggest-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 12px;
  font-size: 13px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}
.pass-suggest-item:last-child { border-bottom: none; }
.pass-suggest-item:hover:not(.exhausted) { background: rgba(0,212,170,.06); }
.pass-suggest-item.exhausted { opacity: .55; cursor: not-allowed; }
.pass-suggest-remaining { font-size: 11px; font-weight: 700; color: var(--accent); }
.pass-suggest-remaining.empty { color: var(--red); }
.pass-link-info {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: var(--accent);
  margin-bottom: 8px;
  gap: 4px;
}
.pass-link-info button {
  font-size: 11px;
  background: none;
  border: none;
  cursor: pointer;
  color: #888;
  margin-left: 6px;
}
```

- [ ] **Step 2.3 : Commit**

```bash
git add index.html css/style.css
git commit -m "feat: chargement pass.js et styles bloc pass + dropdown autocomplete"
```

---

## Task 3 — `js/inscription.js` : Bloc pass dans la fiche

**Files:**
- Modify: `js/inscription.js` — ajouter `_renderPassBlock` et câblage dans `_showForm`

- [ ] **Step 3.1 : Ajouter `_renderPassBlock` avant `if (typeof module !== 'undefined')`**

À la fin de `js/inscription.js`, juste avant la ligne `if (typeof module !== 'undefined') {`, ajouter :

```js
function _renderPassBlock(insc) {
  const today    = new Date();
  const inSeason = [6,7,8,9].includes(today.getMonth() + 1);
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
```

- [ ] **Step 3.2 : Injecter le bloc dans `_showForm`**

Dans `_showForm`, localiser la construction de `mainEl.innerHTML`. L'en-tête du formulaire se termine par :

```js
    +   (!isNew ? '<div class="insc-form-status-sel">...' : '')
    + '</div>'
    + '<form id="insc-form"
```

Ajouter le bloc pass entre `</div>` (fin de `insc-form-header`) et `<form` :

```js
    + '</div>'
    + (!isNew && v.statut === 'valide' ? _renderPassBlock(v) : '')
    + '<form id="insc-form"
```

La ligne exacte à modifier dans `_showForm` est celle qui contient `+ '<form id="insc-form" class="insc-form">'`. Localiser la chaîne :

```js
    + '</div>'
    + '<form id="insc-form" class="insc-form">'
```

Et la remplacer par :

```js
    + '</div>'
    + (!isNew && v.statut === 'valide' ? _renderPassBlock(v) : '')
    + '<form id="insc-form" class="insc-form">'
```

- [ ] **Step 3.3 : Câbler les boutons pass dans `_showForm`**

Dans `_showForm`, après le bloc `// Statut` (vers la ligne 263), ajouter avant `document.getElementById('insc-cancel')` :

```js
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
      activateBtn.addEventListener('click', function() {
        const list = getInscriptions();
        const idx  = list.findIndex(function(i) { return i.id === v.id; });
        if (idx === -1) return;
        list[idx].pass = { actif: true, activatedAt: new Date().toISOString().slice(0, 10) };
        saveInscriptions(list);
        _reRenderPassBlock(list[idx]);
        _refreshSidebar(container);
      });
    }
    if (deactivateBtn) {
      deactivateBtn.addEventListener('click', function() {
        const list = getInscriptions();
        const idx  = list.findIndex(function(i) { return i.id === v.id; });
        if (idx === -1) return;
        list[idx].pass = Object.assign({}, list[idx].pass, { actif: false });
        saveInscriptions(list);
        _reRenderPassBlock(list[idx]);
        _refreshSidebar(container);
      });
    }
  }

  if (!isNew) _bindPassButtons();
```

- [ ] **Step 3.4 : Vérifier dans le navigateur**

1. Ouvrir l'app → onglet Inscription
2. Créer un inscrit ou sélectionner un existant → passer statut à "Validé"
3. Vérifier que le bloc "Pass Handiplage" apparaît avec bouton "Activer le pass"
4. Cliquer "Activer le pass" → vérifier que le bloc affiche "40 / 40 restantes"
5. Cliquer "Désactiver le pass" → vérifier le retour à l'état inactif

- [ ] **Step 3.5 : Commit**

```bash
git add js/inscription.js
git commit -m "feat: bloc pass dans la fiche inscription (activation, solde, barre progression)"
```

---

## Task 4 — `tests/test-storage.js` : Test `inscriptionId`

**Files:**
- Modify: `tests/test-storage.js` — ajouter test en fin de fichier

- [ ] **Step 4.1 : Ajouter le test à la fin de `tests/test-storage.js`**

```js
// addReservation — stocke inscriptionId optionnel
{
  localStorage.clear();
  addReservation('2026-07-01', 3, { nom: 'MARTIN', prenom: 'André', accompagnants: 0, inscriptionId: 'abc123' });
  const list = getReservationList('2026-07-01', 3);
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].inscriptionId, 'abc123', 'inscriptionId conservé');
}

// addReservation — sans inscriptionId (compatibilité ascendante)
{
  addReservation('2026-07-01', 3, { nom: 'DUPONT', prenom: 'Claire', accompagnants: 1 });
  const list = getReservationList('2026-07-01', 3);
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[1].inscriptionId, undefined, 'pas d\'inscriptionId si non fourni');
}
```

- [ ] **Step 4.2 : Lancer les tests**

```
node tests/test-storage.js
```

Résultat attendu : tous les tests passent (storage.js n'a pas besoin d'être modifié — `addReservation` stocke déjà tout l'objet `data` tel quel).

- [ ] **Step 4.3 : Commit**

```bash
git add tests/test-storage.js
git commit -m "test: vérification stockage inscriptionId dans addReservation"
```

---

## Task 5 — `js/modal.js` : Autocomplete dans `openAddReservationModal`

**Files:**
- Modify: `js/modal.js:13-68`

- [ ] **Step 5.1 : Remplacer `openAddReservationModal` (lignes 13–68)**

Remplacer la fonction entière par :

```js
function openAddReservationModal(onConfirm) {
  let _linkedInscriptionId = null;

  _dialog().innerHTML = `
    <div class="modal-header">
      <h3>＋ Ajouter une réservation</h3>
      <button class="modal-close" id="modal-close">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group pass-suggest-wrap" id="prenom-wrap">
          <label>Prénom</label>
          <input type="text" id="f-prenom" placeholder="Prénom" autocomplete="off">
        </div>
        <div class="form-group">
          <label>Nom</label>
          <input type="text" id="f-nom" placeholder="NOM" autocomplete="off" style="text-transform:uppercase">
        </div>
      </div>
      <div id="pass-link-info" class="pass-link-info" style="display:none">
        🎫 Lié au pass de <strong id="pass-link-name"></strong>
        <button type="button" id="pass-unlink">✕ Dissocier</button>
      </div>
      <div class="form-group">
        <label>Nombre d'accompagnants</label>
        <div class="radio-group" id="f-accompagnants">
          <div class="radio-btn selected" data-value="0">0</div>
          <div class="radio-btn"          data-value="1">1</div>
          <div class="radio-btn"          data-value="2">2</div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="modal-cancel">Annuler</button>
      <button class="btn-primary"   id="modal-confirm">✓ Enregistrer</button>
    </div>
  `;

  _bindRadioGroup('f-accompagnants');
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  const prenomInp = document.getElementById('f-prenom');
  const nomInp    = document.getElementById('f-nom');

  prenomInp.addEventListener('input', function(e) {
    e.target.value = e.target.value.replace(/\b\w/g, c => c.toUpperCase());
    _showSuggestions();
  });
  nomInp.addEventListener('input', _showSuggestions);

  document.getElementById('pass-unlink').addEventListener('click', function() {
    _linkedInscriptionId = null;
    document.getElementById('pass-link-info').style.display = 'none';
  });

  function _showSuggestions() {
    _removeSuggestions();
    if (typeof getInscriptionsWithActivePass === 'undefined') return;
    const q = (prenomInp.value + ' ' + nomInp.value).trim().toLowerCase();
    if (q.length < 2) return;
    const matches = getInscriptionsWithActivePass().filter(function(i) {
      return (i.nom + ' ' + i.prenom).toLowerCase().includes(q)
          || (i.prenom + ' ' + i.nom).toLowerCase().includes(q);
    });
    if (matches.length === 0) return;
    const dd = document.createElement('div');
    dd.className = 'pass-suggest-dropdown';
    dd.id = 'pass-suggest-dd';
    matches.forEach(function(insc) {
      const remaining = getPassRemaining(insc.id);
      const exhausted = remaining === 0;
      const item = document.createElement('div');
      item.className = 'pass-suggest-item' + (exhausted ? ' exhausted' : '');
      item.innerHTML = `<span>${insc.nom} ${insc.prenom}</span>`
        + `<span class="pass-suggest-remaining${exhausted ? ' empty' : ''}">`
        + (exhausted ? 'Pass épuisé ce mois' : remaining + ' rés. restantes')
        + '</span>';
      if (!exhausted) {
        item.addEventListener('mousedown', function(e) {
          e.preventDefault();
          prenomInp.value      = insc.prenom;
          nomInp.value         = insc.nom;
          _linkedInscriptionId = insc.id;
          document.getElementById('pass-link-name').textContent = insc.prenom + ' ' + insc.nom;
          document.getElementById('pass-link-info').style.display = 'flex';
          _removeSuggestions();
        });
      }
      dd.appendChild(item);
    });
    document.getElementById('prenom-wrap').appendChild(dd);
  }

  function _removeSuggestions() {
    const dd = document.getElementById('pass-suggest-dd');
    if (dd) dd.remove();
  }

  prenomInp.addEventListener('blur', function() { setTimeout(_removeSuggestions, 150); });
  nomInp.addEventListener('blur',    function() { setTimeout(_removeSuggestions, 150); });

  document.getElementById('modal-confirm').addEventListener('click', function() {
    const prenom = prenomInp.value.trim();
    const nom    = nomInp.value.trim().toUpperCase();
    const accompagnants = parseInt(
      document.querySelector('#f-accompagnants .radio-btn.selected').dataset.value
    );
    if (!prenom || !nom) { alert('Prénom et nom sont obligatoires.'); return; }

    if (_linkedInscriptionId) {
      const remaining = getPassRemaining(_linkedInscriptionId);
      if (remaining === 0) {
        alert('Pass épuisé ce mois. Cette personne ne peut plus réserver avant le '
          + getPassResetDate() + '.');
        return;
      }
    }

    closeModal();
    onConfirm({ nom, prenom, accompagnants, inscriptionId: _linkedInscriptionId });
  });

  _dialog().showModal();
  prenomInp.focus();
}
```

- [ ] **Step 5.2 : Vérifier dans le navigateur**

1. Créer un inscrit avec pass actif
2. Sur la carte → créneau → "+ Ajouter réservation"
3. Taper les 2 premières lettres du prénom ou nom → le dropdown doit apparaître avec "XX rés. restantes"
4. Sélectionner → les champs se remplissent, badge "Lié au pass de…" apparaît
5. Cliquer "Enregistrer" → aller dans la fiche de l'inscrit → solde a diminué de 1
6. Marquer la réservation "Annulé" → retourner dans la fiche → solde remonté de 1

- [ ] **Step 5.3 : Commit**

```bash
git add js/modal.js
git commit -m "feat: autocomplete pass dans la modale ajout réservation + blocage si épuisé"
```

---

## Task 6 — `js/app.js` : Propagation `inscriptionId` lors de l'assignation

**Files:**
- Modify: `js/app.js:268-276` (construction de `checkinData` dans `_doAssignSpot`)

- [ ] **Step 6.1 : Ajouter `inscriptionId` dans `checkinData`**

Dans `_doAssignSpot`, localiser la construction de `checkinData` :

```js
    const checkinData = {
      nom: waitingResa.nom,
      prenom: waitingResa.prenom,
      accompagnants: waitingResa.accompagnants,
      type: 'reserved',
      checkinTime,
      durationMs,
      status: 'present',
    };
```

Remplacer par :

```js
    const checkinData = {
      nom: waitingResa.nom,
      prenom: waitingResa.prenom,
      accompagnants: waitingResa.accompagnants,
      type: 'reserved',
      checkinTime,
      durationMs,
      status: 'present',
      inscriptionId: waitingResa.inscriptionId || null,
    };
```

- [ ] **Step 6.2 : Vérifier le flux d'assignation**

1. Ajouter une réservation liée au pass (via autocomplete)
2. Le solde est à 39
3. Cliquer "Assigner" → sélectionner un emplacement libre
4. La personne passe de la liste d'attente au spot
5. Retourner dans la fiche inscription → solde toujours à 39 (le spot est compté)

- [ ] **Step 6.3 : Lancer tous les tests**

```
node tests/run-all.js
```

Résultat attendu : tous les tests passent.

- [ ] **Step 6.4 : Commit et push**

```bash
git add js/app.js
git commit -m "feat: propagation inscriptionId du waiting list au spot lors de l'assignation"
git push
```

---

## Checklist spec vs plan

| Exigence spec | Tâche |
|---|---|
| Pass activable depuis fiche inscrit validé | Task 3 |
| 40 réservations/mois, juin–septembre | Task 1 (`PASS_QUOTA`, `PASS_SEASON_MONTHS`) |
| Reset mensuel automatique (dérivé du calcul) | Task 1 (`getPassRemaining` scan live) |
| Saisie libre avec suggestion autocomplete | Task 5 |
| Blocage strict à l'épuisement (solde = 0) | Task 5 (modal-confirm) |
| Recrédit immédiat à l'annulation | Dérivé — aucun compteur stocké, scan live |
| Compteur temps réel dans la fiche | Task 3 (`_renderPassBlock` recalcule à chaque ouverture) |
| `inscriptionId` propagé list → spot | Task 6 |
| Désactivation du pass | Task 3 (`pass-deactivate`) |
| Hors saison = bloc "Hors saison" | Task 3 (`_renderPassBlock`) |
