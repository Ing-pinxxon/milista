/*
 * Service worker de Mi lista.
 *
 * Objetivo: poder consultar precios en la plaza sin senal. La app se sirve desde
 * cache y el catalogo se refresca en segundo plano cuando hay red.
 */
const CACHE = 'milista-v1'
const APP_SHELL = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (e) => {
  // addAll falla entera si un recurso falla; se agregan uno a uno para que un
  // 404 en un icono no deje la app sin cache.
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(APP_SHELL.map((u) => c.add(u).catch(() => null)))),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // El catalogo: red primero para tener el precio de hoy, cache como respaldo.
  if (url.pathname === '/api/productos') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copia))
          return res
        })
        .catch(() => caches.match(req).then((r) => r || Response.json({ productos: [] }))),
    )
    return
  }

  // El resto de la API siempre va a la red: escribir sin conexion no tiene sentido.
  if (url.pathname.startsWith('/api/')) return

  // Paginas y estaticos: cache primero, y se refresca por detras.
  e.respondWith(
    caches.match(req).then((cacheada) => {
      const red = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copia = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copia))
          }
          return res
        })
        .catch(() => cacheada)
      return cacheada || red
    }),
  )
})
