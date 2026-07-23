// ===== 풀페이지 (Full Page View) =====
// 바텀시트가 아니라 화면 전체를 덮는 "페이지"를 띄웁니다.
// - 브라우저/기기 뒤로가기(popstate)와 연동해 모바일 페이지 이동처럼 동작
// - 메뉴 설정, (추후) 계정 페이지 등에서 재사용
//
// 정적 사이트라 실제 URL 라우팅 대신 history.pushState로 "가상 페이지"를 쌓습니다.
// 이렇게 하면 상태(state)를 그대로 공유하면서도 뒤로가기로 닫을 수 있습니다.

let active = null;

export function openPage(contentEl, { onClose } = {}) {
  closePage(); // 한 번에 하나만 (지금은 중첩 페이지 불필요)

  const page = document.createElement("div");
  page.className = "page";
  page.appendChild(contentEl);
  document.body.appendChild(page);
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => page.classList.add("is-open"));

  // 뒤로가기 연동: 가상 히스토리 항목을 하나 쌓는다.
  const onPop = () => closePage(true); // 브라우저 뒤로가기로 닫힘
  history.pushState({ page: true }, "");
  window.addEventListener("popstate", onPop);

  active = { page, onClose, onPop };
}

// fromPopstate: 브라우저 뒤로가기(popstate)로 닫히는 경우 true
export function closePage(fromPopstate = false) {
  if (!active) return;
  const { page, onClose, onPop } = active;
  active = null;

  window.removeEventListener("popstate", onPop);
  // UI의 뒤로가기 버튼으로 닫을 때는 우리가 쌓은 히스토리 항목을 되돌린다.
  if (!fromPopstate) history.back();

  document.body.style.overflow = "";
  page.classList.remove("is-open");
  const remove = () => {
    if (page.isConnected) page.remove();
  };
  page.addEventListener("transitionend", remove, { once: true });
  setTimeout(remove, 300); // 트랜지션 미발생 대비 fallback

  if (typeof onClose === "function") onClose();
}
