# WorkBoard 2.0

ระบบใหม่ของ WorkBoard สร้างด้วย Next.js App Router + TypeScript + Supabase
แยกต่างหากจากระบบเดิม (`index.html` / `script.js` / `style.css` ที่ root ของ repo)
ระบบเดิมยังใช้งานได้ตามปกติและไม่ถูกแก้ไขจากการพัฒนา WorkBoard 2.0

## สถานะ: Milestone 5.1 — พร้อมทดสอบกับผู้ใช้จริง (ยังไม่ launch)

Schema (`supabase/migrations/0001` ถึง `0009`, รันตามลำดับ, ห้ามข้าม):

- **0001–0002**: Network/Organization/Unit/Position/Person/Appointment,
  `teams` ตารางเดียวข้ามองค์กรได้, `person_roles` แยก global (ADMIN/EXECUTIVE)
  กับ scoped (HEAD/MEMBER) role, RLS ทุกตาราง
- **0003–0006**: Project/Workstream/Milestone/Task/Subtask/Dependency,
  current holder คำนวณอัตโนมัติ (nullable เมื่อจบงาน), workflow เต็มรูปแบบ
  (Assigned → ... → Pending Approval → Approved → Completed) ผ่าน RPC
  เฉพาะทาง (ไม่เปิด UPDATE ทั้งแถวให้ MEMBER), reviewer/approver แยกขั้นจริง
- **0007**: Playbook v0 (`EVENT_ACTIVITY` template) + `apply_playbook_to_project()`
- **0008–0009**: Time tracking (Attendance แยกจาก Task Time, source
  SYSTEM_TRACKED/RECONSTRUCTED/SELF_DECLARED, correction audit trail),
  HEAD oversight scope ผูกกับ appointment/organization จริง ไม่ใช่ global role

หน้า UI: `/login`, `/overview`, `/my-work` (จริง — attendance + งานของฉัน),
`/tasks/[taskId]` (รายละเอียด+workflow+comment+timer), `/projects`,
`/projects/new`, `/projects/[projectId]` (+ completeness + playbook),
`/executive` (ADMIN/EXECUTIVE), `/teams`, `/teams/[teamId]`,
`/admin/*` (จัดการโครงสร้างองค์กร/ทีม/บทบาท)

**ยังไม่ทำ / known gaps**: file upload สำหรับ submission (ใช้ link ไปก่อน),
ไม่มี UI สำหรับเรียก correction RPC (มีแค่ schema/RPC), Meeting→Task,
Weekly report, semantic search — ดู `docs/testing-checklist.md`

## การรัน

### ติดตั้ง

```bash
cd workboard2
npm install
```

### ตั้งค่า Supabase

1. สร้างโปรเจกต์ Supabase ใหม่ (หรือใช้ `supabase start` รันเครื่อง local
   ผ่าน Docker — `supabase/config.toml` ตั้งไว้แล้ว)
2. รัน migration **ตามลำดับเลขไฟล์** ทั้งหมดใน `supabase/migrations/`
   ผ่าน Supabase SQL editor หรือ `supabase db push` (หรือ `supabase db reset`
   สำหรับ local ซึ่งรัน `supabase/seed.sql` ต่อท้ายด้วย)
3. คัดลอก `.env.local.example` เป็น `.env.local` แล้วใส่ค่า
   `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. สร้างผู้ใช้แรกใน Supabase Auth (อีเมล/รหัสผ่าน) แล้ว insert แถวใน `people`
   ที่มี `email` ตรงกันและ `auth_user_id` เท่ากับ id ของผู้ใช้นั้น
   จากนั้น insert แถวใน `person_roles` role = `ADMIN` เพื่อเข้าใช้หน้า admin

ทดสอบด้วยข้อมูลตัวอย่าง (ADMIN/EXECUTIVE/HEAD×2/MEMBER×2, 2 องค์กร,
โครงการ/ทีม/งานตัวอย่าง) และชุดตรวจ RLS/workflow/time-tracking อัตโนมัติ:
ดู `docs/testing-checklist.md` — **ห้ามรัน `seed.sql` กับโปรเจกต์ที่มีผู้ใช้จริง**

### พัฒนา

```bash
npm run dev
```

### Build / typecheck / lint

```bash
npm run build   # รวม typecheck ของ Next.js
npm run lint
```

## Deploy บน Vercel

1. เชื่อม repo นี้กับ Vercel, ตั้ง **Root Directory = `workboard2`**
   (โปรเจกต์ Next.js อยู่ในโฟลเดอร์ย่อย ไม่ใช่ root ของ repo)
2. Build command / Output: ใช้ค่า default ของ Next.js framework preset
   (`next build`) ไม่ต้องแก้
3. ตั้ง Environment Variables (Production + Preview ทั้งคู่):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. รัน migration บน Supabase project จริงให้ครบก่อน deploy (ดูหัวข้อ
   "ตั้งค่า Supabase" ด้านบน) — ไม่มี migration ไหนรันอัตโนมัติตอน build
5. สร้าง ADMIN คนแรกด้วยมือ (ขั้นตอนเดียวกับข้อ 4 ด้านบน) ก่อนเปิดให้ผู้ใช้เข้า

## ความสัมพันธ์กับระบบเดิม

โฟลเดอร์นี้ไม่แตะไฟล์ที่ root ของ repo เลย ระบบเดิมยัง deploy/ใช้งานแยกกันได้
ระหว่างที่ WorkBoard 2.0 ถูกพัฒนาอยู่ที่นี่ การย้ายข้อมูลจาก Firestore ไป
Supabase จะวางแผนแยกต่างหากในภายหลัง ไม่ทำ migration ที่ทำลายข้อมูลเดิม
