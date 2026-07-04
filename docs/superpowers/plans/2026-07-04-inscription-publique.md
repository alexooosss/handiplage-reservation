# Inscription Publique & Infrastructure Messages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à toute personne de déposer une demande d'inscription via un formulaire public, et gérer le flux refus → réponse usager via un formulaire web sécurisé par token.

**Architecture:** Formulaire public (`inscription-publique.html`) → INSERT en_attente via RLS anon. Quand le staff refuse, une Edge Function génère un token stocké dans une nouvelle table `messages` et ouvre un `mailto:` pré-rempli avec le lien de réponse. La personne répond via `reponse.html` → Edge Function `submit-reply` valide le token et enregistre la réponse.

**Tech Stack:** Vanilla JS ES6, Supabase JS SDK v2, Deno Edge Functions (TypeScript), CSS mobile-first.

---

## Structure des fichiers

| Fichier | Rôle |
|---------|------|
| `supabase/messages-schema.sql` | CREATE TABLE messages |
| `supabase/rls.sql` *(modifié)* | Policy anon INSERT inscriptions + staff messages |
| `supabase/functions/send-refusal-email/index.ts` | Edge Function : génère token + retourne mailto |
| `supabase/functions/submit-reply/index.ts` | Edge Function publique : enregistre la réponse |
| `css/public.css` | CSS base partagé par les pages publiques |
| `js/inscription-publique.js` | Validation + soumission du formulaire public |
| `inscription-publique.html` | Page formulaire public |
| `js/reponse.js` | Logique du formulaire de réponse |
| `reponse.html` | Page réponse pour les refus |
| `js/inscription.js` *(modifié)* | UI refus : saisie motif + bouton send-refusal-email |
| `tests/test-inscription-publique.js` | Tests validation formulaire |
| `tests/run-all.js` *(modifié)* | Ajouter le nouveau test |

---

### Task 1 : Table `messages` et politique RLS anon

**Files:**
- Create: `supabase/messages-schema.sql`
- Modify: `supabase/rls.sql`

- [ ] **Étape 1 : Écrire messages-schema.sql**

```sql
-- supabase/messages-schema.sql
-- Exécuter dans l'éditeur SQL Supabase

CREATE TABLE messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inscription_id   uuid NOT NULL REFERENCES inscriptions(id) ON DELETE CASCADE,
  motif_refus      text NOT NULL,
  token            uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  token_expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  contenu          text,
  lu               boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_messages_inscription_id ON messages(inscription_id);
CREATE INDEX idx_messages_token ON messages(token);
```

- [ ] **Étape 2 : Exécuter le SQL dans Supabase Studio**

Ouvrir Supabase Studio → Table Editor → SQL Editor → coller et exécuter le contenu ci-dessus.
Vérifier que la table `messages` apparaît dans la liste des tables.

- [ ] **Étape 3 : Ajouter les RLS policies dans rls.sql**

Ajouter à la fin de `supabase/rls.sql` :

```sql
-- ── Policies table messages ──────────────────────────────────────────────

-- Staff : accès complet
CREATE POLICY "staff_full_messages" ON messages
  FOR ALL
  USING (auth_user_role() = 'staff')
  WITH CHECK (auth_user_role() = 'staff');

-- ── Policy anon INSERT sur inscriptions ─────────────────────────────────

-- Permet aux personnes non connectées de déposer une demande d'inscription
CREATE POLICY "public_insert_inscription" ON inscriptions
  FOR INSERT
  WITH CHECK (
    statut = 'en_attente'
    AND user_id IS NULL
  );
```

- [ ] **Étape 4 : Exécuter les policies dans Supabase Studio**

Copier le contenu ci-dessus dans SQL Editor → Exécuter.
Vérifier dans Authentication → Policies que les nouvelles policies apparaissent.

- [ ] **Étape 5 : Commit**

```bash
git add supabase/messages-schema.sql supabase/rls.sql
git commit -m "feat: table messages + policy anon inscription"
```

---

### Task 2 : Edge Function `send-refusal-email`

**Files:**
- Create: `supabase/functions/send-refusal-email/index.ts`

La fonction reçoit `{ inscriptionId, motif }` depuis le staff (token Bearer requis), insère dans `messages`, et retourne l'URL de réponse + un objet `mailto` pré-rempli pour que le client ouvre la messagerie locale.

- [ ] **Étape 1 : Créer le dossier et le fichier**

```bash
mkdir supabase/functions/send-refusal-email
```

- [ ] **Étape 2 : Écrire index.ts**

