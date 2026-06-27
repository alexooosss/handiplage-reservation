# Handiplage Réservation — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Interface web staff (tablette, paysage) pour visualiser et gérer en temps réel les 55 emplacements de la Handiplage d'Antibes, avec créneaux fixes, check-in et décompte 1h45.

**Architecture:** Application vanilla HTML/CSS/JS sans dépendances externes. Modules JS séparés par responsabilité, chargés via `<script>` dans `index.html`. Persistance via `localStorage`. Les modules logiques (slots, timer, storage) sont compatibles Node.js pour les tests.

**Tech Stack:** HTML5, CSS3, JavaScript ES6 (vanilla), localStorage, Node.js (tests uniquement)

---

## Structure des fichiers

```
index.html              ← Shell principal (header + double panneau)
css/
  style.css             ← Tous les styles (palette Handiplage + modern)
js/
  data.js               ← Définition statique des 55 emplacements (positions x,y)
  slots.js              ← Logique des 5 créneaux (détection actif/passé/à venir)
  timer.js              ← Calcul décompte 1h45, formatage MM:SS, niveaux d'urgence
  storage.js            ← CRUD localStorage (réservations par date + créneau)
  map.js                ← Rendu DOM de la carte de plage (55 spots colorés)
  panel.js              ← Rendu panneau droit (stats + liste triée)
  modal.js              ← Modale check-in et modale détail emplacement
  app.js                ← Coordinateur : init, événements, boucle refresh 30s
tests/
  test-slots.js         ← Tests Node.js pour slots.js
  test-timer.js         ← Tests Node.js pour timer.js
  test-storage.js       ← Tests Node.js pour storage.js
  run-all.js            ← Lance tous les tests
```

---

## Task 1 : Initialisation du projet & shell HTML

**Files:**
- Create: `index.html`
- Create: `css/style.css`

- [ ] **Step 1 : Créer la structure de dossiers**

```bash
mkdir css js tests
```

- [ ] **Step 2 : Initialiser git**

```bash
git init
echo ".superpowers/" > .gitignore
git add .gitignore
git commit -m "chore: init repo"
```

- [ ] **Step 3 : Créer `index.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1024, initial-scale=1">
  <title>Handiplage — Staff</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>

  <!-- HEADER -->
  <header id="app-header">
    <div class="logo">
      <div class="logo-icon">🏖️</div>
      <div class="logo-text">
        <h1>Handiplage</h1>
        <span>Juan-les-Pins · Antibes</span>
      </div>
    </div>
    <nav class="slots-nav" id="slots-nav">
      <!-- Injecté par app.js -->
    </nav>
    <div class="datetime" id="datetime">
      <span class="time" id="clock">--:--</span>
      <span id="date-label"></span>
    </div>
  </header>

  <!-- MAIN -->
  <div class="main">

    <!-- Panneau gauche : carte de plage -->
    <div class="beach-panel" id="beach-panel">
      <div class="beach-road">
        <span class="parking-label">Parking</span>
      </div>
      <div class="beach-map-container">
        <div class="beach-map" id="beach-map">
          <!-- Injecté par map.js -->
        </div>
      </div>
      <div class="beach-sea">
        <span class="sea-label">Mer</span>
      </div>
      <div class="beach-building">
        <span class="building-label">Accueil</span>
      </div>
    </div>

    <!-- Panneau droit : gestion créneau -->
    <div class="side-panel" id="side-panel">
      <!-- Injecté par panel.js -->
    </div>

  </div>

  <!-- MODALE -->
  <dialog id="app-modal">
    <!-- Injecté par modal.js -->
  </dialog>

  <!-- Scripts -->
  <script src="js/data.js"></script>
  <script src="js/slots.js"></script>
  <script src="js/timer.js"></script>
  <script src="js/storage.js"></script>
  <script src="js/map.js"></script>
  <script src="js/panel.js"></script>
  <script src="js/modal.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 4 : Créer `css/style.css` — base & variables**

```css
/* ── Variables ── */
:root {
  --navy:       #0a1628;
  --blue:       #0055a4;
  --blue-dark:  #003d7a;
  --accent:     #00d4aa;
  --sand:       #f2e8d4;
  --tapis:      #1565c0;
  --sea1:       #48cae4;
  --sea2:       #0077b6;
  --red:        #e53935;
  --red-dark:   #c62828;
  --green:      #43a047;
  --green-dark: #2e7d32;
  --orange:     #f57c00;
  --amber:      #f59e0b;
  --purple:     #7b1fa2;
  --grey:       #78909c;
  --panel-bg:   #f8fafc;
  --border:     #e2e8f0;
  --text:       #1a2340;
  --text-muted: #64748b;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  background: var(--navy);
  color: var(--text);
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Header ── */
header {
  background: linear-gradient(135deg, var(--blue) 0%, var(--blue-dark) 100%);
  padding: 10px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.4);
  flex-shrink: 0;
  z-index: 10;
}

.logo { display: flex; align-items: center; gap: 10px; }

.logo-icon {
  width: 40px; height: 40px;
  background: linear-gradient(135deg, var(--sea1), var(--tapis));
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
  box-shadow: 0 2px 8px rgba(0,180,216,0.35);
  flex-shrink: 0;
}

.logo-text h1 { color: #fff; font-size: 17px; font-weight: 800; }
.logo-text span { color: rgba(255,255,255,0.55); font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }

/* Slot pills */
.slots-nav { display: flex; gap: 5px; flex-wrap: nowrap; }

.slot-pill {
  padding: 5px 11px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  border: 2px solid transparent;
  letter-spacing: 0.2px;
  transition: all 0.15s;
  white-space: nowrap;
  user-select: none;
}

.slot-pill[data-status="active"] {
  background: var(--accent);
  color: var(--navy);
  border-color: var(--accent);
  box-shadow: 0 2px 10px rgba(0,212,170,0.4);
}

.slot-pill[data-status="past"] {
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.35);
  border-color: rgba(255,255,255,0.08);
  cursor: default;
}

.slot-pill[data-status="upcoming"] {
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.65);
  border-color: rgba(255,255,255,0.18);
}

.slot-pill[data-status="upcoming"]:hover,
.slot-pill[data-status="active"]:hover {
  filter: brightness(1.1);
}

.slot-pill.selected-slot {
  outline: 2px solid white;
  outline-offset: 1px;
}

