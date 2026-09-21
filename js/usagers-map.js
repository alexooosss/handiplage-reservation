// js/usagers-map.js
'use strict';

// Sous-vue "Carte des usagers" de l'onglet Stats : globe 3D avec un point par
// usager inscrit, positionné à partir de sa ville/code postal (jamais l'adresse
// précise). Se recharge depuis Supabase à chaque ouverture de l'onglet.
var UsagersMap = (function () {
  var _globe = null;

  function _esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _s(n) { return n > 1 ? 's' : ''; }

  // Âge en années révolues à partir de {jour, mois, annee} (metadata inscription)
  function _computeAge(dob) {
    if (!dob || !dob.annee) return null;
    var today = new Date();
    var monthIdx = (dob.mois || 1) - 1;
    var age = today.getFullYear() - dob.annee;
    var birthdayPassed = today.getMonth() > monthIdx || (today.getMonth() === monthIdx && today.getDate() >= (dob.jour || 1));
    if (!birthdayPassed) age--;
    return (age >= 0 && age < 130) ? age : null;
  }

  function _popupHtml(insc) {
    var age  = _computeAge(insc.dateNaissance);
    var name = ((insc.prenom || '') + ' ' + (insc.nom || '')).trim() || 'Usager';
    var rows = [];
    if (age !== null)   rows.push(['Âge', age + ' ans']);
    if (insc.ville)      rows.push(['Ville', _esc(insc.ville)]);
    if (insc.telephone)  rows.push(['Téléphone', _esc(insc.telephone)]);

    var canLink = typeof App !== 'undefined' && typeof App.navigateToInscription === 'function';

    return '<button type="button" class="usagers-popup-close" aria-label="Fermer">&times;</button>'
      + '<div class="usagers-popup-name">' + _esc(name) + '</div>'
      + rows.map(function(r) {
          return '<div class="usagers-popup-row"><span>' + r[0] + '</span><strong>' + r[1] + '</strong></div>';
        }).join('')
      + (canLink
          ? '<button type="button" class="usagers-popup-link" data-id="' + _esc(insc.id) + '">Voir la fiche →</button>'
          : '');
  }

  function destroy() {
    if (_globe) {
      try { _globe.destroy(); } catch (e) {}
      _globe = null;
    }
  }

  async function render(container) {
    destroy();
    container.innerHTML = ''
      + '<div class="stats-card usagers-map-card">'
      +   '<div class="stats-card-title">Localisation des usagers</div>'
      +   '<p class="usagers-map-hint">Position approximative (ville / code postal), pas l\'adresse précise. Glisser pour tourner, molette pour zoomer, cliquer un point pour la fiche usager.</p>'
      +   '<div id="usagers-map-status" class="usagers-map-status">Chargement…</div>'
      +   '<div id="usagers-globe" class="usagers-globe-wrap"></div>'
      + '</div>';

    var statusEl = container.querySelector('#usagers-map-status');
    var globeEl  = container.querySelector('#usagers-globe');

    try {
      var inscriptions = await getInscriptions();
      var valid    = inscriptions.filter(function(i) { return i.statut === 'valide'; });
      var withAddr = valid.filter(function(i) { return i.codePostal || i.ville; });

      if (!withAddr.length) {
        statusEl.textContent = 'Aucune adresse enregistrée pour le moment.';
        return;
      }

      var geocoded = await geocodeInscriptions(withAddr);
      var missing  = withAddr.length - geocoded.length;

      var markers = geocoded.map(function(insc) {
        var j = jitterOffset(insc.id);
        return {
          lat:   insc.geoLat + j.dLat,
          lng:   insc.geoLng + j.dLng,
          label: ((insc.prenom || '') + ' ' + (insc.nom || '')).trim() || 'Usager',
          insc:  insc,
        };
      });

      statusEl.textContent = markers.length + ' usager' + _s(markers.length) + ' localisé' + _s(markers.length)
        + (missing > 0 ? ' — ' + missing + ' adresse' + _s(missing) + ' non reconnue' + _s(missing) : '');

      if (!window.HandiplageGlobe) {
        // Le module ES (js/globe.js) charge en parallèle — on retente sous peu.
        setTimeout(function() { if (container.isConnected) render(container); }, 500);
        return;
      }

      var tooltip = document.createElement('div');
      tooltip.className = 'usagers-globe-tooltip';
      globeEl.appendChild(tooltip);

      var popup = document.createElement('div');
      popup.className = 'usagers-globe-popup';
      globeEl.appendChild(popup);

      function showPopup(insc, x, y) {
        tooltip.classList.remove('visible');
        popup.innerHTML = _popupHtml(insc);
        var rect = globeEl.getBoundingClientRect();
        var left = x - rect.left + 16;
        var top  = y - rect.top + 16;
        // Évite de déborder hors du cadre du globe
        left = Math.min(left, rect.width - 220);
        top  = Math.min(top, rect.height - 160);
        popup.style.left = Math.max(8, left) + 'px';
        popup.style.top  = Math.max(8, top) + 'px';
        popup.classList.add('visible');

        popup.querySelector('.usagers-popup-close').addEventListener('click', function() {
          popup.classList.remove('visible');
        });
        var linkBtn = popup.querySelector('.usagers-popup-link');
        if (linkBtn) {
          linkBtn.addEventListener('click', function() {
            App.navigateToInscription(linkBtn.dataset.id);
          });
        }
      }

      _globe = window.HandiplageGlobe.create(globeEl, {
        speed: 1.1,
        smoothing: 7,
        scale: 7,
        dots: { color: '#00b090', size: 3.5, density: 7, allDots: false },
        markerConfig: { markers: markers, color: '#f0c93a', size: 55 },
        oceanColor: '#f8fafc',
        outlineColor: 'rgba(10,22,40,0.25)',
        graticuleColor: 'rgba(10,22,40,0.06)',
        initialLatitude: 20,
        initialLongitude: -10,
        onMarkerHover: function(marker, x, y) {
          if (!marker) { tooltip.classList.remove('visible'); return; }
          tooltip.textContent = marker.label;
          var rect = globeEl.getBoundingClientRect();
          tooltip.style.left = (x - rect.left + 14) + 'px';
          tooltip.style.top  = (y - rect.top + 14) + 'px';
          tooltip.classList.add('visible');
        },
        onMarkerClick: function(marker, x, y) {
          if (marker && marker.insc) showPopup(marker.insc, x, y);
        },
        onError: function() {
          statusEl.textContent = 'Le globe 3D n\'a pas pu être chargé (connexion indisponible ?).';
        },
      });
    } catch (e) {
      statusEl.textContent = 'Erreur : ' + _esc(e.message || String(e));
    }
  }

  return { render: render, destroy: destroy };
})();
