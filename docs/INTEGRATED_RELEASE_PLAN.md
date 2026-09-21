# DAEGUK 통합 출시 작업 계획

최종 갱신: 2026-09-21 / Codex

이 문서는 DAEGUK의 코드 정리, iOS 출시, TZIB 공개 사이트 전환, Android 출시를
하나의 순서와 완료 기준으로 관리하는 상위 기준 문서다. iOS 세부 입력값과 수동 검증은
`APP_STORE_RELEASE_CHECKLIST.md`, 구현·운영 근거는 `WORK_HANDOFF.md`를 함께 사용한다.
문서끼리 상태가 충돌하면 날짜가 최신인 실제 검증 기록을 우선하고 이 문서를 즉시
갱신한다.

## 1. 목표

1. 출시 직전 프로젝트에서 동작을 바꾸지 않는 코드·주석 감사를 수행한다.
2. 확실히 안전한 정리만 작은 변경으로 반영한다.
3. 현재 구현된 계정 삭제와 개인정보 안내의 검증 근거를 완성한다.
4. 일반 `tzib-studio` 정적 사이트를 App Review 제출 직전에 공개한다.
5. TestFlight와 App Store 심사를 마친 뒤 동일한 웹·서버 기반으로 Android를 출시한다.

출시 전 원칙은 **기능 추가보다 출시 차단 요소 제거**, 코드 정리 원칙은
**behavior change 0**이다.

## 2. 저장소와 현재 기준

### 게임·앱·서버

- 위치: `/Users/boahspark/Projects/AI-Workspace/projects/daeguk/unknown-kingdom`
- 출시 작업 기반: `main`과 `origin/main`의 `7f7b702`
- 출시 후보 앱·코드 커밋: `c3f49ea89f16b7d4f4b2395feeb12705e9ad79fe`
- 보호 대상: 미추적 `artifacts/live-auth-browser.png`는 사용자 검증 자료로 유지한다.
- iOS 앱, 웹 게임, Node 서버, 인증·계정 삭제, 테스트와 출시 문서는 이 저장소가
  담당한다.

### 일반 공개 사이트

- 위치: `/Users/boahspark/Projects/AI-Workspace/projects/daeguk/tzib-studio`
- GitHub: `parkboa/tzib-studio`
- 기준: `main`과 `origin/main` 모두 `ef451b5`
- 사이트 원본과 `build/` 정적 산출물, 수동 GitHub Pages 워크플로가 있다.
- GitHub Pages Actions 미리보기 `https://parkboa.github.io/tzib-studio/`는 공개되어
  홈페이지와 Privacy·Support 정식 경로 및 호환 리디렉션 검증을 통과했다.
- 미리보기에는 `noindex, nofollow`가 유지된다. `tzib.studio`의 기존 호스트·DNS와
  사용자 정의 도메인은 변경하지 않았으며, App Review 제출 직전 별도 승인으로 전환한다.

### 운영 상태

- Supabase SQL 002 계정 삭제 함수 적용과 최소 실행 권한 확인 완료.
- Render `SUPABASE_SECRET_KEY` 서버 전용 저장 완료.
- 계정 삭제 API와 관련 코드 운영 배포 완료.
- 삭제 전 Auth UUID를 확보한 전용 테스트 게스트로 계정 삭제를 다시 검증했다. 삭제 뒤
  기존 `auth.users`·`auth.sessions`·player·identity가 모두 0이고 새 인증 흐름에서
  다른 공개 ID와 새 Auth/player/identity 연결이 생성됨을 확인했다.
- Android 프로젝트와 `@capacitor/android` 의존성은 아직 없다.

## 3. 확정된 공개 URL 정책

일반 정적 사이트의 정식 경로는 다음을 기준으로 한다.

- Privacy Policy: `https://tzib.studio/privacy/daeguk/`
- Support: `https://tzib.studio/support/daeguk/`

기존 앱·문서가 사용한 경로는 호환 리디렉션을 제공한다.

- `/daeguk/privacy` → `/privacy/daeguk/`
- `/daeguk/support` → `/support/daeguk/`

App Store Connect와 이후 Google Play에는 정식 경로를 입력한다. 공개 전까지 두 URL을
완료로 표시하지 않는다.

