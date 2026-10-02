# Filtres géographiques + panneau usagers sur la carte — Design Spec
**Date :** 2026-10-02
**Périmètre :** Géocodage international (hors France), dérivation continent/région, panneau de tri en cascade + liste à droite du globe 3D, synchronisation liste ↔ globe

---

## Contexte

La carte des usagers (`js/usagers-map.js`, sous-vue de l'onglet Stats) affiche un globe 3D avec un point par usager validé géolocalisé. Le géocodage (`js/supabase-geo.js`) n'utilise aujourd'hui que l'API BAN (`adresse.data.gouv.fr`), réservée à la France — tout usager dont le pays n'est pas la France n'a jamais de coordonnées et n'apparaît jamais sur le globe.

Une part notable des usagers de la Handiplage Antibes vient de l'étranger (tourisme international). Ce spec ajoute : (1) le géocodage hors France, (2) la dérivation du continent et de la région administrative française, (3) un panneau à droite du globe permettant de filtrer les usagers par continent → pays → région → ville, avec une liste des usagers correspondants, synchronisée avec les points affichés sur le globe.

Décisions actées en amont (brainstorming) :
- Le géocodage hors France utilise **Nominatim/OpenStreetMap** (gratuit, sans clé), en conservant l'API BAN pour la France (déjà en place, plus rapide, pas de raison de la remplacer).
- Le niveau « région » = **région administrative française**, dérivée automatiquement de la réponse de géocodage. Vide/non applicable pour les adresses hors France (découpages régionaux différents par pays, hors périmètre).
- Les filtres sont **en cascade** (4 menus déroulants empilés : Continent, Pays, Région, Ville), chaque choix restreignant les options du suivant.
- Choisir un filtre **restreint aussi les points affichés sur le globe**, pas seulement la liste — les deux restent synchronisés.
- Cliquer une ligne de la liste déclenche **exactement le comportement existant d'un clic sur le point correspondant** (`onMarkerClick`) : le globe centre/tourne vers le point, la bulle d'info (nom, ville, téléphone, bouton « Voir la fiche → ») s'ouvre. Aucune nouvelle UI de fiche à construire.
- Les usagers non géolocalisables (pas d'adresse, ou adresse jamais reconnue par les deux API) apparaissent dans la liste sous un groupe à part **« Non localisés »**, hors des 4 filtres géographiques — un clic ouvre directement la fiche usager (il n'y a pas de point à centrer).

---

## Géocodage international

### Répartition des API par pays

```
buildGeocodeQuery / géocodage :
  pays absent ou pays === "France" (insensible à la casse) → API BAN (inchangé)
  pays renseigné et ≠ "France"                             → API Nominatim
```

### API BAN (France) — inchangée, extraction région ajoutée

La réponse BAN pour une recherche `type=municipality` contient déjà un champ `context` au format `"<code département>, <nom département>, <nom région>"` (ex: `"06, Alpes-Maritimes, Provence-Alpes-Côte d'Azur"`). Le nom de région est le dernier segment après la dernière virgule — aucun appel API supplémentaire nécessaire.

### API Nominatim (hors France) — nouvelle

```
GET https://nominatim.openstreetmap.org/search
  ?q=<ville, code postal, pays>
  &format=json
  &addressdetails=1
  &limit=1
```

- Pas de clé API. Le `Referer` HTTP envoyé automatiquement par le navigateur suffit à identifier l'application auprès de Nominatim (on ne peut pas définir un header `User-Agent` personnalisé depuis `fetch()` en navigateur — c'est un header interdit par le navigateur lui-même).
- Réponse exploitée : `address.country_code` (ISO 2 lettres, pour dériver le continent), `lat`/`lon`.
- Pas de région extraite pour ces adresses (les champs `address.state`/`address.county` de Nominatim ne correspondent pas forcément à un découpage administratif cohérent d'un pays à l'autre — hors périmètre, cf. décisions actées).

### Respect du quota Nominatim (1 req/s)

`geocodeInscriptions` applique aujourd'hui un délai unique (`delayMs`, défaut 150ms) entre chaque inscription traitée, quelle que soit l'API utilisée. Ce délai est conservé pour les adresses françaises (BAN n'impose pas cette contrainte), mais une adresse non-française force un délai minimum de **1100ms** avant la requête Nominatim *suivante* (que la suivante soit française ou pas, par simplicité d'implémentation — un léger ralentissement occasionnel sur le cas France est acceptable plutôt que de suivre un throttling différencié par API, plus complexe pour un gain marginal).

### Attribution

Quand au moins un usager affiché a été géocodé via Nominatim (donc hors France), le hint sous le titre de la carte affiche une ligne supplémentaire : *« Données pays hors France : © OpenStreetMap contributors »*.

---

## Dérivation du continent

Nouveau fichier `js/geo-continents.js` : table statique `{ "FR": "Europe", "IT": "Europe", "US": "Amérique", ... }` couvrant les codes pays ISO 3166-1 alpha-2 usuels (~250 entrées), plus une fonction :

```js
function countryCodeToContinent(countryCode) {
  return CONTINENT_BY_COUNTRY_CODE[String(countryCode || '').toUpperCase()] || null;
}
```

- France (BAN) : `countryCode` vaut toujours `'FR'`, continent toujours `'Europe'` — pas besoin d'appeler Nominatim pour le savoir.
- Hors France (Nominatim) : `countryCode` vient de `address.country_code` de la réponse, continent dérivé via la table.
- Si le code pays n'est reconnu par aucune entrée de la table (cas rare), continent = `null` → l'usager tombe dans le groupe « Non localisés » du panneau même s'il a des coordonnées (cas limite accepté, pas de point mort dans les filtres).

