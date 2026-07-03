-- Activer l'extension uuid si nécessaire (normalement déjà active)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper : extraire le rôle depuis le JWT
CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS text AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role'),
    'user'
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Table inscriptions
CREATE TABLE inscriptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nom              text NOT NULL,
  prenom           text NOT NULL,
  mail             text,
  telephone        text,
  statut           text NOT NULL DEFAULT 'en_attente'
                     CHECK (statut IN ('en_attente', 'valide', 'refuse')),
  pass_actif       boolean NOT NULL DEFAULT false,
  pass_activated_at date,
  handicap         text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Table créneaux (statique, 5 lignes)
CREATE TABLE creneaux (
  id               int PRIMARY KEY,
  label            text NOT NULL,
  heure_debut      time NOT NULL,
  heure_fin        time NOT NULL,
  capacite_resa    int NOT NULL,
  capacite_walkin  int NOT NULL
);

-- Table réservations
CREATE TABLE reservations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date            date NOT NULL,
  creneau_id      int NOT NULL REFERENCES creneaux(id),
  inscription_id  uuid REFERENCES inscriptions(id) ON DELETE SET NULL,
  nom             text NOT NULL,
  prenom          text NOT NULL,
  accompagnants   int NOT NULL DEFAULT 0 CHECK (accompagnants BETWEEN 0 AND 2),
  type            text NOT NULL CHECK (type IN ('reserved', 'walkin')),
  statut          text NOT NULL DEFAULT 'attente'
                    CHECK (statut IN ('attente', 'present', 'parti', 'absent', 'annule')),
  spot_id         text,
  resa_type       text NOT NULL DEFAULT 'normal'
                    CHECK (resa_type IN ('normal', 'groupe')),
  checkin_time    timestamptz,
  depart_time     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date, creneau_id, spot_id)
);

-- Table main courante
CREATE TABLE main_courante (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date        date NOT NULL,
  creneau_id  int NOT NULL REFERENCES creneaux(id),
  compteurs   jsonb NOT NULL DEFAULT '{}',
  staff       jsonb NOT NULL DEFAULT '{}',
  notes       jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date, creneau_id)
);

-- Indexes for RLS policy performance and common query patterns
CREATE INDEX idx_inscriptions_user_id ON inscriptions(user_id);
CREATE INDEX idx_reservations_inscription_id ON reservations(inscription_id);
CREATE INDEX idx_reservations_date_creneau ON reservations(date, creneau_id);
CREATE INDEX idx_main_courante_date_creneau ON main_courante(date, creneau_id);
