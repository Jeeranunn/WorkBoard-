-- WorkBoard 2.0 — historical role lifecycle.
--
-- Roles are permissions, but still need a historical record. Deleting a role
-- grant destroys history and makes audits ambiguous. Add valid_from/valid_to
-- and make all authorization helpers consider only currently-active grants.

alter table person_roles
  add column valid_from date not null default current_date,
  add column valid_to date;

alter table person_roles
  add constraint person_roles_valid_range
  check (valid_to is null or valid_to >= valid_from);

drop index if exists person_roles_global_unique;
drop index if exists person_roles_scoped_unique;

create unique index person_roles_global_active_unique
  on person_roles (person_id, role)
  where organization_id is null and valid_to is null;

create unique index person_roles_scoped_active_unique
  on person_roles (person_id, role, organization_id)
  where organization_id is not null and valid_to is null;

create or replace function has_role(check_role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from person_roles
    where person_id = current_person_id()
      and role = check_role
      and valid_from <= current_date
      and (valid_to is null or valid_to >= current_date)
  );
$$;

create or replace function has_role_in_organization(check_role app_role, org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from person_roles
    where person_id = current_person_id()
      and role = check_role
      and organization_id = org_id
      and valid_from <= current_date
      and (valid_to is null or valid_to >= current_date)
  );
$$;
