// js/usager-reserver.js
'use strict';

function _escR(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Pictos des messages (traits, couleur héritée)
var _MSG_ICONES = {
  saison: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 30a14 14 0 0 1 28 0"/><path d="M24 8v4M9.9 13.9l2.8 2.8M38.1 13.9l-2.8 2.8M4 30h4M40 30h4"/><path d="M4 37c4 0 4-2.5 8-2.5s4 2.5 8 2.5 4-2.5 8-2.5 4 2.5 8 2.5 4-2.5 8-2.5"/><path d="M8 43c4 0 4-2.5 8-2.5s4 2.5 8 2.5 4-2.5 8-2.5 4 2.5 8 2.5"/></svg>',
  pass:   '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="21" width="28" height="21" rx="5"/><path d="M16 21v-6a8 8 0 0 1 16 0v6"/><path d="M24 30v5"/></svg>',
  pause:  '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="10" width="36" height="32" rx="6"/><path d="M6 19h36M16 6v8M32 6v8"/><path d="M20 26v10M28 26v10"/></svg>',
};

// Message plein écran de la page Réserver (saison terminée, pass inactif, réservations suspendues)
// o = { ton: 'bleu'|'orange', icone, surtitre, titre, texte (HTML), infos: [[libellé, valeur HTML]], actions: [[libellé, vue, principal]] }
function _blocMessage(container, showView, o) {
  container.innerHTML = '<button class="usager-back" id="back-accueil-msg">← Accueil</button>'
    + '<div class="um um-' + (o.ton || 'bleu') + '">'
    +   '<div class="um-haut">'
    +     '<div class="um-icone">' + (_MSG_ICONES[o.icone] || '') + '</div>'
    +     '<div><div class="um-surtitre">' + o.surtitre + '</div><h2 class="um-titre">' + o.titre + '</h2></div>'
    +   '</div>'
    +   '<div class="um-corps">'
    +     '<p class="um-texte">' + o.texte + '</p>'
    +     (o.infos && o.infos.length ? '<div class="um-infos">' + o.infos.map(function(i) {
            return '<div class="um-info"><small>' + i[0] + '</small><b>' + i[1] + '</b></div>';
          }).join('') + '</div>' : '')
    +     (o.actions && o.actions.length ? '<div class="um-actions">' + o.actions.map(function(a) {
            return '<button type="button" class="um-btn' + (a[2] ? ' principal' : '') + '" data-vue="' + a[1] + '">' + a[0] + '</button>';
          }).join('') + '</div>' : '')
    +   '</div>'
    + '</div>';
  container.querySelector('#back-accueil-msg').addEventListener('click', function() { showView('accueil'); });
  container.querySelectorAll('.um-btn').forEach(function(b) {
    b.addEventListener('click', function() { showView(b.dataset.vue); });
  });
}

async function renderReserver(container, inscription, showView) {
  if (!inscription.passActif) {
    _blocMessage(container, showView, {
      ton: 'bleu', icone: 'pass', surtitre: 'Réservation en ligne', titre: 'Pass non activé',
      texte: 'La réservation en ligne est réservée aux usagers disposant d\'un <strong>pass Handiplage actif</strong>. L\'équipe peut l\'activer pour vous.',
      actions: [['Contacter l\'équipe', 'contact', true], ['Infos pratiques', 'infos']],
    });
    return;
  }

  container.innerHTML = '<div class="usager-loading">Chargement des disponibilités…</div>';

  try {
    var todayISO = _localTodayISO();
    var saisonDates = await getSaisonDates();
    // Saison terminée : plus aucune réservation possible au-delà de la fermeture de la plage
    if (todayISO > saisonDates.fin) {
      var finLabel = new Date(saisonDates.fin + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      var anneeSuivante = Number(saisonDates.fin.slice(0, 4)) + 1;
      _blocMessage(container, showView, {
        ton: 'bleu', icone: 'saison', surtitre: 'À l\'année prochaine', titre: 'La saison est terminée',
        texte: 'La Handiplage est fermée jusqu\'à l\'été prochain. Les réservations en ligne rouvriront avec la nouvelle saison.',
        infos: [['Fermeture', finLabel], ['Prochaine saison', 'Été ' + anneeSuivante + ', dates annoncées ici']],
        actions: [['Mes réservations', 'reservations', true], ['Nous contacter', 'contact']],
      });
      return;
    }
    // Vérification blocage absences avant tout chargement
    var absents = await getAbsentsThisMonth(inscription.id);
    if (isAbsenceBlocked(inscription, absents)) {
      var nextMonthDate = new Date();
      nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
      nextMonthDate.setDate(1);
      var nextMonthStr = nextMonthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      _blocMessage(container, showView, {
        ton: 'orange', icone: 'pause', surtitre: 'Règle des absences', titre: 'Réservations suspendues',
        texte: 'Vous avez <strong>' + absents + ' absences non justifiées</strong> ce mois-ci. Conformément au règlement, les nouvelles réservations sont suspendues après 3 absences. Vous pouvez continuer à venir à la Handiplage <strong>sans réservation</strong>.',
        infos: [['Absences ce mois', absents + ' / 3'], ['Réactivation automatique', nextMonthStr]],
        actions: [['Écrire au staff', 'contact', true], ['Mes réservations', 'reservations']],
      });
      return;
    }

    var today   = new Date();
    // Date locale (évite le décalage UTC+2 qui renverrait hier)
    var fromISO = today.getFullYear() + '-'
      + String(today.getMonth() + 1).padStart(2, '0') + '-'
      + String(today.getDate()).padStart(2, '0');
    var toDate  = new Date(today);
    toDate.setMonth(toDate.getMonth() + 1); // +1 mois exact → API exclusive → dernier jour visible = J+30
    var toISO   = toDate.getFullYear() + '-'
      + String(toDate.getMonth() + 1).padStart(2, '0') + '-'
      + String(toDate.getDate()).padStart(2, '0');
    // Ne jamais proposer de créneau après la fermeture de la plage
    toISO = clampToSeasonEnd(toISO, saisonDates.fin);

    var days = await getAvailableDays(fromISO, toISO, inscription.id);
    // Éliminer les jours passés ou hors saison (sécurité si l'API en renvoie)
    var dateKeys = Object.keys(days).sort().filter(function(d) { return d >= fromISO && d <= saisonDates.fin; });

    var selectedDate = dateKeys[0];
    _renderReserverContent(container, inscription, showView, days, dateKeys, selectedDate);

  } catch (e) {
    container.innerHTML = '<div class="usager-error">Erreur : ' + _escR(e.message) + '</div>';
  }
}

function _renderReserverContent(container, inscription, showView, days, dateKeys, selectedDate, sens) {
  var dayFr    = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  var monthsFr = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];

  var weekBar = '<div class="usager-week-bar">';
  var lastMonth = -1;
  dateKeys.forEach(function(dateISO) {
    var d        = new Date(dateISO + 'T00:00:00');
    var slots    = _filterSlotsByCutoff(days[dateISO], dateISO);
    var hasAvail = slots.some(function(s) { return s.available; });
    var cls      = hasAvail ? (dateISO === selectedDate ? 'selected available' : 'available') : 'full';
    if (dateISO === selectedDate) cls = hasAvail ? 'selected available' : 'selected full';
    // Séparateur de mois
    if (d.getMonth() !== lastMonth) {
      weekBar += '<div class="usager-month-sep">' + monthsFr[d.getMonth()] + '</div>';
      lastMonth = d.getMonth();
    }
    weekBar += '<div class="usager-day-btn ' + cls + '" data-date="' + dateISO + '">'
      + '<div class="usager-day-letter">' + dayFr[d.getDay()] + '</div>'
      + '<div class="usager-day-num">' + d.getDate() + '</div>'
      + (hasAvail ? '<div class="usager-day-dot"></div>' : '<div style="height:10px"></div>')
      + '</div>';
  });
  weekBar += '</div>';

  var slotsHtml = _renderSlots(days[selectedDate] || [], selectedDate);

  var selD = new Date(selectedDate + 'T00:00:00');
  var selLabel = selD.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });

  container.innerHTML = '<button class="usager-back" id="back-accueil">← Accueil</button>'
    + weekBar
    + '<div class="usager-jour-cadre"><div class="usager-jour' + (sens ? ' usager-jour-' + sens : '') + '">'
    + '<div class="usager-card-title">' + selLabel.charAt(0).toUpperCase() + selLabel.slice(1) + '</div>'
    + '<div id="slots-list">' + slotsHtml + '</div>'
    + '</div></div>';

  container.querySelector('#back-accueil').addEventListener('click', function() { showView('accueil'); });

  var barre = container.querySelector('.usager-week-bar');
  _barreGlissable(barre);

  container.querySelectorAll('.usager-day-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (barre && barre._glisse) return;            // fin d'un glisser à la souris : pas un choix de jour
      if (btn.dataset.date === selectedDate) return;
      // Le contenu du jour arrive par la droite (jour suivant) ou par la gauche (jour précédent)
      var sensNouveau = btn.dataset.date > selectedDate ? 'suiv' : 'prec';
      selectedDate = btn.dataset.date;
      var savedScroll = (container.querySelector('.usager-week-bar') || {}).scrollLeft || 0;
      var ancien = container.querySelector('.usager-jour');
      var ancienHtml = ancien ? ancien.innerHTML : '';
      _renderReserverContent(container, inscription, showView, days, dateKeys, selectedDate, sensNouveau);
      // L'ancien jour sort entièrement du côté opposé pendant que le nouveau entre
      var cadre = container.querySelector('.usager-jour-cadre');
      _cascade(container.querySelector('.usager-jour'));
      if (cadre && ancienHtml) {
        var sortant = document.createElement('div');
        sortant.className = 'usager-jour usager-jour-sortant usager-jour-sort-' + sensNouveau;
        sortant.setAttribute('aria-hidden', 'true');
        sortant.innerHTML = ancienHtml;
        cadre.appendChild(sortant);
        _cascade(sortant);
        setTimeout(function() { if (sortant.isConnected) sortant.remove(); }, 1200);
      }
      var newBar = container.querySelector('.usager-week-bar');
      if (newBar) newBar.scrollLeft = savedScroll;
    });
  });

  container.querySelectorAll('.usager-slot-card:not(.full):not(.booked)').forEach(function(card) {
    card.addEventListener('click', function() {
      var creneauId  = parseInt(card.dataset.creneauId);
      var creneauObj = (days[selectedDate] || []).find(function(s) { return s.creneauId === creneauId; });
      if (!creneauObj) return;
      renderConfirmation(container, inscription, showView, {
        dateISO:    selectedDate,
        creneauId:  creneauId,
        label:      creneauObj.label,
        heureDebut: creneauObj.heureDebut,
        heureFin:   creneauObj.heureFin,
      });
    });
  });

  container.querySelectorAll('.usager-slot-card.booked').forEach(function(card) {
    card.addEventListener('click', function() {
      var creneauId  = parseInt(card.dataset.creneauId);
      var resaId     = card.dataset.resaId;
      var creneauObj = (days[selectedDate] || []).find(function(s) { return s.creneauId === creneauId; });
      if (!creneauObj) return;
      _renderResaManage(container, inscription, showView, {
        resaId:     resaId,
        resaStatut: creneauObj.resaStatut,
        dateISO:    selectedDate,
        dateLabel:  selLabel,
        label:      creneauObj.label,
        heureDebut: creneauObj.heureDebut,
        heureFin:   creneauObj.heureFin,
      });
    });
  });
}

