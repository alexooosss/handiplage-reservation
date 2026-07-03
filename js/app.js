'use strict';

const App = (() => {
  let _selectedSlotId = null;
  let _date = null;
  let _selectionMode = null; // { id, resa } | null
  let _currentView = 'carte'; // 'carte' | 'planning' | 'mc' | 'inscription'
  let _planningWeekOffset = 0;
  let _mcDate = null;

  function init() {
    _date   = getTodayISO();
    _mcDate = _date;
    _renderHeader();
    _renderClock();
    setInterval(_renderClock, 1000);

    // Préchargement inscriptions (pour autocomplete pass)
    if (typeof getInscriptions === 'function') {
      getInscriptions().catch(function(err) { console.warn('Preload inscriptions:', err); });
    }

    // Realtime : s'abonner aux inscriptions
    if (typeof subscribeInscriptions === 'function') {
      subscribeInscriptions(function() {
        getInscriptions().catch(function() {});
        if (_currentView === 'inscription') _renderInscription();
      });
    }

    const active   = getActiveSlot(new Date());
    const upcoming = SLOTS.find(s => getSlotStatus(s, new Date()) === 'upcoming');
    const defaultSlot = active || upcoming || SLOTS[0];
    selectSlot(defaultSlot.id);

    setInterval(refresh, 30000);

    // Planning tab button
    const btnPlanning = document.getElementById('btn-planning-tab');
    if (btnPlanning) {
      btnPlanning.addEventListener('click', () => {
        showView(_currentView === 'planning' ? 'carte' : 'planning');
      });
    }

    // Main courante tab button
    const btnMc = document.getElementById('btn-mc-tab');
    if (btnMc) {
      btnMc.addEventListener('click', () => {
        showView(_currentView === 'mc' ? 'carte' : 'mc');
      });
    }

    // Inscription tab button
    const btnInsc = document.getElementById('btn-insc-tab');
    if (btnInsc) {
      btnInsc.addEventListener('click', () => {
        showView(_currentView === 'inscription' ? 'carte' : 'inscription');
      });
    }
  }

  function showView(view) {
    _currentView = view;
    const beachPanel   = document.getElementById('beach-panel');
    const sidePanel    = document.getElementById('side-panel');
    const planningView = document.getElementById('planning-view');
    const mcView       = document.getElementById('mc-view');
    const inscView     = document.getElementById('insc-view');
    const btnPlanning  = document.getElementById('btn-planning-tab');
    const btnMc        = document.getElementById('btn-mc-tab');
    const btnInsc      = document.getElementById('btn-insc-tab');

    // Masquer tout
    if (beachPanel)   beachPanel.style.display   = 'none';
    if (sidePanel)    sidePanel.style.display     = 'none';
    if (planningView) planningView.style.display  = 'none';
    if (mcView)       mcView.style.display        = 'none';
    if (inscView)     inscView.style.display      = 'none';
    if (btnPlanning)  btnPlanning.classList.remove('active');
    if (btnMc)        btnMc.classList.remove('active');
    if (btnInsc)      btnInsc.classList.remove('active');

    if (view === 'planning') {
      if (planningView) planningView.style.display = 'flex';
      if (btnPlanning)  btnPlanning.classList.add('active');
      _renderPlanning().catch(console.error);
    } else if (view === 'mc') {
      if (mcView) mcView.style.display = 'flex';
      if (btnMc)  btnMc.classList.add('active');
      _renderMc().catch(console.error);
    } else if (view === 'inscription') {
      if (inscView) inscView.style.display = 'flex';
      if (btnInsc)  btnInsc.classList.add('active');
      _renderInscription().catch(console.error);
    } else {
      if (beachPanel) beachPanel.style.display = '';
      if (sidePanel)  sidePanel.style.display  = '';
    }
  }

  function _mcDateOffset(iso, delta) {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    return d.toISOString().slice(0, 10);
  }

  async function _renderInscription() {
    const container = document.getElementById('insc-view');
    if (!container) return;
    await renderInscription(container);
  }

  async function _renderMc() {
    const container = document.getElementById('mc-view');
    if (!container) return;
    if (!_mcDate) _mcDate = _date;
    container._onMcPrev  = () => { _mcDate = _mcDateOffset(_mcDate, -1); _renderMc(); };
    container._onMcNext  = () => { const next = _mcDateOffset(_mcDate, +1); if (next <= _date) { _mcDate = next; _renderMc(); } };
    container._onMcToday = () => { _mcDate = _date; _renderMc(); };
    container._onMcGoto  = d  => { _mcDate = d; _renderMc(); };
    await renderMc(container, _mcDate);
  }

  async function _renderPlanning() {
    const container = document.getElementById('planning-view');
    if (!container) return;
    container._onPrev = () => { _planningWeekOffset--; _renderPlanning(); };
    container._onNext = () => { _planningWeekOffset++; _renderPlanning(); };
    await renderPlanning(container, _planningWeekOffset, async (dateISO, slot) => {
      const isToday = dateISO === _date;
      openSlotPlanningModal(dateISO, slot, {
        onAdd:    async data => { await addReservation(dateISO, slot.id, data); await _renderPlanning(); },
        onRemove: async id   => { await removeReservation(id); await _renderPlanning(); },
        onGoLive: isToday ? () => { showView('carte'); selectSlot(slot.id); } : null,
      });
    });
  }

  function selectSlot(slotId) {
    _selectedSlotId = slotId;
    document.querySelectorAll('.slot-pill').forEach(el => {
      el.classList.toggle('selected-slot', parseInt(el.dataset.slotId) === slotId);
    });
    if (typeof subscribeSlot === 'function') {
      subscribeSlot(_date, slotId, function() { refresh().catch(console.error); });
    }
    refresh().catch(console.error);
  }

  async function refresh() {
    if (!_selectedSlotId) return;
    const [reservations, waitingList] = await Promise.all([
      getReservations(_date, _selectedSlotId),
      getReservationList(_date, _selectedSlotId),
    ]);
    const slot      = getSlotById(_selectedSlotId);
    const mapEl     = document.getElementById('beach-map');
    const panelEl   = document.getElementById('side-panel');
    const freeSpots = BEACH_CONFIG.spots
      .filter(s => !reservations[s.id] || reservations[s.id].status === 'free')
      .map(s => s.id);

    const mapHandler = _selectionMode
      ? spotId => _doAssignSpot(spotId, reservations, freeSpots).catch(console.error)
      : spotId => { _onSpotClick(spotId, reservations, freeSpots).catch(console.error); };
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
      onItemClick:      spotId => { _onSpotClick(spotId, reservations, freeSpots); },
      onDepartedClick:  async spotId => {
        const history = await _buildProfileHistory(reservations[spotId]);
        openDepartedModal(spotId, reservations[spotId], history);
      },
      onWaitingClick: async resaId => {
        const resa = waitingList.find(r => r.id === resaId);
        if (!resa) return;
        const history = await _buildProfileHistory(resa);
        openWaitingDetailModal(resa, history, {
          onUpdateAccompagnants: async n => {
            await updateReservationField(resaId, 'accompagnants', n);
            await refresh();
          },
        });
      },
      onPasVenu: async resaId => { await updateReservationStatus(resaId, 'pas_venu'); await refresh(); },
      onAnnule:  async resaId => { await updateReservationStatus(resaId, 'annule'); await refresh(); },
    });
  }

  // ── Spot click (carte ou liste) ──
  async function _onSpotClick(spotId, reservations, freeSpots) {
    const resa = reservations[spotId];
    if (!resa || resa.status === 'free') {
      _openWalkin(freeSpots, spotId);
      return;
    }
    const history = await _buildProfileHistory(resa);
    openSpotDetailModal(spotId, resa, {
      onCheckin: async id => {
        await updateStatus(_date, _selectedSlotId, id, 'present', { checkinTime: Date.now() });
        await refresh();
      },
      onDepart: async id => {
        await updateStatus(_date, _selectedSlotId, id, 'departed', { departTime: Date.now() });
        await refresh();
      },
      onAbsent: async id => {
        await updateStatus(_date, _selectedSlotId, id, 'absent');
        await refresh();
      },
      onUpdateAccompagnants: async n => {
        await updateSpotField(_date, _selectedSlotId, spotId, 'accompagnants', n);
        await refresh();
      },
    }, history);
  }

  // ── Ajouter une réservation à la liste d'attente ──
  async function _openAddReservation() {
    const passInscriptions = (typeof getInscriptionsWithActivePass === 'function')
      ? getInscriptionsWithActivePass() : [];
    if (passInscriptions.length > 0 && typeof preloadPassCounts === 'function') {
      await preloadPassCounts(passInscriptions.map(i => i.id));
    }
    openAddReservationModal(async data => {
      await addReservation(_date, _selectedSlotId, data);
      await refresh();
    });
  }

  // ── Arrivée sans réservation (walk-in) ──
  function _openWalkin(freeSpots, preselectedSpotId) {
    openCheckinModal(freeSpots, preselectedSpotId, async (spotId, data) => {
      const checkinData = { ...data, durationMs: DURATION_MS };
      await saveCheckin(_date, _selectedSlotId, spotId, checkinData);
      await _registerOverflow(spotId, checkinData);
      await refresh();
    });
  }

  // Inscrit la personne dans tous les créneaux suivants dont le début est
  // avant la fin de son temps (débordement horaire)
  async function _registerOverflow(spotId, checkinData) {
    const endTime = checkinData.checkinTime + checkinData.durationMs;
    await Promise.all(SLOTS.map(async slot => {
      if (slot.id <= _selectedSlotId) return;
      const [h, m] = slot.start.split(':').map(Number);
      const slotStart = new Date();
      slotStart.setHours(h, m, 0, 0);
      if (slotStart.getTime() < endTime) {
        await saveCheckin(_date, slot.id, spotId, { ...checkinData });
      }
    }));
  }

  // ── Assigner un emplacement à une personne de la liste d'attente ──
  function _openAssign(index, resa, freeSpots) {
    _selectionMode = { id: resa.id, resa };
    refresh();
  }

  async function _doAssignSpot(spotId, reservations, freeSpots) {
    const resa = reservations[spotId];
    if (resa && resa.status !== 'free' && resa.status !== 'departed') return;

    const { id: waitingResaId, resa: waitingResa } = _selectionMode;
    _selectionMode = null;

    const isDouble    = await _detectDoubleSlot(waitingResa.nom, waitingResa.prenom);
    const durationMs  = isDouble ? DURATION_MS_DOUBLE : DURATION_MS;
    const checkinTime = Date.now();
    const checkinData = {
      nom: waitingResa.nom,
      prenom: waitingResa.prenom,
      accompagnants: waitingResa.accompagnants,
      type: 'reserved',
      checkinTime,
      durationMs,
      status: 'present',
      inscriptionId: waitingResa.inscriptionId || null,
    };

    await saveCheckin(_date, _selectedSlotId, spotId, checkinData);
    await removeReservation(waitingResaId);

    if (isDouble) {
      const nextSlotId = _selectedSlotId + 1;
      const nextList   = await getReservationList(_date, nextSlotId);
      const nextEntry  = nextList.find(r =>
        r.nom.toUpperCase()    === waitingResa.nom.toUpperCase() &&
        r.prenom.toUpperCase() === waitingResa.prenom.toUpperCase()
      );
      if (nextEntry) await removeReservation(nextEntry.id);
    }

    await _registerOverflow(spotId, checkinData);
    await refresh();
  }

  // Retourne l'historique du jour d'une personne : spots assignés + présences en liste d'attente
  async function _buildProfileHistory(resa) {
    if (!resa) return [];
    const nom    = resa.nom.toUpperCase();
    const prenom = resa.prenom.toUpperCase();
    const [allResas, allLists] = await Promise.all([
      Promise.all(SLOTS.map(s => getReservations(_date, s.id))),
      Promise.all(SLOTS.map(s => getReservationList(_date, s.id))),
    ]);
    const result = [];
    SLOTS.forEach((slot, i) => {
      const resas = allResas[i];
      const list  = allLists[i];
      Object.entries(resas).forEach(([sid, r]) => {
        if (r.nom?.toUpperCase() === nom && r.prenom?.toUpperCase() === prenom) {
          result.push({ slot, spotId: sid, resa: r });
        }
      });
      const alreadyInSlot = result.some(e => e.slot.id === slot.id);
      if (!alreadyInSlot) {
        const found = list.find(r => r.nom?.toUpperCase() === nom && r.prenom?.toUpperCase() === prenom);
        if (found) result.push({ slot, spotId: null, resa: { ...found, status: found.status || 'reserved_waiting' } });
      }
    });
    return result;
  }

  // Retourne true si la même personne (NOM+Prénom) est dans la liste du créneau suivant
  async function _detectDoubleSlot(nom, prenom) {
    if (_selectedSlotId >= 5) return false;
    const nextList = await getReservationList(_date, _selectedSlotId + 1);
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

  return { init, selectSlot, refresh, showView };
})();

document.addEventListener('DOMContentLoaded', () => {
  const mapEl = document.getElementById('beach-map');
  renderMapStatic(mapEl);
  App.init();
});
