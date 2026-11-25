-- ════════════════════════════════════════════════════════════════════════
-- Migration : fermetures ponctuelles de la plage
-- À exécuter UNE FOIS dans Supabase → SQL Editor → New query → Run.
-- Le script peut être relancé sans risque (IF NOT EXISTS / DROP … IF EXISTS).
-- ════════════════════════════════════════════════════════════════════════

-- 1. Nouveau statut de réservation « suspendu » (plage fermée)
--    Une réservation suspendue dont le créneau est passé est recréditée sur le pass.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.reservations'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%statut%'
  LOOP
    EXECUTE format('ALTER TABLE public.reservations DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_statut_check
  CHECK (statut IN ('attente', 'present', 'parti', 'absent', 'annule', 'suspendu'));

-- 2. Table des fermetures (une ligne par fermeture ; réouverture éventuelle)
CREATE TABLE IF NOT EXISTS public.fermetures (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date               date NOT NULL,
  heure_fermeture    time NOT NULL,
  heure_reouverture  time,
  motif              text,
  precision          text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fermetures_date ON public.fermetures(date);

ALTER TABLE public.fermetures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fermetures_staff_all" ON public.fermetures;
CREATE POLICY "fermetures_staff_all" ON public.fermetures
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'staff')
  WITH CHECK (public.auth_user_role() = 'staff');

-- Les usagers connectés peuvent lire les fermetures (créneaux affichés « fermés »)
DROP POLICY IF EXISTS "fermetures_lecture" ON public.fermetures;
CREATE POLICY "fermetures_lecture" ON public.fermetures
  FOR SELECT TO authenticated
  USING (true);

-- 3. Garde-fou : aucune nouvelle réservation sur un créneau touché par une fermeture
CREATE OR REPLACE FUNCTION public.refuser_reservation_plage_fermee()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.statut = 'attente' AND EXISTS (
    SELECT 1
    FROM public.fermetures f
    JOIN public.creneaux c ON c.id = NEW.creneau_id
    WHERE f.date = NEW.date
      AND c.heure_fin   > f.heure_fermeture
      AND c.heure_debut < COALESCE(f.heure_reouverture, time '23:59:59')
  ) THEN
    RAISE EXCEPTION 'La Handiplage est fermée sur ce créneau : aucune réservation possible.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_refuser_reservation_plage_fermee ON public.reservations;
CREATE TRIGGER trg_refuser_reservation_plage_fermee
  BEFORE INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.refuser_reservation_plage_fermee();
