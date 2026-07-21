'use strict';

// Rend les éléments statiques : tapis PMR, douches (appelé une seule fois)
function renderMapStatic(container) {
  const cfg = BEACH_CONFIG;

  // SVG overlay : mer, rochers, bâtiment, tapis diagonal, rampe
  _renderDecor(container, cfg);

  // Barrières
  (cfg.barriers || []).forEach(b => {
    const el = document.createElement('div');
    el.className = b.type === 'h' ? 'barrier-h' : 'barrier-v';
    el.style.left = `${b.x}px`;
    el.style.top  = `${b.y}px`;
    if (b.type === 'h') el.style.width  = `${b.width}px`;
    else                el.style.height = `${b.height}px`;
    el.title = b.label || '';
    container.appendChild(el);
  });

  // Tapis horizontaux
  cfg.tapisH.forEach(t => {
    const el = document.createElement('div');
    el.className = 'tapis-h';
    el.style.top   = `${t.y}px`;
    el.style.left  = `${t.x}px`;
    el.style.width = `${t.width}px`;
    container.appendChild(el);
  });

  // Tapis verticaux
  cfg.tapisV.forEach(t => {
    const el = document.createElement('div');
    el.className = 'tapis-v';
    el.style.left = `${t.x}px`;
    if (t.top !== undefined) {
      el.style.top    = `${t.top}px`;
      el.style.bottom = 'auto';
      el.style.height = `${t.height}px`;
    }
    container.appendChild(el);
  });

  // Cabines douche
  cfg.showers.forEach(s => {
    const el = document.createElement('div');
    el.className = 'shower-cabin';
    el.style.left = `${s.x}px`;
    el.style.top  = `${s.y}px`;
    el.title = s.label;
    container.appendChild(el);
  });

  // Taille du conteneur
  container.style.width  = `${cfg.mapWidth}px`;
  container.style.height = `${cfg.mapHeight}px`;

  // Scaling proportionnel selon la taille de l'écran
  _initMapScaling(container);
}

// Rend ou met à jour tous les spots selon l'état des réservations
// reservations : { [spotId]: { nom, prenom, status, checkinTime, ... } }
function renderMapSpots(container, reservations, onSpotClick, selectionMode) {
  // Stocker le handler courant sur le container pour que les listeners existants
  // le récupèrent toujours à jour (les éléments ne sont créés qu'une fois)
  container._spotClickHandler = onSpotClick;

  BEACH_CONFIG.spots.forEach(spot => {
    let el = container.querySelector(`[data-spot-id="${spot.id}"]`);
    const resa = reservations[spot.id];
    const state = (resa && resa.status !== 'departed') ? resa.status : 'free';

    if (!el) {
      // Création initiale
      el = document.createElement('div');
      el.className = 'spot';
      el.dataset.spotId = spot.id;
      el.style.left = `${spot.x - BEACH_CONFIG.spotSize / 2}px`;
      el.style.top  = `${spot.y - BEACH_CONFIG.spotSize / 2}px`;
      el.style.width  = `${BEACH_CONFIG.spotSize}px`;
      el.style.height = `${BEACH_CONFIG.spotSize}px`;
      el.addEventListener('click', () => container._spotClickHandler(spot.id));
      container.appendChild(el);
    }

    // Mise à jour de l'état
    el.dataset.state  = state;
    el.dataset.groupe = (resa && resa.resaType === 'groupe') ? 'true' : 'false';
    el.dataset.selectable = (selectionMode && state === 'free') ? 'true' : 'false';
    el.title = resa ? `${resa.prenom} ${resa.nom}` : spot.label;

    // Contenu (initiales ou numéro)
    const label = _spotLabel(spot, resa);
    const badge = _timerBadge(resa);
    el.innerHTML = label + badge;
  });
}

function _spotLabel(spot, resa) {
  if (!resa || resa.status === 'free') {
    return `<span style="position:relative;z-index:1">${spot.id}</span>`;
  }
  if (resa.status === 'reserved_waiting') {
    return `<span style="position:relative;z-index:1">⏳</span>`;
  }
  if (resa.status === 'absent') {
    return `<span style="position:relative;z-index:1">✕</span>`;
  }
  // present ou walkin → initiales
  const initials = `${(resa.prenom || '')[0] || ''}${(resa.nom || '')[0] || ''}`.toUpperCase();
  return `<span style="position:relative;z-index:1">${initials || '?'}</span>`;
}