// Changement de jour : le titre puis chaque créneau partent l'un après l'autre (cascade)
function _cascade(jour) {
  if (!jour) return;
  var elts = jour.querySelectorAll('.usager-card-title, #slots-list > *');
  for (var i = 0; i < elts.length; i++) elts[i].style.animationDelay = (i * 0.06).toFixed(2) + 's';
}

// Ordinateur : la barre des jours se fait glisser à la souris (main), et la molette la fait défiler
// de gauche à droite. Au doigt, le défilement natif reste inchangé.
function _barreGlissable(barre) {
  if (!barre) return;
  var depart = null;
  barre.addEventListener('pointerdown', function(e) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    depart = { x: e.clientX, scroll: barre.scrollLeft };
    barre._glisse = false;
  });
  barre.addEventListener('pointermove', function(e) {
    if (!depart) return;
    var dx = e.clientX - depart.x;
    if (!barre._glisse && Math.abs(dx) > 5) {
      barre._glisse = true;
      barre.classList.add('glisse');
      try { barre.setPointerCapture(e.pointerId); } catch (err) {}
    }
    if (barre._glisse) barre.scrollLeft = depart.scroll - dx;
  });
  function finir() {
    if (!depart) return;
    depart = null;
    barre.classList.remove('glisse');
    // Le clic qui suit le relâchement est ignoré, puis la barre redevient cliquable
    setTimeout(function() { barre._glisse = false; }, 0);
  }
  barre.addEventListener('pointerup', finir);
  barre.addEventListener('pointercancel', finir);
  barre.addEventListener('wheel', function(e) {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || barre.scrollWidth <= barre.clientWidth) return;
    e.preventDefault();
    barre.scrollLeft += e.deltaY;
  }, { passive: false });
}

