export function getUserErrorDescription(
  error: string | null,
  labels: Record<string, string>,
) {
  if (error === 'auth/permission_denied') return labels.permissionDenied
  if (error === 'auth/invalid_form') return labels.invalidForm
  if (error === 'auth/email_already_exists') return labels.emailAlreadyExists
  if (error === 'auth/invalid_session' || error === 'auth/requires_authenticated_user') {
    return labels.invalidSession
  }
  if (error === 'users/export_popup_blocked') return labels.exportPopupBlocked
  return labels.genericError
}
