import { getCurrentUser } from "@/lib/auth";

export default async function OverviewPage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">หน้าภาพรวม</h1>
      <p className="text-sm text-slate-500">
        ยินดีต้อนรับ {user?.fullName} — Milestone 1 วางโครงระบบเสร็จแล้ว
        แดชบอร์ดโครงการ/งาน จะมาใน Milestone ถัดไป
      </p>
    </div>
  );
}
