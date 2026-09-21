# DAEGUK App Store 제출 초안

최종 갱신: 2026-09-21 / Codex

이 문서는 출시 후보 `1.0.1 (2)`, 앱·코드 커밋
`c3f49ea89f16b7d4f4b2395feeb12705e9ad79fe`를 기준으로 App Store Connect에 입력할
내용과 스크린샷 제작 순서를 정리한 초안이다. 실제 입력·공개·심사 제출 전에는 운영자가
표시 문구, 법적 응답, 연락처와 콘텐츠 설문을 최종 확인한다.

## 1. 앱 기본 정보

| 항목 | 초안 |
| --- | --- |
| 앱 이름 | `DAEGUK` |
| Bundle ID | `com.boahspark.daeguk` |
| 버전 / 빌드 | `1.0.1 (2)` |
| 기본 언어 제안 | 한국어 |
| 추가 현지화 | 영어(미국) |
| 기본 카테고리 제안 | Games |
| Games 하위 카테고리 제안 | Board, Strategy |
| 보조 카테고리 제안 | 없음 — 필요성이 생길 때만 추가 |
| 가격 제안 | 무료 |
| 인앱 구매 / 구독 | 없음 |
| 광고 | 없음 |
| 저작권 초안 | `2026 Boahs Park` — 제출 전 법적 표시 형식 확인 |
| Marketing URL | `https://tzib.studio/` — 정식 도메인 공개 후 사용 |
| Privacy Policy URL | `https://tzib.studio/privacy/daeguk/` |
| User Privacy Choices URL | Privacy Policy URL과 동일하게 사용 가능 |
| Support URL | `https://tzib.studio/support/daeguk/` |

App Store의 이름은 30자, 부제는 30자 이하다. 설명은 4,000자 이하, 프로모션 문구는
170자 이하이며 키워드는 현지화별 100바이트 이하다. 아래 초안은 이 제한 안에 둔다.

## 2. 한국어 현지화

### 이름

`DAEGUK`

### 부제

`숨은 전략의 9×9 보드게임`

### 프로모션 문구

`상대 왕을 포위하고 특수 유닛의 정체를 숨기세요. 5단계 AI 또는 비공개 온라인 방의 상대와 전략 대국을 펼칠 수 있습니다.`

### 키워드

`전략,보드게임,두뇌게임,턴제,퍼즐,온라인대전,인공지능,왕,영토`

UTF-8 기준 86바이트다. 앱 이름과 개발자명은 검색 대상이므로 키워드에서 반복하지 않았다.

### 설명

```text
DAEGUK은 9×9 보드에서 왕과 숨겨진 특수 유닛을 운용하는 턴제 전략 게임입니다.

상대 왕을 포획하면 즉시 승리합니다. 왕을 잡지 못한 채 대국이 끝나면 더 많은 영토를 확보한 쪽이 승리합니다. 자기 성벽의 활로, 왕의 성역, 보이지 않는 상대 특수 유닛을 읽어 한 수 앞을 준비하세요.

주요 특징
• 처음부터 규칙을 익힐 수 있는 단계별 튜토리얼
• 초보부터 그랜드마스터까지 5단계 AI 대국
• 장군, 외교관, 마법사의 서로 다른 일회성 능력
• 비공개 방 만들기와 참가를 지원하는 온라인 대국
• 연결이 잠시 끊겨도 같은 방과 진행 상태로 복귀
• 한국어와 영어 UI

온라인 대국은 자동 생성되는 익명 게스트 계정을 사용합니다. 이메일이나 전화번호는 필요하지 않습니다. 계정과 온라인 ID는 앱의 설정에서 언제든지 영구 삭제할 수 있습니다.
```

## 3. 영어 현지화

### Name

`DAEGUK`

### Subtitle

`Hidden Strategy on a 9×9 Board`

30자다.

### Promotional Text

`Surround the enemy King, conceal your special units, and outthink five levels of AI or a player in a private online room.`

### Keywords

`strategy,board game,tactics,turn-based,puzzle,online,ai,king,territory,multiplayer`

82바이트다.

### Description

```text
DAEGUK is a turn-based strategy game played on a 9×9 board with Kings and hidden special units.

Capture the opposing King for an instant win. If the match ends before either King falls, the side with more territory wins. Use fortress-wall liberties, the King’s opening sanctuary, and incomplete information about enemy units to plan ahead.

Features
• A guided tutorial that teaches the rules step by step
• Five AI levels, from Novice to Grandmaster
• One-time abilities for the General, Diplomat, and Wizard
• Private-room online matches
• Short disconnect recovery that restores the same room and game state
• Korean and English interfaces

Online play uses an automatically generated anonymous guest account. No email address or phone number is required. You can permanently delete the guest account and online ID at any time in Settings.
```

