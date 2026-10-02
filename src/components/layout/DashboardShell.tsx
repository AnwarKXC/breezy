"use client";

import { Suspense, type ReactNode } from "react";

import { BottomNav } from "./BottomNav";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { PageSkeleton } from "@/shared/components/PageSkeleton";
import { AuthStateSync } from "@/modules/auth";
import { PWAClient } from "@/app/pwa-client";
import { CurrencyProvider } from "@/shared/contexts/CurrencyContext";
import { TooltipLayer } from "@/shared/components/TooltipLayer";
import { AssistantWidget } from "@/modules/assistant";
import { LicenseNotice, type LicenseNoticeProps } from "./LicenseNotice";

interface DashboardShellProps {
  children: ReactNode;
  /** Shown above the page while the license is in grace or read-only. */
  licenseNotice?: LicenseNoticeProps | null;
}

export function DashboardShell({ children, licenseNotice }: DashboardShellProps) {
  return (
    <div className="h-screen overflow-hidden bg-page-bg text-ink">
      <AuthStateSync />
      <PWAClient />
      <TooltipLayer />
      <CurrencyProvider>
        <div className="flex h-full w-full">
          <Sidebar />

          <div className="relative flex min-w-0 flex-1 flex-col bg-page-bg">
            <Navbar />
            <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-24 pt-24 sm:px-6 lg:px-8 lg:pb-8 lg:pt-8">
              {licenseNotice && <LicenseNotice {...licenseNotice} />}
              <Suspense fallback={<PageSkeleton />}>
                <div className="animate-fade-in-fast">{children}</div>
              </Suspense>
            </main>
            <BottomNav />
            <AssistantWidget />
          </div>
        </div>
      </CurrencyProvider>
    </div>
  );
}

export default DashboardShell;
