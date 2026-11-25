'use strict';

var _mcCurrentData = null;
var _mcMatSlot     = {};     // créneau choisi dans la zone « Matériel », par date
var _mcEditOuv     = false;  // bloc d'ouverture rouvert via « Modifier »

const MC_COLS = [
  { key: 'resa',          label: 'Usagers\nrésas',      auto: true  },
  { key: 'walkin',        label: 'Usagers\nsans résa',   auto: true  },
  { key: 'acc_total',     label: 'Accom-\npagnants',     auto: true  },
  { key: 'gpe_pers',      label: 'Groupes\npersonnes',   auto: true  },
  { key: 'gpe_acc',       label: 'Groupes\nacc.',        auto: true  },
  { key: 'tiralos',       label: 'Tiralos',              auto: false },
  { key: 'hippocampes',   label: 'Hippo-\ncampes',       auto: false },
  { key: 'audioplage',    label: 'Audio-\nplage',        auto: false },
  { key: 'transferts',    label: 'Trans-\nferts',        auto: false },
  { key: 'leve_personne', label: 'Lève-\npersonne',      auto: false },
];

// Libellés sur une ligne pour la zone matériel
const MC_MAT_LABELS = {
  tiralos: 'Tiralo', hippocampes: 'Hippocampe', audioplage: 'Audioplage',
  transferts: 'Transfert', leve_personne: 'Lève-personne',
};

const MC_REPORTER_KEY = 'hp_mc_reporter';

