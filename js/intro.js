// js/intro.js — animations d'ouverture
//   Usagers : une vague réaliste monte sur le sable, se retire et laisse le logo et un mot d'accueil.
//   Staff   : « La plage se met en place » (places en cascade, tapis tracés, date et créneau).
// L'animation est un calque posé au-dessus de la page : l'application se charge dessous, en parallèle.
// Une seule fois par ouverture de l'application, passable d'un toucher, simple fondu si l'appareil
// demande de réduire les animations.
'use strict';

var INTRO_CLE = 'hp_intro_vue';

var INTRO_FAUTEUIL = '<svg viewBox="0 0 23.17 22.5" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path fill="currentColor" d="M14.44,18.31c-1.59,0-2.88-1.32-2.88-2.91s1.29-2.88,2.88-2.88,2.88,1.29,2.88,2.88-1.29,2.91-2.88,2.91ZM18.9,2.48l2.34.56,1.92-1.52L17.65.1s-.11-.03-.14-.03c-.59-.17-1.02,0-1.25.13-.43.27-.7.66-.83,1.22l-.06.23.33,1.48h-5.98l-.1.03c-.9.2-1.53,1-1.53,1.95v1.16h8.33l.6,2.51c-.8-.33-1.65-.5-2.59-.5-2.31,0-4.33,1.09-5.61,2.78h-4.59c-.97,0-1.72.76-1.72,1.72,0,.4.13.76.36,1.03l-1.25,3.44c-.97.36-1.62,1.25-1.62,2.31,0,1.39,1.12,2.51,2.51,2.51s2.51-1.12,2.51-2.51c0-.63-.27-1.22-.67-1.65l1.48-3.44h1.56c-.03.3-.06.63-.06.92,0,3.94,3.17,7.11,7.1,7.11s7.11-3.17,7.11-7.11c0-.83-.13-1.61-.42-2.38l-2.22-10.54ZM2.47,20.56c-.54,0-.97-.43-.97-.98s.42-.97.97-.97.97.43.97.97-.42.98-.97.98Z"/></svg>';

var INTRO_CSS = ''
  + '.intro{position:fixed;inset:0;z-index:100000;overflow:hidden;cursor:pointer;-webkit-tap-highlight-color:transparent}'
  + '.intro.intro-fin{animation:intro-efface .5s ease-in forwards}'
  + '@keyframes intro-efface{to{opacity:0;visibility:hidden}}'
  + '@keyframes intro-apparait{to{opacity:1;transform:none;filter:none}}'
  // Usagers
  + '.intro-u{background:#e8d7b0}'
  + '.intro-u canvas{position:absolute;inset:0;width:100%;height:100%}'
  + '.intro-u .intro-logo{position:absolute;left:50%;top:36%;width:86px;height:86px;margin-left:-43px;color:#0b4f8a;opacity:0;transform:scale(.85);filter:blur(3px);animation:intro-apparait .7s cubic-bezier(.2,.9,.3,1) 1.45s forwards}'
  + '.intro-u .intro-logo svg{display:block;width:100%;height:100%}'
  + '.intro-u .intro-titre{position:absolute;left:16px;right:16px;top:calc(36% + 104px);text-align:center;opacity:0;transform:translateY(8px);animation:intro-apparait .6s ease-out 1.65s forwards;font-family:inherit}'
  + '.intro-u .intro-titre b{display:block;font-size:34px;font-weight:900;color:#0b4f8a;letter-spacing:.3px}'
  + '.intro-u .intro-mot{display:block;width:min(240px,70vw);height:auto;margin:0 auto}'
  + '.intro-u .intro-titre span{display:block;margin-top:12px;font-size:16px;font-weight:600;color:#6b4a22}'
  // Staff
  + '.intro-s{background:#0a1628;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:52px;animation:intro-efface .45s ease-in 2.2s forwards}'
  + '.intro-s .intro-plan{position:relative;flex:none;width:560px;height:200px}'
  + '.intro-s .pl{position:absolute;width:22px;height:22px;border-radius:50%;background:#43a047;box-shadow:0 0 0 3px rgba(67,160,71,.25);opacity:0;transform:scale(.3);animation:intro-pop .3s cubic-bezier(.3,1.6,.5,1) forwards}'
  + '.intro-s .tp{position:absolute;background:#1e88e5;border-radius:3px}'
  + '.intro-s .tp.h{height:7px;transform-origin:0 50%;transform:scaleX(0);animation:intro-h .6s ease-out forwards}'
  + '.intro-s .tp.v{width:7px;transform-origin:50% 0;transform:scaleY(0);animation:intro-v .5s ease-out forwards}'
  + '.intro-s .intro-mot{display:block;flex:none;width:min(320px,75vw);height:auto;filter:brightness(0) invert(1);opacity:0;transform:translateY(8px);animation:intro-monte .45s ease-out 1.25s forwards}'
  + '.intro-s .intro-txt{text-align:center;opacity:0;transform:translateY(8px);animation:intro-apparait .45s ease-out 1.35s forwards}'
  + '.intro-s .intro-txt b{font-size:30px;font-weight:900}'
  + '.intro-s .intro-txt span{display:block;font-size:16px;color:#b7c4d8;margin-top:4px}'
  + '@keyframes intro-pop{to{opacity:1;transform:none}}'
  + '@keyframes intro-monte{to{opacity:1;transform:none}}'
  + '@keyframes intro-h{to{transform:scaleX(1)}}'
  + '@keyframes intro-v{to{transform:scaleY(1)}}'
  + '@media (max-width:640px){.intro-s{gap:36px}.intro-s .intro-plan{transform:scale(.6);margin:-40px 0}}'
  // Réduire les animations : simple apparition puis fondu
  + '@media (prefers-reduced-motion: reduce){.intro *{animation-duration:.01ms !important;animation-delay:0s !important}.intro-s{animation:intro-efface .4s ease-in 1.2s forwards}}';

