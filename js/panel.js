'use strict';

// container   : #side-panel element
// slot        : { id, label, start, end } or null
// reservations: { [spotId]: { nom, prenom, status, checkinTime, durationMs, ... } }
// waitingList : [{ nom, prenom, accompagnants, status }, ...] — from getReservationList()
// callbacks   : { onAddReservation, onWalkin, onMarkArrival(resa), onPlace(resa), onGroupCheckin, onPasVenu(resaId), onAnnule(resaId), onItemClick(spotId) }
function renderPanel(container, slot, reservations, waitingList, callbacks) {
  const { present, walkin, absent, departed } = _categorizeSpots(reservations);
  const { arrived, waiting, pasVenus, annules } = _categorizeWaiting(waitingList);

  const _slotMs = r => (typeof slotEndMs === 'function' && r.slotId) ? slotEndMs(r.slotId) : 0;
  const sortByTime = arr => arr.sort(([,a],[,b]) => _slotMs(a) - _slotMs(b));
  const presentSorted = sortByTime([...present, ...walkin]);

  const presentCount = present.length + walkin.length;
  const freeCount    = BEACH_CONFIG.spots.filter(s => {
    const r = reservations[s.id];
    return !r || r.status === 'free' || r.status === 'departed';
  }).length;

  container.innerHTML = `
    ${_renderHeader(slot, presentCount, freeCount, walkin.length, waiting.length, arrived.length)}
    <div class="panel-actions">
      <button class="add-resa-btn" id="btn-add-resa">＋ Ajouter réservation</button>
      <button class="walkin-btn"   id="btn-walkin">↓ Sans réservation</button>
    </div>
    <div class="resa-list">
      ${arrived.length ? `
        <div class="resa-section-title section-arrived">Sur plage · non placé·es (${arrived.length})</div>
        ${arrived.map(r => _renderArrivedUnplacedItem(r, waitingList.indexOf(r))).join('')}
      ` : ''}
      ${waiting.length ? `
        <div class="resa-section-title">En attente d'arrivée (${waiting.length})</div>
        ${waiting.map(r => _renderWaitingItem(r, waitingList.indexOf(r), true)).join('')}
      ` : ''}
      ${presentSorted.length ? `
        <div class="resa-section-title">✓ Présents (${presentSorted.length})</div>
        ${presentSorted.map(([id, r]) => _renderPresentItem(id, r)).join('')}
      ` : ''}
      ${departed.length ? `
        <div class="resa-section-title">↩ Partis (${departed.length})</div>
        ${departed.map(([id, r]) => _renderDepartedItem(id, r)).join('')}
      ` : ''}
      ${absent.length ? `
        <div class="resa-section-title">✕ Absents (${absent.length})</div>
        ${absent.map(([id, r]) => _renderAbsentItem(id, r)).join('')}
      ` : ''}
      ${pasVenus.length ? `
        <div class="resa-section-title">⊘ Pas venus (${pasVenus.length})</div>
        ${pasVenus.map(r => _renderWaitingItem(r, waitingList.indexOf(r), false)).join('')}
      ` : ''}
      ${annules.length ? `
        <div class="resa-section-title">✗ Annulés (${annules.length})</div>
        ${annules.map(r => _renderWaitingItem(r, waitingList.indexOf(r), false)).join('')}
      ` : ''}
      ${(arrived.length + waiting.length + presentSorted.length + departed.length + absent.length + pasVenus.length + annules.length) === 0 ? `
        <div class="empty-state">
          <p>Aucune réservation pour ce créneau</p>
        </div>
      ` : ''}
    </div>
    ${_renderLegend()}
  `;

  document.getElementById('btn-add-resa').addEventListener('click', callbacks.onAddReservation);
  document.getElementById('btn-walkin').addEventListener('click', callbacks.onWalkin);

  container.querySelectorAll('.btn-arrive[data-index]').forEach(btn => {
    const idx = parseInt(btn.dataset.index);
    btn.addEventListener('click', e => { e.stopPropagation(); callbacks.onMarkArrival && callbacks.onMarkArrival(waitingList[idx]); });
  });
  container.querySelectorAll('.btn-place[data-index]').forEach(btn => {
    const idx = parseInt(btn.dataset.index);
    btn.addEventListener('click', e => { e.stopPropagation(); callbacks.onPlace && callbacks.onPlace(waitingList[idx]); });
  });
  container.querySelectorAll('.btn-accueil-groupe[data-index]').forEach(btn => {
    const idx = parseInt(btn.dataset.index);
    btn.addEventListener('click', e => { e.stopPropagation(); callbacks.onGroupCheckin && callbacks.onGroupCheckin(idx, waitingList[idx]); });
  });
  container.querySelectorAll('.btn-pas-venu[data-index]').forEach(btn => {
    const idx  = parseInt(btn.dataset.index);
    const resa = waitingList[idx];
    btn.addEventListener('click', e => { e.stopPropagation(); callbacks.onPasVenu(resa && resa.id); });
  });
  container.querySelectorAll('.btn-annule[data-index]').forEach(btn => {
    const idx  = parseInt(btn.dataset.index);
    const resa = waitingList[idx];
    btn.addEventListener('click', e => { e.stopPropagation(); callbacks.onAnnule(resa && resa.id); });
  });
  container.querySelectorAll('.resa-item[data-spot-id]').forEach(el => {
    el.addEventListener('click', () => callbacks.onItemClick(el.dataset.spotId));
  });
  container.querySelectorAll('.departed-item[data-spot-id]').forEach(el => {
    el.addEventListener('click', () => callbacks.onDepartedClick && callbacks.onDepartedClick(el.dataset.spotId));
  });
  container.querySelectorAll('.waiting-item[data-index]').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      const idx  = parseInt(el.dataset.index);
      const resa = waitingList[idx];
      callbacks.onWaitingClick && callbacks.onWaitingClick(resa && resa.id);
    });
  });
  container.querySelectorAll('.arrived-unplaced-item[data-index]').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      const idx  = parseInt(el.dataset.index);
      const resa = waitingList[idx];
      callbacks.onWaitingClick && callbacks.onWaitingClick(resa && resa.id);
    });
  });
}

