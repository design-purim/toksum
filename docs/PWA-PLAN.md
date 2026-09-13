# PWA 설치 셸 작업 계획 (v0.17) — 안드로이드 폰에 앱으로 설치

> 목표: **스토어 출시 없이**, 톡셈을 안드로이드 폰에 "진짜 앱"으로 설치한다.
> 결정(2026-09-14, 사용자): 스토어(TWA/Play Console) 안 함 → **설치형 PWA만**.
> **진행 상태(2026-09-14): Stage 0~5(배포) 완료 · 남은 건 Stage 6(실기기 확인)뿐.**
> 라이브에서 서비스워커 등록·활성화 확인, 프리캐시 23/23, 폰트캐시 7개, **실제 SW로 업데이트 함정 방어까지 검증**. 상세는 CHANGELOG v0.17.

---

## 0. 무엇을 만들고 무엇을 안 만드나

**만드는 것** — 새 파일 3종 + 아이콘. **기존 JS 3,142줄은 건드리지 않는다**(main.js에 SW 등록 몇 줄 제외).

| 파일 | 역할 |
|---|---|
| `manifest.json` | 앱 이름·아이콘·전체화면·테마색·스플래시 |
| `sw.js` | 서비스워커 — **WebAPK 승격**의 조건 + 오프라인 |
| `assets/icon-*.png` | 192 / 512 / maskable |

**안 하는 것 (스토어를 뺐으므로 전부 불필요)**
- ❌ Play Console $25 · 테스터 12명 × 14일
- ❌ `.well-known/assetlinks.json` · `.nojekyll`
- ❌ Bubblewrap/PWABuilder · AAB · 서명 키
- ❌ 개인정보처리방침 (← **스토어 조건으로는** 불필요. 단 HANDOFF §12대로 구글 로그인 때문에 법적으로는 여전히 필요 → TODO에 별건으로 남김)

**왜 "홈 화면에 추가"로는 부족한가**
manifest+SW 없이 추가하면 **크롬 탭을 여는 북마크 바로가기**가 생긴다(주소창 있음). 조건을 갖추면 안드로이드가 **WebAPK**를 생성 → 앱 서랍 등록·주소창 없음·최근앱 독립 카드·오프라인. 사용자 눈엔 스토어 앱과 구분 안 됨.

---

## 1. 사전 확인 완료 (2026-09-14)

- ✅ **아이콘 PNG 생성 경로 확보** — 이 맥엔 node/npx·ImageMagick·rsvg가 **없다**. 대신 macOS 기본 `sips`로 SVG→PNG 변환 성공(512×512 RGBA, 렌더 정상 확인). `qlmanage`도 동작. **추가 설치 불필요.**
- ✅ 현재 `index.html`에 `theme-color #0ca678`·viewport 이미 있음 → manifest와 값만 맞추면 됨.
- ✅ `page.js`가 `history.pushState`를 쓰므로 **안드로이드 시스템 뒤로가기가 그대로 동작**. 수정 불필요.
- ⚠️ **GitHub Pages 서브경로** — 라이브가 `design-purim.github.io/toksum/`이라 `start_url`·`scope`·SW 위치를 **`/toksum/` 기준**으로 잡아야 한다. 루트(`/`)로 쓰면 설치가 조용히 실패한다.
- ⚠️ **SW는 반드시 저장소 루트(`/toksum/sw.js`)** — 서비스워커는 자기 위치보다 상위를 제어할 수 없다. `js/` 안에 두면 앱 전체를 못 덮는다.
- ⚠️ **기존 아이콘 SVG는 maskable로 쓸 수 없다** — 지금 `toksum-icon-green.svg`는 모서리가 둥글고 **바깥이 투명**. maskable은 안드로이드가 자체 모양으로 잘라내므로 **꽉 찬 사각 배경 + 안전영역(중앙 80%) 안에 심볼**인 별도 버전이 필요. (DESIGN.md §5 락업 원리 준수)

---

## 2. 단계별 체크리스트

### ✅ Stage 0 — 준비 (완료)
- [ ] `cp css/style.css css/style.css.bak` · `cp js/main.js js/main.js.bak` (§8 관례, git 아님)
- [ ] no-store 서버 기동 `python3 nocache_server.py` → `http://localhost:8777/index.html` 정상 확인
- [ ] 현재 라이브 정상 확인 (변경 전 기준선)

