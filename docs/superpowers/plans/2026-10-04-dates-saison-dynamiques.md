# Dates de saison pilotées par la base — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Déplacer `SEASON_START`/`SEASON_END` (codées en dur dans `js/slots.js`) vers `app_config` en base, pour que le bouton staff "Ouvrir la saison" devienne le geste unique qui met à jour à la fois `saison_courante` ET les dates d'ouverture/fermeture de la plage.

**Architecture:** Deux nouvelles colonnes sur `app_config` (`saison_debut`, `saison_fin`), lues via une nouvelle fonction `getSaisonDates()` (`js/supabase-config.js`, avec cache mémoire). `isWithinSeason`/`clampToSeasonEnd` (`js/slots.js`) deviennent des fonctions pures classiques (bornes en paramètres, plus de constante figée). Tous les consommateurs sont déjà des fonctions `async` — simple ajout d'un `await getSaisonDates()`. Le bouton "Ouvrir la saison" ouvre une modale (nouvelle, dans `js/modal.js`) demandant les 2 nouvelles dates au lieu d'un simple `confirm()`. Le texte statique "12 juin – 15 sept. 2026" dans `usager.html`/`inscription-publique.html` devient une amélioration progressive (le texte en dur reste un repli visuel, écrasé dès que la requête répond).

**Tech Stack:** Vanilla JS, Supabase (Postgres + RLS), Node `assert` pour les tests.

**Reference spec:** `docs/superpowers/specs/2026-10-04-dates-saison-dynamiques-design.md`

---

## Conventions à respecter (lire avant de commencer)

