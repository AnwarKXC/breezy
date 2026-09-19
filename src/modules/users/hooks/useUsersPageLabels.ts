'use client'

import { useTranslation } from '@/i18n/hooks/useTranslation'
import type { UserRole } from '../types'

export function useUsersPageLabels(page: number) {
  const { t, locale } = useTranslation()
  const labels = {
    title: t('users.title'),
    subtitle: t('users.subtitle'),
    create: t('users.create'),
    total: t('users.metrics.total'),
    name: t('users.name'),
    role: t('users.role'),
    phone: t('users.phone'),
    createdAt: t('users.createdAt'),
    actions: t('users.actions'),
    delete: t('common.delete'),
    edit: t('common.edit'),
    email: t('users.email'),
    password: t('users.password'),
    createTitle: t('users.form.createTitle'),
    editTitle: t('users.form.editTitle'),
    formDescription: t('users.form.description'),
    close: t('common.close'),
    cancel: t('common.cancel'),
    save: t('common.save'),
    confirmDeleteTitle: t('common.confirmDeleteTitle'),
    confirmDeleteDescription: t('common.confirmDeleteDescription'),
    confirmDeleteAction: t('common.confirmDeleteAction'),
    saving: t('users.form.saving'),
    searchPlaceholder: t('users.searchPlaceholder'),
    roleFilter: t('users.roleFilter'),
    rowView: t('users.rowView'),
    gridView: t('users.gridView'),
    export: t('common.export'),
    exportCsv: t('users.exportCsv'),
    exportPdf: t('users.exportPdf'),
    emptyTitle: t('users.emptyTitle'),
    emptyDescription: t('users.emptyDescription'),
    errorTitle: t('users.errorTitle'),
    permissionDenied: t('users.errors.permissionDenied'),
    invalidSession: t('users.errors.invalidSession'),
    invalidForm: t('users.errors.invalidForm'),
    emailAlreadyExists: t('users.errors.emailAlreadyExists'),
    exportPopupBlocked: t('users.errors.exportPopupBlocked'),
    genericError: t('users.errors.generic'),
    previous: t('users.previous'),
    next: t('users.next'),
  }
  const roleLabels: Record<UserRole | 'all', string> = {
    all: t('users.roles.all'),
    admin: 'admin',
    accountant: 'accountant',
    front_desk: 'front_desk',
  }
  const paginationLabel = t('users.pagination').replace('{page}', String(page))

  return { labels, locale, paginationLabel, roleLabels }
}
