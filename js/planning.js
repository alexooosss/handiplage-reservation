'use strict';

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
  SLOTS.forEach(slot => {
    // Determine if slot is in the past for today (used to grey out today's past slots)
    const slotEndParts = slot.end.split(':').map(Number);

    // Slot label cell
    gridHtml += `<div class="planning-slot-label">${slot.label}</div>`;

    // Day cells
    days.forEach(d => {
      const iso     = _isoDate(d);
      const isToday = iso === todayISO;
      const isPast  = d < now || (isToday && (() => {
        const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
        return nowMinutes >= slotEndParts[0] * 60 + slotEndParts[1];
      })());

      const list  = getReservationList(iso, slot.id);
      const count = list.length;

      let classes = 'planning-cell';
      if (isToday) classes += ' today-col';
      if (isPast)  classes += ' past';

      const countClass = count > 0 ? 'planning-cell-count has-resas' : 'planning-cell-count';

      gridHtml += `
        <div class="${classes}" data-date="${iso}" data-slot-id="${slot.id}">
          <span class="${countClass}">${count}</span>
          <span class="planning-cell-sub">rés.</span>
        </div>
      `;
    });
  });

  gridHtml += `</div>`;

  container.innerHTML = navHtml + gridHtml;

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