## 4. 단계별 작업

### 단계 0 — 기준 문서 정합화

- [x] 두 저장소의 기준 커밋과 작업 트리 상태 확인
- [x] 운영 SQL·Render 비밀·배포 완료 상태 확인
- [x] 기존 `tzib.studio` 호스트와 GitHub Pages 정적 사이트의 역할 구분
- [x] 통합 출시 계획 작성
- [x] 기존 App Store 체크리스트의 오래된 상태를 최신 기록과 대조해 갱신
- [x] `WORK_HANDOFF.md`의 현재 목표와 다음 단일 행동을 이 계획에 맞게 갱신

완료 조건: 다음 작업자가 이 문서와 인계 문서만으로 현재 단계와 다음 행동을 판단할 수
있다.

### 단계 1 — 읽기 전용 Code Hygiene Audit

감사 중에는 소스 코드를 수정하지 않는다.

- [x] `app.js`, `js/`, `server/`, `packages/game-engine/`, 직접 작성한 iOS 코드를 조사
- [x] 불필요·오래된·코드 반복 주석 분류
- [x] 보안·게임 규칙·네이티브 브리지의 이유 설명 주석 보존 목록 작성
- [x] dead code, 간접 참조 후보, 중복 helper, TODO/FIXME, 임시 호환 코드 조사
- [x] 각 후보에 `Safe to remove`, `Likely unused`, `Manual review` 확신도 부여
- [x] `docs/CODE_HYGIENE_AUDIT.md`에 파일·근거·위험·권장 시점을 기록

제외 범위:

- `artifacts/`, `experiments/`의 역사·재현 자료
- Pods와 외부 의존성
- `dist-mobile`과 iOS 공개 자산 등 생성물
- 단순히 오래됐다는 이유만으로 보존 문서나 회귀 fixture 삭제

완료 조건: 실제 삭제 없이 검토 가능한 후보 목록과 참조 근거가 존재한다.

### 단계 2 — 일반 사이트 콘텐츠 로컬 준비

이 단계에서는 공개 배포, GitHub Pages 활성화, DNS 변경을 하지 않는다.

- [x] 게임 저장소의 한·영 개인정보 내용을 일반 사이트 페이지에 동기화
- [x] 익명 Auth ID, 내부 player ID, 공개 게임 ID와 게스트 닉네임 명시
- [x] Supabase, Cloudflare Turnstile, Render, Vercel 처리 명시
- [x] 웹 쿠키, iOS Keychain, 기기 전용 진행 정보와 복귀표 설명
- [x] 보관·삭제 범위와 인앱 계정 삭제 경로 설명
- [x] 외부 삭제 요청과 지원 연락 경로 설명
- [x] 운영자 `Boahs Park`, 캐나다, 지원 이메일 확인
- [x] 정식 URL과 두 호환 리디렉션 준비
- [x] 원본과 `build/` 배포 산출물 일치 확인
- [x] 로컬 서버에서 데스크톱·모바일, 한·영, 내부 링크, mailto 검증

완료 조건: 공개만 하지 않았을 뿐 App Review에 제공할 수 있는 최종 사이트 산출물이
로컬에서 검증된다.

### 단계 3 — 출시 전 최소 코드 정리

단계 1의 `Safe to remove` 후보만 기본 대상으로 한다.

- [x] 오래되거나 자명한 주석만 별도 변경으로 정리
- [x] 모든 호출 경로가 없다고 확인된 dead code만 별도 변경으로 제거
- [x] 중복 구조 리팩터링과 중간·낮은 확신도 후보는 iOS 출시 후로 보류

각 변경의 필수 검증:

```bash
npm test
npm run test:browser
npm run build:mobile
node --check app.js
git diff --check
```

변경 범위가 작으면 관련 브라우저 테스트를 먼저 실행하고 최종 출시 후보에서 전체 검사를
한 번 수행한다.

완료 조건: 기능·프로토콜·화면 동작을 바꾸지 않고 승인된 정리만 독립적으로 설명할 수
있다.

2026-09-21 완료 기록:

