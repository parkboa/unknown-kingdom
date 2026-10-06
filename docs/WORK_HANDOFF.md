# 작업 계획 및 모델 인계

최종 갱신: 2026-10-05 / Codex. 이 문서는 새 대화의 시작점이다. 과거 대화 전체를 다시 읽지 않는다.

## Current release snapshot — 2026-10-05 / Codex

- App Store Connect: approved `1.0.1 (3)`, **Pending Developer Release** observed. User will release manually; publication has not been independently confirmed.
- User authorized committing and pushing local release changes. Keep `parkboa/unknown-kingdom` public for now; a separate private repository for future versions is only under discussion.
- All 68 shipped web assets match `build/export-1.0.1-3/App.ipa` byte for byte. Bundle ID `com.boahspark.daeguk`, minimum iOS 15, iPhone only.
- IPA SHA256: `448a408ad3160d382ddfd5928ae1e822fb91da3f00ec906aae38d781aa64c6f9`.
- Validation: full `npm test`, mobile build, auth handshake 6/6, native auth 8/8, JS/Ruby syntax and whitespace checks passed. No new gameplay changes.
- Commit selected store screenshots and release records; preserve private review videos, admin captures and raw screenshots locally under `.gitignore`.
- The dated review/diagnostic entries below are historical; this section is the current status.

## 인증 제한 수정 재개 — 2026-10-04 / Codex

- **최신 / 재심사 접수 완료:** 사용자 `그래 제출하자` 명시승인으로실행했다.
  2026-10-04 23:40 EDT Apple 답변3,631자와정리본MP401–04전송완료,
  Messages(2)의본인답변과4개첨부파일명/Download버튼을확인했다.
  동일6개항목Notes저장후다시읽어확인, 빌드3선택/저장후UpdateReview검증통과.
  Resubmit to App Review완료,23:41 EDT **Waiting for Review / iOS1.0.1(3)**를
  제출상세AX와스크린샷으로확인했다. 제출ID는기존
  `ce44e104-56a2-463a-acbd-56975040e302`, 빌드ID
  `94db0cab-0709-4350-a24c-20dd65f42ce0`. 수동공개선택유지, 실제앱공개없음.
  receipt:`artifacts/app-review/2026-10-04/video-package/submission-receipt.json`.
  다음: Apple심사결과확인, 승인후수동공개. 재전송/재제출을반복하지않는다.

- **최신 / 빌드3 추가녹화 검수·정리:** 사용자23-26-11(17.49초)원본을submission/에추가,
  같은iPhone15Pro/iOS26.6.1/빌드3촬영으로확인했다. 홈화면실행·첫온라인연결·뒤로·
  즉시재진입후동일ID가약1초이내표시되는것을확인했다. 끝제어센터만제외한
  `04_Build3_Lobby_Reentry_Verification.mp4`16.40초/665,275bytes완료.
  원본보존/hash일치, 전체디코딩/형식/faststart/끝화면검수통과.
  제출4편합계10,224,725bytes, 영어전체답변3,631자로수정후영상설명추가.
  새영상에는삭제흐름이없고해당수정후성공은별도수동보고로구분한다.
  동일폴더의사용자원본은첨부하지않고이름이01–04인정리본4개만첨부대상이다.
  외부전송승인/빌드3선택·Notes갱신·재제출은아직없음.

- **최신 / 전송 전 읽기 점검:** 사용자 `그럼 이제 전송하면 될까?`에 ASC를 다시 읽었다.
  제출은아직1.0.1(2)/Rejected/Unresolved Issues, 메시지는Apple1건이다.
  빌드3은TestFlight Ready to Submit. 기존Notes는접근/삭제안내뿐이다.
  답변창4,000자 제한에맞춘6개항목영어전체답변3,372자를
  `artifacts/app-review/2026-10-04/video-package/APP_REVIEW_REPLY_EN.txt`로준비했다.
  실제첨부형식/용량제한은UI에표시없음. 전송승인후영상3편첨부·전체답변·Notes갱신,
  검증된빌드3으로교체·재심사제출이권장다음순서다. 현재외부입력/첨부/저장/전송없음.

- **최신 / 심사용 영상 정리 완료:** 사용자 `그래 영상 정리하자`로 로컬 편집 승인.
  `artifacts/app-review/2026-10-04/video-package/submission/`에3편:
  01앱실행/온라인/삭제1:52.30, 02튜토리얼/AI2:27.00, 03삭제/새게스트0:25.20.
  H.264960×2080/30fps/AAC/faststart. 원본 보존, 배속·대국중간생략 없음.
  03의다른앱화면은불투명가림/시간유지. 과거지연2편은diagnostics/에개인화면을가려보존.
  원본/사본hash와구간manifest, 영어영상설명·README 작성. 디코딩전체/길이/형식 검사,
  장면·한글가독성·가림경계검수. 초회진단04의가림시작이늦어개인사진프레임이보여
  14.50초부터로넓혔고05끝제어센터도제외해재검수. 제출용3편촬영환경을
  사용자iPhone15Pro/iOS26.6.1/빌드2로확인. 빌드3성공은별도보고, 기존영상과구분.
  다음: 실제Apple첨부제한/심사대상빌드확인 후 사용자지시에따라영상·답변전송/Notes갱신.
  현재Apple업로드·답변전송·Notes변경·심사재제출없음.

- **최신 / 서버 수정 후 실기기 재진입 정상 확인:** 사용자가 현재 빌드3에서
  “이제 고쳐졌어. 5초 이내에 아이디가 나와”라고 확인했다. 계정 삭제 후 다시
  시도해도 정상 작동한다고 보고했다. 대기실 재진입 및 삭제 후 재인증 흐름은
  사용자 수동 검증 성공으로 기록한다. 정확한 반복 횟수·통신 종류·앱 종료 후 복원·
  두 기기 대국 복귀까지 확인한 것으로 확대하지 않는다. 다음은 심사 대응 자료 정리다.
  이번 보고로 새 앱 업로드/심사 재제출/공개를 진행하지 않았다.

- **원인 확인·수정 배포 이력:** 사용자가1.0.1(3) 확인.
  첫 진입은5초 이내 ID 표시, 뒤로/재진입은약30초 연결 중 후 연결 끊김 메시지와
  함께 ID가 다시 표시됐다고 보고했다. 해결 완료로 판단하지 않는다. 진단 단계에서는
  정확한 종료 코드/지연 단계가 미확정이었다. 서버 단계별 시간 진단32개 시험 통과,
  `/private/tmp/daeguk-auth-rate-limits` 브랜치 `codex/ws-connection-timing`.
  PR #3 병합 커밋a9c65d4119c65fb0a166e972697b9f188f530f52,
  Render17:31 EDT Live/배포 커밋 일치 확인. 배포 전후 health200/rooms0,
  배포 후0.132초. 개인정보·토큰·ID 로그 없음. 기존 빌드3로 진단 가능.
  아래17:39 운영 재현으로 중복 거부를 확인했다. 실제 화면 지연 전체 시간 분포는 미확정.
  증빙 ws-timing-deployed.png 저장. 새 모바일 빌드/심사 제출 없음.

  **17:39 EDT 운영 재현 후속:** 사용자가 시도 시각5시39분 보고.
  연결1 17:38:52 opened/인증1070ms/대기실송신1275ms,
  연결2 17:38:55 opened→93ms duplicate_rejected(previousState1/OPEN),
  연결1 17:39:03 1006 종료, 연결2 17:39:05 4401 종료,
  연결3 17:39:16 인증107ms/대기실송신189ms. 이전 연결이 남은 상태에서
  새 인증이 중복 접속으로 거부된 증거를 확보했다. JWT/DB30초 지연으로 단정하지 않는다.
  증빙 ws-timing-1739.{txt,png}. 서버가 검증한 동일 계정의 대기실 연결만
  교체하는 수정: 브랜치codex/lobby-connection-replacement/room멤버십보호,
  이전 연결4409종료/1초후강제정리, 늦은종료·진행중명령격리.
  PR #4 병합8cbd0afaccc77f2efac5f373c322195881d32a18,
  Render17:44 EDT Live/배포 커밋 일치 확인. 배포 후health200/rooms0/0.226초.
  증빙 lobby-replacement-deployed.png. 서버35개와 기본 전체npm test 통과.
  로컬main도 remote수정을 병합해 앱/문서 미커밋 변경은 유지. 로컬main을 push하지 않았다.
  회귀시험 초회34/35, 실패는 클라이언트 close 후 서버 close 이벤트 전 상태검사였으며
  서버 close도 기다리도록 보완 후35/35 통과. 실패를 삭제하지 않았다.
  현재 빌드3/계정 유지하고 뒤로→즉시재진입3회·시각/대기시간/메시지 보고를
  요청했고, 이후 위의 사용자 성공 보고를 받았다. 새 iOS빌드/심사제출 없음.

- **최신 / 재진입 수정 빌드3 내부 TestFlight 배포 완료, 실기기 검증 대기:** 사용자 `그럼 시작하자`로
  수정 시작 승인. js/network.js에서 이전 close handshake 대기(최대5초), 취소/종료된
  연결 이벤트·refresh 격리, WS 연결/인증30초 제한, list_rooms만 1006/1012/1013 최대2회
  재시도를 구현했다. 로그인 ID 유지, 4401/생성/참가 자동 반복 없음. app.js 현재 세션 검사 추가.
  실제 WS + game server + guest auth/모의 provider로 close frame300ms 지연한 뒤
  뒤로/즉시 재진입10회 연속 통과, 동일ID/Auth HTTP1회. 신규8개 포함 연결11/11,
  전체 웹47/엔진137/서버29 통과, 마지막 이벤트 격리 보완 후 연결11/11 재확인.
  iOS 1.0.1 (3) Archive와 App Store export 성공, build/export-1.0.1-3/App.ipa 약40MB.
  정상 키체인 환경에서 Archive/추출 IPA 서명 검증, 최소iOS15/iPhone/버전·빌드 및
  app.js/network.js 원본 hash일치 확인. 브라우저 인증14/14 통과.
  기존 TestFlight(2)는 수정 전이다. 실기기 동작 검증·심사 전송은 아직이다.
  사용자가 `응 업로드해줘`로 빌드3 업로드와 기존 본인 전용 DAEGUK Internal 연결을 승인했다.
  Xcode -exportArchive destination=upload가 2026-10-04 17:10:50 EDT `Upload succeeded`
  / Uploaded package is processing / exit0으로 완료됐다. Chrome ASC 로그인 복원.
  약17:13 EDT 빌드3 Ready to Submit 표시로 처리 완료 확인 후 기존 DAEGUK Internal에
  연결했다. 그룹 1 Tester / 2 Builds, 1.0.1(3) Testing / Expires90days 확인.
  빌드ID94db0cab-0709-4350-a24c-20dd65f42ce0. 한국어 What to Test 안내 Saved 확인.
  ASC 본인 테스터 행은 iPhone15Pro/iOS26.6.1 Installed1.0.1(3)로 표시됐으나
  수동 동작 검증을 완료한 증거로 확장하지 않는다. 새 테스터 추가/심사 재제출/공개 없음.
  다음: 사용자 Wi-Fi 대기실→뒤로→즉시재진입10회, 동일ID 확인. 이후 모바일3회,
  앱 종료/재실행 및 두 기기 대국 복귀. 실제 조작은 사용자가 담당한다.
  증빙 testflight-build3-{processing,details,testing}.png 저장. 문서 검사 통과.
  상세 docs/LOBBY_RECONNECT_FIX_2026-10-04.md. 실기기1006 전체 해결 확인은 아직이다.

