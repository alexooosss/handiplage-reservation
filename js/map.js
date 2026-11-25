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
    if (b.rot) el.style.transform = `rotate(${b.rot}deg)`;
    container.appendChild(el);
  });

  // Tapis horizontaux
  cfg.tapisH.forEach(t => {
    const el = document.createElement('div');
    el.className = 'tapis-h';
    el.style.top   = `${t.y}px`;
    el.style.left  = `${t.x}px`;
    el.style.width = `${t.width}px`;
    if (t.rot) el.style.transform = `rotate(${t.rot}deg)`;
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
    if (t.rot) el.style.transform = `rotate(${t.rot}deg)`;
    container.appendChild(el);
  });

  // Cabines douche
  cfg.showers.forEach(s => {
    const el = document.createElement('div');
    el.className = 'shower-cabin';
    el.style.left = `${s.x}px`;
    el.style.top  = `${s.y}px`;
    el.title = s.label;
    if (s.rot) el.style.transform = `translate(-50%, -50%) rotate(${s.rot}deg)`;
    container.appendChild(el);
  });

  // Barnums (vus du dessus), sous les places et sans gêner les clics
  (cfg.barnums || []).forEach(b => {
    if (typeof barnumHtml === 'function') container.insertAdjacentHTML('beforeend', barnumHtml(b));
  });

  // Taille du conteneur
  container.style.width  = `${cfg.mapWidth}px`;
  container.style.height = `${cfg.mapHeight}px`;

  // Scaling proportionnel selon la taille de l'écran
  _initMapScaling(container);
  _placerFrontMer(container);
}

