-- WorkBoard 2.0 — planner scheduling integrity.
--
-- Prevent contradictory schedules:
-- * end_time must be strictly later than start_time
-- * a person cannot have overlapping planned slots on the same date
-- * a person cannot have overlapping availability declarations on the same date
--
-- Availability and planned work may overlap each other by design: availability
-- is descriptive capacity context, while planned_slots is the actual plan.

create function check_planned_slot_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.end_time <= new.start_time then
    raise exception 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม';
  end if;

  if exists (
    select 1
    from planned_slots ps
    where ps.person_id = new.person_id
      and ps.date = new.date
      and ps.id <> new.id
      and new.start_time < ps.end_time
      and new.end_time > ps.start_time
  ) then
    raise exception 'ช่วงเวลานี้ทับกับแผนที่มีอยู่แล้ว';
  end if;

  return new;
end;
$$;

create trigger planned_slots_integrity
  before insert or update on planned_slots
  for each row execute function check_planned_slot_integrity();

create function check_availability_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.end_time <= new.start_time then
    raise exception 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม';
  end if;

  if exists (
    select 1
    from availability a
    where a.person_id = new.person_id
      and a.date = new.date
      and a.id <> new.id
      and new.start_time < a.end_time
      and new.end_time > a.start_time
  ) then
    raise exception 'ช่วงเวลานี้ทับกับ Availability ที่มีอยู่แล้ว';
  end if;

  return new;
end;
$$;

create trigger availability_integrity
  before insert or update on availability
  for each row execute function check_availability_integrity();
