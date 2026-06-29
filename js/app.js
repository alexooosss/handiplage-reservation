'use strict';

const App = (() => {
  let _selectedSlotId = null;
  let _date = null;
  let _selectionMode = null; // { index, resa } | null

  function init() {
    _date = getTodayISO();
    _renderHeader();
    _renderClock();
    setInterval(_renderClock, 1000);

    const active   = getActiveSlot(new Date());
    const upcoming = SLOTS.find(s => getSlotStatus(s, new Date()) === 'upcoming');
    const defaultSlot = active || upcoming || SLOTS[0];
    selectSlot(defaultSlot.id);

    setInterval(refresh, 30000);
  }

  function selectSlot(slotId) {
    _selectedSlotId = slotId;
    document.querySelectorAll('.slot-pill').forEach(el => {
      el.classList.toggle('selected-slot', parseInt(el.dataset.slotId) === slotId);
    });
    refresh();
  }

  function refresh() {
    if (!_selectedSlotId) return;
    const reservations = getReservations(_date, _selectedSlotId);
    const waitingList  = getReservationList(_date, _selectedSlotId);
    const slot         = getSlotById(_selectedSlotId);
    const mapEl        = document.getElementById('beach-map');
    const panelEl      = document.getElementById('side-panel');
    const freeSpots    = BEACH_CONFIG.spots
      .filter(s => !reservations[s.id] || reservations[s.id].status === 'free')
      .map(s => s.id);

    const mapHandler = _selectionMode
      ? spotId => _doAssignSpot(spotId, reservations, freeSpots)
      : spotId => _onSpotClick(spotId, reservations, freeSpots);
    renderMapSpots(mapEl, reservations, mapHandler, !!_selectionMode);

    // Bandeau de sélection
    const banner = document.getElementById('selection-banner');
    if (_selectionMode) {
      banner.style.display = 'flex';
      banner.innerHTML = `
        <span class="banner-text">👆 Cliquez sur un emplacement libre pour <strong>${_selectionMode.resa.nom} ${_selectionMode.resa.prenom}</strong></span>
        <button class="btn-cancel-selection" id="btn-cancel-sel">✕ Annuler</button>
      `;
      document.getElementById('btn-cancel-sel').addEventListener('click', () => {
        _selectionMode = null;
        refresh();
      });
    } else {
      banner.style.display = 'none';
    }

    renderPanel(panelEl, slot, reservations, waitingList, {
      onAddReservation: () => _openAddReservation(),
      onWalkin:         () => _openWalkin(freeSpots),
      onAssign:         (index, resa) => _openAssign(index, resa, freeSpots),
      onItemClick:      spotId => _onSpotClick(spotId, reservations, freeSpots),
      onDepartedClick:  spotId => openDepartedModal(spotId, reservations[spotId], _buildProfileHistory(reservations[spotId])),
      onWaitingClick:   index  => openWaitingDetailModal(waitingList[index], _buildProfileHistory(waitingList[index])),
      onPasVenu:        index => { updateReservationStatus(_date, _selectedSlotId, index, 'pas_venu'); refresh(); },
      onAnnule:         index => { updateReservationStatus(_date, _selectedSlotId, index, 'annule');   refresh(); },
    });
  }

  // ── Spot click (carte ou liste) ──
  function _onSpotClick(spotId, reservations, freeSpots) {
    const resa = reservations[spotId];
    if (!resa || resa.status === 'free') {
      // Place libre — walk-in direct
      _openWalkin(freeSpots, spotId);
    } else {
      openSpotDetailModal(spotId, resa, {
        onCheckin: id => {
          const resas = getReservations(_date, _selectedSlotId);
          resas[id].checkinTime = Date.now();
          resas[id].status = 'present';
          saveCheckin(_date, _selectedSlotId, id, resas[id]);
          refresh();
        },
        onDepart: id => {
          updateStatus(_date, _selectedSlotId, id, 'departed', { departTime: Date.now() });
          refresh();
        },
        onAbsent: id => {
          updateStatus(_date, _selectedSlotId, id, 'absent');
          refresh();
        },
      }, _buildProfileHistory(resa));
    }
  }

  // ── Ajouter une réservation à la liste d'attente ──
  function _openAddReservation() {
    openAddReservationModal(data => {
      addReservation(_date, _selectedSlotId, data);
      refresh();
    });
  }

  // ── Arrivée sans réservation (walk-in) ──
  function _openWalkin(freeSpots, preselectedSpotId) {
    openCheckinModal(freeSpots, preselectedSpotId, (spotId, data) => {
      const checkinData = { ...data, durationMs: DURATION_MS };
      saveCheckin(_date, _selectedSlotId, spotId, checkinData);
      _registerOverflow(spotId, checkinData);
      refresh();
    });
  }

  // Inscrit la personne dans tous les créneaux suivants dont le début est
  // avant la fin de son temps (débordement horaire)
  function _registerOverflow(spotId, checkinData) {
    const endTime = checkinData.checkinTime + checkinData.durationMs;
    SLOTS.forEach(slot => {
      if (slot.id <= _selectedSlotId) return;
      const [h, m] = slot.start.split(':').map(Number);
      const slotStart = new Date();
      slotStart.setHours(h, m, 0, 0);
      if (slotStart.getTime() < endTime) {
        saveCheckin(_date, slot.id, spotId, { ...checkinData });
      }
    });
  }

  // ── Assigner un emplacement à une personne de la liste d'attente ──
  function _openAssign(index, resa, freeSpots) {
    _selectionMode = { index, resa };
    refresh();
  }

  function _doAssignSpot(spotId, reservations, freeSpots) {
    const resa = reservations[spotId];
    // Ignorer si le spot n'est pas libre
    if (resa && resa.status !== 'free' && resa.status !== 'departed') return;

    const { index, resa: waitingResa } = _selectionMode;
    _selectionMode = null;

    const isDouble   = _detectDoubleSlot(waitingResa.nom, waitingResa.prenom);
    const durationMs = isDouble ? DURATION_MS_DOUBLE : DURATION_MS;
    const checkinTime = Date.now();
    const checkinData = {
      nom: waitingResa.nom,
      prenom: waitingResa.prenom,
      accompagnants: waitingResa.accompagnants,
      type: 'reserved',
      checkinTime,
      durationMs,
      status: 'present',
    };

    saveCheckin(_date, _selectedSlotId, spotId, checkinData);
    removeReservation(_date, _selectedSlotId, index);

    // Si double réservation, retirer de la liste d'attente du créneau suivant
    if (isDouble) {
      const nextSlotId = _selectedSlotId + 1;
      const nextList = getReservationList(_date, nextSlotId);
      const nextIdx = nextList.findIndex(r =>
        r.nom.toUpperCase()    === waitingResa.nom.toUpperCase() &&
        r.prenom.toUpperCase() === waitingResa.prenom.toUpperCase()
      );
      if (nextIdx !== -1) removeReservation(_date, nextSlotId, nextIdx);
    }

    // Propager sur les créneaux suivants si le temps déborde
    _registerOverflow(spotId, checkinData);

    refresh();
  }

  // Retourne l'historique du jour d'une personne : spots assignés + présences en liste d'attente
  function _buildProfileHistory(resa) {
    if (!resa) return [];
    const nom    = resa.nom.toUpperCase();
    const prenom = resa.prenom.toUpperCase();
    const result = [];
    SLOTS.forEach(slot => {
      // Spots assignés
      const resas = getReservations(_date, slot.id);
      Object.entries(resas).forEach(([sid, r]) => {
        if (r.nom?.toUpperCase() === nom && r.prenom?.toUpperCase() === prenom) {
          result.push({ slot, spotId: sid, resa: r });
        }
      });
      // Liste d'attente (si pas déjà trouvé dans les spots de ce créneau)
      const alreadyInSlot = result.some(e => e.slot.id === slot.id);
      if (!alreadyInSlot) {
        const list = getReservationList(_date, slot.id);
        const found = list.find(r => r.nom?.toUpperCase() === nom && r.prenom?.toUpperCase() === prenom);
        if (found) result.push({ slot, spotId: null, resa: { ...found, status: found.status || 'reserved_waiting' } });
      }
    });
    return result;
  }

  // Retourne true si la même personne (NOM+Prénom) est dans la liste du créneau suivant
  function _detectDoubleSlot(nom, prenom) {
    if (_selectedSlotId >= 5) return false;
    const nextList = getReservationList(_date, _selectedSlotId + 1);
    return nextList.some(r =>
      r.nom.toUpperCase()    === nom.toUpperCase() &&
      r.prenom.toUpperCase() === prenom.toUpperCase()
    );
  }

  // ── Header & horloge ──
  function _renderHeader() {
    const nav = document.getElementById('slots-nav');
    nav.innerHTML = SLOTS.map(slot => {
      const status = getSlotStatus(slot, new Date());
      return `<div class="slot-pill" data-slot-id="${slot.id}" data-status="${status}">${slot.label.split(' – ')[0]}</div>`;
    }).join('');
    nav.querySelectorAll('.slot-pill').forEach(el => {
      el.addEventListener('click', () => {
        if (el.dataset.status !== 'past') selectSlot(parseInt(el.dataset.slotId));
      });
    });
    const d = new Date();
    document.getElementById('date-label').textContent =
      d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function _renderClock() {
    const d = new Date();
    document.getElementById('clock').textContent =
      `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  return { init, selectSlot, refresh };
})();

document.addEventListener('DOMContentLoaded', () => {
  const mapEl = document.getElementById('beach-map');
  renderMapStatic(mapEl);
  App.init();
});
