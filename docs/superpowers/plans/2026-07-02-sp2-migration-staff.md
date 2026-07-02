# SP2 — Migration interface staff : localStorage → Supabase

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer toute la couche localStorage de l'interface staff par des appels Supabase JS SDK, avec sync Realtime entre tablettes.

**Architecture:** Trois nouveaux modules async (`supabase-storage.js`, `supabase-inscriptions.js`, `supabase-mc.js`) remplacent les fonctions localStorage. Les callers (`app.js`, `inscription.js`, `mc.js`, `planning.js`, `modal.js`, `panel.js`, `pass.js`) sont adaptés pour async/await et UUIDs. Aucune modification UI.

**Tech Stack:** Supabase JS SDK v2 (CDN), vanilla JS ES6, `supabaseClient` global défini dans `js/supabase-client.js`, `'use strict'` dans tous les fichiers.

---

## Contexte codebase

| Fichier | Rôle actuel |
|---|---|
| `js/storage.js` | Fonctions localStorage sync : `getReservations`, `saveCheckin`, `updateStatus`, `updateSpotField`, `clearSlot`, `getReservationList`, `addReservation`, `removeReservation`, `updateReservationStatus`, `updateReservationField`, `getTodayISO` |
| `js/inscription.js` | Contient `getInscriptions()` / `saveInscriptions()` localStorage + tout le rendu UI inscription (539 lignes) |
| `js/mc.js` | Contient `getMcData()` / `saveMcData()` / `getMcDates()` localStorage + tout le rendu UI MC (297 lignes) |
| `js/app.js` | IIFE `App`. `refresh()` sync appelle `getReservations` + `getReservationList`. Callbacks utilisent indices tableau pour liste d'attente |
| `js/planning.js` | `renderPlanning()` appelle `getReservationList` + `getReservations` pour 35 cellules (7j × 5 créneaux) |
| `js/panel.js` | `renderPanel()` : callbacks `onPasVenu(index)`, `onAnnule(index)`, `onWaitingClick(index)` basés sur indices |
| `js/modal.js` | `openSlotPlanningModal` a des fonctions internes `_refreshSection`/`_refreshWalkins` qui appellent storage sync |
| `js/pass.js` | `getPassRemaining(inscriptionId)` scanne localStorage — doit utiliser un cache |

## Schéma Supabase requis

Le schéma Supabase (schema.sql SP1) manque trois colonnes. **À ajouter manuellement dans le SQL Editor Supabase avant de commencer :**

```sql
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS depart_time timestamptz;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS resa_type text NOT NULL DEFAULT 'normal'
  CHECK (resa_type IN ('normal', 'groupe'));
```

## Mapping statuts

| Local | Supabase |
|---|---|
| `'present'` | `'present'` |
| `'departed'` | `'parti'` |
| `'absent'` | `'absent'` |
| `'pas_venu'` | `'absent'` |
| `'annule'` | `'annule'` |
| spot absent (pas de ligne) | — |

## Nouveaux fichiers créés

- `js/supabase-inscriptions.js` — CRUD async inscriptions
- `js/supabase-mc.js` — async main courante
- `js/supabase-storage.js` — async réservations + bulk counts + pass counts
- `tests/test-supabase-inscriptions.js` — tests des fonctions de transformation
- `tests/test-supabase-mc.js` — tests de l'assemblage MC
- `tests/test-supabase-storage.js` — tests du mapping lignes→objets locaux

## Fichiers modifiés

- `js/inscription.js` — supprimer getInscriptions/saveInscriptions localStorage, rendre async, ajouter invitation
- `js/mc.js` — rendre tous les handlers async, supprimer getMcData/saveMcData localStorage
- `js/pass.js` — utiliser cache inscriptions + cache pass counts
- `js/planning.js` — renderPlanning async via bulk query, exportSlotPDF async
- `js/panel.js` — callbacks UUID au lieu d'indices
- `js/app.js` — refresh async, UUID waiting list, _buildProfileHistory async, ajout subscriptions
- `js/modal.js` — openSlotPlanningModal avec fonctions internes async, UUID boutons suppression
- `index.html` — ajouter 3 nouveaux scripts, supprimer storage.js, ajouter requireStaffAuth
- `tests/run-all.js` — inclure les 3 nouveaux fichiers de test

## Fichiers supprimés

- `js/storage.js` (à la fin, tâche 11)

---

## Pré-requis manuel : Extension schéma Supabase

**Avant de commencer toute tâche de code :** ouvrir le SQL Editor dans le dashboard Supabase (projet `xriecamtpxpjicvbcpxw`) et exécuter :

```sql
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS depart_time timestamptz;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS resa_type text NOT NULL DEFAULT 'normal'
  CHECK (resa_type IN ('normal', 'groupe'));
```

Vérifier "Success" dans le SQL Editor avant de continuer.

---

## Task 1 : `js/supabase-inscriptions.js` + tests

**Files:**
- Create: `js/supabase-inscriptions.js`
- Create: `tests/test-supabase-inscriptions.js`
- Modify: `tests/run-all.js`

### Contexte

`inscription.js` stocke actuellement les inscriptions dans localStorage via `getInscriptions()` / `saveInscriptions(list)`. Ces fonctions vont être **supprimées** d'inscription.js et remplacées par des fonctions globales async définies ici.

La structure d'une inscription localStorage :
```js
{
  id, createdAt, updatedAt, statut, nom, prenom,
  dateNaissance: { jour, mois, annee }, telephone, mail, mailConfirm,
  contactPreference, adresse, codePostal, ville, pays,
  urgenceNom, urgenceTel, accompagnement, aidesTechniques,
  gilet, rgpd, ccasCommunications, reglement, signature,
  justificatif1, justificatif1Name, justificatif2, justificatif2Name,
  pass: { actif, activatedAt }
}
```

La table Supabase `inscriptions` a : `id, user_id, nom, prenom, mail, telephone, statut, pass_actif, pass_activated_at, metadata, created_at, updated_at`.

Stratégie : colonnes structurées pour les champs indexés, `metadata jsonb` pour tout le reste.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/test-supabase-inscriptions.js` :

```js
'use strict';
const assert = require('assert');

// _rowToInscription et _inscriptionToRow sont exportées uniquement pour les tests
// On les importe via require en contournant le guard window

// Simuler l'absence de window pour le require
global.window = undefined;
// Charger le module avec require (les fonctions Supabase ne seront pas testées)
// On exporte les fonctions pures séparément via module.exports
const { _rowToInscription, _inscriptionToRow } = require('../js/supabase-inscriptions.js');

// _rowToInscription : ligne Supabase → objet local
const row = {
  id:                 'uuid-abc',
  nom:                'DUPONT',
  prenom:             'Marie',
  mail:               'marie@example.com',
  telephone:          '0600000001',
  statut:             'valide',
  pass_actif:         true,
  pass_activated_at:  '2026-07-01',
  created_at:         '2026-07-01T10:00:00Z',
  updated_at:         '2026-07-01T11:00:00Z',
  user_id:            null,
  metadata: {
    dateNaissance: { jour: '01', mois: '01', annee: '1980' },
    adresse: '12 rue de la Plage',
    codePostal: '06600',
    ville: 'Antibes',
    pays: 'France',
  },
};

const insc = _rowToInscription(row);
assert.strictEqual(insc.id, 'uuid-abc');
assert.strictEqual(insc.nom, 'DUPONT');
assert.strictEqual(insc.mail, 'marie@example.com');
assert.strictEqual(insc.statut, 'valide');
assert.strictEqual(insc.createdAt, '2026-07-01T10:00:00Z');
assert.strictEqual(insc.updatedAt, '2026-07-01T11:00:00Z');
// pass doit être reconstruit comme { actif, activatedAt }
assert.deepStrictEqual(insc.pass, { actif: true, activatedAt: '2026-07-01' });
// champs metadata propagés
assert.strictEqual(insc.adresse, '12 rue de la Plage');
assert.strictEqual(insc.ville, 'Antibes');

// Sans pass
const rowNoPas = { ...row, pass_actif: false, pass_activated_at: null };
const inscNoPas = _rowToInscription(rowNoPas);
assert.strictEqual(inscNoPas.pass, null);

// _inscriptionToRow : objet local → colonnes Supabase + metadata
const data = {
  id: 'uuid-abc',
  nom: 'DUPONT',
  prenom: 'Marie',
  mail: 'marie@example.com',
  telephone: '0600000001',
  statut: 'valide',
  createdAt: '2026-07-01T10:00:00Z',
  updatedAt: '2026-07-01T11:00:00Z',
  pass: { actif: true, activatedAt: '2026-07-01' },
  adresse: '12 rue de la Plage',
  dateNaissance: { jour: '01', mois: '01', annee: '1980' },
};
const toRow = _inscriptionToRow(data);
assert.strictEqual(toRow.nom, 'DUPONT');
assert.strictEqual(toRow.mail, 'marie@example.com');
assert.strictEqual(toRow.pass_actif, true);
assert.strictEqual(toRow.pass_activated_at, '2026-07-01');
// id, created_at ne doivent PAS être dans le row (Supabase les gère)
assert.strictEqual(toRow.id, undefined);
assert.strictEqual(toRow.createdAt, undefined);
// metadata contient les champs supplémentaires
assert.strictEqual(toRow.metadata.adresse, '12 rue de la Plage');
assert.deepStrictEqual(toRow.metadata.dateNaissance, { jour: '01', mois: '01', annee: '1980' });
// les colonnes structurées ne doivent PAS être dans metadata
assert.strictEqual(toRow.metadata.nom, undefined);
assert.strictEqual(toRow.metadata.statut, undefined);

console.log('✓ test-supabase-inscriptions.js OK');
```

- [ ] **Step 2 : Vérifier que le test échoue**

```
node tests/test-supabase-inscriptions.js
```
Attendu : `Cannot find module '../js/supabase-inscriptions.js'`

- [ ] **Step 3 : Créer `js/supabase-inscriptions.js`**

```js
'use strict';

// Cache local — peuplé par getInscriptions(), lu par getCachedInscriptions()
var _inscriptionsCache = null;

// Colonnes structurées (indexées en DB)
var _STRUCTURED_COLS = ['id', 'user_id', 'nom', 'prenom', 'mail', 'telephone',
  'statut', 'pass_actif', 'pass_activated_at', 'created_at', 'updated_at'];

function _rowToInscription(row) {
  var meta = row.metadata || {};
  var insc = Object.assign({}, meta, {
    id:        row.id,
    nom:       row.nom,
    prenom:    row.prenom,
    mail:      row.mail,
    telephone: row.telephone,
    statut:    row.statut,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pass: row.pass_actif ? { actif: true, activatedAt: row.pass_activated_at || null } : null,
  });
  return insc;
}

function _inscriptionToRow(data) {
  var structured = _STRUCTURED_COLS.concat(['pass', 'createdAt', 'updatedAt']);
  var metadata = {};
  Object.keys(data).forEach(function(k) {
    if (structured.indexOf(k) === -1) metadata[k] = data[k];
  });
  return {
    nom:               data.nom || '',
    prenom:            data.prenom || '',
    mail:              data.mail || null,
    telephone:         data.telephone || null,
    statut:            data.statut || 'en_attente',
    pass_actif:        !!(data.pass && data.pass.actif),
    pass_activated_at: (data.pass && data.pass.activatedAt) || null,
    updated_at:        new Date().toISOString(),
    metadata:          metadata,
  };
}

async function getInscriptions() {
  var result = await supabaseClient.from('inscriptions').select('*').order('nom');
  if (result.error) throw result.error;
  _inscriptionsCache = (result.data || []).map(_rowToInscription);
  return _inscriptionsCache;
}

function getCachedInscriptions() {
  return _inscriptionsCache || [];
}