/* Datetime */
.datetime { text-align: right; color: rgba(255,255,255,0.65); font-size: 11px; flex-shrink: 0; }
.datetime .time { font-size: 20px; font-weight: 800; color: #fff; display: block; line-height: 1.1; }

/* ── Main layout ── */
.main {
  display: grid;
  grid-template-columns: 1fr 320px;
  flex: 1;
  overflow: hidden;
}

/* ── Beach panel ── */
.beach-panel {
  background: var(--sand);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.beach-road {
  background: #b0bec5;
  height: 32px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  flex-shrink: 0;
}

.parking-label {
  font-size: 10px;
  font-weight: 700;
  color: rgba(255,255,255,0.6);
  text-transform: uppercase;
  letter-spacing: 1.5px;
}

.beach-map-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  padding-right: 90px; /* espace pour le bâtiment */
}

.beach-map {
  position: relative;
  width: 600px;
  height: 360px;
  flex-shrink: 0;
}

/* Tapis PMR */
.tapis-h {
  position: absolute;
  left: 0; right: 0;
  height: 14px;
  background: linear-gradient(180deg, #1565c0, #1976d2);
  border-radius: 3px;
  box-shadow: 0 2px 8px rgba(21,101,192,0.35);
}

.tapis-v {
  position: absolute;
  top: 0; bottom: 0;
  width: 12px;
  background: linear-gradient(90deg, #1565c0, #1976d2);
  border-radius: 3px;
  box-shadow: 0 2px 8px rgba(21,101,192,0.35);
}

/* Douche */
.shower-marker {
  position: absolute;
  width: 22px; height: 22px;
  background: #8d6e63;
  border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  z-index: 1;
}

/* Spots */
.spot {
  position: absolute;
  width: 36px; height: 36px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.15s;
  display: flex; align-items: center; justify-content: center;
  font-size: 8px;
  font-weight: 800;
  color: #fff;
  text-align: center;
  line-height: 1.2;
  box-shadow: 0 3px 10px rgba(0,0,0,0.22);
  border: 2px solid rgba(255,255,255,0.2);
  user-select: none;
  z-index: 2;
}

.spot::before {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  background: repeating-conic-gradient(rgba(255,255,255,0.1) 0deg 45deg, transparent 45deg 90deg);
  pointer-events: none;
}

.spot:hover { transform: scale(1.18); z-index: 5; }

.spot[data-state="free"]             { background: linear-gradient(135deg, var(--green-dark), var(--green)); }
.spot[data-state="present"]          { background: linear-gradient(135deg, var(--red-dark), var(--red)); }
.spot[data-state="walkin"]           { background: linear-gradient(135deg, #e65100, var(--orange)); }
.spot[data-state="reserved_waiting"] { background: linear-gradient(135deg, #b45309, var(--amber)); }
.spot[data-state="absent"]           { background: linear-gradient(135deg, #4a148c, var(--purple)); }

.spot .timer-badge {
  position: absolute;
  bottom: -3px; right: -3px;
  background: #ffd600;
  color: var(--navy);
  border-radius: 6px;
  padding: 1px 3px;
  font-size: 6px;
  font-weight: 900;
  line-height: 1.5;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  pointer-events: none;
}

.spot .timer-badge.critical { background: #ff1744; color: #fff; animation: blink 0.8s infinite; }

@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

/* Sea */
.beach-sea {
  position: absolute;
  bottom: 0; left: 0;
  width: 35%; height: 80px;
  background: linear-gradient(135deg, var(--sea1), var(--sea2));
  border-radius: 0 70px 0 0;
  opacity: 0.8;
  display: flex; align-items: center; justify-content: center;
}

.sea-label {
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  opacity: 0.75;
  margin-top: 20px; margin-left: 20px;
}

/* Building */
.beach-building {
  position: absolute;
  right: 0; top: 32px; bottom: 0;
  width: 80px;
  background: #78909c;
  display: flex; align-items: center; justify-content: center;
}

.building-label {
  font-size: 9px; color: #fff; font-weight: 700;
  text-transform: uppercase; letter-spacing: 1px;
  writing-mode: vertical-rl;
}

/* ── Side panel ── */
.side-panel {
  background: var(--panel-bg);
  border-left: 1px solid var(--border);
  display: flex; flex-direction: column;
  overflow: hidden;
}

.panel-header {
  background: linear-gradient(135deg, var(--blue), var(--blue-dark));
  padding: 12px 14px;
  color: #fff;
  flex-shrink: 0;
}

.panel-header h2 { font-size: 14px; font-weight: 800; }
.panel-header .slot-countdown { font-size: 11px; color: rgba(255,255,255,0.65); margin-top: 2px; }

.panel-stats {
  display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;
}

.stat-chip {
  background: rgba(255,255,255,0.13);
  border-radius: 8px;
  padding: 3px 9px;
  font-size: 10px; font-weight: 700;
  display: flex; align-items: center; gap: 4px;
}

.stat-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }

.checkin-btn {
  margin: 10px 12px 6px;
  background: linear-gradient(135deg, var(--accent), #00b090);
  color: var(--navy);
  border: none; border-radius: 10px;
  padding: 10px 12px;
  font-size: 12px; font-weight: 800;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  box-shadow: 0 3px 10px rgba(0,212,170,0.3);
  transition: all 0.15s;
  flex-shrink: 0;
}

.checkin-btn:hover { transform: translateY(-1px); box-shadow: 0 5px 16px rgba(0,212,170,0.45); }

.resa-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 12px 12px;
}

.resa-section-title {
  font-size: 9px; font-weight: 800; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 1px;
  margin: 8px 0 5px;
}

.resa-item {
  background: #fff;
  border-radius: 10px;
  padding: 8px 10px;
  margin-bottom: 5px;
  display: flex; align-items: center; gap: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
  border-left: 3px solid transparent;
  cursor: pointer;
  transition: transform 0.12s;
}

.resa-item:hover { transform: translateX(2px); }
.resa-item[data-state="present"]          { border-left-color: var(--red); }
.resa-item[data-state="walkin"]           { border-left-color: var(--orange); }
.resa-item[data-state="reserved_waiting"] { border-left-color: var(--amber); }
.resa-item[data-state="free"]             { border-left-color: var(--green); }
.resa-item[data-state="absent"]           { border-left-color: var(--purple); }

.resa-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 800; color: #fff;
  flex-shrink: 0;
}

.resa-info { flex: 1; min-width: 0; }
.resa-name { font-size: 12px; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.resa-meta { font-size: 9px; color: var(--text-muted); margin-top: 1px; }

.resa-timer {
  font-size: 11px; font-weight: 800;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.resa-timer.critical { color: var(--red-dark); animation: blink 0.8s infinite; }
.resa-timer.warning  { color: var(--orange); }
.resa-timer.ok       { color: var(--amber); }
.resa-timer.muted    { color: var(--text-muted); font-size: 9px; font-weight: 500; }

.spot-num {
  font-size: 9px; background: var(--border); color: #475569;
  border-radius: 4px; padding: 1px 4px; font-weight: 700; flex-shrink: 0;
}

.panel-legend {
  padding: 8px 12px;
  border-top: 1px solid var(--border);
  display: grid; grid-template-columns: 1fr 1fr; gap: 3px;
  flex-shrink: 0;
}

.legend-item {
  display: flex; align-items: center; gap: 4px;
  font-size: 9px; color: var(--text-muted); font-weight: 600;
}

.legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

/* ── Modal ── */
dialog {
  border: none; border-radius: 16px;
  padding: 0; width: 420px; max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0,0,0,0.4);
}

dialog::backdrop { background: rgba(10,22,40,0.7); }

.modal-header {
  background: linear-gradient(135deg, var(--blue), var(--blue-dark));
  padding: 16px 20px;
  color: #fff; border-radius: 16px 16px 0 0;
  display: flex; align-items: center; justify-content: space-between;
}

.modal-header h3 { font-size: 15px; font-weight: 800; }

.modal-close {
  background: rgba(255,255,255,0.15); border: none; color: #fff;
  width: 28px; height: 28px; border-radius: 50%;
  cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center;
}

.modal-body { padding: 20px; }

.form-group { margin-bottom: 14px; }

.form-group label {
  display: block; font-size: 11px; font-weight: 700;
  color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.8px;
  margin-bottom: 5px;
}

.form-group input,
.form-group select {
  width: 100%; padding: 9px 12px;
  border: 2px solid var(--border); border-radius: 8px;
  font-size: 13px; color: var(--text);
  outline: none; transition: border-color 0.15s;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus { border-color: var(--blue); }

.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

.radio-group { display: flex; gap: 8px; }

.radio-btn {
  flex: 1; padding: 8px;
  border: 2px solid var(--border); border-radius: 8px;
  text-align: center; font-size: 11px; font-weight: 700;
  cursor: pointer; transition: all 0.15s; color: var(--text-muted);
}

.radio-btn.selected { border-color: var(--blue); background: #eff6ff; color: var(--blue); }

.modal-footer {
  padding: 0 20px 20px;
  display: flex; gap: 8px;
}

.btn-primary {
  flex: 1; padding: 11px;
  background: linear-gradient(135deg, var(--accent), #00b090);
  color: var(--navy); border: none; border-radius: 10px;
  font-size: 13px; font-weight: 800; cursor: pointer;
  transition: all 0.15s;
}

.btn-primary:hover { filter: brightness(1.05); transform: translateY(-1px); }

.btn-secondary {
  padding: 11px 16px;
  background: var(--border); color: var(--text-muted);
  border: none; border-radius: 10px;
  font-size: 13px; font-weight: 700; cursor: pointer;
}

.btn-danger {
  padding: 11px 16px;
  background: #fee2e2; color: var(--red-dark);
  border: none; border-radius: 10px;
  font-size: 13px; font-weight: 700; cursor: pointer;
}

/* Spot detail in modal */
.spot-detail {
  display: flex; flex-direction: column; gap: 10px;
}

.detail-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 0; border-bottom: 1px solid var(--border);
}

.detail-row:last-child { border-bottom: none; }
.detail-label { font-size: 11px; color: var(--text-muted); font-weight: 600; }
.detail-value { font-size: 13px; font-weight: 700; color: var(--text); }
.detail-timer { font-size: 22px; font-weight: 900; color: var(--red); font-variant-numeric: tabular-nums; }
.detail-timer.critical { color: var(--red-dark); animation: blink 0.8s infinite; }
.detail-timer.warning  { color: var(--orange); }

/* Empty state */
.empty-state {
  text-align: center; padding: 30px 16px;
  color: var(--text-muted);
}
.empty-state .empty-icon { font-size: 32px; margin-bottom: 8px; }
.empty-state p { font-size: 12px; }

/* Scrollbar */
.resa-list::-webkit-scrollbar { width: 4px; }
.resa-list::-webkit-scrollbar-track { background: transparent; }
.resa-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
```

- [ ] **Step 5 : Ouvrir `index.html` dans le navigateur**

```bash
# Windows
start index.html
# ou servir localement
npx serve . -p 3000
```

Vérifier que la page charge sans erreurs JS (console vide, deux panneaux visibles).

- [ ] **Step 6 : Commit**

```bash
git add index.html css/style.css
git commit -m "feat: project scaffold with shell layout and full CSS"
```

---

## Task 2 : Logique des créneaux (TDD)

**Files:**
- Create: `js/slots.js`
- Create: `tests/test-slots.js`

- [ ] **Step 1 : Écrire les tests**

```js
// tests/test-slots.js
'use strict';
const assert = require('assert');
const { SLOTS, timeToMinutes, getSlotStatus, getActiveSlot, getSlotById } = require('../js/slots.js');

// timeToMinutes
assert.strictEqual(timeToMinutes('08:30'), 510);
assert.strictEqual(timeToMinutes('10:15'), 615);
assert.strictEqual(timeToMinutes('00:00'), 0);
assert.strictEqual(timeToMinutes('23:59'), 1439);

// getSlotStatus — avant tous les créneaux
{
  const d = new Date('2026-06-26T07:00:00');
  assert.strictEqual(getSlotStatus(SLOTS[0], d), 'upcoming');
}

// getSlotStatus — pendant le créneau 1
{
  const d = new Date('2026-06-26T09:00:00');
  assert.strictEqual(getSlotStatus(SLOTS[0], d), 'active');
}

// getSlotStatus — après le créneau 1, avant créneau 2
{
  const d = new Date('2026-06-26T10:20:00');
  assert.strictEqual(getSlotStatus(SLOTS[0], d), 'past');
  assert.strictEqual(getSlotStatus(SLOTS[1], d), 'upcoming');
}

// getSlotStatus — pendant créneau 3
{
  const d = new Date('2026-06-26T13:00:00');
  assert.strictEqual(getSlotStatus(SLOTS[2], d), 'active');
  assert.strictEqual(getSlotStatus(SLOTS[1], d), 'past');
  assert.strictEqual(getSlotStatus(SLOTS[3], d), 'upcoming');
}

// getSlotStatus — après tous
{
  const d = new Date('2026-06-26T20:00:00');
  SLOTS.forEach(s => assert.strictEqual(getSlotStatus(s, d), 'past'));
}

// getActiveSlot
{
  const d = new Date('2026-06-26T11:00:00');
  const slot = getActiveSlot(d);
  assert.ok(slot, 'should find active slot at 11h');
  assert.strictEqual(slot.id, 2);
}

{
  const d = new Date('2026-06-26T07:00:00');
  assert.strictEqual(getActiveSlot(d), null);
}

// getSlotById
assert.strictEqual(getSlotById(1).label, '8h30 – 10h15');
assert.strictEqual(getSlotById(5).label, '16h30 – 18h15');
assert.strictEqual(getSlotById(99), null);

console.log('✓ slots.js — tous les tests passent');
```

- [ ] **Step 2 : Lancer les tests — vérifier qu'ils échouent**

```bash
node tests/test-slots.js
```

Attendu : `Error: Cannot find module '../js/slots.js'`

- [ ] **Step 3 : Implémenter `js/slots.js`**

```js
'use strict';

const SLOTS = [
  { id: 1, label: '8h30 – 10h15',  start: '08:30', end: '10:15' },
  { id: 2, label: '10h30 – 12h15', start: '10:30', end: '12:15' },
  { id: 3, label: '12h30 – 14h15', start: '12:30', end: '14:15' },
  { id: 4, label: '14h30 – 16h15', start: '14:30', end: '16:15' },
  { id: 5, label: '16h30 – 18h15', start: '16:30', end: '18:15' },
];

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Retourne 'past' | 'active' | 'upcoming'
function getSlotStatus(slot, date) {
  const now = (date || new Date()).getHours() * 60 + (date || new Date()).getMinutes();
  const start = timeToMinutes(slot.start);
  const end = timeToMinutes(slot.end);
  if (now >= end)   return 'past';
  if (now >= start) return 'active';
  return 'upcoming';
}

// Retourne le créneau actif ou null
function getActiveSlot(date) {
  return SLOTS.find(s => getSlotStatus(s, date) === 'active') || null;
}

function getSlotById(id) {
  return SLOTS.find(s => s.id === id) || null;
}

if (typeof module !== 'undefined') {
  module.exports = { SLOTS, timeToMinutes, getSlotStatus, getActiveSlot, getSlotById };
}
```

- [ ] **Step 4 : Lancer les tests — vérifier qu'ils passent**

```bash
node tests/test-slots.js
```

Attendu : `✓ slots.js — tous les tests passent`

- [ ] **Step 5 : Commit**

```bash
git add js/slots.js tests/test-slots.js
git commit -m "feat: slot logic with full test coverage"
```

---

## Task 3 : Logique du décompte (TDD)

**Files:**
- Create: `js/timer.js`
- Create: `tests/test-timer.js`

- [ ] **Step 1 : Écrire les tests**

```js
// tests/test-timer.js
'use strict';
const assert = require('assert');
const { DURATION_MS, getTimeRemaining, formatCountdown, getUrgencyLevel } = require('../js/timer.js');

// DURATION_MS = 1h45 = 6300 secondes
assert.strictEqual(DURATION_MS, 105 * 60 * 1000);

// getTimeRemaining — arrivée à l'instant
{
  const now = Date.now();
  const remaining = getTimeRemaining(now);
  assert.ok(remaining >= DURATION_MS - 10 && remaining <= DURATION_MS, 'should be ~DURATION_MS');
}

// getTimeRemaining — arrivée il y a 30 minutes
{
  const checkin = Date.now() - 30 * 60 * 1000;
  const remaining = getTimeRemaining(checkin);
  const expected = 75 * 60 * 1000;
  assert.ok(Math.abs(remaining - expected) < 100, 'should be ~75 minutes remaining');
}

// getTimeRemaining — temps écoulé → retourne 0 (pas négatif)
{
  const checkin = Date.now() - 200 * 60 * 1000;
  assert.strictEqual(getTimeRemaining(checkin), 0);
}

// formatCountdown
assert.strictEqual(formatCountdown(105 * 60 * 1000), '105:00');
assert.strictEqual(formatCountdown(75 * 60 * 1000), '75:00');
assert.strictEqual(formatCountdown(90 * 1000),       '01:30');
assert.strictEqual(formatCountdown(5 * 1000),        '00:05');
assert.strictEqual(formatCountdown(0),               '00:00');
assert.strictEqual(formatCountdown(61 * 1000),       '01:01');

// getUrgencyLevel
assert.strictEqual(getUrgencyLevel(0),                  'expired');
assert.strictEqual(getUrgencyLevel(5 * 60 * 1000),      'critical'); // <15min
assert.strictEqual(getUrgencyLevel(14 * 60 * 1000 + 59000), 'critical');
assert.strictEqual(getUrgencyLevel(15 * 60 * 1000),     'warning');  // 15-30min
assert.strictEqual(getUrgencyLevel(29 * 60 * 1000),     'warning');
assert.strictEqual(getUrgencyLevel(30 * 60 * 1000),     'ok');       // ≥30min

console.log('✓ timer.js — tous les tests passent');
```

- [ ] **Step 2 : Lancer les tests — vérifier qu'ils échouent**

```bash
node tests/test-timer.js
```

Attendu : `Error: Cannot find module '../js/timer.js'`

- [ ] **Step 3 : Implémenter `js/timer.js`**

```js
'use strict';

const DURATION_MS = 105 * 60 * 1000; // 1h45

function getTimeRemaining(checkinTimestamp) {
  return Math.max(0, DURATION_MS - (Date.now() - checkinTimestamp));
}

// Formate des millisecondes en "MM:SS"
function formatCountdown(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Retourne le niveau d'urgence : 'expired' | 'critical' | 'warning' | 'ok'
function getUrgencyLevel(ms) {
  if (ms === 0)              return 'expired';
  if (ms < 15 * 60 * 1000)  return 'critical';
  if (ms < 30 * 60 * 1000)  return 'warning';
  return 'ok';
}

if (typeof module !== 'undefined') {
  module.exports = { DURATION_MS, getTimeRemaining, formatCountdown, getUrgencyLevel };
}
```

- [ ] **Step 4 : Lancer les tests — vérifier qu'ils passent**

```bash
node tests/test-timer.js
```

Attendu : `✓ timer.js — tous les tests passent`

- [ ] **Step 5 : Commit**

```bash
git add js/timer.js tests/test-timer.js
git commit -m "feat: countdown timer logic with full test coverage"
```

---

## Task 4 : Couche de persistance localStorage (TDD)

**Files:**
- Create: `js/storage.js`
- Create: `tests/test-storage.js`

- [ ] **Step 1 : Écrire les tests**

```js
// tests/test-storage.js
'use strict';
const assert = require('assert');

// Mock localStorage pour Node.js
global.localStorage = {
  _data: {},
  getItem(key)      { return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null; },
  setItem(key, val) { this._data[key] = String(val); },
  removeItem(key)   { delete this._data[key]; },
  clear()           { this._data = {}; },
};

const {
  getReservations, saveCheckin, updateStatus, clearSlot, getTodayISO
} = require('../js/storage.js');

const DATE = '2026-06-26';
const SLOT = 2;

// getReservations — vide au départ
{
  const resas = getReservations(DATE, SLOT);
  assert.deepStrictEqual(resas, {});
}

// saveCheckin — enregistre une réservation
{
  saveCheckin(DATE, SLOT, 'P1', {
    nom: 'Martin', prenom: 'André', accompagnants: 1,
    type: 'reserved', checkinTime: 1750000000000, status: 'present'
  });
  const resas = getReservations(DATE, SLOT);
  assert.ok(resas['P1'], 'P1 should exist');
  assert.strictEqual(resas['P1'].nom, 'Martin');
  assert.strictEqual(resas['P1'].status, 'present');
}

// saveCheckin — deuxième emplacement
{
  saveCheckin(DATE, SLOT, 'P5', {
    nom: 'Dupont', prenom: 'Claire', accompagnants: 0,
    type: 'walkin', checkinTime: 1750000100000, status: 'present'
  });
  const resas = getReservations(DATE, SLOT);
  assert.ok(resas['P5']);
  assert.strictEqual(resas['P5'].type, 'walkin');
}

// updateStatus
{
  updateStatus(DATE, SLOT, 'P1', 'absent');
  const resas = getReservations(DATE, SLOT);
  assert.strictEqual(resas['P1'].status, 'absent');
  assert.strictEqual(resas['P1'].nom, 'Martin'); // autres champs préservés
}

// updateStatus — spot inexistant → no-op sans crash
{
  assert.doesNotThrow(() => updateStatus(DATE, SLOT, 'P99', 'absent'));
}

// clearSlot — vide uniquement le slot concerné
{
  saveCheckin(DATE, 1, 'P3', {
    nom: 'Test', prenom: 'Un', accompagnants: 0,
    type: 'reserved', checkinTime: Date.now(), status: 'present'
  });
  clearSlot(DATE, SLOT);
  assert.deepStrictEqual(getReservations(DATE, SLOT), {});
  assert.ok(getReservations(DATE, 1)['P3'], 'slot 1 data should remain');
}

// getTodayISO — format YYYY-MM-DD
{
  const iso = getTodayISO();
  assert.match(iso, /^\d{4}-\d{2}-\d{2}$/);
}

console.log('✓ storage.js — tous les tests passent');
```

- [ ] **Step 2 : Lancer les tests — vérifier qu'ils échouent**

```bash
node tests/test-storage.js
```

Attendu : `Error: Cannot find module '../js/storage.js'`

- [ ] **Step 3 : Implémenter `js/storage.js`**

```js
'use strict';

// Clé localStorage : handiplage_YYYY-MM-DD_slotN
function _key(date, slotId) {
  return `handiplage_${date}_slot${slotId}`;
}

// Retourne toutes les réservations d'un créneau sous la forme :
// { [spotId]: { nom, prenom, accompagnants, type, checkinTime, status } }
function getReservations(date, slotId) {
  const raw = localStorage.getItem(_key(date, slotId));
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

// Sauvegarde ou remplace une entrée pour un emplacement
function saveCheckin(date, slotId, spotId, data) {
  const resas = getReservations(date, slotId);
  resas[spotId] = data;
  localStorage.setItem(_key(date, slotId), JSON.stringify(resas));
}

// Met à jour uniquement le statut d'un emplacement existant
function updateStatus(date, slotId, spotId, status) {
  const resas = getReservations(date, slotId);
  if (!resas[spotId]) return;
  resas[spotId].status = status;
  localStorage.setItem(_key(date, slotId), JSON.stringify(resas));
}

// Vide toutes les entrées d'un créneau
function clearSlot(date, slotId) {
  localStorage.setItem(_key(date, slotId), JSON.stringify({}));
}

// Retourne la date du jour au format YYYY-MM-DD
function getTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

if (typeof module !== 'undefined') {
  module.exports = { getReservations, saveCheckin, updateStatus, clearSlot, getTodayISO };
}
```

- [ ] **Step 4 : Lancer les tests — vérifier qu'ils passent**

```bash
node tests/test-storage.js
```

Attendu : `✓ storage.js — tous les tests passent`

- [ ] **Step 5 : Créer le lanceur de tests global**

```js
// tests/run-all.js
'use strict';
const { execSync } = require('child_process');
const tests = ['test-slots.js', 'test-timer.js', 'test-storage.js'];
tests.forEach(f => {
  execSync(`node tests/${f}`, { stdio: 'inherit' });
});
console.log('\n✅ Tous les tests passent.');
```

- [ ] **Step 6 : Vérifier que tous les tests passent**

```bash
node tests/run-all.js
```

Attendu :
```
✓ slots.js — tous les tests passent
✓ timer.js — tous les tests passent
✓ storage.js — tous les tests passent

✅ Tous les tests passent.
```

- [ ] **Step 7 : Commit**

```bash
git add js/storage.js tests/test-storage.js tests/run-all.js
git commit -m "feat: localStorage storage layer with full test coverage"
```

---

## Task 5 : Données statiques de la carte (55 emplacements)

**Files:**
- Create: `js/data.js`

- [ ] **Step 1 : Créer `js/data.js`**

Les 55 emplacements sont disposés en 4 rangées de 14, 14, 14 et 13 spots.
Les tapis PMR verticaux créent 4 sections par rangée.

```js
'use strict';

// Positions x des centres des 14 colonnes (px)
// 4 sections séparées par 3 tapis PMR verticaux
const _COL_X = [20, 58, 96, 134,   // section 1 (cols 1-4)
                176, 214, 252, 290, // section 2 (cols 5-8)
                332, 370, 408, 446, // section 3 (cols 9-12)
                488, 526];          // section 4 (cols 13-14)

// Positions y des centres des 4 rangées (px)
const _ROW_Y = [20, 98, 176, 254];

// Positions des tapis PMR (en px dans la beach-map)
const TAPIS_V = [
  { x: 150, label: 'Allée A' },
  { x: 308, label: 'Allée B' },
  { x: 464, label: 'Allée C' },
];

const TAPIS_H = [
  { y: 54,  label: 'Allée 1-2' },
  { y: 132, label: 'Allée 2-3' },
  { y: 210, label: 'Allée 3-4' },
];

// Positions des douches sur la carte
const SHOWERS = [
  { x: 148, y: 125, label: 'Douche 1' },
  { x: 306, y: 125, label: 'Douche 2' },
];

// Génère les 55 spots : P1–P55
function _generateSpots() {
  const spots = [];
  let id = 1;
  const rowCounts = [14, 14, 14, 13]; // row 4 has 13 spots
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < rowCounts[row]; col++) {
      spots.push({
        id:    `P${id}`,
        label: `Place ${id}`,
        row:   row + 1,
        col:   col + 1,
        x:     _COL_X[col],
        y:     _ROW_Y[row],
      });
      id++;
    }
  }
  return spots; // 14+14+14+13 = 55
}

const BEACH_CONFIG = {
  mapWidth:  560,
  mapHeight: 294, // 4 rangées + marges
  spotSize:  34,  // diamètre en px
  spots:     _generateSpots(),
  tapısV:    TAPIS_V,
  tapısH:    TAPIS_H,
  showers:   SHOWERS,
};

if (typeof module !== 'undefined') {
  module.exports = { BEACH_CONFIG };
}
```

- [ ] **Step 2 : Vérifier le compte de spots en console navigateur**

Ouvrir `index.html` dans le navigateur, puis dans la console :
```js
BEACH_CONFIG.spots.length // doit retourner 55
BEACH_CONFIG.spots[0]     // { id: 'P1', label: 'Place 1', row: 1, col: 1, x: 20, y: 20 }
BEACH_CONFIG.spots[54]    // { id: 'P55', label: 'Place 55', row: 4, col: 13, x: 488, y: 254 }
```

- [ ] **Step 3 : Commit**

```bash
git add js/data.js
git commit -m "feat: static beach layout data (55 spots, tapis PMR, showers)"
```

---

## Task 6 : Rendu de la carte de plage

**Files:**
- Create: `js/map.js`

- [ ] **Step 1 : Implémenter `js/map.js`**

```js
'use strict';

// Rend les éléments statiques : tapis PMR, douches (appelé une seule fois)
function renderMapStatic(container) {
  const cfg = BEACH_CONFIG;

  // Tapis horizontaux
  cfg.tapısH.forEach(t => {
    const el = document.createElement('div');
    el.className = 'tapis-h';
    el.style.top = `${t.y}px`;
    container.appendChild(el);
  });

  // Tapis verticaux
  cfg.tapısV.forEach(t => {
    const el = document.createElement('div');
    el.className = 'tapis-v';
    el.style.left = `${t.x}px`;
    container.appendChild(el);
  });

  // Douches
  cfg.showers.forEach(s => {
    const el = document.createElement('div');
    el.className = 'shower-marker';
    el.style.left = `${s.x}px`;
    el.style.top  = `${s.y}px`;
    el.title = s.label;
    el.textContent = '🚿';
    container.appendChild(el);
  });

  // Taille du conteneur
  container.style.width  = `${cfg.mapWidth}px`;
  container.style.height = `${cfg.mapHeight}px`;
}

// Rend ou met à jour tous les spots selon l'état des réservations
// reservations : { [spotId]: { nom, prenom, status, checkinTime, ... } }
function renderMapSpots(container, reservations, onSpotClick) {
  BEACH_CONFIG.spots.forEach(spot => {
    let el = container.querySelector(`[data-spot-id="${spot.id}"]`);
    const resa = reservations[spot.id];
    const state = resa ? resa.status : 'free';

    if (!el) {
      // Création initiale
      el = document.createElement('div');
      el.className = 'spot';
      el.dataset.spotId = spot.id;
      el.style.left = `${spot.x - BEACH_CONFIG.spotSize / 2}px`;
      el.style.top  = `${spot.y - BEACH_CONFIG.spotSize / 2}px`;
      el.style.width  = `${BEACH_CONFIG.spotSize}px`;
      el.style.height = `${BEACH_CONFIG.spotSize}px`;
      el.addEventListener('click', () => onSpotClick(spot.id));
      container.appendChild(el);
    }

    // Mise à jour de l'état
    el.dataset.state = state;
    el.title = resa ? `${resa.prenom} ${resa.nom}` : spot.label;

    // Contenu (initiales ou numéro)
    const label = _spotLabel(spot, resa);
    const badge = _timerBadge(resa);
    el.innerHTML = label + badge;
  });
}

function _spotLabel(spot, resa) {
  if (!resa || resa.status === 'free') {
    return `<span style="position:relative;z-index:1">${spot.id}</span>`;
  }
  if (resa.status === 'reserved_waiting') {
    return `<span style="position:relative;z-index:1">⏳</span>`;
  }
  if (resa.status === 'absent') {
    return `<span style="position:relative;z-index:1">✕</span>`;
  }
  // present ou walkin → initiales
  const initials = `${(resa.prenom || '')[0] || ''}${(resa.nom || '')[0] || ''}`.toUpperCase();
  return `<span style="position:relative;z-index:1">${initials || '?'}</span>`;
}

function _timerBadge(resa) {
  if (!resa || !resa.checkinTime || resa.status !== 'present' && resa.status !== 'walkin') return '';
  const ms = getTimeRemaining(resa.checkinTime);
  const urgency = getUrgencyLevel(ms);
  const cssClass = urgency === 'critical' ? 'critical' : '';
  return `<span class="timer-badge ${cssClass}">${formatCountdown(ms)}</span>`;
}

if (typeof module !== 'undefined') {
  module.exports = { renderMapStatic, renderMapSpots };
}
```

- [ ] **Step 2 : Test visuel dans le navigateur**

Ajouter temporairement dans la console navigateur pour tester :
```js
const container = document.getElementById('beach-map');
renderMapStatic(container);
renderMapSpots(container, {
  'P1': { nom:'Martin', prenom:'André', accompagnants:1, type:'reserved', checkinTime: Date.now() - 20*60*1000, status:'present' },
  'P5': { nom:'Dupont', prenom:'Claire', accompagnants:0, type:'walkin',   checkinTime: Date.now() - 60*60*1000, status:'present' },
  'P10': { nom:'Legrand', prenom:'Paul', accompagnants:2, type:'reserved', checkinTime: null, status:'reserved_waiting' },
}, id => console.log('spot cliqué:', id));
```

Vérifier : spots colorés visibles, initiales affichées, badges timer présents sur P1 et P5.

- [ ] **Step 3 : Commit**

```bash
git add js/map.js
git commit -m "feat: beach map rendering with spot states and timer badges"
```

---

## Task 7 : Rendu du panneau droit

**Files:**
- Create: `js/panel.js`

- [ ] **Step 1 : Implémenter `js/panel.js`**

```js
'use strict';

// Rend le panneau droit pour un créneau donné
// slot : objet SLOTS, reservations : {[spotId]: {...}}, date : 'YYYY-MM-DD'
// onCheckinClick : function(), onItemClick : function(spotId)
function renderPanel(container, slot, reservations, onCheckinClick, onItemClick) {
  const { present, waiting, walkin, free, absent } = _categorize(reservations);
  const urgents = [...present, ...walkin].filter(([, r]) => {
    const ms = getTimeRemaining(r.checkinTime);
    return getUrgencyLevel(ms) === 'critical' || getUrgencyLevel(ms) === 'expired';
  });
  const normal = [...present, ...walkin].filter(([spotId]) =>
    !urgents.find(([id]) => id === spotId)
  );

  container.innerHTML = `
    ${_renderHeader(slot, present.length + walkin.length, free.length, walkin.length)}
    <button class="checkin-btn" id="checkin-btn">✚ Enregistrer une arrivée</button>
    <div class="resa-list">
      ${urgents.length  ? `<div class="resa-section-title">⚠ Départ imminent</div>${urgents.map(([id,r]) => _renderItem(id,r)).join('')}` : ''}
      ${normal.length   ? `<div class="resa-section-title">Présents</div>${normal.map(([id,r]) => _renderItem(id,r)).join('')}` : ''}
      ${waiting.length  ? `<div class="resa-section-title">Réservés · pas encore arrivés</div>${waiting.map(([id,r]) => _renderItem(id,r)).join('')}` : ''}
      ${absent.length   ? `<div class="resa-section-title">Absents</div>${absent.map(([id,r]) => _renderItem(id,r)).join('')}` : ''}
      ${free.length     ? `<div class="resa-section-title">Places libres</div>${free.map(id => _renderFreeItem(id)).join('')}` : ''}
      ${(present.length + walkin.length + waiting.length + free.length) === 0
          ? '<div class="empty-state"><div class="empty-icon">🏖️</div><p>Aucune réservation pour ce créneau</p></div>'
          : ''}
    </div>
    ${_renderLegend()}
  `;

  container.querySelector('#checkin-btn').addEventListener('click', onCheckinClick);
  container.querySelectorAll('.resa-item[data-spot-id]').forEach(el => {
    el.addEventListener('click', () => onItemClick(el.dataset.spotId));
  });
}

function _categorize(reservations) {
  const present = [], waiting = [], walkin = [], absent = [], free = [];
  BEACH_CONFIG.spots.forEach(spot => {
    const r = reservations[spot.id];
    if (!r || r.status === 'free') {
      free.push(spot.id);
    } else if (r.status === 'present' && r.type === 'reserved') {
      present.push([spot.id, r]);
    } else if (r.status === 'present' && r.type === 'walkin') {
      walkin.push([spot.id, r]);
    } else if (r.status === 'reserved_waiting') {
      waiting.push([spot.id, r]);
    } else if (r.status === 'absent') {
      absent.push([spot.id, r]);
    }
  });
  // Trier présents par temps restant croissant (urgent en premier)
  const sortByTime = arr => arr.sort(([,a],[,b]) =>
    getTimeRemaining(a.checkinTime) - getTimeRemaining(b.checkinTime)
  );
  return { present: sortByTime(present), waiting, walkin: sortByTime(walkin), free, absent };
}

function _renderHeader(slot, presentCount, freeCount, walkinCount) {
  const now = new Date();
  const endMin = slot ? timeToMinutes(slot.end) : 0;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const remainMin = Math.max(0, endMin - nowMin);
  const countdownLabel = slot
    ? `En cours · se termine dans ${remainMin}min`
    : 'Aucun créneau actif';

  return `
    <div class="panel-header">
      <h2>${slot ? slot.label : 'Sélectionner un créneau'}</h2>
      <div class="slot-countdown">${countdownLabel}</div>
      <div class="panel-stats">
        <div class="stat-chip"><span class="stat-dot" style="background:var(--red)"></span>${presentCount + walkinCount} présents</div>
        <div class="stat-chip"><span class="stat-dot" style="background:var(--green)"></span>${freeCount} libres</div>
        <div class="stat-chip"><span class="stat-dot" style="background:var(--orange)"></span>${walkinCount} sans résa</div>
      </div>
    </div>
  `;
}

function _renderItem(spotId, resa) {
  const initials = `${(resa.prenom||'')[0]||''}${(resa.nom||'')[0]||''}`.toUpperCase();
  const avatarColor = resa.status === 'walkin' ? 'var(--orange)' : resa.status === 'absent' ? 'var(--purple)' : 'var(--red-dark)';
  let timerHtml = '';
  if (resa.checkinTime && (resa.status === 'present' || resa.status === 'walkin')) {
    const ms = getTimeRemaining(resa.checkinTime);
    const urgency = getUrgencyLevel(ms);
    timerHtml = `<div class="resa-timer ${urgency}">${formatCountdown(ms)}</div>`;
  } else if (resa.status === 'reserved_waiting') {
    timerHtml = `<div class="resa-timer muted">Pas arrivé·e</div>`;
  } else if (resa.status === 'absent') {
    timerHtml = `<div class="resa-timer muted">Absent·e</div>`;
  }
  const accompLabel = resa.accompagnants === 0 ? 'seul·e'
    : resa.accompagnants === 1 ? '1 accompagnant'
    : '2 accompagnants';

  return `
    <div class="resa-item" data-state="${resa.status}" data-spot-id="${spotId}">
      <div class="resa-avatar" style="background:${avatarColor}">${initials}</div>
      <div class="resa-info">
        <div class="resa-name">${resa.prenom} ${resa.nom}</div>
        <div class="resa-meta">${spotId} · ${accompLabel}</div>
      </div>
      <span class="spot-num">${spotId}</span>
      ${timerHtml}
    </div>
  `;
}

function _renderFreeItem(spotId) {
  return `
    <div class="resa-item" data-state="free" data-spot-id="${spotId}">
      <div class="resa-avatar" style="background:var(--green)">○</div>
      <div class="resa-info">
        <div class="resa-name">${spotId}</div>
        <div class="resa-meta">Disponible</div>
      </div>
      <span class="spot-num">${spotId}</span>
      <div class="resa-timer muted">Libre</div>
    </div>
  `;
}

function _renderLegend() {
  return `
    <div class="panel-legend">
      <div class="legend-item"><div class="legend-dot" style="background:var(--red)"></div>Présent (réservé)</div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--orange)"></div>Arrivée libre</div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--green)"></div>Libre</div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--amber)"></div>Réservé, pas arrivé</div>
    </div>
  `;
}

if (typeof module !== 'undefined') {
  module.exports = { renderPanel };
}
```

- [ ] **Step 2 : Commit**

```bash
git add js/panel.js
git commit -m "feat: right panel rendering with sorted reservation list"
```

---

## Task 8 : Modale check-in et détail emplacement

**Files:**
- Create: `js/modal.js`

- [ ] **Step 1 : Implémenter `js/modal.js`**

```js
'use strict';

const _dialog = () => document.getElementById('app-modal');

function closeModal() {
  _dialog().close();
}

// Modale pour enregistrer une arrivée (spot optionnel = pré-sélection)
// freeSpots : ['P1','P3',...], onConfirm(spotId, data)
function openCheckinModal(freeSpots, preselectedSpotId, onConfirm) {
  const spotOptions = freeSpots.map(id =>
    `<option value="${id}" ${id === preselectedSpotId ? 'selected' : ''}>${id}</option>`
  ).join('');

  _dialog().innerHTML = `
    <div class="modal-header">
      <h3>✚ Enregistrer une arrivée</h3>
      <button class="modal-close" id="modal-close">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label>Prénom</label>
          <input type="text" id="f-prenom" placeholder="Prénom" autocomplete="off">
        </div>
        <div class="form-group">
          <label>Nom</label>
          <input type="text" id="f-nom" placeholder="NOM" autocomplete="off" style="text-transform:uppercase">
        </div>
      </div>
      <div class="form-group">
        <label>Nombre d'accompagnants</label>
        <div class="radio-group" id="f-accompagnants">
          <div class="radio-btn selected" data-value="0">0</div>
          <div class="radio-btn"          data-value="1">1</div>
          <div class="radio-btn"          data-value="2">2</div>
        </div>
      </div>
      <div class="form-group">
        <label>Emplacement</label>
        <select id="f-spot">${spotOptions}</select>
      </div>
      <div class="form-group">
        <label>Type</label>
        <div class="radio-group" id="f-type">
          <div class="radio-btn selected" data-value="reserved">Avec réservation</div>
          <div class="radio-btn"          data-value="walkin">Sans réservation</div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="modal-cancel">Annuler</button>
      <button class="btn-primary"   id="modal-confirm">✓ Confirmer l'arrivée</button>
    </div>
  `;

  _bindRadioGroup('f-accompagnants');
  _bindRadioGroup('f-type');

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('f-prenom').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\b\w/g, c => c.toUpperCase());
  });

  document.getElementById('modal-confirm').addEventListener('click', () => {
    const prenom = document.getElementById('f-prenom').value.trim();
    const nom    = document.getElementById('f-nom').value.trim().toUpperCase();
    const spotId = document.getElementById('f-spot').value;
    const accompagnants = parseInt(
      document.querySelector('#f-accompagnants .radio-btn.selected').dataset.value
    );
    const type = document.querySelector('#f-type .radio-btn.selected').dataset.value;

    if (!prenom || !nom || !spotId) {
      alert('Prénom, nom et emplacement sont obligatoires.');
      return;
    }

    closeModal();
    onConfirm(spotId, {
      nom, prenom, accompagnants, type,
      checkinTime: Date.now(),
      status: 'present',
    });
  });

  _dialog().showModal();
  document.getElementById('f-prenom').focus();
}

// Modale détail d'un emplacement occupé
// resa : { nom, prenom, accompagnants, type, checkinTime, status }
// callbacks : { onCheckin, onDepart, onAbsent }
function openSpotDetailModal(spotId, resa, callbacks) {
  const ms = resa.checkinTime ? getTimeRemaining(resa.checkinTime) : null;
  const urgency = ms !== null ? getUrgencyLevel(ms) : 'ok';

  const timerHtml = ms !== null
    ? `<div class="detail-row"><span class="detail-label">Temps restant</span><span class="detail-timer ${urgency}">${formatCountdown(ms)}</span></div>`
    : '';

  const accompLabel = resa.accompagnants === 0 ? 'Seul·e'
    : resa.accompagnants === 1 ? '1 accompagnant'
    : '2 accompagnants';

  const actionBtns = resa.status === 'reserved_waiting'
    ? `<button class="btn-primary" id="btn-checkin">▶ Confirmer arrivée</button>
       <button class="btn-danger"  id="btn-absent">✕ Marquer absent·e</button>`
    : `<button class="btn-danger" id="btn-depart">↩ Marquer départ</button>`;

  _dialog().innerHTML = `
    <div class="modal-header">
      <h3>${spotId} — ${resa.prenom} ${resa.nom}</h3>
      <button class="modal-close" id="modal-close">✕</button>
    </div>
    <div class="modal-body">
      <div class="spot-detail">
        <div class="detail-row"><span class="detail-label">Emplacement</span><span class="detail-value">${spotId}</span></div>
        <div class="detail-row"><span class="detail-label">Nom</span><span class="detail-value">${resa.prenom} ${resa.nom}</span></div>
        <div class="detail-row"><span class="detail-label">Accompagnants</span><span class="detail-value">${accompLabel}</span></div>
        <div class="detail-row"><span class="detail-label">Type</span><span class="detail-value">${resa.type === 'walkin' ? 'Sans réservation' : 'Avec réservation'}</span></div>
        ${timerHtml}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="modal-cancel">Fermer</button>
      ${actionBtns}
    </div>
  `;

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  if (resa.status === 'reserved_waiting') {
    document.getElementById('btn-checkin').addEventListener('click', () => { closeModal(); callbacks.onCheckin && callbacks.onCheckin(spotId); });
    document.getElementById('btn-absent').addEventListener('click', () => { closeModal(); callbacks.onAbsent && callbacks.onAbsent(spotId); });
  } else {
    document.getElementById('btn-depart').addEventListener('click', () => { closeModal(); callbacks.onDepart && callbacks.onDepart(spotId); });
  }

  _dialog().showModal();
}

function _bindRadioGroup(groupId) {
  document.getElementById(groupId).querySelectorAll('.radio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(groupId).querySelectorAll('.radio-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
}

if (typeof module !== 'undefined') {
  module.exports = { openCheckinModal, openSpotDetailModal, closeModal };
}
```

- [ ] **Step 2 : Commit**

```bash
git add js/modal.js
git commit -m "feat: check-in modal and spot detail modal"
```

---

## Task 9 : Coordinateur principal & boucle de rafraîchissement

**Files:**
- Create: `js/app.js`

- [ ] **Step 1 : Implémenter `js/app.js`**

```js
'use strict';

const App = (() => {
  let _selectedSlotId = null;
  let _date = null;
  let _refreshInterval = null;

  function init() {
    _date = getTodayISO();
    _renderHeader();
    _renderClock();
    setInterval(_renderClock, 1000);

    // Sélectionner le créneau actif, ou le premier à venir
    const active = getActiveSlot(new Date());
    const upcoming = SLOTS.find(s => getSlotStatus(s, new Date()) === 'upcoming');
    const defaultSlot = active || upcoming || SLOTS[0];
    selectSlot(defaultSlot.id);

    // Rafraîchissement toutes les 30 secondes
    _refreshInterval = setInterval(refresh, 30000);
  }

  function selectSlot(slotId) {
    _selectedSlotId = slotId;

    // Mettre à jour les pills
    document.querySelectorAll('.slot-pill').forEach(el => {
      el.classList.toggle('selected-slot', parseInt(el.dataset.slotId) === slotId);
    });

    refresh();
  }

  function refresh() {
    if (!_selectedSlotId) return;
    const reservations = getReservations(_date, _selectedSlotId);
    const slot = getSlotById(_selectedSlotId);
    const mapEl = document.getElementById('beach-map');
    const panelEl = document.getElementById('side-panel');
    const freeSpots = BEACH_CONFIG.spots
      .filter(s => !reservations[s.id] || reservations[s.id].status === 'free')
      .map(s => s.id);

    renderMapSpots(mapEl, reservations, spotId => _onSpotClick(spotId, reservations, freeSpots));
    renderPanel(panelEl, slot, reservations,
      () => _openCheckin(freeSpots),
      spotId => _onSpotClick(spotId, reservations, freeSpots)
    );
  }

  function _onSpotClick(spotId, reservations, freeSpots) {
    const resa = reservations[spotId];
    if (!resa || resa.status === 'free') {
      // Place libre → ouvrir check-in pré-sélectionné
      _openCheckin(freeSpots, spotId);
    } else {
      // Place occupée → détail
      openSpotDetailModal(spotId, resa, {
        onCheckin: id => {
          updateStatus(_date, _selectedSlotId, id, 'present');
          const resas = getReservations(_date, _selectedSlotId);
          resas[id].checkinTime = Date.now();
          saveCheckin(_date, _selectedSlotId, id, resas[id]);
          refresh();
        },
        onDepart: id => {
          updateStatus(_date, _selectedSlotId, id, 'free');
          refresh();
        },
        onAbsent: id => {
          updateStatus(_date, _selectedSlotId, id, 'absent');
          refresh();
        },
      });
    }
  }

  function _openCheckin(freeSpots, preselectedSpotId) {
    // Vérifier la limite de 25 réservations par créneau
    const resas = getReservations(_date, _selectedSlotId);
    const reservedCount = Object.values(resas).filter(r => r.type === 'reserved' && r.status !== 'absent').length;

    openCheckinModal(freeSpots, preselectedSpotId, (spotId, data) => {
      if (data.type === 'reserved' && reservedCount >= 25) {
        alert('Limite atteinte : 25 réservations maximum par créneau.\nEnregistrement possible en accès libre (sans réservation) uniquement.');
        return;
      }
      saveCheckin(_date, _selectedSlotId, spotId, data);
      refresh();
    });
  }

  function _renderHeader() {
    const nav = document.getElementById('slots-nav');
    nav.innerHTML = SLOTS.map(slot => {
      const status = getSlotStatus(slot, new Date());
      return `<div class="slot-pill" data-slot-id="${slot.id}" data-status="${status}">${slot.label.split(' – ')[0]}</div>`;
    }).join('');
    nav.querySelectorAll('.slot-pill').forEach(el => {
      el.addEventListener('click', () => {
        if (el.dataset.status !== 'past') selectSlot(parseInt(el.dataset.slotId));
      });
    });

    const dateEl = document.getElementById('date-label');
    const d = new Date();
    dateEl.textContent = d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  }

  function _renderClock() {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    document.getElementById('clock').textContent = `${h}:${m}`;
  }

  return { init, selectSlot, refresh };
})();

// Point d'entrée
document.addEventListener('DOMContentLoaded', () => {
  const mapEl = document.getElementById('beach-map');
  renderMapStatic(mapEl);
  App.init();
});
```

- [ ] **Step 2 : Commit**

```bash
git add js/app.js
git commit -m "feat: app coordinator with slot selection and 30s refresh loop"
```

---

## Task 10 : Intégration finale & validation complète

**Files:** Aucun nouveau fichier — tests manuels des flux utilisateur

- [ ] **Step 1 : Lancer tous les tests unitaires**

```bash
node tests/run-all.js
```

Attendu : `✅ Tous les tests passent.`

- [ ] **Step 2 : Ouvrir l'interface dans le navigateur tablette (ou DevTools en mode tablette)**

```bash
# Lancer un serveur local
npx serve . -p 3000
# Ouvrir http://localhost:3000
```

Dans Chrome/Edge : DevTools → Toggle device toolbar → sélectionner iPad Pro (1024×1366) en mode paysage.

- [ ] **Step 3 : Valider le flux check-in réservé**

1. Cliquer sur une place verte (libre) → modale s'ouvre avec la place pré-sélectionnée
2. Saisir prénom "Marie", nom "DUPONT", 1 accompagnant, type "Avec réservation"
3. Confirmer → la place passe en rouge avec initiales "MD" et badge timer "01:45"
4. La liste de droite affiche Marie Dupont en "Présents"

- [ ] **Step 4 : Valider le flux check-in sans réservation**

1. Cliquer sur une autre place libre
2. Choisir "Sans réservation"
3. Confirmer → la place passe en orange

- [ ] **Step 5 : Valider le départ**

1. Cliquer sur une place occupée → modale détail s'ouvre avec infos + timer
2. Cliquer "Marquer départ" → la place repasse en vert

- [ ] **Step 6 : Valider la réservation en attente**

1. Ouvrir la console navigateur :
```js
saveCheckin(getTodayISO(), 1, 'P3', {
  nom: 'Martin', prenom: 'André', accompagnants: 0,
  type: 'reserved', checkinTime: null, status: 'reserved_waiting'
});
App.refresh();
```
2. La place P3 doit apparaître en amber/jaune (réservé, pas arrivé)
3. Cliquer sur P3 → modale avec boutons "Confirmer arrivée" et "Marquer absent·e"
4. Cliquer "Confirmer arrivée" → le timer démarre, place passe en rouge

- [ ] **Step 7 : Valider la navigation entre créneaux**

1. Cliquer sur un autre créneau dans le header
2. La carte et la liste se rechargent (vides pour un créneau sans données)
3. Le pill sélectionné est bien mis en évidence

- [ ] **Step 8 : Valider la persistence**

1. Enregistrer quelques arrivées
2. Recharger la page (F5)
3. Les données doivent être préservées (localStorage)

- [ ] **Step 9 : Commit final**

```bash
git add .
git commit -m "feat: full handiplage staff interface v1 complete"
```

---

## Récapitulatif des commandes utiles

```bash
# Tests
node tests/run-all.js

# Serveur local
npx serve . -p 3000

# Vider les données de test (console navigateur)
localStorage.clear(); location.reload();
```

## Notes V2 (déploiement réel)

- Remplacer `localStorage` par des appels API REST dans `storage.js` (seul fichier à modifier)
- Ajouter un backend Node.js/Express + SQLite pour la persistance multi-appareils
- Intégration Réservio via leur API REST (import des réservations du jour au démarrage)
- Authentification staff : login/mot de passe avant accès à l'interface
- Autocomplete nom/prénom depuis les comptes usagers existants
