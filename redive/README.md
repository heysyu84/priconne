# 냥냥클랜 Re²:Dive

냥냥클랜의 새 화면 소스입니다. 운영 주소는 https://priconne.pages.dev/ 이며 기존 화면은 같은 주소의 `/legacy.html`에 유지합니다. 두 화면은 기존 운영 API 한 곳의 배틀로그·택틱·추천 조합·명단·과거 기록을 함께 사용합니다. 초기 시제품의 10월 자료는 개발 참고 자료이며 운영 서버에 자동으로 덮어쓰지 않습니다.

## 화면

- 클랜전: **상황판 → 대시보드 → 배틀로그**. 상황판은 보스 HP·단계·회차, 남은 기본 타수, 이월과 보스별 공격을 HUD로 표시합니다. 대시보드에는 크기가 같은 일반·이월 박스와 오버킬로 계산한 미사용 이월 초를 표시합니다. 클랜원·잔여·이월 표 제목을 눌러 정렬합니다.
- 배틀로그: 클랜원·보스 검색, 영문 이름 우선·한글 자판 검색, 방향키 이동, 피해량 Enter 등록 후 이름칸 복귀, 가산점, 표 안에서 클랜원·보스·피해량·가산점 수정 및 이월타 체크박스, 행 끝의 이동·삭제·앞뒤 추가, 실행 취소, 화면 순서에 맞춘 드래그 이동, 상세 열 가로 스크롤, 50건 단위 목록, CSV, 일차 마감, 이미지 OCR 검토·등록.
- 택틱: 추천 분배·비우기를 같은 상단 버튼으로 전환하고 선택 수·복사를 함께 표시합니다. 지원 캐릭터 선택, 같은 카드 안에서 본문 펼치기, 일반·이월 택틱, SET 표 편집·자동 계산, 원본 색상 보존, 동영상 버튼, XLSX 시트 변환, 해외 택틱 변환, 이름 연속 입력과 위치 순서 확인. 본문 진행 표시는 클릭·위아래 키로 이동하며 포커스를 잃거나 새로고침해도 유지합니다.
- 이월 계산기: 외부 택틱 시간 변환과 원문 임시 저장, 접힌 소형 이월 계산기, 정밀한 시간·구간 변환.
- 기록: 모바일 통합 정렬 표, 웹 지표별 순위, 개인 이력과 일차별 좌우 막대, 종합·2·3·4단계 보스 비중 원그래프, 월 전체 공격 상세를 포함한 A4 한 페이지 PDF 보기·저장.
- 명예의 전당: 월별 결과·클랜 순위 편집과 확정. 수상 횟수는 인게임·기여도·피해량 순서입니다.
- 클랜 DB: 현재·역대 명단, UID와 소속 기간, 복수 가입 이력, 기여도 배율, 미래 보스 편성 자동 자료와 수동 수정, 관리자 캐릭터·초상화 관리.
- 설정: 전체 문구 편집, 월별 보스 HP와 회차·배율, 3단계 추천 자동 숨김, 백업·복원, 글자 크기 90·95·100·105·110%. 100%는 이전 시제품의 110%에 해당합니다. 변환기·초상화·숨김·삭제함 등 편집 도구는 관리자에게만 노출합니다.

최대 웹 폭은 850px이며 제목과 버튼을 굵게 표시하고, 보스색·두 가지 명암·초상화 테두리로 구분합니다. 상황판과 그래프, 택틱 기대딜, 기여도 상위 기록의 만 단위 표시를 제외한 수치는 축약하지 않습니다.

상단 접속자 수는 기존 화면의 `/api/presence`와 `nyang-browser-presence` 식별자를 재사용합니다. 최근 1분 내 브라우저 수이며 같은 브라우저의 여러 탭과 두 화면을 중복 집계하지 않습니다.

## 운영 데이터와 권한

`docs/index.html`의 `nyang-legacy-api-origin` 메타가 원래 운영 서버를 지정합니다. `legacy-shared-client.mjs`는 기존 API와 관리자 비밀번호·세션 규약을 사용합니다. 열람은 공개이며 편집은 서버의 비밀번호 검증을 통과해야 합니다. 2.5초마다 변경을 확인하며, 다른 창에서 먼저 저장한 경우 덮어쓰지 않고 충돌을 알립니다. 이전 화면 전용 필드와 변경하지 않은 과거 월을 보존합니다.

운영 데이터 원본을 복사해 별도 운영 저장소로 만들지 않습니다. 사이트를 다시 빌드하거나 배포해도 운영 기록을 변경하지 않습니다. 환경값·비밀번호·토큰을 정적 파일에 넣지 않습니다.

기존 비공개 Sites 시제품은 메타가 없을 때만 별도 D1을 사용합니다. 공개 운영 화면과 비공개 개발 시제품의 저장 경로를 혼동하지 않아야 합니다.

## 빌드와 확인

```sh
node scripts/prepare-server.mjs
node scripts/check.mjs
node scripts/check-shared.mjs
node scripts/check-shared-client.mjs
node scripts/check-future.mjs
node scripts/check-usability.mjs
node scripts/check-ui-fixes.mjs
node scripts/check-inline-logs.mjs
node scripts/check-entry-keyboard.mjs
node scripts/check-lineup-input.mjs
node scripts/check-presence.mjs
REDIVE_LEGACY_SOURCE=../clan-battle node scripts/check-migration.mjs
node scripts/compat/test-battle-image-parser.mjs
node scripts/compat/test-external-tactic-carry.mjs
node scripts/compat/test-carry-sheet-converter.mjs
```

공개 정적 빌드는 저장소 루트에서 `node clan-battle/scripts/build-pages.mjs docs`를 실행합니다. 기존 정적 자산과 API 설정을 유지하면서 `legacy.html`, 새 `index.html`, `compact/`를 생성합니다. `docs/future-bosses.json`은 기존 월말 자동 갱신을 그대로 사용합니다. GitHub 원본 주소의 화면은 Cloudflare 주소로 이동하며 두 버전 이동 버튼도 Cloudflare 주소를 사용합니다.

마이그레이션 검사는 원래 API 라우트를 SQLite에서 실행해 인증 거부, 정확한 정수와 가산점, 삭제함, 양쪽 방향 저장, 과거 월 보존, 동시 저장 충돌을 확인합니다. 실서버 기록에는 시험 쓰기를 하지 않습니다. 이전 UI 검증은 모바일 320·360·390·430px와 웹 769·850px에서 헤더·명단 폭, 추천 분배·비우기, 링크 박스, 상세 기록 가로 스크롤, 행 앞 추가·이동, 피해량 Tab 이동을 브라우저로 확인했습니다. 표 직접 편집·제목 정렬·화면 순서 이동 수정은 사용자 요청에 따라 스크린샷 확인을 생략하고 회귀 검사로 검증했습니다. PDF는 실제 생성기로 A4 한 장을 만들어 렌더링했습니다. 실제 iOS 기기와 실제 게임 스크린샷 OCR의 판독 정확도는 별도 실사용 확인이 필요합니다.

캐릭터 위치 351개는 pcrdfans의 실제 정렬 자료를 출처와 함께 `data/character-positions.json`에 보관합니다. 작은 위치값일수록 전열이며 게임에서 오른쪽입니다. 한국어 별칭은 `character-unit-map.json`, 이월 영상 링크는 `tactic-video-links.json`에 보관합니다. 기존 계산·변환 도구는 `public/compat/README.md`, 이미지 출처는 `public/assets/credits.txt`를 참고하세요.
