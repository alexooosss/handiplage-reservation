# Messages Staff — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une rubrique "Messages" dans l'interface staff pour voir et traiter les réponses des usagers refusés.

**Architecture:** Nouvelle vue `messages-view` dans `index.html`, routée via `app.js`. `js/supabase-messages.js` gère les requêtes Supabase. `js/messages.js` gère le rendu. Chaque message permet de valider l'inscription (appelle `updateInscription` + `inviteUser`) ou d'ouvrir la messagerie locale pour répondre.

**Dépendance :** Plan `2026-07-04-inscription-publique.md` doit être exécuté d'abord (table `messages` requise).

**Tech Stack:** Vanilla JS ES6, Supabase JS SDK v2, CSS existant (`style.css`).

---

## Structure des fichiers

| Fichier | Rôle |
|---------|------|
| `js/supabase-messages.js` | Requêtes Supabase pour la table messages |
| `js/messages.js` | Rendu de la vue Messages (liste + détail) |
| `index.html` *(modifié)* | Nouvel onglet Messages + conteneur vue |
| `js/app.js` *(modifié)* | Routing vers la vue Messages |
| `css/style.css` *(modifié)* | Styles de la vue Messages |
| `tests/test-supabase-messages.js` | Tests transformations pures |
| `tests/run-all.js` *(modifié)* | Ajouter le nouveau test |

---

### Task 1 : `js/supabase-messages.js`

**Files:**
- Create: `js/supabase-messages.js`

- [ ] **Étape 1 : Écrire le test**

```js
// tests/test-supabase-messages.js
'use strict';
const assert = require('assert');

// Tester la transformation pure d'une ligne messages → objet local
function _rowToMessage(row) {
  return {
    id:              row.id,
    inscriptionId:   row.inscription_id,
    motifRefus:      row.motif_refus,
    token:           row.token,
    tokenExpiresAt:  row.token_expires_at,
    contenu:         row.contenu || null,
    lu:              !!row.lu,
    createdAt:       row.created_at,
    // champs dénormalisés depuis la jointure inscriptions
    nom:             row.inscriptions ? row.inscriptions.nom   : null,
    prenom:          row.inscriptions ? row.inscriptions.prenom : null,
    mail:            row.inscriptions ? row.inscriptions.mail   : null,
    statut:          row.inscriptions ? row.inscriptions.statut : null,
  };
}

// Test 1 : transformation basique
var row1 = {
  id: 'msg-1', inscription_id: 'insc-1', motif_refus: 'CMI illisible',
  token: 'tok-abc', token_expires_at: '2026-08-01T00:00:00Z',
  contenu: null, lu: false, created_at: '2026-07-01T10:00:00Z',
  inscriptions: { nom: 'DUPONT', prenom: 'Marie', mail: 'marie@test.fr', statut: 'refuse' },
};
var m1 = _rowToMessage(row1);
assert.strictEqual(m1.nom, 'DUPONT', 'nom dénormalisé');
assert.strictEqual(m1.motifRefus, 'CMI illisible', 'motifRefus mappé');
assert.strictEqual(m1.contenu, null, 'contenu null si pas de réponse');
assert.strictEqual(m1.lu, false, 'lu=false');
console.log('✓ _rowToMessage basique OK');

// Test 2 : message avec réponse + déjà lu
var row2 = { ...row1, contenu: 'Voici ma CMI en pièce jointe', lu: true };
var m2 = _rowToMessage(row2);
assert.strictEqual(m2.contenu, 'Voici ma CMI en pièce jointe', 'contenu présent');
assert.strictEqual(m2.lu, true, 'lu=true');
console.log('✓ _rowToMessage avec réponse OK');

// Test 3 : pas de jointure inscriptions (row sans inscriptions)
var row3 = { ...row1, inscriptions: null };
var m3 = _rowToMessage(row3);
assert.strictEqual(m3.nom, null, 'nom null sans jointure');
console.log('✓ _rowToMessage sans jointure OK');

console.log('✓ test-supabase-messages.js OK');
```

- [ ] **Étape 2 : Lancer le test — doit échouer**

```bash
node tests/test-supabase-messages.js
```

Expected: `ReferenceError: _rowToMessage is not defined` — comportement TDD attendu.

- [ ] **Étape 3 : Écrire js/supabase-messages.js**

