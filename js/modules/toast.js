// ===== 토스트 (Toast) =====
// 화면 하단에 잠깐 떴다 사라지는 알림. 복사 완료 등 가벼운 피드백에 사용합니다.

let el = null;
let timer = null;

export function showToast(message, { duration = 1800 } = {}) {
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  el.textContent = message;
  // 다음 프레임에 표시 클래스 → 페이드/슬라이드 인
  requestAnimationFrame(() => el.classList.add("is-visible"));

  clearTimeout(timer);
  timer = setTimeout(() => el && el.classList.remove("is-visible"), duration);
}