- **최신 사용자 재현 흐름 / 세션 수명 확인:** 사용자는 온라인 대기실→뒤로→온라인 재진입에서
  끊긴다고 구체화했다. 네트워크 종류만의 문제로 단정하지 말고 종료/재연결 순서를 우선 조사한다.
  app.js cancelNetworkBtn은 disconnectNetwork만 호출하고 로그아웃/Keychain clear를 하지 않는다.
  js/network.js는 socket.close를 요청하고 완료를 기다리지 않은 채 상태를 새로 만든다.
  서버는 close 이벤트에서 계정별 연결 Map을 지우며, 이전 연결이 남으면 새 연결을4401로 거부한다.
  실제 Supabase Sessions UI: access expiry3600초, time-box0/never, inactivity0/never,
  single-session off, refresh reuse10초/재사용 공격 탐지on. 설정 변경 없음.
  정상 연결 종료는 close 이벤트에서 정리되고, 무응답 연결은30초 heartbeat로 약30~60초 후 정리될 수 있다.
  로컬 기존 클라이언트/서버 코드로 뒤로의 close frame 전달을300ms 늦추면 즉시 재진입4401,
  이전 종료 정리 후 동일ID 성공을 재현했다. Auth HTTP는 전체1회여서 토큰 만료/새 가입 없이 발생한다.
  이는 종료/재진입 경쟁 조건의 증거이며 실기기1006의 원인 확정은 아니다. 구현/추가 배포는 아직 없다.
  다음 수정 대상: 로그인 ID 유지, 이전 연결 종료 완료와 새 연결 시작의 순서 보장,
  대기 제한·안전한 재시도 및 취소된 옛 연결의 이벤트 격리. 새 앱 빌드/심사 전송 없음.
  상세 보고서 및 auth-session-lifetimes.png 증빙. 이전 Wi-Fi 단독 가설은 미확정 후보로 낮춘다.
- **현재 가동 재확인 — 15:44 EDT:** 중단 뒤 health 첫 요청은200/22.342687초,
  바로 다음 요청은200/0.144373초, 모두 ok:true/rooms0였다. Render 새 프로세스 bt6x4가
  15:44:25 시작/15:44:30 준비된 것을 CUA Chrome 화면에서 확인했다.
  점검 요청이 서버를 깨웠을 수 있으므로 처음부터 켜져 있었다고 기록하지 않는다.
  현재 HTTP 정상 가동은 확인했으나 iPhone Wi-Fi/WS 정상 인증 검증은 별도다.
  재개 후 Wi-Fi 재시험 응답 대기. 아직 인증 지연/1006 전체 해결로 처리하지 않는다.
- **중단 후 재개 — 모바일 데이터 성공, Wi-Fi 재시험 대기:** 사용자가 같은 iPhone·계정으로
  모바일 데이터에서는 연결됨을 확인했다. 따라서 모든 네트워크에서 접속이 불가능한 상태는 아니다.
  Wi-Fi 경로 또는 일시적 전송 장애 가능성이 커졌지만 네트워크 전환과 시간이 동시에 변했으므로
  원인을 확정하지 않는다. 온라인에서 뒤로 나가기→Wi-Fi 켜기→온라인 재진입을 요청했으나
  한도 중단 뒤 결과는 아직 없다. 15:41 EDT 재개 시 위 결과를 반영하고 동일 비교를 다시 요청했다.
  앞선 HTTP 가동·provider 성공과 최종 WS 성공은 구분한다. 앱/서버 소스·요금제 변경 없음.
  후속 코드 검증: auth-websocket 5/5, network-reconnect 3/3 통과. 운영 Wi-Fi/실기기
  검증을 대신하지 않는다. 첫 온라인 진입1006의 제한 있는 자동 재시도·단계별 안내는
  다음 앱 업데이트 개선 후보로 기록했고 이번 버전에는 구현·배포하지 않았다.
- **최신 오류 — 켜진 서버에서도 온라인 진입 중 1006:** 11:33 EDT health200/0.57초로
  가동 확인 후 사용자가 온라인 진입의 `연결 중` 단계에서 1006을 보고했다. Render pwhm9는
  11:28:12 시작/11:28:16 준비 이후 그대로이며 11:35:11 인증 요청 주소 분류 로그가 있다.
  Supabase 11:35:12/11:35:28 token200, 조회 4xx/5xx 0. 이 오류를 유휴 기동이나
  인증 실패로 단정하지 않는다. 1006은 정상 close frame을 받지 못한 WS 종료 표시다.
  Mac 무계정 WS 초기 연결은 약0.26~0.31초에 열렸으나 기대한 4401 종료 응답은
  시험 제한 안에 수신하지 못했다. 시험의 1006은 에이전트가 종료 제한에서 terminate한
  결과이므로 실제 iPhone 오류를 재현한 증거가 아니다. 운영 WS 연결/인증별 로그가 없어
  실패 지점 미확정. 같은 iPhone에서 Wi-Fi→모바일 데이터 한 번 비교를 요청했고 응답 대기.
  상세 보고서 갱신. 추가 서버/앱 코드 배포·설정 변경·계정 생성삭제 없음.
- **최신 실기기 결과 — 30초 이후 연결 성공:** 사용자는 처음 `30초 후에도 연결 중 또는 오류`를
  선택했지만 곧 `30초 후 연결되었어`로 최종 성공을 알려왔다. 무한 대기/최종 실패로 기록하지 않는다.
  10:43 EDT 조회에서 Render는 새 프로세스 mw57v로 10:41:50 시작, 10:41:54 준비 완료였고,
  Events 최신 배포는 여전히 09:48 e2f7105였다. Supabase 최신 Auth는 10:42:04 JWKS GET200,
  조회 범위 4xx/5xx 0이다. 이번 지연은 Render Free 유휴 기동과 부합하지만 요청 시작 시각·
  기기 단계 기록이 없어 단독 원인으로 확정하지 않는다. 앞선 10:08 지연은 재기동 증거가 없다.
  서버가 켜진 상태에서 한 번 즉시 재접속해 지연을 비교하도록 요청했고 응답 대기 중이다.
  이번 점검은 기록·증빙만 갱신했으며 앱 코드/요금제/운영 설정은 변경하지 않았다.
- **대기시간 후속 확인:** 첫 재접속은 `연결 중`에서10초미만 기다린 뒤 종료했다.
  즉시접속지연은관측됐지만최종실패/timeout/무한대기는실기기에서확인되지않았다.
  HTTP15초·WS연결후서버인증20초의제한만료전중단이다. 신규계정생성없이같은ID로
  한 번재접속해최대30초관측을요청했고응답대기. 아래첫실패/대기시간질문대기는과거기록.
- **사용자 실기기 결과 — 첫 재접속 대기 잔존:** 신규 ID 생성 후 앱 종료, 첫 재접속은
  `연결 중` 지속, 다시 종료·재접속하면 ID/온라인 대기실 표시. 대기 시간 질문 응답 대기.
  Supabase10:08:23 signup200,10:08:54/10:09:18 token200, 동일Auth주체 확인.
  provider성공 이후 게임DB/응답/Keychain저장/WS 어느 단계인지 아직 미확정이다.
  Render 같은 시각 재기동은 조회 범위에 안 보인다. 모의로 이전 무응답 WS 연결이 남으면
  첫재접속4401→정리후성공, HTTP200후Keychain set응답 미완료이면재시도도대기하는
  두 경로를 재현했다. 실제원인으로확정하지않음. 서버 한도 수정과 별개로 다음 업데이트에서
  접속대기·진단·안전재시도를다룬다. 이번후속점검 앱/서버/운영추가변경없음.
  상세 docs/AUTH_RATE_LIMIT_FIX_2026-10-04.md. 아래 실기기응답대기는 과거시점기록이다.
- **최종 운영 확인 완료 / 실기기 응답 대기:** PR #1/#2 병합, 운영 커밋 e2f7105.
  Render 실제 peer가 loopback인 것을 확인해 신뢰 경계를 보정한 뒤 09:57:17 EDT
  `render-client` 선택 로그를 확인했다. 새 회귀11 포함 서버29/29, 웹39/엔진137 통과.
  health200/239ms/rooms0, OPTIONS204/Retry-After 노출, 무세션POST401/NO_SESSION/135ms.
  실제 계정 인증 성공을 이 무세션 요청으로 확인한 것은 아니다. 사용자에게 기존 ID로
  iPhone 종료·재실행/온라인 접속 시간 확인을 요청했고 응답 대기다.
  원래 프로젝트 main에도 최신 서버를 merge했고 미커밋 출시 자료 보존, 로컬main push없음.
  자세한 결과·제한은 docs/AUTH_RATE_LIMIT_FIX_2026-10-04.md.
  Supabase 서버 egress 공유 한도·Free 유휴 기동·앱 대기 문제는 별도이며
  다음 App Review 영상/답변은 아직 전송하지 않았다. 아래 추가 보정 중 기록은 과거 이력이다.
- **운영 확인 후 추가 보정 중:** PR #1 병합/Render 706d0ea 배포는 성공했다.
  OPTIONS 204/Retry-After 노출, create:false POST 401/NO_SESSION, health200 정상.
  그러나 실제 로그는 `socket-peer`여서 사용자별 주소 분리는 아직 운영 확인 전이다.
  private ingress 가정과 실제 전달 경로가 다르다. loopback ingress 포함 및
  주소 값 없이 클래스/헤더 존재 여부만 출력하는 진단을 추가 검증했고 후속 PR 준비 중이다.
  현재 작업 브랜치 codex/auth-ingress-diagnostics, 커밋 d998cc5. 서버28 + 회귀11 통과.
  앞선 PR #1의 코드만으로 문제가 완전히 해결됐다고 보고하지 않는다.
- 원래 프로젝트 로컬 main에 origin/main을 정상 merge했다. 기존 출시 준비 커밋과
  모든 미커밋 출시 자료는 보존했고 로컬 main을 원격에 push하지 않았다.
