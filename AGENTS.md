# Project Instructions

## Repository

- 이 저장소의 기존 구조와 스타일을 우선한다.
- 관련 없는 파일은 수정하지 않는다.
- 새 의존성을 추가하기 전 사용자에게 확인한다.
- 작업 전 `git status`를 확인한다.
- 완료 전에 사용 가능한 검증 명령을 실행한다.
- 테스트 실패를 숨기거나 삭제하지 않는다.
- API 키와 비밀값을 저장소에 커밋하지 않는다.

## Workflow

- 한 번에 하나의 에이전트만 파일을 수정한다.
- 다른 에이전트는 리뷰와 분석만 수행한다.
- 작업 결과에는 변경 파일과 검증 결과를 명시한다.

## Shared Briefing Ownership

- `TODAY_BRIEFING.md`는 여러 AI가 의견을 공유하는 공용 브리핑 문서다.
- Codex는 `## [CODEX]`, Claude Code는 `## [CLAUDE CODE]`, Google Antigravity는 `## [GOOGLE ANTIGRAVITY]` 구역과 `## 오늘의 작업 기록` 안에서 자신의 이름표가 붙은 기록만 수정할 수 있다.
- 각 AI는 다른 AI의 구역을 읽고 자신의 의견에 참고할 수 있지만, 다른 AI의 글을 수정·삭제·이동·재정렬하거나 서식을 바꿔서는 안 된다.
- 다른 AI의 의견에 답하거나 이견을 남길 때도 반드시 자신의 구역에 작성한다.
- 작업을 완료한 AI는 `## 오늘의 작업 기록`에 자신의 이름표로 완료 내용과 검증 결과 또는 커밋을 추가한다.
- 각 AI는 다른 AI가 남긴 작업 기록을 수정·삭제·이동·재정렬하지 않는다.
- 사용자는 문서 전체와 모든 AI 구역을 자유롭게 수정할 수 있다.
- 날짜와 공통 작업 순서는 사용자가 요청했을 때만 갱신한다.

## Commands

- Install: `npm ci`
- Lint: 현재 별도 명령 없음
- Typecheck: 현재 별도 명령 없음
- Test: `npm test`
- Build: `npm run build:mobile`
