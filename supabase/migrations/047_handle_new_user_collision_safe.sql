-- 047: make OAuth signup collision-safe.
--
-- handle_new_user() set profiles.username to the email prefix for OAuth users
-- (Google carries no chosen username). username is UNIQUE, so if that prefix was
-- already taken the INSERT raised unique_violation, which aborted the auth.users
-- INSERT and dead-ended the user at /auth/login?error=oauth_exchange with no
-- workaround. Password signups still send an app-validated username in metadata
-- and must keep raising on collision (so the register form shows "taken") — only
-- the OAuth email-prefix path gets a suffix-on-conflict.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $function$
declare
  v_meta text := new.raw_user_meta_data->>'username';
  v_base text;
  v_candidate text;
  v_n int := 0;
begin
  -- Explicit username (password signup, already app-validated): insert as-is so
  -- a collision raises unique_violation and the register form can say "taken".
  if v_meta is not null then
    insert into public.profiles (id, username) values (new.id, v_meta);
    return new;
  end if;

  -- OAuth (no chosen username): derive from the email prefix, but make it
  -- collision-safe so signup never hard-fails on an already-taken prefix.
  v_base := split_part(new.email, '@', 1);
  if v_base is null or length(v_base) = 0 then
    v_base := 'user';
  end if;
  v_candidate := v_base;
  while exists (select 1 from public.profiles where username = v_candidate) loop
    v_n := v_n + 1;
    v_candidate := v_base || v_n;
  end loop;
  insert into public.profiles (id, username) values (new.id, v_candidate);
  return new;
end;
$function$;