async function getInscriptionById(id) {
  var result = await supabaseClient.from('inscriptions').select('*').eq('id', id).single();
  if (result.error) throw result.error;
  return _rowToInscription(result.data);
}

async function createInscription(data) {
  var row = _inscriptionToRow(data);
  row.created_at = new Date().toISOString();
  var result = await supabaseClient.from('inscriptions').insert(row).select().single();
  if (result.error) throw result.error;
  var insc = _rowToInscription(result.data);
  if (_inscriptionsCache) _inscriptionsCache.push(insc);
  return insc;
}

async function updateInscription(id, partial) {
  var row = {};
  // Mapper les champs connus
  if (partial.statut            !== undefined) row.statut            = partial.statut;
  if (partial.pass_actif        !== undefined) row.pass_actif        = partial.pass_actif;
  if (partial.pass_activated_at !== undefined) row.pass_activated_at = partial.pass_activated_at;
  if (partial.nom               !== undefined) row.nom               = partial.nom;
  if (partial.prenom            !== undefined) row.prenom            = partial.prenom;
  if (partial.mail              !== undefined) row.mail              = partial.mail;
  if (partial.telephone         !== undefined) row.telephone         = partial.telephone;
  if (partial.metadata          !== undefined) row.metadata          = partial.metadata;
  row.updated_at = new Date().toISOString();

  var result = await supabaseClient.from('inscriptions').update(row).eq('id', id).select().single();
  if (result.error) throw result.error;
  var updated = _rowToInscription(result.data);
  if (_inscriptionsCache) {
    var idx = _inscriptionsCache.findIndex(function(i) { return i.id === id; });
    if (idx !== -1) _inscriptionsCache[idx] = updated;
  }
  return updated;
}

async function deleteInscription(id) {
  var result = await supabaseClient.from('inscriptions').delete().eq('id', id);
  if (result.error) throw result.error;
  if (_inscriptionsCache) {
    _inscriptionsCache = _inscriptionsCache.filter(function(i) { return i.id !== id; });
  }
}

// Abonnement Realtime inscriptions
var _inscChannel = null;

function subscribeInscriptions(onUpdate) {
  if (_inscChannel) supabaseClient.removeChannel(_inscChannel);
  _inscChannel = supabaseClient.channel('inscriptions-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inscriptions' }, onUpdate)
    .subscribe();
}

