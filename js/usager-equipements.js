// js/usager-equipements.js
'use strict';

// Photos attendues dans images/equipements/<id>.jpg ; une photo absente
// affiche une icône à la place.
var EQUIPEMENTS = [
  {
    groupe: 'Mise à l\'eau',
    items: [
      { id: 'tiralo',      nom: 'Tiralo',      description: 'Fauteuil amphibie équipé de flotteurs, pour aller dans l\'eau et se baigner en restant assis.' },
      { id: 'hippocampe',  nom: 'Hippocampe',  description: 'Fauteuil tout-terrain à grandes roues, pour circuler sur le sable et rejoindre le bord de l\'eau.' },
      { id: 'audioplage',  nom: 'Audioplage',  description: 'Balisage sonore en mer qui permet aux personnes déficientes visuelles de se repérer et de se baigner.' },
    ],
  },
  {
    groupe: 'Aide à la mobilité',
    items: [
      { id: 'leve-personne', nom: 'Lève-personne',    description: 'Appareil de levage pour faciliter les transferts, par exemple du fauteuil au transat ou au Tiralo.' },
      { id: 'fauteuil',      nom: 'Fauteuil roulant', description: 'Fauteuil roulant disponible sur place pour vos déplacements sur la plage.' },
      { id: 'deambulateur',  nom: 'Déambulateur',     description: 'Déambulateur disponible sur place pour vous déplacer en sécurité.' },
    ],
  },
  {
    groupe: 'Accès et circulation',
    items: [
      { id: 'tapis',        nom: 'Tapis de circulation',   description: 'Tapis posé sur le sable pour circuler facilement, à pied ou en fauteuil.' },
      { id: 'rampe-entree', nom: 'Rampe d\'entrée',        description: 'Accès à la plage par une rampe, sans marche.' },
      { id: 'rampe-eau',    nom: 'Rampe d\'accès à l\'eau', description: 'Rampe qui descend jusqu\'à l\'eau pour faciliter la mise à l\'eau.' },
    ],
  },
  {
    groupe: 'Confort et services',
    items: [
      { id: 'transats',   nom: 'Transats et chaises',  description: 'Chaque réservation comprend 1 transat pour la personne en situation de handicap et 2 chaises pour ses accompagnants.' },
      { id: 'sanitaires', nom: 'Sanitaires adaptés',   description: 'Sanitaires accessibles, équipés de barres d\'appui.' },
    ],
  },
];

var EQUIP_PLACEHOLDER = '<span class="usager-equip-ph" aria-hidden="true">'
  + '<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
  + '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>'
  + '</svg></span>';

function renderEquipements(container, inscription, showView) {
  var groupesHtml = EQUIPEMENTS.map(function(g) {
    return '<section class="usager-equip-groupe">'
      +   '<h2 class="usager-equip-groupe-titre">' + g.groupe + '</h2>'
      +   '<div class="usager-equip-grid">'
      +     g.items.map(function(e) {
              return '<article class="usager-equip-card">'
                +   '<div class="usager-equip-photo">'
                +     '<img src="images/equipements/' + e.id + '.jpg" alt="Photo : ' + e.nom + '" loading="lazy">'
                +   '</div>'
                +   '<div class="usager-equip-body">'
                +     '<h3 class="usager-equip-nom">' + e.nom + '</h3>'
                +     '<p class="usager-equip-desc">' + e.description + '</p>'
                +   '</div>'
                + '</article>';
            }).join('')
      +   '</div>'
      + '</section>';
  }).join('');

  container.innerHTML = '<button class="usager-back" id="equip-back">← Infos</button>'
    + '<div class="usager-card">'
    +   '<div class="usager-card-title">Équipements de la plage</div>'
    +   '<p class="usager-infos-text">Le matériel ci-dessous est disponible sur place. Demandez-le à l\'équipe à votre arrivée ; vous pouvez aussi indiquer vos besoins d\'aides techniques dans votre inscription.</p>'
    + '</div>'
    + groupesHtml;

  container.querySelectorAll('.usager-equip-photo img').forEach(function(img) {
    function fallback() { img.parentNode.innerHTML = EQUIP_PLACEHOLDER; }
    if (img.complete && img.naturalWidth === 0) fallback();
    else img.addEventListener('error', fallback);
  });

  document.getElementById('equip-back').addEventListener('click', function() {
    showView('infos');
  });
}