### ✅ Stage 1 — 아이콘 PNG (완료)
- [ ] `sips`로 `toksum-icon-green.svg` → `assets/icon-192.png`, `assets/icon-512.png`
- [ ] **maskable 전용 SVG 신규 제작** — 모서리 라운드 제거하고 그린 배경 꽉 채움 + "T·" 심볼을 중앙 80% 안전영역으로 축소
- [ ] → `assets/icon-maskable-512.png`
- [ ] `assets/icon-180.png`(apple-touch, 아이폰에서 열 때 대비 — 비용 0이라 같이)
- [ ] **눈으로 확인**: 512 원본 + maskable을 원형/스퀘어클로 마스킹했을 때 심볼이 안 잘리는지 (임시 HTML로 확인, §8-1 로고 때와 같은 방식)

### ✅ Stage 2 — manifest.json (완료)
- [ ] 루트에 `manifest.json` 생성
  - `name` "톡셈" / `short_name` "톡셈"
  - `start_url` `"."`, `scope` `"."` (**서브경로 안전하게 상대경로로**)
  - `display` `"standalone"`, `orientation` `"portrait"`
  - `theme_color` `#0ca678`, `background_color` — **스플래시 배경이 됨**
  - `icons` 192·512·maskable(`purpose:"maskable"`), `id`, `lang:"ko"`
- [ ] `index.html`에 `<link rel="manifest" href="manifest.json">` + apple-touch PNG로 교체
- [ ] **검증(8777)**: 크롬 DevTools → Application → Manifest에 경고 0, "Installability" 통과
- [ ] 💡 **스플래시는 manifest가 자동 생성** — HANDOFF §8의 "톡! 터치 느낌은 모션(스플래시)으로" 항목이 여기서 공짜로 절반 해결됨

### ✅ Stage 3 — sw.js (완료) ⚠️ 가장 조심한 단계
> **§6 함정 1(모듈 캐시)의 강화판.** 캐시 우선으로 짜면 배포해도 폰에서 영원히 옛 버전이 돌고, 새 포트로 도망칠 수도 없어 **앱을 삭제해야** 빠져나온다.

- [ ] 루트에 `sw.js` 생성 — 전략을 **명시적으로** 분리
  - HTML · JS · CSS → **네트워크 우선** (온라인이면 항상 최신, 실패 시에만 캐시)
  - 폰트 · 아이콘 → **캐시 우선** (안 바뀜)
- [ ] `CACHE_VERSION` 상수 — 배포 시 숫자만 올리면 구버전 캐시 일괄 삭제(`activate`에서 정리)
- [ ] `skipWaiting` + `clients.claim` — 다음 실행에 바로 반영(네트워크 우선이라 버전 섞임 위험 낮음)
- [ ] **🔑 개발 탈출구: localhost에서는 SW를 등록하지 않는다** — `location.hostname`이 `design-purim.github.io`일 때만 등록. 8777 no-store 워크플로(§6)를 그대로 보존
- [ ] `main.js` 맨 끝에 등록 코드 (기존 로직과 분리, 실패해도 앱은 정상 동작)
- [ ] **검증(8777)**: SW 등록 안 됨을 확인(탈출구 동작) → 콘솔 에러 0

### ✅ Stage 4 — 폰트 오프라인 (완료 · **A안 확정**)
> 현재 유일한 외부 의존성 = Wanted Sans(jsdelivr CDN). 설치형 앱이 오프라인에서 시스템 폰트로 떨어지면 토스 톤이 무너진다.

- [x] **A안 확정(2026-09-14, 사용자 선택)**: SW가 CDN 폰트를 **런타임 캐시 우선**으로 저장. 첫 실행 후 오프라인 OK. 저장소 변화 0
- [ ] ~~B안~~ (기각): woff2 전부 `assets/fonts/`로 자체 호스팅(§1 원칙에 더 충실). 단 **한글 분할 서브셋이라 파일이 수십~수백 개** → 먼저 개수를 세보고 판단
- [x] **실측 결과**: 선언된 서브셋 **92개(합계 2.2MB)**, 그중 앱이 실제로 받는 건 **6~7개**. 사용자 다운로드량은 A·B 동일(브라우저가 필요한 서브셋만 받음) → B안은 저장소만 2.2MB 무거워질 뿐 → **A안**.

