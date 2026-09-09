# 게스트 인증 연결 (2026-09-07)

## 구현된 범위

- 사용자가 승인한 `@supabase/supabase-js`, `jose`, `pg`를 server 워크스페이스에 설치. SDK 요구 사항에 맞춰 Node 최소 버전 22로 갱신.
- `POST /auth/session`: 최초 익명 계정 생성 / 기존 세션 갱신. SDK는 서버에서만 사용해 웹 번들에 DB 도구를 포함하지 않는다.
- 웹: 같은 출처의 `/auth/session`을 호출, 갱신 토큰은 Secure/HttpOnly/SameSite=Strict 쿠키. 접근 토큰만 메모리에 보관. 탭 간 Web Locks로 갱신을 직렬화.
- iOS: 기존 Capacitor에 앱 내부 플러그인을 등록. 갱신 토큰은 Keychain의 ThisDeviceOnly 항목에 저장하며 원격 웹페이지의 접근은 거절한다. 갱신 실패 시 새 게스트를 자동 발급하여 기존 ID를 잃게 하지 않는다.
- 서버: Supabase JWKS의 ES256/RS256 서명, issuer/audience/role/만료/session_id 검증. DB에서 세션 폐기·사용자 차단·플레이어 상태를 확인한 뒤 내부 UUID를 매핑한다.
- DB: 비공개 스키마의 players와 identities, 동시 생성 잠금과 유일성 제약, 공개 코드 충돌 재시도. 공개 프로필에는 nickname/publicCode만 포함.
- WebSocket: 인증 전에 방 목록·생성·참가·착수 거절, 동일 계정의 동시 연결 거절, 다른 사용자의 빈 자리 인수 차단, 토큰 갱신 시 같은 ID만 허용. 기본 메시지·연결·방 수 제한.

## 현재 활성화 상태

Supabase 프로젝트 `daeguk-dev` (`ajmrlhfhrcsstauqgnip`, Oregon)는 생성됐고 anonymous sign-ins는 켜졌다.
사용자 승인 후 `001_identity.sql`을 개발 프로젝트에 적용했다. 테이블/RLS, 서버 NOLOGIN 역할, 서버 테이블 권한, 클라이언트 스키마/테이블 차단, 세션 함수 권한, 존재하지 않는 세션 거절, 정책, 유일성/참조 제약의 9개 SQL 검증이 모두 true였다.
DB 로그인 역할과 로컬 server/.env 설정을 완료했고 실제 Supabase를 통한 서버 인증 통합 검증을 통과했다. 운영 환경변수와 웹 호스트의 동일 출처 프록시는 아직 적용하지 않았다.
따라서 `js/auth-config.js`의 `enabled`는 false이고 서버의 기본 AUTH_MODE는 legacy다.
운영 서버 주소와 배포 소스는 Render 관리 화면에서 확인했다(아래 서버 설정 상태 참고).

## 다음 연결 순서

1. **적용 완료:** 개발 프로젝트 SQL Editor에서 `server/migrations/001_identity.sql` 실행 및 DB 구조/권한 9개 검증 통과.
   - 비공개 테이블과 NOLOGIN 그룹 역할 `daeguk_server`를 만든다. 기존 게임/사용자 데이터를 삭제하지 않는다.
   - 마이그레이션의 권한 변경은 실행 전에 사용자 확인을 받는다.
2. 관리자가 별도의 DB 로그인 역할을 만들고 `daeguk_server` 그룹만 부여한다.
   - 로그인 비밀번호는 대시보드/안전한 비밀 관리 도구에서 직접 지정한다. SQL 파일·채팅·Git에 넣지 않는다.
   - 앱에 postgres 관리자 비밀번호나 service_role/secret 키를 넣지 않는다.
3. 서버에 `server/.env.example`의 값 설정. `DATABASE_URL`은 Supabase Connect의 pooler 연결 정보를 기준으로 전용 로그인 역할을 사용한다. TLS `sslmode=verify-full` 필수. 자동 적용 마이그레이션은 없다.
   - `SUPABASE_PUBLISHABLE_KEY`는 공개용 키이다. JWT 서명 키는 Supabase의 비대칭 키를 사용한다.
   - 실제 서비스 origin만 `AUTH_ALLOWED_ORIGINS`에 지정. iOS는 `capacitor://localhost`.
   - 로컬 예: `AUTH_ALLOWED_ORIGINS=http://127.0.0.1:4185,capacitor://localhost`, `AUTH_INSECURE_LOCALHOST=true`.
   - 웹 개발 서버는 `AUTH_PROXY_TARGET=http://127.0.0.1:4175 node scripts/serve.mjs`로 실행한다. 로컬 프록시도 Origin과 쿠키를 보존한다.
   - 로컬에서 Node 22 이상으로 `node --env-file=server/.env server/server.js` 실행 가능.
