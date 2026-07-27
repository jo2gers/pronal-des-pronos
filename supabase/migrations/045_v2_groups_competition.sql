-- 045: friends-leagues become per-competition.
-- Existing WC leagues are backfilled to the archive competition; create_group
-- gains p_competition_id (defaulted → old callers keep working) and validates
-- it against ACTIVE competitions.

update public.groups
  set competition_id = (select id from public.competitions where slug = 'wc-2026')
  where competition_id is null;

drop function public.create_group(text, text, boolean);

create function public.create_group(
  p_name text,
  p_description text,
  p_is_public boolean,
  p_competition_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_gid uuid := gen_random_uuid();
  v_name text := trim(p_name);
  v_comp uuid := p_competition_id;
begin
  if v_uid is null then return jsonb_build_object('status','unauthenticated'); end if;
  if v_name is null or length(v_name) < 2 then
    return jsonb_build_object('status','invalid_name');
  end if;

  -- V2: a league lives in one ACTIVE competition. Default (legacy callers):
  -- the earliest-starting active competition.
  if v_comp is null then
    select id into v_comp from public.competitions where active order by starts_at nulls last limit 1;
  elsif not exists (select 1 from public.competitions where id = v_comp and active) then
    return jsonb_build_object('status','invalid_competition');
  end if;

  insert into groups (id, name, description, creator_id, is_public, competition_id)
  values (v_gid, v_name, nullif(trim(coalesce(p_description,'')), ''), v_uid, coalesce(p_is_public, true), v_comp);

  insert into group_members (group_id, user_id, role)
  values (v_gid, v_uid, 'admin');

  return jsonb_build_object('status','created', 'group_id', v_gid);
end;
$function$;
