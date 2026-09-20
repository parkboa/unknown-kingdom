# 개인정보·지원·계정 삭제 출시 준비

최종 갱신: 2026-09-13 / Codex

이 문서는 App Store 제출 전 확정해야 할 제품 사실과 운영 입력값을 분리한다. 법률 자문을 대신하지 않으며, 실제 배포 지역에 맞춰 운영자가 최종 검토한다.

## 현재 제품 데이터 지도

### 서버에 지속 저장

- Supabase Auth: 자동 생성된 익명 사용자 ID와 세션. 이메일, 전화번호, 실명, 소셜 로그인 정보는 받지 않는다.
- 비공개 게임 DB: 내부 player UUID, 20자리 공개 게임 ID, 그 ID에서 생성한 게스트 닉네임, 생성 시각, Supabase 사용자와의 비공개 매핑.
- 계정 삭제 시 Supabase Auth 사용자를 하드 삭제하고 위 게임 DB 매핑과 player 행도 삭제한다.

### 서버 메모리에만 임시 처리

- 온라인 방, 진영, 보드 상태, 차례, 제한 시간과 연결 상태.
- 현재는 경기 기록·승패·랭킹을 서버 DB에 저장하지 않는다. 방 종료 또는 서버 재시작 시 메모리 상태가 사라진다.

### 기기에만 저장

- 언어, 음악·효과음, AI 타이머 설정.
- 튜토리얼·챌린지 진행 상황과 PvE 진단 기록.
- 온라인 경기 복귀표(방 코드, 진영, 공개 게임 ID, 서버 인스턴스 ID). 인증 토큰은 포함하지 않는다.
- 웹 갱신 토큰은 HttpOnly/Secure/SameSite 쿠키, iOS 갱신 토큰은 ThisDeviceOnly Keychain에 저장한다.
- 계정 삭제는 서버 계정 데이터, 인증 세션, 쿠키/Keychain과 온라인 복귀표를 지운다. 서버 계정과 연결되지 않은 기기 내 진행 상황·설정은 유지한다.

### 제3자 처리자

- Supabase: 익명 인증과 인증 세션.
- Cloudflare Turnstile: 신규 게스트 생성 시 자동화·부정 사용 방지. 브라우저/기기 환경 신호를 보안 목적에 필요한 범위에서 처리한다.
- Render: 게임·인증 서버 호스팅.
- Vercel: 웹 앱 호스팅과 인증 API 프록시.
- Apple: App Store 배포 및 Apple이 제공하는 진단/스토어 서비스(활성화 범위는 App Store Connect 설정과 별도 확인).

## 앱 내 계정 삭제 계약

1. 설정에서 `계정 삭제`를 쉽게 찾을 수 있다.
2. 별도 확인 화면에서 영구 삭제, 복구 불가, 기기 전용 진행 상황 유지 여부를 알린다.
3. 삭제 요청은 기존 갱신 세션으로 다시 인증하며, 세션이 없으면 새 게스트를 만들거나 CAPTCHA를 열지 않는다.
4. 서버가 Supabase Auth 사용자와 비공개 게임 ID 매핑을 삭제한 뒤에만 성공으로 표시한다.
5. 웹 쿠키 또는 iOS Keychain 토큰과 경기 복귀표를 지운다. 연결된 온라인 소켓은 재접속 좌석을 남기지 않고 종료한다.
6. 다음 온라인 대국 진입은 CAPTCHA를 거쳐 새 게스트 계정과 새 공개 ID를 만든다.

## App Store Connect 초안