function unsubscribeInscriptions() {
  if (_inscChannel) {
    supabaseClient.removeChannel(_inscChannel);
    _inscChannel = null;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { _rowToInscription, _inscriptionToRow, getInscriptions, getCachedInscriptions,
    getInscriptionById, createInscription, updateInscription, deleteInscription,
    subscribeInscriptions, unsubscribeInscriptions };
}
```

- [ ] **Step 4 : Vérifier que le test passe**

```
node tests/test-supabase-inscriptions.js
```
Attendu : `✓ test-supabase-inscriptions.js OK`

- [ ] **Step 5 : Ajouter à `tests/run-all.js`**

Ouvrir `tests/run-all.js`. Après la dernière ligne `require('./test-pass.js')` (ou équivalent), ajouter :
```js
require('./test-supabase-inscriptions.js');
```

Vérifier :
```
node tests/run-all.js
```
Attendu : `✅ Tous les tests passent`

- [ ] **Step 6 : Commit**

```bash
git add js/supabase-inscriptions.js tests/test-supabase-inscriptions.js tests/run-all.js
git commit -m "feat: supabase-inscriptions.js — async CRUD inscriptions + tests transformations"
```

---

## Task 2 : Adapter `js/inscription.js`

**Files:**
- Modify: `js/inscription.js`

### Contexte

`inscription.js` (539 lignes) contient deux parties :
1. **Stockage localStorage** (à supprimer) : `INSC_KEY`, `getInscriptions()`, `saveInscriptions()`, `_genId()`
2. **UI** (à garder, rendre async) : `renderInscription(container)`, `_handleSubmit()`, handlers statut, pass activation

Après cette tâche, `inscription.js` utilisera les fonctions globales de `supabase-inscriptions.js`.

**Mapping des opérations :**

| Avant | Après |
|---|---|
| `list = getInscriptions()` | `list = await getInscriptions()` |
| `saveInscriptions(list)` après mutation `list[idx].statut` | `await updateInscription(id, { statut })` |
| `saveInscriptions(list)` après activation pass | `await updateInscription(id, { pass_actif: true, pass_activated_at: now })` |
| `saveInscriptions([...list, newInsc])` dans `_handleSubmit` | `await createInscription(data)` |
| `saveInscriptions(list)` après suppression | `await deleteInscription(id)` |
| `_genId()` pour générer l'id | supprimé — Supabase génère l'UUID |
| `renderInscription(container)` sync | `async function renderInscription(container)` |

**Invitation automatique (nouveau) :** quand statut passe à `'valide'` et que `inscription.mail` est non vide :
```js
inviteUser(inscription.mail, inscription.id).catch(function() {});
// Afficher confirmation dans l'UI (non bloquant)
```

- [ ] **Step 1 : Supprimer les fonctions localStorage**

Dans `inscription.js`, supprimer :
- La constante `INSC_KEY = 'handiplage_inscriptions'`
- La fonction `function getInscriptions()` (qui lit localStorage)
- La fonction `function saveInscriptions(list)` (qui écrit localStorage)
- La fonction `function _genId()` (générateur d'ID local)

Supprimer également les références à `_genId()` dans `_handleSubmit` (l'id sera fourni par Supabase au retour de `createInscription`).

- [ ] **Step 2 : Rendre `renderInscription` async**

Changer la signature :
```js
// Avant
function renderInscription(container) {
  var list = getInscriptions();
  // ...
}

// Après
async function renderInscription(container) {
  var list = await getInscriptions();
  // ...
}
```

- [ ] **Step 3 : Rendre `_handleSubmit` async + utiliser `createInscription`**

Dans le handler de soumission du formulaire (qui construisait `inscData` puis appelait `saveInscriptions`), remplacer par :
```js
// Avant
var newInsc = Object.assign({}, inscData, { id: _genId(), createdAt: new Date().toISOString(), ... });
saveInscriptions(list.concat([newInsc]));

// Après
try {
  await createInscription(inscData);
  await renderInscription(container);
} catch (err) {
  // Afficher erreur à l'utilisateur
  var errEl = container.querySelector('.insc-form-error');
  if (errEl) errEl.textContent = 'Erreur lors de la sauvegarde : ' + (err.message || err);
}
```

- [ ] **Step 4 : Rendre les handlers de changement de statut async + invitation**

Localiser les event listeners qui modifient `list[idx].statut` et appellent `saveInscriptions`. Les remplacer par :

```js
// Avant
selectEl.addEventListener('change', function() {
  var list = getInscriptions();
  var idx = list.findIndex(function(i) { return i.id === inscId; });
  list[idx].statut = selectEl.value;
  saveInscriptions(list);
  _render();
});

// Après
selectEl.addEventListener('change', async function() {
  var newStatut = selectEl.value;
  await updateInscription(inscId, { statut: newStatut });
  if (newStatut === 'valide' && insc.mail) {
    inviteUser(insc.mail, inscId)
      .then(function() {
        // Afficher confirmation non-bloquante
        var msgEl = container.querySelector('.insc-invite-msg-' + inscId);
        if (msgEl) {
          msgEl.textContent = 'Email d\'invitation envoyé à ' + insc.mail;
          msgEl.style.display = 'block';
        }
      })
      .catch(function() {}); // Silencieux si déjà invité
  }
  await renderInscription(container);
});
```

Ajouter dans le HTML de chaque carte d'inscription un élément pour ce message :
```html
<div class="insc-invite-msg insc-invite-msg-${insc.id}" style="display:none;color:green;font-size:12px"></div>
```

- [ ] **Step 5 : Rendre les handlers d'activation de pass async**

```js
// Avant
document.getElementById('activate-pass').addEventListener('click', function() {
  var list = getInscriptions();
  var idx = list.findIndex(function(i) { return i.id === inscId; });
  list[idx].pass = { actif: true, activatedAt: new Date().toISOString() };
  saveInscriptions(list);
  renderInscription(container);
});

// Après
document.getElementById('activate-pass').addEventListener('click', async function() {
  await updateInscription(inscId, {
    pass_actif: true,
    pass_activated_at: new Date().toISOString(),
  });
  await renderInscription(container);
});
```

- [ ] **Step 6 : Rendre les handlers de suppression async**

```js
// Avant
deleteBtn.addEventListener('click', function() {
  if (!confirm('Supprimer cette inscription ?')) return;
  var list = getInscriptions();
  saveInscriptions(list.filter(function(i) { return i.id !== inscId; }));
  renderInscription(container);
});

// Après
deleteBtn.addEventListener('click', async function() {
  if (!confirm('Supprimer cette inscription ?')) return;
  await deleteInscription(inscId);
  await renderInscription(container);
});
```

- [ ] **Step 7 : Mettre à jour l'export module**

En bas de `inscription.js`, s'assurer que `module.exports` reste cohérent (si présent) :
```js
if (typeof module !== 'undefined') {
  module.exports = { renderInscription };
}
```

- [ ] **Step 8 : Vérifier les tests existants**

```
node tests/run-all.js
```
Attendu : `✅ Tous les tests passent`  
(Les tests existants de `test-inscription.js` utilisent un mock de localStorage qui ne sera plus appelé — ils peuvent nécessiter une mise à jour si certains testent les fonctions supprimées. Retirer les tests des fonctions supprimées `getInscriptions`/`saveInscriptions`/`_genId` si présents.)

- [ ] **Step 9 : Commit**

```bash
git add js/inscription.js tests/
git commit -m "feat: inscription.js async — Supabase CRUD + invitation automatique statut valide"
```

---

## Task 3 : `js/supabase-mc.js` + tests

**Files:**
- Create: `js/supabase-mc.js`
- Create: `tests/test-supabase-mc.js`
- Modify: `tests/run-all.js`

### Contexte

Structure MC locale actuelle (une par date) :
```js
{
  staff: { entretien_matin, entretien_aprem, accueil_matin, accueil_aprem, police, plage_nettoyee },
  slots: {
    1: { resa:0, walkin:0, gpe_pers:0, gpe_acc:0, tiralos:0, hippocampes:0, audioplage:0, transferts:0 },
    2: { ... }, 3: { ... }, 4: { ... }, 5: { ... }
  },
  notes: [{ ts, text, reporter }]
}
```

Table Supabase `main_courante` : une ligne par (date, creneau_id) avec colonnes `staff jsonb`, `compteurs jsonb`, `notes jsonb`, UNIQUE(date, creneau_id).

Stratégie : `getMcData(date)` lit toutes les lignes de la date et assemble l'objet local. `saveMcData(date, data)` fait un batch UPSERT de 5 lignes (une par créneau). Les notes sont stockées dans toutes les lignes (redondant mais simple). Le `staff` est stocké dans toutes les lignes.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/test-supabase-mc.js` :

```js
'use strict';
const assert = require('assert');

global.window = undefined;
// SLOTS requis par _mcDefault — simuler
global.SLOTS = [
  { id: 1, label: '8h30 – 10h15' },
  { id: 2, label: '10h30 – 12h15' },
  { id: 3, label: '12h30 – 14h15' },
  { id: 4, label: '14h30 – 16h15' },
  { id: 5, label: '16h30 – 18h15' },
];

const { _mcDefault, _rowsToMcData } = require('../js/supabase-mc.js');

// _mcDefault
const def = _mcDefault();
assert.ok(def.staff, 'staff present');
assert.ok(def.slots, 'slots present');
assert.ok(Array.isArray(def.notes), 'notes array');
assert.strictEqual(Object.keys(def.slots).length, 5, '5 slots');
assert.strictEqual(def.slots[1].resa, 0);

// _rowsToMcData : assemble un objet MC depuis les lignes Supabase
const rows = [
  { creneau_id: 1, staff: { entretien_matin: 'Alice', police: true }, compteurs: { resa: 3, walkin: 1, gpe_pers: 0, gpe_acc: 0, tiralos: 0, hippocampes: 0, audioplage: 0, transferts: 0 }, notes: [{ ts: 1000, text: 'Test', reporter: '' }] },
  { creneau_id: 2, staff: { entretien_matin: 'Alice', police: true }, compteurs: { resa: 2, walkin: 0, gpe_pers: 0, gpe_acc: 0, tiralos: 0, hippocampes: 0, audioplage: 0, transferts: 0 }, notes: [] },
];
const mc = _rowsToMcData(rows);
assert.strictEqual(mc.staff.entretien_matin, 'Alice');
assert.strictEqual(mc.staff.police, true);
assert.strictEqual(mc.slots[1].resa, 3);
assert.strictEqual(mc.slots[2].walkin, 0);
assert.strictEqual(mc.notes.length, 1);
// Créneaux sans ligne → défaut zéros
assert.strictEqual(mc.slots[3].resa, 0);

console.log('✓ test-supabase-mc.js OK');
```

- [ ] **Step 2 : Vérifier que le test échoue**

```
node tests/test-supabase-mc.js
```
Attendu : `Cannot find module '../js/supabase-mc.js'`

- [ ] **Step 3 : Créer `js/supabase-mc.js`**

```js
'use strict';

function _mcDefault() {
  var slots = {};
  SLOTS.forEach(function(s) {
    slots[s.id] = { resa:0, walkin:0, gpe_pers:0, gpe_acc:0, tiralos:0, hippocampes:0, audioplage:0, transferts:0 };
  });
  return {
    staff: { entretien_matin:'', entretien_aprem:'', accueil_matin:'', accueil_aprem:'', police:false, plage_nettoyee:false },
    slots: slots,
    notes: [],
    _isNew: true,
  };
}

function _rowsToMcData(rows) {
  var def = _mcDefault();
  if (!rows || rows.length === 0) return def;

  // Prendre staff et notes depuis la première ligne (ou slot 1)
  var refRow = rows.find(function(r) { return r.creneau_id === 1; }) || rows[0];
  var mc = {
    staff: refRow.staff || def.staff,
    notes: refRow.notes || [],
    slots: Object.assign({}, def.slots),
    _isNew: false,
  };

  rows.forEach(function(row) {
    mc.slots[row.creneau_id] = Object.assign({}, def.slots[row.creneau_id], row.compteurs || {});
  });

  return mc;
}

async function getMcData(date) {
  var result = await supabaseClient.from('main_courante').select('*').eq('date', date);
  if (result.error) throw result.error;
  return _rowsToMcData(result.data);
}

async function saveMcData(date, data) {
  var rows = SLOTS.map(function(s) {
    return {
      date:       date,
      creneau_id: s.id,
      staff:      data.staff || {},
      compteurs:  data.slots && data.slots[s.id] ? data.slots[s.id] : {},
      notes:      data.notes || [],
      updated_at: new Date().toISOString(),
    };
  });
  var result = await supabaseClient.from('main_courante').upsert(rows, { onConflict: 'date,creneau_id' });
  if (result.error) throw result.error;
}

async function getMcDates() {
  var result = await supabaseClient
    .from('main_courante')
    .select('date')
    .order('date', { ascending: false });
  if (result.error) throw result.error;
  // Dédupliquer (une ligne par creneau_id → plusieurs lignes par date)
  var seen = {};
  return (result.data || [])
    .map(function(r) { return r.date; })
    .filter(function(d) { if (seen[d]) return false; seen[d] = true; return true; });
}

// Abonnement Realtime main courante
var _mcChannel = null;

function subscribeMc(date, onUpdate) {
  if (_mcChannel) supabaseClient.removeChannel(_mcChannel);
  _mcChannel = supabaseClient.channel('mc-' + date)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'main_courante',
      filter: 'date=eq.' + date }, onUpdate)
    .subscribe();
}

function unsubscribeMc() {
  if (_mcChannel) {
    supabaseClient.removeChannel(_mcChannel);
    _mcChannel = null;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { _mcDefault, _rowsToMcData, getMcData, saveMcData, getMcDates,
    subscribeMc, unsubscribeMc };
}
```

- [ ] **Step 4 : Vérifier que le test passe**

```
node tests/test-supabase-mc.js
```
Attendu : `✓ test-supabase-mc.js OK`

- [ ] **Step 5 : Ajouter à `tests/run-all.js`**

```js
require('./test-supabase-mc.js');
```

```
node tests/run-all.js
```
Attendu : `✅ Tous les tests passent`

- [ ] **Step 6 : Commit**

```bash
git add js/supabase-mc.js tests/test-supabase-mc.js tests/run-all.js
git commit -m "feat: supabase-mc.js — async getMcData/saveMcData/getMcDates + tests"
```

---

## Task 4 : Adapter `js/mc.js`

**Files:**
- Modify: `js/mc.js`

### Contexte

`mc.js` (297 lignes) contient :
- `_mcKey`, `getMcData`, `saveMcData`, `getMcDates` — à **supprimer** (remplacés par supabase-mc.js)
- `renderMc(container, date)` — devient async, appelle `getReservations` async pour l'auto-fill

Points délicats :
- La variable `existsRaw` (ligne 65) est remplacée par `!data._isNew`
- `getMcData` + `saveMcData` dans les handlers deviennent async
- `getMcDates()` dans le rendu et dans le dropdown deviennent async
- `getReservations(date, s.id)` (ligne 71) dans la boucle SLOTS devient async

- [ ] **Step 1 : Supprimer les fonctions localStorage**

Dans `mc.js`, supprimer :
- `function _mcKey(date)` (ligne ~14)
- `function getMcData(date)` (lignes ~16-19)
- `function saveMcData(date, data)` (lignes ~22-24)
- `function getMcDates()` (lignes ~26-36)

- [ ] **Step 2 : Rendre `renderMc` async + adapter l'auto-fill**

```js
// Avant (lignes 62-76)
function renderMc(container, date) {
  const todayISO  = new Date().toISOString().slice(0, 10);
  const isToday   = date === todayISO;
  const existsRaw = localStorage.getItem(_mcKey(date));
  const data      = getMcData(date);

  SLOTS.forEach(s => {
    if (!data.slots[s.id]) data.slots[s.id] = _mcDefault().slots[s.id];
    const vals = Object.values(getReservations(date, s.id));
    data.slots[s.id].resa   = vals.filter(r => r.type === 'reserved').length;
    data.slots[s.id].walkin = vals.filter(r => r.type === 'walkin').length;
  });
  if (existsRaw) saveMcData(date, data);
  // ...
}

// Après
async function renderMc(container, date) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const isToday  = date === todayISO;
  const data     = await getMcData(date);

  // Auto-fill resa/walkin depuis les données réelles
  await Promise.all(SLOTS.map(async s => {
    if (!data.slots[s.id]) data.slots[s.id] = _mcDefault().slots[s.id];
    const vals = Object.values(await getReservations(date, s.id));
    data.slots[s.id].resa   = vals.filter(r => r.type === 'reserved').length;
    data.slots[s.id].walkin = vals.filter(r => r.type === 'walkin').length;
  }));
  if (!data._isNew) await saveMcData(date, data);
  // ... reste du rendu inchangé
}
```

Note : `_mcDefault` est maintenant défini dans `supabase-mc.js` (global). Retirer la définition locale si elle existe dans mc.js.

- [ ] **Step 3 : Rendre les handlers staff async**

```js
// Avant (ligne ~168-173)
el.addEventListener('blur', () => {
  const d = getMcData(date);
  d.staff[staffMap[id]] = el.value.trim();
  saveMcData(date, d);
});

// Après
el.addEventListener('blur', async () => {
  const d = await getMcData(date);
  d.staff[staffMap[id]] = el.value.trim();
  await saveMcData(date, d);
});
```

- [ ] **Step 4 : Rendre les handlers toggles async**

```js
// Avant (lignes ~179-186)
btn.addEventListener('click', () => {
  const d = getMcData(date);
  d.staff[key] = !d.staff[key];
  saveMcData(date, d);
  btn.textContent = d.staff[key] ? 'OUI' : 'NON';
  btn.className   = d.staff[key] ? 'mc-toggle mc-toggle-oui' : 'mc-toggle mc-toggle-non';
});

// Après
btn.addEventListener('click', async () => {
  const d = await getMcData(date);
  if (d.staff[key] === undefined) d.staff[key] = false;
  d.staff[key] = !d.staff[key];
  await saveMcData(date, d);
  btn.textContent = d.staff[key] ? 'OUI' : 'NON';
  btn.className   = d.staff[key] ? 'mc-toggle mc-toggle-oui' : 'mc-toggle mc-toggle-non';
});
```

- [ ] **Step 5 : Rendre les handlers compteurs async**

```js
// Avant (lignes ~192-208)
inp.addEventListener('input', () => {
  const d = getMcData(date);
  // ...
  saveMcData(date, d);
  // ...
});

// Après
inp.addEventListener('input', async () => {
  const d = await getMcData(date);
  const slotId = parseInt(inp.dataset.slot);
  const key    = inp.dataset.key;
  if (!d.slots[slotId]) d.slots[slotId] = _mcDefault().slots[slotId];
  d.slots[slotId][key] = Math.max(0, parseInt(inp.value) || 0);
  await saveMcData(date, d);
  const totEl = document.getElementById('mc-tot-' + key);
  if (totEl) {
    let total = 0;
    container.querySelectorAll('input.mc-count[data-key="' + key + '"]').forEach(i => {
      total += Math.max(0, parseInt(i.value) || 0);
    });
    totEl.textContent = total;
  }
});
```

- [ ] **Step 6 : Rendre `_addNote` et `_bindNoteDelete` async**

```js
// _addNote
async function _addNote() {
  const text     = noteInp.value.trim();
  const reporter = (document.getElementById('mc-note-reporter') || {}).value || '';
  if (!text) return;
  const d = await getMcData(date);
  if (!d.notes) d.notes = [];
  d.notes.unshift({ ts: Date.now(), text, reporter: reporter.trim() });
  await saveMcData(date, d);
  noteInp.value = '';
  document.getElementById('mc-notes-list').innerHTML = _renderNotes(d.notes);
  _bindNoteDelete(date, container);
}

// _bindNoteDelete
function _bindNoteDelete(date, container) {
  container.querySelectorAll('.mc-note-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const d = await getMcData(date);
      d.notes.splice(parseInt(btn.dataset.idx), 1);
      await saveMcData(date, d);
      document.getElementById('mc-notes-list').innerHTML = _renderNotes(d.notes);
      _bindNoteDelete(date, container);
    });
  });
}
```

- [ ] **Step 7 : Rendre le bouton "Historique" async**

```js
// Avant (lignes ~242-265)
listBtn.addEventListener('click', () => {
  // ...
  const dates = getMcDates();
  // ...
});

// Après
listBtn.addEventListener('click', async () => {
  const existing = document.getElementById('mc-hist-dropdown');
  if (existing) { existing.remove(); return; }
  const dd = document.createElement('div');
  dd.id = 'mc-hist-dropdown';
  dd.className = 'mc-hist-dropdown';
  const dates = await getMcDates();
  if (dates.length === 0) {
    dd.innerHTML = '<div class="mc-hist-empty">Aucune main courante sauvegardée.</div>';
  } else {
    dd.innerHTML = dates.map(d =>
      '<button class="mc-hist-item' + (d === date ? ' mc-hist-active' : '') + '" data-date="' + d + '">'
      + _fmtDateFr(d) + '</button>'
    ).join('');
    dd.querySelectorAll('.mc-hist-item').forEach(btn => {
      btn.addEventListener('click', () => {
        if (container._onMcGoto) container._onMcGoto(btn.dataset.date);
        dd.remove();
      });
    });
  }
  listBtn.parentNode.appendChild(dd);
});
```

- [ ] **Step 8 : Adapter `allDates` dans le rendu (ligne ~81)**

```js
// Avant
const allDates = getMcDates();
// ... utilisé pour afficher le count dans le bouton Historique

// Après : récupérer async AVANT le rendu HTML
const allDates = await getMcDates();
```

Cette ligne est dans le corps de `renderMc` qui est maintenant async, donc `await getMcDates()` fonctionne.

- [ ] **Step 9 : Supprimer la définition locale de `_mcDefault` si présente dans mc.js**

`_mcDefault` est maintenant dans `supabase-mc.js`. Si mc.js a sa propre définition, la supprimer (la fonction sera disponible globalement via le script chargé avant mc.js dans index.html).

- [ ] **Step 10 : Mettre à jour `module.exports`**

```js
if (typeof module !== 'undefined') {
  module.exports = { renderMc };
}
```

- [ ] **Step 11 : Vérifier les tests**

```
node tests/run-all.js
```
Attendu : `✅ Tous les tests passent`

- [ ] **Step 12 : Commit**

```bash
git add js/mc.js
git commit -m "feat: mc.js async — getMcData/saveMcData/getMcDates via supabase-mc.js"
```

---

## Task 5 : `js/supabase-storage.js` + tests

**Files:**
- Create: `js/supabase-storage.js`
- Create: `tests/test-supabase-storage.js`
- Modify: `tests/run-all.js`

### Contexte

Remplace `storage.js`. API publique :

| Fonction | Signature | Note |
|---|---|---|
| `getReservations` | `async (date, slotId)` → `{[spotId]: {...}}` | Lignes avec spot_id IS NOT NULL |
| `saveCheckin` | `async (date, slotId, spotId, data)` | UPSERT sur (date, creneau_id, spot_id) |
| `updateStatus` | `async (date, slotId, spotId, status, extras)` | UPDATE local status+extras |
| `updateSpotField` | `async (date, slotId, spotId, field, value)` | UPDATE un champ d'un spot |
| `clearSlot` | `async (date, slotId)` | DELETE tout le créneau |
| `getReservationList` | `async (date, slotId)` → `[{id, nom,...}]` | spot_id IS NULL, retourne id UUID |
| `addReservation` | `async (date, slotId, data)` → objet créé | INSERT waiting list |
| `removeReservation` | `async (reservationId)` | DELETE par UUID |
| `updateReservationStatus` | `async (reservationId, status)` | UPDATE statut waiting list |
| `updateReservationField` | `async (reservationId, field, value)` | UPDATE un champ waiting list |
| `getWeekReservationCounts` | `async (weekStartISO, weekEndISO)` → `{[date]:{[slotId]:{...}}}` | Bulk query planning |
| `getPassRemainingCount` | `async (inscriptionId, monthISO)` → number | Pour cache pass |
| `getTodayISO` | sync | Inchangé |
| `subscribeSlot` | `(date, slotId, onUpdate)` | Realtime |
| `unsubscribeSlot` | `()` | Realtime |

**Mapping champs Supabase → local :**

| Local | Supabase column |
|---|---|
| `status: 'present'` | `statut: 'present'` |
| `status: 'departed'` | `statut: 'parti'` |
| `status: 'absent'` | `statut: 'absent'` |
| `status: 'pas_venu'` | `statut: 'absent'` |
| `status: 'annule'` | `statut: 'annule'` |
| `checkinTime` | `checkin_time` (ms ↔ ISO) |
| `departTime` | `depart_time` (ms ↔ ISO) |
| `inscriptionId` | `inscription_id` |
| `resaType` | `resa_type` |
| `durationMs` | non stocké (local uniquement) |

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/test-supabase-storage.js` :

```js
'use strict';
const assert = require('assert');

global.window = undefined;
const { _rowToSpotResa, _rowToWaitingResa, _localStatusToDb, _dbStatutToLocal } = require('../js/supabase-storage.js');

// _localStatusToDb
assert.strictEqual(_localStatusToDb('present'),  'present');
assert.strictEqual(_localStatusToDb('departed'),  'parti');
assert.strictEqual(_localStatusToDb('absent'),    'absent');
assert.strictEqual(_localStatusToDb('pas_venu'),  'absent');
assert.strictEqual(_localStatusToDb('annule'),    'annule');

// _dbStatutToLocal
assert.strictEqual(_dbStatutToLocal('present'), 'present');
assert.strictEqual(_dbStatutToLocal('parti'),   'departed');
assert.strictEqual(_dbStatutToLocal('absent'),  'absent');
assert.strictEqual(_dbStatutToLocal('annule'),  'annule');

// _rowToSpotResa
const spotRow = {
  id:            'uuid-spot-1',
  nom:           'DUPONT',
  prenom:        'Marie',
  accompagnants: 1,
  type:          'reserved',
  statut:        'present',
  spot_id:       'P12',
  checkin_time:  '2026-07-02T09:00:00Z',
  depart_time:   null,
  inscription_id: 'insc-uuid',
  resa_type:     'normal',
};
const spot = _rowToSpotResa(spotRow);
assert.strictEqual(spot.nom, 'DUPONT');
assert.strictEqual(spot.status, 'present');
assert.strictEqual(spot.type, 'reserved');
assert.strictEqual(spot.inscriptionId, 'insc-uuid');
assert.strictEqual(typeof spot.checkinTime, 'number'); // ms timestamp
assert.strictEqual(spot.departTime, null);
// durationMs non présent (local uniquement)
assert.strictEqual(spot.durationMs, undefined);

// departed
const departedRow = { ...spotRow, statut: 'parti', depart_time: '2026-07-02T10:00:00Z' };
const departed = _rowToSpotResa(departedRow);
assert.strictEqual(departed.status, 'departed');
assert.strictEqual(typeof departed.departTime, 'number');

// _rowToWaitingResa
const waitRow = {
  id:            'uuid-wait-1',
  nom:           'MARTIN',
  prenom:        'Jean',
  accompagnants: 0,
  statut:        'attente',
  inscription_id: null,
  resa_type:     'normal',
};
const wait = _rowToWaitingResa(waitRow);
assert.strictEqual(wait.id, 'uuid-wait-1');
assert.strictEqual(wait.nom, 'MARTIN');
assert.strictEqual(wait.status, 'waiting');
assert.strictEqual(wait.inscriptionId, null);
assert.strictEqual(wait.resaType, 'normal');

// statut pas_venu (absent en DB)
const pvRow = { ...waitRow, statut: 'absent' };
const pv = _rowToWaitingResa(pvRow);
assert.strictEqual(pv.status, 'absent'); // sera filtré comme "pas_venu" par panel si besoin

console.log('✓ test-supabase-storage.js OK');
```

- [ ] **Step 2 : Vérifier que le test échoue**

```
node tests/test-supabase-storage.js
```
Attendu : `Cannot find module '../js/supabase-storage.js'`

- [ ] **Step 3 : Créer `js/supabase-storage.js`**

```js
'use strict';

function getTodayISO() {
  var d = new Date();
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
}

function _localStatusToDb(status) {
  if (status === 'departed') return 'parti';
  if (status === 'pas_venu') return 'absent';
  return status; // 'present', 'absent', 'annule', 'attente'
}

function _dbStatutToLocal(statut) {
  if (statut === 'parti') return 'departed';
  return statut; // 'present', 'absent', 'annule'
}

function _tsToMs(isoOrNull) {
  if (!isoOrNull) return null;
  return new Date(isoOrNull).getTime();
}

function _rowToSpotResa(row) {
  return {
    nom:           row.nom,
    prenom:        row.prenom,
    accompagnants: row.accompagnants,
    type:          row.type,
    status:        _dbStatutToLocal(row.statut),
    checkinTime:   _tsToMs(row.checkin_time),
    departTime:    _tsToMs(row.depart_time),
    inscriptionId: row.inscription_id || null,
    resaType:      row.resa_type || 'normal',
  };
}

function _rowToWaitingResa(row) {
  return {
    id:            row.id,
    nom:           row.nom,
    prenom:        row.prenom,
    accompagnants: row.accompagnants,
    status:        row.statut === 'attente' ? 'waiting' : _dbStatutToLocal(row.statut),
    inscriptionId: row.inscription_id || null,
    resaType:      row.resa_type || 'normal',
  };
}

async function getReservations(date, slotId) {
  var result = await supabaseClient.from('reservations').select('*')
    .eq('date', date).eq('creneau_id', slotId).not('spot_id', 'is', null);
  if (result.error) throw result.error;
  var map = {};
  (result.data || []).forEach(function(row) { map[row.spot_id] = _rowToSpotResa(row); });
  return map;
}

async function getReservationList(date, slotId) {
  var result = await supabaseClient.from('reservations').select('*')
    .eq('date', date).eq('creneau_id', slotId).is('spot_id', null)
    .order('created_at', { ascending: true });
  if (result.error) throw result.error;
  return (result.data || []).map(_rowToWaitingResa);
}

async function saveCheckin(date, slotId, spotId, data) {
  var row = {
    date:          date,
    creneau_id:    slotId,
    spot_id:       spotId,
    nom:           data.nom,
    prenom:        data.prenom,
    accompagnants: data.accompagnants,
    type:          data.type,
    statut:        _localStatusToDb(data.status || 'present'),
    checkin_time:  data.checkinTime ? new Date(data.checkinTime).toISOString() : null,
    depart_time:   data.departTime  ? new Date(data.departTime).toISOString()  : null,
    inscription_id: data.inscriptionId || null,
    resa_type:     data.resaType || 'normal',
  };
  var result = await supabaseClient.from('reservations').upsert(row,
    { onConflict: 'date,creneau_id,spot_id' });
  if (result.error) throw result.error;
}

async function updateStatus(date, slotId, spotId, status, extras) {
  var update = { statut: _localStatusToDb(status) };
  if (extras && extras.departTime) {
    update.depart_time = new Date(extras.departTime).toISOString();
  }
  if (extras && extras.checkinTime) {
    update.checkin_time = new Date(extras.checkinTime).toISOString();
  }
  var result = await supabaseClient.from('reservations').update(update)
    .eq('date', date).eq('creneau_id', slotId).eq('spot_id', spotId);
  if (result.error) throw result.error;
}

async function updateSpotField(date, slotId, spotId, field, value) {
  var col = field === 'accompagnants' ? 'accompagnants'
          : field === 'checkinTime'   ? 'checkin_time'
          : field === 'departTime'    ? 'depart_time'
          : field;
  var val = (col === 'checkin_time' || col === 'depart_time') && typeof value === 'number'
          ? new Date(value).toISOString() : value;
  var update = {};
  update[col] = val;
  var result = await supabaseClient.from('reservations').update(update)
    .eq('date', date).eq('creneau_id', slotId).eq('spot_id', spotId);
  if (result.error) throw result.error;
}

async function clearSlot(date, slotId) {
  var result = await supabaseClient.from('reservations').delete()
    .eq('date', date).eq('creneau_id', slotId);
  if (result.error) throw result.error;
}

async function addReservation(date, slotId, data) {
  var row = {
    date:          date,
    creneau_id:    slotId,
    nom:           data.nom,
    prenom:        data.prenom,
    accompagnants: data.accompagnants,
    type:          'reserved',
    statut:        'attente',
    spot_id:       null,
    inscription_id: data.inscriptionId || null,
    resa_type:     data.resaType || 'normal',
  };
  var result = await supabaseClient.from('reservations').insert(row).select().single();
  if (result.error) throw result.error;
  return _rowToWaitingResa(result.data);
}

async function removeReservation(reservationId) {
  var result = await supabaseClient.from('reservations').delete().eq('id', reservationId);
  if (result.error) throw result.error;
}

async function updateReservationStatus(reservationId, status) {
  var result = await supabaseClient.from('reservations')
    .update({ statut: _localStatusToDb(status) }).eq('id', reservationId);
  if (result.error) throw result.error;
}

async function updateReservationField(reservationId, field, value) {
  var col = field === 'accompagnants' ? 'accompagnants' : field;
  var update = {};
  update[col] = value;
  var result = await supabaseClient.from('reservations').update(update).eq('id', reservationId);
  if (result.error) throw result.error;
}

// Bulk query pour la vue planning (7j × 5 créneaux en une seule requête)
async function getWeekReservationCounts(weekStartISO, weekEndISO) {
  var result = await supabaseClient.from('reservations')
    .select('date, creneau_id, type, statut, resa_type, spot_id')
    .gte('date', weekStartISO).lte('date', weekEndISO);
  if (result.error) throw result.error;
  var counts = {};
  (result.data || []).forEach(function(row) {
    var d = row.date;
    if (!counts[d]) counts[d] = {};
    var s = row.creneau_id;
    if (!counts[d][s]) counts[d][s] = { waiting_normal:0, waiting_groupe:0, arrived_reserved:0, walkins:0 };
    var c = counts[d][s];
    if (row.spot_id === null) {
      if (row.resa_type === 'groupe') c.waiting_groupe++;
      else c.waiting_normal++;
    } else {
      if (row.type === 'walkin') c.walkins++;
      else c.arrived_reserved++;
    }
  });
  return counts;
}

// Compte les réservations liées à un inscriptionId dans un mois (pour pass quota)
async function getPassRemainingCount(inscriptionId, monthISO) {
  // monthISO : 'YYYY-MM'
  var start = monthISO + '-01';
  var end   = monthISO + '-31'; // Supabase gère les dates inexistantes
  var result = await supabaseClient.from('reservations')
    .select('id', { count: 'exact', head: true })
    .eq('inscription_id', inscriptionId)
    .gte('date', start).lte('date', end)
    .neq('statut', 'annule');
  if (result.error) throw result.error;
  return result.count || 0;
}

// Realtime
var _slotChannel = null;

function subscribeSlot(date, slotId, onUpdate) {
  if (_slotChannel) supabaseClient.removeChannel(_slotChannel);
  _slotChannel = supabaseClient.channel('slot-' + date + '-' + slotId)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'reservations',
      filter: 'date=eq.' + date,
    }, function(payload) {
      var changed = (payload.new && payload.new.creneau_id) || (payload.old && payload.old.creneau_id);
      if (changed == slotId) onUpdate(payload);
    })
    .subscribe();
}