function _categorizeSpots(reservations) {
  const present = [], walkin = [], absent = [], departed = [];
  BEACH_CONFIG.spots.forEach(spot => {
    const r = reservations[spot.id];
    if (!r || r.status === 'free') return;
    if (r.status === 'departed') { departed.push([spot.id, r]); return; }
    if (r.status === 'absent')   { absent.push([spot.id, r]);   return; }
    if (r.type === 'walkin')     { walkin.push([spot.id, r]);   return; }
    present.push([spot.id, r]);
  });
  return { present, walkin, absent, departed };
}

function _categorizeWaiting(waitingList) {
  const arrived  = waitingList.filter(r => r.status === 'present');
  const waiting  = waitingList.filter(r => !r.status || r.status === 'waiting');
  const pasVenus = waitingList.filter(r => r.status === 'pas_venu');
  const annules  = waitingList.filter(r => r.status === 'annule');
  return { arrived, waiting, pasVenus, annules };
}

function _renderHeader(slot, presentCount, freeCount, walkinCount, waitingCount, arrivedCount) {
  const now = new Date();
  const endMin = slot ? timeToMinutes(slot.end) : 0;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const remainMin = slot ? Math.max(0, endMin - nowMin) : 0;
  const subtitle = slot ? `Se termine dans ${remainMin} min` : 'Aucun créneau actif';

  return `
    <div class="panel-header">
      <h2>${slot ? slot.label : 'Sélectionner un créneau'}</h2>
      <div class="slot-countdown">${subtitle}</div>
      <div class="panel-stats">
        <div class="stat-chip"><span class="stat-dot" style="background:var(--amber)"></span>${waitingCount} en attente</div>
        <div class="stat-chip"><span class="stat-dot" style="background:var(--red)"></span>${presentCount} présents</div>
        <div class="stat-chip"><span class="stat-dot" style="background:var(--green)"></span>${freeCount} libres</div>
      </div>
    </div>
  `;
}

