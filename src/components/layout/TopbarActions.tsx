import { memo } from "react";

import { LanguageSwitcher } from "@/i18n/components";
import { ProfileMenu } from "./ProfileMenu";

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
      <LanguageSwitcher />
      <ProfileMenu isRTL={isRTL} localePrefix={localePrefix} t={t} />
    </>
  );
});
