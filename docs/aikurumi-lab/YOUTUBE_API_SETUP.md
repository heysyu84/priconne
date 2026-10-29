# YouTube 설명란 연동 — 독립 검증 브랜치

이 기능은 냥냥클랜 운영 사이트나 DB를 변경하지 않습니다.

## 현재 가능한 기능
- aikurumi 2025-10 후기 단계의 유튜브 링크 113건에서 중복 제외 **65개 영상 ID**를 수집합니다.
- `redive/scripts/aikurumi-youtube-api.mjs`에서 YouTube Data API v3 `videos.list(part=snippet)`로 공개 영상 설명란을 조회합니다.
- 이 API 모듈은 **서버/GitHub Actions에서만 실행**합니다. 웹페이지에는 API 키가 들어가지 않습니다.
- 전체 설명란을 공개 GitHub 저장소/웹사이트에 자동 게시하지 않습니다.
- 테스트 페이지 `/aikurumi-lab/`에서 영상 설명란을 직접 복사해 붙여넣으면, 해당 편성과 한국어 ID 매칭을 사용하여 **브라우저 메모리에서만** 변환 결과를 확인합니다.

## API 키 준비
1. Google Cloud Console에서 프로젝트를 만들고 YouTube Data API v3를 활성화합니다.
2. Google Cloud에서 API 키를 생성하고 API 제한은 YouTube Data API v3로 지정합니다.
3. GitHub 저장소 `heysyu84/priconne` → **Settings → Secrets and variables → Actions → New repository secret**에서
   이름을 정확히 `YOUTUBE_API_KEY`로 저장합니다. 이 값은 채팅이나 저장소 파일에 입력하지 않습니다.
4. 기존 테스트 브랜치 GitHub Actions 실행 **YouTube descriptions via official API (isolated, read-only)**를 재실행하면,
   공식 API 조회를 수행합니다. 키가 없을 때는 `YOUTUBE_KEY_NOT_CONFIGURED`를 표시하고 안전하게 건너뜁니다.

## 확인 가능한 결과
- GitHub Actions 로그에 `YOUTUBE_AUDIT_COUNTS` (요청/수신/설명란 보유/예상 TL 건수)만 기록합니다.
- 필요한 경우 생성되는 `aikurumi-youtube-audit-metadata` 아티팩트도 영상 ID/검사 지표만 포함합니다.
- 설명란 전체 텍스트는 액션 로그·공개 배포 파일·아티팩트에 저장하지 않습니다.

## 미구현 및 주의 사항
- 공식 API 인증을 이용한 **실제 YouTube 설명란 수신은 아직 검증하지 못했습니다.**
- 유튜브 설명란을 자동으로 관리자 전용 DB에 저장하거나 사이트 내 택틱으로 자동 등록하지 않습니다.
- 공개 영상이라도 설명란에 TL이 없을 수 있습니다. 'TL 가능성'은 단순 감지이며 정답 인증이 아닙니다.
- 추후 자동 가져오기를 완성하려면 **인증된 관리자용 서버/보관 경로**와 출처 표시, 변경·중복 검토 절차가 필요합니다.
