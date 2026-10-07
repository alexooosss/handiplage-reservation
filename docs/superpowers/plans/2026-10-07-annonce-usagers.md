# Annonce staff → tous les usagers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre au staff de publier une annonce visible par tous les usagers, affichée en priorité sur l'écran d'accueil usager, jusqu'à désactivation manuelle côté staff.

**Architecture:** Nouvelle table `annonces` (une ligne active à la fois, historique conservé). Nouvelle couche de données `js/supabase-annonces.js`. Nouveau composant staff autonome `js/annonces.js` monté dans la vue Messages existante. Ajout d'un bandeau dans `js/usager-accueil.js`.

**Tech Stack:** Vanilla JS (scripts globaux, pas de bundler), Supabase (Postgres + PostgREST + RLS), pas de framework de test (assert Node pour les fonctions pures uniquement).

**Référence spec :** `docs/superpowers/specs/2026-10-07-annonce-usagers-design.md`

---

### Task 1: Schéma et RLS — table `annonces`

**Files:**
- Modify: `supabase/schema.sql` (ajout après la définition de `app_config`, ligne ~63)
- Modify: `supabase/rls.sql` (ajout après la policy `staff_full_messages`, ligne ~54)

- [ ] **Step 1: Ajouter la table dans `supabase/schema.sql`**

Repérer ce bloc existant (lignes 54-63) :

```sql
-- Table de config (ligne unique) : pilotage de la saison en cours
CREATE TABLE app_config (
  id              int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  saison_courante int NOT NULL,
  saison_debut    date,
  saison_fin      date,
  CHECK (saison_debut IS NULL OR saison_fin IS NULL OR saison_debut <= saison_fin)
);

INSERT INTO app_config (id, saison_courante, saison_debut, saison_fin) VALUES (1, 2026, '2026-06-12', '2026-09-15');
```

Ajouter juste après (nouveau bloc, ne pas modifier le bloc existant) :

```sql
-- Table annonces : message staff diffusé à tous les usagers. Une seule
-- ligne actif=true à la fois (imposé côté appli dans createAnnonce(), pas
-- de contrainte DB). L'historique (lignes désactivées) est conservé.
CREATE TABLE annonces (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contenu    text NOT NULL,
  actif      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_annonces_actif ON annonces(actif) WHERE actif;
```

- [ ] **Step 2: Ajouter les policies dans `supabase/rls.sql`**

Repérer ce bloc existant (lignes 51-54) :

```sql
CREATE POLICY "staff_full_messages" ON messages
  FOR ALL
  USING (auth_user_role() = 'staff')
  WITH CHECK (auth_user_role() = 'staff');
```

Ajouter juste après :

```sql
-- ── Policies table annonces ──────────────────────────────────────────────

ALTER TABLE annonces ENABLE ROW LEVEL SECURITY;

-- Staff : lecture/écriture totale (création, désactivation, historique).
CREATE POLICY "staff_full_annonces" ON annonces
  FOR ALL
  USING (auth_user_role() = 'staff')
  WITH CHECK (auth_user_role() = 'staff');

-- Usagers (et anon) : lecture de l'annonce active uniquement — nécessaire
-- pour l'afficher sur l'écran d'accueil usager.
CREATE POLICY "annonces_select_active" ON annonces
  FOR SELECT TO anon, authenticated
  USING (actif = true);
```

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql supabase/rls.sql
git commit -m "feat(annonces): ajouter table annonces et policies RLS

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

**Note pour l'utilisateur :** ces deux fichiers sont la source de vérité pour une installation neuve — comme pour les features précédentes, c'est à toi d'exécuter ces blocs SQL manuellement dans l'éditeur SQL du Dashboard Supabase pour que la table existe réellement en base. Rien n'est appliqué automatiquement.

---

### Task 2: Couche de données `js/supabase-annonces.js`

**Files:**
- Create: `js/supabase-annonces.js`

- [ ] **Step 1: Créer le fichier**

