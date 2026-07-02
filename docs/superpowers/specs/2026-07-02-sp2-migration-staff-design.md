# SP2 — Migration interface staff : localStorage → Supabase

**Date :** 2026-07-02  
**Périmètre :** Remplacer la couche localStorage par Supabase dans l'interface staff existante, sans modifier l'UI. Ajouter la synchronisation temps réel entre tablettes et l'invitation automatique des usagers.

---

## Contexte

SP1 a livré l'authentification Supabase, le schéma de base de données, les RLS et la Edge Function `invite-user`. SP2 migre la persistance des données : chaque appel `localStorage.getItem/setItem` est remplacé par un appel Supabase JS SDK. L'interface staff reste identique visuellement et fonctionnellement.

---

## Architecture

### Nouveaux fichiers

| Fichier | Rôle |
|---|---|
| `js/supabase-storage.js` | Réservations spots + liste d'attente (remplace les appels localStorage de `storage.js`) |
| `js/supabase-inscriptions.js` | CRUD inscriptions (remplace les appels localStorage de `inscription.js`) |
| `js/supabase-mc.js` | Lecture/écriture main courante (remplace les appels localStorage de `mc.js`) |

### Fichiers modifiés

| Fichier | Changement |
|---|---|
| `js/app.js` | `refresh()` devient async ; callbacks spots/liste adaptés pour await + UUID |
| `js/modal.js` | Modales planning deviennent async |
| `js/panel.js` | Callbacks `onPasVenu`, `onAnnule`, `onAssign`, `onWaitingClick` passent des UUIDs au lieu d'indices |
| `js/inscription.js` | Remplace `getInscriptions()`/`saveInscriptions()` par fonctions async ; déclenche invitation automatique |
| `js/mc.js` | Remplace `getMcData()`/`saveMcData()`/`getMcDates()` par fonctions async |
| `index.html` | Ajoute les 3 nouveaux `<script>` tags avant `app.js` |

### Fichiers supprimés

- `js/storage.js` — remplacé par `js/supabase-storage.js`

---

## Couche de données

### Réservations spots (`supabase-storage.js`)

La structure de retour de `getReservations(date, slotId)` reste `{ [spotId]: { nom, prenom, accompagnants, type, status, checkinTime, inscriptionId } }`, reconstituée depuis `SELECT * FROM reservations WHERE date=X AND creneau_id=Y AND spot_id IS NOT NULL`.

| Fonction | Opération Supabase |
|---|---|
| `getReservations(date, slotId)` | SELECT + transformation en objet indexé par spot_id |
| `saveCheckin(date, slotId, spotId, data)` | UPSERT sur (date, creneau_id, spot_id) |
| `updateStatus(date, slotId, spotId, status, extras)` | UPDATE WHERE date+creneau_id+spot_id |
| `updateSpotField(date, slotId, spotId, field, value)` | UPDATE WHERE date+creneau_id+spot_id |
| `clearSlot(date, slotId)` | DELETE WHERE date+creneau_id |

### Liste d'attente (`supabase-storage.js`)

**Changement d'API :** les fonctions d'index (`removeReservation(date, slotId, index)`) sont remplacées par des fonctions UUID. Avec 4-5 agents simultanés, les indices sont instables (risque de race condition). `getReservationList` retourne des objets avec un champ `id` (UUID Supabase).

| Fonction (nouvelle signature) | Opération Supabase |
|---|---|
| `getReservationList(date, slotId)` | SELECT WHERE date+creneau_id AND spot_id IS NULL, retourne `[{id, nom, prenom, ...}]` |
| `addReservation(date, slotId, data)` | INSERT, retourne l'objet créé avec son `id` |
| `removeReservation(reservationId)` | DELETE WHERE id=reservationId |
| `updateReservationStatus(reservationId, status)` | UPDATE WHERE id=reservationId |
| `updateReservationField(reservationId, field, value)` | UPDATE WHERE id=reservationId |

`app.js` et `panel.js` sont adaptés : les callbacks reçoivent et propagent `resa.id` au lieu d'un index.

### Inscriptions (`supabase-inscriptions.js`)

| Fonction | Opération Supabase |
|---|---|
| `getInscriptions()` | SELECT * FROM inscriptions ORDER BY nom |
| `getInscriptionById(id)` | SELECT WHERE id=... |
| `createInscription(data)` | INSERT, retourne l'objet créé (UUID généré par Supabase) |
| `updateInscription(id, data)` | UPDATE WHERE id=... |
| `deleteInscription(id)` | DELETE WHERE id=... |

La génération d'ID locale (`_genId()`) disparaît — Supabase génère les UUIDs.

### Main courante (`supabase-mc.js`)

La structure jsonb stockée dans Supabase est identique à la structure actuelle (`{ staff: {...}, slots: {...}, notes: [...] }`).

| Fonction | Opération Supabase |
|---|---|
| `getMcData(date)` | SELECT * FROM main_courante WHERE date=... (retourne `_mcDefault()` si absent) |
| `saveMcData(date, creneauId, data)` | UPSERT sur (date, creneau_id) |
| `getMcDates()` | SELECT DISTINCT date FROM main_courante ORDER BY date DESC |

---

## Synchronisation temps réel

Trois abonnements Supabase Realtime, ouverts après authentification :

| Canal | Table | Filtre | Déclenche |
|---|---|---|---|
| `slot-{date}-{slotId}` | `reservations` | `date=X AND creneau_id=Y` | `App.refresh()` |
| `inscriptions` | `inscriptions` | aucun | re-render vue inscription |
| `mc-{date}` | `main_courante` | `date=X` | re-render vue MC |

**Cycle de vie :**
- Les abonnements `reservations` et `mc` sont recréés à chaque changement de créneau ou de date (désabonnement de l'ancien, abonnement au nouveau)
- L'abonnement `inscriptions` reste actif toute la session
- Fallback : `setInterval(refresh, 30000)` déjà en place dans `app.js` couvre les coupures réseau

---

## Invitation usager automatique

Dans `inscription.js`, au moment de la sauvegarde d'un changement de statut vers `valide` :

```
si nouveau statut === 'valide' ET inscription.mail non vide
  → inviteUser(inscription.mail, inscription.id)   // auth.js, fire-and-forget
```

- Succès → message de confirmation ("Email d'invitation envoyé à xxx@...")
- Échec (ex: compte déjà existant) → ignoré silencieusement, la validation n'est pas bloquée

---

## Hors périmètre SP2

- Aucune modification de l'UI staff (visuel identique)
- Gestion offline / mode dégradé sans réseau
- Migration des données localStorage existantes (données de test, abandonnées)
- Interface usager (SP3)