4. 웹 호스트에서 `/auth/:path*`를 인증 서버의 `/auth/:path*`로 reverse proxy한다.
   - 프록시는 Origin과 Set-Cookie를 보존한다. 브라우저가 Render 도메인으로 직접 쿠키 요청하는 구성으로 대체하지 않는다.
   - Vercel에서는 실제 인증 서버를 확인한 뒤 rewrites를 구성한다. 현재 저장소에는 미확인 서버로 연결하는 프록시를 추가하지 않았다.
5. 스테이징 클라이언트의 `js/auth-config.js`에서 URL을 확인하고 `enabled: true`로 전환한다. socketUrl은 정확한 허용 서버 하나이며 query/localStorage로 바꾼 서버에 토큰을 보내지 않는다.
6. `npm run ios:sync` 후 실제 iPhone에서 최초 로그인 → 종료·재실행 → 같은 공개 ID 유지 확인.

## 검증 및 출시 전 남은 경계

- `npm test`: JWT 변조/만료/다른 발급자/잘못된 audience, 쿠키·Origin, Keychain 어댑터, 무인증 WS 거절·중복 계정·자리 탈취·세션 폐기 등을 검증한다. HTTP/WS 일부 테스트는 주입한 인증 서비스로 동작하며 실제 Supabase 통합 검증을 대신하지 않는다.
- 실제 PostgreSQL에 SQL을 적용한 뒤 동시 로그인으로 동일 player_id 보장, 공개 코드 충돌, 세션 삭제/계정 차단 시 즉시 거절을 확인해야 한다.
- CAPTCHA는 Supabase가 권장한다. 게임의 Turnstile UI·운영 사이트 키·HTTP captchaToken 전달을 연결했고 Supabase CAPTCHA 보호를 활성화했다. 누락/잘못된 토큰 거절을 실제 API에서 확인했다. 공개 웹의 정상 CAPTCHA 통과와 인증 배포 검증은 남아 있다.
- 프록시 뒤에서는 IP 제한이 프록시 전체에 적용될 수 있다. 현재 보수적인 개발 제한은 세션 요청 30회/분, 최초 게스트 5회/시간/접속 IP다. 실제 ingress 신뢰 범위와 CAPTCHA를 정한 뒤 다중 사용자 부하 시험으로 조정한다. 클라이언트가 보낸 X-Forwarded-For를 무조건 신뢰하지 않는다.
- 서버 재시작을 견디는 경기 복구·전적/랭킹 테이블과 점수 계산은 다음 단계다. 현재 경기는 계속 메모리에 저장된다.
- Android 프로젝트/Keystore 연동은 아직 없다. 보안 저장소가 없으면 네이티브 인증은 실패하도록 한다.
- 게스트 복구·계정 연결/삭제 UI와 분실 안내, 중복 기기 정책의 제품 문구는 공개 배포 전에 정리해야 한다.

참고: https://supabase.com/docs/guides/auth/auth-anonymous · https://supabase.com/docs/guides/auth/jwts

## 서버 전용 로그인 설정 진행 상태

- Supabase에서 `daeguk_login` 로그인 역할을 생성했고 `daeguk_server` 그룹을 연결했다. 연결 한도 10, superuser/role 생성/DB 생성/RLS 우회 없음. DB 조회 `role_ready=true` 확인. 전용 비밀번호와 로컬 환경 파일 설정 완료. 2026-09-08 실제 TLS 로그인 및 최소 권한 검사 통과.
- Render 관리 화면 확인: 서비스 `daeguk-server` (`srv-d8rea8mrnols73fat800`), Oregon, 무료 플랜, `parkboa/unknown-kingdom` main, 최근 성공 커밋 `297ff676e8b137a28fb6d1782d3a0379ae32e1f2`, Root Directory 비어 있음, build `npm ci`, start `npm start --workspace=server`. 도메인 `unknown-kingdom-server.onrender.com`의 연결 소스가 관리 화면에서 확인됨.
- Supabase 세션 풀러: `aws-0-us-west-2.pooler.supabase.com:5432`, DB postgres, 전용 접속 사용자 `daeguk_login.ajmrlhfhrcsstauqgnip`.
- `node scripts/setup-db-login.mjs`는 사용자가 터미널에서 비밀번호를 직접 입력하는 도구다. 기존 postgres 비밀번호는 메모리에서만 사용하고, 새 전용 비밀번호의 SCRAM 검증자만 DB에 전달한다. 새 비밀번호는 사용자가 비밀번호 관리자에 보관한다. 평문 비밀번호를 SQL Editor에 입력하지 않는다.
- 도구는 원격 TLS 인증서 확인을 유지하고 계정 권한 검사 후 전용 계정 비밀번호를 설정한다. `server/.env`를 0600 권한으로 생성하며 기존 파일을 덮어쓰지 않는다. 성공 후 전용 계정 접속·최소 권한을 검증한다. 로컬 HTTP용 쿠키 설정은 Render로 복사하지 않는다.
- 전용 비밀번호·실제 DB 접속·로컬 환경 파일 생성 완료. Render 환경변수 저장은 아직이다.

