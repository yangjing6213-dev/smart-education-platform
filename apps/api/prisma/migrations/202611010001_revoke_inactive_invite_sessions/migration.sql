BEGIN;

CREATE FUNCTION public.require_active_invite_session_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  -- A concurrent status change must finish before issuance can accept this user.
  PERFORM 1 FROM public.users WHERE id = NEW.user_id AND status = 'ACTIVE' FOR SHARE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.require_active_invite_session_user() FROM PUBLIC;

CREATE FUNCTION public.revoke_user_invite_sessions_on_status_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  DELETE FROM public.invite_auth_sessions WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_user_invite_sessions_on_status_change() FROM PUBLIC;

CREATE TRIGGER revoke_invite_sessions_on_user_status_change
AFTER UPDATE OF status ON public.users
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.revoke_user_invite_sessions_on_status_change();

CREATE TRIGGER issue_invite_session_only_for_active_user
BEFORE INSERT ON public.invite_auth_sessions
FOR EACH ROW EXECUTE FUNCTION public.require_active_invite_session_user();

DELETE FROM public.invite_auth_sessions AS session
USING public.users AS actor
WHERE actor.id = session.user_id AND actor.status <> 'ACTIVE';

COMMIT;
