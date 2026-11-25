-- ════════════════════════════════════════════════════════════════════════
-- Migration : rôles sécurisés (staff / user) + rôle « responsable »
-- À exécuter UNE FOIS dans Supabase → SQL Editor → New query → Run.
-- Peut être relancé sans risque.
--
-- Pourquoi : le rôle était lu dans user_metadata, que chaque utilisateur peut
-- modifier lui-même depuis le navigateur (supabase.auth.updateUser). Un usager
-- pouvait donc se déclarer « staff ». Le rôle est désormais lu dans
-- app_metadata, modifiable uniquement par l'administration Supabase.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Recopier les rôles existants dans app_metadata (sans écraser un rôle déjà posé)
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                        || jsonb_build_object('role', raw_user_meta_data ->> 'role')
WHERE raw_user_meta_data ->> 'role' IN ('staff', 'user')
  AND NOT (COALESCE(raw_app_meta_data, '{}'::jsonb) ? 'role');

-- 1b. Tout nouveau compte reçoit le rôle « user » par défaut (un compte staff se crée ensuite
--     avec definir_role, plus bas). Rien ne peut donc créer un compte staff par erreur.
CREATE OR REPLACE FUNCTION public.role_par_defaut_nouveau_compte()
RETURNS trigger AS $$
BEGIN
  IF NOT (COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) ? 'role') THEN
    NEW.raw_app_meta_data := COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || '{"role":"user"}'::jsonb;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_role_par_defaut_nouveau_compte ON auth.users;
CREATE TRIGGER trg_role_par_defaut_nouveau_compte
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.role_par_defaut_nouveau_compte();

-- 1c. Comptes existants sans aucun rôle : usager
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"user"}'::jsonb
WHERE NOT (COALESCE(raw_app_meta_data, '{}'::jsonb) ? 'role');

-- 2. Toutes les règles d'accès (RLS) passent par cette fonction : elles suivent automatiquement
CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS text AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', 'user')
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- 3. Responsable : membre du staff autorisé à modifier les plans de la plage
CREATE OR REPLACE FUNCTION public.auth_est_responsable()
RETURNS boolean AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'staff'
     AND COALESCE((auth.jwt() -> 'app_metadata' ->> 'responsable')::boolean, false)
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- 4. Outil d'administration : définir le rôle d'un compte (SQL Editor uniquement)
--    Exemples :
--      SELECT public.definir_role('prenom.nom@exemple.fr', 'staff', true);   -- responsable
--      SELECT public.definir_role('prenom.nom@exemple.fr', 'staff', false);  -- staff simple
--      SELECT public.definir_role('prenom.nom@exemple.fr', 'user',  false);  -- usager
--    La personne doit se reconnecter (ou attendre au plus une heure) pour que ce soit pris en compte.
CREATE OR REPLACE FUNCTION public.definir_role(p_email text, p_role text, p_responsable boolean DEFAULT false)
RETURNS text AS $$
DECLARE n int;
BEGIN
  IF p_role NOT IN ('staff', 'user') THEN
    RAISE EXCEPTION 'Rôle inconnu : % (staff ou user)', p_role;
  END IF;
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', p_role, 'responsable', (p_role = 'staff' AND p_responsable))
  WHERE lower(email) = lower(p_email);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'Aucun compte avec cet e-mail'; END IF;
  RETURN p_email || ' → ' || p_role || CASE WHEN p_role = 'staff' AND p_responsable THEN ' (responsable)' ELSE '' END;
END $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Personne d'autre que l'administration (SQL Editor) ne peut appeler cet outil
REVOKE ALL ON FUNCTION public.definir_role(text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.definir_role(text, text, boolean) FROM anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 5. VÉRIFICATIONS (le résultat s'affiche sous l'éditeur)
-- ════════════════════════════════════════════════════════════════════════

-- 5a. Comptes staff : vérifier que la liste ne contient QUE des membres de l'équipe.
--     Un compte inconnu ici → le repasser en usager avec definir_role(..., 'user').
SELECT email,
       raw_app_meta_data ->> 'role'        AS role,
       raw_app_meta_data ->> 'responsable' AS responsable,
       created_at, last_sign_in_at
FROM auth.users
WHERE raw_app_meta_data ->> 'role' = 'staff'
ORDER BY created_at;

-- 5b. Règles ou fonctions qui liraient encore user_metadata (doit être vide)
-- SELECT schemaname, tablename, policyname FROM pg_policies
-- WHERE qual ILIKE '%user_metadata%' OR with_check ILIKE '%user_metadata%';
-- SELECT proname FROM pg_proc WHERE prosrc ILIKE '%user_metadata%' AND pronamespace = 'public'::regnamespace;
