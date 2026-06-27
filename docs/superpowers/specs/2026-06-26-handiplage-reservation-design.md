# Handiplage Antibes — Interface Staff Réservation

**Date :** 2026-06-26  
**Statut :** Approuvé  
**Périmètre :** V1 (localStorage) — backend V2 prévu pour déploiement réel

---

## 1. Contexte

La Handiplage de Juan-les-Pins (Antibes) est un espace de plage accessible aux personnes à mobilité réduite (PMR). Le personnel d'accueil a besoin d'un outil visuel pour gérer les emplacements en temps réel : qui est présent, depuis combien de temps, et quand les personnes doivent partir.

L'outil est **exclusivement réservé au staff**. Les réservations sont saisies manuellement (pas d'intégration Réservio en V1, prévu en V2). Le support cible est une **tablette** (iPad ou Android 10–12", orientation paysage).

---

## 2. Créneaux & capacité

| Créneau | Horaires | Durée |
|---------|----------|-------|
| 1 | 8h30 – 10h15 | 1h45 |
| 2 | 10h30 – 12h15 | 1h45 |
| 3 | 12h30 – 14h15 | 1h45 |
| 4 | 14h30 – 16h15 | 1h45 |
| 5 | 16h30 – 18h15 | 1h45 |

- **55 emplacements au total** sur la plage (confirmé)
- **25 places maximum réservables** par créneau
- **30 places en accès libre** (sans réservation) : le décompte de 1h45 démarre à l'arrivée physique, pas à l'heure du créneau
- Les personnes ayant réservé mais arrivant en retard : le décompte démarre au check-in réel

---

## 3. Layout général (tablette paysage)

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER : Logo | Sélecteur 5 créneaux (pills) | Horloge    │
├──────────────────────────────┬──────────────────────────────┤
│                              │  Panneau créneau actif       │
│   CARTE DE PLAGE             │  ─────────────────────────── │
│   (fidèle au plan PDF)       │  Stats: présents/libres/libs │
│                              │  [+ Enregistrer une arrivée] │
│   ● spots colorés            │  ─────────────────────────── │
│   — tapis PMR bleus          │  Liste triée :               │
│   ~ mer (bas gauche)         │   1. Départs urgents (<30mn) │
│   □ parking (haut)           │   2. Présents               │
│   ▪ bâtiment (droite)        │   3. Réservés non arrivés   │
│   🚿 douches                 │   4. Places libres           │
│                              │  ─────────────────────────── │
│                              │  Légende couleurs            │
└──────────────────────────────┴──────────────────────────────┘
```

---

## 4. Plan de plage (fidèle au PDF)

Le plan reproduit exactement la disposition du fichier `Plan handiplage.pdf` :

- **4 rangées horizontales** de spots (parasol + transat PMR + chaise accompagnant)
- **3 tapis PMR horizontaux** (bleu #1565c0) séparant les rangées — voies de circulation accessibles
- **3 tapis PMR verticaux** créant des colonnes/sections (allées transversales)
- **Parking** (bande grise) en haut
- **Mer** (gradient bleu) en bas à gauche avec forme arrondie
- **Bâtiment / Accueil** (structure verte sur le PDF) à droite
- **Douches** (icônes 🚿) positionnées à l'identique du plan
- **Spots numérotés P1 à Pn**, chacun cliquable

---

## 5. États des spots

| Couleur | État | Description |
|---------|------|-------------|
| Rouge | Présent — réservé | Personne arrivée, décompte en cours |
| Vert | Libre | Place disponible |
| Orange | Arrivée libre | Personne sans réservation, décompte en cours |
| Jaune/gris | Réservé, pas arrivé | Réservation enregistrée, personne pas encore là |
| Violet | Absent | Fin de créneau, personne non venue (marquage manuel) |

---

## 6. Données par personne

Champs saisis au check-in :
1. **Nom** (depuis le compte existant — saisie manuelle en V1)
2. **Prénom**
3. **Nombre d'accompagnants** (0, 1 ou 2 — maximum 2)

Données calculées automatiquement :
- Heure d'arrivée (timestamp check-in)
- Temps restant (1h45 − durée depuis check-in)
- Statut (présent / réservé-absent / absent en fin de créneau)

---

## 7. Interactions staff

### Sélecteur de créneaux (header)
- 5 pills : passé (grisé), actif (vert vif), à venir (discret)
- Clic sur un créneau → affiche la carte et la liste pour ce créneau

### Carte interactive
- **Clic sur un spot libre** → ouvre modale "Enregistrer une arrivée" (préremplit le numéro de place)
- **Clic sur un spot occupé** → affiche la fiche de la personne (nom, heure d'arrivée, temps restant, nb accompagnants) + bouton "Marquer départ"
- **Clic sur spot réservé non arrivé** → affiche la réservation + bouton "Check-in" (démarre le décompte) + bouton "Absent"

### Panneau droit — "Enregistrer une arrivée" (bouton principal)
Ouvre une modale avec :
- Champ Nom / Prénom (autocomplete sur les comptes existants en V2)
- Sélecteur nb accompagnants (0 / 1 / 2)
- Sélecteur de place (liste des places libres)
- Toggle "Avec réservation" / "Sans réservation"
- Bouton "Confirmer l'arrivée" → démarre le décompte

### Fin de créneau
- Alerte visuelle quand le temps restant < 15 minutes (badge rouge clignotant)
- Le staff marque manuellement "Absent" pour les no-shows à la fin du créneau

---

## 8. Décompte temps réel

- Le timer affiche **MM:SS** restantes sur chaque spot (badge jaune sur la carte)
- Mis à jour toutes les **30 secondes** (pas de websocket en V1, simple `setInterval`)
- Quand le temps atteint 0 : le spot devient rouge vif + alerte sonore optionnelle
- Le panneau droit trie automatiquement par urgence (temps restant croissant)

---

## 9. Persistance des données (V1)

- **localStorage** du navigateur — les données survivent aux rechargements
- Structure JSON par journée (clé = date ISO)
- Pas de synchronisation multi-appareils en V1
- Les données d'une journée sont archivées automatiquement à minuit

---

## 10. Stack technique

### V1 (en cours)
- HTML5 / CSS3 / JavaScript vanilla
- Pas de dépendances externes (pas de React, pas de build step)
- localStorage pour la persistance
- Un seul fichier `index.html` + `style.css` + `app.js` pour la simplicité

### V2 (déploiement réel — à prévoir)
- Backend léger (Node.js/Express ou PHP) avec base de données (SQLite ou PostgreSQL)
- API REST pour CRUD des réservations
- Authentification staff (login/mot de passe)
- Synchronisation multi-appareils (plusieurs tablettes simultanées)
- Import automatique des réservations depuis l'API Réservio
- Comptes usagers déjà existants → autocomplete au check-in

---

## 11. Style visuel

- Inspiré du site [handiplage.ccas-antibes.fr](https://handiplage.ccas-antibes.fr/) (identité bleue institutionnelle)
- Touche moderne et audacieuse : dégradés profonds, cartes arrondies, typo bold, animations subtiles
- Palette principale : bleu marine `#0055a4` / bleu nuit `#0a1628` / turquoise accent `#00d4aa`
- Fond de carte : sable `#f2e8d4`, mer `#48cae4→#0077b6`, tapis PMR `#1565c0`
- Police : system-ui / Segoe UI (pas de dépendance Google Fonts)

---

## 12. Hors périmètre V1

- Authentification / gestion des comptes staff
- Intégration Réservio
- Notifications push / SMS
- Historique et statistiques
- Multi-appareils simultanés
- Application mobile native
