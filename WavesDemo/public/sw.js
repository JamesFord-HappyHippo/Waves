// Waves Marine Navigation Service Worker
// Enables offline functionality critical for marine environments

const CACHE_NAME = 'waves-marine-v1.0.0';
const OFFLINE_URL = '/offline.html';

// Critical marine navigation assets that must be cached
const CRITICAL_MARINE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/assets/icon-192.png',
  '/assets/icon-512.png'
];

// Marine data that should be cached for offline navigation
const MARINE_DATA_PATTERNS = [
  '/api/depth-readings',
  '/api/weather-data',
  '/api/tide-data',
  '/api/emergency-contacts'
];

// Install event - cache critical marine navigation assets
self.addEventListener('install', (event) => {
  console.log('🌊 Waves Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching critical marine navigation assets');
        return cache.addAll(CRITICAL_MARINE_ASSETS);
      })
      .then(() => {
        console.log('✅ Critical marine assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Failed to cache critical assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 Waves Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle requests with marine-optimized caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle marine navigation requests
  if (request.method === 'GET') {
    // Critical marine data - cache first, then network
    if (isMarineDataRequest(url)) {
      event.respondWith(handleMarineDataRequest(request));
    }
    // Static assets - cache first
    else if (isStaticAsset(url)) {
      event.respondWith(handleStaticAssetRequest(request));
    }
    // API requests - network first with offline fallback
    else if (isAPIRequest(url)) {
      event.respondWith(handleAPIRequest(request));
    }
    // Navigation requests - handle offline navigation
    else if (isNavigationRequest(request)) {
      event.respondWith(handleNavigationRequest(request));
    }
  }
});

// Marine data request handler - prioritizes cached data for offline navigation
async function handleMarineDataRequest(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('📡 Serving cached marine data (offline capability)');
      // Try to update cache in background
      updateMarineDataInBackground(request, cache);
      return cachedResponse;
    }
    
    // No cached data - try network
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
    
  } catch (error) {
    console.error('🌊 Marine data request failed:', error);
    // Return cached emergency data if available
    return getEmergencyMarineData(request);
  }
}

// Static asset request handler
async function handleStaticAssetRequest(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
    
  } catch (error) {
    console.error('📦 Static asset request failed:', error);
    return new Response('Asset not available offline', { status: 404 });
  }
}

// API request handler - network first with offline fallback
async function handleAPIRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful API responses for offline use
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('📡 Network unavailable, checking cache for:', request.url);
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('📱 Serving cached API response (offline mode)');
      return cachedResponse;
    }
    
    // Return offline marine data if critical navigation request
    return getOfflineMarineResponse(request);
  }
}

// Navigation request handler - ensures offline navigation capability
async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.log('🗺️ Serving offline navigation');
    const cache = await caches.open(CACHE_NAME);
    const offlineResponse = await cache.match('/') || 
                           await cache.match(OFFLINE_URL);
    return offlineResponse;
  }
}

// Background marine data update
function updateMarineDataInBackground(request, cache) {
  fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
        console.log('🔄 Updated marine data cache in background');
      }
    })
    .catch((error) => {
      console.log('📡 Background update failed (offline mode)');
    });
}

// Emergency marine data fallback
function getEmergencyMarineData(request) {
  const url = new URL(request.url);
  
  if (url.pathname.includes('emergency')) {
    return new Response(JSON.stringify({
      emergency_contacts: [
        { name: 'Coast Guard', number: '911', coordinates: null },
        { name: 'Marine Emergency', number: '16', radio: true }
      ],
      offline_mode: true,
      message: 'Emergency contacts available offline'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({
    error: 'Marine data not available offline',
    offline_mode: true
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Offline marine response for critical navigation
function getOfflineMarineResponse(request) {
  const url = new URL(request.url);
  
  // Critical navigation endpoints
  if (url.pathname.includes('navigation') || url.pathname.includes('depth')) {
    return new Response(JSON.stringify({
      offline_mode: true,
      message: 'Limited navigation data available offline',
      emergency_only: true,
      cached_data: 'Available for last known position'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response('Service unavailable offline', { status: 503 });
}

// Helper functions
function isMarineDataRequest(url) {
  return MARINE_DATA_PATTERNS.some(pattern => url.pathname.includes(pattern.replace('/api', '')));
}

function isStaticAsset(url) {
  return /\.(js|css|png|jpg|jpeg|svg|woff|woff2|ttf|eot|ico)$/.test(url.pathname);
}

function isAPIRequest(url) {
  return url.pathname.startsWith('/api');
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && request.headers.get('accept').includes('text/html'));
}

// Background sync for marine data updates
self.addEventListener('sync', (event) => {
  if (event.tag === 'marine-data-sync') {
    console.log('🌊 Syncing marine data when connection restored');
    event.waitUntil(syncMarineData());
  }
});

async function syncMarineData() {
  try {
    const cache = await caches.open(CACHE_NAME);
    // Sync critical marine data when connection is restored
    const marineEndpoints = [
      '/api/depth-readings?recent=true',
      '/api/weather-data?current=true',
      '/api/emergency-contacts'
    ];
    
    for (const endpoint of marineEndpoints) {
      try {
        const response = await fetch(endpoint);
        if (response.ok) {
          await cache.put(endpoint, response.clone());
          console.log(`✅ Synced marine data: ${endpoint}`);
        }
      } catch (error) {
        console.log(`📡 Failed to sync: ${endpoint}`);
      }
    }
  } catch (error) {
    console.error('🌊 Marine data sync failed:', error);
  }
}

// Handle marine emergency events
self.addEventListener('message', (event) => {
  if (event.data.type === 'MARINE_EMERGENCY') {
    console.log('🚨 Marine emergency event received');
    handleMarineEmergency(event.data);
  } else if (event.data.type === 'CACHE_MARINE_POSITION') {
    console.log('📍 Caching current marine position');
    cacheCurrentPosition(event.data.position);
  }
});

function handleMarineEmergency(emergencyData) {
  // Cache emergency data for offline access
  caches.open(CACHE_NAME).then(cache => {
    const emergencyResponse = new Response(JSON.stringify({
      emergency_active: true,
      timestamp: Date.now(),
      position: emergencyData.position,
      emergency_type: emergencyData.type,
      contacts_notified: true
    }));
    
    cache.put('/api/emergency-status', emergencyResponse);
  });
}

function cacheCurrentPosition(position) {
  // Cache current position for emergency use
  caches.open(CACHE_NAME).then(cache => {
    const positionResponse = new Response(JSON.stringify({
      latitude: position.latitude,
      longitude: position.longitude,
      timestamp: Date.now(),
      accuracy: position.accuracy,
      cached_for_emergency: true
    }));
    
    cache.put('/api/current-position', positionResponse);
  });
}