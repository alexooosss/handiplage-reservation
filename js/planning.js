'use strict';

const SLOT_COLORS = ['#1565c0', '#2e7d32', '#e65100', '#6a1b9a', '#f9a825'];

// Returns Monday of the current week + offset weeks, as Date
function _weekStart(offset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff + offset * 7);
  return monday;
}

// Returns array of 7 Date objects (Mon–Sun) for the week starting at weekStart
function _weekDays(weekStart) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push(d);
  }
  return days;
}

// Returns ISO date string YYYY-MM-DD for a Date
function _isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Format a date as "Lun\n23" (short weekday + date number)
function _formatDayHeader(d) {
  const weekday = d.toLocaleDateString('fr-FR', { weekday: 'short' });
  // Capitalize first letter, remove trailing dot if present
  const wd = weekday.charAt(0).toUpperCase() + weekday.slice(1).replace(/\.$/, '');
  return `${wd} ${d.getDate()}`;
}

// Format week range label: "Lun 23 – Dim 29 juin 2026"
function _formatWeekLabel(days) {
  const first = days[0];
  const last  = days[6];
  const firstWd = first.toLocaleDateString('fr-FR', { weekday: 'short' });
  const lastWd  = last.toLocaleDateString('fr-FR', { weekday: 'short' });
  const fwd = firstWd.charAt(0).toUpperCase() + firstWd.slice(1).replace(/\.$/, '');
  const lwd = lastWd.charAt(0).toUpperCase() + lastWd.slice(1).replace(/\.$/, '');
  const month = last.toLocaleDateString('fr-FR', { month: 'long' });
  const year  = last.getFullYear();
  return `${fwd} ${first.getDate()} – ${lwd} ${last.getDate()} ${month} ${year}`;
}

// Renders the weekly planning grid into container
// weekOffset: 0=current week, -1=previous, +1=next
// onCellClick(dateISO, slot) called when a cell is clicked
// Défilement de semaine, en deux temps et dans la vraie grille (rien ne se superpose) :
// 1. les colonnes des jours de la semaine affichée partent une à une (pendant le chargement de la suivante) ;
// 2. la nouvelle semaine s'affiche et ses colonnes arrivent une à une de l'autre côté.
// La colonne des créneaux reste fixe.
const _PL_SORTIE = 320, _PL_ENTREE = 420, _PL_DECALAGE = 45;   // millisecondes

