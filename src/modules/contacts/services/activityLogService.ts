import 'server-only'

import { logAction } from '@/services/logs'
import { LOG_ACTIONS, LOG_MODULES, type LogAction } from '@/types/logs'
import type { Contact } from '../types'

type ContactAction = 'contact_created' | 'contact_updated' | 'contact_deleted'

const ACTION_MAP: Record<ContactAction, LogAction> = {
  contact_created: LOG_ACTIONS.CONTACT_CREATED,
  contact_updated: LOG_ACTIONS.CONTACT_UPDATED,
  contact_deleted: LOG_ACTIONS.CONTACT_DELETED,
}

const DESCRIPTION_MAP: Record<ContactAction, string> = {
  contact_created: 'contacts/log/created',
  contact_updated: 'contacts/log/updated',
  contact_deleted: 'contacts/log/deleted',
}

function buildTarget(contact: Pick<Contact, 'id' | 'name' | 'type'>) {
  return { id: contact.id, name: contact.name, type: contact.type }
}

export async function logContactCreated(contact: Pick<Contact, 'id' | 'name' | 'type'>) {
  await logAction({
    action: ACTION_MAP.contact_created,
    description: DESCRIPTION_MAP.contact_created,
    entityId: contact.id,
    entityType: 'contact',
    metadata: { after: { id: contact.id, name: contact.name, type: contact.type } },
    module: LOG_MODULES.CONTACTS,
    target: buildTarget(contact),
  })
}

export async function logContactUpdated(contact: Pick<Contact, 'id' | 'name' | 'type'>) {
  await logAction({
    action: ACTION_MAP.contact_updated,
    description: DESCRIPTION_MAP.contact_updated,
    entityId: contact.id,
    entityType: 'contact',
    metadata: { after: { id: contact.id, name: contact.name } },
    module: LOG_MODULES.CONTACTS,
    target: buildTarget(contact),
  })
}

export async function logContactDeleted(contact: Pick<Contact, 'id' | 'name' | 'type'>) {
  await logAction({
    action: ACTION_MAP.contact_deleted,
    description: DESCRIPTION_MAP.contact_deleted,
    entityId: contact.id,
    entityType: 'contact',
    metadata: { after: { id: contact.id, name: contact.name } },
    module: LOG_MODULES.CONTACTS,
    target: buildTarget(contact),
  })
}