- 사용자 요청: 서버 인증 제한 수정·검증. 중단 전 작업을 이어 진행 중이다.
- 작업 체크아웃 `/private/tmp/daeguk-auth-rate-limits`, 수정 파일:
  `server/{auth-http.js,auth.js,client-address.js,auth-rate-limit.test.js,README.md}`.
  Render runtime + private ingress + 유효 CF-Connecting-IP만 사용하며 X-Forwarded-For는
  신뢰하지 않는다. 새 생성 10회/시간, 일반 요청 30회/분, 기존 refresh는 생성 한도에서 제외.
  로컬 429에 scope/Retry-After를 추가하고 Supabase 429 상태를 보존한다. CAPTCHA 유지.
- 회귀 시험 9개 및 npm test 전체 통과(웹 39, 서버 27 포함). 설치·검증 완료.
  npm audit의 기존 high 1개는 개발용 Capacitor CLI의 brace-expansion 경로이며
  인증 서버 런타임 의존성이 아니다. 이번 변경에서는 의존성을 변경하지 않았다.
- 원격 main/Render는 7f7b702, 로컬 main은 미배포 출시 준비 커밋 bb28cdc다.
  출시 커밋을 배포에 섞지 않고 원격 main을 기준으로 인증 수정만 PR로 옮긴다.
  현재 health ok:true / rooms:0, 아직 수정 배포 전. 관리 worktree 도구는 프로젝트 부모를
  Git repo로 인식하지 못해 실패했고 별도 로컬 clone을 사용했다.
- 다음: 인증 패치만 커밋·PR → 검사/운영 경기 없음 확인 → 병합/Render Live 확인 →
  안전한 OPTIONS/create:false 요청과 주소 분류 로그 확인 → 사용자 iPhone 재접속 확인.
  실제 신규 계정 생성/삭제·CAPTCHA 조작은 사용자가 맡는다.
- 제한: Vercel 웹 rewrite와 Supabase 자체 한도의 서버 egress 공유 문제는 별도다.
  Supabase 설정·키·요금제 변경, iPhone 새 빌드, App Review 영상/답변 전송은 하지 않았다.

## 현재 상태 점검 — 2026-10-03

- **RATE_LIMITED 원인 좁힘:** 사용자가 추가로 해당 인증 오류를 보고했다. 현재 배포
  `7f7b702`의 서버 자체 제한(인증 30회/분, 새 게스트 생성 시도 5회/시간)을 확인하고
  모의 6번째 신규 생성에서 429/RATE_LIMITED를 재현했다. socket.remoteAddress 기준이라
  중계 주소를 공유하는 정상 사용자들이 한도를 공유할 수 있다. 촬영 중 삭제/생성 반복과
  부합하며 무료 플랜 한도라고 단정하지 않는다. 어느 제한이 발동했는지와 실제 peer는
  미확인이다. upstream429는 현재 AUTH_FAILED401로 변환됨. 서버 시험6개통과,
  앱/운영 변경없음. 다음은 신뢰할 수 있는 사용자 구분·제한 종류/재시도 안내 설계 검토.
  상세: docs/AUTH_LATENCY_DIAGNOSIS_2026-10-03.md.
- **후속 실기기 영상 4편 검수:** 22-15-02 영상(26.76초)은 영구 삭제 완료 후
  홈 화면에서 앱 재실행·Turnstile 확인·새 게스트 ID를 보여준다. 약 18초 온라인
  진입→22초 ID 표시로 이번 시도는 약 3~4초에 접속됐다. 화면 Wi-Fi 표시 확인.
  삭제 후 신규 생성의 정상 사례를 확보했지만 이전 간헐적 지연의 원인/해결 증거는
  아니다. 심사 자료와 진단 보고서 갱신, 원본 유지, 아직 편집·업로드·심사 전송 없음.
- **간헐적 인증 지연 1차 진단:** 사용자 요청으로 Render/Supabase의 촬영 시간대
  기록과 auth/network 소스를 대조했다. 현재 서비스 측정은 197~561ms로 정상이며,
  21:55:18 삭제와 21:57:20 신규 가입 성공 사이 완료된 Auth 요청이 보이지 않는다.
  인증 전 lock/Keychain 브리지 및 WebSocket 연결에 제한 없는 대기가 가능한 경로를
  모의 조건으로 재현했다. 실제 기기에서 어느 단계가 막혔는지는 미확정이다.
  Render Free의 50초 이상 유휴 기동 지연도 확인했으나 촬영 시 재기동 증거는 없다.
  앱 코드·운영 설정·요금제 변경 없음. 읽기 전용 diagnose-online-latency 도구 추가,
  관련 시험 10개 통과. 사용자가 현재 iPhone에서 “아이디 나왔어”로 접속 성공을
  확인했다. 소요 시간/재진입 여부/통신 환경은 미확인이다. 실제 지연 단계 확정은
  기기에서 단계별 기록이 필요하며, 이번 진단만으로 Supabase 자체 지연이라고 단정하지 않는다.
  상세: docs/AUTH_LATENCY_DIAGNOSIS_2026-10-03.md.
- **심사용 실기기 영상 3편 검수 / 인증 지연 확인 필요:** 추가 21-56-31 영상(0:54)은
  홈 화면 실행과 삭제 전과 다른 게스트 ID를 보여준다. 그러나 온라인 연결 대기가 지속되고
  재실행 뒤 접속된다. 사용자가 “오쓰가 가끔씩 버벅거려. 나도 원인은 아직 모르겠어”라고
  확인했다. Supabase 복구와 별도로 원인·회복 동작을 점검해야 한다. 아직 원인은 확정하지
  않았고 앱 코드는 변경하지 않았다. 개인 사진/다른 앱 화면 및 불필요한 앞뒤는 제출용
  사본에서 정리할 수 있지만 의미 있는 지연·실패를 숨기지는 않는다. 원본 보존,
  아직 편집·압축·업로드·심사 답변 전송 없음. 상세: docs/APP_REVIEW_INFORMATION_NEEDED.md.
- **앞선 실기기 영상 2편 검수 이력:** 사용자가 Downloads의
  ScreenRecording_10-03-2026 21-48-32_1.MP4 / 21-53-11_1.MP4를 제공했고,
  iPhone 15 Pro / iOS 26.6.1 / TestFlight 1.0.1 (2)로 촬영했음을 확인했다.
  1편(3:09)은 시작 로딩·튜토리얼·AI, 2편(2:17)은 홈 화면에서 재실행·온라인 인증·
  실제 온라인 경기·결과·영구 계정 삭제와 완료 문구를 확인했다.
  온라인 인증·ID만으로 신규 생성과 세션 복구를 구분하지 못하며, 삭제 뒤 재진입 장면이
  없어 당시 추가 촬영을 요청했다. 이후 3편의 결과는 위 최신 기록을 따른다.
  전체 재촬영은 필요하지 않다. 원본 유지, 아직 편집·압축·외부 업로드·심사 답변 전송 없음.
  자세한 검수와 답변 초안: docs/APP_REVIEW_INFORMATION_NEEDED.md.
- **온라인 녹화 중 인증 장애 — Supabase 복구 완료:** 사용자가 비활동 정지 알림과
  iPhone 온라인 인증 실패를 보고했다. Supabase에서 `daeguk-dev`
  (`ajmrlhfhrcsstauqgnip`)가 Paused임을 확인하고 Resume project → Resume을 실행했다.
  Coming up...을 거쳐 **Restoration complete / back online**을 확인했다.
  기동 초기 Auth health HTTP 521 / DB 연결 실패는 복구 이후 HTTP 200과 읽기 전용
  SELECT 1 성공으로 해소됐다. Render 게임 서버 health는 ok:true / rooms:0이다.
  사용자가 iPhone에서 앱을 완전히 종료·재실행한 뒤 **인증되고 온라인 화면이 열림**을
  확인했다. 계정 삭제·온라인 실제 대국·영상 촬영 완료까지의 확인은 아직 아니다.
  증빙: artifacts/release-audit-2026-10-03/supabase-restored.png.
  무료 플랜 유지, 유료 변경·키 교체·계정 삭제·에이전트에 의한 새 계정 생성은 하지 않았다.
  다음은 심사용 실기기 녹화 재개다. Free 프로젝트는 낮은 DB 활동으로 재정지될 수 있어
  심사·출시 중 서비스 가용성을 확인한다. 재정지 방지 운영 방식은 아직 확정하지 않았다.
- **심사 결과 후속 확인 — Rejected / Unresolved Issues:** 사용자 거절 확인 요청으로
  같은 제출 ID의 App Review 메시지를 읽었다. 2.1.0 Performance: App Completeness,
  제목 Guideline 2.1 - Information Needed - New App Submission. 심사 이력이 적은 신규
  개발자 계정에 실제 기기(최신 OS) 시연 영상과 앱 목적·사용 방법·외부 서비스·지역 차이·
  해당 시 권리/허가 증빙의 6개 정보를 요청했다. 개별 버그나 충돌을 특정한 메시지는 아니다.
  App Review 답변과 Review Notes 양쪽에 정보를 추가하라는 요구다. 아직 답변 전송,
  Notes 변경, 새 빌드 업로드·재제출은 하지 않았다. 다음은 사용자 실기기 영상 확보와 검수다.
  요구 원문 증빙: artifacts/release-audit-2026-10-03/rejection-information-needed.{txt,png}.
  촬영 순서와 영어 답변 준비 초안: docs/APP_REVIEW_INFORMATION_NEEDED.md.
  아래 Waiting for Review는 최초 접수 당시 이력이며 현재 상태는 이 후속 확인을 따른다.
- **Apple 심사 접수 완료 — Waiting for Review:** 사용자가 첫 출시는 iPhone만으로 지정했고 TestFlight 1.0.1 (2)의
  AI·특수 기물·온라인 대국/재접속·지원 링크·계정 삭제에 문제가 없었다고 확인했다.
  Mac와 Vision Pro 배포를 해제해 Saved 표시를 확인한 뒤 Submit for Review를 실행했다.
  1 Item Submitted 성공 화면과 심사 상세의 Waiting for Review / iOS App 1.0.1 (2)를
  확인했다. 접수: 2026-10-03 14:28 EDT, ID ce44e104-56a2-463a-acbd-56975040e302.
  증빙: artifacts/release-audit-2026-10-03/waiting-for-review.png 및 iphone-distribution-saved.png.
  무료·한국/미국/캐나다·수동 공개 설정 유지. 다음은 Apple 심사 결과 확인과 승인 후 수동 공개다.
  현재는 일반 사용자 검색·다운로드 전이다. 아래 제출 전 대기 기록은 과거 진행 이력이다.
