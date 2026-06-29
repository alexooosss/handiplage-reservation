'use strict';

// Rend le panneau droit pour un créneau donné
// slot : objet SLOTS, reservations : {[spotId]: {...}}
// onCheckinClick : function(), onItemClick : function(spotId)
function renderPanel(container, slot, reservations, onCheckinClick, onItemClick) {
  const { present, waiting, walkin, free, absent } = _categorize(reservations);
  const urgents = [...present, ...walkin].filter(([, r]) => {
    const ms = getTimeRemaining(r.checkinTime);
    return getUrgencyLevel(ms) === 'critical' || getUrgencyLevel(ms) === 'expired';
  });
  const normal = [...present, ...walkin].filter(([spotId]) =>
    !urgents.find(([id]) => id === spotId)
  );

  container.innerHTML = `
    ${_renderHeader(slot, present.length + walkin.length, free.length, walkin.length)}
    <button class="checkin-btn" id="checkin-btn">✚ Enregistrer une arrivée</button>
    <div class="resa-list">
      ${urgents.length  ? `<div class="resa-section-title">⚠ Départ imminent</div>${urgents.map(([id,r]) => _renderItem(id,r)).join('')}` : ''}
      ${normal.length   ? `<div class="resa-section-title">Présents</div>${normal.map(([id,r]) => _renderItem(id,r)).join('')}` : ''}
      ${waiting.length  ? `<div class="resa-section-title">Réservés · pas encore arrivés</div>${waiting.map(([id,r]) => _renderItem(id,r)).join('')}` : ''}
      ${absent.length   ? `<div class="resa-section-title">Absents</div>${absent.map(([id,r]) => _renderItem(id,r)).join('')}` : ''}
      ${free.length     ? `<div class="resa-section-title">Places libres</div>${free.map(id => _renderFreeItem(id)).join('')}` : ''}
      ${(present.length + walkin.length + waiting.length + free.length) === 0
          ? '<div class="empty-state"><div class="empty-icon">🏖️</div><p>Aucune réservation pour ce créneau</p></div>'
          : ''}
    </div>
    ${_renderLegend()}
  `;

  container.querySelector('#checkin-btn').addEventListener('click', onCheckinClick);
  container.querySelectorAll('.resa-item[data-spot-id]').forEach(el => {
    el.addEventListener('click', () => onItemClick(el.dataset.spotId));
  });
}

function _categorize(reservations) {
  const present = [], waiting = [], walkin = [], absent = [], free = [];
  BEACH_CONFIG.spots.forEach(spot => {
    const r = reservations[spot.id];
    if (!r || r.status === 'free') {
      free.push(spot.id);
    } else if (r.status === 'present' && r.type === 'reserved') {
      present.push([spot.id, r]);
    } else if (r.status === 'present' && r.type === 'walkin') {
      walkin.push([spot.id, r]);
    } else if (r.status === 'reserved_waiting') {
      waiting.push([spot.id, r]);
    } else if (r.status === 'absent') {
      absent.push([spot.id, r]);
    }
  });
  const sortByTime = arr => arr.sort(([,a],[,b]) =>
    getTimeRemaining(a.checkinTime) - getTimeRemaining(b.checkinTime)
  );
  return { present: sortByTime(present), waiting, walkin: sortByTime(walkin), free, absent };
}

function _renderHeader(slot, presentCount, freeCount, walkinCount) {
  const now = new Date();
  const endMin = slot ? timeToMinutes(slot.end) : 0;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const remainMin = Math.max(0, endMin - nowMin);
  const countdownLabel = slot
    ? `En cours · se termine dans ${remainMin}min`
    : 'Aucun créneau actif';

  return `
    <div class="panel-header">
      <h2>${slot ? slot.label : 'Sélectionner un créneau'}</h2>
      <div class="slot-countdown">${countdownLabel}</div>
      <div class="panel-stats">
        <div class="stat-chip"><span class="stat-dot" style="background:var(--red)"></span>${presentCount + walkinCount} présents</div>
        <div class="stat-chip"><span class="stat-dot" style="background:var(--green)"></span>${freeCount} libres</div>
        <div class="stat-chip"><span class="stat-dot" style="background:var(--orange)"></span>${walkinCount} sans résa</div>
      </div>
    </div>
  `;
}

function _renderItem(spotId, resa) {
  const initials = `${(resa.prenom||'')[0]||''}${(resa.nom||'')[0]||''}`.toUpperCase();
  const avatarColor = resa.status === 'walkin' ? 'var(--orange)' : resa.status === 'absent' ? 'var(--purple)' : 'var(--red-dark)';
  let timerHtml = '';
  if (resa.checkinTime && (resa.status === 'present' || resa.status === 'walkin')) {
    const ms = getTimeRemaining(resa.checkinTime);
    const urgency = getUrgencyLevel(ms);
    timerHtml = `<div class="resa-timer ${urgency}">${formatCountdown(ms)}</div>`;
  } else if (resa.status === 'reserved_waiting') {
    timerHtml = `<div class="resa-timer muted">Pas arrivé·e</div>`;
  } else if (resa.status === 'absent') {
    timerHtml = `<div class="resa-timer muted">Absent·e</div>`;
  }
  const accompLabel = resa.accompagnants === 0 ? 'seul·e'
    : resa.accompagnants === 1 ? '1 accompagnant'
    : '2 accompagnants';

  return `
    <div class="resa-item" data-state="${resa.status}" data-spot-id="${spotId}">
      <div class="resa-avatar" style="background:${avatarColor}">${initials}</div>
      <div class="resa-info">
        <div class="resa-name">${resa.prenom} ${resa.nom}</div>
        <div class="resa-meta">${spotId} · ${accompLabel}</div>
      </div>
      <span class="spot-num">${spotId}</span>
      ${timerHtml}
    </div>
  `;
}

function _renderFreeItem(spotId) {
  return `
    <div class="resa-item" data-state="free" data-spot-id="${spotId}">
      <div class="resa-avatar" style="background:var(--green)">○</div>
      <div class="resa-info">
        <div class="resa-name">${spotId}</div>
        <div class="resa-meta">Disponible</div>
      </div>
      <span class="spot-num">${spotId}</span>
      <div class="resa-timer muted">Libre</div>
    </div>
  `;
}

function _renderLegend() {
  return `
    <div class="panel-legend">
      <div class="legend-item"><div class="legend-dot" style="background:var(--red)"></div>Présent (réservé)</div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--orange)"></div>Arrivée libre</div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--green)"></div>Libre</div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--amber)"></div>Réservé, pas arrivé</div>
    </div>
  `;
}

if (typeof module !== 'undefined') {
  module.exports = { renderPanel };
}
