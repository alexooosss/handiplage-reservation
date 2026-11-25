'use strict';

var StatsView = (function () {
  var _period  = null;      // 'week' | 'month' | 'season' — choisi automatiquement au premier affichage
  var _charts  = {};
  var _subview = 'stats';   // 'stats' | 'map'
  var _last    = null;      // dernières données affichées (pour l'export)

  var CRENEAUX = [
    { id: 1, label: '8h30–10h15' },
    { id: 2, label: '10h30–12h15' },
    { id: 3, label: '12h30–14h15' },
    { id: 4, label: '14h30–16h15' },
    { id: 5, label: '16h30–18h15' },
  ];
  // Couleurs des créneaux : les mêmes que dans le Planning et la Main courante
  var SLOT_C = (typeof SLOT_COLORS !== 'undefined') ? SLOT_COLORS : ['#1565c0', '#2e7d32', '#e65100', '#6a1b9a', '#f9a825'];
  var BLUE  = '#05559b';
  var GRID  = 'rgba(15,27,46,0.06)';
  var LABEL = '#5b6576';

  var MATERIEL = [
    { key: 'tiralos',       label: 'Tiralo' },
    { key: 'hippocampes',   label: 'Hippocampe' },
    { key: 'audioplage',    label: 'Audioplage' },
    { key: 'transferts',    label: 'Transferts' },
    { key: 'leve_personne', label: 'Lève-personne' },
  ];

  // ── Dates ──
  function _iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function _today() { return _iso(new Date()); }
  // Saison de référence : de janvier à mai, c'est encore la saison de l'an passé qui compte
  function _seasonYear() { var n = new Date(); return n.getMonth() < 5 ? n.getFullYear() - 1 : n.getFullYear(); }
  function _inSeason() { var m = new Date().getMonth(); return m >= 5 && m <= 8; }
  function _seasonRange(y) {
    var start = y + '-06-01', end = y + '-09-30', today = _today();
    return { start: start, end: today < end ? today : end };
  }
  function _getRange(period) {
    var today = _today();
    if (period === 'week') {
      var d = new Date(), dow = d.getDay();
      d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
      return { start: _iso(d), end: today };
    }
    if (period === 'month') {
      var n = new Date();
      return { start: n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-01', end: today };
    }
    return _seasonRange(_seasonYear());
  }
  function _minusYear(iso) { return (parseInt(iso.slice(0, 4)) - 1) + iso.slice(4); }
  function _fmtJ(iso, opts) { return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', opts || { day: 'numeric', month: 'long' }); }

  function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Calculs ──
  function _isGroupe(r) { return r.resa_type === 'groupe'; }
  function _usagerResas(resas) { return resas.filter(function (r) { return !_isGroupe(r); }); }

  function _bilanResas(resas) {
    var u = _usagerResas(resas);
    var presents = u.filter(function (r) { return r.statut === 'present' || r.statut === 'parti'; }).length;
    var absents  = u.filter(function (r) { return r.statut === 'absent' || r.statut === 'pas_venu'; }).length;
    var annules  = u.filter(function (r) { return r.statut === 'annule'; }).length;
    var suspendues = u.filter(function (r) { return r.statut === 'suspendu'; }).length;
    var attentes = u.filter(function (r) { return r.statut === 'attente'; }).length;
    var honored  = presents + absents;
    return {
      total: u.length - annules - suspendues, presents: presents, absents: absents, annules: annules, attentes: attentes, suspendues: suspendues,
      taux: honored > 0 ? Math.round((presents / honored) * 100) : null,
    };
  }

  // Venues de groupes : une par groupe + date + créneau
  function _bilanGroupes(resas) {
    var map = {};
    resas.filter(_isGroupe).forEach(function (r) {
      if (r.statut === 'annule' || r.statut === 'suspendu') return;
      var k = (r.groupe_id || r.nom) + '|' + r.date + '|' + r.creneau_id;
      if (!map[k]) map[k] = { places: 0, venu: false };
      map[k].places++;
      if (r.statut === 'present' || r.statut === 'parti') map[k].venu = true;
    });
    var v = Object.values(map);
    return {
      venues: v.filter(function (x) { return x.venu; }).length,
      places: v.filter(function (x) { return x.venu; }).reduce(function (s, x) { return s + x.places; }, 0),
      prevues: v.length,
    };
  }

  // Main courante : somme des compteurs sur la période
  function _bilanMc(rows) {
    var t = { resa: 0, walkin: 0, acc_total: 0, gpe_pers: 0, gpe_acc: 0 };
    MATERIEL.forEach(function (m) { t[m.key] = 0; });
    var jours = {}, fermes = {};
    rows.forEach(function (r) {
      var c = r.compteurs || {};
      Object.keys(t).forEach(function (k) { t[k] += Number(c[k]) || 0; });
      if (r.staff && r.staff.fermee) fermes[r.date] = r.staff.fermee_motif || '';
      else jours[r.date] = true;
    });
    t.jours = Object.keys(jours).length;          // jours ouverts avec main courante remplie
    t.fermetures = Object.keys(fermes).sort().map(function (d) { return { date: d, motif: fermes[d] }; });
    t.personnes = t.resa + t.walkin + t.acc_total + t.gpe_pers + t.gpe_acc;
    return t;
  }

  // ── Petits blocs HTML ──
  function _kpi(cls, value, label, sub) {
    return '<div class="st-kpi"><span class="st-kpi-n ' + cls + '">' + value + '</span>'
      + '<span class="st-kpi-l">' + label + '</span><span class="st-kpi-s">' + (sub || '&nbsp;') + '</span></div>';
  }
  function _delta(cur, prev, unite) {
    if (prev == null || cur == null) return '';
    if (prev === 0 && cur === 0) return '';
    var diff = cur - prev;
    var signe = diff > 0 ? '+' : diff < 0 ? '−' : '±';
    return signe + Math.abs(diff) + (unite || '') + ' par rapport à l\'an dernier (' + prev + (unite === ' pt' ? ' %' : '') + ')';
  }
  function _vide(msg) { return '<div class="stats-empty">' + msg + '</div>'; }

  function _statutsBar(b) {
    var parts = [
      { n: b.presents, l: 'Présents',   c: 'st-seg-ok' },
      { n: b.absents,  l: 'Absents',    c: 'st-seg-ko' },
      { n: b.attentes, l: 'En attente', c: 'st-seg-wait' },
      { n: b.annules,  l: 'Annulés',    c: 'st-seg-na' },
      { n: b.suspendues, l: 'Suspendues (plage fermée)', c: 'st-seg-sus' },
    ].filter(function (p) { return p.n || p.c !== 'st-seg-sus'; });
    var tot = parts.reduce(function (s, p) { return s + p.n; }, 0);
    if (!tot) return _vide('Aucune réservation sur cette période.');
    return '<div class="st-bar" role="img" aria-label="' + parts.map(function (p) { return p.l + ' ' + p.n; }).join(', ') + '">'
      + parts.filter(function (p) { return p.n; }).map(function (p) {
          return '<span class="st-seg ' + p.c + '" style="flex:' + p.n + '" title="' + p.l + ' : ' + p.n + '"></span>';
        }).join('')
      + '</div>'
      + '<ul class="st-legend">' + parts.map(function (p) {
          return '<li><span class="st-sw ' + p.c + '"></span><span class="st-leg-l">' + p.l + '</span>'
            + '<b>' + p.n + '</b><span class="st-leg-p">' + Math.round(p.n / tot * 100) + ' %</span></li>';
        }).join('') + '</ul>';
  }

  function _materielList(mc) {
    var max = Math.max.apply(null, MATERIEL.map(function (m) { return mc[m.key]; }).concat([0]));
    if (!max) return _vide(mc.jours ? 'Aucun matériel noté dans la main courante sur cette période.' : 'Aucune main courante remplie sur cette période.');
    return '<ul class="st-hbars">' + MATERIEL.map(function (m) {
      var v = mc[m.key];
      return '<li><span class="st-hb-l">' + m.label + '</span>'
        + '<span class="st-hb-track"><span class="st-hb-fill" style="width:' + (v ? Math.max(2, v / max * 100) : 0) + '%"></span></span>'
        + '<b class="st-hb-v">' + v + '</b></li>';
    }).join('') + '</ul>';
  }

  // Nom cliquable : ouvre la fiche d'inscription
  function _nomUsager(u) {
    var nom = '<b class="st-u-nom">' + _esc((u.nom || '').toUpperCase()) + '</b> ' + _esc(u.prenom || '');
    return u.inscriptionId
      ? '<button type="button" class="st-u-link" data-insc="' + _esc(u.inscriptionId) + '" title="Ouvrir la fiche d\'inscription">' + nom + '</button>'
      : '<span class="st-u-txt">' + nom + '</span>';
  }
  function _telLisible(t) {
    var d = String(t || '').replace(/\D/g, '');
    return d.length === 10 ? d.replace(/(\d{2})(?=\d)/g, '$1 ') : t;
  }

  function _absentsTable(resas, phonesMap) {
    var map = {};
    _usagerResas(resas).forEach(function (r) {
      if (r.statut !== 'absent' && r.statut !== 'pas_venu') return;
      var key = r.inscription_id || ((r.nom || '') + '|' + (r.prenom || ''));
      if (!map[key]) map[key] = { nom: r.nom, prenom: r.prenom, inscriptionId: r.inscription_id, total: 0, derniere: '' };
      map[key].total++;
      if (r.date > map[key].derniere) map[key].derniere = r.date;
    });
    var rows = Object.values(map).sort(function (a, b) { return b.total - a.total || b.derniere.localeCompare(a.derniere); });
    if (!rows.length) return _vide('Aucune absence sur cette période.');
    return '<div class="stats-table-wrap"><table class="stats-table st-table">'
      + '<thead><tr><th>Usager</th><th class="st-th-c">Absences</th><th>Dernière</th><th>Téléphone</th></tr></thead><tbody>'
      + rows.map(function (u) {
          var phone = u.inscriptionId && phonesMap[u.inscriptionId];
          var phoneHtml = phone && phone !== '—'
            ? '<a class="st-tel" href="tel:' + _esc(String(phone).replace(/\s/g, '')) + '">' + _esc(_telLisible(phone)) + '</a>'
            : '<span class="st-muted">—</span>';
          return '<tr><td>' + _nomUsager(u) + (u.total >= 3 ? ' <span class="st-relance">à relancer</span>' : '') + '</td>'
            + '<td class="st-td-c"><span class="st-abs-n' + (u.total >= 3 ? ' fort' : '') + '">' + u.total + '</span></td>'
            + '<td class="st-muted">' + _fmtJ(u.derniere, { day: 'numeric', month: 'short' }) + '</td>'
            + '<td>' + phoneHtml + '</td></tr>';
        }).join('')
      + '</tbody></table></div>';
  }

  function _topTable(resas) {
    var map = {};
    _usagerResas(resas).forEach(function (r) {
      if (r.statut === 'annule' || r.statut === 'suspendu') return;
      var key = r.inscription_id || ((r.nom || '') + '|' + (r.prenom || ''));
      if (!map[key]) map[key] = { nom: r.nom, prenom: r.prenom, inscriptionId: r.inscription_id, total: 0, presents: 0, absents: 0 };
      map[key].total++;
      if (r.statut === 'present' || r.statut === 'parti') map[key].presents++;
      if (r.statut === 'absent' || r.statut === 'pas_venu') map[key].absents++;
    });
    var rows = Object.values(map).sort(function (a, b) { return b.total - a.total; }).slice(0, 10);
    if (!rows.length) return _vide('Aucune réservation sur cette période.');
    var max = rows[0].total;
    return '<div class="stats-table-wrap"><table class="stats-table st-table">'
      + '<thead><tr><th class="st-th-rank">#</th><th>Usager</th><th>Réservations</th>'
      + '<th class="st-th-c">Présence</th><th class="st-th-c">Absences</th></tr></thead><tbody>'
      + rows.map(function (u, i) {
          var pointes = u.presents + u.absents;
          var taux = pointes ? Math.round(u.presents / pointes * 100) : null;
          return '<tr><td class="stats-rank">' + (i + 1) + '</td><td>' + _nomUsager(u) + '</td>'
            + '<td><span class="st-mini"><span class="st-mini-track"><span class="st-mini-fill" style="width:' + (u.total / max * 100) + '%"></span></span><b>' + u.total + '</b></span></td>'
            + '<td class="st-td-c">' + (taux == null ? '<span class="st-muted">—</span>' : '<span class="st-taux' + (taux < 75 ? ' bas' : '') + '">' + taux + ' %</span>') + '</td>'
            + '<td class="st-td-c">' + (u.absents ? '<span class="st-abs-n">' + u.absents + '</span>' : '<span class="st-muted">0</span>') + '</td></tr>';
        }).join('')
      + '</tbody></table></div>';
  }

  // ── Graphiques (barres uniquement : des totaux, pas de lissage) ──
  function _destroyCharts() {
    Object.keys(_charts).forEach(function (k) { try { _charts[k].destroy(); } catch (e) {} });
    _charts = {};
  }
  function _tooltip(unite) {
    return {
      backgroundColor: '#0f1b2e', titleColor: '#fff', bodyColor: 'rgba(255,255,255,.88)',
      padding: 10, cornerRadius: 8, displayColors: false,
      callbacks: { label: function (c) { return ' ' + c.raw + ' ' + (unite || 'réservation') + (c.raw > 1 ? 's' : ''); } },
    };
  }
  function _axes(xMaxTicks) {
    return {
      x: { grid: { display: false }, ticks: { color: LABEL, font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: xMaxTicks || 12 } },
      y: { grid: { color: GRID }, border: { display: false }, ticks: { color: LABEL, font: { size: 11 }, precision: 0 }, beginAtZero: true },
    };
  }
  function _bar(id, labels, data, colors, unite, maxTicks) {
    var ctx = document.getElementById(id);
    if (!ctx || typeof Chart === 'undefined') return;
    _charts[id] = new Chart(ctx, {
      type: 'bar',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderRadius: 4, borderSkipped: 'bottom', maxBarThickness: 48, categoryPercentage: .8, barPercentage: .9 }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
        plugins: { legend: { display: false }, tooltip: _tooltip(unite) },
        scales: _axes(maxTicks),
      },
    });
  }

  function _dailySeries(resas, range) {
    var dates = [], d = new Date(range.start + 'T12:00:00'), end = new Date(range.end + 'T12:00:00');
    while (d <= end) { dates.push(_iso(d)); d.setDate(d.getDate() + 1); }
    var counts = {};
    dates.forEach(function (x) { counts[x] = 0; });
    _usagerResas(resas).forEach(function (r) { if (r.statut !== 'annule' && r.statut !== 'suspendu' && counts[r.date] !== undefined) counts[r.date]++; });
    return { labels: dates.map(function (x) { return _fmtJ(x, { day: '2-digit', month: '2-digit' }); }), data: dates.map(function (x) { return counts[x]; }), dates: dates };
  }
  function _creneauSeries(resas) {
    var counts = {};
    CRENEAUX.forEach(function (c) { counts[c.id] = 0; });
    _usagerResas(resas).forEach(function (r) { if (r.statut !== 'annule' && r.statut !== 'suspendu' && counts[r.creneau_id] !== undefined) counts[r.creneau_id]++; });
    return CRENEAUX.map(function (c) { return counts[c.id]; });
  }
  function _weeklySeries(resas, sy) {
    var start = new Date(sy + '-06-01T12:00:00'), finSaison = new Date(sy + '-09-30T12:00:00'), now = new Date();
    var fin = now < finSaison ? now : finSaison;
    var dow = start.getDay(); start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));
    var weeks = [], d = new Date(start);
    while (d <= fin) {
      var e = new Date(d); e.setDate(e.getDate() + 6);
      weeks.push({ label: _fmtJ(_iso(d), { day: '2-digit', month: '2-digit' }), start: _iso(d), end: _iso(e), count: 0 });
      d.setDate(d.getDate() + 7);
    }
    _usagerResas(resas).forEach(function (r) {
      if (r.statut === 'annule' || r.statut === 'suspendu') return;
      var w = weeks.find(function (w) { return r.date >= w.start && r.date <= w.end; });
      if (w) w.count++;
    });
    return weeks;
  }

  // ── Export du bilan (CSV, s'ouvre dans Excel / LibreOffice) ──
  function _exportCsv() {
    if (!_last) return;
    var L = _last, rows = [];
    var q = function (v) { v = String(v == null ? '' : v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var add = function () { rows.push(Array.prototype.map.call(arguments, q).join(';')); };
    add('Bilan Handiplage — CCAS d\'Antibes');
    add('Période', _fmtJ(L.range.start, { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' au ' + _fmtJ(L.range.end, { day: '2-digit', month: '2-digit', year: 'numeric' }));
    add('');
    add('Réservations (usagers)', L.b.total);
    add('Présents', L.b.presents); add('Absents', L.b.absents); add('En attente', L.b.attentes); add('Annulées', L.b.annules);
    add('Taux de présence (%)', L.b.taux == null ? '' : L.b.taux);
    add('Inscrits actifs', L.active);
    add('');
    add('Fréquentation (main courante, ' + L.mc.jours + ' jour(s) remplis)');
    add('Usagers avec réservation', L.mc.resa); add('Usagers sans réservation', L.mc.walkin);
    add('Accompagnants', L.mc.acc_total); add('Personnes en groupe', L.mc.gpe_pers); add('Accompagnants de groupe', L.mc.gpe_acc);
    add('Total personnes accueillies', L.mc.personnes);
    add('');
    add('Jours de fermeture', L.mc.fermetures.length);
    L.mc.fermetures.forEach(function (f) { add(_fmtJ(f.date, { day: '2-digit', month: '2-digit', year: 'numeric' }), f.motif || ''); });
    add('');
    add('Matériel utilisé');
    MATERIEL.forEach(function (m) { add(m.label, L.mc[m.key]); });
    add('');
    add('Groupes : venues', L.g.venues); add('Groupes : places occupées', L.g.places);
    add('');
    add('Réservations par créneau');
    CRENEAUX.forEach(function (c, i) { add(c.label, L.creneaux[i]); });
    add('');
    add('Réservations par jour');
    L.daily.dates.forEach(function (d, i) { add(_fmtJ(d, { day: '2-digit', month: '2-digit', year: 'numeric' }), L.daily.data[i]); });

    var blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bilan-handiplage-' + L.range.start + '_' + L.range.end + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  // ── Export PDF : document A4 dédié, imprimé via la fenêtre d'impression (« Enregistrer au format PDF ») ──
  function _exportPdf() {
    if (!_last) return;
    var L = _last, sy = _seasonYear();
    var img = function (id) {
      var c = _charts[id];
      try { return c ? c.toBase64Image('image/png', 1) : null; } catch (e) { return null; }
    };
    var dDaily = img('st-daily'), dSeason = img('st-season');
    var per = _fmtJ(L.range.start, { day: 'numeric', month: 'long', year: 'numeric' }) + ' au ' + _fmtJ(L.range.end, { day: 'numeric', month: 'long', year: 'numeric' });
    var titrePer = { week: 'Semaine', month: 'Mois', season: 'Saison ' + sy }[_period] || '';
    var logo = new URL('logo-handiplage-mot-bleu.svg', location.href).href;
    var stat = [['Présents', L.b.presents, '#2e7d32'], ['Absents', L.b.absents, '#c62828'], ['En attente', L.b.attentes, '#05559b'], ['Annulés', L.b.annules, '#9aa4b2']];
    var totStat = stat.reduce(function (s, x) { return s + x[1]; }, 0);
    var maxMat = Math.max.apply(null, MATERIEL.map(function (m) { return L.mc[m.key]; }).concat([1]));
    var kpi = function (v, l, s) { return '<div class="k"><div class="kv">' + v + '</div><div class="kl">' + l + '</div>' + (s ? '<div class="ks">' + s + '</div>' : '') + '</div>'; };
    var bloc = function (t, html) { return '<section><h2>' + t + '</h2>' + html + '</section>'; };
    var vide = function (t) { return '<p class="vide">' + t + '</p>'; };

    var html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bilan Handiplage — ' + _esc(titrePer) + ' (' + _esc(per) + ')</title><style>'
      + '@page{size:A4 portrait;margin:14mm 13mm 16mm}'
      + '*{box-sizing:border-box}body{margin:0;font-family:"Segoe UI",Arial,sans-serif;color:#1f2a3d;font-size:10.5pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + 'header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #05559b;padding-bottom:8px;margin-bottom:12px}'
      + 'header img{height:30px}header .t{text-align:right}header h1{margin:0;font-size:16pt;color:#05559b}header p{margin:2px 0 0;font-size:9.5pt;color:#5b6576}'
      + 'h2{font-size:10pt;text-transform:uppercase;letter-spacing:.06em;color:#05559b;margin:0 0 7px}'
      + 'section{border:1px solid #dfe6ee;border-radius:8px;padding:8px 11px;margin-bottom:8px;break-inside:avoid}'
      + '.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px}'
      + '.k{border:1px solid #dfe6ee;border-radius:8px;padding:8px 10px;break-inside:avoid}.kv{font-size:20pt;font-weight:800;color:#05559b;line-height:1.1}'
      + '.kl{font-weight:700;font-size:9.5pt}.ks{font-size:8pt;color:#5b6576;margin-top:2px}'
      + '.cols{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cols section{margin-bottom:8px}'
      + 'table{width:100%;border-collapse:collapse;font-size:9.5pt}td{padding:2px 0;border-bottom:1px solid #eef2f6}td.n{text-align:right;font-weight:700;width:60px}'
      + '.tot{display:flex;align-items:baseline;gap:8px;margin-bottom:6px}.tot b{font-size:18pt;color:#05559b}'
      + '.hb{display:grid;grid-template-columns:95px 1fr 34px;gap:8px;align-items:center;margin:4px 0;font-size:9.5pt}.hb i{display:block;height:8px;background:#05559b;border-radius:0 3px 3px 0}.hb s{display:block;background:#eef2f6;border-radius:3px;text-decoration:none}.hb b{text-align:right}'
      + '.sbar{display:flex;gap:2px;height:12px;border-radius:3px;overflow:hidden;margin:2px 0 8px}'
      + '.leg{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:9.5pt}.leg span{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px}'
      + '.chart img{display:block;width:100%;height:38mm;object-fit:fill}'
      + '.sw{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px}td.p{text-align:right;width:44px;color:#5b6576}'
      + '.hb{grid-template-columns:105px 1fr 34px}'
      + '.vide{color:#5b6576;font-style:italic;margin:4px 0}'
      + 'footer{margin-top:6px;font-size:8pt;color:#5b6576;display:flex;justify-content:space-between}'
      + '</style></head><body>'
      + '<header><img src="' + logo + '" alt="Handiplage"><div class="t"><h1>Bilan de fréquentation — ' + _esc(titrePer) + '</h1><p>Handiplage d\'Antibes · CCAS · du ' + _esc(per) + '</p></div></header>'

      + '<div class="kpis">'
      +   kpi(L.b.total, 'Réservations', 'usagers, hors annulations')
      +   kpi(L.b.taux == null ? '—' : L.b.taux + ' %', 'Taux de présence', L.b.taux == null ? 'aucun pointage' : L.b.presents + ' présents / ' + (L.b.presents + L.b.absents) + ' pointés')
      +   kpi(L.b.absents, 'Absences', 'réservations non honorées')
      +   kpi(L.mc.fermetures.length, 'Jours de fermeture', L.mc.fermetures.length ? L.mc.fermetures.map(function (f) { return _fmtJ(f.date, { day: 'numeric', month: 'short' }); }).slice(0, 5).join(', ') + (L.mc.fermetures.length > 5 ? '…' : '') : 'aucune fermeture')
      + '</div>'

      + '<div class="cols">'
      +   bloc('Fréquentation <small style="text-transform:none;letter-spacing:0;color:#5b6576;font-weight:400">· main courante, ' + L.mc.jours + ' jour(s)</small>', L.mc.jours
            ? '<div class="tot"><b>' + L.mc.personnes + '</b> personnes accueillies</div><table>'
              + '<tr><td>Usagers avec réservation</td><td class="n">' + L.mc.resa + '</td></tr>'
              + '<tr><td>Usagers sans réservation</td><td class="n">' + L.mc.walkin + '</td></tr>'
              + '<tr><td>Accompagnants</td><td class="n">' + L.mc.acc_total + '</td></tr>'
              + '<tr><td>Personnes en groupe</td><td class="n">' + L.mc.gpe_pers + '</td></tr>'
              + '<tr><td>Accompagnants de groupe</td><td class="n">' + L.mc.gpe_acc + '</td></tr>'
              + '<tr><td>Venues de groupes (places)</td><td class="n">' + L.g.venues + ' (' + L.g.places + ')</td></tr></table>'
            : vide('Aucune main courante remplie sur cette période.'))
      +   bloc('Matériel utilisé', L.mc.jours
            ? MATERIEL.map(function (m) {
                var v = L.mc[m.key];
                return '<div class="hb"><span>' + m.label + '</span><s><i style="width:' + (v / maxMat * 100) + '%"></i></s><b>' + v + '</b></div>';
              }).join('')
            : vide('Aucune donnée.'))
      + '</div>'

      + '<div class="cols">'
      +   bloc('Statuts des réservations', totStat
            ? '<div class="sbar">' + stat.filter(function (s) { return s[1]; }).map(function (s) { return '<i style="flex:' + s[1] + ';background:' + s[2] + '"></i>'; }).join('') + '</div>'
              + '<table>' + stat.map(function (s) { return '<tr><td><span class="sw" style="background:' + s[2] + '"></span>' + s[0] + '</td><td class="n">' + s[1] + '</td><td class="p">' + Math.round(s[1] / totStat * 100) + ' %</td></tr>'; }).join('') + '</table>'
            : vide('Aucune réservation sur cette période.'))
      +   bloc('Réservations par créneau', L.b.total
            ? CRENEAUX.map(function (c, i) {
                var v = L.creneaux[i], max = Math.max.apply(null, L.creneaux.concat([1]));
                return '<div class="hb"><span>' + c.label + '</span><s><i style="width:' + (v / max * 100) + '%;background:' + SLOT_C[i] + '"></i></s><b>' + v + '</b></div>';
              }).join('')
            : vide('Aucune réservation.'))
      + '</div>'
      + bloc('Réservations par jour', dDaily ? '<div class="chart"><img src="' + dDaily + '" alt=""></div>' : vide('Aucune réservation sur cette période.'))
      + bloc('Saison ' + sy + ' — réservations par semaine', dSeason ? '<div class="chart"><img src="' + dSeason + '" alt=""></div>' : vide('Aucune réservation sur la saison.'))

      + '<footer><span>Document généré le ' + new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + '</span><span>Chiffres agrégés — aucune donnée nominative</span></footer>'
      + '</body></html>';

    // Impression depuis un cadre caché (pas de nouvel onglet ni de bloqueur de fenêtres)
    var old = document.getElementById('st-print-frame');
    if (old) old.remove();
    var f = document.createElement('iframe');
    f.id = 'st-print-frame';
    f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(f);
    var doc = f.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    var go = function () { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { alert('Impression impossible : ' + e.message); } };
    // Attendre le logo avant d'imprimer
    var logoImg = doc.querySelector('header img');
    if (logoImg && !logoImg.complete) { logoImg.onload = logoImg.onerror = function () { setTimeout(go, 50); }; }
    else setTimeout(go, 100);
  }

  // ── Rendu ──
  function _render(container, data) {
    var range = data.range, sy = _seasonYear();
    var b  = _bilanResas(data.periodResas);
    var bp = data.prevResas ? _bilanResas(data.prevResas) : null;
    var g  = _bilanGroupes(data.periodResas);
    var mc = _bilanMc(data.mcRows);
    var daily = _dailySeries(data.periodResas, range);
    var creneaux = _creneauSeries(data.periodResas);
    var weeks = _weeklySeries(data.seasonResas, sy);
    _last = { range: range, b: b, g: g, mc: mc, daily: daily, creneaux: creneaux, active: data.activeCount };

    var periodes = [
      { id: 'week', label: 'Cette semaine' },
      { id: 'month', label: 'Ce mois' },
      { id: 'season', label: 'Saison ' + sy },
    ];
    var cmp = function (cur, prev, unite) {
      if (!bp) return '';
      var t = _delta(cur, prev, unite);
      return t ? '<span class="st-cmp">' + t + '</span>' : '';
    };

    container.innerHTML = '<div class="stats-wrap st-wrap">'
      + '<div class="st-toolbar">'
      +   '<div class="st-periods" role="group" aria-label="Période">' + periodes.map(function (p) {
            return '<button type="button" class="st-period' + (_period === p.id ? ' on' : '') + '" aria-pressed="' + (_period === p.id) + '" data-period="' + p.id + '">' + p.label + '</button>';
          }).join('') + '</div>'
      +   '<span class="st-range">' + _fmtJ(range.start) + ' → ' + _fmtJ(range.end, { day: 'numeric', month: 'long', year: 'numeric' }) + '</span>'
      +   '<span class="st-sp"></span>'
      +   '<span class="st-export-lbl">Exporter le bilan :</span>'
      +   '<button type="button" class="st-export" id="st-export-pdf">PDF</button>'
      +   '<button type="button" class="st-export" id="st-export">Tableur</button>'
      + '</div>'

      // Chiffres clés
      + '<div class="st-kpis">'
      +   _kpi('k-blue', b.total, 'Réservations', cmp(b.total, bp && bp.total) || 'usagers, hors annulations')
      +   _kpi('k-green', b.taux == null ? '—' : b.taux + ' %', 'Taux de présence', b.taux == null ? 'aucun pointage sur la période' : (cmp(b.taux, bp && bp.taux, ' pt') || b.presents + ' présents / ' + (b.presents + b.absents) + ' pointés'))
      +   _kpi('k-red', b.absents, 'Absences', cmp(b.absents, bp && bp.absents) || 'réservations non honorées')
      +   _kpi('k-blue', data.activeCount, 'Inscrits actifs', 'inscriptions validées')
      + '</div>'

      // Fréquentation & matériel (main courante)
      + '<section class="stats-card st-card">'
      +   '<div class="st-card-hd"><h3 class="stats-card-title">Fréquentation et matériel</h3>'
      +     '<span class="st-src">d\'après la main courante · ' + mc.jours + ' jour' + (mc.jours > 1 ? 's' : '') + ' d\'ouverture rempli' + (mc.jours > 1 ? 's' : '') + '</span>'
      +     (mc.fermetures.length
              ? '<span class="st-ferme" title="' + _esc(mc.fermetures.map(function (f) { return _fmtJ(f.date, { day: 'numeric', month: 'short' }) + (f.motif ? ' — ' + f.motif : ''); }).join('\n')) + '">'
                + mc.fermetures.length + ' jour' + (mc.fermetures.length > 1 ? 's' : '') + ' de fermeture : '
                + mc.fermetures.slice(0, 6).map(function (f) { return _fmtJ(f.date, { day: 'numeric', month: 'short' }); }).join(', ')
                + (mc.fermetures.length > 6 ? '…' : '') + '</span>'
              : '')
      +   '</div>'
      +   (mc.jours
          ? '<div class="st-freq">'
            + '<div class="st-freq-total"><span class="st-big">' + mc.personnes + '</span><span>personnes accueillies</span></div>'
            + '<ul class="st-freq-list">'
            +   '<li><b>' + mc.resa + '</b> usagers avec réservation</li>'
            +   '<li><b>' + mc.walkin + '</b> usagers sans réservation</li>'
            +   '<li><b>' + mc.acc_total + '</b> accompagnants</li>'
            +   '<li><b>' + mc.gpe_pers + '</b> personnes en groupe <span class="st-muted">(+ ' + mc.gpe_acc + ' accompagnants)</span></li>'
            +   '<li><b>' + g.venues + '</b> venue' + (g.venues > 1 ? 's' : '') + ' de groupes <span class="st-muted">(' + g.places + ' places)</span></li>'
            + '</ul>'
            + '<div class="st-freq-mat"><h4>Matériel utilisé</h4>' + _materielList(mc) + '</div>'
            + '</div>'
          : _vide('Aucune main courante remplie sur cette période.'))
      + '</section>'

      + '<div class="stats-charts-row">'
      +   '<section class="stats-card st-card"><h3 class="stats-card-title">Réservations par jour</h3>'
      +     (b.total ? '<div class="stats-canvas-wrap"><canvas id="st-daily" aria-label="Réservations par jour"></canvas></div>' : _vide('Aucune réservation sur cette période.'))
      +   '</section>'
      +   '<section class="stats-card st-card"><h3 class="stats-card-title">Statuts des réservations</h3>' + _statutsBar(b) + '</section>'
      + '</div>'

      + '<div class="stats-charts-row">'
      +   '<section class="stats-card st-card"><h3 class="stats-card-title">Réservations par créneau</h3>'
      +     (b.total ? '<div class="stats-canvas-wrap"><canvas id="st-creneau" aria-label="Réservations par créneau"></canvas></div>' : _vide('Aucune réservation sur cette période.'))
      +   '</section>'
      +   '<section class="stats-card st-card"><h3 class="stats-card-title">Saison ' + sy + ' — réservations par semaine</h3>'
      +     (weeks.some(function (w) { return w.count; }) ? '<div class="stats-canvas-wrap"><canvas id="st-season" aria-label="Réservations par semaine"></canvas></div>' : _vide('Aucune réservation sur la saison ' + sy + '.'))
      +   '</section>'
      + '</div>'

      + '<div class="stats-charts-row st-tables-row">'
      +   '<section class="stats-card st-card"><h3 class="stats-card-title">Top 10 — usagers les plus actifs</h3>' + _topTable(data.periodResas) + '</section>'
      +   '<section class="stats-card st-card"><h3 class="stats-card-title">Réservations non honorées</h3>' + _absentsTable(data.periodResas, data.phonesMap || {}) + '</section>'
      + '</div>'
      + '</div>';

    container.querySelectorAll('.st-period').forEach(function (btn) {
      btn.addEventListener('click', function () { _period = btn.dataset.period; _renderStatsPanel(container); });
    });
    container.querySelector('#st-export').addEventListener('click', _exportCsv);
    container.querySelector('#st-export-pdf').addEventListener('click', _exportPdf);
    container.querySelectorAll('.st-u-link').forEach(function (b) {
      b.addEventListener('click', function () { if (typeof App !== 'undefined') App.showView('inscription', b.dataset.insc); });
    });

    requestAnimationFrame(function () {
      _destroyCharts();
      if (b.total) {
        _bar('st-daily', daily.labels, daily.data, BLUE, 'réservation', daily.labels.length > 40 ? 10 : 16);
        _bar('st-creneau', CRENEAUX.map(function (c, i) { return c.label + ' (' + creneaux[i] + ')'; }), creneaux, SLOT_C, 'réservation');
      }
      if (weeks.some(function (w) { return w.count; })) {
        _bar('st-season', weeks.map(function (w) { return w.label; }), weeks.map(function (w) { return w.count; }), BLUE, 'réservation', 18);
      }
    });
  }

  async function renderStats(container) {
    if (!_period) _period = _inSeason() ? 'week' : 'season';
    container.innerHTML = ''
      + '<div class="st-subtabs" role="tablist" aria-label="Vue">'
      +   '<button type="button" role="tab" class="st-subtab' + (_subview === 'stats' ? ' on' : '') + '" aria-selected="' + (_subview === 'stats') + '" data-subview="stats">Statistiques</button>'
      +   '<button type="button" role="tab" class="st-subtab' + (_subview === 'map' ? ' on' : '') + '" aria-selected="' + (_subview === 'map') + '" data-subview="map">Carte des usagers</button>'
      + '</div>'
      + '<div id="stats-subview"></div>';

    container.querySelectorAll('[data-subview]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (_subview === 'map' && btn.dataset.subview !== 'map' && typeof UsagersMap !== 'undefined') UsagersMap.destroy();
        _subview = btn.dataset.subview;
        renderStats(container);
      });
    });

    var sub = container.querySelector('#stats-subview');
    if (_subview === 'map') {
      if (typeof UsagersMap === 'undefined') { sub.innerHTML = '<div class="stats-error">Module carte non chargé.</div>'; return; }
      await UsagersMap.render(sub);
    } else {
      await _renderStatsPanel(sub);
    }
  }

  async function _renderStatsPanel(container) {
    container.innerHTML = '<div class="stats-loading">Chargement des statistiques…</div>';
    try {
      var range  = _getRange(_period);
      var season = _seasonRange(_seasonYear());
      var prev   = { start: _minusYear(range.start), end: _minusYear(range.end) };
      var same   = range.start === season.start && range.end === season.end;

      var res = await Promise.all([
        fetchStatsResas(range.start, range.end),
        same ? Promise.resolve(null) : fetchStatsResas(season.start, season.end),
        fetchActiveInscriptionsCount(),
        typeof fetchMcStats === 'function' ? fetchMcStats(range.start, range.end).catch(function () { return []; }) : Promise.resolve([]),
        fetchStatsResas(prev.start, prev.end).catch(function () { return null; }),
      ]);
      var periodResas = res[0];
      var absentIds = [];
      periodResas.forEach(function (r) {
        if ((r.statut === 'absent' || r.statut === 'pas_venu') && r.inscription_id && absentIds.indexOf(r.inscription_id) === -1) absentIds.push(r.inscription_id);
      });
      var phonesMap = await fetchInscriptionsPhones(absentIds);
      // Pas de comparaison si l'an dernier est vide (première saison)
      var prevResas = res[4] && res[4].length ? res[4] : null;

      _render(container, {
        range: range, periodResas: periodResas, seasonResas: res[1] || periodResas,
        activeCount: res[2], mcRows: res[3], prevResas: prevResas, phonesMap: phonesMap,
      });
    } catch (e) {
      container.innerHTML = '<div class="stats-error">Erreur : ' + _esc(e.message) + '</div>';
    }
  }

  return { render: renderStats };
})();
