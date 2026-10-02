import assert from 'node:assert/strict'
import net from 'node:net'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

// A local SMTP server stalls after DATA: this exercises installed Nodemailer, no provider.
const require = createRequire(import.meta.url)
let outgoingSocket
const exports = {}
const source = readFileSync(new URL('../src/services/email/smtp.ts', import.meta.url), 'utf8')
runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, {
  exports, setTimeout, clearTimeout,
  require: (id) => {
    if (id === 'server-only') return {}
    if (id === 'node:net') return { ...net, connect: (...args) => { outgoingSocket = net.connect(...args); return outgoingSocket } }
    return require(id)
  },
})
let receivedData
const dataReceived = new Promise((resolve) => { receivedData = resolve })
let remoteClosed
const connectionClosed = new Promise((resolve) => { remoteClosed = resolve })
const sockets = new Set()
let dataMessages = 0
const server = net.createServer((socket) => {
  sockets.add(socket)
  socket.on('error', () => {})
  socket.on('close', () => { sockets.delete(socket); remoteClosed() })
  socket.write('220 localhost test SMTP\r\n')
  let buffer = ''
  let inData = false
  socket.on('data', (chunk) => {
    buffer += chunk.toString()
    if (inData) {
      if (buffer.includes('\r\n.\r\n')) { dataMessages++; receivedData(); buffer = '' }
      return
    }
    while (buffer.includes('\r\n')) {
      const end = buffer.indexOf('\r\n')
      const line = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      if (/^EHLO/.test(line)) socket.write('250-localhost\r\n250 AUTH PLAIN\r\n')
      else if (/^AUTH/.test(line)) socket.write('235 authenticated\r\n')
      else if (/^DATA/.test(line)) { inData = true; socket.write('354 Send data\r\n'); break }
      else socket.write('250 OK\r\n')
    }
  })
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
let held = false
async function withLock(run) {
  if (held) throw new Error('email/draft_busy')
  held = true
  try { return await run() }
  finally {
    assert.equal(outgoingSocket.destroyed, true, 'destroy active SMTP socket before releasing draft lock')
    held = false
  }
}
try {
  const account = { smtpHost: '127.0.0.1', smtpPort: server.address().port, smtpSecure: false, username: 'test', password: 'test' }
  const sending = withLock(() => exports.sendSmtpMessage(account, { from: 'hotel@example.com', to: 'guest@example.com', subject: 'Local timeout test', text: 'No provider is involved.' }, 500))
  await dataReceived
  assert.equal(held, true)
  await assert.rejects(withLock(async () => {}), /draft_busy/)
  await assert.rejects(sending, /send_uncertain/)
  assert.equal(held, false)
  await connectionClosed
  assert.equal(dataMessages, 1, 'one send reached DATA, and no later continuation can deliver another')
  assert.equal(sockets.size, 0)
  console.log('Email SMTP cancellation passed: stalled local send settles and socket closes before draft lock releases.')
} finally {
  for (const socket of sockets) socket.destroy()
  await new Promise((resolve) => server.close(resolve))
}
