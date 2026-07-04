# Interface Usager Handiplage — Design Spec

**Date :** 2026-07-04
**Périmètre :** Sous-projet A (formulaire public), Sous-projet B (app usager), Rubrique Messages staff
**Dépendances :** `2026-07-02-plateforme-handiplage-design.md` (schéma DB, auth, RLS)

---

## Contexte

Ce document complète le design global en détaillant les interfaces côté usager et le nouveau flux d'inscription publique. Le public cible est souvent âgé — toutes les décisions UX favorisent la lisibilité, les grandes zones de tap, et le minimum de navigation cachée.

---

## Sous-projet A — Formulaire d'inscription public

### Objectif

Permettre à toute personne de déposer une demande d'inscription sans avoir de compte. Aucune authentification requise pour accéder au formulaire.

### Accès

URL publique : `index.html#inscription-publique` (ou page dédiée `inscription.html`).
Lien visible sur la page d'accueil / page de connexion : "Première fois ? Déposez votre demande d'inscription".

### Champs du formulaire

Identiques au formulaire staff existant (`js/inscription.js`), sans les champs réservés au staff (statut, pass, historique) :

**Section Identité**
- Nom (texte, majuscules automatiques) *
- Prénom *
- Date de naissance (sélecteurs jour / mois / année) *
- Téléphone *
- Adresse mail *
- Confirmation de l'adresse mail *
- Modalité de contact préférée : Téléphone | Mail (cases à cocher) *

**Section Adresse**
- Adresse (N° et nom de voie) *
- Code postal *
- Ville *
- Pays (défaut : France) *

**Section Contact d'urgence**
- Nom et prénom *
- Téléphone *

**Section Besoins d'accompagnement**
- Aucun besoin
- Aide au transfert
- Aide à l'entrée et à la sortie de l'eau
- Aide à la baignade (maximum 30 minutes)
_(exclusivité : "Aucun" désélectionne les autres)_

