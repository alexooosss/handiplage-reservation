# Pass Handiplage — Design Spec
**Date :** 2026-06-30  
**Périmètre :** Système de pass lié aux inscriptions validées, décompte automatique des réservations mensuelles

---

## Contexte

Les inscriptions existent avec un statut (en_attente / valide / refusé). Les réservations de plage (créneaux × emplacements) ne sont actuellement pas liées aux inscriptions. Ce spec introduit un pass saisonnier qui donne 40 réservations par mois aux inscrits validés, décrémenté automatiquement lors de la création d'une réservation.

---

## Modèle de données

### Champ ajouté à l'inscription

```js
inscription.pass = {
  actif: boolean,
  activatedAt: string // ISO date "2026-06-15"
} | null
```

- `null` = pas de pass activé
- `actif: false` = pass désactivé manuellement
- `actif: true` = pass en cours

### Champ ajouté à chaque réservation

```js
reservation.inscriptionId = string | null
```

- `null` = réservation sans lien inscrit (walk-in ou nom libre)
- `string` = identifiant de l'inscription liée (déduit du décompte mensuel)

La structure existante des réservations (stockées par date + slotId dans localStorage) est étendue avec ce champ optionnel, sans rupture de compatibilité.

---

## Règles métier

### Validité saisonnière
- Pass valide : **juin à septembre** (mois 6 à 9)
- Hors saison : pass affiché comme "Hors saison", aucune réservation possible via le pass

### Quota mensuel
- **40 réservations par mois calendaire**
- Reset automatique le 1er de chaque mois (le calcul est dérivé des données, pas d'état stocké)
- Les quotas ne s'accumulent pas d'un mois à l'autre

### Calcul du solde restant
```
getPassRemaining(inscriptionId):
  moisCourant = "YYYY-MM"
  scanner toutes les réservations du mois (toutes dates, tous créneaux)
  count = nombre de resas où inscriptionId === X
  return max(0, 40 - count)
```

Le solde est toujours calculé en live — aucun compteur stocké. L'annulation d'une résa recredite immédiatement le solde.

### Blocage à l'épuisement
- Solde = 0 → réservation **impossible** (blocage strict)
- Message d'erreur affiché au staff
- Le staff ne peut pas forcer la réservation
- L'usager devra venir sans réservation jusqu'au 1er du mois suivant

---

## Interface — Fiche inscription

### Bloc "Pass Handiplage" (affiché uniquement si statut = "valide")

**Pass inactif :**
```
🎫 Pass Handiplage
[Activer le pass]
```

**Pass actif :**
```
🎫 Pass Handiplage                          ● Actif depuis le 15/06/2026
Saison : juin → septembre 2026

Ce mois (juillet) :  28 / 40 restantes
████████████████████░░░░  70%
Réinitialisation le 01/08/2026

                                   [Désactiver le pass]
```

**Hors saison :**
```
🎫 Pass Handiplage                          ○ Hors saison
Pass valide de juin à septembre.
```

### Comportement
- Activation → `pass = { actif: true, activatedAt: today }` sauvegardé
- Désactivation → `pass.actif = false`
- Réactivation → `activatedAt` mis à jour
- Bloc absent si statut ≠ "valide"
- Compteur mis à jour en temps réel (recalculé à chaque ouverture de fiche)

---

## Interface — Création de réservation (autocomplete)

### Flux
1. Staff tape un nom dans le champ de réservation existant
2. Si ≥ 2 caractères : filtre les inscriptions avec `pass.actif = true` dont nom/prénom correspond
3. Dropdown affiché sous le champ avec les suggestions
4. Chaque suggestion affiche : **NOM Prénom** + solde (ex: `28 rés. restantes`)
5. Si solde = 0 : suggestion grisée + label "Pass épuisé ce mois"
6. Staff sélectionne → `inscriptionId` associé à la résa en cours
7. Staff ignore les suggestions → résa normale sans `inscriptionId` (pas de décompte)

### Validation à la sauvegarde
- Si `inscriptionId` défini ET solde = 0 → blocage + message d'erreur
- Si `inscriptionId` défini ET solde > 0 → réservation enregistrée avec `inscriptionId`
- Si pas d'`inscriptionId` → comportement actuel inchangé

---

## Nouveau module : `js/pass.js`

Fonctions exportées :

```js
getPassRemaining(inscriptionId)   // → number (0-40)
getPassMonthLabel()               // → "juillet 2026"
getPassResetDate()                // → "01/08/2026"
isPassSeason()                    // → bool (mois courant ∈ [6..9])
getInscriptionsWithActivePass()   // → inscription[] filtrées et triées
```

Ce module est chargé avant `panel.js` et `inscription.js` dans index.html.

---

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `js/pass.js` | Nouveau — logique pass et décompte |
| `js/inscription.js` | Bloc pass dans `_showForm()` |
| `js/panel.js` | Autocomplete + validation blocage |
| `js/storage.js` | `inscriptionId` dans les réservations |
| `index.html` | Chargement de `pass.js` |
| `css/style.css` | Styles bloc pass + dropdown autocomplete |

---

## Hors périmètre

- Historique des réservations passées par inscrit (pas de vue dédiée)
- Export / rapport mensuel des usages de pass
- Notification automatique à l'usager
- Gestion multi-saison (les données 2026 sont suffisantes)
