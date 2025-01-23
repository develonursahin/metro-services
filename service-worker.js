const CACHE_NAME = 'flutter-cache-v1';
const API_URL = ''; // API URL'sini buraya ekleyin

const urlsToCache = [
  '/metro-services/index.html',
  '/metro-services/main.dart.js',
  '/metro-services/flutter_service_worker.js',
  '/metro-services/favicon.png',
  '/metro-services/icons/Icon-192.png',
  '/metro-services/manifest.json',
];

// API URL'sini client tarafından al
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'set-api-url') {
    self.API_URL = event.data.url;
  }
});

// Install event - İlk defa Service Worker aktif olduğunda yapılacak işlemler
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

// Activate event - Service Worker aktif olduğunda yapılacak işlemler
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
      registerPeriodicSync(); // Periodic Sync'i kaydet
      fetchApiData(); // İlk istek
      scheduleNextFetch(); // Sonraki istekleri zamanla
    })
  );
});

// Periodic Sync kaydı
async function registerPeriodicSync() {
  const registration = await self.registration;
  try {
    await registration.periodicSync.register('fetch-data', {
      minInterval: 60 * 1000, // 1 dakika
    });
    console.log('Periodic Sync registered');
  } catch (e) {
    console.error('Periodic Sync registration failed:', e);
  }
}

// Periodic Sync olayını dinle
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'fetch-data') {
    event.waitUntil(fetchApiData());
  }
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

// API'den veri çekme işlemi
function fetchApiData() {
  return fetch(API_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then((data) => {
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

// Service Worker'ı aktif tutmak için ping gönder
setInterval(() => {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'ping' });
    });
  });
}, 30000); // 30 saniyede bir