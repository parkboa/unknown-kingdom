# DAEGUK TestFlight 패키징

이 저장소에는 Capacitor 7 기반 iOS 프로젝트가 `ios/`에 포함되어 있습니다.

## 현재 앱 설정

- 앱 이름: `DAEGUK`
- Bundle ID: `com.boahspark.daeguk`
- 버전: `1.0` (빌드 `1`)
- 대상: iPhone, 세로 방향
- 온라인 서버: `wss://unknown-kingdom-server.onrender.com/ws`
- 로컬 웹 자산 출력: `dist-mobile/`

Bundle ID가 Apple Developer 계정에서 사용할 ID와 다르면 `capacitor.config.json`과 Xcode Target의 Bundle Identifier를 함께 변경합니다.

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
