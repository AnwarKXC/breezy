import type { Metadata } from "next";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = {
  title: "Offline - Hotel Management System",
  description: "You are currently offline. Please check your connection.",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_12%,#ffffff_0,#f5f5f6_34%,#eeeeef_100%)] px-4">
      <section className="max-w-md rounded-xl border border-white/90 bg-white/85 p-4 text-center  backdrop-blur">
        <div className="rounded-xl bg-[#F5F5F5] p-10">
        <div className="mb-6">
          <svg className="mx-auto h-16 w-16 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M18.364 5.636a9 9 0 0 1 0 12.728m0 0L21 21m-2.636-2.636-2.829-2.829M15.536 8.464a5 5 0 0 1 0 7.072m0 0-2.829-2.829"
            />
          </svg>
        </div>
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-[#1A1A1A]">You&apos;re Offline</h1>
        <p className="mb-6 text-sm font-bold text-[#787774]">Please check your internet connection and try again.</p>
        <RetryButton />
        </div>
      </section>
    </main>
  );
}
