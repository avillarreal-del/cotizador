/* Service worker del SK Cotizador.
   Guarda en caché la app y las librerías externas para que funcione sin señal
   después de abrirla una vez con conexión.

   ► AL PUBLICAR UNA VERSIÓN NUEVA hay que subir el número de CACHE. Si no, el
     teléfono sigue sirviendo la copia guardada y los cambios no se ven. */
const CACHE = 'sk-cotizador-v6';   // v6: ajuste de nombres largos y comisión de apertura

const PROPIOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

const EXTERNOS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(PROPIOS);
    await Promise.all(EXTERNOS.map(u =>
      c.add(new Request(u, { mode: 'cors' })).catch(() => null)
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.url.indexOf('api.anthropic.com') >= 0) return;
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreVary: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && EXTERNOS.some(u => req.url.indexOf(u.split('?')[0]) === 0)) {
        const c = await caches.open(CACHE);
        c.put(req, res.clone());
      }
      return res;
    } catch (err) {
      const fb = await caches.match('./index.html');
      return fb || Response.error();
    }
  })());
});
