import { memo } from "react";

import { LanguageSwitcher } from "@/i18n/components";
import { ProfileMenu } from "./ProfileMenu";
import { QuickActionsMenu } from "./QuickActionsMenu";

interface TopbarActionsProps {
  isRTL: boolean;
  localePrefix: string;
  t: (key: string) => string;
}

export const TopbarActions = memo(function TopbarActions({
  isRTL,
  localePrefix,
  t,
}: TopbarActionsProps) {
  return (
    <>
      <QuickActionsMenu isRTL={isRTL} localePrefix={localePrefix} t={t} />
      <LanguageSwitcher />
      <ProfileMenu isRTL={isRTL} localePrefix={localePrefix} t={t} />
    </>
  );
});
