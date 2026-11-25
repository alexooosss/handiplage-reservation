// js/capacites-ui.js — réglage des places (staff) : fenêtre partagée Planning / fenêtre de créneau
'use strict';

function _escCap(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// opts : { date, creneauId?, portee: 'creneau'|'matin'|'apresmidi'|'journee', depart: {totale, groupes, groupeId}, onDone }
function ouvrirReglageCapacite(opts) {
  const old = document.getElementById('cap-dlg');
  if (old) old.remove();
  const slot  = opts.creneauId ? SLOTS.find(s => s.id === opts.creneauId) : null;
  const jour  = new Date(opts.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const dep   = opts.depart || { totale: CAPA_DEFAUT.totale, groupes: CAPA_DEFAUT.groupes, groupeId: null };
  // On règle directement les places usagers et les places groupes ; la capacité totale en découle
  let usagers = Math.max(0, dep.totale - dep.groupes), groupes = dep.groupes, portee = opts.portee || (slot ? 'creneau' : 'journee');
  const groupesListe = (typeof getCachedGroupes === 'function') ? getCachedGroupes() : [];

  const portees = [
    slot ? { id: 'creneau', label: 'Ce créneau' } : null,
    { id: 'matin', label: 'Le matin (8h30 → 12h15)' },
    { id: 'apresmidi', label: 'L\'après-midi (12h30 → 18h15)' },
    { id: 'journee', label: 'La journée' },
    { id: 'periode', label: 'Jusqu\'au…' },
  ].filter(Boolean);

  const dlg = document.createElement('dialog');
  dlg.id = 'cap-dlg';
  dlg.className = 'cap-dlg';
  dlg.setAttribute('aria-labelledby', 'cap-dlg-t');
  dlg.innerHTML = '<form method="dialog" class="cap-f">'
    + '<div class="cap-hd"><h2 id="cap-dlg-t">Places · ' + _escCap(jour.charAt(0).toUpperCase() + jour.slice(1)) + (slot ? ' · ' + _escCap(slot.label) : '') + '</h2>'
    +   '<button type="button" class="cap-x" id="cap-x" aria-label="Fermer">✕</button></div>'
    + '<div class="cap-bd">'
    +   '<div class="cap-bloc cap-bloc-us">'
    +     '<div class="cap-st"><span>Places usagers<small>réservations en ligne · normalement ' + (CAPA_DEFAUT.totale - CAPA_DEFAUT.groupes) + '</small></span>'
    +       '<div class="cap-stp"><button type="button" data-k="usagers" data-d="-1" aria-label="Retirer une place usager">−</button><output id="cap-us"></output><button type="button" class="p" data-k="usagers" data-d="1" aria-label="Ajouter une place usager">+</button></div></div>'
    +     '<p class="cap-hint" id="cap-hint-us"></p>'
    +   '</div>'
    +   '<div class="cap-bloc cap-bloc-gp">'
    +     '<div class="cap-st"><span>Places groupes<small>normalement ' + CAPA_DEFAUT.groupes + '</small></span>'
    +       '<div class="cap-stp"><button type="button" data-k="groupes" data-d="-1" aria-label="Retirer une place groupe">−</button><output id="cap-gp"></output><button type="button" class="p" data-k="groupes" data-d="1" aria-label="Ajouter une place groupe">+</button></div></div>'
    +     '<div class="cap-st cap-st-grp"><label for="cap-grp">Pour quel groupe ?</label>'
    +       '<select id="cap-grp"><option value="">Tous les groupes</option>'
    +         groupesListe.map(g => '<option value="' + _escCap(g.id) + '"' + (g.id === dep.groupeId ? ' selected' : '') + '>' + _escCap(g.nom) + '</option>').join('')
    +       '</select></div>'
    +     '<p class="cap-hint" id="cap-hint-gp"></p>'
    +   '</div>'
    +   '<div class="cap-calc"><span>Capacité totale de la plage<small>usagers + groupes</small></span><b id="cap-tot"></b></div>'
    +   '<div class="cap-port"><span class="cap-port-l">Appliquer à</span><div class="cap-chips" role="radiogroup">'
    +     portees.map(p => '<label class="cap-chip"><input type="radio" name="cap-portee" value="' + p.id + '"' + (p.id === portee ? ' checked' : '') + '><span>' + p.label + '</span></label>').join('')
    +   '</div><div class="cap-per" id="cap-per" hidden><label>du ' + _escCap(new Date(opts.date + 'T12:00:00').toLocaleDateString('fr-FR')) + ' au <input type="date" id="cap-fin" min="' + opts.date + '" value="' + opts.date + '"></label>'
    +     '<span class="cap-hint">sur tous les créneaux de chaque jour</span></div></div>'
    +   '<p class="cap-note">Les réservations déjà faites sont toujours gardées : seules les nouvelles réservations en ligne sont limitées. Le staff peut dépasser la limite.</p>'
    +   '<p class="cap-err" id="cap-err" role="alert"></p>'
    + '</div>'
    + '<div class="cap-acts">'
    +   '<button type="button" class="cap-reset" id="cap-reset">Revenir à la normale</button>'
    +   '<button type="button" class="cap-ok" id="cap-ok">Enregistrer</button>'
    + '</div></form>';
  document.body.appendChild(dlg);

  const el = id => dlg.querySelector('#' + id);
  function maj() {
    el('cap-us').textContent = usagers;
    el('cap-gp').textContent = groupes;
    el('cap-tot').textContent = usagers + groupes;
    const ecart = (n, base, zero) => n === 0 ? zero
      : n > base ? '+' + (n - base) + ' par rapport à la normale'
      : n < base ? (base - n) + ' de moins que la normale' : 'Comme d\'habitude';
    el('cap-hint-us').textContent = ecart(usagers, CAPA_DEFAUT.totale - CAPA_DEFAUT.groupes, 'Aucune réservation en ligne possible : fermé aux usagers');
    el('cap-hint-gp').textContent = ecart(groupes, CAPA_DEFAUT.groupes, 'Aucune place pour les groupes');
    portee = (dlg.querySelector('input[name="cap-portee"]:checked') || {}).value || portee;
    el('cap-per').hidden = portee !== 'periode';
  }
  dlg.querySelectorAll('.cap-stp button').forEach(b => b.addEventListener('click', () => {
    const d = parseInt(b.dataset.d, 10);
    if (b.dataset.k === 'usagers') usagers = Math.max(0, Math.min(300 - groupes, usagers + d));
    else groupes = Math.max(0, Math.min(300 - usagers, groupes + d));
    maj();
  }));
  dlg.addEventListener('change', maj);
  maj();

  // Dates × créneaux concernés selon la portée choisie
  function cible() {
    let dates = [opts.date], slots;
    if (portee === 'creneau') slots = [opts.creneauId];
    else if (portee === 'matin') slots = DEMI_JOURNEES.matin;
    else if (portee === 'apresmidi') slots = DEMI_JOURNEES.apresmidi;
    else slots = SLOTS.map(s => s.id);
    if (portee === 'periode') {
      const fin = el('cap-fin').value;
      if (!fin || fin < opts.date) throw new Error('Choisissez une date de fin valide.');
      dates = datesEntre(opts.date, fin);
    }
    return { dates, slots };
  }

  const close = () => { if (dlg.open) dlg.close(); dlg.remove(); };
  el('cap-x').addEventListener('click', close);
  dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });

  async function agir(fn) {
    const err = el('cap-err');
    err.textContent = '';
    dlg.querySelectorAll('.cap-acts button').forEach(b => { b.disabled = true; });
    try {
      await fn(cible());
      close();
      if (opts.onDone) opts.onDone();
    } catch (e) {
      dlg.querySelectorAll('.cap-acts button').forEach(b => { b.disabled = false; });
      err.textContent = (/capacites|schema cache/i.test(e.message || '')
        ? 'La base n\'est pas encore à jour (script supabase/migration-capacites.sql à exécuter dans Supabase). ' : '')
        + (e.message || e);
    }
  }
  el('cap-ok').addEventListener('click', () => agir(c => enregistrerCapacites(c.dates, c.slots, usagers + groupes, groupes, el('cap-grp').value || null)));
  el('cap-reset').addEventListener('click', () => agir(c => retablirCapacites(c.dates, c.slots)));

  dlg.showModal();
}

