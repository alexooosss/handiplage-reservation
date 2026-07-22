'use strict';

const SLOT_LABELS = { matin: 'Matin', midi: 'Midi', aprem: 'Après-midi', util: 'Après utilisation' };

const ENTRETIEN_FICHES = [
  {
    id: 'plage',
    label: 'Plage adaptée',
    produits: [
      { id: 'transats',         label: 'Transats plastique',          info: 'Exeol surf désinfectant',    slots: ['util'], frequence: 'Après chaque utilisation' },
      { id: 'chaises',          label: 'Chaises plastiques',          info: 'Exeol surf désinfectant',    slots: ['util'], frequence: 'Après chaque utilisation' },
      { id: 'tapis',            label: 'Tapis de circulation',         info: 'Balayage',                   slots: ['util'], frequence: 'Après chaque utilisation' },
      { id: 'tiralo',           label: 'Tiralo',                       info: 'Exeol surf désinfectant',    slots: ['util'], frequence: 'Après chaque utilisation' },
      { id: 'hippocampe',       label: 'Hippocampe',                   info: 'Exeol surf désinfectant',    slots: ['util'], frequence: 'Après chaque utilisation' },
      { id: 'rampe_entree',     label: 'Rampe d\'entrée plage',        info: 'Exeol surf désinfectant',    slots: ['matin', 'midi', 'aprem'], frequence: '3×/jour' },
      { id: 'sol_rampe_entree', label: 'Sol rampe d\'entrée plage',    info: 'Balayage',                   slots: ['matin'], frequence: '1×/jour' },
      { id: 'rampe_eau',        label: 'Rampe d\'accès à l\'eau',      info: 'Exeol surf désinfectant',    slots: ['matin', 'midi', 'aprem'], frequence: '3×/jour' },
      { id: 'sol_rampe_eau',    label: 'Sol rampe d\'accès à l\'eau',  info: 'Balayage',                   slots: ['matin'], frequence: '1×/jour' },
      { id: 'audio',            label: 'Audio plage',                  info: 'Exeol surf désinfectant',    slots: ['util'], frequence: 'Après chaque utilisation' },
      { id: 'fauteuil',         label: 'Fauteuil roulant',             info: 'Exeol surf désinfectant',    slots: ['util'], frequence: 'Après chaque utilisation' },
      { id: 'deambulateur',     label: 'Déambulateur',                 info: 'Exeol surf désinfectant',    slots: ['util'], frequence: 'Après chaque utilisation' },
    ]
  },
  {
    id: 'sanitaire',
    label: 'Sanitaire',
    produits: [
      { id: 'lavabo',       label: 'Lavabo',                       info: 'Ultra Bac Sanit 5+',         slots: ['matin', 'aprem'], frequence: 'Toutes les heures' },
      { id: 'dist_savon',   label: 'Distributeur de savon',        info: 'Ultra Bac Sanit 5+',         slots: ['matin', 'aprem'], frequence: 'Toutes les heures' },
      { id: 'dist_essuie',  label: 'Distributeur d\'essuie-mains', info: 'Exeol surf désinfectant',    slots: ['matin', 'aprem'], frequence: 'Toutes les heures' },
      { id: 'miroir',       label: 'Miroir',                       info: 'Alcène vitres',              slots: ['matin', 'aprem'], frequence: 'Toutes les heures' },
      { id: 'interrupteur', label: 'Interrupteur',                  info: 'Exeol surf désinfectant',    slots: ['matin', 'aprem'], frequence: 'Toutes les heures' },
      { id: 'wc',           label: 'WC',                           info: 'Ultra Bac Sanit 5+',         slots: ['matin', 'aprem'], frequence: 'Toutes les heures' },
      { id: 'barre_appui',  label: 'Barre d\'appui',               info: 'Exeol surf désinfectant',    slots: ['matin', 'aprem'], frequence: 'Toutes les heures' },
      { id: 'poubelle',     label: 'Poubelle',                     info: 'Exeol surf désinfectant',    slots: ['matin', 'aprem'], frequence: 'Toutes les heures' },
      { id: 'porte',        label: 'Porte / poignée de porte',     info: 'Exeol surf désinfectant',    slots: ['matin', 'aprem'], frequence: 'Toutes les heures' },
      { id: 'mur',          label: 'Mur',                          info: 'Ultra Bac Sanit 5+',         slots: ['matin', 'aprem'], frequence: 'Toutes les heures' },
      { id: 'sol',          label: 'Sol',                          info: 'Ultrafresh 3D',              slots: ['matin', 'aprem'], frequence: 'Toutes les heures' },
    ]
  },
  {
    id: 'vestiaires',
    label: 'Vestiaires',
    produits: [
      { id: 'lavabo_rob',    label: 'Lavabo robinet',               info: 'Ultra Bac Sanit 5+',         slots: ['matin', 'aprem'], frequence: '2×/jour' },
      { id: 'dist_savon',    label: 'Distributeur de savon',        info: 'Ultra Bac Sanit 5+',         slots: ['matin', 'aprem'], frequence: '2×/jour' },
      { id: 'dist_essuie',   label: 'Distributeur d\'essuie-mains', info: 'Exeol surf désinfectant',    slots: ['matin', 'aprem'], frequence: '2×/jour' },
      { id: 'miroir',        label: 'Miroir',                       info: 'Alcène Vitres',              slots: ['matin', 'aprem'], frequence: '2×/jour' },
      { id: 'interrupteur',  label: 'Interrupteur',                  info: 'Exeol surf désinfectant',    slots: ['matin', 'aprem'], frequence: '2×/jour' },
      { id: 'porte_vitree',  label: 'Porte vitrée',                 info: 'Alcène Vitres',              slots: ['matin', 'aprem'], frequence: '2×/jour' },
      { id: 'cabine_change', label: 'Cabine de change',             info: 'Ultra Bac Sanit 5+',         slots: ['matin', 'aprem'], frequence: '2×/jour' },
      { id: 'chaise',        label: 'Chaise',                       info: 'Ultra Bac Sanit 5+',         slots: ['matin', 'aprem'], frequence: '2×/jour' },
      { id: 'barre_appui',   label: 'Barre d\'appui',               info: 'Exeol surf désinfectant',    slots: ['matin', 'aprem'], frequence: '2×/jour' },
      { id: 'poubelle',      label: 'Poubelle',                     info: 'Exeol surf désinfectant',    slots: ['matin', 'aprem'], frequence: '2×/jour' },
      { id: 'porte',         label: 'Porte / poignée de porte',     info: 'Exeol surf désinfectant',    slots: ['matin', 'aprem'], frequence: '2×/jour' },
      { id: 'mur',           label: 'Mur',                          info: 'Ultra Bac Sanit 5+',         slots: ['matin', 'aprem'], frequence: '2×/jour' },
      { id: 'sol',           label: 'Sol',                          info: 'Ultrafresh 3D',              slots: ['matin', 'aprem'], frequence: '2×/jour' },
    ]
  },
  {
    id: 'douche_ext',
    label: 'Douche extérieure',
    produits: [
      { id: 'barre_appui',    label: 'Barre d\'appui',              info: 'Ultra Bac Sanit 5+',         slots: ['matin', 'midi', 'aprem'], frequence: '3×/jour' },
      { id: 'poignee_douche', label: 'Poignée de douche',           info: 'Ultra Bac Sanit 5+',         slots: ['matin', 'midi', 'aprem'], frequence: '3×/jour' },
    ]
  },
  {
    id: 'local_tech',
    label: 'Local technique',
    produits: [
      { id: 'sol',          label: 'Sol',                            info: 'Balayage',                   slots: ['matin'], frequence: '1×/jour' },
      { id: 'interrupteur', label: 'Interrupteur',                   info: 'Exeol surf désinfectant',    slots: ['matin'], frequence: '1×/jour' },
      { id: 'porte',        label: 'Poignée / porte',                info: 'Exeol surf désinfectant',    slots: ['matin'], frequence: '1×/jour' },
    ]
  },
];

