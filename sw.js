const CACHE = 'bettonbar-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './biere.png',
    'https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.min.js'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    if (url.pathname.includes('.php')) return;

    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;
            return fetch(e.request).then(res => {
                if (res && res.status === 200 && res.type === 'basic') {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => { });
                }
                return res;
            }).catch(() => caches.match('./index.html'));
        })
    );
});
