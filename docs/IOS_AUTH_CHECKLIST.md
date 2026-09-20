# iOS 실기기 게스트 인증 확인

최종 갱신: 2026-09-11 / Codex. **실기기 검증 완료.**

최종 결과: 실제 iPhone에서 CAPTCHA 경유 신규 게스트 인증, 직접 방 생성, 앱 완전 종료·재실행 후 동일 공개 ID 유지 확인. 19:47–19:53 스크린샷과 사용자의 명시적 완료 확인에 근거한다. 상대 연결 후 가위바위보 단계와 방 목록 표시도 확인했다. 완료된 조작을 반복하지 않는다.

후속 로그 수정 완료: `ios.loggingBehavior: "none"`으로 Capacitor 브리지 요청·응답 및 Xcode 콘솔 전달 로그를 끄고 앱 번들에 복사했다. 설치된 JS 브리지의 합성 데이터 시험 2개 통과, 네이티브 CAPLog 설정 경로는 소스로 확인했다. 실제 기기에는 다음 Xcode Run으로 적용된다. 화면의 오류 안내는 유지되고 iOS 자체 시스템 메시지는 남을 수 있다. 기존 인증 절차를 반복할 필요는 없다. 다음은 경기 중 재접속 복구다. 아래 내용은 준비·검증 당시 기록과 재사용 절차이며, 미확인/대기 표현은 위 최종 결과로 갱신한다.

추가 결과(19:52/19:53): 동일 공개 ID, 상대 연결 후 가위바위보 단계, 대기실 방 목록 수신 확인. 앱 완전 종료·재실행을 거쳤는지와 직접 방 생성 여부는 사용자 설명 대기다. 화면만으로 Keychain의 프로세스 재시작 후 복원을 확정하지 않는다.

실기기 결과 갱신(19:47/19:48 사용자 스크린샷): 최초 CAPTCHA 경유 인증과 공개 ID가 표시된 온라인 대기실 진입 성공. 방 생성과 완전 종료·재실행 후 동일 ID 복원은 아직 확인 대기다. 아래 준비 당시 미확인 표기는 이 결과로 갱신한다. 다음은 3–5번만 진행한다.

최신 수정 완료: iOS 주입 브리지에 없는 `Capacitor.registerPlugin()` 호출을 제거하고 `Capacitor.Plugins.DaegukSession` 접근·메서드 확인을 적용했다. 이제 인증 실패는 서버 오류와 구분되고, 브리지 누락은 `NATIVE_BRIDGE_UNAVAILABLE` 코드로 표시된다. 관련 테스트 13개·모바일 빌드·iOS 자산 복사·원본 일치·공백 검사 통과. Swift 변경이 없어 이전 네이티브 빌드는 반복하지 않았다. Xcode에서 새 앱을 Run해야 반영되며, 실제 iPhone 성공은 여전히 확인 대기다.

## 준비 완료

- Keychain 플러그인 `DaegukSession`의 get/set·브리지 등록과 Storyboard 연결 확인. 저장 속성은 `AfterFirstUnlockThisDeviceOnly`이며 로컬 `capacitor://localhost`에서만 접근한다.
- iOS 신규 가입은 별도 WKWebView에서 `https://unknown-kingdom.vercel.app/js/native-captcha.html`을 연다. 이 창에는 Capacitor/Keychain 브리지가 없으며, 고정 HTTPS 호스트·경로의 주 프레임에서 온 CAPTCHA 결과만 받는다. 취소·시간 초과·로드 실패는 가입 실패로 종료한다.
- 로컬 앱은 CAPTCHA 결과를 기존 인증 API로 보내고 반환된 갱신 토큰을 Keychain에 저장한다. 기존 세션 갱신 실패를 새 계정 생성으로 대체하지 않는다.
- 온라인 대기실에 공개 `ID` 표시 추가. 종료 전후 같은 계정인지 비교할 수 있다. 접근·갱신 토큰이나 내부 UUID는 표시하지 않는다.
- 인증 페이지 두 파일만 별도 배포본 `/private/tmp/daeguk-ios-captcha-release`의 `dc5f843`으로 운영 main에 반영했다. 공개 HTML·JS를 내려받아 로컬 원본과 일치 확인. 다른 앱·화면·서버 변경은 해당 커밋에 없다.
- 운영 `/auth/session`의 OPTIONS: HTTP 204, `Access-Control-Allow-Origin: capacitor://localhost`, POST 및 Content-Type 허용 확인. 신규 계정은 만들지 않았다.
- `npm run ios:sync` 성공(모바일 빌드·웹 자산 복사·기존 Pods 동기화 포함). Xcode 26.6으로 Debug / iphoneos / 서명 없는 빌드 성공. 서명·실기기 설치 성공을 뜻하지 않는다.
- 관련 브라우저 테스트 8개 통과: 기존 웹 인증/CAPTCHA 5개 + 네이티브 경로 3개. 네이티브 브리지·Keychain·CAPTCHA는 모킹하므로 실제 WKWebView/Keychain 성공 증거가 아니다. 첫 실행은 샌드박스의 로컬 서버·브라우저 차단으로 실패했으며 권한 확장 후 통과했다.
- 기존 CapacitorCordova WKProcessPool deprecated 경고, AppIntents 메타데이터 생략 및 Pods 스크립트 출력 경고는 남아 있다. 앱 소스 컴파일 오류는 없다.

