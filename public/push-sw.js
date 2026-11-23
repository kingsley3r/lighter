// Push reminders for Lighter (loaded into the generated service worker).
self.addEventListener('push', (event) => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch { d = { body: event.data && event.data.text() } }
  event.waitUntil(self.registration.showNotification(d.title || 'Lighter', {
    body: d.body || '',
    tag: d.tag,
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    data: { url: d.url || '/' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate && c.navigate(url); return c.focus() } }
    return self.clients.openWindow(url)
  }))
})
