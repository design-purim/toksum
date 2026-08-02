// ===== 메뉴 설정 (Menu Settings) =====
// 설계: "평소엔 깔끔, 필요할 때만 컨트롤 노출" (토스 / iOS 설정 스타일)
//  - 메뉴 행: 이름 ···· 금액 ›  (탭 → 하단 바텀시트에서 수정·삭제)
//  - 폴더 헤더: 📁 이름 ···· ⋯  (⋯ → 폴더 수정·삭제 시트)
//  - 추가: 폴더당 "+ 메뉴 추가" 한 줄 → 시트
//  - 순서 변경: 평소엔 드래그 숨김, 상단 "정렬" 토글에서만 드래그 노출

import {
  state,
  uid,
  addFolder,
  renameFolder,
  deleteFolder,
  addMenu,
  updateMenu,
  deleteMenu,
  toggleMenuFav,
  reorderFolders,
  moveMenu,
  setFolderCollapsed,
  replaceFolders,
} from "../state.js";
import { icon } from "../icons.js";
import { openPage, closePage } from "./page.js";
import { openOverlay, closeOverlay } from "./overlay.js";
import { showToast } from "./toast.js";
import { attachAmountFormatting, parseAmount, formatAmount, formatWonOrFree } from "../format.js";
import Sortable from "../vendor/sortable.esm.js";

let container = null;
let mode = "view"; // 'view' | 'reorder'
let sortables = [];

const won = (n) => `${Number(n).toLocaleString("ko-KR")}원`;
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function openMenuSettings() {
  mode = "view";
  container = document.createElement("div");
  container.className = "settings";
  render();
  container.addEventListener("click", onClick);
  container.addEventListener("submit", onSubmit);
  openPage(container, { onClose: destroySortables });
}

// ===== 렌더 =====
function render() {
  destroySortables();
  const reordering = mode === "reorder";
  container.className = `settings${reordering ? " is-reorder" : ""}`;
  container.innerHTML = `
    <header class="settings-header">
      <button class="icon-btn" data-act="close" aria-label="뒤로">${icon("back")}</button>
      <h2 class="settings-title">메뉴 설정</h2>
      <button class="header-btn settings-mode-btn" data-act="toggle-reorder">
        ${reordering ? "완료" : `${icon("sort", { size: 16 })}<span>정렬</span>`}
      </button>
    </header>

    <div class="settings-body">
      ${
        reordering
          ? ""
          : `<form class="add-folder-form" data-form="add-folder">
               <input class="field" name="name" placeholder="새 폴더 이름" autocomplete="off" />
               <button class="btn btn-primary" type="submit">${icon("plus", { size: 16 })}<span>폴더</span></button>
             </form>`
      }
      <div class="settings-folder-list">
        ${state.folders.map(renderFolder).join("") || `<p class="settings-empty">폴더를 추가해 메뉴를 정리해보세요.</p>`}
      </div>
      ${
        reordering
          ? ""
          : `<section class="settings-backup">
               <h3 class="settings-backup-title">메뉴 백업</h3>
               <p class="settings-backup-desc">메뉴 설정을 파일로 저장해 두거나, 저장한 파일에서 되살려요.</p>
               <div class="settings-backup-actions">
                 <button class="btn-backup" type="button" data-act="export-menus">${icon("download", { size: 18 })}<span>내보내기</span></button>
                 <button class="btn-backup" type="button" data-act="import-menus">${icon("upload", { size: 18 })}<span>불러오기</span></button>
               </div>
             </section>`
      }
    </div>
  `;
  if (reordering) initSortables();
}

function renderFolder(folder) {
  const reordering = mode === "reorder";
  return `
    <section class="settings-folder" data-folder-id="${folder.id}">
      <div class="settings-folder-head">
        ${reordering ? `<button class="icon-btn drag-handle folder-drag" aria-label="폴더 순서 이동" tabindex="-1">${icon("grip", { size: 20 })}</button>` : icon("folder", { size: 20, cls: "folder-icon" })}
        <span class="settings-folder-name">${esc(folder.name)}</span>
        ${
          reordering
            ? ""
            : `<button class="icon-btn folder-more" data-act="folder-sheet" data-folder-id="${folder.id}" aria-label="폴더 수정">${icon("more", { size: 20 })}</button>`
        }
      </div>

      <ul class="settings-menu-list" data-folder-id="${folder.id}">
        ${folder.menus.map((m) => renderMenu(folder.id, m)).join("") || (reordering ? "" : `<li class="settings-menu-empty">메뉴가 없습니다.</li>`)}
      </ul>

      ${
        reordering
          ? ""
          : `<button class="add-menu-row" data-act="add-menu-sheet" data-folder-id="${folder.id}">${icon("plus", { size: 18 })}<span>메뉴 추가</span></button>`
      }
    </section>
  `;
}

