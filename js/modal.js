'use strict';

const _dialog = () => document.getElementById('app-modal');

function closeModal() {
  _dialog().className = '';
  _dialog().close();
}

// ── Modale 1 : Ajouter une réservation à la liste d'attente ──
// Appelée avant l'arrivée de la personne (saisie anticipée)
// onConfirm({ nom, prenom, accompagnants, inscriptionId })
function openAddReservationModal(onConfirm) {
  let _linkedInscriptionId = null;
  let _saisonCourante = null;
  if (typeof getSaisonCourante === 'function') {
    getSaisonCourante().then(function(s) { _saisonCourante = s; }).catch(function() {});
  }

  _dialog().innerHTML = `
    <div class="modal-header">
      <h3>＋ Ajouter une réservation</h3>
      <button class="modal-close" id="modal-close">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group pass-suggest-wrap" id="nom-wrap">
          <label>Nom</label>
          <input type="text" id="f-nom" placeholder="NOM" autocomplete="off" style="text-transform:uppercase">
        </div>
        <div class="form-group">
          <label>Prénom</label>
          <input type="text" id="f-prenom" placeholder="Prénom" autocomplete="off">
        </div>
      </div>
      <div id="pass-link-info" class="pass-link-info" style="display:none">
        🎫 Lié au pass de <strong id="pass-link-name"></strong>
        <button type="button" id="pass-unlink">✕ Dissocier</button>
      </div>
      <div class="form-group">
        <label>Nombre d'accompagnants</label>
        <div class="radio-group" id="f-accompagnants">
          <div class="radio-btn selected" data-value="0">0</div>
          <div class="radio-btn"          data-value="1">1</div>
          <div class="radio-btn"          data-value="2">2</div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="modal-cancel">Annuler</button>
      <button class="btn-primary"   id="modal-confirm">✓ Enregistrer</button>
    </div>
  `;

  _bindRadioGroup('f-accompagnants');
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  const prenomInp = document.getElementById('f-prenom');
  const nomInp    = document.getElementById('f-nom');

  prenomInp.addEventListener('input', function(e) {
    e.target.value = e.target.value.replace(/\b\w/g, c => c.toUpperCase());
    _showSuggestions();
  });
  nomInp.addEventListener('input', _showSuggestions);

  document.getElementById('pass-unlink').addEventListener('click', function() {
    _linkedInscriptionId = null;
    document.getElementById('pass-link-info').style.display = 'none';
  });

  function _showSuggestions() {
    _removeSuggestions();
    // Toute frappe après une sélection efface le lien (évite un nom/inscriptionId divergents)
    if (_linkedInscriptionId) {
      _linkedInscriptionId = null;
      document.getElementById('pass-link-info').style.display = 'none';
    }
    const q = (nomInp.value + ' ' + prenomInp.value).trim().toLowerCase();
    if (q.length < 2) return;
    const all = (typeof getCachedInscriptions === 'function') ? getCachedInscriptions() : [];
    const matches = all.filter(function(i) {
      return (i.nom + ' ' + i.prenom).toLowerCase().includes(q)
          || (i.prenom + ' ' + i.nom).toLowerCase().includes(q);
    }).slice(0, 8);
    if (matches.length === 0) return;
    const dd = document.createElement('div');
    dd.className = 'pass-suggest-dropdown';
    dd.id = 'pass-suggest-dd';
    matches.forEach(function(insc) {
      const remaining = (typeof getPassRemaining === 'function' && insc.pass)
        ? getPassRemaining(insc.id) : null;
      const exhausted = remaining === 0;
      const item = document.createElement('div');
      item.className = 'pass-suggest-item' + (exhausted ? ' exhausted' : '');
      const nameWrap = document.createElement('span');
      nameWrap.className = 'pass-suggest-name-wrap';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = insc.nom.toUpperCase() + ' ' + insc.prenom;
      nameWrap.appendChild(nameSpan);
      if (insc.statut === 'valide' && _saisonCourante !== null && insc.derniereSaisonValidee !== _saisonCourante) {
        const renewSpan = document.createElement('span');
        renewSpan.className = 'pass-suggest-renewal-warning';
        renewSpan.textContent = '⚠️ Non renouvelé';
        nameWrap.appendChild(renewSpan);
      }
      item.appendChild(nameWrap);
      if (insc.pass) {
        const remSpan = document.createElement('span');
        remSpan.className = 'pass-suggest-remaining' + (exhausted ? ' empty' : '');
        remSpan.textContent = exhausted
          ? '🎫 Pass 2026 · épuisé'
          : '🎫 Pass 2026 · ' + remaining + ' résa. rest.';
        item.appendChild(remSpan);
      }
      if (!exhausted) {
        item.addEventListener('mousedown', function(e) {
          e.preventDefault();
          nomInp.value        = insc.nom.toUpperCase();
          prenomInp.value     = insc.prenom;
          _linkedInscriptionId = insc.pass ? insc.id : null;
          if (_linkedInscriptionId) {
            document.getElementById('pass-link-name').textContent = insc.prenom + ' ' + insc.nom;
            document.getElementById('pass-link-info').style.display = 'flex';
          }
          _removeSuggestions();
          prenomInp.focus();
        });
      }
      dd.appendChild(item);
    });
    document.getElementById('nom-wrap').appendChild(dd);
  }

  function _removeSuggestions() {
    const dd = document.getElementById('pass-suggest-dd');
    if (dd) dd.remove();
  }

  prenomInp.addEventListener('blur', function() { setTimeout(_removeSuggestions, 150); });
  nomInp.addEventListener('blur',    function() { setTimeout(_removeSuggestions, 150); });

  document.getElementById('modal-confirm').addEventListener('click', function() {
    const prenom = prenomInp.value.trim();
    const nom    = nomInp.value.trim().toUpperCase();
    const accompagnants = parseInt(
      document.querySelector('#f-accompagnants .radio-btn.selected').dataset.value
    );
    if (!prenom || !nom) { alert('Prénom et nom sont obligatoires.'); return; }

    if (_linkedInscriptionId && typeof getPassRemaining === 'function') {
      const remaining = getPassRemaining(_linkedInscriptionId);
      if (remaining === 0) {
        alert('Pass épuisé ce mois. Cette personne ne peut plus réserver avant le '
          + getPassResetDate() + '.');
        return;
      }
    }

    closeModal();
    onConfirm({ nom, prenom, accompagnants, inscriptionId: _linkedInscriptionId });
  });

  _dialog().showModal();
  nomInp.focus();
}

