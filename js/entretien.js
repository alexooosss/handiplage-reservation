'use strict';

const SLOT_LABELS = { matin: 'Matin', midi: 'Midi', aprem: 'Après-midi', util: 'Utilisation' };

const ENTRETIEN_FICHES = [
  {
    id: 'plage',
    label: 'Plage adaptée',
    produits: [
      { id: 'transats',         label: 'Transats plastique',          info: 'Exeol surf désinfectant',    slots: ['util'] },
      { id: 'chaises',          label: 'Chaises plastiques',          info: 'Exeol surf désinfectant',    slots: ['util'] },
      { id: 'tapis',            label: 'Tapis de circulation',         info: 'Balayage',                   slots: ['util'] },
      { id: 'tiralo',           label: 'Tiralo',                       info: 'Exeol surf désinfectant',    slots: ['util'] },
      { id: 'hippocampe',       label: 'Hippocampe',                   info: 'Exeol surf désinfectant',    slots: ['util'] },
      { id: 'rampe_entree',     label: 'Rampe d\'entrée plage',        info: 'Exeol surf désinfectant',    slots: ['matin', 'midi', 'aprem'] },
      { id: 'sol_rampe_entree', label: 'Sol rampe d\'entrée plage',    info: 'Balayage',                   slots: ['matin'] },
      { id: 'rampe_eau',        label: 'Rampe d\'accès à l\'eau',      info: 'Exeol surf désinfectant',    slots: ['matin', 'midi', 'aprem'] },
      { id: 'sol_rampe_eau',    label: 'Sol rampe d\'accès à l\'eau',  info: 'Balayage',                   slots: ['matin'] },
      { id: 'audio',            label: 'Audio plage',                  info: 'Exeol surf désinfectant',    slots: ['util'] },
      { id: 'fauteuil',         label: 'Fauteuil roulant',             info: 'Exeol surf désinfectant',    slots: ['util'] },
      { id: 'deambulateur',     label: 'Déambulateur',                 info: 'Exeol surf désinfectant',    slots: ['util'] },
    ]
  },
  {
    id: 'sanitaire',
    label: 'Sanitaire',
    produits: [
      { id: 'lavabo',       label: 'Lavabo',                       info: 'Ultra Bac Sanit 5+',         slots: ['matin', 'aprem'] },
      { id: 'dist_savon',   label: 'Distributeur de savon',        info: 'Ultra Bac Sanit 5+',         slots: ['matin', 'aprem'] },
      { id: 'dist_essuie',  label: 'Distributeur d\'essuie-mains', info: 'Exeol surf désinfectant',    slots: ['matin', 'aprem'] },
      { id: 'miroir',       label: 'Miroir',                       info: 'Alcène vitres',              slots: ['matin', 'aprem'] },
      { id: 'interrupteur', label: 'Interrupteur',                  info: 'Exeol surf désinfectant',    slots: ['matin', 'aprem'] },
      { id: 'wc',           label: 'WC',                           info: 'Ultra Bac Sanit 5+',         slots: ['matin', 'aprem'] },
      { id: 'barre_appui',  label: 'Barre d\'appui',               info: 'Exeol surf désinfectant',    slots: ['matin', 'aprem'] },
      { id: 'poubelle',     label: 'Poubelle',                     info: 'Exeol surf désinfectant',    slots: ['matin', 'aprem'] },
      { id: 'porte',        label: 'Porte / poignée de porte',     info: 'Exeol surf désinfectant',    slots: ['matin', 'aprem'] },
      { id: 'mur',          label: 'Mur',                          info: 'Ultra Bac Sanit 5+',         slots: ['matin', 'aprem'] },
      { id: 'sol',          label: 'Sol',                          info: 'Ultrafresh 3D',              slots: ['matin', 'aprem'] },
    ]
  },
  {
    id: 'vestiaires',
    label: 'Vestiaires',
    produits: [
      { id: 'lavabo_rob',    label: 'Lavabo robinet',               info: 'Ultra Bac Sanit 5+',         slots: ['matin', 'aprem'] },
      { id: 'dist_savon',    label: 'Distributeur de savon',        info: 'Ultra Bac Sanit 5+',         slots: ['matin', 'aprem'] },
      { id: 'dist_essuie',   label: 'Distributeur d\'essuie-mains', info: 'Exeol surf désinfectant',    slots: ['matin', 'aprem'] },
      { id: 'miroir',        label: 'Miroir',                       info: 'Alcène Vitres',              slots: ['matin', 'aprem'] },
      { id: 'interrupteur',  label: 'Interrupteur',                  info: 'Exeol surf désinfectant',    slots: ['matin', 'aprem'] },
      { id: 'porte_vitree',  label: 'Porte vitrée',                 info: 'Alcène Vitres',              slots: ['matin', 'aprem'] },
      { id: 'cabine_change', label: 'Cabine de change',             info: 'Ultra Bac Sanit 5+',         slots: ['matin', 'aprem'] },
      { id: 'chaise',        label: 'Chaise',                       info: 'Ultra Bac Sanit 5+',         slots: ['matin', 'aprem'] },
      { id: 'barre_appui',   label: 'Barre d\'appui',               info: 'Exeol surf désinfectant',    slots: ['matin', 'aprem'] },
      { id: 'poubelle',      label: 'Poubelle',                     info: 'Exeol surf désinfectant',    slots: ['matin', 'aprem'] },
      { id: 'porte',         label: 'Porte / poignée de porte',     info: 'Exeol surf désinfectant',    slots: ['matin', 'aprem'] },
      { id: 'mur',           label: 'Mur',                          info: 'Ultra Bac Sanit 5+',         slots: ['matin', 'aprem'] },
      { id: 'sol',           label: 'Sol',                          info: 'Ultrafresh 3D',              slots: ['matin', 'aprem'] },
    ]
  },
  {
    id: 'douche_ext',
    label: 'Douche extérieure',
    produits: [
      { id: 'barre_appui',    label: 'Barre d\'appui',              info: 'Ultra Bac Sanit 5+',         slots: ['matin', 'midi', 'aprem'] },
      { id: 'poignee_douche', label: 'Poignée de douche',           info: 'Ultra Bac Sanit 5+',         slots: ['matin', 'midi', 'aprem'] },
    ]
  },
  {
    id: 'local_tech',
    label: 'Local technique',
    produits: [
      { id: 'sol',          label: 'Sol',                            info: 'Balayage',                   slots: ['matin'] },
      { id: 'interrupteur', label: 'Interrupteur',                   info: 'Exeol surf désinfectant',    slots: ['matin'] },
      { id: 'porte',        label: 'Poignée / porte',                info: 'Exeol surf désinfectant',    slots: ['matin'] },
    ]
  },
];

