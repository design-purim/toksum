// ===== 메뉴 설정 (Menu Settings) =====
// 설계: "평소엔 깔끔, 필요할 때만 컨트롤 노출" (토스 / iOS 설정 스타일)
//  - 메뉴 행: 이름 ···· 금액 ›  (탭 → 하단 바텀시트에서 수정·삭제)
//  - 폴더 헤더: 📁 이름 ···· ⋯  (⋯ → 폴더 수정·삭제 시트)
//  - 추가: 폴더당 "+ 메뉴 추가" 한 줄 → 시트
//  - 순서 변경: 평소엔 드래그 숨김, 상단 "정렬" 토글에서만 드래그 노출

import {
  state,
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
} from "../state.js";
import { icon } from "../icons.js";
import { openPage, closePage } from "./page.js";
import { openOverlay, closeOverlay } from "./overlay.js";
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

// ===== 바텀시트: 메뉴 추가/수정 =====
function openMenuSheet(folderId, menuId) {
  const folder = state.folders.find((f) => f.id === folderId);
  if (!folder) return;
  const menu = menuId ? folder.menus.find((m) => m.id === menuId) : null;
  const isEdit = !!menu;
  const isFree = isEdit && menu.price === 0; // 가격 0 = 무료(Option A)

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
        <input class="field" name="price" type="text" inputmode="numeric" pattern="[0-9,]*" placeholder="${isFree ? "무료" : "0"}" autocomplete="off" value="${isEdit ? formatAmount(menu.price) : ""}" ${isFree ? "disabled" : ""} />
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
      <button class="btn btn-primary btn-lg" type="submit">저장</button>
      ${isEdit ? `<button class="btn-text-danger" type="button" data-act="delete">${icon("trash", { size: 18 })}<span>메뉴 삭제</span></button>` : ""}
    </form>
  `;

  const priceInput = sheet.querySelector('[name="price"]');
  const freeInput = sheet.querySelector('[name="free"]');
  // 무료 토글: 켜면 금액칸 비활성(0원 취급), 끄면 다시 입력 가능
  freeInput.addEventListener("change", () => {
    priceInput.disabled = freeInput.checked;
    priceInput.placeholder = freeInput.checked ? "무료" : "0";
    if (freeInput.checked) priceInput.value = "";
    else priceInput.focus();
  });

  sheet.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = e.target.elements.name.value.trim();
    const free = e.target.elements.free.checked;
    const price = free ? 0 : parseAmount(e.target.elements.price.value); // 무료면 0, 아니면 콤마 제거 후 숫자
    if (!name) {
      e.target.elements.name.focus();
      return;
    }
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
