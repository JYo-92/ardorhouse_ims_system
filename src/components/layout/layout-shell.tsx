"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { ToastProvider } from "./toast-provider";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin) {
    return <ToastProvider>{children}</ToastProvider>;
  }

  return (
    <ToastProvider>
      <Sidebar />
      <main className="lg:ml-[230px] flex-1 p-7 px-8 min-h-screen max-lg:ml-0 max-lg:p-4 max-lg:pt-14">
        {children}
      </main>
    </ToastProvider>
  );
}
