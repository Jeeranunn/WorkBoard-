# WorkBoard 2.0 — แผนพัฒนาระยะเร่งด่วน

## เป้าหมายวันศุกร์ 18 ก.ย. 2569 20:00
ให้ระบบหลักใช้งานจริงได้สำหรับ 4 กลุ่ม:
- ผู้ดูแลระบบ
- หัวหน้าฝ่าย
- สมาชิก
- ประธาน

## Critical Path
1. Supabase schema + Auth + RLS
2. Organization / Roles / Teams
3. Project / Task / Workflow
4. My Work
5. Submit / Review / Revision / Approve
6. Project Completeness + Playbook v0
7. Executive Dashboard
8. Time Core
9. Permission + build + deploy

## Definition of Done
### ผู้ดูแลระบบ
จัดโครงสร้างองค์กร ทีม ตำแหน่ง และสมาชิกได้

### หัวหน้าฝ่าย
สร้างโครงการ แตกงาน มอบหมาย ตั้งผู้ตรวจ และเห็นความครบถ้วนของโครงการได้

### สมาชิก
เห็นงานของตน เริ่มงาน ส่งงาน รับแก้ และส่งใหม่ได้

### ประธาน
เห็นภาพรวมทุกองค์กร โครงการเสี่ยง งานเกินกำหนด งานติดขัด งานรอตรวจ งานรออนุมัติ และกดดูถึงระดับ Task ได้

## สิ่งที่ทำหลัง Core
- Telegram two-way
- AI แตกงานขั้นสูง
- Meeting -> Task
- Weekly Report อัตโนมัติ
- Semantic Search
- Advanced Capacity Planning
- Historical organization UI
- Lesson Learned -> ปรับ Playbook อัตโนมัติ

## Migration
ระบบเดิม Firestore ยังเปิดใช้ระหว่างพัฒนา
อย่าทำ destructive migration
ให้สร้าง Supabase schema ใหม่ และวางแผน import ทีหลัง
