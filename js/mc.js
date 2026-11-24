'use strict';

var _mcCurrentData = null;
var _mcMatSlot     = {};     // créneau choisi dans la zone « Matériel », par date
var _mcEditOuv     = false;  // bloc d'ouverture rouvert via « Modifier »

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

// Libellés sur une ligne pour la zone matériel
const MC_MAT_LABELS = {
  tiralos: 'Tiralo', hippocampes: 'Hippocampe', audioplage: 'Audioplage',
  transferts: 'Transfert', leve_personne: 'Lève-personne',
};

const MC_REPORTER_KEY = 'hp_mc_reporter';

function _fmtDateFr(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function _fmt(ts) {
  const d = new Date(ts);
  return String(d.getHours()).padStart(2,'0') + 'h' + String(d.getMinutes()).padStart(2,'0');
}
function _esc(s)     { return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function _escHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'); }

function _mcTodayISO() {
  if (typeof getTodayISO === 'function') return getTodayISO();
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Enregistre en notant l'heure : l'abonnement temps réel ignore nos propres enregistrements
function _mcSave(date, d) {
  window._mcLocalSaveAt = Date.now();
  return saveMcData(date, d);
}

function _lsGet(k)    { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
function _lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

// Heure de début de l'après-midi : premier créneau qui commence à partir de 12h
function _mcApremStart() {
  const s = SLOTS.find(sl => timeToMinutes(sl.start) >= 12 * 60);
  return s ? timeToMinutes(s.start) : 12 * 60 + 30;
}

// Créneau proposé par défaut dans la zone matériel
function _mcDefaultSlot(isToday) {
  if (!isToday) return SLOTS[0].id;
  const now = new Date();
  const run  = SLOTS.find(s => getSlotStatus(s, now) === 'active');
  const next = SLOTS.find(s => getSlotStatus(s, now) === 'upcoming');
  return (run || next || SLOTS[SLOTS.length - 1]).id;
}

function _mcPolicePassages(d) {
  return (d.notes || []).filter(n => n.type === 'police').sort((a, b) => a.ts - b.ts);
}

// Compatibilité : « police » = au moins un passage daté (ou ancien oui/non)
function _mcSyncPolice(d) {
  d.staff.police = _mcPolicePassages(d).length > 0;
}

async function renderMc(container, date) {
  const todayISO = _mcTodayISO();
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
  if (!_mcCurrentData._isNew) await _mcSave(date, _mcCurrentData);

  const st       = _mcCurrentData.staff;
  const allDates = await getMcDates();
  if (!_mcMatSlot[date]) _mcMatSlot[date] = _mcDefaultSlot(isToday);
  const matSlot  = _mcMatSlot[date];

  const nowMin     = new Date().getHours() * 60 + new Date().getMinutes();
  const apremOuvert = !isToday || nowMin >= _mcApremStart();
  // Anciennes journées déjà remplies : considérées comme ouvertes
  const ouvFaite   = !!st.ouverture_validee
    || (!isToday && !!(st.entretien_matin || st.accueil_matin || st.plage_nettoyee));

  // ── Barre de navigation date ──
  let html = '<div class="nb mc-nav">'
    + '<button type="button" id="mc-nav-prev" class="nb-arrow" title="Jour précédent" aria-label="Jour précédent">&#8592;</button>'
    + '<span class="nb-date">' + _fmtDateFr(date) + '</span>'
    + '<button type="button" id="mc-nav-next" class="nb-arrow' + (isToday ? ' ghost' : '') + '" title="Jour suivant" aria-label="Jour suivant"' + (isToday ? ' disabled tabindex="-1"' : '') + '>&#8594;</button>'
    + (isToday
        ? '<span class="nb-today">Aujourd\'hui</span>'
        : '<button type="button" id="mc-nav-today" class="nb-back">↩ Revenir à aujourd\'hui</button>')
    + '<span class="nb-sp"></span>'
    + '<button type="button" id="mc-nav-entretien" class="nb-sec">Fiches d\'entretien</button>'
    + '<button type="button" id="mc-nav-list" class="nb-sec" aria-haspopup="dialog" aria-expanded="false">Historique <span aria-hidden="true">▾</span></button>'
    + '</div>';

  // ── 1. Ouverture de la journée ──
  const plageBtns = (val) =>
      '<div class="mc-seg" role="group" aria-label="Plage nettoyée par la ville">'
    +   '<button type="button" class="mc-seg-btn' + (val ? ' on' : '') + '" data-plage="1" aria-pressed="' + !!val + '">Oui</button>'
    +   '<button type="button" class="mc-seg-btn' + (!val ? ' on' : '') + '" data-plage="0" aria-pressed="' + !val + '">Non</button>'
    + '</div>';

  if (!ouvFaite || _mcEditOuv) {
    html += '<section class="mc-card mc-ouv" aria-labelledby="mc-ouv-title">'
      + '<div class="mc-card-hd"><h2 id="mc-ouv-title">Ouverture de la journée</h2>'
      +   '<p class="mc-card-sub">À remplir une fois, en début de journée.</p></div>'
      + '<div class="mc-ouv-grid">'
      +   '<label class="mc-big-field"><span>Entretien — matin</span><input type="text" class="mc-staff-inp" id="mc-ent-m" value="' + _esc(st.entretien_matin) + '" placeholder="Prénom Nom" autocomplete="off"></label>'
      +   '<label class="mc-big-field"><span>Accueil — matin</span><input type="text" class="mc-staff-inp" id="mc-acc-m" value="' + _esc(st.accueil_matin) + '" placeholder="Prénom Nom" autocomplete="off"></label>'
      +   '<div class="mc-big-field"><span>Plage nettoyée par la ville</span>' + plageBtns(st.plage_nettoyee) + '</div>'
      + '</div>'
      + (apremOuvert
          ? '<div class="mc-ouv-grid mc-ouv-aprem">'
            + '<label class="mc-big-field"><span>Entretien — après-midi</span><input type="text" class="mc-staff-inp" id="mc-ent-a" value="' + _esc(st.entretien_aprem) + '" placeholder="Prénom Nom" autocomplete="off"></label>'
            + '<label class="mc-big-field"><span>Accueil — après-midi</span><input type="text" class="mc-staff-inp" id="mc-acc-a" value="' + _esc(st.accueil_aprem) + '" placeholder="Prénom Nom" autocomplete="off"></label>'
            + '</div>'
          : '')
      + '<div class="mc-ouv-actions">'
      +   '<button type="button" class="mc-btn-primary" id="mc-ouv-valider">' + (ouvFaite ? 'Enregistrer' : 'Valider l\'ouverture') + '</button>'
      +   (ouvFaite ? '<button type="button" class="mc-btn-ghost" id="mc-ouv-annuler">Annuler</button>' : '')
      + '</div>'
      + '</section>';
  } else {
    const nom = v => v ? '<span class="mc-nom">' + _escHtml(v) + '</span>' : '<em class="mc-vide">—</em>';
    const apremRempli = !!(st.entretien_aprem && st.accueil_aprem);
    const releveAFaire = apremOuvert && !apremRempli;

    // Une seule bande « Équipe du jour » : matin | après-midi | plage | Modifier
    html += '<section class="mc-card mc-equipe" aria-label="Équipe du jour">'
      + '<span class="mc-ouv-ok" aria-hidden="true">✓</span>'
      + '<div class="mc-equipe-grp"><span class="mc-equipe-titre">Matin</span>'
      +   '<span><b>Entretien</b> ' + nom(st.entretien_matin) + '</span>'
      +   '<span><b>Accueil</b> ' + nom(st.accueil_matin) + '</span></div>'
      + (apremRempli
          ? '<div class="mc-equipe-grp"><span class="mc-equipe-titre">Après-midi</span>'
            + '<span><b>Entretien</b> ' + nom(st.entretien_aprem) + '</span>'
            + '<span><b>Accueil</b> ' + nom(st.accueil_aprem) + '</span></div>'
          : '')
      + '<div class="mc-equipe-grp"><span class="mc-equipe-titre">Plage nettoyée</span>'
      +   '<span class="mc-plage-etat' + (st.plage_nettoyee ? ' oui' : '') + '">' + (st.plage_nettoyee ? 'Oui' : 'Non') + '</span></div>'
      + '<button type="button" class="mc-btn-link" id="mc-ouv-modifier">Modifier</button>'
      + '</section>';

    // Relève de l'après-midi : seulement tant qu'elle reste à saisir
    if (releveAFaire) {
      html += '<section class="mc-card mc-releve" aria-label="Relève de l\'après-midi">'
        + '<span class="mc-releve-titre">Relève de l\'après-midi</span>'
        + '<label class="mc-inline-field">Entretien<input type="text" class="mc-staff-inp" id="mc-ent-a" value="' + _esc(st.entretien_aprem) + '" placeholder="Prénom Nom" autocomplete="off"></label>'
        + '<label class="mc-inline-field">Accueil<input type="text" class="mc-staff-inp" id="mc-acc-a" value="' + _esc(st.accueil_aprem) + '" placeholder="Prénom Nom" autocomplete="off"></label>'
        + '</section>';
    }
  }

  // ── 2. Maintenant : matériel + police + note ──
  const sd = _mcCurrentData.slots[matSlot] || {};
  html += '<div class="mc-now">';

  html += '<section class="mc-card mc-mat" aria-labelledby="mc-mat-title">'
    + '<div class="mc-card-hd mc-card-hd-row"><h2 id="mc-mat-title">Matériel utilisé</h2></div>'
    + '<div class="mc-mat-slots" role="group" aria-label="Créneau">'
    + SLOTS.map((s, si) => {
        const status = isToday ? getSlotStatus(s, new Date()) : 'past';
        const tag = isToday && status === 'active' ? '<span class="mc-mat-now">en cours</span>' : '';
        return '<button type="button" class="mc-mat-slot' + (s.id === matSlot ? ' on' : '') + '" data-slot="' + s.id + '" aria-pressed="' + (s.id === matSlot) + '"'
          + ' style="--slot-c:' + ((typeof SLOT_COLORS !== 'undefined' && SLOT_COLORS[si]) || '#1565c0') + '">'
          + s.label.split(' – ')[0] + tag + '</button>';
      }).join('')
    + '</div>'
    + '<div class="mc-mat-list">'
    + MC_COLS.filter(c => !c.auto).map(c => {
        const v = Number(sd[c.key]) || 0;
        return '<div class="mc-step" data-key="' + c.key + '">'
          + '<span class="mc-step-label">' + MC_MAT_LABELS[c.key] + '</span>'
          + '<button type="button" class="mc-step-btn" data-delta="-1" aria-label="Retirer un ' + MC_MAT_LABELS[c.key] + '"' + (v <= 0 ? ' disabled' : '') + '>−</button>'
          + '<output class="mc-step-val" translate="no" aria-live="polite">' + v + '</output>'
          + '<button type="button" class="mc-step-btn plus" data-delta="1" aria-label="Ajouter un ' + MC_MAT_LABELS[c.key] + '">+</button>'
          + '</div>';
      }).join('')
    + '</div>'
    + '</section>';

  const passages = _mcPolicePassages(_mcCurrentData);
  const lastReporter = _lsGet(MC_REPORTER_KEY);
  html += '<div class="mc-now-side">'
    + '<section class="mc-card mc-police" aria-labelledby="mc-police-title">'
    +   '<div class="mc-card-hd"><h2 id="mc-police-title">Police</h2></div>'
    +   '<button type="button" class="mc-btn-police" id="mc-police-add">＋ Passage de la police</button>'
    +   '<p class="mc-police-list">' + (passages.length
          ? 'Passages : ' + passages.map(p => '<b>' + _fmt(p.ts) + '</b>').join(', ')
          : (st.police ? 'Passage signalé (sans heure)' : 'Aucun passage pour l\'instant.')) + '</p>'
    + '</section>'
    + '<section class="mc-card mc-note-rapide" aria-labelledby="mc-note-title">'
    +   '<div class="mc-card-hd"><h2 id="mc-note-title">Ajouter une note</h2></div>'
    +   '<input type="text" class="mc-note-reporter-inp" id="mc-note-reporter" placeholder="Qui rapporte ?" value="' + _esc(lastReporter) + '" autocomplete="off">'
    +   '<textarea id="mc-note-inp" rows="3" placeholder="Événement, incident, remarque… (Entrée pour valider, Maj+Entrée pour aller à la ligne)"></textarea>'
    +   '<button type="button" class="mc-btn-primary" id="mc-note-add">Ajouter la note</button>'
    + '</section>'
    + '</div>';

  html += '</div>'; // .mc-now

  // ── 3. Journal du jour ──
  html += '<section class="mc-card mc-notes" aria-labelledby="mc-journal-title">'
    + '<div class="mc-card-hd"><h2 id="mc-journal-title">Journal du jour</h2></div>'
    + '<div id="mc-notes-list">' + _renderNotes(_mcCurrentData.notes) + '</div>'
    + '</section>';

  // ── 4. Récap (lecture seule) ──
  html += '<details class="mc-card mc-recap"' + (isToday ? '' : ' open') + '>'
    + '<summary><span>Récap de la journée</span><span class="mc-recap-hint">tous les créneaux</span></summary>'
    + '<div class="mc-table-wrap"><table class="mc-table"><thead><tr><th class="mc-row-header"></th>';
  SLOTS.forEach((s, si) => {
    const color = (typeof SLOT_COLORS !== 'undefined' && SLOT_COLORS[si]) || '#1565c0';
    // Fond clair teinté + texte de la couleur du créneau (jaune / orange assombris pour rester lisibles)
    const txt = si === 4 ? '#8a5a00' : si === 2 ? '#bf360c' : color;
    html += '<th class="mc-slot-th" style="border-top:3px solid ' + color + ';background:' + color + '14;color:' + txt + '">' + s.label + '</th>';
  });
  html += '<th class="mc-total-th">Total</th></tr></thead><tbody>';

  MC_COLS.forEach(c => {
    let rowTotal = 0;
    html += '<tr' + (c.auto ? ' class="mc-row-auto"' : '') + '><td class="mc-row-label">' + c.label.replace(/\n/g, ' ') + '</td>';
    SLOTS.forEach(s => {
      const v = Number((_mcCurrentData.slots[s.id] || {})[c.key]) || 0;
      rowTotal += v;
      html += '<td translate="no" id="mc-cell-' + s.id + '-' + c.key + '"' + (v === 0 ? ' class="mc-zero"' : '') + '>' + v + '</td>';
    });
    html += '<td id="mc-tot-' + c.key + '" class="mc-total-cell" translate="no">' + rowTotal + '</td></tr>';
  });
  html += '</tbody></table></div></details>';

  container.innerHTML = html;

  // ── Wiring : noms (enregistrés en quittant le champ) ──
  const staffMap = { 'mc-ent-m':'entretien_matin', 'mc-ent-a':'entretien_aprem', 'mc-acc-m':'accueil_matin', 'mc-acc-a':'accueil_aprem' };
  Object.keys(staffMap).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', async () => {
      try {
        const d = _mcCurrentData;
        if (!d) return;
        const v = el.value.trim();
        if (d.staff[staffMap[id]] === v) return;
        d.staff[staffMap[id]] = v;
        await _mcSave(date, d);
        // Relève complète : la ligne orange se replie dans la bande « Équipe du jour »
        if (container.querySelector('.mc-releve') && d.staff.entretien_aprem && d.staff.accueil_aprem) {
          renderMc(container, date).catch(console.error);
        }
      } catch (e) {
        console.error('MC save error:', e);
      }
    });
  });

  // ── Wiring : plage nettoyée (Oui / Non) ──
  container.querySelectorAll('.mc-seg-btn[data-plage]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const d = _mcCurrentData;
        if (!d) return;
        d.staff.plage_nettoyee = btn.dataset.plage === '1';
        container.querySelectorAll('.mc-seg-btn[data-plage]').forEach(b => {
          const on = (b.dataset.plage === '1') === d.staff.plage_nettoyee;
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', on);
        });
        await _mcSave(date, d);
      } catch (e) {
        console.error('MC save error:', e);
      }
    });
  });

  // ── Wiring : valider / modifier l'ouverture ──
  const rerender = () => renderMc(container, date).catch(console.error);
  const ouvValider = document.getElementById('mc-ouv-valider');
  if (ouvValider) {
    ouvValider.addEventListener('click', async () => {
      try {
        const d = _mcCurrentData;
        Object.keys(staffMap).forEach(id => {
          const el = document.getElementById(id);
          if (el) d.staff[staffMap[id]] = el.value.trim();
        });
        d.staff.ouverture_validee = true;
        await _mcSave(date, d);
        _mcEditOuv = false;
        rerender();
      } catch (e) {
        console.error('MC save error:', e);
      }
    });
  }
  const ouvAnnuler = document.getElementById('mc-ouv-annuler');
  if (ouvAnnuler) ouvAnnuler.addEventListener('click', () => { _mcEditOuv = false; rerender(); });
  const ouvModifier = document.getElementById('mc-ouv-modifier');
  if (ouvModifier) ouvModifier.addEventListener('click', () => { _mcEditOuv = true; rerender(); });

  // ── Wiring : choix du créneau (matériel) ──
  container.querySelectorAll('.mc-mat-slot').forEach(btn => {
    btn.addEventListener('click', () => {
      _mcMatSlot[date] = parseInt(btn.dataset.slot);
      rerender();
    });
  });

  // ── Wiring : compteurs − / + ──
  container.querySelectorAll('.mc-step').forEach(row => {
    const key   = row.dataset.key;
    const out   = row.querySelector('.mc-step-val');
    const minus = row.querySelector('[data-delta="-1"]');
    row.querySelectorAll('.mc-step-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          const d = _mcCurrentData;
          if (!d) return;
          const slotId = _mcMatSlot[date];
          if (!d.slots[slotId]) d.slots[slotId] = _mcDefault().slots[slotId];
          const v = Math.max(0, (Number(d.slots[slotId][key]) || 0) + parseInt(btn.dataset.delta));
          d.slots[slotId][key] = v;
          out.textContent = v;
          minus.disabled = v <= 0;
          row.classList.remove('bump'); void row.offsetWidth; row.classList.add('bump');
          // Récap
          const cell = document.getElementById('mc-cell-' + slotId + '-' + key);
          if (cell) { cell.textContent = v; cell.classList.toggle('mc-zero', v === 0); }
          const totEl = document.getElementById('mc-tot-' + key);
          if (totEl) totEl.textContent = SLOTS.reduce((t, s) => t + (Number((d.slots[s.id] || {})[key]) || 0), 0);
          await _mcSave(date, d);
        } catch (e) {
          console.error('MC save error:', e);
        }
      });
    });
  });

  // ── Wiring : passage de la police (horodaté, ajouté au journal) ──
  const policeBtn = document.getElementById('mc-police-add');
  if (policeBtn) {
    policeBtn.addEventListener('click', async () => {
      try {
        const d = _mcCurrentData;
        if (!d) return;
        if (!d.notes) d.notes = [];
        const reporter = ((document.getElementById('mc-note-reporter') || {}).value || '').trim();
        // Pour une journée passée, l'heure exacte n'est pas connue : midi par défaut
        const ts = isToday ? Date.now() : new Date(date + 'T12:00:00').getTime();
        d.notes.unshift({ ts, text: 'Passage de la police', reporter, type: 'police' });
        _mcSyncPolice(d);
        await _mcSave(date, d);
        rerender();
      } catch (e) {
        console.error('MC save error:', e);
      }
    });
  }

  // ── Wiring : notes ──
  const noteAddBtn = document.getElementById('mc-note-add');
  const noteInp    = document.getElementById('mc-note-inp');
  const reporterEl = document.getElementById('mc-note-reporter');
  async function _addNote() {
    try {
      const text     = noteInp.value.trim();
      const reporter = (reporterEl.value || '').trim();
      if (!text) { noteInp.focus(); return; }
      const d = _mcCurrentData;
      if (!d) return;
      if (!d.notes) d.notes = [];
      d.notes.unshift({ ts: Date.now(), text, reporter });
      _lsSet(MC_REPORTER_KEY, reporter);
      await _mcSave(date, d);
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
  reporterEl.addEventListener('change', () => _lsSet(MC_REPORTER_KEY, reporterEl.value.trim()));

  _bindNoteDelete(date, container);

  // ── Wiring nav ──
  const prevBtn = document.getElementById('mc-nav-prev');
  if (prevBtn) prevBtn.addEventListener('click', () => { _mcEditOuv = false; if (container._onMcPrev) container._onMcPrev(); });
  const nextBtn = document.getElementById('mc-nav-next');
  if (nextBtn) nextBtn.addEventListener('click', () => { _mcEditOuv = false; if (container._onMcNext) container._onMcNext(); });
  const todayBtn = document.getElementById('mc-nav-today');
  if (todayBtn) todayBtn.addEventListener('click', () => { _mcEditOuv = false; if (container._onMcToday) container._onMcToday(); });

  const entretienBtn = document.getElementById('mc-nav-entretien');
  if (entretienBtn) {
    entretienBtn.addEventListener('click', () => {
      renderEntretien(container, () => renderMc(container, date));
    });
  }

  // ── Historique : calendrier du mois, jours remplis cliquables ──
  const listBtn = document.getElementById('mc-nav-list');
  if (listBtn) {
    let calMonth = date.slice(0, 7); // 'YYYY-MM' — mois du jour affiché
    const filled = new Set(allDates);

    function closeCal() {
      const ex = document.getElementById('mc-hist-dropdown');
      if (ex) ex.remove();
      listBtn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', onEsc);
    }
    function outside(e) {
      const dd = document.getElementById('mc-hist-dropdown');
      if (dd && !dd.contains(e.target) && !listBtn.contains(e.target)) closeCal();
    }
    function onEsc(e) { if (e.key === 'Escape') { closeCal(); listBtn.focus(); } }

    function drawCal(dd) {
      const [y, m] = calMonth.split('-').map(Number);
      const first  = new Date(y, m - 1, 1);
      const nbDays = new Date(y, m, 0).getDate();
      const lead   = (first.getDay() + 6) % 7; // lundi = 0
      const titre  = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      const nextOk = calMonth < todayISO.slice(0, 7);
      let g = ['L','M','M','J','V','S','D'].map(w => '<span class="mc-cal-wd" aria-hidden="true">' + w + '</span>').join('');
      for (let i = 0; i < lead; i++) g += '<span></span>';
      for (let d = 1; d <= nbDays; d++) {
        const iso = calMonth + '-' + String(d).padStart(2, '0');
        const has = filled.has(iso);
        const cls = 'mc-cal-d' + (has ? ' has' : '') + (iso === todayISO ? ' tod' : '') + (iso === date ? ' cur' : '');
        const lab = new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
                  + (has ? ', main courante remplie' : ', rien d\'enregistré');
        // Jours remplis + aujourd'hui cliquables ; jours futurs et vides non
        g += (has || iso === todayISO)
          ? '<button type="button" class="' + cls + '" data-date="' + iso + '" aria-label="' + lab + '"' + (iso === date ? ' aria-current="date"' : '') + '>' + d + '</button>'
          : '<span class="' + cls + '" aria-label="' + lab + '">' + d + '</span>';
      }
      const nbMois = allDates.filter(d => d.startsWith(calMonth)).length;
      dd.innerHTML = '<div class="mc-cal-hd">'
        +   '<button type="button" class="mc-cal-nav" data-m="-1" aria-label="Mois précédent">‹</button>'
        +   '<b>' + titre + '</b>'
        +   '<button type="button" class="mc-cal-nav" data-m="1" aria-label="Mois suivant"' + (nextOk ? '' : ' disabled') + '>›</button>'
        + '</div>'
        + '<div class="mc-cal-g">' + g + '</div>'
        + '<div class="mc-cal-leg"><span><i></i>main courante remplie</span><span><s></s>aujourd\'hui</span>'
        +   '<span class="mc-cal-nb">' + nbMois + ' jour' + (nbMois > 1 ? 's' : '') + ' ce mois</span></div>';
      dd.querySelectorAll('.mc-cal-nav').forEach(b => b.addEventListener('click', () => {
        const d = new Date(y, m - 1 + parseInt(b.dataset.m), 1);
        calMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        drawCal(dd);
      }));
      dd.querySelectorAll('button.mc-cal-d').forEach(b => b.addEventListener('click', () => {
        closeCal();
        _mcEditOuv = false;
        if (container._onMcGoto) container._onMcGoto(b.dataset.date);
      }));
    }

    listBtn.addEventListener('click', () => {
      if (document.getElementById('mc-hist-dropdown')) { closeCal(); return; }
      calMonth = date.slice(0, 7);
      const dd = document.createElement('div');
      dd.id = 'mc-hist-dropdown';
      dd.className = 'mc-cal';
      dd.setAttribute('role', 'dialog');
      dd.setAttribute('aria-label', 'Historique des mains courantes');
      listBtn.parentNode.appendChild(dd);
      drawCal(dd);
      listBtn.setAttribute('aria-expanded', 'true');
      setTimeout(() => {
        document.addEventListener('mousedown', outside);
        document.addEventListener('keydown', onEsc);
        const f = (dd.querySelector('button.mc-cal-d.cur') || dd.querySelector('button.mc-cal-d.tod') || dd.querySelector('button.mc-cal-d'));
        if (f) f.focus();
      }, 0);
    });
  }
}

function _renderNotes(notes) {
  if (!notes || notes.length === 0) {
    return '<div class="planning-empty" style="padding:12px 0">Rien de noté pour l\'instant.</div>';
  }
  // Ordre chronologique inverse (le plus récent en haut) ; l'index d'origine sert à la suppression
  return notes
    .map((n, i) => ({ n, i }))
    .sort((a, b) => b.n.ts - a.n.ts)
    .map(({ n, i }) =>
      '<div class="mc-note-item' + (n.type === 'police' ? ' mc-note-police' : '') + '">'
      + '<span class="mc-note-time">' + _fmt(n.ts) + '</span>'
      + '<span class="mc-note-tag">' + (n.type === 'police' ? 'Police' : '') + '</span>'
      + '<span class="mc-note-reporter">' + _escHtml(n.reporter || '') + '</span>'
      + '<span class="mc-note-text">' + _escHtml(n.text) + '</span>'
      + '<button class="mc-note-del" data-idx="' + i + '" title="Supprimer" aria-label="Supprimer cette entrée">✕</button>'
      + '</div>'
    ).join('');
}

function _bindNoteDelete(date, container) {
  container.querySelectorAll('.mc-note-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const d = _mcCurrentData;
        if (!d) return;
        const n = d.notes[parseInt(btn.dataset.idx)];
        if (!n) return;
        if (!confirm(n.type === 'police' ? 'Supprimer ce passage de la police ?' : 'Supprimer cette note ?')) return;
        d.notes.splice(parseInt(btn.dataset.idx), 1);
        const wasPolice = n.type === 'police';
        if (wasPolice) _mcSyncPolice(d);
        await _mcSave(date, d);
        if (wasPolice) { renderMc(container, date).catch(console.error); return; }
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