- 미사용 앱 지역 함수·변수, puzzle/config export와 왕 교환 AI 함수를 제거했다.
- 실제 사용 중인 `RANK_ORDER`, 상태·piece·프로토콜 스키마와 인증 경로는 보존했다.
- 현재 규칙과 충돌하던 한국어 README의 왕 탈출 설명을 수정했다.
- `npm test` 194개, `npm run test:browser` 41개, 모바일 빌드, Xcode 경로를 명시한
  `npm run ios:sync`, 원본·모바일·iOS 핵심 자산 일치와 공백 검사를 통과했다.

### 단계 4 — iOS Release Candidate 고정

- [x] 테스트 게스트의 공개 ID와 내부 Auth UUID를 삭제 전에 기록
- [x] 삭제 후 Auth·session·player·identity 직접 부재 확인
- [x] 기존 세션이 복원되지 않고 새 인증 흐름으로 전환되는지 확인
- [x] CAPTCHA 보호 뒤 새 공개 ID가 생성되는지 확인
- [x] 최종 자동 검사와 iOS 자산 sync
- [x] 원본·`dist-mobile`·iOS 자산 핵심 파일 일치 확인
- [x] 서명 없는 Release 또는 simulator 컴파일 확인
- [x] 버전 `1.0.1 (2)`와 출시 후보 SHA `c3f49ea` 확정
- [x] App Store 설명·키워드·Privacy·연령 등급·심사 메모·스크린샷 계획 초안
- [ ] 한국어·영어 6.9형 스크린샷 제작과 최종 메타데이터 승인

사용자가 직접 수행하는 항목:

- CAPTCHA
- 실기기 설치·종료·재실행
- 두 기기의 수동 온라인 대국
- App Store Connect의 최종 법적·콘텐츠 응답 확인

완료 조건: 출시 차단 결함이 없고 이후에는 심각한 결함 수정 외 기능 변경을 받지 않는다.

2026-09-21 삭제 검증 기록: 공개 ID `BB3C1C9F58C4C9BBEA77`의 삭제 전 Auth UUID와
player ID를 Git 밖의 권한 제한 임시 파일에 확보했다. 앱의 삭제 완료 문구를 확인한 뒤
동일 UUID 기준 `auth.users=0`, `auth.sessions=0`, 게임 DB의 player·identity=0을 직접
확인했다. 삭제 과정에서 refresh token은 브라우저가 안전하게 폐기했으므로 토큰 원문을
추출하거나 재생하지 않았다. 다음 온라인 진입에서 기존 세션이 복원되지 않고 CAPTCHA가
표시되는지 확인했다. 새 공개 ID `5869A1237488DAADC8D2`는 이전 ID와 다르며 동일 ID
기준 player·identity·Auth 사용자·Auth 세션이 각각 1개임을 확인했다.

2026-09-21 최종 자동 검증: `npm test` 194개, `npm run test:browser` 41개,
`node --check app.js`, `git diff --check`, `npm run ios:sync`, 핵심 자산 일치와 서명 없는
Release iOS Simulator 빌드가 모두 통과했다. Xcode의 Pods Embed 단계 반복 실행 경고와
AppIntents 미사용 알림 외 컴파일 오류는 없다.

출시 후보 앱·코드 커밋은 `c3f49ea89f16b7d4f4b2395feeb12705e9ad79fe`다. 이후
상태 기록용 문서 커밋은 앱 실행 자산을 변경하지 않는다.

### 단계 5 — 일반 사이트 공개 전환

App Review 제출 직전에 사용자 최종 승인을 받고 실행한다. 공개는 외부 상태 변경이므로
승인 전에는 수행하지 않는다.

- [x] `tzib-studio` 최신 Privacy·Support 콘텐츠 커밋·푸시 (`ef451b5`)
- [x] GitHub Pages Actions 미리보기 활성화와 첫 배포 성공 확인
- [ ] 사용자 정의 도메인과 `CNAME` 설정
- [ ] `tzib.studio` DNS를 기존 호스트에서 GitHub Pages로 전환
- [ ] HTTPS 인증서 정상 발급 확인
- [ ] 사용자 정의 도메인에서 로그인 없는 공개 접근과 HTTP 200 확인
- [x] Pages 미리보기에서 Privacy·Support 정식 경로와 호환 리디렉션 확인
- [x] Pages 미리보기에서 한·영·내부 링크·메일 링크 확인
- [ ] 최종 공개물에서 미리보기용 `noindex, nofollow` 제거 확인
- [ ] 이전 DNS 값과 롤백 절차 기록

