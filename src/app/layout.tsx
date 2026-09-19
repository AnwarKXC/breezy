import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { headers } from "next/headers";
import { ReduxProvider } from "@/store/provider";
import { ToastProvider } from "@/shared/toast";
import { CsrfBootstrap } from "@/shared/components/CsrfBootstrap";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Breezy System",
  description: "Hotel Management System for staff dashboard",
  // PWA metadata
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Breezy",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers()
  const locale = headersList.get('x-locale') || 'en'
  const dir = headersList.get('x-dir') || 'ltr'

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
            {children}
          </ToastProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
