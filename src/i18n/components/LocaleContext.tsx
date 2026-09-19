"use client";

import { createContext, useContext, memo, useMemo } from "react";

type LocaleContextValue = {
  locale: string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

interface LocaleProviderProps {
  locale: string;
  children: React.ReactNode;
}

export const LocaleProvider = memo(function LocaleProvider({
  locale,
  children,
}: LocaleProviderProps) {
  const value = useMemo(() => ({ locale }), [locale]);
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
});

export function useLocale(): string {
  const context = useContext(LocaleContext);
  if (!context?.locale) {
    // Default fallback - in production this would be set by the provider
    return "en";
  }
  return context.locale;
}