완료 조건: 외부 비로그인 브라우저에서 홈페이지·Privacy·Support가 HTTPS로 정상
열리고 App Review가 접근할 수 있다.

### 단계 6 — TestFlight, App Review와 iOS 공개

- [ ] 서명된 Release Archive 생성·업로드
- [ ] App Store Connect에 정식 Privacy·Support URL 입력
- [ ] 내부 TestFlight 설치와 출시 차단 흐름의 짧은 최종 확인
- [ ] 제출 빌드·버전 연결과 출시 방식 선택
- [ ] `Add for Review`와 `Submit for Review`
- [ ] 심사 중 문의·거절 사유 대응
- [ ] 승인 후 선택한 방식으로 공개
- [ ] 공개 직후 앱 설치, 인증, 온라인 서버, 법적 URL 확인

완료 조건: App Store 공개와 직후 핵심 smoke test가 완료된다.

### 단계 7 — Android 구현과 Google Play 출시

먼저 Play Console 계정 유형과 12명·14일 Closed Test 적용 여부를 확인한다.

- [ ] 새 의존성 추가 사용자 승인
- [ ] `@capacitor/android@7.6.8`과 `android/` 프로젝트 생성
- [ ] package ID `com.boahspark.daeguk` 유지
- [ ] Android 16 / target API 36 적용
- [ ] Android `DaegukSession` 플러그인 구현
- [ ] Keystore 기반 refresh token 저장
- [ ] Android 전용 Turnstile WebView/Activity 구현
- [ ] 계정 삭제 시 Keystore 세션과 복귀표 제거
- [ ] 실기기 신규 가입·종료·동일 ID 복원 검증
- [ ] 온라인 방 생성·참가·재접속·서버 장애 검증
- [ ] Android 아이콘·splash·앱 이름 준비
- [ ] upload key와 서명된 Release AAB 생성
- [ ] Play Console Data Safety·콘텐츠 등급·스토어 자산 입력
- [ ] 외부 계정 삭제 웹 경로 입력
- [ ] Internal Test와 필요한 Closed Test 진행
- [ ] Production access 신청과 심사 제출

완료 조건: Google Play Production 공개와 핵심 smoke test가 완료된다.

## 5. 변경·승인 경계

다음은 별도 사용자 확인 없이 진행할 수 있다.

- 로컬 코드·문서 분석
- 읽기 전용 감사와 보고서 작성
- 승인된 범위의 로컬 문서·코드 수정과 테스트
- 로컬 사이트 미리보기

다음은 실행 직전에 사용자 확인을 받는다.

- 일반 사이트 공개 배포와 DNS 전환
- 운영 데이터·비밀 설정 변경
- App Store 또는 Google Play 심사 제출
- 새 의존성 추가
- 계정 생성·삭제를 포함한 실제 운영 계정 검증

## 6. 진행 기록 규칙

- 한 번에 하나의 에이전트만 파일을 수정한다.
- 각 단계 완료 즉시 이 문서의 체크박스와 `WORK_HANDOFF.md`를 갱신한다.
- 완료 결과에는 변경 파일, 검증 명령과 결과, 남은 위험을 기록한다.
- 이미 통과한 검사를 이유 없이 반복하지 않는다.
- 비밀값, 토큰, 쿠키, 내부 Auth UUID를 문서나 Git에 기록하지 않는다.
- 두 저장소의 변경은 각각 독립된 diff와 커밋으로 유지한다.

## 7. 현재 다음 단일 행동

**단계 4에서 출시 후보 `c3f49ea`를 기준으로 한국어·영어 6.9형 스크린샷을 제작하고
수동 검증을 준비한다.** 입력 초안은 `APP_STORE_SUBMISSION_DRAFT.md`를 사용한다.
사용자 검증 자료
`artifacts/live-auth-browser.png`는 커밋하지 않는다.

GitHub Pages 미리보기는 활성화되어 있다. `tzib.studio` DNS와 사용자 정의 도메인은
App Review 공개 전환 승인을 받을 때까지 변경하지 않는다.
