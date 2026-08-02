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

// 백업 스냅샷(foldersPrev) 불러오기 — 사고 복구용(saveUserFolders가 보존한 직전 정상본).
export async function loadUserFoldersPrev(uid) {
  await ensureDb();
  const snap = await fs.getDoc(fs.doc(db, "users", uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return Array.isArray(data.foldersPrev) ? data.foldersPrev : null;
}

// 사용자 폴더를 클라우드에 저장.
// ⚠️ 방어 심화: 덮어쓰기 "직전"의 folders를 `foldersPrev` 스냅샷으로 보존한다.
//   → 어떤 덮어쓰기(사고든 정상 삭제든)든 클라우드 문서 자체에서 1단계 복구 가능
//     (Firestore PITR·유료플랜 불필요). 복구: 콘솔에서 foldersPrev를 folders로 복사.
//   - 트랜잭션으로 read→write를 원자적으로: 기기 간 경쟁에서도 스냅샷이 어긋나지 않음.
//   - 직전 folders가 "비어있지 않을 때만" 스냅샷을 갱신 → 연속 빈 저장에도 마지막 정상본 유지
//     (merge:true라 이번에 안 건드리면 기존 foldersPrev가 그대로 남음).
export async function saveUserFolders(uid, folders) {
  await ensureDb();
  const ref = fs.doc(db, "users", uid);
  await fs.runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists() ? snap.data() : null;
    const payload = { folders, updatedAt: fs.serverTimestamp() };
    if (prev && Array.isArray(prev.folders) && prev.folders.length > 0) {
      payload.foldersPrev = prev.folders; // 직전 정상본을 백업으로 보존
      payload.foldersPrevAt = prev.updatedAt || null;
    }
    tx.set(ref, payload, { merge: true });
  });
}

// ===== 로그인 사용자 폴더 자동 저장 (게이트 + 디바운스) =====
// ⚠️ 데이터 소실 방지의 핵심: 초기 클라우드 로드가 "성공적으로" 끝나기 전에는
//    어떤 자동 저장도 막는다. 로그인 직후엔 이 기기의 로컬 폴더가 (다른 기기에서
//    편집됐거나·키 상향·시크릿모드 등으로) 비었거나 오래됐을 수 있는데, 그 상태가
//    setDoc(통째 덮어쓰기)으로 클라우드를 지워버리는 사고가 있었다.
//  - enableFolderSync: syncOnLogin이 클라우드를 반영(또는 첫 업로드)에 성공한 뒤에만 호출 → 저장 허용
//  - disableFolderSync: 로그아웃·로드 실패 시 → 저장 잠금(클라우드 상태를 모르므로 이 세션엔 안 씀)
//  - queueFolderSave: 허용된 상태에서만, folders가 실제로 바뀐 경우 800ms 디바운스로 저장
let syncEnabled = false;
let baselineJson = null; // 마지막으로 클라우드와 일치한다고 아는 folders JSON(불필요한 재저장 방지)
let saveTimer = null;

// 초기 로드/첫 업로드 성공 후 호출: 지금 folders를 기준선으로 잡고 저장을 허용.
export function enableFolderSync(folders) {
  baselineJson = JSON.stringify(folders);
  syncEnabled = true;
}

// 로그아웃/로드 실패 시: 저장을 잠그고 대기 중인 저장 타이머를 취소.
export function disableFolderSync() {
  syncEnabled = false;
  baselineJson = null;
  clearTimeout(saveTimer);
  saveTimer = null;
}

// folders가 실제로 바뀐 경우에만 디바운스 저장. 게이트가 닫혀 있으면 아무것도 안 함.
export function queueFolderSave(uid, folders) {
  if (!syncEnabled || !uid) return;
  const json = JSON.stringify(folders);
  if (json === baselineJson) return; // 폴더 변화 없음(예: items만 바뀜) → 스킵
  baselineJson = json;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveUserFolders(uid, folders).catch((e) => console.error("[cloud] 폴더 저장 실패", e));
  }, 800);
}
