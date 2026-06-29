'use strict';

const App = (() => {
  let _selectedSlotId = null;
  let _date = null;

  function init() {
    _date = getTodayISO();
    _renderHeader();
    _renderClock();
    setInterval(_renderClock, 1000);

    // Sélectionner le créneau actif, ou le premier à venir, ou le premier
    const active   = getActiveSlot(new Date());
    const upcoming = SLOTS.find(s => getSlotStatus(s, new Date()) === 'upcoming');
    const defaultSlot = active || upcoming || SLOTS[0];
    selectSlot(defaultSlot.id);

    // Rafraîchissement toutes les 30 secondes
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
    const slot = getSlotById(_selectedSlotId);
    const mapEl   = document.getElementById('beach-map');
    const panelEl = document.getElementById('side-panel');
    const freeSpots = BEACH_CONFIG.spots
      .filter(s => !reservations[s.id] || reservations[s.id].status === 'free')
      .map(s => s.id);

    renderMapSpots(mapEl, reservations, spotId => _onSpotClick(spotId, reservations, freeSpots));
    renderPanel(panelEl, slot, reservations,
      () => _openCheckin(freeSpots),
      spotId => _onSpotClick(spotId, reservations, freeSpots)
    );
  }

  function _onSpotClick(spotId, reservations, freeSpots) {
    const resa = reservations[spotId];
    if (!resa || resa.status === 'free') {
      _openCheckin(freeSpots, spotId);
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
          updateStatus(_date, _selectedSlotId, id, 'free');
          refresh();
        },
        onAbsent: id => {
          updateStatus(_date, _selectedSlotId, id, 'absent');
          refresh();
        },
      });
    }
  }

  function _openCheckin(freeSpots, preselectedSpotId) {
    const resas = getReservations(_date, _selectedSlotId);
    const reservedCount = Object.values(resas).filter(r => r.type === 'reserved' && r.status !== 'absent').length;

    openCheckinModal(freeSpots, preselectedSpotId, (spotId, data) => {
      if (data.type === 'reserved' && reservedCount >= 25) {
        alert('Limite atteinte : 25 réservations maximum par créneau.\nEnregistrement possible en accès libre (sans réservation) uniquement.');
        return;
      }
      saveCheckin(_date, _selectedSlotId, spotId, data);
      refresh();
    });
  }

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
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    document.getElementById('clock').textContent = `${h}:${m}`;
  }

  return { init, selectSlot, refresh };
})();

document.addEventListener('DOMContentLoaded', () => {
  const mapEl = document.getElementById('beach-map');
  renderMapStatic(mapEl);
  App.init();
});