var _SLOT_COLORS = ['#1565c0', '#2e7d32', '#e65100', '#6a1b9a', '#f9a825'];

function _localTodayISO() {
  var d = new Date();
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
}

// Filtre les créneaux d'aujourd'hui : supprime ceux qui débutent dans moins d'1h.
// Les créneaux déjà réservés par l'usager restent visibles (gestion annulation).
function _filterSlotsByCutoff(slots, dateISO) {
  if (dateISO !== _localTodayISO()) return slots || [];
  var cutoff = new Date(Date.now() + 60 * 60 * 1000); // maintenant + 1h
  return (slots || []).filter(function(s) {
    if (s.userBooked) return true;
    if (!s.heureDebut) return true;
    var parts = s.heureDebut.split(':').map(Number);
    var start = new Date();
    start.setHours(parts[0], parts[1] || 0, 0, 0);
    return start > cutoff;
  });
}

function _renderSlots(slots, dateISO) {
  slots = _filterSlotsByCutoff(slots, dateISO);
  if (!slots || slots.length === 0) {
    return '<div class="usager-empty">Aucun créneau disponible pour cette journée.</div>';
  }
  return slots.map(function(s) {
    var cls    = s.userBooked ? 'booked' : (s.dayLimit || !s.available) ? 'full' : '';
    var color  = _SLOT_COLORS[(s.creneauId - 1) % _SLOT_COLORS.length];
    var resaAttr = s.resaId ? ' data-resa-id="' + s.resaId + '"' : '';
    if (s.userBooked) {
      return '<div class="usager-slot-card usager-slot-c' + s.creneauId + ' booked" data-creneau-id="' + s.creneauId + '"' + resaAttr + ' style="border-left:4px solid ' + color + ';cursor:pointer">'
        + '<div class="usager-slot-dot" style="background:' + color + '"></div>'
        + '<div class="usager-slot-body usager-slot-body-booked">'
        +   '<div class="usager-slot-label">' + _escR(s.label) + '</div>'
        +   '<div class="usager-slot-badge booked-badge">✓ Réservé</div>'
        + '</div>'
        + '</div>';
    }
    var badge = s.ferme
      ? '<div class="usager-slot-badge full-badge">Plage fermée</div>'
      : s.dayLimit
      ? '<div class="usager-slot-badge full-badge">Limite journalière atteinte</div>'
      : !s.available
        ? '<div class="usager-slot-badge full-badge">Complet</div>'
        : '<div class="usager-slot-badge">' + s.remaining + ' place' + (s.remaining > 1 ? 's' : '') + '</div>';
    return '<div class="usager-slot-card usager-slot-c' + s.creneauId + ' ' + cls + '" data-creneau-id="' + s.creneauId + '" style="border-left:4px solid ' + color + '">'
      + '<div class="usager-slot-dot" style="background:' + color + '"></div>'
      + '<div class="usager-slot-body">'
      +   '<div class="usager-slot-label">' + _escR(s.label) + '</div>'
      +   badge
      + '</div>'
      + '</div>';
  }).join('');
}

