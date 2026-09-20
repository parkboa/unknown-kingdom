# DAEGUK App Store 출시 체크리스트

최종 갱신: 2026-09-14 / Codex

이 문서는 DAEGUK iOS 출시 준비의 단일 기준 문서다. 현재 상태, 이미 완료한 검증,
운영 변경 순서, App Store Connect 입력값과 남은 일정을 한곳에 모은다. 과거 문서는
구현·검증 근거로 보존하지만, 서로 다른 상태 표현이 있으면 이 문서와
`WORK_HANDOFF.md`의 최신 항목을 우선한다.

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

## 2. 2026-09-14 현재 상태 요약

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

### 미완료 / 출시 차단 항목

- [ ] 출시 변경을 운영 `origin/main` 기준의 격리된 작업 공간에 선별 통합
- [ ] 로그인 없이 열리는 DAEGUK Privacy Policy URL과 Support URL 확정·공개
- [ ] Supabase 운영 DB에 `server/migrations/002_account_deletion.sql` 적용
- [ ] Render에 서버 전용 `SUPABASE_SECRET_KEY` 저장
- [ ] 운영 계정 삭제 API 배포와 실제 테스트 게스트 1개 삭제 검증
- [ ] 최종 출시 후보 자동·수동 검증
- [ ] App Store Connect 앱 정보·개인정보·연령 등급·스크린샷 입력
- [ ] 서명된 Release Archive 업로드와 내부 TestFlight 확인
- [ ] App Review 제출

## 3. 저장소와 배포 안전 규칙

2026-09-14 확인 기준:

- 운영 기준: `origin/main`의 `737e294`
- 현재 로컬 `main`: `d792aa0`
- 로컬 `main`은 운영 기준보다 6개 커밋 뒤이고 독자 커밋 1개가 있다.
- 현재 작업 폴더에는 수정·미추적 파일이 65개 있다.

따라서 다음 규칙을 지킨다.

- [ ] 현재 작업 폴더에서 `git add .`, 전체 커밋, 무조건 pull/reset 또는 Release
  Archive를 실행하지 않는다.
- [ ] `origin/main`에서 격리된 출시 작업 공간과 브랜치를 만든다.
- [ ] 계정 삭제, 개인정보·지원 링크와 그에 필요한 테스트만 선별해 적용한다.
- [ ] 게임 규칙·AI·화면 작업 등 관련 없는 로컬 변경은 섞지 않는다.
- [ ] 출시 후보의 전체 커밋 SHA와 운영 배포 SHA를 기록한다.
- [ ] 비밀값, 로컬 `.env`, 토큰, 인증 로그와 테스트 산출물을 커밋하지 않는다.

## 4. 확정된 운영·개인정보 정보

### 공개 연락처와 URL

- 스튜디오 도메인: `https://tzib.studio`
- 게임 문의: `daeguk@tzib.studio`
- 공통 지원·개인정보 문의: `support@tzib.studio`
- 목표 Privacy Policy URL: `https://tzib.studio/daeguk/privacy`
- 목표 User Privacy Choices URL: Privacy Policy URL 또는 그 안의 계정 삭제 안내
- 목표 Support URL: `https://tzib.studio/daeguk/support`

위 URL은 App Store 제출 전에 로그인 없이 열려야 한다. 현재 TZIB 홈페이지는
ChatGPT Sites에서 비공개 상태이고 GitHub Pages 공개 배포는 활성화하지 않았다.
홈페이지 전체 공개 전에 디자인·내용 검토가 필요하므로 URL 공개는 아직 출시 차단
항목이다.

기존 TZIB 사이트 소스에는 `/privacy/daeguk/`, `/support/daeguk/` 경로도 있다.
출시 전에 목표 경로를 직접 제공하거나 기존 경로에서 영구 리디렉션하는 정책을 하나로
확정한다. 앱과 App Store Connect에는 최종적으로 검증된 동일 URL을 사용한다.

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

- [ ] `origin/main` 최신 커밋에서 격리된 작업 공간 생성
- [ ] 현재 로컬 변경 중 출시 필수 항목만 목록화
- [ ] 계정 삭제·공개 URL·관련 테스트만 선별 적용
- [ ] 버전과 출시 후보 커밋을 식별

완료 조건: 깨끗한 작업 공간에서 출시 후보 변경만 diff로 설명할 수 있다.

### 단계 B — 공개 Privacy/Support URL 준비

- [ ] 개인정보처리방침과 지원 문구를 실제 제품 데이터 지도와 대조
- [ ] `/daeguk/privacy`, `/daeguk/support` 최종 경로 결정
- [ ] 한국어·영어 페이지가 로그인 없이 열리는지 확인
- [ ] 모바일 표시, 내부 링크와 두 이메일 주소 확인
- [ ] App Store 제출용 URL 확정

완료 조건: 두 URL이 HTTPS로 공개되고 로그인·404·리디렉션 루프 없이 열린다.

### 단계 C — 계정 삭제 운영 백엔드 활성화