```js
// js/supabase-messages.js
'use strict';

function _rowToMessage(row) {
  return {
    id:             row.id,
    inscriptionId:  row.inscription_id,
    motifRefus:     row.motif_refus,
    token:          row.token,
    tokenExpiresAt: row.token_expires_at,
    contenu:        row.contenu || null,
    lu:             !!row.lu,
    createdAt:      row.created_at,
    nom:            row.inscriptions ? row.inscriptions.nom    : null,
    prenom:         row.inscriptions ? row.inscriptions.prenom : null,
    mail:           row.inscriptions ? row.inscriptions.mail   : null,
    statut:         row.inscriptions ? row.inscriptions.statut : null,
  };
}

async function getMessages() {
  var result = await supabaseClient
    .from('messages')
    .select('*, inscriptions(nom, prenom, mail, statut)')
    .order('lu', { ascending: true })
    .order('created_at', { ascending: false });
  if (result.error) throw result.error;
  return (result.data || []).map(_rowToMessage);
}

async function getMessageById(id) {
  var result = await supabaseClient
    .from('messages')
    .select('*, inscriptions(nom, prenom, mail, statut)')
    .eq('id', id)
    .single();
  if (result.error) throw result.error;
  return _rowToMessage(result.data);
}

async function markMessageRead(id) {
  var result = await supabaseClient
    .from('messages')
    .update({ lu: true })
    .eq('id', id);
  if (result.error) throw result.error;
}

async function getUnreadCount() {
  var result = await supabaseClient
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('lu', false)
    .not('contenu', 'is', null);
  if (result.error) throw result.error;
  return result.count || 0;
}

if (typeof module !== 'undefined') {
  module.exports = { _rowToMessage, getMessages, getMessageById, markMessageRead, getUnreadCount };
}
```

- [ ] **Étape 4 : Relancer le test — doit passer**