function unsubscribeSlot() {
  if (_slotChannel) {
    supabaseClient.removeChannel(_slotChannel);
    _slotChannel = null;
  }
}

if (typeof module !== 'undefined') {
  module.exports = {
    _rowToSpotResa, _rowToWaitingResa, _localStatusToDb, _dbStatutToLocal,
    getTodayISO, getReservations, getReservationList, saveCheckin, updateStatus,
    updateSpotField, clearSlot, addReservation, removeReservation,
    updateReservationStatus, updateReservationField,
    getWeekReservationCounts, getPassRemainingCount,
    subscribeSlot, unsubscribeSlot,
  };
}
```

- [ ] **Step 4 : Vérifier que le test passe**

```
node tests/test-supabase-storage.js
```
Attendu : `✓ test-supabase-storage.js OK`

- [ ] **Step 5 : Ajouter à `tests/run-all.js`**

```js
require('./test-supabase-storage.js');
```

```
node tests/run-all.js
```
Attendu : `✅ Tous les tests passent`

- [ ] **Step 6 : Commit**

```bash
git add js/supabase-storage.js tests/test-supabase-storage.js tests/run-all.js
git commit -m "feat: supabase-storage.js — async réservations + bulk planning + pass counts + tests"
```

---

## Task 6 : Adapter `js/pass.js`

**Files:**
- Modify: `js/pass.js`

### Contexte

`pass.js` a deux fonctions qui lisent localStorage :
1. `getInscriptionsWithActivePass()` — appelle `getInscriptions()` qui était dans inscription.js
2. `getPassRemaining(inscriptionId)` — scanne toutes les clés localStorage pour compter les réservations du mois en cours

Après SP2 :
1. `getInscriptionsWithActivePass()` utilise `getCachedInscriptions()` (synchrone, depuis le cache de supabase-inscriptions.js)
2. `getPassRemaining(inscriptionId)` consulte un cache local préchargé (évite de rendre la fonction async — elle est appelée de façon synchrone dans la suggestion autocomplete de modal.js)

Le cache pass est préchargé par `preloadPassCounts(inscriptionIds)` (appelé depuis app.js lors de l'ouverture de la modale d'ajout de réservation).

- [ ] **Step 1 : Remplacer `getInscriptionsWithActivePass`**

```js
// Avant
function getInscriptionsWithActivePass() {
  return getInscriptions().filter(i => i.pass && i.pass.actif && isPassSeason());
}