// Front de mer réglé dans le plan : la mer commence à cette hauteur (coordonnées du plan).
// Sans réglage, la mer garde sa place habituelle en bas du panneau.
// La mer suit le plan : son bord est au front de mer (réglé dans le plan, sinon position habituelle)
// et elle s'arrête avant les rochers, quelle que soit l'échelle d'affichage.
function _placerFrontMer(mapEl) {
  const panel = mapEl.closest('.beach-panel');
  const sea = panel && panel.querySelector('.beach-sea');
  if (!sea) return;
  function placer() {
    const fm = typeof BEACH_CONFIG.frontMer === 'number' ? BEACH_CONFIG.frontMer : BEACH_CONFIG.merDefaut;
    const pr = panel.getBoundingClientRect(), mr = mapEl.getBoundingClientRect();
    if (!pr.height || !mr.width) return;                     // panneau masqué
    const s = mr.width / BEACH_CONFIG.mapWidth;
    const haut = Math.max(0, Math.min(pr.height - 24, mr.top - pr.top + fm * s));
    sea.style.top = haut + 'px';
    sea.style.height = 'auto';
    sea.style.width = Math.max(0, mr.left - pr.left + BEACH_CONFIG.merFinX * s) + 'px';
    sea.style.borderRadius = '0 ' + Math.round(70 * s) + 'px 0 0';
  }
  new ResizeObserver(() => requestAnimationFrame(placer)).observe(mapEl.parentElement || panel);
  requestAnimationFrame(placer);
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

// Échelle du plan pour une zone d'affichage donnée : la zone utile remplit l'écran (agrandie ou réduite)
function echellePlan(largeur, hauteur, marge) {
  const v = BEACH_CONFIG.cadrage;
  return Math.max(0.2, Math.min((largeur - 2 * marge) / v.w, (hauteur - 2 * marge) / v.h, 2.5));
}

function _initMapScaling(mapEl) {
  const v    = BEACH_CONFIG.cadrage;
  const wrap = mapEl.parentElement; // .beach-map-container
  if (!wrap) return;
  wrap.style.position = 'relative';

  function applyScale() {
    const W = wrap.clientWidth, H = wrap.clientHeight;
    if (!W || !H) return;                                  // vue masquée
    const s  = echellePlan(W, H, 0);
    const tx = (W - v.w * s) / 2 - v.x * s;                // centrée en largeur
    // Calée en haut (un écran plus haut montre plus de mer, pas plus de sable), puis descendue
    // d'environ 1 cm (38 px) : le fond de sable reste en place, la mer suit le plan
    const ty = Math.min((H - v.h * s) / 2, 0) - v.y * s + 38;
    mapEl.style.position = 'absolute';
    mapEl.style.left = '0';
    mapEl.style.top = '0';
    mapEl.style.margin = '0';
    mapEl.style.transformOrigin = '0 0';
    mapEl.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${s.toFixed(4)})`;
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

  // Rochers (sous le tapis diagonal et la rampe)
  if (cfg.rocks) {
    _renderRocks(svg, defs, cfg.rocks.points, NS);
  }

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

// Formation rocheuse naturelle : gros blocs au cœur, plus petits vers les bords, quelques
// galets épars autour. Rendu déterministe (même dessin à chaque chargement).
function _renderRocks(svg, defs, zonePts, NS) {
  const pts = zonePts.map(p => [p.x, p.y]);

  // Contour lissé (Catmull-Rom fermée → courbes de Bézier)
  function cheminLisse(P) {
    const n = P.length;
    let dd = 'M' + P[0][0] + ',' + P[0][1];
    for (let i = 0; i < n; i++) {
      const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      dd += 'C' + c1.map(v => v.toFixed(1)) + ' ' + c2.map(v => v.toFixed(1)) + ' ' + p2[0] + ',' + p2[1];
    }
    return dd + 'Z';
  }
  function dedans(x, y) {
    let ok = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ok = !ok;
    }
    return ok;
  }
  // Distance au bord (pour des blocs plus gros au cœur)
  function distBord(x, y) {
    let best = Infinity;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [x1, y1] = pts[j], [x2, y2] = pts[i];
      const dx = x2 - x1, dy = y2 - y1, t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
      best = Math.min(best, Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)));
    }
    return best;
  }

  let seed = 7;
  function rand(lo, hi) { seed = (seed * 1664525 + 1013904223) >>> 0; return lo + (seed / 0xffffffff) * (hi - lo); }

  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);

  // Sable humide sous la formation, bords estompés
  const flou = document.createElementNS(NS, 'filter');
  flou.id = 'rocks-flou';
  flou.setAttribute('x', '-20%'); flou.setAttribute('y', '-20%'); flou.setAttribute('width', '140%'); flou.setAttribute('height', '140%');
  const fb = document.createElementNS(NS, 'feGaussianBlur'); fb.setAttribute('stdDeviation', '4');
  flou.appendChild(fb); defs.appendChild(flou);
  _svgEl(svg, NS, 'path', { d: cheminLisse(pts), fill: '#b9a57e', opacity: .55, filter: 'url(#rocks-flou)' });

  // Blocs : tirage aléatoire dans la zone, taille selon la distance au bord
  const rocks = [];
  for (let k = 0; k < 1400 && rocks.length < 210; k++) {
    const x = rand(minX, maxX), y = rand(minY, maxY);
    if (!dedans(x, y)) continue;
    const prof = Math.min(1, distBord(x, y) / 28);                      // 0 au bord → 1 au cœur
    const rx = (prof > .6 && rand(0, 1) < .45) ? rand(11, 17) : rand(4, 7 + prof * 6);
    if (rocks.some(r => Math.hypot(r.x - x, (r.y - y) * 1.3) < (r.rx + rx) * .5)) continue;   // évite les empilements
    rocks.push({ x, y, rx, ry: rx * rand(.55, .85), rot: rand(-35, 35) });
  }
  // Galets épars juste autour de la formation (jamais côté rampe)
  for (let k = 0; k < 500 && rocks.length < 245; k++) {
    const x = rand(minX - 10, maxX + 10), y = rand(minY - 10, maxY + 6);
    if (dedans(x, y)) continue;
    const dist = distBord(x, y);
    if (dist > 9 || x < 650 - (y - 350) + 18 || x > 770) continue;   // ni sur la rampe, ni dans le passage à droite
    const rx = rand(2.2, 4.2);
    rocks.push({ x, y, rx, ry: rx * rand(.6, .85), rot: rand(-40, 40) });
  }
  rocks.sort((p, q) => p.y - q.y);                                      // ceux du bas passent devant

  const COLORS = [
    ['#8a8a8a','#5f5f5f'],['#9e9e9e','#717171'],['#a9a39a','#7d776e'],
    ['#b0a090','#857565'],['#7a7266','#544d44'],['#b8b8b8','#8c8c8c'],
    ['#a09080','#74665a'],['#c2bba9','#958e7e'],['#6f6f6f','#4a4a4a'],
  ];
  function lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgb(' + Math.min(255, (n >> 16) + amt) + ',' + Math.min(255, ((n >> 8) & 0xff) + amt) + ',' + Math.min(255, (n & 0xff) + amt) + ')';
  }
  // Bloc aux formes douces et irrégulières
  function rockPath(cx, cy, rx, ry, s) {
    const n = 7 + (s % 3), P = [];
    for (let i = 0; i < n; i++) {
      const ang = (2 * Math.PI * i) / n;
      const rf = 0.78 + (((s * 13 + i * 47) % 100) / 100) * 0.32;
      P.push([cx + Math.cos(ang) * rx * rf, cy + Math.sin(ang) * ry * rf]);
    }
    let dd = '';
    for (let i = 0; i < n; i++) {
      const p = P[i], q = P[(i + 1) % n], mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      dd += (i === 0 ? 'M' + ((P[n - 1][0] + p[0]) / 2).toFixed(1) + ',' + ((P[n - 1][1] + p[1]) / 2).toFixed(1) : '')
        + 'Q' + p[0].toFixed(1) + ',' + p[1].toFixed(1) + ' ' + mid[0].toFixed(1) + ',' + mid[1].toFixed(1);
    }
    return dd + 'Z';
  }

  const g = document.createElementNS(NS, 'g');
  rocks.forEach(function(r, i) {
    const [fill, dark] = COLORS[i % COLORS.length];
    const gid = 'rk_' + i, s = i * 137 + 42;
    const grad = document.createElementNS(NS, 'radialGradient');
    grad.id = gid;
    grad.setAttribute('cx', '35%'); grad.setAttribute('cy', '30%'); grad.setAttribute('r', '75%');
    [['0%', lighten(fill, 34)], ['70%', fill], ['100%', dark]].forEach(function([off, col]) {
      const st = document.createElementNS(NS, 'stop');
      st.setAttribute('offset', off); st.setAttribute('stop-color', col);
      grad.appendChild(st);
    });
    defs.appendChild(grad);
    const rg = document.createElementNS(NS, 'g');
    rg.setAttribute('transform', 'rotate(' + r.rot.toFixed(1) + ' ' + r.x.toFixed(1) + ' ' + r.y.toFixed(1) + ')');
    _svgEl(rg, NS, 'path', { d: rockPath(r.x + 1.5, r.y + 2.5, r.rx * 1.04, r.ry * 1.02, s), fill: 'rgba(40,30,15,0.28)' });   // ombre portée
    _svgEl(rg, NS, 'path', { d: rockPath(r.x, r.y, r.rx, r.ry, s), fill: 'url(#' + gid + ')', stroke: dark, 'stroke-width': .5, 'stroke-opacity': .5 });
    if (r.rx > 6) _svgEl(rg, NS, 'path', { d: rockPath(r.x - r.rx * .22, r.y - r.ry * .28, r.rx * .36, r.ry * .26, s + 7), fill: 'rgba(255,255,255,0.22)' });
    g.appendChild(rg);
  });
  svg.appendChild(g);
}

if (typeof module !== 'undefined') {
  module.exports = { renderMapStatic, renderMapSpots };
}