- **심사 제출 준비 후속 진행:** 사용자 '이어서 진행해줘'로 심사 제출 작업을 재개했다.
  앞서 확인한 타사 콘텐츠 없음 응답을 저장했고 App Information의 Saved 표시를 확인했다.
  Add for Review 검증을 통과해 1.0.1 (2)가 Draft Submission / Item Ready to Submit,
  앱 상태 Ready for Review로 바뀌었다. **Submit for Review는 아직 누르지 않았다.**
  Mac/Vision Pro 배포 범위와 최종 TestFlight 실기기 확인 결과를 사용자에게 질문했다.
  개인정보·지원 공개 주소는 HTTP 200, 온라인 서버 health는 ok:true를 확인했다.
  무료 앱 계약 Active, Public 배포와 한국·미국·캐나다 선택을 확인했다. 수동 공개 유지.
  새 유료 계약과 EU DSA 심사 중 항목은 이번 세 국가 무료 출시에 대해 변경하지 않았다.
  증빙: artifacts/release-audit-2026-10-03/content-rights-saved.png 및 review-draft-ready.png.
- **개인정보 등록·게시 완료:** 사용자가 정식 배포 뒤 등록·라벨 작성을 승인했다. 한·영
  Privacy Policy URL과 계정 삭제 안내를 가리키는 Privacy Choices URL을 저장했다.
  Gameplay Content, User ID, Device ID, Other Data Types를 App Functionality /
  사용자와 연결됨 / 추적 없음으로 모두 저장했다. 사용자가 최종 동의하고 Publish를
  승인한 뒤 화면에 **Published a few seconds ago by boahs Park**가 표시됨을 확인했다.
  한국어·영어 URL 모두 저장 유지 확인. 개인정보 게시와 앱 심사 제출은 별개다.
  증빙: artifacts/release-audit-2026-10-03/app-privacy-published.png.
  다음 출시 작업은 콘텐츠 권리 선언과 Mac/Vision Pro 배포 범위 확인, 최종 제출 검증이다.
  이 후속 작업은 아래의 점검 시점 공란 기록보다 우선한다.
- **후속 갱신: 사용자가 정식 홈페이지를 배포했다.** https://tzib.studio/ 와
  /privacy/daeguk/, /support/daeguk/ 모두 쿠키·로그인 없는 요청에서 200이며 같은
  HTTPS 주소를 유지한다. Chrome에서 최신 홈페이지와 한·영 법적 문서도 확인했다.
  홈페이지 푸터·DAEGUK 문서 브랜드는 TZIB Studio, 법적 운영자는 Boahs Park다.
  아래의 403·로그인 요구·이전 홈페이지 관측은 정식 배포 전 기록이며 현재 차단이 아니다.
  이후 승인된 개인정보 URL 등록과 라벨 게시도 완료했다(위 후속 결과 참조).
- 사용자는 중단 뒤 직접 진행한 출시 설정과 홈페이지 이름 변경 가능성을 먼저 점검하도록
  요청했다. 이번에는 외부 설정·DNS·브랜드·심사 제출을 변경하지 않았다.
- 실제 App Store Connect: DAEGUK 1.0.1은 **Prepare for Submission**이며 빌드 2,
  한·영 스크린샷 각 5장, 무료, 한국·미국·캐나다, 심사 연락처와 수동 공개가 저장돼 있다.
- TestFlight 최신 조회: 내부 테스터 1명·빌드 1개, iPhone 15 Pro에 1.0.1 (2)
  Installed. 재로그인 전 보였던 Invited는 오래된 화면이었으며 현재 상태가 아니다.
- 연령 설문은 사용자 지정대로 판타지 폭력 None·무기 Infrequent. 한국 ALL/일반 9+.
  콘텐츠 권리는 아직 Set Up Content Rights Information. 개인정보는 한국어·영어 URL
  공란, Get Started/Publish 비활성으로 작성·게시가 남았다.
- Apple Silicon Mac와 Vision Pro도 공개 선택돼 있다. 기기 범위를 의도한 것인지 확인한다.
- 홈페이지 최신 원격 main은 bca0d59지만 Pages 최종 배포는 Sep 21 ef451b5.
  현재 Pages 도메인은 privacy.tzib.studio, 미리보기 noindex와 프로젝트 경로가 남아 있다.
- 사용자가 알려준 우회 주소 parkboa.github.io/tzib-studio/도 privacy.tzib.studio/로
  이동하며 이전 홈페이지가 보인다. 내부 Privacy·Support 링크는 프로젝트 경로가 남아 404.
- 정식 tzib.studio는 기존 Sites 게시본이며 ChatGPT 로그인 요구/custom 공개 범위다.
  등록된 Support URL과 심사 메모의 법적 URL은 공개 요청에 403을 반환한다.
- 최신 홈페이지 일반 페이지는 TZIB Interactive Studio, DAEGUK 문서·앱은 TZIB Studio,
  법적 운영자는 Boahs Park. 이번 출시에는 TZIB Studio 통일을 권장했으나 최종 선택 전이다.
- 상세 근거·다음 순서: docs/RELEASE_AUDIT_2026-10-03.md. 아래 10월 2일 기록의
  '다음 업로드'와 기타 과거 대기 항목은 이 현재 점검보다 우선하지 않는다.

## 출시 재개 — 2026-10-02

- 사용자 요청: 미완료 출시를 이어가고 메뉴·설정 위주 기존 스크린샷 대신 더 재미있어
  보이는 실제 대국·특수 능력 장면을 몇 장 새로 촬영한다.
- 앱 실행 자산은 기존 출시 후보 `c3f49ea` 이후 변경되지 않았음을 Git diff로 확인했다.
  시작 HEAD는 `bb28cdc`, 미추적 사용자 자료 `artifacts/live-auth-browser.png`는 보존한다.
- 현재 Mac의 Xcode는 27.0이다. 기존 iOS 14 deployment target이 앱과 Capacitor Pods
  모두에서 빌드 오류로 거절된다. Apple의 Xcode 지원 범위에 따라 최소 iOS를 15.0으로
  갱신하고 Podfile post_install에서 로컬 Pods에도 동일한 하한을 적용했다.
- `DEVELOPER_DIR`을 지정한 `npm run ios:sync`, Release Simulator 빌드, 로컬 서명된
  Release Archive 생성과 `codesign --verify --deep --strict` 모두 성공했다.
  Podfile.lock은 의존성 버전 변경 없이 Podfile 체크섬만 변경됐다. 원본·dist-mobile·
  iOS 공개 자산·Archive의 핵심 실행 자산 6개가 모두 일치한다.
- 사용자가 App Store Connect에 로그인했다. Bundle ID `com.boahspark.daeguk`와 앱
  레코드 `6818672488`을 새로 등록하고 한·영 문구·부제·카테고리·심사 메모를 저장했다.
  상태는 Prepare for Submission이며 업로드·심사 제출은 아직 하지 않았다.
- Xcode 27의 Device Hub 화면 제어가 계속 시간 초과다. 사용자는 simctl·XCTest 대안
  대신 장면 선택과 원본 촬영을 직접 맡았고 새 한·영 스크린샷 등록을 완료했다.
- 다음 행동: 검증된 배포 파일의 App Store Connect 업로드 승인을 받고 업로드한다.
  준비 폴더는 `artifacts/app-store/1.0.1/retake-2026-10-02/ko/` 및 `en/`이다.
- 변경 파일: `ios/App/App.xcodeproj/project.pbxproj`, `ios/App/Podfile`,
  `ios/App/Podfile.lock`, `TESTFLIGHT.md`, `docs/APP_STORE_RELEASE_CHECKLIST.md`,
  `docs/APP_STORE_SUBMISSION_DRAFT.md`, `docs/INTEGRATED_RELEASE_PLAN.md`,
  이 문서와 `artifacts/app-store/1.0.1/retake-2026-10-02/README.md`.
- 검증: 위 빌드·서명·자산 일치 확인 외 `ruby -c ios/App/Podfile`과
  `git diff --check` 통과. 게임 실행 자산 변경이 없어 기존 전체 게임 검사는 반복하지 않았다.

## 매일 시작할 때 붙여 넣기

```text
/Users/boahspark/Projects/AI-Workspace/projects/daeguk/unknown-kingdom의
AGENTS.md와 docs/WORK_HANDOFF.md를 읽고 이어서 작업해줘.
문서의 다음 작업 하나부터 진행하고, 완료 기준에 필요한 확인만 해줘.
이미 통과한 검사를 이유 없이 반복하지 말고 관련 없는 변경은 보존해줘.
중요한 결과와 중단 위치는 즉시 이 문서에 갱신해줘.
```

다른 모델도 같은 프로젝트 폴더에서 이 요청을 사용한다. 모델 사이의 자동 대화나 기억 공유가 아니라, 파일을 통해 인계하는 방식이다. 다른 컴퓨터라면 최신 파일을 전달해야 한다. 새 대화가 계정 사용 한도를 초기화하지는 않는다.

## 웹 계정 삭제 관측 — 2026-09-20

- 사용자 23:00:30/23:00:54/23:01:32 스크린샷: 이전 공개 ID, 삭제 확인창, 새 공개 ID가 순서대로 표시됨. 삭제 완료 메시지·동일 시크릿 세션 여부는 이미지에서 직접 확인 불가.
- 운영 읽기 전용 조회: 이전 공개 ID B29FF31CFB0410BCF422의 players 0, 새 ID F95B344D25E36FC78013의 players/identities/auth.users 연결은 각 1. 이전 게임 계정 제거와 신규 계정 연결 확인.
- 한계: 삭제 전 내부 Auth UUID를 확보하지 않아 이전 auth.users 행의 직접 부재 및 기존 토큰 재접속 차단은 이 조회로 증명하지 못함. 이전 ID 기준 LEFT JOIN의 auth_users=0을 독립적인 Auth 삭제 증거로 해석하지 않는다. 재삭제나 추가 계정 생성은 하지 않았다. 이는 발견된 기능 결함이 아니라 검증 근거의 한계다. 출시 전 최종 검증에서는 테스트 계정의 공개 ID와 내부 Auth UUID 연결을 삭제 전에 확보하고 삭제 후 직접 대조한다.

## 계정 삭제 증거 보강 완료 — 2026-09-21

- 기존 교체 계정 `F95B344D25E36FC78013`과 별개로, 현재 검증 브라우저의 공개 ID는
  `BB3C1C9F58C4C9BBEA77`이다. 이 ID의 active player·identity가 운영 DB에 각 1개
  존재함을 삭제 전에 읽기 전용으로 확인했다.
- 삭제 전 내부 player ID와 Auth UUID는 Git 밖의 권한 `0600` 임시 파일에만 보관했다.
  UUID와 비밀값은 문서·Git에 기록하지 않았고 검증 완료 뒤 임시 파일을 제거했다.
- 사용자가 온라인 대기실에 직접 진입했고 CAPTCHA는 표시되지 않았다. 기존 유효 세션이
  복원된 정상 흐름이며 새 게스트는 만들지 않았다. 화면의 공개 ID와 DB 매핑이 일치한다.
- 사용자가 `뒤로 → 설정 → 계정 삭제 → 영구 삭제`를 직접 수행했고 화면의
  “계정을 삭제했습니다. 다음 온라인 대국 때 새 게스트 계정이 만들어집니다.” 문구를
  확인했다. 저장한 삭제 전 기준으로 운영 DB의 player와 identity는 모두 0개다.
