'use strict';

function renderInfos(container, inscription, showView) {
  var jours = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
  var horairesRows = jours.map(function(j) {
    return '<tr><td class="usager-infos-jour">' + j.charAt(0).toUpperCase() + j.slice(1) + '</td>'
         + '<td class="usager-infos-heure">08:30 – 18:15</td></tr>';
  }).join('');

  container.innerHTML = ''
    + '<div class="usager-infos-back"><button class="usager-btn-back" id="infos-back">← Retour</button></div>'
    + '<div class="usager-card">'
    +   '<div class="usager-infos-slogan">2 plages horaires max / jour &nbsp;·&nbsp; 40 plages horaires max / mois</div>'
    + '</div>'
    + '<div class="usager-card">'
    +   '<div class="usager-card-title">Informations utiles</div>'
    +   '<p class="usager-infos-text">Inscription obligatoire avant toute réservation.</p>'
    +   '<p class="usager-infos-text">1 réservation = 1 place pour 1 personne en situation de handicap et 2 accompagnants maximum (soit 1 transat et 2 chaises).</p>'
    + '</div>'
    + '<div class="usager-card">'
    +   '<div class="usager-card-title">Heures d\'ouverture</div>'
    +   '<table class="usager-infos-table">' + horairesRows + '</table>'
    + '</div>'
    ;

  document.getElementById('infos-back').addEventListener('click', function() {
    showView('accueil');
  });
}
