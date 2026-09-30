# Renouvellement saisonnier des inscriptions — Design Spec
**Date :** 2026-09-30
**Périmètre :** Gating de l'accès usager à la validité d'une inscription pour la saison en cours + auto-attribution du pass à la validation

---

## Contexte

`inscriptions.statut` (en_attente / valide / refuse) est aujourd'hui permanent : une fois `valide`, un compte reste actif indéfiniment, saison après saison. Or l'inscription est annuelle — un usager doit renouveler sa demande chaque saison, et son compte ne doit pas rester automatiquement actif s'il ne l'a pas fait.

Décisions actées en amont :
- Le renouvellement est un **flux unique** : l'usager soumet une demande de renouvellement, le staff décide en interne (via l'interface existante) s'il revalide direct ou redemande des justificatifs — pas de parcours technique distinct entre "reconduction" et "dossier complet".
- Le basculement de saison est **déclenché manuellement par le staff** (pas de date pivot automatique).
- Le pass Handiplage (`pass_actif`) est **auto-attribué à chaque validation** (1ère inscription ou renouvellement), avec possibilité pour le staff de le désactiver ensuite manuellement comme aujourd'hui.

---

## Modèle de données

### Nouvelle table de config

```sql
CREATE TABLE app_config (
  id              int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  saison_courante int NOT NULL
);
```

Ligne unique (singleton), pilotée par une action staff ("Ouvrir la saison"). Pas de table par saison — juste l'année en cours.

### Nouvelle colonne sur `inscriptions`

```sql
ALTER TABLE inscriptions ADD COLUMN derniere_saison_validee int;
```

- `null` = jamais validé
- `2026` = dernière fois que `statut` est passé à `valide`, c'était pour la saison 2026

Pas de nouvelle valeur de `statut` : `en_attente` / `valide` / `refuse` sont réutilisés tels quels. Un renouvellement repasse simplement `statut` à `en_attente`.

### Migration des données existantes

À l'application de la migration :
- `app_config` seedée avec l'année civile en cours (2026).
- Toutes les inscriptions déjà `statut = 'valide'` reçoivent `derniere_saison_validee = 2026` (pas de renouvellement forcé rétroactif sur le parc existant).

---

## Règles métier

### État d'accès usager

Calculé à partir de `statut`, `derniere_saison_validee`, et `saison_courante` (config) :

| Cas | Condition | Écran |
|---|---|---|
| Refus | `statut = 'refuse'` | Écran refus (existant, inchangé) |
| 1ère demande en attente | `statut = 'en_attente'` ET `derniere_saison_validee = null` | "Demande en cours de traitement" (existant, inchangé) |
| Renouvellement en attente | `statut = 'en_attente'` ET `derniere_saison_validee ≠ null` | Variante texte "Renouvellement en cours de traitement" |
| Accès normal | `statut = 'valide'` ET `derniere_saison_validee = saison_courante` | App usager normale |
| À renouveler | `statut = 'valide'` ET `derniere_saison_validee ≠ saison_courante` | Écran bloquant "Renouveler mon inscription" |

Aucun traitement en masse des inscriptions au changement de saison : le gating est calculé à la volée à chaque chargement, pas de risque de ligne oubliée par un batch update.

### Renouvellement (côté usager)

Écran "À renouveler" → bouton "Renouveler mon inscription" → `updateInscription(id, { statut: 'en_attente' })`. `derniere_saison_validee` n'est pas touché à ce stade (il garde la trace de la dernière saison honorée, utile pour l'affichage staff). L'usager retombe sur l'écran "Renouvellement en cours de traitement" jusqu'à validation staff.

### Ouverture de saison (côté staff)

Action admin (bouton avec confirmation, car impacte tous les usagers d'un coup) : `UPDATE app_config SET saison_courante = saison_courante + 1`. Aucune autre écriture nécessaire — le gating usager applique la nouvelle valeur immédiatement au prochain chargement de chaque compte.

### Auto-attribution du pass à la validation

Dans le handler de changement de statut (`js/inscription.js`, listener sur `#insc-statut`) : toute transition **vers** `valide` (peu importe le statut précédent) déclenche, dans le même `updateInscription()` :
- `pass_actif: true`
- `pass_activated_at: <date du jour>`
- `derniere_saison_validee: saison_courante`

Le toggle manuel existant (`_renderPassBlock`, lignes ~365-374 de `inscription.js`) reste inchangé et permet au staff de désactiver le pass après coup, sur n'importe quelle inscription validée.

### Historique

Aucun changement : `reservations` restent liées au même `inscription_id` d'une saison à l'autre. Rien n'est dupliqué ni archivé.

---

## Interface — Écran usager "À renouveler"

Remplace l'accès normal dans `usager-app.js` → `init()`, sur le modèle de l'écran "en cours de traitement" existant :

```
🔄
Votre inscription doit être renouvelée pour la saison {saison_courante}
Vos informations restent enregistrées — cliquez ci-dessous pour soumettre
votre demande de renouvellement.

[ Renouveler mon inscription ]
```

## Interface — Écran usager "Renouvellement en cours"

Variante texte de l'écran d'attente existant :

```
⏳
Votre demande de renouvellement est en cours de traitement
Vous recevrez un email dès que votre inscription sera validée par notre équipe.
```

---

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `supabase/schema.sql` | Table `app_config` + colonne `inscriptions.derniere_saison_validee` |
| `supabase/` (nouvelle migration) | Seed `app_config`, backfill `derniere_saison_validee` sur les inscriptions déjà validées |
| `js/supabase-inscriptions.js` | Lecture/écriture de `derniere_saison_validee`, fonction de lecture de `saison_courante` |
| `js/usager-app.js` | Logique d'état étendue (5 cas au lieu de 2), écrans "À renouveler" / "Renouvellement en cours" |
| `js/inscription.js` | Auto-stamp `pass_actif` / `pass_activated_at` / `derniere_saison_validee` sur transition vers `valide` |
| Interface staff (page à déterminer, ex. Stats) | Bouton "Ouvrir la saison {N+1}" avec confirmation |

---

## Hors périmètre

- Distinction technique entre "reconduction rapide" et "dossier complet" (décision staff interne, pas de branche système).
- Notification email automatique lors de l'ouverture de saison ou du passage en "à renouveler".
- Historique/archivage des inscriptions par saison passée (une seule ligne par usager, réutilisée d'année en année).
- Reset automatique par date pivot (le déclenchement reste 100% manuel côté staff).
