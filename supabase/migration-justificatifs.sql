-- ════════════════════════════════════════════════════════════════════════════
-- Justificatifs chargés à la demande (réduit fortement le volume de données envoyées)
--
-- 1. Garde-fou : un enregistrement de fiche qui ne contient pas les justificatifs
--    (fiche ouverte sans les avoir téléchargés) les conserve tels quels en base.
--    Un justificatif n'est effacé que si on l'envoie explicitement à null (bouton ✕),
--    et remplacé que si on en envoie un nouveau.
-- 2. Vue « inscriptions_fiche » : la fiche sans les justificatifs (seulement leur
--    nom et leur type), pour l'afficher sans télécharger plusieurs Mo.
--    security_invoker : la vue applique les mêmes règles d'accès (RLS) que la table.
--
-- À exécuter une fois dans Supabase → SQL Editor. Sans risque à relancer.
-- Tant qu'elle n'est pas exécutée, le site continue de tout charger comme avant.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Garde-fou sur les justificatifs
CREATE OR REPLACE FUNCTION public.garder_justificatifs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.metadata IS NOT NULL AND OLD.metadata IS NOT NULL THEN
    IF NOT (NEW.metadata ? 'justificatif1') AND (OLD.metadata ? 'justificatif1') THEN
      NEW.metadata := jsonb_set(NEW.metadata, '{justificatif1}', OLD.metadata -> 'justificatif1');
    END IF;
    IF NOT (NEW.metadata ? 'justificatif2') AND (OLD.metadata ? 'justificatif2') THEN
      NEW.metadata := jsonb_set(NEW.metadata, '{justificatif2}', OLD.metadata -> 'justificatif2');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_garder_justificatifs ON public.inscriptions;
CREATE TRIGGER trg_garder_justificatifs
  BEFORE UPDATE OF metadata ON public.inscriptions
  FOR EACH ROW EXECUTE FUNCTION public.garder_justificatifs();

-- 2. Fiche sans les justificatifs
CREATE OR REPLACE VIEW public.inscriptions_fiche
WITH (security_invoker = true) AS
SELECT
  id, user_id, nom, prenom, mail, telephone, statut,
  pass_actif, pass_activated_at, derniere_saison_validee,
  created_at, updated_at,
  COALESCE(metadata, '{}'::jsonb) - 'justificatif1' - 'justificatif2' AS metadata,
  -- début du fichier (« data:image/jpeg;base64… » ou « data:application/pdf… ») : type du document
  left(metadata ->> 'justificatif1', 40) AS justificatif1_entete,
  left(metadata ->> 'justificatif2', 40) AS justificatif2_entete
FROM public.inscriptions;

GRANT SELECT ON public.inscriptions_fiche TO authenticated;

COMMIT;

-- ── Vérification (doit renvoyer 1 ligne : trg_garder_justificatifs) ──
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_garder_justificatifs';
