// Business Admin service worker.
//  - Makes the app installable: Chrome and Edge need an active worker with a fetch handler.
//  - Activates at once, so a new deploy takes over without waiting for every tab to close.
// It deliberately caches nothing. This is a private admin app on live data (Supabase), so every request goes to
// the network, and nothing from a signed-in session is ever stored by the worker.
self.addEventListener('install', () => { self.skipWaiting() })
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()) })
self.addEventListener('fetch', () => {})
