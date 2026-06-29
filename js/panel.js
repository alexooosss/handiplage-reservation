'use strict';

// container   : #side-panel element
// slot        : { id, label, start, end } or null
// reservations: { [spotId]: { nom, prenom, status, checkinTime, durationMs, ... } }
// waitingList : [{ nom, prenom, accompagnants }, ...] — from getReservationList()
// callbacks   : { onAddReservation, onWalkin, onAssign(index, resa), onItemClick(spotId) }
function renderPanel(container, slot, reservations, waitingList, callbacks) {
  const { present, walkin, absent } = _categorizeSpots(reservations);

  // Sort present+walkin by time remaining ascending (urgent first)
  const sortByTime = arr => arr.sort(([,a],[,b]) =>
    getTimeRemaining(a.checkinTime, a.durationMs) - getTimeRemaining(b.checkinTime, b.durationMs)
  );
  const presentSorted = sortByTime([...present, ...walkin]);

  const presentCount = present.length + walkin.length;
  const freeCount    = BEACH_CONFIG.spots.filter(s => {
    const r = reservations[s.id];
    return !r || r.status === 'free';
  }).length;

  container.innerHTML = `
    ${_renderHeader(slot, presentCount, freeCount, walkin.length, waitingList.length)}
    <div class="panel-actions">
      <button class="add-resa-btn" id="btn-add-resa">＋ Ajouter réservation</button>
      <button class="walkin-btn"   id="btn-walkin">↓ Arrivée sans réservation</button>
    </div>
    <div class="resa-list">
      ${waitingList.length ? `
        <div class="resa-section-title">⏳ En attente d'arrivée (${waitingList.length})</div>
        ${waitingList.map((r, i) => _renderWaitingItem(r, i)).join('')}
      ` : ''}
      ${presentSorted.length ? `
        <div class="resa-section-title">✓ Présents sur la plage (${presentSorted.length})</div>
        ${presentSorted.map(([id, r]) => _renderPresentItem(id, r)).join('')}
      ` : ''}
      ${absent.length ? `
        <div class="resa-section-title">✕ Absents</div>
        ${absent.map(([id, r]) => _renderAbsentItem(id, r)).join('')}
      ` : ''}
      ${(waitingList.length + presentSorted.length + absent.length) === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">🏖️</div>
          <p>Aucune réservation pour ce créneau</p>
        </div>
      ` : ''}
    </div>
    ${_renderLegend()}
  `;

  document.getElementById('btn-add-resa').addEventListener('click', callbacks.onAddReservation);
  document.getElementById('btn-walkin').addEventListener('click', callbacks.onWalkin);

  container.querySelectorAll('.btn-assign[data-index]').forEach(btn => {
    const idx = parseInt(btn.dataset.index);
    btn.addEventListener('click', () => callbacks.onAssign(idx, waitingList[idx]));
  });

  container.querySelectorAll('.resa-item[data-spot-id]').forEach(el => {
    el.addEventListener('click', () => callbacks.onItemClick(el.dataset.spotId));
  });
}

function _categorizeSpots(reservations) {
  const present = [], walkin = [], absent = [];
  BEACH_CONFIG.spots.forEach(spot => {
    const r = reservations[spot.id];
    if (!r || r.status === 'free') return;
    if (r.status === 'absent') { absent.push([spot.id, r]); return; }
    if (r.type === 'walkin')   { walkin.push([spot.id, r]); return; }
    present.push([spot.id, r]);
  });
  return { present, walkin, absent };
}

function _renderHeader(slot, presentCount, freeCount, walkinCount, waitingCount) {
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

function _renderWaitingItem(resa, index) {
  const initials = `${(resa.prenom||'')[0]||''}${(resa.nom||'')[0]||''}`.toUpperCase();
  const accompLabel = resa.accompagnants === 0 ? 'seul·e'
    : resa.accompagnants === 1 ? '1 accompagnant' : '2 accompagnants';
  return `
    <div class="resa-item waiting-item" data-index="${index}">
      <div class="resa-avatar" style="background:var(--amber)">${initials}</div>
      <div class="resa-info">
        <div class="resa-name">${resa.nom} ${resa.prenom}</div>
        <div class="resa-meta">${accompLabel}</div>
      </div>
      <button class="btn-assign" data-index="${index}">Assigner</button>
    </div>
  `;
}

function _renderPresentItem(spotId, resa) {
  const initials = `${(resa.prenom||'')[0]||''}${(resa.nom||'')[0]||''}`.toUpperCase();
  const avatarColor = resa.type === 'walkin' ? 'var(--orange)' : 'var(--red-dark)';
  const ms = getTimeRemaining(resa.checkinTime, resa.durationMs);
  const urgency = getUrgencyLevel(ms);
  const timerHtml = `<div class="resa-timer ${urgency}">${formatCountdown(ms)}</div>`;
  const accompLabel = resa.accompagnants === 0 ? 'seul·e'
    : resa.accompagnants === 1 ? '1 accompagnant' : '2 accompagnants';
  const doubleLabel = resa.durationMs && resa.durationMs > 105 * 60 * 1000 ? ' · 2 créneaux' : '';
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
      <div class="legend-item"><div class="legend-dot" style="background:var(--orange)"></div>Arrivée libre</div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--purple)"></div>Absent·e</div>
    </div>
  `;
}

if (typeof module !== 'undefined') {
  module.exports = { renderPanel };
}
