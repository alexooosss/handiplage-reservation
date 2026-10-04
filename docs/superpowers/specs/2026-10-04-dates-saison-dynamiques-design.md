# Dates de saison pilotées par la base — Design Spec
**Date :** 2026-10-04
**Périmètre :** Déplacer `SEASON_START`/`SEASON_END` (actuellement codées en dur dans `js/slots.js`) vers la base de données, pilotées par le bouton staff "Ouvrir la saison" déjà existant.

---

## Contexte

`js/slots.js` définit `SEASON_START`/`SEASON_END` comme constantes figées (`'2026-06-12'`/`'2026-09-15'`). Elles pilotent : le blocage des réservations en fin de saison (`createUserReservation`), l'affichage de l'écran "Saison terminée" (`renderReserver`), les nouveaux écrans ajoutés cette session (accueil et "Mes réservations" adaptés en fin de saison), et un texte statique affiché dans `usager.html` et `inscription-publique.html`.

Ce mécanisme est **totalement indépendant** du système de renouvellement d'inscriptions construit plus tôt (`app_config.saison_courante`, piloté par le bouton "Ouvrir la saison"). Résultat : chaque année, en plus de cliquer "Ouvrir la saison", il faudrait éditer `js/slots.js` à la main et redéployer — une étape manuelle facile à oublier. Ce spec fusionne les deux : le bouton "Ouvrir la saison" devient le geste unique qui met à jour à la fois `saison_courante` ET les dates d'ouverture/fermeture de la plage.

---

## Modèle de données

Deux colonnes ajoutées à `app_config` (même ligne singleton que `saison_courante`) :

```sql
ALTER TABLE app_config ADD COLUMN saison_debut date;
ALTER TABLE app_config ADD COLUMN saison_fin date;

UPDATE app_config SET saison_debut = '2026-06-12', saison_fin = '2026-09-15' WHERE id = 1;
```

### RLS

La policy `app_config_read_all` passe de `TO authenticated` à `TO anon, authenticated` — même traitement que `creneaux_public_read`, déjà publique. Nécessaire pour que la page d'inscription publique (non connectée) puisse afficher les dates. Aucune donnée sensible n'est exposée (dates d'ouverture de plage, déjà publiques dans le HTML aujourd'hui).

```sql
ALTER POLICY "app_config_read_all" ON app_config TO anon, authenticated;
```

La policy d'écriture (`app_config_staff_write`) reste inchangée (`TO authenticated`, staff uniquement).

---

## Couche données — `js/supabase-config.js`

```js
getSaisonDates()                          // → { debut: '2026-06-12', fin: '2026-09-15' }
ouvrirNouvelleSaison(saisonDebut, saisonFin)  // écrit saison_courante+1, saison_debut, saison_fin en une requête
```

`getSaisonDates()` garde un petit cache mémoire (même esprit que `getCachedInscriptions()`) pour éviter une requête réseau à chaque vue usager qui en a besoin dans une même session de page. `ouvrirNouvelleSaison()` met à jour ce cache après écriture.

`ouvrirNouvelleSaison()` change de signature (0 → 2 arguments) — c'est un changement cassant assumé, son seul appelant (`js/inscription.js`) est mis à jour dans la même tâche.

---

## `js/slots.js`

- `SEASON_START`/`SEASON_END` supprimées (plus de constante figée).
- `isWithinSeason(iso, seasonStart, seasonEnd)` et `clampToSeasonEnd(iso, seasonEnd)` deviennent des fonctions pures classiques : les bornes sont des paramètres, plus une dépendance cachée à un global du module. Même logique que `computePassBalance(reservations, quota)` qui prend déjà son quota en paramètre plutôt que de lire un global.
- `SLOTS`, `getSlotStatus`, `getActiveSlot`, `getSlotById`, `timeToMinutes`, etc. (créneaux horaires, pas de dates de saison) : inchangés.

---

## Consommateurs (tous déjà `async` — pas de refonte d'architecture)

| Fichier | Changement |
|---|---|
| `js/usager-storage.js` (`createUserReservation`) | `await getSaisonDates()` avant la vérification de fermeture saisonnière, au lieu de lire `SEASON_END` |
| `js/usager-reserver.js` (`renderReserver`) | idem pour l'écran "Saison terminée" + `clampToSeasonEnd`/filtrage des jours disponibles |
| `js/usager-accueil.js` | idem pour `seasonOver` + l'année affichée dans la carte "Saison {année}" |
| `js/usager-reservations.js` | idem |