function _renderResaManage(container, inscription, showView, params) {
  var dateLabel = params.dateLabel.charAt(0).toUpperCase() + params.dateLabel.slice(1);
  container.innerHTML =
    '<button class="usager-back" id="back-reserver">← Retour</button>'
    + '<div class="usager-card">'
    +   '<div class="usager-recap-icon"><img src="icone%20votre%20r%C3%A9servation.svg" alt=""></div>'
    +   '<div class="usager-recap-title">Votre réservation</div>'
    +   '<div class="usager-recap-row"><span class="usager-recap-key">Date</span><span class="usager-recap-val">' + dateLabel + '</span></div>'
    +   '<div class="usager-recap-row"><span class="usager-recap-key">Créneau</span><span class="usager-recap-val">' + _escR(params.label) + '</span></div>'
    + '</div>'
    + (params.resaStatut === 'attente'
      ? '<button class="usager-btn usager-btn-danger" id="btn-annuler-manage">Annuler cette réservation</button>'
        + '<div id="cancel-confirm-manage" style="display:none" class="usager-cancel-confirm">'
      : '<div class="usager-info-block" style="text-align:center;color:var(--text-muted);font-size:14px;margin-top:16px">'
        + (params.resaStatut === 'present' ? '✓ Présence enregistrée par le staff'
          : params.resaStatut === 'parti'  ? '✓ Présence enregistrée par le staff'
          : params.resaStatut === 'absent' ? '⚠️ Absence enregistrée — contactez le staff si besoin'
          : 'Annulation non disponible')
        + '</div>'
        + '<div id="cancel-confirm-manage" style="display:none" class="usager-cancel-confirm">'
    )
    +   '<div class="usager-cancel-confirm-text">Confirmer l\'annulation ?</div>'
    +   '<div class="usager-cancel-confirm-row">'
    +     '<button class="usager-btn usager-btn-danger" id="btn-cancel-yes-manage">Oui, annuler</button>'
    +     '<button class="usager-btn usager-btn-ghost" id="btn-cancel-no-manage">Non, garder</button>'
    +   '</div>'
    +   '<div id="cancel-err-manage" class="usager-error" style="display:none;margin-top:8px"></div>'
    + '</div>';

  container.querySelector('#back-reserver').addEventListener('click', function() {
    renderReserver(container, inscription, showView);
  });
  var annulerBtn   = container.querySelector('#btn-annuler-manage');
  var confirmBlock = container.querySelector('#cancel-confirm-manage');
  if (annulerBtn) {
    annulerBtn.addEventListener('click', function() {
      annulerBtn.style.display = 'none';
      confirmBlock.style.display = 'block';
    });
  }
  var cancelNoBtn = container.querySelector('#btn-cancel-no-manage');
  if (cancelNoBtn) {
    cancelNoBtn.addEventListener('click', function() {
      confirmBlock.style.display = 'none';
      if (annulerBtn) annulerBtn.style.display = '';
    });
  }
  var cancelYesBtn = container.querySelector('#btn-cancel-yes-manage');
  if (!cancelYesBtn) return;
  cancelYesBtn.addEventListener('click', async function() {
    var btn   = cancelYesBtn;
    var errEl = container.querySelector('#cancel-err-manage');
    btn.disabled = true; btn.textContent = 'Annulation…';
    errEl.style.display = 'none';
    try {
      await cancelUserReservation(params.resaId);
      container.innerHTML =
        '<div class="usager-success">'
        + '<div class="usager-success-icon">↩️</div>'
        + '<div class="usager-success-title" style="color:var(--text-muted)">Réservation annulée</div>'
        + '<div class="usager-success-detail">' + dateLabel + ' — ' + _escR(params.label) + '</div>'
        + '</div>'
        + '<div class="usager-success-actions">'
        +   '<button class="usager-btn usager-btn-primary" id="btn-reserver-apres">＋ Faire une réservation</button>'
        +   '<button class="usager-btn usager-btn-ghost" id="btn-accueil-apres">← Accueil</button>'
        + '</div>';
      container.querySelector('#btn-reserver-apres').addEventListener('click', function() { renderReserver(container, inscription, showView); });
      container.querySelector('#btn-accueil-apres').addEventListener('click', function() { showView('accueil'); });
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Oui, annuler';
      errEl.textContent = 'Erreur : ' + (e.message || 'Impossible d\'annuler.'); errEl.style.display = 'block';
    }
  });
}

