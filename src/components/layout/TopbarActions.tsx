import { memo } from "react";

import { LanguageSwitcher } from "@/i18n/components";
import { ProfileMenu } from "./ProfileMenu";
import { QuickActionsMenu } from "./QuickActionsMenu";

interface TopbarActionsProps {
  localePrefix: string;
  t: (key: string) => string;
}

export const TopbarActions = memo(function TopbarActions({
  localePrefix,
  t,
}: TopbarActionsProps) {
  return (
    <>
      <QuickActionsMenu localePrefix={localePrefix} t={t} />
      <LanguageSwitcher />
      <ProfileMenu localePrefix={localePrefix} t={t} />
    </>
  );
});
