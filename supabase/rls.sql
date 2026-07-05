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

-- ── Policy anon INSERT sur inscriptions ─────────────────────────────────

-- Permet aux personnes non connectées de déposer une demande d'inscription
CREATE POLICY "public_insert_inscription" ON inscriptions
  FOR INSERT
  WITH CHECK (
    statut = 'en_attente'
    AND user_id IS NULL
  );
