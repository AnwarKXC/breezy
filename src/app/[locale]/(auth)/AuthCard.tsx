import { BrandLogo } from "@/shared/branding/BrandingContext";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-10 text-[#111111]">
      <div className="w-full max-w-[320px]">
        <div className="mb-8 text-center">
          <BrandLogo size={80} className="mx-auto mb-5 h-20 w-20 object-contain" priority />
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-xs font-medium text-[#787774]">{subtitle}</p>
        </div>
        {children}
      </div>
    </main>
  );
}

export const authButtonClass =
  "mt-2 h-11 w-full rounded-lg bg-[#1A1A1A] px-4 text-xs font-bold text-white transition hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-40";
export const authLinkClass = "block py-2 text-center text-xs font-bold text-[#787774] hover:text-[#1A1A1A]";
export const authErrorClass = "bg-[#F5F5F5] px-3 py-2 text-xs font-bold text-[#9F2F2D]";
