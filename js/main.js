// ===== 앱 진입점 (Entry Point) =====
// 상태(state)와 뷰(ui)를 연결하고, 사용자 입력(클릭)을 각 기능으로 라우팅합니다.
// 계산 로직·실행취소·저장 등은 이후 단계에서 이 라우터에 케이스를 추가합니다.

import {
  state,
  subscribe,
  addItem,
  addMenuItem,
  removeItem,
  changeItemQty,
  setItemQty,
  clearItems,
  undo,
  quoteTotal,
  saveFolders,
  replaceFolders,
} from "./state.js";
import { mountApp, render, toggleFolder } from "./ui.js";
import { openMenuSettings } from "./modules/menuSettings.js";
import { showToast } from "./modules/toast.js";
import { initAuth, openAccountSheet } from "./modules/auth.js";
import { queueFolderSave, loadUserFoldersPrev } from "./modules/cloud.js";
import { attachAmountFormatting, parseAmount, formatWonOrFree } from "./format.js";

const wonFmt = (n) => `${Number(n).toLocaleString("ko-KR")}원`;

const root = document.getElementById("app");

function init() {
  mountApp(root);
  render(root);

  // 상태가 바뀌면: 메뉴 설정(폴더) 저장 + 화면 갱신
  // (items 변경 시에도 폴더를 다시 저장하지만 동일 데이터라 부담 없음)
  subscribe(() => {
    saveFolders(); // LocalStorage는 회원/비회원 공통으로 항상 저장(오프라인 대비)
    render(root);
    // 회원이면 폴더 변경분을 Firestore에도 저장(디바운스). 단, 로그인 직후 클라우드 로드가
    // 성공적으로 끝나기 전(또는 실패 세션)에는 cloud.js의 게이트가 저장을 막는다(소실 방지).
    if (state.user) queueFolderSave(state.user.uid, state.folders);
  });

  // 금액 인풋: 입력 즉시 천단위 콤마 + 맨 앞 0 제거
  attachAmountFormatting(root.querySelector('[data-input="amount"]'));

  // 클릭 이벤트를 한곳에서 위임 처리
  root.addEventListener("click", onClick);

  // 개수 직접 입력: 입력칸에서 포커스가 빠질 때(change) 개수 반영. 최소 1로 정규화.
  root.addEventListener("change", (e) => {
    const input = e.target.closest('[data-action="qty-input"]');
    if (!input) return;
    const id = e.target.closest(".list-item")?.dataset.itemId;
    if (id) setItemQty(id, input.value);
  });
  // 개수 입력칸에서 Enter → 커밋(블러)
  root.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.closest('[data-action="qty-input"]')) {
      e.preventDefault();
      e.target.blur();
    }
  });

  // 헤더: 스크롤 시에만 하단 hairline 표시 (토스·iOS 패턴)
  const header = root.querySelector(".app-header");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 24);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Firebase 로그인 초기화(설정돼 있으면 세션 복원 → 헤더 아바타 자동 표시)
  initAuth();
}

function onClick(e) {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;

  switch (action) {
    case "open-menu":
      openMenuSettings();
      break;
    case "toggle-folder":
      // UI 전용 토글(상태 변경 아님) → 직접 재렌더
      toggleFolder(el.dataset.folderId);
      render(root);
      break;
    case "add-menu":
      // 메뉴 칩 클릭 → 목록에 추가
      addMenuItem(el.dataset.menuId);
      break;
    case "add-direct":
      // 직접입력(금액/메모) → 목록에 추가
      handleAddDirect();
      break;
    case "half":
      // 50% 추가 → 입력액의 절반을 목록에 추가
      handleHalf();
      break;
    case "discount":
      // 할인 → 입력액을 마이너스로 목록에 추가
      handleDiscount();
      break;
    case "copy":
      // 견적 복사 → 클립보드 + 토스트
      handleCopy();
      break;
    case "remove-item": {
      const id = el.closest(".list-item")?.dataset.itemId;
      if (id) removeItem(id);
      break;
    }
    case "qty-inc": {
      const id = el.closest(".list-item")?.dataset.itemId;
      if (id) changeItemQty(id, +1);
      break;
    }
    case "qty-dec": {
      const id = el.closest(".list-item")?.dataset.itemId;
      if (id) changeItemQty(id, -1);
      break;
    }
    case "undo":
      // 마지막 변경 되돌리기
      undo();
      break;
    case "clear":
      // 목록 비우기(실행취소로 복구 가능)
      handleClear();
      break;
    case "open-account":
      // 계정 바텀시트 (로그인/로그아웃)
      openAccountSheet(state.user);
      break;
    default:
      break;
  }
}

