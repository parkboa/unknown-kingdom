# DAEGUK App Store 출시 체크리스트

최종 갱신: 2026-09-21 / Codex

이 문서는 DAEGUK iOS 출시의 세부 체크리스트다. 코드 정리, TZIB 일반 사이트 공개,
iOS와 Android를 포함한 전체 순서와 승인 경계는 `INTEGRATED_RELEASE_PLAN.md`를 상위
기준으로 사용한다. 구현·운영 근거는 `WORK_HANDOFF.md`에 보존한다.

이 문서는 법률 자문을 대신하지 않는다. 공개 문구, 배포 국가와 개인정보 응답은 실제
서비스 상태에 맞춰 운영자가 제출 직전에 최종 확인한다.

## 1. 출시 범위와 현재 버전

- 제품: DAEGUK iOS 첫 App Store 출시
- 공개 브랜드: `TZIB Studio`
- 법적 운영자: `Boahs Park`
- 운영자 소재 국가: 캐나다
- Bundle ID: `com.boahspark.daeguk`
- Xcode 마케팅 버전: `1.0.1`
- Xcode 빌드 번호: `2`
- 지원 기기: iPhone
- 최소 iOS: 14.0
- 화면 방향: 세로
- 현재 앱 버전은 `1.0.1 (2)`이다. 기존 `TESTFLIGHT.md`의 `1.0 (1)` 표기는
  과거 값이므로 다음 출시 후보를 만들 때 이 문서와 함께 갱신한다.

## 2. 2026-09-21 현재 상태 요약

### 완료

- [x] 1.0 게임 규칙, 흑·백 진영, 프로토콜 3과 기본 UI 정리
- [x] 웹 게스트 인증, Cloudflare Turnstile과 Supabase Auth 운영 연결
- [x] iOS 전용 CAPTCHA 창, Keychain 세션 저장과 동일 공개 ID 복원 실기기 확인
- [x] Capacitor 브리지 인증값 로그 억제 설정 적용
- [x] 온라인 대국 연결 종료 후 2분 내 동일 방·진영·보드·차례 복귀 실기기 확인
- [x] 서버 재시작 시 승패 없이 대국 무효 처리와 한·영 안내 운영 배포
- [x] 앱 내 한·영 계정 삭제 UI, 서버 삭제 API와 세션·복귀표 제거 로컬 구현
- [x] 한·영 DAEGUK 개인정보처리방침·지원 페이지와 앱 내 링크 로컬 구현
- [x] 지원 이메일 수신 확인
  - `support@tzib.studio` → `parkboahs@gmail.com`
  - `daeguk@tzib.studio` → `parkboahs@gmail.com`
  - 2026-09-14 사용자가 두 주소 모두 실제 수신 성공을 확인함
  - 현재는 수신 전달 방식이다. 답장은 개인 Gmail 주소로 표시될 수 있으며 정식
    `@tzib.studio` 발신은 향후 별도 메일 서비스가 필요하다.
- [x] Supabase 운영 DB에 계정 삭제 SQL 002 적용과 최소 실행 권한 확인
- [x] Render에 서버 전용 `SUPABASE_SECRET_KEY` 저장
- [x] 계정 삭제 API 포함 운영 배포와 공개 ID 교체 관측
- [x] 게임 `main`과 `origin/main`을 `7f7b702`로 통합
- [x] 일반 `tzib-studio` 정적 사이트와 GitHub Pages 수동 배포 구조 확인
- [x] GitHub Pages 미리보기 배포와 홈페이지·Privacy·Support 경로 검증

### 미완료 / 출시 차단 항목

