"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
}

const mainNav: NavItem[] = [
  { href: "/overview", label: "หน้าภาพรวม" },
  { href: "/my-work", label: "งานของฉัน" },
  { href: "/weekly-plan", label: "แผนรายสัปดาห์" },
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

function NavLink({
  href,
  label,
  pathname,
  onNavigate,
}: NavItem & {
  pathname: string;
  onNavigate: (href: string) => void;
}) {
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      onClick={() => {
        if (!isActive) onNavigate(href);
      }}
      className={`block rounded-md px-3 py-2 text-sm transition-colors ${
        isActive
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
  const pathname = usePathname();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  useEffect(() => {
    setNavigatingTo(null);
  }, [pathname]);

  const navProps = {
    pathname,
    onNavigate: setNavigatingTo,
  };

  return (
    <nav className="relative flex h-full w-60 flex-col gap-6 border-r border-slate-200 bg-white p-4">
      {navigatingTo && (
        <div
          aria-label="กำลังเปิดหน้า"
          className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-slate-100"
        >
          <div className="h-full w-1/2 animate-pulse bg-slate-900" />
        </div>
      )}

      <div className="px-2 text-lg font-semibold tracking-tight">WorkBoard</div>

      <div className="space-y-1">
        {mainNav.map((item) => (
          <NavLink key={item.href} {...item} {...navProps} />
        ))}
      </div>

      <div className="space-y-1">
        {workNav.map((item) => (
          <NavLink key={item.href} {...item} {...navProps} />
        ))}
        {(isAdmin || isExecutive) && (
          <NavLink
            href="/executive"
            label="ภาพรวมผู้บริหาร"
            {...navProps}
          />
        )}
      </div>

      {isAdmin && (
        <div className="space-y-1">
          <div className="px-3 text-xs font-medium uppercase text-slate-400">
            ผู้ดูแลระบบ
          </div>
          {adminNav.map((item) => (
            <NavLink key={item.href} {...item} {...navProps} />
          ))}
        </div>
      )}
    </nav>
  );
}
