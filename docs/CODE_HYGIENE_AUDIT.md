# DAEGUK Code Hygiene Audit

감사일: 2026-09-21 / Codex

## 1. 목적과 결론

이 감사는 출시 직전 동작을 바꾸지 않고 주석·dead code·중복·임시 호환 코드를
분류하기 위한 읽기 전용 조사다. 감사 중 소스 코드는 수정하지 않았다.

결론:

- 직접 참조가 없고 동적 호출 경로도 찾지 못한 소규모 삭제 후보가 있다.
- 왕 탈출과 과거 순간이동 상태 흔적은 실제 실행 경로가 없지만 상태 스키마·프로토콜·AI
  직렬화에 퍼져 있어 출시 전 단순 삭제 대상이 아니다.
- AI의 긴 주석은 많지만 대부분 게임 규칙, 숨은 정보 경계, 측정 근거와 실패 원인을
  설명한다. 출시 전 일괄 삭제하지 않는다.
- 개발자 데모와 FX 미리보기 코드는 제품 UI에서 숨겨지지만 브라우저 회귀 시험이 직접
  사용하므로 dead code가 아니다.

## 2. 범위와 조사 방법

조사 범위:

- `app.js`
- `js/`
- `server/`
- `packages/game-engine/src/`
- `ios/App/App/AppDelegate.swift`
- 진입 HTML, 테스트, 스크립트와 README의 참조 경로

제외 범위:

- `artifacts/`, `experiments/`의 역사·재현 자료
- `node_modules`, Pods와 외부 의존성
- `dist-mobile`, `ios/App/App/public` 등 생성물

확인 방법:

- export·함수·상수 정의의 전체 저장소 식별자 참조 횟수 확인
- import, HTML module entry, 이벤트 등록, 네이티브 브리지와 테스트 참조 검색
- TODO/FIXME/legacy/temporary 계열 표식 검색
- 상태 필드의 생성·할당·직렬화·프로토콜 검증 경로 대조
- 설명 문서와 현재 엔진 규칙 비교

텍스트 검색은 JavaScript 동적 호출을 완전히 증명하지 못하므로 실제 삭제 전에는 diff별
테스트를 수행한다.

## 3. Safe to remove — 고확신 후보

다음 후보는 정의 외 직접 참조가 없거나, 참조하는 코드 전체가 함께 죽은 작은 묶음이다.

| 후보 | 근거 | 권장 변경 |
| --- | --- | --- |
| `app.js`의 `visiblePveRanks()` | 함수 호출이 없고 `firstUnresolvedRankIndex`의 유일한 앱 호출자다. 현재 PvE 랭크 UI는 `AI_RANK_ORDER`를 직접 사용한다. | 함수와 전용 import 제거 |
| `app.js`의 `forEachPiece()` | 정의 외 참조가 없다. | 함수 제거 |
| `app.js`의 `teleportActive` | 값을 계산하지만 읽지 않는다. 실제 UI는 바로 아래 `teleportUiState`를 사용한다. | 지역 상수 제거 |
| `app.js`의 `previousTeleportKey`, `nextTeleportKey` | 네트워크 상태 수신 시 계산하지만 이후 읽지 않는다. | 두 지역 상수 제거 |
| `js/config.js`의 `createSpecialHelp()` | 전체 저장소에 호출·import·테스트가 없다. 도움말은 `TEXT`와 현재 UI 경로가 담당한다. | export 함수 제거 |
| `js/puzzle-controller.js`의 `TUTORIAL_SPECIAL_SURROUND_DELAY_MS` | 앱은 별도 `SPECIAL_ACTIVATE_DELAY_MS`/로컬 상수를 사용하며 이 export를 import하지 않는다. | export 상수 제거 |
| `js/puzzle-controller.js`의 `TUTORIAL_SPECIAL_ACTIVATE_DELAY_MS` | 2026-09-21 검색 기준 정의만 남아 있다. 과거 작업 기록에도 통합 타이머 전환 시 삭제 대상으로 기록돼 있다. | export 상수 제거 |
| `js/puzzle-controller.js`의 `isPuzzleUnlocked()` | 전체 저장소에 호출·테스트가 없다. 현재 Challenge 진행은 다른 랭크 잠금 경로를 사용한다. | export 함수 제거 |
| `firstUnresolvedRankIndex`의 죽은 연결 | 함수는 죽은 `visiblePveRanks()`만 호출한다. `RANK_ORDER` 자체는 퍼즐 카탈로그와 테스트가 사용하므로 보존한다. | 함수와 전용 import만 제거 |
| `js/ai.js`의 `chooseAiKingSwapTarget()` | 정의 외 호출·import·테스트가 없고 현재 규칙은 왕 탈출을 허용하지 않는다. | 함수만 제거; 상태 스키마는 별도 판단 |