function _fmtDateFr(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function _fmt(ts) {
  const d = new Date(ts);
  return String(d.getHours()).padStart(2,'0') + 'h' + String(d.getMinutes()).padStart(2,'0');
}
function _esc(s)     { return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function _escHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'); }

function _mcTodayISO() {
  if (typeof getTodayISO === 'function') return getTodayISO();
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Enregistre en notant l'heure : l'abonnement temps réel ignore nos propres enregistrements
function _mcSave(date, d) {
  window._mcLocalSaveAt = Date.now();
  return saveMcData(date, d);
}

function _lsGet(k)    { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
function _lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

// Heure de début de l'après-midi : premier créneau qui commence à partir de 12h
function _mcApremStart() {
  const s = SLOTS.find(sl => timeToMinutes(sl.start) >= 12 * 60);
  return s ? timeToMinutes(s.start) : 12 * 60 + 30;
}

// Créneau proposé par défaut dans la zone matériel
function _mcDefaultSlot(isToday) {
  if (!isToday) return SLOTS[0].id;
  const now = new Date();
  const run  = SLOTS.find(s => getSlotStatus(s, now) === 'active');
  const next = SLOTS.find(s => getSlotStatus(s, now) === 'upcoming');
  return (run || next || SLOTS[SLOTS.length - 1]).id;
}

function _mcPolicePassages(d) {
  return (d.notes || []).filter(n => n.type === 'police').sort((a, b) => a.ts - b.ts);
}

// Compatibilité : « police » = au moins un passage daté (ou ancien oui/non)
function _mcSyncPolice(d) {
  d.staff.police = _mcPolicePassages(d).length > 0;
}

async function renderMc(container, date) {
  const todayISO = _mcTodayISO();
  const isToday  = date === todayISO;
  const data     = await getMcData(date);
  _mcCurrentData = data;

  // Auto-remplissage resa/walkin (depuis les données réelles du jour)
  await Promise.all(SLOTS.map(async s => {
    if (!_mcCurrentData.slots[s.id]) _mcCurrentData.slots[s.id] = _mcDefault().slots[s.id];
    try {
      const vals = Object.values(await getReservations(date, s.id));
      // Comptages groupes (dédupliqués par nom+prénom)
      const seenGroups = {};
      let gpe_pers = 0, gpe_acc = 0;
      vals.filter(r => r.resaType === 'groupe').forEach(r => {
        const key = ((r.nom || '') + '_' + (r.prenom || '')).toUpperCase();
        if (!seenGroups[key]) {
          seenGroups[key] = true;
          gpe_pers += r.nbUsagers || 0;
          gpe_acc  += r.accompagnants || 0;
        }
      });
      _mcCurrentData.slots[s.id].gpe_pers  = gpe_pers;
      _mcCurrentData.slots[s.id].gpe_acc   = gpe_acc;
      _mcCurrentData.slots[s.id].acc_total = vals.filter(r => r.resaType !== 'groupe').reduce((sum, r) => sum + (r.accompagnants || 0), 0);
      _mcCurrentData.slots[s.id].resa   = vals.filter(r => r.type === 'reserved' && r.resaType !== 'groupe').length;
      _mcCurrentData.slots[s.id].walkin = vals.filter(r => r.type === 'walkin').length;
    } catch (e) {
      // Laisse resa/walkin à 0 si le créneau échoue — n'interrompt pas le rendu
    }
  }));
  // Ne sauvegarder que si une MC existe déjà (évite de créer des entrées vides à la navigation)
  if (!_mcCurrentData._isNew) await _mcSave(date, _mcCurrentData);

  const st       = _mcCurrentData.staff;
  const allDates = await getMcDates();
  if (!_mcMatSlot[date]) _mcMatSlot[date] = _mcDefaultSlot(isToday);
  const matSlot  = _mcMatSlot[date];

  const nowMin     = new Date().getHours() * 60 + new Date().getMinutes();
  const apremOuvert = !isToday || nowMin >= _mcApremStart();
  // Anciennes journées déjà remplies : considérées comme ouvertes
  const ouvFaite   = !!st.ouverture_validee
    || (!isToday && !!(st.entretien_matin || st.accueil_matin || st.plage_nettoyee));

  // ── Barre de navigation date ──
  let html = '<div class="nb mc-nav">'
    + '<button type="button" id="mc-nav-prev" class="nb-arrow" title="Jour précédent" aria-label="Jour précédent">&#8592;</button>'
    + '<span class="nb-date">' + _fmtDateFr(date) + '</span>'
    + '<button type="button" id="mc-nav-next" class="nb-arrow' + (isToday ? ' ghost' : '') + '" title="Jour suivant" aria-label="Jour suivant"' + (isToday ? ' disabled tabindex="-1"' : '') + '>&#8594;</button>'
    + (isToday
        ? '<span class="nb-today">Aujourd\'hui</span>'
        : '<button type="button" id="mc-nav-today" class="nb-back">↩ Revenir à aujourd\'hui</button>')
    + '<span class="nb-sp"></span>'
    + (st.fermee ? '' : '<button type="button" id="mc-fermer" class="mc-btn-fermer">Déclarer la plage fermée</button>')
    + '<button type="button" id="mc-nav-pdf" class="nb-sec" aria-haspopup="dialog">Exporter en PDF</button>'
    + '<button type="button" id="mc-nav-entretien" class="nb-sec">Fiches d\'entretien</button>'
    + '<button type="button" id="mc-nav-list" class="nb-sec" aria-haspopup="dialog" aria-expanded="false">Historique <span aria-hidden="true">▾</span></button>'
    + '</div>';

  // ── 0. Plage fermée ce jour ──
  if (st.fermee) {
    html += '<section class="mc-ferme" role="status" aria-labelledby="mc-ferme-title">'
      + '<span class="mc-ferme-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg></span>'
      + '<div class="mc-ferme-txt">'
      +   '<h2 id="mc-ferme-title">Handiplage fermée ' + (isToday ? 'aujourd\'hui' + (st.fermee_heure && st.fermee_heure !== '00:00' ? ' depuis ' + st.fermee_heure.replace(':', 'h') : '') : 'ce jour-là') + '</h2>'
      +   '<p>' + _esc(st.fermee_motif || 'Motif non précisé') + (st.fermee_precision ? ' — ' + _esc(st.fermee_precision) : '') + '</p>'
      +   '<p class="mc-ferme-usagers">' + (st.fermee_annonce_id ? '✓ Message affiché aux usagers sur leur accueil' : 'Aucun message affiché aux usagers') + '</p>'
      + '</div>'
      + '<button type="button" class="mc-btn-rouvrir" id="mc-rouvrir">Rouvrir la plage</button>'
      + '</section>'
      // Usagers dont la réservation est suspendue : à prévenir
      + '<section class="mc-card mc-prevenir" aria-labelledby="mc-prev-t">'
      +   '<div class="mc-card-hd"><h2 id="mc-prev-t">Usagers à prévenir</h2>'
      +     '<p class="mc-card-sub">Réservations suspendues. Si la plage ne rouvre pas, elles seront recréditées automatiquement sur le pass, une fois le créneau terminé.</p></div>'
      +   '<div id="mc-prev-liste"><p class="mc-card-sub">Chargement…</p></div>'
      + '</section>';
  }

  // ── 1. Ouverture de la journée ──
  const plageBtns = (val) =>
      '<div class="mc-seg" role="group" aria-label="Plage nettoyée par la ville">'
    +   '<button type="button" class="mc-seg-btn' + (val ? ' on' : '') + '" data-plage="1" aria-pressed="' + !!val + '">Oui</button>'
    +   '<button type="button" class="mc-seg-btn' + (!val ? ' on' : '') + '" data-plage="0" aria-pressed="' + !val + '">Non</button>'
    + '</div>';

  if (st.fermee) {
    // Plage fermée : pas d'ouverture de journée à saisir
  } else if (!ouvFaite || _mcEditOuv) {
    html += '<section class="mc-card mc-ouv" aria-labelledby="mc-ouv-title">'
      + '<div class="mc-card-hd"><h2 id="mc-ouv-title">Ouverture de la journée</h2>'
      +   '<p class="mc-card-sub">À remplir une fois, en début de journée.</p></div>'
      + '<div class="mc-ouv-grid">'
      +   '<label class="mc-big-field"><span>Entretien — matin</span><input type="text" class="mc-staff-inp" id="mc-ent-m" value="' + _esc(st.entretien_matin) + '" placeholder="Prénom Nom" autocomplete="off"></label>'
      +   '<label class="mc-big-field"><span>Accueil — matin</span><input type="text" class="mc-staff-inp" id="mc-acc-m" value="' + _esc(st.accueil_matin) + '" placeholder="Prénom Nom" autocomplete="off"></label>'
      +   '<div class="mc-big-field"><span>Plage nettoyée par la ville</span>' + plageBtns(st.plage_nettoyee) + '</div>'
      + '</div>'
      + (apremOuvert
          ? '<div class="mc-ouv-grid mc-ouv-aprem">'
            + '<label class="mc-big-field"><span>Entretien — après-midi</span><input type="text" class="mc-staff-inp" id="mc-ent-a" value="' + _esc(st.entretien_aprem) + '" placeholder="Prénom Nom" autocomplete="off"></label>'
            + '<label class="mc-big-field"><span>Accueil — après-midi</span><input type="text" class="mc-staff-inp" id="mc-acc-a" value="' + _esc(st.accueil_aprem) + '" placeholder="Prénom Nom" autocomplete="off"></label>'
            + '</div>'
          : '')
      + '<div class="mc-ouv-actions">'
      +   '<button type="button" class="mc-btn-primary" id="mc-ouv-valider">' + (ouvFaite ? 'Enregistrer' : 'Valider l\'ouverture') + '</button>'
      +   (ouvFaite ? '<button type="button" class="mc-btn-ghost" id="mc-ouv-annuler">Annuler</button>' : '')
      + '</div>'
      + '</section>';
  } else {
    const nom = v => v ? '<span class="mc-nom">' + _escHtml(v) + '</span>' : '<em class="mc-vide">—</em>';
    const apremRempli = !!(st.entretien_aprem && st.accueil_aprem);
    const releveAFaire = apremOuvert && !apremRempli;

    // Une seule bande « Équipe du jour » : matin | après-midi | plage | Modifier
    html += '<section class="mc-card mc-equipe" aria-label="Équipe du jour">'
      + '<span class="mc-ouv-ok" aria-hidden="true">✓</span>'
      + '<div class="mc-equipe-grp"><span class="mc-equipe-titre">Matin</span>'
      +   '<span><b>Entretien</b> ' + nom(st.entretien_matin) + '</span>'
      +   '<span><b>Accueil</b> ' + nom(st.accueil_matin) + '</span></div>'
      + (apremRempli
          ? '<div class="mc-equipe-grp"><span class="mc-equipe-titre">Après-midi</span>'
            + '<span><b>Entretien</b> ' + nom(st.entretien_aprem) + '</span>'
            + '<span><b>Accueil</b> ' + nom(st.accueil_aprem) + '</span></div>'
          : '')
      + '<div class="mc-equipe-grp"><span class="mc-equipe-titre">Plage nettoyée</span>'
      +   '<span class="mc-plage-etat' + (st.plage_nettoyee ? ' oui' : '') + '">' + (st.plage_nettoyee ? 'Oui' : 'Non') + '</span></div>'
      + '<button type="button" class="mc-btn-link" id="mc-ouv-modifier">Modifier</button>'
      + '</section>';

    // Relève de l'après-midi : seulement tant qu'elle reste à saisir
    if (releveAFaire) {
      html += '<section class="mc-card mc-releve" aria-label="Relève de l\'après-midi">'
        + '<span class="mc-releve-titre">Relève de l\'après-midi</span>'
        + '<label class="mc-inline-field">Entretien<input type="text" class="mc-staff-inp" id="mc-ent-a" value="' + _esc(st.entretien_aprem) + '" placeholder="Prénom Nom" autocomplete="off"></label>'
        + '<label class="mc-inline-field">Accueil<input type="text" class="mc-staff-inp" id="mc-acc-a" value="' + _esc(st.accueil_aprem) + '" placeholder="Prénom Nom" autocomplete="off"></label>'
        + '</section>';
    }
  }

  // ── 2. Maintenant : matériel + police + note ──
  const sd = _mcCurrentData.slots[matSlot] || {};
  html += '<div class="mc-now' + (st.fermee ? ' mc-now-ferme' : '') + '">';

  if (!st.fermee) html += '<section class="mc-card mc-mat" aria-labelledby="mc-mat-title">'
    + '<div class="mc-card-hd mc-card-hd-row"><h2 id="mc-mat-title">Matériel utilisé</h2></div>'
    + '<div class="mc-mat-slots" role="group" aria-label="Créneau">'
    + SLOTS.map((s, si) => {
        const status = isToday ? getSlotStatus(s, new Date()) : 'past';
        const tag = isToday && status === 'active' ? '<span class="mc-mat-now">en cours</span>' : '';
        return '<button type="button" class="mc-mat-slot' + (s.id === matSlot ? ' on' : '') + '" data-slot="' + s.id + '" aria-pressed="' + (s.id === matSlot) + '"'
          + ' style="--slot-c:' + ((typeof SLOT_COLORS !== 'undefined' && SLOT_COLORS[si]) || '#1565c0') + '">'
          + s.label.split(' – ')[0] + tag + '</button>';
      }).join('')
    + '</div>'
    + '<div class="mc-mat-list">'
    + MC_COLS.filter(c => !c.auto).map(c => {
        const v = Number(sd[c.key]) || 0;
        return '<div class="mc-step" data-key="' + c.key + '">'
          + '<span class="mc-step-label">' + MC_MAT_LABELS[c.key] + '</span>'
          + '<button type="button" class="mc-step-btn" data-delta="-1" aria-label="Retirer un ' + MC_MAT_LABELS[c.key] + '"' + (v <= 0 ? ' disabled' : '') + '>−</button>'
          + '<output class="mc-step-val" translate="no" aria-live="polite">' + v + '</output>'
          + '<button type="button" class="mc-step-btn plus" data-delta="1" aria-label="Ajouter un ' + MC_MAT_LABELS[c.key] + '">+</button>'
          + '</div>';
      }).join('')
    + '</div>'
    + '</section>';

  const passages = _mcPolicePassages(_mcCurrentData);
  const lastReporter = _lsGet(MC_REPORTER_KEY);
  html += '<div class="mc-now-side">'
    + '<section class="mc-card mc-police" aria-labelledby="mc-police-title">'
    +   '<div class="mc-card-hd"><h2 id="mc-police-title">Police</h2></div>'
    +   '<button type="button" class="mc-btn-police" id="mc-police-add">＋ Passage de la police</button>'
    +   '<p class="mc-police-list">' + (passages.length
          ? 'Passages : ' + passages.map(p => '<b>' + _fmt(p.ts) + '</b>').join(', ')
          : (st.police ? 'Passage signalé (sans heure)' : 'Aucun passage pour l\'instant.')) + '</p>'
    + '</section>'
    + '<section class="mc-card mc-note-rapide" aria-labelledby="mc-note-title">'
    +   '<div class="mc-card-hd"><h2 id="mc-note-title">Ajouter une note</h2></div>'
    +   '<input type="text" class="mc-note-reporter-inp" id="mc-note-reporter" placeholder="Qui rapporte ?" value="' + _esc(lastReporter) + '" autocomplete="off">'
    +   '<textarea id="mc-note-inp" rows="3" placeholder="Événement, incident, remarque… (Entrée pour valider, Maj+Entrée pour aller à la ligne)"></textarea>'
    +   '<button type="button" class="mc-btn-primary" id="mc-note-add">Ajouter la note</button>'
    + '</section>'
    + '</div>';

  html += '</div>'; // .mc-now

  // ── 3. Journal du jour ──
  html += '<section class="mc-card mc-notes" aria-labelledby="mc-journal-title">'
    + '<div class="mc-card-hd"><h2 id="mc-journal-title">Journal du jour</h2></div>'
    + '<div id="mc-notes-list">' + _renderNotes(_mcCurrentData.notes) + '</div>'
    + '</section>';

  // ── 4. Récap (lecture seule) ──
  html += '<details class="mc-card mc-recap"' + (isToday ? '' : ' open') + '>'
    + '<summary><span>Récap de la journée</span><span class="mc-recap-hint">tous les créneaux</span></summary>'
    + '<div class="mc-table-wrap"><table class="mc-table"><thead><tr><th class="mc-row-header"></th>';
  SLOTS.forEach((s, si) => {
    const color = (typeof SLOT_COLORS !== 'undefined' && SLOT_COLORS[si]) || '#1565c0';
    // Fond clair teinté + texte de la couleur du créneau (jaune / orange assombris pour rester lisibles)
    const txt = si === 4 ? '#8a5a00' : si === 2 ? '#bf360c' : color;
    html += '<th class="mc-slot-th" style="border-top:3px solid ' + color + ';background:' + color + '14;color:' + txt + '">' + s.label + '</th>';
  });
  html += '<th class="mc-total-th">Total</th></tr></thead><tbody>';

  MC_COLS.forEach(c => {
    let rowTotal = 0;
    html += '<tr' + (c.auto ? ' class="mc-row-auto"' : '') + '><td class="mc-row-label">' + c.label.replace(/\n/g, ' ') + '</td>';
    SLOTS.forEach(s => {
      const v = Number((_mcCurrentData.slots[s.id] || {})[c.key]) || 0;
      rowTotal += v;
      html += '<td translate="no" id="mc-cell-' + s.id + '-' + c.key + '"' + (v === 0 ? ' class="mc-zero"' : '') + '>' + v + '</td>';
    });
    html += '<td id="mc-tot-' + c.key + '" class="mc-total-cell" translate="no">' + rowTotal + '</td></tr>';
  });
  html += '</tbody></table></div></details>';

  container.innerHTML = html;

  // ── Wiring : noms (enregistrés en quittant le champ) ──
  const staffMap = { 'mc-ent-m':'entretien_matin', 'mc-ent-a':'entretien_aprem', 'mc-acc-m':'accueil_matin', 'mc-acc-a':'accueil_aprem' };
  Object.keys(staffMap).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', async () => {
      try {
        const d = _mcCurrentData;
        if (!d) return;
        const v = el.value.trim();
        if (d.staff[staffMap[id]] === v) return;
        d.staff[staffMap[id]] = v;
        await _mcSave(date, d);
        // Relève complète : la ligne orange se replie dans la bande « Équipe du jour »
        if (container.querySelector('.mc-releve') && d.staff.entretien_aprem && d.staff.accueil_aprem) {
          renderMc(container, date).catch(console.error);
        }
      } catch (e) {
        console.error('MC save error:', e);
      }
    });
  });

  // ── Wiring : plage nettoyée (Oui / Non) ──
  container.querySelectorAll('.mc-seg-btn[data-plage]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const d = _mcCurrentData;
        if (!d) return;
        d.staff.plage_nettoyee = btn.dataset.plage === '1';
        container.querySelectorAll('.mc-seg-btn[data-plage]').forEach(b => {
          const on = (b.dataset.plage === '1') === d.staff.plage_nettoyee;
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', on);
        });
        await _mcSave(date, d);
      } catch (e) {
        console.error('MC save error:', e);
      }
    });
  });

  // ── Wiring : valider / modifier l'ouverture ──
  const rerender = () => renderMc(container, date).catch(console.error);

  if (st.fermee) _mcChargerAPrevenir(date);

  // ── Wiring : export PDF ──
  const pdfBtn = document.getElementById('mc-nav-pdf');
  if (pdfBtn) pdfBtn.addEventListener('click', () => _mcDialogExport(date, allDates));

  // ── Wiring : plage fermée / réouverture ──
  const fermerBtn = document.getElementById('mc-fermer');
  if (fermerBtn) fermerBtn.addEventListener('click', () => _mcDialogFermeture(date, isToday, rerender));
  const rouvrirBtn = document.getElementById('mc-rouvrir');
  if (rouvrirBtn) rouvrirBtn.addEventListener('click', async () => {
    const d = _mcCurrentData;
    if (!confirm('Rouvrir la plage ?\n\n'
      + (isToday
          ? 'Les réservations des créneaux pas encore terminés seront rétablies. Celles des créneaux passés pendant la fermeture restent recréditées.'
          : 'Jour passé : la fermeture sera annulée et toutes les réservations suspendues rétablies.')
      + (d.staff.fermee_annonce_id ? '\n\nLe message de fermeture sera retiré de l\'accueil des usagers.' : ''))) return;
    rouvrirBtn.disabled = true;
    try {
      // Aujourd'hui : réservations des créneaux pas encore terminés rétablies, les autres restent recréditées.
      // Jour passé : il s'agit d'une erreur de saisie → tout est rétabli.
      const heure = isToday ? _heureCourante() : '00:00';
      let res = { retablies: 0 };
      if (typeof rouvrirPlage === 'function') {
        let fid = d.staff.fermee_id;
        if (!fid && typeof getFermetureOuverte === 'function') { const f = await getFermetureOuverte(date).catch(() => null); fid = f && f.id; }
        res = await rouvrirPlage(fid, date, heure);
      }
      await _mcRetirerAnnonceFermeture(d.staff);
      ['fermee', 'fermee_motif', 'fermee_precision', 'fermee_annonce_id', 'fermee_annonce_prec', 'fermee_heure', 'fermee_id', 'fermee_suspendues'].forEach(k => { delete d.staff[k]; });
      if (!d.notes) d.notes = [];
      d.notes.unshift({ ts: isToday ? Date.now() : new Date(date + 'T12:00:00').getTime(),
        text: 'Plage rouverte' + (isToday ? ' à ' + heure.replace(':', 'h') : '') + ' · ' + res.retablies + ' réservation' + (res.retablies > 1 ? 's' : '') + ' rétablie' + (res.retablies > 1 ? 's' : ''),
        reporter: _lsGet(MC_REPORTER_KEY), type: 'reouverture' });
      await _mcSave(date, d);
      rerender();
    } catch (e) {
      rouvrirBtn.disabled = false;
      alert('Réouverture impossible : ' + (e.message || e));
    }
  });
  const ouvValider = document.getElementById('mc-ouv-valider');
  if (ouvValider) {
    ouvValider.addEventListener('click', async () => {
      try {
        const d = _mcCurrentData;
        Object.keys(staffMap).forEach(id => {
          const el = document.getElementById(id);
          if (el) d.staff[staffMap[id]] = el.value.trim();
        });
        d.staff.ouverture_validee = true;
        await _mcSave(date, d);
        _mcEditOuv = false;
        rerender();
      } catch (e) {
        console.error('MC save error:', e);
      }
    });
  }
  const ouvAnnuler = document.getElementById('mc-ouv-annuler');
  if (ouvAnnuler) ouvAnnuler.addEventListener('click', () => { _mcEditOuv = false; rerender(); });
  const ouvModifier = document.getElementById('mc-ouv-modifier');
  if (ouvModifier) ouvModifier.addEventListener('click', () => { _mcEditOuv = true; rerender(); });

  // ── Wiring : choix du créneau (matériel) ──
  container.querySelectorAll('.mc-mat-slot').forEach(btn => {
    btn.addEventListener('click', () => {
      _mcMatSlot[date] = parseInt(btn.dataset.slot);
      rerender();
    });
  });

  // ── Wiring : compteurs − / + ──
  container.querySelectorAll('.mc-step').forEach(row => {
    const key   = row.dataset.key;
    const out   = row.querySelector('.mc-step-val');
    const minus = row.querySelector('[data-delta="-1"]');
    row.querySelectorAll('.mc-step-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          const d = _mcCurrentData;
          if (!d) return;
          const slotId = _mcMatSlot[date];
          if (!d.slots[slotId]) d.slots[slotId] = _mcDefault().slots[slotId];
          const v = Math.max(0, (Number(d.slots[slotId][key]) || 0) + parseInt(btn.dataset.delta));
          d.slots[slotId][key] = v;
          out.textContent = v;
          minus.disabled = v <= 0;
          row.classList.remove('bump'); void row.offsetWidth; row.classList.add('bump');
          // Récap
          const cell = document.getElementById('mc-cell-' + slotId + '-' + key);
          if (cell) { cell.textContent = v; cell.classList.toggle('mc-zero', v === 0); }
          const totEl = document.getElementById('mc-tot-' + key);
          if (totEl) totEl.textContent = SLOTS.reduce((t, s) => t + (Number((d.slots[s.id] || {})[key]) || 0), 0);
          await _mcSave(date, d);
        } catch (e) {
          console.error('MC save error:', e);
        }
      });
    });
  });

  // ── Wiring : passage de la police (horodaté, ajouté au journal) ──
  const policeBtn = document.getElementById('mc-police-add');
  if (policeBtn) {
    policeBtn.addEventListener('click', async () => {
      try {
        const d = _mcCurrentData;
        if (!d) return;
        if (!d.notes) d.notes = [];
        const reporter = ((document.getElementById('mc-note-reporter') || {}).value || '').trim();
        // Pour une journée passée, l'heure exacte n'est pas connue : midi par défaut
        const ts = isToday ? Date.now() : new Date(date + 'T12:00:00').getTime();
        d.notes.unshift({ ts, text: 'Passage de la police', reporter, type: 'police' });
        _mcSyncPolice(d);
        await _mcSave(date, d);
        rerender();
      } catch (e) {
        console.error('MC save error:', e);
      }
    });
  }

  // ── Wiring : notes ──
  const noteAddBtn = document.getElementById('mc-note-add');
  const noteInp    = document.getElementById('mc-note-inp');
  const reporterEl = document.getElementById('mc-note-reporter');
  async function _addNote() {
    try {
      const text     = noteInp.value.trim();
      const reporter = (reporterEl.value || '').trim();
      if (!text) { noteInp.focus(); return; }
      const d = _mcCurrentData;
      if (!d) return;
      if (!d.notes) d.notes = [];
      d.notes.unshift({ ts: Date.now(), text, reporter });
      _lsSet(MC_REPORTER_KEY, reporter);
      await _mcSave(date, d);
      noteInp.value = '';
      document.getElementById('mc-notes-list').innerHTML = _renderNotes(d.notes);
      _bindNoteDelete(date, container);
    } catch (e) {
      console.error('MC save error:', e);
    }
  }
  noteAddBtn.addEventListener('click', _addNote);
  noteInp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _addNote(); }
  });
  reporterEl.addEventListener('change', () => _lsSet(MC_REPORTER_KEY, reporterEl.value.trim()));

  _bindNoteDelete(date, container);

  // ── Wiring nav ──
  const prevBtn = document.getElementById('mc-nav-prev');
  if (prevBtn) prevBtn.addEventListener('click', () => { _mcEditOuv = false; if (container._onMcPrev) container._onMcPrev(); });
  const nextBtn = document.getElementById('mc-nav-next');
  if (nextBtn) nextBtn.addEventListener('click', () => { _mcEditOuv = false; if (container._onMcNext) container._onMcNext(); });
  const todayBtn = document.getElementById('mc-nav-today');
  if (todayBtn) todayBtn.addEventListener('click', () => { _mcEditOuv = false; if (container._onMcToday) container._onMcToday(); });

  const entretienBtn = document.getElementById('mc-nav-entretien');
  if (entretienBtn) {
    entretienBtn.addEventListener('click', () => {
      renderEntretien(container, () => renderMc(container, date));
    });
  }

  // ── Historique : calendrier du mois, jours remplis cliquables ──
  const listBtn = document.getElementById('mc-nav-list');
  if (listBtn) {
    let calMonth = date.slice(0, 7); // 'YYYY-MM' — mois du jour affiché
    const filled = new Set(allDates);

    function closeCal() {
      const ex = document.getElementById('mc-hist-dropdown');
      if (ex) ex.remove();
      listBtn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', onEsc);
    }
    function outside(e) {
      const dd = document.getElementById('mc-hist-dropdown');
      if (dd && !dd.contains(e.target) && !listBtn.contains(e.target)) closeCal();
    }
    function onEsc(e) { if (e.key === 'Escape') { closeCal(); listBtn.focus(); } }

    function drawCal(dd) {
      const [y, m] = calMonth.split('-').map(Number);
      const first  = new Date(y, m - 1, 1);
      const nbDays = new Date(y, m, 0).getDate();
      const lead   = (first.getDay() + 6) % 7; // lundi = 0
      const titre  = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      const nextOk = calMonth < todayISO.slice(0, 7);
      let g = ['L','M','M','J','V','S','D'].map(w => '<span class="mc-cal-wd" aria-hidden="true">' + w + '</span>').join('');
      for (let i = 0; i < lead; i++) g += '<span></span>';
      for (let d = 1; d <= nbDays; d++) {
        const iso = calMonth + '-' + String(d).padStart(2, '0');
        const has = filled.has(iso);
        const cls = 'mc-cal-d' + (has ? ' has' : '') + (iso === todayISO ? ' tod' : '') + (iso === date ? ' cur' : '');
        const lab = new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
                  + (has ? ', main courante remplie' : ', rien d\'enregistré');
        // Jours remplis + aujourd'hui cliquables ; jours futurs et vides non
        g += (has || iso === todayISO)
          ? '<button type="button" class="' + cls + '" data-date="' + iso + '" aria-label="' + lab + '"' + (iso === date ? ' aria-current="date"' : '') + '>' + d + '</button>'
          : '<span class="' + cls + '" aria-label="' + lab + '">' + d + '</span>';
      }
      const nbMois = allDates.filter(d => d.startsWith(calMonth)).length;
      dd.innerHTML = '<div class="mc-cal-hd">'
        +   '<button type="button" class="mc-cal-nav" data-m="-1" aria-label="Mois précédent">‹</button>'
        +   '<b>' + titre + '</b>'
        +   '<button type="button" class="mc-cal-nav" data-m="1" aria-label="Mois suivant"' + (nextOk ? '' : ' disabled') + '>›</button>'
        + '</div>'
        + '<div class="mc-cal-g">' + g + '</div>'
        + '<div class="mc-cal-leg"><span><i></i>main courante remplie</span><span><s></s>aujourd\'hui</span>'
        +   '<span class="mc-cal-nb">' + nbMois + ' jour' + (nbMois > 1 ? 's' : '') + ' ce mois</span></div>';
      dd.querySelectorAll('.mc-cal-nav').forEach(b => b.addEventListener('click', () => {
        const d = new Date(y, m - 1 + parseInt(b.dataset.m), 1);
        calMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        drawCal(dd);
      }));
      dd.querySelectorAll('button.mc-cal-d').forEach(b => b.addEventListener('click', () => {
        closeCal();
        _mcEditOuv = false;
        if (container._onMcGoto) container._onMcGoto(b.dataset.date);
      }));
    }

    listBtn.addEventListener('click', () => {
      if (document.getElementById('mc-hist-dropdown')) { closeCal(); return; }
      calMonth = date.slice(0, 7);
      const dd = document.createElement('div');
      dd.id = 'mc-hist-dropdown';
      dd.className = 'mc-cal';
      dd.setAttribute('role', 'dialog');
      dd.setAttribute('aria-label', 'Historique des mains courantes');
      listBtn.parentNode.appendChild(dd);
      drawCal(dd);
      listBtn.setAttribute('aria-expanded', 'true');
      setTimeout(() => {
        document.addEventListener('mousedown', outside);
        document.addEventListener('keydown', onEsc);
        const f = (dd.querySelector('button.mc-cal-d.cur') || dd.querySelector('button.mc-cal-d.tod') || dd.querySelector('button.mc-cal-d'));
        if (f) f.focus();
      }, 0);
    });
  }
}