// 직접입력 영역의 금액/메모를 읽어옵니다.
function readDirectInput() {
  const amountEl = root.querySelector('[data-input="amount"]');
  const memoEl = root.querySelector('[data-input="memo"]');
  // 표시용 콤마를 제거하고 숫자로 변환
  return {
    amountEl,
    memoEl,
    amount: parseAmount(amountEl.value),
    memo: memoEl.value.trim(),
  };
}

function clearDirectInput(amountEl, memoEl) {
  amountEl.value = "";
  memoEl.value = "";
  amountEl.focus();
}

// +추가 → 입력액 그대로 목록에 추가
function handleAddDirect() {
  const { amountEl, memoEl, amount, memo } = readDirectInput();
  if (!amount) return void amountEl.focus();
  addItem({ name: memo || "직접입력", amount, type: "direct" });
  clearDirectInput(amountEl, memoEl);
}

// 50% 추가 → 입력액의 절반(반올림)을 목록에 추가
function handleHalf() {
  const { amountEl, memoEl, amount, memo } = readDirectInput();
  if (!amount) return void amountEl.focus();
  addItem({ name: memo || "50%", amount: Math.round(amount * 0.5), type: "half" });
  clearDirectInput(amountEl, memoEl);
}

// − 할인 → 입력액을 마이너스로 목록에 추가
function handleDiscount() {
  const { amountEl, memoEl, amount, memo } = readDirectInput();
  if (!amount) return void amountEl.focus();
  addItem({ name: memo || "할인", amount: -Math.abs(amount), type: "discount" });
  clearDirectInput(amountEl, memoEl);
}

// 복사 → 목록의 모든 항목 + 합계를 텍스트로 만들어 클립보드에 복사
async function handleCopy() {
  if (state.items.length === 0) return void showToast("복사할 항목이 없어요");

  const lines = state.items.map((it) => {
    const qty = it.qty || 1;
    const label = qty > 1 ? `${it.name} ×${qty}` : it.name;
    return `${label}  ${formatWonOrFree(it.amount * qty)}`;
  });
  const text = `${lines.join("\n")}\n\n합계  ${wonFmt(quoteTotal())}`;

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    fallbackCopy(text); // 클립보드 API 불가 시 폴백
  }
  showToast("견적을 복사했어요");
}

// 비우기 → 목록 전체 삭제 후 안내(↶로 복구 가능)
function handleClear() {
  if (state.items.length === 0) return;
  clearItems();
  showToast("목록을 비웠어요");
}

// navigator.clipboard를 못 쓰는 환경용 폴백(임시 textarea + execCommand)
function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {
    /* 무시 */
  }
  ta.remove();
}

init();

// 개발 편의: 콘솔에서 상태 확인용
window.__state = state;

// 사고 복구용(콘솔): 클라우드 백업 스냅샷(foldersPrev)을 현재 메뉴로 되돌린다.
// 로그인 상태에서 `await __restoreCloudPrev()` 실행 → 직전 정상본으로 복구되고 저장까지 이어짐.
window.__restoreCloudPrev = async () => {
  if (!state.user) return "로그인 후 사용하세요.";
  const prev = await loadUserFoldersPrev(state.user.uid);
  if (!prev || !prev.length) return "복구할 이전 스냅샷이 없어요.";
  replaceFolders(prev); // notify → 저장(게이트 열려있으면 클라우드도 이 값으로 갱신)
  showToast("이전 백업으로 복구했어요");
  return `이전 스냅샷 폴더 ${prev.length}개로 복구됨.`;
};