권장 순서:

1. 앱 지역 변수·지역 함수 묶음
2. puzzle/config의 미사용 export와 import 묶음
3. 사용되지 않는 왕 교환 AI 함수

각 묶음은 독립된 diff로 검증한다.

## 4. Safe but optional — 주석·템플릿 정리

### iOS AppDelegate 기본 주석과 빈 수명주기 메서드

`ios/App/App/AppDelegate.swift` 앞부분에는 Xcode 템플릿이 만든 빈 수명주기 메서드와
코드를 그대로 설명하는 기본 주석이 남아 있다. 앱 동작을 수행하지 않는 다음 메서드는
주석과 함께 제거할 수 있다.

- `applicationWillResignActive`
- `applicationDidEnterBackground`
- `applicationWillEnterForeground`
- `applicationDidBecomeActive`
- `applicationWillTerminate`

URL·Universal Link를 `ApplicationDelegateProxy`로 전달하는 두 메서드는 보존한다.
`DaegukSessionPlugin`, Keychain 경계, CAPTCHA WebView의 보안 주석도 보존한다.

Swift 파일 변경은 이득이 작으므로 출시 전 정리에서 생략해도 된다. 반영한다면 Xcode
서명 없는 빌드까지 수행한다.

### 한국어 README의 현재 규칙 불일치

- `README.md`는 “왕은 탈출·교환·순간이동할 수 없다”고 현재 규칙을 설명한다.
- `README.ko.md` 63~65행은 아직 왕의 최초 피격 탈출·교환과 AI 자동 선택을 설명한다.
- `DEV_LOG.md`의 현재 규칙 기록도 왕이 탈출하지 않는다고 명시한다.

`README.ko.md`는 사용자 대상 현재 설명이므로 영문 README와 동일한 규칙으로 갱신한다.
`DESIGN_NOTES.md`의 왕 탈출 설계는 역사 자료이므로 삭제하지 않고, 필요하면 “폐기된 초기
설계”라는 표지만 추가한다.

## 5. Likely unused — 출시 후 구조 정리 후보

다음은 실행 중 값이 만들어지지 않지만 여러 계층에 퍼져 있어 작은 dead-code 삭제가
아니다.

### `pendingKingSwap`

관측:

- 초기 상태에서 항상 `null`로 생성된다.
- `pendingKingSwap`에 비-null 값을 대입하는 실행 코드가 없다.
- 엔진 액션·포획·반응·프로토콜·IS-MCTS·실험 스크립트는 여전히 이 필드를 검사하거나
  직렬화한다.
- 사용되지 않는 `chooseAiKingSwapTarget()`만 과거 왕 교환 선택을 구현한다.

판단: 왕 탈출 기능을 폐기한 뒤 남은 상태 스키마 호환 흔적으로 보인다. 함수 하나는
고확신 삭제가 가능하지만 필드 전체 제거는 프로토콜·기록·fixture 마이그레이션 범위를
결정한 뒤 iOS 출시 후 진행한다.

### `pendingWizardTeleport`

관측:

- 초기 상태에서 `null`로 생성되며 비-null 대입 경로가 없다.
- 현재 마법사 이동은 `teleporting` 필드를 사용한다.
- 프로토콜, IS-MCTS와 대칭성 스크립트가 필드를 계속 포함한다.

판단: 이전 스키마 필드일 가능성이 높다. 저장 기록과 네트워크 호환 범위를 확인한 뒤
프로토콜 버전 변경 또는 마이그레이션과 함께 제거한다.

### `kingEscapeUsed`

관측:

- 모든 생성 경로가 `false`로만 초기화한다.
- 값을 `true`로 바꾸는 실행 코드가 없다.
- 프로토콜 검증, AI 복제 상태와 IS-MCTS 키에는 여전히 포함된다.

