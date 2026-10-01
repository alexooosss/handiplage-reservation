# Renouvellement saisonnier des inscriptions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate usager access to `statut = 'valide'` AND `derniere_saison_validee = saison_courante`, so a validated account from a past season no longer grants access until the usager renews and staff re-validates — with the pass auto-granted on every validation.

**Architecture:** One new config table (`app_config`, singleton row holding `saison_courante`) and one new nullable column on `inscriptions` (`derniere_saison_validee`). A pure function `computeUsagerAccessState(inscription, saisonCourante)` derives one of 5 UI states from `statut` + `derniere_saison_validee` + `saison_courante`. The usager-side renewal write goes through a `SECURITY DEFINER` Postgres function (`request_renewal()`) rather than a direct RLS-gated UPDATE, since the usager currently has read-only RLS access to their own `inscriptions` row and a broad UPDATE grant would let them tamper with other columns.

**Tech Stack:** Vanilla JS (no framework), Supabase (Postgres + PostgREST + RLS), Node `assert` for tests (no test framework — see `tests/run-all.js`).

**Reference spec:** `docs/superpowers/specs/2026-09-30-renouvellement-saisonnier-design.md`

---

## Important conventions in this codebase (read before starting)

- **No migration runner.** `supabase/schema.sql` and `supabase/rls.sql` are the source of truth for a *fresh* install, edited directly. Changes to the *live* Supabase project are applied manually by the user via the Supabase SQL Editor (confirmed by prior sessions — `rls.sql` was applied this way). Task 1 below produces both: the updated source files, and a standalone SQL block for the user to run once, by hand, against the live project.
- **Tests are plain Node scripts** run with `node tests/test-x.js`, asserting with the built-in `assert` module — no Jest/Mocha. Only **pure, synchronous functions** are unit tested in this codebase (row↔object mappers, calculators). Async Supabase-calling functions (`getInscriptions`, `createUserReservation`, etc.) have no dedicated tests — this plan follows that existing convention and does not invent DB mocking infra for the new async wrappers.
- `tests/run-all.js` lists every test file explicitly — any new test file must be added there.

---

### Task 1: Schema, RLS, and the `request_renewal()` function

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `supabase/rls.sql`

- [ ] **Step 1: Add the `derniere_saison_validee` column to the `inscriptions` table definition**

In `supabase/schema.sql`, find the `CREATE TABLE inscriptions` block and add the new column right after `pass_activated_at`:

```sql
CREATE TABLE inscriptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nom              text NOT NULL,
  prenom           text NOT NULL,
  mail             text,
  telephone        text,
  statut           text NOT NULL DEFAULT 'en_attente'
                     CHECK (statut IN ('en_attente', 'valide', 'refuse')),
  pass_actif       boolean NOT NULL DEFAULT false,
  pass_activated_at date,
  derniere_saison_validee int,
  metadata         jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Add the `app_config` table**

In `supabase/schema.sql`, right after the `inscriptions` table block (before `CREATE TABLE creneaux`), add:

```sql
-- Table de config (ligne unique) : pilotage de la saison en cours
CREATE TABLE app_config (
  id              int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  saison_courante int NOT NULL
);

INSERT INTO app_config (id, saison_courante) VALUES (1, 2026);
```

- [ ] **Step 3: Add the `request_renewal()` function**

In `supabase/schema.sql`, right after the existing `auth_user_role()` function (after line 11, before `-- Table inscriptions`), add:

```sql
-- Demande de renouvellement par l'usager lui-même. SECURITY DEFINER : contourne
-- RLS pour ne modifier QUE le statut de sa propre ligne (l'usager n'a qu'un accès
-- RLS en lecture sur inscriptions — voir inscriptions_user_read_own dans rls.sql).
CREATE OR REPLACE FUNCTION public.request_renewal()
RETURNS inscriptions AS $$
DECLARE
  result inscriptions;
BEGIN
  UPDATE inscriptions
  SET statut = 'en_attente', updated_at = now()
  WHERE user_id = auth.uid() AND statut = 'valide'
  RETURNING * INTO result;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Aucune inscription valide à renouveler pour cet utilisateur';
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 4: Add RLS policies for `app_config`**

In `supabase/rls.sql`, append at the end of the file:

