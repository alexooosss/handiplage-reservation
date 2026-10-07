-- Activer RLS sur toutes les tables
ALTER TABLE inscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE creneaux       ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE main_courante  ENABLE ROW LEVEL SECURITY;

-- inscriptions : staff = accès total, usager = lecture de sa propre ligne
CREATE POLICY "inscriptions_staff_all" ON inscriptions
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'staff')
  WITH CHECK (public.auth_user_role() = 'staff');

CREATE POLICY "inscriptions_user_read_own" ON inscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- creneaux : lecture publique (y compris non connecté)
CREATE POLICY "creneaux_public_read" ON creneaux
  FOR SELECT TO anon, authenticated
  USING (true);

-- reservations : staff = accès total
--                usager = CRUD sur ses propres réservations
CREATE POLICY "reservations_staff_all" ON reservations
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'staff')
  WITH CHECK (public.auth_user_role() = 'staff');

CREATE POLICY "reservations_user_own" ON reservations
  FOR ALL TO authenticated
  USING (
    inscription_id IN (
      SELECT id FROM inscriptions WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    inscription_id IN (
      SELECT id FROM inscriptions WHERE user_id = auth.uid()
    )
  );

-- main_courante : staff uniquement
CREATE POLICY "mc_staff_all" ON main_courante
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'staff')
  WITH CHECK (public.auth_user_role() = 'staff');

-- ── Policies table messages ──────────────────────────────────────────────

-- Staff : accès complet
CREATE POLICY "staff_full_messages" ON messages
  FOR ALL
  USING (auth_user_role() = 'staff')
  WITH CHECK (auth_user_role() = 'staff');

-- ── Policies table annonces ──────────────────────────────────────────────

ALTER TABLE annonces ENABLE ROW LEVEL SECURITY;

-- Staff : lecture/écriture totale (création, désactivation, historique).
CREATE POLICY "staff_full_annonces" ON annonces
  FOR ALL
  USING (auth_user_role() = 'staff')
  WITH CHECK (auth_user_role() = 'staff');

-- Usagers (et anon) : lecture de l'annonce active uniquement — nécessaire
-- pour l'afficher sur l'écran d'accueil usager.
CREATE POLICY "annonces_select_active" ON annonces
  FOR SELECT TO anon, authenticated
  USING (actif = true);

-- ── Policy anon INSERT sur inscriptions ─────────────────────────────────

-- Permet aux personnes non connectées de déposer une demande d'inscription
CREATE POLICY "public_insert_inscription" ON inscriptions
  FOR INSERT
  WITH CHECK (
    statut = 'en_attente'
    AND user_id IS NULL
  );

-- ── Policies table app_config ────────────────────────────────────────────

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Lecture : tout le monde, y compris non connecté — nécessaire pour que la
-- page d'inscription publique affiche les dates de saison. RLS est au niveau
-- de la ligne, pas de la colonne : ça rend aussi saison_courante lisible en
-- anon (sans conséquence, c'est juste l'année de saison en cours, déjà
-- visible ailleurs dans le HTML public). Rien de sensible dans cette table —
-- même traitement que creneaux_public_read. Toute future colonne ajoutée à
-- app_config hérite automatiquement de cette lecture publique.
CREATE POLICY "app_config_read_all" ON app_config
  FOR SELECT TO anon, authenticated
  USING (true);

-- Écriture : staff uniquement (bouton "Ouvrir la saison").
CREATE POLICY "app_config_staff_write" ON app_config
  FOR UPDATE TO authenticated
  USING (public.auth_user_role() = 'staff')
  WITH CHECK (public.auth_user_role() = 'staff');
