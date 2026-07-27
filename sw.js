/* =====================================================================
   سجل البكش — عامل الخدمة (Service Worker)
   يجعل التطبيق يعمل بلا إنترنت: يخزّن ملفات التطبيق عند أول فتح،
   ثم يخزّن الخطوط ومكتبة PDF تلقائيًا بعد أول تحميل ناجح لها.

   عند رفع نسخة جديدة من التطبيق: غيّر رقم VERSION أدناه
   (مثلًا من v1 إلى v2) ليتخلص المتصفح من النسخة القديمة.
   ===================================================================== */

const VERSION = 'baksha-v4';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon.png'
];

// التثبيت: خزّن ملفات التطبيق الأساسية (ملف ناقص لا يُفشل الباقي)
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

// التفعيل: احذف النسخ القديمة من الذاكرة
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // فتح التطبيق: جرّب الشبكة أولًا لالتقاط أي تحديث، وإلا افتح النسخة المخزّنة
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html', {ignoreSearch: true}))
    );
    return;
  }

  // باقي الملفات (وضمنها الخطوط ومكتبة PDF): المخزَّن أولًا ثم الشبكة
  e.respondWith(
    caches.match(req, {ignoreSearch: true}).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        // خزّن أي رد ناجح، بما فيه ردود CDN المعتمة (opaque)
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
    })
  );
});
