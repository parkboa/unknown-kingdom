# DAEGUK TestFlight 패키징

이 저장소에는 Capacitor 7 기반 iOS 프로젝트가 `ios/`에 포함되어 있습니다.

## 현재 앱 설정

- 앱 이름: `DAEGUK`
- Bundle ID: `com.boahspark.daeguk`
- 현재 내부 TestFlight: `1.0.1` (빌드 `3`), 서버 수정 후 실기기 대기실 재진입·삭제 후 재인증 정상 확인
- 현재 App Review: `1.0.1 (3)` **Pending Developer Release** — 2026-10-05 승인 확인. 사용자가 직접 수동 공개를 진행한다. 아래 심사 접수 기록은 과거 이력이다.
- 최소 iOS: `15.0` (Xcode 27 지원 범위)
- 대상: iPhone, 세로 방향
- 온라인 서버: `wss://unknown-kingdom-server.onrender.com/ws`
- 로컬 웹 자산 출력: `dist-mobile/`

Bundle ID가 Apple Developer 계정에서 사용할 ID와 다르면 `capacitor.config.json`과 Xcode Target의 Bundle Identifier를 함께 변경합니다.

## 2026-10-04 재진입 수정 후보

대기실→뒤로→재진입의 종료 순서 문제를 수정한 `1.0.1 (3)`의 로컬 Archive와
App Store 배포용 export를 완료했다. `build/export-1.0.1-3/App.ipa` (약40MB),
최소iOS15.0/iPhone 전용, 서명 검증 및 수정된 app.js/network.js의 원본 일치 확인 통과.
전체 시험(웹47/엔진137/서버29), 최종 연결11/11, 브라우저 인증14/14 통과.
지연 close frame300ms를 주입한 실제 WS 시험에서 뒤로/즉시 재진입10회,
동일ID/인증HTTP1회를 확인했다. 빌드2에는 이 클라이언트 수정이 없다.
사용자 승인 후 2026-10-04 17:10:50 EDT Xcode Upload succeeded / Uploaded package is processing,
exit0 확인. 약17:13 EDT Apple 처리 완료 후 기존 DAEGUK Internal에 연결,
1 Tester / 2 Builds 및 1.0.1(3) Testing 확인. 한국어 What to Test Saved 확인.
ASC 본인 행은 iPhone15Pro/iOS26.6.1 Installed1.0.1(3)로 표시됐다.
초기 실기기 재진입은약30초 지연/중복 거부가 남아 서버 PR #4를 추가 반영했다.
2026-10-04 17:44 EDT 서버 배포 후 사용자가 ID가5초 이내 나오고,
계정 삭제 후 다시 시도해도 정상 작동한다고 확인했다. 해당 흐름은 수동 검증 성공이다.
정확한 반복 횟수·통신 종류·앱 재실행 복원·두 기기 대국 복귀는 이번 보고에 포함되지 않았다.
2026-10-04 23:41 EDT 빌드3재심사접수완료, 앱공개전이다.
설치 후 수동 검증 절차는
`docs/LOBBY_RECONNECT_FIX_2026-10-04.md`에 있다.

## 최초 준비

