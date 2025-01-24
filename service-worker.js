// Activate event - Service Worker aktif olduğunda yapılacak işlemler
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // Tüm client'ları kontrol et
  scheduleApiFetch(); // Tam dakika başlangıcında API zamanlamasını başlat
});

// Tam dakikada API çağrısı yapmak için zamanlayıcı
function scheduleApiFetch() {
  const now = new Date();
  const seconds = now.getSeconds();
  const milliseconds = now.getMilliseconds();

  // Sonraki tam dakikaya kadar geçen süreyi hesapla
  const timeToNextMinute = (60 - seconds) * 1000 - milliseconds;

  // İlk isteği tam dakikada zamanla
  setTimeout(() => {
    fetchApiAndBroadcast(); // İlk isteği yap
    setInterval(fetchApiAndBroadcast, 60000); // Her 1 dakikada bir tekrar et
  }, timeToNextMinute);
}

// API'den veri al ve istemcilere gönder
function fetchApiAndBroadcast() {
  const apiUrl = "https://metro-services-a80377f65047.herokuapp.com/services"; // API URL'nizi buraya ekleyin

  fetch(apiUrl, { cache: 'no-store' }) // Veriyi her zaman taze almak için cache: 'no-store'
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      console.log('API fetched at minute 00.', data);

      // Tüm istemcilere veriyi gönder
      self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'data-from-service-worker',
            data: data,
          });
        });
      });
    })
    .catch(error => {
      console.error('Error fetching data:', error);

      // Hata durumunda istemcilere bilgi gönder
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

// Mesaj dinleme
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'fetch-api') {
    const apiUrl = event.data.apiUrl;

    fetch(apiUrl, { cache: 'no-store' }) // Elle API çağrısı için de cache: 'no-store'
      .then(response => response.json())
      .then(data => {
        console.log('API fetched manually.');

        self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'data-from-service-worker',
              data: data,
            });
          });
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