// ── Export PDF des mains courantes (une journée ou une période) ──
function _mcDialogExport(date, allDates) {
  const old = document.getElementById('mc-export-dlg');
  if (old) old.remove();
  const today = _mcTodayISO();
  const debutMois = date.slice(0, 8) + '01';
  const dlg = document.createElement('dialog');
  dlg.id = 'mc-export-dlg';
  dlg.className = 'mc-ferme-dlg mc-export-dlg';
  dlg.setAttribute('aria-labelledby', 'mc-ex-t');
  dlg.innerHTML = '<form method="dialog" class="mc-fd">'
    + '<h2 id="mc-ex-t" class="mc-ex-t">Exporter la main courante en PDF</h2>'
    + '<label class="mc-ex-opt"><input type="radio" name="mc-ex-mode" value="jour" checked>'
    +   '<span><b>Cette journée</b><small class="mc-ex-date">' + _fmtDateFr(date) + '</small></span></label>'
    + '<label class="mc-ex-opt"><input type="radio" name="mc-ex-mode" value="periode">'
    +   '<span><b>Plusieurs journées</b><small>une journée par page</small></span></label>'
    + '<div class="mc-ex-periode" id="mc-ex-periode" hidden>'
    +   '<label>Du <input type="date" id="mc-ex-du" value="' + debutMois + '" max="' + today + '"></label>'
    +   '<label>au <input type="date" id="mc-ex-au" value="' + date + '" max="' + today + '"></label>'
    +   '<p class="mc-ex-nb" id="mc-ex-nb" aria-live="polite"></p>'
    + '</div>'
    + '<div class="mc-fd-acts">'
    +   '<button type="button" class="mc-btn-ghost" id="mc-ex-annuler">Annuler</button>'
    +   '<button type="button" class="mc-btn-primary" id="mc-ex-ok">Exporter</button>'
    + '</div>'
    + '<p class="mc-fd-err" id="mc-ex-err" role="alert"></p>'
    + '</form>';
  document.body.appendChild(dlg);

  const mode = () => dlg.querySelector('input[name="mc-ex-mode"]:checked').value;
  const du = dlg.querySelector('#mc-ex-du'), au = dlg.querySelector('#mc-ex-au');
  function maj() {
    dlg.querySelector('#mc-ex-periode').hidden = mode() !== 'periode';
    const n = (allDates || []).filter(d => d >= du.value && d <= au.value).length;
    dlg.querySelector('#mc-ex-nb').textContent = (du.value > au.value)
      ? 'La date de début doit précéder la date de fin.'
      : n + ' main' + (n > 1 ? 's' : '') + ' courante' + (n > 1 ? 's' : '') + ' enregistrée' + (n > 1 ? 's' : '') + ' sur cette période.';
  }
  dlg.addEventListener('change', maj);
  dlg.addEventListener('input', maj);
  maj();

  const close = () => { if (dlg.open) dlg.close(); dlg.remove(); };
  dlg.querySelector('#mc-ex-annuler').addEventListener('click', close);
  dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
  dlg.querySelector('#mc-ex-ok').addEventListener('click', async () => {
    const ok = dlg.querySelector('#mc-ex-ok'), err = dlg.querySelector('#mc-ex-err');
    err.textContent = '';
    try {
      let jours;
      if (mode() === 'jour') {
        jours = [{ date: date, mc: _mcCurrentData }];
      } else {
        if (!du.value || !au.value || du.value > au.value) { err.textContent = 'Choisissez une période valide.'; return; }
        ok.disabled = true; ok.textContent = 'Préparation…';
        const parDate = await getMcRange(du.value, au.value);
        // La journée affichée : on prend la version à l'écran (compteurs à jour)
        if (date >= du.value && date <= au.value && _mcCurrentData) parDate[date] = _mcCurrentData;
        jours = Object.keys(parDate).sort().map(d => ({ date: d, mc: parDate[d] }));
        if (!jours.length) { ok.disabled = false; ok.textContent = 'Exporter'; err.textContent = 'Aucune main courante enregistrée sur cette période.'; return; }
      }
      close();
      _mcExportPdf(jours);
    } catch (e) {
      ok.disabled = false; ok.textContent = 'Exporter';
      err.textContent = 'Export impossible : ' + (e.message || e);
    }
  });
  dlg.showModal();
}

