'use client'

import { memo, useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import type { Contact } from '../types'
import { getContactErrorDescription } from '../utils/contactErrors'
import { useContactsView, useContactForm, useContactsExport } from '../hooks'
import type { ContactsExportLabels } from '../hooks/useContactsExport'
import { ContactForm } from './ContactForm'
import { ContactsAnalytics } from './ContactsAnalytics'
import { ContactsHeader } from './ContactsHeader'
import { ContactsLoadingState, ContactsStateCard } from './ContactsStates'
import { ContactsTable } from './ContactsTable'
import { ContactsToolbar } from './ContactsToolbar'
import { ContactsPagination } from './ContactsPagination'
import { ContactCard } from './ContactCard'
import { DeleteConfirmationDialog } from '@/shared/components/DeleteConfirmationDialog'

interface ContactsPagePermissions {
  canCreateContacts: boolean
  canDeleteContacts: boolean
  canUpdateContacts: boolean
}

export const ContactsPage = memo(function ContactsPage({ permissions }: { permissions: ContactsPagePermissions }) {
  const router = useRouter()
  const { t, locale } = useTranslation()
  const view = useContactsView()
  const form = useContactForm(view)
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null)
  const [deletingContact, setDeletingContact] = useState(false)
  const labels = useMemo(() => ({
    title: t('contacts.title'),
    subtitle: t('contacts.subtitle'),
    create: t('contacts.create'),
    total: t('contacts.metrics.total'),
    company: t('contacts.company'),
    individual: t('contacts.individual'),

    name: t('contacts.name'),
    type: t('contacts.type'),
    phone: t('contacts.phone'),
    email: t('contacts.email'),
    country: t('contacts.country'),
    city: t('contacts.city'),
    responsiblePerson: t('contacts.responsiblePerson'),
    idPassport: t('contacts.idPassport'),
    logo: t('contacts.logo'),
    createdAt: t('contacts.createdAt'),
    actions: t('contacts.actions'),
    delete: t('common.delete'),
    edit: t('common.edit'),
    searchPlaceholder: t('contacts.searchPlaceholder'),
    typeFilter: t('contacts.typeFilter'),
    rowView: t('contacts.rowView'),
    gridView: t('contacts.gridView'),
    exportCsv: t('contacts.exportCsv'),
    exportPdf: t('contacts.exportPdf'),
    emptyTitle: t('contacts.emptyTitle'),
    emptyDescription: t('contacts.emptyDescription'),
    errorTitle: t('contacts.errorTitle'),
    permissionDenied: t('contacts.errors.permissionDenied'),
    invalidSession: t('contacts.errors.invalidSession'),
    invalidForm: t('contacts.errors.invalidForm'),
    notFound: t('contacts.errors.notFound'),
    phoneExists: t('contacts.errors.phoneExists'),
    requestFailed: t('contacts.errors.requestFailed'),
    genericError: t('contacts.errors.generic'),
    previous: t('contacts.previous'),
    next: t('contacts.next'),
    createTitle: t('contacts.form.createTitle'),
    editTitle: t('contacts.form.editTitle'),
    description: t('contacts.form.description'),
    saving: t('contacts.form.saving'),
    close: t('common.close'),
    cancel: t('common.cancel'),
    save: t('common.save'),
    confirmDeleteTitle: t('common.confirmDeleteTitle'),
    confirmDeleteDescription: t('common.confirmDeleteDescription'),
    confirmDeleteAction: t('common.confirmDeleteAction'),
  }), [t])

  const typeLabels = useMemo(() => ({
    all: t('contacts.typeLabels.all'),
    company: t('contacts.typeLabels.company'),
    individual: t('contacts.typeLabels.individual'),
  }), [t])

  const paginationLabel = t('contacts.pagination').replace('{page}', String(view.page))

  const errorDescription = getContactErrorDescription(view.error, labels)
  const formErrorDescription = getContactErrorDescription(form.error, labels)
  const phoneErrorDescription = getContactErrorDescription(form.phoneError, labels)

  const handleRowClick = useCallback(
    (contact: Contact, event?: React.MouseEvent | MouseEvent) => {
      document.body.classList.add('table-navigating')
      const wrapper = document.querySelector('.contacts-table-wrapper')
      if (wrapper) wrapper.classList.add('loading')
      router.push(`/${locale}/contacts/${contact.id}`)
    },
    [locale, router],
  )

  const contactsExport = useContactsExport(view.contacts, labels as unknown as ContactsExportLabels, locale)

  const handleDelete = useCallback((id: string) => {
    setDeleteContactId(id)
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!deleteContactId || deletingContact) return
    setDeletingContact(true)
    try {
      await view.deleteContact(deleteContactId)
      setDeleteContactId(null)
    } finally {
      setDeletingContact(false)
    }
  }, [deleteContactId, deletingContact, view])

  return (
    <ErrorBoundary>
      <main className="flex w-full flex-col gap-6">
        <ContactsHeader
          title={labels.title}
          subtitle={labels.subtitle}
          actionLabel={labels.create}
          locale={locale}
          onCreate={permissions.canCreateContacts ? form.openCreateForm : undefined}
        />
        <ContactsAnalytics loading={view.loading} metrics={view.metrics} labels={labels} />
        <ContactsToolbar
          query={view.query}
          type={view.type}
          view={view.view}
          labels={labels}
          typeLabels={typeLabels}
          onQueryChange={view.setQuery}
          onTypeChange={view.setType}
          onViewChange={view.setView}
          onExportCsv={contactsExport.exportCsv}
          onExportPdf={contactsExport.exportPdf}
        />
        {view.loading ? <ContactsLoadingState /> : null}
        {!view.loading && view.error ? (
          <ContactsStateCard
            title={labels.errorTitle}
            description={errorDescription}
            retryLabel={t('common.retry')}
            onRetry={view.triggerMutation}
          />
        ) : null}
        {!view.loading && !view.error && !view.contacts.length ? (
          <ContactsStateCard title={labels.emptyTitle} description={labels.emptyDescription} />
        ) : null}
        {!view.loading && !view.error && view.contacts.length ? (
          <div className="content-visibility-auto">
            {view.view === 'row' ? (
              <ContactsTable
                contacts={view.contacts}
                labels={labels}
                onDelete={permissions.canDeleteContacts ? handleDelete : undefined}
                onEdit={permissions.canUpdateContacts ? form.openEditForm : undefined}
                onRowClick={handleRowClick}
              />
            ) : (
              <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {view.contacts.map((contact) => (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    labels={labels}
                    onDelete={permissions.canDeleteContacts ? handleDelete : undefined}
                    onEdit={permissions.canUpdateContacts ? form.openEditForm : undefined}
                    onRowClick={handleRowClick}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}
        {!view.loading && !view.error && view.contacts.length ? (
          <ContactsPagination
            canNext={view.canNext}
            canPrevious={view.canPrevious}
            page={view.page}
            pageSize={view.pageSize}
            pageSizeOptions={view.pageSizeOptions}
            label={paginationLabel}
            previousLabel={labels.previous}
            nextLabel={labels.next}
            totalPages={view.totalPages}
            onNext={view.nextPage}
            onPrevious={view.previousPage}
            onPageChange={view.goToPage}
            onPageSizeChange={view.setPageSize}
          />
        ) : null}
        {form.open &&
        (form.mode === 'create' ? permissions.canCreateContacts : permissions.canUpdateContacts) ? (
          <ContactForm
            draft={form.draft}
            error={form.error}
            errorDescription={formErrorDescription}
            fieldErrors={form.fieldErrors}
            phoneError={form.phoneError}
            phoneErrorDescription={phoneErrorDescription}
            labels={labels}
            mode={form.mode}
            saving={form.saving}
            onClose={form.closeForm}
            onSubmit={form.submitForm}
            onUpdate={form.updateDraft}
          />
        ) : null}
        <DeleteConfirmationDialog
          isOpen={Boolean(deleteContactId)}
          title={labels.confirmDeleteTitle}
          description={labels.confirmDeleteDescription}
          cancelLabel={labels.cancel}
          confirmLabel={labels.confirmDeleteAction}
          loading={deletingContact}
          onClose={() => { if (!deletingContact) setDeleteContactId(null) }}
          onConfirm={confirmDelete}
        />
      </main>
    </ErrorBoundary>
  )
})
