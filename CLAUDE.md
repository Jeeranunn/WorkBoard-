# CLAUDE.md — WorkBoard 2.0

## ภารกิจ
พัฒนา WorkBoard 2.0 จากระบบเดิมให้เป็นพื้นที่ทำงานกลางของเครือข่ายองค์กร โดยต้องใช้งานจริงได้เร็วและสามารถขยายได้ในระยะยาว

## ข้อจำกัดสำคัญ
- ระบบเดิมยังมีผู้ใช้งานอยู่ ห้ามทำให้ระบบเดิมหยุดใช้งานระหว่างพัฒนา
- งานหลักต้องพร้อมใช้งานภายในวันศุกร์ที่ 18 กันยายน 2569 ก่อน 20:00 น.
- ให้พัฒนา WorkBoard 2.0 บน branch `workboard-2`
- หลีกเลี่ยงการแก้ `main` โดยตรง
- ระบบใหม่ใช้ Next.js App Router + TypeScript + Supabase + Vercel
- ภาษาใน UI ใช้ภาษาไทยเป็นหลัก คำเทคนิคใช้เท่าที่จำเป็น
- อย่าสร้างฟีเจอร์เกินขอบเขตโดยไม่มีเหตุผลจาก requirement
- ทุก migration ต้องมีแนวทางย้อนกลับหรือไม่ทำลายข้อมูลเดิม

## ระบบเดิม
Repo เดิมเป็นเว็บแบบ monolithic:
- `index.html`
- `script.js`
- `style.css`
- Firebase Firestore
- มี Project, Task, Review, Clock In/Out, Team Dashboard, CC, Note, Question, Meeting อยู่แล้ว
- Auth ปัจจุบันตรวจ password จาก Firestore ฝั่ง client ซึ่งต้องเลิกใช้ในระบบใหม่
- Role ปัจจุบันค่อนข้างตายตัว: BOSS / ADMIN / HEAD / Staff และผูกกับ dept เดียว

## เป้าหมาย WorkBoard 2.0
WorkBoard ต้องเป็นระบบหลักของงาน ไม่ใช่ที่บันทึกย้อนหลัง

หลัก:
1. งานขององค์กรต้องมีตัวตนในระบบ
2. ทุกงานมีผู้รับผิดชอบ
3. ทุกงานมีสถานะ
4. ทุกงานรู้ว่าตอนนี้อยู่ที่ใคร
5. ทุกงานมีประวัติย้อนหลัง
6. ระบบช่วยจำและติดตามแทนคน
7. ข้อมูลที่มีแล้วไม่ให้กรอกซ้ำ
8. ความซับซ้อนอยู่หลังระบบ ไม่อยู่หน้าผู้ใช้
9. UI ภาษาไทยเป็นหลัก
10. WorkBoard เป็นแหล่งข้อมูลหลักของสถานะงาน

## โมเดลหลัก
### โครงสร้างองค์กร
- Network
- Organization
- Organization Unit
- Position
- Appointment
- Person

โครงสร้างองค์กรแก้ไขได้โดย Admin และต้องเก็บประวัติช่วงเวลาของโครงสร้าง/ตำแหน่ง

### ทีม
แยกจาก hierarchy ขององค์กร:
- Working Team
- Project Team
- Team Membership
คนหนึ่งอยู่หลายทีม/หลายองค์กร/หลายบทบาทได้พร้อมกัน

### งาน
- Project
- Workstream
- Milestone
- Task
- Subtask
- Dependency

### ลำดับงาน
ขั้นต่ำ:
Assigned -> Acknowledged -> In Progress -> Submitted -> In Review -> Revision Required -> Resubmitted -> Approved -> Completed

สถานะประกอบ:
- Blocked
- Waiting
- On Hold
- Overdue

ทุก Task ต้องมี Current Action Holder

## ลำดับความสำคัญ
ใช้ 4 กลุ่ม:
- P1 สำคัญ + เร่งด่วน
- P2 สำคัญ + ไม่เร่งด่วน
- P3 ไม่สำคัญ + เร่งด่วน
- P4 ไม่สำคัญ + ไม่เร่งด่วน

เก็บ Importance และ Urgency แยกกัน และให้ระบบแนะนำได้ภายหลัง

## ปัญหาที่ต้องแก้ตั้งแต่ Core
1. ประธานต้องตามงานเอง
2. งานกระจายอยู่ในแชท
3. ส่งงานซ้ำหลายช่องทาง
4. ไม่รู้ว่างานอยู่ที่ใคร
5. โครงสร้างองค์กรเดิมไม่รองรับหลายบทบาท
6. ทีมเฉพาะกิจ/ทีมข้ามฝ่ายจัดใน hierarchy เดียวไม่ได้
7. หัวหน้าฝ่ายแตกงานไม่ครบ
8. มี template แต่คนไม่หา/ไม่ใช้
9. งานต้องเพิ่มย้อนหลังจน Board ไม่ตรงกับงานจริง
10. งานประจำต้องอาศัยคนจำ

