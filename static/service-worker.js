// Installability basics only - no caching yet. A service worker (even a pass-through one)
// is required by several browsers' "add to home screen" criteria. Offline caching can be
// layered on later; skipped for now since getting cache invalidation wrong on a page that's
// mostly live chat/quest data is worse than no caching at all.

self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
	event.respondWith(fetch(event.request));
});
