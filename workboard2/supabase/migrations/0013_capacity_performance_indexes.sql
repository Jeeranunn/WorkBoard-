-- WorkBoard 2.0 — capacity/planner query indexes.
--
-- 0010 created (person_id, date) indexes, which are efficient for a person's
-- own weekly planner. Executive/Head capacity dashboards query by date across
-- many people, so those composite indexes cannot efficiently serve the
-- date-only predicate. Add the complementary date-leading indexes.

create index availability_date_idx on availability (date);

create index planned_slots_date_idx on planned_slots (date);

-- Rollback:
-- drop index if exists planned_slots_date_idx;
-- drop index if exists availability_date_idx;
