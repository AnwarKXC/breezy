import { DashboardShell } from "@/components/layout";
import { getAppTheme } from "@/shared/theme/server";
import { themeCssVars } from "@/shared/theme/theme";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = await getAppTheme();
  // Values are validated #RRGGBB hex, so interpolating them into CSS is safe.
  const themeCss = theme.isDefault
    ? null
    : `:root{${Object.entries(themeCssVars(theme.primaryColor)).map(([k, v]) => `${k}:${v}`).join(";")}}`;

  return (
    <>
      {themeCss && <style>{themeCss}</style>}
      <DashboardShell>{children}</DashboardShell>
    </>
  );
}
