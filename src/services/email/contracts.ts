import { z } from 'zod'
import { MAIL_ACTIONS, MAIL_FOLDERS } from './mailbox'

export const FolderSchema = z.preprocess((value) => value === null || value === undefined ? 'inbox' : value, z.enum(MAIL_FOLDERS))
export const UidSchema = z.coerce.number().int().positive().max(4_294_967_295)
const emailList = z.array(z.email().trim().max(254)).max(50)
const header = z.string().max(998).refine((value) => !/[\r\n]/.test(value), 'email/invalid_header')
export const DraftSchema = z.object({
  to: emailList.default([]), cc: emailList.default([]), subject: z.string().trim().max(500).refine((value) => !/[\r\n]/.test(value), 'email/invalid_header'),
  text: z.string().max(200_000), inReplyTo: header.optional(), references: z.array(header).max(100).optional(),
  draftUid: z.number().int().positive().max(4_294_967_295).optional(),
  attachments: z.array(z.object({ filename: z.string().trim().min(1).max(255), contentType: z.string().trim().max(255).default('application/octet-stream'), content: z.base64() })).max(10).default([]),
}).refine((mail) => mail.attachments.reduce((sum, a) => sum + a.content.length, 0) <= 14_000_000, { message: 'email/attachments_too_large', path: ['attachments'] })
export const SendSchema = DraftSchema.refine((mail) => mail.to.length > 0, { message: 'email/recipient_required', path: ['to'] })
export const BulkSchema = z.object({ folder: z.enum(MAIL_FOLDERS).exclude(['pinned']), uids: z.array(z.number().int().positive().max(4_294_967_295)).min(1).max(100).transform((uids) => [...new Set(uids)]), action: z.enum(MAIL_ACTIONS) })