function renderMenu(folderId, menu) {
  if (mode === "reorder") {
    return `
      <li class="settings-menu-item is-reorder" data-menu-id="${menu.id}">
        <button class="icon-btn drag-handle menu-drag" aria-label="메뉴 순서 이동" tabindex="-1">${icon("grip", { size: 20 })}</button>
        <span class="settings-menu-name">${esc(menu.name)}</span>
        <span class="settings-menu-price">${formatWonOrFree(menu.price)}</span>
      </li>`;
  }
  return `
    <li class="settings-menu-item" data-menu-id="${menu.id}">
      <button class="menu-fav ${menu.fav ? "is-fav" : ""}" data-act="toggle-fav" data-folder-id="${folderId}" data-menu-id="${menu.id}" aria-label="${menu.fav ? "즐겨찾기 해제" : "즐겨찾기"}" aria-pressed="${!!menu.fav}">${icon("star", { size: 20, cls: "menu-fav-icon" })}</button>
      <button class="menu-row" data-act="edit-menu-sheet" data-folder-id="${folderId}" data-menu-id="${menu.id}">
        <span class="settings-menu-name">${esc(menu.name)}</span>
        <span class="settings-menu-price">${formatWonOrFree(menu.price)}</span>
        ${icon("chevron-right", { size: 18, cls: "menu-row-chevron" })}
      </button>
    </li>`;
}

// ===== 이벤트 =====
function onClick(e) {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const { act, folderId, menuId } = btn.dataset;

  switch (act) {
    case "close":
      closePage();
      break;
    case "toggle-reorder":
      mode = mode === "reorder" ? "view" : "reorder";
      render();
      break;
    case "folder-sheet":
      openFolderSheet(folderId);
      break;
    case "add-menu-sheet":
      openMenuSheet(folderId, null);
      break;
    case "edit-menu-sheet":
      openMenuSheet(folderId, menuId);
      break;
    case "toggle-fav":
      // 별 토글 → 상태 반영 후 설정 화면 다시 그림(메인은 notify로 자동 갱신)
      toggleMenuFav(folderId, menuId);
      render();
      break;
    case "export-menus":
      exportMenus();
      break;
    case "import-menus":
      pickImportFile();
      break;
  }
}

function onSubmit(e) {
  e.preventDefault();
  if (e.target.dataset.form === "add-folder") {
    const input = e.target.elements.name;
    addFolder(input.value);
    render();
  }
}

// ===== 메뉴 백업 (JSON 내보내기 / 불러오기) =====
// 수동 안전망: 클라우드 사고와 무관하게 사용자가 직접 메뉴 설정을 파일로 보관·복원.
// (HANDOFF §11 개선 후보 ①) 폴더/메뉴 구조를 JSON으로 내려받고, 같은 형식으로 되살림.

// 현재 폴더/메뉴를 JSON 파일로 다운로드.
function exportMenus() {
  if (!state.folders.length) return void showToast("내보낼 메뉴가 없어요");
  const payload = {
    app: "toksum",
    type: "menu-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    folders: state.folders,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `toksum-menu-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("메뉴를 파일로 내보냈어요");
}

// 파일 선택창을 열어 백업 JSON을 고르게 함.
function pickImportFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (file) applyImport(file);
  });
  input.click();
}

// 백업 JSON을 검증·정규화한 뒤(확인 후) 현재 메뉴를 교체.
async function applyImport(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return void showToast("올바른 백업 파일이 아니에요");
  }
  // 우리 포맷({folders:[...]}) 또는 folders 배열만 담긴 파일 둘 다 허용.
  const folders = normalizeFolders(Array.isArray(parsed) ? parsed : parsed && parsed.folders);
  if (!folders) return void showToast("올바른 백업 파일이 아니에요");

  const menuCount = folders.reduce((n, f) => n + f.menus.length, 0);
  const ok = confirm(
    `이 파일로 메뉴를 교체할까요?\n폴더 ${folders.length}개 · 메뉴 ${menuCount}개\n\n지금 화면의 메뉴는 교체됩니다.`
  );
  if (!ok) return;

  replaceFolders(folders); // notify → LocalStorage 저장(+회원이면 클라우드 저장, 게이트 열려있을 때)
  render();
  showToast("메뉴를 불러왔어요");
}

