'use strict';

function renderContact(container, inscription, showView) {
  container.innerHTML = ''
    + '<button class="usager-back" id="contact-back">← Accueil</button>'
    + '<div class="usager-card">'
    +   '<div class="usager-card-title">Contact</div>'
    +   '<div class="usager-contact-row"><span class="usager-contact-icon">📞</span>'
    +     '<a href="tel:+33492913906" class="usager-contact-link">+33 4 92 91 39 06</a></div>'
    +   '<div class="usager-contact-row"><span class="usager-contact-icon">✉️</span>'
    +     '<a href="mailto:handiplageresa@gmail.com" class="usager-contact-link">handiplageresa@gmail.com</a></div>'
    +   '<div class="usager-contact-row"><span class="usager-contact-icon">📍</span>'
    +     '<span>Boulevard James Wyllie, Antibes</span></div>'
    + '</div>'
    + '<div class="usager-card">'
    +   '<div class="usager-card-title">Plan</div>'
    +   '<div class="usager-map-wrap">'
    +     '<iframe class="usager-map-iframe" src="https://maps.google.com/maps?q=Boulevard+James+Wyllie+Antibes&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>'
    +   '</div>'
    +   '<a class="usager-btn usager-btn-primary" style="display:block;text-align:center;margin-top:12px;text-decoration:none;padding:12px" '
    +      'href="https://www.google.com/maps/dir/?api=1&destination=Boulevard+James+Wyllie+Antibes" target="_blank" rel="noopener">'
    +     '🗺️ Obtenir l\'itinéraire'
    +   '</a>'
    + '</div>';

  document.getElementById('contact-back').addEventListener('click', function() {
    showView('accueil');
  });
}
