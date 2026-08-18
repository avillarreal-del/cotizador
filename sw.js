/* Service worker del SK Cotizador.
   Guarda en caché la app y las cuatro librerías externas (jsPDF, PDF.js y su
   worker, SheetJS) más las fuentes, para que funcione sin señal después de
   abrirla una vez con conexión. Estrategia: caché primero para lo propio y lo
   de CDN —son versiones fijas, no cambian— y red primero para todo lo demás. */
const CACHE = 'sk-cotizador-v1';

const PROPIOS = [
  './',
  './sk_cotizador_41.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

/* Versiones fijadas: si se actualizan en el HTML, hay que subir CACHE a v2. */
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
    /* Los externos se piden de uno en uno y sin abortar la instalación si
       alguno falla: si el CDN no responde, la app igual queda instalada. */
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
  if (req.method !== 'GET') return;                    // descargas y POST pasan directo
  if (req.url.indexOf('api.anthropic.com') >= 0) return; // nunca cachear llamadas a la API

  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreVary: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      /* Se guarda lo que venga de los CDN conocidos, para la próxima vez. */
      if (res && res.status === 200 && EXTERNOS.some(u => req.url.indexOf(u.split('?')[0]) === 0)) {
        const c = await caches.open(CACHE);
        c.put(req, res.clone());
      }
      return res;
    } catch (err) {
      const fb = await caches.match('./sk_cotizador_41.html');
      return fb || Response.error();
    }
  })());
});
