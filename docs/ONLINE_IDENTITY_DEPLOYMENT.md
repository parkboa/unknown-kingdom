# 게스트 인증 착수와 배포 선택

2026-09-06 최초 검토.

2026-09-07 갱신: 사용자가 Supabase와 supabase-js/jose/pg 설치를 승인했다. 개발 프로젝트와 익명 로그인이 준비됐고 로컬 인증 코드·검증을 추가했다. 최신 적용 절차와 미완료 항목은 `GUEST_AUTH_SETUP.md`를 따른다. 아래 비용·구성 비교와 착수 기록은 최초 검토 시점의 기록이다.

## 확인된 환경

- 웹: README의 Vercel 주소 `https://unknown-kingdom.vercel.app`.
- 게임 서버: `https://unknown-kingdom-server.onrender.com/health`가 실제로 `{ok:true,rooms:0}` 응답. 이 응답만으로 배포 커밋·플랜·리전을 확인할 수는 없다.
- 이 저장소의 render.yaml은 무료 Node 서버, 루트 npm ci, server 워크스페이스 시작을 지정한다. 서비스 이름은 daeguk-server로 실제 도메인과 달라 Render 관리 화면에서 연결 저장소·브랜치·Root Directory·빌드/시작 명령·리전·플랜을 확인해야 한다. 인접한 구형 서버 저장소와 혼동하지 않는다.
- 현재 server의 외부 의존성은 ws이며, DB 드라이버·영구 계정 저장·인증은 없다. rooms Map은 서버 재시작 때 소실된다.
- iOS는 Capacitor 7이며 보안 토큰 저장소는 아직 없다. 일반 Preferences/localStorage를 갱신 토큰 저장소로 대신 사용하지 않는다.

## 선택지와 비용

| 선택 | 장점 | 추가 부담 |
| --- | --- | --- |
| Render PostgreSQL + 서버 인증 | 기존 호스팅과 같은 운영처, 서버와 같은 리전의 DB | 토큰 회전·탈취 재사용 감지·계정 연결을 직접 구현/운영. pg 드라이버 필요 |
| Supabase PostgreSQL + Supabase Auth | 익명 로그인과 이후 로그인 연결을 관리형 인증으로 처리 | 별도 서비스 설정, SDK와 서버 토큰 검증, CAPTCHA, 네이티브 보안 저장 연동 |

추천은 **Supabase Auth + PostgreSQL로 개발 검증**, 기존 Render 서버가 대국 판정과 전적 쓰기를 계속 소유하는 방식이다. 게임 player_id는 인증 제공자의 ID와 분리해 제공자를 바꾸거나 로그인 수단을 추가해도 전적의 주인이 바뀌지 않게 한다.

- Supabase Free: 월 $0, DB 500MB·월 활성 사용자 5만 명 한도, 비활성 프로젝트 일시정지 조건 있음. Pro는 월 US$25부터. 실제 운영에서는 백업·중단 정책까지 검토한다. https://supabase.com/pricing
- Render는 공식 2026년 7월 예시에서 상시 웹 서버+소형 PostgreSQL을 약 US$13/월로 안내한다. 저장 용량·트래픽·세금 등 별도이며 결제 직전 현재 가격을 확인한다. https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses
- Render 무료 PostgreSQL은 30일 만료이므로 출시용 영구 전적 저장소로 쓰지 않는다. 무료 웹 서버의 유휴 중단도 온라인 대국 운영에 고려한다. https://render.com/docs/free
- SQLite 파일을 현재 Render 임시 파일시스템에 저장하는 방식은 재배포/재시작 시 유실될 수 있어 제외한다. https://render.com/docs/faq

## 새 의존성 승인 후 구현 순서

Supabase 선택 시 @supabase/supabase-js를 인증과 서버 DB 접근 후보로, jose를 서버 JWT 검증 후보로 검토한다. 실제 버전·라이선스·번들 크기·Capacitor 호환성을 확인하고 필요한 패키지만 설치한다. 네이티브 보안 저장 플러그인은 별도 비교 후 승인받는다. 패키지 사용료와 클라우드 사용료는 구분한다.

1. 개발/스테이징 프로젝트를 만들고 키는 환경 설정에만 보관한다. 서비스 권한 키는 서버 전용. 앱에 넣지 않는다.
2. 검증된 인증 subject → 내부 player_id 매핑을 트랜잭션/유일성 제약으로 한 번만 만든다. 공개 코드 충돌은 DB 제약으로 거절하고 재발급한다.
3. Auth가 세션과 refresh rotation을 관리하면 별도 자체 refresh 테이블을 중복 구현하지 않는다. 기존 설계 문서의 sessions 초안은 자체 인증 선택에만 적용한다.
4. 브라우저 Vercel/Render 간 쿠키는 서로 다른 사이트이므로 단순 cross-site 쿠키만 전제로 삼지 않는다. same-site API 도메인 또는 BFF를 확정한다. iOS는 Keychain 저장과 메모리 access token을 사용한다.
5. WebSocket 첫 인증 메시지의 토큰을 서버에서 검증한 뒤에만 경기 요청을 받는다. 타임아웃·Origin·메시지 크기/속도 제한을 함께 구현한다. URL에 토큰을 싣지 않는다.
6. 기존 무인증 클라이언트와 서버를 동시에 운영 전환하기 전에 버전 호환/업데이트 전략을 확정한다. 무인증 경기를 인증 전적으로 승격하지 않는다.

익명 계정 생성에도 CAPTCHA와 발급 속도 제한이 필요하다. https://supabase.com/docs/guides/auth/auth-anonymous

## 확장 경계

- players: 내부 UUID PK, public_code UNIQUE, nickname, status, created_at. 닉네임 변경과 계정 정지를 인증 ID 변경 없이 처리한다.
- identities: player_id FK, issuer, subject, UNIQUE(issuer, subject). 클라이언트가 보내는 player_id로 매핑하지 않는다.
- 재접속: match_players가 player_id에 자리를 귀속시키고, 검증된 세션만 해당 자리의 비공개 스냅샷을 읽는다.
- 전적: 서버가 match_id를 발급하고 단일 트랜잭션으로 결과를 확정한다. Supabase를 쓰더라도 클라이언트 전적 쓰기 권한은 주지 않는다. RLS/권한을 기본 거부로 설정한다.
- 랭킹: 시즌·규칙 버전·참가 자격을 분리하고 (match_id, player_id) 유일성으로 점수 중복 반영을 막는다. 산식은 아직 결정하지 않는다.
- SQL 마이그레이션과 동시 생성/회전/폐기 시험은 DB 선택 후 실제 PostgreSQL에서 검증한다. 메모리 테스트 통과를 영구 저장 검증으로 간주하지 않는다.

## 이번에 시작한 코드

server/identity.js에 서버 UUID·암호학적 공개 코드 생성과 공개 프로필 투영을 추가했다. 공개 응답에 내부 ID·인증 비밀이 섞이지 않는 시험을 포함한다. 아직 API나 WebSocket에 연결하지 않았으므로 게스트 인증이 활성화된 상태는 아니다.

다음 결정: DB/인증 제공자와 신규 의존성 승인. 이 지점까지는 비용이 발생하지 않는다. 이후 스테이징 검증을 끝낸 뒤 운영 배포를 별도로 진행한다.
