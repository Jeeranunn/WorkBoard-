-- WorkBoard 2.0 — scoped organization people lookup.
--
-- Appointments/positions/units are the canonical organization membership
-- model. Permission roles are not membership. Management screens previously
-- used multiple sequential queries (or person_roles) to discover assignable
-- people. This RPC resolves active membership in one DB query and enforces
-- that the caller is ADMIN or HEAD for every requested organization.

create function managed_people_in_organizations(p_organization_ids uuid[])
returns table (
  person_id uuid,
  full_name text,
  organization_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
begin
  if p_organization_ids is null or cardinality(p_organization_ids) = 0 then
    return;
  end if;

  if not is_admin() then
    foreach org_id in array p_organization_ids
    loop
      if not has_role_in_organization('HEAD', org_id) then
        raise exception 'ไม่มีสิทธิ์ดูบุคลากรขององค์กรนี้';
      end if;
    end loop;
  end if;

  return query
    select distinct
      pe.id,
      pe.full_name,
      ou.organization_id
    from appointments a
    join positions p on p.id = a.position_id
    join organization_units ou on ou.id = p.unit_id
    join people pe on pe.id = a.person_id
    where ou.organization_id = any (p_organization_ids)
      and a.valid_from <= current_date
      and (a.valid_to is null or a.valid_to >= current_date)
      and p.valid_from <= current_date
      and (p.valid_to is null or p.valid_to >= current_date)
      and ou.valid_from <= current_date
      and (ou.valid_to is null or ou.valid_to >= current_date)
    order by pe.full_name;
end;
$$;

grant execute on function managed_people_in_organizations(uuid[]) to authenticated;