```sql
-- ── Policies table app_config ────────────────────────────────────────────

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Lecture : tout utilisateur connecté (staff + usager) doit pouvoir lire la
-- saison en cours pour calculer son état d'accès.
CREATE POLICY "app_config_read_all" ON app_config
  FOR SELECT TO authenticated
  USING (true);

-- Écriture : staff uniquement (bouton "Ouvrir la saison").
CREATE POLICY "app_config_staff_write" ON app_config
  FOR UPDATE TO authenticated
  USING (public.auth_user_role() = 'staff')
  WITH CHECK (public.auth_user_role() = 'staff');
```

- [ ] **Step 5: Apply to the live Supabase project (manual, one-time)**

This step is not automatable from this plan — the engineer (or the user) must open the Supabase Dashboard → SQL Editor for this project and run the following block once. It's the incremental equivalent of Steps 1–4 (an `ALTER TABLE`, since the live `inscriptions` table already exists and can't be re-run through `CREATE TABLE`):

```sql
ALTER TABLE inscriptions ADD COLUMN derniere_saison_validee int;

CREATE TABLE app_config (
  id              int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  saison_courante int NOT NULL
);
INSERT INTO app_config (id, saison_courante) VALUES (1, 2026);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_config_read_all" ON app_config
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "app_config_staff_write" ON app_config
  FOR UPDATE TO authenticated
  USING (public.auth_user_role() = 'staff')
  WITH CHECK (public.auth_user_role() = 'staff');

CREATE OR REPLACE FUNCTION public.request_renewal()
RETURNS inscriptions AS $$
DECLARE
  result inscriptions;
BEGIN
  UPDATE inscriptions
  SET statut = 'en_attente', updated_at = now()
  WHERE user_id = auth.uid() AND statut = 'valide'
  RETURNING * INTO result;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Aucune inscription valide à renouveler pour cet utilisateur';
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Backfill : les comptes déjà validés ne doivent pas être forcés au renouvellement
-- rétroactivement sur le parc existant.
UPDATE inscriptions SET derniere_saison_validee = 2026 WHERE statut = 'valide';
```

Confirm with the user that this SQL has been run before proceeding to later tasks that depend on it functioning against the live project (Task 4 onward will fail against a live Supabase instance without it — the local test suite in Tasks 2–3 does not need it, since those tests only exercise pure JS functions).

- [ ] **Step 6: Commit**

```bash
git add supabase/schema.sql supabase/rls.sql
git commit -m "feat(db): app_config table, derniere_saison_validee column, request_renewal() function"
```

---

### Task 2: Pure access-state logic in `js/usager-storage.js`

**Files:**
- Modify: `js/usager-storage.js`
- Create: `tests/test-usager-renewal.js`
- Modify: `tests/run-all.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/test-usager-renewal.js`:

