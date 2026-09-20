BEGIN;
CREATE OR REPLACE FUNCTION daeguk_private.delete_player_identity(
  identity_issuer text,
  identity_subject uuid,
  expected_player_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  removed_player_id uuid;
BEGIN
  DELETE FROM daeguk_private.identities
  WHERE issuer = identity_issuer
    AND subject = identity_subject
    AND player_id = expected_player_id
  RETURNING player_id INTO removed_player_id;

  IF removed_player_id IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM daeguk_private.players WHERE id = removed_player_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION daeguk_private.delete_player_identity(text,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION daeguk_private.delete_player_identity(text,uuid,uuid) TO daeguk_server;
COMMIT;
