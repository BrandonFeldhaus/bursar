/* Bursar service worker — generated into out/sw.js by scripts/build-sw.ts; edit the template, not the output.
 *
 * Install pre-caches every file of the static export. Requests are served from that cache first, so the
 * installed app opens offline. A new deploy installs a new cache and takes over once every window of the
 * app has closed (no skipWaiting: an open page never loses the chunks it was built with). */

const VERSION = "2caff2d7101e";
const FILES = ["404.html","_next/static/M3hVqMIEafHcaWTjdx6w6/_buildManifest.js","_next/static/M3hVqMIEafHcaWTjdx6w6/_ssgManifest.js","_next/static/chunks/405-644c6699a54ca511.js","_next/static/chunks/4bd1b696-73085844afb0e896.js","_next/static/chunks/517-a8d916cb3d01fd5c.js","_next/static/chunks/557-0443eb2c5a47119a.js","_next/static/chunks/62-8c343c1c63370d3d.js","_next/static/chunks/746-dec95f31ce24fa26.js","_next/static/chunks/834-cb89520e3cc9f57a.js","_next/static/chunks/app/_not-found/page-e347d5691909ba1b.js","_next/static/chunks/app/budget/page-25782d71083b0550.js","_next/static/chunks/app/expenses/page-c2d2304e820ebefd.js","_next/static/chunks/app/goals/page-37d8cac0cbaaf1ff.js","_next/static/chunks/app/income/page-127a6ef58825334e.js","_next/static/chunks/app/layout-908b46cfad06d768.js","_next/static/chunks/app/page-f7c1604c005ece12.js","_next/static/chunks/app/settings/page-80c83ae58b50e4b5.js","_next/static/chunks/framework-6c5b4831cfbd7aa9.js","_next/static/chunks/main-5410268e00637b64.js","_next/static/chunks/main-app-f0896804252ddd13.js","_next/static/chunks/pages/_app-d23763e3e6c904ff.js","_next/static/chunks/pages/_error-9b7125ad1a1e68fa.js","_next/static/chunks/polyfills-42372ed130431b0a.js","_next/static/chunks/webpack-68f22649503f8e75.js","_next/static/css/d38f4ce7f774b956.css","apple-icon.png","budget.html","budget.txt","expenses.html","expenses.txt","goals.html","goals.txt","icon.svg","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","income.html","income.txt","index.html","index.txt","manifest.webmanifest","settings.html","settings.txt"];

const CACHE = `bursar-${VERSION}`;
const FONTS = "bursar-fonts";
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
const BASE = new URL("./", self.location).pathname; // "/" or "/bursar/"

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => new Request(BASE + f, { cache: "reload" })))),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** The exported file behind a page URL: /bursar/ → index.html, /bursar/budget → budget.html. */
function pageFile(pathname) {
  const rel = pathname.slice(BASE.length).replace(/\/$/, "");
  if (rel === "") return "index.html";
  return /\.[a-z0-9]+$/i.test(rel) ? rel : `${rel}.html`;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(fromCacheThenNetwork(FONTS, req, req, { store: true }));
    return;
  }
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  const key = req.mode === "navigate" ? BASE + pageFile(url.pathname) : url.pathname;
  event.respondWith(
    fromCacheThenNetwork(CACHE, key, req, { ignoreSearch: true }).catch(async (err) => {
      // Offline on a URL we don't have: open the Overview rather than an error page.
      const home = req.mode === "navigate" && (await caches.match(BASE + "index.html"));
      if (home) return home;
      throw err;
    }),
  );
});

/** Cached copy if there is one, else the network. App files ignore the query (Next adds ?_rsc= to
 *  prefetches); fonts keep it (the stylesheet URL names the families) and are stored on first use. */
async function fromCacheThenNetwork(cacheName, key, req, { ignoreSearch = false, store = false }) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(key, { ignoreSearch });
  if (hit) return hit;
  const res = await fetch(req);
  if (store && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
  return res;
}