```js
// tests/test-usager-renewal.js
'use strict';
const assert = require('assert');

global.window = undefined;
global.supabaseClient = null;

const {
  _rowToUsagerInscription,
  computeUsagerAccessState,
} = require('../js/usager-storage.js');

// ── _rowToUsagerInscription : derniereSaisonValidee ──

// 1. Valeur présente en DB
{
  const row = {
    id: 'uuid-1', nom: 'MARTIN', prenom: 'André', mail: null, telephone: null,
    statut: 'valide', pass_actif: true, pass_activated_at: '2026-06-01',
    derniere_saison_validee: 2026, metadata: {},
  };
  const obj = _rowToUsagerInscription(row);
  assert.strictEqual(obj.derniereSaisonValidee, 2026,
    '_rowToUsagerInscription: derniereSaisonValidee mappé depuis derniere_saison_validee');
}

// 2. Valeur null (jamais validé)
{
  const row = {
    id: 'uuid-2', nom: 'DUPONT', prenom: 'Claire', mail: null, telephone: null,
    statut: 'en_attente', pass_actif: false, pass_activated_at: null,
    derniere_saison_validee: null, metadata: {},
  };
  const obj = _rowToUsagerInscription(row);
  assert.strictEqual(obj.derniereSaisonValidee, null,
    '_rowToUsagerInscription: derniereSaisonValidee null quand jamais validé');
}

// ── computeUsagerAccessState ──

// 3. Refusé → 'refuse'
{
  const state = computeUsagerAccessState({ statut: 'refuse', derniereSaisonValidee: null }, 2026);
  assert.strictEqual(state, 'refuse', 'refuse quel que soit derniereSaisonValidee');
}

// 4. En attente, jamais validé → 'premiere_demande'
{
  const state = computeUsagerAccessState({ statut: 'en_attente', derniereSaisonValidee: null }, 2026);
  assert.strictEqual(state, 'premiere_demande', '1ère demande jamais validée');
}

// 5. En attente, déjà validé une saison passée → 'renouvellement_attente'
{
  const state = computeUsagerAccessState({ statut: 'en_attente', derniereSaisonValidee: 2025 }, 2026);
  assert.strictEqual(state, 'renouvellement_attente', 'renouvellement soumis, en attente de validation staff');
}

// 6. Valide, saison à jour → 'actif'
{
  const state = computeUsagerAccessState({ statut: 'valide', derniereSaisonValidee: 2026 }, 2026);
  assert.strictEqual(state, 'actif', 'accès normal quand la saison validée = saison courante');
}

// 7. Valide, saison passée → 'a_renouveler'
{
  const state = computeUsagerAccessState({ statut: 'valide', derniereSaisonValidee: 2025 }, 2026);
  assert.strictEqual(state, 'a_renouveler', 'blocage renouvellement quand la saison validée != saison courante');
}

// 8. Valide, jamais de derniereSaisonValidee (cas défensif, ne devrait pas arriver en pratique) → 'a_renouveler'
{
  const state = computeUsagerAccessState({ statut: 'valide', derniereSaisonValidee: null }, 2026);
  assert.strictEqual(state, 'a_renouveler', 'valide sans saison stampée = doit renouveler');
}

console.log('✓ test-usager-renewal.js OK');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/test-usager-renewal.js`
Expected: `TypeError: computeUsagerAccessState is not a function` (or similar — the function doesn't exist yet, and `derniereSaisonValidee` isn't mapped yet).

- [ ] **Step 3: Implement `derniereSaisonValidee` mapping and `computeUsagerAccessState`**

In `js/usager-storage.js`, modify `_rowToUsagerInscription` (around line 6) to add the new field:

```js
function _rowToUsagerInscription(row) {
  var obj = {
    id:                 row.id,
    nom:                row.nom,
    prenom:             row.prenom,
    mail:               row.mail,
    telephone:          row.telephone,
    statut:             row.statut,
    passActif:          !!row.pass_actif,
    passActivatedAt:    row.pass_activated_at || null,
    derniereSaisonValidee: row.derniere_saison_validee || null,
  };
  if (row.metadata && typeof row.metadata === 'object') {
    Object.assign(obj, row.metadata);
  }
  return obj;
}
```

Add the new pure function right after `isAbsenceBlocked` (around line 70), before `getUserInscription`:

```js
/**
 * Dérive l'état d'accès usager à partir du statut d'inscription et de la
 * saison en cours. 5 états possibles :
 *   'refuse'                 — demande refusée
 *   'premiere_demande'       — jamais validé, 1ère demande en attente
 *   'renouvellement_attente' — déjà validé une saison passée, renouvellement soumis, en attente
 *   'actif'                  — validé pour la saison en cours, accès normal
 *   'a_renouveler'           — validé mais pour une saison différente, doit renouveler
 */
function computeUsagerAccessState(inscription, saisonCourante) {
  if (inscription.statut === 'refuse') return 'refuse';
  if (inscription.statut === 'en_attente') {
    return inscription.derniereSaisonValidee ? 'renouvellement_attente' : 'premiere_demande';
  }
  // statut === 'valide'
  return inscription.derniereSaisonValidee === saisonCourante ? 'actif' : 'a_renouveler';
}
```

Add `computeUsagerAccessState` to `module.exports` at the bottom of the file:

```js
if (typeof module !== 'undefined') {
  module.exports = { _rowToUsagerInscription, _rowToUsagerReservation, computePassBalance, canCancelReservation, getAbsentsThisMonth, isAbsenceBlocked, sendUsagerMessage, computeUsagerAccessState };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/test-usager-renewal.js`
Expected: `✓ test-usager-renewal.js OK`

- [ ] **Step 5: Register the new test file in `tests/run-all.js`**

In `tests/run-all.js`, add `'test-usager-renewal.js'` to the `tests` array:

