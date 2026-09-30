/* Bursar service worker — generated into out/sw.js by scripts/build-sw.ts; edit the template, not the output.
 *
 * Install pre-caches every file of the static export. Requests are served from that cache first, so the
 * installed app opens offline. A new deploy installs a new cache and takes over once every window of the
 * app has closed (no skipWaiting: an open page never loses the chunks it was built with). */

const VERSION = "__VERSION__";
const FILES = __FILES__;

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
