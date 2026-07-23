// ===== 클라우드 동기화 (Firestore) =====
// 로그인 사용자의 메뉴 설정(폴더/메뉴)을 Firestore에 저장/복원합니다.
//  - 데이터 위치: users/{uid} 문서의 `folders` 필드
//  - 견적 목록(items)은 저장 안 함(임시 작업 데이터, 기존 결정 유지)
//  - Firestore SDK는 gstatic CDN(ESM) 동적 import — auth.js가 만든 Firebase 앱을 재사용
//
// 앱이 Firestore 없이도 안 깨지도록: 로드/저장 실패(미생성·권한·오프라인)는
// 호출부에서 catch해 LocalStorage로 자연 폴백합니다.

import { firebaseConfig } from "../firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/11.1.0";

let db = null; // Firestore 인스턴스(1회 초기화 후 재사용)
let fs = null; // firestore 모듈 함수 모음

// Firestore 준비 — auth.js가 이미 initializeApp 했으면 그 앱을 재사용(중복 init 방지).
async function ensureDb() {
  if (db) return db;
  const [appMod, fsMod] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  let app;
  try {
    app = appMod.getApp(); // auth.js가 만든 기본 앱
  } catch {
    app = appMod.initializeApp(firebaseConfig); // 혹시 아직이면 직접 초기화
  }
  fs = fsMod;
  db = fsMod.getFirestore(app);
  return db;
}

// 클라우드에서 사용자 폴더 불러오기. 문서가 없으면 null(첫 로그인 신호).
export async function loadUserFolders(uid) {
  await ensureDb();
  const snap = await fs.getDoc(fs.doc(db, "users", uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return Array.isArray(data.folders) ? data.folders : null;
}

// 사용자 폴더를 클라우드에 저장(문서 통째 덮어쓰기).
export async function saveUserFolders(uid, folders) {
  await ensureDb();
  await fs.setDoc(fs.doc(db, "users", uid), {
    folders,
    updatedAt: fs.serverTimestamp(),
  });
}