### 🔶 Stage 5 — 배포 완료 · 폰 설치만 남음
- [x] `git push` → Pages 빌드 완료(실측 ~25초, 커밋 `51cbb6c`)
- [x] **라이브 검증 완료** — 새 파일 7종 200·MIME 정상, 상대경로가 `/toksum/`으로 정확히 해석(start_url·scope·아이콘), **SW 등록·activated**(scope `/toksum/`), 프리캐시 23/23, 폰트캐시 7개(CSS1+woff2 6 — 실측 예상과 일치), 콘솔 에러 0
- [x] **업데이트 함정 방어 검증(실제 SW)** — 캐시에 옛 버전을 심어도 최신 코드 반환 + 캐시 자동 복구
- [ ] ⬇️ **여기부터 사용자가 폰에서 할 일**
- [ ] 안드로이드 크롬에서 라이브 접속 → **"앱 설치"** 배너/메뉴 확인
- [ ] 설치 → 앱 서랍에 아이콘 / 주소창 없음 / 최근앱 독립 카드 확인
- [ ] 스플래시 확인
- [ ] 비행기모드 → 실행되는지(오프라인) 확인

### Stage 6 — 실기기 검증 & 대응 ⚠️ 여기서 나올 문제들
- [ ] **구글 로그인** — `auth.js:107` `signInWithPopup`이 standalone에서 크롬 커스텀탭으로 뜬다. **설치 후 제일 먼저 눌러볼 것.**
  - 실패 시: `signInWithRedirect` 교체가 정석이지만 ⚠️ **§10 저장 게이트(`enableFolderSync` 해제 타이밍)를 다시 검증해야 하는 영역** = 소실 사고 난 그 지점. **이번 작업에 끼워넣지 말고 별건으로 분리**
- [ ] **세이프에어리어** — 주소창이 사라지면서 하단바(합계 + 복사 CTA)가 제스처 바에 물리는지 **실기기에서 확인**. 물리면 `env(safe-area-inset-bottom)` 적용
  - 대상 3곳: `.total-bar`(sticky bottom) · `.overlay-panel`(바텀시트) · `.toast`(`--footer-h` 기준이라 연동)
- [ ] 바텀시트 · 메뉴 설정 풀페이지 · 뒤로가기 동작 확인
- [ ] 복사(`navigator.clipboard`) 동작 확인 — 이 앱의 최종 목적
- [ ] **업데이트 확인** — 사소한 수정 후 push → 폰 앱 재실행 시 반영되는지. **Stage 3 전략이 맞는지 판정하는 진짜 시험**

### Stage 7 — 문서 (프로젝트 관례)
- [ ] `CHANGELOG.md` v0.17 항목
- [ ] `TODO.md` "PWA 설치 셸" 체크
- [ ] `HANDOFF.md` 최종 갱신 줄 + §8 다음 할 일 + §10에 결정 추가
  - "SW는 네트워크 우선 + localhost 미등록" ← 되돌리면 §6 함정 재발
  - "maskable은 별도 풀블리드 아이콘" ← 둥근 SVG 재사용 금지

---

## 3. 되돌리기

전부 **새 파일 추가**라 롤백이 쉽다. 단 **서비스워커만 예외** — 한 번 등록되면 파일을 지워도 폰에 남는다.
- 철회하려면: `sw.js`를 "자기 자신을 `unregister()`하고 캐시를 전부 지우는 빈 SW"로 교체해 배포(파일 삭제 ❌ — 404는 기존 SW를 해제하지 못한다).
- 기타: `manifest.json`·아이콘·`index.html` 한 줄 → 그냥 삭제.

## 4. 이후로 남는 것

이 작업을 해두면 나중에 마음이 바뀌어 **스토어에 낼 때 여기서 껍데기 한 겹만 얹으면 된다**(assetlinks + Bubblewrap). 버려지는 작업 없음.