// 외부 파일이라 신뢰하지 않고 형태를 강제한다(예상 필드만 남기고 값 정규화).
function normalizeFolders(raw) {
  if (!Array.isArray(raw)) return null;
  return raw.map((f) => ({
    id: typeof f?.id === "string" && f.id ? f.id : uid("folder"),
    name: String(f?.name ?? "").trim() || "새 폴더",
    collapsed: !!f?.collapsed,
    menus: Array.isArray(f?.menus)
      ? f.menus.map((m) => {
          const menu = {
            id: typeof m?.id === "string" && m.id ? m.id : uid("menu"),
            name: String(m?.name ?? "").trim() || "메뉴",
            price: Number(m?.price) || 0, // 음수(할인)·0(무료)도 그대로 허용
          };
          if (m?.fav) menu.fav = true;
          return menu;
        })
      : [],
  }));
}

// ===== 바텀시트: 메뉴 추가/수정 =====
function openMenuSheet(folderId, menuId) {
  const folder = state.folders.find((f) => f.id === folderId);
  if (!folder) return;
  const menu = menuId ? folder.menus.find((m) => m.id === menuId) : null;
  const isEdit = !!menu;
  const isFree = isEdit && menu.price === 0; // 가격 0 = 무료(Option A)
  const isDiscount = isEdit && menu.price < 0; // 음수 가격 = 할인 항목
  // 금액칸엔 항상 양수(부호는 할인 토글이 담당). 할인 편집 시 절댓값을 보여줌.
  const priceFieldValue = isEdit ? formatAmount(isDiscount ? Math.abs(menu.price) : menu.price) : "";

  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3 class="sheet-title">${isEdit ? "메뉴 수정" : "메뉴 추가"}</h3>
    <form class="sheet-form">
      <label class="sheet-field">
        <span class="sheet-label">이름</span>
        <input class="field" name="name" placeholder="메뉴 이름" autocomplete="off" value="${isEdit ? esc(menu.name) : ""}" />
      </label>
      <label class="sheet-field">
        <span class="sheet-label">금액</span>
        <input class="field" name="price" type="text" inputmode="numeric" pattern="[0-9,]*" placeholder="${isFree ? "무료" : "0"}" autocomplete="off" value="${priceFieldValue}" ${isFree ? "disabled" : ""} />
      </label>
      <label class="switch-row">
        <span class="switch-text">
          <span class="switch-title">무료</span>
          <span class="switch-sub">금액을 0원으로 두고 "무료"로 표시해요</span>
        </span>
        <span class="switch">
          <input type="checkbox" name="free" ${isFree ? "checked" : ""} />
          <span class="switch-track" aria-hidden="true"></span>
        </span>
      </label>
      <label class="switch-row">
        <span class="switch-text">
          <span class="switch-title">할인 항목</span>
          <span class="switch-sub">금액을 마이너스로 넣어 견적에서 빼요</span>
        </span>
        <span class="switch">
          <input type="checkbox" name="discount" ${isDiscount ? "checked" : ""} />
          <span class="switch-track" aria-hidden="true"></span>
        </span>
      </label>
      <button class="btn btn-primary btn-lg" type="submit">저장</button>
      ${isEdit ? `<button class="btn-text-danger" type="button" data-act="delete">${icon("trash", { size: 18 })}<span>메뉴 삭제</span></button>` : ""}
    </form>
  `;

  const priceInput = sheet.querySelector('[name="price"]');
  const freeInput = sheet.querySelector('[name="free"]');
  const discountInput = sheet.querySelector('[name="discount"]');

  // 금액칸 상태는 "무료"에만 좌우됨(할인은 부호만 담당하므로 칸은 그대로 입력 가능)
  const syncPriceField = () => {
    priceInput.disabled = freeInput.checked;
    priceInput.placeholder = freeInput.checked ? "무료" : "0";
    if (freeInput.checked) priceInput.value = "";
  };
  // 무료 · 할인은 상호배타(둘 다 켤 수 없음)
  freeInput.addEventListener("change", () => {
    if (freeInput.checked) discountInput.checked = false;
    syncPriceField();
    if (!freeInput.checked) priceInput.focus();
  });
  discountInput.addEventListener("change", () => {
    if (discountInput.checked) freeInput.checked = false;
    syncPriceField();
    priceInput.focus();
  });

  sheet.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = e.target.elements.name.value.trim();
    const free = e.target.elements.free.checked;
    const discount = e.target.elements.discount.checked;
    if (!name) {
      e.target.elements.name.focus();
      return;
    }
    const abs = parseAmount(e.target.elements.price.value); // 콤마 뗀 양수
    // 할인인데 금액이 비었으면(0) 저장 거부 — "할인인데 무료로 저장"되는 혼동 방지
    if (discount && abs === 0) {
      e.target.elements.price.focus();
      return;
    }
    const price = free ? 0 : discount ? -Math.abs(abs) : abs; // 무료=0, 할인=음수, 그 외=입력액
    if (isEdit) updateMenu(folderId, menuId, { name, price });
    else addMenu(folderId, name, price);
    closeOverlay();
    render();
  });

  sheet.addEventListener("click", (e) => {
    if (e.target.closest('[data-act="delete"]')) {
      deleteMenu(folderId, menuId);
      closeOverlay();
      render();
    }
  });

  openOverlay(sheet);
  attachAmountFormatting(priceInput); // 금액 실시간 콤마+앞0제거
  focusSheet(sheet);
}

// ===== 바텀시트: 폴더 수정/삭제 =====
function openFolderSheet(folderId) {
  const folder = state.folders.find((f) => f.id === folderId);
  if (!folder) return;

  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3 class="sheet-title">폴더 수정</h3>
    <form class="sheet-form">
      <label class="sheet-field">
        <span class="sheet-label">이름</span>
        <input class="field" name="name" placeholder="폴더 이름" autocomplete="off" value="${esc(folder.name)}" />
      </label>
      <label class="switch-row">
        <span class="switch-text">
          <span class="switch-title">기본으로 접어두기</span>
          <span class="switch-sub">메인 화면에서 이 폴더를 접은 채로 시작해요</span>
        </span>
        <span class="switch">
          <input type="checkbox" name="collapsed" ${folder.collapsed ? "checked" : ""} />
          <span class="switch-track" aria-hidden="true"></span>
        </span>
      </label>
      <button class="btn btn-primary btn-lg" type="submit">저장</button>
      <button class="btn-text-danger" type="button" data-act="delete">${icon("trash", { size: 18 })}<span>폴더 삭제</span></button>
    </form>
  `;

  sheet.addEventListener("submit", (e) => {
    e.preventDefault();
    renameFolder(folderId, e.target.elements.name.value);
    setFolderCollapsed(folderId, e.target.elements.collapsed.checked);
    closeOverlay();
    render();
  });

  sheet.addEventListener("click", (e) => {
    if (e.target.closest('[data-act="delete"]')) {
      if (confirm("이 폴더와 폴더 안의 모든 메뉴를 삭제할까요?")) {
        deleteFolder(folderId);
        closeOverlay();
        render();
      }
    }
  });

  openOverlay(sheet);
  focusSheet(sheet);
}