운영 데이터와 비밀 설정을 바꾸는 단계이므로 실행 직전에 사용자 확인을 받는다.

1. [ ] Supabase SQL Editor에서 `server/migrations/002_account_deletion.sql` 적용
2. [ ] 함수·테이블 권한이 마이그레이션 명세와 일치하는지 확인
3. [ ] Render에 `SUPABASE_SECRET_KEY`를 서버 전용 비밀로 저장
4. [ ] 웹·iOS 자산, Vercel 공개 환경과 Git 저장소에 비밀이 없는지 확인
5. [ ] 서버 배포 후 `/health`와 기존 인증·온라인 접속 회귀 확인

완료 조건: 서버가 삭제에 필요한 최소 권한과 Admin Auth 삭제 권한을 가지며 기존
게스트 인증과 온라인 대국이 유지된다.

### 단계 D — 계정 삭제 실제 검증

격리된 테스트 게스트를 웹과 iOS에서 각각 최대 1개만 사용한다.

- [ ] 삭제 전 공개 게임 ID 기록
- [ ] 앱 설정에서 영구 삭제 실행
- [ ] Supabase Auth 사용자 삭제 확인
- [ ] 비공개 player/identity 매핑 삭제 확인
- [ ] 웹 쿠키 또는 iOS Keychain과 복귀표 제거 확인
- [ ] 기존 세션으로 복원·재접속 불가 확인
- [ ] 새 온라인 진입 시 CAPTCHA 후 새 공개 ID 생성 확인
- [ ] 삭제된 계정의 활성 소켓과 좌석이 남지 않는지 확인

완료 조건: 기존 계정·세션·공개 ID가 복원되지 않고 새 게스트만 생성된다.

### 단계 E — 출시 후보 자동 검증

```bash
npm test
npm run test:browser
npm run build:mobile
node --check app.js
git diff --check
```

- [ ] `npm run ios:sync`로 최종 웹 자산을 iOS에 복사
- [ ] 원본·`dist-mobile`·iOS 공개 자산의 핵심 파일 일치 확인
- [ ] 서명 없는 Release 또는 simulator 빌드로 컴파일 오류 확인
- [ ] 심각도 높은 미해결 결함이 없는지 확인

과거 통과 결과는 기능의 기존 근거로 유지하되, 최종 출시 후보 변경이 통합된 뒤 위
검사를 한 번 다시 실행한다.

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
- [ ] 마케팅 버전·빌드 번호 확정 및 문서 갱신
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

## 6. 남은 일정 — 2026-09-14 기준 제안

아래는 추가 기능 개발이나 심각한 결함이 없다는 전제의 가장 빠른 내부 일정이다.
Apple 처리·심사 시간과 홈페이지 내용 승인 시점은 통제할 수 없다.

| 목표일 | 작업 | 완료 기준 |
| --- | --- | --- |
| 9월 14일 | 출시 문서 통합, 지원 이메일 수신 확인 | 이 문서가 단일 기준이며 두 주소 수신 성공 기록 |
| 9월 15일 | 격리된 출시 작업 공간 생성, 필수 변경 선별 통합 | 운영 기준 위에 출시 diff만 존재 |
| 9월 16일 | 공개 Privacy/Support 문구·경로 확정 | 운영자가 한·영 문구와 두 URL 승인 |
| 9월 17일 | 사용자 승인 후 SQL 002·Render 비밀 적용, 서버 배포 | 기존 인증 정상, 삭제 API 운영 준비 |
| 9월 17~18일 | 웹·iOS 실제 계정 삭제 검증, 자동 테스트 | 기존 계정 복원 불가·새 ID 생성 및 전체 테스트 통과 |
| 9월 18일 | 버전·빌드 확정, Release Archive 업로드 | App Store Connect에서 빌드 처리 완료 |
| 9월 18~19일 | 내부 TestFlight 실기기 출시 후보 확인 | 출시 차단 결함 0개 |
| 9월 20일 이후 | App Store 정보 최종 확인 및 심사 제출 | `Waiting for Review` 상태 |

공개 Privacy/Support URL 승인이 늦어지면 9월 16일 이후 일정도 같은 만큼 이동한다.
내부 TestFlight 업로드 준비는 병행할 수 있지만 App Review 제출 전에는 공개 URL과 실제
계정 삭제 검증이 반드시 완료되어야 한다.

## 7. 즉시 다음 행동

`origin/main`의 최신 운영 커밋에서 격리된 출시 작업 공간을 만들고, 현재 로컬 변경 중
계정 삭제·개인정보·지원·App Store 출시 필수 파일만 선별해 통합한다. 현재 작업 폴더의
다른 사용자 변경은 수정하거나 커밋하지 않는다.

운영 SQL 적용, Render 비밀 저장, 공개 URL 전환과 App Store 제출은 각각 실제 외부 상태를
바꾸므로 해당 단계에 도달했을 때 사용자의 명시적 확인을 받는다.

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
