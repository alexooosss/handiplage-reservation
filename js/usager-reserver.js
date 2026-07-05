// js/usager-reserver.js
'use strict';

function _escR(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function renderReserver(container, inscription, showView) {
  container.innerHTML = '<div class="usager-loading">Chargement des disponibilités…</div>';

  try {
    var today   = new Date();
    var fromISO = today.toISOString().slice(0, 10);
    var toDate  = new Date(today);
    toDate.setDate(toDate.getDate() + 29);
    var toISO   = toDate.toISOString().slice(0, 10);

    var days = await getAvailableDays(fromISO, toISO, inscription.id);
    var dateKeys = Object.keys(days).sort();

    var selectedDate = dateKeys[0];
    _renderReserverContent(container, inscription, showView, days, dateKeys, selectedDate);

  } catch (e) {
    container.innerHTML = '<div class="usager-error">Erreur : ' + _escR(e.message) + '</div>';
  }
}

function _renderReserverContent(container, inscription, showView, days, dateKeys, selectedDate) {
  var dayFr = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

  var weekBar = '<div class="usager-week-bar">';
  dateKeys.forEach(function(dateISO) {
    var d        = new Date(dateISO + 'T00:00:00');
    var slots    = days[dateISO];
    var hasAvail = slots.some(function(s) { return s.available; });
    var isPast   = dateISO < new Date().toISOString().slice(0, 10);
    var cls      = isPast ? 'past' : hasAvail ? (dateISO === selectedDate ? 'selected available' : 'available') : 'full';
    if (dateISO === selectedDate && !isPast) cls = hasAvail ? 'selected available' : 'selected full';
    weekBar += '<div class="usager-day-btn ' + cls + '" data-date="' + dateISO + '">'
      + '<div class="usager-day-letter">' + dayFr[d.getDay()] + '</div>'
      + '<div class="usager-day-num">' + d.getDate() + '</div>'
      + (hasAvail && !isPast ? '<div class="usager-day-dot"></div>' : '<div style="height:10px"></div>')
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

  container.querySelectorAll('.usager-day-btn:not(.past)').forEach(function(btn) {
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
}

var _SLOT_COLORS = ['#1565c0', '#2e7d32', '#e65100', '#6a1b9a', '#f9a825'];

function _renderSlots(slots, dateISO) {
  if (!slots || slots.length === 0) {
    return '<div class="usager-empty">Aucun créneau disponible pour cette journée.</div>';
  }
  return slots.map(function(s) {
    var cls    = s.userBooked ? 'booked' : !s.available ? 'full' : '';
    var color  = _SLOT_COLORS[(s.creneauId - 1) % _SLOT_COLORS.length];
    var badge  = s.userBooked
      ? '<div class="usager-slot-badge booked-badge">✓ Déjà réservé</div>'
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
      await createUserReservation(inscription, params.dateISO, params.creneauId);
      container.innerHTML = '<div class="usager-success" style="margin-top:20px">'
        + '<div style="font-size:2rem;margin-bottom:10px">✅</div>'
        + '<div style="font-weight:700;font-size:1.1rem;margin-bottom:8px">Réservation confirmée !</div>'
        + '<div style="font-size:.9375rem;color:#555">' + dateLabel + ' — ' + _escR(params.label) + '</div>'
        + '<button class="usager-btn usager-btn-primary" style="margin-top:20px" id="btn-retour-accueil">Retour à l\'accueil</button>'
        + '</div>';
      container.querySelector('#btn-retour-accueil').addEventListener('click', function() { showView('accueil'); });
    } catch (e) {
      btn.disabled = false;
      btn.textContent = '✓ Confirmer cette réservation';
      errEl.textContent = 'Erreur : ' + (e.message || 'Réservation impossible.');
      errEl.style.display = 'block';
    }
  });
}
