'use strict';

var _mcCurrentData = null;

const MC_COLS = [
  { key: 'resa',          label: 'Usagers\nrésas',      auto: true  },
  { key: 'walkin',        label: 'Usagers\nsans résa',   auto: true  },
  { key: 'acc_total',     label: 'Accom-\npagnants',     auto: true  },
  { key: 'gpe_pers',      label: 'Groupes\npersonnes',   auto: true  },
  { key: 'gpe_acc',       label: 'Groupes\nacc.',        auto: true  },
  { key: 'tiralos',       label: 'Tiralos',              auto: false },
  { key: 'hippocampes',   label: 'Hippo-\ncampes',       auto: false },
  { key: 'audioplage',    label: 'Audio-\nplage',        auto: false },
  { key: 'transferts',    label: 'Trans-\nferts',        auto: false },
  { key: 'leve_personne', label: 'Lève-\npersonne',      auto: false },
];

function _fmtDateFr(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function _fmt(ts) {
  const d = new Date(ts);
  return String(d.getHours()).padStart(2,'0') + 'h' + String(d.getMinutes()).padStart(2,'0');
}
function _esc(s)     { return (s||'').replace(/"/g,'&quot;'); }
function _escHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'); }

async function renderMc(container, date) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const isToday  = date === todayISO;
  const data     = await getMcData(date);
  _mcCurrentData = data;

  // Auto-remplissage resa/walkin (depuis les données réelles du jour)
  await Promise.all(SLOTS.map(async s => {
    if (!_mcCurrentData.slots[s.id]) _mcCurrentData.slots[s.id] = _mcDefault().slots[s.id];
    try {
      const vals = Object.values(await getReservations(date, s.id));
      // Comptages groupes (dédupliqués par nom+prénom)
      const seenGroups = {};
      let gpe_pers = 0, gpe_acc = 0;
      vals.filter(r => r.resaType === 'groupe').forEach(r => {
        const key = ((r.nom || '') + '_' + (r.prenom || '')).toUpperCase();
        if (!seenGroups[key]) {
          seenGroups[key] = true;
          gpe_pers += r.nbUsagers || 0;
          gpe_acc  += r.accompagnants || 0;
        }
      });
      _mcCurrentData.slots[s.id].gpe_pers  = gpe_pers;
      _mcCurrentData.slots[s.id].gpe_acc   = gpe_acc;
      _mcCurrentData.slots[s.id].acc_total = vals.filter(r => r.resaType !== 'groupe').reduce((sum, r) => sum + (r.accompagnants || 0), 0);
      _mcCurrentData.slots[s.id].resa   = vals.filter(r => r.type === 'reserved' && r.resaType !== 'groupe').length;
      _mcCurrentData.slots[s.id].walkin = vals.filter(r => r.type === 'walkin').length;
    } catch (e) {
      // Laisse resa/walkin à 0 si le créneau échoue — n'interrompt pas le rendu
    }
  }));
  // Ne sauvegarder que si une MC existe déjà (évite de créer des entrées vides à la navigation)
  if (!_mcCurrentData._isNew) await saveMcData(date, _mcCurrentData);

  const st        = _mcCurrentData.staff;
  const policeCls = st.police         ? 'mc-toggle mc-toggle-oui' : 'mc-toggle mc-toggle-non';
  const plageCls  = st.plage_nettoyee ? 'mc-toggle mc-toggle-oui' : 'mc-toggle mc-toggle-non';
  const allDates  = await getMcDates();

  // ── Barre de navigation date ──
  let html = '<div class="mc-nav">'
    + '<button id="mc-nav-prev" class="mc-nav-btn">&#8592;</button>'
    + '<span class="mc-nav-label">' + _fmtDateFr(date) + '</span>'
    + '<button id="mc-nav-next" class="mc-nav-btn"' + (isToday ? ' disabled' : '') + '>&#8594;</button>'
    + (!isToday ? '<button id="mc-nav-today" class="mc-nav-return">↩ Aujourd\'hui</button>' : '')
    + '<button id="mc-nav-entretien" class="mc-nav-entretien-btn">Fiches d\'entretien</button>'
    + '<button id="mc-nav-list" class="mc-nav-list-btn"><img src="icone%20r%C3%A9server.svg" alt="" style="height:16px;width:16px;display:block;flex-shrink:0"> Historique'
    + (allDates.length > 0 ? ' (' + allDates.length + ')' : '') + '</button>'
    + '</div>';

  // ── Section staff ──
  html += '<div class="mc-staff">'
    + '<div class="mc-staff-main">'
    + '<div class="mc-staff-row">'
    +   '<span class="mc-staff-label">Entretien</span>'
    +   '<div class="mc-staff-inputs">'
    +     '<label class="mc-field-label">Matin<input type="text" class="mc-staff-inp" id="mc-ent-m" value="' + _esc(st.entretien_matin) + '" placeholder="Prénom Nom"></label>'
    +     '<label class="mc-field-label">Après-midi<input type="text" class="mc-staff-inp" id="mc-ent-a" value="' + _esc(st.entretien_aprem) + '" placeholder="Prénom Nom"></label>'
    +   '</div>'
    + '</div>'
    + '<div class="mc-staff-row">'
    +   '<span class="mc-staff-label">Accueil</span>'
    +   '<div class="mc-staff-inputs">'
    +     '<label class="mc-field-label">Matin<input type="text" class="mc-staff-inp" id="mc-acc-m" value="' + _esc(st.accueil_matin) + '" placeholder="Prénom Nom"></label>'
    +     '<label class="mc-field-label">Après-midi<input type="text" class="mc-staff-inp" id="mc-acc-a" value="' + _esc(st.accueil_aprem) + '" placeholder="Prénom Nom"></label>'
    +   '</div>'
    + '</div>'
    + '</div>'
    + '<div class="mc-staff-checks">'
    + '<div class="mc-check-row">'
    +   '<span class="mc-check-label">Passage de la police</span>'
    +   '<button class="' + policeCls + '" id="mc-toggle-police">' + (st.police ? 'OUI' : 'NON') + '</button>'
    + '</div>'
    + '<div class="mc-check-row">'
    +   '<span class="mc-check-label">Plage nettoyée par la ville</span>'
    +   '<button class="' + plageCls + '" id="mc-toggle-plage">' + (st.plage_nettoyee ? 'OUI' : 'NON') + '</button>'
    + '</div>'
    + '</div>'
    + '</div>';

  // ── Tableau (lignes = métriques, colonnes = créneaux, total en fin de ligne) ──
  html += '<div class="mc-table-wrap"><table class="mc-table"><thead><tr><th class="mc-row-header"></th>';
  SLOTS.forEach((s, si) => {
    const color = (typeof SLOT_COLORS !== 'undefined' && SLOT_COLORS[si]) || '#1565c0';
    html += '<th class="mc-slot-th" style="border-top:3px solid ' + color + ';color:' + color + '">' + s.label + '</th>';
  });
  html += '<th class="mc-total-th">Total</th></tr></thead><tbody>';

  MC_COLS.forEach(c => {
    let rowTotal = 0;
    html += '<tr><td class="mc-row-label">' + c.label.replace(/\n/g, '<br>') + '</td>';
    SLOTS.forEach(s => {
      const sd  = _mcCurrentData.slots[s.id] || {};
      const val = (sd[c.key] !== undefined ? sd[c.key] : 0);
      rowTotal += Number(val) || 0;
      if (c.auto) {
        html += '<td class="mc-auto-td" translate="no"><span class="mc-auto-val">' + val + '</span></td>';
      } else {
        html += '<td><input type="number" class="mc-count" min="0" value="' + val
          + '" data-slot="' + s.id + '" data-key="' + c.key + '" translate="no"></td>';
      }
    });
    html += '<td id="mc-tot-' + c.key + '" class="mc-total-cell" translate="no">' + rowTotal + '</td>';
    html += '</tr>';
  });
  html += '</tbody></table></div>';

  // ── Notes ──
  html += '<div class="mc-notes">'
    + '<div class="mc-notes-hd">Notes</div>'
    + '<div class="mc-notes-add">'
    +   '<input type="text" class="mc-note-reporter-inp" id="mc-note-reporter" placeholder="Qui rapporte ?">'
    +   '<textarea id="mc-note-inp" placeholder="Saisir une note ou un événement notable… (Entrée pour valider, Maj+Entrée pour saut de ligne)"></textarea>'
    +   '<button class="btn-primary" id="mc-note-add">＋ Ajouter</button>'
    + '</div>'
    + '<div id="mc-notes-list">' + _renderNotes(_mcCurrentData.notes) + '</div>'
    + '</div>';

  container.innerHTML = html;

  // ── Wiring staff ──
  const staffMap = { 'mc-ent-m':'entretien_matin', 'mc-ent-a':'entretien_aprem', 'mc-acc-m':'accueil_matin', 'mc-acc-a':'accueil_aprem' };
  Object.keys(staffMap).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', async () => {
      try {
        const d = _mcCurrentData;
        if (!d) return;
        d.staff[staffMap[id]] = el.value.trim();
        await saveMcData(date, d);
      } catch (e) {
        console.error('MC save error:', e);
      }
    });
  });

  // ── Wiring toggles ──
  [['mc-toggle-police', 'police'], ['mc-toggle-plage', 'plage_nettoyee']].forEach(([id, key]) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', async () => {
      try {
        const d = _mcCurrentData;
        if (!d) return;
        if (d.staff[key] === undefined) d.staff[key] = false;
        d.staff[key] = !d.staff[key];
        await saveMcData(date, d);
        btn.textContent = d.staff[key] ? 'OUI' : 'NON';
        btn.className   = d.staff[key] ? 'mc-toggle mc-toggle-oui' : 'mc-toggle mc-toggle-non';
      } catch (e) {
        console.error('MC save error:', e);
      }
    });
  });

  // ── Wiring compteurs ──
  container.querySelectorAll('input.mc-count').forEach(inp => {
    inp.addEventListener('input', async () => {
      try {
        const d = _mcCurrentData;
        if (!d) return;
        const slotId = parseInt(inp.dataset.slot);
        const key    = inp.dataset.key;
        if (!d.slots[slotId]) d.slots[slotId] = _mcDefault().slots[slotId];
        d.slots[slotId][key] = Math.max(0, parseInt(inp.value) || 0);
        await saveMcData(date, d);
        // Mise à jour de la cellule total de cette colonne
        const totEl = document.getElementById('mc-tot-' + key);
        if (totEl) {
          let total = 0;
          container.querySelectorAll('input.mc-count[data-key="' + key + '"]').forEach(i => {
            total += Math.max(0, parseInt(i.value) || 0);
          });
          totEl.textContent = total;
        }
      } catch (e) {
        console.error('MC save error:', e);
      }
    });
  });

  // ── Wiring notes ──
  const noteAddBtn = document.getElementById('mc-note-add');
  const noteInp    = document.getElementById('mc-note-inp');
  async function _addNote() {
    try {
      const text     = noteInp.value.trim();
      const reporter = (document.getElementById('mc-note-reporter') || {}).value || '';
      if (!text) return;
      const d = _mcCurrentData;
      if (!d) return;
      if (!d.notes) d.notes = [];
      d.notes.unshift({ ts: Date.now(), text, reporter: reporter.trim() });
      await saveMcData(date, d);
      noteInp.value = '';
      document.getElementById('mc-notes-list').innerHTML = _renderNotes(d.notes);
      _bindNoteDelete(date, container);
    } catch (e) {
      console.error('MC save error:', e);
    }
  }
  noteAddBtn.addEventListener('click', _addNote);
  noteInp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _addNote(); }
  });

  _bindNoteDelete(date, container);

  // ── Wiring nav ──
  const prevBtn = document.getElementById('mc-nav-prev');
  if (prevBtn) prevBtn.addEventListener('click', () => { if (container._onMcPrev) container._onMcPrev(); });
  const nextBtn = document.getElementById('mc-nav-next');
  if (nextBtn) nextBtn.addEventListener('click', () => { if (container._onMcNext) container._onMcNext(); });
  const todayBtn = document.getElementById('mc-nav-today');
  if (todayBtn) todayBtn.addEventListener('click', () => { if (container._onMcToday) container._onMcToday(); });

  const entretienBtn = document.getElementById('mc-nav-entretien');
  if (entretienBtn) {
    entretienBtn.addEventListener('click', () => {
      renderEntretien(container, () => renderMc(container, date));
    });
  }

  const listBtn = document.getElementById('mc-nav-list');
  if (listBtn) {
    listBtn.addEventListener('click', async () => {
      const existing = document.getElementById('mc-hist-dropdown');
      if (existing) { existing.remove(); return; }
      const dd = document.createElement('div');
      dd.id = 'mc-hist-dropdown';
      dd.className = 'mc-hist-dropdown';
      const dates = await getMcDates();
      if (dates.length === 0) {
        dd.innerHTML = '<div class="mc-hist-empty">Aucune main courante sauvegardée.</div>';
      } else {
        dd.innerHTML = dates.map(d =>
          '<button class="mc-hist-item' + (d === date ? ' mc-hist-active' : '') + '" data-date="' + d + '">'
          + _fmtDateFr(d) + '</button>'
        ).join('');
        dd.querySelectorAll('.mc-hist-item').forEach(btn => {
          btn.addEventListener('click', () => {
            if (container._onMcGoto) container._onMcGoto(btn.dataset.date);
            dd.remove();
          });
        });
      }
      listBtn.parentNode.appendChild(dd);
    });
  }
}

function _renderNotes(notes) {
  if (!notes || notes.length === 0) {
    return '<div class="planning-empty" style="padding:12px 0">Aucune note pour aujourd\'hui.</div>';
  }
  return notes.map((n, i) =>
    '<div class="mc-note-item">'
    + '<span class="mc-note-time">' + _fmt(n.ts) + '</span>'
    + (n.reporter ? '<span class="mc-note-reporter">' + _escHtml(n.reporter) + '</span>' : '')
    + '<span class="mc-note-text">' + _escHtml(n.text) + '</span>'
    + '<button class="mc-note-del" data-idx="' + i + '" title="Supprimer">✕</button>'
    + '</div>'
  ).join('');
}

function _bindNoteDelete(date, container) {
  container.querySelectorAll('.mc-note-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const d = _mcCurrentData;
        if (!d) return;
        d.notes.splice(parseInt(btn.dataset.idx), 1);
        await saveMcData(date, d);
        document.getElementById('mc-notes-list').innerHTML = _renderNotes(d.notes);
        _bindNoteDelete(date, container);
      } catch (e) {
        console.error('MC save error:', e);
      }
    });
  });
}

if (typeof module !== 'undefined') {
  module.exports = { renderMc };
}
