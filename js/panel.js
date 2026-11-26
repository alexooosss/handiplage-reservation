'use strict';

function _esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// container   : #side-panel element
// slot        : { id, label, start, end } or null
// reservations: { [spotId]: { nom, prenom, status, checkinTime, durationMs, ... } }
// waitingList : [{ nom, prenom, accompagnants, status }, ...] — from getReservationList()
// callbacks   : { onWalkin, onOpenPlanning, onMarkArrival(resa), onPlace(resa), onGroupCheckin, onPasVenu(resaId), onAnnule(resaId), onItemClick(spotId), onWaitingClick, onDepartedClick }
// Présentation : le temps au centre (anneau), « Sans réservation » comme action principale,
// les personnes à placer mises en avant, les présents avec la barre de leur temps restant.
function renderPanel(container, slot, reservations, waitingList, callbacks) {
  const { present, walkin, absent } = _categorizeSpots(reservations);
  const { arrived, waiting, pasVenus, annules } = _categorizeWaiting(waitingList);

  const _slotMs = r => (typeof resaEndMs === 'function') ? resaEndMs(r) : ((typeof slotEndMs === 'function' && r.slotId) ? slotEndMs(r.slotId) : 0);
  const sortByTime = arr => arr.sort(([,a],[,b]) => _slotMs(a) - _slotMs(b));
  const presentSorted = sortByTime([...present, ...walkin]);

  const presentCount = present.length + walkin.length;
  const freeCount    = BEACH_CONFIG.spots.filter(s => {
    const r = reservations[s.id];
    return !r || r.status === 'free' || r.status === 'departed';
  }).length;
  const dureeSlotMs = slot ? (timeToMinutes(slot.end) - timeToMinutes(slot.start)) * 60000 : 0;

  const nbSections = arrived.length + waiting.length + presentSorted.length + absent.length + pasVenus.length + annules.length;
  container.innerHTML = `
    ${_renderHeader(slot, presentCount, freeCount, waiting.length)}
    <div class="vp-actions">
      <button type="button" class="vp-walkin" id="btn-walkin">↓ Sans réservation</button>
      <button type="button" class="vp-planning" id="btn-ouvrir-planning">${_VP_ICO_CAL}Ouvrir le planning</button>
    </div>
    <div class="resa-list vp-liste">
      ${arrived.length ? `
        <section class="vp-carte vp-aplacer">
          <div class="vp-aplacer-t">${arrived.length} personne${arrived.length > 1 ? 's' : ''} à placer</div>
          ${arrived.map(r => _renderArrivedUnplacedItem(r, waitingList.indexOf(r))).join('')}
        </section>` : ''}
      ${waiting.length ? `
        <section class="vp-carte">
          <div class="vp-sec-t">En attente d'arrivée <span class="vp-compte">${waiting.length}</span></div>
          ${waiting.map(r => _renderWaitingItem(r, waitingList.indexOf(r), true)).join('')}
        </section>` : ''}
      ${presentSorted.length ? `
        <section class="vp-carte">
          <div class="vp-sec-t">Présents <span class="vp-compte">${presentSorted.length}</span></div>
          ${presentSorted.map(([id, r]) => _renderPresentItem(id, r, dureeSlotMs)).join('')}
        </section>` : ''}
      ${absent.length ? `
        <section class="vp-carte vp-discret">
          <div class="vp-sec-t">Absents <span class="vp-compte">${absent.length}</span></div>
          ${absent.map(([id, r]) => _renderAbsentItem(id, r)).join('')}
        </section>` : ''}
      ${pasVenus.length ? `
        <section class="vp-carte vp-discret">
          <div class="vp-sec-t">Pas venus <span class="vp-compte">${pasVenus.length}</span></div>
          ${pasVenus.map(r => _renderWaitingItem(r, waitingList.indexOf(r), false)).join('')}
        </section>` : ''}
      ${annules.length ? `
        <section class="vp-carte vp-discret">
          <div class="vp-sec-t">Annulés <span class="vp-compte">${annules.length}</span></div>
          ${annules.map(r => _renderWaitingItem(r, waitingList.indexOf(r), false)).join('')}
        </section>` : ''}
      ${nbSections === 0 ? `
        <div class="empty-state">
          <p>Aucune réservation pour ce créneau</p>
        </div>
      ` : ''}
    </div>
  `;

  document.getElementById('btn-walkin').addEventListener('click', callbacks.onWalkin);
  const bPlanning = document.getElementById('btn-ouvrir-planning');
  if (bPlanning) bPlanning.addEventListener('click', () => callbacks.onOpenPlanning && callbacks.onOpenPlanning());

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

const _VP_ICO_CAL = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';

function _vpInitiales(r) { return `${(r.prenom||'')[0]||''}${(r.nom||'')[0]||''}`.toUpperCase() || (r.nom || '?').slice(0, 2).toUpperCase(); }
function _vpAcc(n) { return n == null ? '' : n === 0 ? 'seul·e' : n === 1 ? '1 acc.' : n + ' acc.'; }
function _vpJoin(parts) { return parts.filter(p => p != null && p !== '' && !/undefined|null/.test(String(p))).join(' · '); }
// Temps restant lisible : « 44 min », « 1 h 05 »
function _vpTemps(ms) {
  const min = Math.ceil(ms / 60000);
  if (min <= 0) return 'Terminé';
  if (min < 60) return min + ' min';
  return Math.floor(min / 60) + ' h ' + String(min % 60).padStart(2, '0');
}

function _categorizeSpots(reservations) {
  const present = [], walkin = [], absent = [], departed = [];
  BEACH_CONFIG.spots.forEach(spot => {
    const r = reservations[spot.id];
    if (!r || r.status === 'free') return;
    if (r.status === 'departed') { present.push([spot.id, r]); return; }
    if (r.status === 'absent')   { absent.push([spot.id, r]);  return; }
    if (r.type === 'walkin')     { walkin.push([spot.id, r]);  return; }
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

// En-tête : anneau du temps restant, créneau, trois chiffres
function _renderHeader(slot, presentCount, freeCount, waitingCount) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  let restant = 0, part = 0, etat = '';
  if (slot) {
    const debut = timeToMinutes(slot.start), fin = timeToMinutes(slot.end);
    restant = Math.max(0, Math.ceil(fin - nowMin));
    if (nowMin < debut) { etat = 'à venir'; part = 0; restant = fin - debut; }
    else if (nowMin >= fin) { etat = 'terminé'; part = 1; }
    else { part = (nowMin - debut) / (fin - debut); }
  }
  // L'anneau se vide au fil du créneau : la partie colorée = le temps qui reste
  const pctReste = Math.round((1 - part) * 100);
  const centre = !slot ? '–' : etat === 'terminé' ? '0' : restant >= 60 ? Math.floor(restant / 60) + 'h' + String(restant % 60).padStart(2, '0') : String(restant);
  const unite = !slot || etat === 'terminé' ? 'fini' : restant >= 60 ? '' : 'min';
  return `
    <div class="vp-carte vp-hd">
      <div class="vp-anneau" style="--p:${pctReste}%" role="img" aria-label="${slot ? (etat === 'terminé' ? 'Créneau terminé' : etat === 'à venir' ? 'Créneau à venir' : 'Reste ' + restant + ' minutes') : 'Aucun créneau'}">
        <div><b>${centre}</b>${unite ? `<small>${unite}</small>` : ''}</div>
      </div>
      <div class="vp-hd-txt">
        <h2>${slot ? slot.label : 'Sélectionner un créneau'}</h2>
        ${etat === 'à venir' ? '<div class="vp-etat">Créneau à venir</div>' : etat === 'terminé' ? '<div class="vp-etat">Créneau terminé</div>' : ''}
        <div class="vp-meta panel-stats">
          <span class="stat-chip"><b>${waitingCount}</b> attendus</span>
          <span class="stat-chip"><b>${presentCount}</b> présents</span>
          <span class="stat-chip vp-libres"><b>${freeCount}</b> libres</span>
        </div>
      </div>
    </div>
  `;
}

function _renderArrivedUnplacedItem(resa, index) {
  const isGroupe = resa.resaType === 'groupe';
  const detail = _vpJoin([
    isGroupe ? (resa.nbUsagers || 1) + ' empl.' : _vpAcc(resa.accompagnants),
    resa.type === 'walkin' ? 'sans résa' : 'réservé',
    resa.checkinTime ? new Date(resa.checkinTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
  ]);
  return `
    <div class="resa-item vp-ligne arrived-unplaced-item" data-index="${index}">
      <div class="resa-avatar vp-av vert">${_vpInitiales(resa)}</div>
      <div class="resa-info">
        <div class="resa-name">${_esc(resa.nom)} ${_esc(resa.prenom)}</div>
        <div class="resa-meta">${_esc(detail)}</div>
      </div>
      ${isGroupe
        ? `<button class="vp-btn vp-placer btn-accueil-groupe" data-index="${index}">Placer</button>`
        : `<button class="vp-btn vp-placer btn-place" data-index="${index}">Placer</button>`}
    </div>
  `;
}

function _renderWaitingItem(resa, index, showActions) {
  const isGroupe = resa.resaType === 'groupe';
  const detail = _vpJoin([
    isGroupe ? (resa.nbUsagers || 1) + ' empl. · groupe' : 'réservation',
    resa.status === 'pas_venu' ? 'pas venu·e' : resa.status === 'annule' ? 'annulé·e' : '',
  ]);
  const couleur = (resa.status === 'pas_venu' || resa.status === 'annule') ? 'gris' : isGroupe ? 'violet' : 'ambre';
  const actions = showActions ? `
    <div class="vp-actions-l">
      ${isGroupe
        ? `<button class="vp-btn vp-arrivee btn-accueil-groupe" data-index="${index}">Accueillir</button>`
        : `<button class="vp-btn vp-arrivee btn-arrive" data-index="${index}">✓ Arrivée</button>`}
      <button class="vp-btn vp-petit btn-pas-venu" data-index="${index}">Pas venu</button>
      <button class="vp-btn vp-petit btn-annule" data-index="${index}">Annuler</button>
    </div>
  ` : '';
  return `
    <div class="resa-item vp-ligne waiting-item${showActions ? ' vp-attendu' : ''}" data-index="${index}">
      <div class="vp-ligne-l">
        <div class="resa-avatar vp-av ${couleur}">${_vpInitiales(resa)}</div>
        <div class="resa-info">
          <div class="resa-name">${_esc(resa.nom)} ${_esc(resa.prenom)}</div>
          <div class="resa-meta">${_esc(detail)}</div>
        </div>
      </div>
      ${actions}
    </div>
  `;
}

function _renderPresentItem(spotId, resa, dureeSlotMs) {
  const sansResa = resa.type === 'walkin';
  const ms = (typeof resaEndMs === 'function') ? resaEndMs(resa) : ((typeof slotEndMs === 'function' && resa.slotId) ? slotEndMs(resa.slotId) : 0);
  const urgence = getUrgencyLevel(ms);
  const duree = (typeof resaDureeMs === 'function' && resaDureeMs(resa)) || dureeSlotMs;
  const pct = duree > 0 ? Math.max(0, Math.min(100, Math.round(ms / duree * 100))) : 0;
  const deux = typeof resaFinSlotId === 'function' ? resaFinSlotId(resa) !== resa.slotId : resa.nbCreneaux > 1;
  const detail = _vpJoin([spotId, _vpAcc(resa.accompagnants), sansResa ? 'sans résa' : '', deux ? '2 créneaux' : '']);
  return `
    <div class="resa-item vp-ligne vp-present" data-state="${resa.status}" data-spot-id="${spotId}">
      <div class="vp-ligne-l">
        <div class="resa-avatar vp-av ${sansResa ? 'orange' : 'bleu'}">${_vpInitiales(resa)}</div>
        <div class="resa-info">
          <div class="resa-name">${_esc(resa.nom)} ${_esc(resa.prenom)}</div>
          <div class="resa-meta">${_esc(detail)}</div>
        </div>
        <div class="vp-temps ${urgence}">${_vpTemps(ms)}</div>
      </div>
      <div class="vp-barre"><i class="${sansResa ? 'orange' : ''} ${urgence}" style="width:${pct}%"></i></div>
    </div>
  `;
}

function _renderDepartedItem(spotId, resa) {
  return `
    <div class="resa-item vp-ligne departed-item" data-state="departed" data-spot-id="${spotId}">
      <div class="vp-ligne-l">
        <div class="resa-avatar vp-av gris">${_vpInitiales(resa)}</div>
        <div class="resa-info">
          <div class="resa-name">${_esc(resa.nom)} ${_esc(resa.prenom)}</div>
          <div class="resa-meta">${_esc(_vpJoin([spotId, _vpAcc(resa.accompagnants)]))}</div>
        </div>
        <div class="vp-temps muted">Parti·e</div>
      </div>
    </div>
  `;
}

function _renderAbsentItem(spotId, resa) {
  return `
    <div class="resa-item vp-ligne" data-state="absent" data-spot-id="${spotId}">
      <div class="vp-ligne-l">
        <div class="resa-avatar vp-av gris">${_vpInitiales(resa)}</div>
        <div class="resa-info">
          <div class="resa-name">${_esc(resa.nom)} ${_esc(resa.prenom)}</div>
          <div class="resa-meta">${_esc(spotId)} · absent·e</div>
        </div>
      </div>
    </div>
  `;
}

if (typeof module !== 'undefined') {
  module.exports = { renderPanel };
}
