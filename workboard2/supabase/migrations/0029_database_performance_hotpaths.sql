-- WorkBoard 2.0 — database hot-path performance pass.
--
-- Addresses concrete Supabase Performance Advisor findings on production:
--   * covering indexes for foreign-key joins used by hierarchy, management,
--     playbook, audit and team screens
--   * auth.uid() in broad read RLS policies evaluated once per statement
--     instead of once per row
--
-- CREATE INDEX IF NOT EXISTS keeps this safe when an equivalent migration has
-- already introduced an index under the same canonical name.

create index if not exists appointments_position_id_idx
  on appointments(position_id);
create index if not exists milestones_workstream_id_idx
  on milestones(workstream_id);
create index if not exists organization_units_organization_id_idx
  on organization_units(organization_id);
create index if not exists organization_units_parent_unit_id_idx
  on organization_units(parent_unit_id);
create index if not exists organizations_network_id_idx
  on organizations(network_id);
create index if not exists person_roles_organization_id_idx
  on person_roles(organization_id);
create index if not exists playbook_conditional_rules_playbook_id_idx
  on playbook_conditional_rules(playbook_id);
create index if not exists playbook_tasks_playbook_id_idx
  on playbook_tasks(playbook_id);
create index if not exists playbook_tasks_playbook_workstream_id_idx
  on playbook_tasks(playbook_workstream_id);
create index if not exists playbook_workstreams_playbook_id_idx
  on playbook_workstreams(playbook_id);
create index if not exists positions_unit_id_idx
  on positions(unit_id);
create index if not exists projects_owner_person_id_idx
  on projects(owner_person_id);
create index if not exists suggestions_suggested_by_idx
  on suggestions(suggested_by);
create index if not exists task_collaborators_person_id_idx
  on task_collaborators(person_id);
create index if not exists task_comments_author_person_id_idx
  on task_comments(author_person_id);
create index if not exists task_history_changed_by_person_id_idx
  on task_history(changed_by_person_id);
create index if not exists task_submissions_submitted_by_person_id_idx
  on task_submissions(submitted_by_person_id);
create index if not exists tasks_source_playbook_task_id_idx
  on tasks(source_playbook_task_id);
create index if not exists team_memberships_person_id_idx
  on team_memberships(person_id);
create index if not exists team_projects_project_id_idx
  on team_projects(project_id);
create index if not exists teams_network_id_idx
  on teams(network_id);
create index if not exists teams_owner_organization_id_idx
  on teams(owner_organization_id);
create index if not exists time_corrections_corrected_by_person_id_idx
  on time_corrections(corrected_by_person_id);
create index if not exists workstreams_owner_person_id_idx
  on workstreams(owner_person_id);
create index if not exists workstreams_source_playbook_workstream_id_idx
  on workstreams(source_playbook_workstream_id);

-- Supabase's RLS advisor flags direct auth.uid() calls in broad read policies
-- because they may be re-evaluated per row. Wrapping in SELECT turns them into
-- an initplan evaluated once per statement.

drop policy if exists "authenticated read" on networks;
create policy "authenticated read" on networks
for select using ((select auth.uid()) is not null);

drop policy if exists "authenticated read" on organizations;
create policy "authenticated read" on organizations
for select using ((select auth.uid()) is not null);

drop policy if exists "authenticated read" on organization_units;
create policy "authenticated read" on organization_units
for select using ((select auth.uid()) is not null);

drop policy if exists "authenticated read" on positions;
create policy "authenticated read" on positions
for select using ((select auth.uid()) is not null);

drop policy if exists "authenticated read" on people;
create policy "authenticated read" on people
for select using ((select auth.uid()) is not null);

drop policy if exists "authenticated read" on appointments;
create policy "authenticated read" on appointments
for select using ((select auth.uid()) is not null);

drop policy if exists "authenticated read" on teams;
create policy "authenticated read" on teams
for select using ((select auth.uid()) is not null);

drop policy if exists "authenticated read" on team_memberships;
create policy "authenticated read" on team_memberships
for select using ((select auth.uid()) is not null);

drop policy if exists "authenticated read" on team_projects;
create policy "authenticated read" on team_projects
for select using ((select auth.uid()) is not null);

drop policy if exists "authenticated read" on playbooks;
create policy "authenticated read" on playbooks
for select using ((select auth.uid()) is not null);

drop policy if exists "authenticated read" on playbook_workstreams;
create policy "authenticated read" on playbook_workstreams
for select using ((select auth.uid()) is not null);

drop policy if exists "authenticated read" on playbook_tasks;
create policy "authenticated read" on playbook_tasks
for select using ((select auth.uid()) is not null);

drop policy if exists "authenticated read" on playbook_conditional_rules;
create policy "authenticated read" on playbook_conditional_rules
for select using ((select auth.uid()) is not null);
