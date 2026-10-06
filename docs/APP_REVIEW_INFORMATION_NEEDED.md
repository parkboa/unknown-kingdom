# DAEGUK 심사 추가 자료 요청

확인: 2026-10-03 / Codex. App Store Connect의 실제 심사 메시지를 읽었다.

2026-10-05 최신 상태: **1.0.1 (3) 승인 / Pending Developer Release** 확인.
추가 자료 제출 뒤 심사가 승인됐다. 사용자가 직접 수동 공개를 진행하며,
아래 거절·준비·재접수 기록은 과거 이력이다.

## 최신 준비 — 2026-10-04

**최종 제출 완료:** 사용자승인후2026-10-04 23:40 EDT에영어답변3,631자와
영상4편을App Review메시지로전송했다. Messages(2)에서본인답변과첨부4개를확인했다.
Notes에도동일6개항목저장/재확인, 빌드3으로교체후UpdateReview/Resubmit완료。
23:41 EDT 제출/항목모두**Waiting for Review / iOS1.0.1(3)**,
제출ID`ce44e104-56a2-463a-acbd-56975040e302`확인. 수동공개유지。
`video-package/submission-receipt.json`에접수결과/파일hash를기록했다.
이하미전송/거절표현은준비당시경과다. 현재다음행동은Apple심사결과확인이다.

후속: 사용자가submission/에추가한`ScreenRecording_10-04-2026 23-26-11_1.MP4`를
동일iPhone15Pro/iOS26.6.1/TestFlight1.0.1(3) 촬영으로확인했다.
홈화면실행→첫온라인ID→뒤로→즉시재진입→동일ID를확인했다.
재진입연결중약11.0초→ID약11.5초(0.5초간격추출)로약1초이내다.
`submission/04_Build3_Lobby_Reentry_Verification.mp4`16.40초/665,275bytes로정리,
끝제어센터만제외하고원본/시간흐름을보존했다. 전체디코딩·형식·hash·끝화면검수통과。
현재제출용은4편/약10.2MB이며01–03빌드2,04빌드3이다. 영어전송답변3,631자,
영상설명·README·manifest에추가했다. 수정후삭제/신규인증성공은별도사용자보고이며
04의영상확인범위로확대하지않는다. 아직외부전송없음.

사용자가 영상 정리를 요청해 제출용 MP43편과 과거 진단 사본2편을 만들었다.
폴더: `artifacts/app-review/2026-10-04/video-package/`.
제출용3편은 사용자가 iPhone15Pro/iOS26.6.1/TestFlight1.0.1(2) 촬영으로 확인했다.
서버 수정 후 빌드3에서 재진입 ID5초 이내 및 계정 삭제 후 재인증 정상 작동도
별도 사용자 수동 검증으로 확인했다. 기존 촬영본을 빌드3 영상으로 표시하지 않는다.
정확한 파일 순서·구간·개인 화면 가림·원본/사본hash는 README와 manifest에 기록했다.
H.264960×2080/30fps/AAC/faststart, 배속·대국 중간 생략 없음.
원본4편 보존, 전체 사본 디코딩 검사 및 장면/가림 경계 시각 검수 완료.
실제 Apple 첨부 제한과 최신 심사 대상 빌드는 전송 단계에서 확인한다. 아직 전송하지 않았다.

## 최초 거절 상태와 사유 — 2026-10-03 이력

- 앱: DAEGUK / iOS 1.0.1 (2)
- 제출 ID: `ce44e104-56a2-463a-acbd-56975040e302`
- 제출 상태: **Unresolved Issues**, 앱 버전 **Rejected**
- 분류: **2.1.0 Performance: App Completeness**
- 메시지 제목: **Guideline 2.1 - Information Needed - New App Submission**
- Apple 메시지 표시: Today 7:21 PM
- 이유: 개발자 계정의 심사 이력이 적어 앱을 이해하고 심사를 완료하기 위한 추가 정보가 필요하다고 명시했다. 이 메시지에서 개별 버그·충돌·문제 화면은 특정하지 않았다. 아래 Prevent Common Issues는 일반 안내다.
- Apple 요구: 아래 6개 정보를 App Review 답변에 제공하고, 향후 제출을 위해 **App Review Information → Notes**에도 추가한다.
- 원문 증빙: `artifacts/release-audit-2026-10-03/rejection-information-needed.txt`, 같은 이름의 `.png`.

## Apple이 요구한 6개 항목