### DB 인증서 검증

`server/certs/prod-ca-2021.crt`는 사용자가 Supabase 대시보드에서 내려받은 공개 CA 인증서다. 설정 스크립트는 이 인증서로 TLS 체인과 호스트를 검증하고, 생성하는 DATABASE_URL에 `sslmode=verify-full` 및 `sslrootcert` 절대 경로를 포함한다. 배포 시에는 인증서 경로를 해당 서버의 경로로 변경해야 한다. 인증서 검증은 끄지 않는다.

`28P01` 발생 시 기존 설정 스크립트를 반복 실행하지 말고 `node scripts/diagnose-db-login.mjs`로 읽기 전용 진단한다. 기존 postgres 비밀번호를 숨김 입력하며 DB SCRAM 검증자와 로컬 전용 비밀번호의 일치 여부, 풀러 인증 챌린지 일치 여부, 실제 로그인 결과만 출력한다. 비밀번호·검증자·연결 URL은 출력하거나 변경하지 않는다.

### SCRAM 반복 횟수 호환성 수정 (2026-09-08)

DB 검증자 32768회와 실제 Supavisor 챌린지 4096회의 불일치를 확인했다. 초기 스크립트의 32768 설정을 4096으로 수정했다. 기존 환경은 `node scripts/repair-db-login.mjs`를 실행하여 관리자 비밀번호를 숨김 입력한다. 로컬 비밀번호 일치를 먼저 검증하고 동일 비밀번호의 검증자만 4096회로 재계산하여 저장한다. 환경 파일과 계정 권한은 유지하며 수정 후 로그인과 최소 권한을 확인한다. 4096 상태에서는 수정 없이 재검증만 한다.

2026-09-08 복구 후 저장된 `server/.env`의 전용 계정으로 재접속해 로그인·players SELECT/INSERT 허용·DELETE 금지·존재하지 않는 세션 거부를 모두 확인했다(`LOGIN_AND_PERMISSIONS_OK=true`). 복구 직후 사용자 실행은 28P01이었지만 이후 재검사에서 성공했다. 운영 Render 환경변수와 실제 게스트 인증 연동은 별도 진행한다.

### 실제 서버 인증 통합 검증 (2026-09-08)

`node scripts/verify-live-auth.mjs` 실행 통과. 로컬 HTTP/WS 서버와 실제 daeguk-dev를 사용했고 개발용 게스트 1명이 생성됐다. 최초 로그인, players/identities 저장, HttpOnly 쿠키를 통한 갱신, 서버 재시작 후 동일 공개 코드·내부 ID 복원(중복 매핑 없음), WebSocket 인증 및 방 목록 조회를 확인했다. 비밀번호와 토큰은 출력하지 않는다. 실행할 때마다 개발 게스트 1명을 생성하므로 일반 테스트에는 포함하지 않는다.

이 검증은 실제 브라우저의 쿠키 처리·게임 화면 또는 iPhone Keychain 동작을 검증하지 않는다. 다음 단계는 로컬 웹 프록시와 클라이언트를 연결한 브라우저 검증이다.

### 실제 브라우저 인증 검증 (2026-09-08)

`node scripts/verify-live-auth-browser.mjs` 통과. Chromium에서 실제 게임의 온라인 버튼을 눌러 Supabase 로그인, 동일 출처 프록시의 HttpOnly/SameSite 쿠키 저장, JavaScript 쿠키·localStorage의 토큰 비노출, 새로고침 후 동일 공개 ID 재인증, 대국장 생성과 대기실 표시를 검증했다. 공개 auth-config 모듈만 테스트용 로컬 주소로 대체했으며 인증 HTTP/WS 응답은 모킹하지 않았다. 저장소의 운영 인증 enabled:false는 유지한다. 첫 실행은 상대 연결 표시를 서버 연결 표시로 오인한 테스트 조건으로 실패했으며 실제 접속 완료 문구로 수정 후 통과했다. 결과 화면: artifacts/live-auth-browser.png. iPhone Keychain과 운영 HTTPS Secure 쿠키/프록시는 아직 검증 전이다.