async function _loadEntr(year, month) {
  const start  = year + '-' + String(month).padStart(2, '0') + '-01';
  const nextDt = new Date(year, month, 1);
  const end    = nextDt.getFullYear() + '-' + String(nextDt.getMonth() + 1).padStart(2, '0') + '-01';
  const result = await supabaseClient.from('entretien_checks')
    .select('date, fiche_id, produit_id, slot, initiales')
    .gte('date', start).lt('date', end);
  if (result.error) throw result.error;
  const data = {};
  (result.data || []).forEach(row => {
    if (!data[row.fiche_id]) data[row.fiche_id] = {};
    if (!data[row.fiche_id][row.date]) data[row.fiche_id][row.date] = {};
    if (!data[row.fiche_id][row.date][row.produit_id]) data[row.fiche_id][row.date][row.produit_id] = {};
    data[row.fiche_id][row.date][row.produit_id][row.slot] = row.initiales;
  });
  return data;
}

async function _saveCell(ficheId, dayISO, produitId, slot, initiales) {
  if (initiales) {
    const result = await supabaseClient.from('entretien_checks').upsert(
      { date: dayISO, fiche_id: ficheId, produit_id: produitId, slot, initiales, updated_at: new Date().toISOString() },
      { onConflict: 'date,fiche_id,produit_id,slot' }
    );
    if (result.error) throw result.error;
  } else {
    const result = await supabaseClient.from('entretien_checks')
      .delete()
      .eq('date', dayISO).eq('fiche_id', ficheId).eq('produit_id', produitId).eq('slot', slot);
    if (result.error) throw result.error;
  }
}