- Pas de migration runner dans ce projet — `supabase/schema.sql`/`supabase/rls.sql` sont les sources de vérité pour une install neuve, éditées directement ; le bloc SQL pour appliquer en prod est fourni séparément, à exécuter à la main par l'utilisateur dans l'éditeur SQL Supabase.
- Seules les fonctions pures/synchrones sont testées unitairement. Les wrappers async qui appellent Supabase ne le sont pas (sauf ceux qui acceptent déjà une injection, ce qui n'est pas le cas ici).
- Fichiers `.js` chargés via de simples balises `<script>` (pas de bundler) — l'ordre de chargement dans les `.html` compte.

---

### Task 1: Schéma, RLS — colonnes `saison_debut`/`saison_fin`

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `supabase/rls.sql`

- [ ] **Step 1: Ajouter les colonnes à `app_config`**

Dans `supabase/schema.sql`, remplacer :

```sql
-- Table de config (ligne unique) : pilotage de la saison en cours
CREATE TABLE app_config (
  id              int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  saison_courante int NOT NULL
);

INSERT INTO app_config (id, saison_courante) VALUES (1, 2026);
```

par :

```sql
-- Table de config (ligne unique) : pilotage de la saison en cours
CREATE TABLE app_config (
  id              int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  saison_courante int NOT NULL,
  saison_debut    date,
  saison_fin      date
);

INSERT INTO app_config (id, saison_courante, saison_debut, saison_fin) VALUES (1, 2026, '2026-06-12', '2026-09-15');
```

- [ ] **Step 2: Ouvrir la lecture de `app_config` aux visiteurs non connectés**

Dans `supabase/rls.sql`, remplacer :

```sql
-- Lecture : tout utilisateur connecté (staff + usager) doit pouvoir lire la
-- saison en cours pour calculer son état d'accès.
CREATE POLICY "app_config_read_all" ON app_config
  FOR SELECT TO authenticated
  USING (true);
```

par :

```sql
-- Lecture : tout le monde, y compris non connecté — nécessaire pour que la
-- page d'inscription publique affiche les dates de saison. Rien de sensible
-- (mêmes dates déjà visibles en clair dans le HTML aujourd'hui), même
-- traitement que creneaux_public_read.
CREATE POLICY "app_config_read_all" ON app_config
  FOR SELECT TO anon, authenticated
  USING (true);
```

- [ ] **Step 3: Appliquer en base (manuel, une fois)**

Ce bloc n'est pas exécutable depuis ce plan — ouvrir le Dashboard Supabase → SQL Editor et lancer une fois :

```sql
ALTER TABLE app_config ADD COLUMN saison_debut date;
ALTER TABLE app_config ADD COLUMN saison_fin date;

UPDATE app_config SET saison_debut = '2026-06-12', saison_fin = '2026-09-15' WHERE id = 1;

ALTER POLICY "app_config_read_all" ON app_config TO anon, authenticated;
```

Confirmer avec l'utilisateur que ce bloc a été exécuté avant de considérer les tâches suivantes comme fonctionnelles contre le projet live (les tests locaux des tâches suivantes n'en ont pas besoin, ils n'exercent que des fonctions JS pures).

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql supabase/rls.sql
git commit -m "feat(db): colonnes saison_debut/saison_fin sur app_config, lecture publique"
```

---

### Task 2: `js/supabase-config.js` — `getSaisonDates()` + `ouvrirNouvelleSaison(debut, fin)`

**Files:**
- Modify: `js/supabase-config.js`

Pas de TDD : wrappers Supabase async, même convention que `getSaisonCourante()` existant (pas de test dédié).

- [ ] **Step 1: Remplacer le contenu du fichier**

Remplacer le contenu complet de `js/supabase-config.js` par :

```js
// js/supabase-config.js
'use strict';

/**
 * SELECT saison_courante FROM app_config WHERE id = 1
 */
async function getSaisonCourante() {
  var result = await supabaseClient
    .from('app_config')
    .select('saison_courante')
    .eq('id', 1)
    .single();
  if (result.error) throw result.error;
  return result.data.saison_courante;
}

var _saisonDatesCache = null;

/**
 * SELECT saison_debut, saison_fin FROM app_config WHERE id = 1
 * Résultat mis en cache en mémoire (une requête par session de page) —
 * invalidé/rafraîchi par ouvrirNouvelleSaison().
 */
async function getSaisonDates() {
  if (_saisonDatesCache) return _saisonDatesCache;
  var result = await supabaseClient
    .from('app_config')
    .select('saison_debut, saison_fin')
    .eq('id', 1)
    .single();
  if (result.error) throw result.error;
  _saisonDatesCache = { debut: result.data.saison_debut, fin: result.data.saison_fin };
  return _saisonDatesCache;
}

/**
 * Incrémente saison_courante de 1 et écrit les nouvelles dates de saison.
 * Réservé au staff (RLS app_config_staff_write). Retourne la nouvelle
 * saison_courante.
 */
async function ouvrirNouvelleSaison(saisonDebut, saisonFin) {
  var courante = await getSaisonCourante();
  var result = await supabaseClient
    .from('app_config')
    .update({ saison_courante: courante + 1, saison_debut: saisonDebut, saison_fin: saisonFin })
    .eq('id', 1)
    .select('saison_courante, saison_debut, saison_fin')
    .single();
  if (result.error) throw result.error;
  _saisonDatesCache = { debut: result.data.saison_debut, fin: result.data.saison_fin };
  return result.data.saison_courante;
}

if (typeof module !== 'undefined') {
  module.exports = { getSaisonCourante, getSaisonDates, ouvrirNouvelleSaison };
}
```

- [ ] **Step 2: Run the full suite (sanity check)**

Run: `node tests/run-all.js`
Expected: `✅ Tous les tests passent.`

- [ ] **Step 3: Commit**

```bash
git add js/supabase-config.js
git commit -m "feat: getSaisonDates() + ouvrirNouvelleSaison(debut, fin)"
```

---

### Task 3: `js/slots.js` — bornes de saison en paramètres

**Files:**
- Modify: `js/slots.js`
- Modify: `tests/test-slots.js`

- [ ] **Step 1: Modifier les tests existants**

Dans `tests/test-slots.js`, remplacer la ligne d'import :

```js
const { SLOTS, SEASON_START, SEASON_END, isWithinSeason, clampToSeasonEnd, timeToMinutes, getSlotStatus, getActiveSlot, getSlotById } = require('../js/slots.js');
```

par :

```js
const { SLOTS, isWithinSeason, clampToSeasonEnd, timeToMinutes, getSlotStatus, getActiveSlot, getSlotById } = require('../js/slots.js');
```

Puis remplacer tout le bloc `// ── Période de saison ──` jusqu'à la fin du fichier (avant `console.log`) :

```js
// ── Période de saison ──
assert.strictEqual(SEASON_END, '2026-09-15');
assert.strictEqual(SEASON_START, '2026-06-12');

// isWithinSeason
assert.strictEqual(isWithinSeason('2026-06-12'), true,  'borne de début incluse');
assert.strictEqual(isWithinSeason('2026-09-15'), true,  'borne de fin incluse');
assert.strictEqual(isWithinSeason('2026-08-01'), true);
assert.strictEqual(isWithinSeason('2026-09-16'), false, 'lendemain de fermeture exclu');
assert.strictEqual(isWithinSeason('2026-06-11'), false);
assert.strictEqual(isWithinSeason(''), false);
assert.strictEqual(isWithinSeason(null), false);

// clampToSeasonEnd
assert.strictEqual(clampToSeasonEnd('2026-09-22'), '2026-09-15', 'date au-delà ramenée à la fin de saison');
assert.strictEqual(clampToSeasonEnd('2026-09-15'), '2026-09-15', 'fin de saison inchangée');
assert.strictEqual(clampToSeasonEnd('2026-09-08'), '2026-09-08', 'date en saison inchangée');
```

par :

```js
// ── Période de saison (bornes passées en paramètres — plus de constante figée
// dans slots.js, elles vivent dans app_config.saison_debut/saison_fin).
// Bornes volontairement différentes de l'ancienne constante figée de slots.js
// (2026-06-12/2026-09-15) : si l'implémentation ignorait les paramètres et
// retombait sur un reliquat interne au module, ces assertions échoueraient —
// preuve que la fonction utilise bien ce qu'on lui passe.
const SEASON_START = '2027-05-01';
const SEASON_END   = '2027-08-31';

// isWithinSeason
assert.strictEqual(isWithinSeason('2027-05-01', SEASON_START, SEASON_END), true,  'borne de début incluse');
assert.strictEqual(isWithinSeason('2027-08-31', SEASON_START, SEASON_END), true,  'borne de fin incluse');
assert.strictEqual(isWithinSeason('2027-07-01', SEASON_START, SEASON_END), true);
assert.strictEqual(isWithinSeason('2027-09-01', SEASON_START, SEASON_END), false, 'lendemain de fermeture exclu');
assert.strictEqual(isWithinSeason('2027-04-30', SEASON_START, SEASON_END), false);
assert.strictEqual(isWithinSeason('', SEASON_START, SEASON_END), false);
assert.strictEqual(isWithinSeason(null, SEASON_START, SEASON_END), false);

// clampToSeasonEnd
assert.strictEqual(clampToSeasonEnd('2027-09-10', SEASON_END), '2027-08-31', 'date au-delà ramenée à la fin de saison');
assert.strictEqual(clampToSeasonEnd('2027-08-31', SEASON_END), '2027-08-31', 'fin de saison inchangée');
assert.strictEqual(clampToSeasonEnd('2027-07-15', SEASON_END), '2027-07-15', 'date en saison inchangée');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/test-slots.js`
Expected: FAIL — ex. `AssertionError` sur `isWithinSeason('2027-05-01', SEASON_START, SEASON_END)` : la fonction actuelle (1 seul paramètre) ignore les 2e/3e arguments et compare `'2027-05-01'` à ses propres constantes internes `2026-06-12`/`2026-09-15` (toujours en dur à ce stade) → retourne `false` au lieu de `true` attendu. C'est le signal attendu avant de passer à l'implémentation.

- [ ] **Step 3: Implement**

Remplacer le contenu complet de `js/slots.js` par :

```js
'use strict';

const SLOTS = [
  { id: 1, label: '8h30 – 10h15',  start: '08:30', end: '10:15' },
  { id: 2, label: '10h30 – 12h15', start: '10:30', end: '12:15' },
  { id: 3, label: '12h30 – 14h15', start: '12:30', end: '14:15' },
  { id: 4, label: '14h30 – 16h15', start: '14:30', end: '16:15' },
  { id: 5, label: '16h30 – 18h15', start: '16:30', end: '18:15' },
];

// Les dates d'ouverture/fermeture de la plage vivent en base
// (app_config.saison_debut/saison_fin, lues via getSaisonDates() dans
// js/supabase-config.js) — plus de constante figée ici. Ces deux fonctions
// restent pures : les bornes sont passées en paramètres.

// true si la date ISO est comprise dans la période d'ouverture (bornes incluses)
function isWithinSeason(iso, seasonStart, seasonEnd) {
  return !!iso && iso >= seasonStart && iso <= seasonEnd;
}

// Ramène une date ISO à la fin de saison si elle la dépasse (sinon inchangée)
function clampToSeasonEnd(iso, seasonEnd) {
  return iso > seasonEnd ? seasonEnd : iso;
}

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Retourne 'past' | 'active' | 'upcoming'
function getSlotStatus(slot, date) {
  const d = date || new Date();
  const now = d.getHours() * 60 + d.getMinutes();
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

// Minutes écoulées depuis le début du créneau (peut être négatif si avant le début)
function minutesSinceSlotStart(slotId) {
  const slot = getSlotById(slotId);
  if (!slot) return 0;
  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  return currentMin - timeToMinutes(slot.start);
}

function isLastSlot(slotId) {
  return slotId >= SLOTS[SLOTS.length - 1].id;
}

if (typeof module !== 'undefined') {
  module.exports = { SLOTS, isWithinSeason, clampToSeasonEnd, timeToMinutes, getSlotStatus, getActiveSlot, getSlotById, minutesSinceSlotStart, isLastSlot };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/test-slots.js`
Expected: `✓ slots.js — tous les tests passent`

- [ ] **Step 5: Run the full suite**

Run: `node tests/run-all.js`
Expected: FAIL à ce stade — `js/usager-storage.js` et `js/usager-reserver.js` référencent encore `SEASON_END`/`clampToSeasonEnd(iso)` à l'ancien format. C'est attendu : ces fichiers sont corrigés dans les Tasks 4-5. Si `tests/run-all.js` échoue ailleurs (un fichier non lié à SEASON_END/SEASON_START), s'arrêter et investiguer avant de continuer.

Vérifier spécifiquement que `node tests/test-slots.js` seul passe (Step 4) — c'est le critère de succès de CETTE tâche. Le reste de la suite redeviendra vert au fil des tâches suivantes.

- [ ] **Step 6: Commit**

```bash
git add js/slots.js tests/test-slots.js
git commit -m "refactor(slots): SEASON_START/SEASON_END en paramètres plutôt qu'en constantes figées"
```

---

### Task 4: `js/usager-storage.js` — `createUserReservation` utilise `getSaisonDates()`

**Files:**
- Modify: `js/usager-storage.js`

- [ ] **Step 1: Remplacer la vérification de fermeture saisonnière**

Dans `js/usager-storage.js`, dans `createUserReservation`, remplacer :

```js
  // Fermeture saisonnière : aucune réservation au-delà du 15 septembre
  if (typeof SEASON_END !== 'undefined' && dateISO > SEASON_END) {
    throw new Error('La Handiplage est fermée pour la saison — aucune réservation possible après le 15 septembre.');
  }
```

par :

```js
  // Fermeture saisonnière : aucune réservation au-delà de la fin de saison
  var saisonDates = await getSaisonDates();
  if (dateISO > saisonDates.fin) {
    var finLabel = new Date(saisonDates.fin + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    throw new Error('La Handiplage est fermée pour la saison — aucune réservation possible après le ' + finLabel + '.');
  }
```

Ne rien changer d'autre dans cette fonction (les vérifications `passActif`, `isDemo`, le garde de renouvellement, le blocage absences, les limites journalière/mensuelle, et l'insert final restent identiques).

