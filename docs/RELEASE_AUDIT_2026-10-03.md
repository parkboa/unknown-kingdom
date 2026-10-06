# 출시 및 브랜드 점검 — 2026-10-03

사용자가 중단 뒤 직접 진행한 설정을 App Store Connect 화면, 홈페이지 최신 원격 소스,
실제 공개 URL, GitHub Pages 및 Sites 읽기 전용 조회로 점검했다. 외부 설정·브랜드·DNS·
심사 제출은 변경하지 않았다. 아래는 이전 준비 문서보다 우선하는 현재 관측값이다.

## 정식 배포 후 재확인 — 같은 날 후속 갱신

사용자가 https://tzib.studio/ 정식 배포를 알렸다. 쿠키·로그인 없는 공개 요청에서
홈페이지, https://tzib.studio/privacy/daeguk/,
https://tzib.studio/support/daeguk/ 모두 **200**이며 같은 HTTPS 주소를 유지했다.
Chrome에서도 최신 이름 이야기·Draw/Write·Playground가 있는 홈페이지와 한·영
DAEGUK 개인정보처리방침·지원 문서를 확인했다. 홈페이지 푸터와 DAEGUK 문서의
브랜드는 TZIB Studio, 법적 운영자는 Boahs Park다. 앞서의 로그인 차단은 해소됐다.

아래 홈페이지 섹션의 403·로그인 요구·미배포 상태는 배포 전 관측 기록이다.
배포 재확인 당시에는 홈페이지·App Store Connect 설정을 수정하지 않았다. 이후 승인된
개인정보 URL 등록 및 라벨 게시를 완료했다(아래 후속 결과 참조).

## App Store Connect

### 심사 접수 완료 — Waiting for Review

사용자 '이어서 진행해줘'로 심사 제출 작업을 재개했다. 앞서 확인한 타사 콘텐츠 없음으로
Content Rights를 저장하고 Saved 표시를 확인했다. Add for Review의 필수 정보 검증을
통과해 앱이 **Ready for Review**, 제출 초안이 **Item Ready to Submit / 1.0.1 (2)**가 됐다.
이후 사용자가 첫 출시는 iPhone만이며 TestFlight 실기기 기능 확인에 문제가 없었다고 답했다.
Mac·Vision Pro 배포를 해제하고 Saved 표시를 확인한 뒤 Submit for Review를 실행했다.
**1 Item Submitted** 성공 및 상세의 **Waiting for Review / 1.0.1 (2)**를 확인했다.
접수는 2026-10-03 14:28 EDT, ID `ce44e104-56a2-463a-acbd-56975040e302`다.
다음은 Apple 심사 결과 확인과 승인 후 수동 공개이며 일반 사용자 다운로드는 아직 불가하다.

- 무료 앱 계약 Active(2026-09-05~2027-09-06); 새 유료 앱 계약은 이번 무료 출시 대상이 아님.
- 공개 배포 Public, 선택 국가 Canada / Korea, Republic of / United States.
- 첫 출시는 iPhone용. Mac·Vision Pro 배포 선택은 둘 다 해제·저장했다.
- 공개 개인정보·지원 URL은 HTTP 200. 온라인 서버 `/health`는 `ok:true`.
- 한국어 스크린샷 5장, 빌드 2 연결, 로그인 불필요 심사 안내, 수동 공개 설정 유지 확인.
- 사용자 확인: TestFlight 1.0.1 (2)의 AI·특수 기물·온라인 대국/재접속·지원 링크·계정 삭제 문제 없음.
- 증빙: `artifacts/release-audit-2026-10-03/waiting-for-review.png`,
  `iphone-distribution-saved.png`, `review-submitted-success.png`, `content-rights-saved.png`.

아래 최초 점검 표의 Prepare for Submission·미선언 콘텐츠 권리는 후속 작업 이전 기록이다.

### 개인정보 등록 후속 작업 — 게시 완료

사용자의 진행 승인 후 네 데이터 유형을 모두 저장했다. 목적은 모두 App Functionality,
사용자와 연결됨 Yes, 추적 No다. 최종 Publish 창의 정확성·법률 준수·향후 갱신에 대해
사용자가 동의하고 Publish를 승인했다. 이후 **Published a few seconds ago by boahs Park**
표시와 한국어·영어 URL 유지, 네 항목의 저장된 목적·연결 상태를 확인했다. 심사 제출은 별개다.