function _plReduit() {
  return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function _plCascade(grille, classe, sens) {
  const colonnes = [];                                            // ordre des jours dans la grille
  grille.querySelectorAll('[data-date]').forEach(el => {
    let i = colonnes.indexOf(el.dataset.date);
    if (i < 0) { colonnes.push(el.dataset.date); i = colonnes.length - 1; }
    const rang = sens === 'suiv' ? i : 6 - i;                     // la colonne du côté du mouvement part la première
    el.style.animationDelay = (rang * _PL_DECALAGE) + 'ms';
    el.classList.add(classe);
  });
}

// Étape 1 : renvoie une promesse résolue quand l'ancienne semaine est sortie
function _plSortieSemaine(container, sens) {
  const grille = container.querySelector('.planning-grid');
  if (!grille || _plReduit()) return Promise.resolve();
  container.classList.add('pl-anim');
  container.style.setProperty('--pl-dist', Math.round(grille.offsetWidth * 0.5) + 'px');
  _plCascade(grille, 'pl-sort-' + sens, sens);
  return new Promise(r => setTimeout(r, _PL_SORTIE + 6 * _PL_DECALAGE));
}

// Étape 2 : la nouvelle semaine vient d'être affichée, ses colonnes arrivent
function _plEntreeSemaine(container, sens) {
  const grille = container.querySelector('.planning-grid');
  if (!grille) return;
  if (_plReduit()) { container.classList.remove('pl-anim'); grille.classList.add('pl-fondu'); return; }
  const id = (container._plAnimId || 0) + 1;
  container._plAnimId = id;
  container.classList.add('pl-anim');
  container.style.setProperty('--pl-dist', Math.round(grille.offsetWidth * 0.5) + 'px');
  _plCascade(grille, 'pl-entre-' + sens, sens);
  setTimeout(() => {
    if (container._plAnimId !== id || !grille.isConnected) return;   // une autre semaine a été demandée entre-temps
    container.classList.remove('pl-anim');
    grille.querySelectorAll('[data-date]').forEach(el => {
      el.classList.remove('pl-entre-suiv', 'pl-entre-prec');
      el.style.animationDelay = '';
    });
  }, _PL_ENTREE + 6 * _PL_DECALAGE + 80);
}

async function renderPlanning(container, weekOffset, onCellClick) {
  const todayISO = _isoDate(new Date());
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const ws           = _weekStart(weekOffset);
  const days         = _weekDays(ws);
  const weekStartISO = _isoDate(ws);
  const weekEndISO   = _isoDate(days[6]);
  // Changement de semaine : l'ancienne part pendant que la nouvelle se charge
  const sens = container._sensSemaine;
  container._sensSemaine = null;
  const sortie = sens ? _plSortieSemaine(container, sens) : null;
  const [counts, fermetures, capaRows] = await Promise.all([
    getWeekReservationCounts(weekStartISO, weekEndISO),
    typeof getFermetures === 'function' ? getFermetures(weekStartISO, weekEndISO).catch(() => []) : Promise.resolve([]),
    typeof getCapacites === 'function' ? getCapacites(weekStartISO, weekEndISO).catch(() => []) : Promise.resolve([]),
  ]);
  const capaIndex = typeof indexCapacites === 'function' ? indexCapacites(capaRows) : {};
  container._capaIndex = capaIndex;
  const groupesCache = typeof getCachedGroupes === 'function' ? getCachedGroupes() : [];

  // Bandeau : réservation en cours pour un groupe (lancée depuis l'onglet Groupes)
  const gp = window._hpGroupePreselect;
  const bannerHtml = gp
    ? '<div class="plan-groupe-banner" id="plan-groupe-banner" role="status">'
      + '<span>Réservation pour le groupe <b>' + String(gp.nom).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</b> : choisissez un créneau dans le planning.</span>'
      + '<button type="button" id="plan-groupe-cancel">Annuler</button></div>'
    : '';

  // Nav bar
  const navHtml = bannerHtml + `
    <div class="nb planning-nav">
      <button type="button" id="btn-plan-prev" class="nb-arrow" title="Semaine précédente" aria-label="Semaine précédente">&#8592;</button>
      <div class="nb-centre">
        <span class="nb-date">${_formatWeekLabel(days)}</span>
        ${weekOffset === 0
          ? '<span class="nb-today">Cette semaine</span>'
          : '<button type="button" id="btn-plan-today" class="nb-back">↩ Revenir à cette semaine</button>'}
      </div>
      <button type="button" id="btn-plan-next" class="nb-arrow" title="Semaine suivante" aria-label="Semaine suivante">&#8594;</button>
    </div>
  `;

  // Grid header row (empty corner + 7 day headers)
  let gridHtml = `<div class="planning-grid">`;
  gridHtml += `<div class="planning-grid-header"></div>`; // corner

  days.forEach(d => {
    const iso     = _isoDate(d);
    const isToday = iso === todayISO;
    const jourModifie = SLOTS.some(s => capaIndex[iso + '_' + s.id]);
    gridHtml += '<button type="button" class="planning-grid-header pgh-btn' + (isToday ? ' today' : '') + (jourModifie ? ' pgh-modif' : '') + '"'
      + ' data-date="' + iso + '" aria-haspopup="menu" title="Régler les places de la journée"' + (isToday ? ' aria-current="date"' : '') + '>'
      + (isToday ? '<span class="pgh-today-tag">Aujourd\'hui</span>' : '')
      + '<span>' + _formatDayHeader(d) + '</span>'
      + '<span class="pgh-regler">Places ▾</span>'
      + '</button>';
  });

  // Créneau en cours (seulement si la semaine affichée contient aujourd'hui)
  const weekHasToday = days.some(d => _isoDate(d) === todayISO);
  const nowDate      = new Date();
  // En cours ; sinon (entre deux créneaux / avant l'ouverture) : le prochain de la journée
  const runningSlot  = weekHasToday ? SLOTS.find(s => getSlotStatus(s, nowDate) === 'active') : null;
  const nextSlot     = weekHasToday && !runningSlot ? SLOTS.find(s => getSlotStatus(s, nowDate) === 'upcoming') : null;
  const activeSlot   = runningSlot || nextSlot || null;
  const nowTag       = runningSlot ? 'En cours' : 'À suivre';

  // Slot rows
  SLOTS.forEach((slot, slotIdx) => {
    const slotEndParts = slot.end.split(':').map(Number);
    const color = SLOT_COLORS[slotIdx] || '#1565c0';
    const isNowRow = !!activeSlot && activeSlot.id === slot.id;

    // Slot label — coloré par créneau ; plein + « En cours » pour le créneau actuel
    if (isNowRow) {
      const txt = slotIdx === 4 ? '#0f1b2e' : '#ffffff'; // jaune → texte foncé pour le contraste
      gridHtml += `<div class="planning-slot-label now-row${runningSlot ? '' : ' is-next'}${slotIdx === 4 ? ' is-jaune' : ''}"${runningSlot ? ' aria-current="time"' : ''} style="--slot-c:${color};background:${color};color:${txt}">`
               +   `<span class="psl-now-tag">${nowTag}</span><span>${slot.label}</span></div>`;
    } else {
      gridHtml += `<div class="planning-slot-label" style="border-left:3px solid ${color};background:${color}18;color:${color}">${slot.label}</div>`;
    }

    // Day cells
    days.forEach(d => {
      const iso     = _isoDate(d);
      const isToday = iso === todayISO;
      const isPast  = d < now || (isToday && (() => {
        const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
        return nowMinutes >= slotEndParts[0] * 60 + slotEndParts[1];
      })());

      const slotCounts = (counts[iso] && counts[iso][slot.id]) || { waiting_normal: 0, waiting_groupe: 0, arrived_reserved: 0, arrived_groupe: 0, walkins: 0 };
      const cntN       = slotCounts.waiting_normal + slotCounts.arrived_reserved;
      const cntG       = slotCounts.waiting_groupe + (slotCounts.arrived_groupe || 0);
      const walkins    = slotCounts.walkins;

      let classes = 'planning-cell';
      if (isToday) classes += ' today-col';
      if (isPast)  classes += ' past';
      // Créneau en cours : seule la case d'aujourd'hui est mise en avant
      if (isNowRow && isToday) classes += runningSlot ? ' now-cell' : ' now-cell is-next';
      // Plage fermée sur ce créneau (déclarée dans la main courante)
      const fermeCell = typeof creneauFerme === 'function' ? creneauFerme(fermetures, iso, slot.id) : null;
      if (fermeCell) classes += ' ferme-cell';

      // Places du créneau (réglage ponctuel ou capacité normale)
      const cap  = typeof capaciteDe === 'function' ? capaciteDe(capaIndex, iso, slot.id)
                 : { usagers: CAPACITY_NORMAL, groupes: CAPACITY_GROUPE, modifie: false };
      const capN = cap.usagers, capG = cap.groupes;
      const nCls = cntN > capN ? 'phalf-count full over' : cntN >= capN ? 'phalf-count full'
                 : cntN >= capN * 0.8 ? 'phalf-count warn' : 'phalf-count';
      const gCls = cntG > capG ? 'phalf-count full over' : cntG >= capG ? 'phalf-count full'
                 : cntG >= capG * 0.8 ? 'phalf-count warn' : 'phalf-count';
      // Étiquette quand le créneau a été réglé
      let capTag = '';
      if (cap.modifie) {
        const grp = cap.groupeId ? groupesCache.find(g => g.id === cap.groupeId) : null;
        if (cntN > capN && capN > 0)              capTag = '<span class="capa-tag capa-over">Limite dépassée</span>';
        else if (capN === 0)                     capTag = '<span class="capa-tag capa-off">Fermé en ligne</span>';
        else if (grp)                            capTag = '<span class="capa-tag capa-grp" title="Places groupes réservées pour ' + String(grp.nom).replace(/"/g, '&quot;') + '">' + String(grp.nom).replace(/</g, '&lt;') + '</span>';
        else if (capN > CAPA_DEFAUT.totale - CAPA_DEFAUT.groupes) capTag = '<span class="capa-tag capa-plus">+ ouvert</span>';
        else                                     capTag = '<span class="capa-tag capa-lim">Limité</span>';
        classes += ' capa-modif';
      }
      const nSty = nCls === 'phalf-count' ? 'color:' + color : '';

      const walkinHtml = walkins > 0
        ? '<div class="phalf-walkin-box"><span class="phalf-walkin-count" translate="no">' + walkins + '</span><span class="phalf-walkin-label">Sans réservation</span></div>'
        : '';

      // Les compteurs sont mis via textContent après rendu pour éviter tout problème d'interprétation
      gridHtml += '<div class="' + classes + '" data-date="' + iso + '" data-slot-id="' + slot.id + '"'
        + (fermeCell ? ' title="Plage fermée' + (fermeCell.motif ? ' : ' + String(fermeCell.motif).replace(/"/g, '&quot;') : '') + '"' : '')
        + ' style="--slot-c:' + color + ';border-top:3px solid ' + (isToday ? 'transparent' : color) + '">'
        + (fermeCell ? '<span class="ferme-tag">Fermé</span>' : capTag)
        + '<div class="phalf-row">'
        + '<div class="phalf" style="background:' + color + '0d">'
        + '<span class="' + nCls + '" style="' + nSty + '" translate="no" data-cnt="' + cntN + '" data-cap="' + capN + '"></span>'
        + '<span class="phalf-label">Réservations</span>'
        + '</div>'
        + '<div class="phalf-div"></div>'
        + '<div class="phalf phalf-groupe">'
        + '<span class="' + gCls + '" translate="no" data-cnt="' + cntG + '" data-cap="' + capG + '"></span>'
        + '<span class="phalf-label">Groupes</span>'
        + '</div>'
        + '</div>'
        + walkinHtml
        + '</div>';
    });
  });

  gridHtml += `</div>`;

  if (sortie) await sortie;                                          // l'ancienne semaine a fini de partir
  container.innerHTML = navHtml + gridHtml;
  if (sens) _plEntreeSemaine(container, sens);

  // Remplissage des compteurs via textContent
  container.querySelectorAll('span[data-cnt]').forEach(function(el) {
    var cnt = el.getAttribute('data-cnt');
    var cap = el.getAttribute('data-cap');
    el.textContent = cnt + '/' + cap;
  });

  // Wire nav buttons (dispatch event up to app.js via callbacks stored on container)
  document.getElementById('btn-plan-prev').addEventListener('click', () => {
    if (container._onPrev) container._onPrev();
  });
  document.getElementById('btn-plan-next').addEventListener('click', () => {
    if (container._onNext) container._onNext();
  });
  const gpCancel = document.getElementById('plan-groupe-cancel');
  if (gpCancel) gpCancel.addEventListener('click', () => {
    window._hpGroupePreselect = null;
    const b = document.getElementById('plan-groupe-banner');
    if (b) b.remove();
  });

  container.querySelectorAll('.pgh-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof ouvrirMenuJournee === 'function') ouvrirMenuJournee(btn, btn.dataset.date, capaIndex, () => { if (container._onCapacite) container._onCapacite(); });
    });
  });

  const planTodayBtn = document.getElementById('btn-plan-today');
  if (planTodayBtn) planTodayBtn.addEventListener('click', () => {
    if (container._onToday) container._onToday();
  });

  // Wire cell clicks
  container.querySelectorAll('.planning-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const dateISO = cell.dataset.date;
      const slotId  = parseInt(cell.dataset.slotId);
      const slot    = SLOTS.find(s => s.id === slotId);
      if (slot && onCellClick) onCellClick(dateISO, slot);
    });
  });
}