- [ ] **Step 2: Vérification statique**

`getSaisonDates` est une fonction globale (définie dans `js/supabase-config.js`, chargée avant `js/usager-storage.js` dans `usager.html` — vérifier l'ordre des balises `<script>` si un doute existe).

- [ ] **Step 3: Run the full suite (sanity check)**

Run: `node tests/run-all.js`
Expected: `✅ Tous les tests passent.` (plus d'échec lié à ce fichier — `createUserReservation` n'a pas de test dédié de toute façon, donc rien de nouveau à vérifier ici, mais la suite ne doit plus échouer ailleurs à cause de ce fichier)

- [ ] **Step 4: Commit**

```bash
git add js/usager-storage.js
git commit -m "feat(usager): createUserReservation utilise getSaisonDates()"
```

---

### Task 5: `js/usager-reserver.js` — écran "Saison terminée" + disponibilités via `getSaisonDates()`

**Files:**
- Modify: `js/usager-reserver.js`

- [ ] **Step 1: Remplacer les 3 usages de `SEASON_END`/`clampToSeasonEnd`**

Dans `js/usager-reserver.js`, dans `renderReserver`, remplacer :

```js
    var todayISO = _localTodayISO();
    // Saison terminée : plus aucune réservation possible au-delà de la fermeture de la plage
    if (todayISO > SEASON_END) {
      container.innerHTML = '<button class="usager-back" id="back-accueil">← Accueil</button>'
        + '<div class="usager-absence-block">'
        +   '<div class="usager-absence-icon">🏖️</div>'
        +   '<div class="usager-absence-title">Saison terminée</div>'
        +   '<div class="usager-absence-body">'
        +     '<p>La Handiplage a fermé pour la saison le <strong>15 septembre</strong>.</p>'
        +     '<p>Les réservations en ligne rouvriront à la prochaine saison estivale.</p>'
        +   '</div>'
        + '</div>';
      container.querySelector('#back-accueil').addEventListener('click', function() { showView('accueil'); });
      return;
    }
```

par :

```js
    var todayISO = _localTodayISO();
    var saisonDates = await getSaisonDates();
    // Saison terminée : plus aucune réservation possible au-delà de la fermeture de la plage
    if (todayISO > saisonDates.fin) {
      var finLabel = new Date(saisonDates.fin + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
      container.innerHTML = '<button class="usager-back" id="back-accueil">← Accueil</button>'
        + '<div class="usager-absence-block">'
        +   '<div class="usager-absence-icon">🏖️</div>'
        +   '<div class="usager-absence-title">Saison terminée</div>'
        +   '<div class="usager-absence-body">'
        +     '<p>La Handiplage a fermé pour la saison le <strong>' + finLabel + '</strong>.</p>'
        +     '<p>Les réservations en ligne rouvriront à la prochaine saison estivale.</p>'
        +   '</div>'
        + '</div>';
      container.querySelector('#back-accueil').addEventListener('click', function() { showView('accueil'); });
      return;
    }
```

Puis remplacer :

```js
    // Ne jamais proposer de créneau après la fermeture de la plage (15 sept.)
    toISO = clampToSeasonEnd(toISO);

    var days = await getAvailableDays(fromISO, toISO, inscription.id);
    // Éliminer les jours passés ou hors saison (sécurité si l'API en renvoie)
    var dateKeys = Object.keys(days).sort().filter(function(d) { return d >= fromISO && d <= SEASON_END; });
```

par :

```js
    // Ne jamais proposer de créneau après la fermeture de la plage
    toISO = clampToSeasonEnd(toISO, saisonDates.fin);

    var days = await getAvailableDays(fromISO, toISO, inscription.id);
    // Éliminer les jours passés ou hors saison (sécurité si l'API en renvoie)
    var dateKeys = Object.keys(days).sort().filter(function(d) { return d >= fromISO && d <= saisonDates.fin; });
```

Ne rien changer d'autre (le garde pass inactif en haut de fonction, le blocage absences, `_renderReserverContent`, etc.).

- [ ] **Step 2: Run the full suite (sanity check)**

Run: `node tests/run-all.js`
Expected: `✅ Tous les tests passent.`

- [ ] **Step 3: Commit**

```bash
git add js/usager-reserver.js
git commit -m "feat(usager): renderReserver utilise getSaisonDates()"
```

---

### Task 6: `js/usager-accueil.js` — `getSaisonDates()`

**Files:**
- Modify: `js/usager-accueil.js`

- [ ] **Step 1: Remplacer les usages de `SEASON_END`**

Dans `js/usager-accueil.js`, remplacer :

```js
    var balance = computePassBalance(resas, PASS_QUOTA);
    var seasonOver = typeof SEASON_END !== 'undefined' && today > SEASON_END;
```

par :

```js
    var balance = computePassBalance(resas, PASS_QUOTA);
    var saisonDates = await getSaisonDates();
    var seasonOver = today > saisonDates.fin;
```

Puis remplacer :

```js
      var seasonYear  = (typeof SEASON_END !== 'undefined' ? SEASON_END : today).slice(0, 4);
```

par :

```js
      var seasonYear  = saisonDates.fin.slice(0, 4);
```

Ne rien changer d'autre dans ce fichier.

- [ ] **Step 2: Run the full suite (sanity check)**

Run: `node tests/run-all.js`
Expected: `✅ Tous les tests passent.`

- [ ] **Step 3: Commit**

```bash
git add js/usager-accueil.js
git commit -m "feat(usager): accueil utilise getSaisonDates()"
```

---

### Task 7: `js/usager-reservations.js` — `getSaisonDates()`

**Files:**
- Modify: `js/usager-reservations.js`

- [ ] **Step 1: Remplacer les usages de `SEASON_END`**

Dans `js/usager-reservations.js`, remplacer :

```js
    var seasonOver = typeof SEASON_END !== 'undefined' && todayISO > SEASON_END;

    var passHtml = '';
    if (seasonOver) {
      var seasonCount = resas.filter(function(r) { return r.statut !== 'annule'; }).length;
      var seasonYear  = (typeof SEASON_END !== 'undefined' ? SEASON_END : todayISO).slice(0, 4);
```

par :

```js
    var saisonDates = await getSaisonDates();
    var seasonOver = todayISO > saisonDates.fin;

    var passHtml = '';
    if (seasonOver) {
      var seasonCount = resas.filter(function(r) { return r.statut !== 'annule'; }).length;
      var seasonYear  = saisonDates.fin.slice(0, 4);
```

Ne rien changer d'autre dans ce fichier.

- [ ] **Step 2: Run the full suite (sanity check)**

Run: `node tests/run-all.js`
Expected: `✅ Tous les tests passent.`

- [ ] **Step 3: Commit**

```bash
git add js/usager-reservations.js
git commit -m "feat(usager): vue réservations utilise getSaisonDates()"
```

---

### Task 8: `js/modal.js` — modale "Ouvrir la saison"

**Files:**
- Modify: `js/modal.js`

Pas de tests : fichier DOM/modales, aucune infra de test existante.

- [ ] **Step 1: Ajouter la nouvelle modale**

Dans `js/modal.js`, juste avant la ligne `if (typeof module !== 'undefined') {` (la toute dernière section du fichier, juste avant le bloc `module.exports`), ajouter :

```js
// ── Modale : Ouvrir une nouvelle saison ──
// onConfirm({ debut, fin }) — dates ISO (YYYY-MM-DD)
function openOpenSeasonModal(saisonCourante, saisonDates, onConfirm) {
  _dialog().innerHTML = `
    <div class="modal-header">
      <h3>Ouvrir la saison ${saisonCourante + 1}</h3>
      <button class="modal-close" id="modal-close">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label>Date de début</label>
          <input type="date" id="f-saison-debut" value="${saisonDates.debut || ''}">
        </div>
        <div class="form-group">
          <label>Date de fin</label>
          <input type="date" id="f-saison-fin" value="${saisonDates.fin || ''}">
        </div>
      </div>
      <p class="modal-hint">Tous les comptes usagers validés pour la saison ${saisonCourante} devront renouveler leur inscription pour continuer à réserver.</p>
      <div id="season-dates-error" style="display:none;color:var(--red);font-size:13px;margin-top:6px"></div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="modal-cancel">Annuler</button>
      <button class="btn-primary"   id="modal-confirm">Confirmer</button>
    </div>
  `;

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  document.getElementById('modal-confirm').addEventListener('click', function() {
    const debut = document.getElementById('f-saison-debut').value;
    const fin   = document.getElementById('f-saison-fin').value;
    const errEl = document.getElementById('season-dates-error');
    if (!debut || !fin) {
      errEl.textContent = 'Les deux dates sont obligatoires.';
      errEl.style.display = 'block';
      return;
    }
    if (debut >= fin) {
      errEl.textContent = 'La date de début doit être avant la date de fin.';
      errEl.style.display = 'block';
      return;
    }
    closeModal();
    onConfirm({ debut: debut, fin: fin });
  });

  _dialog().showModal();
}

```

- [ ] **Step 2: Ajouter l'export**

Toujours dans `js/modal.js`, remplacer la dernière ligne :

```js
  module.exports = { openAddReservationModal, openAssignSpotModal, openCheckinModal, openWalkinEntryModal, openPlacementPickerModal, openSpotDetailModal, openDepartedModal, openWaitingDetailModal, openSlotPlanningModal, openGroupCheckinModal, closeModal };
```

par :

```js
  module.exports = { openAddReservationModal, openAssignSpotModal, openCheckinModal, openWalkinEntryModal, openPlacementPickerModal, openSpotDetailModal, openDepartedModal, openWaitingDetailModal, openSlotPlanningModal, openGroupCheckinModal, openOpenSeasonModal, closeModal };
```

- [ ] **Step 3: Run the full suite (sanity check)**

Run: `node tests/run-all.js`
Expected: `✅ Tous les tests passent.`

- [ ] **Step 4: Commit**

```bash
git add js/modal.js
git commit -m "feat(staff): modale openOpenSeasonModal (dates de début/fin de saison)"
```

---

### Task 9: `js/inscription.js` — brancher la modale sur "Ouvrir la saison"

**Files:**
- Modify: `js/inscription.js`

- [ ] **Step 1: Récupérer aussi les dates de saison**

Dans `js/inscription.js`, dans `renderInscription`, remplacer :

```js
async function renderInscription(container, selectedId) {
  const [inscriptions, saisonCourante] = await Promise.all([getInscriptions(), getSaisonCourante()]);
```

par :

```js
async function renderInscription(container, selectedId) {
  const [inscriptions, saisonCourante, saisonDates] = await Promise.all([getInscriptions(), getSaisonCourante(), getSaisonDates()]);
```

- [ ] **Step 2: Remplacer le `confirm()` par la modale**

Toujours dans `renderInscription`, remplacer :

```js
  document.getElementById('insc-open-season-btn').addEventListener('click', async function() {
    if (!confirm('Ouvrir la saison ' + (saisonCourante + 1) + ' ?\n\nTous les comptes usagers validés pour la saison ' + saisonCourante + ' devront renouveler leur inscription pour continuer à réserver.')) return;
    await ouvrirNouvelleSaison();
    await renderInscription(container, selectedId);
  });
```

par :

```js
  document.getElementById('insc-open-season-btn').addEventListener('click', function() {
    openOpenSeasonModal(saisonCourante, saisonDates, async function(dates) {
      await ouvrirNouvelleSaison(dates.debut, dates.fin);
      await renderInscription(container, selectedId);
    });
  });
```

Ne rien changer d'autre dans cette fonction (le reste du rendu de la sidebar, la recherche, le bouton "Nouvelle inscription", `_bindListItems`, etc.).

- [ ] **Step 3: Run the full suite (sanity check)**

Run: `node tests/run-all.js`
Expected: `✅ Tous les tests passent.`

- [ ] **Step 4: Commit**

```bash
git add js/inscription.js
git commit -m "feat(staff): bouton Ouvrir la saison demande les nouvelles dates via modale"
```

---

### Task 10: Texte dynamique côté usager (`usager.html` + `js/usager-app.js`)

**Files:**
- Modify: `usager.html`
- Modify: `js/usager-app.js`

- [ ] **Step 1: Donner un id au `<span>` des dates**

Dans `usager.html`, remplacer :

```html
        <div class="usager-sidebar-info">
          <div class="usager-sidebar-info-icon"><img src="icone%20r%C3%A9server.svg" alt=""></div>
          <span>12 juin – 15 sept. 2026</span>
        </div>
```

par :

```html
        <div class="usager-sidebar-info">
          <div class="usager-sidebar-info-icon"><img src="icone%20r%C3%A9server.svg" alt=""></div>
          <span id="usager-sidebar-season">12 juin – 15 sept. 2026</span>
        </div>
```

Le texte actuel reste en dur dans le HTML comme repli visuel (affiché tant que le JS n'a pas répondu, ou s'il échoue).

- [ ] **Step 2: Mettre à jour le texte au chargement**

Dans `js/usager-app.js`, remplacer :

```js
    var saisonCourante;
    try {
      var results = await Promise.all([getUserInscription(), getSaisonCourante()]);
      _inscription = results[0];
      _inscription.isDemo = (_inscription.mail === DEMO_EMAIL);
      saisonCourante = results[1];
    } catch (e) {
      container.innerHTML = '<div class="usager-error" style="margin:20px">Impossible de charger votre profil : ' + (e.message || e) + '<br>Veuillez vous reconnecter.</div>';
      return;
    }
```

par :

```js
    var saisonCourante;
    try {
      var results = await Promise.all([getUserInscription(), getSaisonCourante()]);
      _inscription = results[0];
      _inscription.isDemo = (_inscription.mail === DEMO_EMAIL);
      saisonCourante = results[1];
    } catch (e) {
      container.innerHTML = '<div class="usager-error" style="margin:20px">Impossible de charger votre profil : ' + (e.message || e) + '<br>Veuillez vous reconnecter.</div>';
      return;
    }

    // Amélioration progressive : le texte en dur dans le HTML reste affiché
    // si cette requête échoue ou n'a pas encore répondu — pas critique.
    getSaisonDates().then(function(dates) {
      var seasonEl = document.getElementById('usager-sidebar-season');
      if (!seasonEl || !dates.debut || !dates.fin) return;
      var debutLabel = new Date(dates.debut + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
      var finLabel   = new Date(dates.fin   + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
      seasonEl.textContent = debutLabel + ' – ' + finLabel;
    }).catch(function() { /* repli : texte en dur déjà affiché */ });
```

- [ ] **Step 2b: Vérification statique**

`getSaisonDates` est globale (`js/supabase-config.js`), déjà chargée avant `js/usager-app.js` dans `usager.html` (confirmé à la Task 4). Pas de nouvelle balise `<script>` nécessaire dans ce fichier.

- [ ] **Step 3: Run the full suite (sanity check)**

Run: `node tests/run-all.js`
Expected: `✅ Tous les tests passent.`

- [ ] **Step 4: Commit**

```bash
git add usager.html js/usager-app.js
git commit -m "feat(usager): dates de saison dynamiques dans la barre latérale"
```

---

### Task 11: Texte dynamique côté inscription publique

**Files:**
- Modify: `inscription-publique.html`
- Modify: `js/inscription-publique.js`

- [ ] **Step 1: Charger `supabase-config.js` et donner un id au `<span>`**

Dans `inscription-publique.html`, remplacer la balise script :

```html
<script src="js/env.js"></script>
<script src="js/supabase-client.js"></script>
<script src="js/inscription-publique.js"></script>
```

par :

```html
<script src="js/env.js"></script>
<script src="js/supabase-client.js"></script>
<script src="js/supabase-config.js"></script>
<script src="js/inscription-publique.js"></script>
```

Puis remplacer :

```html
      <div class="pub-sidebar-info">
        <div class="pub-sidebar-info-icon"><img src="icone%20r%C3%A9server.svg" alt=""></div>
        <span>12 juin – 15 sept. 2026</span>
      </div>
```

par :

```html
      <div class="pub-sidebar-info">
        <div class="pub-sidebar-info-icon"><img src="icone%20r%C3%A9server.svg" alt=""></div>
        <span id="pub-sidebar-season">12 juin – 15 sept. 2026</span>
      </div>
```

- [ ] **Step 2: Ajouter l'appel au chargement**

Dans `js/inscription-publique.js`, juste avant la ligne `if (typeof module !== 'undefined') {` (toute dernière section du fichier), ajouter :

```js
// Amélioration progressive : le texte en dur dans le HTML reste affiché si
// cette requête échoue (page publique, pas de session utilisateur).
if (typeof getSaisonDates === 'function') {
  getSaisonDates().then(function(dates) {
    var seasonEl = document.getElementById('pub-sidebar-season');
    if (!seasonEl || !dates.debut || !dates.fin) return;
    var debutLabel = new Date(dates.debut + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    var finLabel   = new Date(dates.fin   + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    seasonEl.textContent = debutLabel + ' – ' + finLabel;
  }).catch(function() { /* repli : texte en dur déjà affiché */ });
}

```

Le garde `typeof getSaisonDates === 'function'` est nécessaire ici (contrairement à `usager-app.js`) car ce fichier n'est pas structuré en une seule fonction `init()` async — ce bloc s'exécute au chargement du script, potentiellement avant que tout soit garanti prêt dans d'autres contextes de test.

- [ ] **Step 3: Run the full suite (sanity check)**

Run: `node tests/run-all.js`
Expected: `✅ Tous les tests passent.`

- [ ] **Step 4: Commit**

```bash
git add inscription-publique.html js/inscription-publique.js
git commit -m "feat(inscription-publique): dates de saison dynamiques dans la barre latérale"
```

---

### Task 12: Vérification finale

**Files:** aucun (vérification uniquement)

- [ ] **Step 1: Run the full test suite one last time**

Run: `node tests/run-all.js`
Expected: `✅ Tous les tests passent.`

- [ ] **Step 2: Confirmer que le bloc SQL de la Task 1 Step 3 a été appliqué en base**

Rien de ce qui précède ne fonctionne contre le projet Supabase live sans ça — `getSaisonDates()` échouera (colonnes inexistantes), la page d'inscription publique ne pourra pas lire `app_config` (policy encore restreinte à `authenticated`).

- [ ] **Step 3: Smoke test manuel**

Pas d'environnement navigateur disponible dans ce plan — à vérifier par l'utilisateur, ou par l'agent si un accès est disponible :
1. Onglet Inscriptions (staff) → cliquer "Ouvrir la saison" → confirmer que la modale affiche les dates actuelles pré-remplies, qu'elle refuse une date de fin avant la date de début, et qu'après confirmation le bouton affiche la nouvelle saison et le bandeau "Saison en cours" se met à jour.
2. `usager.html`, usager connecté : confirmer que la barre latérale affiche les dates à jour (rafraîchir après l'étape 1 pour voir le changement).
3. `inscription-publique.html` (navigation privée, non connecté) : confirmer que la barre latérale affiche aussi les dates à jour.
4. Avec une date du jour artificiellement après `saison_fin` (ou en attendant la vraie fin de saison), confirmer que l'écran "Saison terminée" de `renderReserver` affiche la bonne date de fin, et que l'accueil/mes réservations affichent "Saison {année}" avec le bon nombre.

- [ ] **Step 4: Ne pas pousser**

Comme pour le reste du projet, les changements sont commités localement mais **pas poussés** avant une demande explicite.

---

## Hors périmètre (per spec)

- Validation d'un chevauchement entre l'ancienne et la nouvelle saison.
- Historique des saisons passées.
- Le texte "Demande d'inscription 2026" dans l'en-tête de `inscription-publique.html` (hors périmètre, concept différent de `saison_debut`/`saison_fin`).
