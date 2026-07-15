'use strict';

var StatsView = (function () {
  var _period = 'month';
  var _charts = {};

  var CRENEAU_LABELS = {
    1: '8h30–10h15',
    2: '10h30–12h15',
    3: '12h30–14h15',
    4: '14h30–16h15',
    5: '16h30–18h15'
  };
  var BLUE   = '#0772b8';
  var GOLD   = '#f0c93a';
  var GREEN  = '#2e7d32';
  var RED    = '#c62828';
  var GREY   = '#9e9e9e';
  var GRID   = 'rgba(0,0,0,0.055)';
  var LABEL  = '#6b7280';

  function _today() { return new Date().toISOString().slice(0, 10); }
  function _year()  { return new Date().getFullYear(); }

  function _getRange(period) {
    var today = _today();
    var year  = _year();
    var start;
    if (period === 'week') {
      var d   = new Date();
      var dow = d.getDay();
      d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
      start = d.toISOString().slice(0, 10);
    } else if (period === 'month') {
      var m = String(new Date().getMonth() + 1).padStart(2, '0');
      start = year + '-' + m + '-01';
    } else {
      start = year + '-06-01';
    }
    return { start: start, end: today };
  }

  function _esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _kpi(icon, label, value, mod) {
    return '<div class="stats-kpi' + (mod ? ' stats-kpi-' + mod : '') + '">'
      + '<div class="stats-kpi-icon">' + icon + '</div>'
      + '<div class="stats-kpi-value">' + value + '</div>'
      + '<div class="stats-kpi-label">' + label + '</div>'
      + '</div>';
  }

  function _absentsTable(resas, phonesMap) {
    var map = {};
    resas.forEach(function(r) {
      if (r.statut !== 'absent' && r.statut !== 'pas_venu') return;
      var key = r.inscription_id || ((r.nom || '') + '|' + (r.prenom || ''));
      if (!map[key]) map[key] = { nom: r.nom, prenom: r.prenom, inscriptionId: r.inscription_id, total: 0 };
      map[key].total++;
    });

    var rows = Object.values(map).sort(function(a, b) { return b.total - a.total; });

    if (!rows.length) return '<div class="stats-empty">Aucune absence sur cette période.</div>';

    return '<div class="stats-table-wrap"><table class="stats-table">'
      + '<thead><tr>'
      + '<th>Usager</th>'
      + '<th class="stats-th-num">Non présentés</th>'
      + '<th>Téléphone</th>'
      + '</tr></thead>'
      + '<tbody>'
      + rows.map(function(u) {
          var phone = (u.inscriptionId && phonesMap[u.inscriptionId]) || '—';
          var phoneHtml = phone !== '—'
            ? '<a href="tel:' + phone.replace(/\s/g, '') + '" style="color:var(--navy);text-decoration:none">' + phone + '</a>'
            : '—';
          return '<tr>'
            + '<td>' + _esc(u.prenom) + ' ' + _esc(u.nom) + '</td>'
            + '<td class="stats-num stats-col-absent">' + u.total + '</td>'
            + '<td style="font-size:.875rem">' + phoneHtml + '</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table></div>';
  }

  function _topTable(resas) {
    var map = {};
    resas.forEach(function (r) {
      if (r.statut === 'annule') return;
      var key = r.inscription_id || ((r.nom || '') + '|' + (r.prenom || ''));
      if (!map[key]) map[key] = { nom: r.nom, prenom: r.prenom, total: 0, presents: 0, absents: 0 };
      map[key].total++;
      if (r.statut === 'present' || r.statut === 'parti') map[key].presents++;
      if (r.statut === 'absent') map[key].absents++;
    });

    var rows = Object.values(map).sort(function (a, b) { return b.total - a.total; }).slice(0, 10);
    if (!rows.length) return '<div class="stats-empty">Aucune donnée sur cette période.</div>';

    return '<div class="stats-table-wrap"><table class="stats-table">'
      + '<thead><tr>'
      + '<th class="stats-th-rank">#</th>'
      + '<th>Usager</th>'
      + '<th class="stats-th-num">Réservations</th>'
      + '<th class="stats-th-num">Présences</th>'
      + '<th class="stats-th-num">Absences</th>'
      + '</tr></thead>'
      + '<tbody>'
      + rows.map(function (u, i) {
          return '<tr>'
            + '<td class="stats-rank">' + (i + 1) + '</td>'
            + '<td>' + _esc(u.prenom) + ' ' + _esc(u.nom) + '</td>'
            + '<td class="stats-num">' + u.total + '</td>'
            + '<td class="stats-num stats-col-present">' + u.presents + '</td>'
            + '<td class="stats-num stats-col-absent">' + u.absents + '</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table></div>';
  }

  function _destroyCharts() {
    Object.keys(_charts).forEach(function (k) {
      try { _charts[k].destroy(); } catch (e) {}
    });
    _charts = {};
  }

  function _tooltipDefaults() {
    return {
      backgroundColor: '#1a2340',
      titleColor: '#fff',
      bodyColor: 'rgba(255,255,255,.8)',
      padding: 10,
      cornerRadius: 8,
      borderColor: 'rgba(255,255,255,.08)',
      borderWidth: 1
    };
  }

  function _axisOpts() {
    return {
      x: { grid: { color: GRID }, ticks: { color: LABEL, font: { size: 11 } } },
      y: { grid: { color: GRID }, ticks: { color: LABEL, font: { size: 11 }, precision: 0 }, beginAtZero: true }
    };
  }

  function _drawDaily(resas, range) {
    var ctx = document.getElementById('chart-daily');
    if (!ctx) return;

    var dates = [];
    var d = new Date(range.start + 'T12:00:00');
    var end = new Date(range.end + 'T12:00:00');
    while (d <= end) {
      dates.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }

    var counts = {};
    dates.forEach(function (dt) { counts[dt] = 0; });
    resas.forEach(function (r) {
      if (r.statut !== 'annule' && counts[r.date] !== undefined) counts[r.date]++;
    });

    var labels = dates.map(function (dt) {
      return new Date(dt + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    });

    _charts.daily = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: dates.map(function (dt) { return counts[dt]; }),
          borderColor: BLUE,
          backgroundColor: 'rgba(7,114,184,0.1)',
          fill: true, tension: 0.4,
          pointRadius: dates.length <= 14 ? 4 : 2,
          pointBackgroundColor: BLUE,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: _tooltipDefaults() },
        scales: _axisOpts()
      }
    });
  }

  function _drawStatuts(presents, absents, annules, attentes) {
    var ctx = document.getElementById('chart-statuts');
    if (!ctx) return;
    var total = presents + absents + annules + attentes;
    _charts.statuts = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Présents', 'Absents', 'Annulés', 'En attente'],
        datasets: [{
          data: [presents, absents, annules, attentes],
          backgroundColor: [GREEN, RED, GREY, BLUE],
          borderWidth: 2, borderColor: '#fff'
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '64%',
        plugins: {
          legend: {
            display: true, position: 'bottom',
            labels: { color: LABEL, font: { size: 11 }, padding: 14, usePointStyle: true }
          },
          tooltip: Object.assign({}, _tooltipDefaults(), {
            callbacks: {
              label: function (ctx) {
                var pct = total > 0 ? Math.round((ctx.raw / total) * 100) : 0;
                return ' ' + ctx.raw + ' (' + pct + '%)';
              }
            }
          })
        }
      }
    });
  }

  function _drawCreneau(resas) {
    var ctx = document.getElementById('chart-creneau');
    if (!ctx) return;
    var counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    resas.forEach(function (r) {
      if (r.statut !== 'annule' && r.creneau_id && counts[r.creneau_id] !== undefined) counts[r.creneau_id]++;
    });
    _charts.creneau = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.values(CRENEAU_LABELS),
        datasets: [{
          data: Object.keys(counts).map(function (k) { return counts[k]; }),
          backgroundColor: [
            'rgba(7,114,184,0.8)', 'rgba(7,114,184,0.55)',
            'rgba(240,201,58,0.85)', 'rgba(240,201,58,0.6)',
            'rgba(46,125,50,0.8)'
          ],
          borderRadius: 6, borderWidth: 0
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: _tooltipDefaults() },
        scales: Object.assign({}, _axisOpts(), { x: { grid: { display: false }, ticks: { color: LABEL, font: { size: 11 } } } })
      }
    });
  }

  function _drawSeason(seasonResas) {
    var ctx = document.getElementById('chart-season');
    if (!ctx) return;

    var year = _year();
    var start = new Date(year + '-06-01T12:00:00');
    var seasonEnd = new Date(year + '-09-30T12:00:00');
    var today = new Date();
    var effectiveEnd = today < seasonEnd ? today : seasonEnd;

    // Align start to Monday
    var dow = start.getDay();
    start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));

    var weeks = [];
    var d = new Date(start);
    while (d <= effectiveEnd) {
      var wStart = new Date(d);
      var wEnd = new Date(d);
      wEnd.setDate(wEnd.getDate() + 6);
      weeks.push({
        label: wStart.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        start: wStart.toISOString().slice(0, 10),
        end:   wEnd.toISOString().slice(0, 10),
        count: 0
      });
      d.setDate(d.getDate() + 7);
    }

    seasonResas.forEach(function (r) {
      if (r.statut === 'annule') return;
      var w = weeks.find(function (w) { return r.date >= w.start && r.date <= w.end; });
      if (w) w.count++;
    });

    _charts.season = new Chart(ctx, {
      type: 'line',
      data: {
        labels: weeks.map(function (w) { return w.label; }),
        datasets: [{
          data: weeks.map(function (w) { return w.count; }),
          label: 'Réservations',
          borderColor: GOLD,
          backgroundColor: 'rgba(240,201,58,0.1)',
          fill: true, tension: 0.4,
          pointRadius: 4, pointBackgroundColor: GOLD,
          borderWidth: 2.5
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: _tooltipDefaults() },
        scales: _axisOpts()
      }
    });
  }

  function _render(container, periodResas, seasonResas, activeCount, range, phonesMap) {
    var total    = periodResas.length;
    var presents = periodResas.filter(function (r) { return r.statut === 'present' || r.statut === 'parti'; }).length;
    var absents  = periodResas.filter(function (r) { return r.statut === 'absent'; }).length;
    var annules  = periodResas.filter(function (r) { return r.statut === 'annule'; }).length;
    var attentes = periodResas.filter(function (r) { return r.statut === 'attente'; }).length;
    var honored  = presents + absents;
    var tauxPct  = honored > 0 ? Math.round((presents / honored) * 100) : 0;
    var tauxMod  = tauxPct >= 75 ? 'good' : tauxPct >= 50 ? 'warn' : honored > 0 ? 'bad' : '';

    container.innerHTML = [
      '<div class="stats-wrap">',

        '<div class="stats-filters">',
          '<button class="stats-filter-btn' + (_period === 'week'   ? ' active' : '') + '" data-period="week">Cette semaine</button>',
          '<button class="stats-filter-btn' + (_period === 'month'  ? ' active' : '') + '" data-period="month">Ce mois</button>',
          '<button class="stats-filter-btn' + (_period === 'season' ? ' active' : '') + '" data-period="season">Toute la saison</button>',
          '<span class="stats-range-label">',
            new Date(range.start + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' }),
            ' → ',
            new Date(range.end + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' }),
          '</span>',
        '</div>',

        '<div class="stats-kpis">',
          _kpi('📅', 'Réservations', total, ''),
          _kpi('✅', 'Taux de présence', tauxPct + ' %', tauxMod),
          _kpi('⚠️', 'Absences', absents, absents >= 3 ? 'warn' : ''),
          _kpi('👥', 'Inscrits actifs', activeCount, ''),
        '</div>',

        '<div class="stats-charts-row">',
          '<div class="stats-card">',
            '<div class="stats-card-title">Réservations par jour</div>',
            '<div class="stats-canvas-wrap"><canvas id="chart-daily"></canvas></div>',
          '</div>',
          '<div class="stats-card">',
            '<div class="stats-card-title">Répartition des statuts</div>',
            '<div class="stats-canvas-wrap stats-canvas-donut"><canvas id="chart-statuts"></canvas></div>',
          '</div>',
        '</div>',

        '<div class="stats-charts-row">',
          '<div class="stats-card">',
            '<div class="stats-card-title">Réservations par créneau</div>',
            '<div class="stats-canvas-wrap"><canvas id="chart-creneau"></canvas></div>',
          '</div>',
          '<div class="stats-card">',
            '<div class="stats-card-title">Évolution de la saison (semaine par semaine)</div>',
            '<div class="stats-canvas-wrap"><canvas id="chart-season"></canvas></div>',
          '</div>',
        '</div>',

        '<div class="stats-card">',
          '<div class="stats-card-title">Top 10 — Usagers les plus actifs</div>',
          _topTable(periodResas),
        '</div>',

        '<div class="stats-card" style="margin-top:14px">',
          '<div class="stats-card-title">Réservations non honorées</div>',
          _absentsTable(periodResas, phonesMap || {}),
        '</div>',

      '</div>'
    ].join('');

    container.querySelectorAll('.stats-filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _period = btn.dataset.period;
        renderStats(container);
      });
    });

    requestAnimationFrame(function () {
      _destroyCharts();
      _drawDaily(periodResas, range);
      _drawStatuts(presents, absents, annules, attentes);
      _drawCreneau(periodResas);
      _drawSeason(seasonResas);
    });
  }

  async function renderStats(container) {
    container.innerHTML = '<div class="stats-loading">Chargement des statistiques…</div>';
    try {
      var today       = _today();
      var year        = _year();
      var periodRange = _getRange(_period);
      var seasonStart = year + '-06-01';

      var periodResas, seasonResas, activeCount;
      var samePeriod = (periodRange.start === seasonStart && periodRange.end === today);

      if (samePeriod) {
        var both = await Promise.all([fetchStatsResas(periodRange.start, periodRange.end), fetchActiveInscriptionsCount()]);
        periodResas = both[0];
        seasonResas = both[0];
        activeCount = both[1];
      } else {
        var all = await Promise.all([
          fetchStatsResas(periodRange.start, periodRange.end),
          fetchStatsResas(seasonStart, today),
          fetchActiveInscriptionsCount()
        ]);
        periodResas = all[0];
        seasonResas = all[1];
        activeCount = all[2];
      }

      var absentIds = [];
      periodResas.forEach(function(r) {
        if ((r.statut === 'absent' || r.statut === 'pas_venu') && r.inscription_id && absentIds.indexOf(r.inscription_id) === -1) {
          absentIds.push(r.inscription_id);
        }
      });
      var phonesMap = await fetchInscriptionsPhones(absentIds);

      _render(container, periodResas, seasonResas, activeCount, periodRange, phonesMap);
    } catch (e) {
      container.innerHTML = '<div class="stats-error">Erreur : ' + _esc(e.message) + '</div>';
    }
  }

  return { render: renderStats };
})();
