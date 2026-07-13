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

  var isUsagerMsg  = function(m) { return m.motifRefus && m.motifRefus.startsWith('[USAGER]'); };
  var usagerMsgs   = messages.filter(isUsagerMsg);
  var withReply    = messages.filter(function(m) { return !isUsagerMsg(m) && m.contenu; });
  var withoutReply = messages.filter(function(m) { return !isUsagerMsg(m) && !m.contenu; });

  container.innerHTML = '<div class="msg-layout">'
    + '<div class="msg-list-panel" id="msg-list-panel">'
    +   '<div class="msg-list-hd">Messages</div>'
    +   _renderMessageList(withReply, withoutReply, usagerMsgs)
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

function _renderMessageList(withReply, withoutReply, usagerMsgs) {
  var html = '';

  if (usagerMsgs && usagerMsgs.length) {
    html += '<div class="msg-list-section msg-section-usager">📩 Demandes usagers</div>';
    html += usagerMsgs.map(function(m) {
      var unread = !m.lu ? ' msg-unread' : '';
      var preview = m.contenu ? m.contenu.slice(0, 60) + (m.contenu.length > 60 ? '…' : '') : '';
      return '<div class="msg-list-item' + unread + '" data-id="' + _escM(m.id) + '">'
        + '<div class="msg-list-name">' + _escM(m.nom) + ' ' + _escM(m.prenom) + '</div>'
        + '<div class="msg-list-preview">' + _escM(preview) + '</div>'
        + '<div class="msg-list-date">' + _formatDate(m.createdAt) + '</div>'
        + '</div>';
    }).join('');
  }

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
  var isUsager    = !!(msg.motifRefus && msg.motifRefus.startsWith('[USAGER]'));
  var canValidate = !isUsager && msg.statut === 'refuse';
  var hasReply    = !!msg.contenu;

  var bodyHtml = isUsager
    ? '<div class="msg-detail-section msg-usager-block">'
      +   '<div class="msg-detail-label">📩 Message de l\'usager — ' + _formatDate(msg.createdAt) + '</div>'
      +   '<div class="msg-detail-body msg-reply-content">' + _escM(msg.contenu) + '</div>'
      + '</div>'
    : '<div class="msg-detail-section">'
      +   '<div class="msg-detail-label">Motif du refus</div>'
      +   '<div class="msg-detail-body">' + _escM(msg.motifRefus) + '</div>'
      + '</div>'
      + (hasReply
        ? '<div class="msg-detail-section msg-reply-block">'
          +   '<div class="msg-detail-label">Réponse reçue le ' + _formatDate(msg.createdAt) + '</div>'
          +   '<div class="msg-detail-body msg-reply-content">' + _escM(msg.contenu) + '</div>'
          + '</div>'
        : '<div class="msg-detail-section"><em style="color:#aaa;font-size:13px">Aucune réponse reçue pour le moment.</em></div>'
      );

  panel.innerHTML = '<div class="msg-detail">'
    + '<div class="msg-detail-hd">'
    +   '<div class="msg-detail-name">' + _escM(msg.nom) + ' ' + _escM(msg.prenom) + '</div>'
    +   '<div class="msg-detail-mail">' + _escM(msg.mail) + '</div>'
    + '</div>'

    + bodyHtml

    + '<div class="msg-detail-actions">'
    + (canValidate
      ? '<button type="button" class="btn-primary" id="msg-btn-validate">✓ Valider l\'inscription</button>'
      : (!isUsager ? '<div style="font-size:13px;color:#2e7d32;padding:8px 0">✓ Inscription déjà validée</div>' : '')
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
