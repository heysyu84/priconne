# 냥냥클랜 리리다이브

프린세스 커넥트 클랜전의 배틀로그, 대시보드, 택틱과 개인 이월, 추천 조합, 기여도 및 역대 클랜원 기록을 관리합니다.

- GitHub Pages: https://heysyu84.github.io/priconne/
- 공유 저장 API / 기존 접속 주소: https://nyang-clan-manager.heysyu457310.chatgpt.site
- GitHub 위치: heysyu84/priconne → clan-battle/
- 라이트 모드와 보스별 원본 시트 색상을 사용합니다.
- 관리자 코드로 작성 잠금을 해제합니다. 공용 기록은 서버에 저장하며 개인 이월 시간은 각 브라우저에만 저장합니다.
- 배틀로그의 관리자용 마감 이력에서 마감을 취소할 수 있습니다. 새로고침 뒤에도 사용할 수 있으며 공격 기록을 보존하고 이후 일차, 타수와 이월 연결을 다시 계산합니다.
- HP는 정수로 계산합니다. 기여도 계산값의 정밀도를 유지하고 화면에만 소수점 둘째 자리까지 표시합니다.

## 구성

| 경로 | 내용 |
| --- | --- |
| public/clan-shell.html, public/clan.js | 화면과 초기 데이터 |
| public/engine.mjs | HP, 회차, 이월 연결, 점수와 기여도 계산 |
| public/guild-workspace.mjs, public/guild-model.mjs | 하루 단위 대시보드, DB, 순위, 이력과 추천 조합 |
| public/tactics-workspace.mjs, public/tactics-model.mjs | 원본 색상과 SET 상태를 유지하는 택틱 편집과 개인 이월 |
| public/characters.json, public/character-portraits.mjs | 원본 327명 초상화 연결, 성급별 이미지와 기본 초상화 복구 |
| public/responsive.css | 모바일과 중간 너비의 배치 |
| app/api/state/, app/api/editor/, app/editor-access.ts | 서버 저장과 작성 권한 |
| public/images/characters/, public/images/bosses/, public/images/branding/ | 사이트에서 사용하는 이미지 |
| public/images/sheet-originals/ | 원본 시트에서 추출한 PNG 328개와 셀 위치·해시 목록 |
| public/fonts/ | PDF용 한글 글꼴과 라이선스 |
| drizzle/ | D1 테이블 마이그레이션 |

## 개발과 검증

Node.js 22.13 이상과 package.json에 지정된 pnpm을 사용합니다. pnpm install --frozen-lockfile 후 pnpm dev로 개발하고 pnpm build로 빌드합니다. 서버는 Cloudflare Workers/D1 기반의 Vinext 앱이며 데이터베이스 바인딩 이름은 DB입니다. 새 환경의 D1에는 drizzle/의 SQL을 먼저 적용해야 합니다.

화면과 모든 초상화는 GitHub Pages에서 배포합니다. 공유 기록과 1122 작성 코드 검증은 기존 Cloudflare Workers/D1의 /api/state, /api/editor를 사용합니다. Pages 접속은 허용된 출처만 API에 연결할 수 있고, 수정 세션은 12시간 동안 해당 탭의 sessionStorage에 보관합니다. 작성 코드 자체는 브라우저에 저장하지 않습니다. 기존 주소의 HttpOnly 쿠키 인증도 유지합니다.

`node scripts/build-pages.mjs`는 `out/pages/`에 정적 배포 파일을 만듭니다. 이 결과를 GitHub 저장소 루트의 `docs/`로 올리고, Pages 소스를 `main` 브랜치의 `/docs`로 지정합니다. 원본 소스와 이미지는 계속 `clan-battle/`에 있습니다. 서버 DB와 관리자 세션은 저장소에 포함하지 않습니다.

GitHub Pages만으로 공유 저장 서버를 대체할 수는 없습니다. 서버를 이전할 때는 scripts/build-pages.mjs의 공개 API 주소와 app/api-access.ts의 Pages 출처를 함께 수정하고 기존 DB를 이관해야 합니다.

검증 명령:

    node scripts/test-exact-hp.mjs
    node scripts/test-workflow.mjs
    node scripts/test-day-closures.mjs
    node scripts/test-tactics.mjs
    node scripts/test-portraits.mjs
    node scripts/test-guild.mjs
    node scripts/test-guild-ui.mjs
    node --experimental-strip-types scripts/test-editor.mjs
    node scripts/test-pages.mjs

원본 시트 이미지의 바이트, 해시와 위치는 public/images/sheet-originals/manifest.json에서 확인할 수 있습니다. scripts/extract-sheet-images.py로 동일한 원본 XLSX에서 다시 추출할 수 있습니다.

## 분리형 월별 아카이브 (2026-10-22 설계)
현재 진행 중인 월은 `clan_state`에, 과거 월은 `clan_archive_months`에 별도 보관합니다.
새 클라이언트는 `/api/state?compact=1`을 사용하고 서버가 `splitStorage:true`를 명시한 경우에만 분리 저장합니다.
과거 월은 `/api/archive?month=YYYY-MM`으로 필요할 때만 불러오고 읽기 전용 '과거 기록' 페이지에서 조회합니다.
구버전 API는 전체 월 데이터로 작동하므로 배포 중 기록 손실을 막습니다. 기존 데이터 이전은 수정 권한이 있는 클라이언트의 **첫 정상 저장 시** D1 단일 트랜잭션으로 보관되며, 과거 월은 삭제하지 않고 옮겨집니다.
중요: GitHub Pages에 정적 파일을 배포하는 것만으로 Cloudflare API와 D1 마이그레이션이 배포되지는 않습니다. 서버 배포 전에 D1 백업을 생성하고 `drizzle/0001_clan_archives.sql`을 적용한 뒤 API 앱을 배포해야 분리가 실제 작동합니다.
JSON 전체 백업 시 아카이브를 함께 가져오고, 복원 시 명시적 보관 월 덮어쓰기로 처리합니다.