function focusSheet(sheet) {
  const input = sheet.querySelector("input");
  if (input) {
    input.focus();
    if (input.value) input.select();
  }
}

// ===== 드래그 정렬 (정렬 모드에서만) =====
function initSortables() {
  const common = { handle: ".drag-handle", animation: 150, ghostClass: "drag-ghost", chosenClass: "drag-chosen" };

  const folderList = container.querySelector(".settings-folder-list");
  if (folderList) {
    sortables.push(
      Sortable.create(folderList, {
        ...common,
        onEnd: (e) => {
          if (e.oldIndex !== e.newIndex) reorderFolders(e.oldIndex, e.newIndex);
        },
      })
    );
  }

  container.querySelectorAll(".settings-menu-list").forEach((ul) => {
    sortables.push(
      Sortable.create(ul, {
        ...common,
        group: "menus",
        onEnd: (e) => {
          const fromFolderId = e.from.dataset.folderId;
          const toFolderId = e.to.dataset.folderId;
          if (fromFolderId === toFolderId && e.oldIndex === e.newIndex) return;
          moveMenu(fromFolderId, toFolderId, e.oldIndex, e.newIndex);
          if (fromFolderId !== toFolderId) render();
        },
      })
    );
  });
}

function destroySortables() {
  sortables.forEach((s) => s.destroy());
  sortables = [];
}