// Après
function getInscriptionsWithActivePass() {
  var list = (typeof getCachedInscriptions === 'function') ? getCachedInscriptions() : [];
  return list.filter(function(i) { return i.pass && i.pass.actif && isPassSeason(); });
}
```

- [ ] **Step 2 : Ajouter le cache pass + `setPassCountCache` + adapter `getPassRemaining`**

Remplacer la fonction `getPassRemaining` (qui scannait localStorage) par une version basée sur un cache :

```js
// Cache peuplé par preloadPassCounts (app.js) avant ouverture de la modale
var _passCountCache = {}; // { [inscriptionId]: number }

function setPassCountCache(cache) {
  _passCountCache = cache || {};
}

function getPassRemaining(inscriptionId) {
  if (!inscriptionId) return null;
  var used = _passCountCache[inscriptionId];
  if (used === undefined) return null; // non préchargé = on ne sait pas
  var monthly = typeof PASS_MONTHLY_LIMIT !== 'undefined' ? PASS_MONTHLY_LIMIT : 4;
  return Math.max(0, monthly - used);
}
```

Note : `PASS_MONTHLY_LIMIT` est déjà défini dans pass.js. Si son nom est différent, l'adapter.

- [ ] **Step 3 : Ajouter `preloadPassCounts` (async)**

```js
// Précharge les compteurs de réservations pass pour ce mois
// inscriptionIds : tableau d'UUIDs
async function preloadPassCounts(inscriptionIds) {
  if (!inscriptionIds || inscriptionIds.length === 0) {
    setPassCountCache({});
    return;
  }
  var monthISO = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  var cache = {};
  await Promise.all(inscriptionIds.map(async function(id) {
    cache[id] = await getPassRemainingCount(id, monthISO);
  }));
  setPassCountCache(cache);
}
```

- [ ] **Step 4 : Supprimer l'ancienne implémentation de `getPassRemaining`**

L'ancienne version scannait `localStorage` — la supprimer entièrement et la remplacer par la version cache ci-dessus.

- [ ] **Step 5 : Mettre à jour `module.exports`**

```js
if (typeof module !== 'undefined') {
  module.exports = {
    isPassSeason, getPassMonthLabel, getPassResetDate, getPassRemainingCount: undefined,
    getInscriptionsWithActivePass, getPassRemaining,
    setPassCountCache, preloadPassCounts,
    // conserver les autres exports existants
  };
}
```

Vérifier que les exports correspondent aux fonctions réellement définies dans le fichier.

- [ ] **Step 6 : Mettre à jour `tests/test-pass.js`**

Les tests existants de `getPassRemaining` utilisent localStorage. Les remplacer par des tests du cache :

```js
// Tester setPassCountCache + getPassRemaining
setPassCountCache({ 'insc-uuid-1': 2 });
assert.strictEqual(getPassRemaining('insc-uuid-1'), 2); // PASS_MONTHLY_LIMIT - 2
assert.strictEqual(getPassRemaining('insc-uuid-unknown'), null); // non préchargé
assert.strictEqual(getPassRemaining(null), null);

// Nettoyer
setPassCountCache({});
```

Adapter les assertions au `PASS_MONTHLY_LIMIT` réel défini dans pass.js.

- [ ] **Step 7 : Vérifier les tests**

```
node tests/run-all.js
```
Attendu : `✅ Tous les tests passent`

- [ ] **Step 8 : Commit**

```bash
git add js/pass.js tests/test-pass.js
git commit -m "feat: pass.js — cache-based getPassRemaining + preloadPassCounts async"
```

---

## Task 7 : Adapter `js/planning.js`

**Files:**
- Modify: `js/planning.js`

### Contexte

`planning.js` appelle `getReservationList` et `getReservations` pour chaque cellule de la grille (35 appels = 7j × 5 créneaux × 2). En SP2, ces appels sont remplacés par `getWeekReservationCounts` (une seule requête Supabase pour toute la semaine).

`exportSlotPDF` (fonction dans planning.js) appelle aussi les deux fonctions — devient async.

- [ ] **Step 1 : Rendre `renderPlanning` async et utiliser `getWeekReservationCounts`**

Dans `planning.js`, remplacer le début de `renderPlanning` :

```js
// Avant
function renderPlanning(container, weekOffset, onCellClick) {
  const todayISO = _isoDate(new Date());
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const ws   = _weekStart(weekOffset);
  const days = _weekDays(ws);
  // ...
  SLOTS.forEach((slot, slotIdx) => {
    // ...
    days.forEach(d => {
      const iso    = _isoDate(d);
      const list   = getReservationList(iso, slot.id);
      const spotVals = Object.values(getReservations(iso, slot.id));
      const presences = spotVals.filter(r => r.type === 'reserved').length;
      const walkins   = spotVals.filter(r => r.type === 'walkin').length;
      const cntN = list.filter(r => !r.resaType || r.resaType === 'normal').length + presences;
      const cntG = list.filter(r => r.resaType === 'groupe').length;
      // ...
    });
  });
}

// Après
async function renderPlanning(container, weekOffset, onCellClick) {
  const todayISO = _isoDate(new Date());
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const ws         = _weekStart(weekOffset);
  const days       = _weekDays(ws);
  const weekStartISO = _isoDate(ws);
  const weekEndISO   = _isoDate(days[6]);

  // Une seule requête pour toute la semaine
  const counts = await getWeekReservationCounts(weekStartISO, weekEndISO);

  // Nav bar + grid header (inchangés)
  // ...

  SLOTS.forEach((slot, slotIdx) => {
    // ...
    days.forEach(d => {
      const iso = _isoDate(d);
      const slotCounts = (counts[iso] && counts[iso][slot.id]) || { waiting_normal:0, waiting_groupe:0, arrived_reserved:0, walkins:0 };
      const cntN   = slotCounts.waiting_normal  + slotCounts.arrived_reserved;
      const cntG   = slotCounts.waiting_groupe;
      const walkins = slotCounts.walkins;
      // ... rendu cellule identique
    });
  });
  // ... nav et click handlers inchangés
}
```

- [ ] **Step 2 : Rendre `exportSlotPDF` async**

```js
// Avant
function exportSlotPDF(dateISO, slot) {
  const list  = getReservationList(dateISO, slot.id);
  const spots = getReservations(dateISO, slot.id);
  // ...
}

