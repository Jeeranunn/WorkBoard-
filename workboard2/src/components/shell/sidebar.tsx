"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
}

const mainNav: NavItem[] = [
  { href: "/overview", label: "หน้าภาพรวม" },
  { href: "/my-work", label: "งานของฉัน" },
];

const workNav: NavItem[] = [
  { href: "/projects", label: "โครงการ" },
  { href: "/teams", label: "ทีม" },
];

const adminNav: NavItem[] = [
  { href: "/admin/organizations", label: "โครงสร้างองค์กร" },
  { href: "/admin/units", label: "หน่วยงาน" },
  { href: "/admin/positions", label: "ตำแหน่ง" },
  { href: "/admin/teams", label: "จัดการทีม" },
  { href: "/admin/members", label: "สมาชิกและบทบาท" },
];

function NavLink({ href, label }: NavItem) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`block rounded-md px-3 py-2 text-sm ${
        isActive
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </Link>
  );
}

export function Sidebar({
  isAdmin,
  isExecutive,
}: {
  isAdmin: boolean;
  isExecutive: boolean;
}) {
  return (
    <nav className="flex h-full w-60 flex-col gap-6 border-r border-slate-200 bg-white p-4">
      <div className="px-2 text-lg font-semibold">WorkBoard</div>

      <div className="space-y-1">
        {mainNav.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </div>

      <div className="space-y-1">
        {workNav.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
        {(isAdmin || isExecutive) && (
          <NavLink href="/executive" label="ภาพรวมผู้บริหาร" />
        )}
      </div>

      {isAdmin && (
        <div className="space-y-1">
          <div className="px-3 text-xs font-medium uppercase text-slate-400">
            ผู้ดูแลระบบ
          </div>
          {adminNav.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>
      )}
    </nav>
  );
}