function _introLeverCache() {
  // Retire le fond uni posé avant le premier affichage (voir index.html / usager.html)
  requestAnimationFrame(function() { document.documentElement.classList.remove('intro-attente'); });
}

function _introDejaVue() {
  try { return sessionStorage.getItem(INTRO_CLE) === '1'; } catch (e) { return false; }
}
function _introMarquer() {
  try { sessionStorage.setItem(INTRO_CLE, '1'); } catch (e) { /* navigation privée : on rejouera, sans gravité */ }
}
function _introReduite() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
function _introStyle() {
  if (document.getElementById('intro-style')) return;
  var st = document.createElement('style'); st.id = 'intro-style'; st.textContent = INTRO_CSS;
  document.head.appendChild(st);
}
function _introCalque(classe, html) {
  _introStyle();
  var el = document.createElement('div');
  el.className = 'intro ' + classe;
  el.setAttribute('role', 'presentation');
  el.innerHTML = html;
  document.body.appendChild(el);
  var parti = false;
  function fermer() {
    if (parti) return; parti = true;
    el.classList.add('intro-fin');
    setTimeout(function() { el.remove(); }, 520);
  }
  el.addEventListener('click', fermer);
  _introLeverCache();
  return { el: el, fermer: fermer };
}

// ── Usagers : la vague ──
var _introPrenomEl = null;

// Le prénom arrive avec l'inscription (chargée pendant l'animation)
function introPrenom(prenom) {
  var p = String(prenom || '').trim();
  if (!_introPrenomEl || p.length < 2 || /utilisateur/i.test(p)) return;
  _introPrenomEl.textContent = 'Bonjour ' + p.charAt(0).toUpperCase() + p.slice(1) + ', bonne journée à la plage !';
}

function introUsager() {
  if (_introDejaVue()) { _introLeverCache(); return; }
  _introMarquer();
  var c = _introCalque('intro-u',
    '<div class="intro-logo">' + INTRO_FAUTEUIL + '</div>'
    + '<div class="intro-titre"><img class="intro-mot" src="logo-handiplage-mot-bleu.svg" alt="Handiplage"><span>Bienvenue, bonne journée à la plage !</span></div>');
  _introPrenomEl = c.el.querySelector('.intro-titre span');
  if (_introReduite()) { setTimeout(c.fermer, 1600); return; }
  var cv = _vagueRealiste(c.el, c.fermer);
  c.el.insertBefore(cv, c.el.firstChild);   // le logo et le texte passent au-dessus du sable
}

