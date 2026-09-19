'use client'

import { memo } from 'react'
import Image from 'next/image'

import { TableActionsMenu } from '@/shared/table'
import { useLocale } from '@/i18n/components/LocaleContext'
import { countryName } from '@/shared/static/countries'
import { formatDateTime } from '@/shared/utils/date'
import type { Contact } from '../types'
import { ContactTypeBadge } from './ContactTypeBadge'

interface ContactCardProps {
  contact: Contact
  labels: Record<string, string>
  onDelete?: (id: string) => void
  onEdit?: (contact: Contact) => void
  onRowClick?: (contact: Contact, event?: React.MouseEvent) => void
}

export const ContactCard = memo(function ContactCard({
  contact,
  labels,
  onDelete,
  onEdit,
  onRowClick,
}: ContactCardProps) {
  const locale = useLocale()
  const isCompany = contact.type === 'company'
  const hasActions = Boolean(onDelete || onEdit)

  return (
    <article
      className="min-w-0 rounded-xl border border-[#EAEAEA] bg-white p-5 transition duration-200 hover:"
      data-contact-id={contact.id}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex min-w-0 cursor-pointer items-center gap-3"
          role={onRowClick ? 'button' : undefined}
          onClick={(e) => onRowClick?.(contact, e)}
        >
          {contact.logo ? (
            <Image unoptimized
              src={contact.logo}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#F5F5F5] text-lg font-bold text-[#333333]">
              {contact.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-[#1A1A1A]">{contact.name}</h2>
            <p className="break-all text-sm text-[#787774]">{contact.email ?? ''}</p>
          </div>
        </div>
        {hasActions ? (
          <TableActionsMenu
            actions={[
              ...(onEdit ? [{ label: labels.edit, onSelect: () => onEdit(contact) }] : []),
              ...(onDelete
                ? [{ destructive: true as const, label: labels.delete, onSelect: () => onDelete(contact.id) }]
                : []),
            ]}
            ariaLabel={labels.actions}
          />
        ) : (
          <ContactTypeBadge type={contact.type} labels={labels} />
        )}
      </div>

      <dl className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <dt className="text-xs font-medium uppercase tracking-[0.18em] text-[#787774]">{labels.phone}</dt>
          <dd className="break-all text-sm text-[#555555]">{contact.phone}</dd>
        </div>
        {isCompany && contact.country && (
          <div className="flex items-center justify-between">
            <dt className="text-xs font-medium uppercase tracking-[0.18em] text-[#787774]">{labels.country}</dt>
            <dd className="text-sm text-[#555555]">
              {contact.city ? `${contact.city}, ` : ''}{countryName(contact.country, locale)}
            </dd>
          </div>
        )}
        {isCompany && contact.responsiblePerson && (
          <div className="flex items-center justify-between">
            <dt className="text-xs font-medium uppercase tracking-[0.18em] text-[#787774]">{labels.responsiblePerson}</dt>
            <dd className="text-sm text-[#555555]">{contact.responsiblePerson}</dd>
          </div>
        )}
        <div className="flex items-center justify-between">
          <dt className="text-xs font-medium uppercase tracking-[0.18em] text-[#787774]">{labels.createdAt}</dt>
          <dd className="text-sm text-[#555555]">
            {formatDateTime(contact.createdAt, locale)}
          </dd>
        </div>
      </dl>
    </article>
  )
})