1. 최신 운영체제를 쓰는 실제 기기에서 제출 앱의 기능을 보여주는 화면 녹화. 앱 실행부터 시작해 일반적인 사용 흐름을 보여준다. 계정 기능이 있으면 등록·로그인·삭제, UGC가 있으면 신고·차단, 유료 기능이 있으면 접근 과정도 포함한다.
2. 앱 목적·대상 사용자·해결하는 문제와 제공하는 가치.
3. 주요 기능의 설정·접근 방법과 필요한 계정/예제 파일.
4. 핵심 기능을 제공하는 외부 서비스·도구·플랫폼 목록.
5. 지역별 기능·콘텐츠 차이 설명 또는 모든 지역에서 동일함을 확인.
6. 규제 산업 또는 보호받는 타사 자료에 해당하면 관련 허가·증빙.

## 사용자가 준비할 실기기 영상

2026-10-03 사용자 제공 실기기 영상 4편을 검수했다. 아래 촬영 안내는 기준으로 보존한다.
검수 결과와 남은 촬영 항목은 다음 절을 따른다. 시뮬레이터 녹화로 대신하지 않는다.

1. iPhone의 iOS가 촬영 시점 최신인지 확인하고, TestFlight의 **DAEGUK 1.0.1 (2)**를 사용한다.
2. 홈 화면에서 앱 아이콘을 누르는 장면으로 시작한다. 튜토리얼과 주요 메뉴를 보여준다. AI·온라인 모드는 튜토리얼 완료 후 해금된다.
3. AI 대국에서 실제 착수와 특수 기물 기능을 보여준다.
4. 온라인 진입 시 자동 익명 게스트 계정 생성/인증 과정을 보여준다. Turnstile이 나타나면 정상적으로 완료한다. 이메일·비밀번호 입력 방식은 없다.
5. 방 만들기와 두 번째 기기/웹 클라이언트의 참가로 실제 온라인 대국을 보여준다. 두 번째 클라이언트도 필요한 튜토리얼 해금을 마쳐야 한다.
6. 폐기 가능한 테스트 게스트 계정으로 **설정 → 계정 삭제 → 영구 삭제 → 완료**를 보여준다. 보존할 본인 계정을 삭제하지 않는다.

원본 영상과 기기·iOS 버전·빌드 정보를 함께 확보한다. 영상 길이 제한은 이번 Apple 메시지에 명시되지 않았다. 업로드 방식/용량 제한은 실제 첨부 화면에서 확인한다.

## 제공 영상 검수 — 2026-10-03

사용자가 두 파일의 촬영 환경을 **iPhone 15 Pro / iOS 26.6.1 / TestFlight DAEGUK 1.0.1 (2)**로 확인했다.
파일 자체의 메타데이터로 기기 모델·OS·앱 빌드를 독립 검증한 것은 아니다.

| 원본 파일 (Downloads) | 길이 / 크기 | 확인한 내용 |
| --- | --- | --- |
| `ScreenRecording_10-03-2026 21-48-32_1.MP4` | 3:09.45 / 221,727,770 bytes | 시작 로딩 → 메뉴 → 튜토리얼 실제 착수·특수 기물 안내 → AI 설정·착수·특수 기물 반응 → 온라인 방 생성·상대 대기 |
| `ScreenRecording_10-03-2026 21-53-11_1.MP4` | 2:17.70 / 176,201,893 bytes | 앱 재실행 → 온라인 인증·ID 표시 → 방 생성·상대 연결·실제 온라인 착수 → 왕 포획 승패·경기 결과 → 계정 삭제 경고·영구 삭제·완료 |
| `ScreenRecording_10-03-2026 21-56-31_1.MP4` | 0:53.88 / 63,519,878 bytes | 홈 화면에서 실행 → 온라인 연결 대기 → 메뉴로 복귀·재진입·연결 대기 → 앱 재실행 → 삭제 전과 다른 게스트 ID·온라인 대기실 |
| `ScreenRecording_10-03-2026 22-15-02_1.MP4` | 0:26.76 / 39,757,894 bytes | 영구 계정 삭제·완료 → 홈 화면에서 앱 재실행 → 온라인 진입 → Turnstile 확인 → 약 3~4초 만에 새 게스트 ID·온라인 대기실 |