- 전용 게임 DB 로그인은 `auth.users`·`auth.sessions` 직접 조회 권한이 없어 Supabase
  관리 화면의 읽기 전용 SQL로 동일 UUID를 대조했다. 결과는 `auth.users=0`,
  `auth.sessions=0`, player=0, identity=0이다. 삭제 전 계정과 서버 세션 제거가 직접
  확인됐다. refresh token 원문은 브라우저 삭제 흐름에서 안전하게 폐기되어 추출하거나
  재생하지 않았다.
- 사용자가 새 공개 ID `5869A1237488DAADC8D2`를 전달했다. 이전 ID와 다르며 운영
  읽기 전용 조회 결과 player=1, identity=1, `auth.users`=1, `auth.sessions`=1이다.
  삭제 전·후·재생성의 계정 삭제 종단 증거가 완성됐다. 기존 refresh token 원문은
  보안상 추출·재생하지 않았고, 기존 Auth 세션 0과 새 인증 흐름·새 ID 생성으로 복원
  불가를 확인했다.
- 최종 자동 검사 완료: `npm test` 194개, `npm run test:browser` 41개,
  `node --check app.js`, `git diff --check`, `npm run ios:sync`, 원본·`dist-mobile`·iOS
  핵심 자산 일치, 서명 없는 Release iOS Simulator 빌드가 모두 통과했다. Pods Embed
  반복 실행 경고와 AppIntents 미사용 알림 외 컴파일 오류는 없다.
- 출시 후보 앱·코드 커밋은 `c3f49ea89f16b7d4f4b2395feeb12705e9ad79fe`다. 버전은
  `1.0.1 (2)`이며 사용자 검증 자료 `artifacts/live-auth-browser.png`는 포함하지 않았다.
- App Store 한·영 설명·키워드, Privacy·연령 등급·심사 메모와 스크린샷 계획 초안을
  `docs/APP_STORE_SUBMISSION_DRAFT.md`에 작성했다.
- iPhone 17 Pro Max Simulator(iOS 26.5)의 출시 후보에서 한국어·영어 6.9형
  `1320×2868` JPEG를 각 5장 만들고 규격·알파 채널·화면·민감정보 노출을 검수했다.
  위치는 `artifacts/app-store/1.0.1/`이다. 온라인 캡처는 새 계정/CAPTCHA 생성을 피해
  제외했다.
- 다음 행동: 운영자가 제출 문구·Privacy·연령 등급과 스크린샷을 최종 검토하고 단계 F
  수동 검증 순서를 확정한다.

## 최신 배포 결과 — 2026-09-20

- `0a33cb5dbf5635f0a4a5be8f85514bb5c9ac4778` main 푸시 완료. Vercel 커밋 상태 success, Render 배포 dep-dankf1rtqb8s73akv7rg Live(45.1초) 확인.
- 공개 app.js는 로컬과 바이트 일치. 서버 /health 정상. Vercel /auth/account에 쿠키 없는 DELETE 요청은 HTTP 401 NO_SESSION으로 거절됨. 실제 계정 삭제·새 계정 생성 없음.
- 특수 유닛 캐릭터·대사 설정과 효과음 아래 배치가 웹에 반영됨. 실제 계정 삭제 종단 검증과 App Store 출시는 별도 미완료.
- 이후 사용자 요청으로 이 배포 결과와 계정 삭제 검증 범위를 문서 커밋·푸시하고 자동 배포한다. 기능 코드 변경은 없다.

## 최신 운영 설정 — 2026-09-20

- 사용자 승인으로 SQL 002 계정 삭제 함수 적용 완료. daeguk_server 실행 허용, anon/authenticated 실행 차단을 운영 SQL 조회로 확인(3개 true). 실제 계정 삭제는 수행하지 않았다.
- Render daeguk-server에 기존 Supabase 서버 비밀 키를 SUPABASE_SECRET_KEY로 저장 완료(Save only). 키는 저장소·문서에 기록하지 않았다.
- 로컬 통합 7192b1d는 전체 테스트 194개와 모바일 빌드를 통과했다. 사용자 푸시·배포 승인에 따라 운영 배포 진행. 아래 미적용 표현은 이전 기록이다.

## 현재 목표와 다음 행동

현재 목표: **통합 출시 계획에 따라 코드 감사를 시작하고 iOS 출시를 완료한 뒤 Android로 이어간다.**

- 전체 순서·승인 경계·완료 기준의 상위 문서는 `docs/INTEGRATED_RELEASE_PLAN.md`다.
  `docs/APP_STORE_RELEASE_CHECKLIST.md`는 iOS 세부 체크리스트로 사용한다.
- 2026-09-21 출시 작업 기반은 게임 `main`과 `origin/main`의 `7f7b702`, 일반 사이트
  `tzib-studio`의 `main`과 `origin/main`은 `ef451b5`로 일치한다. 게임 저장소의
  미추적 `artifacts/live-auth-browser.png`는 사용자 검증 자료로 보존한다.
- 일반 사이트의 정식 목표 경로는 `/privacy/daeguk/`와 `/support/daeguk/`다.
  GitHub Pages Actions 첫 배포가 성공했고 `https://parkboa.github.io/tzib-studio/`에서
  홈페이지·한영 법적 페이지·호환 리디렉션을 검증했다. 미리보기에는
  `noindex, nofollow`가 유지된다. `tzib.studio` DNS와 사용자 정의 도메인은 변경하지
  않았으며 App Review 제출 직전 별도 승인으로 전환한다.
- 2026-09-14 지원 이메일 확인 완료: 사용자가 외부 메일로
  `support@tzib.studio`와 `daeguk@tzib.studio` 모두 실제 수신되는 것을 확인했다.
  두 주소는 현재 `parkboahs@gmail.com`으로 전달되며 수신 준비는 출시 차단 항목이 아니다.

- 로컬 구현 완료: 설정의 한·영 `계정 삭제` 진입과 영구 삭제 확인, `DELETE /auth/account`, Supabase Auth 하드 삭제, 비공개 player/identity 삭제 SQL 함수, 웹 쿠키/iOS Keychain·온라인 복귀표 제거를 연결했다. 삭제된 계정의 활성 WebSocket은 재접속 좌석을 남기지 않고 닫힌다. 없는 세션은 새 계정이나 CAPTCHA를 만들지 않는다.
- 개인정보·지원 준비: `docs/PRIVACY_SUPPORT_RELEASE.md`에 실제 데이터 지도, 제3자 처리자, App Store 입력 초안과 출시 순서를 기록했다. 확정된 운영자 정보로 한·영 공개 페이지와 앱 내 링크를 만들었다.
- 사용자 확정값: 스튜디오 도메인 `tzib.studio`, 게임 주소 `daeguk@tzib.studio`, 공통 지원 주소 `support@tzib.studio`. 제안 URL은 `/daeguk/privacy`, `/daeguk/support`이며 실제 도메인 호스팅 경로 확인이 남아 있다.
- 추가 확정값: 법적 운영자 `Boahs Park`, 운영자 소재 국가 캐나다, 목표 이용자는 전연령 일반 이용자. 한·영 `privacy.html`·`support.html`과 앱 설정 링크, Vercel 경로 rewrite를 로컬에 추가했다. App Store `Made for Kids`는 전연령과 별개이므로 자동 선택하지 않고 콘텐츠 설문으로 실제 등급을 정한다.
- 검증: 웹 단위 39개, 서버 18개, 계정 삭제·인증·네이티브·6개 화면 크기 한영 레이아웃 브라우저 20개, 개인정보·지원 페이지와 앱 링크 브라우저 3개, 모바일 빌드, iOS 자산 복사·핵심 파일 일치, 서명 없는 iOS 시뮬레이터 빌드, 공백 검사 통과. 모바일 한국어 삭제 확인 화면을 PNG로 직접 확인했다.
- 최신 상태: 운영 DB 마이그레이션과 Render 서버 비밀 저장은 완료됐다. 삭제 전 Auth
  UUID를 확보한 전용 테스트 게스트로 기존 Auth 사용자·세션·player·identity가 모두
  제거되고, 새 인증 흐름에서 다른 공개 ID와 새 Auth/player/identity 연결이 생성됨을
  확인했다. refresh token 원문은 추출·재생하지 않았다.

- 서버는 인증된 내부 player ID로 흑/백 좌석을 예약하고 연결 종료 뒤 기본 2분(`RECONNECT_GRACE_MS`) 동안 방·보드·현재 차례·남은 턴 시간을 메모리에 보존한다. 한 명 또는 두 명 모두 끊겨도 같은 ID의 `resume_room`만 복귀할 수 있고, 대기 중에는 턴 입력과 타이머가 정지한다. 진행 중 대국은 공개 방 목록에 노출하지 않는다.
- 클라이언트는 비밀값 없이 방 코드·진영·공개 ID만 localStorage에 저장한다. 예상치 못한 종료 시 점증 간격으로 유예 시간까지 자동 재접속하며, 페이지/앱 재실행 뒤 온라인 모드에 들어가도 저장된 대국 복귀를 먼저 시도한다. 복귀가 만료됐으면 새 방을 자동 생성하지 않고 대기실로 돌아간다. 명시적으로 대국을 나가면 복귀 표를 삭제한다.
- 검증: 실제 인증 WebSocket 두 계정으로 한쪽 및 양쪽 연결 종료 → 동일 좌석·배치 말·차례·일시 정지된 남은 시간 복원, 타 계정 좌석 탈취 차단을 확인했다. `npm test` 188개 통과, 관련 브라우저 흐름 17개 통과(초기 16개 통과 후 인증 모킹이 빠진 기존 1개를 보완해 단독 재검증), 모바일 빌드·iOS 자산 복사와 원본/빌드/iOS 핵심 JS 일치, 변경 공백 검사 통과.
- 배포: 격리된 배포 저장소에서 origin/main `dc5f843` 위에 검증된 재접속 변경만 구성해 `2e28d6e`(`feat: resume interrupted online matches`)로 main에 push했다. Vercel 배포 성공 상태와 공개 `app.js`/`js/network.js`의 `reconnect-1`·`resume_room`, 공개 `index.html`의 네트워크 ID 요소를 확인했다. Render는 `render.yaml`의 main 자동 배포가 활성화되어 있고 push 뒤 운영 `/health`가 `{ok:true,rooms:0}`로 응답했다. Render 관리 화면은 GitHub 재로그인이 필요해 실행 커밋 표시는 직접 확인하지 못했다.
- 실기기 최종 검증: 사용자가 iPhone과 공개 웹 상대 환경에서 연결 종료 후 2분 안에 복귀해 같은 방·진영·보드·차례가 복원된 것을 확인했다. 기존 CAPTCHA·계정 유지 검증은 반복하지 않는다.
- 서버 장애 정책 완료: 서버 프로세스마다 공개 인스턴스 ID를 발급하고 대국 복귀표에 함께 저장한다. 재접속한 서버의 ID가 달라지면 일반 연결 만료와 구분해 해당 대국을 승패 없이 무효 처리하고, 복귀표를 삭제한 뒤 대기실에서 한영 사과 안내를 표시한다. 승패·랭킹 기록은 현재 제품에 없으므로 추가 기록 변경은 없다.
- 배포·검증: 격리된 운영 저장소에서 전체 테스트 191개, 인증/장애 브라우저 흐름 4개, 모바일 빌드와 공백 검사를 통과했다. `737e294`(`feat: void matches after server restart`)로 main에 push했고 Vercel 성공 상태, 공개 `server-fault-1`·`match_voided` 자산, Render health 정상 응답을 확인했다. 원본 iOS 자산도 다시 복사해 핵심 network.js 일치를 확인했다.
- 한계: 방 상태는 계속 서버 메모리에만 있으며 실제 복원은 하지 않는다. 서버 장애 시 양쪽 모두 패배 없이 무효 처리하는 현재 합의에 따른 의도된 동작이다. 이번 배포 시점 이전 형식으로 저장된 복귀표에는 서버 인스턴스 ID가 없어 최초 1회는 일반 복귀 불가 안내로 끝날 수 있고, 새 배포 이후 생성된 대국부터 장애 원인을 정확히 구분한다.
- 출시 후보: 버전 `1.0.1 (2)`, 앱·코드 커밋
  `c3f49ea89f16b7d4f4b2395feeb12705e9ad79fe`. 이후 상태 문서 커밋은 앱 실행 자산을
  변경하지 않는다.