// Vague vue du dessus : nappe d'eau transparente au bord, reflets en réseau, écume en dentelle,
// sable mouillé qui sèche. Dessinée en temps réel (même dessin à chaque fois).
function _vagueRealiste(conteneur, onFin) {
  var cv = document.createElement('canvas'); conteneur.appendChild(cv);
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var W = conteneur.clientWidth || window.innerWidth, H = conteneur.clientHeight || window.innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  var ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  var graine = 11;
  function hasard() { graine = (graine * 16807) % 2147483647; return graine / 2147483647; }

  // Sable : grains fins + quelques gros grains + lumière douce
  var sable = document.createElement('canvas'); sable.width = cv.width; sable.height = cv.height;
  var sc = sable.getContext('2d'), img = sc.createImageData(sable.width, sable.height), d = img.data;
  for (var p = 0; p < d.length; p += 4) {
    var n = (hasard() - .5) * 24, g = hasard() < .018 ? -34 : (hasard() < .01 ? 22 : 0);
    d[p] = 233 + n + g; d[p + 1] = 215 + n + g; d[p + 2] = 174 + n * .8 + g; d[p + 3] = 255;
  }
  sc.putImageData(img, 0, 0);
  var lum = sc.createRadialGradient(sable.width * .3, sable.height * .1, 0, sable.width * .3, sable.height * .1, sable.height);
  lum.addColorStop(0, 'rgba(255,248,230,.35)'); lum.addColorStop(1, 'rgba(120,90,40,.14)');
  sc.fillStyle = lum; sc.fillRect(0, 0, sable.width, sable.height);

  // Motif cellulaire répétable (reflets de lumière dans l'eau, dentelle d'écume)
  function reseau(taille, nb, finesse) {
    var c = document.createElement('canvas'); c.width = c.height = taille;
    var x = c.getContext('2d'), im = x.createImageData(taille, taille), dd = im.data, pts = [];
    for (var i = 0; i < nb; i++) pts.push([hasard() * taille, hasard() * taille]);
    for (var yy = 0; yy < taille; yy++) for (var xx = 0; xx < taille; xx++) {
      var f1 = 1e9, f2 = 1e9;
      for (var k = 0; k < nb; k++) for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
        var dx = xx - pts[k][0] - ox * taille, dy = yy - pts[k][1] - oy * taille, dist = dx * dx + dy * dy;
        if (dist < f1) { f2 = f1; f1 = dist; } else if (dist < f2) f2 = dist;
      }
      var v = Math.max(0, 1 - (Math.sqrt(f2) - Math.sqrt(f1)) / finesse);
      var o = (yy * taille + xx) * 4; dd[o] = dd[o + 1] = dd[o + 2] = 255; dd[o + 3] = Math.round(255 * v * v);
    }
    x.putImageData(im, 0, 0); return c;
  }
  var motifC = ctx.createPattern(reseau(128, 18, 5.5), 'repeat');
  var motifD = ctx.createPattern(reseau(96, 30, 3.2), 'repeat');
  var bulles = [];
  for (var b = 0; b < 170; b++) bulles.push({ x: hasard(), r: .5 + hasard() * 2.2, prof: hasard() * 52, ph: hasard() * 6.28 });

  var MONTEE = 1000, PAUSE = 80, RETRAIT = 900, TOTAL = MONTEE + PAUSE + RETRAIT;
  var HAUT = H * .1, DEPART = H + 90, maxAtteint = H + 40, t = 0, tPrec = null, fini = false;
  // Montée : départ en douceur sous le bas de l'écran, élan, puis ralentissement en haut
  function montee(x) { return 1 - Math.pow(1 - x, 3) * (1 + 3 * x); }
  function easeIn(x) { return x * x * x; }
  function front(t) {
    if (t < MONTEE) return DEPART - (DEPART - HAUT) * Math.min(1, montee(t / MONTEE));
    if (t < MONTEE + PAUSE) return HAUT;
    return HAUT + (H + 60 - HAUT) * easeIn(Math.min(1, (t - MONTEE - PAUSE) / RETRAIT));
  }
  function bord(x, yF, t) {
    var s = t / 1000;
    return yF + 10 * Math.sin(x * .019 + s * 1.3) + 6 * Math.sin(x * .051 - s * 2.2 + 1.7) + 3.5 * Math.sin(x * .12 + s * 3.9) + 1.6 * Math.sin(x * .31 - s * 5);
  }
  function chemin(yF, t) {
    ctx.beginPath(); ctx.moveTo(-10, H + 20);
    for (var x = -10; x <= W + 10; x += 4) ctx.lineTo(x, bord(x, yF, t));
    ctx.lineTo(W + 10, H + 20); ctx.closePath();
  }
  function remplirMotif(motif, ox, oy, echelle, alpha, flou) {
    ctx.save(); ctx.globalAlpha = alpha; if (flou) ctx.filter = 'blur(' + flou + 'px)';
    ctx.translate(ox, oy); ctx.scale(echelle, echelle);
    ctx.fillStyle = motif; ctx.fillRect(-ox / echelle - 50, -oy / echelle - 50, W / echelle + 100, H / echelle + 100);
    ctx.restore();
  }

  function image(ts) {
    if (fini || !conteneur.isConnected) return;
    // Horloge propre à l'animation : elle avance d'au plus 1/30 s par image. Si la tablette est
    // occupée (chargement de l'espace en parallèle), la vague ralentit au lieu de sauter.
    if (tPrec === null) tPrec = ts;
    t += Math.min(33, Math.max(0, ts - tPrec)); tPrec = ts;
    var yF = front(t);
    if (yF < maxAtteint) maxAtteint = yF;

    ctx.drawImage(sable, 0, 0, W, H);

    // Sable mouillé (plus sombre, légèrement brillant) là où l'eau est passée ; il sèche peu à peu
    var seche = t > MONTEE ? Math.min(1, (t - MONTEE) / 2600) : 0;
    ctx.save(); chemin(maxAtteint + 3, t); ctx.clip();
    var mg = ctx.createLinearGradient(0, maxAtteint, 0, H);
    mg.addColorStop(0, 'rgba(110,84,42,' + (.2 * (1 - seche)) + ')'); mg.addColorStop(1, 'rgba(90,68,34,' + (.34 * (1 - seche * .6)) + ')');
    ctx.fillStyle = mg; ctx.fillRect(0, 0, W, H);
    var br = ctx.createLinearGradient(0, 0, W, H);
    br.addColorStop(0, 'rgba(255,255,255,0)'); br.addColorStop(.5, 'rgba(255,255,255,' + (.1 * (1 - seche)) + ')'); br.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = br; ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Pellicule d'eau très fine en avant du front
    ctx.save(); chemin(yF - 9, t); ctx.clip(); ctx.fillStyle = 'rgba(170,220,228,.22)'; ctx.fillRect(0, 0, W, H); ctx.restore();

    // Nappe d'eau : transparente près du bord (le sable se voit au travers), plus profonde vers le bas
    ctx.save(); chemin(yF, t); ctx.clip();
    var prof = Math.max(60, H - yF);
    var eg = ctx.createLinearGradient(0, yF, 0, yF + prof * 1.4);
    eg.addColorStop(0, 'rgba(110,200,205,.30)'); eg.addColorStop(.12, 'rgba(60,175,195,.48)');
    eg.addColorStop(.45, 'rgba(22,140,178,.74)'); eg.addColorStop(1, 'rgba(8,88,132,.94)');
    ctx.fillStyle = eg; ctx.fillRect(0, 0, W, H);
    remplirMotif(motifC, (t * .018) % 256, (t * .03) % 256, 2.4, .13, 1.6);    // reflets de lumière
    remplirMotif(motifC, -(t * .022) % 256, (t * .012) % 256, 1.6, .08, 1.2);
    ctx.restore();

    // Écume en dentelle juste derrière le front
    ctx.save(); ctx.beginPath();
    for (var x1 = -10; x1 <= W + 10; x1 += 4) ctx.lineTo(x1, bord(x1, yF, t) - 2);
    for (var x2 = W + 10; x2 >= -10; x2 -= 4) ctx.lineTo(x2, bord(x2, yF, t) + 26 + 9 * Math.sin(x2 * .07 + t / 300) + 5 * Math.sin(x2 * .19));
    ctx.closePath(); ctx.clip();
    remplirMotif(motifD, (t * .01) % 192, (t * .004) % 192, 1.1, .75);
    ctx.restore();

    // Liseré d'écume au front, second liseré discontinu, bulles
    ctx.save();
    ctx.beginPath(); for (var x3 = -10; x3 <= W + 10; x3 += 4) ctx.lineTo(x3, bord(x3, yF, t));
    ctx.strokeStyle = 'rgba(255,255,255,.32)'; ctx.lineWidth = 14; ctx.filter = 'blur(4px)'; ctx.stroke();
    ctx.filter = 'none'; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.beginPath(); for (var x5 = -10; x5 <= W + 10; x5 += 4) ctx.lineTo(x5, bord(x5, yF, t) + 7 + 3 * Math.sin(x5 * .2 + t / 200));
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.2; ctx.setLineDash([9, 6, 3, 7]); ctx.stroke(); ctx.setLineDash([]);
    bulles.forEach(function(bu) {
      var x = bu.x * W, y = bord(x, yF, t) + 3 + bu.prof * (.35 + .65 * Math.abs(Math.sin(bu.ph + t / 480)));
      ctx.beginPath(); ctx.arc(x, y, bu.r, 0, 6.283);
      ctx.fillStyle = 'rgba(255,255,255,' + Math.max(0, .8 - bu.prof / 65) + ')'; ctx.fill();
    });
    ctx.restore();

    // Trace d'écume laissée au point le plus haut, qui s'efface
    if (t > MONTEE) {
      var a = Math.max(0, 1 - (t - MONTEE) / 1600);
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,' + (.6 * a) + ')'; ctx.lineWidth = 1.5; ctx.setLineDash([14, 5, 4, 6]);
      ctx.beginPath(); for (var x4 = -10; x4 <= W + 10; x4 += 4) ctx.lineTo(x4, bord(x4, HAUT, MONTEE) + 1.5 * Math.sin(x4 * .35)); ctx.stroke();
      ctx.restore();
    }

    if (t >= 2800) { terminer(); return; }
    requestAnimationFrame(image);
  }
  function terminer() { if (fini) return; fini = true; if (onFin) onFin(); }
  requestAnimationFrame(image);
  setTimeout(terminer, 6000);   // sécurité : jamais bloqué sur l'animation
  return cv;
}

