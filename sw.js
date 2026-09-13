// ===== 서비스워커 (PWA 설치 셸 · v0.17) =====
//
// ⚠️⚠️ 이 파일은 HANDOFF §6 "함정 1(브라우저 모듈 캐시)"의 강화판이다.
//    캐시 우선(cache-first)으로 우리 코드를 저장하면 배포해도 폰에서 영원히 옛 버전이 돌고,
//    새 포트로 도망칠 수도 없어 **앱을 삭제해야** 빠져나온다.
//    → 그래서 전략을 둘로 명확히 갈라 둔다. 이 구분을 무너뜨리지 말 것.
//
//    · 우리 코드(HTML/JS/CSS/manifest) = 네트워크 우선. 온라인이면 항상 최신, 실패 시에만 캐시.
//    · 안 바뀌는 것(폰트/아이콘)        = 캐시 우선.
//
// 배포 때 할 일: 아래 VERSION 숫자만 올리면 구버전 앱 캐시가 activate에서 일괄 삭제된다.

const VERSION = "v0.17.0";

const APP_CACHE = `toksum-app-${VERSION}`; // 우리 코드 — 버전마다 새로
const FONT_CACHE = "toksum-font-v1";       // CDN 폰트 — URL에 버전이 박혀 있어 버전 무관 유지

// 앱 셸: 오프라인 첫 실행에 필요한 최소 집합.
// ⚠️ js/ 아래 모듈을 추가하면 여기도 추가할 것(빠지면 오프라인에서 그 모듈만 실패).
// ⚠️ js/vendor/Sortable.min.js는 아무데서도 import하지 않는 죽은 파일이라 제외.
const APP_SHELL = [
  "./",
  "index.html",
  "manifest.json",
  "favicon.svg",
  "css/style.css",
  "js/main.js",
  "js/state.js",
  "js/ui.js",
  "js/icons.js",
  "js/format.js",
  "js/firebase-config.js",
  "js/modules/overlay.js",
  "js/modules/page.js",
  "js/modules/menuSettings.js",
  "js/modules/toast.js",
  "js/modules/auth.js",
  "js/modules/cloud.js",
  "js/vendor/sortable.esm.js",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/icon-maskable-192.png",
  "assets/icon-maskable-512.png",
  "assets/icon-180.png",
];

const FONT_ORIGIN = "https://cdn.jsdelivr.net";   // Wanted Sans (분할 서브셋 92개 중 쓰는 것만 캐시됨)
const FIREBASE_ORIGIN = "https://www.gstatic.com"; // Firebase SDK — 로그인은 본질적으로 온라인, 캐시 안 함

// ===== install: 앱 셸 미리 담기 =====
self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      // 하나가 404여도 설치 전체가 실패하지 않도록 개별 처리(addAll은 all-or-nothing).
      await Promise.all(
        APP_SHELL.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch((err) =>
            console.warn("[sw] 프리캐시 실패:", url, err)
          )
        )
      );
      await self.skipWaiting(); // 다음 실행에 바로 반영(네트워크 우선이라 버전 섞임 위험 낮음)
    })()
  );
});

// ===== activate: 구버전 캐시 청소 =====
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keep = new Set([APP_CACHE, FONT_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

// ===== 전략 2종 =====
// ⚠️ 캐시 쓰기는 반드시 evt.waitUntil로 붙든다. 그냥 호출하면 SW가 먼저 종료될 때
//    쓰기가 유실돼 오프라인에 옛 파일이 남는다(fire-and-forget 금지).
async function networkFirst(req, evt) {
  const cache = await caches.open(APP_CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) evt.waitUntil(cache.put(req, res.clone()));
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    // 오프라인에서 주소 진입/새로고침 → 앱 셸로 되살림
    if (req.mode === "navigate") {
      const shell = (await cache.match("./")) || (await cache.match("index.html"));
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirst(req, cacheName, evt) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === "opaque")) evt.waitUntil(cache.put(req, res.clone()));
  return res;
}

// ===== fetch 라우팅 =====
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // 쓰기 요청(Firestore 등)은 건드리지 않는다

  const url = new URL(req.url);

  // 폰트 CDN → 캐시 우선(오프라인에서도 토스 톤 유지)
  if (url.origin === FONT_ORIGIN) return void e.respondWith(cacheFirst(req, FONT_CACHE, e));

  // Firebase SDK → 캐시하지 않음. 오프라인이면 로그인만 자연스럽게 실패하는 게 맞다.
  if (url.origin === FIREBASE_ORIGIN) return;

  // 우리 코드 → 네트워크 우선
  if (url.origin === self.location.origin) return void e.respondWith(networkFirst(req, e));

  // 그 외(Firestore API 등)는 그대로 통과
});