- 다음 단일 행동: 운영자가 `docs/APP_STORE_SUBMISSION_DRAFT.md`와
  `artifacts/app-store/1.0.1/`을 최종 검토하고 단계 F 수동 검증 순서를 확정한다.

### 완료된 이전 목표 — iOS 인증과 로그 억제

- 완료 근거: 19:47/19:48 스크린샷에서 최초 CAPTCHA 경유 게스트 인증·온라인 대기실 진입 확인. 19:52/19:53에는 동일 공개 ID와 상대 연결 후 가위바위보 단계·방 목록 수신 확인. 사용자가 직접 방 생성 후 앱 완전 종료·재실행한 화면이라고 명시적으로 확인하고 완료 기록을 요청했다. iOS 인증·직접 방 생성·완전 종료 후 동일 계정 복원 검증 완료로 기록한다.
- 로그 수정 완료: capacitor.config.json에 `ios.loggingBehavior: "none"` 적용. 설치된 Capacitor 소스에서 동일 설정이 네이티브 CAPLog와 JS 브리지 요청·응답 로그를 모두 끄는 경로를 확인했다. CAPTCHA 토큰 반환과 Keychain get/set 데이터에 적용된다. 앱 화면의 오류 문구·안전한 오류 코드는 유지한다. Capacitor 일반 로그/콘솔의 Xcode 전달도 꺼지며 iOS/WebKit 자체 시스템 로그는 별개다.
- 검증: 실제 설치된 native-bridge.js를 실행하는 신규 테스트 2개 통과(1.2초). 로그 활성 대조군은 6회 로깅, 비활성은 0회이며 set/get/requestCaptcha 응답 전달은 유지됐다. 실제 계정·토큰 없이 합성 데이터만 사용. `npx cap copy ios` 성공 및 원본/앱 번들 설정 none 일치, 변경 공백 검사 통과. 네이티브 CAPLog 경로는 소스 확인이며 새 iPhone 콘솔을 직접 관찰한 결과는 아니다.
- 반영: 사용자가 다음 Xcode Run으로 앱을 업데이트하면 적용된다. 기존 설치 앱에 즉시 적용되거나 과거 로그가 삭제되는 것은 아니다. 기존 CAPTCHA·방 생성·계정 유지 검사를 반복할 필요는 없다. Swift/Pods·게임 JS 변경, 전체 테스트·빌드·재배포 없음.
- 이후 권장 작업: 프록시 다중 사용자·부하 검증은 공개 이용 확대 전 별도 진행한다.
- 사용자 입력 대기 없음. 완료한 실기기 조작·테스트·빌드·배포를 다시 요구하지 않는다. 아래 미확인/대기 표현은 완료 전 경과 기록이며 현재 다음 행동이 아니다.

### 완료 전 관측·수정 이력

- 추가 실기기 관측(사용자 19:52/19:53 스크린샷): 이전과 동일한 공개 ID 유지. 19:52에는 상대 연결 후 가위바위보 단계 진입, 19:53에는 대기실의 제2대국장 목록 표시를 확인했다. 두 스크린샷 사이 앱 완전 종료 여부, 해당 사용자의 직접 방 생성 여부는 화면만으로 확정할 수 없다. 다음은 사용자에게 완전 종료·재실행 여부를 확인하며, 이미 수행했다면 반복을 요구하지 않는다.

- 실기기 진전(사용자 19:47/19:48 스크린샷): CAPTCHA 결과 반환, Keychain 미저장 상태 읽기 및 set 호출, 공개 ID가 표시된 정상 온라인 대기실을 확인했다. 신규 iOS CAPTCHA 경유 게스트 인증·인증된 온라인 접속 성공으로 기록한다. 방 생성·앱 완전 종료 후 동일 공개 ID 복원은 아직 미확인이다. 표시 ID는 publicCode이며 내부 player_id/Supabase UID와 구분한다.
- 현재 다음 행동: 사용자가 `만들기`로 방 생성 확인 → 방에서 나오기 → 앱 완전 종료·재실행 → 공개 ID 동일 여부와 방 생성 확인. 최초 CAPTCHA 검증은 반복하지 않는다.
- 추가 관측: Xcode의 Capacitor `TO JS` 디버그 출력에 CAPTCHA 토큰이 보였다. 값은 문서에 복사하지 않았다. 네이티브 브리지 디버그 로그의 인증값 노출 억제를 후속 수정 대상으로 기록한다. 다음 사용자 결과는 공개 ID·방 생성 여부만 받는다.

- 최신 사용자 로그(스크린샷 19:43:02): `Loading app at capacitor://localhost`, `WebView loaded`, `Guest authentication failed: TypeError` 2회 확인. 네이티브 앱 실행은 확인됐으나 해당 TypeError는 수정 전 로그 형식이다. 현재 원본·ios/App/App/public의 network.js는 허용 코드만 출력하므로 `TypeError`를 그대로 출력하지 않는다. 이전 콘솔 기록이거나 이전 앱 자산을 실행했을 가능성을 먼저 구분한다. 다음은 사용자가 Xcode 실행 중지 → 콘솔 비우기 → 이 저장소 App.xcworkspace에서 iPhone Run → 온라인 진입 후 새 로그 확인. 앱·Keychain 삭제와 테스트/빌드 반복은 하지 않았다.

- 최신 수정: `js/auth.js`에서 주입된 `Capacitor.Plugins.DaegukSession`을 사용하고 get/set/requestCaptcha 메서드를 확인한다. 누락은 `NATIVE_BRIDGE_UNAVAILABLE`로 처리해 계정 생성이나 소켓 연결을 진행하지 않는다.
- 오류 안내: js/network.js·js/config.js·app.js에서 초기 인증 실패를 서버 연결 오류와 구분해 표시한다. 알려진 오류 코드만 표시하고 원문 예외·토큰은 노출하지 않는다.
- 최신 검증: 실제 iOS 주입 구조처럼 registerPlugin이 없는 테스트로 교체, 누락 플러그인/메서드 4개와 대기실 인증 오류 표시 검증 추가. 관련 브라우저 테스트 13개 통과(10.5초). `npm run build:mobile` 및 `npx cap copy ios` 성공. 복사된 auth.js/network.js/config.js/app.js 원본 일치와 변경 파일 공백 검사 통과.
- 이번 변경은 JS·테스트·문서에 한정한다. Swift·Pods 변경이 없으므로 기존 네이티브 컴파일 검사는 반복하지 않았다. 운영 서버·웹 재배포와 실제 계정 발급도 하지 않았다.
- **다음 단일 행동: Xcode에서 App scheme과 본인 iPhone을 선택해 Run한 뒤 온라인 대국에 진입한다.** 사용자가 CAPTCHA·공개 ID·방 생성 결과를 알려주면 다음 단계를 판단한다. 기존 설치 앱을 그냥 재실행하는 것만으로는 이번 수정이 반영되지 않는다.

아래는 수정 전 원인과 준비 이력이다.

- 사용자 제보: iPhone 온라인 대기실에서 CAPTCHA 없이 “게임 서버를 사용할 수 없습니다. 온라인 PvP에는 WebSocket 서버가 필요합니다.” 표시. 스크린샷만으로 네이티브 앱/웹 실행 경로와 실제 예외는 확정하지 못했다.
- 재검토 결과: `js/auth.js`는 `globalThis.Capacitor.registerPlugin('DaegukSession')`을 호출하지만 이 프로젝트는 `@capacitor/core` JS 런타임을 앱에 번들/로드하지 않는다. 설치된 iOS `native-bridge.js`는 registerPlugin을 제공하지 않고 `JSExport.swift`는 플러그인을 `Capacitor.Plugins.DaegukSession`에 주입한다. iOS 공개 자산에도 같은 잘못된 호출이 남아 있다.
- 재현: 실제 주입 형태를 모델링한 Node 확인에서 `globalThis.Capacitor.registerPlugin is not a function`, Keychain 읽기 0회. HTTP/CAPTCHA/WebSocket 이전에 실패한다. iPhone 로그로 동일 예외를 직접 확인한 것은 아니다.
- 이전 테스트의 한계: `test/browser/native-auth.spec.js`가 registerPlugin을 가짜로 제공해 이 결함을 놓쳤다. 이전 8개 테스트·빌드 통과는 이 호출의 실기기 호환성을 보장하지 않는다.
- 이전 설명 정정: `js/network.js`는 초기 인증 실패에도 공통 서버 오류 문구를 표시한다. 스크린샷만으로 WebSocket 실패를 확정할 수 없다. 직전 health 200/ok:true는 HTTP 생존만 확인하며 인증/WS 성공은 증명하지 않는다. 추가 POST·WS 진단은 사용자 중단으로 실행되지 않았다.
- 진단 당시 제안했던 플러그인 접근·회귀 테스트·오류 안내 수정은 위 최신 작업에서 완료했다. 원격 POST·WS 진단은 재시도하지 않았다.

