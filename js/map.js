'use strict';

// Rend les éléments statiques : tapis PMR, douches (appelé une seule fois)
function renderMapStatic(container) {
  const cfg = BEACH_CONFIG;

  // Tapis horizontaux
  cfg.tapisH.forEach(t => {
    const el = document.createElement('div');
    el.className = 'tapis-h';
    el.style.top = `${t.y}px`;
    container.appendChild(el);
  });

  // Tapis verticaux
  cfg.tapisV.forEach(t => {
    const el = document.createElement('div');
    el.className = 'tapis-v';
    el.style.left = `${t.x}px`;
    if (t.top !== undefined) {
      el.style.top    = `${t.top}px`;
      el.style.bottom = 'auto';
      el.style.height = `${t.height}px`;
    }
    container.appendChild(el);
  });

  // Douches
  cfg.showers.forEach(s => {
    const el = document.createElement('div');
    el.className = 'shower-marker';
    el.style.left = `${s.x}px`;
    el.style.top  = `${s.y}px`;
    el.title = s.label;
    el.textContent = '🚿';
    container.appendChild(el);
  });

  // Taille du conteneur
  container.style.width  = `${cfg.mapWidth}px`;
  container.style.height = `${cfg.mapHeight}px`;
}

// Rend ou met à jour tous les spots selon l'état des réservations
// reservations : { [spotId]: { nom, prenom, status, checkinTime, ... } }
function renderMapSpots(container, reservations, onSpotClick, selectionMode) {
  BEACH_CONFIG.spots.forEach(spot => {
    let el = container.querySelector(`[data-spot-id="${spot.id}"]`);
    const resa = reservations[spot.id];
    const state = (resa && resa.status !== 'departed') ? resa.status : 'free';

    if (!el) {
      // Création initiale
      el = document.createElement('div');
      el.className = 'spot';
      el.dataset.spotId = spot.id;
      el.style.left = `${spot.x - BEACH_CONFIG.spotSize / 2}px`;
      el.style.top  = `${spot.y - BEACH_CONFIG.spotSize / 2}px`;
      el.style.width  = `${BEACH_CONFIG.spotSize}px`;
      el.style.height = `${BEACH_CONFIG.spotSize}px`;
      el.addEventListener('click', () => onSpotClick(spot.id));
      container.appendChild(el);
    }

    // Mise à jour de l'état
    el.dataset.state = state;
    el.dataset.selectable = (selectionMode && state === 'free') ? 'true' : 'false';
    el.title = resa ? `${resa.prenom} ${resa.nom}` : spot.label;

    // Contenu (initiales ou numéro)
    const label = _spotLabel(spot, resa);
    const badge = _timerBadge(resa);
    el.innerHTML = label + badge;
  });
}

function _spotLabel(spot, resa) {
  if (!resa || resa.status === 'free') {
    return `<span style="position:relative;z-index:1">${spot.id}</span>`;
  }
  if (resa.status === 'reserved_waiting') {
    return `<span style="position:relative;z-index:1">⏳</span>`;
  }
  if (resa.status === 'absent') {
    return `<span style="position:relative;z-index:1">✕</span>`;
  }
  // present ou walkin → initiales
  const initials = `${(resa.prenom || '')[0] || ''}${(resa.nom || '')[0] || ''}`.toUpperCase();
  return `<span style="position:relative;z-index:1">${initials || '?'}</span>`;
}

function _timerBadge(resa) {
  if (!resa || !resa.checkinTime || (resa.status !== 'present' && resa.status !== 'walkin')) return '';
  const ms = getTimeRemaining(resa.checkinTime, resa.durationMs);
  const urgency = getUrgencyLevel(ms);
  const cssClass = urgency === 'critical' ? 'critical' : '';
  return `<span class="timer-badge ${cssClass}">${formatCountdown(ms)}</span>`;
}

if (typeof module !== 'undefined') {
  module.exports = { renderMapStatic, renderMapSpots };
}
