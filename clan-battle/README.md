# 냥냥클랜 리리다이브

프린세스 커넥트 클랜전의 배틀로그, 대시보드, 택틱과 개인 이월, 추천 조합, 기여도 및 역대 클랜원 기록을 관리합니다.

- Cloudflare Pages: https://priconne.pages.dev/
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
| public/combo-workspace.mjs, public/combo-planner.mjs, public/combo.css | 간략 추천 조합과 4단계 3타 분배 계산 |
| app/api/presence/, public/presence.mjs, public/presence.css | 익명 브라우저 접속 수 집계와 상단 표시 |
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
    node scripts/test-combo-planner.mjs
    node scripts/test-presence.mjs
    node --experimental-strip-types scripts/test-editor.mjs
    node scripts/test-pages.mjs

원본 시트 이미지의 바이트, 해시와 위치는 public/images/sheet-originals/manifest.json에서 확인할 수 있습니다. scripts/extract-sheet-images.py로 동일한 원본 XLSX에서 다시 추출할 수 있습니다.

## 분리형 월별 아카이브 (2026-10-22 설계)
현재 진행 중인 월은 `clan_state`에, 과거 월은 `clan_archive_months`에 별도 보관합니다.
새 클라이언트는 `/api/state?compact=1`을 사용하고 서버가 `splitStorage:true`를 명시한 경우에만 분리 저장합니다.
과거 월은 `/api/archive?month=YYYY-MM`으로 선택할 때만 불러옵니다. 우상단 월 선택은 과거 배틀로그·택틱·월별 규칙 등 전체 상세 화면을 읽기 전용으로 조회하며, 현재 월의 편집·저장 상태와 분리됩니다.
구버전 API는 전체 월 데이터로 작동하므로 배포 중 기록 손실을 막습니다. 기존 데이터 이전은 수정 권한이 있는 클라이언트의 **첫 정상 저장 시** D1 단일 트랜잭션으로 보관되며, 과거 월은 삭제하지 않고 옮겨집니다.
중요: GitHub Pages에 정적 파일을 배포하는 것만으로 Cloudflare API와 D1 마이그레이션이 배포되지는 않습니다. 서버 배포 전에 D1 백업을 생성하고 `drizzle/0001_clan_archives.sql`을 적용한 뒤 API 앱을 배포해야 분리가 실제 작동합니다.
JSON 전체 백업 시 아카이브를 함께 가져오고, 복원 시 명시적 보관 월 덮어쓰기로 처리합니다.

‘과거 기록’ 요약은 클랜 DB에서 이동하며, 직접 링크 `/#archive` 또는 `/#archive=2026-09`로도 열 수 있습니다. 미지원 백엔드에서는 기존 상태에 포함된 월별 기록을 읽기 전용으로 보여줍니다.


### 클랜 DB의 과거 기록

과거 월은 클랜 DB의 기여도 → 과거 기록 → 과거 이력 → 명예의 전당 → 역대 클랜원 순서에서 조회합니다. 과거 기록은 선택한 월의 실제 피해량 합계, 인게임 점수 합계, 클랜 등수, 클랜원 수와 개인별 순위를 표시합니다. 배틀로그·택틱·규칙 등 월별 원본은 그대로 보관하며 화면에서만 제외합니다. 과거 월은 선택할 때 불러오고, 기존 #archive=YYYY-MM 주소도 해당 DB 화면으로 연결됩니다.

3단계 추천 조합은 필요시간·이월시간·조작택틱을 표시하며, 조작이 비어 있으면 전부 SET을 사용합니다. 상황판의 잔여타수는 현재 진행 일차의 남은 기본타+미사용 이월타로 계산합니다.

전체 화면의 공통 최대 너비는 1360px이며, 기여도 배율과 4단계 상위 기록은 상하로 배치합니다. 배틀로그의 상세 열은 표 너비에 비례해 배분합니다.

초상화 제작은 상단 메뉴에서 제외하고 설정 메뉴에 PC·모바일 공통으로 제공합니다.

4단계 상위 기록은 전체 보스를 기본으로 표시합니다. 전체 보기에서는 보스별 상위 10건과 평균·보정 평균을 만 단위 표로 비교하고, 개별 보스 선택 시 클랜원·일차를 포함한 기존 상세 기록을 제공합니다.

웹 상단 메뉴는 최소 16px 글자와 아이콘을 사용하며, 넓은 저배율 화면에서는 18px 또는 20px 하한을 적용합니다. 가변 열 너비와 메뉴 여백으로 좁은 웹 화면에 맞춥니다.

