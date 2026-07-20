'use strict';

function renderInfos(container, inscription, showView) {
  var jours = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
  var horairesRows = jours.map(function(j) {
    return '<tr><td class="usager-infos-jour">' + j.charAt(0).toUpperCase() + j.slice(1) + '</td>'
         + '<td class="usager-infos-heure">08:30 – 18:15</td></tr>';
  }).join('');

  container.innerHTML = ''
    + '<button class="usager-back" id="infos-back">← Accueil</button>'
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
    + '<div class="usager-card" style="border-left:4px solid #e65100">'
    +   '<div class="usager-card-title" style="color:#bf360c">⚠️ Règle d\'absence</div>'
    +   '<p class="usager-infos-text">Après <strong>3 absences non justifiées</strong> au cours d\'un même mois, les réservations en ligne sont automatiquement suspendues jusqu\'au 1er du mois suivant.</p>'
    +   '<p class="usager-infos-text">Vous pouvez continuer à vous rendre à la Handiplage <strong>sans réservation préalable</strong> pendant cette période.</p>'
    +   '<p class="usager-infos-text">Pour toute demande de réactivation anticipée, contactez le staff depuis la section <strong>Mes réservations</strong>.</p>'
    + '</div>'
    ;

  document.getElementById('infos-back').addEventListener('click', function() {
    showView('accueil');
  });
}