function _renderConfirmSuccess(container, inscription, showView, dateLabel, params, resaId) {
  container.innerHTML =
    '<div class="usager-success">'
    + '<div class="usager-success-icon">✅</div>'
    + '<div class="usager-success-title">Réservation confirmée !</div>'
    + '<div class="usager-success-detail">' + dateLabel + ' — ' + _escR(params.label) + '</div>'
    + '</div>'
    + '<div class="usager-success-actions">'
    +   '<button class="usager-btn usager-btn-primary" id="btn-voir-resas"><img src="icone%20mes%20r%C3%A9servations.svg" alt="" class="usager-btn-icon">Mes réservations</button>'
    +   '<button class="usager-btn usager-btn-ghost" id="btn-autre-resa">＋ Faire une autre réservation</button>'
    +   '<button class="usager-btn usager-btn-danger" id="btn-annuler-resa">Annuler cette réservation</button>'
    + '</div>'
    + '<div id="cancel-confirm" class="usager-cancel-confirm" style="display:none">'
    +   '<div class="usager-cancel-confirm-text">Confirmer l\'annulation de cette réservation ?</div>'
    +   '<div class="usager-cancel-confirm-row">'
    +     '<button class="usager-btn usager-btn-danger" id="btn-cancel-yes">Oui, annuler</button>'
    +     '<button class="usager-btn usager-btn-ghost" id="btn-cancel-no">Non, garder</button>'
    +   '</div>'
    +   '<div id="cancel-err" class="usager-error" style="display:none;margin-top:8px"></div>'
    + '</div>';

  container.querySelector('#btn-voir-resas').addEventListener('click', function() {
    showView('reservations');
  });
  container.querySelector('#btn-autre-resa').addEventListener('click', function() {
    renderReserver(container, inscription, showView);
  });
  container.querySelector('#btn-annuler-resa').addEventListener('click', function() {
    container.querySelector('#cancel-confirm').style.display = 'block';
    container.querySelector('#btn-annuler-resa').style.display = 'none';
  });
  container.querySelector('#btn-cancel-no').addEventListener('click', function() {
    container.querySelector('#cancel-confirm').style.display = 'none';
    container.querySelector('#btn-annuler-resa').style.display = '';
  });
  container.querySelector('#btn-cancel-yes').addEventListener('click', async function() {
    var btn = container.querySelector('#btn-cancel-yes');
    var errEl = container.querySelector('#cancel-err');
    btn.disabled = true; btn.textContent = 'Annulation…';
    errEl.style.display = 'none';
    try {
      await cancelUserReservation(resaId);
      container.innerHTML =
        '<div class="usager-success">'
        + '<div class="usager-success-icon" style="font-size:2rem">↩️</div>'
        + '<div class="usager-success-title" style="color:var(--text-muted)">Réservation annulée</div>'
        + '<div class="usager-success-detail">' + dateLabel + ' — ' + _escR(params.label) + '</div>'
        + '</div>'
        + '<div class="usager-success-actions">'
        +   '<button class="usager-btn usager-btn-primary" id="btn-refaire">＋ Faire une réservation</button>'
        +   '<button class="usager-btn usager-btn-ghost" id="btn-accueil-annul">← Accueil</button>'
        + '</div>';
      container.querySelector('#btn-refaire').addEventListener('click', function() { renderReserver(container, inscription, showView); });
      container.querySelector('#btn-accueil-annul').addEventListener('click', function() { showView('accueil'); });
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Oui, annuler';
      errEl.textContent = 'Erreur : ' + (e.message || 'Impossible d\'annuler.'); errEl.style.display = 'block';
    }
  });
}