- 네 파일: 세로 960×2080, HEVC 영상 / AAC 음성 트랙 포함, 약 60fps. 촬영 환경에 대한 사용자 확인은 앞의 두 파일에 대한 응답이며, 세·네 번째는 같은 날 후속 촬영이다.
- 검수 방법: 영상에서 일정 간격으로 장면을 추출하고, 시작·재실행·계정 삭제 구간은 1~2초 간격으로 추가 확인했다. 모든 프레임을 실시간 재생하거나 음성 내용을 검수한 것은 아니다.
- 1편은 앱의 시작 로딩 화면부터 시작하며 홈 화면에서 아이콘을 누르는 장면은 없다.
- 2편 약 00:18~00:22에 홈 화면에서 앱을 실행하는 흐름이 있다. 그 전에는 연결 대기와 앱 전환 화면이 있으므로, 제출용 사본을 만들 때 이 재실행 구간부터 시작하면 Apple의 앱 실행 시작 요구를 더 분명하게 보여줄 수 있다.
- 2편 약 02:02 설정, 02:04 삭제 경고, 02:06 삭제 중, 02:08 **계정을 삭제했습니다. 다음 온라인 대국 때 새 게스트 계정이 만들어집니다.** 완료 문구를 확인했다.
- 영상 중 익명 인증과 온라인 ID는 보이지만, 그것만으로 신규 생성인지 기존 계정의 세션 복구인지는 구분할 수 없다. 2편 삭제 완료 뒤에는 온라인으로 다시 들어가지 않았다.
- 3편은 홈 화면에서 실행하는 장면과 삭제 전과 다른 게스트 ID를 확보했다. 다만 약 00:04~00:22와 재진입 뒤 약 00:28~00:36에 연결 대기가 지속되고, 앱 재실행 뒤 약 00:52에 ID가 나타난다. 사용자는 **“오쓰가 가끔씩 버벅거려. 나도 원인은 아직 모르겠어”**라고 확인했다. 정상적인 촬영 정리를 위한 재실행으로 해석하지 않는다.
- 4편 약 00:02~00:03 영구 삭제 확인, 00:04~00:06 완료 문구, 00:11 홈 화면,
  00:12~00:14 앱 시작, 00:18 온라인 진입, 00:19 Turnstile 확인 중,
  00:20 인증 화면 닫힘, 00:22 새 게스트 ID·대기실을 확인했다. 온라인 진입부터
  ID 표시까지 약 3~4초(1초 간격 추출 기준)이며 이번 시도에는 긴 지연이 없다.
  계정 삭제 뒤 신규 생성 흐름의 정상 사례로 활용할 수 있으나, 간헐적 지연 문제의
  해결 증거는 아니다. 약 00:09~00:10 다른 앱, 끝부분 제어 센터는 정리 대상이다.
- **당시 확인할 문제**: 간헐적인 인증/온라인 연결 지연의 원인과 회복 동작. 영상만으로 Supabase Auth, 네트워크, 서버 기동, 앱의 연결 처리 중 어디가 원인인지는 확정할 수 없다. Supabase 정지 복구가 완료됐다는 사실만으로 이 간헐적 증상까지 해소됐다고 판단하지 않는다.
  1차 진단은 `docs/AUTH_LATENCY_DIAGNOSIS_2026-10-03.md` 참조. 현재 백엔드는 1초 이내 정상 응답하며 앱의 제한 없는 대기 경로를 모의 재현했지만, 실기기 원인 확정은 남았다.
- 이후2026-10-04 운영 진단에서 이전 연결이 남아 새 접속을 중복 거부하는 것을 확인했고 서버 PR #4로 수정했다. 사용자가 현재 빌드3에서5초 이내 ID와 삭제 후 정상 동작을 확인했다. 상세 `docs/LOBBY_RECONNECT_FIX_2026-10-04.md`.
- 제출용 사본은 개인 사진·다른 앱 화면 및 불필요한 앞뒤 구간을 정리했다. 가림 구간의 시간은 유지하고 의미 있는 과거 실패·지연은 별도 진단 사본으로 보존했다. 영어 설명에 과거 지연과 최신 수정 결과를 구분한다.
- 기존 검수용 이미지: `artifacts/release-audit-2026-10-03/video-review/`. 새 사본/경계 검수는 위video-package의qa-source/qa-output. 원본은 수정·삭제하지 않았으며 아직 외부 업로드하지 않았다.

## 영어 답변 및 Notes용 준비 초안

**아직 제출하지 않았다.** 영상 정보와 최근 수정 결과를 반영한 초안이다. 전송 단계에서 실제 첨부 제한과 심사 대상 빌드를 확인한다.

2026-10-04 후속 읽기 확인: 제출 상세와 버전 화면 모두 아직1.0.1(2), Rejected /
Unresolved Issues이다. Apple 답변창은4,000자 제한이고 현재 Notes에는 기존 접근/삭제
안내만 있어6개 요청 정보를 추가해야 한다. 전송용 전체 답변은
`artifacts/app-review/2026-10-04/video-package/APP_REVIEW_REPLY_EN.txt`에현재3,631자로
준비했다. 아래 긴 초안보다 이 파일을 사용한다. 방 안내는 공개 대기실 목록과 혼동하지
않도록 단순히 create a room으로 적었다. 재심사에는 실기기 검증을 마친빌드3 선택을
권장한다. 읽기 및 로컬 준비만 했으며 답변 입력/첨부/Notes 변경/빌드 교체/재제출 없음.
답변창에는 파일 첨부 기능이 있으나 형식·용량 제한은 표시되지 않아 실제 첨부 시 확인한다.

