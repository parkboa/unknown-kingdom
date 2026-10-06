# 인증 제한 수정·운영 검증 — 2026-10-04

## 결과

서버 인증 제한 수정은 운영 배포됐다. PR [#1](https://github.com/parkboa/unknown-kingdom/pull/1)과
[#2](https://github.com/parkboa/unknown-kingdom/pull/2) 모두 병합됐다.
최종 운영 커밋은 `e2f710582b9e18507a33618bdeaca3145c7b5d1a`다.
Render 로그에서 09:48:36 EDT service live, 09:57:17 EDT
`Auth limiter address source: render-client`를 확인했다.
실기기 결과: 사용자는 신규 생성 후 앱 종료·첫 재접속에서 `연결 중`이 계속 보였고,
다시 종료·재접속한 뒤 ID와 온라인 대기실이 표시됐다고 보고했다.
따라서 한도 수정의 운영 확인과 별개로 간헐적 재접속 문제는 남아 있다.
사용자는 첫 시도의 대기 시간이 **10초 미만**이었다고 확인했다. 이때 종료했으므로
15초 HTTP 제한/연결 후20초 서버 인증 제한의 만료나 무한 대기가 실기기에서
확인된 것은 아니다. 첫 시도는 즉시 접속하지 못했고 최종 성공/오류 전에 중단한 관측이다.
같은 계정으로 최대30초의 한 번 재접속 확인을 요청했고 응답 대기다.

## 변경

- `server/client-address.js`: Render runtime에서만 private/loopback ingress의
  유효한 CF-Connecting-IP를 사용한다. public direct peer, 다른 배포 환경,
  누락/잘못된 헤더에서는 socket peer로 대체한다. X-Forwarded-For를 신뢰하지 않는다.
  IPv6 별칭과 IPv4-mapped 주소를 정규화한다.
- `server/auth-http.js`: 신규 생성 시도 제한을 네트워크별 5→10회/시간으로 조정했다.
  실패도 한도에 포함하며 일반 인증 30회/분은 유지한다. 기존 세션 refresh는 신규 생성
  한도에서 제외한다. 로컬 429에 scope, retryAfterSeconds, Retry-After를 추가했다.
  Supabase 429는 upstream 범위의 429로 반환하며 오류 원문은 노출하지 않는다.
- `server/auth.js`: Supabase SDK 오류의 상태를 보존한다.
- `server/auth-rate-limit.test.js`: 중계 주소 공유·헤더 위조·시간 경과·IPv6 별칭·기존
  refresh·삭제 보호·CAPTCHA 전달·SDK upstream429·로그 개인정보 미노출·runtime gate 검증.
- `server/README.md`: 신뢰 경계, 제한 및 운영 확인 방법을 기록했다.

IP 값/쿠키/토큰/본문은 로그에 남기지 않는다. 선택된 source와 주소 클래스/헤더 존재
여부만 종류별 1회, 최대 16개를 기록한다. CAPTCHA·요금제·Supabase 설정·키는 변경하지 않았다.

## 검증

- 운영 기준 전체 시험: 웹 39, 엔진 137 통과. 최초 패치 서버 27 통과.
- 최종 서버 시험: **29/29 통과**, 새 인증 회귀 시험 11개 포함.
- 원격 main과 로컬 출시 준비 커밋이 다른 것을 확인해 서버 파일 5개만 PR에 포함했다.
  기존 출시 커밋·미커밋 자료는 원래 로컬 main에 보존했고 원격 main 수정은 서버만 포함한다.
- 최종 운영 응답 09:57:17 EDT: health 200/239ms/rooms0,
  OPTIONS 204/99ms/Retry-After 노출, create:false POST 401/NO_SESSION/135ms.
  이는 무세션 거부·수정 코드 배포 확인이며 실제 계정 인증 성공 시험은 아니다.
- 위조 CF/XFF 헤더 요청은 앞단 Cloudflare에서 HTML403으로 거부됐다.
  이것만으로 모든 헤더 위조가 차단된다고 판단하지 않는다. 경계는 모의 회귀 시험으로 검증했다.
- 첫 배포 706d0ea는 로그에서 socket-peer fallback이었다. 후속 점검에서 Render의 실제
  peer가 loopback임을 확인했고 이를 처리한 최종 버전은 render-client로 선택된다.
  배포 성공과 사용자별 주소 분리 검증을 구분해 기록했다.
- `git diff --check` 통과. 의존성 신규 추가/변경 없음.
- 기존 npm audit high1은 개발용 Capacitor CLI → rimraf → glob → minimatch →
  brace-expansion5.0.9이며 서버 런타임 의존성 경로가 아니다. 이번 범위에서 수정하지 않았다.

증빙: `artifacts/release-audit-2026-10-04/auth-client-address-confirmed.png`.

## 남은 제한과 다음 행동

1. 두 번째 재실행의 ID/대기실 표시를 확인했다. 첫 재접속에서 계속 `연결 중`이 보여
   전체 재접속 검증 완료로 처리하지 않는다. 계정 반복 삭제·생성은 필요하지 않다.
2. 실제 삭제·신규 생성의 실기기 확인은 사용자가 CAPTCHA를 조작해야 한다.
   에이전트는 운영 계정을 만들거나 삭제하지 않았다.
3. Supabase는 여전히 서버 egress IP를 본다. 자체 익명 가입 제한은 별도이며 이 변경이
   그 제한을 늘리거나 해제하지 않는다. Vercel rewrite 웹 요청도 Vercel egress를 공유할 수 있다.
4. NAT 사용자는 주소를 공유한다. 한도 상태는 메모리 기반이라 재시작 시 초기화된다.
5. Render Free 유휴 기동 지연, 앱 lock/Keychain/WebSocket의 제한 없는 대기 가능성은
   별도 문제다. 인증 지연 전체가 해결됐다고 주장하지 않는다.
6. 기존 iPhone 앱에 호환된다. Retry-After 시간을 화면에 표시하려면 후속 앱 업데이트가 필요하다.
7. App Review 영상 편집·전송, Notes/답변 게시, 새 iPhone 빌드·재심사 제출은 아직 하지 않았다.

근거: [Render ingress 설명](https://render.com/articles/how-render-handles-ddos-attacks),
[Cloudflare visitor header](https://developers.cloudflare.com/fundamentals/reference/http-headers/),
[Supabase 제한](https://supabase.com/docs/guides/auth/rate-limits).

## 첫 재접속 지연 추가 진단

- Supabase 실제 Auth 로그(America/Toronto): 10:08:23 `/signup`200,
  10:08:54 `/token`200, 10:09:18 `/token`200. 두 refresh의 Auth 주체가 같은 것을 확인했다.
  `token revoked: request completed`는 여기서는 HTTP200 refresh 회전 기록이며
  이 문구 자체를 인증 거절로 해석하지 않는다. 조회 화면의 warning4xx/error5xx는 0이다.
- Render 조회 범위에 이 시간대 새 프로세스 기동은 표시되지 않는다. 단, 요청별
  HTTP/WS 최종 응답 기록이 없어 Supabase 성공과 DAEGUK 최종 인증 성공을 동일시하지 않는다.
- 기존 서버는 같은 게임 계정의 연결이 Map에 남아 있으면 새 WS 인증을4401로 거부한다.
  기존 heartbeat는30초 간격이며 이전 연결 종료를 즉시 통지받지 못하면 정리까지
  약30~60초 걸릴 수 있다. 강제 종료 후 앱 재접속 패턴과 맞는 후보 경로다.
- 로컬 모의 재현: 기존 인증 연결이 ping에 응답하지 않는 상태에서 동일 계정으로
  새 연결→4401 거부, 이전 연결 정리 후 재시도→authenticated.
  이는 실제 iPhone이 이 경로였다는 증거는 아니다. 특히 사용자는 오류 코드 대신
  `연결 중` 지속만 보고했으므로 duplicate 경로로 원인을 단정하지 않는다.
- 첫 시도는10초미만에 중단한 것이므로 timeout/무한대기/duplicate거부로 확정하지 않는다.
  15초 HTTP timeout은 fetch만 포함하고,20초 서버 auth deadline은 WS가 열린 뒤 시작한다.
  따라서 전체 연결 시간이20초이내로 보장되는 것은 아니다.
- 별도 모의 재현: native get완료→HTTP200완료→Keychain set응답을 막으면 getSession과
  재시도가 같은 inflight에서 대기한다. 이 단계에는 현재 JS 제한이 없다. WS open/응답도
  클라이언트 제한이 없다. 실제 대기 단계는 미확정이다.
- 따라서 이번 실패를 Supabase 무료 요금제나 RATE_LIMITED로 단정하지 않는다.
  다음은 최대30초의 한 번 재접속 관측 및 앱의 최종 HTTP/Keychain저장/WS open/인증 단계를
  구분하는 진단과 안전한 재시도 설계다. 새 계정 생성으로 복구하는 방식은 피한다.
- 이 후속 점검에서는 앱·서버 코드·운영 설정을 추가 변경하지 않았다.
  새 iPhone 빌드·업로드·심사 전송도 없다.

증빙: `artifacts/release-audit-2026-10-04/iphone-reconnect-result.png`,
`reconnect-auth-successes.png`. 원본 사용자 이미지 보존.
임시 모의 도구: `/private/tmp/daeguk-stale-connection-probe.mjs`,
`/private/tmp/daeguk-post-auth-wait-probe.mjs`. 실제 계정이나 외부 인증 요청 없이 실행했다.

## 30초 관측 결과와 새 서버 기동 — 10:43 EDT 후속

- 사용자는 30초 관측 질문에서 처음 `30초 후에도 연결 중 또는 오류`를 선택한 뒤,
  곧 `30초 후 연결되었어`라고 최종 성공을 알렸다. 정확한 초 수는 미확인이다.
  이번 결과는 긴 지연 후 접속 성공이며, 최종 실패나 무한 대기 관측으로 분류하지 않는다.
- Render Application logs: 새 프로세스 `mw57v`가 10:41:50 시작했고,
  10:41:54에 `Unknown Kingdom server listening on 10000`이 기록됐다.
  Events 최신 배포는 09:48 e2f7105였으며 10:41 새 배포는 표시되지 않았다.
- Supabase Auth 최신 기록은 10:42:04 `GET /.well-known/jwks.json`200이다.
  조회 범위 Auth 8개, warning4xx/error5xx 0. JWKS 성공만으로 사용자 최종 인증을
  증명하지 않으며 실제 앱 접속 성공은 사용자 보고를 근거로 한다.
- Render Free는 트래픽이 15분 없으면 정지하고 다음 HTTP/WS 요청에서 재기동하며
  약 1분 걸릴 수 있다. 이번 접속 시점의 새 프로세스 기동은 이 지연 원인과 부합한다.
  요청 시작 시각·기기 단계 기록이 없으므로 유휴 기동을 단독 원인으로 확정하지 않는다.
  앞선 10:08 첫 재접속에는 같은 시각 재기동 기록이 없어서 따로 진단한다.
- 서버가 켜진 상태에서 계정 유지·앱 종료/재실행·온라인 한 번 접속을 요청했다.
  10초 안 / 10~30초 / 다시 30초 이상 중 결과 응답을 기다린다.
- 출시 전에는 게임 서버의 상시 실행 방식과 앱의 연결 단계 안내·대기 제한·안전한 재시도를
  검토해야 한다. Supabase 유료 전환만으로 Render 유휴 기동은 해결되지 않는다.
  요금제 변경·결제·추가 배포·새 iPhone 빌드는 수행하지 않았다.

근거: [Render Free 유휴 기동 공식 문서](https://render.com/docs/free#spinning-down-on-idle).
증빙: `artifacts/release-audit-2026-10-04/reconnect-render-startup.png`.

## 서버 가동 후 온라인 진입 오류 1006 — 11:36~11:44 EDT

- 11:33 가동 점검: `/health` 첫 응답 HTTP200/ok:true/rooms0, 22.254930초.
  Render 새 프로세스 pwhm9는 11:28:12 시작/11:28:16 준비 완료였다.
  후속 `/health`는 HTTP200/0.572593초였다. HTTP 가동을 확인한 것이며
  실제 iPhone의 WS 인증이나 경기 흐름까지 성공했다고 판단하지 않는다.
- 사용자 보고: 온라인에 들어가며 `연결 중`일 때 게임 서버 연결 종료1006.
  이 시점은 방 입장이나 대국 진행 중이 아니다. 켜진 서버에서도 접속 실패 관측이 있어
  이전의 유휴 기동 지연만으로 모든 증상을 설명할 수 없다.
- Render 조회에는 같은 pwhm9가 유지되고 11:35:11 `render-client` 요청 분류가 있다.
  Supabase Auth에는 11:35:12/11:35:28 `/token`200, JWKS200, 조회4xx/5xx0.
  provider 성공은 최종 DAEGUK HTTP/WS 성공과 구분한다. 사용자 요청과의 정확한
  상관관계 ID는 현재 없고, WS 연결/종료 단계별 운영 기록도 없다.
- 1006은 정상 close frame 없이 연결이 끝났다는 표시다. 초기 WS 연결 실패와
  열린 이후 강제 종료 모두 가능하므로 이 코드만으로 원인을 결정하지 않는다.
  현재 앱은 대국 복귀 가능한 연결만 자동 재시도하며, 첫 온라인 대기실 진입 실패는
  종료 문구를 표시하고 멈춘다. 서버의 명시적 인증 거절은 보통4401이며,
  heartbeat 미응답 terminate와 전송 경로 단절도 조사 후보로 남긴다.
- Mac 무계정 시험1: health200/277ms, native origin WS open256ms.
  24초까지 기대한 무인증4401을 수신하지 못해 시험 도구가 terminate했다.
- 시험2: 실제 계정과 무관한 합성 무효 토큰을 한 번 보내 거부 응답을 점검했다.
  health200/377ms, WS open311ms, 12초 동안 close/ping 수신 없음,
  이후 도구 제한에서 terminate. 두 시험의1006은 자체 terminate 결과이므로
  iPhone의1006을 재현한 증거가 아니다. Mac 시험의 전송 경로도 실제 기기와 다를 수 있다.
- 다음 관측: 같은 iPhone에서 계정 유지, Wi-Fi를 끄고 모바일 데이터로 한 번 접속하여
  1006이 같은지 비교하도록 요청했다. 결과를 기다린다. 계속 실패하면 기기와 운영 WS의
  초기 연결/인증/종료 단계별 진단이 필요하다. 원인 확정 전 임의 재시작이나 계정 재생성은 하지 않는다.
- 이번 후속 점검은 읽기·안전한 무계정 시험·기록 갱신이며, 추가 서버/앱 소스 배포나
  운영 설정·요금제·권한 변경은 없다. 임시 도구 `/private/tmp/daeguk-ws-availability.mjs`.

근거: [WebSocket 종료 코드](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code).

## 모바일 데이터 비교와 한도 중단 후 재개 — 15:41 EDT

- 사용자가 같은 iPhone·계정에서 `모바일 데이터에서는 연결됨`을 확인했다.
  운영 서버와 현재 앱이 실제 인증·온라인 연결에 성공할 수 있음을 보여주는 사례다.
  Wi-Fi에서의1006을 계정 손상이나 서버 전체 장애로 분류하지 않는다.
- Wi-Fi 경로 또는 일시적 전송 장애를 의심할 근거가 늘었지만, 접속 시각도 함께 달라졌고
  이전 연결 정리 여부도 달라질 수 있으므로 Wi-Fi를 단독 원인으로 확정하지 않는다.
- 온라인 화면에서 뒤로 나가 기존 연결을 닫은 뒤 Wi-Fi를 켜고 다시 온라인에 들어가는
  비교를 요청했다. 한도 중단 뒤 재개 시 결과가 아직 없어 같은 확인을 다시 요청했다.
  추가 앱 종료·계정 삭제·새 ID 생성은 요구하지 않았다.
- 11:33의 health 응답을15:41의 현재 가동 증거로 재사용하지 않는다.
  이 재개 단계에서 서버 설정이나 요금제를 변경하지 않았고 새 iPhone 빌드도 없다.
- 코드 검증: `node --test server/auth-websocket.test.js`5/5 및
  `node --test test/network-reconnect.test.js`3/3 통과. 무계정 명령·무효 토큰의
  명시적4401, 중복 계정 거부, 세션 취소, 대국 복귀, 서버 변경 후 무효 처리를 검증했다.
  서버 시험은 로컬 모의 인증으로 수행해 운영 계정을 만들거나 삭제하지 않았다.
  이 통과 결과는 운영 Wi-Fi/실제 iPhone의1006 해결 증거가 아니다.
- 다음 앱 업데이트 개선 후보: 첫 온라인 진입1006 등 일시적 단절에서 제한된 자동 재시도,
  연결 단계별 진단·대기 제한·명확한 재시도 안내. 기존 ID를 유지하고 생성 요청을
  반복하지 않는 설계를 먼저 검증해야 한다. 이번 재개 단계에는 이를 구현·배포하지 않았다.
- 15:44 EDT 현재 가동 재확인: health 첫 응답200/ok:true/rooms0/22.342687초,
  후속 응답200/0.144373초. Render Application logs의 새 프로세스 bt6x4는
  15:44:25 시작,15:44:30 준비 완료였다. 점검 요청이 유휴 서버를 깨웠을 수 있어
  요청 전부터 켜져 있었다는 증거로 보지 않는다. HTTP 정상 응답을 iPhone의
  Wi-Fi 접속/WS 인증 성공으로 확장하지 않는다. 재개 후 Wi-Fi 시험 결과는 아직 대기 중이다.

## 대기실 뒤로 → 재진입 흐름과 실제 유지시간 확인

사용자가 오류 흐름을 온라인 대기실→뒤로→다시 온라인 진입으로 구체화했다.
Wi-Fi/LTE 비교는 계속 참고하되, 네트워크 종류만의 장애로 단정하지 않는다.

### 현재 프로젝트의 로그인 설정

Supabase `daeguk-dev`의 Authentication → Sessions를 읽기 전용으로 확인했다.

| 항목 | 실제 설정/코드 | 의미 |
| --- | --- | --- |
| Access token expiry | 3600초 | 인증 토큰은1시간 유효, 갱신 가능 |
| Time-box user sessions | 0 / never | 로그인 세션 최대 수명 제한 없음 |
| Inactivity timeout | 0 / never | 미사용 시간에 따른 강제 재로그인 없음 |
| Enforce single session per user | off | Supabase의 단일 세션 정책은 꺼짐 |
| Refresh token reuse interval | 10초 | refresh 회전의 재사용 예외 구간, 로그인 유지시간이 아님 |
| Refresh replay detection | on | 손상·재사용 의심 상황은 세션 취소 가능 |
| 앱의 메모리 캐시 | 만료까지60초 이상이면 재사용 | 짧은 대기실 재진입은 보통 새 Auth 요청 없이 기존 토큰 사용 |
| 연결 중 자동 갱신 | 토큰 만료45초 전 | 열린 WS에서 새 토큰으로 다시 인증 |

‘뒤로’는 Supabase 로그아웃이나 계정 삭제가 아니다. Keychain의 refresh token과
인증 모듈의 cached access token을 유지한다. 앱의 ID 표시는 게임 연결이 인증된 동안만
표시하므로, ID가 화면에서 사라지는 것만으로 로그인 세션 종료를 판단하지 않는다.
앱 종료 시 메모리 토큰은 사라지지만 Keychain 값으로 다음 접속 때 갱신한다.
계정 삭제·세션 취소·보안상 폐기 같은 종료 사유까지 무조건 유지된다는 뜻은 아니다.

### 게임 연결의 종료와 정리

- `app.js`의 cancelNetworkBtn → disconnectNetwork → `js/network.js:85`는
  이전 socket에 close를 요청한 뒤 바로 새 빈 상태를 반환한다. 완료를 기다리는 절차가 없다.
- `server/server.js:556`의 close 이벤트가 실제 발생하면 `authenticatedSockets`와
  대기실 등록을 정리한다. 정상 close 전달에는 별도의30초 유지 정책이 있는 것이 아니다.
- 종료가 전달되지 않은 무응답 연결은30초 간격 heartbeat에서 pong 누락을 확인하고
  다음 주기에 terminate한다. 끊긴 시점에 따라 약30~60초가 걸릴 수 있으며 일정한 TTL이 아니다.
- 서버 ws 라이브러리의 close handshake 대기는 기본30000ms다. iOS 브라우저의 모든
  종료 시간을30초로 보장하는 설정은 아니며, 서버 이벤트 루프/전송 경로에 따라 달라질 수 있다.
- 서버는 계정별 이전 socket이 Map에 남으면 새 socket을4401로 거부한다.
  Supabase single-session off와 별개의 게임 연결1개 제한이다.
- 실제 대국의 좌석 복귀 유예는 코드 기본120초이며 로비 연결 정리/로그인 수명과 별개다.
  운영 환경의 RECONNECT_GRACE_MS override 값은 이번 UI 점검에서 읽지 않았다.

### 기존 코드의 뒤로/재진입 모의 재현

`/private/tmp/daeguk-lobby-back-reenter-probe.mjs`에서 실제 createGuestAuth,
connectNetwork/disconnectNetwork, createGameServer를 사용했고 인증 서비스만 모의로 주입했다.

1. 첫 대기실 접속 성공, 같은 사용자와 유효한5분 토큰을 준비했다.
2. ‘뒤로’가 보내는 기존 연결의 close frame을 로컬에서300ms 지연시켰다.
3. 클라이언트 이전 socket은CLOSING인데 서버에는 아직 기존 연결이 남았다.
4. 즉시 재진입은 중복 연결로4401 거부됐다.
5. 이전 연결 종료 정리 후 재진입은 동일 public ID로 성공했다.
6. 전체 Auth HTTP 호출은1회였다. 로그인 만료·새 ID 생성 없이 연결 경쟁 조건이 발생했다.

시험 통과. 외부 Auth·실제 계정·운영 게임 상태는 사용하지 않았다.
이는 발견된 연결 경쟁 조건의 모의 재현이며, 사용자의1006을 그대로 재현한 것이 아니다.
실기기1006의 정확한 경로는 아직 요청/WS 단계 기록이 필요하다.

수정 방향은 기존 ID를 유지하면서 이전 연결의 종료 완료와 새 연결 시작의 순서를
맞추고, 종료 지연에는 제한 있는 재시도를 적용하는 것이다. 취소된 이전 연결의 늦은
응답이 새 화면을 건드리지 않도록 이벤트도 격리해야 한다. 이번에는 감사·모의 재현·기록만
완료했으며 앱/서버 소스·로그인 설정을 바꾸거나 새 빌드/배포/심사 전송을 하지 않았다.

증빙: `artifacts/release-audit-2026-10-04/auth-session-lifetimes.png`.
근거: [Supabase 로그인 세션 수명](https://supabase.com/docs/guides/auth/sessions).