// Texte comparable : sans accents, en minuscules
function _sansAccent(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
// Suggestion d'inscription : début du nom et/ou début du prénom (au moins l'un des deux saisi)
function _correspondInscription(i, nom, prenom) {
  return !!i.nom && (!nom || _sansAccent(i.nom).startsWith(nom)) && (!prenom || _sansAccent(i.prenom).startsWith(prenom));
}

// ── Modale 2 : Assigner un emplacement à une personne arrivée ──
// resa : { nom, prenom, accompagnants } — depuis la liste d'attente
// freeSpots : ['P1', 'P3', ...] — emplacements libres
// onConfirm(spotId)
function openAssignSpotModal(resa, freeSpots, onConfirm) {
  const spotOptions = freeSpots.map(id =>
    `<option value="${id}">${id}</option>`
  ).join('');

  _dialog().innerHTML = `
    <div class="modal-header">
      <h3>▶ Assigner un emplacement</h3>
      <button class="modal-close" id="modal-close">✕</button>
    </div>
    <div class="modal-body">
      <div class="spot-detail" style="margin-bottom:16px">
        <div class="detail-row">
          <span class="detail-label">Personne</span>
          <span class="detail-value">${resa.nom} ${resa.prenom}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Accompagnants</span>
          <span class="detail-value">${resa.accompagnants === 0 ? 'Seul·e' : resa.accompagnants === 1 ? '1 accompagnant' : '2 accompagnants'}</span>
        </div>
      </div>
      <div class="form-group">
        <label>Choisir un emplacement libre</label>
        <select id="f-spot">${spotOptions}</select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="modal-cancel">Annuler</button>
      <button class="btn-primary"   id="modal-confirm">✓ Confirmer l'arrivée</button>
    </div>
  `;

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  document.getElementById('modal-confirm').addEventListener('click', () => {
    const spotId = document.getElementById('f-spot').value;
    if (!spotId) { alert('Veuillez sélectionner un emplacement.'); return; }
    closeModal();
    onConfirm(spotId);
  });

  _dialog().showModal();
}

// ── Modale 3a : Saisie walk-in (étape 1 — sans emplacement) ──
// onConfirm({ nom, prenom, accompagnants, nbCreneaux })
// opts : { isLate: bool, nextSlot: { label, end } | null }
function openWalkinEntryModal(onConfirm, opts) {
  opts = opts || {};
  let _saisonCourante = null;
  if (typeof getSaisonCourante === 'function') {
    getSaisonCourante().then(function(s) { _saisonCourante = s; }).catch(function() {});
  }
  const showCreneaux = !!(opts.isLate && opts.nextSlot);
  const hintCreneaux = showCreneaux ? `
      <div id="wk-creneaux-row">
        <div class="fw-sec-t">Durée souhaitée</div>
        <div class="radio-group fw-choix2" id="wk-creneaux">
          <div class="radio-btn selected" data-value="1" role="button" tabindex="0">1 créneau<small>jusqu'à ${opts.nextSlot && opts.nextSlot.start ? opts.nextSlot.start.replace(':', 'h') : ''}</small></div>
          <div class="radio-btn"          data-value="2" role="button" tabindex="0">2 créneaux<small>jusqu'à ${opts.nextSlot && opts.nextSlot.end ? opts.nextSlot.end.replace(':', 'h') : ''}</small></div>
        </div>
      </div>` : '';
  _dialog().innerHTML = `
    <div class="fw">
      <div class="fw-carte fw-hd">
        <span class="fw-filet"></span>
        <h3>Arrivée sans réservation<small>La personne est accueillie, l'emplacement se choisit ensuite</small></h3>
        <button type="button" class="pm-fermer" id="modal-close" aria-label="Fermer">✕</button>
      </div>
      <div class="fw-carte fw-corps">
        <div>
          <div class="fw-sec-t">Qui arrive ?</div>
          <div class="fw-champs">
            <label class="sr-only" for="wk-nom">Nom</label>
            <input type="text" id="wk-nom" placeholder="NOM" autocomplete="off" style="text-transform:uppercase">
            <span class="fw-sep" aria-hidden="true"></span>
            <label class="sr-only" for="wk-prenom">Prénom</label>
            <input type="text" id="wk-prenom" placeholder="Prénom" autocomplete="off">
            <div id="wk-nom-suggest" class="pm-suggest" style="display:none"></div>
          </div>
        </div>
        <div>
          <div class="fw-sec-t">Accompagnants</div>
          <div class="radio-group fw-choix3" id="wk-accompagnants">
            <div class="radio-btn selected" data-value="0" role="button" tabindex="0">0<small>seul·e</small></div>
            <div class="radio-btn"          data-value="1" role="button" tabindex="0">1<small>accompagnant</small></div>
            <div class="radio-btn"          data-value="2" role="button" tabindex="0">2<small>accompagnants</small></div>
          </div>
        </div>
        ${hintCreneaux}
        <p class="fw-note">L'emplacement se choisit ensuite, sur le plan ou avec « Placer ».</p>
      </div>
      <div class="fw-pied">
        <button type="button" class="fw-annuler" id="modal-cancel">Annuler</button>
        <button type="button" class="fw-valider" id="modal-confirm">✓ Enregistrer l'arrivée</button>
      </div>
    </div>
  `;
  _dialog().classList.add('fw-dialog');
  _dialog().querySelectorAll('.fw-choix3 .radio-btn, .fw-choix2 .radio-btn').forEach(b => {
    b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.click(); } });
  });

  _bindRadioGroup('wk-accompagnants');
  if (showCreneaux) _bindRadioGroup('wk-creneaux');
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('wk-prenom').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\b\w/g, c => c.toUpperCase());
  });

  // Autocomplete NOM → inscriptions
  (function() {
    var nomEl     = document.getElementById('wk-nom');
    var prenomEl  = document.getElementById('wk-prenom');
    var suggestEl = document.getElementById('wk-nom-suggest');
    function _close() { suggestEl.style.display = 'none'; suggestEl.innerHTML = ''; }

    nomEl.addEventListener('input', function() {
      var val = nomEl.value.trim().toUpperCase();
      _close();
      if ((!val && !prenomEl.value.trim()) || typeof getCachedInscriptions !== 'function') return;
      var matches = getCachedInscriptions()
        .filter(function(i) { return _correspondInscription(i, _sansAccent(val), _sansAccent(prenomEl.value)); })
        .slice(0, 8);
      if (!matches.length) return;
      suggestEl.style.display = 'block';
      matches.forEach(function(i) {
        var remaining = (typeof getPassRemaining === 'function' && i.pass)
          ? getPassRemaining(i.id) : null;
        var exhausted = remaining === 0;
        var item = document.createElement('div');
        item.className = 'pf-suggest-item';
        item.style.cssText = 'padding:6px 10px;cursor:pointer;font-size:13px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center'
          + (exhausted ? ';opacity:.5;cursor:not-allowed' : '');
        var nameSpan = document.createElement('span');
        var _b1 = document.createElement('strong');
        _b1.textContent = i.nom.toUpperCase();
        nameSpan.appendChild(_b1);
        nameSpan.appendChild(document.createTextNode(' ' + i.prenom));
        var nameWrap = document.createElement('span');
        nameWrap.style.cssText = 'display:flex;flex-direction:column;gap:2px';
        nameWrap.appendChild(nameSpan);
        if (i.statut === 'valide' && _saisonCourante !== null && i.derniereSaisonValidee !== _saisonCourante) {
          var renewSpan = document.createElement('span');
          renewSpan.style.cssText = 'font-size:10px;font-weight:700;color:#f57c00';
          renewSpan.textContent = '⚠️ Non renouvelé';
          nameWrap.appendChild(renewSpan);
        }
        item.appendChild(nameWrap);
        if (i.pass) {
          var remSpan = document.createElement('span');
          remSpan.style.cssText = 'font-size:11px;' + (exhausted ? 'color:#c00' : 'color:#1565c0');
          remSpan.textContent = exhausted
            ? '🎫 Pass 2026 · épuisé'
            : '🎫 Pass 2026 · ' + remaining + ' résa. rest.';
          item.appendChild(remSpan);
        }
        item.addEventListener('mousedown', function(e) {
          e.preventDefault();
          nomEl.value    = i.nom.toUpperCase();
          prenomEl.value = i.prenom;
          _close();
          prenomEl.focus();
        });
        item.addEventListener('mouseover', function() { item.style.background = '#f0f4ff'; });
        item.addEventListener('mouseout',  function() { item.style.background = ''; });
        suggestEl.appendChild(item);
      });
    });
    nomEl.addEventListener('blur',    function() { setTimeout(_close, 150); });
    nomEl.addEventListener('keydown', function(e) { if (e.key === 'Escape') _close(); });
    // Le prénom propose aussi des suggestions (en complément du nom)
    prenomEl.addEventListener('input',   function() { nomEl.dispatchEvent(new Event('input')); });
    prenomEl.addEventListener('blur',    function() { setTimeout(_close, 150); });
    prenomEl.addEventListener('keydown', function(e) { if (e.key === 'Escape') _close(); });
  })();

  document.getElementById('modal-confirm').addEventListener('click', () => {
    const nom    = document.getElementById('wk-nom').value.trim().toUpperCase();
    const prenom = document.getElementById('wk-prenom').value.trim();
    const accompagnants = parseInt(
      document.querySelector('#wk-accompagnants .radio-btn.selected').dataset.value
    );
    const nbCreneaux = showCreneaux
      ? parseInt(document.querySelector('#wk-creneaux .radio-btn.selected').dataset.value)
      : 1;
    if (!nom) { alert('Le nom est obligatoire.'); return; }
    closeModal();
    onConfirm({ nom, prenom, accompagnants, nbCreneaux });
  });

  _dialog().showModal();
  document.getElementById('wk-nom').focus();
}