- 발견/수정: 기존 iOS는 `capacitor://localhost`에서 웹 CAPTCHA를 직접 렌더링했다. 고정 운영 HTTPS 페이지를 전용 WKWebView로 열고 결과만 앱에 반환하도록 연결했다. Keychain 접근은 로컬 앱에 제한하고 CAPTCHA 창에는 해당 브리지를 주지 않는다.
- 공개 ID 표시: 앱 온라인 대기실에 `ID`를 표시해 종료 전후 동일 계정을 비교할 수 있게 했다.
- 배포: `dc5f843`(인증 HTML/JS 두 파일만) 운영 main에 push 완료. 공개 두 파일 원본 일치 확인. 원래 작업 폴더의 화면·iOS 변경은 웹에 배포하지 않았다. 임시 분리 저장소 `/private/tmp/daeguk-ios-captcha-release` 사용.
- 새 검증: 관련 브라우저 테스트 8개, `ios:sync`(모바일 빌드 포함), Xcode Debug iphoneos 서명 없는 빌드, 변경 파일 공백 검사 통과. 운영 iOS Origin OPTIONS도 204/허용 헤더 확인. 첫 브라우저/Xcode 실행은 샌드박스 제약으로 실패했고 권한 확장 후 통과했다. 네이티브 브리지·Keychain·CAPTCHA 자동 테스트는 모킹이다.
- **수정된 자산 복사 완료. 새 앱으로 실기기 확인 가능.** 상세 절차와 결과 양식: [IOS_AUTH_CHECKLIST.md](IOS_AUTH_CHECKLIST.md).
- 사용자 조작 전에 AI가 튜토리얼·CAPTCHA·실기기 앱을 대신 조작하지 않는다. 기존 앱·Keychain 삭제 금지. 실기기 확인 전 신규 가입·복원 성공으로 기록하지 않는다.
- 한도 중단 후 재개 정리: 새 파일·문서 공백 검사를 마쳤다. 이전 `/private/tmp` 테스트 로그와 배포 다운로드 사본은 현재 존재하지 않아 재열람하지 못했다. 이전 도구 출력의 성공 결과는 유지하며 테스트·빌드·배포를 반복하지 않았다. 배포용 임시 저장소도 재사용 전 존재 여부를 확인한다. 남은 작업은 사용자 실기기 확인뿐이다.

### 완료된 이전 목표 — 웹 인증

목표: 공개 웹에서 CAPTCHA 보호 게스트 인증, 새로고침 후 접속, 방 생성 확인 및 운영 기록 정리. **2026-09-11 완료.**

| 순서 | 작업 | 결과 |
|---|---|---|
| 1 | 깨끗한 별도 브라우저에서 최초 가입 확인 | Chrome 사용자 선택 화면에서 게스트 모드 시작 → 튜토리얼 진행 및 온라인 해금 확인 → 실제 Cloudflare Turnstile 표시 → 대기실 진입 → 제1대국장 생성 성공 |
| 2 | 새로고침 접속 안정성 확인 | 같은 창에서 페이지 새로고침 → 온라인 대국 → CAPTCHA 재표시 없이 제2대국장 생성 1회 성공. 대기실 새로고침 재시도 불필요, 1006 오류 미재현 |
| 3 | 운영 기록 정리 | 이 문서와 GUEST_AUTH_SETUP.md에 최신 상태·관측 한계 반영. 제품 코드·배포 변경 없음 |

검증 시각: 2026-09-11 약 09:57–09:59 EDT. 기존 프로필 쿠키를 보존하고 하나의 새 게스트 세션만 사용했다. 에이전트의 CAPTCHA 클릭·토큰 조작은 없었다. 실제 위젯 표시와 그 뒤 방 생성 성공을 관측했으며, 위젯 종료가 자동 통과인지 사용자 조작인지는 관측하지 못했다. HTTP 응답·계정 ID·토큰을 별도로 수집하지 않았다. 튜토리얼 중 사용자 브라우저 조작 감지 후 최신 화면에서 온라인 해금을 확인해 이어갔다.

검증 후 `뒤로`로 제2대국장에서 나와 대국 선택 화면으로 복귀했다. Chrome 게스트 창은 세션 보존을 위해 열어 두었다. 모든 게스트 창을 닫으면 해당 브라우저 세션은 사라진다.

**이전 웹 인증 작업은 종료했다. 현재 iOS 작업은 위 상태를 따른다.** 과거 1006 원인은 미확정이나 이번에 재현되지 않아 추가 진단하지 않는다. iOS CAPTCHA/Keychain 실기기 확인, 프록시 뒤 다중 사용자 제한·부하 검증은 별도 후속 작업이며 자동 착수하지 않는다.

## 확인된 사실 — 다시 시작하지 않을 항목

사용자 작업 분담(2026-09-11): 튜토리얼 진행·해금처럼 사용자가 직접 할 수 있는 화면 조작은 사용자가 한다. CAPTCHA 확인, 실기기 앱 실행·종료·재실행, 수동 대국도 필요한 조작과 확인 결과만 짧게 안내하고 사용자 결과를 기다린다. 명시적으로 맡기기 전 AI가 대신 반복 조작하거나 해금 상태를 우회하지 않는다. AI는 코드·검증 준비·오류 진단·문서 정리를 담당하며 독립적인 작업은 계속한다.

후속 순서(1번 준비 착수·완료, 실기기 결과 대기; 2–3번 미착수):
1. iOS 실기기 인증 확인 준비: 현재 CAPTCHA 연결 방식과 Keychain 저장·복원 경로를 코드에서 확인하고 사용자의 실기기 확인 절차를 준비한다. 사용자가 최초 접속 → 앱 완전 종료·재실행 → 같은 게스트 ID 유지·온라인 방 생성 여부를 확인한다. 웹 성공을 iOS 성공으로 간주하지 않는다.
2. 경기 중 연결 끊김·재접속 복구: 새로고침 뒤 새 방 생성과 기존 경기 복구를 구분한다. 참가자 자리·턴·보드 복구 정책을 정한 후 구현한다. 실제 두 기기 조작은 사용자가 담당한다.
3. 공개 이용 확대 전 프록시 뒤 다중 사용자 제한·부하 검증. 운영 부하를 임의로 발생시키지 않고 격리된 검증 환경부터 준비한다.

아래 항목은 완료된 웹 인증 사실이다. 1번 iOS 준비는 사용자 요청으로 착수했으며 2–3번은 별도 후속 제안이다.

- Render DATABASE_URL 저장 및 전용 DB 로그인·TLS·최소 권한 검증은 이전 작업에서 완료했다. 비밀번호를 다시 만들거나 환경값을 재입력할 필요는 없다.
- Cloudflare Managed Turnstile 위젯과 공개 사이트 키 연결, Supabase CAPTCHA 보호 활성화 완료. 허용 웹 호스트는 unknown-kingdom.vercel.app. 비밀 키는 Supabase에만 저장했다.
- 2026-09-09 실제 Supabase 가입 API에서 CAPTCHA 누락/잘못된 토큰 모두 400/captcha_failed로 거절됨. 2026-09-11 정상 신규 게스트 UI 흐름과 방 생성 성공 확인(위 관측 한계 참고).
- 0a96ef5: CAPTCHA 보호 게스트 인증 활성화. 서버 AUTH_MODE=required, 웹 enabled=true, Vercel 동일 출처 /auth 프록시 적용.
- 6606d08: 초기 인증 실패 상태 유지 및 비밀값 없는 오류 분류.
- fbf7679: 대기실 목록 갱신·방 생성에서 기존 인증 소켓 재사용. 연결을 끊고 다시 여는 중복 접속 검사 충돌 가능성을 제거했다. 비정상 종료 코드를 표시한다.
- fbf7679의 Render Live / Vercel Production Ready를 2026-09-10 작업에서 확인했다. 오늘 원격 상태를 새로 조회한 것은 아니다.
- 과거 운영 검증 기록(이번 신규 게스트 검증과 별개): 기존 세션 접속 → 제1대국장 생성 성공. 페이지 새로고침 후 1006 종료 1회, 대기실 새로고침으로 재접속 → 제2대국장 생성 성공. **1006 원인은 확정되지 않았다.**
- fbf7679 기준 코드 테스트 184개, 인증/CAPTCHA 브라우저 테스트 5개, build:mobile, diff 검사 통과. 브라우저 자동 테스트는 CAPTCHA/인증 응답을 모킹하므로 운영 신규 가입 증거와 구분한다.

## 파일·배포 위치

- 저장소: /Users/boahspark/Projects/AI-Workspace/projects/daeguk/unknown-kingdom
- 공개 웹: https://unknown-kingdom.vercel.app/?lang=ko
- 서버 health: https://unknown-kingdom-server.onrender.com/health
- Render: https://dashboard.render.com/web/srv-d8rea8mrnols73fat800/deploys
- Vercel: https://vercel.com/shalom21/unknown-kingdom/deployments?environment=production
- 인증 관련: js/auth-config.js, js/auth.js, js/captcha.js, js/network.js, app.js, server/auth.js, server/auth-http.js, server/server.js, vercel.json
- 관련 테스트: test/auth-client.test.js, test/browser/auth-handshake.spec.js, test/browser/captcha.spec.js, server/auth*.test.js
- 상세 과거 기록: docs/GUEST_AUTH_SETUP.md. 막힌 항목과 관련된 부분만 읽는다.

## 로컬 변경 보호

- 2026-09-19/20 사용자 요청으로 로컬 변경을 `2c5636a`에 보존하고 `origin/main` (`737e294`)의 6개 커밋을 로컬 main에 병합했다. 원격 코드가 이미 로컬 후속 구현에 포함돼 있어 기존 기능은 보존하고 원격 CODEX 기록만 추가했다. 전체 테스트 194개, 모바일 빌드, 공백 검사 통과. 푸시·운영 배포는 하지 않았다. `artifacts/live-auth-browser.png`는 미추적 로컬 자료로 유지한다. 아래 d792aa0·격리 저장소 설명은 과거 작업 경과다.

- 로컬 main은 d792aa0 기반이며 화면·iOS 등 커밋되지 않은 변경과 인증 관련 미추적 파일이 많다. 재접속 운영 배포는 이 작업 트리를 커밋하지 않고 origin/main `dc5f843` 기반의 격리 저장소에서 `2e28d6e`로 만들었다.
- 운영 수정은 별도 worktree /private/tmp/daeguk-auth-live-fix, branch codex/auth-live-fix에서 진행했다. 임시 경로는 사라질 수 있으므로 존재를 확인하고, 없으면 확인된 배포 커밋에서 격리된 작업 공간을 만든다.
- 6606d08/fbf7679의 관련 수정은 원래 작업 폴더에도 패치 적용했다. 같은 패치를 중복 적용하지 않는다.
- git status를 먼저 확인한다. git add . / 무조건 pull·reset / 작업 트리 전체 덮어쓰기는 하지 않는다. 배포할 변경만 분리하고 사용자 작업을 보존한다.
- 환경 파일·쿠키·접근/갱신 토큰·DB URL·비밀 키를 출력하거나 인계 문서에 넣지 않는다.

## 토큰 절약 실행 규칙