const MC_PDF_LABELS = {
  resa: 'Usagers avec réservation', walkin: 'Usagers sans réservation', acc_total: 'Accompagnants',
  gpe_pers: 'Personnes en groupe', gpe_acc: 'Accompagnants de groupe',
  tiralos: 'Tiralo', hippocampes: 'Hippocampe', audioplage: 'Audioplage', transferts: 'Transferts', leve_personne: 'Lève-personne',
};

function _mcPageHtml(date, mc) {
  const st = mc.staff || {};
  const nom = v => v ? _esc(v) : '<span class="vide">—</span>';
  const notes = (mc.notes || []).slice().sort((a, b) => a.ts - b.ts);
  const police = notes.filter(n => n.type === 'police');
  const tag = { police: 'Police', fermeture: 'Fermeture', reouverture: 'Réouverture' };

  let tableau = '<table class="recap"><thead><tr><th></th>'
    + SLOTS.map(s => '<th>' + _esc(s.label) + '</th>').join('') + '<th class="tot">Total</th></tr></thead><tbody>';
  MC_COLS.forEach(c => {
    let tot = 0;
    tableau += '<tr' + (c.auto ? '' : ' class="mat"') + '><td class="lab">' + _esc(MC_PDF_LABELS[c.key] || c.key) + '</td>';
    SLOTS.forEach(s => {
      const v = Number(((mc.slots || {})[s.id] || {})[c.key]) || 0;
      tot += v;
      tableau += '<td' + (v ? '' : ' class="z"') + '>' + v + '</td>';
    });
    tableau += '<td class="tot">' + tot + '</td></tr>';
  });
  tableau += '</tbody></table>';

  return '<section class="page">'
    + '<header><img src="' + new URL('logo-handiplage-mot-bleu.svg', location.href).href + '" alt="Handiplage">'
    +   '<div class="t"><h1>Main courante</h1><p><span class="d">' + _esc(_fmtDateFr(date)) + '</span> · Handiplage d\'Antibes · CCAS</p></div></header>'
    + (st.fermee
        ? '<div class="ferme"><b>Plage fermée</b> — ' + _esc(st.fermee_motif || 'motif non précisé') + (st.fermee_precision ? ' : ' + _esc(st.fermee_precision) : '')
          + (st.fermee_annonce_id ? ' · message affiché aux usagers' : '') + '</div>'
        : '')
    + '<div class="cols">'
    +   '<div class="bloc"><h2>Équipe</h2><table class="kv">'
    +     '<tr><td>Entretien — matin</td><td>' + nom(st.entretien_matin) + '</td></tr>'
    +     '<tr><td>Accueil — matin</td><td>' + nom(st.accueil_matin) + '</td></tr>'
    +     '<tr><td>Entretien — après-midi</td><td>' + nom(st.entretien_aprem) + '</td></tr>'
    +     '<tr><td>Accueil — après-midi</td><td>' + nom(st.accueil_aprem) + '</td></tr>'
    +   '</table></div>'
    +   '<div class="bloc"><h2>Plage et sécurité</h2><table class="kv">'
    +     '<tr><td>Plage nettoyée par la ville</td><td>' + (st.plage_nettoyee ? 'Oui' : 'Non') + '</td></tr>'
    +     '<tr><td>Passages de la police</td><td>' + (police.length ? police.map(p => _fmt(p.ts)).join(', ') : (st.police ? 'Oui (heure non notée)' : 'Aucun')) + '</td></tr>'
    +   '</table></div>'
    + '</div>'
    + '<div class="bloc"><h2>Fréquentation et matériel par créneau</h2>' + tableau + '</div>'
    + '<div class="bloc"><h2>Journal du jour</h2>'
    +   (notes.length
          ? '<table class="journal">' + notes.map(n =>
              '<tr class="' + (n.type || '') + '"><td class="h">' + _fmt(n.ts) + '</td>'
              + '<td class="ty">' + (tag[n.type] || '') + '</td>'
              + '<td class="qui">' + _esc(n.reporter || '') + '</td>'
              + '<td>' + _escHtml(n.text) + '</td></tr>').join('') + '</table>'
          : '<p class="vide">Rien de noté.</p>')
    + '</div>'
    + '<footer><span>Document généré le ' + new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + '</span>'
    +   '<div class="visa">Visa du responsable<br><span>Date :</span><span>Signature :</span></div></footer>'
    + '</section>';
}

