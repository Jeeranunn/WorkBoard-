import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { logout } from "./actions";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="flex h-screen items-center justify-center px-4 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="text-lg font-semibold">รอผู้ดูแลระบบเชื่อมบัญชี</h1>
          <p className="text-sm text-slate-500">
            บัญชีของคุณยังไม่ถูกเชื่อมกับข้อมูลบุคลากรในระบบ
            กรุณาติดต่อผู้ดูแลระบบ
          </p>
          <form action={logout}>
            <button
              type="submit"
              className="text-sm text-slate-500 underline hover:text-slate-900"
            >
              ออกจากระบบ
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        isAdmin={hasRole(user, "ADMIN")}
        isExecutive={hasRole(user, "EXECUTIVE")}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar fullName={user.fullName} />
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