```js
const tests = ['test-slots.js', 'test-timer.js', 'test-storage.js', 'test-pass.js', 'test-auth.js', 'test-supabase-inscriptions.js', 'test-supabase-mc.js', 'test-supabase-storage.js', 'test-inscription-publique.js', 'test-supabase-messages.js', 'test-usager-storage.js', 'test-supabase-geo.js', 'test-usager-renewal.js'];
```

- [ ] **Step 6: Run the full suite to confirm nothing else broke**

Run: `node tests/run-all.js`
Expected: `✅ Tous les tests passent.`

- [ ] **Step 7: Commit**

```bash
git add js/usager-storage.js tests/test-usager-renewal.js tests/run-all.js
git commit -m "feat(usager): computeUsagerAccessState + derniereSaisonValidee mapping"
```

---

### Task 3: `derniere_saison_validee` in `js/supabase-inscriptions.js` (staff-side CRUD)

**Files:**
- Modify: `js/supabase-inscriptions.js`
- Modify: `tests/test-supabase-inscriptions.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/test-supabase-inscriptions.js`, right before the final `console.log('✓ test-supabase-inscriptions.js OK');` line:

```js
// 10. derniereSaisonValidee mappé depuis derniere_saison_validee
{
  const row = {
    id: 'uuid-10', nom: 'ROUX', prenom: 'Julie', mail: null, telephone: null,
    statut: 'valide', pass_actif: true, pass_activated_at: '2026-06-01',
    derniere_saison_validee: 2026,
    created_at: '2026-06-01T10:00:00Z', updated_at: '2026-06-01T10:00:00Z', metadata: {},
  };
  const obj = _rowToInscription(row);
  assert.strictEqual(obj.derniereSaisonValidee, 2026,
    '_rowToInscription: derniereSaisonValidee mappé depuis derniere_saison_validee');
}

// 11. derniereSaisonValidee null quand absent
{
  const row = {
    id: 'uuid-11', nom: 'ROUX', prenom: 'Julie', mail: null, telephone: null,
    statut: 'en_attente', pass_actif: false, pass_activated_at: null,
    derniere_saison_validee: null,
    created_at: '2026-06-01T10:00:00Z', updated_at: '2026-06-01T10:00:00Z', metadata: {},
  };
  const obj = _rowToInscription(row);
  assert.strictEqual(obj.derniereSaisonValidee, null,
    '_rowToInscription: derniereSaisonValidee null');
}

// 12. derniere_saison_validee n'est jamais spillé dans metadata
{
  const data = {
    nom: 'ROUX', prenom: 'Julie', mail: null, telephone: null, statut: 'valide', pass: null,
    derniereSaisonValidee: 2026,
  };
  const row = _inscriptionToRow(data);
  assert.strictEqual(row.metadata.derniereSaisonValidee, undefined,
    '_inscriptionToRow: derniereSaisonValidee absent de metadata');
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/test-supabase-inscriptions.js`
Expected: FAIL — `obj.derniereSaisonValidee` is `undefined`, not `2026`.

- [ ] **Step 3: Implement**

In `js/supabase-inscriptions.js`, add to `STRUCTURED_COLS` (around line 4-12):

```js
var STRUCTURED_COLS = [
  'id', 'user_id',
  'nom', 'prenom', 'mail', 'telephone',
  'statut',
  'pass_actif', 'pass_activated_at',
  'derniere_saison_validee',
  'created_at', 'updated_at',
  // champs locaux gérés séparément
  'pass', 'createdAt', 'updatedAt', 'derniereSaisonValidee',
];
```

Add to `_rowToInscription` (around line 21-45), inside the returned `obj`:

```js
function _rowToInscription(row) {
  var obj = {
    id:        row.id,
    nom:       row.nom,
    prenom:    row.prenom,
    mail:      row.mail,
    telephone: row.telephone,
    statut:    row.statut,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pass: row.pass_actif
      ? { actif: true, activatedAt: row.pass_activated_at }
      : null,
    derniereSaisonValidee: row.derniere_saison_validee !== undefined ? row.derniere_saison_validee : null,
  };

  // Étale les champs metadata au top-level
  if (row.metadata && typeof row.metadata === 'object') {
    var keys = Object.keys(row.metadata);
    for (var i = 0; i < keys.length; i++) {
      obj[keys[i]] = row.metadata[keys[i]];
    }
  }

  return obj;
}
```