추천 조합은 초상화 5개를 가까이 모은 간략 보기를 기본으로 표시합니다. 손컨·TP·메모는 위쪽에, 성급과 기대딜은 초상화 옆에 표시하며 상단에서 전체 상세 보기로 전환할 수 있습니다. 간략·상세 선택은 해당 브라우저에 기억합니다. 4단계의 ‘3타 분배’는 선택한 월에 등록된 조합의 기대딜 합계가 높은 보스 분배 5개를 계산합니다. 내 캐릭터는 하루 한 번만 사용하고 타당 서포트 한 명을 빌리는 조건을 적용합니다. 반드시 빌려야 하는 캐릭터는 `[이름]`으로 표시하며, ‘자유’는 중복이 없어 누구든 한 명 빌릴 수 있는 편성입니다. 서로 다른 보스 세 곳을 기본으로 추천하고, 선택을 해제하면 같은 보스 재타격도 허용합니다.

택틱 작업실은 보스 번호 순서로 묶고 각 보스 안에서 기대딜이 높은 순서로 표시합니다. 기대딜 미입력은 해당 보스의 마지막에 배치하며, 같은 수치는 기존 순서를 유지합니다. 기대딜을 수정하면 목록 순서도 즉시 갱신합니다.

가독성 스타일은 기존 표의 열 폭을 유지하면서 PC 본문 16px·모바일 본문 15px를 사용합니다. 간략 조합은 초상화 크기를 유지하고 오른쪽에 성급·기대딜을 강조하며, 1000px 이상에서는 두 열로 배치합니다. 이월 시간 입력은 16px로 표시해 iOS 입력 확대를 방지하고 초기화 버튼은 비활성 상태에서도 글씨를 읽을 수 있게 합니다. 규칙의 단계 선택은 한 줄을 유지합니다.

상단 접속자 수는 익명 브라우저 단위입니다. 동일 브라우저의 여러 탭은 같은 식별자를 사용하며 20초마다 접속 상태를 갱신합니다. 마지막 갱신 후 60초가 지난 브라우저는 집계에서 제외합니다. 이름이나 IP 주소를 저장하지 않으며, D1의 `clan_presence` 테이블에는 임의 식별자와 마지막 접속 시각만 보관합니다. 서버 오류 시 0명으로 잘못 표시하지 않고 `—`를 표시합니다. 새 서버에는 `drizzle/0002_regular_dreaming_celestial.sql`을 적용해야 합니다.


## 메뉴 SD 일러스트

메뉴 8개에 가로형 SD 그림을 배치합니다. 추천 조합에는 리리(서머), 스페어에는 티아를 사용합니다. 전신 11명과 전체 해상도 그림은 `public/images/menu-sd/`에 분류해 보관합니다. 메뉴별 장면, 폴더, 공식 참조와 제작 프롬프트는 [artwork/menu-sd/README.md](artwork/menu-sd/README.md)에 있습니다. 현재 메뉴의 작은 이미지 한 장만 로드합니다.

## 개인 화면 설정

설정 → 화면 · 글자 크기에서 100~200%를 5% 단위로 조절합니다. 선택은 해당 브라우저에만 저장되며 클랜 공유 상태나 배틀로그를 변경하지 않습니다. 모바일 기본은 일반 글씨 110%, 하단 메뉴 글씨·아이콘 115%이며 일반 글씨는 정수 px로 반올림합니다. 개인 확대는 이 기본 크기에 이어 적용하므로 설정을 높여도 글씨가 줄어들지 않습니다. 택틱 본문과 체크박스는 일반 확대 보정에서 제외하며, 이전 모바일 115% 사용값은 택틱 전용 값으로 보관합니다. 화면 정보 복사는 현재 본문 너비, 브라우저 안쪽 너비, 글자 크기를 복사합니다. 너비는 CSS px 기준이며 모니터의 물리 픽셀 수와 다를 수 있습니다.

`node scripts/build-display-styles.mjs`는 HTML에 연결된 CSS의 글자 크기와 미디어 쿼리 순서를 보존해 개인 확대 스타일을 만듭니다. 상대 단위·상속·배틀로그 크기 변수는 중복 확대하지 않습니다. PC 메뉴 최소 크기는 16 CSS px입니다. 브라우저 너비 1920px 이상·픽셀 배율 1.49 이하에서는 본문 18px/일반 글씨 14px/메뉴 18px, 너비 3200px 이상에서는 본문 22px/일반 글씨 16px/메뉴 20px 하한을 적용합니다. 이는 물리 모니터 크기가 아니라 브라우저 환경을 기준으로 하며, 사용자 확대는 이 하한보다 크게 적용할 수 있습니다. 기본 CSS를 바꾸면 확대 스타일도 재생성합니다. `build-pages.mjs`는 복사 전에 이 작업을 자동 실행합니다.

검증: `node scripts/test-display-settings.mjs` · `node scripts/test-presentation.mjs` · `node scripts/test-workflow.mjs` · `node scripts/test-pages.mjs`.


이미지 일괄 등록 검토 화면은 등록 체크 변경 즉시 선택 건수와 등록 버튼 상태를 갱신합니다. 검증: `node scripts/test-battle-image-import.mjs` · `node scripts/test-battle-image-parser.mjs`.
