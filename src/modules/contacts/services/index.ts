export {
  getContactsUiPermissions,
  requireContactsCreate,
  requireContactsDelete,
  requireContactsRead,
  requireContactsUpdate,
} from './serviceSecurity'
export {
  createContact,
  deleteContact,
  getContactById,
  getContactsMetrics,
  getContactsPage,
  updateContact,
} from './contactService'
export {
  createContact as createContactApi,
  deleteContact as deleteContactApi,
  fetchContacts,
  fetchContactsMetrics,
  updateContact as updateContactApi,
} from './contactsApiClient'