// Après
async function exportSlotPDF(dateISO, slot) {
  const [list, spots] = await Promise.all([
    getReservationList(dateISO, slot.id),
    getReservations(dateISO, slot.id),
  ]);
  // ... reste inchangé
}
```

- [ ] **Step 3 : Vérifier les tests**

```
node tests/run-all.js
```
Attendu : `✅ Tous les tests passent`

- [ ] **Step 4 : Commit**

```bash
git add js/planning.js
git commit -m "feat: planning.js async — bulk query getWeekReservationCounts + exportSlotPDF async"
```

---

## Task 8 : Adapter `js/panel.js`

**Files:**
- Modify: `js/panel.js`

### Contexte

`panel.js::renderPanel` câble les callbacks `onPasVenu(index)`, `onAnnule(index)`, `onWaitingClick(index)` avec des indices tableau. Après SP2, les waiting list entries ont un champ `id` (UUID). Les callbacks doivent propager l'UUID.

L'appel `onAssign(idx, waitingList[idx])` passe déjà l'objet resa — `app.js` utilisera `resa.id`.

Lignes à modifier (dans la section câblage des boutons) :

```js
// Avant (~lignes 68-91)
container.querySelectorAll('.btn-assign[data-index]').forEach(btn => {
  const idx = parseInt(btn.dataset.index);
  btn.addEventListener('click', e => { e.stopPropagation(); callbacks.onAssign(idx, waitingList[idx]); });
});
container.querySelectorAll('.btn-pas-venu[data-index]').forEach(btn => {
  const idx = parseInt(btn.dataset.index);
  btn.addEventListener('click', e => { e.stopPropagation(); callbacks.onPasVenu(idx); });
});
container.querySelectorAll('.btn-annule[data-index]').forEach(btn => {
  const idx = parseInt(btn.dataset.index);
  btn.addEventListener('click', e => { e.stopPropagation(); callbacks.onAnnule(idx); });
});
// ...
container.querySelectorAll('.waiting-item[data-index]').forEach(el => {
  el.addEventListener('click', e => {
    if (e.target.closest('button')) return;
    callbacks.onWaitingClick && callbacks.onWaitingClick(parseInt(el.dataset.index));
  });
});
```

- [ ] **Step 1 : Passer les UUIDs dans les callbacks**

```js
// Après
container.querySelectorAll('.btn-assign[data-index]').forEach(btn => {
  const idx = parseInt(btn.dataset.index);
  btn.addEventListener('click', e => { e.stopPropagation(); callbacks.onAssign(idx, waitingList[idx]); });
  // onAssign inchangé — app.js lira resa.id
});
container.querySelectorAll('.btn-pas-venu[data-index]').forEach(btn => {
  const idx = parseInt(btn.dataset.index);
  const resa = waitingList[idx];
  btn.addEventListener('click', e => { e.stopPropagation(); callbacks.onPasVenu(resa && resa.id); });
});
container.querySelectorAll('.btn-annule[data-index]').forEach(btn => {
  const idx = parseInt(btn.dataset.index);
  const resa = waitingList[idx];
  btn.addEventListener('click', e => { e.stopPropagation(); callbacks.onAnnule(resa && resa.id); });
});
// ...
container.querySelectorAll('.waiting-item[data-index]').forEach(el => {
  el.addEventListener('click', e => {
    if (e.target.closest('button')) return;
    const idx = parseInt(el.dataset.index);
    const resa = waitingList[idx];
    callbacks.onWaitingClick && callbacks.onWaitingClick(resa && resa.id);
  });
});
```

- [ ] **Step 2 : Vérifier les tests**

```
node tests/run-all.js
```
Attendu : `✅ Tous les tests passent`

- [ ] **Step 3 : Commit**

```bash
git add js/panel.js
git commit -m "feat: panel.js — callbacks UUID (onPasVenu/onAnnule/onWaitingClick passent resa.id)"
```

---

## Task 9 : Adapter `js/app.js`

**Files:**
- Modify: `js/app.js`

### Contexte

C'est la tâche la plus complexe. `app.js` est un IIFE de 365 lignes. Les changements nécessaires :

1. `refresh()` → `async function refresh()` avec `await`
2. `_selectionMode = { index, resa }` → `{ id: resa.id, resa }` 
3. `_openAssign(index, resa, freeSpots)` → `_openAssign(id, resa, freeSpots)` 
4. `_doAssignSpot` → async, utilise `waitingResa.id` et `removeReservation(id)`
5. `_detectDoubleSlot` → async, utilise `await getReservationList`
6. `_buildProfileHistory` → async, `await` tous les appels storage
7. `_registerOverflow` → async, `await saveCheckin` pour chaque slot
8. `_openWalkin` → callback async pour `saveCheckin` + `_registerOverflow`
9. `_openAddReservation` → callback async + préchargement pass counts
10. `onDepartedClick`, `onWaitingClick` → async avec `await _buildProfileHistory`
11. `onPasVenu(id)`, `onAnnule(id)` → async UUID-based
12. `onUpdateAccompagnants` dans spot modal → async
13. `_onSpotClick` → async (pour `onCheckin`, `onDepart`, `onAbsent`)
14. `_renderPlanning` → async
15. `_renderMc` → async (appelle `renderMc` qui est async)
16. `_renderInscription` → async
17. Ajout : `init()` précharge les inscriptions + subscribe Realtime

- [ ] **Step 1 : Rendre `refresh` async**

```js
// Avant
function refresh() {
  if (!_selectedSlotId) return;
  const reservations = getReservations(_date, _selectedSlotId);
  const waitingList  = getReservationList(_date, _selectedSlotId);
  // ...
}

// Après
async function refresh() {
  if (!_selectedSlotId) return;
  const [reservations, waitingList] = await Promise.all([
    getReservations(_date, _selectedSlotId),
    getReservationList(_date, _selectedSlotId),
  ]);
  const slot      = getSlotById(_selectedSlotId);
  const mapEl     = document.getElementById('beach-map');
  const panelEl   = document.getElementById('side-panel');
  const freeSpots = BEACH_CONFIG.spots
    .filter(s => !reservations[s.id] || reservations[s.id].status === 'free')
    .map(s => s.id);
  // ... reste du rendu inchangé
}
```

- [ ] **Step 2 : Rendre `_buildProfileHistory` async**

```js
// Avant
function _buildProfileHistory(resa) {
  if (!resa) return [];
  const nom    = resa.nom.toUpperCase();
  const prenom = resa.prenom.toUpperCase();
  const result = [];
  SLOTS.forEach(slot => {
    const resas = getReservations(_date, slot.id);
    // ...
    const list = getReservationList(_date, slot.id);
    // ...
  });
  return result;
}

// Après
async function _buildProfileHistory(resa) {
  if (!resa) return [];
  const nom    = resa.nom.toUpperCase();
  const prenom = resa.prenom.toUpperCase();
  const [allResas, allLists] = await Promise.all([
    Promise.all(SLOTS.map(s => getReservations(_date, s.id))),
    Promise.all(SLOTS.map(s => getReservationList(_date, s.id))),
  ]);
  const result = [];
  SLOTS.forEach((slot, i) => {
    const resas = allResas[i];
    const list  = allLists[i];
    Object.entries(resas).forEach(([sid, r]) => {
      if (r.nom?.toUpperCase() === nom && r.prenom?.toUpperCase() === prenom) {
        result.push({ slot, spotId: sid, resa: r });
      }
    });
    const alreadyInSlot = result.some(e => e.slot.id === slot.id);
    if (!alreadyInSlot) {
      const found = list.find(r => r.nom?.toUpperCase() === nom && r.prenom?.toUpperCase() === prenom);
      if (found) result.push({ slot, spotId: null, resa: { ...found, status: found.status || 'reserved_waiting' } });
    }
  });
  return result;
}
```

- [ ] **Step 3 : Adapter les callbacks dans `renderPanel` — `onDepartedClick` et `onWaitingClick` async**

```js
// Dans refresh(), section renderPanel :

// Avant
onDepartedClick: spotId => openDepartedModal(spotId, reservations[spotId], _buildProfileHistory(reservations[spotId])),
onWaitingClick:  index  => openWaitingDetailModal(waitingList[index], _buildProfileHistory(waitingList[index]), {
  onUpdateAccompagnants: n => {
    updateReservationField(_date, _selectedSlotId, index, 'accompagnants', n);
    refresh();
  },
}),
onPasVenu: index => { updateReservationStatus(_date, _selectedSlotId, index, 'pas_venu'); refresh(); },
onAnnule:  index => { updateReservationStatus(_date, _selectedSlotId, index, 'annule');   refresh(); },

// Après
onDepartedClick: async spotId => {
  const history = await _buildProfileHistory(reservations[spotId]);
  openDepartedModal(spotId, reservations[spotId], history);
},
onWaitingClick: async resaId => {
  const resa = waitingList.find(r => r.id === resaId);
  if (!resa) return;
  const history = await _buildProfileHistory(resa);
  openWaitingDetailModal(resa, history, {
    onUpdateAccompagnants: async n => {
      await updateReservationField(resaId, 'accompagnants', n);
      await refresh();
    },
  });
},
onPasVenu: async resaId => { await updateReservationStatus(resaId, 'absent'); await refresh(); },
onAnnule:  async resaId => { await updateReservationStatus(resaId, 'annule'); await refresh(); },
```

- [ ] **Step 4 : Adapter `_onSpotClick` async**

```js
// Avant
function _onSpotClick(spotId, reservations, freeSpots) {
  const resa = reservations[spotId];
  if (!resa || resa.status === 'free') {
    _openWalkin(freeSpots, spotId);
  } else {
    openSpotDetailModal(spotId, resa, {
      onCheckin: id => {
        const resas = getReservations(_date, _selectedSlotId);
        resas[id].checkinTime = Date.now();
        resas[id].status = 'present';
        saveCheckin(_date, _selectedSlotId, id, resas[id]);
        refresh();
      },
      onDepart: id => { updateStatus(_date, _selectedSlotId, id, 'departed', { departTime: Date.now() }); refresh(); },
      onAbsent: id => { updateStatus(_date, _selectedSlotId, id, 'absent'); refresh(); },
      onUpdateAccompagnants: n => { updateSpotField(_date, _selectedSlotId, spotId, 'accompagnants', n); refresh(); },
    }, _buildProfileHistory(resa));
  }
}

// Après
async function _onSpotClick(spotId, reservations, freeSpots) {
  const resa = reservations[spotId];
  if (!resa || resa.status === 'free') {
    _openWalkin(freeSpots, spotId);
    return;
  }
  const history = await _buildProfileHistory(resa);
  openSpotDetailModal(spotId, resa, {
    onCheckin: async id => {
      await updateStatus(_date, _selectedSlotId, id, 'present', { checkinTime: Date.now() });
      await refresh();
    },
    onDepart: async id => {
      await updateStatus(_date, _selectedSlotId, id, 'departed', { departTime: Date.now() });
      await refresh();
    },
    onAbsent: async id => {
      await updateStatus(_date, _selectedSlotId, id, 'absent');
      await refresh();
    },
    onUpdateAccompagnants: async n => {
      await updateSpotField(_date, _selectedSlotId, spotId, 'accompagnants', n);
      await refresh();
    },
  }, history);
}
```

Note : `mapHandler` dans `refresh()` appelle `_onSpotClick` — adapter en conséquence (fire-and-forget si appelé depuis un event listener, ce qui est le cas dans `renderMapSpots`).

- [ ] **Step 5 : Adapter `_openAddReservation` async avec préchargement pass**

```js
// Avant
function _openAddReservation() {
  openAddReservationModal(data => {
    addReservation(_date, _selectedSlotId, data);
    refresh();
  });
}

