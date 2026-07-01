'use strict';

const INSC_KEY = 'handiplage_inscriptions';

function getInscriptions() {
  const raw = localStorage.getItem(INSC_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function saveInscriptions(list) {
  localStorage.setItem(INSC_KEY, JSON.stringify(list));
}

function _genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function _escI(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Vue principale ──
function renderInscription(container) {
  const inscriptions = getInscriptions();

  container.innerHTML = '<div class="insc-layout">'
    + '<div class="insc-sidebar">'
    +   '<div class="insc-sidebar-hd">'
    +     '<input type="search" id="insc-search" class="insc-search-inp" placeholder="Rechercher…">'
    +     '<button class="btn-primary" id="insc-new-btn">＋ Nouvelle inscription</button>'
    +   '</div>'
    +   '<div id="insc-list" class="insc-list">' + _renderListItems(inscriptions, '') + '</div>'
    + '</div>'
    + '<div class="insc-main" id="insc-main">'
    +   '<div class="insc-empty">'
    +     '<div class="insc-empty-icon">📋</div>'
    +     '<p>Sélectionnez une inscription ou créez-en une nouvelle.</p>'
    +     '<p class="insc-count">' + inscriptions.length + ' inscription' + (inscriptions.length !== 1 ? 's' : '') + ' enregistrée' + (inscriptions.length !== 1 ? 's' : '') + '</p>'
    +   '</div>'
    + '</div>'
    + '</div>';

  document.getElementById('insc-search').addEventListener('input', function() {
    const q = this.value.toLowerCase();
    document.getElementById('insc-list').innerHTML = _renderListItems(getInscriptions(), q);
    _bindListItems(container);
  });

  document.getElementById('insc-new-btn').addEventListener('click', function() {
    _showForm(container, null);
  });

  _bindListItems(container);
}

function _renderListItems(list, query) {
  const filtered = list
    .filter(i => (i.nom + ' ' + i.prenom).toLowerCase().includes(query))
    .sort((a, b) => a.nom.localeCompare(b.nom));

  if (filtered.length === 0) {
    return '<div class="insc-list-empty">Aucune inscription trouvée</div>';
  }

  return filtered.map(function(i) {
    const dob = i.dateNaissance
      ? String(i.dateNaissance.jour).padStart(2,'0') + '/' + String(i.dateNaissance.mois).padStart(2,'0') + '/' + i.dateNaissance.annee
      : '';
    const sCls = i.statut === 'valide' ? 'insc-status-ok' : i.statut === 'refuse' ? 'insc-status-ko' : 'insc-status-wait';
    const sLbl = i.statut === 'valide' ? 'Validé' : i.statut === 'refuse' ? 'Refusé' : 'En attente';
    return '<div class="insc-list-item" data-id="' + i.id + '">'
      + '<div class="insc-list-name">' + _escI(i.nom) + ' ' + _escI(i.prenom) + '</div>'
      + (dob ? '<div class="insc-list-meta">Né·e le ' + dob + '</div>' : '')
      + '<span class="insc-status ' + sCls + '">' + sLbl + '</span>'
      + '</div>';
  }).join('');
}

function _bindListItems(container) {
  container.querySelectorAll('.insc-list-item').forEach(function(el) {
    el.addEventListener('click', function() {
      container.querySelectorAll('.insc-list-item').forEach(function(e) { e.classList.remove('active'); });
      el.classList.add('active');
      const insc = getInscriptions().find(function(i) { return i.id === el.dataset.id; });
      if (insc) _showForm(container, insc);
    });
  });
}

// ── Formulaire ──
function _showForm(container, insc) {
  const isNew = !insc;
  const v     = insc || {};
  const dob   = v.dateNaissance || {};
  const aides = v.aidesTechniques || [];
  const mainEl = document.getElementById('insc-main');
  if (!mainEl) return;

  const currentYear = new Date().getFullYear();
  let yearOpts  = '<option value="">Année</option>';
  for (let y = currentYear - 5; y >= 1920; y--) yearOpts += '<option value="' + y + '"' + (dob.annee == y ? ' selected' : '') + '>' + y + '</option>';
  let monthOpts = '<option value="">Mois</option>';
  for (let m = 1; m <= 12; m++) monthOpts += '<option value="' + m + '"' + (dob.mois == m ? ' selected' : '') + '>' + String(m).padStart(2,'0') + '</option>';
  let dayOpts   = '<option value="">Jour</option>';
  for (let d = 1; d <= 31; d++) dayOpts += '<option value="' + d + '"' + (dob.jour == d ? ' selected' : '') + '>' + String(d).padStart(2,'0') + '</option>';

  const chk  = function(val, opt) { return val === opt ? ' checked' : ''; };
  const chkA = function(opt) { return aides.includes(opt) ? ' checked' : ''; };
  const chkB = function(b) { return b ? ' checked' : ''; };
  const noneAide   = aides.length === 0 || aides.includes('aucun');
  const contactPref = Array.isArray(v.contactPreference) ? v.contactPreference : (v.contactPreference ? [v.contactPreference] : []);
  const accompPref  = Array.isArray(v.accompagnement)    ? v.accompagnement    : (v.accompagnement    ? [v.accompagnement]    : ['aucun']);

  mainEl.innerHTML = '<div class="insc-form-wrap">'
    + '<div class="insc-form-header">'
    +   '<h2>' + (isNew ? 'Nouvelle inscription' : 'Inscription — ' + _escI(v.nom) + ' ' + _escI(v.prenom)) + '</h2>'
    +   (!isNew ? '<div class="insc-form-status-sel"><label>Statut :</label><select id="insc-statut"><option value="en_attente"' + ((!v.statut || v.statut === 'en_attente') ? ' selected' : '') + '>En attente</option><option value="valide"' + chk(v.statut,'valide') + '>Validé ✓</option><option value="refuse"' + chk(v.statut,'refuse') + '>Refusé ✗</option></select></div>' : '')
    + '</div>'
    + (!isNew && v.statut === 'valide' ? _renderPassBlock(v) : '')
    + '<form id="insc-form" class="insc-form">'

    // IDENTITÉ
    + '<div class="insc-section">'
    +   '<div class="insc-section-title">Identité</div>'
    +   '<div class="insc-row">'
    +     '<div class="insc-field"><label>Nom <span class="req">*</span></label><input type="text" id="f-nom" value="' + _escI(v.nom) + '" placeholder="NOM" style="text-transform:uppercase"></div>'
    +     '<div class="insc-field"><label>Prénom <span class="req">*</span></label><input type="text" id="f-prenom" value="' + _escI(v.prenom) + '" placeholder="Prénom"></div>'
    +   '</div>'
    +   '<div class="insc-row">'
    +     '<div class="insc-field"><label>Date de naissance <span class="req">*</span></label><div class="insc-dob"><select id="f-dob-j">' + dayOpts + '</select><span>/</span><select id="f-dob-m">' + monthOpts + '</select><span>/</span><select id="f-dob-y">' + yearOpts + '</select></div></div>'
    +     '<div class="insc-field"><label>Téléphone <span class="req">*</span></label><input type="text" id="f-tel" value="' + _escI(v.telephone) + '" placeholder="Ex : 06 00 00 00 00, +39 …"></div>'
    +   '</div>'
    +   '<div class="insc-row">'
    +     '<div class="insc-field"><label>Adresse mail <span class="req">*</span></label><input type="email" id="f-mail" value="' + _escI(v.mail) + '" placeholder="adresse@mail.fr"></div>'
    +     '<div class="insc-field"><label>Confirmation du mail <span class="req">*</span></label><input type="email" id="f-mail2" value="' + _escI(v.mailConfirm) + '" placeholder="adresse@mail.fr"></div>'
    +   '</div>'
    +   '<div class="insc-field"><label>Modalité de contact préférée <span class="req">*</span></label>'
    +     '<div class="insc-check-group">'
    +       '<label class="insc-check"><input type="checkbox" name="contact" value="telephone"' + (contactPref.includes('telephone') ? ' checked' : '') + '> Téléphone</label>'
    +       '<label class="insc-check"><input type="checkbox" name="contact" value="mail"' + (contactPref.includes('mail') ? ' checked' : '') + '> Mail</label>'
    +     '</div></div>'
    + '</div>'

    // ADRESSE
    + '<div class="insc-section">'
    +   '<div class="insc-section-title">Adresse</div>'
    +   '<div class="insc-field"><label>Adresse <span class="req">*</span></label><input type="text" id="f-adresse" value="' + _escI(v.adresse) + '" placeholder="N° et nom de la voie"></div>'
    +   '<div class="insc-row">'
    +     '<div class="insc-field insc-field-sm"><label>Code postal <span class="req">*</span></label><input type="text" id="f-cp" value="' + _escI(v.codePostal) + '" placeholder="06600"></div>'
    +     '<div class="insc-field"><label>Ville <span class="req">*</span></label><input type="text" id="f-ville" value="' + _escI(v.ville) + '" placeholder="Antibes"></div>'
    +     '<div class="insc-field insc-field-sm"><label>Pays <span class="req">*</span></label><input type="text" id="f-pays" value="' + _escI(v.pays || 'France') + '" placeholder="France"></div>'
    +   '</div>'
    + '</div>'

    // URGENCE
    + '<div class="insc-section">'
    +   '<div class="insc-section-title">Contact d\'urgence</div>'
    +   '<div class="insc-row">'
    +     '<div class="insc-field"><label>Nom et prénom <span class="req">*</span></label><input type="text" id="f-urg-nom" value="' + _escI(v.urgenceNom) + '" placeholder="Prénom NOM"></div>'
    +     '<div class="insc-field"><label>Téléphone <span class="req">*</span></label><input type="text" id="f-urg-tel" value="' + _escI(v.urgenceTel) + '" placeholder="Ex : 06 00 00 00 00, +39 …"></div>'
    +   '</div>'
    + '</div>'

    // BESOINS
    + '<div class="insc-section">'
    +   '<div class="insc-section-title">Besoins d\'accompagnement par notre équipe d\'handiplagistes <span class="req">*</span></div>'
    +   '<div class="insc-check-group">'
    +     '<label class="insc-check"><input type="checkbox" name="accomp" value="aucun" id="accomp-aucun"' + (accompPref.includes('aucun') ? ' checked' : '') + '> Aucun besoin</label>'
    +     '<label class="insc-check"><input type="checkbox" name="accomp" value="transfert"' + (accompPref.includes('transfert') ? ' checked' : '') + '> Aide au transfert</label>'
    +     '<label class="insc-check"><input type="checkbox" name="accomp" value="entree_sortie"' + (accompPref.includes('entree_sortie') ? ' checked' : '') + '> Aide à l\'entrée et à la sortie de l\'eau</label>'
    +     '<label class="insc-check"><input type="checkbox" name="accomp" value="baignade"' + (accompPref.includes('baignade') ? ' checked' : '') + '> Aide à la baignade, maximum 30 minutes</label>'
    +   '</div>'
    +   '<div class="insc-section-title" style="margin-top:18px">Besoins d\'aides techniques <span class="req">*</span></div>'
    +   '<div class="insc-check-group">'
    +     '<label class="insc-check"><input type="checkbox" name="at" value="aucun" id="at-aucun"' + (noneAide ? ' checked' : '') + '> Aucun besoin</label>'
    +     '<label class="insc-check"><input type="checkbox" name="at" value="tiralo" id="at-tiralo"' + chkA('tiralo') + '> Tiralo <span class="insc-hint">(fauteuil amphibie équipé de flotteurs)</span></label>'
    +     '<label class="insc-check"><input type="checkbox" name="at" value="hippocampe" id="at-hippocampe"' + chkA('hippocampe') + '> Hippocampe <span class="insc-hint">(fauteuil tout terrain pour aller au bord de l\'eau)</span></label>'
    +     '<label class="insc-check"><input type="checkbox" name="at" value="audioplage" id="at-audioplage"' + chkA('audioplage') + '> Audioplage <span class="insc-hint">(balisage sonore en mer pour personnes déficientes visuelles)</span></label>'
    +   '</div>'
    + '</div>'

    // ENGAGEMENTS
    + '<div class="insc-section">'
    +   '<div class="insc-section-title">Engagements</div>'
    +   '<div class="insc-engage-block">'
    +     '<div class="insc-engage-label">Port du gilet de sauvetage <span class="req">*</span></div>'
    +     '<div class="insc-radio-group insc-radio-col">'
    +       '<label class="insc-radio"><input type="radio" name="gilet" value="oui"' + ((!v.gilet || v.gilet === 'oui') ? ' checked' : '') + '> J\'accepte le port du gilet de sauvetage, obligatoire dans le cadre de ma baignade</label>'
    +       '<label class="insc-radio"><input type="radio" name="gilet" value="non"' + chk(v.gilet,'non') + '> Je n\'accepte pas, et j\'atteste dégager le CCAS d\'Antibes Juan-les-Pins de toutes responsabilités</label>'
    +     '</div>'
    +   '</div>'
    +   '<div class="insc-engage-block">'
    +     '<div class="insc-engage-label">Traitement des données personnelles <span class="req">*</span></div>'
    +     '<label class="insc-check"><input type="checkbox" id="f-rgpd"' + chkB(v.rgpd) + '> J\'atteste avoir pris connaissance de l\'information relative au traitement des données personnelles</label>'
    +   '</div>'
    +   '<div class="insc-engage-block">'
    +     '<div class="insc-engage-label">Communications du CCAS <span class="req">*</span></div>'
    +     '<div class="insc-radio-group insc-radio-col">'
    +       '<label class="insc-radio"><input type="radio" name="ccas" value="accepte"' + ((!v.ccasCommunications || v.ccasCommunications === 'accepte') ? ' checked' : '') + '> J\'accepte de recevoir par mail des informations de la part du CCAS</label>'
    +       '<label class="insc-radio"><input type="radio" name="ccas" value="refuse"' + chk(v.ccasCommunications,'refuse') + '> Je refuse de recevoir par mail des informations de la part du CCAS</label>'
    +     '</div>'
    +   '</div>'
    +   '<div class="insc-engage-block">'
    +     '<div class="insc-engage-label">Règlement de fonctionnement <span class="req">*</span></div>'
    +     '<label class="insc-check"><input type="checkbox" id="f-reglement"' + chkB(v.reglement) + '> J\'ai lu et j\'accepte le règlement de fonctionnement Handiplage 2026 sans restriction</label>'
    +   '</div>'
    + '</div>'

    // DOCUMENTS
    + '<div class="insc-section">'
    +   '<div class="insc-section-title">Documents justificatifs</div>'
    +   '<p class="insc-doc-info">Joindre le justificatif du handicap RECTO-VERSO, avec identité et date de validité lisible <span class="req">*</span><br><em>Carte Mobilité Inclusion (CMI) — les documents de l\'assurance maladie ne sont pas valables.</em></p>'
    +   '<div class="insc-field" style="margin-top:12px"><label>Document principal (recto-verso) <span class="req">*</span></label>'
    +     (v.justificatif1Name ? '<div class="insc-file-existing" id="doc1-existing">📄 ' + _escI(v.justificatif1Name) + ' <button type="button" class="insc-file-del" id="del-doc1">✕</button></div>' : '')
    +     '<input type="file" id="f-doc1" accept="image/*,.pdf" class="insc-file-input"></div>'
    +   '<div class="insc-field" style="margin-top:8px"><label>Deuxième document <span class="insc-optional">(verso si le premier n\'est pas recto-verso)</span></label>'
    +     (v.justificatif2Name ? '<div class="insc-file-existing" id="doc2-existing">📄 ' + _escI(v.justificatif2Name) + ' <button type="button" class="insc-file-del" id="del-doc2">✕</button></div>' : '')
    +     '<input type="file" id="f-doc2" accept="image/*,.pdf" class="insc-file-input"></div>'
    +   '<div class="insc-field" style="margin-top:16px"><label>Signature <span class="req">*</span> — <span class="insc-hint">La saisie de vos nom et prénom vaut signature</span></label><input type="text" id="f-signature" value="' + _escI(v.signature) + '" placeholder="Prénom NOM"></div>'
    + '</div>'

    // RGPD
    + '<div class="insc-rgpd-notice">'
    +   '<p>Les informations recueillies dans ce formulaire ne sont utilisées que par le service Autonomie et Adaptation du Cadre de Vie du CCAS d\'Antibes. Les données sont conservées pendant 2 ans à compter de la fermeture saisonnière de la Handiplage.</p>'
    +   '<ul><li>Remplir les obligations notamment statistiques du CCAS ;</li><li>Améliorer, si nécessaire, les actions proposées en vous demandant par mail de remplir le questionnaire de satisfaction.</li></ul>'
    +   '<p style="margin-top:8px">Vous disposez d\'un droit d\'accès, de rectification, d\'opposition, de limitation et de suppression de vos données en contactant le DPO du CCAS : <a href="mailto:rgpd@ccas-antibes.fr">rgpd@ccas-antibes.fr</a> — CCAS, 2 avenue de la Libération, BP 83, 06602 Antibes CEDEX.</p>'
    + '</div>'

    + '<div id="insc-form-err" class="insc-form-err"></div>'
    + '<div class="insc-form-actions">'
    +   (!isNew ? '<button type="button" class="btn-danger" id="insc-delete">🗑 Supprimer</button>' : '')
    +   '<button type="button" class="btn-ghost" id="insc-cancel">Annuler</button>'
    +   '<button type="submit" class="btn-primary insc-submit">' + (isNew ? 'VALIDER LA DEMANDE D\'INSCRIPTION' : 'ENREGISTRER LES MODIFICATIONS') + '</button>'
    + '</div>'
    + '</form>'
    + '</div>';

  // Exclusivité "aucun besoin" aides techniques
  const atAucun = document.getElementById('at-aucun');
  const atOthers = ['at-tiralo','at-hippocampe','at-audioplage'];
  if (atAucun) {
    atAucun.addEventListener('change', function() {
      if (atAucun.checked) atOthers.forEach(function(id) { const el=document.getElementById(id); if(el) el.checked=false; });
    });
    atOthers.forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', function() { if(el.checked) atAucun.checked=false; });
    });
  }

  // Exclusivité "aucun besoin" accompagnement
  const accompAucun = document.getElementById('accomp-aucun');
  if (accompAucun) {
    const accompOthers = document.querySelectorAll('input[name="accomp"]:not([value="aucun"])');
    accompAucun.addEventListener('change', function() {
      if (accompAucun.checked) accompOthers.forEach(function(el) { el.checked = false; });
    });
    accompOthers.forEach(function(el) {
      el.addEventListener('change', function() { if (el.checked) accompAucun.checked = false; });
    });
  }

  // Statut
  if (!isNew) {
    const statutEl = document.getElementById('insc-statut');
    if (statutEl) {
      statutEl.addEventListener('change', function() {
        const list = getInscriptions();
        const idx  = list.findIndex(function(i) { return i.id === v.id; });
        if (idx !== -1) {
          list[idx].statut = statutEl.value;
          saveInscriptions(list);
          _refreshSidebar(container);
          const updatedInsc = list[idx];
          const existingBlock = mainEl.querySelector('.pass-block');
          if (updatedInsc.statut !== 'valide') {
            if (existingBlock) existingBlock.remove();
          } else {
            _reRenderPassBlock(updatedInsc);
          }
        }
      });
    }
    // Supprimer
    const delBtn = document.getElementById('insc-delete');
    if (delBtn) {
      delBtn.addEventListener('click', function() {
        if (!confirm('Supprimer cette inscription définitivement ?')) return;
        saveInscriptions(getInscriptions().filter(function(i) { return i.id !== v.id; }));
        renderInscription(container);
      });
    }
    // Supprimer fichiers
    const del1 = document.getElementById('del-doc1');
    if (del1) del1.addEventListener('click', function() {
      const list = getInscriptions(); const idx = list.findIndex(function(i){return i.id===v.id;});
      if (idx!==-1){list[idx].justificatif1=null;list[idx].justificatif1Name='';saveInscriptions(list);}
      const ex = document.getElementById('doc1-existing'); if(ex) ex.remove();
    });
    const del2 = document.getElementById('del-doc2');
    if (del2) del2.addEventListener('click', function() {
      const list = getInscriptions(); const idx = list.findIndex(function(i){return i.id===v.id;});
      if (idx!==-1){list[idx].justificatif2=null;list[idx].justificatif2Name='';saveInscriptions(list);}
      const ex = document.getElementById('doc2-existing'); if(ex) ex.remove();
    });
  }

  // ── Pass ──
  function _reRenderPassBlock(updatedInsc) {
    const existing = mainEl.querySelector('.pass-block');
    const newHtml  = _renderPassBlock(updatedInsc);
    if (existing) {
      const tmp = document.createElement('div');
      tmp.innerHTML = newHtml;
      existing.replaceWith(tmp.firstElementChild || document.createElement('div'));
    } else if (newHtml) {
      const formHeader = mainEl.querySelector('.insc-form-header');
      if (formHeader) formHeader.insertAdjacentHTML('afterend', newHtml);
    }
    _bindPassButtons();
  }

  function _bindPassButtons() {
    const activateBtn   = document.getElementById('pass-activate');
    const deactivateBtn = document.getElementById('pass-deactivate');
    if (activateBtn) {
      activateBtn.addEventListener('click', function() {
        const list = getInscriptions();
        const idx  = list.findIndex(function(i) { return i.id === v.id; });
        if (idx === -1) return;
        list[idx].pass = Object.assign({}, list[idx].pass, { actif: true, activatedAt: new Date().toISOString().slice(0, 10) });
        saveInscriptions(list);
        _reRenderPassBlock(list[idx]);
        _refreshSidebar(container);
      });
    }
    if (deactivateBtn) {
      deactivateBtn.addEventListener('click', function() {
        const list = getInscriptions();
        const idx  = list.findIndex(function(i) { return i.id === v.id; });
        if (idx === -1) return;
        list[idx].pass = Object.assign({}, list[idx].pass, { actif: false });
        saveInscriptions(list);
        _reRenderPassBlock(list[idx]);
        _refreshSidebar(container);
      });
    }
  }

  if (!isNew) _bindPassButtons();

  document.getElementById('insc-cancel').addEventListener('click', function() { renderInscription(container); });
  document.getElementById('insc-form').addEventListener('submit', function(e) { e.preventDefault(); _handleSubmit(container, isNew ? null : v.id, isNew ? null : v); });
}

function _refreshSidebar(container) {
  const insc = getInscriptions();
  const searchEl = document.getElementById('insc-search');
  const q = searchEl ? searchEl.value.toLowerCase() : '';
  const listEl = document.getElementById('insc-list');
  if (listEl) listEl.innerHTML = _renderListItems(insc, q);
  _bindListItems(container);
}

function _handleSubmit(container, existingId, existingData) {
  const g  = function(id) { return document.getElementById(id); };
  const gv = function(id) { const el=g(id); return el ? el.value.trim() : ''; };
  const gr = function(name) { const el=document.querySelector('input[name="'+name+'"]:checked'); return el ? el.value : ''; };
  const ga = function(name) { return Array.from(document.querySelectorAll('input[name="'+name+'"]:checked')).map(function(el){return el.value;}); };

  const nom     = gv('f-nom').toUpperCase();
  const prenom  = gv('f-prenom');
  const dobJ    = gv('f-dob-j');
  const dobM    = gv('f-dob-m');
  const dobY    = gv('f-dob-y');
  const tel     = gv('f-tel');
  const mail    = gv('f-mail');
  const mail2   = gv('f-mail2');
  const contact = ga('contact');
  const adresse = gv('f-adresse');
  const cp      = gv('f-cp');
  const ville   = gv('f-ville');
  const pays    = gv('f-pays');
  const urgNom  = gv('f-urg-nom');
  const urgTel  = gv('f-urg-tel');
  const accomp  = ga('accomp');
  const gilet   = gr('gilet');
  const ccas    = gr('ccas');
  const rgpd    = g('f-rgpd') && g('f-rgpd').checked;
  const regl    = g('f-reglement') && g('f-reglement').checked;
  const sig     = gv('f-signature');
  const errEl   = g('insc-form-err');

  const errors = [];
  if (!nom)               errors.push('Nom requis');
  if (!prenom)            errors.push('Prénom requis');
  if (!dobJ||!dobM||!dobY) errors.push('Date de naissance complète requise');
  if (!tel)               errors.push('Téléphone requis');
  if (!mail)              errors.push('Adresse mail requise');
  if (mail !== mail2)     errors.push('Les deux adresses mail ne correspondent pas');
  if (contact.length === 0) errors.push('Modalité de contact préférée requise');
  if (!adresse)           errors.push('Adresse requise');
  if (!cp)                errors.push('Code postal requis');
  if (!ville)             errors.push('Ville requise');
  if (!pays)              errors.push('Pays requis');
  if (!urgNom)            errors.push('Nom du contact d\'urgence requis');
  if (!urgTel)            errors.push('Téléphone du contact d\'urgence requis');
  if (accomp.length === 0)  errors.push('Besoin d\'accompagnement requis');
  if (!gilet)             errors.push('Réponse sur le gilet de sauvetage requise');
  if (!rgpd)              errors.push('Veuillez attester avoir pris connaissance du traitement des données');
  if (!ccas)              errors.push('Réponse communications CCAS requise');
  if (!regl)              errors.push('Veuillez accepter le règlement de fonctionnement');
  if (!sig)               errors.push('Signature requise');

  if (errors.length > 0) {
    errEl.innerHTML = errors.map(function(e) { return '• ' + e; }).join('<br>');
    errEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  errEl.innerHTML = '';

  const atChecked = Array.from(document.querySelectorAll('input[name="at"]:checked')).map(function(el) { return el.value; });

  const inscData = {
    id:                existingId || _genId(),
    createdAt:         existingData ? existingData.createdAt : Date.now(),
    updatedAt:         Date.now(),
    statut:            existingData ? existingData.statut : 'en_attente',
    nom, prenom,
    dateNaissance:     { jour: parseInt(dobJ), mois: parseInt(dobM), annee: parseInt(dobY) },
    telephone:         tel,
    mail,
    mailConfirm:       mail2,
    contactPreference: contact,
    adresse, codePostal: cp, ville, pays,
    urgenceNom:        urgNom,
    urgenceTel:        urgTel,
    accompagnement:    accomp,
    aidesTechniques:   atChecked,
    gilet,
    rgpd,
    ccasCommunications: ccas,
    reglement:         regl,
    signature:         sig,
    justificatif1:     existingData ? existingData.justificatif1 : null,
    justificatif1Name: existingData ? existingData.justificatif1Name : '',
    justificatif2:     existingData ? existingData.justificatif2 : null,
    justificatif2Name: existingData ? existingData.justificatif2Name : '',
  };

  _readFiles(g('f-doc1'), g('f-doc2'), inscData, function(data) {
    const list = getInscriptions();
    if (existingId) {
      const idx = list.findIndex(function(i) { return i.id === existingId; });
      if (idx !== -1) list[idx] = data; else list.push(data);
    } else {
      list.push(data);
    }
    try {
      saveInscriptions(list);
    } catch (e) {
      errEl.textContent = 'Erreur de stockage : les documents joints sont trop volumineux. Réessayez sans fichiers joints.';
      return;
    }
    renderInscription(container);
  });
}

function _readFiles(input1, input2, data, callback) {
  function readOne(input, cb) {
    if (!input || !input.files || input.files.length === 0) { cb(null, ''); return; }
    const file   = input.files[0];
    const reader = new FileReader();
    reader.onload = function(e) { cb(e.target.result, file.name); };
    reader.readAsDataURL(file);
  }
  readOne(input1, function(b64a, nameA) {
    if (b64a) { data.justificatif1 = b64a; data.justificatif1Name = nameA; }
    readOne(input2, function(b64b, nameB) {
      if (b64b) { data.justificatif2 = b64b; data.justificatif2Name = nameB; }
      callback(data);
    });
  });
}

function _renderPassBlock(insc) {
  const today    = new Date();
  const inSeason = (typeof isPassSeason === 'function') ? isPassSeason() : [6,7,8,9].includes(today.getMonth() + 1);
  const pass     = insc.pass || null;
  const actif    = !!(pass && pass.actif);

  if (!inSeason && !pass) return ''; // hors saison, jamais activé

  let inner = '';
  if (!actif) {
    const badgeCls = inSeason ? 'pass-badge-inactive' : 'pass-badge-season';
    const badgeLbl = inSeason ? 'Inactif' : 'Hors saison';
    inner = `
      <div class="pass-block-hd">🎫 Pass Handiplage
        <span class="pass-badge ${badgeCls}">${badgeLbl}</span>
      </div>
      <p class="pass-meta">${inSeason ? 'Ce pass donne accès à 40 réservations par mois (juin–septembre).' : 'Le pass est valide de juin à septembre.'}</p>
      ${inSeason ? '<div class="pass-actions"><button type="button" class="btn-primary" id="pass-activate">Activer le pass</button></div>' : ''}
    `;
  } else {
    const remaining  = (typeof getPassRemaining === 'function') ? getPassRemaining(insc.id) : 0;
    const pct        = Math.round((remaining / 40) * 100);
    const fillCls    = remaining === 0 ? 'empty' : remaining <= 10 ? 'low' : '';
    const monthLabel = (typeof getPassMonthLabel === 'function') ? getPassMonthLabel() : '';
    const resetDate  = (typeof getPassResetDate  === 'function') ? getPassResetDate()  : '';
    const sinceDate  = pass.activatedAt
      ? new Date(pass.activatedAt + 'T12:00:00').toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' })
      : '';
    inner = `
      <div class="pass-block-hd">🎫 Pass Handiplage
        <span class="pass-badge pass-badge-active">● Actif${sinceDate ? ' depuis le ' + sinceDate : ''}</span>
      </div>
      <p class="pass-meta">Saison : juin → septembre ${today.getFullYear()}</p>
      <div class="pass-remaining-row">
        <span class="pass-remaining-count">${remaining}</span>
        <span class="pass-remaining-label">/ 40 réservations restantes${monthLabel ? ' (' + monthLabel + ')' : ''}</span>
      </div>
      <div class="pass-bar-wrap">
        <div class="pass-bar-fill ${fillCls}" style="width:${pct}%"></div>
      </div>
      <p class="pass-meta">Réinitialisation le ${resetDate}</p>
      <div class="pass-actions">
        <button type="button" class="btn-ghost" id="pass-deactivate">Désactiver le pass</button>
      </div>
    `;
  }
  return `<div class="pass-block">${inner}</div>`;
}

if (typeof module !== 'undefined') {
  module.exports = { renderInscription, getInscriptions, saveInscriptions };
}
