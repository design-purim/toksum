// ===== 메인 UI 렌더링 (View) =====
// state를 받아 화면을 그립니다. 이 단계에서는 레이아웃/구조를 완성하고,
// 실제 동작(추가·계산·실행취소 등)은 이후 단계에서 이벤트 핸들러로 연결합니다.

import { state, grandTotal, canUndo } from "./state.js";
import { icon } from "./icons.js";
import { formatWonOrFree } from "./format.js";

const won = (n) => `${Number(n).toLocaleString("ko-KR")}원`;

// 브랜드 심볼 "T·" — 잉크 T(currentColor) + 초록 탭닷(--primary). 좌표는 로고 확정 스펙.
const brandSymbol = `<svg class="logo-sym" viewBox="20 22 60 64" aria-hidden="true"><rect class="ink" x="24" y="25" width="52" height="13" rx="6.5"/><rect class="ink" x="43.5" y="25" width="13" height="36" rx="6.5"/><circle class="dot" cx="50" cy="76" r="7.5"/></svg>`;
const brandLockup = `<span class="brand">${brandSymbol}<span class="brand-text">톡셈</span></span>`;

// 폴더 접힘 상태 (런타임 UI 상태 — 새로고침하면 각 폴더의 "기본값"에서 다시 시작)
const collapsedFolders = new Set();
// 각 폴더에 마지막으로 반영한 기본값(folder.collapsed). 기본값이 바뀌면 다시 반영한다.
const appliedDefault = new Map();

// 폴더별 "기본 접힘" 설정을 런타임 상태에 반영.
//  - 처음 보는 폴더(새로고침·신규·클라우드 로드): 기본값대로 시작
//  - 기본값이 설정에서 바뀌면: 그 폴더만 새 기본값으로 재적용
//  - 사용자가 메인에서 접었다 편 것(런타임 토글)은 기본값이 그대로면 유지
function syncCollapseDefaults() {
  for (const folder of state.folders) {
    const def = !!folder.collapsed;
    if (appliedDefault.get(folder.id) !== def) {
      appliedDefault.set(folder.id, def);
      if (def) collapsedFolders.add(folder.id);
      else collapsedFolders.delete(folder.id);
    }
  }
}

export function toggleFolder(id) {
  if (collapsedFolders.has(id)) collapsedFolders.delete(id);
  else collapsedFolders.add(id);
}

// 앱 전체 골격을 최초 1회 생성합니다.
export function mountApp(root) {
  root.innerHTML = `
    <header class="app-header">
      <span class="nav-title" aria-hidden="true">${brandLockup}</span>
      <button class="icon-btn account-btn" data-action="open-account" data-bind="account" aria-label="로그인 / 계정">${icon("account")}</button>
    </header>

    <main class="app-main">
      <h1 class="large-title">${brandLockup}</h1>
      <section class="direct-input" aria-label="직접입력">
        <div class="field-row">
          <input class="field" type="text" inputmode="numeric" pattern="[0-9,]*"
                 data-input="amount" placeholder="금액" autocomplete="off" />
          <input class="field" type="text" data-input="memo" placeholder="메모" />
        </div>
        <div class="action-row">
          <button class="btn btn-primary" data-action="add-direct">${icon("plus", { size: 18 })}<span>추가</span></button>
          <button class="btn btn-half" data-action="half"><span>50% 추가</span></button>
          <button class="btn btn-discount" data-action="discount">${icon("minus", { size: 18 })}<span>할인</span></button>
        </div>
      </section>

      <section class="menu-section" aria-label="메뉴">
        <div class="section-head">
          <h2 class="section-head-title">메뉴</h2>
          <button class="section-head-action icon-btn" data-action="open-menu" aria-label="메뉴 관리">${icon("settings", { size: 20 })}</button>
        </div>
        <div class="folders"></div>
      </section>

      <section class="list" aria-label="견적 목록"></section>
    </main>

    <footer class="total-bar">
      <div class="total-amount">
        <span class="total-label">합계</span>
        <span class="total-value" data-bind="total">0원</span>
      </div>
      <div class="total-actions">
        <button class="icon-btn" data-action="undo" aria-label="실행취소">${icon("undo", { size: 20 })}</button>
        <button class="icon-btn" data-action="clear" aria-label="비우기">${icon("trash", { size: 20 })}</button>
        <button class="btn-copy" data-action="copy">${icon("copy", { size: 18 })}<span>복사</span></button>
      </div>
    </footer>
  `;
}

// 데이터가 바뀔 때마다 폴더/목록/합계 영역을 다시 그립니다.
export function render(root) {
  renderFolders(root.querySelector(".folders"));
  renderList(root.querySelector(".list"));
  renderTotal(root.querySelector('[data-bind="total"]'));
  renderFooterActions(root);
  renderAccount(root.querySelector('[data-bind="account"]'));
}

