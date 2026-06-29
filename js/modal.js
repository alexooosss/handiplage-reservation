'use strict';

const _dialog = () => document.getElementById('app-modal');

function closeModal() {
  _dialog().close();
}

// ── Modale 1 : Ajouter une réservation à la liste d'attente ──
// Appelée avant l'arrivée de la personne (saisie anticipée)
// onConfirm({ nom, prenom, accompagnants })
function openAddReservationModal(onConfirm) {
  _dialog().innerHTML = `
    <div class="modal-header">
      <h3>＋ Ajouter une réservation</h3>
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
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="modal-cancel">Annuler</button>
      <button class="btn-primary"   id="modal-confirm">✓ Enregistrer</button>
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
    const accompagnants = parseInt(
      document.querySelector('#f-accompagnants .radio-btn.selected').dataset.value
    );
    if (!prenom || !nom) {
      alert('Prénom et nom sont obligatoires.');
      return;
    }
    closeModal();
    onConfirm({ nom, prenom, accompagnants });
  });

  _dialog().showModal();
  document.getElementById('f-prenom').focus();
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
    );
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
    );
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
// callbacks : { onAdd, onRemove(index), onGoLive } (onGoLive=null si pas aujourd'hui)
function openSlotPlanningModal(dateISO, slot, callbacks) {
  // Format date label: "Lundi 23 juin"
  const d = new Date(dateISO + 'T00:00:00');
  const dateLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const titleLabel = `${slot.label} · ${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}`;

  const goLiveBtn = callbacks.onGoLive
    ? `<button class="btn-ghost" id="btn-go-live">&#9654; Vue live</button>`
    : '';

  _dialog().innerHTML = `
    <div class="modal-header">
      <h3>${titleLabel}</h3>
      <button class="modal-close" id="modal-close">✕</button>
    </div>
    <div class="modal-body">
      <div id="planning-list"></div>
    </div>
    <div class="modal-footer">
      ${goLiveBtn}
      <button class="btn-secondary" id="modal-cancel">Fermer</button>
      <button class="btn-primary"   id="btn-plan-add">＋ Ajouter</button>
    </div>
  `;

  function _refreshPlanningList() {
    const list = getReservationList(dateISO, slot.id);
    const listEl = document.getElementById('planning-list');
    if (!listEl) return;
    if (list.length === 0) {
      listEl.innerHTML = `<div class="planning-empty">Aucune réservation</div>`;
      return;
    }
    listEl.innerHTML = list.map((r, i) => {
      const accompStr = r.accompagnants === 0 ? 'seul·e'
        : r.accompagnants === 1 ? '1 accompagnant' : `${r.accompagnants} accompagnants`;
      return `
        <div class="planning-list-item">
          <span>${r.nom} ${r.prenom} — ${accompStr}</span>
          <button class="btn-remove" data-index="${i}">✕</button>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        callbacks.onRemove(idx);
        _refreshPlanningList();
      });
    });
  }

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  document.getElementById('btn-plan-add').addEventListener('click', () => {
    openAddReservationModal(data => {
      callbacks.onAdd(data);
      _refreshPlanningList();
    });
  });

  if (callbacks.onGoLive) {
    document.getElementById('btn-go-live').addEventListener('click', () => {
      closeModal();
      callbacks.onGoLive();
    });
  }

  _refreshPlanningList();
  _dialog().showModal();
}

if (typeof module !== 'undefined') {
  module.exports = { openAddReservationModal, openAssignSpotModal, openCheckinModal, openSpotDetailModal, openDepartedModal, openWaitingDetailModal, openSlotPlanningModal, closeModal };
}
