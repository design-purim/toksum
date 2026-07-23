// ===== 금액 포맷 유틸 (공용) =====
// 메인 직접입력 칸과 메뉴 설정 바텀시트가 함께 사용합니다.
//  - 실시간 천단위 콤마 + 맨 앞 0 제거
//  - 표시용 콤마를 뗀 순수 숫자 파싱

// 콤마 섞인 문자열/숫자 → 순수 숫자(빈값·NaN은 0).
export function parseAmount(v) {
  return Number(String(v).replace(/,/g, "")) || 0;
}

// 숫자 → 천단위 콤마 문자열(단위 없음). 0/빈값은 빈 문자열(placeholder가 보이게).
export function formatAmount(n) {
  const num = Number(n);
  if (!num) return "";
  return num.toLocaleString("ko-KR");
}

// input에 실시간 포맷팅을 붙입니다.
//  - 숫자만 남기고 천단위 콤마 삽입(1000 → 1,000)
//  - 맨 앞 0 제거("" / 05 → 5)
//  - 콤마 삽입으로 밀린 커서를 '왼쪽 숫자 개수' 기준으로 복원(중간 편집 시 안 튐)
export function attachAmountFormatting(input) {
  if (!input) return;
  input.addEventListener("input", () => {
    const raw = input.value;
    const caret = input.selectionStart ?? raw.length;
    const digitsBeforeCaret = raw.slice(0, caret).replace(/\D/g, "").length;

    const digits = raw.replace(/\D/g, "").replace(/^0+/, ""); // 숫자만 + 맨 앞 0 제거
    const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ","); // 천단위 콤마
    input.value = formatted;

    if (digitsBeforeCaret === 0) {
      input.setSelectionRange(0, 0);
      return;
    }
    let count = 0;
    let pos = formatted.length;
    for (let i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i])) count++;
      if (count === digitsBeforeCaret) {
        pos = i + 1;
        break;
      }
    }
    input.setSelectionRange(pos, pos);
  });
}