- [x] 읽기 전용 Code Hygiene Audit
- [x] 감사에서 승인된 최소 정리와 전체 회귀 검사
- [x] 일반 `tzib-studio`에 최신 한·영 Privacy·Support 내용 로컬 동기화
- [ ] App Review 제출 직전 일반 사이트와 정식 URL 공개
- [x] 삭제 전 Auth UUID를 확보한 테스트 게스트로 계정 삭제 증거 보강
- [x] 최종 출시 후보 자동 검증
- [x] App Store 한·영 메타데이터·Privacy·연령 등급·심사 메모·스크린샷 계획 초안
- [x] 한국어·영어 6.9형 App Store 스크린샷 각 5장 제작·규격·육안 검수
- [ ] 최종 출시 후보 수동 검증
- [ ] App Store Connect 앱 정보·개인정보·연령 등급·스크린샷 입력
- [ ] 서명된 Release Archive 업로드와 내부 TestFlight 확인
- [ ] App Review 제출

## 3. 저장소와 배포 안전 규칙

2026-09-21 출시 작업 시작 기준:

- 출시 변경의 기반: `main`과 `origin/main`의 `7f7b702`
- 출시 변경 외 미추적 파일은 사용자 검증 자료 `artifacts/live-auth-browser.png`다.
- 이 자료는 출시 변경에 포함하거나 삭제하지 않는다.

따라서 다음 규칙을 지킨다.

- [ ] `git add .`, 무조건 pull/reset 또는 검증 전 Release Archive를 실행하지 않는다.
- [ ] 사용자 검증 자료를 제외하고 작업별 파일만 선별해 반영한다.
- [ ] 게임 규칙·AI·화면 작업 등 관련 없는 로컬 변경은 섞지 않는다.
- [ ] 출시 후보의 전체 커밋 SHA와 운영 배포 SHA를 기록한다.
- [ ] 비밀값, 로컬 `.env`, 토큰, 인증 로그와 테스트 산출물을 커밋하지 않는다.

## 4. 확정된 운영·개인정보 정보

### 공개 연락처와 URL

- 스튜디오 도메인: `https://tzib.studio`
- 게임 문의: `daeguk@tzib.studio`
- 공통 지원·개인정보 문의: `support@tzib.studio`
- 목표 Privacy Policy URL: `https://tzib.studio/privacy/daeguk/`
- 목표 User Privacy Choices URL: Privacy Policy URL 또는 그 안의 계정 삭제 안내
- 목표 Support URL: `https://tzib.studio/support/daeguk/`
- 호환 경로: `/daeguk/privacy`, `/daeguk/support`는 위 정식 경로로 리디렉션

위 URL은 App Store 제출 전에 로그인 없이 열려야 한다. GitHub Pages 미리보기
`https://parkboa.github.io/tzib-studio/`는 공개되어 홈페이지와 법적 페이지를 검토할 수
있다. 미리보기에는 `noindex, nofollow`가 유지되며 App Store에 입력할 정식 URL은
아니다. `tzib.studio`의 기존 호스트·DNS는 변경하지 않았으므로 사용자 정의 도메인
공개 전환은 여전히 출시 차단 항목이다.

TZIB 사이트 소스와 `build/`에는 정식 경로 `/privacy/daeguk/`,
`/support/daeguk/`를 준비했다. 기존 `/daeguk/privacy`, `/daeguk/support`는
언어 쿼리와 해시를 보존해 정식 경로로 이동한다. App Store Connect에는 공개 전환 뒤
HTTPS로 다시 검증한 정식 경로를 사용한다.

### 처리하는 정보

- Supabase Auth: 자동 생성 익명 사용자 ID와 인증 세션
- 비공개 게임 DB: 내부 player UUID, 20자리 공개 게임 ID, 게스트 닉네임, 생성 시각,
  Supabase 사용자와의 비공개 매핑
- 서버 메모리: 온라인 방, 진영, 보드, 차례, 제한 시간과 연결 상태
- 기기 저장: 언어·음향·AI 타이머, 튜토리얼·챌린지 진행, PvE 진단 기록,
  인증 토큰이 없는 온라인 대국 복귀표
- 웹 갱신 토큰: HttpOnly/Secure/SameSite 쿠키
- iOS 갱신 토큰: ThisDeviceOnly Keychain

