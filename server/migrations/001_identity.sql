-- Apply explicitly in the development project. No client-facing Data API required.
BEGIN;
CREATE SCHEMA IF NOT EXISTS daeguk_private;
REVOKE ALL ON SCHEMA daeguk_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS daeguk_private.players (
  id uuid PRIMARY KEY,
  public_code text NOT NULL UNIQUE CHECK (public_code ~ '^[A-F0-9]{20}$'),
  nickname text NOT NULL CHECK (char_length(nickname) BETWEEN 1 AND 40),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS daeguk_private.identities (
  issuer text NOT NULL,
  subject uuid NOT NULL,
  player_id uuid NOT NULL REFERENCES daeguk_private.players(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (issuer, subject)
);
ALTER TABLE daeguk_private.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE daeguk_private.identities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA daeguk_private FROM PUBLIC, anon, authenticated;
-- The game server's dedicated login role must receive only these grants.
-- Provision its password outside this migration and never commit it.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='daeguk_server') THEN
    CREATE ROLE daeguk_server NOLOGIN;
  END IF;
END $$;
GRANT USAGE ON SCHEMA daeguk_private TO daeguk_server;
GRANT SELECT, INSERT ON daeguk_private.players, daeguk_private.identities TO daeguk_server;
-- Narrow privileged lookup works even when Auth tables have RLS; no direct Auth table grants.
CREATE OR REPLACE FUNCTION daeguk_private.session_is_active(session_uuid uuid, user_uuid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id
    WHERE s.id=session_uuid AND s.user_id=user_uuid
      AND (s.not_after IS NULL OR s.not_after > now())
      AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until < now())
  );
$$;
REVOKE ALL ON FUNCTION daeguk_private.session_is_active(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION daeguk_private.session_is_active(uuid,uuid) TO daeguk_server;
DROP POLICY IF EXISTS game_server_players ON daeguk_private.players;
CREATE POLICY game_server_players ON daeguk_private.players TO daeguk_server USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS game_server_identities ON daeguk_private.identities;
CREATE POLICY game_server_identities ON daeguk_private.identities TO daeguk_server USING (true) WITH CHECK (true);
COMMIT;