function _daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function _isoDay(year, month, day) {
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function _fmtMonthYear(year, month) {
  const s = new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function _getVal(data, ficheId, dayISO, produitId, slot) {
  return (data[ficheId] && data[ficheId][dayISO] && data[ficheId][dayISO][produitId] && data[ficheId][dayISO][produitId][slot]) || '';
}

function _setVal(data, ficheId, dayISO, produitId, slot, val) {
  if (!data[ficheId]) data[ficheId] = {};
  if (!data[ficheId][dayISO]) data[ficheId][dayISO] = {};
  if (!data[ficheId][dayISO][produitId]) data[ficheId][dayISO][produitId] = {};
  data[ficheId][dayISO][produitId][slot] = val;
}

function _renderFicheTable(fiche, data, year, month) {
  const days = _daysInMonth(year, month);

  let thead = '<thead><tr>';
  thead += '<th class="entr-th-prod">Surface</th>';
  thead += '<th class="entr-th-info">Produit</th>';
  thead += '<th class="entr-th-slotcol"></th>';
  for (let d = 1; d <= days; d++) {
    const dayObj = new Date(year, month - 1, d);
    const dow    = dayObj.getDay();
    const wd     = dayObj.toLocaleDateString('fr-FR', { weekday: 'narrow' });
    const wkCls  = (dow === 0 || dow === 6) ? ' entr-th-weekend' : '';
    thead += '<th class="entr-th-day' + wkCls + '">'
      + '<div class="entr-day-num">' + d + '</div>'
      + '<div class="entr-day-wd">' + wd + '</div>'
      + '</th>';
  }
  thead += '</tr></thead>';

  let tbody = '<tbody>';
  fiche.produits.forEach((p, pi) => {
    const altCls   = pi % 2 === 1 ? ' entr-row-alt' : '';
    const rowspan  = p.slots.length;

    p.slots.forEach((slot, si) => {
      tbody += '<tr class="entr-row' + altCls + (si === 0 ? ' entr-row-top' : '') + (si === rowspan - 1 ? ' entr-row-bot' : '') + '">';

      if (si === 0) {
        tbody += '<td class="entr-td-produit" rowspan="' + rowspan + '">' + p.label + '</td>';
        tbody += '<td class="entr-td-info" rowspan="' + rowspan + '">' + (p.info || '') + '</td>';
      }

      tbody += '<td class="entr-td-slot">' + (SLOT_LABELS[slot] || slot) + '</td>';

      for (let d = 1; d <= days; d++) {
        const iso    = _isoDay(year, month, d);
        const dayObj = new Date(year, month - 1, d);
        const dow    = dayObj.getDay();
        const wkCls  = (dow === 0 || dow === 6) ? ' entr-td-weekend' : '';
        const val    = _getVal(data, fiche.id, iso, p.id, slot);
        const valEsc = val.replace(/"/g, '&quot;');
        tbody += '<td class="entr-td-init' + wkCls + (val ? ' entr-filled' : '') + '">'
          + '<input type="text" class="entr-init-inp" maxlength="5" value="' + valEsc + '"'
          + ' data-fiche="' + fiche.id + '" data-day="' + iso + '" data-prod="' + p.id + '" data-slot="' + slot + '"'
          + ' placeholder="—">'
          + '</td>';
      }
      tbody += '</tr>';
    });

    if (pi < fiche.produits.length - 1) {
      tbody += '<tr class="entr-sep"><td colspan="' + (days + 3) + '"></td></tr>';
    }
  });
  tbody += '</tbody>';

  return '<div class="entr-table-wrap"><table class="entr-table">' + thead + tbody + '</table></div>';
}

function _exportEntretienPDF(fiche, data, year, month) {
  const days  = _daysInMonth(year, month);
  const title = 'Fiche d\'entretien — ' + fiche.label + ' — ' + _fmtMonthYear(year, month);

  let thead = '<thead><tr>'
    + '<th class="th-prod">Surface</th>'
    + '<th class="th-info">Produit</th>'
    + '<th class="th-slot">Moment</th>';
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    const wd  = new Date(year, month - 1, d).toLocaleDateString('fr-FR', { weekday: 'narrow' });
    thead += '<th class="th-day' + (dow === 0 || dow === 6 ? ' wk' : '') + '">'
      + d + '<br><span class="wd">' + wd + '</span></th>';
  }
  thead += '</tr></thead>';

  let tbody = '<tbody>';
  fiche.produits.forEach((p, pi) => {
    const rowspan = p.slots.length;
    p.slots.forEach((slot, si) => {
      tbody += '<tr' + (pi % 2 === 1 ? ' class="alt"' : '') + '>';
      if (si === 0) {
        tbody += '<td class="td-prod" rowspan="' + rowspan + '">' + p.label + '</td>';
        tbody += '<td class="td-info" rowspan="' + rowspan + '">' + (p.info || '') + '</td>';
      }
      tbody += '<td class="td-slot">' + (SLOT_LABELS[slot] || slot) + '</td>';
      for (let d = 1; d <= days; d++) {
        const val = _getVal(data, fiche.id, _isoDay(year, month, d), p.id, slot);
        const dow = new Date(year, month - 1, d).getDay();
        tbody += '<td' + (dow === 0 || dow === 6 ? ' class="wk"' : '') + '>' + (val || '') + '</td>';
      }
      tbody += '</tr>';
    });
    if (pi < fiche.produits.length - 1) {
      tbody += '<tr class="sep"><td colspan="' + (days + 3) + '"></td></tr>';
    }
  });
  tbody += '</tbody>';

  const html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>' + title + '</title><style>'
    + '@page{size:A4 landscape;margin:8mm}'
    + '*{box-sizing:border-box}'
    + 'body{font-family:Arial,sans-serif;font-size:8px;margin:0}'
    + 'h1{font-size:11px;margin:0 0 6px;font-weight:700}'
    + 'table{border-collapse:collapse;width:100%;table-layout:fixed}'
    + 'th,td{border:1px solid #ccc;padding:2px 1px;text-align:center;vertical-align:middle;overflow:hidden;word-break:break-all}'
    + '.th-prod,.td-prod{width:16%;text-align:left;font-weight:600;padding:2px 3px}'
    + '.th-info,.td-info{width:11%;text-align:left;font-size:7px;color:#555;padding:2px 3px}'
    + '.th-slot,.td-slot{width:7%;font-size:7px}'
    + '.th-day{font-size:6px;padding:1px}'
    + '.wd{font-size:5.5px;color:#888;display:block}'
    + '.wk{background:#ececec}'
    + '.alt td,.alt th{background:#fafafa}'
    + '.alt .wk{background:#e4e4e4}'
    + '.sep td{height:3px;padding:0;background:#ddd;border:none}'
    + 'thead th{background:#1a5fa8;color:#fff;font-weight:700}'
    + 'thead .wk{background:#154d8c}'
    + '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}'
    + '</style></head><body>'
    + '<h1>' + title + '</h1>'
    + '<table>' + thead + tbody + '</table>'
    + '<script>window.onload=function(){window.print();}<\/script>'
    + '</body></html>';

  const win = window.open('', '_blank', 'width=1200,height=800');
  if (!win) { alert('Veuillez autoriser les pop-ups pour exporter le PDF.'); return; }
  win.document.write(html);
  win.document.close();
}

function _wireInputs(container, data, onCellSave) {
  container.querySelectorAll('.entr-init-inp').forEach(inp => {
    inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase(); });

    inp.addEventListener('blur', () => {
      const val  = inp.value.trim().toUpperCase();
      const { fiche, day, prod, slot } = inp.dataset;
      inp.value = val;
      _setVal(data, fiche, day, prod, slot, val);
      inp.closest('td').classList.toggle('entr-filled', val.length > 0);
      onCellSave(fiche, day, prod, slot, val);

      if (val) {
        container.querySelectorAll(
          '.entr-init-inp[data-day="' + day + '"][data-slot="' + slot + '"]'
        ).forEach(other => {
          if (other !== inp && !other.value.trim()) {
            other.value = val;
            _setVal(data, other.dataset.fiche, other.dataset.day, other.dataset.prod, other.dataset.slot, val);
            other.closest('td').classList.add('entr-filled');
            onCellSave(other.dataset.fiche, other.dataset.day, other.dataset.prod, other.dataset.slot, val);
          }
        });
      }
    });
  });
}

