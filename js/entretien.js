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
  // Jours où la plage a été déclarée fermée dans la main courante
  data._fermes = {};
  try {
    const mc = await supabaseClient.from('main_courante').select('date, staff').gte('date', start).lt('date', end);
    (mc.data || []).forEach(r => { if (r.staff && r.staff.fermee) data._fermes[r.date] = r.staff.fermee_motif || 'Fermée'; });
  } catch (e) { /* sans effet : aucun jour marqué fermé */ }
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

function _escE(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _todayISOEntr() {
  const d = new Date();
  return _isoDay(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function _renderFicheTable(fiche, data, year, month) {
  const days  = _daysInMonth(year, month);
  const today = _todayISOEntr();

  let thead = '<thead><tr>';
  thead += '<th class="entr-th-prod">Surface</th>';
  thead += '<th class="entr-th-info">Produit · fréquence</th>';
  thead += '<th class="entr-th-slotcol">Moment</th>';
  for (let d = 1; d <= days; d++) {
    const iso    = _isoDay(year, month, d);
    const dayObj = new Date(year, month - 1, d);
    const dow    = dayObj.getDay();
    const wd     = dayObj.toLocaleDateString('fr-FR', { weekday: 'narrow' });
    const ferme  = data._fermes && data._fermes[iso];
    const cls    = ((dow === 0 || dow === 6) ? ' entr-th-weekend' : '') + (iso === today ? ' entr-th-today' : '') + (iso > today ? ' entr-th-future' : '') + (ferme ? ' entr-th-closed' : '');
    thead += '<th class="entr-th-day' + cls + '"' + (iso === today ? ' id="entr-today-col" aria-current="date"' : '') + (ferme ? ' title="Plage fermée : ' + _escE(ferme) + '"' : '') + '>'
      + (iso === today ? '<div class="entr-today-tag">Auj.</div>' : '')
      + (ferme ? '<div class="entr-closed-tag">Fermé</div>' : '')
      + '<div class="entr-day-num">' + d + '</div>'
      + '<div class="entr-day-wd">' + wd + '</div>'
      + '</th>';
  }
  thead += '</tr></thead>';

  let tbody = '<tbody>';
  fiche.produits.forEach((p, pi) => {
    const altCls  = pi % 2 === 1 ? ' entr-row-alt' : '';
    const rowspan = p.slots.length;

    p.slots.forEach((slot, si) => {
      tbody += '<tr class="entr-row' + altCls + (si === 0 ? ' entr-row-top' : '') + (si === rowspan - 1 ? ' entr-row-bot' : '') + '">';
      if (si === 0) {
        tbody += '<td class="entr-td-produit" rowspan="' + rowspan + '">' + _escE(p.label) + '</td>';
        tbody += '<td class="entr-td-info" rowspan="' + rowspan + '">' + _escE(p.info || '')
          + (p.frequence ? '<span class="entr-freq">' + _escE(p.frequence) + '</span>' : '') + '</td>';
      }
      tbody += '<td class="entr-td-slot">' + (SLOT_LABELS[slot] || slot) + '</td>';

      for (let d = 1; d <= days; d++) {
        const iso    = _isoDay(year, month, d);
        const dow    = new Date(year, month - 1, d).getDay();
        const futur  = iso > today;
        const ferme  = !!(data._fermes && data._fermes[iso]);
        const val    = _getVal(data, fiche.id, iso, p.id, slot);
        const cls    = ((dow === 0 || dow === 6) ? ' entr-td-weekend' : '') + (iso === today ? ' entr-td-today' : '') + (futur ? ' entr-td-future' : '') + (ferme ? ' entr-td-closed' : '') + (val ? ' entr-filled' : '');
        tbody += '<td class="entr-td-init' + cls + '">'
          + '<input type="text" class="entr-init-inp" maxlength="5" value="' + _escE(val) + '"'
          + ' data-fiche="' + fiche.id + '" data-day="' + iso + '" data-prod="' + p.id + '" data-slot="' + slot + '"'
          + ' aria-label="' + _escE(p.label + ', ' + (SLOT_LABELS[slot] || slot) + ', ' + d + ' ' + _fmtMonthYear(year, month)) + '"'
          + (futur ? ' disabled title="Jour à venir"' : ferme ? ' disabled title="Plage fermée ce jour"' : '')
          + ' autocomplete="off">'
          + '</td>';
      }
      tbody += '</tr>';
    });

    if (pi < fiche.produits.length - 1) {
      tbody += '<tr class="entr-sep"><td colspan="' + (days + 3) + '"></td></tr>';
    }
  });
  tbody += '</tbody>';

  return '<div class="entr-table-wrap" id="entr-table-wrap"><table class="entr-table">' + thead + tbody + '</table></div>';
}

// ── Export PDF : une fiche ou toutes, A4 paysage, sans fenêtre surgissante ──
function _ficheExportHtml(fiche, data, year, month) {
  const days  = _daysInMonth(year, month);
  const today = _todayISOEntr();
  let total = 0, faits = 0;

  let thead = '<thead><tr><th class="c-prod">Surface</th><th class="c-info">Produit</th><th class="c-freq">Fréquence</th><th class="c-slot">Moment</th>';
  for (let d = 1; d <= days; d++) {
    const dt  = new Date(year, month - 1, d);
    const dow = dt.getDay();
    const fe  = data._fermes && data._fermes[_isoDay(year, month, d)];
    thead += '<th class="c-day' + (dow === 0 || dow === 6 ? ' wk' : '') + (fe ? ' cl' : '') + '">' + d
      + '<span class="wd">' + dt.toLocaleDateString('fr-FR', { weekday: 'narrow' }) + '</span></th>';
  }
  thead += '</tr></thead>';

  let tbody = '<tbody>';
  fiche.produits.forEach((p, pi) => {
    p.slots.forEach((slot, si) => {
      tbody += '<tr class="' + (pi % 2 ? 'alt' : '') + (si === p.slots.length - 1 ? ' last' : '') + '">';
      if (si === 0) {
        tbody += '<td class="c-prod" rowspan="' + p.slots.length + '">' + _escE(p.label) + '</td>'
          + '<td class="c-info" rowspan="' + p.slots.length + '">' + _escE(p.info || '') + '</td>'
          + '<td class="c-freq" rowspan="' + p.slots.length + '">' + _escE(p.frequence || '') + '</td>';
      }
      tbody += '<td class="c-slot">' + (SLOT_LABELS[slot] || slot) + '</td>';
      for (let d = 1; d <= days; d++) {
        const iso = _isoDay(year, month, d);
        const dow = new Date(year, month - 1, d).getDay();
        const val = _getVal(data, fiche.id, iso, p.id, slot);
        const futur = iso > today;
        const fe    = !!(data._fermes && data._fermes[iso]);
        if (!futur && !fe) { total++; if (val) faits++; }
        tbody += '<td class="v' + (dow === 0 || dow === 6 ? ' wk' : '') + (futur ? ' fut' : '') + (fe ? ' cl' : '') + '">' + (fe && !val ? 'F' : _escE(val)) + '</td>';
      }
      tbody += '</tr>';
    });
  });
  tbody += '</tbody>';

  const taux = total ? Math.round(faits / total * 100) : null;
  return { html: '<table>' + thead + tbody + '</table>', taux: taux, faits: faits, total: total };
}

function _exportEntretienPDF(fiches, data, year, month) {
  const mois = _fmtMonthYear(year, month);
  const logo = new URL('logo-handiplage-mot-bleu.svg', location.href).href;
  const genere = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  const pages = fiches.map(f => {
    const r = _ficheExportHtml(f, data, year, month);
    return '<section class="page">'
      + '<header><img src="' + logo + '" alt="Handiplage"><div class="t"><h1>Fiche d\'entretien — ' + _escE(f.label) + '</h1>'
      +   '<p>Handiplage d\'Antibes · CCAS · ' + _escE(mois) + '</p></div></header>'
      + r.html
      + '<footer>'
      +   '<div class="leg"><b>Légende :</b> initiales de l\'agent ayant effectué le nettoyage · '
      +     '<span class="sw wk"></span> week-end · <span class="sw fut"></span> jour à venir · <span class="sw cl">F</span> plage fermée (exclu du taux)<br>'
      +     '<b>Contrôles renseignés :</b> ' + (r.taux == null ? '—' : r.taux + ' % (' + r.faits + ' sur ' + r.total + ')')
      +     ' · Document généré le ' + genere + '</div>'
      +   '<div class="visa">Visa du responsable<br><span>Date :</span><span>Signature :</span></div>'
      + '</footer>'
      + '</section>';
  }).join('');

  const titre = fiches.length === 1
    ? 'Fiche d\'entretien — ' + fiches[0].label + ' — ' + mois
    : 'Fiches d\'entretien — ' + mois;

  const html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>' + _escE(titre) + '</title><style>'
    + '@page{size:A4 landscape;margin:8mm 8mm 9mm}'
    + '*{box-sizing:border-box}'
    + 'body{font-family:"Segoe UI",Arial,sans-serif;font-size:8pt;margin:0;color:#1f2a3d;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + '.page{break-after:page}.page:last-child{break-after:auto}'
    + 'header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #05559b;padding-bottom:5px;margin-bottom:6px}'
    + 'header img{height:24px}header .t{text-align:right}header h1{margin:0;font-size:13pt;color:#05559b}header p{margin:1px 0 0;font-size:8.5pt;color:#5b6576}'
    + 'table{border-collapse:collapse;width:100%;table-layout:fixed}'
    + 'th,td{border:1px solid #c9d2dc;padding:2px 1px;text-align:center;vertical-align:middle;overflow:hidden}'
    + 'thead th{background:#05559b;color:#fff;font-weight:700;font-size:7.5pt}thead th.wk{background:#3f6f9a}'
    + '.c-prod{width:12%;text-align:left;font-weight:700;padding:2px 4px;font-size:8pt}'
    + '.c-info{width:9%;text-align:left;font-size:7pt;color:#4a5568;padding:2px 4px}'
    + '.c-freq{width:7%;font-size:7pt;color:#4a5568}'
    + '.c-slot{width:6.5%;font-size:7pt;font-weight:700;color:#2f3b52}'
    + 'thead .c-prod,thead .c-info,thead .c-freq,thead .c-slot{color:#fff;font-size:7.5pt}'
    + '.c-day{font-size:7.5pt;padding:1px 0}.wd{display:block;font-size:6pt;font-weight:400;opacity:.85}'
    + 'td.v{font-size:7pt;font-weight:700;color:#1b5e20;height:15px}'
    + 'td.cl{background:#fde8e8;color:#b71c1c;font-weight:800}thead th.cl{background:#a33}.sw.cl{background:#fde8e8;color:#b71c1c;font-size:6pt;text-align:center;line-height:8px;font-weight:800}'
    + 'td.wk{background:#eef1f4}td.fut{background:repeating-linear-gradient(45deg,#fff,#fff 2px,#e7ebef 2px,#e7ebef 4px)}'
    + 'tr.alt td.c-prod,tr.alt td.c-info,tr.alt td.c-freq,tr.alt td.c-slot{background:#f6f8fb}'
    + 'tr.last td{border-bottom:1.6px solid #8a97a8}'
    + 'footer{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-top:6px;font-size:7.5pt;color:#2f3b52}'
    + '.leg{line-height:1.6}.sw{display:inline-block;width:10px;height:8px;border:1px solid #c9d2dc;vertical-align:middle;margin:0 2px}'
    + '.sw.wk{background:#eef1f4}.sw.fut{background:repeating-linear-gradient(45deg,#fff,#fff 2px,#e7ebef 2px,#e7ebef 4px)}'
    + '.visa{border:1px solid #8a97a8;border-radius:4px;padding:4px 8px;min-width:230px;height:46px;font-weight:700}'
    + '.visa span{display:inline-block;width:48%;font-weight:400;margin-top:12px}'
    + '</style></head><body>' + pages + '</body></html>';

  const old = document.getElementById('entr-print-frame');
  if (old) old.remove();
  const f = document.createElement('iframe');
  f.id = 'entr-print-frame';
  f.setAttribute('aria-hidden', 'true');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(f);
  const doc = f.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { alert('Impression impossible : ' + e.message); } };
  const img = doc.querySelector('header img');
  if (img && !img.complete) { img.onload = img.onerror = () => setTimeout(go, 50); }
  else setTimeout(go, 100);
}

// ── Saisie : chaque case est indépendante (pas de remplissage automatique) ──
function _wireInputs(container, data, onCellSave) {
  container.querySelectorAll('.entr-init-inp:not([disabled])').forEach(inp => {
    inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase(); });
    inp.addEventListener('blur', () => {
      const val = inp.value.trim().toUpperCase();
      const { fiche, day, prod, slot } = inp.dataset;
      inp.value = val;
      if (_getVal(data, fiche, day, prod, slot) === val && !inp.closest('td').classList.contains('entr-err')) return;
      _setVal(data, fiche, day, prod, slot, val);
      inp.closest('td').classList.toggle('entr-filled', val.length > 0);
      onCellSave(inp, fiche, day, prod, slot, val);
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
  });
}

async function renderEntretien(container, onBack) {
  const now = new Date();
  let year          = now.getFullYear();
  let month         = now.getMonth() + 1;
  let activeFicheId = ENTRETIEN_FICHES[0].id;
  let data          = {};
  let enCours       = 0;
  const INIT_KEY    = 'hp_entr_initiales';
  const lsGet = () => { try { return localStorage.getItem(INIT_KEY) || ''; } catch (e) { return ''; } };
  const lsSet = v => { try { localStorage.setItem(INIT_KEY, v); } catch (e) {} };

  async function _renderWithLoad() {
    try { data = await _loadEntr(year, month); }
    catch (e) { console.error('Entretien load error:', e); data = {}; }
    _render();
  }

  // Indicateur d'enregistrement (« Enregistrement… » / « Enregistré ✓ » / échec)
  function _status(etat, msg) {
    const el = document.getElementById('entr-status');
    if (!el) return;
    el.className = 'entr-status entr-status-' + etat;
    el.textContent = msg;
  }

  function _save(inp, ficheId, day, prodId, slot, val) {
    enCours++;
    _status('busy', 'Enregistrement…');
    const td = inp ? inp.closest('td') : null;
    return _saveCell(ficheId, day, prodId, slot, val)
      .then(() => {
        if (td) td.classList.remove('entr-err');
        if (--enCours === 0) _status('ok', 'Enregistré ✓');
      })
      .catch(e => {
        enCours--;
        console.error('Entretien save error:', e);
        if (td) td.classList.add('entr-err');
        _status('err', 'Échec de l\'enregistrement — vérifiez la connexion puis ressaisissez la case en rouge');
      });
  }

  function _render() {
    const fiche = ENTRETIEN_FICHES.find(f => f.id === activeFicheId);
    const today = _todayISOEntr();
    const moisCourant = today.slice(0, 7) === (year + '-' + String(month).padStart(2, '0'));
    const slotsFiche  = Array.from(new Set(fiche.produits.reduce((a, p) => a.concat(p.slots), [])));

    const tabs = ENTRETIEN_FICHES.map(f =>
      '<button type="button" class="entr-tab' + (f.id === activeFicheId ? ' active' : '') + '" data-fiche="' + f.id + '">' + f.label + '</button>'
    ).join('');

    container.innerHTML = '<div class="entr-view">'
      + '<div class="nb entr-nb">'
      +   '<button type="button" class="nb-back" id="entr-back">← Main courante</button>'
      +   '<span class="entr-title">Fiches d\'entretien</span>'
      +   '<span class="nb-sp"></span>'
      +   '<button type="button" class="nb-arrow" id="entr-prev" aria-label="Mois précédent">&#8592;</button>'
      +   '<span class="nb-date entr-month">' + _fmtMonthYear(year, month) + '</span>'
      +   '<button type="button" class="nb-arrow" id="entr-next" aria-label="Mois suivant">&#8594;</button>'
      +   '<span class="nb-sp"></span>'
      +   '<span class="st-export-lbl">PDF :</span>'
      +   '<button type="button" class="nb-sec" id="entr-export">Cette fiche</button>'
      +   '<button type="button" class="nb-sec" id="entr-export-all">Toutes les fiches</button>'
      + '</div>'
      + '<div class="entr-tabs" role="tablist">' + tabs + '</div>'
      // Validation groupée, explicite et confirmée (uniquement aujourd'hui)
      + (moisCourant && data._fermes && data._fermes[today]
          ? '<div class="entr-bulk entr-bulk-closed"><span class="entr-bulk-t entr-bulk-t-closed">Plage fermée aujourd\'hui</span>'
            + '<span class="entr-bulk-l">' + _escE(data._fermes[today]) + ' — aucun contrôle attendu</span><span class="nb-sp"></span>'
            + '<span class="entr-status" id="entr-status" role="status" aria-live="polite"></span></div>'
          : moisCourant
          ? '<div class="entr-bulk">'
            + '<span class="entr-bulk-t">Aujourd\'hui</span>'
            + '<label class="entr-bulk-init">Vos initiales <input type="text" id="entr-initiales" maxlength="5" autocomplete="off" value="' + _escE(lsGet()) + '"></label>'
            + '<span class="entr-bulk-l">Tout valider :</span>'
            + slotsFiche.map(s => '<button type="button" class="entr-bulk-btn" data-slot="' + s + '">' + (SLOT_LABELS[s] || s) + '</button>').join('')
            + '<span class="nb-sp"></span>'
            + '<span class="entr-status" id="entr-status" role="status" aria-live="polite"></span>'
            + '</div>'
          : '<div class="entr-bulk"><span class="nb-sp"></span><span class="entr-status" id="entr-status" role="status" aria-live="polite"></span></div>')
      + '<div class="entr-body">' + _renderFicheTable(fiche, data, year, month) + '</div>'
      + '</div>';

    document.getElementById('entr-back').addEventListener('click', () => { if (onBack) onBack(); });
    document.getElementById('entr-export').addEventListener('click', () => _exportEntretienPDF([fiche], data, year, month));
    document.getElementById('entr-export-all').addEventListener('click', () => _exportEntretienPDF(ENTRETIEN_FICHES, data, year, month));

    document.getElementById('entr-prev').addEventListener('click', () => {
      month--; if (month < 1) { month = 12; year--; }
      _renderWithLoad();
    });
    document.getElementById('entr-next').addEventListener('click', () => {
      month++; if (month > 12) { month = 1; year++; }
      _renderWithLoad();
    });

    container.querySelectorAll('.entr-tab').forEach(btn => {
      btn.addEventListener('click', () => { activeFicheId = btn.dataset.fiche; _render(); });
    });

    _wireInputs(container, data, _save);

    const initEl = document.getElementById('entr-initiales');
    if (initEl) {
      initEl.addEventListener('input', () => { initEl.value = initEl.value.toUpperCase(); });
      initEl.addEventListener('change', () => lsSet(initEl.value.trim()));
    }
    container.querySelectorAll('.entr-bulk-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ini = (initEl.value || '').trim().toUpperCase();
        if (!ini) { initEl.focus(); _status('err', 'Saisissez d\'abord vos initiales'); return; }
        const slot = btn.dataset.slot;
        const vides = fiche.produits.filter(p => p.slots.includes(slot) && !_getVal(data, fiche.id, today, p.id, slot));
        if (!vides.length) { _status('ok', 'Tout est déjà renseigné pour ce moment'); return; }
        const msg = 'Inscrire « ' + ini + ' » pour ' + vides.length + ' surface' + (vides.length > 1 ? 's' : '')
          + ' non renseignée' + (vides.length > 1 ? 's' : '') + ' (' + (SLOT_LABELS[slot] || slot).toLowerCase() + ', aujourd\'hui) ?\n\n'
          + vides.map(p => '• ' + p.label).join('\n')
          + '\n\nNe validez que les surfaces réellement nettoyées.';
        if (!confirm(msg)) return;
        lsSet(ini);
        vides.forEach(p => {
          _setVal(data, fiche.id, today, p.id, slot, ini);
          const inp = container.querySelector('.entr-init-inp[data-day="' + today + '"][data-prod="' + p.id + '"][data-slot="' + slot + '"]');
          if (inp) { inp.value = ini; inp.closest('td').classList.add('entr-filled'); }
          _save(inp, fiche.id, today, p.id, slot, ini);
        });
      });
    });

    // Amener la colonne du jour à l'écran (juste après les colonnes fixes)
    const wrap = document.getElementById('entr-table-wrap');
    const col  = document.getElementById('entr-today-col');
    if (wrap && col) {
      const fixe = 150 + 140 + 86;
      wrap.scrollLeft = Math.max(0, col.offsetLeft - fixe - 3 * col.offsetWidth);
    }
  }

  await _renderWithLoad();
}
