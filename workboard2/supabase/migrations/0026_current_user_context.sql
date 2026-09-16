-- WorkBoard 2.0 — current user context lookup.
--
-- Every authenticated page previously performed:
--   1) people lookup by auth_user_id
--   2) person_roles lookup by person_id
-- as two sequential network round-trips.
-- Return the same context in one database call.

create function current_user_context()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when p.id is null then null
      else jsonb_build_object(
        'person_id', p.id,
        'full_name', p.full_name,
        'email', p.email,
        'roles', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'role', pr.role,
                'organization_id', pr.organization_id
              )
              order by pr.created_at
            )
            from person_roles pr
            where pr.person_id = p.id
              and pr.valid_from <= current_date
              and (pr.valid_to is null or pr.valid_to >= current_date)
          ),
          '[]'::jsonb
        )
      )
    end
  from people p
  where p.auth_user_id = auth.uid()
  limit 1;
$$;

grant execute on function current_user_context() to authenticated;