async function renderEntretien(container, onBack) {
  const now = new Date();
  let year          = now.getFullYear();
  let month         = now.getMonth() + 1;
  let activeFicheId = ENTRETIEN_FICHES[0].id;
  let data          = {};

  async function _renderWithLoad() {
    try { data = await _loadEntr(year, month); }
    catch (e) { console.error('Entretien load error:', e); data = {}; }
    _render();
  }

  function _render() {
    const fiche = ENTRETIEN_FICHES.find(f => f.id === activeFicheId);

    const tabs = ENTRETIEN_FICHES.map(f =>
      '<button class="entr-tab' + (f.id === activeFicheId ? ' active' : '') + '" data-fiche="' + f.id + '">' + f.label + '</button>'
    ).join('');

    container.innerHTML = '<div class="entr-view">'
      + '<div class="entr-header">'
      +   '<button class="entr-back" id="entr-back">&#8592; Main courante</button>'
      +   '<div class="entr-month-nav">'
      +     '<button class="entr-month-btn" id="entr-prev">&#8592;</button>'
      +     '<span class="entr-month-label">' + _fmtMonthYear(year, month) + '</span>'
      +     '<button class="entr-month-btn" id="entr-next">&#8594;</button>'
      +   '</div>'
      +   '<div class="entr-header-right">'
      +     '<div class="entr-header-title">Fiches d\'entretien</div>'
      +     '<button class="entr-export-btn" id="entr-export">&#8595; PDF</button>'
      +   '</div>'
      + '</div>'
      + '<div class="entr-tabs">' + tabs + '</div>'
      + '<div class="entr-body">' + _renderFicheTable(fiche, data, year, month) + '</div>'
      + '</div>';

    document.getElementById('entr-back').addEventListener('click', () => { if (onBack) onBack(); });
    document.getElementById('entr-export').addEventListener('click', () => {
      _exportEntretienPDF(fiche, data, year, month);
    });

    document.getElementById('entr-prev').addEventListener('click', () => {
      month--;
      if (month < 1) { month = 12; year--; }
      _renderWithLoad();
    });
    document.getElementById('entr-next').addEventListener('click', () => {
      month++;
      if (month > 12) { month = 1; year++; }
      _renderWithLoad();
    });

    container.querySelectorAll('.entr-tab').forEach(btn => {
      btn.addEventListener('click', () => { activeFicheId = btn.dataset.fiche; _render(); });
    });

    _wireInputs(container, data, (ficheId, day, prodId, slot, val) => {
      _saveCell(ficheId, day, prodId, slot, val).catch(console.error);
    });
  }

  await _renderWithLoad();
}
