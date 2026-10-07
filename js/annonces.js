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
