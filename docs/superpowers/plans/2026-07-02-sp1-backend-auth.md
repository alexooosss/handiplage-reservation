# SP1 — Backend + Auth : Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer le projet Supabase (schéma + RLS + Edge Function), configurer l'authentification staff/usager, ajouter une page de login et un garde d'accès sur l'interface staff, déployer sur Netlify.

**Architecture:** Application vanilla JS sans outil de build. Supabase fournit la base PostgreSQL, l'auth email+password et les Edge Functions Deno. Le frontend lit la config depuis `js/env.js` (généré par Netlify au déploiement, créé manuellement en local). La page de login redirige selon le rôle (`user_metadata.role`). L'interface staff existante (`index.html`) reçoit un garde qui redirige vers `login.html` si la session est absente ou non-staff.

**Tech Stack:** Supabase JS SDK v2 (CDN), Supabase CLI (pour Edge Functions), Netlify (hébergement + build env vars), Deno/TypeScript (Edge Function), SQL (PostgreSQL via Supabase SQL Editor)

---

## Structure des fichiers

```
supabase/
  schema.sql                         ← CREATE TABLE (4 tables)
  seed.sql                           ← INSERT 5 créneaux
  rls.sql                            ← Row Level Security policies
  functions/
    invite-user/
      index.ts                       ← Edge Function : inviter un usager par email
js/
  env.example.js                     ← Template de config (commité)
  env.js                             ← Config réelle (gitignorée, générée par Netlify)
  supabase-client.js                 ← createClient() depuis window.SUPABASE_CONFIG
  auth.js                            ← signIn, signOut, getSession, getUserRole
login.html                           ← Page de connexion (nouveau fichier)
netlify.toml                         ← Config Netlify + commande de build
tests/
  test-auth.js                       ← Tests unitaires de auth.js
```

**Fichiers modifiés :**
- `index.html` — ajout CDN supabase-js + `js/supabase-client.js` + `js/auth.js` + garde d'accès (lignes 72-86)
- `.gitignore` — ajouter `js/env.js`

---

## Prérequis (à faire une seule fois manuellement)

Avant de commencer les tâches :

