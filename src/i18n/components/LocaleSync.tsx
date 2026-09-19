"use client";

import { memo, useEffect } from "react";
import type { Locale } from "../config";
import { useTranslation } from "../hooks/useTranslation";

export const LocaleSync = memo(function LocaleSync({ locale }: { locale: Locale }) {
  const { locale: activeLocale, setLocale } = useTranslation();

  useEffect(() => {
    if (activeLocale !== locale) {
      setLocale(locale);
    }
  }, [activeLocale, locale, setLocale]);

  return null;
});