## 사용자가 직접 할 순서

1. iPhone을 Mac에 연결하고 Xcode에서 프로젝트의 `ios/App/App.xcworkspace`를 연다. `App` scheme과 본인 iPhone을 선택해 Run한다. 기기 신뢰·개발자 모드·서명이 필요하면 사용자가 해당 화면을 처리한다. 기존 앱·Keychain을 삭제하지 않는다.
2. 앱에서 필요한 튜토리얼을 직접 완료하고 온라인 대국에 들어간다. CAPTCHA가 나오면 직접 확인한다. 처음부터 CAPTCHA가 나오지 않으면 기존 Keychain 세션일 수 있으므로 그 사실을 기록하며 새 가입 성공으로 간주하지 않는다.
3. 대기실의 공개 ID를 적고 방을 한 번 만든다. 성공하면 `뒤로`로 나온다.
4. 앱 전환 화면에서 DAEGUK를 완전히 종료한 후 다시 실행한다. 온라인 대국에서 공개 ID가 같은지, CAPTCHA 재표시 없이 방을 만들 수 있는지 확인한다.
5. 완료 후 방에서 나와 결과를 전달한다. 이번 확인용 신규 게스트는 최대 1개만 사용한다. 인증 실패 시 계정 삭제·Keychain 초기화·재가입 반복을 하지 않는다.

전달할 결과: iOS 버전 / 첫 접속 CAPTCHA 표시·통과 여부 / 첫 공개 ID / 재실행 후 공개 ID / 각 방 생성 성공 여부. 실패하면 화면의 오류 문구·발생 단계·시각만 알려준다. 인증 토큰·쿠키·DB URL은 보내지 않는다.

## 완료 기준과 멈출 조건

- 실제 iOS 신규 CAPTCHA → 인증 → 방 생성 성공, 완전 종료·재실행 후 동일 공개 ID와 방 생성 성공을 각각 기록한다.
- 기존 Keychain 세션만 확인되면 세션 복원만 통과 처리하고 신규 iOS CAPTCHA는 미확인으로 남긴다. 새 기기/별도 테스트 앱 사용 여부는 이후 정하며 기존 계정을 지우지 않는다.
- 오류가 있으면 그 증거에 맞는 경로만 진단한다. 완료한 웹 테스트·빌드·DB 검증을 이유 없이 반복하지 않는다.
- 이번 범위에는 경기 도중 재접속 복구, 랭킹, 운영 부하 시험을 포함하지 않는다.

## 근거와 로그

Cloudflare 공식 [모바일 WebView 구현 안내](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/)를 확인해 허용 HTTPS 페이지를 전용 WKWebView로 여는 방식을 적용했다. 기존 운영 허용 호스트를 추가·변경하거나 CAPTCHA를 해제하지 않았다.

로컬 로그(임시 경로이므로 사라질 수 있음): `/private/tmp/daeguk-ios-auth-browser.log`, `/private/tmp/daeguk-ios-auth-sync.log`, `/private/tmp/daeguk-ios-auth-build.log`.

한도 중단 후 재개 시 브라우저·빌드 로그와 배포 다운로드 사본이 삭제된 상태를 확인했다. 위 성공 결과는 중단 전 도구 출력에 근거하며 재검사를 실행한 결과가 아니다. 실기기 확인은 아직 대기 중이다.
