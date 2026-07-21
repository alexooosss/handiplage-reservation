// js/usager-reserver.js
'use strict';

function _escR(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function renderReserver(container, inscription, showView) {
  container.innerHTML = '<div class="usager-loading">Chargement des disponibilités…</div>';

  try {
    // Vérification blocage absences avant tout chargement
    var absents = await getAbsentsThisMonth(inscription.id);
    if (isAbsenceBlocked(inscription, absents)) {
      var nextMonthDate = new Date();
      nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
      nextMonthDate.setDate(1);
      var nextMonthStr = nextMonthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      container.innerHTML = '<button class="usager-back" id="back-accueil">← Accueil</button>'
        + '<div class="usager-absence-block">'
        +   '<div class="usager-absence-icon">⚠️</div>'
        +   '<div class="usager-absence-title">Réservations suspendues</div>'
        +   '<div class="usager-absence-body">'
        +     '<p>Vous avez <strong>' + absents + ' absences non justifiées</strong> ce mois. Conformément au règlement, les nouvelles réservations sont suspendues après 3 absences.</p>'
        +     '<p>Vous pouvez continuer à vous rendre à la Handiplage <strong>sans réservation</strong>.</p>'
        +     '<p>Les réservations seront réactivées automatiquement en <strong>' + nextMonthStr + '</strong>, ou plus tôt sur demande auprès du staff.</p>'
        +   '</div>'
        + '</div>';
      container.querySelector('#back-accueil').addEventListener('click', function() { showView('accueil'); });
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

    var days = await getAvailableDays(fromISO, toISO, inscription.id);
    // Éliminer les jours passés (sécurité si l'API en renvoie)
    var dateKeys = Object.keys(days).sort().filter(function(d) { return d >= fromISO; });

    var selectedDate = dateKeys[0];
    _renderReserverContent(container, inscription, showView, days, dateKeys, selectedDate);

  } catch (e) {
    container.innerHTML = '<div class="usager-error">Erreur : ' + _escR(e.message) + '</div>';
  }
}

function _renderReserverContent(container, inscription, showView, days, dateKeys, selectedDate) {
  var dayFr    = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  var monthsFr = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];

  var weekBar = '<div class="usager-week-bar">';
  var lastMonth = -1;
  dateKeys.forEach(function(dateISO) {
    var d        = new Date(dateISO + 'T00:00:00');
    var slots    = days[dateISO];
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
    + '<div class="usager-card-title">' + selLabel.charAt(0).toUpperCase() + selLabel.slice(1) + '</div>'
    + '<div id="slots-list">' + slotsHtml + '</div>';

  container.querySelector('#back-accueil').addEventListener('click', function() { showView('accueil'); });

  container.querySelectorAll('.usager-day-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      selectedDate = btn.dataset.date;
      _renderReserverContent(container, inscription, showView, days, dateKeys, selectedDate);
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

var _SLOT_COLORS = ['#1565c0', '#2e7d32', '#e65100', '#6a1b9a', '#f9a825'];

function _localTodayISO() {
  var d = new Date();
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
}

function _renderSlots(slots, dateISO) {
  // Pour aujourd'hui, masquer les créneaux dont l'heure de fin est déjà passée
  if (dateISO === _localTodayISO()) {
    var now = new Date();
    slots = (slots || []).filter(function(s) {
      if (!s.heureFin) return true;
      var parts = s.heureFin.split(':');
      var end = new Date();
      end.setHours(parseInt(parts[0], 10), parseInt(parts[1] || '0', 10), 0, 0);
      return end > now;
    });
  }
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
    var badge = s.dayLimit
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
    +   '<div class="usager-recap-icon">📋</div>'
    +   '<div class="usager-recap-title">Votre réservation</div>'
    +   '<div class="usager-recap-row"><span class="usager-recap-key">Date</span><span class="usager-recap-val">' + dateLabel + '</span></div>'
    +   '<div class="usager-recap-row"><span class="usager-recap-key">Créneau</span><span class="usager-recap-val">' + _escR(params.label) + ' (' + (params.heureDebut || '').slice(0,5) + '–' + (params.heureFin || '').slice(0,5) + ')</span></div>'
    + '</div>'
    + (params.resaStatut === 'attente'
      ? '<button class="usager-btn usager-btn-danger" id="btn-annuler-manage">Annuler cette réservation</button>'
        + '<div id="cancel-confirm-manage" style="display:none" class="usager-cancel-confirm">'
      : '<div class="usager-info-block" style="text-align:center;color:var(--text-muted);font-size:14px;margin-top:16px">'
        + (params.resaStatut === 'present' ? '✓ Présence enregistrée par le staff'
          : params.resaStatut === 'parti'  ? '✓ Votre venue a été enregistrée'
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
    +   '<button class="usager-btn usager-btn-primary" id="btn-voir-resas">📄 Mes réservations</button>'
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
      var balance = computePassBalance(resas, PASS_QUOTA_USAGER);
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
    +   '<div class="usager-recap-icon">📋</div>'
    +   '<div class="usager-recap-title">Votre réservation</div>'
    +   '<div class="usager-recap-row"><span class="usager-recap-key">Date</span><span class="usager-recap-val">' + dateLabel + '</span></div>'
    +   '<div class="usager-recap-row"><span class="usager-recap-key">Créneau</span><span class="usager-recap-val">' + _escR(params.label) + ' (' + (params.heureDebut || '').slice(0, 5) + '–' + (params.heureFin || '').slice(0, 5) + ')</span></div>'
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