- 공개 브랜드: `TZIB Studio`
- 법적 운영자: `Boahs Park` (TZIB Studio 브랜드로 운영)
- 운영자 소재 국가: 캐나다
- 목표 이용자: 전연령 일반 이용자. 특정 아동 연령층 전용으로 두지 않으며 App Store의 `Made for Kids`는 자동 선택하지 않는다. 실제 연령 등급은 콘텐츠 설문 결과를 따른다.
- 스튜디오 도메인: `https://tzib.studio`
- 게임 문의: `daeguk@tzib.studio`
- 공통 지원·개인정보 문의: `support@tzib.studio`
- Privacy Policy URL: `https://tzib.studio/daeguk/privacy` (페이지 로컬 생성 완료, 호스팅 경로 확정 후 배포)
- User Privacy Choices URL: 위 Privacy Policy URL 또는 별도 삭제 안내 앵커. 선택 항목이지만 같은 URL 사용을 권장한다.
- Support URL: `https://tzib.studio/daeguk/support` (페이지 로컬 생성 완료, 호스팅 경로 확정 후 배포)
- App Privacy 예상 답변: `Identifiers > User ID`, 앱 기능 목적, 사용자와 연결됨, 추적에 사용하지 않음. Turnstile을 포함한 제3자 처리와 실제 App Store Connect/호스팅 설정을 기준으로 제출 직전 다시 확인한다.
- 현재 코드에는 광고 SDK, 제품 분석 SDK, 위치·연락처·사진·마이크·카메라 수집이 없다.

## 공개 페이지에 필요한 운영자 입력

다음 값은 추측하거나 저장소의 Git 작성자 이메일을 재사용하지 않는다.

- 법적 운영자 이름: `Boahs Park`로 확정. `TZIB Studio`는 공개 브랜드명으로 함께 표시한다.
- 지원 이메일 주소: `support@tzib.studio`로 확정
- 게임 전용 이메일 주소: `daeguk@tzib.studio`로 확정
- 개인정보 문의 이메일 주소: 초기에는 `support@tzib.studio` 사용
- 운영자 소재 국가: 캐나다로 확정. 실제 앱 배포 국가/지역은 App Store Connect에서 별도 확정
- 문의 응답 목표 시간(예: 영업일 기준 3일)
- 별도 법적 보존 의무가 있는 데이터와 기간. 현재 없다면 `법률상 보존이 필요한 경우를 제외하고 즉시 삭제`로 명시
- 목표 연령대: 전연령 일반 이용자로 확정. 특정 아동층 전용 `Kids` 카테고리 선택 여부와 Apple 설문에 따른 최종 연령 등급은 별도 확정

## 출시 전 순서

1. Supabase SQL Editor에서 `server/migrations/002_account_deletion.sql`을 명시적으로 적용한다.
2. Render에 서버 전용 `SUPABASE_SECRET_KEY`를 저장한다. 웹·iOS 자산이나 Vercel 공개 환경에는 절대 넣지 않는다.
3. 운영자 입력을 확정하고 한·영 개인정보처리방침/지원 페이지를 만든다.
4. 앱 설정에 개인정보처리방침과 지원 링크를 노출하고 모바일 빌드에 포함한다.
5. 격리 환경에서 웹/iOS 각각 `기존 ID 확인 → 삭제 → 같은 세션 복원 불가 → 새 CAPTCHA → 새 ID`를 검증한다.
6. 운영 배포 뒤 실제 테스트 게스트 1개만 삭제해 Auth 사용자, DB 매핑, 쿠키/Keychain, 재접속 좌석 제거를 확인한다.
7. App Store Connect의 Privacy Policy URL, Support URL, App Privacy 응답을 입력하고 심사 노트에 `설정 → 계정 삭제` 경로를 적는다.

## 공식 기준 확인

- Apple 계정 삭제: https://developer.apple.com/support/offering-account-deletion-in-your-app
- Apple App Review Guidelines 5.1.1: https://developer.apple.com/app-store/review/guidelines/
- Apple App Privacy: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- Supabase 사용자 삭제: https://supabase.com/docs/reference/javascript/auth-admin-deleteuser
- Cloudflare Turnstile 개요: https://developers.cloudflare.com/turnstile/