현재 경기 기록·승패·랭킹은 서버 DB에 저장하지 않는다. 이메일, 전화번호, 실명,
위치, 연락처, 사진, 마이크 또는 카메라 권한을 게임 계정 생성에 요구하지 않는다.
광고·제품 분석 SDK와 사용자 추적은 현재 코드에 없다.

### 제3자 처리자

- Supabase: 익명 인증과 비공개 게임 DB
- Cloudflare Turnstile: 신규 게스트 자동화·부정 가입 방지
- Render: 게임·인증 서버
- Vercel: 웹 게임 호스팅과 인증 프록시
- Apple: App Store 배포 및 활성화한 스토어·진단 서비스

### App Store Privacy 예상 답변

- 수집 여부: `Yes`
- 데이터 유형: `Identifiers > User ID`
- 목적: `App Functionality`
- 사용자와 연결됨: `Yes`
- 추적에 사용: `No`

Turnstile과 Apple을 포함한 제3자 처리 및 App Store Connect에서 실제 활성화한 진단
설정을 제출 직전에 다시 확인한다.

### 연령과 계정 삭제

- 목표 이용자: 전연령 일반 이용자
- `Made for Kids`: 전연령이라는 이유만으로 선택하지 않음
- 최종 연령 등급: App Store Connect 콘텐츠 설문 결과에 따름
- 계정 삭제 위치: `설정 → 계정 삭제 → 영구 삭제`
- 삭제 범위: Supabase Auth 사용자, player/identity 매핑, 웹 쿠키 또는 iOS Keychain
  세션, 온라인 대국 복귀표와 활성 WebSocket 재접속 좌석
- 기기에만 있고 서버 계정과 연결되지 않은 진행 상황과 설정은 유지되며 앱 삭제 또는
  브라우저 사이트 데이터 삭제로 제거 가능

## 5. 출시 작업 순서

각 단계의 완료 조건을 충족하기 전에는 다음 단계로 넘어가지 않는다.

### 단계 A — 출시 후보 작업 공간 고정

- [x] `origin/main`의 출시 작업 기반 `7f7b702` 확인
- [x] 현재 로컬 변경 중 출시 필수 항목 목록화
- [x] 검증된 코드 정리·출시 문서만 선별 적용
- [x] 버전 `1.0.1 (2)`와 출시 후보 앱·코드 커밋 `c3f49ea` 식별

완료 조건: 깨끗한 작업 공간에서 출시 후보 변경만 diff로 설명할 수 있다.

### 단계 B — 공개 Privacy/Support URL 준비

- [x] 개인정보처리방침과 지원 문구를 실제 제품 데이터 지도와 대조
- [x] 정식 경로와 `/daeguk/privacy`, `/daeguk/support` 호환 정책 결정
- [ ] 한국어·영어 페이지가 로그인 없이 열리는지 확인
- [x] 로컬 모바일·데스크톱 표시, 한·영 전환, 내부 링크와 두 이메일 주소 확인
- [ ] App Store 제출용 URL 확정

완료 조건: 두 URL이 HTTPS로 공개되고 로그인·404·리디렉션 루프 없이 열린다.

### 단계 C — 계정 삭제 운영 백엔드 활성화

운영 데이터와 비밀 설정을 바꾸는 단계이므로 실행 직전에 사용자 확인을 받는다.

1. [x] Supabase SQL Editor에서 `server/migrations/002_account_deletion.sql` 적용
2. [x] 함수·테이블 권한이 마이그레이션 명세와 일치하는지 확인
3. [x] Render에 `SUPABASE_SECRET_KEY`를 서버 전용 비밀로 저장
4. [x] 웹·iOS 자산, Vercel 공개 환경과 Git 저장소에 비밀이 없는지 확인
5. [x] 서버 배포 후 `/health`와 기존 인증·온라인 접속 회귀 확인

완료 조건: 서버가 삭제에 필요한 최소 권한과 Admin Auth 삭제 권한을 가지며 기존
게스트 인증과 온라인 대국이 유지된다.

### 단계 D — 계정 삭제 실제 검증

격리된 테스트 게스트를 웹과 iOS에서 각각 최대 1개만 사용한다.

