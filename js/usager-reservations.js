// js/usager-reservations.js
'use strict';

function _escRes(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

var STATUT_LABELS = { attente: 'Réservation', present: 'Présent·e', parti: 'Présent·e', absent: 'Absent·e', annule: 'Annulée', suspendu: 'Suspendue — plage fermée' };
var STATUT_CLS    = { attente: 'resa-s-attente', present: 'resa-s-present', parti: 'resa-s-present', absent: 'resa-s-absent', annule: 'resa-s-annule', suspendu: 'resa-s-suspendu' };
var CRENEAU_LABELS = { 1: '8h30 – 10h15', 2: '10h30 – 12h15', 3: '12h30 – 14h15', 4: '14h30 – 16h15', 5: '16h30 – 18h15' };
var CRENEAU_COULEURS = ['#1565c0', '#2e7d32', '#e65100', '#6a1b9a', '#f9a825'];

async function renderReservations(container, inscription, showView) {
  container.innerHTML = '<div class="usager-loading">Chargement…</div>';

  try {
    var resas    = await getUserReservations(inscription.id);
    var todayISO = _isoLocal(new Date()); // date locale (slots.js), pas UTC
    var monthKey = todayISO.slice(0, 7);
    var nowHHMM  = new Date().toTimeString().slice(0, 5); // "HH:MM"

    function _isUpcoming(r) {
      if (r.statut === 'annule' || suspensionRecreditee(r)) return false;
      if (r.date > todayISO) return true;
      if (r.date < todayISO) return false;
      // Même jour : vérifier si l'heure de fin du créneau est déjà passée
      return !r.heureFin || r.heureFin > nowHHMM;
    }

    var parDate  = function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.creneauId || 0) - (b.creneauId || 0); };
    var upcoming = resas.filter(_isUpcoming).sort(parDate);
    var past     = resas.filter(function(r) { return !_isUpcoming(r); }).sort(function(a, b) { return -parDate(a, b); });
    var absentsThisMonth = resas.filter(function(r) { return r.statut === 'absent' && r.date && r.date.startsWith(monthKey); }).length;

    var saisonDates = await getSaisonDates();
    var seasonOver = todayISO > saisonDates.fin;

    // ── Compteurs : pass (ou bilan de saison) et absences ──
    var cartes = [];
    if (seasonOver) {
      var seasonCount = resas.filter(function(r) { return r.statut !== 'annule' && !suspensionRecreditee(r); }).length;
      cartes.push('<div class="ur-stat">'
        + '<small>Saison ' + saisonDates.fin.slice(0, 4) + '</small>'
        + '<div class="ur-n ur-bleu">' + seasonCount + '</div>'
        + '<div class="ur-petit">réservation' + (seasonCount > 1 ? 's' : '') + ' effectuée' + (seasonCount > 1 ? 's' : '') + ' cette saison</div>'
        + '</div>');
    } else if (inscription.passActif) {
      var balance  = computePassBalance(resas, PASS_QUOTA);
      var pct      = balance.quota > 0 ? Math.round((balance.remaining / balance.quota) * 100) : 0;
      var niveau   = balance.remaining === 0 ? 'vide' : balance.remaining <= 10 ? 'bas' : '';
      var nextReset = new Date();
      nextReset.setDate(1);
      nextReset.setMonth(nextReset.getMonth() + 1);
      var resetLabel = (nextReset.getDate() === 1 ? '1<sup>er</sup> ' : nextReset.getDate() + ' ')
        + nextReset.toLocaleDateString('fr-FR', { month: 'long' });
      cartes.push('<div class="ur-stat">'
        + '<small>Pass de ' + nomMoisCourant() + '</small>'
        + '<div class="ur-n ur-pass ' + niveau + '">' + balance.remaining + '<span> / ' + balance.quota + '</span></div>'
        + '<div class="ur-barre ' + niveau + '"><i style="width:' + pct + '%"></i></div>'
        + '<div class="ur-petit">Repart à ' + PASS_QUOTA + ' le ' + resetLabel + '. Les réservations non utilisées ne sont pas reportées.</div>'
        + '</div>');
    }

    var contactHtml = absentsThisMonth >= 3
      ? '<button class="usager-absence-contact-btn" id="btn-open-contact">Écrire au staff</button>'
        + '<div id="usager-contact-form" class="usager-contact-form" style="display:none">'
        +   '<textarea id="usager-contact-msg" class="usager-contact-textarea" rows="4" placeholder="Décrivez votre situation ou posez votre question…"></textarea>'
        +   '<div class="usager-contact-actions">'
        +     '<button class="usager-btn usager-btn-primary" id="btn-send-contact">Envoyer</button>'
        +     '<button class="usager-btn usager-btn-ghost" id="btn-cancel-contact">Annuler</button>'
        +   '</div>'
        +   '<div id="usager-contact-status"></div>'
        + '</div>'
      : '';
    if (!seasonOver) {
      var pips = '';
      for (var i = 0; i < 3; i++) pips += '<i class="' + (i < absentsThisMonth ? (absentsThisMonth >= 3 ? 'rouge' : 'orange') : '') + '"></i>';
      cartes.push('<div class="ur-stat">'
        + '<small>Absences ce mois</small>'
        + '<div class="ur-n' + (absentsThisMonth >= 3 ? ' ur-rouge' : '') + '">' + absentsThisMonth + '<span> / 3</span></div>'
        + '<div class="ur-pips">' + pips + '</div>'
        + '<div class="ur-petit">Après 3 absences non justifiées, les réservations sont suspendues jusqu\'au mois suivant.</div>'
        + contactHtml
        + '</div>');
    }
    var statsHtml = cartes.length
      ? '<div class="ur-stats' + (cartes.length === 1 ? ' seul' : '') + '">' + cartes.join('') + '</div>'
      : '';

    // ── À venir : la prochaine réservation en avant, puis les suivantes ──
    var aVenirHtml;
    if (!upcoming.length) {
      aVenirHtml = '<div class="ur-vide">Aucune réservation à venir.</div>';
    } else {
      aVenirHtml = _heroResa(upcoming[0], todayISO);
      var suite = upcoming.slice(1);
      if (suite.length) {
        aVenirHtml += '<div class="ur-titre">Ensuite <em>' + suite.length + '</em></div>'
          + '<div class="ur-liste">' + suite.map(function(r) { return _ligneResa(r, true); }).join('') + '</div>';
      }
    }

    container.innerHTML = '<div class="ur">'
      + '<button class="usager-back" id="back-accueil-resa">← Accueil</button>'
      + statsHtml
      + aVenirHtml
      + '<div class="ur-titre">Historique</div>'
      + _renderHistorique(past)
      + '</div>';

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
          await sendUsagerMessage(inscription.id, 'Réactivation des réservations', text);
          container.querySelector('#usager-contact-form').style.display = 'none';
          btnOpenContact.textContent = 'Message envoyé';
          btnOpenContact.disabled = true;
        } catch (e) {
          btn.disabled = false;
          btn.textContent = 'Envoyer';
          status.textContent = 'Erreur : ' + (e.message || 'Impossible d\'envoyer le message.');
          status.style.color = 'var(--red)';
        }
      });
    }

    // Historique : choix du mois
    container.querySelectorAll('.ur-mois button').forEach(function(btn) {
      btn.addEventListener('click', function() {
        container.querySelectorAll('.ur-mois button').forEach(function(b) {
          var on = b === btn;
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        container.querySelectorAll('.ur-mois-corps').forEach(function(c) {
          c.hidden = c.dataset.mois !== btn.dataset.mois;
        });
      });
    });

    container.querySelectorAll('.resa-month-more').forEach(function(btn) {
      btn.dataset.label = btn.textContent;
      btn.addEventListener('click', function() {
        var extra = btn.nextElementSibling;
        var isOpen = extra.classList.toggle('open');
        btn.textContent = isOpen ? 'Replier' : btn.dataset.label;
      });
    });

    container.querySelectorAll('.usager-cancel-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var id = btn.dataset.resaId;
        var resa = upcoming.find(function(r) { return String(r.id) === String(id); });
        if (!(await _demanderAnnulation(resa, btn))) return;
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

function _groupByMonth(resas) {
  var months = {};
  resas.forEach(function(r) {
    var key = r.date.slice(0, 7);
    if (!months[key]) months[key] = [];
    months[key].push(r);
  });
  return months;
}

function _monthLabel(key) {
  var s = new Date(key + '-02').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

var PAST_VISIBLE = 5;

// Historique : un bouton par mois (le plus récent ouvert), un bilan, puis la liste
function _renderHistorique(past) {
  if (!past.length) return '<div class="ur-vide">Aucune réservation passée.</div>';

  var months = _groupByMonth(past);
  var keys = Object.keys(months).sort().reverse();
  var anneeCourante = String(new Date().getFullYear());
  // Mois ouvert d'office : le mois en cours (ou le plus récent avant lui), pas un mois futur
  // qui ne contiendrait que des annulations
  var moisCourant = _isoLocal(new Date()).slice(0, 7);
  var ouvert = keys.find(function(k) { return k <= moisCourant; }) || keys[0];

  var boutons = '<div class="ur-mois" role="group" aria-label="Choisir le mois">' + keys.map(function(key) {
    var lbl = _monthLabel(key);
    if (key.slice(0, 4) === anneeCourante) lbl = lbl.replace(/\s\d{4}$/, '');
    var on = key === ouvert;
    return '<button type="button" data-mois="' + key + '" class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '">' + lbl + '</button>';
  }).join('') + '</div>';

  var corps = keys.map(function(key) {
    var items = months[key];
    var nPres = 0, nAbs = 0, nAnn = 0;
    items.forEach(function(r) {
      if (r.statut === 'present' || r.statut === 'parti') nPres++;
      else if (r.statut === 'absent') nAbs++;
      else if (r.statut === 'annule' || r.statut === 'suspendu' || suspensionRecreditee(r)) nAnn++;
    });
    var bilan = [
      '<span><b>' + nPres + '</b> présence' + (nPres > 1 ? 's' : '') + '</span>',
      '<span><b>' + nAbs + '</b> absence' + (nAbs > 1 ? 's' : '') + '</span>',
      '<span><b>' + nAnn + '</b> annulée' + (nAnn > 1 ? 's' : '') + '</span>',
    ].join('');
    var visible = items.slice(0, PAST_VISIBLE);
    var extra   = items.slice(PAST_VISIBLE);

    return '<div class="ur-liste ur-mois-corps" data-mois="' + key + '"' + (key === ouvert ? '' : ' hidden') + '>'
      + '<div class="ur-bilan">' + bilan + '</div>'
      + visible.map(function(r) { return _ligneResa(r, false); }).join('')
      + (extra.length
          ? '<button class="resa-month-more">Voir les ' + extra.length + ' autre' + (extra.length > 1 ? 's' : '') + '</button>'
            + '<div class="resa-month-extra">' + extra.map(function(r) { return _ligneResa(r, false); }).join('') + '</div>'
          : '')
      + '</div>';
  }).join('');

  return boutons + corps;
}

function _jourCourt(d) {
  var s = d.toLocaleDateString('fr-FR', { weekday: 'short' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function _dateLongue(d) {
  var s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function _infosResa(r) {
  var bits = [_escRes(CRENEAU_LABELS[r.creneauId] || ('Créneau ' + r.creneauId))];
  if (r.accompagnants > 0) bits.push(r.accompagnants + ' accompagnant' + (r.accompagnants > 1 ? 's' : ''));
  if (r.spotId) bits.push('Emplacement ' + _escRes(r.spotId));
  return bits.join(' · ');
}
function _statutResa(r) {
  var recred = suspensionRecreditee(r);
  return {
    lbl: recred ? 'Recréditée — plage fermée' : (STATUT_LABELS[r.statut] || r.statut),
    cls: recred ? 'resa-s-recredit' : (STATUT_CLS[r.statut] || ''),
  };
}
function _boutonAnnuler(r, cls) {
  return '<button class="usager-cancel-btn' + (cls ? ' ' + cls : '') + '" data-resa-id="' + r.id + '">Annuler</button>';
}

// Grande carte bleue de la prochaine réservation
function _heroResa(r, todayISO) {
  var d = new Date(r.date + 'T00:00:00');
  var jours = Math.round((d - new Date(todayISO + 'T00:00:00')) / 86400000);
  var quand = jours <= 0 ? 'Aujourd\'hui' : jours === 1 ? 'Demain' : 'Dans ' + jours + ' jours';
  var canCancel = r.statut === 'attente' && canCancelReservation(r.date);
  var st = _statutResa(r);
  return '<div class="ur-hero">'
    + '<div class="ur-jour"><small>' + _jourCourt(d) + '</small><b>' + d.getDate() + '</b><span>' + d.toLocaleDateString('fr-FR', { month: 'short' }) + '</span></div>'
    + '<div class="ur-hero-infos">'
    +   '<div class="ur-surtitre">Prochaine réservation</div>'
    +   '<h3>' + _dateLongue(d) + '</h3>'
    +   '<p>' + _infosResa(r) + '</p>'
    +   '<span class="ur-dans">' + quand + '</span>'
    +   (r.statut !== 'attente' ? ' <span class="usager-resa-statut ' + st.cls + '">' + st.lbl + '</span>' : '')
    + '</div>'
    + (canCancel ? _boutonAnnuler(r, 'ur-annuler-clair') : '')
    + '</div>';
}

// Ligne de liste : petit calendrier, date, créneau (pastille de couleur), statut ou Annuler
function _ligneResa(r, isUpcoming) {
  var d = new Date(r.date + 'T00:00:00');
  var couleur = CRENEAU_COULEURS[(r.creneauId || 1) - 1] || '#90a4ae';
  var st = _statutResa(r);
  var canCancel = isUpcoming && r.statut === 'attente' && canCancelReservation(r.date);
  var droite = canCancel ? _boutonAnnuler(r)
    : (isUpcoming && r.statut === 'attente') ? ''
    : '<span class="usager-resa-statut ' + st.cls + '">' + st.lbl + '</span>';
  return '<div class="ur-ligne">'
    + '<div class="ur-mini"><small>' + _jourCourt(d) + '</small><b>' + d.getDate() + '</b></div>'
    + '<div class="ur-txt"><b>' + _dateLongue(d) + '</b><span><i style="background:' + couleur + '"></i>' + _infosResa(r) + '</span></div>'
    + droite
    + '</div>';
}

// Fenêtre de confirmation avant d'annuler une réservation.
// Renvoie une promesse : true = annuler, false = garder la réservation.
function _demanderAnnulation(r, declencheur) {
  return new Promise(function(resolve) {
    var d = r ? new Date(r.date + 'T00:00:00') : null;
    var moisCourant = _isoLocal(new Date()).slice(0, 7);
    var cree = r && r.createdAt ? _isoLocal(new Date(r.createdAt)).slice(0, 7) : null;
    var credit = cree === moisCourant
      ? 'La réservation est rendue à votre pass de ' + nomMoisCourant() + '.'
      : cree ? 'Faite un mois précédent, elle n\'est pas rendue à votre pass.' : '';

    var fond = document.createElement('div');
    fond.className = 'ur-dlg-fond';
    fond.innerHTML = '<div class="ur-dlg" role="alertdialog" aria-modal="true" aria-labelledby="ur-dlg-titre" aria-describedby="ur-dlg-texte">'
      + '<h3 id="ur-dlg-titre">Annuler cette réservation ?</h3>'
      + (d ? '<div class="ur-dlg-resa">'
          +   '<div class="ur-mini"><small>' + _jourCourt(d) + '</small><b>' + d.getDate() + '</b></div>'
          +   '<div class="ur-txt"><b>' + _dateLongue(d) + '</b><span>' + _infosResa(r) + '</span></div>'
          + '</div>' : '')
      + '<p id="ur-dlg-texte">Votre place sera libérée pour une autre personne. ' + credit + '</p>'
      + '<div class="ur-dlg-actions">'
      +   '<button type="button" class="ur-dlg-garder">Non, garder</button>'
      +   '<button type="button" class="ur-dlg-annuler">Oui, annuler</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(fond);
    requestAnimationFrame(function() { fond.classList.add('ouvert'); });

    var garder = fond.querySelector('.ur-dlg-garder');
    garder.focus();

    function fermer(valeur) {
      document.removeEventListener('keydown', clavier);
      fond.classList.remove('ouvert');
      setTimeout(function() { fond.remove(); }, 180);
      if (!valeur && declencheur) declencheur.focus();
      resolve(valeur);
    }
    function clavier(e) {
      if (e.key === 'Escape') fermer(false);
      if (e.key === 'Tab') { // garder le focus dans la fenêtre
        var b = fond.querySelectorAll('button');
        if (e.shiftKey && document.activeElement === b[0]) { e.preventDefault(); b[b.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === b[b.length - 1]) { e.preventDefault(); b[0].focus(); }
      }
    }
    document.addEventListener('keydown', clavier);
    garder.addEventListener('click', function() { fermer(false); });
    fond.querySelector('.ur-dlg-annuler').addEventListener('click', function() { fermer(true); });
    fond.addEventListener('click', function(e) { if (e.target === fond) fermer(false); });
  });
}