## ฟีเจอร์ Core ที่ต้องพร้อมวันศุกร์
### Admin
- จัดการ Organization / Unit / Position / Team / Membership / Role

### หัวหน้าฝ่าย
- สร้าง Project
- สร้าง Workstream/Milestone/Task/Subtask
- Assign
- ตั้ง Deadline
- ตั้ง Priority
- ตั้ง Reviewer
- ตรวจความครบถ้วนของโครงการ
- ติดตามทีม

### สมาชิก
- Clock In / Break / Clock Out
- My Work
- Start/Pause/Switch Task
- Submit
- แนบไฟล์/ลิงก์
- Comment
- Revision
- Resubmit
- Complete

### ประธาน
- Executive Dashboard
- เห็นองค์กรทั้งหมด
- Active Projects
- Open Tasks
- Overdue
- Blocked
- Waiting Review
- Waiting Approval
- Needs Attention
- Project Health
- Current Holder
- Drill down ถึง Task

## Project Starter / Playbook
ห้ามให้การสร้าง Project เริ่มจากหน้าว่างเสมอ
ต้องมี Playbook รุ่นแรกอย่างน้อย 1 แบบสำหรับ “กิจกรรม”

โครงมาตรฐาน:
- วางแผน
- เอกสาร
- ประสานงาน
- ประชาสัมพันธ์
- การดำเนินงาน
- การเงิน
- รายงานผล
- ถอดบทเรียน

ระบบต้องสามารถเตือนความไม่ครบ เช่น:
- Task ไม่มี owner
- ไม่มี deadline
- ไม่มี reviewer
- workstream ไม่มี task
- มีวิทยากรแต่ยังไม่มีงานประสาน
- มีประชาสัมพันธ์แต่ยังไม่มีงานตรวจ

แยก:
- Planned Work
- Added Work
- Scope Change
- Planning Gap

## Time
แยก:
- Attendance Time
- Task Time

ข้อมูลเวลาในอนาคตต้องแยก:
- System-tracked
- Reconstructed
- Self-declared
และมี audit trail

## Telegram
ยังไม่แทนแชท
หลัก:
- Telegram = การสื่อสาร/แจ้งเตือน
- WorkBoard = สถานะงานทางการ
กด Submit ครั้งเดียวควรเปลี่ยนสถานะ + แจ้งผู้ตรวจ + อัปเดต dashboard + แจ้ง Telegram ภายหลัง

## ห้ามทำ
- ห้ามเก็บ password plaintext ใน database
- ห้ามใช้ client-side role check เป็น security boundary
- ห้าม hard-code ว่า user มี role เดียวหรือ dept เดียว
- ห้ามใช้ project progress % จากจำนวน task อย่างเดียวโดยไม่พิจารณาสถานะ/งานที่เพิ่มทีหลัง
- ห้ามทำหน้าแรกสมาชิกให้ซับซ้อน
- ห้ามใช้ activity/การขยับเมาส์เป็นตัววัด productivity
- ห้ามให้ AI สร้าง/เปลี่ยนงานสำคัญโดยไม่ให้คนยืนยัน

## สถาปัตยกรรมเป้าหมาย
- Next.js App Router
- TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase Storage (เฉพาะกรณีจำเป็น)
- Row Level Security
- Vercel
- Server Components เป็นค่าเริ่มต้น
- ใช้ Client Components เฉพาะจุดที่ต้องมี interaction
- Server Actions / Route Handlers สำหรับ mutation ตามความเหมาะสม

## แนวทางการทำงาน
ทำทีละ milestone และให้ระบบ build ผ่านทุก milestone

Milestone 1 — Foundation
- scaffold app
- auth
- database types
- organizations / units / positions / appointments
- teams / memberships
- app shell ภาษาไทย

Milestone 2 — Work Core
- projects / workstreams / milestones / tasks
- assignments
- current holder
- priority
- workflow

Milestone 3 — Execution
- My Work
- submit/review/revision/approve
- comments/files/activity log

Milestone 4 — Management
- Executive Dashboard
- Team Dashboard
- Project Completeness
- Playbook v0

Milestone 5 — Time
- attendance
- task timer
- basic workload

ทุก milestone:
1. build
2. ตรวจ type errors
3. ตรวจ permission
4. สรุปสิ่งที่เปลี่ยน
5. commit เป็นก้อนเล็ก

## ภาษา UI
ใช้คำไทย เช่น:
- หน้าภาพรวม
- งานของฉัน
- โครงการ
- กลุ่มงาน
- งานย่อย
- ผู้รับผิดชอบ
- ผู้ตรวจ
- รออนุมัติ
- เกินกำหนด
- ติดขัด
- ลำดับความสำคัญ
- ความครบถ้วนของโครงการ

ใช้ภาษาอังกฤษเฉพาะคำที่จำเป็นและมีความหมายชัดกว่า