```js
// js/supabase-annonces.js
'use strict';

function _rowToAnnonce(row) {
  return {
    id:        row.id,
    contenu:   row.contenu,
    actif:     !!row.actif,
    createdAt: row.created_at,
  };
}

/**
 * SELECT * FROM annonces WHERE actif = true (au plus une ligne)
 * Retourne null si aucune annonce active. Accessible usager + staff.
 */
async function getActiveAnnonce() {
  var result = await supabaseClient
    .from('annonces')
    .select('*')
    .eq('actif', true)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data ? _rowToAnnonce(result.data) : null;
}

/**
 * Historique complet, le plus récent d'abord. Réservé au staff (RLS
 * staff_full_annonces) — non consommé par l'UI en v1, prévu pour un futur
 * écran d'historique.
 */
async function getAnnonces() {
  var result = await supabaseClient
    .from('annonces')
    .select('*')
    .order('created_at', { ascending: false });
  if (result.error) throw result.error;
  return (result.data || []).map(_rowToAnnonce);
}

/**
 * Désactive l'annonce active existante (s'il y en a une), puis crée la
 * nouvelle ligne active. Deux requêtes séquentielles, pas de transaction :
 * en cas d'échec de l'insertion après la désactivation, aucune annonce ne
 * reste active (le staff republie). Réservé au staff (RLS).
 */
async function createAnnonce(contenu) {
  var deactivate = await supabaseClient
    .from('annonces')
    .update({ actif: false })
    .eq('actif', true);
  if (deactivate.error) throw deactivate.error;

  var result = await supabaseClient
    .from('annonces')
    .insert({ contenu: contenu, actif: true })
    .select('*')
    .single();
  if (result.error) throw result.error;
  return _rowToAnnonce(result.data);
}

/**
 * Désactive une annonce par id. Réservé au staff (RLS).
 */
async function deactivateAnnonce(id) {
  var result = await supabaseClient
    .from('annonces')
    .update({ actif: false })
    .eq('id', id);
  if (result.error) throw result.error;
}

if (typeof module !== 'undefined') {
  module.exports = { _rowToAnnonce, getActiveAnnonce, getAnnonces, createAnnonce, deactivateAnnonce };
}
```

- [ ] **Step 2: Vérifier qu'il n'y a pas de régression dans la suite de tests existante**

