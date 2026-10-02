import { DashboardShell } from "@/components/layout";
import { getLicenseStatus } from "@/services/fleet/license";
import { getAppTheme } from "@/shared/theme/server";
import { themeCssVars } from "@/shared/theme/theme";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, license] = await Promise.all([getAppTheme(), getLicenseStatus()]);
  // Values are validated #RRGGBB hex, so interpolating them into CSS is safe.
  const themeCss = theme.isDefault
    ? null
    : `:root{${Object.entries(themeCssVars(theme.primaryColor)).map(([k, v]) => `${k}:${v}`).join(";")}}`;

  return (
    <>
      {themeCss && <style>{themeCss}</style>}
      <DashboardShell
        licenseNotice={
          license.state === "grace" || license.readOnly
            ? { readOnly: license.readOnly, readOnlyAt: license.readOnlyAt }
            : null
        }
      >
        {children}
      </DashboardShell>
    </>
  );
}
