"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "◼" },
  { href: "/inventory", label: "Inventory", icon: "◼" },
  { href: "/projects", label: "Projects", icon: "◼" },
  { href: "/reports", label: "Reports", icon: "◼" },
];

const SECONDARY_ITEMS = [
  { href: "/payroll", label: "Weekly Payroll", icon: "◼" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="fixed top-3 left-3 z-[200] bg-[#1a1a2e] text-white border-none rounded-lg w-[38px] h-[38px] text-xl cursor-pointer lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        ☰
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[99] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`w-[230px] bg-[#1a1a2e] text-white p-6 px-4 flex flex-col fixed top-0 left-0 bottom-0 z-[100] transition-transform duration-300
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        <div className="text-xl font-bold text-[#e2b87e] tracking-wide mb-1">
          Ardor House
        </div>
        <div className="text-[.65rem] text-white/40 uppercase tracking-[1.5px] mb-7">
          Staging Operations
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 py-2.5 px-3.5 rounded-lg text-sm no-underline transition-colors duration-200
                ${
                  isActive(item.href)
                    ? "bg-[rgba(226,184,126,0.15)] text-[#e2b87e]"
                    : "text-white/65 hover:bg-white/[.08] hover:text-white"
                }`}
            >
              <span>{item.icon}</span> {item.label}
            </Link>
          ))}

          <div className="h-px bg-white/[.08] my-3" />

          {SECONDARY_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 py-2.5 px-3.5 rounded-lg text-sm no-underline transition-colors duration-200
                ${
                  isActive(item.href)
                    ? "bg-[rgba(226,184,126,0.15)] text-[#e2b87e]"
                    : "text-white/65 hover:bg-white/[.08] hover:text-white"
                }`}
            >
              <span>{item.icon}</span> {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto text-[.65rem] text-white/25">
          <button
            onClick={handleSignOut}
            className="text-white/50 text-xs bg-transparent border-none cursor-pointer mb-2 font-inherit hover:text-white/80"
          >
            ▶ Sign Out
          </button>
          <div>&copy; 2026 Ardor House</div>
        </div>
      </aside>
    </>
  );
}
