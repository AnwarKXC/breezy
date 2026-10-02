// public/assistant-sw.js - Service worker of the standalone assistant app.
// Registered with scope /{locale}/assistant (allowed by the Service-Worker-Allowed
// header in next.config.ts). It only handles page navigations so the app opens
// with an offline screen instead of the browser error; API calls (chat answers,
// conversation history) are never intercepted or cached: they contain hotel data.

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(
    fetch(event.request).catch(() => new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })),
  )
})

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #fff; color: #1a1a1a; }
    main { text-align: center; padding: 2rem; max-width: 22rem; }
    p { color: #787774; line-height: 1.6; }
    button { margin-top: 1rem; height: 2.75rem; padding: 0 1.5rem; border: 0; border-radius: 0.5rem; background: #1a1a1a; color: #fff; font: inherit; }
  </style>
</head>
<body>
  <main>
    <h1>You're offline</h1>
    <p>The assistant needs a connection to look up hotel data.</p>
    <p dir="rtl" lang="ar">أنت غير متصل بالإنترنت. المساعد يحتاج اتصالاً للبحث في بيانات الفندق.</p>
    <button onclick="location.reload()">Try again · إعادة المحاولة</button>
  </main>
</body>
</html>`