## 4. App Privacy 입력 초안

제출 전 현재 빌드와 포함된 제3자 코드를 기준으로 다시 확인한다.

| 질문 | 초안 답변 |
| --- | --- |
| 앱 또는 제3자 파트너가 데이터를 수집하는가 | Yes |
| 데이터 유형 | Identifiers → User ID |
| 목적 | App Functionality |
| 사용자 신원과 연결되는가 | Yes |
| 추적에 사용하는가 | No |

근거:

- 온라인 기능은 Supabase 익명 Auth ID, 내부 player ID, 20자리 공개 게임 ID와 인증
  세션을 사용한다.
- 이메일, 전화번호, 실명, 위치, 연락처, 사진, 마이크·카메라 권한은 요구하지 않는다.
- 광고·제품 분석 SDK와 ATT/IDFA 기반 추적은 현재 코드에 없다.
- Cloudflare Turnstile이 부정 가입 방지를 위해 처리하는 브라우저·기기 환경 신호가 Apple의
  데이터 유형 중 추가 선언 대상인지 제출 화면의 최신 정의와 Cloudflare 계약을 대조한다.
- Privacy Policy URL은 iOS에서 필수이고 User Privacy Choices URL은 선택 사항이다.

## 5. 연령 등급 설문 초안

Apple이 실제 설문 응답으로 등급을 계산하므로 숫자 등급을 미리 고정하지 않는다.

| 항목 | 제안 응답 | 근거 / 확인점 |
| --- | --- | --- |
| Parental controls | No | 별도 보호자 제어 없음 |
| Age assurance | No | 생년월일·연령 확인 없음 |
| User-generated content | No | 사용자가 글·이미지·닉네임을 입력하거나 공개하지 않음 |
| Messaging or chat | No | 온라인 대국에 채팅 없음 |
| Advertising | No | 광고 SDK·광고 화면 없음 |
| Unrestricted web access | No | 고정 Privacy·Support 링크와 CAPTCHA 화면만 사용 |
| Social media | No | 소셜 피드·공유 기능 없음 |
| Cartoon or fantasy violence | 운영자 최종 확인 | 추상적인 돌의 포획·제거가 핵심 플레이에 반복되므로 화면 예시를 보고 빈도를 선택 |
| Realistic violence / graphic content | None | 사실적 인물·유혈·고어 없음 |
| Guns or other weapons | None | 무기 묘사 없음 |
| Horror, profanity, sexual content, drugs | None | 해당 콘텐츠 없음 |
| Simulated gambling / gambling / loot boxes | None / No | 가위바위보는 진영 결정이며 베팅·유료 보상·확률형 상품 없음 |
| Contests | None | 상품·순위 보상을 주는 경연 없음 |
| Made for Kids | 선택하지 않음 | 전연령 일반 이용자이며 Kids 카테고리 전용 앱이 아님 |
| Override to Higher Age Rating | Not Applicable 제안 | 설문 계산 결과와 운영자 판단 후 확정 |

한국 스토어에 제공할 경우 App Store가 표시하는 지역별 등급과 GRAC 관련 알림을 제출 전에
확인한다.

## 6. App Review 정보 초안

### Sign-in required

`No` 제안. 앱의 튜토리얼과 AI 대국은 계정 없이 사용할 수 있고, 온라인 대국은 이메일·
비밀번호가 없는 익명 게스트 인증을 자동으로 만든다. 별도 데모 계정 자격 증명은 없다.

### Review Notes

```text
DAEGUK does not require an email address, password, or paid account.

The tutorial and AI modes are available locally. Complete the guided tutorial to unlock AI and Online PvP.

Online PvP uses an automatically generated anonymous guest account. On the first online entry, a Cloudflare Turnstile verification screen may appear in a secure in-app web view. No reviewer credentials are required. To test a match, create a private room on one device and join it from a second client.

Account deletion path:
1. Open Settings from the main screen.
2. Tap Delete Account.
3. Review the warning and tap Delete Permanently.

Deletion removes the anonymous authentication user, online player mapping, device authentication session, and online match-resume ticket. Device-only tutorial and challenge progress remains, as disclosed in the confirmation screen.

Privacy Policy: https://tzib.studio/privacy/daeguk/
Support: https://tzib.studio/support/daeguk/
```

