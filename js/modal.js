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
      const nameSpan = document.createElement('span');
      nameSpan.textContent = insc.nom.toUpperCase() + ' ' + insc.prenom;
      item.appendChild(nameSpan);
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

// ── Modale 3 : Check-in direct (arrivée sans réservation — walk-in) ──
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
// callbacks : { onCheckin, onDepart, onAbsent }
// history   : [{ slot, spotId, resa }] — historique du jour (optionnel)
function openSpotDetailModal(spotId, resa, callbacks, history) {
  const ms = resa.checkinTime ? getTimeRemaining(resa.checkinTime, resa.durationMs) : null;
  const urgency = ms !== null ? getUrgencyLevel(ms) : 'ok';

  const timerHtml = ms !== null
    ? `<div class="detail-row"><span class="detail-label">Temps restant</span><span class="detail-timer ${urgency}">${formatCountdown(ms)}</span></div>`
    : '';

  const accompLabel = resa.accompagnants === 0 ? 'Seul·e'
    : resa.accompagnants === 1 ? '1 accompagnant' : '2 accompagnants';
  const doubleLabel = resa.durationMs && resa.durationMs > 105 * 60 * 1000 ? ' (2 créneaux)' : '';

  const actionBtns = resa.status === 'reserved_waiting'
    ? `<button class="btn-primary" id="btn-checkin">▶ Confirmer arrivée</button>
       <button class="btn-danger"  id="btn-absent">✕ Marquer absent·e</button>`
    : `<button class="btn-danger" id="btn-depart">↩ Marquer départ</button>`;

  _dialog().innerHTML = `
    <div class="modal-header">
      <h3>${spotId} — ${resa.prenom} ${resa.nom}${doubleLabel}</h3>
      <button class="modal-close" id="modal-close">✕</button>
    </div>
    <div class="modal-body" id="spot-detail-body">
      <div class="spot-detail">
        <div class="detail-row"><span class="detail-label">Emplacement</span><span class="detail-value">${spotId}</span></div>
        <div class="detail-row"><span class="detail-label">Nom</span><span class="detail-value">${resa.prenom} ${resa.nom}</span></div>
        <div class="detail-row detail-row-editable" id="accomp-row" title="Cliquer pour modifier"><span class="detail-label">Accompagnants</span><span class="detail-value">${accompLabel} <span class="edit-hint">✏️</span></span></div>
        <div class="detail-row"><span class="detail-label">Type</span><span class="detail-value">${resa.type === 'walkin' ? 'Sans réservation' : 'Avec réservation'}${doubleLabel}</span></div>
        ${timerHtml}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" id="btn-profil">👤 Profil</button>
      <button class="btn-secondary" id="modal-cancel">Fermer</button>
      ${actionBtns}
    </div>
  `;

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  _bindProfilBtn('spot-detail-body', 'btn-profil', history || []);
  if (callbacks.onUpdateAccompagnants) {
    document.getElementById('accomp-row').addEventListener('click', () =>
      _inlineEditAccompagnants('accomp-row', resa.accompagnants, callbacks.onUpdateAccompagnants)
    , { once: true });
  }

  if (resa.status === 'reserved_waiting') {
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
  const accompLabel = resa.accompagnants === 0 ? 'Seul·e'
    : resa.accompagnants === 1 ? '1 accompagnant' : '2 accompagnants';

  const fmt = ts => {
    if (!ts) return '—';
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2,'0')}h${String(d.getMinutes()).padStart(2,'0')}`;
  };

  let dureeStr = '—';
  if (resa.checkinTime && resa.departTime) {
    const ms = resa.departTime - resa.checkinTime;
    const h  = Math.floor(ms / 3600000);
    const m  = Math.floor((ms % 3600000) / 60000);
    dureeStr = h > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${m} min`;
  }

  const typeLabel = resa.type === 'walkin' ? 'Sans réservation' : 'Avec réservation';
  const doubleLabel = resa.durationMs && resa.durationMs > 105 * 60 * 1000 ? ' · double créneau' : '';

  _dialog().innerHTML = `
    <div class="modal-header">
      <h3>↩ ${resa.prenom} ${resa.nom}</h3>
      <button class="modal-close" id="modal-close">✕</button>
    </div>
    <div class="modal-body" id="departed-body">
      <div class="spot-detail">
        <div class="detail-row"><span class="detail-label">Emplacement</span><span class="detail-value">${spotId}</span></div>
        <div class="detail-row"><span class="detail-label">Accompagnants</span><span class="detail-value">${accompLabel}</span></div>
        <div class="detail-row"><span class="detail-label">Type</span><span class="detail-value">${typeLabel}${doubleLabel}</span></div>
        <div class="detail-row"><span class="detail-label">Arrivée</span><span class="detail-value">${fmt(resa.checkinTime)}</span></div>
        <div class="detail-row"><span class="detail-label">Départ</span><span class="detail-value">${fmt(resa.departTime)}</span></div>
        <div class="detail-row"><span class="detail-label">Temps sur la plage</span><span class="detail-value">${dureeStr}</span></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="modal-cancel">Fermer</button>
      <button class="btn-primary" id="btn-profil">👤 Voir le profil</button>
    </div>
  `;

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  _bindProfilBtn('departed-body', 'btn-profil', history || []);

  _dialog().showModal();
}

