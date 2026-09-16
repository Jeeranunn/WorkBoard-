"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
}

const memberNav: NavItem[] = [
  { href: "/member", label: "พื้นที่สมาชิก" },
  { href: "/my-work", label: "งานของฉัน" },
  { href: "/weekly-plan", label: "แผนรายสัปดาห์" },
  { href: "/projects", label: "โครงการ" },
];

const headNav: NavItem[] = [
  { href: "/head", label: "พื้นที่หัวหน้าฝ่าย" },
  { href: "/management-board", label: "บอร์ดบริหาร" },
  { href: "/head/capacity", label: "Capacity ทีม" },
  { href: "/projects", label: "โครงการ" },
  { href: "/teams", label: "ทีม" },
];

const executiveNav: NavItem[] = [
  { href: "/executive", label: "ภาพรวมผู้บริหาร" },
  { href: "/management-board", label: "บอร์ดบริหาร" },
  { href: "/executive/capacity", label: "Capacity องค์กร" },
  { href: "/projects", label: "โครงการ" },
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

function NavSection({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  onNavigate: (href: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </div>
      {items.map((item) => (
        <NavLink
          key={item.href}
          {...item}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

export function Sidebar({
  isAdmin,
  isExecutive,
  isHead,
}: {
  isAdmin: boolean;
  isExecutive: boolean;
  isHead: boolean;
}) {
  const pathname = usePathname();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  const showNavigationIndicator =
    navigatingTo !== null &&
    pathname !== navigatingTo &&
    !pathname.startsWith(`${navigatingTo}/`);

  const hasLeadershipWorkspace = isHead || isExecutive || isAdmin;

  return (
    <nav className="relative flex h-full w-60 flex-col gap-5 overflow-y-auto border-r border-slate-200 bg-white p-4">
      {showNavigationIndicator && (
        <div
          aria-label="กำลังเปิดหน้า"
          className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-slate-100"
        >
          <div className="h-full w-1/2 animate-pulse bg-slate-900" />
        </div>
      )}

      <div className="px-2 text-lg font-semibold tracking-tight">WorkBoard</div>

      <NavSection
        title="พื้นที่ของฉัน"
        items={memberNav}
        pathname={pathname}
        onNavigate={setNavigatingTo}
      />

      {isHead && (
        <NavSection
          title="หัวหน้าฝ่าย"
          items={headNav}
          pathname={pathname}
          onNavigate={setNavigatingTo}
        />
      )}

      {isExecutive && (
        <NavSection
          title="ผู้บริหาร"
          items={executiveNav}
          pathname={pathname}
          onNavigate={setNavigatingTo}
        />
      )}

      {isAdmin && !isHead && !isExecutive && (
        <NavSection
          title="พื้นที่บริหาร"
          items={[
            { href: "/management-board", label: "บอร์ดบริหาร" },
            { href: "/executive", label: "ภาพรวมผู้บริหาร" },
            { href: "/head", label: "พื้นที่หัวหน้าฝ่าย" },
          ]}
          pathname={pathname}
          onNavigate={setNavigatingTo}
        />
      )}

      {isAdmin && (
        <NavSection
          title="ผู้ดูแลระบบ"
          items={adminNav}
          pathname={pathname}
          onNavigate={setNavigatingTo}
        />
      )}

      {!hasLeadershipWorkspace && (
        <div className="mt-auto rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">
          เมนูนี้แสดงเฉพาะงานและแผนที่เกี่ยวกับคุณ เพื่อให้ใช้งานได้ง่ายและไม่รก
        </div>
      )}
    </nav>
  );
}