// ── Modale 3b : Choix de placement (étape 2 — depuis un emplacement libre) ──
// arrivedList : [{id, nom, prenom, accompagnants, checkinTime, type, resaType, ...}]
// spotId : l'emplacement libre cliqué
// onConfirm(resa) : la personne choisie à placer
// onWalkin() : ajouter un walk-in à la place
function openPlacementPickerModal(arrivedList, spotId, onConfirm, onWalkin) {
  function _esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  const listHtml = arrivedList.length
    ? arrivedList.map((r, i) => {
        const acc = r.resaType === 'groupe'
          ? `${r.nbUsagers||1} empl.`
          : r.accompagnants === 0 ? 'seul·e' : r.accompagnants + ' acc.';
        const arrivedAt = r.checkinTime
          ? ' · ' + new Date(r.checkinTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          : '';
        const typeTag = r.type === 'walkin' ? '<span class="fw-tag">Sans résa</span>' : '';
        const ini = ((r.prenom || '').charAt(0) + (r.nom || '').charAt(0)).toUpperCase() || '?';
        const couleur = r.resaType === 'groupe' ? 'violet' : r.type === 'walkin' ? 'orange' : 'bleu';
        // Seulement les informations connues (pas de « undefined acc. »)
        const detail = [
          (r.resaType !== 'groupe' && r.accompagnants == null) ? '' : acc,
          r.type === 'walkin' ? '' : 'réservé',
          arrivedAt ? 'arrivé·e à' + arrivedAt.replace(' · ', ' ') : '',
        ].filter(Boolean).join(' · ');
        return `<button type="button" class="placement-picker-item fw-pers" data-index="${i}">
          <span class="vp-av ${couleur}" aria-hidden="true">${_esc(ini)}</span>
          <span class="fw-qui"><b>${_esc(r.nom)} ${_esc(r.prenom)} ${typeTag}</b><small>${_esc(detail)}</small></span>
          <span class="fw-placer">Placer</span>
        </button>`;
      }).join('')
    : `<div class="fw-carte fw-vide">
         <span class="fw-vide-rond" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg></span>
         <b>Personne n'attend d'emplacement</b>
         <p>Toutes les personnes arrivées sont déjà placées.</p>
       </div>`;

  _dialog().innerHTML = `
    <div class="fw">
      <div class="fw-carte fw-hd">
        <span class="fw-place">${_esc(spotId)}</span>
        <h3>${arrivedList.length ? 'Qui placer ici ?' : 'Emplacement libre'}<small>${arrivedList.length ? 'Emplacement libre' : 'Aucune personne à placer pour l\'instant'}</small></h3>
        <button type="button" class="pm-fermer" id="modal-close" aria-label="Fermer">✕</button>
      </div>
      ${arrivedList.length ? '<div class="fw-sec-t fw-sec-hors">Sur la plage, en attente d\'emplacement · ' + arrivedList.length + '</div>' : ''}
      <div class="placement-picker-list fw-liste">${listHtml}</div>
      ${arrivedList.length ? '<div class="fw-ou">ou</div>' : ''}
      <div class="fw-pied">
        <button type="button" class="fw-valider" id="modal-walkin">↓ Nouvelle arrivée sans réservation</button>
      </div>
    </div>
  `;
  _dialog().classList.add('fw-dialog');

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-walkin').addEventListener('click', () => { closeModal(); onWalkin && onWalkin(); });
  _dialog().querySelectorAll('.placement-picker-item').forEach(el => {
    el.addEventListener('click', () => {
      const resa = arrivedList[parseInt(el.dataset.index)];
      closeModal();
      onConfirm(resa);
    });
  });

  _dialog().showModal();
}

// ── Modale 3c : Check-in direct (arrivée sans réservation — walk-in) — conservé ──
// freeSpots : ['P1','P3',...], preselectedSpotId optionnel
// onConfirm(spotId, data)
function openCheckinModal(freeSpots, preselectedSpotId, onConfirm) {
  const spotOptions = freeSpots.map(id =>
    `<option value="${id}" ${id === preselectedSpotId ? 'selected' : ''}>${id}</option>`
  ).join('');

  _dialog().innerHTML = `
    <div class="modal-header">
      <h3>↓ Arrivée sans réservation</h3>
      <button class="modal-close" id="modal-close">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label>Prénom</label>
          <input type="text" id="f-prenom" placeholder="Prénom" autocomplete="off">
        </div>
        <div class="form-group">
          <label>Nom</label>
          <input type="text" id="f-nom" placeholder="NOM" autocomplete="off" style="text-transform:uppercase">
        </div>
      </div>
      <div class="form-group">
        <label>Nombre d'accompagnants</label>
        <div class="radio-group" id="f-accompagnants">
          <div class="radio-btn selected" data-value="0">0</div>
          <div class="radio-btn"          data-value="1">1</div>
          <div class="radio-btn"          data-value="2">2</div>
        </div>
      </div>
      <div class="form-group">
        <label>Emplacement</label>
        <select id="f-spot">${spotOptions}</select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="modal-cancel">Annuler</button>
      <button class="btn-primary"   id="modal-confirm">✓ Confirmer l'arrivée</button>
    </div>
  `;

  _bindRadioGroup('f-accompagnants');
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('f-prenom').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\b\w/g, c => c.toUpperCase());
  });

  document.getElementById('modal-confirm').addEventListener('click', () => {
    const prenom = document.getElementById('f-prenom').value.trim();
    const nom    = document.getElementById('f-nom').value.trim().toUpperCase();
    const spotId = document.getElementById('f-spot').value;
    const accompagnants = parseInt(
      document.querySelector('#f-accompagnants .radio-btn.selected').dataset.value
    );
    if (!prenom || !nom || !spotId) {
      alert('Prénom, nom et emplacement sont obligatoires.');
      return;
    }
    closeModal();
    onConfirm(spotId, { nom, prenom, accompagnants, type: 'walkin', checkinTime: Date.now(), status: 'present' });
  });

  _dialog().showModal();
  document.getElementById('f-prenom').focus();
}

// Édition inline du nombre d'accompagnants dans n'importe quelle modale
function _inlineEditAccompagnants(rowId, current, onSave) {
  const row = document.getElementById(rowId);
  row.innerHTML = `
    <span class="detail-label">Accompagnants</span>
    <span style="display:flex;gap:6px;align-items:center">
      <div class="radio-group" id="f-accomp-inline">
        <div class="radio-btn ${current===0?'selected':''}" data-value="0">0</div>
        <div class="radio-btn ${current===1?'selected':''}" data-value="1">1</div>
        <div class="radio-btn ${current===2?'selected':''}" data-value="2">2</div>
      </div>
      <button class="btn-primary" id="btn-save-accomp" style="padding:6px 12px;font-size:12px">✓</button>
      <button class="btn-secondary" id="btn-cancel-accomp" style="padding:6px 10px;font-size:12px">✕</button>
    </span>
  `;
  _bindRadioGroup('f-accomp-inline');
  document.getElementById('btn-save-accomp').addEventListener('click', e => {
    e.stopPropagation();
    const newVal = parseInt(document.querySelector('#f-accomp-inline .radio-btn.selected').dataset.value);
    closeModal();
    onSave(newVal);
  });
  document.getElementById('btn-cancel-accomp').addEventListener('click', e => {
    e.stopPropagation();
    closeModal();
  });
}

// Affiche l'historique du jour dans le corps de la modale au clic sur "Voir profil"
function _bindProfilBtn(bodyId, btnId, history) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener('click', () => {
    const fmt = ts => {
      if (!ts) return '—';
      const d = new Date(ts);
      return `${String(d.getHours()).padStart(2,'0')}h${String(d.getMinutes()).padStart(2,'0')}`;
    };
    const rows = history.length === 0
      ? '<p style="color:var(--grey);font-size:13px;margin:0">Aucune présence enregistrée aujourd\'hui.</p>'
      : history.map(({ slot, spotId: sid, resa: r }) => {
          const icon = { departed:'↩', present:'✓', walkin:'↓', absent:'✕', reserved_waiting:'⏳' }[r.status] || '·';
          const spotInfo = sid ? ` ${sid}` : '';
          const times = r.checkinTime ? ` · ${fmt(r.checkinTime)}${r.departTime ? ` → ${fmt(r.departTime)}` : ''}` : '';
          return `<div class="detail-row">
            <span class="detail-label">${slot.label}</span>
            <span class="detail-value">${icon}${spotInfo}${times}</span>
          </div>`;
        }).join('');
    document.getElementById(bodyId).innerHTML = `
      <p style="font-size:11px;color:var(--accent);font-weight:700;margin:0 0 10px">HISTORIQUE DU JOUR</p>
      <div class="spot-detail">${rows}</div>
    `;
    btn.style.display = 'none';
  });
}

// ── Modale 4 : Détail d'un emplacement occupé ──
// callbacks : { onCheckin, onDepart, onAbsent, onUpdateAccompagnants }
// history   : [{ slot, spotId, resa }] — historique du jour (optionnel)
const _ICO_CRAYON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/></svg>';
function _fwHeure(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0');
}
function _fwAcc(n) { return n === 0 ? 'Seul·e' : n === 1 ? '1 accompagnant' : n == null ? '—' : n + ' accompagnants'; }
function _fwTemps(ms) {
  const min = Math.ceil(ms / 60000);
  if (min <= 0) return 'Terminé';
  if (min < 60) return min + ' min';
  return Math.floor(min / 60) + ' h ' + String(min % 60).padStart(2, '0');
}

