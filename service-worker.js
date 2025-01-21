const CACHE_NAME = 'flutter-cache-v1';
const urlsToCache = [
  '/metro-services/index.html',
  '/metro-services/main.dart.js',
  '/metro-services/flutter_service_worker.js',
  '/metro-services/favicon.png',
  '/metro-services/icons/Icon-192.png',
  '/metro-services/manifest.json',
];


// Install event - İlk defa service worker aktif olduğunda yapılacak işlemler
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // console.log('Caching static assets');
      return cache.addAll(urlsToCache);
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
    })
  );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'fetch-api') {
      // console.log('Message received from Flutter:', event.data);
      const apiUrl = event.data.apiUrl;
  
      // console.log('Fetching data from API');
      // console.log('Fetching data from API:', apiUrl);
      fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
          // console.log('API response:', data);
          console.log('API fetched.');
  
          self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
            // console.log('Clients found:', clients);
  
            if (clients.length === 0) {
              console.log('No clients available for messaging');
            } else {
              clients.forEach(client => {
                // console.log('Sending message to client:', client);
                client.postMessage({
                  type: 'data-from-service-worker',
                  data: data,
                });
                // console.log('Message sent to client.');
              });
            }
          }).catch(error => {
            console.error('Error fetching clients:', error);
          });
        })
        .catch(error => {
          console.error('Error fetching data:', error);
          self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'fetch-error',
                message: error.toString(),
              });
            });
          });
        });
    }
  });
  