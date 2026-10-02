'use client'

import { memo } from 'react'

import { useLocale } from '@/i18n/components/LocaleContext'
import type { User } from '../types'
import { formatUserDate, getInitials } from '../utils/userUi'

interface UsersGridProps {
  users: User[]
  labels: Record<string, string>
  onDelete?: (id: string) => void
  onEdit?: (user: User) => void
}

export const UsersGrid = memo(function UsersGrid({
  users,
  labels,
  onDelete,
  onEdit,
}: UsersGridProps) {
  const locale = useLocale()
  const hasActions = Boolean(onDelete || onEdit)

  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {users.map((user) => (
        <article
          key={user.id}
          className="min-w-0 rounded-xl border border-[#EAEAEA] bg-white p-4  transition duration-200 hover: sm:p-5"
        >
          <div className="grid gap-3 sm:flex sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#F5F5F5] text-sm font-bold text-[#333333]">
                {getInitials(user.name)}
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-[#1A1A1A]">{user.name}</h2>
                <p className="break-all text-sm text-[#787774]">{user.email}</p>
              </div>
            </div>
            <span className="w-fit rounded-full bg-[#F5F5F5] px-3 py-1 text-xs font-bold text-[#555555]">
              {user.role}
            </span>
          </div>
          <dl className="mt-5 space-y-3">
            <div className="grid gap-1 border-b border-[#EAEAEA] pb-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
              <dt className="text-xs font-bold uppercase tracking-[0.18em] text-[#787774]">{labels.phone}</dt>
              <dd className="break-all text-sm text-[#555555]">{user.phone}</dd>
            </div>
            <div className="grid gap-1 sm:flex sm:items-center sm:justify-between sm:gap-4">
              <dt className="text-xs font-bold uppercase tracking-[0.18em] text-[#787774]">{labels.createdAt}</dt>
              <dd className="text-sm text-[#555555]">{formatUserDate(user, locale)}</dd>
            </div>
          </dl>
          {hasActions ? (
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(user)}
                  className="rounded-xl bg-[#F5F5F5] px-4 py-2 text-sm font-bold text-[#555555] transition-all duration-200 hover:bg-accent/10"
                >
                  {labels.edit}
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete(user.id)}
                  className="rounded-xl bg-[#FDEBEC] px-4 py-2 text-sm font-bold text-[#9F2F2D] transition-all duration-200 hover:bg-[#FDEBEC]"
                >
                  {labels.delete}
                </button>
              ) : null}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  )
})