1. 시작 읽기는 AGENTS.md + 이 문서 + git status로 한정한다. 이후 현재 문제에 필요한 파일 부분만 읽는다.
2. 기본 모델은 Sol을 권장한다. 상태 조회·문서 정리는 Terra/Luna도 가능하다. Astra는 재현 증거가 있는 복잡한 문제의 분석에 한정하고, 모델 선택은 사용자가 한다.
   - 작업에 현재 모델이 과하거나 부족하다고 판단되면 실행 전에 현재 모델·권장 모델·이유를 알리고 사용자 답변을 기다린다. 예: "현재 모델은 GPT-6 Astra입니다. 이번 문서 정리는 Terra로도 충분해 사용량을 줄일 수 있습니다. 현재 Astra로 계속 진행할까요?"
   - 이미 같은 작업에 승인받았다면 다시 묻지 않는다. 모델이 적합한 경우에는 바로 진행한다. 모델명을 확인할 수 없으면 추측하지 않으며 모델 변경은 사용자가 한다.
3. 모델 변경 요청에는 질문·관련 파일·관측 증거·시도한 방법·원하는 결과만 전달한다. 전체 대화나 전체 로그를 복사하지 않는다.
4. 도구 출력은 보통 1,000~2,000 토큰 이내로 제한한다. 배포 목록 전체, 수백 줄 성공 테스트 로그, 전체 대시보드 DOM을 반복 출력하지 않는다. 상세 로그는 파일에 저장하고 실패 부분만 읽는다.
5. 브라우저는 실제 UI 검증과 관리자 설정에 사용한다. 코드 검색·공개 health·빌드 확인은 목적에 맞는 파일/CLI/API 도구로 처리한다. 브라우저 도구 제한을 우회하지 않는다.
6. 배포는 실패 증거에 따른 수정이 있을 때만 한다. 변경 없는 배포 상태를 연속 조회하지 않는다. 대기는 모델 호출을 반복하는 대신 가능한 대기 기능을 사용한다.
7. 같은 실패를 같은 방식으로 두 번 재현하면 새 증거 없이 반복하지 않는다. 원인 가설과 다음 구분 검사를 기록한 뒤 접근을 바꾼다. 외부 입력이 필수이면 정확한 장애물만 보고한다.
8. 검사는 변경 범위에 맞춘다. 인증 수정은 관련 테스트, 빌드 영향은 빌드 확인. 통과 후 추가 변경이 없으면 전체 테스트를 다시 돌리지 않는다. 단순 문서 편집은 diff 확인이면 충분하다.
9. 한도 조회가 가능하면 장시간 작업 시작과 큰 단계 완료 때만 확인한다. 정확한 토큰 예산 강제나 중단 방지를 보장하지 않는다. 초기화 크레딧·유료 구매는 별도 사용자 요청 없이 사용하지 않는다.
10. 배포·검증 성공 또는 접근 방식 변경 직후 아래 인계 상태를 갱신한다. 종료 직전까지 미루지 않는다. 한 번에 한 모델만 파일을 수정한다.

## 모델 간 인계 상태 — 다음 작업자가 갱신

- 갱신자/날짜: Codex / 2026-10-02
- 현재 HEAD: `bb28cdc`. 최소 iOS 15 호환 설정·관련 문서가 로컬 변경 상태다.
  앱 JS/CSS/HTML은 기존 `c3f49ea`와 동일하다. 최종 네이티브 후보 SHA는 커밋 후 고정한다.
- 검증 완료: iOS sync, Xcode 27 Release Simulator 빌드, 로컬 서명된 Release Archive,
  서명 검증, 원본·모바일·iOS·Archive 핵심 파일 6개 일치. 기존 전체 자동 검사 194/41개는
  게임 자산 변경이 없어 이유 없이 반복하지 않았다.
- Archive: `build/DAEGUK-1.0.1-2.xcarchive`, `1.0.1 (2)`, 최소 iOS 15, iphoneos27.0.
  Archive 서명은 Apple Development다. App Store 배포용 IPA export·검증은 완료됐고
  업로드와 Apple 처리는 완료됐고 TestFlight 내부 초대가 남아 있다.
- App Store Connect: 앱 `6818672488`, SKU `daeguk-ios`, 기본 언어 Korean, English U.S.
  현지화 추가. 한·영 문구·부제, Games / Board / Strategy, 저작권, Support URL 초안,
  심사 메모·수동 출시·무료 가격·한국/미국/캐나다 판매 지역 설정 저장.
  개인정보·연령 등급·콘텐츠 권리·
  DSA 응답 필요 여부·심사 연락처는 미완료다.
  처리 완료된 빌드 `1.0.1 (2)`를 App Store 버전 1.0.1 초안에 연결·저장했다. 한·영 새 스크린샷 등록은 완료했다.
- App Privacy 초안 보강: 온라인 방의 대국 상태를 메모리에 보존하므로 User ID 외
  Gameplay Content를 포함한다. Turnstile은 보안 신호를 봇 탐지 개선에도 사용한다고
  명시하므로 추가 데이터 유형·사용자 연결 여부를 최종 검토한다. Privacy 선언은 게시 안 됨.
- 스크린샷: 사용자가 직접 촬영한 한국어 PNG 9장을 `artifacts/app-store/1.0.1/ko/`에서
  발견했다. 모두 1320×2868, 완전 불투명 RGBA. 시각 검수 후 흑 장군 → 백 마법사 →
  순간이동 선택 → 외교관 → 백 장군 순으로 5장을 `retake-2026-10-02/ko/`에 RGB PNG로
  무손실 내보냈다. 전환 효과 잔상이 남은 승리 2장은 제외. 원본 픽셀·기존 한·영 세트 보존,
  새 영어 16장도 발견하여 마법사 → 중반전 → 순간이동 → 외교관 → 왕 대결 5장을
  `retake-2026-10-02/en/`에 같은 방식으로 내보냈다. 상세 매핑은 폴더 README 참조.
  Device Hub 화면 제어 시간 초과로 AI 촬영은 수행하지 못했고 simctl·XCTest도 쓰지 않았다.
- ASC 스크린샷 완료: Chrome 파일 권한 변경 후 한·영 각 5장이 iPhone 6.9형에 등록됐다.
  영어 추가 5장 전송은 사용자가 명시적으로 승인했다. 업로드 완료 순서가 임의이므로 UI
  드래그로 문서 순서에 맞췄다. 새로고침·언어 재선택 후 양쪽 5/10장·파일 순서 유지 확인.
  6.5형은 해당 언어 6.9형을 자동 사용. Media Manager 탭 `706807462`, Chrome 브라우저
  연결 ID `3` (확장 재시작 후 변경), 현재 English U.S.를 표시한다.
- 연령 등급 확인: 새 장군 이미지의 창을 확인하여 설문 초안의
  `Guns or other weapons: None`을 최종 확인 대상으로 정정했다.
- 배포 파일 완료: 사용자가 배포 인증서·프로파일 생성/다운로드를 명시적으로 허용했다.
  `xcodebuild -exportArchive -allowProvisioningUpdates` 성공. 결과는
  `build/export-1.0.1-2/App.ipa`이며 Apple Distribution / 팀 `3X9AZQY6CN` 서명이다.
  `codesign --verify --deep --strict` 통과. App Store 프로파일은 `get-task-allow=false`,
  기기 목록·전체 기기 배포 없음. 버전 `1.0.1 (2)`, 최소 iOS 15, iPhone 대상 및 핵심
  실행 자산 6개 원본 일치를 확인했다. IPA SHA256:
  `44a6b75116a3222fa8119759abdca8c05917921cfc7164ff5e1ea07e9e59ce57`.
  로컬 옵션 `/private/tmp/daeguk-export-local-20261002.plist`는 `destination=export`,
  `manageAppVersionAndBuildNumber=false`. 기존 저장소 옵션은 `destination=upload`이므로
  업로드 승인 전 그대로 실행하지 않는다. 로그 `/private/tmp/daeguk-export-20261002.log`.
- 사용자 확정 및 ASC 저장 완료: 무료 가격, 첫 출시 국가 한국·미국·캐나다.
  Availability(3 Countries or Regions)에 세 국가의 Available on App Release를 확인했다.
- 사용자 업로드 승인: `DAEGUK 1.0.1 (2) 업로드 허용` 답변을 받았다.
  Xcode 업로드는 23:49 EDT에 성공했다 (`Upload succeeded`, `EXPORT SUCCEEDED`).
  Apple 처리 완료 후 TestFlight `Version 1.0.1` / `Build 2` / `Ready to Submit`를 확인했다.
  빌드 ID `1df2fb84-236f-4cb8-9175-ebfe80a1a871`. 로그 `/private/tmp/daeguk-upload-20261002.log`.
  What to Test 한국어 출시 후보 안내 저장 완료. 그룹·개별 테스터는 아직 0명.
- 내부 TestFlight 완료: 사용자가 본인 계정에 초대 메일 발송을 허용했다.
  `DAEGUK Internal` 그룹 생성(자동 배포 해제), `1.0.1 (2)` 연결 및 본인 계정만 초대했다.
  그룹 ID `bcd21faa-66b8-48b5-a69d-921fa08b3039`, 1 Tester / 1 Build / Invited 확인.
  Chrome ID 3 / 탭 `706807475`에 그룹 테스터 페이지가 열려 있다.
- 콘텐츠 권리 사용자 확정: 모두 직접 제작, 타사 콘텐츠 없음. ASC No 응답 저장 준비.
- 연령 설문 준비: Chrome 3 / 탭 `706807462`, Step 5 Violence에 도달.
  Step 1 기능 8개 모두 No, Step 2 성인 주제 3개 None, Step 3 의료 None·웰니스 No,
  Step 4 성/노출 3개 None 선택 상태이며 아직 전체 저장 전. 폭력·무기 빈도 답변 대기.
- 사용자 확인 요청: iPhone에서 초대 메일로 설치하고 앱·튜토리얼·AI 대국 시작 확인.
  실기기 결과는 아직 대기 중이며 수동 검증 완료로 기록하지 않는다.
- 다음 행동: 실기기 결과 대기와 병행해 미완료 스토어 선언·심사 연락처·정식 URL 준비.
  앱 공개·App Review 심사 제출은 별도 단계이며 아직 하지 않았다.
- 재실행 금지: 기존 CAPTCHA·계정 생성/삭제·재접속 검증과 자동 검사의 이유 없는 반복,
  기존 계정·Keychain 삭제, 사용자 `artifacts/live-auth-browser.png` 변경/커밋.
- 별도 확인 경계: 정식 사이트 DNS/도메인 전환과 App Review 심사 제출은 구체적인
  준비 결과를 검토한 뒤 명시적 승인을 받는다. 심사 연락처는 사용자가 화면에 직접 입력한다.

이 구역은 다음 모델이 최신 상태로 교체한다. 장문의 일지는 누적하지 않는다. 과거 상세 사항이 필요할 때만 관련 문서를 링크한다.