// Après
async function _openAddReservation() {
  // Précharger les pass counts avant d'ouvrir la modale
  const passInscriptions = (typeof getInscriptionsWithActivePass === 'function')
    ? getInscriptionsWithActivePass() : [];
  if (passInscriptions.length > 0 && typeof preloadPassCounts === 'function') {
    await preloadPassCounts(passInscriptions.map(i => i.id));
  }
  openAddReservationModal(async data => {
    await addReservation(_date, _selectedSlotId, data);
    await refresh();
  });
}
```

- [ ] **Step 6 : Adapter `_openWalkin` async**

```js
// Avant
function _openWalkin(freeSpots, preselectedSpotId) {
  openCheckinModal(freeSpots, preselectedSpotId, (spotId, data) => {
    const checkinData = { ...data, durationMs: DURATION_MS };
    saveCheckin(_date, _selectedSlotId, spotId, checkinData);
    _registerOverflow(spotId, checkinData);
    refresh();
  });
}

// Après
function _openWalkin(freeSpots, preselectedSpotId) {
  openCheckinModal(freeSpots, preselectedSpotId, async (spotId, data) => {
    const checkinData = { ...data, durationMs: DURATION_MS };
    await saveCheckin(_date, _selectedSlotId, spotId, checkinData);
    await _registerOverflow(spotId, checkinData);
    await refresh();
  });
}
```

- [ ] **Step 7 : Rendre `_registerOverflow` async**

```js
// Avant
function _registerOverflow(spotId, checkinData) {
  const endTime = checkinData.checkinTime + checkinData.durationMs;
  SLOTS.forEach(slot => {
    if (slot.id <= _selectedSlotId) return;
    const [h, m] = slot.start.split(':').map(Number);
    const slotStart = new Date();
    slotStart.setHours(h, m, 0, 0);
    if (slotStart.getTime() < endTime) {
      saveCheckin(_date, slot.id, spotId, { ...checkinData });
    }
  });
}

// Après
async function _registerOverflow(spotId, checkinData) {
  const endTime = checkinData.checkinTime + checkinData.durationMs;
  await Promise.all(SLOTS.map(async slot => {
    if (slot.id <= _selectedSlotId) return;
    const [h, m] = slot.start.split(':').map(Number);
    const slotStart = new Date();
    slotStart.setHours(h, m, 0, 0);
    if (slotStart.getTime() < endTime) {
      await saveCheckin(_date, slot.id, spotId, { ...checkinData });
    }
  }));
}
```

- [ ] **Step 8 : Adapter `_openAssign` et `_doAssignSpot` async (UUID)**

```js
// Avant
function _openAssign(index, resa, freeSpots) {
  _selectionMode = { index, resa };
  refresh();
}

async function _doAssignSpot(spotId, reservations, freeSpots) {
  // ...
  const { index, resa: waitingResa } = _selectionMode;
  _selectionMode = null;
  // ...
  saveCheckin(...);
  removeReservation(_date, _selectedSlotId, index);
  if (isDouble) {
    const nextList = getReservationList(_date, nextSlotId);
    const nextIdx = nextList.findIndex(...);
    if (nextIdx !== -1) removeReservation(_date, nextSlotId, nextIdx);
  }
  _registerOverflow(...);
  refresh();
}

// Après
function _openAssign(index, resa, freeSpots) {
  _selectionMode = { id: resa.id, resa }; // UUID au lieu d'index
  refresh();
}

async function _doAssignSpot(spotId, reservations, freeSpots) {
  const resa = reservations[spotId];
  if (resa && resa.status !== 'free' && resa.status !== 'departed') return;

  const { id: waitingResaId, resa: waitingResa } = _selectionMode;
  _selectionMode = null;

  const isDouble   = await _detectDoubleSlot(waitingResa.nom, waitingResa.prenom);
  const durationMs = isDouble ? DURATION_MS_DOUBLE : DURATION_MS;
  const checkinTime = Date.now();
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

  await saveCheckin(_date, _selectedSlotId, spotId, checkinData);
  await removeReservation(waitingResaId); // UUID

  if (isDouble) {
    const nextSlotId = _selectedSlotId + 1;
    const nextList = await getReservationList(_date, nextSlotId);
    const nextEntry = nextList.find(r =>
      r.nom.toUpperCase()    === waitingResa.nom.toUpperCase() &&
      r.prenom.toUpperCase() === waitingResa.prenom.toUpperCase()
    );
    if (nextEntry) await removeReservation(nextEntry.id); // UUID
  }

  await _registerOverflow(spotId, checkinData);
  await refresh();
}
```

- [ ] **Step 9 : Rendre `_detectDoubleSlot` async**

```js
// Avant
function _detectDoubleSlot(nom, prenom) {
  if (_selectedSlotId >= 5) return false;
  const nextList = getReservationList(_date, _selectedSlotId + 1);
  return nextList.some(r =>
    r.nom.toUpperCase()    === nom.toUpperCase() &&
    r.prenom.toUpperCase() === prenom.toUpperCase()
  );
}

// Après
async function _detectDoubleSlot(nom, prenom) {
  if (_selectedSlotId >= 5) return false;
  const nextList = await getReservationList(_date, _selectedSlotId + 1);
  return nextList.some(r =>
    r.nom.toUpperCase()    === nom.toUpperCase() &&
    r.prenom.toUpperCase() === prenom.toUpperCase()
  );
}
```

- [ ] **Step 10 : Adapter `_renderPlanning`, `_renderMc`, `_renderInscription` async**

```js
async function _renderPlanning() {
  const container = document.getElementById('planning-view');
  if (!container) return;
  container._onPrev = () => { _planningWeekOffset--; _renderPlanning(); };
  container._onNext = () => { _planningWeekOffset++; _renderPlanning(); };
  await renderPlanning(container, _planningWeekOffset, async (dateISO, slot) => {
    const isToday = dateISO === _date;
    openSlotPlanningModal(dateISO, slot, {
      onAdd:    async data => { await addReservation(dateISO, slot.id, data); await _renderPlanning(); },
      onRemove: async id   => { await removeReservation(id); await _renderPlanning(); },
      onGoLive: isToday ? () => { showView('carte'); selectSlot(slot.id); } : null,
    });
  });
}

async function _renderMc() {
  const container = document.getElementById('mc-view');
  if (!container) return;
  if (!_mcDate) _mcDate = _date;
  container._onMcPrev  = () => { _mcDate = _mcDateOffset(_mcDate, -1); _renderMc(); };
  container._onMcNext  = () => { const next = _mcDateOffset(_mcDate, +1); if (next <= _date) { _mcDate = next; _renderMc(); } };
  container._onMcToday = () => { _mcDate = _date; _renderMc(); };
  container._onMcGoto  = d  => { _mcDate = d; _renderMc(); };
  await renderMc(container, _mcDate);
}

async function _renderInscription() {
  const container = document.getElementById('insc-view');
  if (!container) return;
  await renderInscription(container);
}
```

- [ ] **Step 11 : Adapter `init()` — précharger inscriptions + Realtime**

```js
function init() {
  _date   = getTodayISO();
  _mcDate = _date;
  _renderHeader();
  _renderClock();
  setInterval(_renderClock, 1000);

  // Préchargement inscriptions (pour autocomplete pass)
  if (typeof getInscriptions === 'function') {
    getInscriptions().catch(function(err) { console.warn('Preload inscriptions:', err); });
  }

  // Realtime : s'abonner aux inscriptions
  if (typeof subscribeInscriptions === 'function') {
    subscribeInscriptions(function() {
      getInscriptions().catch(function() {});
      if (_currentView === 'inscription') _renderInscription();
    });
  }

  const active   = getActiveSlot(new Date());
  const upcoming = SLOTS.find(s => getSlotStatus(s, new Date()) === 'upcoming');
  const defaultSlot = active || upcoming || SLOTS[0];
  selectSlot(defaultSlot.id);

  setInterval(refresh, 30000);

  // ... câblage boutons tab (inchangé)
}
```

- [ ] **Step 12 : Adapter `selectSlot` pour activer la subscription Realtime**

```js
function selectSlot(slotId) {
  _selectedSlotId = slotId;
  document.querySelectorAll('.slot-pill').forEach(el => {
    el.classList.toggle('selected-slot', parseInt(el.dataset.slotId) === slotId);
  });
  // Réabonnement Realtime au nouveau créneau
  if (typeof subscribeSlot === 'function') {
    subscribeSlot(_date, slotId, function() { refresh(); });
  }
  refresh();
}
```

- [ ] **Step 13 : Adapter le callback `onItemClick` dans `renderPanel`**

```js
// Avant (dans refresh)
onItemClick: spotId => _onSpotClick(spotId, reservations, freeSpots),

// Après
onItemClick: spotId => { _onSpotClick(spotId, reservations, freeSpots); },
// _onSpotClick est async, le fire-and-forget est intentionnel (event handler)
```

- [ ] **Step 14 : Vérifier les tests**

```
node tests/run-all.js
```
Attendu : `✅ Tous les tests passent`

- [ ] **Step 15 : Commit**

```bash
git add js/app.js
git commit -m "feat: app.js async — refresh, waiting list UUID, buildProfileHistory async, Realtime init"
```

---

## Task 10 : Adapter `js/modal.js`

**Files:**
- Modify: `js/modal.js`

### Contexte

`openSlotPlanningModal` a des fonctions internes `_refreshSection`, `_refreshWalkins`, `_refreshAll` qui appellent `getReservationList` et `getReservations` de façon synchrone. Ces fonctions deviennent async.

Le bouton "remove" utilisait `data-index` → passe à `data-id` (UUID).

La validation de capacité dans le bouton "Add" appelle aussi les deux fonctions sync.

- [ ] **Step 1 : Rendre `_refreshSection` async**

Dans `openSlotPlanningModal`, remplacer la fonction `_refreshSection` :

```js
// Avant
function _refreshSection(resaType, listId, capId, capacity) {
  const all     = getReservationList(dateISO, slot.id);
  const pending = all.map((r, i) => ({ ...r, _idx: i })).filter(...);
  const arrived = resaType === 'normal'
    ? Object.entries(getReservations(dateISO, slot.id)).filter(...)
    : [];
  // ...
  listEl.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      callbacks.onRemove(parseInt(btn.dataset.index));
      _refreshAll();
    });
  });
}

