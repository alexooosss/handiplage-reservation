// tests/test-inscription-publique.js
'use strict';
const assert = require('assert');

// Simuler les fonctions de validation (extraites de inscription-publique.js)
// On les injecte ici directement pour tester sans browser

function validatePublicForm(data) {
  const errors = [];
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

// Données minimales valides
const valid = {
  nom: 'DUPONT', prenom: 'Marie',
  dobJ: '15', dobM: '3', dobY: '1958',
  telephone: '06 00 00 00 00',
  mail: 'marie@test.fr', mail2: 'marie@test.fr',
  contact: ['mail'],
  adresse: '12 rue de la Plage', cp: '06600', ville: 'Antibes', pays: 'France',
  urgNom: 'Pierre Dupont', urgTel: '06 11 22 33 44',
  accomp: ['aucun'],
  gilet: 'oui',
  rgpd: true, ccas: 'accepte', reglement: true,
  signature: 'Marie DUPONT',
};

// Test 1 : formulaire valide → aucune erreur
const e1 = validatePublicForm(valid);
assert.strictEqual(e1.length, 0, 'Formulaire valide attendu : ' + JSON.stringify(e1));
console.log('✓ Formulaire valide → 0 erreurs');

// Test 2 : nom manquant
const e2 = validatePublicForm({ ...valid, nom: '' });
assert.ok(e2.some(e => e.includes('Nom')), 'Doit signaler le nom manquant');
console.log('✓ Nom manquant → erreur détectée');

// Test 3 : mails différents
const e3 = validatePublicForm({ ...valid, mail2: 'autre@test.fr' });
assert.ok(e3.some(e => e.includes('correspondent pas')), 'Doit signaler les mails différents');
console.log('✓ Mails différents → erreur détectée');

// Test 4 : date de naissance incomplète
const e4 = validatePublicForm({ ...valid, dobM: '' });
assert.ok(e4.some(e => e.includes('naissance')), 'Doit signaler la date incomplète');
console.log('✓ Date incomplète → erreur détectée');

// Test 5 : accompagnement vide
const e5 = validatePublicForm({ ...valid, accomp: [] });
assert.ok(e5.some(e => e.includes('accompagnement')), 'Doit signaler accompagnement vide');
console.log('✓ Accompagnement vide → erreur détectée');

// Test 6 : RGPD non coché
const e6 = validatePublicForm({ ...valid, rgpd: false });
assert.ok(e6.some(e => e.includes('RGPD')), 'Doit signaler RGPD non coché');
console.log('✓ RGPD non coché → erreur détectée');

console.log('✓ test-inscription-publique.js OK');