Run: `node tests/run-all.js`
Expected: tous les tests existants passent toujours (ce fichier n'ajoute aucune fonction pure, donc aucun nouveau test — conforme à la convention du projet : seules les fonctions pures synchrones sont testées).

- [ ] **Step 3: Commit**

```bash
git add js/supabase-annonces.js
git commit -m "feat(annonces): ajouter la couche de données supabase-annonces.js

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Charger `js/supabase-annonces.js` dans les deux pages

**Files:**
- Modify: `index.html:118` (avant `js/messages.js`)
- Modify: `usager.html:67` (avant `js/usager-accueil.js`)

- [ ] **Step 1: `index.html`**

Repérer (lignes 118-119) :

```html
  <script src="js/supabase-messages.js"></script>
  <script src="js/messages.js"></script>
```

Remplacer par :

```html
  <script src="js/supabase-messages.js"></script>
  <script src="js/supabase-annonces.js"></script>
  <script src="js/annonces.js"></script>
  <script src="js/messages.js"></script>
```

(`js/annonces.js` n'existe pas encore — il sera créé à la Task 4. L'ordre doit être respecté : couche de données avant composant, composant avant `messages.js` qui l'appelle.)

- [ ] **Step 2: `usager.html`**

Repérer (lignes 66-67) :

```html
<script src="js/usager-storage.js"></script>
<script src="js/supabase-config.js"></script>
<script src="js/usager-accueil.js"></script>
```

Remplacer par :

```html
<script src="js/usager-storage.js"></script>
<script src="js/supabase-config.js"></script>
<script src="js/supabase-annonces.js"></script>
<script src="js/usager-accueil.js"></script>
```

- [ ] **Step 3: Commit**

```bash
git add index.html usager.html
git commit -m "feat(annonces): charger supabase-annonces.js dans les deux pages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Composant staff `js/annonces.js` + CSS + intégration dans `js/messages.js`

**Files:**
- Create: `js/annonces.js`
- Modify: `js/messages.js:14` (renommer la fonction existante + ajouter le nouveau point d'entrée)
- Modify: `css/style.css` (ajout après le bloc `.msg-layout`, ligne ~1920)

- [ ] **Step 1: Créer `js/annonces.js`**

```js
// js/annonces.js
'use strict';

function _escAn(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _annonceBlockHtml(annonce) {
  if (annonce) {
    return '<div class="annonce-staff-block">'
      +   '<div class="annonce-staff-label">Annonce active — visible par tous les usagers</div>'
      +   '<div class="annonce-staff-text">' + _escAn(annonce.contenu).replace(/\n/g, '<br>') + '</div>'
      +   '<button type="button" class="btn-danger" id="annonce-btn-deactivate">Désactiver</button>'
      + '</div>';
  }
  return '<div class="annonce-staff-block">'
    +   '<div class="annonce-staff-label">Aucune annonce active</div>'
    +   '<textarea id="annonce-staff-textarea" rows="3" placeholder="Message visible par tous les usagers…" '
    +     'style="width:100%;padding:10px;border:1.5px solid #ccc;border-radius:8px;font-size:13px;resize:vertical;box-sizing:border-box"></textarea>'
    +   '<div style="margin-top:8px"><button type="button" class="btn-primary" id="annonce-btn-publish">Publier</button></div>'
    +   '<div id="annonce-staff-status" style="font-size:12px;margin-top:6px"></div>'
    + '</div>';
}

async function renderAnnonceStaffBlock(container) {
  var annonce;
  try {
    annonce = await getActiveAnnonce();
  } catch (e) {
    container.innerHTML = '<div class="annonce-staff-block">'
      + '<div class="annonce-staff-label" style="color:var(--red)">Erreur de chargement de l\'annonce : ' + _escAn(e.message) + '</div>'
      + '</div>';
    return;
  }

  container.innerHTML = _annonceBlockHtml(annonce);

  var btnPublish = container.querySelector('#annonce-btn-publish');
  if (btnPublish) {
    btnPublish.addEventListener('click', async function() {
      var textarea = container.querySelector('#annonce-staff-textarea');
      var status   = container.querySelector('#annonce-staff-status');
      var text     = textarea.value.trim();
      if (!text) {
        status.textContent = 'Veuillez écrire un message.';
        status.style.color = 'var(--red)';
        return;
      }
      btnPublish.disabled = true;
      btnPublish.textContent = 'Publication…';
      try {
        await createAnnonce(text);
        renderAnnonceStaffBlock(container);
      } catch (e) {
        btnPublish.disabled = false;
        btnPublish.textContent = 'Publier';
        status.textContent = 'Erreur : ' + e.message;
        status.style.color = 'var(--red)';
      }
    });
  }

  var btnDeactivate = container.querySelector('#annonce-btn-deactivate');
  if (btnDeactivate) {
    btnDeactivate.addEventListener('click', async function() {
      if (!confirm('Désactiver cette annonce ? Elle ne sera plus visible par les usagers.')) return;
      btnDeactivate.disabled = true;
      btnDeactivate.textContent = 'Désactivation…';
      try {
        await deactivateAnnonce(annonce.id);
        renderAnnonceStaffBlock(container);
      } catch (e) {
        btnDeactivate.disabled = false;
        btnDeactivate.textContent = 'Désactiver';
        alert('Erreur : ' + e.message);
      }
    });
  }
}
```

(Pas de `module.exports` : fichier purement UI/DOM, même convention que `js/messages.js` qui n'en a pas non plus.)

- [ ] **Step 2: Intégrer dans `js/messages.js`**

Repérer la ligne 14 actuelle :

```js
async function renderMessages(container) {
  container.innerHTML = '<div class="msg-loading">Chargement…</div>';
```

Remplacer la déclaration de fonction `renderMessages` par un nouveau point d'entrée qui monte le bloc annonce dans un conteneur séparé (persistant), puis délègue le reste à une fonction renommée `_renderMessagesBody` :

```js
async function renderMessages(container) {
  container.innerHTML = '<div id="annonce-staff-container"></div><div id="msg-body-container"></div>';
  renderAnnonceStaffBlock(document.getElementById('annonce-staff-container'));
  await _renderMessagesBody(document.getElementById('msg-body-container'));
}

async function _renderMessagesBody(container) {
  container.innerHTML = '<div class="msg-loading">Chargement…</div>';
```

Tout le reste du corps de l'ancienne fonction `renderMessages` (lignes 15 à la fin de la fonction, ~ligne 61) ne change pas : il continue d'opérer sur le paramètre `container`, qui référence maintenant `#msg-body-container` au lieu du conteneur racine de la vue — aucune autre modification nécessaire dans ce corps.

- [ ] **Step 3: Ajouter le CSS dans `css/style.css`**

Repérer ce bloc existant (lignes 1915-1920) :

```css
.msg-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
  background: white;
}
```

Ajouter juste après :

```css
.annonce-staff-block {
  padding: 14px 16px;
  background: #fff8e1;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
}
.annonce-staff-label {
  font-size: 12px;
  font-weight: 700;
  color: #f57f17;
  text-transform: uppercase;
  letter-spacing: .04em;
  margin-bottom: 8px;
}
.annonce-staff-text {
  font-size: 14px;
  color: #333;
  margin-bottom: 10px;
}
```

(`#msg-body-container` doit continuer à prendre l'espace restant : comme `.messages-view` est déjà `display:flex; flex-direction:column`, et que `.msg-layout` à l'intérieur de `#msg-body-container` a `height:100%`, aucune règle supplémentaire n'est nécessaire — `#msg-body-container` n'a pas de style propre, il hérite du flux normal.)

- [ ] **Step 4: Test manuel**

Ouvrir `index.html`, se connecter en staff, aller dans l'onglet Messages. Vérifier :
- Le bloc "Aucune annonce active" + textarea + bouton "Publier" s'affiche en haut, au-dessus de la liste de messages existante.
- Écrire un texte, cliquer "Publier" → le bloc se transforme en "Annonce active" avec le texte et un bouton "Désactiver", la liste de messages en dessous reste intacte.
- Cliquer "Désactiver" → confirmation → retour à l'état "Aucune annonce active".

- [ ] **Step 5: Commit**

```bash
git add js/annonces.js js/messages.js css/style.css
git commit -m "feat(annonces): composant staff de gestion de l'annonce dans la vue Messages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Bandeau usager dans `js/usager-accueil.js` + CSS

**Files:**
- Modify: `js/usager-accueil.js:8-93`
- Modify: `css/usager.css` (ajout après le bloc `.usager-demo-banner`, ligne ~650)

- [ ] **Step 1: Ajouter le fetch de l'annonce dans `renderAccueil`**

Repérer (ligne 12) :

```js
    var resas   = await getUserReservations(inscription.id);
```

Ajouter juste après :

```js
    var resas   = await getUserReservations(inscription.id);

    var annonce = null;
    try {
      annonce = await getActiveAnnonce();
    } catch (e) {
      console.error('Erreur chargement annonce:', e);
    }
```

(Try/catch séparé du try/catch principal de la fonction : un échec réseau sur l'annonce ne doit pas empêcher l'affichage des cartes prochaine réservation / pass, qui sont le contenu essentiel de l'écran.)

- [ ] **Step 2: Construire le HTML du bandeau**

Repérer (lignes 80-82) :

```js
    var demoBanner = inscription.isDemo
      ? '<div class="usager-demo-banner"><img src="icone%20demo.svg" alt="" style="height:16px;vertical-align:middle;margin-right:7px;filter:brightness(0)invert(1)">Compte démo — vos actions ne seront pas enregistrées</div>'
      : '';
```

Ajouter juste après :

```js
    var annonceHtml = annonce
      ? '<div class="usager-annonce-banner">' + _escA(annonce.contenu).replace(/\n/g, '<br>') + '</div>'
      : '';
```

- [ ] **Step 3: Insérer le bandeau dans le rendu final**

Repérer (ligne 84) :

```js
    container.innerHTML = demoBanner
      + '<p style="font-size:.9375rem;color:#555;margin-bottom:14px">Bonjour, <strong>' + _escA(inscription.prenom) + '</strong></p>'
```

Remplacer par :

```js
    container.innerHTML = demoBanner
      + annonceHtml
      + '<p style="font-size:.9375rem;color:#555;margin-bottom:14px">Bonjour, <strong>' + _escA(inscription.prenom) + '</strong></p>'
```

- [ ] **Step 4: Ajouter le CSS dans `css/usager.css`**

Repérer ce bloc existant (lignes 639-650) :

```css
/* ── Bandeau démo ── */
.usager-demo-banner {
  background: #e65100;
  color: #fff;
  text-align: center;
  padding: 9px 16px;
  font-size: .8125rem;
  font-weight: 700;
  border-radius: 10px;
  margin-bottom: 16px;
  letter-spacing: .01em;
}
```

Ajouter juste après :

```css
/* ── Bandeau annonce staff ── */
.usager-annonce-banner {
  background: #1565c0;
  color: #fff;
  padding: 12px 16px;
  font-size: .875rem;
  line-height: 1.4;
  border-radius: 10px;
  margin-bottom: 16px;
}
```

- [ ] **Step 5: Test manuel**

Avec une annonce active publiée (Task 4), se connecter côté usager sur `usager.html`. Vérifier :
- Le bandeau bleu s'affiche en haut de l'accueil, au-dessus de "Bonjour {prénom}" et des cartes "Prochaine réservation" / "Pass".
- Se déconnecter/reconnecter : le bandeau reste affiché (pas de suivi "lu", pas de bouton fermer).
- Désactiver l'annonce côté staff, recharger l'accueil usager : le bandeau disparaît.
- Compte démo : le bandeau démo (orange) reste au-dessus du bandeau annonce (bleu), les deux coexistent sans se chevaucher.

- [ ] **Step 6: Run full test suite (non-régression)**

Run: `node tests/run-all.js`
Expected: tous les tests passent (aucune fonction pure modifiée dans cette tâche).

- [ ] **Step 7: Commit**

```bash
git add js/usager-accueil.js css/usager.css
git commit -m "feat(annonces): afficher le bandeau d'annonce staff sur l'accueil usager

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Hors scope (rappel, voir spec)

- Historique/réactivation des annonces passées côté staff.
- Dismissible / suivi de lecture par usager.
- Affichage sur d'autres vues usager que l'accueil.
- Plusieurs annonces actives simultanément.
