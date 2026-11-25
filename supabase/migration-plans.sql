-- ════════════════════════════════════════════════════════════════════════
-- Migration : plans de la plage (sauvegardes, plan par défaut, programmation)
-- Prérequis : migration-roles.sql (fonction auth_est_responsable).
-- À exécuter UNE FOIS dans Supabase → SQL Editor → New query → Run.
-- Peut être relancé sans risque. Aucune donnée existante n'est modifiée.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Plans enregistrés. contenu = places, tapis, douches, barnums (le décor fixe reste dans le code).
--    Les identifiants de places (P1, P2…) ne sont jamais réutilisés : l'historique reste juste.
CREATE TABLE IF NOT EXISTS public.plans (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom          text NOT NULL CHECK (length(trim(nom)) BETWEEN 1 AND 80),
  description  text,
  contenu      jsonb NOT NULL,
  par_defaut   boolean NOT NULL DEFAULT false,
  brouillon    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
-- Un seul plan par défaut
CREATE UNIQUE INDEX IF NOT EXISTS plans_un_seul_defaut ON public.plans (par_defaut) WHERE par_defaut;

-- 2. Programmation : tel plan du … au … (un plan d'un jour passe devant un plan de saison)
CREATE TABLE IF NOT EXISTS public.plans_programmation (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  date_debut  date NOT NULL,
  date_fin    date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (date_fin >= date_debut)
);
CREATE INDEX IF NOT EXISTS plans_programmation_dates ON public.plans_programmation (date_debut, date_fin);

-- 3. Droits : tout le staff lit, seul un responsable modifie
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans_programmation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plans_staff_lecture" ON public.plans;
CREATE POLICY "plans_staff_lecture" ON public.plans
  FOR SELECT TO authenticated USING (public.auth_user_role() = 'staff');
DROP POLICY IF EXISTS "plans_responsable_ecriture" ON public.plans;
CREATE POLICY "plans_responsable_ecriture" ON public.plans
  FOR ALL TO authenticated
  USING (public.auth_est_responsable()) WITH CHECK (public.auth_est_responsable());

DROP POLICY IF EXISTS "plans_prog_staff_lecture" ON public.plans_programmation;
CREATE POLICY "plans_prog_staff_lecture" ON public.plans_programmation
  FOR SELECT TO authenticated USING (public.auth_user_role() = 'staff');
DROP POLICY IF EXISTS "plans_prog_responsable_ecriture" ON public.plans_programmation;
CREATE POLICY "plans_prog_responsable_ecriture" ON public.plans_programmation
  FOR ALL TO authenticated
  USING (public.auth_est_responsable()) WITH CHECK (public.auth_est_responsable());

-- 4. Plan en service à une date : la programmation la plus courte qui couvre la date,
--    sinon le plan par défaut. Les brouillons ne sont jamais mis en service.
CREATE OR REPLACE FUNCTION public.plan_du_jour(p_date date DEFAULT current_date)
RETURNS uuid AS $$
  SELECT COALESCE(
    (SELECT pp.plan_id
       FROM public.plans_programmation pp
       JOIN public.plans p ON p.id = pp.plan_id AND NOT p.brouillon
      WHERE p_date BETWEEN pp.date_debut AND pp.date_fin
      ORDER BY (pp.date_fin - pp.date_debut), pp.created_at DESC
      LIMIT 1),
    (SELECT id FROM public.plans WHERE par_defaut LIMIT 1)
  )
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp;

-- 5. Plan d'origine = le plan actuel, à l'identique (créé une seule fois)
INSERT INTO public.plans (nom, description, contenu, par_defaut)
SELECT 'Plan d''origine', 'Plan historique de la plage (54 places).', '{"version":1,"spots":[{"id":"P1","label":"Place 1","x":40,"y":30},{"id":"P2","label":"Place 2","x":90,"y":30},{"id":"P3","label":"Place 3","x":140,"y":30},{"id":"P4","label":"Place 4","x":210,"y":30},{"id":"P5","label":"Place 5","x":260,"y":30},{"id":"P6","label":"Place 6","x":310,"y":30},{"id":"P7","label":"Place 7","x":380,"y":30},{"id":"P8","label":"Place 8","x":430,"y":30},{"id":"P9","label":"Place 9","x":480,"y":30},{"id":"P10","label":"Place 10","x":550,"y":30},{"id":"P11","label":"Place 11","x":600,"y":30},{"id":"P12","label":"Place 12","x":650,"y":30},{"id":"P13","label":"Place 13","x":700,"y":30},{"id":"P14","label":"Place 14","x":750,"y":30},{"id":"P15","label":"Place 15","x":40,"y":100},{"id":"P16","label":"Place 16","x":90,"y":100},{"id":"P17","label":"Place 17","x":140,"y":100},{"id":"P18","label":"Place 18","x":40,"y":150},{"id":"P19","label":"Place 19","x":90,"y":150},{"id":"P20","label":"Place 20","x":140,"y":150},{"id":"P21","label":"Place 21","x":40,"y":200},{"id":"P22","label":"Place 22","x":90,"y":200},{"id":"P23","label":"Place 23","x":140,"y":200},{"id":"P24","label":"Place 24","x":210,"y":100},{"id":"P25","label":"Place 25","x":210,"y":150},{"id":"P26","label":"Place 26","x":210,"y":200},{"id":"P27","label":"Place 27","x":260,"y":125},{"id":"P28","label":"Place 28","x":260,"y":175},{"id":"P29","label":"Place 29","x":310,"y":100},{"id":"P30","label":"Place 30","x":310,"y":150},{"id":"P31","label":"Place 31","x":310,"y":200},{"id":"P32","label":"Place 32","x":380,"y":100},{"id":"P33","label":"Place 33","x":380,"y":150},{"id":"P34","label":"Place 34","x":380,"y":200},{"id":"P35","label":"Place 35","x":430,"y":125},{"id":"P36","label":"Place 36","x":430,"y":175},{"id":"P37","label":"Place 37","x":480,"y":100},{"id":"P38","label":"Place 38","x":480,"y":150},{"id":"P39","label":"Place 39","x":480,"y":200},{"id":"P40","label":"Place 40","x":550,"y":100},{"id":"P41","label":"Place 41","x":600,"y":100},{"id":"P42","label":"Place 42","x":650,"y":100},{"id":"P43","label":"Place 43","x":700,"y":100},{"id":"P44","label":"Place 44","x":750,"y":100},{"id":"P45","label":"Place 45","x":550,"y":150},{"id":"P46","label":"Place 46","x":600,"y":150},{"id":"P47","label":"Place 47","x":650,"y":150},{"id":"P48","label":"Place 48","x":700,"y":150},{"id":"P49","label":"Place 49","x":750,"y":150},{"id":"P50","label":"Place 50","x":550,"y":200},{"id":"P51","label":"Place 51","x":600,"y":200},{"id":"P52","label":"Place 52","x":650,"y":200},{"id":"P53","label":"Place 53","x":700,"y":200},{"id":"P54","label":"Place 54","x":750,"y":200}],"tapisH":[{"y":56,"x":30,"width":750,"label":"Allée fond"},{"y":232,"x":130,"width":650,"label":"Allée avant"}],"tapisV":[{"x":169,"top":19,"height":257,"label":"Allée 1-2"},{"x":339,"top":19,"height":277,"label":"Allée 2-3"},{"x":509,"top":19,"height":277,"label":"Allée 3-4"}],"showers":[{"x":196,"y":260,"label":"Douche 1"},{"x":366,"y":260,"label":"Douche 2"},{"x":536,"y":260,"label":"Douche 3"}],"barnums":[]}'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.plans);

-- Vérification : doit afficher « Plan d'origine », 54 places, par défaut
SELECT nom, jsonb_array_length(contenu -> 'spots') AS places, par_defaut FROM public.plans;