function _timerBadge(resa) {
  if (!resa || (resa.status !== 'present' && resa.status !== 'walkin')) return '';
  if (!resa.slotId) return '';
  const ms = (typeof slotEndMs === 'function') ? slotEndMs(resa.slotId) : 0;
  const urgency = getUrgencyLevel(ms);
  const cssClass = urgency === 'critical' ? 'critical' : '';
  return `<span class="timer-badge ${cssClass}">${formatCountdown(ms)}</span>`;
}

// ── Scaling proportionnel ─────────────────────────────────────────────────

function _initMapScaling(mapEl) {
  const W    = BEACH_CONFIG.mapWidth;
  const H    = BEACH_CONFIG.mapHeight;
  const wrap = mapEl.parentElement; // .beach-map-container
  if (!wrap) return;

  function applyScale() {
    const pad    = 24; // padding 12px de chaque côté
    const availW = wrap.clientWidth  - pad;
    const availH = wrap.clientHeight - pad;
    const scale  = Math.min(availW / W, availH / H);

    if (scale < 1) {
      // Compensation des marges : réduit la "boîte layout" à la taille visuelle
      const mx = ((scale - 1) * W / 2).toFixed(1);
      const my = ((scale - 1) * H / 2).toFixed(1);
      mapEl.style.transform = `scale(${scale.toFixed(4)})`;
      mapEl.style.margin    = `${my}px ${mx}px`;
    } else {
      mapEl.style.transform = '';
      mapEl.style.margin    = '';
    }
  }

  new ResizeObserver(applyScale).observe(wrap);
  applyScale();
}

// ── Décor SVG : mer, rochers, tapis diagonal, rampe, bâtiment ────────────

function _svgEl(parent, NS, tag, attrs) {
  const el = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
  parent.appendChild(el);
  return el;
}

function _renderDecor(container, cfg) {
  const NS = 'http://www.w3.org/2000/svg';
  const W = cfg.mapWidth, H = cfg.mapHeight;

  const svg = document.createElementNS(NS, 'svg');
  svg.style.cssText = `position:absolute;top:0;left:0;width:${W}px;height:${H}px;pointer-events:none;overflow:visible`;

  const defs = document.createElementNS(NS, 'defs');
  svg.appendChild(defs);

  // Tapis PMR diagonal
  if (cfg.tapisPMR) {
    _svgEl(svg, NS, 'polygon', {
      points: cfg.tapisPMR.points.map(p => p.join(',')).join(' '),
      fill: '#1565c0', opacity: .92,
    });
  }

  // Rampe métal + hachures
  if (cfg.rampeMetal) {
    const pts = cfg.rampeMetal.points;
    _svgEl(svg, NS, 'polygon', {
      points: pts.map(p => p.join(',')).join(' '),
      fill: '#90a4ae', opacity: .92,
    });
    for (let k = 1; k < 8; k++) {
      const t = k / 8;
      const x1 = (pts[0][0] + t * (pts[3][0] - pts[0][0])).toFixed(1);
      const y1 = (pts[0][1] + t * (pts[3][1] - pts[0][1])).toFixed(1);
      const x2 = (pts[1][0] + t * (pts[2][0] - pts[1][0])).toFixed(1);
      const y2 = (pts[1][1] + t * (pts[2][1] - pts[1][1])).toFixed(1);
      _svgEl(svg, NS, 'line', {x1, y1, x2, y2, stroke:'#546e7a', 'stroke-width':'1', opacity:'.5'});
    }
  }

  // Rochers
  if (cfg.rocks) {
    _renderRocks(svg, defs, cfg.rocks.points, NS);
  }

  // Bâtiment (polygone 9 points)
  if (cfg.batiment) {
    const grd = document.createElementNS(NS, 'linearGradient');
    grd.id = 'bat-g';
    grd.setAttribute('x1','0'); grd.setAttribute('y1','0');
    grd.setAttribute('x2','1'); grd.setAttribute('y2','1');
    [['0%','#90a4ae'],['100%','#607d8b']].forEach(([offset, color]) => {
      const st = document.createElementNS(NS, 'stop');
      st.setAttribute('offset', offset);
      st.setAttribute('stop-color', color);
      grd.appendChild(st);
    });
    defs.appendChild(grd);
    _svgEl(svg, NS, 'polygon', {
      points: cfg.batiment.points.map(p => p.x + ',' + p.y).join(' '),
      fill: 'url(#bat-g)', stroke: '#455a64', 'stroke-width': 2,
    });
  }

  container.appendChild(svg);
}