- [x] 삭제 전 공개 게임 ID 기록
- [x] 앱 설정에서 영구 삭제 실행
- [x] Supabase Auth 사용자와 세션 삭제 확인
- [x] 비공개 player/identity 매핑 삭제 확인
- [x] 웹 쿠키와 기존 온라인 세션 제거 확인
- [x] 기존 세션으로 복원·재접속 불가 확인
- [x] 새 온라인 진입 시 CAPTCHA 보호 뒤 새 공개 ID 생성 확인
- [x] 삭제된 계정의 활성 소켓과 좌석이 남지 않는지 확인

완료 조건: 기존 계정·세션·공개 ID가 복원되지 않고 새 게스트만 생성된다.

### 단계 E — 출시 후보 자동 검증

```bash
npm test
npm run test:browser
npm run build:mobile
node --check app.js
git diff --check
```

- [x] `npm run ios:sync`로 최종 웹 자산을 iOS에 복사
- [x] 원본·`dist-mobile`·iOS 공개 자산의 핵심 파일 일치 확인
- [x] 서명 없는 Release 또는 simulator 빌드로 컴파일 오류 확인
- [x] 심각도 높은 미해결 결함이 없는지 확인

과거 통과 결과는 기능의 기존 근거로 유지하되, 최종 출시 후보 변경이 통합된 뒤 위
검사를 한 번 다시 실행한다.

2026-09-21 최종 결과: 단위·엔진·서버 테스트 194개와 브라우저 테스트 41개 통과,
모바일 빌드와 iOS sync 성공, 핵심 자산 일치, 서명 없는 Release iOS Simulator 빌드
성공. Pods Embed 반복 실행 경고와 AppIntents 미사용 알림은 출시 차단 오류가 아니다.

### 단계 F — 출시 후보 수동 검증

- [ ] 새 설치 또는 통제된 테스트 상태에서 첫 실행·튜토리얼·언어 전환
- [ ] 흑·백 각각 AI 대국 시작
- [ ] 세 특수 기물과 마법사 순간이동
- [ ] 왕 포획, 기권, 시간 초과와 둘 곳 없음 종료
- [ ] 결과, 재대국과 로비 복귀
- [ ] 두 기기의 온라인 방 생성·참가·가위바위보·대국·재대국
- [ ] 연결 종료 후 2분 내 복귀와 서버 장애 무효 처리
- [ ] 개인정보·지원 링크와 이메일 열기
- [ ] 계정 삭제 실제 흐름
- [ ] 브리지·콘솔에 인증 토큰이나 비밀값이 노출되지 않음

이미 완료된 iOS CAPTCHA 신규 가입·동일 ID 복원 자체를 이유 없이 반복하지 않는다.
최종 TestFlight 빌드에서의 짧은 회귀 확인은 별도다.

### 단계 G — App Store Connect와 TestFlight

- [ ] Apple Developer 계약 상태와 App Store Connect 앱 레코드 확인
- [ ] 앱 이름, Bundle ID와 SKU 확인
- [x] 마케팅 버전 `1.0.1`·빌드 번호 `2` 확정 및 문서 갱신
- [x] 한·영 설명·키워드, Privacy·연령 등급·심사 메모 입력 초안 작성
- [ ] 설명, 키워드, 카테고리, 저작권, 배포 지역과 가격 입력
- [ ] App Privacy 응답, Privacy Policy URL과 Support URL 입력
- [ ] 콘텐츠 설문으로 연령 등급 확정
- [ ] 스크린샷과 필요한 미리보기 준비
- [ ] 수출 규정 응답 확인 (`ITSAppUsesNonExemptEncryption=false` 현재 설정)
- [ ] 심사 메모에 게스트 계정과 `설정 → 계정 삭제` 경로 작성
- [ ] 서명된 Release Archive 생성·업로드
- [ ] Apple 처리 완료와 빌드 상태 확인
- [ ] 내부 TestFlight 그룹에 배포

