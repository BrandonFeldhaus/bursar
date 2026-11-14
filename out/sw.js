/* Bursar service worker — generated into out/sw.js by scripts/build-sw.ts; edit the template, not the output.
 *
 * Install pre-caches every file of the static export. Requests are served from that cache first, so the
 * installed app opens offline. A new deploy installs a new cache and takes over once every window of the
 * app has closed (no skipWaiting: an open page never loses the chunks it was built with). */

const VERSION = "c38ec1a7e3b5";
const FILES = ["404.html","_next/static/chunks/283-49d1bcc9ebc75ae8.js","_next/static/chunks/29dfb9cd-640399cbfd20a73e.js","_next/static/chunks/430-836e6b21ef34f4b7.js","_next/static/chunks/556-0db80b947e27455a.js","_next/static/chunks/655-c38b1e100b08fee6.js","_next/static/chunks/664-5e543b8387f55649.js","_next/static/chunks/848-5897e8238edd2570.js","_next/static/chunks/app/_not-found/page-6f74ba8221b50fab.js","_next/static/chunks/app/budget/page-5ec359fd96a2b53d.js","_next/static/chunks/app/expenses/page-e7537ba702bd504c.js","_next/static/chunks/app/goals/page-d42063090fa2b846.js","_next/static/chunks/app/income/page-a7ad21b185fb0abb.js","_next/static/chunks/app/layout-44653cdca26f8304.js","_next/static/chunks/app/page-9ba5b711465c9121.js","_next/static/chunks/app/settings/page-de4976879e7b7c2f.js","_next/static/chunks/framework-6a968712528ec0c2.js","_next/static/chunks/main-app-ed7ca1cd86f4f7a5.js","_next/static/chunks/main-dffcf51da263d74d.js","_next/static/chunks/pages/_app-10fa80cef3acaaef.js","_next/static/chunks/pages/_error-bfbe954363265601.js","_next/static/chunks/polyfills-42372ed130431b0a.js","_next/static/chunks/webpack-b32f562a2a139e4e.js","_next/static/css/39fbe7ee94e0645d.css","_next/static/sRrnF51lm6-BipGMVwI_U/_buildManifest.js","_next/static/sRrnF51lm6-BipGMVwI_U/_ssgManifest.js","apple-icon.png","budget.html","budget.txt","expenses.html","expenses.txt","goals.html","goals.txt","icon.svg","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","income.html","income.txt","index.html","index.txt","manifest.webmanifest","settings.html","settings.txt"];

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