Copier la définition de `_rowToMessage` dans le fichier de test en haut (pour qu'il soit disponible) puis :

```bash
node tests/test-supabase-messages.js
```

Expected: `✓ test-supabase-messages.js OK`

Note : le test inclut la définition inline de `_rowToMessage` en haut du fichier de test, donc il s'auto-suffit.

- [ ] **Étape 5 : Ajouter à run-all.js**

Dans `tests/run-all.js`, ajouter `'test-supabase-messages.js'` dans le tableau `tests` :

```js
const tests = ['test-slots.js', 'test-timer.js', 'test-storage.js', 'test-pass.js', 'test-auth.js', 'test-supabase-inscriptions.js', 'test-supabase-mc.js', 'test-supabase-storage.js', 'test-inscription-publique.js', 'test-supabase-messages.js'];
```

- [ ] **Étape 6 : Vérifier suite complète**

```bash
node tests/run-all.js
```

Expected: `✅ Tous les tests passent.`

- [ ] **Étape 7 : Commit**

```bash
git add js/supabase-messages.js tests/test-supabase-messages.js tests/run-all.js
git commit -m "feat: supabase-messages.js + tests (getMessages, markRead, unreadCount)"
```

---

### Task 2 : `js/messages.js` — Rendu de la vue

**Files:**
- Create: `js/messages.js`

La vue Messages a deux états : liste des messages, et détail d'un message sélectionné.

- [ ] **Étape 1 : Écrire js/messages.js**

```js
// js/messages.js
'use strict';

function _escM(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _formatDate(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function renderMessages(container) {
  container.innerHTML = '<div class="msg-loading">Chargement…</div>';

  var messages;
  try {
    messages = await getMessages();
  } catch (e) {
    container.innerHTML = '<div class="msg-error">Erreur de chargement : ' + _escM(e.message) + '</div>';
    return;
  }

  if (!messages.length) {
    container.innerHTML = '<div class="msg-empty"><div class="msg-empty-icon">📭</div><p>Aucun message pour le moment.</p></div>';
    return;
  }

  // Séparer messages avec réponse (non lus d'abord) des messages sans réponse
  var withReply   = messages.filter(function(m) { return m.contenu; });
  var withoutReply = messages.filter(function(m) { return !m.contenu; });

  container.innerHTML = '<div class="msg-layout">'
    + '<div class="msg-list-panel" id="msg-list-panel">'
    +   '<div class="msg-list-hd">Messages</div>'
    +   _renderMessageList(withReply, withoutReply)
    + '</div>'
    + '<div class="msg-detail-panel" id="msg-detail-panel">'
    +   '<div class="msg-detail-empty"><div class="msg-empty-icon">👈</div><p>Sélectionnez un message</p></div>'
    + '</div>'
    + '</div>';

  container.querySelectorAll('.msg-list-item').forEach(function(el) {
    el.addEventListener('click', async function() {
      container.querySelectorAll('.msg-list-item').forEach(function(e) { e.classList.remove('active'); });
      el.classList.add('active');
      var id = el.dataset.id;
      var msg = messages.find(function(m) { return m.id === id; });
      if (!msg) return;
      if (!msg.lu && msg.contenu) {
        await markMessageRead(id).catch(function() {});
        el.classList.remove('msg-unread');
        msg.lu = true;
      }
      _renderDetail(document.getElementById('msg-detail-panel'), msg);
    });
  });
}

function _renderMessageList(withReply, withoutReply) {
  var html = '';

  if (withReply.length) {
    html += '<div class="msg-list-section">Réponses reçues</div>';
    html += withReply.map(function(m) {
      var unread = !m.lu ? ' msg-unread' : '';
      var preview = m.contenu ? m.contenu.slice(0, 60) + (m.contenu.length > 60 ? '…' : '') : '';
      return '<div class="msg-list-item' + unread + '" data-id="' + _escM(m.id) + '">'
        + '<div class="msg-list-name">' + _escM(m.nom) + ' ' + _escM(m.prenom) + '</div>'
        + '<div class="msg-list-preview">' + _escM(preview) + '</div>'
        + '<div class="msg-list-date">' + _formatDate(m.createdAt) + '</div>'
        + '</div>';
    }).join('');
  }

  if (withoutReply.length) {
    html += '<div class="msg-list-section" style="color:#aaa">En attente de réponse</div>';
    html += withoutReply.map(function(m) {
      return '<div class="msg-list-item msg-no-reply" data-id="' + _escM(m.id) + '">'
        + '<div class="msg-list-name">' + _escM(m.nom) + ' ' + _escM(m.prenom) + '</div>'
        + '<div class="msg-list-preview" style="color:#aaa;font-style:italic">Pas encore de réponse</div>'
        + '<div class="msg-list-date">' + _formatDate(m.createdAt) + '</div>'
        + '</div>';
    }).join('');
  }

  return html;
}

function _renderDetail(panel, msg) {
  var canValidate = msg.statut === 'refuse';
  var hasReply    = !!msg.contenu;

  panel.innerHTML = '<div class="msg-detail">'
    + '<div class="msg-detail-hd">'
    +   '<div class="msg-detail-name">' + _escM(msg.nom) + ' ' + _escM(msg.prenom) + '</div>'
    +   '<div class="msg-detail-mail">' + _escM(msg.mail) + '</div>'
    + '</div>'

    + '<div class="msg-detail-section">'
    +   '<div class="msg-detail-label">Motif du refus</div>'
    +   '<div class="msg-detail-body">' + _escM(msg.motifRefus) + '</div>'
    + '</div>'

    + (hasReply
      ? '<div class="msg-detail-section msg-reply-block">'
      +   '<div class="msg-detail-label">Réponse reçue le ' + _formatDate(msg.createdAt) + '</div>'
      +   '<div class="msg-detail-body msg-reply-content">' + _escM(msg.contenu) + '</div>'
      + '</div>'
      : '<div class="msg-detail-section"><em style="color:#aaa;font-size:13px">Aucune réponse reçue pour le moment.</em></div>'
    )

    + '<div class="msg-detail-actions">'
    + (canValidate
      ? '<button type="button" class="btn-primary" id="msg-btn-validate">✓ Valider l\'inscription</button>'
      : '<div style="font-size:13px;color:#2e7d32;padding:8px 0">✓ Inscription déjà validée</div>'
    )
    + '<button type="button" class="btn-ghost" id="msg-btn-reply">✉ Répondre par email</button>'
    + '</div>'

    + '<div id="msg-reply-form" style="display:none;margin-top:16px">'
    +   '<textarea id="msg-reply-text" rows="5" placeholder="Votre réponse…" '
    +     'style="width:100%;padding:10px;border:1.5px solid #ccc;border-radius:8px;font-size:13px;resize:vertical"></textarea>'
    +   '<div style="display:flex;gap:8px;margin-top:8px">'
    +     '<button type="button" class="btn-primary" id="msg-btn-send-reply">Envoyer</button>'
    +     '<button type="button" class="btn-ghost" id="msg-btn-cancel-reply">Annuler</button>'
    +   '</div>'
    +   '<div id="msg-reply-status" style="font-size:12px;margin-top:6px"></div>'
    + '</div>'

    + '</div>';

  // Wirer le bouton Valider
  var btnValidate = document.getElementById('msg-btn-validate');
  if (btnValidate) {
    btnValidate.addEventListener('click', async function() {
      if (!confirm('Valider l\'inscription de ' + msg.nom + ' ' + msg.prenom + ' et envoyer l\'email d\'invitation ?')) return;
      btnValidate.disabled = true;
      btnValidate.textContent = 'Validation…';
      try {
        await updateInscription(msg.inscriptionId, { statut: 'valide' });
        if (typeof inviteUser === 'function' && msg.mail) {
          await inviteUser(msg.mail, msg.inscriptionId).catch(function() {});
        }
        await markMessageRead(msg.id).catch(function() {});
        btnValidate.textContent = '✓ Inscription validée — email envoyé';
        btnValidate.style.background = '#2e7d32';
      } catch (e) {
        btnValidate.disabled = false;
        btnValidate.textContent = '✓ Valider l\'inscription';
        alert('Erreur : ' + e.message);
      }
    });
  }

  // Wirer le bouton Répondre
  var btnReply = document.getElementById('msg-btn-reply');
  var replyForm = document.getElementById('msg-reply-form');
  if (btnReply && replyForm) {
    btnReply.addEventListener('click', function() {
      replyForm.style.display = replyForm.style.display === 'none' ? 'block' : 'none';
    });
  }

  var btnCancelReply = document.getElementById('msg-btn-cancel-reply');
  if (btnCancelReply) {
    btnCancelReply.addEventListener('click', function() {
      replyForm.style.display = 'none';
    });
  }

  // Wirer l'envoi de réponse (via mailto)
  var btnSendReply = document.getElementById('msg-btn-send-reply');
  if (btnSendReply) {
    btnSendReply.addEventListener('click', async function() {
      var text = document.getElementById('msg-reply-text').value.trim();
      if (!text) return;
      var subject = encodeURIComponent('Handiplage — Suite à votre demande d\'inscription');
      var body    = encodeURIComponent(
        'Madame, Monsieur ' + msg.prenom + ' ' + msg.nom + ',\n\n'
        + text + '\n\n'
        + 'Cordialement,\nL\'équipe Handiplage — CCAS d\'Antibes'
      );
      window.location.href = 'mailto:' + msg.mail + '?subject=' + subject + '&body=' + body;
      document.getElementById('msg-reply-status').textContent = 'Votre messagerie a été ouverte avec l\'email pré-rempli.';
    });
  }
}
```

- [ ] **Étape 2 : Commit**

```bash
git add js/messages.js
git commit -m "feat: messages.js — vue liste + vue détail avec actions valider/répondre"
```

---

### Task 3 : Modifications `index.html` et `js/app.js`

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`

- [ ] **Étape 1 : Ajouter le tab et le conteneur dans index.html**

Dans `index.html`, dans la balise `<header id="app-header">`, après le bouton `btn-insc-tab`, ajouter :

```html
<button id="btn-messages-tab" class="planning-tab-btn">
  ✉ Messages<span id="messages-badge" class="msg-badge" style="display:none"></span>
</button>
```

Dans la section `<div class="main">`, après la div `id="insc-view"`, ajouter :

```html
<!-- Vue Messages -->
<div id="messages-view" style="display:none" class="messages-view"></div>
```

Dans la balise `<script>` du bas de `index.html`, dans la liste des balises `<script src="...">`, ajouter avant `<script src="js/app.js">` :

```html
<script src="js/supabase-messages.js"></script>
<script src="js/messages.js"></script>
```

- [ ] **Étape 2 : Modifier js/app.js — ajouter le routing messages**

Dans `app.js`, dans la fonction `init()`, après le bloc du bouton `btn-insc-tab`, ajouter :

```js
// Messages tab button
const btnMessages = document.getElementById('btn-messages-tab');
if (btnMessages) {
  btnMessages.addEventListener('click', () => {
    showView(_currentView === 'messages' ? 'carte' : 'messages');
  });
}

// Badge non-lus
if (typeof getUnreadCount === 'function') {
  getUnreadCount().then(function(count) {
    const badge = document.getElementById('messages-badge');
    if (badge) {
      if (count > 0) { badge.textContent = count; badge.style.display = 'inline'; }
      else badge.style.display = 'none';
    }
  }).catch(function() {});
}
```

Dans `showView()`, dans les déclarations de variables (après `const btnInsc`), ajouter :

```js
const messagesView   = document.getElementById('messages-view');
const btnMessages    = document.getElementById('btn-messages-tab');
```

Dans le bloc `// Masquer tout`, ajouter :

```js
if (messagesView) messagesView.style.display = 'none';
if (btnMessages)  btnMessages.classList.remove('active');
```

Puis ajouter le cas `messages` dans la chaîne `if/else if` :

```js
} else if (view === 'messages') {
  if (messagesView) messagesView.style.display = 'flex';
  if (btnMessages)  btnMessages.classList.add('active');
  renderMessages(messagesView).catch(console.error);
```

Dans l'objet `return { ... }` final, ajouter `showView` est déjà présent — rien à modifier.

- [ ] **Étape 3 : Vérifier manuellement**

1. Charger `index.html` dans le navigateur
2. Vérifier que le tab "✉ Messages" est visible dans le header
3. Cliquer dessus → la vue messages doit s'afficher
4. Si des messages existent dans Supabase, ils doivent apparaître dans la liste

- [ ] **Étape 4 : Commit**

```bash
git add index.html js/app.js
git commit -m "feat: tab Messages dans index.html + routing app.js"
```

---

### Task 4 : Styles `css/style.css`

**Files:**
- Modify: `css/style.css`

- [ ] **Étape 1 : Ajouter les styles à la fin de style.css**

```css
/* ── Vue Messages ─────────────────────────────────────────────────────── */

.messages-view {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.msg-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.msg-list-panel {
  width: 320px;
  flex-shrink: 0;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.msg-list-hd {
  padding: 14px 16px;
  font-size: 15px;
  font-weight: 700;
  color: #333;
  border-bottom: 1px solid #e0e0e0;
  background: #fafafa;
}

.msg-list-section {
  padding: 6px 16px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: #1565c0;
  letter-spacing: .05em;
  background: #f5f7fa;
  border-bottom: 1px solid #eee;
}

.msg-list-item {
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background .1s;
}
.msg-list-item:hover   { background: #f0f4ff; }
.msg-list-item.active  { background: #e3f2fd; }
.msg-list-item.msg-unread { border-left: 3px solid #1565c0; padding-left: 13px; }
.msg-list-item.msg-no-reply { opacity: .6; }

.msg-list-name    { font-weight: 700; font-size: 14px; color: #222; }
.msg-list-preview { font-size: 12px; color: #666; margin-top: 2px; }
.msg-list-date    { font-size: 11px; color: #aaa; margin-top: 4px; }

/* Panneau détail */
.msg-detail-panel {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  background: white;
}

.msg-detail { padding: 24px; max-width: 700px; }

.msg-detail-hd {
  margin-bottom: 20px;
  padding-bottom: 14px;
  border-bottom: 1px solid #eee;
}
.msg-detail-name { font-size: 18px; font-weight: 700; color: #1565c0; }
.msg-detail-mail { font-size: 13px; color: #666; margin-top: 4px; }

.msg-detail-section { margin-bottom: 20px; }
.msg-detail-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: #888;
  letter-spacing: .05em;
  margin-bottom: 8px;
}
.msg-detail-body {
  font-size: 14px;
  color: #333;
  line-height: 1.6;
  white-space: pre-wrap;
}

.msg-reply-block  { background: #f1f8ff; border-radius: 8px; padding: 14px; }
.msg-reply-content { color: #1565c0; }

.msg-detail-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

/* Badge non-lus */
.msg-badge {
  display: inline-block;
  background: #e53935;
  color: white;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  margin-left: 5px;
  vertical-align: middle;
}

/* États vides et chargement */
.msg-loading, .msg-error, .msg-empty, .msg-detail-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #aaa;
  font-size: 14px;
  gap: 12px;
  padding: 40px;
  text-align: center;
}
.msg-empty-icon { font-size: 2.5rem; }
.msg-error { color: #c62828; }
```

- [ ] **Étape 2 : Vérifier visuellement**

Charger l'interface staff, cliquer sur "✉ Messages". Vérifier que le layout liste/détail s'affiche correctement. Sélectionner un message (si disponible) et vérifier le panneau de détail.

- [ ] **Étape 3 : Commit final**

```bash
git add css/style.css
git commit -m "feat: styles vue Messages (liste, détail, badge)"
```

---

## Vérification finale

```bash
node tests/run-all.js
```

Expected: `✅ Tous les tests passent.`

Test manuel complet :
1. Vérifier que le tab Messages apparaît dans le header
2. Si un message existe dans Supabase avec `contenu` renseigné : le badge doit afficher le compte non-lus
3. Cliquer sur le message → voir le détail (motif, réponse reçue)
4. Cliquer "✓ Valider l'inscription" → vérifier changement de statut dans Supabase + email d'invitation
5. Cliquer "✉ Répondre par email" → ouvrir le formulaire → cliquer "Envoyer" → messagerie locale ouverte
