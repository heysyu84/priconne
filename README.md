# Priconne

냥냥클랜 Re²:Dive · 프린세스 커넥트 클랜전

- **[클랜전 사이트](https://priconne.pages.dev/)**
- [기존 화면](https://priconne.pages.dev/legacy.html)
- [새 화면 소스](./redive/), [기존 화면·공유 API 소스](./clan-battle/)
- [원본 이미지 라이브러리](./clan-battle/public/source-library/), [추출 위치·해시 기록](./clan-battle/public/source-library/sheet-provenance.json)

누구나 기록을 열람할 수 있습니다. 기존 화면에서는 현재 월의 공격을 일반 입력으로 추가할 수 있으며, 기존 기록의 수정·삭제와 명단·택틱 편집에는 작성 잠금 해제가 필요합니다. 개인 이월 시간과 화면 설정은 각 브라우저에만 적용됩니다.

운영 화면은 Cloudflare Pages에서 배포하고 GitHub Pages 주소는 운영 주소로 이동합니다. 공유 기록과 작성 권한 검증은 기존 운영 API를 사용합니다. 두 화면은 같은 기록을 사용합니다.

정적 배포본 `docs/`는 저장소 루트에서 `node clan-battle/scripts/build-pages.mjs docs`로 생성합니다. 이 명령은 새 화면 번들과 가입 기간 보정 모듈도 함께 생성합니다. 배포본을 직접 수정하지 말고 원본 소스를 수정한 뒤 빌드합니다. 정적 배포와 API 서버 배포는 별개이며, 화면 빌드로 운영 DB가 초기화되지는 않습니다.

빌드는 기존 `docs/`의 내장 배틀로그·명단·이력·수상 참조 자료를 데이터 입력으로 보존하고 화면 코드만 갱신합니다. 따라서 소스에 남아 있는 이전 초기 자료로 기존 배포본의 기록이 바뀌지 않습니다. 이 참조 자료를 교체하는 작업은 화면 수정과 구분해 처리합니다.

API·데이터 구조와 보존 규칙은 [운영 설명](./clan-battle/README.md), 새 화면 검증은 [새 화면 설명](./redive/README.md)을 참고하세요.
