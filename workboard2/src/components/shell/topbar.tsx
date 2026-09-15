import { logout } from "@/app/(app)/actions";

export function Topbar({ fullName }: { fullName: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
      <span className="text-sm text-slate-500">สวัสดี, {fullName}</span>
      <form action={logout}>
        <button
          type="submit"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ออกจากระบบ
        </button>
      </form>
    </header>
  );
}