function openSpotDetailModal(spotId, resa, callbacks, history) {
  const ms = (resa.status === 'present' || resa.status === 'walkin') && resa.slotId
    ? (typeof resaEndMs === 'function' ? resaEndMs(resa) : (typeof slotEndMs === 'function' ? slotEndMs(resa.slotId) : null))
    : null;
  const urgency = ms !== null ? getUrgencyLevel(ms) : 'ok';
  const sansResa = resa.type === 'walkin';
  const deuxCreneaux = typeof resaFinSlotId === 'function' ? resaFinSlotId(resa) !== resa.slotId : resa.nbCreneaux > 1;
  const dureeMs = typeof resaDureeMs === 'function' ? resaDureeMs(resa) : 0;
  const pct = ms !== null && dureeMs > 0 ? Math.max(0, Math.min(100, Math.round(ms / dureeMs * 100))) : 0;
  const attente = resa.status === 'reserved_waiting';

  const tempsHtml = ms !== null ? `
      <div class="fw-carte fw-temps">
        <div class="fw-temps-l"><span>Temps restant</span><b class="${urgency}">${_fwTemps(ms)}</b></div>
        <div class="vp-barre fw-barre"><i class="${sansResa ? 'orange' : ''} ${urgency}" style="width:${pct}%"></i></div>
        ${deuxCreneaux ? '<small>Reste 2 créneaux : jusqu\'à la fin du créneau suivant</small>' : ''}
      </div>` : '';

  const actionBtns = attente
    ? `<button type="button" class="fw-secondaire" id="btn-absent">✕ Absent·e</button>
       <button type="button" class="fw-valider fw-vert" id="btn-checkin">✓ Confirmer l'arrivée</button>`
    : `<button type="button" class="fw-valider fw-depart" id="btn-depart">↩ Marquer le départ</button>`;

  _dialog().innerHTML = `
    <div class="fw">
      <div class="fw-carte fw-hd">
        <span class="fw-place ${sansResa ? 'orange' : 'bleu'}">${_esc(spotId)}</span>
        <h3>${_esc(resa.nom)} ${_esc(resa.prenom)}<small>${sansResa ? 'Sans réservation' : 'Avec réservation'}${attente ? ' · attendu·e' : ''}</small></h3>
        <button type="button" class="pm-fermer" id="modal-close" aria-label="Fermer">✕</button>
      </div>
      ${tempsHtml}
      <div class="fw-carte fw-details" id="spot-detail-body">
        <div class="spot-detail">
          <div class="detail-row detail-row-editable" id="accomp-row" role="button" tabindex="0" title="Modifier le nombre d'accompagnants">
            <span class="detail-label">Accompagnants</span><span class="detail-value">${_fwAcc(resa.accompagnants)} <span class="edit-hint">${_ICO_CRAYON}</span></span>
          </div>
          ${resa.checkinTime ? `<div class="detail-row"><span class="detail-label">Arrivée</span><span class="detail-value">${_fwHeure(resa.checkinTime)}</span></div>` : ''}
          <div class="detail-row"><span class="detail-label">Emplacement</span><span class="detail-value">${_esc(spotId)}</span></div>
        </div>
      </div>
      <div class="fw-pied">
        <button type="button" class="fw-annuler" id="btn-profil">Historique du jour</button>
        ${actionBtns}
      </div>
    </div>
  `;
  _dialog().classList.add('fw-dialog');

  document.getElementById('modal-close').addEventListener('click', closeModal);
  _bindProfilBtn('spot-detail-body', 'btn-profil', history || []);
  if (callbacks.onUpdateAccompagnants) {
    const row = document.getElementById('accomp-row');
    const ouvrir = () => _inlineEditAccompagnants('accomp-row', resa.accompagnants, callbacks.onUpdateAccompagnants);
    row.addEventListener('click', ouvrir, { once: true });
    row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir(); } }, { once: true });
  } else {
    const hint = document.querySelector('#accomp-row .edit-hint'); if (hint) hint.remove();
  }

  if (attente) {
    document.getElementById('btn-checkin').addEventListener('click', () => { closeModal(); callbacks.onCheckin && callbacks.onCheckin(spotId); });
    document.getElementById('btn-absent').addEventListener('click', () => { closeModal(); callbacks.onAbsent && callbacks.onAbsent(spotId); });
  } else {
    document.getElementById('btn-depart').addEventListener('click', () => { closeModal(); callbacks.onDepart && callbacks.onDepart(spotId); });
  }

  _dialog().showModal();
}