// ── Modale 6 : Détail d'une personne en liste d'attente ──
// callbacks : { onUpdateAccompagnants }
function openWaitingDetailModal(resa, history, callbacks) {
  callbacks = callbacks || {};
  const accompLabel = resa.accompagnants === 0 ? 'Seul·e'
    : resa.accompagnants === 1 ? '1 accompagnant' : '2 accompagnants';
  const statusLabel = resa.status === 'pas_venu' ? 'Pas venu·e'
    : resa.status === 'annule' ? 'Annulé·e' : 'En attente';

  _dialog().innerHTML = `
    <div class="modal-header">
      <h3>⏳ ${resa.prenom} ${resa.nom}</h3>
      <button class="modal-close" id="modal-close">✕</button>
    </div>
    <div class="modal-body" id="waiting-detail-body">
      <div class="spot-detail">
        <div class="detail-row"><span class="detail-label">Nom</span><span class="detail-value">${resa.prenom} ${resa.nom}</span></div>
        <div class="detail-row detail-row-editable" id="accomp-row" title="Cliquer pour modifier"><span class="detail-label">Accompagnants</span><span class="detail-value">${accompLabel} <span class="edit-hint">✏️</span></span></div>
        <div class="detail-row"><span class="detail-label">Statut</span><span class="detail-value">${statusLabel}</span></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" id="btn-profil">👤 Profil</button>
      <button class="btn-secondary" id="modal-cancel">Fermer</button>
    </div>
  `;

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  _bindProfilBtn('waiting-detail-body', 'btn-profil', history || []);
  if (callbacks.onUpdateAccompagnants) {
    document.getElementById('accomp-row').addEventListener('click', () =>
      _inlineEditAccompagnants('accomp-row', resa.accompagnants, callbacks.onUpdateAccompagnants)
    , { once: true });
  }

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
    ? `<button class="btn-ghost" id="btn-go-live">&#9654; Vue live</button>` : '';

  _dialog().innerHTML = `
    <div class="modal-header">
      <h3>${titleLabel}</h3>
      <button class="modal-close" id="modal-close">✕</button>
    </div>
    <div class="modal-body plan-modal-body">
      <!-- Formulaire d'ajout inline -->
      <div class="plan-inline-form">
        <div class="plan-form-row">
          <div style="position:relative;display:flex;gap:8px">
            <div class="plan-form-group">
              <label>Nom</label>
              <input type="text" id="pf-nom" placeholder="NOM" autocomplete="off" style="text-transform:uppercase">
            </div>
            <div class="plan-form-group">
              <label>Prénom</label>
              <input type="text" id="pf-prenom" placeholder="Prénom" autocomplete="off">
            </div>
            <div id="pf-nom-suggest" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #ccc;border-radius:4px;z-index:200;max-height:200px;overflow-y:auto;box-shadow:0 2px 8px rgba(0,0,0,.2)"></div>
          </div>
          <div class="plan-form-group">
            <label>Acc.</label>
            <div class="radio-group radio-sm" id="pf-accomp">
              <div class="radio-btn selected" data-value="0">0</div>
              <div class="radio-btn" data-value="1">1</div>
              <div class="radio-btn" data-value="2">2</div>
            </div>
          </div>
          <div class="plan-form-group">
            <label>Type</label>
            <div class="radio-group radio-sm" id="pf-type">
              <div class="radio-btn selected" data-value="normal">Usager</div>
              <div class="radio-btn" data-value="groupe">Groupe</div>
            </div>
          </div>
          <button class="btn-primary" id="pf-add" style="align-self:flex-end">＋ Ajouter</button>
        </div>
        <div id="pf-error" style="color:var(--red);font-size:11px;min-height:14px"></div>
      </div>
      <!-- Listes côte à côte -->
      <div class="plan-lists">
        <div class="plan-section">
          <div class="plan-section-hd">
            <span class="plan-section-title">👤 Réservations</span>
            <span class="plan-section-cap" id="cap-normal"></span>
          </div>
          <div id="planning-list-normal"></div>
        </div>
        <div class="plan-section-sep"></div>
        <div class="plan-section">
          <div class="plan-section-hd">
            <span class="plan-section-title">👥 Groupes</span>
            <span class="plan-section-cap" id="cap-groupe"></span>
          </div>
          <div id="planning-list-groupe"></div>
        </div>
      </div>
      <!-- Personnes sans réservation (walk-ins du jour) -->
      <div id="plan-walkins-section" style="display:none" class="plan-walkins-section">
        <div class="plan-section-hd" style="padding:10px 16px 4px">
          <span class="plan-section-title">🚶 Sans réservation</span>
          <span class="plan-section-cap" id="cap-walkins"></span>
        </div>
        <div id="planning-list-walkins" style="padding:0 16px 10px;display:flex;flex-direction:column;gap:4px"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-ghost" id="btn-export-pdf">📄 Exporter PDF</button>
      ${goLiveBtn}
      <button class="btn-secondary" id="modal-cancel">Fermer</button>
    </div>
  `;

  function _fmtCheckinTime(ts) {
    const d = new Date(ts);
    return String(d.getHours()).padStart(2,'0') + 'h' + String(d.getMinutes()).padStart(2,'0');
  }

  function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _openProfilePanel(inscriptionId, nom, prenom) {
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
    const pending = all.filter(r => resaType === 'normal'
      ? (!r.resaType || r.resaType === 'normal')
      : r.resaType === 'groupe');

    const arrived = resaType === 'normal'
      ? Object.entries(spotsMap)
              .filter(([, r]) => r.type === 'reserved')
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

    if (total === 0) {
      listEl.innerHTML = '<div class="planning-empty">Aucune réservation</div>';
      return;
    }

    const pendingHtml = pending.map(r => {
      const acc = r.accompagnants === 0 ? 'seul·e'
        : r.accompagnants === 1 ? '1 acc.' : r.accompagnants + ' acc.';
      const insc = (typeof getCachedInscriptions === 'function' && r.inscriptionId)
        ? getCachedInscriptions().find(i => i.id === r.inscriptionId) : null;
      const passTag = (insc && insc.pass && insc.pass.actif)
        ? ' <span style="font-size:11px;color:#1565c0;font-weight:600">🎫 Pass 2026</span>' : '';
      return '<div class="planning-list-item">'
        + '<span class="plan-name-link" data-insc-id="' + _esc(r.inscriptionId || '') + '" data-nom="' + _esc(r.nom) + '" data-prenom="' + _esc(r.prenom) + '" >' + r.nom + ' ' + r.prenom + ' — ' + acc + passTag + '</span>'
        + '<button class="btn-remove" data-id="' + r.id + '">✕</button>'
        + '</div>';
    }).join('');

    const arrivedHtml = arrived.map(r => {
      const acc  = r.accompagnants === 0 ? 'seul·e'
        : r.accompagnants === 1 ? '1 acc.' : r.accompagnants + ' acc.';
      const time = r.checkinTime ? ' · ' + _fmtCheckinTime(r.checkinTime) : '';
      return '<div class="planning-list-item planning-list-present">'
        + '<span class="plan-name-link" data-insc-id="' + _esc(r.inscriptionId || '') + '" data-nom="' + _esc(r.nom) + '" data-prenom="' + _esc(r.prenom) + '" >✓ ' + r.prenom + ' ' + r.nom + ' — ' + acc + ' (' + r._spotId + ')' + time + '</span>'
        + '</div>';
    }).join('');

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
        _openProfilePanel(span.dataset.inscId, span.dataset.nom, span.dataset.prenom);
      });
    });
  }

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
      const acc = r.accompagnants === 0 ? 'seul·e'
        : r.accompagnants === 1 ? '1 acc.' : r.accompagnants + ' acc.';
      return '<div class="planning-list-item">'
        + '<span class="plan-name-link" data-insc-id="' + _esc(r.inscriptionId || '') + '" data-nom="' + _esc(r.nom) + '" data-prenom="' + _esc(r.prenom) + '" >' + r.prenom + ' ' + r.nom + ' — ' + acc + ' (' + spotId + ')</span>'
        + '</div>';
    }).join('');
    listEl.querySelectorAll('.plan-name-link').forEach(function(span) {
      span.addEventListener('click', function() {
        _openProfilePanel(span.dataset.inscId, span.dataset.nom, span.dataset.prenom);
      });
    });
  }

  async function _refreshAll() {
    await Promise.all([
      _refreshSection('normal', 'planning-list-normal', 'cap-normal', CAPACITY_NORMAL),
      _refreshSection('groupe', 'planning-list-groupe', 'cap-groupe', CAPACITY_GROUPE),
      _refreshWalkins(),
    ]);
  }

  _bindRadioGroup('pf-accomp');
  _bindRadioGroup('pf-type');

  document.getElementById('pf-prenom').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\b\w/g, c => c.toUpperCase());
  });

  // Autocomplete NOM depuis les inscriptions
  var _linkedPfInscriptionId = null;
  (function() {
    var nomEl     = document.getElementById('pf-nom');
    var prenomEl  = document.getElementById('pf-prenom');
    var suggestEl = document.getElementById('pf-nom-suggest');

    function _close() { suggestEl.style.display = 'none'; suggestEl.innerHTML = ''; }

    nomEl.addEventListener('input', function() {
      _linkedPfInscriptionId = null; // frappe manuelle → efface le lien
      var val = nomEl.value.trim().toUpperCase();
      _close();
      if (!val || typeof getCachedInscriptions !== 'function') return;
      var matches = getCachedInscriptions()
        .filter(function(i) { return i.nom && i.nom.toUpperCase().startsWith(val); })
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
        nameSpan.innerHTML = '<strong>' + i.nom.toUpperCase() + '</strong> ' + i.prenom;
        item.appendChild(nameSpan);
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
    });

    nomEl.addEventListener('blur',    function() { setTimeout(_close, 150); });
    nomEl.addEventListener('keydown', function(e) { if (e.key === 'Escape') _close(); });
  })();

  document.getElementById('pf-add').addEventListener('click', async () => {
    const prenom = document.getElementById('pf-prenom').value.trim();
    const nom    = document.getElementById('pf-nom').value.trim().toUpperCase();
    const accompagnants = parseInt(document.querySelector('#pf-accomp .radio-btn.selected').dataset.value);
    const resaType      = document.querySelector('#pf-type .radio-btn.selected').dataset.value;
    const errEl = document.getElementById('pf-error');

    if (!prenom || !nom) {
      errEl.textContent = 'Prénom et nom sont obligatoires.';
      return;
    }

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
    try {
      await callbacks.onAdd({ nom, prenom, accompagnants, resaType, inscriptionId: _linkedPfInscriptionId });
      _linkedPfInscriptionId = null;
      document.getElementById('pf-prenom').value = '';
      document.getElementById('pf-nom').value    = '';
      document.getElementById('pf-nom').focus();
      await _refreshAll();
    } catch (e) {
      console.error(e);
    }
  });

  // Ajouter au "Enter" sur les champs texte
  ['pf-prenom', 'pf-nom'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('pf-add').click();
    });
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('btn-export-pdf').addEventListener('click', () => exportSlotPDF(dateISO, slot).catch(console.error));

  if (callbacks.onGoLive) {
    document.getElementById('btn-go-live').addEventListener('click', () => { closeModal(); callbacks.onGoLive(); });
  }

  _dialog().classList.add('plan-dialog');
  _dialog().showModal();
  document.getElementById('pf-prenom').focus();
  _refreshAll(); // fire-and-forget async — modal is already open
}

if (typeof module !== 'undefined') {
  module.exports = { openAddReservationModal, openAssignSpotModal, openCheckinModal, openSpotDetailModal, openDepartedModal, openWaitingDetailModal, openSlotPlanningModal, closeModal };
}
