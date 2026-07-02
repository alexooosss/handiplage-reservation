# Plateforme Handiplage — Design Spec

**Date :** 2026-07-02  
**Périmètre :** Transformation en plateforme multi-utilisateurs synchronisée (3 sous-projets)

---

## Contexte

Le site Handiplage réservation existant est une application vanilla JS fonctionnant entièrement en localStorage, utilisée par le staff sur tablette. L'objectif est de :

1. Migrer vers un backend Supabase (PostgreSQL + Auth + temps réel)
2. Conserver intégralement l'interface staff existante, en remplaçant uniquement la couche de stockage
3. Ajouter une interface usager permettant les réservations en ligne

Les données localStorage existantes sont abandonnées (données de test uniquement, aucune migration).

---

## Sous-projet 1 : Backend + Auth

### Infrastructure

- **Base de données :** Supabase (plan gratuit — 2000 inscrits/an ≈ 4% du quota MAU)
- **Auth :** Supabase Auth (email + password, invitation par email)
- **Hébergement frontend :** Netlify (auto-deploy depuis `master` sur GitHub)
- **Variables d'environnement Netlify :** `SUPABASE_URL`, `SUPABASE_ANON_KEY`

### Schéma de la base de données

#### `auth.users` (géré par Supabase)
| Champ | Type | Description |
|-------|------|-------------|
| id | uuid PK | identifiant Supabase |
| email | text | adresse de connexion |
| user_metadata.role | text | `'staff'` ou `'user'` |

#### `inscriptions`
| Champ | Type | Description |
|-------|------|-------------|
| id | uuid PK | identifiant unique |
| user_id | uuid FK → auth.users | null jusqu'à la 1ère connexion |
| nom | text | |
| prenom | text | |
| mail | text | adresse pour invitation |
| telephone | text | |
| statut | text | `'en_attente'` \| `'valide'` \| `'refuse'` |
| pass_actif | boolean | pass activé par le staff |
| pass_activated_at | date | date d'activation du pass |
| handicap | text | type de handicap |
| notes | text | notes libres |
| created_at | timestamptz | auto |
| updated_at | timestamptz | auto |

#### `creneaux` (table statique — 5 lignes, jamais modifiée)
| Champ | Type | Description |
|-------|------|-------------|
| id | int PK | 1 à 5 |
| label | text | ex: "Créneau 1 — 9h00" |
| heure_debut | time | ex: `09:00` |
| heure_fin | time | ex: `10:45` |
| capacite_resa | int | places réservables en avance |
| capacite_walkin | int | places sans réservation |

#### `reservations`
| Champ | Type | Description |
|-------|------|-------------|
| id | uuid PK | |
| date | date | jour de la réservation |
| creneau_id | int FK → creneaux | |
| inscription_id | uuid FK → inscriptions | null si walk-in anonyme |
| nom | text | dénormalisé pour l'affichage staff |
| prenom | text | dénormalisé |
| accompagnants | int | 0, 1 ou 2 |
| type | text | `'reserved'` \| `'walkin'` |
| statut | text | `'attente'` \| `'present'` \| `'parti'` \| `'absent'` \| `'annule'` |
| spot_id | text | emplacement assigné (P1, P2…) — null si en attente |
| checkin_time | timestamptz | heure d'arrivée effective |
| created_at | timestamptz | auto |

#### `main_courante`
| Champ | Type | Description |
|-------|------|-------------|
| id | uuid PK | |
| date | date | |
| creneau_id | int FK → creneaux | |
| compteurs | jsonb | tiralos, hippocampes, audioplage… |
| staff | jsonb | noms entretien/accueil, police, plage nettoyée |
| notes | jsonb | tableau de notes horodatées |
| created_at | timestamptz | auto |
| updated_at | timestamptz | auto |

### Row Level Security (RLS)

- **`inscriptions`** : lecture/écriture = staff uniquement ; l'usager peut lire sa propre ligne (`user_id = auth.uid()`)
- **`creneaux`** : lecture publique (accédée par les usagers non authentifiés pour l'affichage des disponibilités)
- **`reservations`** : staff = accès total ; usager = lecture/création/annulation de ses propres réservations (`inscription_id` lié à son `user_id`)
- **`main_courante`** : staff uniquement

### Rôles et routage

La valeur `user_metadata.role` dans le token JWT détermine l'interface affichée après login :
- `'staff'` → interface staff existante (sous-projet 2)
- `'user'` → interface usager (sous-projet 3)

Le routage est géré côté client en JS au chargement de `index.html`.

---

## Sous-projet 2 : Migration de l'interface staff

### Principe

L'intégralité de l'interface staff existante est conservée **visuellement et fonctionnellement**. Seule la couche de persistance change : chaque appel localStorage est remplacé par un appel Supabase JS SDK.

### Correspondance localStorage → Supabase

| Clé localStorage | Table Supabase |
|-----------------|----------------|
| `handiplage_inscriptions` | `inscriptions` |
| `handiplage_YYYY-MM-DD_slotN` | `reservations` (date + creneau_id, type='reserved') |
| `handiplage_YYYY-MM-DD_slotN_list` | `reservations` (statut='attente') |
| `handiplage_mc_<date>` | `main_courante` |

### Synchronisation temps réel

Abonnements Supabase Realtime sur `reservations` et `main_courante` pour `INSERT`, `UPDATE`, `DELETE`. Toute modification d'une tablette se propage instantanément aux autres.

### Page de login

Ajout d'une page de connexion (`login.html` ou section dans `index.html`). Après authentification, redirection selon le rôle.

### Invitation usager automatique

Lorsque le staff passe une inscription à `statut = 'valide'` et que l'inscrit a un email, l'app appelle `supabase.auth.admin.inviteUserByEmail(email, { data: { role: 'user' } })` via une Edge Function Supabase (pour ne pas exposer la clé service côté client).

---

## Sous-projet 3 : Interface usager

### Accès

Même URL, même `index.html`. Après login avec `role = 'user'`, l'interface staff est masquée et l'interface usager est affichée.

### Fonctionnalités

1. **Réserver un créneau** : liste des créneaux du jour et des jours à venir (fenêtre = aujourd'hui + 1 mois − 1 jour)
2. **Annuler une réservation** : annulation possible jusqu'à la veille du créneau
3. **Historique** : liste des réservations passées et à venir
4. **Solde pass** : nombre de créneaux restants pour le mois en cours (si pass actif)
5. **Mon compte** : changement de mot de passe, affichage des informations de l'inscription

### Règles métier

- Max 2 créneaux par jour et par usager
- Réservation auto-validée si une place est disponible (`statut = 'attente'` → spot assigné automatiquement)
- Si créneau plein : mise en liste d'attente (`statut = 'attente'`, pas de spot_id)
- Annulation d'une réservation avec pass → recrédit immédiat du quota mensuel
- Réservation impossible si pass épuisé (quota = 40/mois)
- Réservation impossible si inscription non validée (`statut ≠ 'valide'`)

---

## Ordre d'implémentation

1. **Sous-projet 1** : Créer le projet Supabase, créer les tables + RLS, configurer Netlify, écrire la Edge Function d'invitation, tester le flux auth complet
2. **Sous-projet 2** : Migrer le staff (remplacer localStorage, ajouter login, ajouter realtime)
3. **Sous-projet 3** : Créer l'interface usager

Chaque sous-projet est indépendant et livrable séparément.