Apple 처리 후 내부 TestFlight에서 설치한 정확한 빌드로 단계 F의 출시 차단 흐름을
짧게 다시 확인한다.

### 단계 H — App Review와 출시

- [ ] TestFlight 출시 차단 결함 0개 확인
- [ ] 제출할 빌드와 App Store 버전 연결
- [ ] 자동·수동·예약 출시 중 공개 방식을 결정
- [ ] `Add for Review` 후 `Submit for Review`
- [ ] 심사 메시지와 상태 모니터링
- [ ] 승인 후 선택한 방식으로 공개
- [ ] 공개 직후 로그인, 지원·개인정보 URL과 온라인 서버 상태 확인

## 6. 남은 일정 — 단계 기준

달력 날짜는 코드 감사 결과, 사이트 최종 승인과 Apple 처리 시간에 따라 정한다. 아래
순서를 바꾸지 않는다.

| 순서 | 작업 | 완료 기준 |
| --- | --- | --- |
| 1 | 읽기 전용 Code Hygiene Audit | 삭제 없이 후보·근거·확신도 기록 |
| 2 | 일반 사이트 콘텐츠 로컬 준비 | 미공개 최종 산출물과 URL 호환 경로 검증 |
| 3 | 승인된 최소 코드 정리 | 동작 변경 없이 전체 출시 검증 통과 |
| 4 | 계정 삭제 증거 보강과 iOS RC 고정 | 기존 계정 복원 불가·새 ID 생성·RC SHA 확정 |
| 5 | App Review 직전 일반 사이트 공개 | 정식 두 URL이 로그인 없이 HTTPS로 열림 |
| 6 | Archive·TestFlight·App Review | 출시 차단 결함 0개와 심사 제출 상태 |

내부 TestFlight 업로드 준비는 사이트 공개 준비와 병행할 수 있지만 App Review 제출
전에는 공개 URL과 계정 삭제 증거 보강이 완료되어야 한다.

## 7. 즉시 다음 행동

출시 후보 앱·코드 커밋 `c3f49ea89f16b7d4f4b2395feeb12705e9ad79fe`와
`APP_STORE_SUBMISSION_DRAFT.md`, `artifacts/app-store/1.0.1/`을 운영자가 검토해
메타데이터·Privacy·연령 등급·스크린샷을 최종 승인한다. 그 뒤 단계 F 수동 검증과
정식 도메인 공개 전환 순서를 확정한다. 사용자 검증 자료
`artifacts/live-auth-browser.png`는 커밋하지 않고 보존한다.

GitHub Pages 미리보기는 이미 공개되어 있다. `tzib.studio` 사용자 정의 도메인·DNS
전환과 App Store 제출은 실제 외부 상태를 바꾸므로 해당 단계에 도달했을 때 사용자의
명시적 확인을 받는다.

## 8. 근거 문서

다음 문서는 삭제하지 않고 과거 구현·검증 근거로 보존한다.

- `docs/WORK_HANDOFF.md`: 작업 인수인계와 최신 구현 기록
- `docs/PRIVACY_SUPPORT_RELEASE.md`: 개인정보 데이터 지도와 계정 삭제 설계 원본
- `TESTFLIGHT.md`: 기존 iOS 패키징 절차
- `docs/RELEASE_1_0_CLEANUP_MANUAL.md`: 1.0 정리·자동/수동 검증 원본
- `docs/RELEASE_NOTES_1_0.md`: 1.0 기능과 변경 사항
- `docs/IOS_AUTH_CHECKLIST.md`: 완료된 iOS 인증 실기기 검증 기록
- `docs/GUEST_AUTH_SETUP.md`: 웹·iOS 게스트 인증 운영 구성 근거
- `docs/ONLINE_IDENTITY_DEPLOYMENT.md`: 인증·DB 구조 결정 기록

공식 기준:

- Apple 계정 삭제: https://developer.apple.com/support/offering-account-deletion-in-your-app
- App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- App Privacy: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- 빌드 업로드: https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds
- 앱 심사 제출: https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app