Add to `updateInscription` (around line 141-151), matching the existing convention of raw DB column names for `pass_actif`/`pass_activated_at`:

```js
async function updateInscription(id, partial) {
  var row = {};
  if (partial.statut                    !== undefined) row.statut                    = partial.statut;
  if (partial.pass_actif                !== undefined) row.pass_actif                = partial.pass_actif;
  if (partial.pass_activated_at         !== undefined) row.pass_activated_at         = partial.pass_activated_at;
  if (partial.derniere_saison_validee   !== undefined) row.derniere_saison_validee   = partial.derniere_saison_validee;
  if (partial.nom                       !== undefined) row.nom                       = partial.nom;
  if (partial.prenom                    !== undefined) row.prenom                    = partial.prenom;
  if (partial.mail                      !== undefined) row.mail                      = partial.mail;
  if (partial.telephone                 !== undefined) row.telephone                 = partial.telephone;
  if (partial.metadata                  !== undefined) row.metadata                  = partial.metadata;
  row.updated_at = new Date().toISOString();

  var result = await supabaseClient
    .from('inscriptions')
    .update(row)
    .eq('id', id)
    .select()
    .single();
  if (result.error) throw result.error;
  var updated = _rowToInscription(result.data);

  if (_inscriptionsCache !== null) {
    var idx = _inscriptionsCache.findIndex(function(i) { return i.id === id; });
    if (idx !== -1) _inscriptionsCache[idx] = updated;
  }

  return updated;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/test-supabase-inscriptions.js`
Expected: `✓ test-supabase-inscriptions.js OK`

- [ ] **Step 5: Run the full suite**

Run: `node tests/run-all.js`
Expected: `✅ Tous les tests passent.`

- [ ] **Step 6: Commit**

```bash
git add js/supabase-inscriptions.js tests/test-supabase-inscriptions.js
git commit -m "feat(staff): derniere_saison_validee dans supabase-inscriptions.js"
```

---

### Task 4: New module `js/supabase-config.js` + `requestRenewal()`

**Files:**
- Create: `js/supabase-config.js`
- Modify: `js/usager-storage.js`
- Modify: `index.html`
- Modify: `usager.html`

No TDD here: both functions are thin Supabase wrappers with no pure logic to isolate, matching the existing convention in this codebase where async DB-calling functions (`getInscriptions`, `createUserReservation`, `getUserInscription`, etc.) have no dedicated unit tests.

- [ ] **Step 1: Create `js/supabase-config.js`**

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

/**
 * Incrémente saison_courante de 1. Réservé au staff (RLS app_config_staff_write).
 * Retourne la nouvelle valeur.
 */
async function ouvrirNouvelleSaison() {
  var courante = await getSaisonCourante();
  var result = await supabaseClient
    .from('app_config')
    .update({ saison_courante: courante + 1 })
    .eq('id', 1)
    .select('saison_courante')
    .single();
  if (result.error) throw result.error;
  return result.data.saison_courante;
}

if (typeof module !== 'undefined') {
  module.exports = { getSaisonCourante, ouvrirNouvelleSaison };
}
```

- [ ] **Step 2: Add `requestRenewal()` to `js/usager-storage.js`**

Add right after `getUserInscription` (around line 83), before `getAvailableDays`:

```js
/**
 * Demande de renouvellement : appelle la fonction SQL request_renewal(),
 * qui repasse le statut de l'inscription de l'usager connecté à 'en_attente'.
 */
async function requestRenewal() {
  var result = await supabaseClient.rpc('request_renewal');
  if (result.error) throw result.error;
  return _rowToUsagerInscription(result.data);
}
```

- [ ] **Step 3: Load `supabase-config.js` in the staff panel**

In `index.html`, insert right after the `supabase-inscriptions.js` line (currently line 103):

```html
  <script src="js/supabase-inscriptions.js"></script>
  <script src="js/supabase-config.js"></script>