---

## Modèle de données

Nouveaux champs stockés dans `inscription.metadata` (même mécanisme que `geoLat`/`geoLng`/`geocodedAt` actuels, écrits par `updateInscription` lors du géocodage) :

```js
inscription.continent    // "Europe" | "Amérique" | ... | null
inscription.region       // "Provence-Alpes-Côte d'Azur" | null (toujours null hors France)
inscription.countryCode  // "FR" | "IT" | "US" | ... | null
```

Aucune migration SQL nécessaire — ces champs vivent dans la colonne `metadata` jsonb existante, comme tous les champs non structurés.

---

## Interface — Panneau de droite

### Layout

```
┌─────────────────────────────────────────┬──────────────────┐
│                                           │  Continent  ▾    │
│                                           │  Pays       ▾    │
│              Globe 3D                    │  Région     ▾    │
│           (flexible, inchangé)           │  Ville      ▾    │
│                                           ├──────────────────┤
│                                           │  🧍 Nom — Ville  │
│                                           │  🧍 Nom — Ville  │
│                                           │  …               │
│                                           ├──────────────────┤
│                                           │  Non localisés   │
│                                           │  🧍 Nom          │
└─────────────────────────────────────────┴──────────────────┘
```

- Nouveau conteneur flex `.usagers-map-layout` (remplace l'actuel `#usagers-globe` comme enfant direct de `.usagers-map-card`) : globe à gauche (flex: 1), panneau `.usagers-filter-panel` à droite, largeur fixe ~300px.
- Sous ~768px de large (mobile/tablette), le panneau passe sous le globe (`flex-direction: column`), cohérent avec le point de rupture déjà utilisé pour `.usagers-globe-wrap` (`@media` existant à `css/style.css:2332`).

### Comportement des 4 menus en cascade

- Chaque menu ne liste que les valeurs **réellement présentes** parmi les usagers actuellement géolocalisés (pas une liste figée de tous les pays du monde).
- Changer un menu réinitialise et recalcule les options des menus suivants (Continent → vide Pays/Région/Ville ; Pays → vide Région/Ville ; Région → vide Ville).
- Valeur par défaut de chaque menu : `« Tous »` (aucun filtre à ce niveau).
- Les 4 menus + la liste tiennent dans un seul composant JS pur, testable indépendamment du rendu (voir Tests).

### Liste

- Une ligne par usager correspondant aux filtres actifs : `🧍 NOM Prénom — Ville`.
- Groupe séparé **« Non localisés »** en bas (toujours visible, non affecté par les 4 filtres géographiques) : usagers validés sans coordonnées (pas d'adresse, adresse non reconnue par BAN/Nominatim, ou continent non résolu).
- Clic sur une ligne géolocalisée → appelle la même fonction que `onMarkerClick` aujourd'hui (centre le globe, ouvre la bulle).
- Clic sur une ligne « Non localisés » → `App.navigateToInscription(id)` directement (comportement du lien « Voir la fiche → » de la bulle, sans bulle intermédiaire puisqu'il n'y a pas de point).

### Synchronisation filtre → globe

Les filtres actifs recalculent le tableau `markers` filtré, puis le globe est **détruit et recréé** (`destroy()` existant + nouvel appel à `window.HandiplageGlobe.create(...)` avec les mêmes options sauf `markerConfig.markers`) à chaque changement de filtre. Pas de mise à jour incrémentale de l'instance existante — l'interaction (changer un menu déroulant) est peu fréquente, la recréation complète reste simple et fiable.

---

## Tests (fonctions pures)

Comme pour le reste de la codebase, seules les fonctions pures/synchrones sont testées unitairement (pas les appels réseau BAN/Nominatim eux-mêmes) :

- `countryCodeToContinent(countryCode)` (`js/geo-continents.js`) — codes connus, code inconnu → `null`, casse variable.
- Extraction de la région depuis le champ `context` de la réponse BAN (ex: `"06, Alpes-Maritimes, Provence-Alpes-Côte d'Azur"` → `"Provence-Alpes-Côte d'Azur"`), y compris le cas où `context` est absent/malformé.
- La fonction de filtrage en cascade : étant donné une liste d'inscriptions géolocalisées + des filtres actifs (`{ continent, pays, region, ville }`, chacun optionnel), retourne la sous-liste correspondante — y compris le cas « aucun filtre actif » (tout retourner) et « filtre sur une valeur absente des données » (liste vide, pas d'erreur).
- La fonction qui sépare une liste d'inscriptions validées en « géolocalisées » vs « non localisées » (pas de `geoLat`/`geoLng`, ou `continent` null).
- La fonction qui calcule les options disponibles d'un niveau de filtre à partir du niveau parent sélectionné (ex: pays disponibles pour `continent = "Europe"`).

---

## Hors périmètre

- Région administrative pour les pays hors France (découpages incohérents d'un pays à l'autre).
- Mise à jour temps réel du panneau si un usager est géocodé pendant que le panneau est ouvert (le géocodage se fait au chargement de la vue, comme aujourd'hui).
- Recherche texte libre dans le panneau (seulement les 4 filtres en cascade, pas de champ de recherche nom/prénom).
- Export ou impression de la liste filtrée.
