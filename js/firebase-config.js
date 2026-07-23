// ===== Firebase 설정 (Firebase Config) =====
// 아래 값은 Firebase 콘솔에서 발급받은 "웹 앱" 설정으로 교체하세요.
//
// 발급 방법:
//   1) https://console.firebase.google.com 에서 프로젝트 생성
//   2) 프로젝트 개요 → 웹 앱 추가(</>)  →  firebaseConfig 객체 복사
//   3) 아래 값들을 그대로 붙여넣기
//   4) Authentication → 로그인 방법 → Google 사용 설정
//   5) Authentication → 설정 → 승인된 도메인에 localhost 가 있는지 확인(기본 포함)
//
// 참고: 이 값들은 "비밀키"가 아니라 클라이언트에 공개되는 식별자입니다.
//       (실제 보안은 Firebase 보안 규칙으로 합니다.) 그대로 커밋해도 됩니다.
//
// 아직 설정 전이라면 placeholder 그대로 두세요 — 로그인 버튼을 누르면
// "설정이 필요하다"는 안내만 뜨고, 앱의 나머지 기능은 정상 동작합니다.

export const firebaseConfig = {
  apiKey: "AIzaSyAhaEeW0jAHWpM_BLd_M1Sd6RaXexHdp1E",
  authDomain: "toksum-107fe.firebaseapp.com",
  projectId: "toksum-107fe",
  storageBucket: "toksum-107fe.firebasestorage.app",
  messagingSenderId: "917310909198",
  appId: "1:917310909198:web:6e6132475a56893082855f",
  measurementId: "G-LG5EK46WC4",
};

// config가 실제 값으로 채워졌는지 검사 — placeholder면 false.
export function isFirebaseConfigured() {
  return (
    !!firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.startsWith("YOUR_") &&
    !!firebaseConfig.projectId &&
    !firebaseConfig.projectId.startsWith("YOUR_")
  );
}