// ── Staff : la plage se met en place ──
function _introCreneauTexte() {
  if (typeof SLOTS === 'undefined') return '';
  var now = new Date(), m = now.getHours() * 60 + now.getMinutes();
  function min(hhmm) { var p = String(hhmm).split(':'); return +p[0] * 60 + +p[1]; }
  var enCours = SLOTS.find(function(s) { return m >= min(s.start) && m < min(s.end); });
  if (enCours) return 'créneau ' + enCours.start.replace(':', 'h');
  var suivant = SLOTS.find(function(s) { return m < min(s.start); });
  return suivant ? 'prochain créneau ' + suivant.start.replace(':', 'h') : 'créneaux terminés pour aujourd\'hui';
}

function introStaff() {
  if (_introDejaVue()) { _introLeverCache(); return; }
  _introMarquer();
  var jour = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  jour = jour.charAt(0).toUpperCase() + jour.slice(1);
  var creneau = _introCreneauTexte();

  // Plan simplifié : rangées de places, tapis horizontaux et verticaux, en cascade de gauche à droite
  var h = '', cols = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 15, 16], rows = [0, 62, 94, 126];
  h += '<i class="tp h" style="left:0;top:31px;width:560px;animation-delay:.2s"></i>';
  h += '<i class="tp h" style="left:112px;top:160px;width:448px;animation-delay:.35s"></i>';
  [104, 238, 372].forEach(function(x, k) { h += '<i class="tp v" style="left:' + x + 'px;top:0;height:200px;animation-delay:' + (.25 + k * .08) + 's"></i>'; });
  cols.forEach(function(c, ci) {
    rows.forEach(function(r, ri) {
      if (ri === 0 || [3, 7, 11].indexOf(c) < 0) {
        h += '<i class="pl" style="left:' + (c * 32.5) + 'px;top:' + r + 'px;animation-delay:' + (.3 + ci * .045 + ri * .03).toFixed(2) + 's"></i>';
      }
    });
  });
  var c = _introCalque('intro-s',
    '<div class="intro-plan">' + h + '</div>'
    + '<img class="intro-mot" src="logo-handiplage-mot-bleu.svg" alt="Handiplage">'
    + '<div class="intro-txt"><b>La plage est prête</b><span>' + jour + (creneau ? ' · ' + creneau : '') + '</span></div>');
  setTimeout(function() { if (c.el.isConnected) c.el.remove(); }, _introReduite() ? 1700 : 2750);
}

if (typeof module !== 'undefined') {
  module.exports = { _introCreneauTexte: _introCreneauTexte };
}