- Privacy Policy: 한국어 `https://tzib.studio/privacy/daeguk/`,
  English (U.S.) `https://tzib.studio/privacy/daeguk/?lang=en`.
- Privacy Choices: 같은 URL의 `#choices` / `#choices-en` 계정 삭제 안내.
- Gameplay Content: 온라인 보드·진영·차례·멀티플레이 상태.
- User ID: Supabase 익명 Auth ID, 게임 ID와 게스트 이름.
- Device ID: Turnstile의 IP·TLS fingerprint 기반 보안 식별 신호를 이 유형에 대응시켰다.
- Other Data Types: Turnstile User-Agent·sitekey/origin 등 기타 접속 환경 신호.
- 위 대응은 앱 코드, Apple 데이터 유형 정의, Cloudflare Turnstile Privacy Addendum을
  대조한 분류 판단이다. 실명 없는 계정도 계정/기기와의 연결을 끊지 않으므로 연결됨으로
  선언했다. 광고·제품 분석·위치 수집은 선언하지 않았다.
- 증빙: `artifacts/release-audit-2026-10-03/app-privacy-published.png`.

아래 표의 개인정보 공란은 이번 등록 전 점검 기록이다.

| 항목 | 현재 관측 |
| --- | --- |
| 앱 | DAEGUK / 6818672488 / com.boahspark.daeguk |
| 심사 상태 | iOS 1.0.1 **Prepare for Submission**, Add for Review 표시. 심사 중이 아님 |
| 연결 빌드 | 1.0.1 (2) |
| TestFlight | 내부 그룹 테스터 1명·빌드 1개. 현재 Installed 1.0.1 (2), iPhone 15 Pro / iOS 26.6.1. 재로그인 전 보인 Invited는 오래된 화면이었다 |
| 스크린샷 | 한국어·English (U.S.) 각각 5장, 6.9형 원본을 6.5형에서 사용 |
| 설명·키워드 | 한국어·영어 저장됨 |
| 심사 정보 | 연락처·심사 메모 저장됨, Sign-in required 해제 |
| 공개 방식 | Manually release this version |
| 가격·국가 | 한국·미국·캐나다 가격 0; 공개 선택은 정확히 이 세 국가 |
| 연령 | 한국 ALL, 일반 9+; 이전 OS 일반 4+ |
| 연령 설문 | 판타지 폭력 None, 사실적 폭력 None, 무기 Infrequent. 나머지 기능·성인·의료·성적·도박 항목 None/No |
| 콘텐츠 권리 | Set Up Content Rights Information — 아직 선언 안 됨 |
| 개인정보 | 한국어·영어 Privacy Policy URL 공란; Get Started, Publish 비활성 — 라벨 작성·게시 안 됨 |
| DSA | Trader로 지정됨 |
| 기기 배포 | Apple Silicon Mac·Apple Vision Pro 모두 선택됨. Mac 호환성 검증은 미완료 표시 |

사용자가 콘텐츠는 모두 직접 제작했고 타사 콘텐츠가 없다고 이미 답했다. 이번 요청은
점검 우선이므로 해당 선언을 대신 저장하지 않았다. 개인정보 라벨은 실제 데이터 지도와
Cloudflare Turnstile 등 제공자 처리를 대조해 완성해야 한다.

## 홈페이지와 공개 URL

- 최신 GitHub 원격 main: `bca0d59`. 로컬 main은 `ef451b5`이며 깨끗하다.
  최신 원격 파일을 직접 읽었고 로컬 체크아웃을 이동하지 않았다.
- GitHub Pages의 마지막 성공 배포는 2026-09-21의 `ef451b5`다. 최신 수정은 미배포다.
- Pages 연결 주소는 `privacy.tzib.studio`. 인증서는 승인됨, HTTPS 강제 설정은 꺼져 있다.
- `https://privacy.tzib.studio/privacy/daeguk/`는 200. 문서 운영자는 Boahs Park,
  브랜드는 TZIB Studio, 시행일은 2026-09-13. 미리보기용 noindex, nofollow가 남아 있다.
- 기존 `https://parkboa.github.io/tzib-studio/privacy/daeguk/` 요청은
  `http://privacy.tzib.studio/privacy/daeguk/`로 이동했다.
