'use client'

import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { useUserForm } from '../hooks'
import type { User } from '../types'
import type { UsersPage as UsersPageData } from '../types'
import { useUsersExport } from '../hooks/useUsersExport'
import { useUsersPageLabels } from '../hooks/useUsersPageLabels'
import { useUsersView } from '../hooks/useUsersView'
import { getUserErrorDescription } from '../utils/userErrors'
import { UserForm } from './UserForm'
import { UsersAnalytics } from './UsersAnalytics'
import { UsersGrid } from './UsersGrid'
import { UsersHeader } from './UsersHeader'
import { UsersPagination } from './UsersPagination'
import { UsersStateCard, UsersLoadingState } from './UsersStates'
import { UsersTable } from './UsersTable'
import { UsersToolbar } from './UsersToolbar'
import { DeleteConfirmationDialog } from '@/shared/components/DeleteConfirmationDialog'

interface UsersPagePermissions {
  canCreateUsers: boolean
  canDeleteUsers: boolean
  canUpdateUsers: boolean
}

export const UsersPage = memo(function UsersPage({ permissions, initialData }: { permissions: UsersPagePermissions; initialData?: UsersPageData }) {
  const router = useRouter()
  const view = useUsersView(initialData)
  const form = useUserForm(view)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)
  const navigatingRef = useRef(false)
  const { labels, locale, paginationLabel, roleLabels } = useUsersPageLabels(view.page)
  const selectedUsers = useMemo(
    () => view.pageUsers.filter((user) => selectedUserIds.includes(user.id)),
    [selectedUserIds, view.pageUsers]
  )
  const exportUsers = selectedUsers.length ? selectedUsers : view.pageUsers
  const usersExport = useUsersExport(exportUsers, labels, locale)
  const pageError = view.error ?? usersExport.error
  const errorDescription = getUserErrorDescription(pageError, labels)
  const formErrorDescription = getUserErrorDescription(form.error, labels)
  const { deleteUser } = view
  const handleDeleteUser = useCallback((id: string) => {
    setDeleteUserId(id)
  }, [])
  const confirmDeleteUser = useCallback(() => {
    if (!deleteUserId) return
    void deleteUser(deleteUserId).catch(() => undefined)
    setDeleteUserId(null)
  }, [deleteUser, deleteUserId])
  const handleRowClick = useCallback((user: User) => {
    if (navigatingRef.current) return
    navigatingRef.current = true
    router.push(`/${locale}/users/${user.id}`)
  }, [locale, router])

  return (
    <ErrorBoundary>
      <main className="flex w-full flex-col gap-6">
          <UsersHeader
            title={labels.title}
            subtitle={labels.subtitle}
            actionLabel={labels.create}
            onCreate={permissions.canCreateUsers ? form.openCreateForm : undefined}
          />
          <UsersAnalytics loading={view.loading} metrics={view.metrics} labels={{ total: labels.total, ...roleLabels }} />
          <UsersToolbar
            query={view.query}
            role={view.role}
            view={view.view}
            labels={labels}
            roleLabels={roleLabels}
            onQueryChange={view.setQuery}
            onRoleChange={view.setRole}
            onViewChange={view.setView}
            onExportCsv={usersExport.exportCsv}
            onExportPdf={usersExport.exportPdf}
          />
          {view.loading ? <UsersLoadingState /> : null}
          {!view.loading && pageError ? (
            <UsersStateCard title={labels.errorTitle} description={errorDescription} />
          ) : null}
          {!view.loading && !pageError && !view.pageUsers.length ? (
            <UsersStateCard title={labels.emptyTitle} description={labels.emptyDescription} />
          ) : null}
          {!view.loading && !pageError && view.pageUsers.length ? (
            <div className="content-visibility-auto">
              {view.view === 'row' ? (
                <UsersTable
                  users={view.pageUsers}
                  labels={labels}
                  selectedRowIds={selectedUserIds}
                  onSelectedRowIdsChange={setSelectedUserIds}
                  onDelete={permissions.canDeleteUsers ? handleDeleteUser : undefined}
                  onEdit={permissions.canUpdateUsers ? form.openEditForm : undefined}
                  onRowClick={handleRowClick}
                />
              ) : (
                <UsersGrid
                  users={view.pageUsers}
                  labels={labels}
                  onDelete={permissions.canDeleteUsers ? handleDeleteUser : undefined}
                  onEdit={permissions.canUpdateUsers ? form.openEditForm : undefined}
                />
              )}
            </div>
          ) : null}

          {!view.loading && !pageError && view.pageUsers.length ? (
            <UsersPagination
              page={view.page}
              pageSize={view.pageSize}
              pageSizeOptions={view.pageSizeOptions}
              label={paginationLabel}
              previousLabel={labels.previous}
              nextLabel={labels.next}
              totalPages={view.totalPages}
              canPrevious={view.canPrevious}
              canNext={view.canNext}
              onPrevious={view.previousPage}
              onNext={view.nextPage}
              onPageChange={view.goToPage}
              onPageSizeChange={view.setPageSize}
            />
          ) : null}
        {form.open &&
        (form.mode === 'create' ? permissions.canCreateUsers : permissions.canUpdateUsers) ? (
          <UserForm
            draft={form.draft}
            error={form.error}
            errorDescription={formErrorDescription}
            labels={labels}
            mode={form.mode}
            roleLabels={roleLabels}
            saving={form.saving}
            onClose={form.closeForm}
            onSubmit={form.submitForm}
            onUpdate={form.updateDraft}
          />
        ) : null}
        <DeleteConfirmationDialog
          isOpen={Boolean(deleteUserId)}
          title={labels.confirmDeleteTitle}
          description={labels.confirmDeleteDescription}
          cancelLabel={labels.cancel}
          confirmLabel={labels.confirmDeleteAction}
          onClose={() => setDeleteUserId(null)}
          onConfirm={confirmDeleteUser}
        />
      </main>
    </ErrorBoundary>
  )
})

