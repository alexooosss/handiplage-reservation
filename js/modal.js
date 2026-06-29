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

// ── Modale 4 : Détail d'un emplacement occupé ──
// callbacks : { onCheckin, onDepart, onAbsent }
function openSpotDetailModal(spotId, resa, callbacks) {
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
    <div class="modal-body">
      <div class="spot-detail">
        <div class="detail-row"><span class="detail-label">Emplacement</span><span class="detail-value">${spotId}</span></div>
        <div class="detail-row"><span class="detail-label">Nom</span><span class="detail-value">${resa.prenom} ${resa.nom}</span></div>
        <div class="detail-row"><span class="detail-label">Accompagnants</span><span class="detail-value">${accompLabel}</span></div>
        <div class="detail-row"><span class="detail-label">Type</span><span class="detail-value">${resa.type === 'walkin' ? 'Sans réservation' : 'Avec réservation'}${doubleLabel}</span></div>
        ${timerHtml}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="modal-cancel">Fermer</button>
      ${actionBtns}
    </div>
  `;

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  if (resa.status === 'reserved_waiting') {
    document.getElementById('btn-checkin').addEventListener('click', () => { closeModal(); callbacks.onCheckin && callbacks.onCheckin(spotId); });
    document.getElementById('btn-absent').addEventListener('click', () => { closeModal(); callbacks.onAbsent && callbacks.onAbsent(spotId); });
  } else {
    document.getElementById('btn-depart').addEventListener('click', () => { closeModal(); callbacks.onDepart && callbacks.onDepart(spotId); });
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

if (typeof module !== 'undefined') {
  module.exports = { openAddReservationModal, openAssignSpotModal, openCheckinModal, openSpotDetailModal, closeModal };
}
