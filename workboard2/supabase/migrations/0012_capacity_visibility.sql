-- WorkBoard 2.0 — management capacity visibility
--
-- Product decision update:
-- Managers should understand not only that someone is unavailable, but why.
-- Therefore EXECUTIVE can read personal planner item content and personal
-- planned slots for capacity planning. HEAD receives the same visibility only
-- for people inside organizations they oversee. ADMIN retains support access.
--
-- Write access remains unchanged: only the owner (or ADMIN) can edit personal
-- planner data. This migration changes SELECT visibility only.

drop policy if exists "owner or admin read" on personal_planner_items;
create policy "owner or scoped oversight read" on personal_planner_items for select
  using (
    person_id = current_person_id()
    or is_admin()
    or is_executive()
    or is_head_over_person(person_id)
  );

drop policy if exists "self or oversight read" on availability;
create policy "self or scoped oversight read" on availability for select
  using (
    person_id = current_person_id()
    or is_admin()
    or is_executive()
    or is_head_over_person(person_id)
  );

drop policy if exists "self or formal-work oversight read" on planned_slots;
create policy "self or scoped oversight read" on planned_slots for select
  using (
    person_id = current_person_id()
    or is_admin()
    or is_executive()
    or is_head_over_person(person_id)
  );

-- Intentionally no changes to INSERT/UPDATE/DELETE policies.
