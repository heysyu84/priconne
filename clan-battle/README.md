# 냥냥클랜 리리다이브

프린세스 커넥트 클랜전의 배틀로그, 대시보드, 택틱과 개인 이월, 추천 조합, 기여도 및 역대 클랜원 기록을 관리합니다.

- 실행 중인 사이트: https://nyang-clan-manager.heysyu457310.chatgpt.site
- GitHub 위치: heysyu84/priconne → clan-battle/
- 라이트 모드와 보스별 원본 시트 색상을 사용합니다.
- 관리자 코드로 작성 잠금을 해제합니다. 공용 기록은 서버에 저장하며 개인 이월 시간은 각 브라우저에만 저장합니다.
- HP는 정수로 계산합니다. 기여도 계산값의 정밀도를 유지하고 화면에만 소수점 둘째 자리까지 표시합니다.

## 구성

| 경로 | 내용 |
| --- | --- |
| public/clan-shell.html, public/clan.js | 화면과 초기 데이터 |
| public/engine.mjs | HP, 회차, 이월 연결, 점수와 기여도 계산 |
| public/guild-workspace.mjs, public/guild-model.mjs | 하루 단위 대시보드, DB, 순위, 이력과 추천 조합 |
| public/tactics-workspace.mjs, public/tactics-model.mjs | 원본 색상과 SET 상태를 유지하는 택틱 편집과 개인 이월 |
| public/responsive.css | 모바일과 중간 너비의 배치 |
| app/api/state/, app/api/editor/, app/editor-access.ts | 서버 저장과 작성 권한 |
| public/images/characters/, public/images/bosses/, public/images/branding/ | 사이트에서 사용하는 이미지 |
| public/images/sheet-originals/ | 원본 시트에서 추출한 PNG 328개와 셀 위치·해시 목록 |
| public/fonts/ | PDF용 한글 글꼴과 라이선스 |
| drizzle/ | D1 테이블 마이그레이션 |

## 개발과 검증

Node.js 22.13 이상과 package.json에 지정된 pnpm을 사용합니다. pnpm install --frozen-lockfile 후 pnpm dev로 개발하고 pnpm build로 빌드합니다. 서버는 Cloudflare Workers/D1 기반의 Vinext 앱이며 데이터베이스 바인딩 이름은 DB입니다. 새 환경의 D1에는 drizzle/의 SQL을 먼저 적용해야 합니다.

GitHub는 소스와 이미지의 보관 위치입니다. 현재 서버 DB와 관리자 세션은 저장소에 포함하지 않습니다. 배포할 때는 정적 파일과 함께 /api/state, /api/editor 서버 기능 및 D1을 연결해야 공유 저장과 작성 권한이 유지됩니다.

검증 명령:

    node scripts/test-exact-hp.mjs
    node scripts/test-workflow.mjs
    node scripts/test-tactics.mjs
    node scripts/test-guild.mjs
    node scripts/test-guild-ui.mjs
    node --experimental-strip-types scripts/test-editor.mjs

원본 시트 이미지의 바이트, 해시와 위치는 public/images/sheet-originals/manifest.json에서 확인할 수 있습니다. scripts/extract-sheet-images.py로 동일한 원본 XLSX에서 다시 추출할 수 있습니다.