// 헤더 계정 버튼 — 로그인 전엔 사람 아이콘, 로그인 후엔 프로필 아바타(사진/이니셜)
function renderAccount(btn) {
  if (!btn) return;
  const user = state.user;
  if (!user) {
    btn.classList.remove("is-signed-in");
    btn.setAttribute("aria-label", "로그인 / 계정");
    btn.innerHTML = icon("account");
    return;
  }
  btn.classList.add("is-signed-in");
  btn.setAttribute("aria-label", `${user.name || "계정"} · 계정 열기`);
  if (user.photo) {
    btn.innerHTML = `<img class="account-avatar" src="${escapeHtml(user.photo)}" alt="" referrerpolicy="no-referrer" />`;
  } else {
    const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();
    btn.innerHTML = `<span class="account-avatar">${escapeHtml(initial)}</span>`;
  }
}

// 하단바 유틸 버튼 활성/비활성 — 되돌릴 게 없으면 ↶, 목록이 비면 🗑 을 흐리게
function renderFooterActions(root) {
  const undoBtn = root.querySelector('[data-action="undo"]');
  const clearBtn = root.querySelector('[data-action="clear"]');
  if (undoBtn) undoBtn.disabled = !canUndo();
  if (clearBtn) clearBtn.disabled = state.items.length === 0;
}

function renderFolders(container) {
  syncCollapseDefaults(); // 폴더별 "기본 접힘" 설정을 런타임 상태에 반영
  // 빈 메뉴(신규 사용자) — 다음 행동(관리에서 추가) 유도
  if (state.folders.length === 0) {
    container.innerHTML = `
      <div class="menu-empty">
        <span class="menu-empty-text">아직 등록된 메뉴가 없어요</span>
        <span class="menu-empty-sub">위 ${icon("settings", { size: 15, cls: "menu-empty-icon" })} 관리에서 폴더와 메뉴를 추가해보세요</span>
      </div>`;
    return;
  }
  container.innerHTML = state.folders
    .map((folder) => {
      const collapsed = collapsedFolders.has(folder.id);
      return `
      <div class="folder ${collapsed ? "is-collapsed" : ""}">
        <button class="folder-name" data-action="toggle-folder" data-folder-id="${folder.id}" aria-expanded="${!collapsed}">
          ${icon("folder", { size: 17, cls: "folder-icon" })}
          <span class="folder-label">${escapeHtml(folder.name)}</span>
          ${collapsed ? `<span class="folder-count">${folder.menus.length}</span>` : ""}
          ${icon("chevron-down", { size: 18, cls: "folder-caret" })}
        </button>
        <div class="menu-grid">
          ${folder.menus
            .map(
              (menu) => `
            <button class="menu-btn" data-action="add-menu" data-menu-id="${menu.id}">
              <span class="menu-btn-name">${escapeHtml(menu.name)}</span>
              <span class="menu-btn-price">${formatWonOrFree(menu.price)}</span>
            </button>`
            )
            .join("")}
        </div>
      </div>`;
    })
    .join("");
}

function renderList(container) {
  if (state.items.length === 0) {
    // 빈 상태 안내는 우선 숨김(사용자 요청). 되살리려면 아래 블록 복원.
    container.innerHTML = "";
    return;
  }
  container.innerHTML = state.items
    .map((item) => {
      const qty = item.qty || 1;
      const line = item.amount * qty; // 줄 금액 = 단가 × 개수
      return `
      <div class="list-item" data-item-id="${item.id}">
        <div class="list-body">
          <span class="list-name">${escapeHtml(item.name)}</span>
          ${item.memo ? `<span class="list-memo">${escapeHtml(item.memo)}</span>` : ""}
        </div>
        <span class="list-amount ${line < 0 ? "is-minus" : ""}">${formatWonOrFree(line)}</span>
        <div class="qty-stepper">
          <button class="qty-btn" data-action="qty-dec" aria-label="개수 줄이기" ${qty <= 1 ? "disabled" : ""}>${icon("minus", { size: 14 })}</button>
          <input class="qty-num" data-action="qty-input" type="text" inputmode="numeric" pattern="[0-9]*" value="${qty}" aria-label="개수 직접 입력" />
          <button class="qty-btn" data-action="qty-inc" aria-label="개수 늘리기">${icon("plus", { size: 14 })}</button>
        </div>
        <button class="icon-btn list-remove" data-action="remove-item" aria-label="삭제">${icon("x", { size: 16 })}</button>
      </div>`;
    })
    .join("");
}

function renderTotal(el) {
  // 합계 = 목록의 모든 항목(단가 × 개수). 빼려면 항목을 삭제(X).
  el.textContent = won(grandTotal());
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