async function renderConfirmation(container, inscription, showView, params) {
  var d = new Date(params.dateISO + 'T00:00:00');
  var dateLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  var passImpactHtml = '';
  if (inscription.passActif) {
    try {
      var resas   = await getUserReservations(inscription.id);
      var balance = computePassBalance(resas, PASS_QUOTA);
      if (balance.remaining === 0) {
        container.innerHTML = '<button class="usager-back" id="back-reserver">← Retour</button>'
          + '<div class="usager-error" style="margin-top:12px">Pass épuisé pour ce mois. Aucune réservation possible.</div>';
        container.querySelector('#back-reserver').addEventListener('click', function() { renderReserver(container, inscription, showView); });
        return;
      }
      passImpactHtml = '<div class="usager-recap-row"><span class="usager-recap-key">Pass</span>'
        + '<span class="usager-recap-val pass-impact">' + balance.remaining + ' → ' + (balance.remaining - 1) + '</span></div>';
    } catch (e) { /* silencieux */ }
  }

  container.innerHTML = '<button class="usager-back" id="back-reserver">← Retour</button>'
    + '<div class="usager-card">'
    +   '<div class="usager-recap-icon"><img src="icone%20votre%20r%C3%A9servation.svg" alt=""></div>'
    +   '<div class="usager-recap-title">Votre réservation</div>'
    +   '<div class="usager-recap-row"><span class="usager-recap-key">Date</span><span class="usager-recap-val">' + dateLabel + '</span></div>'
    +   '<div class="usager-recap-row"><span class="usager-recap-key">Créneau</span><span class="usager-recap-val">' + _escR(params.label) + '</span></div>'
    +   passImpactHtml
    + '</div>'
    + '<div id="confirm-error" class="usager-error" style="display:none"></div>'
    + '<button class="usager-btn usager-btn-confirm" id="btn-confirm">✓ Confirmer cette réservation</button>'
    + '<button class="usager-btn usager-btn-ghost" id="btn-cancel-confirm" style="margin-top:8px">Annuler</button>';

  container.querySelector('#back-reserver').addEventListener('click', function() {
    renderReserver(container, inscription, showView);
  });
  container.querySelector('#btn-cancel-confirm').addEventListener('click', function() {
    renderReserver(container, inscription, showView);
  });
  container.querySelector('#btn-confirm').addEventListener('click', async function() {
    // Compte démo : même parcours qu'un vrai compte (réservation simulée dans le navigateur)
    var btn = container.querySelector('#btn-confirm');
    var errEl = container.querySelector('#confirm-error');
    btn.disabled = true;
    btn.textContent = 'Réservation en cours…';
    errEl.style.display = 'none';
    try {
      var newResa = await createUserReservation(inscription, params.dateISO, params.creneauId);
      _renderConfirmSuccess(container, inscription, showView, dateLabel, params, newResa.id);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = '✓ Confirmer cette réservation';
      errEl.textContent = 'Erreur : ' + (e.message || 'Réservation impossible.');
      errEl.style.display = 'block';
    }
  });
}
