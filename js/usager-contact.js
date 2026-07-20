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
    +   '<div class="usager-card-title">Envoyer un message</div>'
    +   '<label class="usager-contact-label" for="contact-sujet">Sujet</label>'
    +   '<select id="contact-sujet" class="usager-contact-select">'
    +     '<option value="Question générale">Question générale</option>'
    +     '<option value="Problème avec ma réservation">Problème avec ma réservation</option>'
    +     '<option value="Accessibilité / matériel">Accessibilité / matériel</option>'
    +     '<option value="Autre">Autre</option>'
    +   '</select>'
    +   '<div class="usager-contact-form">'
    +     '<textarea id="contact-msg" class="usager-contact-textarea" rows="4" placeholder="Votre message…"></textarea>'
    +     '<div class="usager-contact-actions">'
    +       '<button class="usager-btn usager-btn-primary" id="btn-contact-send">Envoyer</button>'
    +     '</div>'
    +     '<div id="contact-status" style="font-size:.8125rem;margin-top:6px"></div>'
    +   '</div>'
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

  document.getElementById('btn-contact-send').addEventListener('click', async function() {
    var btn    = document.getElementById('btn-contact-send');
    var status = document.getElementById('contact-status');
    var sujet  = document.getElementById('contact-sujet').value;
    var text   = document.getElementById('contact-msg').value.trim();
    if (!text) {
      status.style.color = 'var(--red)';
      status.textContent = 'Veuillez saisir un message.';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Envoi…';
    status.textContent = '';
    try {
      await sendUsagerMessage(inscription.id, sujet, text);
      document.getElementById('contact-msg').value = '';
      status.style.color = 'var(--green)';
      status.textContent = '✓ Message envoyé. Nous vous répondrons par email.';
    } catch (e) {
      status.style.color = 'var(--red)';
      status.textContent = 'Erreur : ' + (e.message || 'Impossible d\'envoyer le message.');
    }
    btn.disabled = false;
    btn.textContent = 'Envoyer';
  });
}
