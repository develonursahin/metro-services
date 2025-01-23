const CACHE_NAME = 'flutter-cache-v1';
const API_URL = '';

const urlsToCache = [
  '/metro-services/index.html',
  '/metro-services/main.dart.js',
  '/metro-services/flutter_service_worker.js',
  '/metro-services/favicon.png',
  '/metro-services/icons/Icon-192.png',
  '/metro-services/manifest.json',
];
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'set-api-url') {
    self.API_URL = event.data.url; // API URL'sini client tarafından al
  }
});

// Install event - İlk defa service worker aktif olduğunda yapılacak işlemler
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Yeni Service Worker'ın beklemeden aktif olması için
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        urlsToCache.map((url) => {
          return fetch(url).then((response) => {
            if (!response.ok) {
              throw new Error(`Failed to fetch: ${url}`);
            }
            return cache.put(url, response);
          });
        })
      );
    })
  );
});

// Activate event - Service worker aktif olduğunda yapılacak işlemler
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      clients.claim(); // Yeni Service Worker tüm clientları kontrol etmeye başlar
      fetchApiData(); // İlk istek
      scheduleNextFetch(); // Sonraki istekleri zamanla
    })
  );
});

// Dakika başında API isteği tetikleyici
function scheduleNextFetch() {
  const now = new Date();
  const seconds = now.getSeconds();
  const milliseconds = now.getMilliseconds();

  // Bir sonraki dakika başına kalan süreyi hesapla
  const timeToNextMinute = (60 - seconds) * 1000 - milliseconds;

  // Dakika başına zamanla
  setTimeout(() => {
    fetchApiData().then(() => {
      scheduleNextFetch(); // Bir sonraki istek için zamanlama
    });
  }, timeToNextMinute);
}

function fetchApiData() {
  return fetch(API_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then((data) => {
      // console.log('API Response:', data);

      // Tüm clientlara veriyi gönder
      self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'data-from-service-worker',
            data: data,
          });
        });
      });
    })
    .catch((error) => {
      console.error('Error fetching API data:', error);

      // Hata durumunda clientlara bilgi gönder
      self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'fetch-error',
            message: error.toString(),
          });
        });
      });
    });
}
