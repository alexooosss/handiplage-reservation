'use strict';

const App = (() => {
  let _selectedSlotId = null;
  let _date = null;
  let _selectionMode = null; // { id, resa } | null
  let _waitingList   = [];   // snapshot courant de la liste d'attente (spot_id=null)
  let _currentView = 'carte'; // 'carte' | 'planning' | 'mc' | 'inscription' | 'groupes'
  let _planningWeekOffset = 0;
  let _mcDate = null;

  function init() {
    _date   = getTodayISO();
    _mcDate = _date;
    _renderHeader();
    _renderClock();
    setInterval(_renderClock, 1000);

    // Préchargement inscriptions (pour autocomplete pass) : version légère, sans les justificatifs
    const _chargerCacheInsc = typeof chargerCacheInscriptions === 'function' ? chargerCacheInscriptions
                            : (typeof getInscriptions === 'function' ? getInscriptions : null);
    if (_chargerCacheInsc) {
      _chargerCacheInsc().catch(function(err) { console.warn('Preload inscriptions:', err); });
    }
    // Préchargement groupes (pour autocomplete planning)
    if (typeof getGroupes === 'function') {
      getGroupes().catch(function(err) { console.warn('Preload groupes:', err); });
    }

    // Realtime : s'abonner aux inscriptions
    if (typeof subscribeInscriptions === 'function') {
      subscribeInscriptions(function() {
        if (_chargerCacheInsc) _chargerCacheInsc().catch(function() {});
        // Rafraîchit la liste sans fermer la fiche éventuellement ouverte
        if (_currentView === 'inscription' && typeof refreshInscriptionListe === 'function') {
          refreshInscriptionListe(document.getElementById('insc-view')).catch(console.error);
        }
      });
    }
    // Realtime : s'abonner aux groupes
    if (typeof subscribeGroupes === 'function') {
      subscribeGroupes(function() {
        // Garde le groupe ouvert ; ne pas redessiner pendant une modification en cours
        if (_currentView === 'groupes' && (typeof _gpMode === 'undefined' || _gpMode === 'view')) {
          _renderGroupesView(typeof _gpSelectedId !== 'undefined' ? _gpSelectedId : null);
        }
      });
    }

    const active   = getActiveSlot(new Date());
    const upcoming = SLOTS.find(s => getSlotStatus(s, new Date()) === 'upcoming');
    const defaultSlot = active || upcoming || SLOTS[0];
    selectSlot(defaultSlot.id);

    setInterval(function() { if (!_refreshing && !document.hidden) refresh().catch(console.error); }, 30000);
    // Retour sur l'écran (tablette réveillée, onglet réaffiché) : mise à jour immédiate
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden && !_refreshing && _currentView === 'carte') refresh().catch(console.error);
    });

    // Mise à jour automatique quand un créneau commence / se termine (ou au changement de jour)
    let _phaseKey = _computePhaseKey();
    setInterval(function() {
      const key = _computePhaseKey();
      if (key === _phaseKey) return;
      // Ne pas redessiner sous une fenêtre ouverte : on réessaiera à la minute suivante
      const modal = document.getElementById('app-modal');
      if (modal && modal.open) return;
      _phaseKey = key;
      _renderHeader();
      if (_currentView === 'planning') _renderPlanning().catch(console.error);
    }, 30000);

    // Onglet « Plage » : retour au plan
    const btnCarte = document.getElementById('btn-carte-tab');
    if (btnCarte) {
      btnCarte.addEventListener('click', () => showView('carte'));
    }

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

    // Groupes tab button
    const btnGroupes = document.getElementById('btn-groupes-tab');
    if (btnGroupes) {
      btnGroupes.addEventListener('click', () => {
        showView(_currentView === 'groupes' ? 'carte' : 'groupes');
      });
    }

    // Messages tab button
    const btnMessages = document.getElementById('btn-messages-tab');
    if (btnMessages) {
      btnMessages.addEventListener('click', () => {
        showView(_currentView === 'messages' ? 'carte' : 'messages');
      });
    }

    // Stats tab button
    const btnStats = document.getElementById('btn-stats-tab');
    if (btnStats) {
      btnStats.addEventListener('click', () => {
        showView(_currentView === 'stats' ? 'carte' : 'stats');
      });
    }

    // Plans tab button (responsable)
    const btnPlans = document.getElementById('btn-plans-tab');
    if (btnPlans) {
      btnPlans.addEventListener('click', () => {
        showView(_currentView === 'plans' ? 'carte' : 'plans');
      });
    }

    // Profil tab button
    const btnProfil = document.getElementById('btn-profil-tab');
    if (btnProfil) {
      btnProfil.addEventListener('click', () => {
        showView(_currentView === 'profil' ? 'carte' : 'profil');
      });
    }

    // Badge non-lus
    if (typeof getUnreadCount === 'function') {
      getUnreadCount().then(function(count) {
        const badge = document.getElementById('messages-badge');
        if (badge) {
          if (count > 0) { badge.textContent = count; badge.style.display = 'inline'; }
          else badge.style.display = 'none';
        }
      }).catch(function() {});
    }
  }

  function showView(view, inscriptionId) {
    if (_currentView === 'mc' && view !== 'mc' && typeof unsubscribeMc === 'function') {
      unsubscribeMc();
    }
    if (_currentView === 'stats' && view !== 'stats' && typeof UsagersMap !== 'undefined') {
      UsagersMap.destroy();
    }

    _currentView = view;
    const beachPanel   = document.getElementById('beach-panel');
    const sidePanel    = document.getElementById('side-panel');
    const planningView   = document.getElementById('planning-view');
    const mcView         = document.getElementById('mc-view');
    const inscView       = document.getElementById('insc-view');
    const groupesView    = document.getElementById('groupes-view');
    const messagesView   = document.getElementById('messages-view');
    const statsView      = document.getElementById('stats-view');
    const btnPlanning    = document.getElementById('btn-planning-tab');
    const btnMc          = document.getElementById('btn-mc-tab');
    const btnInsc        = document.getElementById('btn-insc-tab');
    const btnGroupes     = document.getElementById('btn-groupes-tab');
    const btnMessages    = document.getElementById('btn-messages-tab');
    const btnStats       = document.getElementById('btn-stats-tab');
    const btnProfil      = document.getElementById('btn-profil-tab');
    const profilView     = document.getElementById('profil-view');
    const plansView      = document.getElementById('plans-view');
    const btnPlans       = document.getElementById('btn-plans-tab');
    const btnCarte       = document.getElementById('btn-carte-tab');
    const slotsNav       = document.getElementById('slots-nav');

    // Créneaux visibles uniquement sur le plan
    if (slotsNav) slotsNav.hidden = view !== 'carte';
    if (btnCarte) btnCarte.classList.toggle('active', view === 'carte');
    document.querySelectorAll('#app-header .planning-tab-btn').forEach(b => {
      b.setAttribute('aria-current', 'false');
    });

    // Masquer tout
    if (beachPanel)   beachPanel.style.display   = 'none';
    if (sidePanel)    sidePanel.style.display     = 'none';
    if (planningView) planningView.style.display  = 'none';
    if (mcView)       mcView.style.display        = 'none';
    if (inscView)     inscView.style.display      = 'none';
    if (groupesView)  groupesView.style.display   = 'none';
    if (messagesView) messagesView.style.display  = 'none';
    if (statsView)    statsView.style.display     = 'none';
    if (profilView)   profilView.style.display    = 'none';
    if (plansView)    plansView.style.display     = 'none';
    if (btnPlans)     btnPlans.classList.remove('active');
    if (btnPlanning)  btnPlanning.classList.remove('active');
    if (btnMc)        btnMc.classList.remove('active');
    if (btnInsc)      btnInsc.classList.remove('active');
    if (btnGroupes)   btnGroupes.classList.remove('active');
    if (btnMessages)  btnMessages.classList.remove('active');
    if (btnStats)     btnStats.classList.remove('active');
    if (btnProfil)    btnProfil.classList.remove('active');

    if (view === 'planning') {
      if (planningView) planningView.style.display = 'flex';
      if (btnPlanning)  btnPlanning.classList.add('active');
      _renderPlanning().catch(console.error);
    } else if (view === 'mc') {
      if (mcView) mcView.style.display = 'flex';
      if (btnMc)  btnMc.classList.add('active');
      _renderMc().catch(console.error);
      if (typeof subscribeMc === 'function') {
        subscribeMc(_mcDate, _onMcRealtime);
      }
    } else if (view === 'groupes') {
      if (groupesView) groupesView.style.display = 'flex';
      if (btnGroupes)  btnGroupes.classList.add('active');
      _renderGroupesView(inscriptionId); // inscriptionId slot réutilisé pour groupeId
    } else if (view === 'inscription') {
      if (inscView) inscView.style.display = 'flex';
      if (btnInsc)  btnInsc.classList.add('active');
      _renderInscription(inscriptionId).catch(console.error);
    } else if (view === 'messages') {
      if (messagesView) messagesView.style.display = 'flex';
      if (btnMessages)  btnMessages.classList.add('active');
      renderMessages(messagesView).catch(console.error);
    } else if (view === 'stats') {
      if (statsView) statsView.style.display = 'block';
      if (btnStats)  btnStats.classList.add('active');
      StatsView.render(statsView).catch(console.error);
    } else if (view === 'plans') {
      if (plansView) plansView.style.display = 'block';
      if (btnPlans)  btnPlans.classList.add('active');
      renderPlansView(plansView).catch(console.error);
    } else if (view === 'profil') {
      if (profilView) profilView.style.display = 'block';
      if (btnProfil)  btnProfil.classList.add('active');
      renderStaffProfil(profilView).catch(console.error);
    } else {
      if (beachPanel) beachPanel.style.display = '';
      if (sidePanel)  sidePanel.style.display  = '';
    }
    document.querySelectorAll('#app-header .planning-tab-btn.active').forEach(b => {
      b.setAttribute('aria-current', 'page');
    });
    document.dispatchEvent(new CustomEvent('hp:vue', { detail: view }));
  }

  function _mcDateOffset(iso, delta) {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    return d.toISOString().slice(0, 10);
  }

  function _renderGroupesView(selectedGroupeId) {
    const container = document.getElementById('groupes-view');
    if (!container) return;
    if (typeof renderGroupes === 'function') renderGroupes(container, selectedGroupeId);
  }

  async function _renderInscription(selectedId) {
    const container = document.getElementById('insc-view');
    if (!container) return;
    await renderInscription(container, selectedId);
  }

  // Temps réel main courante : ignorer nos propres enregistrements (ils sont déjà affichés)
  // et ne pas redessiner pendant une saisie (texte en cours perdu sinon)
  let _mcPending = null;
  function _onMcRealtime(force) {
    if (force !== true && Date.now() - (window._mcLocalSaveAt || 0) < 2500) return;
    const view = document.getElementById('mc-view');
    const ae   = document.activeElement;
    if (view && ae && view.contains(ae) && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) {
      // Réessayer quand le champ est quitté
      if (!_mcPending) {
        _mcPending = () => { ae.removeEventListener('blur', _mcPending); _mcPending = null; setTimeout(() => _onMcRealtime(true), 300); };
        ae.addEventListener('blur', _mcPending);
      }
      return;
    }
    if (_currentView === 'mc') _renderMc().catch(console.error);
  }

  async function _renderMc() {
    const container = document.getElementById('mc-view');
    if (!container) return;
    if (!_mcDate) _mcDate = _date;
    container._onMcPrev  = () => {
      _mcDate = _mcDateOffset(_mcDate, -1);
      if (typeof subscribeMc === 'function') subscribeMc(_mcDate, _onMcRealtime);
      _renderMc().catch(console.error);
    };
    container._onMcNext  = () => {
      const next = _mcDateOffset(_mcDate, +1);
      if (next <= _date) {
        _mcDate = next;
        if (typeof subscribeMc === 'function') subscribeMc(_mcDate, _onMcRealtime);
        _renderMc().catch(console.error);
      }
    };
    container._onMcToday = () => {
      _mcDate = _date;
      if (typeof subscribeMc === 'function') subscribeMc(_mcDate, _onMcRealtime);
      _renderMc().catch(console.error);
    };
    container._onMcGoto  = d  => {
      _mcDate = d;
      if (typeof subscribeMc === 'function') subscribeMc(_mcDate, _onMcRealtime);
      _renderMc().catch(console.error);
    };
    await renderMc(container, _mcDate);
  }

  async function _renderPlanning() {
    const container = document.getElementById('planning-view');
    if (!container) return;
    // Sens du changement de semaine : sert à l'animation de défilement (planning.js)
    container._onPrev  = () => { _planningWeekOffset--; container._sensSemaine = 'prec'; _renderPlanning(); };
    container._onNext  = () => { _planningWeekOffset++; container._sensSemaine = 'suiv'; _renderPlanning(); };
    container._onToday = () => {
      if (_planningWeekOffset !== 0) container._sensSemaine = _planningWeekOffset > 0 ? 'prec' : 'suiv';
      _planningWeekOffset = 0; _renderPlanning();
    };
    container._onCapacite = () => { _renderPlanning(); };
    const surCreneau = async (dateISO, slot) => {
      const isToday = dateISO === _date;
      openSlotPlanningModal(dateISO, slot, {
        onAdd:    async data => { await addReservation(dateISO, slot.id, data); await _renderPlanning(); },
        onRemove: async id   => { await removeReservation(id); await _renderPlanning(); },
        onGoLive: isToday ? () => { showView('carte'); selectSlot(slot.id); } : null,
        // Places du créneau (réglage ponctuel ou normal) et réglage depuis la fenêtre
        capacite: typeof capaciteDe === 'function' ? capaciteDe(container._capaIndex || {}, dateISO, slot.id) : null,
        onCapacite: () => _renderPlanning(),
      });
    };
    if (typeof estTelStaff === 'function' && estTelStaff() && typeof renderPlanningTel === 'function') {
      await renderPlanningTel(container, surCreneau);
    } else {
      await renderPlanning(container, _planningWeekOffset, surCreneau);
    }
    // Ouvert depuis le volet de la Plage : la fenêtre du créneau s'ouvre directement
    if (_creneauAOuvrir) {
      const s = getSlotById(_creneauAOuvrir);
      _creneauAOuvrir = null;
      if (s) surCreneau(_date, s);
    }
  }

  // Volet de la Plage → « Ouvrir le planning » : onglet Planning, semaine (ou jour) en cours, créneau ouvert
  let _creneauAOuvrir = null;
  function _ouvrirCreneauDansPlanning(slotId) {
    _creneauAOuvrir = slotId || null;
    _planningWeekOffset = 0;
    if (typeof _telJour !== 'undefined') _telJour = _date;
    showView('planning');
  }

  function selectSlot(slotId) {
    _selectedSlotId = slotId;
    document.querySelectorAll('.slot-pill').forEach(el => {
      const sel = parseInt(el.dataset.slotId) === slotId;
      el.classList.toggle('selected-slot', sel);
      el.setAttribute('aria-pressed', sel ? 'true' : 'false');
    });
    if (typeof subscribeSlot === 'function') {
      subscribeSlot(_date, slotId, function() { refresh().catch(console.error); });
    }
    refresh().catch(console.error);
  }

  let _refreshing = false;
  let _fermetureCreneau = null;   // fermeture du créneau affiché (affichage uniquement)
  function _afficherFermeturePlan(f) {
    const panel = document.getElementById('beach-panel');
    if (!panel) return;
    _fermetureCreneau = f || null;
    panel.classList.toggle('plage-fermee', !!f);
    let el = document.getElementById('fermeture-plan');
    if (!f) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'fermeture-plan';
      el.className = 'fermeture-plan';
      el.setAttribute('role', 'status');
      const route = panel.querySelector('.beach-road');
      if (route) route.appendChild(el); else panel.insertBefore(el, panel.firstChild);
    }
    const h = String(f.heure_fermeture || '').slice(0, 5);
    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    el.innerHTML = '<span><b>Plage fermée</b>'
      + (h && h !== '00:00' ? ' depuis ' + h.replace(':', 'h') : '')
      + (f.motif ? ' — ' + esc(f.motif) : '')
      + ' · réservations de ce créneau suspendues</span>'
      + ' <button type="button" class="fermeture-plan-lien" id="fermeture-plan-mc">Main courante →</button>';
    const lien = document.getElementById('fermeture-plan-mc');
    if (lien) lien.addEventListener('click', () => showView('mc'));
  }

  // Panneau de droite : habillage selon l'état de la plage, après le rendu habituel.
  // N'ajoute qu'un affichage et une confirmation : les actions elles-mêmes ne changent pas.
  function _habillerPanneau(panelEl, slot) {
    const f = _fermetureCreneau;
    // Compteur « libres » → « Plage fermée »
    const chips = panelEl.querySelectorAll('.panel-stats .stat-chip');
    const chipLibres = chips[chips.length - 1];
    if (f && chipLibres) {
      chipLibres.classList.add('stat-chip-ferme');
      chipLibres.innerHTML = '<span class="stat-dot" style="background:#ff5252"></span>Plage fermée';
    }
    // Ajouter / Sans réservation : toujours possibles, mais après confirmation
    if (f) {
      ['btn-add-resa', 'btn-walkin'].forEach(id => {
        const b = document.getElementById(id);
        if (!b) return;
        b.classList.add('btn-plage-fermee');
        b.addEventListener('click', e => {
          if (!confirm('La plage est fermée sur ce créneau. Ajouter quand même ?')) {
            e.stopImmediatePropagation();
            e.preventDefault();
          }
        }, true);
      });
    }
    // Liste vide : quoi faire ensuite
    const vide = panelEl.querySelector('.resa-list .empty-state');
    if (vide) {
      if (f) {
        vide.innerHTML = '<p class="empty-titre">Plage fermée sur ce créneau</p>'
          + '<p class="empty-sous">Pour rouvrir la plage, passez par la main courante.</p>'
          + '<button type="button" class="empty-btn" id="empty-rouvrir">Rouvrir la plage →</button>';
        document.getElementById('empty-rouvrir').addEventListener('click', () => showView('mc'));
      } else {
        const idx = SLOTS.findIndex(s => slot && s.id === slot.id);
        const suivant = idx >= 0 ? SLOTS[idx + 1] : null;
        vide.innerHTML = '<p class="empty-titre">Aucune réservation pour ce créneau</p>'
          + (suivant
              ? '<button type="button" class="empty-btn" id="empty-suivant">Créneau suivant · ' + String(suivant.start).replace(':', 'h') + ' →</button>'
              : '<p class="empty-sous">C\'est le dernier créneau de la journée.</p>');
        const bs = document.getElementById('empty-suivant');
        if (bs) bs.addEventListener('click', () => selectSlot(suivant.id));
      }
    }
  }

  async function refresh() {
    if (!_selectedSlotId || _refreshing) return;
    _refreshing = true;
    try {
    const [reservations, waitingList, fermetures, suivantes] = await Promise.all([
      getReservations(_date, _selectedSlotId),
      getReservationList(_date, _selectedSlotId),
      typeof getFermetures === 'function' ? getFermetures(_date, _date).catch(() => []) : Promise.resolve([]),
      // Créneau suivant : sert à repérer les personnes qui restent 2 créneaux (temps restant juste)
      getSlotById(_selectedSlotId + 1) ? getReservations(_date, _selectedSlotId + 1).catch(() => ({})) : Promise.resolve({}),
    ]);
    Object.keys(reservations).forEach(spotId => {
      const r = reservations[spotId], n = suivantes[spotId];
      if (r && n && String(n.nom || '').toUpperCase() === String(r.nom || '').toUpperCase()
          && String(n.prenom || '').toUpperCase() === String(r.prenom || '').toUpperCase()) {
        r._finSlotId = _selectedSlotId + 1;
      }
    });
    // Plage fermée sur ce créneau : bandeau au-dessus du plan
    _afficherFermeturePlan(typeof creneauFerme === 'function' ? creneauFerme(fermetures, _date, _selectedSlotId) : null);
    _waitingList = waitingList;
    const slot      = getSlotById(_selectedSlotId);
    const mapEl     = document.getElementById('beach-map');
    const panelEl   = document.getElementById('side-panel');
    const freeSpots = BEACH_CONFIG.spots
      .filter(s => !reservations[s.id] || reservations[s.id].status === 'free')
      .map(s => s.id);

    const mapHandler = _selectionMode
      ? spotId => _doPlaceOnSpot(spotId, reservations).catch(console.error)
      : spotId => { _onSpotClick(spotId, reservations, freeSpots).catch(console.error); };
    renderMapSpots(mapEl, reservations, mapHandler, !!_selectionMode);

    // Bandeau de sélection
    const banner = document.getElementById('selection-banner');
    if (_selectionMode) {
      banner.style.display = 'flex';
      const _escB = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      banner.innerHTML = `
        <span class="banner-text">📍 Cliquez sur un emplacement libre pour placer <strong>${_escB(_selectionMode.resa.nom)} ${_escB(_selectionMode.resa.prenom)}</strong></span>
        <button class="btn-cancel-selection" id="btn-cancel-sel">✕ Annuler</button>
      `;
      document.getElementById('btn-cancel-sel').addEventListener('click', () => {
        _selectionMode = null;
        refresh();
      });
    } else {
      banner.style.display = 'none';
    }
    if (typeof telPlacer === 'function') {
      telPlacer(_selectionMode, reservations,
        spotId => _doPlaceOnSpot(spotId, reservations).catch(console.error),
        () => { _selectionMode = null; refresh(); });
    }

    renderPanel(panelEl, slot, reservations, waitingList, {
      onAddReservation: () => _openAddReservation(),
      onOpenPlanning:   () => _ouvrirCreneauDansPlanning(_selectedSlotId),
      onWalkin:         () => _openWalkinEntry(),
      onMarkArrival:    resa => _onMarkArrival(resa),
      onPlace:          resa => _openPlace(resa),
      onGroupCheckin:   (index, resa) => _openGroupCheckin(resa, freeSpots),
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
    _habillerPanneau(panelEl, slot);
    } finally { _refreshing = false; }
  }

  // ── Spot click (carte ou liste) ──
  async function _onSpotClick(spotId, reservations, freeSpots) {
    const resa = reservations[spotId];
    if (!resa || resa.status === 'free') {
      // Emplacement libre : proposer de placer une personne arrivée non placée
      const arrivedUnplaced = _waitingList.filter(r => r.status === 'present');
      openPlacementPickerModal(arrivedUnplaced, spotId, async selectedResa => {
        _selectionMode = { id: selectedResa.id, resa: selectedResa };
        await _doPlaceOnSpot(spotId, reservations);
      }, () => _openWalkinEntry());
      return;
    }
    const history = await _buildProfileHistory(resa);
    openSpotDetailModal(spotId, resa, {
      onCheckin: async id => {
        const now = Date.now();
        await updateStatus(_date, _selectedSlotId, id, 'present', { checkinTime: now });
        await refresh();
      },
      onDepart: async id => {
        const departResa = reservations[id];
        const now = Date.now();
        if (departResa && departResa.resaType === 'groupe') {
          const groupNom = (departResa.nom || '').toUpperCase();
          const groupIds = Object.entries(reservations)
            .filter(([, r]) => r.resaType === 'groupe' && (r.nom || '').toUpperCase() === groupNom
              && r.status !== 'departed')
            .map(([sid]) => sid);
          await Promise.all(groupIds.map(sid =>
            updateStatus(_date, _selectedSlotId, sid, 'departed', { departTime: now })
          ));
        } else {
          await updateStatus(_date, _selectedSlotId, id, 'departed', { departTime: now });
        }
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
      try {
        await addReservation(_date, _selectedSlotId, data);
        await refresh();
      } catch (e) {
        alert(e.message || 'Impossible d\'ajouter la réservation.');
        await refresh();
      }
    });
  }

  // ── Étape 1 : noter l'arrivée d'un walk-in (sans emplacement) ──
  function _openWalkinEntry() {
    const minutesSince = (typeof minutesSinceSlotStart === 'function')
      ? minutesSinceSlotStart(_selectedSlotId) : 0;
    const isLate   = minutesSince > 45;
    const nextSlot = (isLate && !isLastSlot(_selectedSlotId))
      ? getSlotById(_selectedSlotId + 1) : null;
    openWalkinEntryModal(async data => {
      await addWalkinToList(_date, _selectedSlotId, data);
      await refresh();
    }, { isLate, nextSlot });
  }

  // ── Étape 1 : noter l'arrivée depuis la liste d'attente ──
  async function _onMarkArrival(resa) {
    await markArrivalFromList(resa.id);
    await refresh();
  }

  // ── Étape 2A : activer le mode sélection depuis le panneau ──
  function _openPlace(resa) {
    _selectionMode = { id: resa.id, resa };
    refresh().catch(console.error);
  }

  // Timestamp de fin officielle d'un créneau pour aujourd'hui
  function _slotEndTimestamp(slotId) {
    const slot = getSlotById(slotId);
    if (!slot) return Infinity;
    const [h, m] = slot.end.split(':').map(Number);
    const t = new Date();
    t.setHours(h, m, 0, 0);
    return t.getTime();
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

  // ── Accueil groupe : saisie des effectifs + attribution multi-spots ──
  function _openGroupCheckin(resa, freeSpots) {
    const nbSpotsHint = resa.nbUsagers || 1;
    openGroupCheckinModal(resa, freeSpots, async ({ nbUsagers, nbAcc, spots }) => {
      const now        = Date.now();
      const durationMs = Math.max(0, Math.min(DURATION_MS, _slotEndTimestamp(_selectedSlotId) - now));
      for (const spotId of spots) {
        const checkinData = {
          nom:           resa.nom,
          prenom:        resa.prenom,
          accompagnants: nbAcc,
          nbUsagers,
          type:          'reserved',
          checkinTime:   now,
          durationMs,
          status:        'present',
          resaType:      'groupe',
          inscriptionId: resa.inscriptionId || null,
          groupeId:      resa.groupeId      || null,
        };
        await saveCheckin(_date, _selectedSlotId, spotId, checkinData);
        await _registerOverflow(spotId, checkinData);
      }
      await removeReservation(resa.id);
      await refresh();
    }, nbSpotsHint);
  }

  // ── Étape 2B : placer une personne sur un emplacement (depuis carte ou panneau) ──
  async function _doPlaceOnSpot(spotId, reservations) {
    const occupant = reservations[spotId];
    if (occupant && occupant.status !== 'free' && occupant.status !== 'departed') return;

    const { id: waitingResaId, resa: waitingResa } = _selectionMode;
    _selectionMode = null;

    const isDouble = waitingResa.type === 'walkin'
      ? (waitingResa.nbCreneaux > 1)
      : await _detectDoubleSlot(waitingResa.nom, waitingResa.prenom);
    const maxSlotId    = isDouble ? _selectedSlotId + 1 : _selectedSlotId;
    const baseDuration = isDouble ? DURATION_MS_DOUBLE : DURATION_MS;
    const durationMs   = Math.max(0, Math.min(baseDuration, _slotEndTimestamp(maxSlotId) - Date.now()));

    // Assigne le spot_id sur l'enregistrement existant (déjà statut=present)
    await assignSpotFromWaiting(waitingResaId, spotId);

    if (isDouble) {
      const nextList  = await getReservationList(_date, _selectedSlotId + 1);
      const nextEntry = nextList.find(r =>
        r.nom.toUpperCase()    === waitingResa.nom.toUpperCase() &&
        r.prenom.toUpperCase() === waitingResa.prenom.toUpperCase()
      );
      if (nextEntry) await removeReservation(nextEntry.id);
    }

    const overflowData = {
      nom:           waitingResa.nom,
      prenom:        waitingResa.prenom,
      accompagnants: waitingResa.accompagnants,
      type:          waitingResa.type || 'reserved',
      checkinTime:   waitingResa.checkinTime || Date.now(),
      durationMs,
      status:        'present',
      inscriptionId: waitingResa.inscriptionId || null,
    };
    await _registerOverflow(spotId, overflowData);
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

  // État des créneaux du jour (sert à détecter un changement de phase)
  function _computePhaseKey() {
    const now = new Date();
    return getTodayISO() + '|' + SLOTS.map(s => getSlotStatus(s, now)).join(',');
  }

  // ── Header & horloge ──
  function _renderHeader() {
    const nav = document.getElementById('slots-nav');
    const libelles = { active: 'en cours', past: 'terminé', upcoming: 'à venir' };
    nav.innerHTML = '<div class="slots-track">' + SLOTS.map(slot => {
      const status = getSlotStatus(slot, new Date());
      const heure  = slot.label.split(' – ')[0];
      const sel    = slot.id === _selectedSlotId;
      return `<button type="button" class="slot-pill${sel ? ' selected-slot' : ''}" data-slot-id="${slot.id}" data-status="${status}"`
           + ` aria-pressed="${sel}" aria-label="Créneau ${heure}, ${libelles[status] || ''}"${status === 'past' ? ' disabled' : ''}>${heure}</button>`;
    }).join('') + '</div>';
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

  return {
    init, selectSlot, refresh, showView,
    navigateToInscription: function(id) { closeModal(); showView('inscription', id); },
    navigateToGroupe: function(id) { closeModal(); showView('groupes', id); },
  };
})();
