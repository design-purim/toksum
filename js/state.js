// ===== 애플리케이션 상태 (State) =====
// 앱 전역에서 공유하는 단일 데이터 소스입니다.
// - folders: 폴더별 메뉴 정의 (메뉴 설정 단계에서 편집)
// - items:   현재 견적 목록에 담긴 항목들 (계산 로직 단계에서 조작)
// 저장/불러오기(LocalStorage·Firestore)는 이후 단계에서 이 구조를 직렬화합니다.

let seq = 0;
export function uid(prefix = "id") {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq}`;
}

// 기본 시드 = 빈 목록. 신규 사용자는 폴더/메뉴 0개에서 시작해
// "메뉴 관리"에서 직접 자기 메뉴를 등록합니다(데모 데이터 없음).
function seedFolders() {
  return [];
}

// ===== 저장 (LocalStorage) — 메뉴 설정(폴더/메뉴)만 =====
// 견적 목록(items)은 저장하지 않음(작업용 임시 데이터).
// v2: 데모 시드 제거 시점에 키를 올려, 기존 브라우저에 남은 옛 시드를 자동 무시.
const STORAGE_KEY = "coverCalc.folders.v2";

function loadFolders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedFolders(); // 저장된 게 없으면 빈 목록
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seedFolders();
    return parsed; // 빈 배열도 그대로 존중(사용자가 다 지운 상태)
  } catch {
    return seedFolders(); // 파싱 실패 등은 빈 목록으로 복구
  }
}

export function saveFolders() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.folders));
  } catch {
    /* 저장 실패(용량 초과·프라이빗 모드 등)는 조용히 무시 */
  }
}

export const state = {
  folders: loadFolders(),
  // 견적 목록 항목: { id, name, amount, type: 'menu'|'direct'|'discount', selected }
  items: [],
  user: null, // 로그인 사용자 (Firebase 단계에서 채움)
};

// ===== 간단한 구독(Subscribe) 시스템 =====
// 상태가 바뀌면 등록된 리스너(주로 UI 렌더러)를 호출해 화면을 갱신합니다.
const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify() {
  listeners.forEach((fn) => fn(state));
}

// ===== 계정 액션 =====
// 로그인/로그아웃 시 Firebase Auth(auth.js)가 호출 → 화면(헤더 아바타 등) 자동 갱신.
export function setUser(user) {
  state.user = user; // { uid, name, email, photo } 또는 null
  notify();
}

// 폴더 전체 교체 — 로그인 시 클라우드(Firestore) 데이터로 메뉴 설정을 갈아끼울 때 사용.
export function replaceFolders(folders) {
  if (!Array.isArray(folders)) return;
  state.folders = folders;
  notify();
}

// ===== 폴더 액션 =====
export function addFolder(name) {
  // collapsed: 메인 화면에서 이 폴더를 접은 채로 시작할지(기본 열림 = false)
  state.folders.push({ id: uid("folder"), name: (name || "").trim() || "새 폴더", menus: [], collapsed: false });
  notify();
}

// 폴더의 "기본 접힘" 설정 변경 (메뉴 설정에서 토글). 메인 화면 시작 상태를 정함.
export function setFolderCollapsed(folderId, collapsed) {
  const folder = state.folders.find((f) => f.id === folderId);
  if (!folder) return;
  folder.collapsed = !!collapsed;
  notify();
}

export function renameFolder(folderId, name) {
  const folder = state.folders.find((f) => f.id === folderId);
  if (!folder) return;
  folder.name = (name || "").trim() || folder.name;
  notify();
}

export function deleteFolder(folderId) {
  const idx = state.folders.findIndex((f) => f.id === folderId);
  if (idx === -1) return;
  state.folders.splice(idx, 1);
  notify();
}

// ===== 메뉴 액션 =====
export function addMenu(folderId, name, price) {
  const folder = state.folders.find((f) => f.id === folderId);
  if (!folder) return;
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  folder.menus.push({ id: uid("menu"), name: trimmed, price: Number(price) || 0 });
  notify();
}

export function updateMenu(folderId, menuId, { name, price }) {
  const folder = state.folders.find((f) => f.id === folderId);
  if (!folder) return;
  const menu = folder.menus.find((m) => m.id === menuId);
  if (!menu) return;
  if (name !== undefined) {
    const trimmed = name.trim();
    if (trimmed) menu.name = trimmed;
  }
  if (price !== undefined) menu.price = Number(price) || 0;
  notify();
}

// 메뉴 즐겨찾기 토글 (메뉴 설정의 별 아이콘). menu.fav 플래그는 folders에 얹혀
// 기존 LocalStorage·Firestore 저장/동기화에 그대로 함께 저장됩니다.
export function toggleMenuFav(folderId, menuId) {
  const folder = state.folders.find((f) => f.id === folderId);
  if (!folder) return;
  const menu = folder.menus.find((m) => m.id === menuId);
  if (!menu) return;
  menu.fav = !menu.fav;
  notify();
}

// 즐겨찾기로 지정된 메뉴 목록 (폴더 순서 → 메뉴 순서 유지).
// 메인 화면 최상단의 가상 "즐겨찾기" 폴더에서 사용.
export function favMenus() {
  const out = [];
  for (const folder of state.folders) {
    for (const menu of folder.menus) {
      if (menu.fav) out.push(menu);
    }
  }
  return out;
}

export function deleteMenu(folderId, menuId) {
  const folder = state.folders.find((f) => f.id === folderId);
  if (!folder) return;
  const idx = folder.menus.findIndex((m) => m.id === menuId);
  if (idx === -1) return;
  folder.menus.splice(idx, 1);
  notify();
}

// ===== 정렬 액션 (드래그) =====
// 폴더 순서 변경
export function reorderFolders(fromIndex, toIndex) {
  if (fromIndex === toIndex) return;
  const [moved] = state.folders.splice(fromIndex, 1);
  if (!moved) return;
  state.folders.splice(toIndex, 0, moved);
  notify();
}

// 메뉴 순서 변경 (같은 폴더 내부 또는 다른 폴더로 이동)
export function moveMenu(fromFolderId, toFolderId, fromIndex, toIndex) {
  const from = state.folders.find((f) => f.id === fromFolderId);
  const to = state.folders.find((f) => f.id === toFolderId);
  if (!from || !to) return;
  const [moved] = from.menus.splice(fromIndex, 1);
  if (!moved) return;
  to.menus.splice(toIndex, 0, moved);
  notify();
}

// ===== 견적 목록(items) 액션 =====
// 실행취소용 히스토리: items를 바꾸기 "직전" 상태를 스냅샷으로 쌓아둡니다.
const history = [];
const MAX_HISTORY = 50;

function snapshot() {
  history.push(JSON.stringify(state.items));
  if (history.length > MAX_HISTORY) history.shift();
}

export function canUndo() {
  return history.length > 0;
}

// 마지막 변경을 되돌립니다(추가/개수/삭제/비우기 공통).
export function undo() {
  if (history.length === 0) return;
  state.items = JSON.parse(history.pop());
  notify();
}

// 항목 하나를 목록에 추가합니다. 목록에 있는 항목은 모두 합계·복사에 포함됩니다.
// amount는 "단가", qty는 "개수" → 줄 금액 = amount × qty.
export function addItem({ name, amount, memo = "", type = "menu", menuId = null }) {
  snapshot();
  state.items.push({
    id: uid("item"),
    name: (name || "").trim() || "항목",
    amount: Number(amount) || 0,
    qty: 1,
    memo: (memo || "").trim(),
    type,
    menuId, // 메뉴칩에서 온 항목만 값이 있음(같은 메뉴 재추가 시 개수 합치기 기준)
  });
  notify();
}

// 메뉴 버튼(칩) 클릭 → 목록에 추가. 이미 같은 메뉴가 있으면 새 줄 대신 개수 +1.
export function addMenuItem(menuId) {
  for (const folder of state.folders) {
    const menu = folder.menus.find((m) => m.id === menuId);
    if (!menu) continue;
    const existing = state.items.find((it) => it.menuId === menuId);
    if (existing) {
      snapshot();
      existing.qty += 1;
      notify();
      return;
    }
    return addItem({ name: menu.name, amount: menu.price, type: "menu", menuId });
  }
}

// 항목 개수 조절 (+1 / −1). 최소 1까지만(0 이하로는 안 내려감 — 삭제는 X 버튼).
export function changeItemQty(itemId, delta) {
  const item = state.items.find((it) => it.id === itemId);
  if (!item) return;
  const next = Math.max(1, (item.qty || 1) + delta);
  if (next === item.qty) return;
  snapshot();
  item.qty = next;
  notify();
}

// 항목 개수 직접 지정(입력칸). 정수·최소 1로 정규화(빈값/0/음수/소수는 1로).
export function setItemQty(itemId, qty) {
  const item = state.items.find((it) => it.id === itemId);
  if (!item) return;
  const next = Math.max(1, Math.floor(Number(qty) || 1));
  if (next === item.qty) return;
  snapshot();
  item.qty = next;
  notify();
}

// 항목 삭제
export function removeItem(itemId) {
  const idx = state.items.findIndex((it) => it.id === itemId);
  if (idx === -1) return;
  snapshot();
  state.items.splice(idx, 1);
  notify();
}

// 목록 전체 비우기(실행취소로 복구 가능)
export function clearItems() {
  if (state.items.length === 0) return;
  snapshot();
  state.items = [];
  notify();
}

// ===== 파생 계산 =====
// 합계 = 목록의 모든 항목(단가 × 개수). 체크 개념 없음(있으면 다 포함).
export function grandTotal() {
  return state.items.reduce((sum, it) => sum + it.amount * (it.qty || 1), 0);
}