Si `getSaisonDates()` échoue (réseau indisponible), l'erreur remonte au `catch` déjà présent dans chaque vue (`container.innerHTML = 'Erreur : ...'`) — pas de date de repli codée en dur qui masquerait silencieusement un vrai problème.

---

## Flux "Ouvrir la saison" (`js/inscription.js` + nouvelle modale dans `js/modal.js`)

Le `confirm()` actuel est remplacé par une modale (`openOpenSeasonModal`, même famille que les modales existantes de `js/modal.js`, construite sur `<dialog id="app-modal">`) :

```
┌─ Ouvrir la saison 2027 ───────────────┐
│ Date de début   [____________]         │
│ Date de fin     [____________]         │
│                                         │
│ Tous les comptes usagers validés pour  │
│ la saison 2026 devront renouveler leur │
│ inscription pour continuer à réserver. │
│                                         │
│              [Annuler]  [Confirmer]    │
└─────────────────────────────────────────┘
```

- Champs pré-remplis avec les dates actuelles (`getSaisonDates()`).
- Validation : date de début < date de fin (sinon message d'erreur inline, pas de soumission).
- Confirmer → `ouvrirNouvelleSaison(debut, fin)` → `renderInscription(container, selectedId)` (comme aujourd'hui).

---

## Texte statique → dynamique (`usager.html`, `inscription-publique.html`)

Le `<span>` affichant "12 juin – 15 sept. 2026" **garde son texte actuel comme repli visuel immédiat** dans le HTML (rien ne casse si JS est lent ou échoue) — il se fait écraser dès que `getSaisonDates()` répond. Amélioration progressive, pas de nouvel état d'erreur à gérer sur ce texte cosmétique : en cas d'échec de la requête, le texte codé en dur reste affiché tel quel.

- `usager.html` : câblé dans `js/usager-app.js` → `init()` (déjà exécuté au chargement, déjà `await getSaisonCourante()` en parallèle — `getSaisonDates()` rejoint le même `Promise.all`).
- `inscription-publique.html` : pas d'init existant dans `js/inscription-publique.js` — un petit bloc ajouté en fin de fichier, exécuté au chargement du script. Nécessite d'ajouter `<script src="js/supabase-config.js"></script>` à `inscription-publique.html` (absent aujourd'hui).

Format d'affichage : `"{j} {mois long} – {j} {mois court} {année}"` (ex: "12 juin – 15 sept. 2026"), via `toLocaleDateString('fr-FR', ...)` — reproduit le format actuel exactement.

---

## Tests (fonctions pures)

- `isWithinSeason(iso, seasonStart, seasonEnd)` / `clampToSeasonEnd(iso, seasonEnd)` dans `tests/test-slots.js` : mêmes cas qu'aujourd'hui, adaptés à la nouvelle signature (bornes passées explicitement plutôt que lues sur le module).
- Pas de test pour `getSaisonDates()`/`ouvrirNouvelleSaison()` (wrappers Supabase asynchrones, même convention que `getSaisonCourante()` qui n'a pas de test dédié).
- Pas de test pour la modale ni pour les vues usager (DOM, même convention que le reste de ces fichiers).

---

## Migration / application en base

Comme pour toutes les évolutions de schéma de ce projet (pas de migration runner), le bloc SQL (colonnes + seed + policy) est fourni séparément pour exécution manuelle par l'utilisateur dans l'éditeur SQL Supabase, en plus d'être reflété dans `supabase/schema.sql`/`supabase/rls.sql`.

---

## Hors périmètre

- Validation d'un chevauchement entre l'ancienne et la nouvelle saison (le staff est seul responsable de la cohérence des dates saisies).
- Historique des saisons passées (une seule ligne, écrasée à chaque ouverture — comme `saison_courante` aujourd'hui).
- Le texte "Demande d'inscription 2026" dans l'en-tête de `inscription-publique.html` (année de la saison d'inscription, concept différent des dates d'ouverture de plage — non traité ici).