판단: 왕 탈출 폐기 흔적으로 보이지만 piece 스키마 변경이므로 `pendingKingSwap`과 같은
후속 작업으로 묶는다.

### `aiProfile`

브라우저 초기 상태는 과거 세 프로필 중 하나를 무작위로 기록하고 프로토콜은 값을
검증하지만, 현재 AI 선택은 `aiRank`/난이도 설정을 사용한다. 서버 공개 상태와 과거 기록
호환 여부를 먼저 확인한 뒤 제거 여부를 결정한다.

## 6. Manual review — 보존 또는 제품 결정 필요

### `AUTH_MODE=legacy`

운영은 인증 필수 모드지만 로컬·테스트·이전 배포 호환을 위한 `legacy` 경로가 남아 있다.
인증을 강제로 단순화하기 전에 테스트 서버, 개발 명령과 Render 기본값을 확인한다. 출시
직전 삭제 대상이 아니다.

### `applyAction`, `state.log`와 shared adapter

공유 엔진 README가 명시적으로 호환 wrapper와 기존 UI adapter로 정의한다. 테스트와 UI가
사용하고 있으므로 이름에 `legacy`가 있다는 이유로 제거하지 않는다. 새 UI가 events만
사용하도록 마이그레이션한 뒤 별도 작업으로 다룬다.

### 개발자 데모와 FX Preview

`?demo=...`, `?dev=1`과 FX toolbar는 일반 사용자에게 숨겨져 있지만
`test/browser/critical-game-flows.spec.js`가 실제로 사용한다. 회귀 재현과 화면 검증 수단이므로
보존한다.

## 7. 주석 보존 기준

출시 전 보존:

- 인증 토큰이 JavaScript 메모리, Keychain, 쿠키 사이에서 이동하는 경계
- CAPTCHA WebView와 게임 WebView의 권한 분리
- 프록시 환경의 IP 신뢰 경계와 rate limit 이유
- 포위·특수 발동·마법사 이동·턴 복원처럼 코드만으로 의도가 드러나지 않는 규칙
- 숨은 정보가 AI 평가나 상대 공개 상태로 누출되지 않게 하는 이유
- 측정값이 AI 상수와 우선순위로 연결되는 근거
- 기존에 실제 오판을 만들었던 접근과 현재 구현이 이를 피하는 이유

후속 정리 후보:

- `js/ai.js`, `js/strategic-analysis.js`, `js/state-evaluation.js`의 측정 서술 중 같은 설명이
  여러 티어에 반복되는 부분
- 실험 결과를 코드 주석과 `docs/AI_MODEL.md` 양쪽에서 중복 설명하는 부분

후속 정리는 측정 근거를 문서로 옮기고 코드에는 규칙과 링크만 남기는 방식으로 한다.
출시 전에는 AI 동작 해석에 필요한 맥락을 잃을 위험이 더 크므로 일괄 축약하지 않는다.

## 8. 권장 최소 정리 범위

iOS 출시 전에 반영할 기본 범위:

1. `app.js`의 미사용 지역 함수·지역 변수
2. `js/config.js`, `js/puzzle-controller.js`의 미사용 export와 연결 import
3. `js/ai.js`의 미사용 왕 교환 선택 함수
4. 현재 규칙과 충돌하는 `README.ko.md` 수정

기본 범위에서 제외:

- 상태·piece·프로토콜 스키마 제거
- 인증 legacy mode 제거
- AI 알고리즘 주석 대량 축약
- 공유 엔진 호환 wrapper 제거
- 개발자 데모 제거
- iOS 보안 주석 변경

## 9. 검증 계획

각 작은 정리 후:

```bash
node --check app.js
git diff --check
npm test
```

모든 최소 정리를 합친 출시 후보에서:

```bash
npm run test:browser
npm run build:mobile
npm run ios:sync
```

Swift 템플릿 정리를 포함하면 서명 없는 Xcode 빌드를 추가한다.

## 10. 다음 행동

2026-09-21 위 `Safe to remove` 후보와 한국어 README 규칙 수정이 반영됐고 전체 필수
검사를 통과했다. 실제 사용 중인 `RANK_ORDER`는 재확인 후 보존했다. 상태 스키마와
프로토콜 후보는 iOS 출시 뒤 별도 검토한다.
