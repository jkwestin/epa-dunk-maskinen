/* EPA-dunk maskinen service worker.
   Bump VERSION whenever index.html changes, so clients pick up the new build. */
var VERSION = "v1";
var SHELL_CACHE = "epa-dunk-shell-" + VERSION;
var RUNTIME_CACHE = "epa-dunk-runtime-" + VERSION;

var SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

/* Cross-origin things worth keeping: the typeface and the mp3 encoder.
   Both are fetched no-cors, so the cached responses are opaque — fine to
   replay, but never inspected. */
var RUNTIME_HOSTS = [
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
  "https://cdn.jsdelivr.net"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then(function(c){ return c.addAll(SHELL); })
      .then(function(){ return self.skipWaiting(); })
      .catch(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== SHELL_CACHE && k !== RUNTIME_CACHE) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function isRuntimeHost(url){
  for(var i=0;i<RUNTIME_HOSTS.length;i++){
    if(url.indexOf(RUNTIME_HOSTS[i]) === 0) return true;
  }
  return false;
}

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;

  var sameOrigin = req.url.indexOf(self.location.origin) === 0;

  /* Navigations: network first so a deploy shows up, shell as the offline
     fallback. */
  if(req.mode === "navigate"){
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(SHELL_CACHE).then(function(c){ c.put("./index.html", copy); });
        return res;
      }).catch(function(){
        return caches.match("./index.html").then(function(hit){
          return hit || Response.error();
        });
      })
    );
    return;
  }

  if(sameOrigin){
    /* Shell assets: cache first, they change only on a version bump. */
    e.respondWith(
      caches.match(req).then(function(hit){
        return hit || fetch(req).then(function(res){
          var copy = res.clone();
          caches.open(SHELL_CACHE).then(function(c){ c.put(req, copy); });
          return res;
        });
      })
    );
    return;
  }

  if(isRuntimeHost(req.url)){
    /* Fonts and the encoder: serve the cached copy at once, refresh behind it. */
    e.respondWith(
      caches.open(RUNTIME_CACHE).then(function(c){
        return c.match(req).then(function(hit){
          var net = fetch(req).then(function(res){
            c.put(req, res.clone());
            return res;
          }).catch(function(){ return hit; });
          return hit || net;
        });
      })
    );
  }
});
