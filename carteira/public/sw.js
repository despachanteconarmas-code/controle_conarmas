// Service worker da Carteira Conarmas.
// Objetivo: abrir o app (carteirinha e Modo Livro) mesmo sem sinal no
// estande. Os dados do filiado ficam no localStorage do próprio app; aqui
// só se guarda o "casco" (HTML, JS, CSS, imagens).
const CACHE = "carteira-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/brasao.jpg", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Supabase, Edge Functions e qualquer outra origem: sempre rede, nunca cache
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Navegação: rede primeiro, cai para o index.html guardado se estiver offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html")),
    );
    return;
  }

  // Arquivos estáticos (têm hash no nome): cache primeiro
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
