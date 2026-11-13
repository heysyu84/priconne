# YouTube 설명란 수집 설정

운영 화면의 관리자 외부 택틱 검수에 사용하는 수집 설정입니다.

1. Google Cloud에서 YouTube Data API v3를 활성화하고 해당 API로 사용 범위를 제한한 키를 만듭니다.
2. 저장소의 Settings → Secrets and variables → Actions에 `YOUTUBE_API_KEY`라는 Secret으로 저장합니다. 키는 소스·정적 배포 파일·채팅에 넣지 않습니다.
3. `.github/workflows/refresh-aikurumi-youtube-candidates.yml`의 수동 실행이나 기존 예약 실행으로 수집합니다.

`redive/scripts/aikurumi-youtube-api.mjs`는 GitHub Actions에서 공개 설명란을 조회합니다. 자동 갱신은 한국시간 08:20에 실행하며 운영 DB에 택틱을 자동으로 등록하지 않습니다. 변환 결과를 관리자가 검토·확인한 뒤 적용합니다. `/aikurumi-lab/`는 같은 검수 모듈을 사용하는 별도 확인 화면입니다.

원문 전체와 키는 정적 파일·로그·아티팩트에 게시하지 않습니다. 영상에 일본어 TL이 있는지 확인하고, 수집 실패나 만료를 중국어 TL로 자동 대체하지 않습니다. 수집·변환 실패 상태는 검수 화면에서 확인합니다.

검증: `node --test redive/scripts/test-aikurumi-*.mjs`.