// Après
async function _refreshSection(resaType, listId, capId, capacity) {
  const [all, spotsMap] = await Promise.all([
    getReservationList(dateISO, slot.id),
    getReservations(dateISO, slot.id),
  ]);
  const pending = all.filter(r => resaType === 'normal'
    ? (!r.resaType || r.resaType === 'normal')
    : r.resaType === 'groupe');

  const arrived = resaType === 'normal'
    ? Object.entries(spotsMap).filter(([, r]) => r.type === 'reserved')
             .map(([spotId, r]) => ({ ...r, _spotId: spotId }))
    : [];

  const total = pending.length + arrived.length;
  const capEl = document.getElementById(capId);
  if (capEl) {
    capEl.textContent = total + ' / ' + capacity;
    capEl.className = 'plan-section-cap' + (total >= capacity ? ' full' : total >= capacity * 0.8 ? ' warn' : '');
  }
  const listEl = document.getElementById(listId);
  if (!listEl) return;

  if (total === 0) { listEl.innerHTML = '<div class="planning-empty">Aucune réservation</div>'; return; }

  const pendingHtml = pending.map(r => {
    const acc = r.accompagnants === 0 ? 'seul·e'
      : r.accompagnants === 1 ? '1 acc.' : r.accompagnants + ' acc.';
    return '<div class="planning-list-item">'
      + '<span>' + r.nom + ' ' + r.prenom + ' — ' + acc + '</span>'
      + '<button class="btn-remove" data-id="' + r.id + '">✕</button>'  // UUID !
      + '</div>';
  }).join('');

  const arrivedHtml = arrived.map(r => {
    const acc  = r.accompagnants === 0 ? 'seul·e' : r.accompagnants === 1 ? '1 acc.' : r.accompagnants + ' acc.';
    const time = r.checkinTime ? ' · ' + _fmtCheckinTime(r.checkinTime) : '';
    return '<div class="planning-list-item planning-list-present">'
      + '<span>✓ ' + r.prenom + ' ' + r.nom + ' — ' + acc + ' (' + r._spotId + ')' + time + '</span>'
      + '</div>';
  }).join('');

  listEl.innerHTML = arrivedHtml + pendingHtml;

  listEl.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      await callbacks.onRemove(btn.dataset.id);  // UUID
      await _refreshAll();
    });
  });
}
```

- [ ] **Step 2 : Rendre `_refreshWalkins` async**

```js
async function _refreshWalkins() {
  const spots = await getReservations(dateISO, slot.id);
  const items = Object.entries(spots).filter(([, r]) => r.type === 'walkin');
  const section = document.getElementById('plan-walkins-section');
  if (!section) return;
  if (items.length === 0) { section.style.display = 'none'; return; }
  section.style.display = '';
  const capEl = document.getElementById('cap-walkins');
  if (capEl) capEl.textContent = items.length;
  const listEl = document.getElementById('planning-list-walkins');
  if (!listEl) return;
  listEl.innerHTML = items.map(([spotId, r]) => {
    const acc = r.accompagnants === 0 ? 'seul·e' : r.accompagnants === 1 ? '1 acc.' : r.accompagnants + ' acc.';
    return '<div class="planning-list-item"><span>' + r.prenom + ' ' + r.nom + ' — ' + acc + ' (' + spotId + ')</span></div>';
  }).join('');
}
```

- [ ] **Step 3 : Rendre `_refreshAll` async**

```js
async function _refreshAll() {
  await Promise.all([
    _refreshSection('normal', 'planning-list-normal', 'cap-normal', CAPACITY_NORMAL),
    _refreshSection('groupe', 'planning-list-groupe', 'cap-groupe', CAPACITY_GROUPE),
    _refreshWalkins(),
  ]);
}
```

- [ ] **Step 4 : Rendre le handler "Add" async (validation capacité)**

```js
// Avant
document.getElementById('pf-add').addEventListener('click', () => {
  // ...
  const all = getReservationList(dateISO, slot.id);
  const count = all.filter(...).length;
  const arrivedCount = ...Object.values(getReservations(dateISO, slot.id))...;
  // ...
  callbacks.onAdd({ nom, prenom, accompagnants, resaType });
  _refreshAll();
});

// Après
document.getElementById('pf-add').addEventListener('click', async () => {
  const prenom = document.getElementById('pf-prenom').value.trim();
  const nom    = document.getElementById('pf-nom').value.trim().toUpperCase();
  const accompagnants = parseInt(document.querySelector('#pf-accomp .radio-btn.selected').dataset.value);
  const resaType      = document.querySelector('#pf-type .radio-btn.selected').dataset.value;
  const errEl = document.getElementById('pf-error');

  if (!prenom || !nom) { errEl.textContent = 'Prénom et nom sont obligatoires.'; return; }

  const [all, spotsMap] = await Promise.all([
    getReservationList(dateISO, slot.id),
    getReservations(dateISO, slot.id),
  ]);
  const count = all.filter(r => resaType === 'normal'
    ? (!r.resaType || r.resaType === 'normal') : r.resaType === 'groupe').length;
  const arrivedCount = resaType === 'normal'
    ? Object.values(spotsMap).filter(r => r.type === 'reserved').length : 0;
  const limit = resaType === 'normal' ? CAPACITY_NORMAL : CAPACITY_GROUPE;
  if (count + arrivedCount >= limit) {
    errEl.textContent = 'Capacité maximale atteinte (' + limit + ').';
    return;
  }

  errEl.textContent = '';
  await callbacks.onAdd({ nom, prenom, accompagnants, resaType });
  document.getElementById('pf-prenom').value = '';
  document.getElementById('pf-nom').value    = '';
  document.getElementById('pf-prenom').focus();
  await _refreshAll();
});
```

- [ ] **Step 5 : Appeler `_refreshAll()` au démarrage de façon async**

```js
// Avant (fin de openSlotPlanningModal)
_refreshAll();
_dialog().classList.add('plan-dialog');
_dialog().showModal();

// Après
_dialog().classList.add('plan-dialog');
_dialog().showModal();
document.getElementById('pf-prenom').focus();
_refreshAll(); // fire-and-forget async
```

- [ ] **Step 6 : Vérifier les tests**

```
node tests/run-all.js
```
Attendu : `✅ Tous les tests passent`

- [ ] **Step 7 : Commit**

```bash
git add js/modal.js
git commit -m "feat: modal.js — openSlotPlanningModal async, UUID boutons suppression planning"
```

---

## Task 11 : Mettre à jour `index.html`

**Files:**
- Modify: `index.html`

### Contexte

`index.html` charge les scripts dans cet ordre. Il faut :
1. Ajouter les 3 nouveaux modules Supabase **avant** les fichiers qui les utilisent
2. Supprimer `js/storage.js`
3. Ajouter `requireStaffAuth()` au démarrage

- [ ] **Step 1 : Vérifier l'ordre actuel des scripts dans `index.html`**

Localiser la section `<script>` tags. L'ordre actuel ressemble à :
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/env.js"></script>
<script src="js/supabase-client.js"></script>
<script src="js/auth.js"></script>
<script src="js/data.js"></script>
<script src="js/slots.js"></script>
<script src="js/storage.js"></script>
<script src="js/pass.js"></script>
<script src="js/inscription.js"></script>
<script src="js/mc.js"></script>
<script src="js/planning.js"></script>
<script src="js/map.js"></script>
<script src="js/panel.js"></script>
<script src="js/modal.js"></script>
<script src="js/app.js"></script>
```

- [ ] **Step 2 : Remplacer `storage.js` par les 3 nouveaux modules, dans l'ordre correct**

```html
<!-- Avant -->
<script src="js/storage.js"></script>

<!-- Après (remplacer storage.js par) -->
<script src="js/supabase-storage.js"></script>
<script src="js/supabase-inscriptions.js"></script>
<script src="js/supabase-mc.js"></script>
```

L'ordre doit être :
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/env.js"></script>
<script src="js/supabase-client.js"></script>
<script src="js/auth.js"></script>
<script src="js/data.js"></script>
<script src="js/slots.js"></script>
<script src="js/supabase-storage.js"></script>
<script src="js/supabase-inscriptions.js"></script>
<script src="js/supabase-mc.js"></script>
<script src="js/pass.js"></script>
<script src="js/inscription.js"></script>
<script src="js/mc.js"></script>
<script src="js/planning.js"></script>
<script src="js/map.js"></script>
<script src="js/panel.js"></script>
<script src="js/modal.js"></script>
<script src="js/app.js"></script>
```

- [ ] **Step 3 : Ajouter le guard d'authentification staff**

Avant le `</body>` (ou dans un `<script>` inline existant), ajouter :

```html
<script>
  (async function() {
    var session = await requireStaffAuth();
    if (!session) return; // requireStaffAuth redirige si nécessaire
    document.addEventListener('DOMContentLoaded', function() {
      var mapEl = document.getElementById('beach-map');
      renderMapStatic(mapEl);
      App.init();
    });
  })();
</script>
```

Vérifier si `DOMContentLoaded` est déjà câblé en bas de `app.js`. Si oui, supprimer le câblage en bas de `app.js` (lignes 360-364) et laisser uniquement le câblage ci-dessus avec le guard auth.

- [ ] **Step 4 : Vérifier les tests**

```
node tests/run-all.js
```
Attendu : `✅ Tous les tests passent`

- [ ] **Step 5 : Commit**

```bash
git add index.html
git commit -m "feat: index.html — supabase storage modules + auth guard staff, suppression storage.js ref"
```

---

## Task 12 : Subscriptions Realtime MC

**Files:**
- Modify: `js/app.js`

### Contexte

Les subscriptions `reservations` et `inscriptions` ont été ajoutées dans Task 9. Il reste à brancher la subscription `main_courante` pour que les changements MC sur d'autres tablettes se reflètent en temps réel.

- [ ] **Step 1 : Brancher la subscription MC dans `showView`**

Dans `app.js::showView`, quand on passe à la vue MC, abonner au canal MC et se désabonner en quittant :

```js
// Dans showView, au début
// Se désabonner MC si on quitte la vue MC
if (_currentView === 'mc' && view !== 'mc' && typeof unsubscribeMc === 'function') {
  unsubscribeMc();
}

// ... (le reste de showView)

if (view === 'mc') {
  if (mcView) mcView.style.display = 'flex';
  if (btnMc)  btnMc.classList.add('active');
  // S'abonner aux changements MC pour la date courante
  if (typeof subscribeMc === 'function') {
    subscribeMc(_mcDate, function() { _renderMc(); });
  }
  _renderMc();
}
```

- [ ] **Step 2 : Ré-abonner quand la date MC change**

Dans les callbacks de navigation MC, ré-abonner après le changement de date :

```js
container._onMcPrev = () => {
  _mcDate = _mcDateOffset(_mcDate, -1);
  if (typeof subscribeMc === 'function') subscribeMc(_mcDate, function() { _renderMc(); });
  _renderMc();
};
container._onMcNext = () => {
  const next = _mcDateOffset(_mcDate, +1);
  if (next <= _date) {
    _mcDate = next;
    if (typeof subscribeMc === 'function') subscribeMc(_mcDate, function() { _renderMc(); });
    _renderMc();
  }
};
container._onMcToday = () => {
  _mcDate = _date;
  if (typeof subscribeMc === 'function') subscribeMc(_mcDate, function() { _renderMc(); });
  _renderMc();
};
container._onMcGoto = d => {
  _mcDate = d;
  if (typeof subscribeMc === 'function') subscribeMc(_mcDate, function() { _renderMc(); });
  _renderMc();
};
```

- [ ] **Step 3 : Vérifier les tests**

```
node tests/run-all.js
```
Attendu : `✅ Tous les tests passent`

- [ ] **Step 4 : Commit**

```bash
git add js/app.js
git commit -m "feat: Realtime MC subscription dans showView + navigation date"
```

---

## Checklist de vérification finale (navigateur)

Après la dernière tâche, tester manuellement dans le navigateur :

**Réservations / carte**
- [ ] Sélectionner un créneau → spots et liste d'attente se chargent depuis Supabase
- [ ] Ajouter une réservation → apparaît dans la liste d'attente
- [ ] Assigner un spot → spot passe en "présent", entrée supprimée de la liste d'attente
- [ ] Walk-in → spot passe en "présent" sans liste d'attente
- [ ] Marquer départ → spot passe en "parti"
- [ ] Ouvrir le profil d'un présent → historique du jour s'affiche
- [ ] Modifier le nombre d'accompagnants → sauvegardé en DB

**Planning**
- [ ] Vue planning affiche les compteurs corrects
- [ ] Cliquer sur une cellule → modale de planning
- [ ] Ajouter une réservation dans la modale → compteur mis à jour
- [ ] Supprimer une réservation → supprimée par UUID (sans décalage d'indices)
- [ ] Exporter PDF → génère le PDF avec les données correctes

**Main courante**
- [ ] Remplir les champs staff (blur) → sauvegardé
- [ ] Compteurs manuels → sauvegardés
- [ ] Ajouter une note → sauvegardée
- [ ] Historique → liste les dates avec données

**Inscriptions**
- [ ] Liste des inscriptions charge depuis Supabase
- [ ] Créer une nouvelle inscription → UUID Supabase assigné
- [ ] Changer statut → 'valide' déclenche invitation email
- [ ] Activer le pass → `pass_actif = true` en DB

**Sync Realtime**
- [ ] Ouvrir l'app sur deux onglets → action sur onglet 1 se reflète sur onglet 2 en <2s

**Pass autocomplete**
- [ ] Taper un prénom dans "Ajouter réservation" → suggestions apparaissent
- [ ] Pass épuisé → badge "Pass épuisé" affiché, bouton désactivé