- 사용자는 `https://parkboa.github.io/tzib-studio/`가 현재 우회 공개 주소라고 알려줬다.
  Chrome에서도 이 주소가 `privacy.tzib.studio/`로 이동하는 것을 확인했다. 화면은
  이전 홈페이지이고 푸터는 TZIB Studio다. 최신 원격의 이름 이야기·놀이터 수정본이 아니다.
  이 홈페이지의 Privacy·Support 링크에는 /tzib-studio/ 경로가 남아 있어 각각
  `privacy.tzib.studio/tzib-studio/privacy/`, `/tzib-studio/support/`에서 404가 발생한다.
- `https://tzib.studio/`, `/privacy/daeguk/`, `/support/daeguk/`의 공개 요청은 403.
  Chrome에서 루트 주소에 **Log in to access / Continue with ChatGPT**가 나타났다.
- Sites 조회도 동일 원인의 근거를 제공한다: 기존 프로젝트
  `appgprj_6aa5f9ce1a848191b3756f9dabd65bee`는 active, 공개 주소는 tzib.studio,
  현재 access_mode는 custom. public 모드는 선택 가능하지만 변경하지 않았다.
- 현재 Sites 게시본은 version 2, 마지막 갱신 2026-09-13이다. GitHub Pages 최신 소스와
  별개의 이전 게시본이므로 접근권한만 바꿔도 최신 홈페이지가 배포되는 것은 아니다.
- App Store Support URL과 심사 메모는 tzib.studio의 법적 페이지를 가리킨다.
  제출 전에 로그인 없는 접근을 확보하고 Privacy Policy URL도 실제 등록해야 한다.
- Pages 배포 작업은 프로젝트 경로 /tzib-studio/와 noindex를 삽입하는 미리보기 전용이다.
  정식 도메인 이전 시 그대로 실행하면 안 되고 루트 경로·검색 공개 설정을 정비해야 한다.

## 이름이 섞인 위치와 판단

최신 원격 소스에서 홈페이지 OG 이름·푸터, Contact·일반 Privacy/Support 푸터,
README는 **TZIB Interactive Studio**다. DAEGUK Privacy/Support와 일반 Privacy 본문,
업로드 빌드에 포함된 로컬 법적 문서는 **TZIB Studio**다. 법적 운영자는 **Boahs Park**다.

홈페이지의 브랜드 문구·푸터·공유 이름은 지금 수정할 수 있다. Apple의 판매자·개발자
이름 변경과는 별개의 작업이다. 앱 내부 법적 문구까지 즉시 바꾸려면 새 빌드가 필요하다.
홈페이지 이름만 바꾸는 데 재빌드는 필요하지 않다.

권장안은 이번 출시의 정식 공개 브랜드를 **TZIB Studio**로 통일하고
“Independent interactive studio”를 활동 설명으로 쓰는 것이다. 기존 앱 문서와 맞아
재빌드 없이 이어갈 수 있다. 이는 점검자의 권장안이며 사용자의 최종 이름 선택은 아니다.
TZIB Interactive Studio를 선택하는 것도 홈페이지에서는 가능하다. 그 경우 앱 법적
문서와의 브랜드 관계를 명확히 하거나 다음 빌드에서 함께 통일하면 된다.

Apple 공식 규칙에 따르면 개인 회원의 개발자 이름은 법적 이름이다. 조직 회원의
별도 개발자 이름은 첫 앱을 만들 때 설정하며 이후 직접 편집할 수 없다. 법적 명칭 변경
또는 개인→조직 전환은 Apple의 검증 절차를 거친다. 이번 홈페이지 브랜드 정리만으로
판매자 이름이나 팀·Bundle ID를 바꿀 필요는 없다.

- [Apple: 개발자 이름 설정](https://developer.apple.com/help/app-store-connect/create-an-app-record/set-your-developer-name)
- [Apple: 회원 정보 변경 및 조직 전환](https://developer.apple.com/help/account/membership/updating-your-account-information/)

## 다음 순서

1. 홈페이지에서 사용할 이름 확정 및 본문·푸터·메타 정보 일관성 정리.
2. 최신 홈페이지 공개와 정식 도메인의 로그인 없는 법적 URL 접근 확보.
3. 개인정보 URL·라벨 및 콘텐츠 권리 선언 완성.
4. Mac·Vision Pro 공개 범위가 의도한 것인지 정리.
5. 최종 제출 전 점검 후 심사 제출, 승인 후 수동 공개.
