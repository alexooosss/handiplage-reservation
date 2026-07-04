// js/inscription-publique.js
'use strict';

function _escP(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function validatePublicForm(data) {
  var errors = [];
  if (!data.nom)                errors.push('Nom requis');
  if (!data.prenom)             errors.push('Prénom requis');
  if (!data.dobJ || !data.dobM || !data.dobY) errors.push('Date de naissance complète requise');
  if (!data.telephone)          errors.push('Téléphone requis');
  if (!data.mail)               errors.push('Adresse mail requise');
  if (!data.mail2)              errors.push('Confirmation mail requise');
  if (data.mail && data.mail2 && data.mail !== data.mail2) errors.push('Les deux adresses mail ne correspondent pas');
  if (!data.contact || data.contact.length === 0) errors.push('Modalité de contact préférée requise');
  if (!data.adresse)            errors.push('Adresse requise');
  if (!data.cp)                 errors.push('Code postal requis');
  if (!data.ville)              errors.push('Ville requise');
  if (!data.pays)               errors.push('Pays requis');
  if (!data.urgNom)             errors.push('Nom du contact d\'urgence requis');
  if (!data.urgTel)             errors.push('Téléphone du contact d\'urgence requis');
  if (!data.accomp || data.accomp.length === 0) errors.push('Besoin d\'accompagnement requis');
  if (!data.gilet)              errors.push('Réponse sur le gilet de sauvetage requise');
  if (!data.rgpd)               errors.push('Attestation RGPD requise');
  if (!data.ccas)               errors.push('Réponse communications CCAS requise');
  if (!data.reglement)          errors.push('Règlement de fonctionnement requis');
  if (!data.signature)          errors.push('Signature requise');
  return errors;
}

function _collectFormData() {
  var g  = function(id) { return document.getElementById(id); };
  var gv = function(id) { var el = g(id); return el ? el.value.trim() : ''; };
  var gr = function(name) { var el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; };
  var ga = function(name) { return Array.from(document.querySelectorAll('input[name="' + name + '"]:checked')).map(function(el) { return el.value; }); };
  return {
    nom:        gv('f-nom').toUpperCase(),
    prenom:     gv('f-prenom'),
    dobJ:       gv('f-dob-j'),
    dobM:       gv('f-dob-m'),
    dobY:       gv('f-dob-y'),
    telephone:  gv('f-tel'),
    mail:       gv('f-mail'),
    mail2:      gv('f-mail2'),
    contact:    ga('contact'),
    adresse:    gv('f-adresse'),
    cp:         gv('f-cp'),
    ville:      gv('f-ville'),
    pays:       gv('f-pays'),
    urgNom:     gv('f-urg-nom'),
    urgTel:     gv('f-urg-tel'),
    accomp:     ga('accomp'),
    at:         ga('at'),
    gilet:      gr('gilet'),
    rgpd:       !!(g('f-rgpd') && g('f-rgpd').checked),
    ccas:       gr('ccas'),
    reglement:  !!(g('f-reglement') && g('f-reglement').checked),
    signature:  gv('f-signature'),
  };
}

function _readFiles(input1, input2, callback) {
  function readOne(input, cb) {
    if (!input || !input.files || input.files.length === 0) { cb(null, ''); return; }
    var file = input.files[0];
    var reader = new FileReader();
    reader.onload = function(e) { cb(e.target.result, file.name); };
    reader.readAsDataURL(file);
  }
  readOne(input1, function(b64a, nameA) {
    readOne(input2, function(b64b, nameB) {
      callback(b64a, nameA, b64b, nameB);
    });
  });
}

function initInscriptionPublique() {
  var form    = document.getElementById('pub-form');
  var errEl   = document.getElementById('pub-errors');
  var succEl  = document.getElementById('pub-success');
  var submitBtn = document.getElementById('pub-submit');
  if (!form) return;

  // Exclusivité "aucun" accompagnement
  var accompAucun = document.getElementById('accomp-aucun');
  if (accompAucun) {
    var accompOthers = document.querySelectorAll('input[name="accomp"]:not([value="aucun"])');
    accompAucun.addEventListener('change', function() {
      if (accompAucun.checked) accompOthers.forEach(function(el) { el.checked = false; });
    });
    accompOthers.forEach(function(el) {
      el.addEventListener('change', function() { if (el.checked) accompAucun.checked = false; });
    });
  }

  // Exclusivité "aucun" aides techniques
  var atAucun = document.getElementById('at-aucun');
  if (atAucun) {
    var atOthers = document.querySelectorAll('input[name="at"]:not([value="aucun"])');
    atAucun.addEventListener('change', function() {
      if (atAucun.checked) atOthers.forEach(function(el) { el.checked = false; });
    });
    atOthers.forEach(function(el) {
      el.addEventListener('change', function() { if (el.checked) atAucun.checked = false; });
    });
  }

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    errEl.innerHTML = '';
    errEl.classList.remove('visible');

    var data   = _collectFormData();
    var errors = validatePublicForm(data);

    // Validation fichier obligatoire
    var doc1Input = document.getElementById('f-doc1');
    if (!doc1Input || !doc1Input.files || doc1Input.files.length === 0) {
      errors.push('Document justificatif principal requis (CMI recto-verso)');
    }

    if (errors.length > 0) {
      errEl.innerHTML = errors.map(function(e) { return '<p>• ' + _escP(e) + '</p>'; }).join('');
      errEl.classList.add('visible');
      errEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours…';

    _readFiles(
      document.getElementById('f-doc1'),
      document.getElementById('f-doc2'),
      function(b64a, nameA, b64b, nameB) {
        var inscData = {
          statut:            'en_attente',
          nom:               data.nom,
          prenom:            data.prenom,
          mail:              data.mail,
          telephone:         data.telephone,
          metadata: {
            mailConfirm:       data.mail2,
            dateNaissance:     { jour: parseInt(data.dobJ), mois: parseInt(data.dobM), annee: parseInt(data.dobY) },
            contactPreference: data.contact,
            adresse:           data.adresse,
            codePostal:        data.cp,
            ville:             data.ville,
            pays:              data.pays,
            urgenceNom:        data.urgNom,
            urgenceTel:        data.urgTel,
            accompagnement:    data.accomp,
            aidesTechniques:   data.at,
            gilet:             data.gilet,
            rgpd:              data.rgpd,
            ccasCommunications: data.ccas,
            reglement:         data.reglement,
            signature:         data.signature,
            justificatif1:     b64a || null,
            justificatif1Name: nameA || '',
            justificatif2:     b64b || null,
            justificatif2Name: nameB || '',
          },
        };

        supabaseClient.from('inscriptions').insert({
          nom:       inscData.nom,
          prenom:    inscData.prenom,
          mail:      inscData.mail,
          telephone: inscData.telephone,
          statut:    'en_attente',
          metadata:  inscData.metadata,
        }).then(function(result) {
          if (result.error) {
            errEl.innerHTML = '<p>Erreur lors de l\'envoi : ' + _escP(result.error.message) + '</p>';
            errEl.classList.add('visible');
            submitBtn.disabled = false;
            submitBtn.textContent = 'VALIDER MA DEMANDE D\'INSCRIPTION';
            return;
          }
          form.style.display = 'none';
          succEl.style.display = 'block';
          succEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    );
  });
}

if (typeof module !== 'undefined') {
  module.exports = { validatePublicForm };
}
