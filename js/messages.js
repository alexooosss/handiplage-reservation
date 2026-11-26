// js/messages.js
'use strict';

var _msgAll        = [];
var _msgFilter     = 'todo';   // 'todo' | 'done' | 'all'
var _msgSelectedId = null;

// Débuts de réponse prêts à l'emploi (modifiables avant envoi)
var MSG_MODELES = [
  { label: 'Dossier bien reçu',
    texte: 'Nous avons bien reçu votre message et les éléments transmis. Votre dossier va être examiné dans les meilleurs délais.' },
  { label: 'Inscription validée',
    texte: 'Votre inscription à la Handiplage est validée. Vous allez recevoir un e-mail pour activer votre espace et réserver vos créneaux.' },
  { label: 'Justificatif encore illisible',
    texte: 'Le justificatif transmis n\'est malheureusement pas lisible. Pourriez-vous nous envoyer une photo nette, recto et verso, de votre carte en cours de validité ?' },
];

function _escM(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// « il y a 2 h », « hier », « il y a 3 j », sinon la date
function _msgDepuis(iso) {
  if (!iso) return '';
  var d = new Date(iso), now = new Date();
  var min = Math.round((now - d) / 60000);
  if (min < 1)  return 'à l\'instant';
  if (min < 60) return 'il y a ' + min + ' min';
  var h = Math.round(min / 60);
  var hier = new Date(now); hier.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'il y a ' + h + ' h';
  if (d.toDateString() === hier.toDateString()) return 'hier';
  var j = Math.round((now - d) / 86400000);
  if (j < 7) return 'il y a ' + j + ' j';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function _msgIsUsager(m)    { return !!(m.motifRefus && m.motifRefus.startsWith('[USAGER]')); }
function _msgIsReponse(m)   { return !_msgIsUsager(m) && !!m.contenu; }        // réponse à un refus
function _msgIsSansRep(m)   { return !_msgIsUsager(m) && !m.contenu; }         // refus resté sans réponse
function _msgATraiter(m)    { return (_msgIsUsager(m) || _msgIsReponse(m)) && !m.lu; }
function _msgTraite(m)      { return (_msgIsUsager(m) || _msgIsReponse(m)) && m.lu; }
function _msgNomAffiche(m)  { return _escM((m.nom || '').toUpperCase()) + ' ' + _escM(m.prenom || ''); }
function _msgInitiales(m)   { return ((m.nom || '?').charAt(0) + (m.prenom || '').charAt(0)).toUpperCase(); }

// Met à jour la pastille rouge de l'onglet Messages
function _msgMajBadge() {
  if (typeof getUnreadCount !== 'function') return;
  getUnreadCount().then(function(n) {
    var b = document.getElementById('messages-badge');
    if (!b) return;
    if (n > 0) { b.textContent = n; b.style.display = 'inline'; } else { b.style.display = 'none'; }
  }).catch(function() {});
}

async function renderMessages(container) {
  container.innerHTML = '<div id="msg-body-container"></div>';
  await _renderMessagesBody(document.getElementById('msg-body-container'));
}

async function _renderMessagesBody(container) {
  container.innerHTML = '<div class="msg-loading">Chargement…</div>';
  try {
    _msgAll = await getMessages();
  } catch (e) {
    container.innerHTML = '<div class="msg-error">Erreur de chargement : ' + _escM(e.message) + '</div>';
    return;
  }
  // Le message sélectionné a pu être supprimé entre-temps
  if (_msgSelectedId && !_msgAll.some(function(m) { return m.id === _msgSelectedId; })) _msgSelectedId = null;

  container.innerHTML = '<div class="mx-layout">'
    + '<aside class="mx-side">'
    +   '<div class="mx-side-hd"><h2>Messages</h2>'
    +     '<div class="mx-seg" role="tablist" aria-label="Filtrer les messages" id="mx-seg"></div>'
    +   '</div>'
    +   '<div class="mx-list" id="mx-list"></div>'
    + '</aside>'
    + '<section class="mx-detail" id="mx-detail"></section>'
    + '</div>';

  _msgRenderSeg();
  _msgRenderList();
  _msgRenderDetail();
}

function _msgRenderSeg() {
  var seg = document.getElementById('mx-seg');
  if (!seg) return;
  var nTodo = _msgAll.filter(_msgATraiter).length;
  var opts = [
    { id: 'todo', label: 'À traiter', count: nTodo, alerte: nTodo > 0 },
    { id: 'done', label: 'Traités', count: _msgAll.filter(_msgTraite).length },
    { id: 'all',  label: 'Tous', count: _msgAll.length },
  ];
  seg.innerHTML = opts.map(function(o) {
    var on = _msgFilter === o.id;
    return '<button type="button" role="tab" class="mx-seg-btn' + (on ? ' on' : '') + '" aria-selected="' + on + '" data-f="' + o.id + '">'
      + o.label + '<span class="mx-seg-c' + (o.alerte ? '' : ' zero') + '">' + o.count + '</span></button>';
  }).join('');
  seg.querySelectorAll('.mx-seg-btn').forEach(function(b) {
    b.addEventListener('click', function() { _msgFilter = b.dataset.f; _msgRenderSeg(); _msgRenderList(); });
  });
}

function _msgRenderList() {
  var listEl = document.getElementById('mx-list');
  if (!listEl) return;
  var liste = _msgAll.filter(function(m) {
    return _msgFilter === 'todo' ? _msgATraiter(m) : _msgFilter === 'done' ? _msgTraite(m) : true;
  }).sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

  if (!liste.length) {
    listEl.innerHTML = '<p class="mx-empty">' + (_msgFilter === 'todo' ? 'Rien à traiter. ✓' : 'Aucun message.') + '</p>';
    return;
  }
  listEl.innerHTML = liste.map(function(m) {
    var tag, apercu, quand;
    if (_msgIsUsager(m)) {
      tag = '<span class="mx-tag mx-tag-u">Message</span>';
      apercu = m.sujet || (m.contenu || '').slice(0, 80);
      quand = _msgDepuis(m.createdAt);
    } else if (_msgIsReponse(m)) {
      tag = '<span class="mx-tag mx-tag-r">Réponse à un refus</span>';
      apercu = (m.contenu || '').replace(/\s+/g, ' ').slice(0, 80);
      quand = 'refus du ' + new Date(m.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    } else {
      tag = '<span class="mx-tag mx-tag-n">Refus sans réponse</span>';
      apercu = (m.motifRefus || '').slice(0, 80);
      quand = _msgDepuis(m.createdAt);
    }
    var nonLu = _msgATraiter(m);
    return '<button type="button" class="mx-item' + (m.id === _msgSelectedId ? ' on' : '') + (nonLu ? ' unread' : '') + '" data-id="' + _escM(m.id) + '">'
      + '<span class="mx-dot" aria-hidden="true"></span>'
      + '<span class="mx-name">' + _msgNomAffiche(m) + (nonLu ? '<span class="sr-only"> (à traiter)</span>' : '') + '</span>'
      + '<span class="mx-when">' + quand + '</span>'
      + '<span class="mx-prev">' + tag + _escM(apercu) + '</span>'
      + '</button>';
  }).join('');
  listEl.querySelectorAll('.mx-item').forEach(function(el) {
    el.addEventListener('click', function() {
      _msgSelectedId = el.dataset.id;
      listEl.querySelectorAll('.mx-item').forEach(function(x) { x.classList.toggle('on', x === el); });
      _msgRenderDetail();
    });
  });
}

// ── Partie droite ──
function _msgRenderDetail() {
  var panel = document.getElementById('mx-detail');
  if (!panel) return;
  var msg = _msgAll.find(function(m) { return m.id === _msgSelectedId; });
  // Téléphone : un message ouvert prend tout l'écran (voir css/staff-tel.css)
  var lay = panel.closest('.mx-layout');
  if (lay) lay.classList.toggle('mx-msg-ouvert', !!msg);
  if (!msg) { _msgRenderOverview(panel); return; }

  var isUsager = _msgIsUsager(msg);
  var aTraiter = _msgATraiter(msg);
  var lienDossier = msg.inscriptionId
    ? '<button type="button" class="mx-link" id="mx-dossier">Voir le dossier d\'inscription →</button>' : '';

  var corps;
  if (isUsager) {
    corps = '<div><div class="mx-lab">' + _escM(msg.sujet || 'Message de l\'usager') + ' · reçu le ' + _formatDate(msg.createdAt) + '</div>'
      + '<div class="mx-bubble">' + _escM(msg.contenu).replace(/\n/g, '<br>') + '</div></div>';
  } else {
    corps = '<div class="mx-card mx-sent"><div class="mx-lab">Refus envoyé le ' + _formatDate(msg.createdAt) + '</div>'
      + '<div class="mx-sent-txt">' + _escM(msg.motifRefus || '').replace(/\n/g, '<br>') + '</div></div>'
      + (msg.contenu
          ? '<div><div class="mx-lab">Réponse de l\'usager</div><div class="mx-bubble">' + _escM(msg.contenu).replace(/\n/g, '<br>') + '</div></div>'
          : '<p class="mx-empty">Aucune réponse reçue pour le moment.</p>');
  }

  var actions = '';
  if (!isUsager && msg.inscriptionId && msg.contenu) {
    actions += '<button type="button" class="mx-btn-pri" id="mx-verif">Ouvrir le dossier pour vérifier</button>';
  }
  if (msg.mail) {
    actions += '<button type="button" class="' + (isUsager ? 'mx-btn-pri' : 'mx-btn-sec') + '" id="mx-reply"><span aria-hidden="true">✉</span> Répondre par e-mail</button>';
  }
  if (isUsager || msg.contenu) {
    actions += aTraiter
      ? '<button type="button" class="mx-btn-sec" id="mx-traite">✓ Marquer comme traité</button>'
      : '<span class="mx-done">✓ Traité</span><button type="button" class="mx-link-sm" id="mx-retraiter">Remettre à traiter</button>';
  }
  actions += '<button type="button" class="mx-del" id="mx-delete">Supprimer</button>';

  panel.innerHTML = '<div class="mx-page">'
    + '<div class="mx-hd">'
    +   '<span class="mx-avatar" aria-hidden="true">' + _escM(_msgInitiales(msg)) + '</span>'
    +   '<div class="mx-hd-txt"><h2>' + _msgNomAffiche(msg) + '</h2>' + (msg.mail ? '<small>' + _escM(msg.mail) + '</small>' : '') + '</div>'
    +   '<span class="mx-sp"></span>' + lienDossier
    +   '<button type="button" class="mx-close" id="mx-close" title="Fermer le message (Échap)" aria-label="Fermer le message">✕</button>'
    + '</div>'
    + corps
    + '<div class="mx-acts">' + actions + '</div>'
    + '<div class="mx-card mx-comp" id="mx-comp" hidden>'
    +   '<div class="mx-lab">Répondre à ' + _escM(msg.prenom || '') + ' ' + _escM(msg.nom || '') + '</div>'
    +   '<div class="mx-modeles">' + MSG_MODELES.map(function(t, i) {
          return '<button type="button" class="mx-modele" data-i="' + i + '">' + _escM(t.label) + '</button>';
        }).join('') + '</div>'
    +   '<label class="sr-only" for="mx-reply-text">Votre réponse</label>'
    +   '<textarea id="mx-reply-text" rows="5" placeholder="Votre réponse… (ou choisissez un début de réponse ci-dessus)"></textarea>'
    +   '<p class="mx-hint">La formule de politesse et la signature « L\'équipe Handiplage — CCAS d\'Antibes » sont ajoutées automatiquement.</p>'
    +   '<div class="mx-acts">'
    +     '<button type="button" class="mx-btn-pri" id="mx-send">Ouvrir dans ma messagerie</button>'
    +     '<button type="button" class="mx-btn-sec" id="mx-cancel">Annuler</button>'
    +   '</div>'
    +   '<div id="mx-reply-status" class="mx-hint" role="status"></div>'
    + '</div>'
    + '</div>';

  // Fermer le message : retour à la vue d'ensemble
  function fermer() {
    _msgSelectedId = null;
    document.querySelectorAll('#mx-list .mx-item').forEach(function(x) { x.classList.remove('on'); });
    _msgRenderDetail();
  }
  document.getElementById('mx-close').addEventListener('click', fermer);
  panel.onkeydown = function(e) {
    if (e.key === 'Escape' && !e.target.closest('textarea')) fermer();
  };
  if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');

  function ouvrirDossier() {
    if (typeof App !== 'undefined' && msg.inscriptionId) App.showView('inscription', msg.inscriptionId);
  }
  var bDossier = document.getElementById('mx-dossier');
  if (bDossier) bDossier.addEventListener('click', ouvrirDossier);
  var bVerif = document.getElementById('mx-verif');
  if (bVerif) bVerif.addEventListener('click', ouvrirDossier);

  async function changerEtat(lu) {
    try {
      if (lu) await markMessageRead(msg.id);
      else    await markMessageUnread(msg.id);
      msg.lu = lu;
      _msgRenderSeg(); _msgRenderList(); _msgRenderDetail(); _msgMajBadge();
    } catch (e) { alert('Erreur : ' + e.message); }
  }
  var bTraite = document.getElementById('mx-traite');
  if (bTraite) bTraite.addEventListener('click', function() { bTraite.disabled = true; changerEtat(true); });
  var bRe = document.getElementById('mx-retraiter');
  if (bRe) bRe.addEventListener('click', function() { changerEtat(false); });

  var bDel = document.getElementById('mx-delete');
  bDel.addEventListener('click', async function() {
    if (!confirm('Supprimer définitivement ce message ?')) return;
    bDel.disabled = true;
    try {
      await deleteMessage(msg.id);
      _msgAll = _msgAll.filter(function(m) { return m.id !== msg.id; });
      _msgSelectedId = null;
      _msgRenderSeg(); _msgRenderList(); _msgRenderDetail(); _msgMajBadge();
    } catch (e) { bDel.disabled = false; alert('Erreur : ' + e.message); }
  });

  // Réponse par e-mail
  var comp = document.getElementById('mx-comp');
  var txt  = document.getElementById('mx-reply-text');
  var bReply = document.getElementById('mx-reply');
  if (bReply) bReply.addEventListener('click', function() {
    comp.hidden = !comp.hidden;
    if (!comp.hidden) { comp.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); txt.focus(); }
  });
  comp.querySelectorAll('.mx-modele').forEach(function(b) {
    b.addEventListener('click', function() {
      txt.value = MSG_MODELES[parseInt(b.dataset.i)].texte;
      txt.focus();
    });
  });
  document.getElementById('mx-cancel').addEventListener('click', function() { comp.hidden = true; });
  document.getElementById('mx-send').addEventListener('click', function() {
    var t = txt.value.trim();
    if (!t) { txt.focus(); return; }
    var subject = encodeURIComponent('Handiplage — Suite à votre message');
    var body = encodeURIComponent('Bonjour ' + (msg.prenom || '') + ' ' + (msg.nom || '') + ',\n\n'
      + t + '\n\nCordialement,\nL\'équipe Handiplage — CCAS d\'Antibes');
    window.location.href = 'mailto:' + msg.mail + '?subject=' + subject + '&body=' + body;
    document.getElementById('mx-reply-status').textContent = 'Votre messagerie a été ouverte avec l\'e-mail pré-rempli. Pensez à marquer le message comme traité une fois la réponse envoyée.';
  });
}

// Aucun message sélectionné : résumé + accès au plus ancien à traiter
function _msgRenderOverview(panel) {
  var todo    = _msgAll.filter(_msgATraiter).sort(function(a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
  var reps    = todo.filter(_msgIsReponse);
  var annee   = String(new Date().getFullYear());
  var traites = _msgAll.filter(function(m) { return _msgTraite(m) && String(m.createdAt || '').slice(0, 4) === annee; });
  var plusAncien = todo[0];

  // Compteurs compacts (même présentation que les onglets Inscription et Groupes) ;
  // ceux qui ont quelque chose à ouvrir sont cliquables
  var kpi = function(cls, n, l, s, id) {
    return '<' + (id ? 'button type="button" id="' + id + '"' : 'div') + ' class="idb-kpi ' + cls + (id ? ' mx-kpi-btn' : '') + '">'
      + '<span class="idb-kpi-n">' + n + '</span><span class="idb-kpi-l">' + l + '</span><span class="idb-kpi-s">' + s + '</span>'
      + '</' + (id ? 'button' : 'div') + '>';
  };
  var depuis = plusAncien ? (function(d) {
    return d === 'hier' ? 'depuis hier' : /^il y a /.test(d) ? d.replace(/^il y a /, 'depuis ') : /^\d/.test(d) ? 'depuis le ' + d : d;
  })(_msgDepuis(plusAncien.createdAt)) : '';
  var recents = _msgAll.filter(_msgTraite).sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }).slice(0, 6);

  panel.innerHTML = '<div class="mx-page">'
    + '<div class="mx-page-hd"><h2>Messages</h2><p>Messages des usagers et réponses aux refus d\'inscription</p></div>'
    + '<div class="idb-kpis mx-kpis3">'
    +   kpi('k-wait' + (todo.length ? ' k-alerte' : ''), todo.length, 'À traiter',
          plusAncien ? 'le plus ancien attend ' + depuis + ' · ouvrir →' : 'tout est à jour', plusAncien ? 'mx-oldest' : '')
    +   kpi('k-ko', reps.length, 'Réponses à un refus',
          reps.length ? 'dossier' + (reps.length > 1 ? 's' : '') + ' à revérifier · ouvrir →' : 'aucune en attente', reps.length ? 'mx-reps' : '')
    +   kpi('k-ok', traites.length, 'Traités', 'cette saison')
    + '</div>'
    // Annonce aux usagers : ce qu'on envoie, à côté de ce qu'on reçoit
    + '<div id="annonce-staff-container" class="mx-annonce"></div>'
    + '<section class="idb-card"><h2 class="idb-card-t">Derniers messages traités</h2>'
    +   (recents.length
          ? '<ul class="idb-list">' + recents.map(function(m) {
              var extrait = (_msgIsUsager(m) ? (m.sujet || m.contenu) : m.contenu) || '';
              extrait = extrait.replace(/\s+/g, ' ');
              return '<li class="idb-row idb-row-click" data-id="' + _escM(m.id) + '" tabindex="0" role="button">'
                + '<div class="idb-who"><b>' + _msgNomAffiche(m) + '</b><small>'
                +   (_msgIsUsager(m) ? 'Message' : 'Réponse à un refus') + ' · « ' + _escM(extrait.slice(0, 70)) + (extrait.length > 70 ? '…' : '') + ' »</small></div>'
                + '<span class="idb-when">' + _escM(_msgDepuis(m.createdAt)) + '</span>'
                + '</li>';
            }).join('') + '</ul>'
          : '<p class="idb-empty">Aucun message traité pour l\'instant.</p>')
    + '</section>'
    + '</div>';

  renderAnnonceStaffBlock(document.getElementById('annonce-staff-container')).catch(console.error);

  function ouvrirMessage(id, filtre) {
    _msgSelectedId = id;
    if (filtre) _msgFilter = filtre;
    _msgRenderSeg(); _msgRenderList(); _msgRenderDetail();
  }
  var b = document.getElementById('mx-oldest');
  if (b) b.addEventListener('click', function() { ouvrirMessage(plusAncien.id, 'todo'); });
  var br = document.getElementById('mx-reps');
  if (br) br.addEventListener('click', function() { ouvrirMessage(reps[0].id, 'todo'); });
  panel.querySelectorAll('.idb-row-click').forEach(function(r) {
    r.addEventListener('click', function() { ouvrirMessage(r.dataset.id, null); });
    r.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrirMessage(r.dataset.id, null); } });
  });
}
