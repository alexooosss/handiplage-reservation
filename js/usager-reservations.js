// js/usager-reservations.js
'use strict';

function _escRes(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

var STATUT_LABELS = { attente: 'Réservation', present: 'Présent·e', parti: 'Parti·e', absent: 'Absent·e', annule: 'Annulé' };
var STATUT_CLS    = { attente: 'resa-s-attente', present: 'resa-s-present', parti: 'resa-s-parti', absent: 'resa-s-absent', annule: 'resa-s-annule' };
var CRENEAU_LABELS = { 1: '8h30–10h15', 2: '10h30–12h15', 3: '12h30–14h15', 4: '14h30–16h15', 5: '16h30–18h15' };

async function renderReservations(container, inscription, showView) {
  container.innerHTML = '<div class="usager-loading">Chargement…</div>';

  try {
    var resas    = await getUserReservations(inscription.id);
    var todayISO = new Date().toISOString().slice(0, 10);
    var monthKey = todayISO.slice(0, 7);
    var today    = todayISO;
    var upcoming = resas.filter(function(r) { return r.date >= today && r.statut !== 'annule'; }).sort(function(a,b){ return a.date<b.date?-1:1; });
    var past     = resas.filter(function(r) { return r.date < today || r.statut === 'annule'; }).sort(function(a,b){ return a.date>b.date?-1:1; });
    var absentsThisMonth = resas.filter(function(r) { return r.statut === 'absent' && r.date && r.date.startsWith(monthKey); }).length;

    var passHtml = '';
    if (inscription.passActif) {
      var balance  = computePassBalance(resas, PASS_QUOTA_USAGER);
      var pct      = balance.quota > 0 ? Math.round((balance.remaining / balance.quota) * 100) : 0;
      var fillCls  = balance.remaining === 0 ? 'empty' : balance.remaining <= 10 ? 'low' : '';
      var nextReset = new Date();
      nextReset.setDate(1);
      nextReset.setMonth(nextReset.getMonth() + 1);
      var resetLabel = nextReset.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

      passHtml = '<div class="usager-card usager-pass-banner">'
        + '<div class="usager-pass-banner-row">'
        +   '<div class="usager-pass-banner-label">Pass ce mois</div>'
        +   '<div class="usager-pass-banner-count"><span class="usager-pass-banner-num">' + balance.remaining + '</span> / ' + balance.quota + '</div>'
        + '</div>'
        + '<div class="usager-pass-bar-wrap" style="margin:8px 0 4px"><div class="usager-pass-bar-fill ' + fillCls + '" style="width:' + pct + '%"></div></div>'
        + '<div class="usager-pass-meta">Réinitialisation le ' + resetLabel + '</div>'
        + '</div>';
    }

    var absenceColor   = absentsThisMonth >= 3 ? 'var(--red)' : absentsThisMonth >= 2 ? '#e65100' : '#2e7d32';
    var contactHtml    = absentsThisMonth >= 3
      ? '<button class="usager-absence-contact-btn" id="btn-open-contact">📩 Écrire au staff</button>'
        + '<div id="usager-contact-form" class="usager-contact-form" style="display:none">'
        +   '<textarea id="usager-contact-msg" class="usager-contact-textarea" rows="4" placeholder="Décrivez votre situation ou posez votre question…"></textarea>'
        +   '<div class="usager-contact-actions">'
        +     '<button class="usager-btn usager-btn-primary" id="btn-send-contact">Envoyer</button>'
        +     '<button class="usager-btn usager-btn-ghost" id="btn-cancel-contact">Annuler</button>'
        +   '</div>'
        +   '<div id="usager-contact-status"></div>'
        + '</div>'
      : '';
    var absenceInfoHtml = '<div class="usager-absence-info">'
      + '<div class="usager-absence-info-rule">'
      +   '⚠️ Règle absences : après <strong>3 absences non justifiées</strong> dans le mois, les réservations sont suspendues jusqu\'au mois suivant.'
      + '</div>'
      + '<div class="usager-absence-info-count">Vos absences ce mois : <strong style="color:' + absenceColor + '">' + absentsThisMonth + ' / 3</strong></div>'
      + contactHtml
      + '</div>';

    container.innerHTML = '<button class="usager-back" id="back-accueil-resa">← Accueil</button>'
      + passHtml
      + absenceInfoHtml
      + '<div class="usager-resa-section-title">À venir (' + upcoming.length + ')</div>'
      + (upcoming.length ? upcoming.map(function(r) { return _resaCard(r, true); }).join('') : '<div class="usager-empty">Aucune réservation à venir.</div>')
      + '<div class="usager-resa-section-title" style="margin-top:24px">Passées</div>'
      + (past.length ? past.slice(0, 20).map(function(r) { return _resaCard(r, false); }).join('') : '<div class="usager-empty">Aucune réservation passée.</div>');

    container.querySelector('#back-accueil-resa').addEventListener('click', function() { showView('accueil'); });

    // Formulaire de contact staff (uniquement si 3 absences)
    var btnOpenContact = container.querySelector('#btn-open-contact');
    if (btnOpenContact) {
      btnOpenContact.addEventListener('click', function() {
        var form = container.querySelector('#usager-contact-form');
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
      });
      container.querySelector('#btn-cancel-contact').addEventListener('click', function() {
        container.querySelector('#usager-contact-form').style.display = 'none';
      });
      container.querySelector('#btn-send-contact').addEventListener('click', async function() {
        var btn    = container.querySelector('#btn-send-contact');
        var status = container.querySelector('#usager-contact-status');
        var text   = container.querySelector('#usager-contact-msg').value.trim();
        if (!text) { status.textContent = 'Veuillez écrire un message.'; status.style.color = 'var(--red)'; return; }
        btn.disabled = true;
        btn.textContent = 'Envoi…';
        status.textContent = '';
        try {
          await sendUsagerMessage(inscription.id, text);
          container.querySelector('#usager-contact-form').style.display = 'none';
          btnOpenContact.textContent = '✓ Message envoyé';
          btnOpenContact.disabled = true;
        } catch (e) {
          btn.disabled = false;
          btn.textContent = 'Envoyer';
          status.textContent = 'Erreur : ' + (e.message || 'Impossible d\'envoyer le message.');
          status.style.color = 'var(--red)';
        }
      });
    }

    container.querySelectorAll('.usager-cancel-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var id = btn.dataset.resaId;
        if (!confirm('Annuler cette réservation ?')) return;
        btn.disabled = true;
        btn.textContent = 'Annulation…';
        try {
          await cancelUserReservation(id);
          renderReservations(container, inscription, showView);
        } catch (e) {
          btn.disabled = false;
          btn.textContent = 'Annuler';
          alert('Erreur : ' + e.message);
        }
      });
    });

  } catch (e) {
    container.innerHTML = '<div class="usager-error">Erreur : ' + _escRes(e.message) + '</div>';
  }
}

