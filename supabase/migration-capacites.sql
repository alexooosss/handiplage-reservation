-- ════════════════════════════════════════════════════════════════════════
-- Migration : capacités ajustables par créneau (usagers / groupes)
-- À exécuter UNE FOIS dans Supabase → SQL Editor → New query → Run.
-- Peut être relancé sans risque. Aucune donnée existante n'est modifiée.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Réglages ponctuels : sans ligne pour une date/créneau, la capacité normale s'applique
--    (35 places : 25 usagers + 10 groupes). Places usagers = capacité − places groupes.
CREATE TABLE IF NOT EXISTS public.capacites (
  date             date NOT NULL,
  creneau_id       int  NOT NULL REFERENCES public.creneaux(id),
  capacite_totale  int  NOT NULL CHECK (capacite_totale BETWEEN 0 AND 300),
  places_groupes   int  NOT NULL CHECK (places_groupes >= 0),
  groupe_id        uuid,            -- groupe à qui les places groupes sont attribuées (facultatif)
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (date, creneau_id)
);

ALTER TABLE public.capacites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "capacites_staff_all" ON public.capacites;
CREATE POLICY "capacites_staff_all" ON public.capacites
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'staff')
  WITH CHECK (public.auth_user_role() = 'staff');

-- Les usagers connectés lisent les capacités (nombre de places affiché)
DROP POLICY IF EXISTS "capacites_lecture" ON public.capacites;
CREATE POLICY "capacites_lecture" ON public.capacites
  FOR SELECT TO authenticated
  USING (true);

-- 2. Garde-fou : un usager ne peut pas réserver au-delà des places en ligne du créneau.
--    Le staff, lui, peut dépasser (l'interface lui demande une confirmation).
--    Les réservations déjà faites ne sont jamais touchées.
CREATE OR REPLACE FUNCTION public.refuser_reservation_creneau_complet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  places int;
  prises int;
BEGIN
  IF COALESCE(NEW.statut, 'attente') <> 'attente' OR COALESCE(NEW.resa_type, 'normal') <> 'normal' OR COALESCE(NEW.type, 'reserved') <> 'reserved'
     OR COALESCE(public.auth_user_role(), '') = 'staff' THEN
    RETURN NEW;
  END IF;

  -- Une seule réservation à la fois par créneau : évite que deux usagers prennent la dernière place
  PERFORM pg_advisory_xact_lock(hashtext('resa:' || NEW.date::text || ':' || NEW.creneau_id::text));

  SELECT GREATEST(c.capacite_totale - c.places_groupes, 0) INTO places
  FROM public.capacites c
  WHERE c.date = NEW.date AND c.creneau_id = NEW.creneau_id;

  IF places IS NULL THEN
    SELECT cr.capacite_resa INTO places FROM public.creneaux cr WHERE cr.id = NEW.creneau_id;
  END IF;

  SELECT count(*) INTO prises
  FROM public.reservations r
  WHERE r.date = NEW.date AND r.creneau_id = NEW.creneau_id
    AND COALESCE(r.resa_type, 'normal') = 'normal' AND COALESCE(r.type, 'reserved') = 'reserved'
    AND r.statut NOT IN ('annule', 'suspendu');

  IF prises >= COALESCE(places, 0) THEN
    RAISE EXCEPTION 'Ce créneau est complet : plus de place disponible en ligne.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_refuser_reservation_creneau_complet ON public.reservations;
CREATE TRIGGER trg_refuser_reservation_creneau_complet
  BEFORE INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.refuser_reservation_creneau_complet();