function _renderRocks(svg, defs, zonePts, NS) {
  const clipId = 'rocks-clip';
  const clip = document.createElementNS(NS, 'clipPath');
  clip.id = clipId;
  const cpoly = document.createElementNS(NS, 'polygon');
  cpoly.setAttribute('points', zonePts.map(p => p.x + ',' + p.y).join(' '));
  clip.appendChild(cpoly);
  defs.appendChild(clip);

  const g = document.createElementNS(NS, 'g');
  g.setAttribute('clip-path', 'url(#' + clipId + ')');

  // Bounding box du polygone — la grille couvre toute la zone
  const xs = zonePts.map(p => p.x), ys = zonePts.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  // Fond sableux couvrant toute la bbox
  _svgEl(g, NS, 'rect', {x: minX - 10, y: minY - 10, width: maxX - minX + 20, height: maxY - minY + 20, fill: '#c8b898'});

  const COLORS = [
    ['#8a8a8a','#6a6a6a'],['#9e9e9e','#7a7a7a'],['#ababab','#888'],
    ['#b0a090','#8a7a70'],['#787060','#58504a'],['#bdbdbd','#999'],
    ['#a09080','#807060'],['#c0b8a8','#a09888'],['#707070','#505050'],
  ];

  // LCG déterministe — même rendu à chaque chargement
  let seed = 1;
  function rand(a, b) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return a + (seed / 0xffffffff) * (b - a);
  }

  const rocks = [];
  for (let cy = minY + 5; cy < maxY + 10; cy += 10) {
    for (let cx = minX; cx < maxX + 15; cx += 15) {
      const sc = rand(0, 1);
      const rx = sc < 0.25 ? rand(3.5, 6) : sc < 0.65 ? rand(7, 11) : rand(12, 16);
      rocks.push({ x: cx + rand(-3, 3), y: cy + rand(-2, 2), rx, ry: rx * rand(0.5, 0.85) });
    }
  }

  function rockPath(cx, cy, rx, ry, s) {
    const n = 6 + (s % 3);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const base = (2 * Math.PI * i) / n;
      const jit  = (((s * 17 + i * 31) % 100) / 100 - 0.5) * (Math.PI / n) * 0.7;
      const rf   = 0.45 + (((s * 13 + i * 47) % 100) / 100) * 0.6;
      pts.push([(cx + Math.cos(base + jit) * rx * rf).toFixed(1),
                (cy + Math.sin(base + jit) * ry * rf).toFixed(1)]);
    }
    return 'M' + pts.map(p => p.join(',')).join('L') + 'Z';
  }

  function lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgb(' + Math.min(255, (n >> 16) + amt) + ',' +
                    Math.min(255, ((n >> 8) & 0xff) + amt) + ',' +
                    Math.min(255, (n & 0xff) + amt) + ')';
  }

  rocks.forEach(function(r, i) {
    const [fill, dark] = COLORS[i % COLORS.length];
    const gid = 'rk_' + i;
    const s   = i * 137 + 42;

    const grad = document.createElementNS(NS, 'radialGradient');
    grad.id = gid;
    grad.setAttribute('cx', '32%'); grad.setAttribute('cy', '28%'); grad.setAttribute('r', '68%');
    [['0%', lighten(fill, 28)], ['100%', dark]].forEach(function([off, col]) {
      const st = document.createElementNS(NS, 'stop');
      st.setAttribute('offset', off); st.setAttribute('stop-color', col);
      grad.appendChild(st);
    });
    defs.appendChild(grad);

    _svgEl(g, NS, 'path', {d: rockPath(r.x + 2, r.y + 3, r.rx + 1, r.ry + 0.5, s), fill: 'rgba(0,0,0,0.2)'});
    _svgEl(g, NS, 'path', {d: rockPath(r.x, r.y, r.rx, r.ry, s), fill: 'url(#' + gid + ')', stroke: dark, 'stroke-width': .6, 'stroke-opacity': .45});
    if (r.rx > 6) {
      _svgEl(g, NS, 'path', {d: rockPath(r.x - r.rx * .18, r.y - r.ry * .22, r.rx * .38, r.ry * .30, s + 7), fill: 'rgba(255,255,255,0.2)'});
    }
  });

  svg.appendChild(g);

  // Contour de la zone rocheuse (tirets)
  _svgEl(svg, NS, 'polygon', {
    points: zonePts.map(p => p.x + ',' + p.y).join(' '),
    fill: 'none', stroke: '#a09060', 'stroke-width': 1.5, 'stroke-dasharray': '5,3',
  });

}

if (typeof module !== 'undefined') {
  module.exports = { renderMapStatic, renderMapSpots };
}
