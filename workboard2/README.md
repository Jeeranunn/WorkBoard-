# WorkBoard 2.0

ระบบใหม่ของ WorkBoard สร้างด้วย Next.js App Router + TypeScript + Supabase
แยกต่างหากจากระบบเดิม (`index.html` / `script.js` / `style.css` ที่ root ของ repo)
ระบบเดิมยังใช้งานได้ตามปกติและไม่ถูกแก้ไขจากการพัฒนา WorkBoard 2.0

## สถานะ: Milestone 1.1 — Foundation Schema Correction

สิ่งที่ทำแล้ว:
- Scaffold Next.js App Router + TypeScript + Tailwind
- Supabase Auth (email/password) ผ่าน `@supabase/ssr`, session อยู่ใน cookie,
  ตรวจสิทธิ์ผ่าน `proxy.ts` (เดิมชื่อ middleware ใน Next.js < 16)
- Database schema (`supabase/migrations/0001_foundation.sql` +
  `0002_foundation_corrections.sql`):
  - Network / Organization / Organization Unit / Position / Person / Appointment
  - `teams` ตารางเดียว (`team_type`: WORKING/PROJECT) ผูกกับ `network_id`
    ไม่ผูกกับองค์กรเดียวตายตัว — สมาชิกในทีมมาจากหลายองค์กรได้
    (`team_memberships` ต่อกับ `teams` ด้วย `team_id` เดียว)
  - `person_roles` แยก global role (ADMIN/EXECUTIVE — ไม่มี organization_id)
    ออกจาก scoped role (HEAD/MEMBER — ต้องมี organization_id) ด้วย CHECK
    constraint และมี `has_role_in_organization()` กันไม่ให้ HEAD ของ Org A
    ผ่านสิทธิ์ของ Org B
  - ทุกตารางมี Row Level Security เปิดใช้งาน, `is_admin()`/`is_executive()`
    เป็น security definer function แทนการเช็ค role ฝั่ง client
  - `updated_at` ทุกตาราง, `is_active`/`archived_at` บน networks/organizations,
    unique index กัน active membership/appointment ซ้ำ, trigger กัน
    `organization_units.parent_unit_id` ข้าม organization
- App shell ภาษาไทย (Sidebar/Topbar) พร้อมหน้า:
  - `/login` เข้าสู่ระบบ
  - `/overview` หน้าภาพรวม (placeholder)
  - `/my-work` งานของฉัน (placeholder, milestone 3)
  - `/admin/organizations`, `/admin/units`, `/admin/positions`, `/admin/teams`,
    `/admin/members` — จัดการโครงสร้างองค์กร/ทีม/บทบาทเบื้องต้น (admin only,
    บังคับด้วย RLS ไม่ใช่แค่ UI)

ยังไม่ทำ (milestone ถัดไป): Project/Task/Workflow (รวมถึง `team_projects`
junction table สำหรับผูกทีมกับโครงการแบบ many-to-many), My Work จริง,
Executive Dashboard, Playbook, Time tracking

## การรัน

### ติดตั้ง

```bash
cd workboard2
npm install
```

### ตั้งค่า Supabase

1. สร้างโปรเจกต์ Supabase ใหม่
2. รัน migration ตามลำดับ: `0001_foundation.sql` แล้วตามด้วย
   `0002_foundation_corrections.sql` ผ่าน Supabase SQL editor
   หรือ Supabase CLI (`supabase db push`)
3. คัดลอก `.env.local.example` เป็น `.env.local` แล้วใส่ค่า
   `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. สร้างผู้ใช้แรกใน Supabase Auth (อีเมล/รหัสผ่าน) แล้ว insert แถวใน `people`
   ที่มี `email` ตรงกันและ `auth_user_id` เท่ากับ id ของผู้ใช้นั้น
   จากนั้น insert แถวใน `person_roles` role = `ADMIN` เพื่อเข้าใช้หน้า admin

### พัฒนา

```bash
npm run dev
```

### Build

```bash
npm run build
```

## ความสัมพันธ์กับระบบเดิม

โฟลเดอร์นี้ไม่แตะไฟล์ที่ root ของ repo เลย ระบบเดิมยัง deploy/ใช้งานแยกกันได้
ระหว่างที่ WorkBoard 2.0 ถูกพัฒนาอยู่ที่นี่ การย้ายข้อมูลจาก Firestore ไป
Supabase จะวางแผนแยกต่างหากในภายหลัง ไม่ทำ migration ที่ทำลายข้อมูลเดิม