function _mcExportPdf(jours) {
  const titre = jours.length === 1
    ? 'Main courante — ' + _fmtDateFr(jours[0].date)
    : 'Mains courantes — du ' + _fmtDateFr(jours[0].date) + ' au ' + _fmtDateFr(jours[jours.length - 1].date);
  const html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>' + _esc(titre) + '</title><style>'
    + '@page{size:A4 portrait;margin:13mm 12mm 14mm}'
    + '*{box-sizing:border-box}body{margin:0;font-family:"Segoe UI",Arial,sans-serif;font-size:9.5pt;color:#1f2a3d;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + '.page{break-after:page}.page:last-child{break-after:auto}'
    + 'header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #05559b;padding-bottom:6px;margin-bottom:10px}'
    + 'header img{height:28px}header .t{text-align:right}header h1{margin:0;font-size:15pt;color:#05559b}header p{margin:2px 0 0;font-size:9pt;color:#5b6576}header .d{text-transform:capitalize}'
    + 'h2{font-size:9pt;text-transform:uppercase;letter-spacing:.06em;color:#05559b;margin:0 0 6px}'
    + '.bloc{border:1px solid #dfe6ee;border-radius:8px;padding:8px 10px;margin-bottom:9px;break-inside:avoid}'
    + '.cols{display:grid;grid-template-columns:1fr 1fr;gap:9px}'
    + '.ferme{background:#fde8e8;border:1.5px solid #c62828;color:#7f1d1d;border-radius:8px;padding:7px 10px;margin-bottom:9px}.ferme b{color:#b71c1c}'
    + 'table{width:100%;border-collapse:collapse}'
    + '.kv td{padding:3px 0;border-bottom:1px solid #eef2f6;font-size:9.5pt}.kv td:first-child{color:#5b6576;width:55%}.kv td:last-child{font-weight:700;text-transform:capitalize}'
    + '.recap th,.recap td{border:1px solid #d5dde7;padding:3px 4px;text-align:center;font-size:8.5pt}'
    + '.recap thead th{background:#05559b;color:#fff;font-weight:700}.recap thead th:first-child{background:#fff;border:none}'
    + '.recap td.lab{text-align:left;font-weight:600;width:24%}.recap tr.mat td.lab{color:#05559b}'
    + '.recap td.z{color:#a0a9b6}.recap .tot{font-weight:800;background:#f1f5fa}.recap thead .tot{background:#043f73}'
    + '.journal td{padding:4px 4px;border-bottom:1px solid #eef2f6;vertical-align:top;font-size:9pt}'
    + '.journal td.h{width:42px;font-weight:700;color:#9a3c00}.journal td.ty{width:72px;font-size:7.5pt;font-weight:800;text-transform:uppercase}'
    + '.journal td.qui{width:90px;font-weight:700;color:#05559b}'
    + '.journal tr.police td.ty{color:#05559b}.journal tr.fermeture td.ty{color:#b71c1c}.journal tr.reouverture td.ty{color:#2e7d32}'
    + '.vide{color:#8a94a3;font-style:italic;margin:0}'
    + 'footer{display:flex;justify-content:space-between;align-items:flex-end;margin-top:12px;font-size:8pt;color:#5b6576}'
    + '.visa{border:1px solid #8a97a8;border-radius:4px;padding:4px 8px;min-width:230px;height:46px;font-weight:700;color:#1f2a3d}'
    + '.visa span{display:inline-block;width:48%;font-weight:400;margin-top:12px}'
    + '</style></head><body>' + jours.map(j => _mcPageHtml(j.date, j.mc)).join('') + '</body></html>';

  const old = document.getElementById('mc-print-frame');
  if (old) old.remove();
  const f = document.createElement('iframe');
  f.id = 'mc-print-frame';
  f.setAttribute('aria-hidden', 'true');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(f);
  const doc = f.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { alert('Impression impossible : ' + e.message); } };
  const img = doc.querySelector('header img');
  if (img && !img.complete) { img.onload = img.onerror = () => setTimeout(go, 50); }
  else setTimeout(go, 100);
}

