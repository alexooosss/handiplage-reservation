'use strict';

// À remplacer par la liste réelle fournie par l'équipe
const ENTRETIEN_FICHES = [
  {
    id: 'toilettes',
    label: 'Toilettes',
    produits: [
      { id: 'desinfectant_wc',  label: 'Désinfectant WC (cuvette, abattant, rambardes)' },
      { id: 'nettoyant_sol',    label: 'Nettoyant sol' },
      { id: 'nettoyant_lavabo', label: 'Lavabos / robinetterie' },
      { id: 'desodorisant',     label: 'Désodorisant' },
    ]
  },
  {
    id: 'vestiaires',
    label: 'Vestiaires',
    produits: [
      { id: 'nettoyant_sol',    label: 'Nettoyant sol' },
      { id: 'desinfectant',     label: 'Désinfectant surfaces / bancs' },
      { id: 'nettoyant_douche', label: 'Douches / anticalcaire' },
    ]
  },
  {
    id: 'reserve',
    label: 'Réserve',
    produits: [
      { id: 'nettoyant_sol',  label: 'Nettoyant sol' },
      { id: 'depoussiérant',  label: 'Dépoussiérant étagères / matériel' },
    ]
  }
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
  return new Date(year, month, 0).getDate(); // month est 1-based
}

function _isoDay(year, month, day) {
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function _fmtMonthYear(year, month) {
  const s = new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function _fmtDayLabel(year, month, day) {
  const d = new Date(year, month - 1, day);
  const wd = d.toLocaleDateString('fr-FR', { weekday: 'short' });
  return day + ' ' + wd.charAt(0).toUpperCase() + wd.slice(1).replace(/\.$/, '');
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

  // En-tête : colonne produit + colonne M/AM + 1 colonne par jour
  let thead = '<thead><tr>';
  thead += '<th class="entr-th-prod">Produit</th>';
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

  // Corps : pour chaque produit, 2 lignes (M et AM)
  let tbody = '<tbody>';
  fiche.produits.forEach((p, pi) => {
    const altCls = pi % 2 === 1 ? ' entr-row-alt' : '';

    ['matin', 'aprem'].forEach((slot, si) => {
      tbody += '<tr class="entr-row' + altCls + (si === 0 ? ' entr-row-top' : ' entr-row-bot') + '">';

      // Nom du produit — rowspan 2, sticky gauche
      if (si === 0) {
        tbody += '<td class="entr-td-produit" rowspan="2">' + p.label + '</td>';
      }

      // Label M / AM — sticky gauche (deuxième colonne)
      tbody += '<td class="entr-td-slot">' + (slot === 'matin' ? 'Matin' : 'Après-midi') + '</td>';

      // Cellules jours
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

    // Séparateur visuel entre produits
    if (pi < fiche.produits.length - 1) {
      tbody += '<tr class="entr-sep"><td colspan="' + (days + 2) + '"></td></tr>';
    }
  });
  tbody += '</tbody>';

  return '<div class="entr-table-wrap"><table class="entr-table">' + thead + tbody + '</table></div>';
}

function _wireInputs(container, data, year, month, onDataChange) {
  container.querySelectorAll('.entr-init-inp').forEach(inp => {
    // Majuscules en temps réel
    inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase(); });

    inp.addEventListener('blur', () => {
      const val     = inp.value.trim().toUpperCase();
      const { fiche, day, prod, slot } = inp.dataset;
      inp.value = val;
      _setVal(data, fiche, day, prod, slot, val);
      inp.closest('td').classList.toggle('entr-filled', val.length > 0);

      // Pré-remplissage des autres produits de la même demi-journée si vides
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