### 배포 설정 준비 (2026-09-08)

- `server/.env.render`: 로컬 환경에서 전용 DB 자격증명을 가져온 0600/Git 제외 파일. Render의 Environment → Add from .env에 가져온 뒤 **Save only**로 저장한다. NODE_VERSION=22, 운영 origin, Secure 쿠키 기본값을 사용한다. 인증서 경로 `certs/prod-ca-2021.crt`는 `npm start --workspace=server`의 작업 디렉터리를 기준으로 한다. 로컬 HTTP 옵션은 포함하지 않는다.
- `vercel.json`: 기존 공개 자산 복사 빌드를 사용하고 dist-mobile만 게시한다. `/auth/:path*`는 확인된 Render URL로 전달하며 캐시를 금지한다. `.vercelignore`는 로컬 환경 파일과 검증 결과물을 업로드에서 제외한다.
- 빌드·환경 구성·인증서 경로·공개 출력의 서버/비밀 파일 제외 검증 완료. 원격 환경변수 저장과 코드 배포는 아직 완료되지 않았다.
- 활성화 전 남은 사항: 공개 게스트 발급 CAPTCHA, 프록시에서의 다중 사용자 제한, 기존 클라이언트와 새 서버의 전환 순서를 정리해야 한다. 현재 웹의 enabled:false 상태에서 인증 필수 서버만 먼저 배포하면 온라인 접속이 끊기므로 전환 배포를 따로 진행한다.

2026-09-08: 사용자 확인으로 Render 최초 환경변수 Save only 저장 완료(배포 미실행). 이후 스크린샷에 보인 전용 비밀번호를 rotate-db-login.mjs로 자동 생성 값으로 교체했고 새 로그인·최소 권한 검증 통과. 로컬 .env와 .env.render는 갱신했으며 Render에 저장된 DATABASE_URL은 새 파일 값으로 다시 저장해야 한다. 교체 스크립트는 중단 복구를 위해 Git 제외·0600 pending 파일을 먼저 기록하고 DB 변경 후 원본 환경 파일로 이름을 바꾼다.

### CAPTCHA 연결 준비 (2026-09-09)

- `js/captcha.js`: 최초 게스트 생성 시 Turnstile 인증 대화창. 한국어/영어, 취소/Escape, 로딩 실패·만료·재시도와 위젯 정리 지원. 새 패키지 의존성 없음.
- `js/auth.js`: 기존 세션이 없을 때만 CAPTCHA를 요청하고 토큰을 가입 요청에 전달한다. 갱신 실패는 새 계정으로 대체하지 않는다. 취소나 빈 토큰은 가입 요청을 보내지 않는다.
- `js/network.js`: CAPTCHA 완료 뒤 WebSocket을 열어 서버의 20초 인증 제한에 걸리지 않도록 한다. 연결 전 취소된 세션은 소켓을 열지 않는다.
- Cloudflare `DAEGUK guest login` 위젯 생성 완료. Managed 모드, 허용 호스트 `unknown-kingdom.vercel.app`, pre-clearance 꺼짐. 공개 site key는 `js/auth-config.js`에 연결했고 비밀 키는 Supabase에만 저장했다. Supabase Turnstile 보호 활성화 완료. 웹 `enabled:false` 유지, Render/Vercel 코드 배포는 미실행.
- 다음 작업: Render/Vercel 전환 배포 및 운영 브라우저 최초 로그인·새로고침·방 생성 확인. 배포 전 프록시 뒤 요청 제한과 기존 클라이언트 전환을 검토한다. secret key는 저장소에 넣지 않는다.
- iOS의 `capacitor://localhost`는 일반 HTTPS 웹사이트가 아니므로 별도의 지원되는 CAPTCHA 연결 방식을 검증해야 한다. 웹 검증을 iOS 검증으로 간주하지 않는다.
- 검증: `npm test`, 인증/CAPTCHA 브라우저 테스트 4개, `npm run build:mobile`, `git diff --check` 통과. CAPTCHA 브라우저 테스트는 위젯/인증 응답을 모킹하며 실제 Cloudflare/Supabase 검증을 대신하지 않는다.

2026-09-09 실제 Supabase `/auth/v1/signup` 검증: CAPTCHA 누락과 잘못된 토큰 모두 HTTP 400 / `captcha_failed`로 거절됨. 공개 사이트 키 연결 후 `npm run build:mobile`, `git diff --check` 통과. 정상 사용자 CAPTCHA 통과와 운영 로그인은 배포 후 확인할 항목이다.