// Menu de l'en-tête d'un jour dans le Planning
function ouvrirMenuJournee(ancre, dateISO, index, onDone) {
  const old = document.getElementById('cap-menu');
  if (old) { old.remove(); if (old.dataset.date === dateISO) return; }
  const jour = new Date(dateISO + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const m = document.createElement('div');
  m.id = 'cap-menu';
  m.className = 'cap-menu';
  m.dataset.date = dateISO;
  m.setAttribute('role', 'menu');
  m.innerHTML = '<p class="cap-menu-t">' + _escCap(jour.charAt(0).toUpperCase() + jour.slice(1)) + '</p>'
    + '<button type="button" role="menuitem" data-a="journee">Régler les places de la journée…</button>'
    + '<button type="button" role="menuitem" data-a="matin">Réserver le matin à un groupe…<small>8h30 → 12h15 (2 créneaux)</small></button>'
    + '<button type="button" role="menuitem" data-a="apresmidi">Réserver l\'après-midi à un groupe…<small>12h30 → 18h15 (3 créneaux)</small></button>'
    + '<button type="button" role="menuitem" data-a="fermer">Fermer la journée aux réservations en ligne</button>'
    + '<hr>'
    + '<button type="button" role="menuitem" data-a="periode">Appliquer à une période…</button>'
    + '<button type="button" role="menuitem" data-a="normal" class="cap-menu-danger">Revenir à la normale</button>';
  document.body.appendChild(m);
  const r = ancre.getBoundingClientRect();
  m.style.top = (window.scrollY + r.bottom + 6) + 'px';
  m.style.left = Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - m.offsetWidth - 8)) + 'px';

  const fermer = () => { m.remove(); document.removeEventListener('mousedown', dehors); document.removeEventListener('keydown', echap); };
  const dehors = e => { if (!m.contains(e.target) && !ancre.contains(e.target)) fermer(); };
  const echap  = e => { if (e.key === 'Escape') { fermer(); ancre.focus(); } };
  setTimeout(() => { document.addEventListener('mousedown', dehors); document.addEventListener('keydown', echap); }, 0);

  const depart = capaciteDe(index, dateISO, 1);
  m.querySelectorAll('button').forEach(b => b.addEventListener('click', async () => {
    const a = b.dataset.a;
    fermer();
    if (a === 'fermer') {
      if (!confirm('Fermer toute la journée aux réservations en ligne ?\n\nLes réservations déjà faites sont gardées. Les groupes et le staff peuvent toujours réserver.')) return;
      try { await enregistrerCapacites([dateISO], SLOTS.map(s => s.id), CAPA_DEFAUT.groupes, CAPA_DEFAUT.groupes, null); if (onDone) onDone(); }
      catch (e) { alert('Enregistrement impossible : ' + (e.message || e)); }
      return;
    }
    if (a === 'normal') {
      if (!confirm('Revenir à la capacité normale sur toute la journée ?')) return;
      try { await retablirCapacites([dateISO], SLOTS.map(s => s.id)); if (onDone) onDone(); }
      catch (e) { alert('Enregistrement impossible : ' + (e.message || e)); }
      return;
    }
    // Réserver une demi-journée à un groupe : on part de places groupes = capacité (0 usager), à ajuster
    const dep = (a === 'matin' || a === 'apresmidi')
      ? { totale: depart.totale, groupes: depart.totale, groupeId: null }
      : depart;
    ouvrirReglageCapacite({ date: dateISO, portee: a, depart: dep, onDone: onDone });
  }));
  const premier = m.querySelector('button');
  if (premier) premier.focus();
}
