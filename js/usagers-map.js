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

  function _uniqueSorted(values) {
    var seen = {};
    var out = [];
    values.forEach(function(v) {
      if (!v || seen[v]) return;
      seen[v] = true;
      out.push(v);
    });
    out.sort(function(a, b) { return a.localeCompare(b, 'fr'); });
    return out;
  }

  // Sépare les usagers validés en géolocalisés (point possible sur le globe)
  // et non localisés (pas d'adresse, échec de géocodage, ou continent non résolu).
  function splitLocalisables(valid) {
    var localized = [];
    var unlocalized = [];
    valid.forEach(function(i) {
      if (typeof i.geoLat === 'number' && typeof i.geoLng === 'number' && i.continent) {
        localized.push(i);
      } else {
        unlocalized.push(i);
      }
    });
    return { localized: localized, unlocalized: unlocalized };
  }

  // Options disponibles pour chaque niveau de filtre, calculées à partir des
  // sélections des niveaux parents uniquement (continent → pays → région → ville).
  function getFilterOptions(localized, filters) {
    filters = filters || {};
    var afterContinent = filters.continent
      ? localized.filter(function(i) { return i.continent === filters.continent; })
      : localized;
    var afterPays = filters.pays
      ? afterContinent.filter(function(i) { return i.pays === filters.pays; })
      : afterContinent;
    var afterRegion = filters.region
      ? afterPays.filter(function(i) { return i.region === filters.region; })
      : afterPays;

    return {
      continents: _uniqueSorted(localized.map(function(i) { return i.continent; })),
      pays:       _uniqueSorted(afterContinent.map(function(i) { return i.pays; })),
      regions:    _uniqueSorted(afterPays.map(function(i) { return i.region; })),
      villes:     _uniqueSorted(afterRegion.map(function(i) { return i.ville; })),
    };
  }

  // Sous-ensemble des usagers géolocalisés correspondant à tous les filtres actifs.
  function filterInscriptions(localized, filters) {
    filters = filters || {};
    return localized.filter(function(i) {
      if (filters.continent && i.continent !== filters.continent) return false;
      if (filters.pays      && i.pays      !== filters.pays)      return false;
      if (filters.region    && i.region    !== filters.region)    return false;
      if (filters.ville     && i.ville     !== filters.ville)     return false;
      return true;
    });
  }

  var _filters     = { continent: '', pays: '', region: '', ville: '' };
  var _localized    = [];
  var _unlocalized  = [];
  var _markersById  = {};

  function _buildMarkers(list) {
    var map = {};
    var markers = list.map(function(insc) {
      var j = jitterOffset(insc.id);
      var marker = {
        lat:   insc.geoLat + j.dLat,
        lng:   insc.geoLng + j.dLng,
        label: ((insc.prenom || '') + ' ' + (insc.nom || '')).trim() || 'Usager',
        insc:  insc,
      };
      map[insc.id] = marker;
      return marker;
    });
    return { markers: markers, map: map };
  }

  function _selectHtml(id, label, values, selected) {
    return '<label class="usagers-filter-label" for="' + id + '">' + label + '</label>'
      + '<select class="usagers-filter-select" id="' + id + '">'
      +   '<option value="">Tous</option>'
      +   values.map(function(v) {
            return '<option value="' + _esc(v) + '"' + (v === selected ? ' selected' : '') + '>' + _esc(v) + '</option>';
          }).join('')
      + '</select>';
  }

  function _renderPanelHtml(options, filters) {
    return '<div class="usagers-filter-selects">'
      +   _selectHtml('usagers-filter-continent', 'Continent', options.continents, filters.continent)
      +   _selectHtml('usagers-filter-pays',      'Pays',      options.pays,       filters.pays)
      +   _selectHtml('usagers-filter-region',    'Région',    options.regions,    filters.region)
      +   _selectHtml('usagers-filter-ville',     'Ville',     options.villes,     filters.ville)
      + '</div>'
      + '<div class="usagers-filter-list" id="usagers-filter-list"></div>';
  }

  function _rowHtml(insc, localized) {
    var name = ((insc.prenom || '') + ' ' + (insc.nom || '')).trim() || 'Usager';
    var sub  = localized ? (insc.ville || '') : '';
    return '<div class="usagers-filter-row" data-id="' + _esc(insc.id) + '" data-localized="' + (localized ? '1' : '0') + '">'
      + '🧍 ' + _esc(name) + (sub ? ' — ' + _esc(sub) : '')
      + '</div>';
  }

  function _renderListHtml(filtered, unlocalized) {
    var html = filtered.length
      ? filtered.map(function(i) { return _rowHtml(i, true); }).join('')
      : '<div class="usagers-filter-empty">Aucun usager pour ce filtre.</div>';
    if (unlocalized.length) {
      html += '<div class="usagers-filter-group-label">Non localisés</div>'
        + unlocalized.map(function(i) { return _rowHtml(i, false); }).join('');
    }
    return html;
  }

  function _bindPanelList(listEl) {
    listEl.querySelectorAll('.usagers-filter-row').forEach(function(rowEl) {
      rowEl.addEventListener('click', function() {
        var id = rowEl.dataset.id;
        if (rowEl.dataset.localized === '1') {
          var marker = _markersById[id];
          if (marker && _globe && typeof _globe.focusOnMarker === 'function') _globe.focusOnMarker(marker);
        } else if (typeof App !== 'undefined' && typeof App.navigateToInscription === 'function') {
          App.navigateToInscription(id);
        }
      });
    });
  }

  function _bindPanelSelects(panelEl) {
    var levels = [
      ['usagers-filter-continent', 'continent'],
      ['usagers-filter-pays',      'pays'],
      ['usagers-filter-region',    'region'],
      ['usagers-filter-ville',     'ville'],
    ];
    levels.forEach(function(pair, idx) {
      var selectEl = panelEl.querySelector('#' + pair[0]);
      if (!selectEl) return;
      selectEl.addEventListener('change', function() {
        _filters[pair[1]] = selectEl.value;
        for (var j = idx + 1; j < levels.length; j++) {
          _filters[levels[j][1]] = '';
        }
        _applyFilters(panelEl);
      });
    });
  }

  function _applyFilters(panelEl) {
    var filtered = filterInscriptions(_localized, _filters);
    var built = _buildMarkers(filtered);
    _markersById = built.map;

    if (_globe) _globe.setMarkers(built.markers);

    var options = getFilterOptions(_localized, _filters);
    panelEl.innerHTML = _renderPanelHtml(options, _filters);
    _bindPanelSelects(panelEl);

    var listEl = panelEl.querySelector('#usagers-filter-list');
    listEl.innerHTML = _renderListHtml(filtered, _unlocalized);
    _bindPanelList(listEl);
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
      +   '<p class="usagers-map-hint" id="usagers-map-hint">Position approximative (ville / code postal), pas l\'adresse précise. Glisser pour tourner, molette pour zoomer, cliquer un point (ou une ligne de la liste) pour la fiche usager.</p>'
      +   '<div id="usagers-map-status" class="usagers-map-status">Chargement…</div>'
      +   '<div class="usagers-map-layout">'
      +     '<div id="usagers-globe" class="usagers-globe-wrap"></div>'
      +     '<div class="usagers-filter-panel" id="usagers-filter-panel"></div>'
      +   '</div>'
      + '</div>';

    var statusEl = container.querySelector('#usagers-map-status');
    var globeEl  = container.querySelector('#usagers-globe');
    var panelEl  = container.querySelector('#usagers-filter-panel');
    var hintEl   = container.querySelector('#usagers-map-hint');

    _filters = { continent: '', pays: '', region: '', ville: '' };

    try {
      var inscriptions = await getInscriptions();
      var valid    = inscriptions.filter(function(i) { return i.statut === 'valide'; });
      var withAddr = valid.filter(function(i) { return i.codePostal || i.ville; });

      if (!valid.length) {
        statusEl.textContent = 'Aucun usager validé pour le moment.';
        return;
      }

      var geocoded = await geocodeInscriptions(withAddr);
      var hasForeign = geocoded.some(function(i) { return i.countryCode && i.countryCode !== 'FR'; });
      if (hasForeign) {
        hintEl.textContent += ' Données pays hors France : © OpenStreetMap contributors.';
      }

      var split = splitLocalisables(valid);
      _localized   = split.localized;
      _unlocalized = split.unlocalized;

      if (!_localized.length) {
        statusEl.textContent = 'Aucun usager localisé pour le moment.';
        panelEl.innerHTML = _renderPanelHtml({ continents: [], pays: [], regions: [], villes: [] }, _filters);
        panelEl.querySelector('#usagers-filter-list').innerHTML = _renderListHtml([], _unlocalized);
        _bindPanelList(panelEl.querySelector('#usagers-filter-list'));
        return;
      }

      var missing = withAddr.length - geocoded.length;
      statusEl.textContent = _localized.length + ' usager' + _s(_localized.length) + ' localisé' + _s(_localized.length)
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

      var initial = _buildMarkers(_localized);
      _markersById = initial.map;

      _globe = window.HandiplageGlobe.create(globeEl, {
        speed: 1.1,
        smoothing: 7,
        scale: 7,
        dots: { color: '#00b090', size: 3.5, density: 7, allDots: false },
        markerConfig: { markers: initial.markers, color: '#f0c93a', size: 55 },
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

      _applyFilters(panelEl);
    } catch (e) {
      statusEl.textContent = 'Erreur : ' + _esc(e.message || String(e));
    }
  }

  if (typeof module !== 'undefined') {
    module.exports = {
      splitLocalisables: splitLocalisables,
      getFilterOptions: getFilterOptions,
      filterInscriptions: filterInscriptions,
    };
  }

  return { render: render, destroy: destroy };
})();
