'use strict';

var _gpSelectedId = null;
var _gpMode       = 'view'; // 'view' | 'edit' | 'new'
var _gpSearch     = '';
var _gpContainer  = null;

function renderGroupes(container, selectedId) {
  _gpContainer = container;
  _gpSelectedId = selectedId || null;
  _gpMode       = 'view';
  _gpSearch     = '';

  container.innerHTML = `
    <div class="groupes-wrap">
      <div class="groupes-sidebar">
        <div class="groupes-sidebar-top">
          <h2 class="gp-sidebar-title">Groupes inscrits</h2>
          <input type="text" id="gp-search" class="gp-search-input" placeholder="Rechercher…">
          <button id="gp-new-btn" class="btn-primary gp-new-btn">＋ Nouveau groupe</button>
        </div>
        <div id="gp-list" class="gp-list"></div>
      </div>
      <div id="gp-detail" class="groupes-detail">
        <div class="groupes-empty-state">
                    <p>Sélectionnez un groupe ou créez-en un nouveau</p>
        </div>
      </div>
    </div>
  `;

  _gpRenderList();

  if (_gpSelectedId) {
    var preselected = getCachedGroupes().find(function(x) { return x.id === _gpSelectedId; });
    if (preselected) {
      _gpRenderDetail(preselected);
      var el = document.querySelector('.gp-list-item[data-id="' + _gpSelectedId + '"]');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  document.getElementById('gp-search').addEventListener('input', function(e) {
    _gpSearch = e.target.value;
    _gpRenderList();
  });

  document.getElementById('gp-new-btn').addEventListener('click', function() {
    _gpSelectedId = null;
    _gpMode = 'new';
    _gpRenderList();
    _gpRenderDetail(null);
  });
}

function _gpRenderList() {
  var listEl = document.getElementById('gp-list');
  if (!listEl) return;
  var groupes = getCachedGroupes();
  var search  = _gpSearch.toLowerCase().trim();
  if (search) {
    groupes = groupes.filter(function(g) {
      return g.nom.toLowerCase().includes(search)
        || g.typeStructure.toLowerCase().includes(search)
        || g.commune.toLowerCase().includes(search)
        || g.referentNom.toLowerCase().includes(search);
    });
  }
  if (groupes.length === 0) {
    listEl.innerHTML = '<div class="gp-list-empty">' + (search ? 'Aucun résultat' : 'Aucun groupe inscrit') + '</div>';
    return;
  }
  listEl.innerHTML = groupes.map(function(g) {
    var active = g.id === _gpSelectedId ? ' active' : '';
    return '<div class="gp-list-item' + active + '" data-id="' + _gpEsc(g.id) + '">'
      + '<div class="gp-list-nom">' + _gpEsc(g.nom) + '</div>'
      + '<div class="gp-list-meta">' + _gpEsc(g.typeStructure) + (g.commune ? ' · ' + _gpEsc(g.commune) : '') + '</div>'
      + '</div>';
  }).join('');

  listEl.querySelectorAll('.gp-list-item').forEach(function(el) {
    el.addEventListener('click', function() {
      _gpSelectedId = el.dataset.id;
      _gpMode = 'view';
      _gpRenderList();
      var g = getCachedGroupes().find(function(x) { return x.id === _gpSelectedId; });
      _gpRenderDetail(g);
    });
  });
}

function _gpRenderDetail(groupe) {
  var detailEl = document.getElementById('gp-detail');
  if (!detailEl) return;
  if (_gpMode === 'new' || _gpMode === 'edit') {
    _gpRenderForm(detailEl, groupe);
  } else if (groupe) {
    _gpRenderView(detailEl, groupe);
  } else {
    detailEl.innerHTML = '<div class="groupes-empty-state"><div class="empty-icon">👥</div><p>Sélectionnez un groupe ou créez-en un nouveau</p></div>';
  }
}

function _gpRenderView(el, g) {
  el.innerHTML = `
    <div class="gp-detail-content">
      <div class="gp-detail-header">
        <div>
          <h2 class="gp-detail-nom">${_gpEsc(g.nom)}</h2>
          <span class="gp-type-badge">${_gpEsc(g.typeStructure)}</span>
        </div>
        <div class="gp-detail-actions">
          <button class="btn-ghost" id="gp-edit-btn">✎ Modifier</button>
          <button class="btn-danger-ghost" id="gp-delete-btn" title="Supprimer">🗑</button>
        </div>
      </div>
      <div class="gp-info-grid">
        ${g.referentNom   ? `<div class="gp-info-row"><span class="gp-info-label">Référent</span><span class="gp-info-value">${_gpEsc(g.referentNom)}</span></div>` : ''}
        ${g.referentTel   ? `<div class="gp-info-row"><span class="gp-info-label">Téléphone</span><span class="gp-info-value"><a href="tel:${_gpEsc(g.referentTel)}">${_gpEsc(g.referentTel)}</a></span></div>` : ''}
        ${g.referentEmail ? `<div class="gp-info-row"><span class="gp-info-label">E-mail</span><span class="gp-info-value"><a href="mailto:${_gpEsc(g.referentEmail)}">${_gpEsc(g.referentEmail)}</a></span></div>` : ''}
        ${g.commune       ? `<div class="gp-info-row"><span class="gp-info-label">Commune</span><span class="gp-info-value">${_gpEsc(g.commune)}</span></div>` : ''}
        ${g.notes      ? `<div class="gp-info-row"><span class="gp-info-label">Notes</span><span class="gp-info-value gp-notes">${_gpEsc(g.notes)}</span></div>` : ''}
      </div>
      <div class="gp-history-section">
        <h3 class="gp-history-title">Historique des venues</h3>
        <div id="gp-history" class="gp-history"><div class="gp-history-loading">Chargement…</div></div>
      </div>
    </div>
  `;

  document.getElementById('gp-edit-btn').addEventListener('click', function() {
    _gpMode = 'edit';
    _gpRenderForm(el, g);
  });

  document.getElementById('gp-delete-btn').addEventListener('click', async function() {
    if (!confirm('Supprimer le groupe « ' + g.nom + ' » ? Cette action est irréversible.')) return;
    try {
      await deleteGroupe(g.id);
      _gpSelectedId = null;
      _gpMode = 'view';
      _gpRenderList();
      _gpRenderDetail(null);
    } catch (e) {
      alert('Erreur : ' + (e.message || 'inconnue'));
    }
  });

  _gpLoadHistory(g);
}

async function _gpLoadHistory(g) {
  var histEl = document.getElementById('gp-history');
  if (!histEl) return;
  try {
    var rows = await getReservationsForGroupe(g.id, g.nom);
    if (rows.length === 0) {
      histEl.innerHTML = '<div class="gp-history-empty">Aucune venue enregistrée</div>';
      return;
    }
    // Dédupliquer par date+créneau (compter les emplacements)
    var grouped = {};
    rows.forEach(function(row) {
      var key = row.date + '_' + row.creneau_id;
      if (!grouped[key]) {
        grouped[key] = { date: row.date, creneauId: row.creneau_id, spots: 0, statut: row.statut, nbUsagers: row.nb_usagers };
      }
      if (row.spot_id) grouped[key].spots++;
    });
    var entries = Object.values(grouped).sort(function(a, b) { return b.date.localeCompare(a.date); });
    histEl.innerHTML = entries.map(function(e) {
      var slot = typeof SLOTS !== 'undefined' ? SLOTS.find(function(s) { return s.id == e.creneauId; }) : null;
      var slotLabel = slot ? slot.label : e.creneauId;
      var d = new Date(e.date + 'T00:00:00');
      var dateStr = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
      var emplLabel = e.spots > 0 ? e.spots + ' empl.' : (e.nbUsagers ? e.nbUsagers + ' empl.' : '—');
      var statutIcon = { parti: '✓', absent: '✕', present: '✓', attente: '⏳' }[e.statut] || '·';
      var statutColor = { parti: 'var(--green)', absent: 'var(--red)', present: 'var(--green)', attente: 'var(--amber)' }[e.statut] || '';
      return '<div class="gp-history-row">'
        + '<span class="gp-hist-date">' + dateStr + '</span>'
        + '<span class="gp-hist-slot">' + _gpEsc(slotLabel) + '</span>'
        + '<span class="gp-hist-empl">' + emplLabel + '</span>'
        + '<span class="gp-hist-statut" style="color:' + statutColor + '">' + statutIcon + '</span>'
        + '</div>';
    }).join('');
  } catch (e) {
    if (histEl) histEl.innerHTML = '<div class="gp-history-empty">Erreur de chargement</div>';
  }
}

function _gpRenderForm(el, g) {
  var isNew = !g;
  var types = ['FAM', 'EHPAD', 'ESAT', 'Association', 'École', 'Autre'];
  el.innerHTML = `
    <div class="gp-detail-content">
      <h2 class="gp-form-title">${isNew ? 'Nouveau groupe' : 'Modifier · ' + _gpEsc(g.nom)}</h2>
      <div class="gp-form">
        <div class="gf-row">
          <div class="gf-group" style="flex:2">
            <label>Nom du groupe <span class="req">*</span></label>
            <input type="text" id="gf-nom" value="${g ? _gpEsc(g.nom) : ''}" placeholder="Ex: FAM Les Hauts d'Antibes">
          </div>
          <div class="gf-group">
            <label>Type de structure <span class="req">*</span></label>
            <select id="gf-type">
              ${types.map(function(t) {
                return '<option value="' + t + '"' + (g && g.typeStructure === t ? ' selected' : (!g && t === 'Autre' ? ' selected' : '')) + '>' + t + '</option>';
              }).join('')}
            </select>
          </div>
        </div>
        <div class="gf-row">
          <div class="gf-group">
            <label>Référent (nom)</label>
            <input type="text" id="gf-referent-nom" value="${g ? _gpEsc(g.referentNom) : ''}">
          </div>
          <div class="gf-group">
            <label>Référent (téléphone)</label>
            <input type="tel" id="gf-referent-tel" value="${g ? _gpEsc(g.referentTel) : ''}">
          </div>
          <div class="gf-group">
            <label>Référent (e-mail)</label>
            <input type="email" id="gf-referent-email" value="${g ? _gpEsc(g.referentEmail) : ''}">
          </div>
        </div>
        <div class="gf-row">
          <div class="gf-group">
            <label>Commune</label>
            <input type="text" id="gf-commune" value="${g ? _gpEsc(g.commune) : ''}">
          </div>
        </div>
        <div class="gf-row">
          <div class="gf-group" style="flex:1">
            <label>Notes</label>
            <textarea id="gf-notes" rows="3" placeholder="Besoins spécifiques, créneaux préférentiels…">${g ? _gpEsc(g.notes) : ''}</textarea>
          </div>
        </div>
        <div id="gf-error" class="gf-error"></div>
        <div class="gf-actions">
          <button id="gf-cancel" class="btn-secondary">Annuler</button>
          <button id="gf-save" class="btn-primary">Enregistrer</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('gf-cancel').addEventListener('click', function() {
    if (isNew) {
      _gpSelectedId = null;
      _gpMode = 'view';
      _gpRenderDetail(null);
    } else {
      _gpMode = 'view';
      _gpRenderDetail(g);
    }
  });

  document.getElementById('gf-save').addEventListener('click', async function() {
    var nom  = document.getElementById('gf-nom').value.trim();
    var errEl = document.getElementById('gf-error');
    if (!nom) { errEl.textContent = 'Le nom du groupe est obligatoire.'; return; }

    var data = {
      nom:          nom,
      typeStructure: document.getElementById('gf-type').value,
      referentNom:   document.getElementById('gf-referent-nom').value.trim(),
      referentTel:   document.getElementById('gf-referent-tel').value.trim(),
      referentEmail: document.getElementById('gf-referent-email').value.trim(),
      commune:       document.getElementById('gf-commune').value.trim(),
      notes:        document.getElementById('gf-notes').value.trim(),
    };

    try {
      var saved;
      if (isNew) {
        saved = await createGroupe(data);
        _gpSelectedId = saved.id;
      } else {
        saved = await updateGroupe(g.id, data);
      }
      _gpMode = 'view';
      _gpRenderList();
      _gpRenderDetail(saved);
    } catch (e) {
      errEl.textContent = 'Erreur : ' + (e.message || 'inconnue');
    }
  });
}

function _gpEsc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

if (typeof module !== 'undefined') {
  module.exports = { renderGroupes };
}
