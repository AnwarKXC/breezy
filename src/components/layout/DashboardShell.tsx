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

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="h-screen overflow-hidden bg-[#FFFFFF] text-[#1A1A1A]">
      <AuthStateSync />
      <PWAClient />
      <TooltipLayer />
      <CurrencyProvider>
        <div className="flex h-full w-full">
          <Sidebar />

          <div className="relative flex min-w-0 flex-1 flex-col bg-[#FFFFFF]">
            <Navbar />
            <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-24 pt-24 sm:px-6 lg:px-8 lg:pb-8 lg:pt-8">
              <Suspense fallback={<PageSkeleton />}>
                <div className="animate-fade-in-fast">{children}</div>
              </Suspense>
            </main>
            <BottomNav />
          </div>
        </div>
      </CurrencyProvider>
    </div>
  );
}

export default DashboardShell;