// ── Export PDF d'un créneau ──
// Mêmes listes que la fenêtre du créneau : Réservations (attendues + placées), Sans réservation
// (placées ou non), Groupes (en emplacements). capa : places du créneau (réglage du jour ou normal).
async function exportSlotPDF(dateISO, slot, capa) {
  const [list, spots] = await Promise.all([
    getReservationList(dateISO, slot.id),
    getReservations(dateISO, slot.id),
  ]);
  const CAP_N = (capa && capa.usagers != null) ? capa.usagers : CAPACITY_NORMAL;
  const CAP_G = (capa && capa.groupes != null) ? capa.groupes : CAPACITY_GROUPE;

  const actives  = list.filter(r => r.status !== 'annule');
  const placees  = Object.entries(spots).filter(([spotId]) => spotId && spotId !== 'null').map(([spotId, r]) => Object.assign({}, r, { _spot: spotId }));
  const estNormal = r => !r.resaType || r.resaType === 'normal';

  // Réservations : en attente (pas encore placées) + arrivées et placées
  const reservations = actives.filter(r => r.type !== 'walkin' && estNormal(r)).map(r => Object.assign({}, r, { _spot: null }))
    .concat(placees.filter(r => r.type === 'reserved' && estNormal(r) && r.status !== 'annule'));
  // Sans réservation : placées + arrivées pas encore placées
  const walkins = placees.filter(r => r.type === 'walkin')
    .concat(actives.filter(r => r.type === 'walkin').map(r => Object.assign({}, r, { _spot: null })));
  // Groupes : en attente (n emplacements) + arrivés (une ligne par groupe, avec ses emplacements)
  const groupesAttente = actives.filter(r => r.type !== 'walkin' && r.resaType === 'groupe');
  const groupesPlaces = {};
  placees.filter(r => r.resaType === 'groupe').forEach(r => {
    const k = String(r.nom || '').toUpperCase();
    (groupesPlaces[k] = groupesPlaces[k] || { nom: r.nom, spots: [], checkinTime: r.checkinTime, status: r.status }).spots.push(r._spot);
  });
  const groupes = groupesAttente.map(r => ({ nom: r.nom, empl: r.nbUsagers || 1, spots: [], status: r.status }))
    .concat(Object.values(groupesPlaces).map(g => ({ nom: g.nom, empl: g.spots.length, spots: g.spots, checkinTime: g.checkinTime, status: 'present' })));
  const emplGroupes = groupes.reduce((s, g) => s + g.empl, 0);

  const tri = (a, b) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr') || String(a.prenom || '').localeCompare(String(b.prenom || ''), 'fr');
  reservations.sort(tri); walkins.sort(tri); groupes.sort(tri);

  const dateObj = new Date(dateISO + 'T12:00:00');
  const dateFr  = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const cap     = s => s.charAt(0).toUpperCase() + s.slice(1);
  const acc     = n => n == null ? '—' : n === 0 ? 'Seul·e' : n === 1 ? '1' : String(n);
  const heure   = ts => { if (!ts) return '—'; const d = new Date(ts); return String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0'); };
  const now     = new Date();
  const genTime = now.toLocaleDateString('fr-FR') + ' à ' + heure(now.getTime());
  const ep = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const statut = r => {
    if (r.status === 'pas_venu' || r.status === 'absent') return '<span class="st rouge">Pas venu·e</span>';
    if (r.status === 'departed') return '<span class="st gris">Parti·e</span>';
    if (r._spot || r.status === 'present' || r.status === 'walkin') return r._spot ? '<span class="st vert">Arrivé·e</span>' : '<span class="st orange">À placer</span>';
    return '<span class="st bleu">Attendu·e</span>';
  };
  const idxSlot = SLOTS.findIndex(s => s.id === slot.id);
  const couleur = (typeof SLOT_COLORS !== 'undefined' && SLOT_COLORS[idxSlot]) || '#05559b';
  const nbAcc = reservations.concat(walkins).reduce((s, r) => s + (Number(r.accompagnants) || 0), 0);

  const ligne = (r, i) => '<tr>'
    + '<td class="num">' + (i + 1) + '</td>'
    + '<td class="nom"><b>' + ep(String(r.nom || '').toUpperCase()) + '</b> ' + ep(r.prenom) + '</td>'
    + '<td class="c">' + acc(r.accompagnants) + '</td>'
    + '<td>' + statut(r) + '</td>'
    + '<td class="c spot">' + ep(r._spot || '—') + '</td>'
    + '<td class="c">' + heure(r.checkinTime) + '</td>'
    + '</tr>';
  const ligneGroupe = (g, i) => '<tr>'
    + '<td class="num">' + (i + 1) + '</td>'
    + '<td class="nom"><b>' + ep(g.nom) + '</b></td>'
    + '<td class="c">' + g.empl + '</td>'
    + '<td>' + (g.spots.length ? '<span class="st vert">Arrivé·e</span>' : '<span class="st bleu">Attendu</span>') + '</td>'
    + '<td class="c spot">' + ep(g.spots.join(', ') || '—') + '</td>'
    + '<td class="c">' + heure(g.checkinTime) + '</td>'
    + '</tr>';
  const vide = '<tr><td colspan="6" class="vide">Personne</td></tr>';
  const tete = (col3) => '<thead><tr><th class="num">#</th><th>Nom</th><th class="c">' + col3 + '</th><th>Statut</th><th class="c">Emplacement</th><th class="c">Arrivée</th></tr></thead>';
  const section = (titre, compte, corps, col3) => '<section><h3><span>' + titre + '</span><em>' + compte + '</em></h3>'
    + '<table><colgroup><col style="width:6%"><col style="width:34%"><col style="width:11%"><col style="width:19%"><col style="width:17%"><col style="width:13%"></colgroup>' + tete(col3 || 'Accomp.') + '<tbody>' + corps + '</tbody></table></section>';

  const html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">'
    + '<title>Handiplage – ' + slot.label + ' · ' + cap(dateFr) + '</title>'
    + '<style>'
    + '*{margin:0;padding:0;box-sizing:border-box}'
    + 'body{font-family:"Segoe UI",system-ui,Arial,sans-serif;font-size:10.5pt;color:#0f1b2e;background:#fff}'
    + '@page{margin:1.5cm 1.6cm;size:A4 portrait}'
    + '.wrap{max-width:780px;margin:0 auto;padding:24px 0}'
    + '.hdr{display:flex;align-items:center;gap:16px;padding-bottom:16px;margin-bottom:18px;border-bottom:1px solid #e2e8f0}'
    + '.hdr img{height:34px;width:auto}'
    + '.titre{flex:1;border-left:6px solid ' + couleur + ';padding-left:12px}'
    + '.titre h1{font-size:18pt;font-weight:800;line-height:1.1}'
    + '.titre p{font-size:10pt;color:#5b6576;margin-top:3px;font-weight:600}'
    + '.chiffres{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}'
    + '.ch{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px}'
    + '.ch small{display:block;font-size:8.5pt;color:#5b6576;font-weight:600}'
    + '.ch b{display:block;font-size:20pt;font-weight:800;line-height:1.15}'
    + '.ch b span{font-size:10pt;color:#5b6576;font-weight:700}'
    + '.ch em{display:block;font-style:normal;font-size:8pt;color:#5b6576}'
    + 'section{margin-bottom:18px;page-break-inside:auto}'
    + 'h3{display:flex;align-items:center;justify-content:space-between;font-size:9pt;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#5b6576;margin-bottom:6px}'
    + 'h3 em{font-style:normal;font-size:9pt;background:#eef2f6;color:#3b4658;border-radius:999px;padding:1px 9px;letter-spacing:0}'
    + 'table{width:100%;border-collapse:collapse;font-size:9.5pt;table-layout:fixed}'
    + 'thead th{text-align:left;font-size:8pt;font-weight:800;color:#5b6576;text-transform:uppercase;letter-spacing:.05em;padding:6px 8px;border-bottom:1.5px solid #cbd5e1}'
    + 'tbody td{padding:7px 8px;border-bottom:1px solid #edf1f5;vertical-align:middle}'
    + 'tbody tr{page-break-inside:avoid}'
    + '.num{width:28px;color:#94a3b8;text-align:center}'
    + '.c{text-align:center}'
    + '.spot{font-weight:800;color:#05559b}'
    + '.vide{text-align:center;color:#94a3b8;font-style:italic;padding:12px}'
    + '.st{display:inline-block;font-size:8pt;font-weight:800;padding:2px 8px;border-radius:999px;white-space:nowrap}'
    + '.st.vert{background:#e8f5e9;color:#1b5e20}.st.bleu{background:#eaf2fb;color:#05559b}.st.orange{background:#fff4e5;color:#8a4b00}.st.rouge{background:#ffebee;color:#c62828}.st.gris{background:#eef2f6;color:#4a5568}'
    + '.pied{margin-top:24px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:8pt;color:#94a3b8;display:flex;justify-content:space-between}'
    + '.imprimer{position:fixed;top:14px;right:14px;background:#05559b;color:#fff;border:none;border-radius:999px;padding:10px 20px;font:inherit;font-size:11pt;font-weight:800;cursor:pointer;box-shadow:0 4px 12px rgba(5,85,155,.3)}'
    + '@media print{.imprimer{display:none}.wrap{padding:0}}'
    + '</style></head><body>'
    + '<button class="imprimer" onclick="window.print()">Imprimer / Enregistrer en PDF</button>'
    + '<div class="wrap">'
    + '<div class="hdr">'
    +   '<img src="' + new URL('logo-handiplage-mot-bleu.svg', document.baseURI).href + '" alt="Handiplage">'
    +   '<div class="titre"><h1>' + slot.label + '</h1><p>' + cap(dateFr) + '</p></div>'
    + '</div>'
    + '<div class="chiffres">'
    +   '<div class="ch"><small>Réservations</small><b>' + reservations.length + '<span>/' + CAP_N + '</span></b><em>' + Math.max(0, CAP_N - reservations.length) + ' places restantes</em></div>'
    +   '<div class="ch"><small>Sans réservation</small><b>' + walkins.length + '</b><em>venues sur place</em></div>'
    +   '<div class="ch"><small>Groupes</small><b>' + emplGroupes + '<span>/' + CAP_G + '</span></b><em>' + groupes.length + ' groupe' + (groupes.length > 1 ? 's' : '') + '</em></div>'
    +   '<div class="ch"><small>Usagers</small><b>' + (reservations.length + walkins.length) + '</b><em>+ ' + nbAcc + ' accompagnant' + (nbAcc > 1 ? 's' : '') + '</em></div>'
    + '</div>'
    + section('Réservations', reservations.length + ' / ' + CAP_N, reservations.length ? reservations.map(ligne).join('') : vide)
    + section('Sans réservation', walkins.length, walkins.length ? walkins.map(ligne).join('') : vide)
    + section('Groupes', emplGroupes + ' / ' + CAP_G, groupes.length ? groupes.map(ligneGroupe).join('') : vide, 'Empl.')
    + '<div class="pied"><span>Handiplage · CCAS d\'Antibes</span><span>Généré le ' + genTime + '</span></div>'
    + '</div></body></html>';

  const win = window.open('', '_blank', 'width=900,height=760');
  if (!win) { alert('Autorisez les popups pour exporter en PDF.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
}
