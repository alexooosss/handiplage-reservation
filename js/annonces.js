// js/annonces.js
'use strict';

var ANNONCE_MAX = 280;

var ANNONCE_ICON = '<svg class="annonce-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" '
  + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>';

function _escAn(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _annonceDateLabel(iso) {
  var d = new Date(iso);
  return 'Publiée le ' + d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
    + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function _annonceHeaderHtml(chipHtml, actionsHtml) {
  return '<div class="annonce-staff-hd">'
    +   '<span class="annonce-staff-title" id="annonce-staff-title">'
    +     '<span class="annonce-staff-icon">' + ANNONCE_ICON + '</span>Annonce aux usagers'
    +   '</span>'
    +   chipHtml
    +   (actionsHtml ? '<div class="annonce-staff-actions">' + actionsHtml + '</div>' : '')
    + '</div>';
}

var ANNONCE_CHIP_OFF  = '<span class="annonce-chip">Aucune annonce en ligne</span>';
var ANNONCE_CHIP_LIVE = '<span class="annonce-chip annonce-chip-live"><span class="annonce-chip-dot"></span>En ligne</span>';

function _paintAnnonce(container, annonce, draft) {
  var html;

  if (draft !== null) {
    var len = draft.length;
    html = _annonceHeaderHtml(annonce ? ANNONCE_CHIP_LIVE : ANNONCE_CHIP_OFF, '')
      + '<div class="annonce-composer">'
      +   '<label for="annonce-staff-textarea" class="annonce-label">'
      +     (annonce ? 'Nouveau message (remplacera l\'annonce en ligne)' : 'Message')
      +   '</label>'
      +   '<textarea id="annonce-staff-textarea" class="annonce-textarea" rows="2" maxlength="' + ANNONCE_MAX + '" '
      +     'aria-describedby="annonce-help annonce-count" '
      +     'placeholder="Ex. : Présence de méduses ce matin, baignade déconseillée.">' + _escAn(draft) + '</textarea>'
      +   '<div class="annonce-composer-foot">'
      +     '<span id="annonce-help">Affichée en haut de l\'accueil de tous les usagers jusqu\'à ce que vous la retiriez.</span>'
      +     '<span id="annonce-count" class="annonce-count">' + len + ' / ' + ANNONCE_MAX + '</span>'
      +   '</div>'
      +   '<div class="annonce-composer-actions">'
      +     '<button type="button" class="btn-primary annonce-btn" id="annonce-btn-publish">Publier</button>'
      +     '<button type="button" class="btn-secondary annonce-btn" id="annonce-btn-cancel">Annuler</button>'
      +   '</div>'
      +   '<div id="annonce-staff-status" class="annonce-status" role="alert"></div>'
      + '</div>';
  } else if (annonce) {
    html = _annonceHeaderHtml(ANNONCE_CHIP_LIVE,
        '<button type="button" class="btn-secondary annonce-btn" id="annonce-btn-edit">Modifier</button>'
      + '<button type="button" class="btn-danger annonce-btn" id="annonce-btn-deactivate">Retirer</button>')
      + '<div class="annonce-preview">'
      +   '<p class="annonce-preview-text">' + _escAn(annonce.contenu).replace(/\n/g, '<br>') + '</p>'
      +   '<p class="annonce-preview-meta">' + _annonceDateLabel(annonce.createdAt) + '</p>'
      + '</div>';
  } else {
    html = _annonceHeaderHtml(ANNONCE_CHIP_OFF,
      '<button type="button" class="btn-ghost annonce-btn" id="annonce-btn-new">Rédiger une annonce</button>');
  }

  container.innerHTML = '<section class="annonce-staff" aria-labelledby="annonce-staff-title">' + html + '</section>';

  var btnNew = container.querySelector('#annonce-btn-new');
  if (btnNew) btnNew.addEventListener('click', function() { _paintAnnonce(container, annonce, ''); });

  var btnEdit = container.querySelector('#annonce-btn-edit');
  if (btnEdit) btnEdit.addEventListener('click', function() { _paintAnnonce(container, annonce, annonce.contenu); });

  var textarea = container.querySelector('#annonce-staff-textarea');
  if (textarea) _wireComposer(container, annonce, textarea);

  var btnDeactivate = container.querySelector('#annonce-btn-deactivate');
  if (btnDeactivate) {
    btnDeactivate.addEventListener('click', async function() {
      if (!confirm('Retirer cette annonce ? Elle ne sera plus visible par les usagers.')) return;
      btnDeactivate.disabled = true;
      btnDeactivate.textContent = 'Retrait…';
      try {
        await deactivateAnnonce(annonce.id);
        renderAnnonceStaffBlock(container);
      } catch (e) {
        btnDeactivate.disabled = false;
        btnDeactivate.textContent = 'Retirer';
        alert('Erreur : ' + e.message);
      }
    });
  }
}

function _wireComposer(container, annonce, textarea) {
  var count      = container.querySelector('#annonce-count');
  var status     = container.querySelector('#annonce-staff-status');
  var btnPublish = container.querySelector('#annonce-btn-publish');
  var btnCancel  = container.querySelector('#annonce-btn-cancel');

  function cancel() { _paintAnnonce(container, annonce, null); }

  function refresh() {
    var len = textarea.value.length;
    count.textContent = len + ' / ' + ANNONCE_MAX;
    count.classList.toggle('is-near', len >= ANNONCE_MAX - 20);
    btnPublish.disabled = !textarea.value.trim();
    if (status.textContent) status.textContent = '';
  }

  textarea.addEventListener('input', refresh);
  textarea.addEventListener('keydown', function(e) { if (e.key === 'Escape') cancel(); });
  btnCancel.addEventListener('click', cancel);

  btnPublish.addEventListener('click', async function() {
    var text = textarea.value.trim();
    if (!text) return;
    btnPublish.disabled = true;
    btnCancel.disabled  = true;
    btnPublish.textContent = 'Publication…';
    try {
      await createAnnonce(text);
      renderAnnonceStaffBlock(container);
    } catch (e) {
      btnPublish.disabled = false;
      btnCancel.disabled  = false;
      btnPublish.textContent = 'Publier';
      status.textContent = 'Publication impossible : ' + e.message + '. Réessayez.';
    }
  });

  refresh();
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

async function renderAnnonceStaffBlock(container) {
  container.innerHTML = '<section class="annonce-staff" aria-labelledby="annonce-staff-title" aria-busy="true">'
    + _annonceHeaderHtml('<span class="annonce-chip">Chargement…</span>', '')
    + '</section>';

  var annonce;
  try {
    annonce = await getActiveAnnonce();
  } catch (e) {
    container.innerHTML = '<section class="annonce-staff" aria-labelledby="annonce-staff-title">'
      + _annonceHeaderHtml('<span class="annonce-chip annonce-chip-error">Indisponible</span>',
          '<button type="button" class="btn-secondary annonce-btn" id="annonce-btn-retry">Réessayer</button>')
      + '<p class="annonce-status">Impossible de charger l\'annonce : ' + _escAn(e.message) + '</p>'
      + '</section>';
    container.querySelector('#annonce-btn-retry').addEventListener('click', function() {
      renderAnnonceStaffBlock(container);
    });
    return;
  }

  _paintAnnonce(container, annonce, null);
}