// Liste des réservations suspendues, avec téléphone (usager) ou référent (groupe)
async function _mcChargerAPrevenir(date) {
  const el = document.getElementById('mc-prev-liste');
  if (!el) return;
  if (typeof getReservationsSuspendues !== 'function') { el.innerHTML = ''; return; }
  let rows;
  try { rows = await getReservationsSuspendues(date); }
  catch (e) { el.innerHTML = '<p class="mc-card-sub">Liste indisponible : ' + _esc(e.message || String(e)) + '</p>'; return; }
  if (!rows.length) { el.innerHTML = '<p class="mc-card-sub">Aucune réservation concernée.</p>'; return; }

  const groupes = (typeof getCachedGroupes === 'function') ? getCachedGroupes() : [];
  const tel = t => {
    const d = String(t || '').replace(/\D/g, '');
    return d ? '<a class="mc-prev-tel" href="tel:' + _esc(d) + '">' + _esc(d.length === 10 ? d.replace(/(\d{2})(?=\d)/g, '$1 ') : t) + '</a>' : '<span class="mc-card-sub">pas de téléphone</span>';
  };
  // Un groupe réserve plusieurs places : une seule ligne par groupe et par créneau
  const vus = {};
  const lignes = [];
  rows.forEach(r => {
    if (r.resa_type === 'groupe') {
      const k = (r.groupe_id || r.nom) + '|' + r.creneau_id;
      if (vus[k]) { vus[k].places++; return; }
      const g = groupes.find(x => x.id === r.groupe_id) || {};
      vus[k] = { groupe: true, nom: g.nom || r.nom, ref: g.referentNom, tel: g.referentTel, creneau: r.creneau_id, places: 1 };
      lignes.push(vus[k]);
    } else {
      lignes.push({ nom: (r.nom || '').toUpperCase() + ' ' + (r.prenom || ''), tel: r.inscriptions && r.inscriptions.telephone, creneau: r.creneau_id });
    }
  });
  el.innerHTML = '<p class="mc-prev-nb">' + lignes.length + ' à prévenir</p><ul class="mc-prev-list">' + lignes.map(l => {
    const slot = SLOTS.find(s => s.id === l.creneau);
    return '<li><span class="mc-prev-slot">' + _esc(slot ? slot.label : '') + '</span>'
      + '<span class="mc-prev-nom">' + _esc(l.nom) + (l.groupe ? ' <span class="mc-prev-g">Groupe · ' + l.places + ' place' + (l.places > 1 ? 's' : '') + (l.ref ? ' · réf. ' + _esc(l.ref) : '') + '</span>' : '') + '</span>'
      + tel(l.tel) + '</li>';
  }).join('') + '</ul>';
}