**Section Aides techniques**
- Aucun besoin
- Tiralo (fauteuil amphibie équipé de flotteurs)
- Hippocampe (fauteuil tout terrain pour aller au bord de l'eau)
- Audioplage (balisage sonore en mer pour personnes déficientes visuelles)
_(exclusivité : "Aucun" désélectionne les autres)_

**Section Engagements**
- Port du gilet de sauvetage : radio Oui / Non *
- RGPD : case à cocher attestation *
- Communications CCAS : radio Accepte / Refuse *
- Règlement de fonctionnement : case à cocher *

**Section Documents**
- Document principal — CMI recto-verso (image ou PDF) *
- Deuxième document (optionnel, si le premier n'est pas recto-verso)
- Signature — saisie du prénom et nom (vaut signature) *

### Comportement à la soumission

1. Validation JS côté client (mêmes règles que le formulaire staff)
2. `createInscription({ ...data, statut: 'en_attente' })` — pas d'invitation envoyée
3. Affichage d'un message de confirmation :
   > "Votre demande a bien été enregistrée. Vous recevrez un email lorsqu'elle sera traitée par notre équipe."
4. Le formulaire est vidé / désactivé (pas de double soumission)

### Ce qui n'est pas dans le formulaire public

- Champ statut (géré par le staff uniquement)
- Bloc pass (créé par le staff après validation)
- Historique de réservations

---

## Flux de validation par le staff

```
Demande soumise (en_attente)
    │
    ├─ Staff VALIDE → statut = 'valide'
    │     └─ inviteUser(mail) → email Supabase avec lien de création de mot de passe
    │           └─ Usager clique → crée son mot de passe → connecté → App usager
    │
    └─ Staff REFUSE → statut = 'refuse'
          └─ Staff saisit un motif de refus
                └─ Email de refus envoyé à l'usager
                      └─ Email contient un lien "Répondre à cette décision"
                            └─ Lien → formulaire web simple (token sécurisé)
                                  └─ Réponse stockée dans table `messages`
                                        └─ Apparaît dans la rubrique Messages du staff
```

### Email de refus

L'email de refus contient :
- Le motif saisi par le staff
- Un lien sécurisé vers un formulaire de réponse : `https://[site]/reponse?token=<uuid_signé>`
- Le token expire après 30 jours

### Formulaire de réponse (page publique)

Page légère, sans navigation. Champs :
- Texte libre (textarea) — "Votre message à l'équipe Handiplage"
- Bouton "Envoyer ma réponse"

Soumission → INSERT dans `messages` (voir schéma ci-dessous).

---

## Nouveau schéma — table `messages`

| Champ | Type | Description |
|-------|------|-------------|
| id | uuid PK | |
| inscription_id | uuid FK → inscriptions | |
| token | text unique | token URL signé pour le formulaire de réponse |
| token_expires_at | timestamptz | 30 jours après envoi |
| contenu | text | texte de la réponse de l'usager |
| lu | boolean | false par défaut |
| created_at | timestamptz | auto |

RLS : lecture/écriture staff uniquement. INSERT public via token valide uniquement (via Edge Function).

---

## Sous-projet B — App usager

### Principes UX

- **Mobile-first** : conçu pour smartphone, utilisable sur tablette et desktop
- **Grandes zones de tap** : boutons et tuiles ≥ 48px de hauteur
- **Aucun menu caché** : toute la navigation est visible depuis l'accueil
- **Texte lisible** : taille de base ≥ 16px

### Architecture

Même `index.html`. Après login avec `user_metadata.role = 'user'`, l'interface staff est masquée et l'interface usager est montée dans le même conteneur principal.

Routage interne par vue : `accueil`, `reserver`, `mes-reservations`, `mon-pass`, `mon-compte`.

### Connexion

**Première connexion :**
L'usager reçoit un email d'invitation Supabase contenant un lien de création de mot de passe. Ce lien ouvre `index.html` avec un hash Supabase (`#access_token=...`). L'app détecte ce hash, affiche un formulaire "Choisissez votre mot de passe", puis connecte l'usager.

**Connexions suivantes :**
Formulaire email + mot de passe standard. Pas de "Mot de passe oublié" dans un premier temps (l'usager contacte le staff).

### Écran 1 — Accueil (Dashboard)

```
┌─────────────────────────────┐
│  🏖 Handiplage              │
│  Bonjour, Marie             │
├──────────────┬──────────────┤
│ PROCHAINE    │ PASS CE MOIS │
│ RÉSERVATION  │              │
│ Mar. 9 juil. │   32 / 40   │
│ Matin · A3   │  restantes   │
├──────────────┴──────────────┤
│  [📅 Réserver]  [📋 Mes    │
│                  résa.]     │
│  [🎫 Mon pass] [👤 Mon     │
│                  compte]    │
└─────────────────────────────┘
```

- Si aucune réservation à venir : carte "Prochaine réservation" affiche "Aucune réservation prévue"
- Si pass inactif : carte pass remplacée par une carte neutre (le staff active le pass)
- Les 4 tuiles sont toujours affichées

### Écran 2 — Réserver

```
┌─────────────────────────────┐
│ ← Réserver                  │
├─────────────────────────────┤
│ [L7][M8][M9●][J10●][V11]… │  ← barre scrollable
│                             │
│  Mardi 9 juillet            │
│ ┌─────────────────────────┐ │
│ │ 🕘 Matin                │ │
│ │ 9h00 – 12h00 · 3 places │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ 🕑 Après-midi           │ │
│ │ 14h00 – 17h00 · 5 places│ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

- Barre de jours : aujourd'hui + 30 jours glissants
- Jours disponibles : fond vert clair
- Jours complets : grisés, non cliquables
- Jours passés : grisés, non cliquables
- Tap sur un créneau → Écran de confirmation

**Règles d'affichage des créneaux :**
- Place disponible si `count(reservations WHERE date=X AND creneau_id=Y AND statut != 'annule') < creneaux.capacite_resa`
- Si le créneau est plein : afficher "Complet" sans bouton de sélection (pas de liste d'attente côté usager dans cette version)

### Écran 3 — Confirmation de réservation

```
┌─────────────────────────────┐
│ ← Récapitulatif             │
│                             │
│           📋                │
│    Votre réservation        │
│                             │
│  Date        Mar. 9 juillet │
│  Créneau     Matin (9h–12h) │
│  Pass        32 → 31        │
│                             │
│  [    ✓ Confirmer      ]    │
│  [       Annuler        ]   │
└─────────────────────────────┘
```

- La ligne "Pass" n'est affichée que si le pass est actif
- Si pass épuisé (0 restant) : bouton Confirmer désactivé + message "Pass épuisé pour ce mois"
- Confirmation → `createReservation({ inscription_id, date, creneau_id, statut: 'attente' })`
- Succès → retour à l'accueil avec message "Réservation confirmée"

### Écran 4 — Mes réservations

Deux sections :

**À venir** (statut ≠ 'annule', date ≥ aujourd'hui) :
- Carte par réservation : date, créneau, emplacement (si assigné), statut
- Bouton "Annuler" visible si `date > aujourd'hui + 1 jour`
- Annulation → confirmation ("Êtes-vous sûr ?") → `updateReservation({ statut: 'annule' })`

**Passées** (date < aujourd'hui) :
- Même structure, sans bouton d'annulation
- Statut coloré : Présent·e (vert), Absent·e (rouge), Parti·e (bleu), Annulé (gris)

### Écran 5 — Mon pass

- Solde du mois en cours : N / 40 réservations restantes
- Barre de progression (même logique que le bloc pass staff)
- Date de réinitialisation (1er du mois suivant)
- Historique des réservations du mois (dates, créneaux)
- Si pass inactif : "Votre pass n'est pas encore activé. Contactez l'équipe Handiplage."

### Écran 6 — Mon compte

- Informations de l'inscription (lecture seule) : Nom, Prénom, Email, Téléphone, Adresse
- Bouton "Modifier mon mot de passe" → formulaire nouveau mot de passe (via `supabase.auth.updateUser`)
- Bouton "Déconnexion"

---

## Nouveau dans le staff — Rubrique Messages

### Position dans l'interface

Nouvel onglet "Messages" dans la navigation staff principale, avec badge de compteur si messages non lus.

### Vue liste

```
┌──────────────────────────────────────────────┐
│ Messages                              [3 non lus] │
├──────────────────────────────────────────────┤
│ ● DUPONT Marie · 2 juil.                     │
│   "Je viens de retrouver ma CMI, voici…"     │
├──────────────────────────────────────────────┤
│   MARTIN Paul · 30 juin                      │
│   "Suite à votre refus, je souhaitais…"      │
└──────────────────────────────────────────────┘
```

- Messages non lus : point coloré + gras
- Tri : non lus d'abord, puis chronologique décroissant

### Vue détail (tap sur un message)

```
┌──────────────────────────────────────────────┐
│ ← Messages                                   │
├──────────────────────────────────────────────┤
│ DUPONT Marie — Demande du 15 juin             │
│ Refus envoyé le 20 juin :                    │
│ "Justificatif illisible — CMI non valide"    │
├──────────────────────────────────────────────┤
│ Réponse reçue le 2 juillet :                 │
│ "Je viens de retrouver ma CMI, le recto et  │
│  verso sont joints à ce message…"           │
├──────────────────────────────────────────────┤
│  [✓ Valider l'inscription]                   │
│  [✉ Répondre par email]                      │
└──────────────────────────────────────────────┘
```

**Action "Valider l'inscription" :**
- Passe `inscriptions.statut` à `'valide'`
- Déclenche `inviteUser()` (même flux que la validation normale)
- Marque le message comme lu
- Affiche confirmation "Inscription validée — email d'invitation envoyé"

**Action "Répondre par email" :**
- Champ textarea dans l'interface
- Envoi via Edge Function → email à l'adresse de l'inscrit
- Le message reste dans la liste (archivé)
- Un nouveau token de réponse est généré et inclus dans l'email (permet une nouvelle réponse)

---

## Ordre d'implémentation recommandé

1. **Table `messages` + Edge Function token** — prérequis pour le formulaire de réponse
2. **Sous-projet A** — formulaire public + page de réponse publique
3. **Rubrique Messages staff** — vue liste + vue détail + actions
4. **Sous-projet B** — app usager (accueil → réserver → confirmation → mes réservations → mon pass → mon compte)

---

## Hors périmètre (cette version)

- Notifications push
- Mot de passe oublié en autonomie (contacter le staff)
- Modification des infos d'inscription par l'usager
- Liste d'attente côté usager
- Calendrier public de disponibilité (Sous-projet C — future itération)
