// ===== 인증 (Firebase Auth · Google 로그인) =====
// 설계: 로그인은 "선택" (SPEC). 비회원도 즉시 사용, 로그인하면 계정에 연결.
//  - 계정 버튼(헤더 👤) → 이 모듈의 바텀시트(overlay.js 재사용, 토스 톤)
//  - 로그인 전: Google 로그인 버튼 + 안내
//  - 로그인 후: 프로필(아바타/이름/이메일) + 로그아웃
//
// Firebase JS SDK는 gstatic CDN(ESM)에서 "동적 import"로 불러옵니다.
//  - ⚠️ §1의 "가능하면 자체호스팅" 원칙의 예외: 로그인은 본질적으로 온라인 기능이고,
//    Auth SDK는 자체호스팅이 비현실적이라 CDN을 씁니다(무료·Apache-2.0). — 한 줄 고지.
//  - config가 placeholder면 SDK를 아예 로드하지 않음 → 불필요한 네트워크/오류 없음.

import { setUser, replaceFolders, state } from "../state.js";
import { icon } from "../icons.js";
import { openOverlay, closeOverlay } from "./overlay.js";
import { showToast } from "./toast.js";
import { firebaseConfig, isFirebaseConfigured } from "../firebase-config.js";
import { loadUserFolders, saveUserFolders, enableFolderSync, disableFolderSync } from "./cloud.js";

const SDK = "https://www.gstatic.com/firebasejs/11.1.0";

// 로드된 Firebase 핸들(초기화 후 채워짐). null이면 아직 미초기화.
let fb = null;

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Google 공식 "G" 로고(멀티컬러). 브랜드 가이드라인상 소셜 로그인 버튼엔 원본 로고 사용이 표준이라
// currentColor 단색 아이콘 세트(icons.js)와 분리해 여기에 인라인합니다.
const GOOGLE_LOGO = `
  <svg class="google-logo" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>`;

// ===== 초기화 =====
// 앱 시작 시 1회 호출. config가 있으면 Firebase를 로드하고 로그인 세션을 복원(자동 로그인 유지).
export async function initAuth() {
  if (!isFirebaseConfigured()) return; // 설정 전이면 아무것도 하지 않음
  try {
    const [appMod, authMod] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
    ]);
    const app = appMod.initializeApp(firebaseConfig);
    const auth = authMod.getAuth(app);
    fb = { auth, ...authMod };
    // 로그인/로그아웃·재방문 세션 복원 → 상태에 반영(헤더 아바타 등 자동 갱신)
    fb.onAuthStateChanged(auth, async (user) => {
      if (!user) {
        disableFolderSync(); // 로그아웃: 자동 저장 잠금
        return void setUser(null);
      }
      // ⚠️ 클라우드 로드가 끝나기 전엔 저장을 잠근다. setUser의 notify가 로컬(빈/오래된)
      //    폴더를 클라우드에 덮어쓰는 것을 막기 위함(데이터 소실 방지).
      disableFolderSync();
      setUser(toProfile(user));
      await syncOnLogin(user.uid); // 로그인 시 클라우드 메뉴 설정 동기화
    });
  } catch (e) {
    console.error("[auth] Firebase 초기화 실패", e);
  }
}

// 로그인 직후 동기화 — 클라우드에 데이터가 있으면 그걸로 반영(다른 기기 데이터 따라옴),
// 비어있으면(첫 로그인) 지금 이 기기의 메뉴 설정을 클라우드에 업로드.
async function syncOnLogin(uid) {
  try {
    const cloud = await loadUserFolders(uid);
    if (cloud && cloud.length) {
      replaceFolders(cloud); // 클라우드에 데이터가 있으면 그걸로 반영(다른 기기 데이터 따라옴)
    } else {
      // cloud === null 은 "문서 없음"(첫 로그인)일 때만 옴 — 일시적 오류는 아래 catch로 감.
      // 이 기기의 메뉴 설정을 클라우드에 최초 업로드.
      await saveUserFolders(uid, state.folders);
    }
    // ✅ 여기까지 왔으면 클라우드와 상태가 일치 → 이제부터 자동 저장 허용.
    enableFolderSync(state.folders);
  } catch (e) {
    // 로드/초기 업로드 실패: 클라우드 상태를 모르므로 이 세션엔 저장하지 않는다(덮어쓰기 사고 방지).
    disableFolderSync();
    console.error("[cloud] 로그인 동기화 실패", e);
    showToast("클라우드 동기화에 실패했어요. 이 기기의 변경은 저장되지 않아요.");
  }
}

// Firebase user → 우리가 쓰는 최소 프로필 형태
function toProfile(user) {
  return {
    uid: user.uid,
    name: user.displayName || "",
    email: user.email || "",
    photo: user.photoURL || "",
  };
}

// ===== 로그인 / 로그아웃 =====
async function signIn() {
  if (!isFirebaseConfigured()) {
    showToast("로그인 설정이 아직 안 됐어요");
    return;
  }
  try {
    if (!fb) await initAuth();
    const provider = new fb.GoogleAuthProvider();
    await fb.signInWithPopup(fb.auth, provider);
    closeOverlay();
    showToast("로그인했어요");
  } catch (e) {
    // 사용자가 팝업을 닫은 경우는 오류로 취급하지 않음
    if (e?.code === "auth/popup-closed-by-user" || e?.code === "auth/cancelled-popup-request") return;
    console.error("[auth] 로그인 실패", e);
    showToast("로그인에 실패했어요");
  }
}

async function signOutUser() {
  if (!fb) return;
  try {
    await fb.signOut(fb.auth);
    closeOverlay();
    showToast("로그아웃했어요");
  } catch (e) {
    console.error("[auth] 로그아웃 실패", e);
  }
}

// ===== 계정 바텀시트 =====
// user: 현재 로그인 사용자 프로필(state.user) 또는 null
export function openAccountSheet(user) {
  const sheet = document.createElement("div");
  sheet.className = "sheet account-sheet";
  sheet.innerHTML = user ? signedInView(user) : signedOutView();

  sheet.addEventListener("click", (e) => {
    if (e.target.closest('[data-act="sign-in"]')) signIn();
    else if (e.target.closest('[data-act="sign-out"]')) signOutUser();
  });

  openOverlay(sheet);
}

function signedOutView() {
  return `
    <div class="sheet-handle"></div>
    <div class="account-intro">
      <div class="account-avatar account-avatar-lg is-empty">${icon("account", { size: 32 })}</div>
      <h3 class="sheet-title account-title">로그인</h3>
      <p class="account-desc">로그인하면 메뉴 설정을 기기 간에 이어서 쓸 수 있어요.</p>
    </div>
    <button class="btn-google" data-act="sign-in">
      ${GOOGLE_LOGO}<span>Google로 로그인</span>
    </button>
  `;
}

function signedInView(user) {
  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();
  const avatar = user.photo
    ? `<img class="account-avatar account-avatar-lg" src="${esc(user.photo)}" alt="" referrerpolicy="no-referrer" />`
    : `<div class="account-avatar account-avatar-lg">${esc(initial)}</div>`;
  return `
    <div class="sheet-handle"></div>
    <div class="account-intro">
      ${avatar}
      <h3 class="sheet-title account-title">${esc(user.name || "내 계정")}</h3>
      ${user.email ? `<p class="account-desc">${esc(user.email)}</p>` : ""}
    </div>
    <button class="btn-account-out" data-act="sign-out">${icon("logout", { size: 18 })}<span>로그아웃</span></button>
  `;
}