1. Créer un compte sur [supabase.com](https://supabase.com) si ce n'est pas fait
2. Installer le CLI Supabase :
   ```bash
   npm install -g supabase
   ```
3. Créer un compte sur [netlify.com](https://netlify.com) si ce n'est pas fait

---

## Tâche 1 : Projet Supabase — schéma, données, RLS

**Fichiers :**
- Créer : `supabase/schema.sql`
- Créer : `supabase/seed.sql`
- Créer : `supabase/rls.sql`

### Étapes

- [ ] **1.1 — Créer le projet Supabase**

  Aller sur https://supabase.com/dashboard → "New project" → remplir :
  - Name : `handiplage-reservation`
  - Password : choisir un mot de passe fort (le noter, c'est le password PostgreSQL)
  - Region : `West EU (Ireland)` ou `Europe (Frankfurt)`

  Attendre 1-2 min que le projet démarre. Conserver :
  - Project URL : `https://xxxxxxxxxxxx.supabase.co`
  - Anon public key (Settings → API)
  - Service role key (Settings → API — **ne jamais exposer côté client**)

- [ ] **1.2 — Écrire `supabase/schema.sql`**

  ```sql
  -- Activer l'extension uuid si nécessaire (normalement déjà active)
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  -- Helper : extraire le rôle depuis le JWT
  CREATE OR REPLACE FUNCTION public.auth_user_role()
  RETURNS text AS $$
    SELECT COALESCE(
      (auth.jwt() -> 'user_metadata' ->> 'role'),
      'user'
    )
  $$ LANGUAGE sql STABLE SECURITY DEFINER;

  -- Table inscriptions
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
    handicap         text,
    notes            text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
  );

  -- Table créneaux (statique, 5 lignes)
  CREATE TABLE creneaux (
    id               int PRIMARY KEY,
    label            text NOT NULL,
    heure_debut      time NOT NULL,
    heure_fin        time NOT NULL,
    capacite_resa    int NOT NULL,
    capacite_walkin  int NOT NULL
  );

  -- Table réservations
  CREATE TABLE reservations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    date            date NOT NULL,
    creneau_id      int NOT NULL REFERENCES creneaux(id),
    inscription_id  uuid REFERENCES inscriptions(id) ON DELETE SET NULL,
    nom             text NOT NULL,
    prenom          text NOT NULL,
    accompagnants   int NOT NULL DEFAULT 0 CHECK (accompagnants BETWEEN 0 AND 2),
    type            text NOT NULL CHECK (type IN ('reserved', 'walkin')),
    statut          text NOT NULL DEFAULT 'attente'
                      CHECK (statut IN ('attente', 'present', 'parti', 'absent', 'annule')),
    spot_id         text,
    checkin_time    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
  );

  -- Table main courante
  CREATE TABLE main_courante (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    date        date NOT NULL,
    creneau_id  int NOT NULL REFERENCES creneaux(id),
    compteurs   jsonb NOT NULL DEFAULT '{}',
    staff       jsonb NOT NULL DEFAULT '{}',
    notes       jsonb NOT NULL DEFAULT '[]',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (date, creneau_id)
  );
  ```

- [ ] **1.3 — Écrire `supabase/seed.sql`**

  ```sql
  -- 5 créneaux Handiplage (horaires issus de js/slots.js)
  INSERT INTO creneaux (id, label, heure_debut, heure_fin, capacite_resa, capacite_walkin) VALUES
    (1, '8h30 – 10h15',  '08:30', '10:15', 25, 10),
    (2, '10h30 – 12h15', '10:30', '12:15', 25, 10),
    (3, '12h30 – 14h15', '12:30', '14:15', 25, 10),
    (4, '14h30 – 16h15', '14:30', '16:15', 25, 10),
    (5, '16h30 – 18h15', '16:30', '18:15', 25, 10);
  ```

- [ ] **1.4 — Écrire `supabase/rls.sql`**

  ```sql
  -- Activer RLS sur toutes les tables
  ALTER TABLE inscriptions   ENABLE ROW LEVEL SECURITY;
  ALTER TABLE creneaux       ENABLE ROW LEVEL SECURITY;
  ALTER TABLE reservations   ENABLE ROW LEVEL SECURITY;
  ALTER TABLE main_courante  ENABLE ROW LEVEL SECURITY;

  -- inscriptions : staff = accès total, usager = lecture de sa propre ligne
  CREATE POLICY "inscriptions_staff_all" ON inscriptions
    FOR ALL TO authenticated
    USING (public.auth_user_role() = 'staff')
    WITH CHECK (public.auth_user_role() = 'staff');

  CREATE POLICY "inscriptions_user_read_own" ON inscriptions
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

  -- creneaux : lecture publique (y compris non connecté)
  CREATE POLICY "creneaux_public_read" ON creneaux
    FOR SELECT TO anon, authenticated
    USING (true);

  -- reservations : staff = accès total
  --                usager = CRUD sur ses propres réservations
  CREATE POLICY "reservations_staff_all" ON reservations
    FOR ALL TO authenticated
    USING (public.auth_user_role() = 'staff')
    WITH CHECK (public.auth_user_role() = 'staff');

  CREATE POLICY "reservations_user_own" ON reservations
    FOR ALL TO authenticated
    USING (
      inscription_id IN (
        SELECT id FROM inscriptions WHERE user_id = auth.uid()
      )
    )
    WITH CHECK (
      inscription_id IN (
        SELECT id FROM inscriptions WHERE user_id = auth.uid()
      )
    );

  -- main_courante : staff uniquement
  CREATE POLICY "mc_staff_all" ON main_courante
    FOR ALL TO authenticated
    USING (public.auth_user_role() = 'staff')
    WITH CHECK (public.auth_user_role() = 'staff');
  ```

- [ ] **1.5 — Exécuter les scripts dans Supabase**

  Dans le dashboard Supabase → SQL Editor :
  1. Coller et exécuter le contenu de `schema.sql` → vérifier "Success"
  2. Coller et exécuter le contenu de `seed.sql` → vérifier "Success"
  3. Coller et exécuter le contenu de `rls.sql` → vérifier "Success"

  Vérification : aller dans Table Editor → 4 tables présentes, `creneaux` contient 5 lignes.

- [ ] **1.6 — Créer le compte staff dans Supabase**

  Dans Authentication → Users → "Add user" → "Create new user" :
  - Email : (votre email staff)
  - Password : (mot de passe fort)

  Ensuite, dans SQL Editor, attribuer le rôle staff :
  ```sql
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'),
    '{role}',
    '"staff"'
  )
  WHERE email = 'VOTRE_EMAIL_STAFF';
  ```
  Remplacer `VOTRE_EMAIL_STAFF` par l'email saisi.

  Vérification :
  ```sql
  SELECT email, raw_user_meta_data -> 'role' AS role FROM auth.users;
  ```
  Résultat attendu : `"staff"` dans la colonne role.

- [ ] **1.7 — Commit**

  ```bash
  git add supabase/schema.sql supabase/seed.sql supabase/rls.sql
  git commit -m "feat: schéma Supabase — 4 tables + RLS + seed créneaux"
  ```

---

## Tâche 2 : Client Supabase + configuration d'environnement

**Fichiers :**
- Créer : `js/env.example.js`
- Créer : `js/supabase-client.js`
- Créer : `js/env.js` (local uniquement, gitignorée)
- Modifier : `.gitignore` (ajouter `js/env.js`)
- Modifier : `index.html` (ajouter CDN + 2 scripts)

- [ ] **2.1 — Ajouter `js/env.js` au .gitignore**

  Dans `.gitignore`, ajouter après `.worktrees/` :
  ```
  js/env.js
  ```

- [ ] **2.2 — Écrire `js/env.example.js`**

  ```js
  // Copier ce fichier en js/env.js et remplir les valeurs Supabase
  // js/env.js est gitignorée — ne jamais commiter les vraies valeurs
  // Sur Netlify, ce fichier est généré automatiquement par la commande de build
  window.SUPABASE_CONFIG = {
    url: 'https://VOTRE_PROJECT_ID.supabase.co',
    anonKey: 'VOTRE_ANON_KEY'
  };
  ```

- [ ] **2.3 — Créer `js/env.js` localement (non commité)**

  Copier `js/env.example.js` → `js/env.js`, puis remplir avec les vraies valeurs :
  - `url` : Project URL depuis Settings → API
  - `anonKey` : `anon public` key depuis Settings → API

- [ ] **2.4 — Écrire `js/supabase-client.js`**

  ```js
  'use strict';
  // window.SUPABASE_CONFIG est défini par js/env.js
  var supabase = window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey
  );
  ```

- [ ] **2.5 — Modifier `index.html` : ajouter CDN + scripts**

  Remplacer la ligne `<!-- Scripts -->` (ligne 72) et le premier script (ligne 73) par :

  ```html
  <!-- Scripts -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="js/env.js"></script>
  <script src="js/supabase-client.js"></script>
  <script src="js/data.js"></script>
  ```

  Les lignes suivantes restent inchangées (slots.js, timer.js, etc.).

- [ ] **2.6 — Vérifier dans le navigateur**

  Ouvrir `index.html` (serveur local ou file://) → console :
  ```js
  supabase.from('creneaux').select('*').then(r => console.log(r.data))
  ```
  Résultat attendu : tableau de 5 objets créneaux (si RLS allow anon read sur creneaux).

- [ ] **2.7 — Commit**

  ```bash
  git add js/env.example.js js/supabase-client.js index.html .gitignore
  git commit -m "feat: client Supabase + configuration env"
  ```

---

## Tâche 3 : Module d'authentification + tests

**Fichiers :**
- Créer : `js/auth.js`
- Créer : `tests/test-auth.js`
- Modifier : `tests/run-all.js`

- [ ] **3.1 — Écrire `tests/test-auth.js` (test d'abord)**

  ```js
  'use strict';
  const assert = require('assert');

  // Mock supabase global (fonctions async non testées ici — elles appellent le réseau)
  global.supabase = { auth: {} };
  // Mock window.location pour éviter une erreur dans Node
  global.window = { location: { href: '' } };

  const { getUserRole } = require('../js/auth.js');

  // 1. Rôle staff
  const staffSession = { user: { user_metadata: { role: 'staff' } } };
  assert.strictEqual(getUserRole(staffSession), 'staff', 'getUserRole retourne staff');

  // 2. Rôle user
  const userSession = { user: { user_metadata: { role: 'user' } } };
  assert.strictEqual(getUserRole(userSession), 'user', 'getUserRole retourne user');

  // 3. Session null
  assert.strictEqual(getUserRole(null), null, 'getUserRole retourne null si pas de session');

  // 4. user_metadata absent
  const emptySession = { user: {} };
  assert.strictEqual(getUserRole(emptySession), null, 'getUserRole retourne null si user_metadata absent');

  // 5. user absent
  const noUser = {};
  assert.strictEqual(getUserRole(noUser), null, 'getUserRole retourne null si user absent');

  console.log('✓ test-auth.js OK');
  ```

- [ ] **3.2 — Exécuter le test — vérifier qu'il échoue**

  ```bash
  node tests/test-auth.js
  ```
  Résultat attendu : `Error: Cannot find module '../js/auth.js'`

- [ ] **3.3 — Écrire `js/auth.js`**

  ```js
  'use strict';

  function getUserRole(session) {
    if (!session || !session.user) return null;
    return (session.user.user_metadata && session.user.user_metadata.role) || null;
  }

  async function signIn(email, password) {
    var result = await supabase.auth.signInWithPassword({ email: email, password: password });
    if (result.error) throw result.error;
    return result.data;
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/login.html';
  }

  async function getSession() {
    var result = await supabase.auth.getSession();
    return result.data.session;
  }

  // Redirige vers login.html si pas de session, vers usager.html si rôle user
  async function requireStaffAuth() {
    var session = await getSession();
    if (!session) {
      window.location.href = '/login.html';
      return null;
    }
    if (getUserRole(session) !== 'staff') {
      window.location.href = '/usager.html';
      return null;
    }
    return session;
  }

  // Appelle l'Edge Function pour inviter un usager par email
  async function inviteUser(email, inscriptionId) {
    var session = await getSession();
    var response = await fetch(window.SUPABASE_CONFIG.url + '/functions/v1/invite-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + session.access_token
      },
      body: JSON.stringify({ email: email, inscriptionId: inscriptionId })
    });
    if (!response.ok) {
      var body = await response.json();
      throw new Error(body.error || 'Erreur invitation');
    }
  }

  if (typeof module !== 'undefined') {
    module.exports = { getUserRole, signIn, signOut, getSession, requireStaffAuth, inviteUser };
  }
  ```

- [ ] **3.4 — Exécuter le test — vérifier qu'il passe**

  ```bash
  node tests/test-auth.js
  ```
  Résultat attendu : `✓ test-auth.js OK`

- [ ] **3.5 — Ajouter `test-auth.js` à `tests/run-all.js`**

  Dans `tests/run-all.js`, ajouter `'test-auth.js'` à la liste des fichiers de test (même pattern que les autres entrées).

- [ ] **3.6 — Lancer la suite complète**

  ```bash
  node tests/run-all.js
  ```
  Résultat attendu : `✅ Tous les tests passent`

- [ ] **3.7 — Ajouter `js/auth.js` à `index.html`**

  Après `<script src="js/supabase-client.js"></script>`, ajouter :
  ```html
  <script src="js/auth.js"></script>
  ```

- [ ] **3.8 — Commit**

  ```bash
  git add js/auth.js tests/test-auth.js tests/run-all.js index.html
  git commit -m "feat: module auth (getUserRole, signIn, signOut, requireStaffAuth)"
  ```

---

## Tâche 4 : Page de connexion

**Fichiers :**
- Créer : `login.html`

- [ ] **4.1 — Écrire `login.html`**

  ```html
  <!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Handiplage — Connexion</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      body {
        margin: 0; font-family: system-ui, sans-serif;
        background: #e3f2fd; display: flex;
        align-items: center; justify-content: center; min-height: 100vh;
      }
      .login-card {
        background: #fff; border-radius: 16px;
        box-shadow: 0 4px 24px rgba(0,0,0,.12);
        padding: 40px 32px; width: 360px;
      }
      .login-card h1 {
        margin: 0 0 6px; font-size: 22px; color: #1565c0;
      }
      .login-card p.sub {
        margin: 0 0 28px; color: #666; font-size: 14px;
      }
      label { display: block; font-size: 13px; font-weight: 600;
              color: #444; margin-bottom: 4px; }
      input[type=email], input[type=password] {
        width: 100%; padding: 10px 12px; border: 1px solid #ccc;
        border-radius: 8px; font-size: 14px; margin-bottom: 16px;
      }
      input:focus { outline: none; border-color: #1565c0; }
      button[type=submit] {
        width: 100%; padding: 12px; background: #1565c0;
        color: #fff; border: none; border-radius: 8px;
        font-size: 15px; font-weight: 700; cursor: pointer;
      }
      button:hover { background: #1976d2; }
      #login-error {
        display: none; margin-top: 12px; color: #c62828;
        font-size: 13px; text-align: center;
      }
      .forgot { text-align: center; margin-top: 16px; font-size: 12px; }
      .forgot a { color: #1565c0; text-decoration: none; }
    </style>
  </head>
  <body>
    <div class="login-card">
      <h1>Handiplage Antibes</h1>
      <p class="sub">Connectez-vous pour accéder à votre espace</p>
      <form id="login-form">
        <label for="login-email">Adresse email</label>
        <input type="email" id="login-email" autocomplete="email" required>
        <label for="login-password">Mot de passe</label>
        <input type="password" id="login-password" autocomplete="current-password" required>
        <button type="submit">Se connecter</button>
        <div id="login-error"></div>
      </form>
      <div class="forgot">
        <a href="#" id="forgot-link">Mot de passe oublié ?</a>
      </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="js/env.js"></script>
    <script src="js/supabase-client.js"></script>
    <script src="js/auth.js"></script>
    <script>
      // Si déjà connecté, rediriger immédiatement
      (async function () {
        var session = await getSession();
        if (session) {
          window.location.href = getUserRole(session) === 'staff' ? '/index.html' : '/usager.html';
        }
      })();

      document.getElementById('login-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        var email = document.getElementById('login-email').value;
        var password = document.getElementById('login-password').value;
        var errEl = document.getElementById('login-error');
        errEl.style.display = 'none';
        try {
          var data = await signIn(email, password);
          var role = getUserRole({ user: data.user });
          window.location.href = role === 'staff' ? '/index.html' : '/usager.html';
        } catch (err) {
          errEl.textContent = err.message === 'Invalid login credentials'
            ? 'Email ou mot de passe incorrect'
            : err.message;
          errEl.style.display = 'block';
        }
      });

      document.getElementById('forgot-link').addEventListener('click', async function (e) {
        e.preventDefault();
        var email = document.getElementById('login-email').value;
        if (!email) {
          alert('Saisissez votre email dans le champ ci-dessus puis cliquez à nouveau.');
          return;
        }
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/login.html'
        });
        alert('Email de réinitialisation envoyé à ' + email);
      });
    </script>
  </body>
  </html>
  ```

- [ ] **4.2 — Tester manuellement dans le navigateur**

  Ouvrir `login.html` dans le navigateur (via un serveur local, ex: `npx serve .`) :
  1. Laisser le formulaire vide → bouton Submit → message de validation HTML natif ✓
  2. Saisir email/password incorrects → message "Email ou mot de passe incorrect" ✓
  3. Saisir les identifiants staff créés à la Tâche 1 → redirection vers `index.html` ✓
  4. Sur `index.html`, ouvrir la console → `(await getSession()).user.user_metadata.role` → `"staff"` ✓

- [ ] **4.3 — Commit**

  ```bash
  git add login.html
  git commit -m "feat: page de connexion (login.html)"
  ```

---

## Tâche 5 : Garde d'accès sur l'interface staff

**Fichiers :**
- Modifier : `index.html`

- [ ] **5.1 — Ajouter le bouton déconnexion dans le header**

  Dans `index.html`, après `<div class="datetime" id="datetime">` ... `</div>` (ligne ~27), ajouter :
  ```html
  <button id="btn-logout" class="planning-tab-btn" style="margin-left:auto">Déconnexion</button>
  ```

- [ ] **5.2 — Ajouter le garde d'accès dans `index.html`**

  Après `<script src="js/auth.js"></script>` et avant `<script src="js/data.js"></script>`, insérer ce bloc unique :

  ```html
  <script>
    (async function () {
      var session = await getSession();
      if (!session || getUserRole(session) !== 'staff') {
        window.location.href = '/login.html';
        return;
      }
      document.getElementById('btn-logout').addEventListener('click', signOut);
    })();
  </script>
  ```

- [ ] **5.3 — Tester manuellement**

  1. Effacer la session : dans la console → `await supabase.auth.signOut()` puis recharger `index.html` → redirection automatique vers `login.html` ✓
  2. Se reconnecter → retour sur `index.html` avec l'interface staff complète ✓
  3. Cliquer "Déconnexion" → redirection vers `login.html` ✓

- [ ] **5.4 — Commit**

  ```bash
  git add index.html
  git commit -m "feat: garde d'accès staff sur index.html + bouton déconnexion"
  ```

---

## Tâche 6 : Edge Function — invitation usager

**Fichiers :**
- Créer : `supabase/functions/invite-user/index.ts`

- [ ] **6.1 — Initialiser le projet Supabase CLI**

  À la racine du projet :
  ```bash
  supabase init
  ```
  Cela crée un dossier `supabase/` avec `config.toml`. Si `supabase/` existe déjà (contenant nos SQL), répondre "Overwrite? No" pour conserver les fichiers SQL.

- [ ] **6.2 — Lier le projet local au projet Supabase distant**

  ```bash
  supabase login
  supabase link --project-ref VOTRE_PROJECT_ID
  ```
  `VOTRE_PROJECT_ID` = les 20 caractères dans votre URL Supabase (ex: `abcdefghijklmnopqrst`).

- [ ] **6.3 — Créer la fonction**

  ```bash
  supabase functions new invite-user
  ```
  Cela crée `supabase/functions/invite-user/index.ts`.

- [ ] **6.4 — Écrire `supabase/functions/invite-user/index.ts`**

  ```typescript
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  Deno.serve(async (req) => {
    // Preflight CORS
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    // Vérifier l'Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    // Vérifier que l'appelant est bien staff
    const callerClient = createClient(supabaseUrl, anonKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await callerClient.auth.getUser(token)

    if (userError || !user || user.user_metadata?.role !== 'staff') {
      return new Response(JSON.stringify({ error: 'Accès refusé — réservé au staff' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Lire le body
    const { email, inscriptionId } = await req.json()
    if (!email) {
      return new Response(JSON.stringify({ error: 'email requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Inviter l'usager (requiert service role)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const siteUrl = Deno.env.get('SITE_URL') ?? ''
    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      { data: { role: 'user' }, redirectTo: siteUrl + '/login.html' }
    )

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Lier le user_id à l'inscription si fourni
    if (inscriptionId && invited.user) {
      await adminClient
        .from('inscriptions')
        .update({ user_id: invited.user.id })
        .eq('id', inscriptionId)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  })
  ```

- [ ] **6.5 — Configurer les secrets de la fonction**

  Dans le dashboard Supabase → Edge Functions → invite-user → Secrets, ajouter :
  - `SITE_URL` : URL Netlify de production (ex: `https://handiplage-reservation.netlify.app`)
    Pour l'instant, utiliser `http://localhost:3000` en attendant le déploiement Netlify.

  Les variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` sont automatiquement disponibles dans les Edge Functions Supabase — pas besoin de les ajouter manuellement.

- [ ] **6.6 — Déployer la fonction**

  ```bash
  supabase functions deploy invite-user
  ```
  Résultat attendu : `Deployed Function invite-user`

- [ ] **6.7 — Tester la fonction depuis le dashboard**

  Dans Supabase → Edge Functions → invite-user → "Test function" :
  - Method: POST
  - Headers: `Authorization: Bearer <votre_access_token>` (récupéré dans la console : `(await supabase.auth.getSession()).data.session.access_token`)
  - Body:
    ```json
    { "email": "test@example.com" }
    ```
  Résultat attendu : `{ "success": true }` et l'utilisateur apparaît dans Authentication → Users.

- [ ] **6.8 — Commit**

  ```bash
  git add supabase/functions/invite-user/index.ts supabase/config.toml
  git commit -m "feat: edge function invite-user (invitation par email avec vérification staff)"
  ```

---

## Tâche 7 : Déploiement Netlify

**Fichiers :**
- Créer : `netlify.toml`

- [ ] **7.1 — Écrire `netlify.toml`**

  ```toml
  [build]
    # Génère js/env.js à partir des variables d'environnement Netlify
    command = "printf 'window.SUPABASE_CONFIG={url:\"%s\",anonKey:\"%s\"};' \"$SUPABASE_URL\" \"$SUPABASE_ANON_KEY\" > js/env.js"
    publish = "."

  [[headers]]
    for = "/*"
    [headers.values]
      X-Frame-Options = "DENY"
      X-Content-Type-Options = "nosniff"
      Referrer-Policy = "strict-origin-when-cross-origin"
  ```

  Note : la redirection vers `login.html` est gérée côté client (JS dans `index.html`), pas par Netlify.

- [ ] **7.2 — Commiter et pousser sur GitHub**

  ```bash
  git add netlify.toml
  git commit -m "feat: configuration Netlify (build env + headers sécurité)"
  git push origin master
  ```

- [ ] **7.3 — Créer le site sur Netlify**

  Sur https://app.netlify.com → "Add new site" → "Import an existing project" → GitHub → sélectionner `alexooosss/handiplage-reservation`.

  Paramètres de déploiement :
  - Branch to deploy : `master`
  - Base directory : (laisser vide)
  - Build command : (déjà dans `netlify.toml`, Netlify le détecte)
  - Publish directory : `.`

- [ ] **7.4 — Configurer les variables d'environnement Netlify**

  Dans Site settings → Environment variables → "Add a variable" :
  - `SUPABASE_URL` : votre Project URL (ex: `https://abcdefghij.supabase.co`)
  - `SUPABASE_ANON_KEY` : votre anon public key

- [ ] **7.5 — Déclencher un déploiement**

  Dans Deploys → "Trigger deploy" → "Deploy site".

  Vérifier dans le log de build :
  ```
  $ printf 'window.SUPABASE_CONFIG=...' ... > js/env.js
  ```
  Le fichier `js/env.js` doit apparaître dans la liste des fichiers déployés.

- [ ] **7.6 — Mettre à jour `SITE_URL` dans les secrets de la fonction**

  Copier l'URL Netlify attribuée (ex: `https://handiplage-reservation.netlify.app`).

  Dans Supabase → Edge Functions → invite-user → Secrets, mettre à jour :
  - `SITE_URL` : `https://handiplage-reservation.netlify.app`

  Redéployer la fonction :
  ```bash
  supabase functions deploy invite-user
  ```

- [ ] **7.7 — Test de bout en bout sur l'URL Netlify**

  1. Ouvrir `https://handiplage-reservation.netlify.app/login.html`
  2. Se connecter avec le compte staff → redirection vers `/index.html` ✓
  3. Vérifier que l'interface staff s'affiche normalement ✓
  4. Cliquer "Déconnexion" → retour sur `login.html` ✓
  5. Ouvrir `https://handiplage-reservation.netlify.app/index.html` sans être connecté → redirection vers `login.html` ✓

- [ ] **7.8 — Mettre à jour GitHub Pages (si configuré)**

  Si GitHub Pages était configuré sur une ancienne branche, aller dans le repo GitHub → Settings → Pages → Source → `master` branch → Save. L'hébergement principal sera désormais Netlify.

---

## Récapitulatif des livrables

| Livrable | Vérifié par |
|----------|------------|
| 4 tables Supabase avec RLS | SQL Editor → Table Editor |
| 5 créneaux insérés | `SELECT * FROM creneaux` → 5 lignes |
| Compte staff fonctionnel | Login sur login.html |
| `supabase.from('creneaux').select()` depuis le browser | Console → 5 objets |
| Redirection non-connecté → login.html | Tâche 5.2 |
| Redirection après login → index.html (staff) | Tâche 4.2 |
| Edge Function déployée | Tâche 6.7 |
| Site Netlify live | URL Netlify accessible |
| Tests : `node tests/run-all.js` passe | `✅ Tous les tests passent` |
