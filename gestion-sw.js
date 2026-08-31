// Service Worker de la app de Gestión Takuwaku
// Cachea el "shell" de la app (HTML/CSS/JS y las librerías externas) la primera vez que se abre
// con conexión, para que después pueda abrirse sin internet. Los DATOS (productos, pedidos, etc.)
// se manejan aparte, por la persistencia offline de Firestore (ver gestion.html).

const CACHE_NAME = 'takuwaku-gestion-v1';

const APP_SHELL = [
    'gestion.html',
    'gestion-manifest.json',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest',
    'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // addAll puede fallar si algún recurso externo bloquea CORS; se agregan uno por uno
            // para que un solo recurso fallido no impida cachear el resto.
            return Promise.all(
                APP_SHELL.map((url) => cache.add(url).catch((err) => console.warn('No se pudo cachear:', url, err)))
            );
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
        )
    );
    self.clients.claim();
});

// Estrategia: red primero (para tener datos frescos de Firebase y del propio código),
// y si no hay conexión, cae en lo que haya en caché — así la app abre aunque no haya internet.
self.addEventListener('fetch', (event) => {
    // No interceptar llamadas a Firebase/Firestore: esas las maneja la propia persistencia offline del SDK.
    if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('firebaseapp.com')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
