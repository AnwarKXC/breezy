import { memo, useMemo } from 'react'
import Image from 'next/image'

import { Table, TableActionsMenu, type TableColumn } from '@/shared/table'
import { useLocale } from '@/i18n/components/LocaleContext'
import { countryName } from '@/shared/static/countries'
import { formatDateTime } from '@/shared/utils/date'
import type { Contact } from '../types'
import { ContactTypeBadge } from './ContactTypeBadge'

type ContactTableRow = Contact & Record<string, unknown>

interface ContactsTableProps {
  contacts: Contact[]
  labels: Record<string, string>
  onDelete?: (id: string) => void
  onEdit?: (contact: Contact) => void
  onRowClick?: (contact: Contact, event?: React.MouseEvent) => void
}

export const ContactsTable = memo(function ContactsTable({
  contacts,
  labels,
  onDelete,
  onEdit,
  onRowClick,
}: ContactsTableProps) {
  const locale = useLocale()
  const hasActions = Boolean(onDelete || onEdit)
  const columns = useMemo(() => {
    const tableColumns: TableColumn<ContactTableRow>[] = [
      {
        key: 'name',
        label: labels.name,
        render: (_value, row) => {
          const contact = row as Contact
          return (
            <div className="flex min-w-0 items-center gap-3">
              {contact.logo ? (
                <Image unoptimized
                  src={contact.logo}
                  alt=""
                  width={36}
                  height={36}
                  className="h-9 w-9 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F5F5F5] text-xs font-bold text-[#333333]">
                  {contact.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-[#1A1A1A]">
                  {contact.name}
                </span>
                <span className="block break-all text-xs text-[#787774]">
                  {contact.email ?? ''}
                </span>
              </span>
            </div>
          )
        },
      },
      {
        key: 'type',
        label: labels.type,
        render: (_value, row) => (
          <ContactTypeBadge type={(row as Contact).type} labels={labels} />
        ),
      },
      { key: 'phone', label: labels.phone },
      { key: 'email', label: labels.email },
      {
        key: 'country',
        label: labels.country,
        render: (_value, row) => {
          const contact = row as Contact
          if (!contact.country) return <span className="text-[#787774]">—</span>
          return <span className="text-[#555555]">{countryName(contact.country, locale)}</span>
        },
      },
      {
        key: 'city',
        label: labels.city,
        render: (_value, row) => {
          const contact = row as Contact
          if (!contact.city) return <span className="text-[#787774]">—</span>
          return <span className="text-[#555555]">{contact.city}</span>
        },
      },
      {
        key: 'createdAt',
        label: labels.createdAt,
        render: (_value, row) => (
          <span className="text-[#787774]">
            {formatDateTime((row as Contact).createdAt, locale)}
          </span>
        ),
      },
    ]

    if (hasActions) {
      tableColumns.push({
        key: 'id',
        label: labels.actions,
        render: (_value, row) => {
          const contact = row as Contact
          return (
            <TableActionsMenu
              actions={[
                ...(onEdit ? [{ label: labels.edit, onSelect: () => onEdit(contact) }] : []),
                ...(onDelete
                  ? [{ destructive: true as const, label: labels.delete, onSelect: () => onDelete(contact.id) }]
                  : []),
              ]}
              ariaLabel={labels.actions}
            />
          )
        },
      })
    }

    return tableColumns
  }, [hasActions, labels, onDelete, onEdit, locale])

  return (
    <div className="contacts-table-wrapper">
      <Table
        columns={columns}
        data={contacts as ContactTableRow[]}
        paginate={false}
        pageSize={contacts.length || 1}
        sortable={false}
        getRowId={(row) => (row as Contact).id}
        onRowClick={onRowClick ? (row) => onRowClick(row as Contact) : undefined}
      />
    </div>
  )
})
