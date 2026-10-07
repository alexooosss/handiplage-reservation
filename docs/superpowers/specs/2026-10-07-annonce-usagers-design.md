# Annonce staff → tous les usagers

## Contexte

Le staff veut pouvoir publier un message visible par tous les usagers, affiché en priorité à la connexion sur leur espace (au-dessus des cartes "Prochaine réservation" / "Pass"). La table `messages` existante est conçue pour des échanges 1-à-1 (refus d'inscription avec token de réponse, contact usager↔staff) : `inscription_id` y est `NOT NULL`, donc inadaptée à un message collectif. Ce besoin est donc couvert par une table dédiée.

## Décisions validées

- Une seule annonce active à la fois ; elle reste affichée tant que le staff ne la désactive pas manuellement (pas de suivi "lu" par usager, pas de bouton fermer côté usager).
- Table dédiée `annonces` avec historique (lignes désactivées conservées), plutôt qu'un champ singleton dans `app_config`.
- Pas d'UI d'historique/réactivation en v1 — le staff republie le texte s'il veut le remettre.
- Portée : écran d'accueil usager uniquement (pas "mes réservations" ni les autres vues).

## Schéma

```sql
CREATE TABLE annonces (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contenu    text NOT NULL,
  actif      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_annonces_actif ON annonces(actif) WHERE actif;

ALTER TABLE annonces ENABLE ROW LEVEL SECURITY;
```

Une seule ligne `actif = true` à la fois : pas de contrainte DB dédiée, imposé côté application (voir `createAnnonce` ci-dessous).

## RLS

- `staff_full_annonces` : `ALL` pour le rôle staff (même pattern que `staff_full_messages`).
- `annonces_select_active` : `SELECT` pour `anon, authenticated`, filtré `actif = true` — même pattern d'ouverture que la policy `app_config` ajoutée pour les dates de saison.

Pas de policy `INSERT`/`UPDATE`/`DELETE` pour `anon`/`authenticated` : seul le staff écrit.

## Couche données — `js/supabase-annonces.js` (nouveau fichier)

Mirror du pattern de `js/supabase-messages.js`.

- `getActiveAnnonce()` : `select *` où `actif = true`, `.maybeSingle()` (ou équivalent) ; retourne `null` si aucune. Accessible usager + staff.
- `getAnnonces()` : staff — toutes les lignes, `order by created_at desc`. Prévu pour un futur historique UI, non consommé en v1.
- `createAnnonce(contenu)` : staff — désactive toutes les lignes actives existantes (`update actif=false where actif=true`), puis insère la nouvelle ligne `actif=true`. Deux requêtes séquentielles, pas de transaction RPC : en cas d'échec partiel (désactivation ok, insertion échoue), aucune annonce active ne reste affichée — le staff réessaie. Risque jugé acceptable (pas de RPC existant pour ce besoin dans le projet).
- `deactivateAnnonce(id)` : staff — `update actif=false`.

Pas de fonction `deleteAnnonce` en v1 (l'historique reste en base, pas de suppression nécessaire).

## Staff UI — `js/annonces.js` (nouveau fichier)

- `renderAnnonceBanner(container)` : monté en haut de la vue Messages (`js/messages.js` → `renderMessages`, prepend avant `.msg-layout`), fichier séparé pour garder `messages.js` focalisé sur le flux 1-à-1 existant.
- Si une annonce active existe : affiche son texte + bouton "Désactiver".
- Sinon : zone de texte (`<textarea>`) + bouton "Publier".
- Après publication/désactivation : re-render du bloc (pas de réécriture de toute la vue Messages).

## Usager UI — `js/usager-accueil.js`

- Dans `renderAccueil`, ajoute un `await getActiveAnnonce()` dans un bloc try/catch séparé (une erreur réseau sur l'annonce ne doit pas casser l'affichage des cartes principales — `console.error` et continuer, pattern déjà utilisé pour `getSaisonDates()`).
- Si une annonce existe : bandeau `.usager-annonce-banner` inséré juste après le bandeau démo (`demoBanner`) et avant la ligne "Bonjour, {prenom}" — donc au-dessus de tout, y compris les cartes prochaine réservation / pass.
- Pas de bouton fermer : le bandeau reste visible à chaque connexion tant que l'annonce est active côté staff.
- Contenu échappé via `_escA` (existant dans le fichier) pour éviter l'injection HTML.

## CSS

Nouvelle règle `.usager-annonce-banner` dans `css/style.css`, visuellement distincte du bandeau démo (couleur d'accent différente), texte qui wrap naturellement (pas de troncature — le texte est écrit par le staff, supposé court).

## Fichiers impactés

- `supabase/schema.sql`, `supabase/rls.sql` — table + policies (ajout à la source de vérité, appliqué manuellement en base par l'utilisateur comme d'habitude).
- `js/supabase-annonces.js` (nouveau).
- `js/annonces.js` (nouveau).
- `js/messages.js` — prepend du bandeau annonce en haut de `renderMessages`.
- `js/usager-accueil.js` — fetch + bandeau.
- `css/style.css` — styles du bandeau.
- `index.html` — charger `js/supabase-annonces.js` + `js/annonces.js` (ordre : avant `js/messages.js`).
- `usager.html` — charger `js/supabase-annonces.js` avant `js/usager-accueil.js`.

## Tests

Aucune nouvelle fonction pure (uniquement fetch réseau + construction de HTML) : pas de nouveau test unitaire, cohérent avec la convention du projet (seules les fonctions pures synchrones sont testées).

## Hors scope (v1)

- Historique/réactivation des annonces passées côté staff.
- Dismissible / suivi de lecture par usager.
- Affichage sur d'autres vues usager que l'accueil.
- Plusieurs annonces actives simultanément.