// ── Fermeture de la plage ──
const MC_MOTIFS_FERMETURE = [
  'Météo défavorable',
  'Baignade interdite (pollution, méduses…)',
  'Problème technique',
  'Manque de personnel',
  'Autre',
];

function _mcMessageFermeture(motif, precision) {
  const m = motif === 'Autre' ? '' : motif;
  const detail = [m, precision].filter(Boolean).join(' : ');
  return (detail ? 'Motif : ' + detail + '. ' : '') + 'Nous vous prions de nous excuser pour la gêne occasionnée.';
}

// Retire l'annonce de fermeture (si c'est encore celle en ligne) et remet l'annonce précédente
async function _mcRetirerAnnonceFermeture(st) {
  if (!st.fermee_annonce_id || typeof getActiveAnnonce !== 'function') return;
  const active = await getActiveAnnonce();
  if (active && active.id === st.fermee_annonce_id) {
    await deactivateAnnonce(active.id);
    if (st.fermee_annonce_prec) await createAnnonce(st.fermee_annonce_prec);
  }
}

function _mcDialogFermeture(date, isToday, onDone) {
  const old = document.getElementById('mc-ferme-dlg');
  if (old) old.remove();
  const dlg = document.createElement('dialog');
  dlg.id = 'mc-ferme-dlg';
  dlg.className = 'mc-ferme-dlg';
  dlg.setAttribute('aria-labelledby', 'mc-ferme-dlg-t');
  dlg.innerHTML = '<form method="dialog" class="mc-fd">'
    + '<h2 id="mc-ferme-dlg-t">Déclarer la plage fermée</h2>'
    + '<p class="mc-fd-sub">' + _fmtDateFr(date) + '</p>'
    + '<fieldset class="mc-fd-motifs"><legend>Motif</legend>'
    +   MC_MOTIFS_FERMETURE.map((m, i) =>
          '<label class="mc-fd-motif"><input type="radio" name="mc-fd-motif" value="' + _esc(m) + '"' + (i === 0 ? ' checked' : '') + '><span>' + _esc(m) + '</span></label>').join('')
    + '</fieldset>'
    + '<label class="mc-fd-lab" for="mc-fd-prec">Précision <span>(facultatif)</span></label>'
    + '<input type="text" id="mc-fd-prec" maxlength="140" placeholder="Ex. : vent fort, drapeau rouge" autocomplete="off">'
    + (isToday
        ? '<label class="mc-fd-check"><input type="checkbox" id="mc-fd-notif" checked> Afficher un message aux usagers sur leur accueil</label>'
          + '<div class="mc-fd-apercu" id="mc-fd-apercu" aria-live="polite"></div>'
        : '<p class="mc-fd-note">Jour passé : la fermeture est seulement enregistrée (statistiques, fiches d\'entretien), sans message aux usagers.</p>')
    + '<div class="mc-fd-acts">'
    +   '<button type="button" class="mc-btn-ghost" id="mc-fd-annuler">Annuler</button>'
    +   '<button type="button" class="mc-btn-danger" id="mc-fd-ok">Fermer la plage</button>'
    + '</div>'
    + '<p class="mc-fd-err" id="mc-fd-err" role="alert"></p>'
    + '</form>';
  document.body.appendChild(dlg);

  const motif = () => (dlg.querySelector('input[name="mc-fd-motif"]:checked') || {}).value || '';
  const prec  = () => dlg.querySelector('#mc-fd-prec').value.trim();
  const notif = () => { const c = dlg.querySelector('#mc-fd-notif'); return !!(c && c.checked); };
  function apercu() {
    const el = dlg.querySelector('#mc-fd-apercu');
    if (!el) return;
    el.hidden = !notif();
    el.innerHTML = '<span class="mc-fd-apercu-l">Aperçu côté usagers</span>'
      + '<b>Handiplage fermée aujourd\'hui</b><br>' + _esc(_mcMessageFermeture(motif(), prec()));
  }
  dlg.addEventListener('input', apercu);
  dlg.addEventListener('change', apercu);
  apercu();

  const close = () => { if (dlg.open) dlg.close(); dlg.remove(); };
  dlg.querySelector('#mc-fd-annuler').addEventListener('click', close);
  dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });

  dlg.querySelector('#mc-fd-ok').addEventListener('click', async () => {
    const ok = dlg.querySelector('#mc-fd-ok');
    const err = dlg.querySelector('#mc-fd-err');
    ok.disabled = true; ok.textContent = 'Enregistrement…';
    try {
      const d = _mcCurrentData;
      const st = d.staff;
      // 1) Fermeture enregistrée + réservations des créneaux non terminés suspendues
      const heure = isToday ? _heureCourante() : '00:00';
      let resultat;
      try {
        resultat = await fermerPlage(date, heure, motif(), prec());
      } catch (e) {
        throw new Error((/fermetures|suspendu|check constraint|schema cache/i.test(e.message || '')
          ? 'la base de données n\'est pas encore à jour (script supabase/migration-fermetures.sql à exécuter dans Supabase). '
          : '') + (e.message || e));
      }
      st.fermee = true;
      st.fermee_motif = motif();
      st.fermee_precision = prec();
      st.fermee_heure = heure;
      st.fermee_id = resultat.fermeture.id;
      st.fermee_suspendues = resultat.suspendues;
      delete st.fermee_annonce_id; delete st.fermee_annonce_prec;
      if (isToday && notif() && typeof createAnnonce === 'function') {
        // On garde l'annonce en cours pour la remettre à la réouverture
        const prev = await getActiveAnnonce();
        if (prev && !(typeof parseFermetureAnnonce === 'function' && parseFermetureAnnonce(prev))) st.fermee_annonce_prec = prev.contenu;
        const created = await createAnnonce(fermetureContenu(date, _mcMessageFermeture(st.fermee_motif, st.fermee_precision)));
        st.fermee_annonce_id = created.id;
      }
      if (!d.notes) d.notes = [];
      d.notes.unshift({
        ts: isToday ? Date.now() : new Date(date + 'T12:00:00').getTime(),
        text: 'Plage fermée' + (isToday ? ' à ' + heure.replace(':', 'h') : '') + ' — ' + st.fermee_motif + (st.fermee_precision ? ' : ' + st.fermee_precision : '')
          + ' · ' + resultat.suspendues + ' réservation' + (resultat.suspendues > 1 ? 's' : '') + ' suspendue' + (resultat.suspendues > 1 ? 's' : ''),
        reporter: _lsGet(MC_REPORTER_KEY), type: 'fermeture',
      });
      await _mcSave(date, d);
      close();
      onDone();
    } catch (e) {
      ok.disabled = false; ok.textContent = 'Fermer la plage';
      err.textContent = 'Enregistrement impossible : ' + (e.message || e);
    }
  });

  dlg.showModal();
}

