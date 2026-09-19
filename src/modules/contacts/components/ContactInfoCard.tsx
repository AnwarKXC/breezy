'use client'

import Image from 'next/image'
import type { Contact } from '../types'
import { Card } from '@/shared/components/Card'
import { AnalyticsCard } from '@/shared/components/AnalyticsCard'
import { ContactTypeBadge } from './ContactTypeBadge'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { countryName } from '@/shared/static/countries'
import { useMemo } from 'react'
import type { Invoice } from '../types/invoiceTypes'

interface ContactInfoCardProps {
 contact: Contact
  labels: Record<string, string>; permissions: {
 canCreateContacts: boolean
 canDeleteContacts: boolean
 canUpdateContacts: boolean
 canUpdatePriceOverrides: boolean
 }
 onEdit?: () => void
 onDelete?: () => void
}

export function ContactInfoCard({ contact, labels, permissions, onEdit, onDelete }: ContactInfoCardProps) {
  const { t, locale } = useTranslation()
  const isCompany = contact.type === 'company'

 return (
 <Card padding="lg"> <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between"> <div className="flex items-center gap-4"> {contact.logo ? (
 <Image unoptimized
 src={contact.logo}
 alt=""
 width={72}
 height={72}
 className="h-18 w-18 shrink-0 rounded-xl object-cover"
 /> ) : (
 <span className="grid h-18 w-18 shrink-0 place-items-center rounded-xl bg-[#F5F5F5] text-2xl font-bold text-[#333333]"> {contact.name.charAt(0).toUpperCase()}
 </span> )}
 <div> <div className="flex items-center gap-3"> <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">{contact.name}</h1> <ContactTypeBadge type={contact.type} labels={labels} /> </div> <p className="mt-1 text-sm text-[#787774]"> {isCompany ? contact.responsiblePerson || labels.responsiblePerson : contact.email || contact.phone}
 </p> <p className="mt-1 text-xs text-[#787774]"> {labels.createdLabel}: {new Date(contact.createdAt).toLocaleDateString()}
 </p> </div> </div> <div className="flex gap-3"> {permissions.canUpdateContacts && (
 <button
 type="button"
 onClick={onEdit}
 className="rounded-xl bg-[#F5F5F5] px-4 py-2 text-sm font-bold text-[#555555] transition-all duration-200 hover:bg-[#EAEAEA]"> {labels.edit}
 </button> )}
 {permissions.canDeleteContacts && (
 <button
 type="button"
 onClick={onDelete}
 className="rounded-xl bg-[#FDEBEC] px-4 py-2 text-sm font-bold text-[#9F2F2D] transition-all duration-200 hover:bg-[#FDEBEC]"> {labels.delete}
 </button> )}
 </div> </div> <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"> <div> <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#787774]">{labels.phone}</p> <div className="mt-1 flex items-center gap-2"> <p className="text-sm font-medium text-[#1A1A1A]">{contact.phone}</p> {contact.phone ? (
 <div className="flex gap-1"> <a
 href={`https://wa.me/${contact.phone.replace(/[^\d+]/g, '')}`}
 target="_blank"
 rel="noopener noreferrer"
 className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-[#346538] transition-colors hover:bg-green-100"
   aria-label={t('contacts.whatsapp')}> <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"> <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /> </svg> </a> <a
 href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}
 className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#1A1A1A] transition-colors hover:bg-blue-100"
   aria-label={t('contacts.call')}> <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"> <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /> </svg> </a> </div> ) : null}
 </div> </div> <div> <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#787774]">{labels.email}</p> <p className="mt-1 text-sm font-medium text-[#1A1A1A]">{contact.email || '—'}</p> </div> {isCompany && (
 <> <div> <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#787774]">{labels.country}</p> <p className="mt-1 text-sm font-medium text-[#1A1A1A]">{contact.country ? countryName(contact.country, locale) : '—'}</p> </div> <div> <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#787774]">{labels.city}</p> <p className="mt-1 text-sm font-medium text-[#1A1A1A]">{contact.city || '—'}</p> </div> </> )}
 {!isCompany && contact.idPassport && (
 <div> <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#787774]">{labels.idPassport}</p> <p className="mt-1 text-sm font-medium text-[#1A1A1A]">{contact.idPassport}</p> </div> )}
 </div> </Card> )
}

interface ContactAnalyticsProps {
 invoices: Invoice[]
 formatCurrency: (amount: number) => string
}

export function ContactAnalytics({ invoices, formatCurrency }: ContactAnalyticsProps) {
  const { t } = useTranslation()
 const totalRevenue = useMemo(
 () => invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + Number(i.amount), 0),
 [invoices],
 )
 const remaining = useMemo(
 () => invoices.filter((i) => i.status === 'pending' || i.status === 'overdue').reduce((sum, i) => sum + Number(i.amount), 0),
 [invoices],
 )
 const lastInvoice = invoices.length ? invoices.reduce((latest, i) => i.issueDate> latest.issueDate ? i : latest) : null

 return (
 <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">   <AnalyticsCard label={t('contacts.totalInvoices')} value={invoices.length} accent="indigo" /> <AnalyticsCard label={t('contacts.totalRevenue')} value={formatCurrency(totalRevenue)} accent="emerald" /> <AnalyticsCard label={t('contacts.remaining')} value={formatCurrency(remaining)} accent="amber" /> <AnalyticsCard label={t('contacts.lastInvoice')} value={lastInvoice ? `#${lastInvoice.invoiceNumber}` : '—'} accent="violet" /> </section> )
}
