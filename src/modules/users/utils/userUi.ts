import { USER_ROLES } from "@/config/rbac";
import { formatDateTime } from "@/shared/utils/date";
import type { User } from "../types";

export const USERS_PAGE_SIZE = 10;
export const USERS_PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;
export { USER_ROLES };

export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function getUserCreatedAt(user: User) {
  const value = user.createdAt as unknown as {
    toDate?: () => Date;
    seconds?: number;
    _seconds?: number;
    nanoseconds?: number;
    _nanoseconds?: number;
  };
  const milliseconds =
    ((value.seconds ?? value._seconds ?? 0) * 1000) +
    Math.floor((value.nanoseconds ?? value._nanoseconds ?? 0) / 1000000);
  const date =
    value.toDate?.() ??
    new Date(milliseconds || Date.now());

  return date;
}

export function formatUserDate(user: User, locale: string = 'en') {
  return formatDateTime(getUserCreatedAt(user).toISOString(), locale);
}
