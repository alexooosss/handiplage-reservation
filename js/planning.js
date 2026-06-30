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
function renderPlanning(container, weekOffset, onCellClick) {
  const todayISO = _isoDate(new Date());
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const ws   = _weekStart(weekOffset);
  const days = _weekDays(ws);

  // Nav bar
  const navHtml = `
    <div class="planning-nav">
      <button id="btn-plan-prev">&#8592;</button>
      <span class="planning-nav-label">${_formatWeekLabel(days)}</span>
      <button id="btn-plan-next">&#8594;</button>
    </div>
  `;

  // Grid header row (empty corner + 7 day headers)
  let gridHtml = `<div class="planning-grid">`;
  gridHtml += `<div class="planning-grid-header"></div>`; // corner

  days.forEach(d => {
    const iso     = _isoDate(d);
    const isToday = iso === todayISO;
    gridHtml += `<div class="planning-grid-header${isToday ? ' today' : ''}">${_formatDayHeader(d)}</div>`;
  });

  // Slot rows
  SLOTS.forEach((slot, slotIdx) => {
    const slotEndParts = slot.end.split(':').map(Number);
    const color = SLOT_COLORS[slotIdx] || '#1565c0';

    // Slot label — coloré par créneau
    gridHtml += `<div class="planning-slot-label" style="border-left:3px solid ${color};background:${color}18;color:${color}">${slot.label}</div>`;

    // Day cells
    days.forEach(d => {
      const iso     = _isoDate(d);
      const isToday = iso === todayISO;
      const isPast  = d < now || (isToday && (() => {
        const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
        return nowMinutes >= slotEndParts[0] * 60 + slotEndParts[1];
      })());

      const list      = getReservationList(iso, slot.id);
      const spotVals  = Object.values(getReservations(iso, slot.id));
      const presences = spotVals.filter(r => r.type === 'reserved').length;
      const walkins   = spotVals.filter(r => r.type === 'walkin').length;
      // Décompte usagers = en attente (liste) + déjà arrivés (assignés à un spot)
      const cntN      = list.filter(r => !r.resaType || r.resaType === 'normal').length + presences;
      const cntG      = list.filter(r => r.resaType === 'groupe').length;

      let classes = 'planning-cell';
      if (isToday) classes += ' today-col';
      if (isPast)  classes += ' past';

      const nCls = cntN >= CAPACITY_NORMAL ? 'phalf-count full'
                 : cntN >= CAPACITY_NORMAL * 0.8 ? 'phalf-count warn' : 'phalf-count';
      const gCls = cntG >= CAPACITY_GROUPE ? 'phalf-count full'
                 : cntG >= CAPACITY_GROUPE * 0.8 ? 'phalf-count warn' : 'phalf-count';
      const nSty = nCls === 'phalf-count' ? 'color:' + color : '';

      const walkinHtml = walkins > 0
        ? '<div class="phalf-walkin-box"><span class="phalf-walkin-count" translate="no">' + walkins + '</span><span class="phalf-walkin-label">🚶 Sans résa</span></div>'
        : '';

      // Les compteurs sont mis via textContent après rendu pour éviter tout problème d'interprétation
      gridHtml += '<div class="' + classes + '" data-date="' + iso + '" data-slot-id="' + slot.id + '" style="border-top:3px solid ' + color + '">'
        + '<div class="phalf-row">'
        + '<div class="phalf" style="background:' + color + '0d">'
        + '<span class="' + nCls + '" style="' + nSty + '" translate="no" data-cnt="' + cntN + '" data-cap="' + CAPACITY_NORMAL + '"></span>'
        + '<span class="phalf-label">Réservations</span>'
        + '</div>'
        + '<div class="phalf-div"></div>'
        + '<div class="phalf phalf-groupe">'
        + '<span class="' + gCls + '" translate="no" data-cnt="' + cntG + '" data-cap="' + CAPACITY_GROUPE + '"></span>'
        + '<span class="phalf-label">Groupes</span>'
        + '</div>'
        + '</div>'
        + walkinHtml
        + '</div>';
    });
  });

  gridHtml += `</div>`;

  container.innerHTML = navHtml + gridHtml;

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
function exportSlotPDF(dateISO, slot) {
  const list   = getReservationList(dateISO, slot.id);
  const spots  = getReservations(dateISO, slot.id);

  const normal  = list.filter(r => !r.resaType || r.resaType === 'normal');
  const groupes = list.filter(r => r.resaType === 'groupe');
  const walkins = Object.entries(spots).filter(([, r]) => r.type === 'walkin');

  // Repère les emplacements assignés (type reserved) pour les croiser avec la liste
  const assignedByName = {};
  Object.entries(spots).forEach(([spotId, r]) => {
    if (r.type === 'reserved') {
      assignedByName[(r.nom + r.prenom).replace(/\s/g,'').toUpperCase()] = spotId;
    }
  });

  const dateObj = new Date(dateISO + 'T12:00:00');
  const dateFr  = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const cap     = s => s.charAt(0).toUpperCase() + s.slice(1);
  const acc     = n => n === 0 ? 'Seul·e' : n === 1 ? '1 acc.' : n + ' acc.';
  const now     = new Date();
  const genTime = now.toLocaleDateString('fr-FR') + ' à '
    + String(now.getHours()).padStart(2,'0') + 'h' + String(now.getMinutes()).padStart(2,'0');

  const mkRow = (r, i, withSpot) => {
    const spot = withSpot
      ? assignedByName[(r.nom + r.prenom).replace(/\s/g,'').toUpperCase()] || '—'
      : null;
    return '<tr>'
      + '<td class="num">' + (i + 1) + '</td>'
      + '<td>' + r.nom + ' ' + r.prenom + '</td>'
      + '<td>' + acc(r.accompagnants) + '</td>'
      + (withSpot ? '<td class="spot">' + spot + '</td>' : '')
      + '</tr>';
  };

  const mkWalkinRow = ([spotId, r], i) =>
    '<tr>'
    + '<td class="num">' + (i + 1) + '</td>'
    + '<td>' + r.prenom + ' ' + r.nom + '</td>'
    + '<td>' + acc(r.accompagnants) + '</td>'
    + '<td class="spot">' + spotId + '</td>'
    + '</tr>';

  const emptyRow = cols => '<tr><td colspan="' + cols + '" class="empty">Aucune entrée</td></tr>';

  const sectionNormal = normal.length === 0 ? emptyRow(4)
    : normal.map((r, i) => mkRow(r, i, true)).join('');
  const sectionGroupes = groupes.length === 0 ? emptyRow(3)
    : groupes.map((r, i) => mkRow(r, i, false)).join('');
  const sectionWalkins = walkins.length === 0 ? emptyRow(4)
    : walkins.map((entry, i) => mkWalkinRow(entry, i)).join('');

  const html = '<!DOCTYPE html><html lang="fr"><head>'
    + '<meta charset="UTF-8">'
    + '<title>Handiplage – ' + slot.label + ' · ' + dateFr + '</title>'
    + '<style>'
    + '* { margin:0; padding:0; box-sizing:border-box; }'
    + 'body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #1a2340; padding: 0; }'
    + '@page { margin: 1.8cm 2cm; size: A4 portrait; }'
    + '.wrap { max-width: 780px; margin: 0 auto; padding: 24px 0; }'
    + '.hdr { border-bottom: 3px solid #0055a4; padding-bottom: 14px; margin-bottom: 20px; display:flex; align-items:center; gap:14px; }'
    + '.hdr-logo { height: 56px; width: auto; display:block; }'
    + 'h2 { font-size: 13pt; font-weight: 700; margin-top: 6px; color: #1a2340; }'
    + '.summary { display: flex; gap: 14px; margin-bottom: 22px; }'
    + '.sbox { flex:1; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; text-align:center; }'
    + '.sbox .n { font-size: 24pt; font-weight: 900; color: #0055a4; display:block; line-height:1.1; }'
    + '.sbox .l { font-size: 8.5pt; color: #64748b; margin-top:2px; display:block; }'
    + '.sbox.hi { background:#f0f6ff; border-color:#0055a4; }'
    + '.sec { margin-bottom: 22px; }'
    + '.sec-title { font-size: 11.5pt; font-weight: 800; color: #0055a4; padding-bottom: 5px; border-bottom: 2px solid #e2e8f0; margin-bottom: 8px; }'
    + 'table { width:100%; border-collapse:collapse; font-size: 10pt; }'
    + 'thead th { background:#0055a4; color:#fff; padding: 7px 10px; text-align:left; font-weight:700; }'
    + 'tbody tr:nth-child(even) { background:#f8fafc; }'
    + 'tbody td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }'
    + 'td.num { text-align:center; color:#94a3b8; width:34px; }'
    + 'td.spot { text-align:center; color:#0055a4; font-weight:700; width:90px; }'
    + 'td.empty { text-align:center; color:#94a3b8; font-style:italic; padding: 12px; }'
    + '.footer { margin-top:28px; padding-top:10px; border-top:1px solid #e2e8f0; font-size:8pt; color:#94a3b8; display:flex; justify-content:space-between; }'
    + '.print-btn { position:fixed; top:14px; right:14px; background:#0055a4; color:#fff; border:none; border-radius:8px; padding:9px 18px; font-size:11pt; font-weight:700; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.2); }'
    + '@media print { .print-btn { display:none; } }'
    + '</style></head><body>'
    + '<button class="print-btn" onclick="window.print()">🖨️ Imprimer / Enregistrer PDF</button>'
    + '<div class="wrap">'
    + '<div class="hdr"><img class="hdr-logo" src="' + (typeof LOGO_B64 !== 'undefined' ? LOGO_B64 : '') + '" alt="Handiplage"><div>'
    + '<h2 style="margin-top:0">' + slot.label + ' · ' + cap(dateFr) + '</h2>'
    + '</div></div>'
    + '<div class="summary">'
    + '<div class="sbox hi"><span class="n">' + normal.length + '</span><span class="l">Réservations inscrites</span></div>'
    + '<div class="sbox"><span class="n">' + groupes.length + '</span><span class="l">Groupes</span></div>'
    + '<div class="sbox"><span class="n">' + walkins.length + '</span><span class="l">Sans réservation</span></div>'
    + '<div class="sbox"><span class="n">' + (normal.length + groupes.length + walkins.length) + '</span><span class="l">Total</span></div>'
    + '</div>'
    + '<div class="sec"><div class="sec-title">👤 Réservations (' + normal.length + ' / ' + CAPACITY_NORMAL + ')</div>'
    + '<table><thead><tr><th>#</th><th>Nom Prénom</th><th>Accompagnants</th><th>Emplacement</th></tr></thead>'
    + '<tbody>' + sectionNormal + '</tbody></table></div>'
    + (groupes.length > 0
        ? '<div class="sec"><div class="sec-title">👥 Groupes (' + groupes.length + ' / ' + CAPACITY_GROUPE + ')</div>'
          + '<table><thead><tr><th>#</th><th>Référent</th><th>Accompagnants</th></tr></thead>'
          + '<tbody>' + sectionGroupes + '</tbody></table></div>'
        : '')
    + (walkins.length > 0
        ? '<div class="sec"><div class="sec-title">🚶 Sans réservation (' + walkins.length + ')</div>'
          + '<table><thead><tr><th>#</th><th>Nom Prénom</th><th>Accompagnants</th><th>Emplacement</th></tr></thead>'
          + '<tbody>' + sectionWalkins + '</tbody></table></div>'
        : '')
    + '<div class="footer"><span>Handiplage Juan-les-Pins · Antibes</span><span>Généré le ' + genTime + '</span></div>'
    + '</div></body></html>';

  const win = window.open('', '_blank', 'width=900,height=760');
  if (!win) { alert('Autorisez les popups pour exporter en PDF.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
}