실제 제출 전 리뷰 연락 담당자의 이름·이메일·국제 형식 전화번호를 입력한다. 이 정보는
저장소에 기록하지 않는다.

## 7. 스크린샷 제작 계획

iPhone 세로 화면만 지원한다. 현행 App Store Connect 기준으로 현지화별 1~10장을 올릴
수 있다. 우선 6.9형 세로 규격에서 한국어와 영어 각각 5장을 준비한다. 허용되는 대표
크기는 `1320×2868`, `1290×2796`, `1260×2736`이며 한 규격으로 통일한다. PNG/JPEG에는
알파 채널을 포함하지 않는다.

| 순서 | 화면 | 한국어 캡션 | 영어 캡션 | 주의 |
| --- | --- | --- | --- | --- |
| 1 | 메인·모드 선택 | 왕을 지키고, 상대 왕을 포위하라 | Protect Your King. Surround Theirs. | 잠긴 모드보다 완성된 진입 화면 사용 |
| 2 | 튜토리얼 보드 | 단계별로 익히는 9×9 전술 | Learn 9×9 Tactics Step by Step | 안내 문구와 강조 칸이 보이게 캡처 |
| 3 | AI 설정 또는 대국 | 5단계 AI와 벌이는 수읽기 | Outthink Five Levels of AI | 실제 제공되는 난이도만 표시 |
| 4 | 특수 유닛 발동 장면 | 장군·외교관·마법사의 반전 | Turn the Match with Hidden Units | 숨은 정보가 상대 화면에 노출되지 않게 함 |
| 5 | 한국어: 마법사 순간이동 / 영어: 설정 | 숨은 유닛으로 판을 뒤집으세요 | Privacy and Account Controls | 실제 공개 ID나 방 코드를 노출하지 않음 |

제작 규칙:

- 출시 후보 `1.0.1 (2)`의 실제 iPhone Simulator 또는 실기기 화면을 사용한다.
- 상태 막대, Dynamic Island와 안전 영역이 잘리지 않게 한다.
- CAPTCHA, 토큰, 내부 UUID, 실제 공개 게임 ID, 이메일 전달 대상이나 디버그 로그를
  스크린샷에 포함하지 않는다.
- 한국어와 영어 캡션은 각 언어의 실제 UI와 짝을 맞춘다.
- 캡션 오버레이를 만들면 게임 화면을 과도하게 가리지 않고 모든 이미지의 여백·글꼴·
  대비를 동일하게 유지한다.
- 앱 미리보기 동영상은 첫 제출에서 생략할 수 있다.

## 8. 제출 전 미확정 항목

- [ ] App Store Connect의 기존 앱 레코드, 앱 이름·SKU와 계약 상태 확인
- [ ] 기본·보조 카테고리 최종 선택
- [ ] 판매 지역과 가격(무료) 최종 확인
- [ ] 저작권 표기 최종 확인
- [ ] Cloudflare Turnstile 관련 App Privacy 추가 데이터 유형 여부 최종 확인
- [ ] 추상적 포획 표현의 Cartoon or Fantasy Violence 빈도 최종 선택
- [x] 한국어·영어 6.9형 스크린샷 각 5장 제작·검수
- [ ] 리뷰 연락 담당자 정보를 App Store Connect에 직접 입력
- [ ] 정식 `tzib.studio` Privacy·Support URL 공개와 로그인 없는 접근 확인
- [ ] 서명된 Archive 업로드 뒤 정확한 빌드 `1.0.1 (2)` 연결

## 9. Apple 공식 기준

- App information: https://developer.apple.com/help/app-store-connect/reference/app-information/app-information
- Platform version information: https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information
- Screenshot specifications: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
- App Privacy: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- Age rating: https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating
- Submit an app: https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app

## 10. 스크린샷 완료 기록

`artifacts/app-store/1.0.1/`에 한국어·영어 각 5장을 저장했다. 모두 출시 후보
`1.0.1 (2)`를 iPhone 17 Pro Max Simulator(iOS 26.5)에서 직접 캡처한
`1320×2868` 세로 JPEG이며 알파 채널이 없다. 전수 육안 검수에서 잘림, 디버그 로그,
내부 UUID·토큰·공개 온라인 ID 노출이 없음을 확인했다.

온라인 대기실은 캡처 과정에서 새 운영 게스트와 CAPTCHA를 만들지 않기 위해 제외했다.
현재 세트는 현지화별 5장으로 Apple의 1~10장 요구 범위를 충족한다. 파일 순서와 각 장면은
`artifacts/app-store/1.0.1/README.md`에 기록했다.