1. Mac App Store에서 Xcode 16 이상을 설치합니다.
2. Xcode를 한 번 실행해 라이선스와 추가 구성 요소 설치를 완료합니다.
3. 터미널에서 활성 Xcode를 선택합니다.

   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```

4. 프로젝트 루트에서 네이티브 의존성을 동기화합니다.

   ```bash
   npm install
   npm run ios:sync
   ```

## Xcode에서 TestFlight 업로드

1. `npm run ios:open`으로 `ios/App/App.xcworkspace`를 엽니다.
2. `App` Target의 **Signing & Capabilities**에서 Apple Developer Team을 선택합니다.
3. Bundle Identifier가 App Store Connect에 등록한 값과 같은지 확인합니다.
4. 빌드 대상을 **Any iOS Device (arm64)**로 선택합니다.
5. **Product > Archive**를 실행합니다.
6. Organizer에서 **Distribute App > App Store Connect > Upload**를 선택합니다.
7. App Store Connect의 TestFlight 탭에서 처리 완료 후 테스터에게 배포합니다.

업로드 전에 App Store Connect에 같은 Bundle ID의 앱 레코드가 있어야 합니다. 새 빌드를 올릴 때마다 Xcode의 `CURRENT_PROJECT_VERSION` 값을 증가시켜야 합니다.

## 명령줄 아카이브

Xcode에 Apple 계정 로그인이 되어 있고 App Store Connect 앱 레코드가 준비됐다면 다음 명령으로 Archive와 업로드용 export를 만들 수 있습니다.

```bash
APPLE_TEAM_ID=ABCDE12345 npm run ios:archive
```

결과는 `build/DAEGUK.xcarchive`와 `build/export/`에 생성됩니다. 업로드는 Xcode Organizer 또는 Transporter에서 진행합니다.

## 2026-10-02 로컬 배포 파일 검증 완료

`build/DAEGUK-1.0.1-2.xcarchive`에서 App Store Connect 방식으로 로컬 export를 완료했다.
결과는 `build/export-1.0.1-2/App.ipa`다. 버전 `1.0.1 (2)`, 최소 iOS 15, iPhone 대상이며
Apple Distribution / 팀 `3X9AZQY6CN` 서명과 App Store 프로비저닝을 검증했다.
`codesign --verify --deep --strict`와 핵심 실행 자산 6개의 원본 일치 확인이 통과했다.

사용자가 배포 서명 준비 후 `DAEGUK 1.0.1 (2) 업로드 허용`을 답해 Xcode 업로드를
시작했고 23:49 EDT에 `Upload succeeded`를 확인했다. 그 뒤
TestFlight에 `Version 1.0.1` / `Build 2` / `Ready to Submit`가 표시되어 Apple 처리 완료를
확인했다. What to Test 안내를 저장했다. 내부 그룹 `DAEGUK Internal`에 빌드를 연결하고 사용자 허용으로 본인 계정만 초대했다.
1 Tester / 1 Build / Invited 확인. 실기기 설치·확인과 심사 제출은 아직 완료 전이다. `ios-export-options.plist`는 `destination=upload`이므로 로컬 파일만
만들 때 그대로 사용하지 않는다. 이번 로컬 export는 `destination=export`,
`manageAppVersionAndBuildNumber=false` 옵션을 사용했다.

## 내부 TestFlight 설치 후 사용자 확인

2026-10-03 ASC 점검에서 본인 계정은 iPhone 15 Pro / iOS 26.6.1에 1.0.1 (2)
Installed로 표시됐다. 이후 사용자가 정확한 1.0.1 (2)에서 AI·특수 기물·온라인 대국/
재접속·지원 링크·계정 삭제를 확인했고 문제가 없었다고 답했다. 실기기 수동 검증은
사용자 보고로 통과 기록한다. 첫 출시는 iPhone용이며 Mac·Vision Pro 배포는 해제했다.
동일 빌드의 App Review 제출을 완료했고 상세 상태는 Waiting for Review다.
접수: 2026-10-03 14:28 EDT, ID ce44e104-56a2-463a-acbd-56975040e302.

정확히 `1.0.1 (2)`를 설치하고 다음 출시 차단 흐름을 확인한다. 실제 iPhone 조작은
사용자가 담당하며, 촬영 시뮬레이터와 로컬 서명 검증만으로 실기기 통과를 기록하지 않는다.

1. 첫 실행·튜토리얼·한국어/영어 전환과 AI 대국 시작.
2. 장군·외교관·마법사 능력과 순간이동 선택, 왕 포획·종료·재대국.
3. 온라인 진입과 앱 종료/재실행 뒤 동일 게스트 ID 복원.
4. 두 기기의 방 참가·대국·재대국, 짧은 연결 종료 뒤 같은 대국 복귀.
5. 개인정보/지원 링크·메일 열기. 공개 도메인 전환 전 링크 실패는 별도 준비 항목으로 기록.
6. 계정 삭제는 기존 완료 증거를 보존하고 통제된 테스트 계정에서만 필요 시 확인.

다른 테스터 초대나 외부 베타 심사는 대상과 범위를 사용자와 확정한 뒤 진행한다.