function _renderArrivedUnplacedItem(resa, index) {
  const initials = `${(resa.prenom||'')[0]||''}${(resa.nom||'')[0]||''}`.toUpperCase();
  const isGroupe = resa.resaType === 'groupe';
  const accompLabel = isGroupe ? `${resa.nbUsagers || 1} empl.`
    : resa.accompagnants === 0 ? 'seul·e'
    : resa.accompagnants === 1 ? '1 accompagnant' : '2 accompagnants';
  const typeLabel = resa.type === 'walkin' ? ' · Sans résa' : '';
  const arrivedAt = resa.checkinTime
    ? ' · ' + new Date(resa.checkinTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '';
  return `
    <div class="resa-item arrived-unplaced-item" data-index="${index}" style="cursor:pointer">
      <div class="resa-avatar" style="background:var(--green-dark, #2e7d32)">${initials}</div>
      <div class="resa-info">
        <div class="resa-name">${resa.nom} ${resa.prenom}</div>
        <div class="resa-meta">${accompLabel}${typeLabel}${arrivedAt}</div>
      </div>
      <div class="waiting-actions">
        ${isGroupe
          ? `<button class="btn-accueil-groupe" data-index="${index}">Placer</button>`
          : `<button class="btn-place" data-index="${index}">📍 Placer</button>`
        }
      </div>
    </div>
  `;
}

function _renderWaitingItem(resa, index, showActions) {
  const initials = `${(resa.prenom||'')[0]||''}${(resa.nom||'')[0]||''}`.toUpperCase();
  const isGroupe = resa.resaType === 'groupe';
  const accompLabel = isGroupe ? `${resa.nbUsagers || 1} empl.`
    : resa.accompagnants === 0 ? 'seul·e'
    : resa.accompagnants === 1 ? '1 accompagnant' : '2 accompagnants';
  const statusLabel = resa.status === 'pas_venu' ? ' · Pas venu·e'
    : resa.status === 'annule' ? ' · Annulé·e' : '';
  const avatarColor = resa.status === 'pas_venu' ? 'var(--grey)'
    : resa.status === 'annule' ? 'var(--grey)'
    : isGroupe ? 'var(--indigo, #3949ab)' : 'var(--amber)';
  const actions = showActions ? `
    <div class="waiting-actions">
      ${isGroupe
        ? `<button class="btn-accueil-groupe" data-index="${index}">Accueillir</button>`
        : `<button class="btn-arrive" data-index="${index}">✓ Arrivée</button>`
      }
      <button class="btn-pas-venu" data-index="${index}">Pas venu</button>
      <button class="btn-annule"   data-index="${index}">Annuler</button>
    </div>
  ` : '';
  return `
    <div class="resa-item waiting-item" data-index="${index}" style="cursor:pointer">
      <div class="resa-avatar" style="background:${avatarColor}">${initials}</div>
      <div class="resa-info">
        <div class="resa-name">${resa.nom} ${resa.prenom}</div>
        <div class="resa-meta">${accompLabel}${statusLabel}</div>
      </div>
      ${actions}
    </div>
  `;
}

function _renderPresentItem(spotId, resa) {
  const initials = `${(resa.prenom||'')[0]||''}${(resa.nom||'')[0]||''}`.toUpperCase();
  const avatarColor = resa.type === 'walkin' ? 'var(--orange)' : 'var(--red-dark)';
  const ms = (typeof slotEndMs === 'function' && resa.slotId) ? slotEndMs(resa.slotId) : 0;
  const urgency = getUrgencyLevel(ms);
  const timerHtml = `<div class="resa-timer ${urgency}">${formatCountdown(ms)}</div>`;
  const accompLabel = resa.accompagnants === 0 ? 'seul·e'
    : resa.accompagnants === 1 ? '1 accompagnant' : '2 accompagnants';
  const doubleLabel = resa.nbCreneaux > 1 ? ' · 2 créneaux' : '';
  return `
    <div class="resa-item" data-state="${resa.status}" data-spot-id="${spotId}">
      <div class="resa-avatar" style="background:${avatarColor}">${initials}</div>
      <div class="resa-info">
        <div class="resa-name">${resa.nom} ${resa.prenom}</div>
        <div class="resa-meta">${spotId} · ${accompLabel}${doubleLabel}</div>
      </div>
      <span class="spot-num">${spotId}</span>
      ${timerHtml}
    </div>
  `;
}

function _renderDepartedItem(spotId, resa) {
  const initials = `${(resa.prenom||'')[0]||''}${(resa.nom||'')[0]||''}`.toUpperCase();
  const accompLabel = resa.accompagnants === 0 ? 'seul·e'
    : resa.accompagnants === 1 ? '1 accompagnant' : '2 accompagnants';
  let dureeLabel = '';
  if (resa.checkinTime && resa.departTime) {
    const ms = resa.departTime - resa.checkinTime;
    const h  = Math.floor(ms / 3600000);
    const m  = Math.floor((ms % 3600000) / 60000);
    dureeLabel = ` · ${h > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${m} min`} sur la plage`;
  }
  return `
    <div class="resa-item departed-item" data-state="departed" data-spot-id="${spotId}" style="cursor:pointer">
      <div class="resa-avatar" style="background:var(--grey)">${initials}</div>
      <div class="resa-info">
        <div class="resa-name">${resa.nom} ${resa.prenom}</div>
        <div class="resa-meta">${spotId} · ${accompLabel}${dureeLabel}</div>
      </div>
      <span class="spot-num">${spotId}</span>
      <div class="resa-timer muted">Parti·e</div>
    </div>
  `;
}

function _renderAbsentItem(spotId, resa) {
  const initials = `${(resa.prenom||'')[0]||''}${(resa.nom||'')[0]||''}`.toUpperCase();
  return `
    <div class="resa-item" data-state="absent" data-spot-id="${spotId}">
      <div class="resa-avatar" style="background:var(--purple)">${initials}</div>
      <div class="resa-info">
        <div class="resa-name">${resa.nom} ${resa.prenom}</div>
        <div class="resa-meta">${spotId} · Absent·e</div>
      </div>
      <span class="spot-num">${spotId}</span>
      <div class="resa-timer muted">Absent·e</div>
    </div>
  `;
}

function _renderLegend() {
  return `
    <div class="panel-legend">
      <div class="legend-item"><div class="legend-dot" style="background:var(--amber)"></div>En attente</div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--red)"></div>Présent (réservé)</div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--orange)"></div>Sans réservation</div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--grey)"></div>Parti·e / Absent·e</div>
    </div>
  `;
}

if (typeof module !== 'undefined') {
  module.exports = { renderPanel };
}
