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
      +   '<p class="usagers-map-hint">Position approximative (ville / code postal), pas l\'adresse précise. Glisser pour tourner le globe.</p>'
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

      _globe = window.HandiplageGlobe.create(globeEl, {
        speed: 1.1,
        smoothing: 7,
        scale: 9,
        dots: { color: '#cfe0f2', size: 3.5, density: 7, allDots: false },
        markerConfig: { markers: markers, color: '#f0c93a', size: 55 },
        oceanColor: '#0a1628',
        outlineColor: 'rgba(255,255,255,0.28)',
        graticuleColor: 'rgba(255,255,255,0.07)',
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
