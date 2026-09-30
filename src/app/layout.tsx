import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { headers } from "next/headers";
import { ReduxProvider } from "@/store/provider";
import { ToastProvider } from "@/shared/toast";
import { CsrfBootstrap } from "@/shared/components/CsrfBootstrap";
import { BrandingProvider } from "@/shared/branding/BrandingContext";
import { getBranding } from "@/shared/branding/server";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { displayName } = await getBranding();
  return {
    title: displayName,
    description: "Hotel Management System for staff dashboard",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: displayName,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers()
  const locale = headersList.get('x-locale') || 'en'
  const dir = headersList.get('x-dir') || 'ltr'
  const branding = await getBranding()

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${poppins.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-[var(--background)] text-[#1A1A1A]">
        <CsrfBootstrap />
        <ReduxProvider>
          <ToastProvider>
            <BrandingProvider value={branding}>{children}</BrandingProvider>
          </ToastProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