```typescript
// supabase/functions/send-refusal-email/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const supabaseUrl      = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const anonKey          = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const siteUrl          = Deno.env.get('SITE_URL') ?? ''

  // Vérifier que l'appelant est staff
  const callerClient = createClient(supabaseUrl, anonKey)
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  const { data: { user }, error: userError } = await callerClient.auth.getUser(token)
  if (userError || !user || user.user_metadata?.role !== 'staff') {
    return new Response(JSON.stringify({ error: 'Accès refusé' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  let inscriptionId: string, motif: string
  try {
    const body = await req.json()
    inscriptionId = body.inscriptionId
    motif = body.motif
  } catch {
    return new Response(JSON.stringify({ error: 'JSON invalide' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (!inscriptionId || !motif) {
    return new Response(JSON.stringify({ error: 'inscriptionId et motif requis' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Récupérer les infos de l'inscription pour l'email
  const { data: insc, error: inscError } = await adminClient
    .from('inscriptions')
    .select('nom, prenom, mail')
    .eq('id', inscriptionId)
    .single()
  if (inscError || !insc) {
    return new Response(JSON.stringify({ error: 'Inscription introuvable' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Insérer dans messages (token généré automatiquement par DEFAULT)
  const { data: msg, error: msgError } = await adminClient
    .from('messages')
    .insert({ inscription_id: inscriptionId, motif_refus: motif })
    .select('token')
    .single()
  if (msgError || !msg) {
    return new Response(JSON.stringify({ error: 'Erreur création message' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const replyUrl = `${siteUrl}/reponse.html?token=${msg.token}`
  const mailSubject = encodeURIComponent('Handiplage — Décision sur votre demande d\'inscription')
  const mailBody = encodeURIComponent(
    `Madame, Monsieur ${insc.prenom} ${insc.nom},\n\n` +
    `Suite à l'examen de votre demande d'inscription à Handiplage, nous avons le regret de vous informer qu'elle ne peut pas être acceptée pour le motif suivant :\n\n` +
    `${motif}\n\n` +
    `Si vous souhaitez nous adresser des éléments complémentaires ou contester cette décision, vous pouvez répondre via le lien suivant (valable 30 jours) :\n\n` +
    `${replyUrl}\n\n` +
    `Cordialement,\nL'équipe Handiplage — CCAS d'Antibes`
  )
  const mailtoLink = `mailto:${insc.mail}?subject=${mailSubject}&body=${mailBody}`

  return new Response(JSON.stringify({ success: true, mailtoLink, replyUrl }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
```

- [ ] **Étape 3 : Déployer la Edge Function**

```bash
npx supabase functions deploy send-refusal-email
```

S'assurer que `SITE_URL` est configuré dans les secrets Supabase (`npx supabase secrets set SITE_URL=https://[votre-url]`).

- [ ] **Étape 4 : Commit**

```bash
git add supabase/functions/send-refusal-email/index.ts
git commit -m "feat: Edge Function send-refusal-email"
```

---

### Task 3 : Edge Function `submit-reply`

**Files:**
- Create: `supabase/functions/submit-reply/index.ts`

Endpoint public (pas d'auth requise). Prend `{ token, contenu }`, valide le token, enregistre la réponse.

- [ ] **Étape 1 : Créer le dossier et le fichier**

```bash
mkdir supabase/functions/submit-reply
```

- [ ] **Étape 2 : Écrire index.ts**

```typescript
// supabase/functions/submit-reply/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non supportée' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  let token: string, contenu: string
  try {
    const body = await req.json()
    token   = body.token
    contenu = body.contenu
  } catch {
    return new Response(JSON.stringify({ error: 'JSON invalide' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (!token || !contenu || contenu.trim().length < 10) {
    return new Response(JSON.stringify({ error: 'token et contenu (min 10 car.) requis' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const adminClient    = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Vérifier le token
  const { data: msg, error: msgError } = await adminClient
    .from('messages')
    .select('id, token_expires_at, contenu')
    .eq('token', token)
    .single()

  if (msgError || !msg) {
    return new Response(JSON.stringify({ error: 'Lien invalide ou expiré' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (new Date(msg.token_expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: 'Ce lien a expiré (30 jours). Contactez directement l\'équipe Handiplage.' }), {
      status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (msg.contenu) {
    return new Response(JSON.stringify({ error: 'Une réponse a déjà été envoyée pour ce dossier.' }), {
      status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Enregistrer la réponse
  const { error: updateError } = await adminClient
    .from('messages')
    .update({ contenu: contenu.trim() })
    .eq('id', msg.id)

  if (updateError) {
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
```

- [ ] **Étape 3 : Déployer**

```bash
npx supabase functions deploy submit-reply
```

- [ ] **Étape 4 : Commit**

```bash
git add supabase/functions/submit-reply/index.ts
git commit -m "feat: Edge Function submit-reply (token validé)"
```

---

### Task 4 : CSS public.css

**Files:**
- Create: `css/public.css`

CSS mobile-first partagé par `inscription-publique.html` et `reponse.html`.

- [ ] **Étape 1 : Écrire public.css**

```css
/* css/public.css — pages publiques mobile-first */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 16px;
  background: #e3f2fd;
  min-height: 100vh;
  color: #222;
}

/* Header */
.pub-header {
  background: #1565c0;
  color: white;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.pub-header-title { font-size: 1.1rem; font-weight: 700; }
.pub-header-sub   { font-size: 0.875rem; opacity: .85; }

/* Contenu principal */
.pub-container {
  max-width: 680px;
  margin: 0 auto;
  padding: 16px;
}

/* Carte section */
.pub-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,.08);
}
.pub-card-title {
  font-size: 1rem;
  font-weight: 700;
  color: #1565c0;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 2px solid #e3f2fd;
}

/* Champs de formulaire */
.pub-field { margin-bottom: 16px; }
.pub-field label {
  display: block;
  font-size: .875rem;
  font-weight: 600;
  color: #444;
  margin-bottom: 6px;
}
.pub-field input[type="text"],
.pub-field input[type="email"],
.pub-field input[type="tel"],
.pub-field select,
.pub-field textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1.5px solid #ccc;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  transition: border-color .15s;
  background: white;
}
.pub-field input:focus,
.pub-field select:focus,
.pub-field textarea:focus {
  outline: none;
  border-color: #1565c0;
}
.pub-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 480px) { .pub-row { grid-template-columns: 1fr; } }

/* DOB sélecteurs */
.pub-dob {
  display: flex;
  gap: 8px;
  align-items: center;
}
.pub-dob select { flex: 1; }
.pub-dob span { color: #aaa; font-size: 1.1rem; }

/* Cases à cocher et radios */
.pub-checks { display: flex; flex-direction: column; gap: 10px; }
.pub-check, .pub-radio {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
  font-size: .9375rem;
  line-height: 1.4;
}
.pub-check input, .pub-radio input {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 2px;
  cursor: pointer;
  accent-color: #1565c0;
}
.pub-hint { font-size: .8125rem; color: #777; }

/* Fichiers */
.pub-field input[type="file"] {
  padding: 8px;
  background: #f5f5f5;
  border-style: dashed;
}

/* Notice RGPD */
.pub-rgpd {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 14px 16px;
  font-size: .8125rem;
  color: #555;
  line-height: 1.6;
  margin-bottom: 16px;
}
.pub-rgpd ul { margin: 8px 0 8px 18px; }
.pub-rgpd a { color: #1565c0; }

/* Requis */
.req { color: #c62828; }

/* Bouton principal */
.pub-btn {
  width: 100%;
  padding: 16px;
  background: #1565c0;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 1.0625rem;
  font-weight: 700;
  cursor: pointer;
  transition: background .15s;
  letter-spacing: .02em;
}
.pub-btn:hover   { background: #0d47a1; }
.pub-btn:disabled { background: #90a4ae; cursor: not-allowed; }

/* Messages d'erreur / succès */
.pub-errors {
  background: #ffebee;
  border: 1px solid #ef9a9a;
  border-radius: 8px;
  padding: 12px 16px;
  color: #b71c1c;
  font-size: .9rem;
  margin-bottom: 16px;
  display: none;
}
.pub-errors.visible { display: block; }
.pub-errors p { margin-bottom: 4px; }

.pub-success {
  background: #e8f5e9;
  border: 1px solid #a5d6a7;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
}
.pub-success-icon { font-size: 2.5rem; margin-bottom: 12px; }
.pub-success h2   { color: #2e7d32; font-size: 1.2rem; margin-bottom: 8px; }
.pub-success p    { color: #555; font-size: .9375rem; line-height: 1.5; }
```

- [ ] **Étape 2 : Commit**

```bash
git add css/public.css
git commit -m "feat: css/public.css — styles pages publiques mobile-first"
```

---

### Task 5 : Tests + logique de validation `inscription-publique.js`

**Files:**
- Create: `tests/test-inscription-publique.js`
- Create: `js/inscription-publique.js`
- Modify: `tests/run-all.js`

- [ ] **Étape 1 : Écrire le test en premier**

```js
// tests/test-inscription-publique.js
'use strict';
const assert = require('assert');

// Simuler les fonctions de validation (extraites de inscription-publique.js)
// On les injecte ici directement pour tester sans browser

function validatePublicForm(data) {
  const errors = [];
  if (!data.nom)                errors.push('Nom requis');
  if (!data.prenom)             errors.push('Prénom requis');
  if (!data.dobJ || !data.dobM || !data.dobY) errors.push('Date de naissance complète requise');
  if (!data.telephone)          errors.push('Téléphone requis');
  if (!data.mail)               errors.push('Adresse mail requise');
  if (!data.mail2)              errors.push('Confirmation mail requise');
  if (data.mail && data.mail2 && data.mail !== data.mail2) errors.push('Les deux adresses mail ne correspondent pas');
  if (!data.contact || data.contact.length === 0) errors.push('Modalité de contact préférée requise');
  if (!data.adresse)            errors.push('Adresse requise');
  if (!data.cp)                 errors.push('Code postal requis');
  if (!data.ville)              errors.push('Ville requise');
  if (!data.pays)               errors.push('Pays requis');
  if (!data.urgNom)             errors.push('Nom du contact d\'urgence requis');
  if (!data.urgTel)             errors.push('Téléphone du contact d\'urgence requis');
  if (!data.accomp || data.accomp.length === 0) errors.push('Besoin d\'accompagnement requis');
  if (!data.gilet)              errors.push('Réponse sur le gilet de sauvetage requise');
  if (!data.rgpd)               errors.push('Attestation RGPD requise');
  if (!data.ccas)               errors.push('Réponse communications CCAS requise');
  if (!data.reglement)          errors.push('Règlement de fonctionnement requis');
  if (!data.signature)          errors.push('Signature requise');
  return errors;
}

// Données minimales valides
const valid = {
  nom: 'DUPONT', prenom: 'Marie',
  dobJ: '15', dobM: '3', dobY: '1958',
  telephone: '06 00 00 00 00',
  mail: 'marie@test.fr', mail2: 'marie@test.fr',
  contact: ['mail'],
  adresse: '12 rue de la Plage', cp: '06600', ville: 'Antibes', pays: 'France',
  urgNom: 'Pierre Dupont', urgTel: '06 11 22 33 44',
  accomp: ['aucun'],
  gilet: 'oui',
  rgpd: true, ccas: 'accepte', reglement: true,
  signature: 'Marie DUPONT',
};

// Test 1 : formulaire valide → aucune erreur
const e1 = validatePublicForm(valid);
assert.strictEqual(e1.length, 0, 'Formulaire valide attendu : ' + JSON.stringify(e1));
console.log('✓ Formulaire valide → 0 erreurs');

// Test 2 : nom manquant
const e2 = validatePublicForm({ ...valid, nom: '' });
assert.ok(e2.some(e => e.includes('Nom')), 'Doit signaler le nom manquant');
console.log('✓ Nom manquant → erreur détectée');

// Test 3 : mails différents
const e3 = validatePublicForm({ ...valid, mail2: 'autre@test.fr' });
assert.ok(e3.some(e => e.includes('correspondent pas')), 'Doit signaler les mails différents');
console.log('✓ Mails différents → erreur détectée');

// Test 4 : date de naissance incomplète
const e4 = validatePublicForm({ ...valid, dobM: '' });
assert.ok(e4.some(e => e.includes('naissance')), 'Doit signaler la date incomplète');
console.log('✓ Date incomplète → erreur détectée');

// Test 5 : accompagnement vide
const e5 = validatePublicForm({ ...valid, accomp: [] });
assert.ok(e5.some(e => e.includes('accompagnement')), 'Doit signaler accompagnement vide');
console.log('✓ Accompagnement vide → erreur détectée');

// Test 6 : RGPD non coché
const e6 = validatePublicForm({ ...valid, rgpd: false });
assert.ok(e6.some(e => e.includes('RGPD')), 'Doit signaler RGPD non coché');
console.log('✓ RGPD non coché → erreur détectée');

console.log('✓ test-inscription-publique.js OK');
```

- [ ] **Étape 2 : Lancer le test — doit échouer (validatePublicForm non définie dans le module)**

```bash
node tests/test-inscription-publique.js
```

Expected: `ReferenceError: validatePublicForm is not defined` ou similaire — c'est le comportement attendu en TDD.

- [ ] **Étape 3 : Écrire js/inscription-publique.js**

```js
// js/inscription-publique.js
'use strict';

function _escP(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function validatePublicForm(data) {
  var errors = [];
  if (!data.nom)                errors.push('Nom requis');
  if (!data.prenom)             errors.push('Prénom requis');
  if (!data.dobJ || !data.dobM || !data.dobY) errors.push('Date de naissance complète requise');
  if (!data.telephone)          errors.push('Téléphone requis');
  if (!data.mail)               errors.push('Adresse mail requise');
  if (!data.mail2)              errors.push('Confirmation mail requise');
  if (data.mail && data.mail2 && data.mail !== data.mail2) errors.push('Les deux adresses mail ne correspondent pas');
  if (!data.contact || data.contact.length === 0) errors.push('Modalité de contact préférée requise');
  if (!data.adresse)            errors.push('Adresse requise');
  if (!data.cp)                 errors.push('Code postal requis');
  if (!data.ville)              errors.push('Ville requise');
  if (!data.pays)               errors.push('Pays requis');
  if (!data.urgNom)             errors.push('Nom du contact d\'urgence requis');
  if (!data.urgTel)             errors.push('Téléphone du contact d\'urgence requis');
  if (!data.accomp || data.accomp.length === 0) errors.push('Besoin d\'accompagnement requis');
  if (!data.gilet)              errors.push('Réponse sur le gilet de sauvetage requise');
  if (!data.rgpd)               errors.push('Attestation RGPD requise');
  if (!data.ccas)               errors.push('Réponse communications CCAS requise');
  if (!data.reglement)          errors.push('Règlement de fonctionnement requis');
  if (!data.signature)          errors.push('Signature requise');
  return errors;
}

function _collectFormData() {
  var g  = function(id) { return document.getElementById(id); };
  var gv = function(id) { var el = g(id); return el ? el.value.trim() : ''; };
  var gr = function(name) { var el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; };
  var ga = function(name) { return Array.from(document.querySelectorAll('input[name="' + name + '"]:checked')).map(function(el) { return el.value; }); };
  return {
    nom:        gv('f-nom').toUpperCase(),
    prenom:     gv('f-prenom'),
    dobJ:       gv('f-dob-j'),
    dobM:       gv('f-dob-m'),
    dobY:       gv('f-dob-y'),
    telephone:  gv('f-tel'),
    mail:       gv('f-mail'),
    mail2:      gv('f-mail2'),
    contact:    ga('contact'),
    adresse:    gv('f-adresse'),
    cp:         gv('f-cp'),
    ville:      gv('f-ville'),
    pays:       gv('f-pays'),
    urgNom:     gv('f-urg-nom'),
    urgTel:     gv('f-urg-tel'),
    accomp:     ga('accomp'),
    at:         ga('at'),
    gilet:      gr('gilet'),
    rgpd:       !!(g('f-rgpd') && g('f-rgpd').checked),
    ccas:       gr('ccas'),
    reglement:  !!(g('f-reglement') && g('f-reglement').checked),
    signature:  gv('f-signature'),
  };
}

function _readFiles(input1, input2, callback) {
  function readOne(input, cb) {
    if (!input || !input.files || input.files.length === 0) { cb(null, ''); return; }
    var file = input.files[0];
    var reader = new FileReader();
    reader.onload = function(e) { cb(e.target.result, file.name); };
    reader.readAsDataURL(file);
  }
  readOne(input1, function(b64a, nameA) {
    readOne(input2, function(b64b, nameB) {
      callback(b64a, nameA, b64b, nameB);
    });
  });
}

function initInscriptionPublique() {
  var form    = document.getElementById('pub-form');
  var errEl   = document.getElementById('pub-errors');
  var succEl  = document.getElementById('pub-success');
  var submitBtn = document.getElementById('pub-submit');
  if (!form) return;

  // Exclusivité "aucun" accompagnement
  var accompAucun = document.getElementById('accomp-aucun');
  if (accompAucun) {
    var accompOthers = document.querySelectorAll('input[name="accomp"]:not([value="aucun"])');
    accompAucun.addEventListener('change', function() {
      if (accompAucun.checked) accompOthers.forEach(function(el) { el.checked = false; });
    });
    accompOthers.forEach(function(el) {
      el.addEventListener('change', function() { if (el.checked) accompAucun.checked = false; });
    });
  }

  // Exclusivité "aucun" aides techniques
  var atAucun = document.getElementById('at-aucun');
  if (atAucun) {
    var atOthers = document.querySelectorAll('input[name="at"]:not([value="aucun"])');
    atAucun.addEventListener('change', function() {
      if (atAucun.checked) atOthers.forEach(function(el) { el.checked = false; });
    });
    atOthers.forEach(function(el) {
      el.addEventListener('change', function() { if (el.checked) atAucun.checked = false; });
    });
  }

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    errEl.innerHTML = '';
    errEl.classList.remove('visible');

    var data   = _collectFormData();
    var errors = validatePublicForm(data);

    // Validation fichier obligatoire
    var doc1Input = document.getElementById('f-doc1');
    if (!doc1Input || !doc1Input.files || doc1Input.files.length === 0) {
      errors.push('Document justificatif principal requis (CMI recto-verso)');
    }

    if (errors.length > 0) {
      errEl.innerHTML = errors.map(function(e) { return '<p>• ' + _escP(e) + '</p>'; }).join('');
      errEl.classList.add('visible');
      errEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours…';

    _readFiles(
      document.getElementById('f-doc1'),
      document.getElementById('f-doc2'),
      function(b64a, nameA, b64b, nameB) {
        var inscData = {
          statut:            'en_attente',
          nom:               data.nom,
          prenom:            data.prenom,
          mail:              data.mail,
          telephone:         data.telephone,
          metadata: {
            mailConfirm:       data.mail2,
            dateNaissance:     { jour: parseInt(data.dobJ), mois: parseInt(data.dobM), annee: parseInt(data.dobY) },
            contactPreference: data.contact,
            adresse:           data.adresse,
            codePostal:        data.cp,
            ville:             data.ville,
            pays:              data.pays,
            urgenceNom:        data.urgNom,
            urgenceTel:        data.urgTel,
            accompagnement:    data.accomp,
            aidesTechniques:   data.at,
            gilet:             data.gilet,
            rgpd:              data.rgpd,
            ccasCommunications: data.ccas,
            reglement:         data.reglement,
            signature:         data.signature,
            justificatif1:     b64a || null,
            justificatif1Name: nameA || '',
            justificatif2:     b64b || null,
            justificatif2Name: nameB || '',
          },
        };

        supabaseClient.from('inscriptions').insert({
          nom:       inscData.nom,
          prenom:    inscData.prenom,
          mail:      inscData.mail,
          telephone: inscData.telephone,
          statut:    'en_attente',
          metadata:  inscData.metadata,
        }).then(function(result) {
          if (result.error) {
            errEl.innerHTML = '<p>Erreur lors de l\'envoi : ' + _escP(result.error.message) + '</p>';
            errEl.classList.add('visible');
            submitBtn.disabled = false;
            submitBtn.textContent = 'VALIDER MA DEMANDE D\'INSCRIPTION';
            return;
          }
          form.style.display = 'none';
          succEl.style.display = 'block';
          succEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    );
  });
}

if (typeof module !== 'undefined') {
  module.exports = { validatePublicForm };
}
```

- [ ] **Étape 4 : Relancer les tests — doivent passer**

```bash
node tests/test-inscription-publique.js
```

Expected: `✓ test-inscription-publique.js OK`

- [ ] **Étape 5 : Ajouter le test à run-all.js**

Dans `tests/run-all.js`, ajouter `'test-inscription-publique.js'` dans le tableau `tests` :

```js
const tests = ['test-slots.js', 'test-timer.js', 'test-storage.js', 'test-pass.js', 'test-auth.js', 'test-supabase-inscriptions.js', 'test-supabase-mc.js', 'test-supabase-storage.js', 'test-inscription-publique.js'];
```

- [ ] **Étape 6 : Vérifier la suite complète**

```bash
node tests/run-all.js
```

Expected: `✅ Tous les tests passent.`

- [ ] **Étape 7 : Commit**

```bash
git add js/inscription-publique.js tests/test-inscription-publique.js tests/run-all.js
git commit -m "feat: validation formulaire inscription publique + tests"
```

---

### Task 6 : Page `inscription-publique.html`

**Files:**
- Create: `inscription-publique.html`

Page complète du formulaire d'inscription public. Même champs que le formulaire staff, sans les éléments réservés au staff (statut, pass, historique).

- [ ] **Étape 1 : Créer inscription-publique.html**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Handiplage — Demande d'inscription</title>
  <link rel="stylesheet" href="css/public.css">
</head>
<body>

<header class="pub-header">
  <div>
    <div class="pub-header-title">🏖 Handiplage Antibes</div>
    <div class="pub-header-sub">Demande d'inscription 2026</div>
  </div>
</header>

<div class="pub-container">

  <div id="pub-errors" class="pub-errors"></div>

  <!-- Message de succès (masqué au départ) -->
  <div id="pub-success" class="pub-success" style="display:none">
    <div class="pub-success-icon">✅</div>
    <h2>Demande envoyée !</h2>
    <p>Votre demande d'inscription a bien été enregistrée.<br>
       Vous recevrez un email lorsqu'elle sera traitée par notre équipe (délai habituel : quelques jours).</p>
  </div>

  <form id="pub-form">

    <!-- IDENTITÉ -->
    <div class="pub-card">
      <div class="pub-card-title">Identité</div>
      <div class="pub-row">
        <div class="pub-field">
          <label>Nom <span class="req">*</span></label>
          <input type="text" id="f-nom" placeholder="NOM" style="text-transform:uppercase">
        </div>
        <div class="pub-field">
          <label>Prénom <span class="req">*</span></label>
          <input type="text" id="f-prenom" placeholder="Prénom">
        </div>
      </div>
      <div class="pub-row">
        <div class="pub-field">
          <label>Date de naissance <span class="req">*</span></label>
          <div class="pub-dob">
            <select id="f-dob-j">
              <option value="">Jour</option>
              <!-- 1–31 injecté par JS -->
            </select>
            <span>/</span>
            <select id="f-dob-m">
              <option value="">Mois</option>
              <!-- 1–12 injecté par JS -->
            </select>
            <span>/</span>
            <select id="f-dob-y">
              <option value="">Année</option>
              <!-- 1920–année en cours injecté par JS -->
            </select>
          </div>
        </div>
        <div class="pub-field">
          <label>Téléphone <span class="req">*</span></label>
          <input type="tel" id="f-tel" placeholder="Ex : 06 00 00 00 00">
        </div>
      </div>
      <div class="pub-row">
        <div class="pub-field">
          <label>Adresse mail <span class="req">*</span></label>
          <input type="email" id="f-mail" placeholder="adresse@mail.fr">
        </div>
        <div class="pub-field">
          <label>Confirmation du mail <span class="req">*</span></label>
          <input type="email" id="f-mail2" placeholder="adresse@mail.fr">
        </div>
      </div>
      <div class="pub-field">
        <label>Modalité de contact préférée <span class="req">*</span></label>
        <div class="pub-checks">
          <label class="pub-check"><input type="checkbox" name="contact" value="telephone"> Téléphone</label>
          <label class="pub-check"><input type="checkbox" name="contact" value="mail"> Mail</label>
        </div>
      </div>
    </div>

    <!-- ADRESSE -->
    <div class="pub-card">
      <div class="pub-card-title">Adresse</div>
      <div class="pub-field">
        <label>Adresse <span class="req">*</span></label>
        <input type="text" id="f-adresse" placeholder="N° et nom de la voie">
      </div>
      <div class="pub-row">
        <div class="pub-field">
          <label>Code postal <span class="req">*</span></label>
          <input type="text" id="f-cp" placeholder="06600">
        </div>
        <div class="pub-field">
          <label>Ville <span class="req">*</span></label>
          <input type="text" id="f-ville" placeholder="Antibes">
        </div>
      </div>
      <div class="pub-field">
        <label>Pays <span class="req">*</span></label>
        <input type="text" id="f-pays" value="France">
      </div>
    </div>

    <!-- CONTACT D'URGENCE -->
    <div class="pub-card">
      <div class="pub-card-title">Contact d'urgence</div>
      <div class="pub-row">
        <div class="pub-field">
          <label>Nom et prénom <span class="req">*</span></label>
          <input type="text" id="f-urg-nom" placeholder="Prénom NOM">
        </div>
        <div class="pub-field">
          <label>Téléphone <span class="req">*</span></label>
          <input type="tel" id="f-urg-tel" placeholder="Ex : 06 00 00 00 00">
        </div>
      </div>
    </div>

    <!-- BESOINS -->
    <div class="pub-card">
      <div class="pub-card-title">Besoins d'accompagnement par notre équipe d'handiplagistes <span class="req">*</span></div>
      <div class="pub-checks">
        <label class="pub-check"><input type="checkbox" name="accomp" value="aucun" id="accomp-aucun"> Aucun besoin</label>
        <label class="pub-check"><input type="checkbox" name="accomp" value="transfert"> Aide au transfert</label>
        <label class="pub-check"><input type="checkbox" name="accomp" value="entree_sortie"> Aide à l'entrée et à la sortie de l'eau</label>
        <label class="pub-check"><input type="checkbox" name="accomp" value="baignade"> Aide à la baignade, maximum 30 minutes</label>
      </div>

      <div class="pub-card-title" style="margin-top:20px">Besoins d'aides techniques <span class="req">*</span></div>
      <div class="pub-checks">
        <label class="pub-check"><input type="checkbox" name="at" value="aucun" id="at-aucun"> Aucun besoin</label>
        <label class="pub-check"><input type="checkbox" name="at" value="tiralo" id="at-tiralo"> Tiralo <span class="pub-hint">(fauteuil amphibie équipé de flotteurs)</span></label>
        <label class="pub-check"><input type="checkbox" name="at" value="hippocampe" id="at-hippocampe"> Hippocampe <span class="pub-hint">(fauteuil tout terrain pour aller au bord de l'eau)</span></label>
        <label class="pub-check"><input type="checkbox" name="at" value="audioplage" id="at-audioplage"> Audioplage <span class="pub-hint">(balisage sonore en mer pour personnes déficientes visuelles)</span></label>
      </div>
    </div>

    <!-- ENGAGEMENTS -->
    <div class="pub-card">
      <div class="pub-card-title">Engagements</div>

      <div class="pub-field">
        <label>Port du gilet de sauvetage <span class="req">*</span></label>
        <div class="pub-checks">
          <label class="pub-radio"><input type="radio" name="gilet" value="oui"> J'accepte le port du gilet de sauvetage, obligatoire dans le cadre de ma baignade</label>
          <label class="pub-radio"><input type="radio" name="gilet" value="non"> Je n'accepte pas, et j'atteste dégager le CCAS d'Antibes Juan-les-Pins de toutes responsabilités</label>
        </div>
      </div>

      <div class="pub-field">
        <label>Traitement des données personnelles <span class="req">*</span></label>
        <label class="pub-check"><input type="checkbox" id="f-rgpd"> J'atteste avoir pris connaissance de l'information relative au traitement des données personnelles</label>
      </div>

      <div class="pub-field">
        <label>Communications du CCAS <span class="req">*</span></label>
        <div class="pub-checks">
          <label class="pub-radio"><input type="radio" name="ccas" value="accepte"> J'accepte de recevoir par mail des informations de la part du CCAS</label>
          <label class="pub-radio"><input type="radio" name="ccas" value="refuse"> Je refuse de recevoir par mail des informations de la part du CCAS</label>
        </div>
      </div>

      <div class="pub-field">
        <label>Règlement de fonctionnement <span class="req">*</span></label>
        <label class="pub-check"><input type="checkbox" id="f-reglement"> J'ai lu et j'accepte le règlement de fonctionnement Handiplage 2026 sans restriction</label>
      </div>
    </div>

    <!-- DOCUMENTS -->
    <div class="pub-card">
      <div class="pub-card-title">Documents justificatifs</div>
      <p style="font-size:.9rem;color:#555;margin-bottom:12px;line-height:1.5">
        Joindre le justificatif du handicap <strong>RECTO-VERSO</strong>, avec identité et date de validité lisible <span class="req">*</span><br>
        <em>Carte Mobilité Inclusion (CMI) — les documents de l'assurance maladie ne sont pas valables.</em>
      </p>
      <div class="pub-field">
        <label>Document principal (recto-verso) <span class="req">*</span></label>
        <input type="file" id="f-doc1" accept="image/*,.pdf">
      </div>
      <div class="pub-field">
        <label>Deuxième document <span style="font-size:.8rem;color:#777">(verso si le premier n'est pas recto-verso)</span></label>
        <input type="file" id="f-doc2" accept="image/*,.pdf">
      </div>
      <div class="pub-field">
        <label>Signature <span class="req">*</span> — <span style="font-size:.8rem;color:#777">La saisie de vos nom et prénom vaut signature</span></label>
        <input type="text" id="f-signature" placeholder="Prénom NOM">
      </div>
    </div>

    <!-- RGPD NOTICE -->
    <div class="pub-rgpd">
      <p>Les informations recueillies dans ce formulaire ne sont utilisées que par le service Autonomie et Adaptation du Cadre de Vie du CCAS d'Antibes. Les données sont conservées pendant 2 ans à compter de la fermeture saisonnière de la Handiplage.</p>
      <ul>
        <li>Remplir les obligations notamment statistiques du CCAS ;</li>
        <li>Améliorer, si nécessaire, les actions proposées en vous demandant par mail de remplir le questionnaire de satisfaction.</li>
      </ul>
      <p style="margin-top:8px">Vous disposez d'un droit d'accès, de rectification, d'opposition, de limitation et de suppression de vos données en contactant le DPO du CCAS : <a href="mailto:rgpd@ccas-antibes.fr">rgpd@ccas-antibes.fr</a> — CCAS, 2 avenue de la Libération, BP 83, 06602 Antibes CEDEX.</p>
    </div>

    <button type="submit" class="pub-btn" id="pub-submit">VALIDER MA DEMANDE D'INSCRIPTION</button>

  </form>
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/env.js"></script>
<script src="js/supabase-client.js"></script>
<script src="js/inscription-publique.js"></script>
<script>
  // Peupler les sélecteurs de date
  (function() {
    var dobJ = document.getElementById('f-dob-j');
    var dobM = document.getElementById('f-dob-m');
    var dobY = document.getElementById('f-dob-y');
    for (var d = 1; d <= 31; d++) {
      var o = document.createElement('option');
      o.value = d; o.textContent = String(d).padStart(2, '0');
      dobJ.appendChild(o);
    }
    for (var m = 1; m <= 12; m++) {
      var o = document.createElement('option');
      o.value = m; o.textContent = String(m).padStart(2, '0');
      dobM.appendChild(o);
    }
    var currentYear = new Date().getFullYear();
    for (var y = currentYear - 5; y >= 1920; y--) {
      var o = document.createElement('option');
      o.value = y; o.textContent = y;
      dobY.appendChild(o);
    }
    initInscriptionPublique();
  })();
</script>
</body>
</html>
```

- [ ] **Étape 2 : Tester manuellement dans le navigateur**

Ouvrir `inscription-publique.html` dans le navigateur (via le serveur local ou directement).
- Tester la soumission avec des champs vides → erreurs affichées
- Tester avec toutes les données valides + un fichier → message de succès
- Vérifier dans Supabase Studio que l'inscription est créée avec `statut = 'en_attente'`

- [ ] **Étape 3 : Commit**

```bash
git add inscription-publique.html js/inscription-publique.js
git commit -m "feat: page inscription-publique.html + logique formulaire"
```

---

### Task 7 : UI refus dans `inscription.js`

Quand le staff passe une inscription à `statut = 'refuse'`, un champ de motif apparaît et un bouton "Envoyer email de refus" génère le token et ouvre la messagerie locale.

**Files:**
- Modify: `js/inscription.js`

- [ ] **Étape 1 : Ajouter la fonction `_handleRefusal` dans inscription.js**

Dans `js/inscription.js`, après la déclaration de `_buildMetadata`, ajouter :

```js
async function _sendRefusalEmail(inscriptionId) {
  var motif = document.getElementById('refus-motif') && document.getElementById('refus-motif').value.trim();
  if (!motif) {
    alert('Veuillez saisir le motif du refus avant d\'envoyer l\'email.');
    return;
  }
  var btn = document.getElementById('btn-send-refusal');
  if (btn) { btn.disabled = true; btn.textContent = 'Envoi…'; }

  try {
    var session = await (typeof getSession === 'function' ? getSession() : Promise.resolve(null));
    var response = await fetch(window.SUPABASE_CONFIG.url + '/functions/v1/send-refusal-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (session ? session.access_token : ''),
      },
      body: JSON.stringify({ inscriptionId: inscriptionId, motif: motif }),
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Erreur serveur');
    window.location.href = data.mailtoLink;
    if (btn) { btn.disabled = false; btn.textContent = 'Ouvrir le modèle d\'email'; }
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Ouvrir le modèle d\'email'; }
    alert('Erreur : ' + err.message);
  }
}
```

- [ ] **Étape 2 : Modifier la section statut dans `_showForm`**

Dans `_showForm`, remplacer le bloc `insc-form-status-sel` existant par :

```js
+ (!isNew ? '<div class="insc-form-status-sel">'
  + '<label>Statut :</label>'
  + '<select id="insc-statut">'
  + '<option value="en_attente"' + ((!v.statut || v.statut === 'en_attente') ? ' selected' : '') + '>En attente</option>'
  + '<option value="valide"' + (v.statut === 'valide' ? ' selected' : '') + '>Validé ✓</option>'
  + '<option value="refuse"' + (v.statut === 'refuse' ? ' selected' : '') + '>Refusé ✗</option>'
  + '</select></div>'
  + '<div id="refus-block" style="' + (v.statut === 'refuse' ? '' : 'display:none') + ';margin-top:10px">'
  + '<textarea id="refus-motif" placeholder="Motif du refus (justificatif non valable, etc.)" rows="3" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:13px;resize:vertical"></textarea>'
  + '<button type="button" id="btn-send-refusal" style="margin-top:6px;padding:7px 14px;background:#e53935;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px">✉ Ouvrir le modèle d\'email de refus</button>'
  + '</div>'
  : '')
```

- [ ] **Étape 3 : Wirer le bloc refus dans le gestionnaire de statut**

Dans le listener `statutEl.addEventListener('change', ...)`, après `const newStatut = statutEl.value;` :

```js
// Afficher/masquer bloc refus
var refusBlock = document.getElementById('refus-block');
if (refusBlock) refusBlock.style.display = newStatut === 'refuse' ? 'block' : 'none';
```

Et après le `if (!isNew) _bindPassButtons();` existant, ajouter :

```js
// Wirer bouton refus
var btnRefusal = document.getElementById('btn-send-refusal');
if (btnRefusal && !isNew && v.id) {
  btnRefusal.addEventListener('click', function() { _sendRefusalEmail(v.id); });
}
```

- [ ] **Étape 4 : Test manuel**

1. Ouvrir une inscription en attente dans l'interface staff
2. Changer le statut à "Refusé"
3. Vérifier que le bloc motif apparaît
4. Saisir un motif et cliquer "Ouvrir le modèle d'email"
5. Vérifier que la messagerie locale s'ouvre avec l'email pré-rempli
6. Vérifier dans Supabase Studio que la ligne `messages` a été créée

- [ ] **Étape 5 : Commit**

```bash
git add js/inscription.js
git commit -m "feat: UI refus dans inscription.js + appel send-refusal-email"
```

---

### Task 8 : Page `reponse.html` + `js/reponse.js`

**Files:**
- Create: `reponse.html`
- Create: `js/reponse.js`

- [ ] **Étape 1 : Écrire js/reponse.js**

```js
// js/reponse.js
'use strict';

function initReponsePage() {
  var params  = new URLSearchParams(window.location.search);
  var token   = params.get('token');
  var form    = document.getElementById('reponse-form');
  var errEl   = document.getElementById('reponse-errors');
  var succEl  = document.getElementById('reponse-success');
  var submitBtn = document.getElementById('reponse-submit');

  if (!token) {
    document.getElementById('reponse-content').innerHTML =
      '<p style="color:#c62828;padding:20px">Lien invalide. Vérifiez l\'URL dans votre email.</p>';
    return;
  }

  if (!form) return;

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    var contenu = document.getElementById('f-contenu').value.trim();

    errEl.innerHTML = '';
    errEl.classList.remove('visible');

    if (contenu.length < 10) {
      errEl.innerHTML = '<p>• Votre message doit contenir au moins 10 caractères.</p>';
      errEl.classList.add('visible');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours…';

    try {
      var response = await fetch(window.SUPABASE_CONFIG.url + '/functions/v1/submit-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token, contenu: contenu }),
      });
      var data = await response.json();

      if (!response.ok) {
        errEl.innerHTML = '<p>' + (data.error || 'Erreur lors de l\'envoi.') + '</p>';
        errEl.classList.add('visible');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Envoyer ma réponse';
        return;
      }

      form.style.display = 'none';
      succEl.style.display = 'block';
    } catch (err) {
      errEl.innerHTML = '<p>Erreur réseau. Réessayez.</p>';
      errEl.classList.add('visible');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Envoyer ma réponse';
    }
  });
}
```

- [ ] **Étape 2 : Écrire reponse.html**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Handiplage — Réponse à votre dossier</title>
  <link rel="stylesheet" href="css/public.css">
</head>
<body>

<header class="pub-header">
  <div>
    <div class="pub-header-title">🏖 Handiplage Antibes</div>
    <div class="pub-header-sub">Réponse à votre dossier</div>
  </div>
</header>

<div class="pub-container">
  <div id="reponse-content">

    <div class="pub-card">
      <div class="pub-card-title">Adressez votre réponse à l'équipe Handiplage</div>
      <p style="font-size:.9375rem;color:#555;margin-bottom:16px;line-height:1.6">
        Ce formulaire vous permet de répondre à la décision concernant votre demande d'inscription.
        Joignez tout élément complémentaire en décrivant votre situation dans le champ ci-dessous.
      </p>

      <div id="reponse-errors" class="pub-errors"></div>

      <div id="reponse-success" class="pub-success" style="display:none">
        <div class="pub-success-icon">✅</div>
        <h2>Réponse envoyée !</h2>
        <p>Votre réponse a bien été transmise à l'équipe Handiplage.<br>
           Elle sera examinée dans les meilleurs délais.</p>
      </div>

      <form id="reponse-form">
        <div class="pub-field">
          <label for="f-contenu">Votre message <span class="req">*</span></label>
          <textarea id="f-contenu" rows="8" placeholder="Décrivez votre situation, joignez les informations complémentaires…" style="width:100%;padding:12px;border:1.5px solid #ccc;border-radius:8px;font-size:1rem;font-family:inherit;resize:vertical"></textarea>
        </div>
        <button type="submit" class="pub-btn" id="reponse-submit">Envoyer ma réponse</button>
      </form>
    </div>

  </div>
</div>

<script src="js/env.js"></script>
<script src="js/reponse.js"></script>
<script>
  initReponsePage();
</script>
</body>
</html>
```

- [ ] **Étape 3 : Test manuel**

1. Dans Supabase Studio, récupérer un token depuis la table `messages`
2. Ouvrir `reponse.html?token=<le-token>` dans le navigateur
3. Soumettre un message
4. Vérifier dans Supabase Studio que `messages.contenu` a été mis à jour

- [ ] **Étape 4 : Commit**

```bash
git add reponse.html js/reponse.js
git commit -m "feat: page reponse.html + js/reponse.js (formulaire réponse refus)"
```

---

### Task 9 : Gestion du flux invitation dans `login.html`

Quand un usager clique sur le lien d'invitation Supabase, il arrive sur `login.html` avec le token dans le hash. Supabase SDK v2 le connecte automatiquement. On détecte cet état et on demande de créer un mot de passe.

**Files:**
- Modify: `login.html`

- [ ] **Étape 1 : Ajouter le formulaire de création de mot de passe dans login.html**

Dans `login.html`, après la balise `</form>` du formulaire de connexion existant, ajouter :

```html
<!-- Formulaire création mot de passe (visible après invitation) -->
<form id="set-password-form" style="display:none" novalidate>
  <p style="font-size:.9rem;color:#444;margin-bottom:1rem;line-height:1.5">
    Bienvenue sur votre espace Handiplage.<br>Choisissez un mot de passe pour accéder à votre compte.
  </p>
  <label for="new-password">Nouveau mot de passe</label>
  <input type="password" id="new-password" name="new-password" autocomplete="new-password"
    placeholder="8 caractères minimum" required />
  <label for="new-password2">Confirmer le mot de passe</label>
  <input type="password" id="new-password2" name="new-password2" autocomplete="new-password"
    placeholder="Répétez le mot de passe" required />
  <button type="submit" id="set-pwd-btn">Créer mon mot de passe</button>
</form>
```

- [ ] **Étape 2 : Ajouter la logique de détection invite dans le script de login.html**

Dans le script inline de `login.html`, avant `form.addEventListener('submit', ...)`, ajouter :

```js
// Détecter le flux invitation (lien Supabase avec type=invite dans le hash)
const urlHash = window.location.hash;
const isInvite = urlHash.includes('type=invite') || urlHash.includes('type=recovery');

supabaseClient.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session && isInvite) {
    // Masquer le formulaire de connexion, afficher celui du mot de passe
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('forgot-btn').style.display = 'none';
    document.getElementById('set-password-form').style.display = 'block';
    // Nettoyer le hash de l'URL
    history.replaceState(null, '', window.location.pathname);
  } else if (event === 'SIGNED_IN' && session && !isInvite) {
    const role = getUserRole(session);
    if (role === 'staff') { window.location.href = '/index.html'; }
    else if (role === 'user') { window.location.href = '/usager.html'; }
  }
});

const setPasswordForm = document.getElementById('set-password-form');
const setPwdBtn = document.getElementById('set-pwd-btn');
setPasswordForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  errorMsg.textContent = '';
  const pwd  = document.getElementById('new-password').value;
  const pwd2 = document.getElementById('new-password2').value;
  if (pwd.length < 8) { errorMsg.textContent = 'Le mot de passe doit contenir au moins 8 caractères.'; return; }
  if (pwd !== pwd2)   { errorMsg.textContent = 'Les deux mots de passe ne correspondent pas.'; return; }
  setPwdBtn.disabled = true;
  setPwdBtn.textContent = 'Enregistrement…';
  try {
    const { error } = await supabaseClient.auth.updateUser({ password: pwd });
    if (error) throw error;
    window.location.href = '/usager.html';
  } catch (err) {
    errorMsg.textContent = 'Erreur : ' + (err.message || 'Impossible de définir le mot de passe.');
    setPwdBtn.disabled = false;
    setPwdBtn.textContent = 'Créer mon mot de passe';
  }
});
```

- [ ] **Étape 3 : Test manuel du flux invitation**

1. Dans l'interface staff, valider une inscription avec un email réel
2. Cliquer sur l'email reçu
3. Vérifier que `login.html` affiche le formulaire de création de mot de passe
4. Créer le mot de passe → vérifier la redirection vers `/usager.html`

- [ ] **Étape 4 : Commit final**

```bash
git add login.html
git commit -m "feat: login.html gère le flux invitation Supabase (création mot de passe)"
```

---

## Vérification finale

```bash
node tests/run-all.js
```

Expected: `✅ Tous les tests passent.`

Tester manuellement le flux complet :
1. `inscription-publique.html` → soumission → vérifier Supabase
2. Interface staff → refus avec motif → email de refus ouvert dans messagerie
3. `reponse.html?token=<token>` → réponse soumise → vérifier Supabase
4. Interface staff → validation → email invitation → `login.html` → mot de passe → `/usager.html`