function _resaCard(r, isUpcoming) {
  var d = new Date(r.date + 'T00:00:00');
  var dateStr  = d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  var slotLbl  = CRENEAU_LABELS[r.creneauId] || ('Créneau ' + r.creneauId);
  var statutLbl = STATUT_LABELS[r.statut] || r.statut;
  var statutCls = STATUT_CLS[r.statut] || '';
  var canCancel = isUpcoming && r.statut === 'attente' && canCancelReservation(r.date);

  return '<div class="usager-resa-card">'
    + '<div class="usager-resa-info">'
    +   '<span class="usager-resa-date">' + dateStr + '</span>'
    +   '<span class="usager-resa-sep">|</span>'
    +   '<span class="usager-resa-slot">' + _escRes(slotLbl) + (r.accompagnants > 0 ? ' · ' + r.accompagnants + ' acc.' : '') + '</span>'
    +   (r.spotId ? '<span class="usager-resa-spot">Emplacement ' + _escRes(r.spotId) + '</span>' : '')
    + '</div>'
    + '<span class="usager-resa-statut ' + statutCls + '">' + statutLbl + '</span>'
    + (canCancel ? '<button class="usager-cancel-btn" data-resa-id="' + r.id + '">Annuler</button>' : '')
    + '</div>';
}
