"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { ToastProvider } from "./toast-provider";
import { useProfile } from "@/hooks/use-profile";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, isLoading } = useProfile();
  const isLogin = pathname === "/login";
  const isInstaller = role === "installer";

  // Installers only ever use the clock screen — keep them there.
  useEffect(() => {
    if (!isLoading && isInstaller && !isLogin && pathname !== "/clock") {
      router.replace("/clock");
    }
  }, [isLoading, isInstaller, isLogin, pathname, router]);

  if (isLogin) {
    return <ToastProvider>{children}</ToastProvider>;
  }

  // Installer view: no sidebar, full-screen clock.
  if (isInstaller) {
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
