export function getContactErrorDescription(
  error: string | null,
  labels: Record<string, string>,
) {
  if (error === 'contacts/invalid_form') return labels.invalidForm
  if (error === 'contacts/not_found') return labels.notFound
  if (error === 'contacts/phone_exists') return labels.phoneExists
  if (error === 'contacts/request_failed') return labels.requestFailed
  if (error === 'auth/permission_denied') return labels.permissionDenied
  if (error === 'auth/invalid_session') return labels.invalidSession
  if (error?.includes('/')) return labels.genericError
  return error || labels.genericError
}