```

- [ ] **Step 4: Load `supabase-config.js` in the usager app**

In `usager.html`, insert right after the `usager-storage.js` line (currently line 66):

```html
<script src="js/usager-storage.js"></script>
<script src="js/supabase-config.js"></script>
```

- [ ] **Step 5: Run the full suite (sanity check — no logic here should break existing tests)**

Run: `node tests/run-all.js`
Expected: `✅ Tous les tests passent.`

- [ ] **Step 6: Commit**

```bash
git add js/supabase-config.js js/usager-storage.js index.html usager.html
git commit -m "feat: supabase-config.js (saison_courante) + requestRenewal()"
```

---

### Task 5: Wire the 5-state UI into `js/usager-app.js`

**Files:**
- Modify: `js/usager-app.js`

No TDD — this is DOM-rendering glue code, consistent with the rest of `usager-app.js` (no existing test file covers it).

- [ ] **Step 1: Replace `init()`**

Replace the entire `init` function in `js/usager-app.js` (lines 9-31):

```js
  async function init() {
    var container = document.getElementById('usager-content');
    container.innerHTML = '<div class="usager-loading">Chargement de votre espace…</div>';

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

    var state = computeUsagerAccessState(_inscription, saisonCourante);

    if (state === 'refuse' || state === 'premiere_demande') {
      container.innerHTML = '<div class="usager-card" style="text-align:center;padding:32px">'
        + '<div style="font-size:2rem;margin-bottom:12px">⏳</div>'
        + '<div style="font-weight:700;margin-bottom:8px">Votre demande est en cours de traitement</div>'
        + '<div style="color:#666;font-size:.9375rem">Vous recevrez un email dès que votre inscription sera validée par notre équipe.</div>'
        + '</div>';
      return;
    }

    if (state === 'renouvellement_attente') {
      container.innerHTML = '<div class="usager-card" style="text-align:center;padding:32px">'
        + '<div style="font-size:2rem;margin-bottom:12px">⏳</div>'
        + '<div style="font-weight:700;margin-bottom:8px">Votre demande de renouvellement est en cours de traitement</div>'
        + '<div style="color:#666;font-size:.9375rem">Vous recevrez un email dès que votre inscription sera validée par notre équipe.</div>'
        + '</div>';
      return;
    }

    if (state === 'a_renouveler') {
      container.innerHTML = '<div class="usager-card" style="text-align:center;padding:32px">'
        + '<div style="font-size:2rem;margin-bottom:12px">🔄</div>'
        + '<div style="font-weight:700;margin-bottom:8px">Votre inscription doit être renouvelée pour la saison ' + saisonCourante + '</div>'
        + '<div style="color:#666;font-size:.9375rem;margin-bottom:20px">Vos informations restent enregistrées — cliquez ci-dessous pour soumettre votre demande de renouvellement.</div>'
        + '<button class="btn-primary" id="usager-renew-btn">Renouveler mon inscription</button>'
        + '</div>';
      var renewBtn = document.getElementById('usager-renew-btn');
      if (renewBtn) {
        renewBtn.addEventListener('click', async function() {
          renewBtn.disabled = true;
          renewBtn.textContent = 'Envoi en cours…';
          try {
            await requestRenewal();
            await init();
          } catch (e) {
            renewBtn.disabled = false;
            renewBtn.textContent = 'Renouveler mon inscription';
            alert('Erreur : ' + (e.message || e));
          }
        });
      }
      return;
    }

    showView('accueil');
  }
