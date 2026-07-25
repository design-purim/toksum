# 톡셈 (Toksum)

**톡톡 눌러 셈한다** — 미리 등록한 항목을 눌러 빠르게 견적을 만들고 복사하는 범용 견적기(PWA).
"Tok"(톡톡 누르기) + "sum"(셈·합계).

🌐 **라이브: https://design-purim.github.io/toksum/**

## 주요 기능

- **빠른 견적** — 메뉴 칩을 눌러 항목 담기(같은 메뉴는 개수 합치기) · 개수 조절/직접 입력 · 직접입력(+추가) · 50% 추가 · 할인(−)
- **합계·복사** — 목록 전체 합계를 클립보드로 복사 · 실행취소 · 비우기. 견적이라 **합계는 0원까지만**(할인이 넘쳐도 마이너스로 안 감)
- **메뉴 관리** — 폴더별 메뉴 · **즐겨찾기(별)** 로 자주 쓰는 메뉴를 상단에 모아두기 · **무료 메뉴**("무료" 표시)·**할인 메뉴**(음수 금액) · 드래그 정렬 · 바텀시트 편집 · 금액 자동 콤마
- **로그인·동기화** — Google 로그인(Firebase) · 로그인하면 메뉴 설정이 여러 기기에 동기화(Firestore)
- **로그인 없이도** — 비회원은 즉시 사용(LocalStorage 저장)

## 실행

```bash
python3 nocache_server.py   # http://localhost:8777
```

순수 정적 · 빌드 도구 없음. ES 모듈이라 `file://`이 아닌 http 서빙이 필요합니다(위 스크립트는 캐시 없는 dev 서버).

## 기술

HTML5 / CSS3 / **Vanilla JS(ES Modules)** · Firebase Auth + Firestore · GitHub Pages 배포됨.
라이브러리는 완전 무료 원칙 — 아이콘(Lucide) 인라인 내장, 드래그(SortableJS) 자체호스팅, 폰트(Wanted Sans, OFL). 디자인 톤은 토스 참고, 메인 컬러 에메랄드 그린.

## 문서

- **docs/HANDOFF.md** — 세션 인수인계(항상 최신 상태 기준)
- **docs/CHANGELOG.md** — 변경 이력(버전별 상세)
- **docs/DESIGN.md** — 디자인 시스템·UX 기준
- docs/SPEC.md · docs/UI.md · docs/TODO.md — 초안(요구사항·화면·할 일)
- docs/PROMPT.md — 프로젝트 프롬프트