```text
Thank you for reviewing DAEGUK. Please find the requested information below.

1. Physical-device demonstration
The three demonstration recordings were captured on a physical iPhone 15 Pro running iOS 26.6.1, using TestFlight DAEGUK 1.0.1 (build 2), on October 3, 2026. Please watch them in this order:
- 01_App_Launch_Online_Match_Account_Deletion.mp4 (1:52.30): launch from the home screen, anonymous authentication/session restoration, room creation, an actual online match, results, and permanent account deletion.
- 02_Tutorial_AI_Gameplay.mp4 (2:27.00): app startup, guided tutorial, special-unit interactions, AI settings/gameplay, and results.
- 03_Account_Deletion_New_Guest_Creation.mp4 (0:25.20): permanent account deletion, relaunch, human verification, and automatic creation of a new anonymous guest account.
The files are separate recordings at normal speed, with unrelated personal screens covered and outer sections trimmed. Privacy covers preserve the original elapsed time. Historical connection-delay footage is preserved separately as diagnostic material.
On October 4 we corrected server-side duplicate-connection rejection during lobby reentry. After deployment, the developer confirmed on TestFlight 1.0.1 (build 3) that reentry displays the ID within five seconds and that deletion followed by new guest authentication works correctly. These recordings predate that fix; the latest confirmation is a physical-device manual test report.

2. Purpose and audience
DAEGUK is a free, turn-based strategy board game for general audiences who enjoy tactical games. Players learn an original 9x9 game through a guided tutorial, practice against five levels of AI, and play online matches using rooms. Hidden special units and territory control provide strategic depth.

3. Access to the main features
No email address, password, paid account, or sample files are required. Complete the guided tutorial to unlock AI and Online PvP. Tutorial and AI gameplay are available locally. Online mode automatically creates an anonymous guest account; a Cloudflare Turnstile verification may appear on first entry. Create a room on one client and join it from a second client to test multiplayer.
Account deletion: Main screen > Settings > Delete Account > Delete Permanently. Deletion removes the server-side anonymous account, game identity mapping, authentication session, and match-resume ticket. Device-only tutorial/challenge progress remains, as explained in the confirmation screen.

4. External services and tools
Supabase Auth provides anonymous authentication. PostgreSQL stores game identities and their private authentication mappings. Cloudflare Turnstile protects guest account creation against automated abuse. Render hosts the online game/authentication server. Vercel hosts the web client and authentication proxy. Capacitor packages the local game assets in the iOS application. The computer opponent runs locally and does not use a remote AI or LLM service. There are no payment processors, in-app purchases, subscriptions, or advertising services.

5. Regional differences
The game functionality and content are the same in South Korea, the United States, and Canada. The interface supports Korean and English. There is no region-specific paid or restricted content.

6. Regulated services and protected material
The app is a strategy game and does not provide highly regulated services. All game artwork, audio, and other creative content were created by the developer; no protected third-party creative material is included.

Privacy Policy: https://tzib.studio/privacy/daeguk/
Support: https://tzib.studio/support/daeguk/
```

## 남은 작업

- [x] 사용자의 실제 iPhone 영상 2편과 기기/OS/빌드 정보 확보.
- [x] 제공 영상의 주요 기능·계정 삭제 내용과 답변 초안 대조.
- [x] 삭제 후 다른 게스트 ID가 나타나는 추가 영상 확보·검수.
- [x] 재진입 중복 거부 원인 확인·서버 수정·사용자 실기기 성공 보고 기록.
- [x] 앱 실행으로 시작하는 제출 순서와 제출용 MP43편/진단 사본2편 준비.
- [x] 최신 심사 대상빌드3확인 및정리본4편 실제첨부처리성공(일반형식/용량한도는UI에별도표시없음).
- [x] 사용자 지시에 따라 App Review에 답변·영상 제공 및 Notes 갱신(2026-10-04 23:40 EDT).
- [x] UpdateReview/Resubmit완료후WaitingforReview /1.0.1(3)확인(23:41 EDT).

이번 확인에서는 답변 전송, Notes 변경, 새 빌드 업로드, 재제출을 하지 않았다. 새 빌드가 필요하다는 요구는 이번 메시지에 없다. 별도로 발견된 확대·AI 버그는 다음 업데이트 목록에 유지하되, 녹화/테스트에서 중대한 문제가 확인되면 출시 후보 수정 여부를 판단한다.
