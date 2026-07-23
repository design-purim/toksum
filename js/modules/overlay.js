// ===== 오버레이 (Overlay) =====
// 화면 위에 패널을 띄우는 공용 컴포넌트입니다.
// 메뉴 설정 패널, 퍼센트 선택 모달 등 여러 곳에서 재사용합니다.

let active = null;

// contentEl(HTMLElement)을 패널 안에 넣어 표시합니다.
// options.onClose: 닫힐 때 호출되는 콜백
export function openOverlay(contentEl, { onClose } = {}) {
  closeOverlay();

  const backdrop = document.createElement("div");
  backdrop.className = "overlay-backdrop";

  const panel = document.createElement("div");
  panel.className = "overlay-panel";
  panel.appendChild(contentEl);
  backdrop.appendChild(panel);

  document.body.appendChild(backdrop);
  document.body.style.overflow = "hidden"; // 뒤 배경 스크롤 잠금

  // 배경(패널 바깥) 클릭 시 닫기
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeOverlay();
  });

  // ESC 키로 닫기
  const onKey = (e) => {
    if (e.key === "Escape") closeOverlay();
  };
  document.addEventListener("keydown", onKey);

  active = { backdrop, onClose, onKey };
  // 애니메이션용: 다음 프레임에 open 클래스 부여
  requestAnimationFrame(() => backdrop.classList.add("is-open"));
  return backdrop;
}

export function closeOverlay() {
  if (!active) return;
  const { backdrop, onClose, onKey } = active;
  active = null;
  document.removeEventListener("keydown", onKey);
  document.body.style.overflow = "";
  backdrop.remove();
  if (typeof onClose === "function") onClose();
}
