import 'server-only'
import net from 'node:net'
import tls from 'node:tls'
import nodemailer from 'nodemailer'
import type Mail from 'nodemailer/lib/mailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import type { EmailAccount } from './account'

/** Await send settlement after destroying the actual socket, keeping draft locks held. */
export async function sendSmtpMessage(account: EmailAccount, mail: Mail.Options, timeoutMs = 30_000): Promise<void> {
  let socket: net.Socket | undefined
  let timedOut = false
  const timeoutError = new Error('email/send_uncertain')
  const options: SMTPTransport.Options = {
    host: account.smtpHost, port: account.smtpPort, secure: account.smtpSecure,
    auth: { user: account.username, pass: account.password }, connectionTimeout: 15_000,
    getSocket: (_options, callback) => {
      if (timedOut) { callback(timeoutError, undefined); return }
      let completed = false
      const done = (error?: Error) => {
        if (completed) return
        completed = true
        socket?.removeListener('error', onError)
        if (error) callback(error, undefined)
        else callback(null, { connection: socket, secured: account.smtpSecure })
      }
      const onError = (error: Error) => done(error)
      socket = account.smtpSecure
        ? tls.connect({ host: account.smtpHost, port: account.smtpPort, servername: net.isIP(account.smtpHost) ? undefined : account.smtpHost }, () => done())
        : net.connect({ host: account.smtpHost, port: account.smtpPort }, () => done())
      socket.once('error', onError)
    },
  }
  const transport = nodemailer.createTransport(options)
  const timer = setTimeout(() => { timedOut = true; socket?.destroy(timeoutError) }, timeoutMs)
  try {
    await transport.sendMail(mail)
    if (timedOut) throw timeoutError
  } catch (error) {
    throw timedOut ? timeoutError : error
  } finally {
    clearTimeout(timer)
    socket?.destroy()
    transport.close()
  }
}