function _renderNotes(notes) {
  if (!notes || notes.length === 0) {
    return '<div class="planning-empty" style="padding:12px 0">Rien de noté pour l\'instant.</div>';
  }
  // Ordre chronologique inverse (le plus récent en haut) ; l'index d'origine sert à la suppression
  return notes
    .map((n, i) => ({ n, i }))
    .sort((a, b) => b.n.ts - a.n.ts)
    .map(({ n, i }) =>
      '<div class="mc-note-item' + (n.type ? ' mc-note-' + n.type : '') + '">'
      + '<span class="mc-note-time">' + _fmt(n.ts) + '</span>'
      + '<span class="mc-note-tag">' + ({ police: 'Police', fermeture: 'Fermeture', reouverture: 'Réouverture' }[n.type] || '') + '</span>'
      + '<span class="mc-note-reporter">' + _escHtml(n.reporter || '') + '</span>'
      + '<span class="mc-note-text">' + _escHtml(n.text) + '</span>'
      + '<button class="mc-note-del" data-idx="' + i + '" title="Supprimer" aria-label="Supprimer cette entrée">✕</button>'
      + '</div>'
    ).join('');
}

function _bindNoteDelete(date, container) {
  container.querySelectorAll('.mc-note-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const d = _mcCurrentData;
        if (!d) return;
        const n = d.notes[parseInt(btn.dataset.idx)];
        if (!n) return;
        if (!confirm(n.type === 'police' ? 'Supprimer ce passage de la police ?' : 'Supprimer cette note ?')) return;
        d.notes.splice(parseInt(btn.dataset.idx), 1);
        const wasPolice = n.type === 'police';
        if (wasPolice) _mcSyncPolice(d);
        await _mcSave(date, d);
        if (wasPolice) { renderMc(container, date).catch(console.error); return; }
        document.getElementById('mc-notes-list').innerHTML = _renderNotes(d.notes);
        _bindNoteDelete(date, container);
      } catch (e) {
        console.error('MC save error:', e);
      }
    });
  });
}

if (typeof module !== 'undefined') {
  module.exports = { renderMc };
}
