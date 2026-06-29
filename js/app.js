'use strict';

const App = (() => {
  let _selectedSlotId = null;
  let _date = null;

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

    renderMapSpots(mapEl, reservations, spotId => _onSpotClick(spotId, reservations, freeSpots));

    renderPanel(panelEl, slot, reservations, waitingList, {
      onAddReservation: () => _openAddReservation(),
      onWalkin:         () => _openWalkin(freeSpots),
      onAssign:         (index, resa) => _openAssign(index, resa, freeSpots),
      onItemClick:      spotId => _onSpotClick(spotId, reservations, freeSpots),
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
          updateStatus(_date, _selectedSlotId, id, 'departed');
          refresh();
        },
        onAbsent: id => {
          updateStatus(_date, _selectedSlotId, id, 'absent');
          refresh();
        },
      });
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
      saveCheckin(_date, _selectedSlotId, spotId, { ...data, durationMs: DURATION_MS });
      refresh();
    });
  }

  // ── Assigner un emplacement à une personne de la liste d'attente ──
  function _openAssign(index, resa, freeSpots) {
    openAssignSpotModal(resa, freeSpots, spotId => {
      const isDouble = _detectDoubleSlot(resa.nom, resa.prenom);
      const durationMs = isDouble ? DURATION_MS_DOUBLE : DURATION_MS;
      const checkinTime = Date.now();

      const checkinData = {
        nom: resa.nom,
        prenom: resa.prenom,
        accompagnants: resa.accompagnants,
        type: 'reserved',
        checkinTime,
        durationMs,
        status: 'present',
      };

      // Sauvegarder dans le créneau courant
      saveCheckin(_date, _selectedSlotId, spotId, checkinData);
      removeReservation(_date, _selectedSlotId, index);

      if (isDouble) {
        const nextSlotId = _selectedSlotId + 1;
        // Sauvegarder aussi dans le créneau suivant (même emplacement, même timer)
        saveCheckin(_date, nextSlotId, spotId, { ...checkinData });
        // Retirer de la liste d'attente du créneau suivant
        const nextList = getReservationList(_date, nextSlotId);
        const nextIdx = nextList.findIndex(r =>
          r.nom.toUpperCase() === resa.nom.toUpperCase() &&
          r.prenom.toUpperCase() === resa.prenom.toUpperCase()
        );
        if (nextIdx !== -1) removeReservation(_date, nextSlotId, nextIdx);
      }

      refresh();
    });
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