function _entrKey(year, month) { return 'entretien_' + year + '_' + month; }

function _loadEntr(year, month) {
  try {
    const raw = localStorage.getItem(_entrKey(year, month));
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function _saveEntr(year, month, data) {
  try { localStorage.setItem(_entrKey(year, month), JSON.stringify(data)); } catch (e) {}
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
  thead += '<th class="entr-th-prod entr-th-info">Produit</th>';
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
        tbody += '<td class="entr-td-init' + wkCls + (val ? ' entr-filled' : '') + '">'
          + '<input type="text" class="entr-init-inp" maxlength="5" value="' + val + '"'
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

function _wireInputs(container, data, year, month, onDataChange) {
  container.querySelectorAll('.entr-init-inp').forEach(inp => {
    inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase(); });

    inp.addEventListener('blur', () => {
      const val  = inp.value.trim().toUpperCase();
      const { fiche, day, prod, slot } = inp.dataset;
      inp.value = val;
      _setVal(data, fiche, day, prod, slot, val);
      inp.closest('td').classList.toggle('entr-filled', val.length > 0);

      if (val) {
        container.querySelectorAll(
          '.entr-init-inp[data-day="' + day + '"][data-slot="' + slot + '"]'
        ).forEach(other => {
          if (other !== inp && !other.value.trim()) {
            other.value = val;
            _setVal(data, other.dataset.fiche, other.dataset.day, other.dataset.prod, other.dataset.slot, val);
            other.closest('td').classList.add('entr-filled');
          }
        });
      }

      onDataChange();
    });
  });
}

function renderEntretien(container, onBack) {
  const now = new Date();
  let year          = now.getFullYear();
  let month         = now.getMonth() + 1;
  let activeFicheId = ENTRETIEN_FICHES[0].id;
  let data          = _loadEntr(year, month);

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
      +   '<div class="entr-header-title">Fiches d\'entretien</div>'
      + '</div>'
      + '<div class="entr-tabs">' + tabs + '</div>'
      + '<div class="entr-body">' + _renderFicheTable(fiche, data, year, month) + '</div>'
      + '</div>';

    document.getElementById('entr-back').addEventListener('click', () => { if (onBack) onBack(); });

    document.getElementById('entr-prev').addEventListener('click', () => {
      month--;
      if (month < 1) { month = 12; year--; }
      data = _loadEntr(year, month);
      _render();
    });
    document.getElementById('entr-next').addEventListener('click', () => {
      month++;
      if (month > 12) { month = 1; year++; }
      data = _loadEntr(year, month);
      _render();
    });

    container.querySelectorAll('.entr-tab').forEach(btn => {
      btn.addEventListener('click', () => { activeFicheId = btn.dataset.fiche; _render(); });
    });

    _wireInputs(container, data, year, month, () => _saveEntr(year, month, data));
  }

  _render();
}