```

- [ ] **Step 2: Manual smoke test**

This view has no test coverage in the codebase and touches live Supabase auth/session state, so verify manually:
1. Run the app locally (see project's usual local-serving method, e.g. opening `usager.html` through the existing dev flow).
2. Log in as a usager whose `statut = 'valide'` and whose `derniere_saison_validee` (in the live DB, once Task 1 Step 5 SQL has run) matches `app_config.saison_courante` → confirm normal app access (`accueil` view shows).
3. In Supabase, manually set that inscription's `derniere_saison_validee` to a past year → reload → confirm the "Votre inscription doit être renouvelée…" screen appears with the working button.
4. Click the button → confirm the screen switches to "Votre demande de renouvellement est en cours de traitement".
5. In Supabase, confirm the row's `statut` is now `en_attente` and `derniere_saison_validee` is unchanged (still the old year).

- [ ] **Step 3: Commit**

```bash
git add js/usager-app.js
git commit -m "feat(usager): gating d'accès sur derniere_saison_validee + écran de renouvellement"
```

---

### Task 6: Staff UI — "Ouvrir la saison" button

**Files:**
- Modify: `js/inscription.js`

- [ ] **Step 1: Fetch `saisonCourante` and render the button in `renderInscription`**

Replace the top of `renderInscription` (lines 8-27) in `js/inscription.js`:

```js
async function renderInscription(container, selectedId) {
  const inscriptions = await getInscriptions();
  const saisonCourante = await getSaisonCourante();

  container.innerHTML = '<div class="insc-layout">'
    + '<div class="insc-sidebar">'
    +   '<div class="insc-sidebar-hd">'
    +     '<h2 class="insc-sidebar-title">Inscriptions</h2>'
    +     '<input type="search" id="insc-search" class="insc-search-inp" placeholder="Rechercher…">'
    +     '<button class="btn-primary" id="insc-new-btn">＋ Nouvelle inscription</button>'
    +     '<button class="btn-secondary" id="insc-open-season-btn" style="margin-top:8px">Ouvrir la saison ' + (saisonCourante + 1) + '</button>'
    +     '<div style="font-size:.8125rem;color:#666;margin-top:6px">Saison en cours : ' + saisonCourante + '</div>'
    +   '</div>'
    +   '<div id="insc-list" class="insc-list">' + _renderListItems(inscriptions, '') + '</div>'
    + '</div>'
    + '<div class="insc-main" id="insc-main">'
    +   '<div class="insc-empty">'
    +     ''
    +     '<p>Sélectionnez une inscription ou créez-en une nouvelle.</p>'
    +     '<p class="insc-count">' + inscriptions.length + ' inscription' + (inscriptions.length !== 1 ? 's' : '') + ' enregistrée' + (inscriptions.length !== 1 ? 's' : '') + '</p>'
    +   '</div>'
    + '</div>'
    + '</div>';

  document.getElementById('insc-search').addEventListener('input', async function() {
    const q = this.value.toLowerCase();
    const list = getCachedInscriptions() || await getInscriptions();
    document.getElementById('insc-list').innerHTML = _renderListItems(list, q);
    _bindListItems(container);
  });

  document.getElementById('insc-new-btn').addEventListener('click', function() {
    _showForm(container, null);
  });

  document.getElementById('insc-open-season-btn').addEventListener('click', async function() {
    if (!confirm('Ouvrir la saison ' + (saisonCourante + 1) + ' ?\n\nTous les comptes usagers validés pour la saison ' + saisonCourante + ' devront renouveler leur inscription pour continuer à réserver.')) return;
    await ouvrirNouvelleSaison();
    await renderInscription(container, selectedId);
  });

  _bindListItems(container);

  if (selectedId) {
    var target = container.querySelector('.insc-list-item[data-id="' + selectedId + '"]');
    if (target) { target.click(); target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  }
}
```

- [ ] **Step 2: Auto-grant the pass and stamp `derniere_saison_validee` on validation**

Replace the `statutEl.addEventListener('change', ...)` block (lines 271-302):

```js
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
```

Note: the manual pass toggle buttons (`_bindPassButtons`, lines 359-379) are untouched — staff can still deactivate the auto-granted pass afterward, per the approved design.

- [ ] **Step 3: Run the full test suite (sanity check)**

Run: `node tests/run-all.js`
Expected: `✅ Tous les tests passent.`

- [ ] **Step 4: Manual smoke test**

1. Open the staff panel, select an inscription with `statut = 'en_attente'`.
2. Switch the status dropdown to "Validé ✓".
3. Confirm the pass block appears as active (`Actif depuis le <today>`) without manually clicking "Activer le pass".
4. In Supabase, confirm `derniere_saison_validee` on that row now equals `app_config.saison_courante`.
5. Click "Ouvrir la saison {N+1}", confirm the dialog, accept it.
6. Confirm the button label and "Saison en cours" text update to the new year.
7. Reload the usager app for that same usager (now stale relative to the new season) → confirm they see "Votre inscription doit être renouvelée…".

- [ ] **Step 5: Commit**

```bash
git add js/inscription.js
git commit -m "feat(staff): bouton ouverture de saison + auto-attribution du pass à la validation"
```

---

### Task 7: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite one last time**

Run: `node tests/run-all.js`
Expected: `✅ Tous les tests passent.`

- [ ] **Step 2: Confirm the Task 1 Step 5 manual SQL has been run against the live Supabase project**

Ask the user to confirm (or confirm yourself via the Supabase dashboard, if you have access) that the SQL block from Task 1 Step 5 has been executed. Nothing in Tasks 4-6 will work against the live app without it — `getSaisonCourante()` will throw (`app_config` table doesn't exist / RLS not configured), `request_renewal()` won't exist as a callable RPC, and `derniere_saison_validee` won't exist as a column.

- [ ] **Step 3: Do not push**

Per project convention, changes are committed locally but **not pushed** to the remote until the user explicitly asks for it.

---

### Task 8: Defense-in-depth — block reservations when the season isn't renewed

**Why:** Task 6's code quality review traced the full renewal loop end-to-end and found that the "must renew" gate only exists in `usager-app.js`'s router. `createUserReservation()` only checks `inscription.passActif` — never `statut` or `derniere_saison_validee` vs `saison_courante`. Nothing in this feature ever clears `pass_actif` on renewal (it stays `true` from the prior season), so a usager routed to the "à renouveler" screen could still successfully reserve if the reservation function were ever reached directly (a stale tab left open on the `reserver` view when staff opens a new season mid-session, a console call, a future routing bug). The UI redirect alone doesn't satisfy the feature's actual goal — the account must not be able to act as active until renewed, not just avoid being shown the button. Confirmed with user: add the guard, scoped to `createUserReservation()` only (no RLS/SQL changes — out of scope for this task).

**Files:**
- Modify: `js/usager-storage.js`

No TDD: `createUserReservation` is an async Supabase-calling function with no dedicated tests in this codebase (same convention as its existing `SEASON_END` and absence-blocking guards, neither of which is unit tested either).

- [ ] **Step 1: Add the season guard**

In `js/usager-storage.js`, in `createUserReservation`, add a new guard right after the existing `SEASON_END` check and before the absence-blocking check:

```js
async function createUserReservation(inscription, dateISO, creneauId) {
  if (!inscription.passActif) throw new Error('Pass non activé. Contactez l\'équipe Handiplage.');
  if (inscription.isDemo) throw new Error('Compte démo — aucune réservation n\'est enregistrée.');

  // Fermeture saisonnière : aucune réservation au-delà du 15 septembre
  if (typeof SEASON_END !== 'undefined' && dateISO > SEASON_END) {
    throw new Error('La Handiplage est fermée pour la saison — aucune réservation possible après le 15 septembre.');
  }

  // Inscription non renouvelée pour la saison en cours : le routeur usager-app.js
  // bloque déjà l'accès à cette vue, mais on revérifie ici en profondeur — pass_actif
  // n'est jamais remis à false au changement de saison, donc rien d'autre n'empêcherait
  // un appel direct à cette fonction de réussir pour un compte non renouvelé.
  var saisonCourante = await getSaisonCourante();
  if (inscription.derniereSaisonValidee !== saisonCourante) {
    throw new Error('Votre inscription doit être renouvelée pour la saison en cours. Contactez l\'équipe Handiplage.');
  }

  // Vérification blocage absences (3 absences non justifiées ce mois)
  var absents = await getAbsentsThisMonth(inscription.id);
  ...
```

(Only the new block is added — the `// Vérification blocage absences` line and everything after it in the function is unchanged, shown here only to mark the exact insertion point.)

- [ ] **Step 2: Run the full test suite (sanity check)**

Run: `node tests/run-all.js`
Expected: `✅ Tous les tests passent.`

- [ ] **Step 3: Static verification**

No live Supabase project available. Confirm by reading the file that `getSaisonCourante` is in scope (global, from `js/supabase-config.js`, loaded in `usager.html` before `js/usager-storage.js`... actually loaded AFTER `usager-storage.js` in the current script order — confirm this is still fine, since `createUserReservation` is only ever CALLED later, in response to a user action, well after all `<script>` tags have executed and registered their global functions; declaration order between sibling `<script>` tags doesn't matter for later function calls, only execution-order side effects would, and neither file has any top-level side effects).

- [ ] **Step 4: Commit**

```bash
git add js/usager-storage.js
git commit -m "fix(usager): bloquer createUserReservation si la saison n'est pas renouvelée"
```

---

## Out of scope (per spec)

- A distinct technical path for "quick renewal" vs "full dossier update" (staff judgment call, no system branch).
- Automatic email notifications on season-open or on entering the "à renouveler" state.
- Archiving/history of past-season inscriptions as separate records (single row reused year over year).
- Automatic date-based season rollover (stays 100% staff-triggered).