// ── Modale 5 : Détail d'une personne partie ──
// history : [{ slot, spotId, resa }] — passages du jour (calculé dans app.js)
function openDepartedModal(spotId, resa, history) {
  let dureeStr = '—';
  if (resa.checkinTime && resa.departTime) {
    const ms = resa.departTime - resa.checkinTime;
    const h  = Math.floor(ms / 3600000);
    const m  = Math.floor((ms % 3600000) / 60000);
    dureeStr = h > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${m} min`;
  }
  const sansResa = resa.type === 'walkin';

  _dialog().innerHTML = `
    <div class="fw">
      <div class="fw-carte fw-hd">
        <span class="fw-place gris">${_esc(spotId)}</span>
        <h3>${_esc(resa.nom)} ${_esc(resa.prenom)}<small>Parti·e${resa.departTime ? ' à ' + _fwHeure(resa.departTime) : ''} · ${sansResa ? 'sans réservation' : 'avec réservation'}${resa.nbCreneaux > 1 ? ' · 2 créneaux' : ''}</small></h3>
        <button type="button" class="pm-fermer" id="modal-close" aria-label="Fermer">✕</button>
      </div>
      <div class="fw-carte fw-trois">
        <div><span>Arrivée</span><b>${_fwHeure(resa.checkinTime) || '—'}</b></div>
        <div><span>Départ</span><b>${_fwHeure(resa.departTime) || '—'}</b></div>
        <div><span>Sur la plage</span><b>${dureeStr}</b></div>
      </div>
      <div class="fw-carte fw-details" id="departed-body">
        <div class="spot-detail">
          <div class="detail-row"><span class="detail-label">Accompagnants</span><span class="detail-value">${_fwAcc(resa.accompagnants)}</span></div>
          <div class="detail-row"><span class="detail-label">Emplacement</span><span class="detail-value">${_esc(spotId)}</span></div>
        </div>
      </div>
      <div class="fw-pied">
        <button type="button" class="fw-valider fw-bleu" id="btn-profil">Historique du jour</button>
      </div>
    </div>
  `;
  _dialog().classList.add('fw-dialog');

  document.getElementById('modal-close').addEventListener('click', closeModal);
  _bindProfilBtn('departed-body', 'btn-profil', history || []);

  _dialog().showModal();
}

// ── Modale 6 : Détail d'une personne en liste d'attente ──
// callbacks : { onUpdateAccompagnants }
function openWaitingDetailModal(resa, history, callbacks) {
  callbacks = callbacks || {};
  const statusLabel = resa.status === 'pas_venu' ? 'Pas venu·e'
    : resa.status === 'annule' ? 'Annulé·e'
    : resa.status === 'present' ? 'Arrivé·e, à placer' : 'Attendu·e';
  const ini = ((resa.prenom || '').charAt(0) + (resa.nom || '').charAt(0)).toUpperCase() || '?';
  const couleur = resa.status === 'present' ? 'vert' : (resa.status === 'pas_venu' || resa.status === 'annule') ? 'gris'
    : resa.resaType === 'groupe' ? 'violet' : 'ambre';

  _dialog().innerHTML = `
    <div class="fw">
      <div class="fw-carte fw-hd">
        <span class="vp-av fw-av ${couleur}" aria-hidden="true">${_esc(ini)}</span>
        <h3>${_esc(resa.nom)} ${_esc(resa.prenom)}<small>${statusLabel}${resa.type === 'walkin' ? ' · sans réservation' : ''}</small></h3>
        <button type="button" class="pm-fermer" id="modal-close" aria-label="Fermer">✕</button>
      </div>
      <div class="fw-carte fw-details" id="waiting-detail-body">
        <div class="spot-detail">
          <div class="detail-row detail-row-editable" id="accomp-row" role="button" tabindex="0" title="Modifier le nombre d'accompagnants">
            <span class="detail-label">Accompagnants</span><span class="detail-value">${_fwAcc(resa.accompagnants)} <span class="edit-hint">${_ICO_CRAYON}</span></span>
          </div>
          <div class="detail-row"><span class="detail-label">Statut</span><span class="detail-value">${statusLabel}</span></div>
          ${resa.checkinTime ? `<div class="detail-row"><span class="detail-label">Arrivée</span><span class="detail-value">${_fwHeure(resa.checkinTime)}</span></div>` : ''}
        </div>
      </div>
      <div class="fw-pied">
        <button type="button" class="fw-valider fw-bleu" id="btn-profil">Historique du jour</button>
      </div>
    </div>
  `;
  _dialog().classList.add('fw-dialog');

  document.getElementById('modal-close').addEventListener('click', closeModal);
  _bindProfilBtn('waiting-detail-body', 'btn-profil', history || []);
  if (callbacks.onUpdateAccompagnants) {
    const row = document.getElementById('accomp-row');
    const ouvrir = () => _inlineEditAccompagnants('accomp-row', resa.accompagnants, callbacks.onUpdateAccompagnants);
    row.addEventListener('click', ouvrir, { once: true });
    row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir(); } }, { once: true });
  } else {
    const hint = document.querySelector('#accomp-row .edit-hint'); if (hint) hint.remove();
  }

  _dialog().showModal();
}

// Trouve N emplacements adjacents (même rangée, même zone entre tapis)
function _findAdjacentFreeSpots(freeSpotIds, count) {
  if (!count || freeSpotIds.length === 0) return freeSpotIds.slice(0, count || 0);
  const freeSet  = new Set(freeSpotIds);
  const allSpots = ((typeof BEACH_CONFIG !== 'undefined') && BEACH_CONFIG.spots) || [];
  const freeObjs = allSpots.filter(s => freeSet.has(s.id));
  if (freeObjs.length <= count) return freeObjs.map(s => s.id);

  // Regrouper par rangée (y proche à ±25 px)
  const rows = [];
  freeObjs.forEach(s => {
    let row = rows.find(r => Math.abs(r.y - s.y) <= 25);
    if (!row) { row = { y: s.y, spots: [] }; rows.push(row); }
    row.spots.push(s);
  });

  // Tapis verticaux séparant les zones
  const TAPIS_X = [169, 339, 509];

  for (const row of rows) {
    row.spots.sort((a, b) => a.x - b.x);
    // Découper la rangée aux tapis
    const zones = [[row.spots[0]]];
    for (let i = 1; i < row.spots.length; i++) {
      const prev = row.spots[i - 1], curr = row.spots[i];
      if (TAPIS_X.some(tx => prev.x < tx && curr.x > tx)) zones.push([curr]);
      else zones[zones.length - 1].push(curr);
    }
    for (const zone of zones) {
      if (zone.length >= count) return zone.slice(0, count).map(s => s.id);
    }
  }

  // Repli : premiers spots libres disponibles
  return freeSpotIds.slice(0, count);
}

// ── Modale Accueil Groupe ──
// nbSpotsHint : nb d'emplacements pré-définis depuis la réservation (resa.accompagnants)
// onConfirm({ nbUsagers, nbAcc, spots })
function openGroupCheckinModal(resa, freeSpots, onConfirm, nbSpotsHint) {
  // nbSpotsHint = nb_emplacements pré-définis (depuis resa.nbUsagers côté liste d'attente)
  let nbUsagers = Math.max(1, nbSpotsHint || resa.nbUsagers || 1) * 3;
  let nbAcc = 0;

  function _needed()    { return Math.ceil((nbUsagers + nbAcc) / 3); }
  function _suggested() { return _findAdjacentFreeSpots(freeSpots, _needed()); }

  function _draw() {
    const needed = _needed();
    const spots  = _suggested();
    const ok     = spots.length >= needed;
    _dialog().innerHTML = `
      <div class="modal-header">
        <h3>Accueil Groupe · ${_esc(resa.nom)} ${_esc(resa.prenom)}</h3>
        <button class="modal-close" id="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label>Usagers présents</label>
            <div class="spinner-row">
              <button class="spinner-btn" id="sp-u-dec">−</button>
              <span class="spinner-val" id="sp-u-val">${nbUsagers}</span>
              <button class="spinner-btn" id="sp-u-inc">＋</button>
            </div>
          </div>
          <div class="form-group">
            <label>Accompagnants</label>
            <div class="spinner-row">
              <button class="spinner-btn" id="sp-a-dec">−</button>
              <span class="spinner-val" id="sp-a-val">${nbAcc}</span>
              <button class="spinner-btn" id="sp-a-inc">＋</button>
            </div>
          </div>
        </div>
        <div class="groupe-spots-info${ok ? '' : ' groupe-spots-warn'}">
          <span>Emplacements nécessaires : <strong>${needed}</strong> <span style="opacity:.7">(1 emplacement pour 3 personnes)</span></span>
          <span>Proposés : <strong>${spots.length > 0 ? spots.join(', ') : '—'}</strong></span>
          ${!ok ? `<span class="groupe-spots-err">⚠ Pas assez d'emplacements libres (${freeSpots.length} disponible${freeSpots.length > 1 ? 's' : ''}).</span>` : ''}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" id="modal-cancel">Annuler</button>
        <button class="btn-primary" id="modal-confirm"${!ok ? ' disabled' : ''}>✓ Accueillir</button>
      </div>
    `;
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('sp-u-dec').addEventListener('click', () => { if (nbUsagers > 1) { nbUsagers--; _draw(); } });
    document.getElementById('sp-u-inc').addEventListener('click', () => { nbUsagers++; _draw(); });
    document.getElementById('sp-a-dec').addEventListener('click', () => { if (nbAcc > 0) { nbAcc--; _draw(); } });
    document.getElementById('sp-a-inc').addEventListener('click', () => { nbAcc++; _draw(); });
    if (ok) {
      document.getElementById('modal-confirm').addEventListener('click', () => {
        closeModal();
        onConfirm({ nbUsagers, nbAcc, spots: _suggested() });
      });
    }
  }

  _draw();
  _dialog().showModal();
}

function _bindRadioGroup(groupId) {
  document.getElementById(groupId).querySelectorAll('.radio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(groupId).querySelectorAll('.radio-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
}

// ── Modale Planning : liste des réservations d'un créneau pour une date ──
// callbacks : { onAdd, onRemove(id), onGoLive } (onGoLive=null si pas aujourd'hui)
function openSlotPlanningModal(dateISO, slot, callbacks) {
  const d = new Date(dateISO + 'T00:00:00');
  const dateLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const titleLabel = `${slot.label} · ${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}`;

  const goLiveBtn = callbacks.onGoLive
    ? '<button type="button" class="pm-act" id="btn-go-live">&#9654; Vue live</button>' : '';
  const capa = callbacks.capacite || { usagers: CAPACITY_NORMAL, groupes: CAPACITY_GROUPE, totale: CAPACITY_NORMAL + CAPACITY_GROUPE, modifie: false };
  const CAP_N = capa.usagers, CAP_G = capa.groupes;

  // Titre : créneau, date courte, état (en cours / à venir / terminé) et couleur du créneau
  const dateCourte = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const idxSlot = typeof SLOTS !== 'undefined' ? SLOTS.findIndex(s => s.id === slot.id) : -1;
  const couleurSlot = (typeof SLOT_COLORS !== 'undefined' && SLOT_COLORS[idxSlot]) || '#1565c0';
  const auj = new Date(); const ajdISO = auj.getFullYear() + '-' + String(auj.getMonth() + 1).padStart(2, '0') + '-' + String(auj.getDate()).padStart(2, '0');
  let etatSlot = '';
  if (dateISO === ajdISO && typeof getSlotStatus === 'function') {
    etatSlot = { active: 'en cours', upcoming: 'à venir', past: 'terminé' }[getSlotStatus(slot, auj)] || '';
  } else if (dateISO < ajdISO) etatSlot = 'passé';
  const loupe = c => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="' + c + '" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg>';

  _dialog().innerHTML = `
    <div class="pm">
      <!-- Résumé du créneau : titre, trois chiffres, actions -->
      <div class="pm-resume">
        <div class="pm-titre" style="--c:${couleurSlot}">
          <h3>${slot.label}</h3>
          <small>${dateCourte.charAt(0).toUpperCase() + dateCourte.slice(1)}${etatSlot ? ' · ' + etatSlot : ''}${capa.modifie ? ' · places réglées' : ''}</small>
        </div>
        <div class="pm-chiffre">
          <small>Réservations</small>
          <b id="pm-n-normal">–<span>/${CAP_N}</span></b>
          <div class="pm-piste"><i id="pm-bar-normal"></i></div>
          <em id="pm-rest-normal">&nbsp;</em>
        </div>
        <div class="pm-chiffre">
          <small>Sans réservation</small>
          <b id="pm-n-walkins">–</b>
          <div class="pm-piste" style="visibility:hidden"></div>
          <em>sur place</em>
        </div>
        <div class="pm-chiffre">
          <small>Groupes</small>
          <b id="pm-n-groupe">–<span>/${CAP_G}</span></b>
          <div class="pm-piste"><i id="pm-bar-groupe" class="violet"></i></div>
          <em id="pm-rest-groupe">&nbsp;</em>
        </div>
        <div class="pm-actions">
          ${typeof ouvrirReglageCapacite === 'function' ? '<button type="button" class="pm-act" id="pf-capa">Régler les places</button>' : ''}
          <button type="button" class="pm-act" id="btn-export-pdf">PDF</button>
          ${goLiveBtn}
          <button type="button" class="pm-fermer" id="modal-close" aria-label="Fermer">✕</button>
        </div>
      </div>

      <!-- Ajout : l'action principale de la fenêtre (bleu = usager, violet = groupe) -->
      <div class="pm-ajout" id="pm-ajout">
        <div class="pm-ajout-t" id="pm-ajout-t">Ajouter une réservation</div>
        <div class="pm-ajout-l">
          <div class="pm-seg radio-group" id="pf-type" role="group" aria-label="Type de réservation">
            <div class="radio-btn selected" data-value="normal" role="button" tabindex="0">Usager</div>
            <div class="radio-btn" data-value="groupe" role="button" tabindex="0">Groupe</div>
          </div>
          <div class="pm-champs">
            <span class="pm-loupe" id="pm-loupe">${loupe('#05559b')}</span>
            <label class="sr-only" for="pf-nom" id="pf-nom-label">Nom</label>
            <input type="text" id="pf-nom" placeholder="NOM" autocomplete="off" style="text-transform:uppercase">
            <span id="pf-prenom-wrap" class="pm-prenom">
              <label class="sr-only" for="pf-prenom">Prénom</label>
              <input type="text" id="pf-prenom" placeholder="Prénom" autocomplete="off">
            </span>
            <div id="pf-nom-suggest" class="pm-suggest" style="display:none"></div>
          </div>
          <div class="pm-empl" id="pf-empl-grp" style="display:none">
            <label for="pf-empl">Emplacements</label>
            <button type="button" class="pm-pas" data-pas="-1" aria-label="Un emplacement de moins">−</button>
            <input type="number" id="pf-empl" min="1" max="10" value="1" class="plan-empl-inp">
            <button type="button" class="pm-pas" data-pas="1" aria-label="Un emplacement de plus">＋</button>
          </div>
          <button type="button" class="pm-ajouter" id="pf-add">＋ Ajouter</button>
        </div>
        <div id="pf-error" class="pm-erreur" role="alert"></div>
      </div>

      <!-- Les trois listes : Réservations, Sans réservation, Groupes -->
      <div class="pm-listes">
        <section class="pm-liste">
          <div class="pm-liste-hd"><span>Réservations</span><span class="plan-section-cap" id="cap-normal"></span></div>
          <div id="planning-list-normal" class="pm-lignes"></div>
        </section>
        <section class="pm-liste" id="plan-walkins-section">
          <div class="pm-liste-hd"><span>Sans réservation</span><span class="plan-section-cap" id="cap-walkins">0</span></div>
          <div id="planning-list-walkins" class="pm-lignes"></div>
        </section>
        <section class="pm-liste">
          <div class="pm-liste-hd"><span>Groupes</span><span class="plan-section-cap" id="cap-groupe"></span></div>
          <div id="planning-list-groupe" class="pm-lignes"></div>
        </section>
      </div>
    </div>
  `;

  // Ligne d'une liste : pastille, nom (lien vers la fiche), détail, étiquette d'état, suppression
  function _ligne(o) {
    const ini = ((o.prenom || '').charAt(0) + (o.nom || '').charAt(0)).toUpperCase() || (o.nom || '?').slice(0, 2).toUpperCase();
    return '<div class="planning-list-item pm-ligne' + (o.present ? ' planning-list-present' : '') + '">'
      + '<span class="pm-av' + (o.av ? ' ' + o.av : '') + '" aria-hidden="true">' + _esc(ini) + '</span>'
      + '<span class="plan-name-link pm-qui" data-insc-id="' + _esc(o.inscriptionId || '') + '" data-groupe-id="' + _esc(o.groupeId || '') + '" data-nom="' + _esc(o.nom) + '" data-prenom="' + _esc(o.prenom) + '">'
      +   '<b>' + _esc(o.titre) + '</b><small>' + o.sous + '</small></span>'
      + (o.tag ? '<span class="pm-tag ' + o.tagCls + '">' + o.tag + '</span>' : '')
      + (o.removeId ? '<button type="button" class="btn-remove pm-suppr" data-id="' + _esc(o.removeId) + '" aria-label="Retirer">✕</button>' : '<span class="pm-suppr-vide"></span>')
      + '</div>';
  }

  function _details(morceaux) { return _esc(morceaux.filter(function(m) { return m != null && m !== '' && !/undefined|null/.test(String(m)); }).join(' · ')); }
  function _acc(n) { return n == null ? '' : n === 0 ? 'seul·e' : n === 1 ? '1 acc.' : n + ' acc.'; }

  // Chiffres du résumé, mis à jour à chaque rafraîchissement des listes
  function _majResume(cle, total, capacite) {
    const n = document.getElementById('pm-n-' + cle);
    if (n) n.innerHTML = total + (capacite != null ? '<span>/' + capacite + '</span>' : '');
    const bar = document.getElementById('pm-bar-' + cle);
    if (bar) {
      bar.style.width = (capacite > 0 ? Math.min(100, Math.round(total / capacite * 100)) : (total > 0 ? 100 : 0)) + '%';
      bar.classList.toggle('plein', capacite != null && total >= capacite);
    }
    const rest = document.getElementById('pm-rest-' + cle);
    if (rest && capacite != null) {
      const r = capacite - total;
      rest.textContent = r > 0 ? r + (cle === 'groupe' ? ' restant' : ' restante') + (r > 1 ? 's' : '')
                       : r === 0 ? 'complet' : 'dépassé de ' + (-r);
    }
  }

  function _fmtCheckinTime(ts) {
    const d = new Date(ts);
    return String(d.getHours()).padStart(2,'0') + 'h' + String(d.getMinutes()).padStart(2,'0');
  }

  function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _openProfilePanel(inscriptionId, nom, prenom, groupeId) {
    if (groupeId) {
      if (typeof App !== 'undefined' && typeof App.navigateToGroupe === 'function') {
        App.navigateToGroupe(groupeId);
      }
      return;
    }
    var id = inscriptionId;
    if (!id && typeof getCachedInscriptions === 'function') {
      var nomUp = (nom || '').toUpperCase();
      var match = getCachedInscriptions().find(function(i) {
        return i.nom.toUpperCase() === nomUp
            && i.prenom.toUpperCase() === (prenom || '').toUpperCase();
      });
      if (match) id = match.id;
    }
    if (!id) return;
    if (typeof App !== 'undefined' && typeof App.navigateToInscription === 'function') {
      App.navigateToInscription(id);
    }
  }

  async function _refreshSection(resaType, listId, capId, capacity) {
    const [all, spotsMap] = await Promise.all([
      getReservationList(dateISO, slot.id),
      getReservations(dateISO, slot.id),
    ]);
    // Les personnes venues sans réservation ont leur propre liste, placées ou non
    const pending = all.filter(r => r.status !== 'annule' && r.type !== 'walkin' && (resaType === 'normal'
      ? (!r.resaType || r.resaType === 'normal')
      : r.resaType === 'groupe'));

    const arrived = resaType === 'normal'
      ? Object.entries(spotsMap)
              .filter(([, r]) => r.type === 'reserved' && r.status !== 'annule' && (!r.resaType || r.resaType === 'normal'))
              .map(([spotId, r]) => ({ ...r, _spotId: spotId }))
      : [];

    // Spots groupe assignés (présents ET partis) — pour compteur et historique
    const arrivedGroupSpots = resaType === 'groupe'
      ? Object.entries(spotsMap)
              .filter(([, r]) => r.resaType === 'groupe' && r.type === 'reserved')
              .map(([spotId, r]) => ({ ...r, _spotId: spotId }))
      : [];

    const total = resaType === 'groupe'
      ? pending.reduce(function(sum, r) { return sum + (r.nbUsagers || 1); }, 0) + arrivedGroupSpots.length
      : pending.length + arrived.length;
    const capEl = document.getElementById(capId);
    if (capEl) {
      capEl.textContent = total + ' / ' + capacity;
      capEl.className = 'plan-section-cap' + (total >= capacity ? ' full' : total >= capacity * 0.8 ? ' warn' : '');
    }
    _majResume(resaType === 'groupe' ? 'groupe' : 'normal', total, capacity);
    const listEl = document.getElementById(listId);
    if (!listEl) return;

    if (total === 0 && arrived.length === 0 && arrivedGroupSpots.length === 0) {
      listEl.innerHTML = '<div class="planning-empty">' + (resaType === 'groupe' ? 'Aucun groupe' : 'Aucune réservation') + '</div>';
      return;
    }

    const _etat = r => (r.status === 'absent' || r.status === 'pas_venu')
      ? { tag: 'Pas venu·e', tagCls: 'rouge' } : { tag: 'Attendu·e', tagCls: 'orange' };
    const pendingHtml = pending.map(r => {
      const insc = (typeof getCachedInscriptions === 'function' && r.inscriptionId)
        ? getCachedInscriptions().find(i => i.id === r.inscriptionId) : null;
      let pass = '';
      if (insc && insc.pass && insc.pass.actif) {
        const reste = typeof getPassRemaining === 'function' ? getPassRemaining(insc.id) : null;
        pass = (typeof reste === 'number' && typeof PASS_QUOTA !== 'undefined') ? 'Pass ' + reste + ' / ' + PASS_QUOTA : 'Pass actif';
      }
      const e = _etat(r);
      return _ligne({
        nom: r.nom, prenom: r.prenom, inscriptionId: r.inscriptionId, groupeId: r.groupeId,
        titre: resaType === 'groupe' ? r.nom : (r.nom + (r.prenom ? ' ' + r.prenom : '')),
        sous: resaType === 'groupe' ? (r.nbUsagers || 1) + ' emplacement' + ((r.nbUsagers || 1) > 1 ? 's' : '') : (pass || 'Réservation'),
        av: resaType === 'groupe' ? 'violet' : '', tag: e.tag, tagCls: e.tagCls, removeId: r.id,
      });
    }).join('');

    // Groupes arrivés : dédupliquer par nom (1 ligne par groupe, liste des emplacements)
    let arrivedHtml = '';
    if (resaType === 'groupe' && arrivedGroupSpots.length > 0) {
      const _seen = {};
      arrivedHtml = arrivedGroupSpots.reduce(function(html, r) {
        const key = (r.nom || '').toUpperCase();
        if (_seen[key]) return html;
        _seen[key] = true;
        const groupSpots = arrivedGroupSpots.filter(function(g) { return (g.nom || '').toUpperCase() === key; });
        const spotList = groupSpots.map(function(g) { return g._spotId; }).join(', ');
        const empl = groupSpots.length + ' empl.';
        const time = r.checkinTime ? ' · ' + _fmtCheckinTime(r.checkinTime) : '';
        const surPlage = groupSpots.some(function(g) { return g.status === 'present'; });
        return html + _ligne({
          nom: r.nom, prenom: '', inscriptionId: r.inscriptionId, groupeId: r.groupeId, present: true,
          titre: r.nom + (r.prenom ? ' ' + r.prenom : ''), sous: _details([empl, spotList, time.replace(' · ', '')]),
          av: 'violet', tag: surPlage ? 'Sur la plage' : 'Parti', tagCls: surPlage ? 'vert' : 'gris',
        });
      }, '');
    } else {
      arrivedHtml = arrived.map(r => {
        const acc  = r.accompagnants === 0 ? 'seul·e'
          : r.accompagnants === 1 ? '1 acc.' : r.accompagnants + ' acc.';
        const time = r.checkinTime ? ' · ' + _fmtCheckinTime(r.checkinTime) : '';
        return _ligne({
          nom: r.nom, prenom: r.prenom, inscriptionId: r.inscriptionId, present: true,
          titre: r.nom + (r.prenom ? ' ' + r.prenom : ''), sous: _details([r._spotId, _acc(r.accompagnants), time.replace(' · ', '')]),
          tag: 'Arrivé·e', tagCls: 'vert',
        });
      }).join('');
    }

    listEl.innerHTML = arrivedHtml + pendingHtml;
    listEl.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await callbacks.onRemove(btn.dataset.id);
          await _refreshAll();
        } catch (e) {
          console.error(e);
        }
      });
    });
    listEl.querySelectorAll('.plan-name-link').forEach(function(span) {
      span.addEventListener('click', function() {
        _openProfilePanel(span.dataset.inscId, span.dataset.nom, span.dataset.prenom, span.dataset.groupeId);
      });
    });
  }

  async function _refreshWalkins() {
    const [spots, attente] = await Promise.all([getReservations(dateISO, slot.id), getReservationList(dateISO, slot.id)]);
    const nonPlaces = attente.filter(r => r.type === 'walkin' && r.status !== 'annule');
    const items = Object.entries(spots).filter(([, r]) => r.type === 'walkin')
      .concat(nonPlaces.map(r => [null, r]));
    const section = document.getElementById('plan-walkins-section');
    if (!section) return;
    const capEl = document.getElementById('cap-walkins');
    if (capEl) capEl.textContent = items.length;
    _majResume('walkins', items.length, null);
    const listEl = document.getElementById('planning-list-walkins');
    if (!listEl) return;
    if (items.length === 0) { listEl.innerHTML = '<div class="planning-empty">Personne pour l\'instant</div>'; return; }
    listEl.innerHTML = items.map(([spotId, r]) => {
      const acc = r.accompagnants === 0 ? 'seul·e'
        : r.accompagnants === 1 ? '1 acc.' : r.accompagnants + ' acc.';
      const time = r.checkinTime ? 'arrivé·e à ' + _fmtCheckinTime(r.checkinTime) : '';
      return _ligne({
        nom: r.nom, prenom: r.prenom, inscriptionId: r.inscriptionId,
        titre: r.nom + (r.prenom ? ' ' + r.prenom : ''), sous: _details([spotId, _acc(r.accompagnants), time]), av: 'orange',
        tag: spotId ? '' : 'À placer', tagCls: 'orange',
      });
    }).join('');
    listEl.querySelectorAll('.plan-name-link').forEach(function(span) {
      span.addEventListener('click', function() {
        _openProfilePanel(span.dataset.inscId, span.dataset.nom, span.dataset.prenom, span.dataset.groupeId);
      });
    });
  }

  async function _refreshAll() {
    await Promise.all([
      _refreshSection('normal', 'planning-list-normal', 'cap-normal', CAP_N),
      _refreshSection('groupe', 'planning-list-groupe', 'cap-groupe', CAP_G),
      _refreshWalkins(),
    ]);
  }

  _bindRadioGroup('pf-type');

  const capaBtn = document.getElementById('pf-capa');
  if (capaBtn) capaBtn.addEventListener('click', () => {
    ouvrirReglageCapacite({
      date: dateISO, creneauId: slot.id, portee: 'creneau',
      depart: { totale: capa.totale, groupes: capa.groupes, groupeId: capa.groupeId },
      onDone: () => { if (_dialog().open) _dialog().close(); if (callbacks.onCapacite) callbacks.onCapacite(); },
    });
  });

  // Bascule Acc. ↔ Empl. et Nom/Prénom ↔ Nom du groupe selon le type
  document.querySelectorAll('#pf-type .radio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const isGroupe = btn.dataset.value === 'groupe';
      document.getElementById('pm-ajout').classList.toggle('groupe', isGroupe);
      document.getElementById('pm-ajout-t').textContent = isGroupe ? 'Ajouter un groupe' : 'Ajouter une réservation';
      document.getElementById('pm-loupe').innerHTML = loupe(isGroupe ? '#6a1b9a' : '#05559b');
      document.getElementById('pf-empl-grp').style.display    = isGroupe ? '' : 'none';
      document.getElementById('pf-prenom-wrap').style.display = isGroupe ? 'none' : '';
      document.getElementById('pf-nom-label').textContent     = isGroupe ? 'Nom du groupe' : 'Nom';
      if (isGroupe) document.getElementById('pf-nom').placeholder = 'Nom du groupe';
      else          document.getElementById('pf-nom').placeholder = 'NOM';
    });
  });

  document.querySelectorAll('#pf-type .radio-btn').forEach(btn => {
    btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); } });
  });
  document.querySelectorAll('#pf-empl-grp .pm-pas').forEach(b => {
    b.addEventListener('click', () => {
      const inp = document.getElementById('pf-empl');
      inp.value = Math.min(10, Math.max(1, (parseInt(inp.value, 10) || 1) + parseInt(b.dataset.pas, 10)));
    });
  });

  document.getElementById('pf-prenom').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\b\w/g, c => c.toUpperCase());
  });

  // Autocomplete NOM (usagers) ou NOM DU GROUPE selon le type sélectionné
  var _linkedPfInscriptionId = null;
  var _linkedGroupeId        = null;
  var _saisonCourante = null;
  if (typeof getSaisonCourante === 'function') {
    getSaisonCourante().then(function(s) { _saisonCourante = s; }).catch(function() {});
  }
  (function() {
    var nomEl     = document.getElementById('pf-nom');
    var prenomEl  = document.getElementById('pf-prenom');
    var suggestEl = document.getElementById('pf-nom-suggest');

    function _close() { suggestEl.style.display = 'none'; suggestEl.innerHTML = ''; }

    nomEl.addEventListener('input', function() {
      _linkedPfInscriptionId = null;
      _linkedGroupeId        = null;
      var val = nomEl.value.trim().toUpperCase();
      _close();
      if (!val && !prenomEl.value.trim()) return;

      var currentType = (document.querySelector('#pf-type .radio-btn.selected') || {}).dataset
        ? document.querySelector('#pf-type .radio-btn.selected').dataset.value : 'normal';

      if (currentType === 'groupe') {
        if (!val || typeof getCachedGroupes !== 'function') return;
        var gmatches = getCachedGroupes()
          .filter(function(g) { return g.nom.toUpperCase().includes(val); })
          .slice(0, 8);
        if (!gmatches.length) return;
        suggestEl.style.display = 'block';
        gmatches.forEach(function(g) {
          var item = document.createElement('div');
          item.className = 'pf-suggest-item';
          item.style.cssText = 'padding:6px 10px;cursor:pointer;font-size:13px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center';
          var nameSpan = document.createElement('span');
          var _b2 = document.createElement('strong');
          _b2.textContent = g.nom;
          nameSpan.appendChild(_b2);
          item.appendChild(nameSpan);
          var metaSpan = document.createElement('span');
          metaSpan.style.cssText = 'font-size:11px;color:#888';
          metaSpan.textContent = g.typeStructure + (g.commune ? ' · ' + g.commune : '');
          item.appendChild(metaSpan);
          item.addEventListener('mousedown', function(e) {
            e.preventDefault();
            nomEl.value     = g.nom;
            _linkedGroupeId = g.id;
            _close();
          });
          item.addEventListener('mouseover', function() { item.style.background = '#f0f4ff'; });
          item.addEventListener('mouseout',  function() { item.style.background = ''; });
          suggestEl.appendChild(item);
        });
      } else {
        if (typeof getCachedInscriptions !== 'function') return;
        var matches = getCachedInscriptions()
          .filter(function(i) { return _correspondInscription(i, _sansAccent(val), _sansAccent(prenomEl.value)); })
          .slice(0, 8);
        if (!matches.length) return;
        suggestEl.style.display = 'block';
        matches.forEach(function(i) {
          var remaining = (typeof getPassRemaining === 'function' && i.pass)
            ? getPassRemaining(i.id) : null;
          var exhausted = remaining === 0;
          var item = document.createElement('div');
          item.className = 'pf-suggest-item';
          item.style.cssText = 'padding:6px 10px;cursor:pointer;font-size:13px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center'
            + (exhausted ? ';opacity:.5;cursor:not-allowed' : '');
          var nameSpan = document.createElement('span');
          var _b3 = document.createElement('strong');
          _b3.textContent = i.nom.toUpperCase();
          nameSpan.appendChild(_b3);
          nameSpan.appendChild(document.createTextNode(' ' + i.prenom));
          var nameWrap = document.createElement('span');
          nameWrap.style.cssText = 'display:flex;flex-direction:column;gap:2px';
          nameWrap.appendChild(nameSpan);
          if (i.statut === 'valide' && _saisonCourante !== null && i.derniereSaisonValidee !== _saisonCourante) {
            var renewSpan = document.createElement('span');
            renewSpan.style.cssText = 'font-size:10px;font-weight:700;color:#f57c00';
            renewSpan.textContent = '⚠️ Non renouvelé';
            nameWrap.appendChild(renewSpan);
          }
          item.appendChild(nameWrap);
          if (i.pass) {
            var remSpan = document.createElement('span');
            remSpan.style.cssText = 'font-size:11px;' + (exhausted ? 'color:#c00' : 'color:#1565c0');
            remSpan.textContent = exhausted
              ? '🎫 Pass 2026 · épuisé'
              : '🎫 Pass 2026 · ' + remaining + ' résa. rest.';
            item.appendChild(remSpan);
          }
          if (!exhausted) {
            item.addEventListener('mousedown', function(e) {
              e.preventDefault();
              nomEl.value             = i.nom.toUpperCase();
              prenomEl.value          = i.prenom;
              _linkedPfInscriptionId  = i.id;
              _close();
              prenomEl.focus();
            });
            item.addEventListener('mouseover', function() { item.style.background = '#f0f4ff'; });
            item.addEventListener('mouseout',  function() { item.style.background = ''; });
          }
          suggestEl.appendChild(item);
        });
      }
    });

    nomEl.addEventListener('blur',    function() { setTimeout(_close, 150); });
    nomEl.addEventListener('keydown', function(e) { if (e.key === 'Escape') _close(); });
    // Le prénom propose aussi des suggestions d'usagers (en complément du nom)
    prenomEl.addEventListener('input',   function() { nomEl.dispatchEvent(new Event('input')); });
    prenomEl.addEventListener('blur',    function() { setTimeout(_close, 150); });
    prenomEl.addEventListener('keydown', function(e) { if (e.key === 'Escape') _close(); });
  })();

  // Réservation lancée depuis la fiche d'un groupe (onglet Groupes → « Réserver un créneau ») :
  // type « Groupe » et groupe présélectionnés
  if (window._hpGroupePreselect) {
    const gp = window._hpGroupePreselect;
    const gBtn = document.querySelector('#pf-type .radio-btn[data-value="groupe"]');
    if (gBtn) gBtn.click();
    document.getElementById('pf-nom').value = gp.nom;
    _linkedGroupeId = gp.id;
    setTimeout(function() { const e = document.getElementById('pf-empl'); if (e) e.focus(); }, 50);
  }

  // Réservation lancée depuis le profil d'un inscrit (téléphone) : la personne est déjà choisie
  if (window._hpUsagerPreselect) {
    const up = window._hpUsagerPreselect;
    window._hpUsagerPreselect = null;
    document.getElementById('pf-nom').value    = String(up.nom || '').toUpperCase();
    document.getElementById('pf-prenom').value = up.prenom || '';
    _linkedPfInscriptionId = up.id || null;
  }

  document.getElementById('pf-add').addEventListener('click', async () => {
    const nom           = document.getElementById('pf-nom').value.trim().toUpperCase();
    const resaType      = document.querySelector('#pf-type .radio-btn.selected').dataset.value;
    const accompagnants = resaType === 'groupe'
      ? Math.max(1, parseInt(document.getElementById('pf-empl').value) || 1)
      : 0;
    const prenom = resaType === 'groupe' ? '' : document.getElementById('pf-prenom').value.trim();
    const errEl  = document.getElementById('pf-error');

    if (!nom || (resaType !== 'groupe' && !prenom)) {
      errEl.textContent = resaType === 'groupe' ? 'Le nom du groupe est obligatoire.' : 'Prénom et nom sont obligatoires.';
      return;
    }

    const [all, spotsMap] = await Promise.all([
      getReservationList(dateISO, slot.id),
      getReservations(dateISO, slot.id),
    ]);
    const limit = resaType === 'normal' ? CAP_N : CAP_G;
    if (resaType === 'groupe') {
      const existingEmpl = all.filter(function(r) { return r.resaType === 'groupe'; })
        .reduce(function(sum, r) { return sum + (r.nbUsagers || 1); }, 0);
      if (existingEmpl + accompagnants > limit
          && !confirm('Ce créneau est limité à ' + limit + ' places groupes et ' + existingEmpl + ' sont déjà prises.\n\nAjouter quand même ce groupe ?')) {
        return;
      }
    } else {
      const count        = all.filter(function(r) { return r.type !== 'walkin' && (!r.resaType || r.resaType === 'normal'); }).length;
      const arrivedCount = Object.values(spotsMap).filter(function(r) { return r.type === 'reserved'; }).length;
      if (count + arrivedCount >= limit
          && !confirm('Ce créneau est limité à ' + limit + ' places en ligne et ' + (count + arrivedCount) + ' sont déjà réservées.\n\nAjouter quand même cette réservation ?')) {
        return;
      }
    }

    errEl.textContent = '';
    try {
      const addData = resaType === 'groupe'
        ? { nom, prenom: '', accompagnants: 0, nbEmpl: accompagnants, resaType, inscriptionId: null, groupeId: _linkedGroupeId }
        : { nom, prenom, accompagnants, resaType, inscriptionId: _linkedPfInscriptionId, groupeId: null };
      _linkedGroupeId = null;
      await callbacks.onAdd(addData);
      // Réservation du groupe présélectionné faite : on sort de ce mode
      if (window._hpGroupePreselect && resaType === 'groupe') {
        window._hpGroupePreselect = null;
        const ban = document.getElementById('plan-groupe-banner');
        if (ban) ban.remove();
      }
      _linkedPfInscriptionId = null;
      document.getElementById('pf-prenom').value = '';
      document.getElementById('pf-nom').value    = '';
      document.getElementById('pf-nom').focus();
      await _refreshAll();
    } catch (e) {
      errEl.textContent = e.message || 'Erreur lors de l\'ajout.';
    }
  });

  // Ajouter au "Enter" sur les champs texte
  ['pf-prenom', 'pf-nom'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('pf-add').click();
    });
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-export-pdf').addEventListener('click', () => exportSlotPDF(dateISO, slot, capa).catch(console.error));

  if (callbacks.onGoLive) {
    document.getElementById('btn-go-live').addEventListener('click', () => { closeModal(); callbacks.onGoLive(); });
  }

  _dialog().classList.add('plan-dialog');
  _dialog().showModal();
  // Aucun champ sélectionné à l'ouverture : sur tablette, le clavier ne s'ouvre pas tout seul
  // (on choisit d'abord l'action ; le clavier vient quand on touche Nom ou Prénom).
  _dialog().setAttribute('tabindex', '-1');
  _dialog().focus({ preventScroll: true });
  _refreshAll();

  // Souscription Realtime : rafraîchit la liste si une réservation change (ex: annulation depuis l'interface usager)
  var _modalChannel = supabaseClient
    .channel('planning-modal-' + dateISO + '-' + slot.id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations', filter: 'date=eq.' + dateISO }, function(payload) {
      var creneauId = (payload.new && payload.new.creneau_id) || (payload.old && payload.old.creneau_id);
      if (creneauId == slot.id) _refreshAll().catch(console.error);
    })
    .subscribe();

  _dialog().addEventListener('close', function() {
    supabaseClient.removeChannel(_modalChannel);
  }, { once: true });
}

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
      <p class="modal-hint">Dates pré-remplies avec celles de la saison ${saisonCourante} — à mettre à jour pour la nouvelle saison.</p>
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

if (typeof module !== 'undefined') {
  module.exports = { openAddReservationModal, openAssignSpotModal, openCheckinModal, openWalkinEntryModal, openPlacementPickerModal, openSpotDetailModal, openDepartedModal, openWaitingDetailModal, openSlotPlanningModal, openGroupCheckinModal, openOpenSeasonModal, closeModal };
}
