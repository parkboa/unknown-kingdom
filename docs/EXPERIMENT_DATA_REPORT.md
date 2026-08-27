# 실험·측정 데이터 분류 보고서 (2026-08-27)

`main` 통합 준비(공통 2)를 위한 사전 조사. **이 보고서는 파일을 수정·삭제·이동하지 않는다.**
분류와 권고만 담는다. 실제 정리 방침은 사용자가 결정한다.

## 요약

| | 파일 수 | 디스크 | 비고 |
| --- | --- | --- | --- |
| `experiments/` | 47 + 하위 5 | 2.70 MiB | 대부분 A/B 측정 로그 |
| `artifacts/` | 16 | 13.37 MiB | 94.3%가 `ai-puzzle-candidates-*.jsonl` 8개 |
| `main...HEAD` 이 두 폴더 diff | 21 파일 | +86,875줄 | 브랜치 리뷰 부담의 주원인 |

현재 `.git`의 압축·중복 제거된 loose object 저장 공간은 41.22 MiB다. 이 값은 HEAD가 가리키는
추적 파일의 원본 크기와 측정 기준이 다르므로 디렉터리별 원본 크기의 합을 `.git` 구성이라고
부를 수 없다. HEAD 기준 추적 파일 원본 크기는 `assets/` 23.58 MiB · `ios/` 22.07 MiB ·
`artifacts/` 13.37 MiB · `experiments/` 2.70 MiB다. **저장소 용량 문제는 실험 JSON보다
에셋/iOS의 비중이 크다.** 실험 데이터의 실제 비용은 **diff 가독성**이다 — 86,875줄이 22커밋
리뷰에 섞여 있다. 파일 churn은 거의 없다(대부분 히스토리에 1회만 등장,
`is-mcts-candidate.json`만 2회).

## 분류

### A. 설정 입력 — 코드가 읽는다, 작다, 유지

평가·시험 스크립트가 입력으로 참조한다. 지우면 명령이 깨진다.

| 파일 | 참조처 |
| --- | --- |
| `experiments/grandmaster-legacy-settings.json` | `package.json` → `ai:compare-grandmaster` |
| `experiments/tolerance-{015,030,050,070,100}.json` | `ai-tactics-suite.mjs --tier-override` (AI_MODEL.md 검증 절차) |
| `experiments/ablation-*.json`, `fix-*.json`, `sweep-king-danger-x{2,4,8}.json` | 오버라이드 설정 (각 3~5줄) |
| `experiments/stage1*.json`, `experiments/stage2-*.json` | 1a·1b·1c 독립 채점과 2단계 조합 검증용 오버라이드 |
| `experiments/is-mcts-{candidate,expert,tier-budgets}.json` | `packages/game-engine/README.md`, IS-MCTS 설정 |
| `experiments/hidden-special-prior.json` | `estimate-hidden-special-prior.mjs`가 재생성, AI 입력 (25줄) |

### B. 검증 결과 및 재사용 산출물 — 작고 유지

| 파일 | 참조처 | 크기 |
| --- | --- | --- |
| `experiments/grandmaster-tactical-validation.json` | `validate-grandmaster-tactics.mjs`가 쓰는 검증 요약 | 104줄 |
| `experiments/grandmaster-comparison.json` | `ai:compare-grandmaster --output`이 쓰는 비교 요약 | 197줄 |
| `experiments/open-spiel-tactical-crosscheck.json` | `crosscheck-open-spiel-tactics.mjs`가 쓰는 교차검증 요약 | 137줄 |
| `experiments/is-mcts-promotion-result.json` | `reproduce-is-mcts-losses.mjs`, `analyze-is-mcts-hidden-risk.mjs`가 읽는 승격 평가 입력 | 567줄 |
| `experiments/is-mcts-loss-replays/` (5개) | `analyze-is-mcts-hidden-risk.mjs`, `reproduce-is-mcts-losses.mjs` | 6.9 KB + 3× 재생 JSONL |

> `grandmaster-tactical-validation.json`은 지금 작업 트리에서 수정된 상태다(재생성됨). 커밋
> 여부는 별도 판단.

### C. 진단·회귀용 시험 픽스처 — 크지만 유지

| 파일 | 줄 | 용도와 제한 |
| --- | --- | --- |
| `experiments/ai-tactics-soldiers-only.json` | 16,723 | **종국 마무리 결함 재현 국면 p77·p94·p100·p107의 압축 보드가 저장돼 있다.** 구형 형식이라 현재 `--load-exam`에는 직접 사용할 수 없다. |
| `experiments/ai-tactics-all-units.json` | 16,505 | 전 유닛 모드의 구형 압축 시험. 현재 `--load-exam`에는 직접 사용할 수 없다. |

재생성 비용이 크다("AI가 수백 판을 둔다"). 전체 `position`을 저장하기 전의 구형 산출물이라
현재 채점 명령으로 그대로 재생할 수는 없지만, 과거 결과와 압축 보드 회귀의 근거이므로 추적
유지가 맞다. 새 플래그 비교에는 현재 스키마로 생성한 별도 시험을 사용한다.

### D. 대용량 측정 로그 — 코드가 안 읽는다, 재생성 가능, 정리 후보

한 번의 A/B 측정 덤프. 결론은 `DEV_LOG.md`·`docs/AI_MODEL.md`에 문장으로 남아 있고, 원본
JSON을 다시 읽는 코드는 없다.

| 파일 | 줄 |
| --- | --- |
| `experiments/sweep-king-danger-vs-tiers.json` | 11,845 |
| `experiments/sweep-king-danger-vs-random.json` | 8,857 |
| `experiments/objective-fix-vs-random.json` | 6,616 |
| `experiments/stage0-tier-vs-random.json` | 5,519 |
| `experiments/stage1c-vs-tiers.json`, `terminal-objective-vs-tiers.json`, `stage1b-vs-tiers.json` | 각 4,759 |
| `experiments/baseline-league-random-opening.json` | 4,684 |
| `experiments/tier-vs-random-reference.json` | 4,717 |
| `experiments/grandmaster-king-priority-sweep.json` | 4,557 |
| `experiments/objective-fix-vs-tiers.json` | 4,439 |
| `experiments/stage1b-vs-random.json`, `stage1c-vs-random.json`, `terminal-objective-vs-random.json` | 각 3,574 |
| `experiments/stage0-vs-tiers.json` | 2,397 |
| `experiments/grandmaster-king-safety-ablation.json` | 2,152 |
| `artifacts/ai-matchup-traces-20260822{,-hidden-risk,-selective-risk}.json` | 5,160 / 12,532 / 13,640 |

소계: 19개 파일, 112,114줄 / 2.78 MiB.

### E. 퍼즐 후보 덤프 — 13 MB, 대부분 미참조

| 파일 | 크기 | 참조 |
| --- | --- | --- |
| `artifacts/ai-puzzle-candidates-20260820.jsonl` | 2.2 MB | `ai-symmetry-check.mjs`가 읽음 → **유지** |
| 나머지 7개 `ai-puzzle-candidates-*-20260820.jsonl` | 약 11 MB | 코드 참조 없음. 2026-08-20 하루치 ablation 덤프 |
| `artifacts/ai-league-*.json` (5개) | 각 ~90줄 | 리그 요약, 작음 → 유지 |

## 권고 (실행하지 않음)

1. **A·B·C·리그 요약·`ai-puzzle-candidates-20260820.jsonl`은 추적 유지.** 코드 의존 또는
   소형.
2. **D·E(7개)는 `main` 병합 전 분리 검토.** 선택지:
   - (a) 그대로 둔다 — D 2.78 MiB와 E의 미참조 7개 10.48 MiB를 유지해 히스토리 재작성
     위험을 피한다. 총 13.26 MiB와 diff 가독성 비용은 감수한다.
   - (b) `.gitignore` 추가 + `git rm --cached` — **앞으로만** 제외, 과거 커밋은 유지. 이미
     `origin`에 있는 브랜치이므로 히스토리 재작성은 하지 않음. (Claude Code·Antigravity 합의안)
   - (c) `experiments/README.md`에 "각 파일이 무엇을 측정했고 결론은 어디에" 인덱스를 추가해
     원본을 지우기 쉽게 만든 뒤 (b) 적용.
3. **히스토리 재작성(`git filter-repo`)은 권하지 않는다.** 브랜치가 공유 상태이고, HEAD의
   추적 파일 원본 기준으로 `assets/`와 `ios/`가 각각 23.58 MiB, 22.07 MiB라 실험 JSON을
   지워도 체감 효과가 작다.
4. **측정 스크립트에 요약 출력 옵션 추가를 검토.** `docs/AI_MODEL.md` 남은 문제 #4와 동일 —
   앞으로는 판별 지표만 커밋하고 전체 게임 로그는 커밋에서 뺀다.

## 재생성 방법 (참고)

D 범주 대부분은 `scripts/ai-ablation-study.mjs`(`--league`, `--reference`, `--random-opening`)와
`scripts/ai-tactics-suite.mjs`로 재생성된다. 기존 C 범주 fixture는 전체 `position`이 없는 구형
형식이라 현재 `--load-exam`으로 다시 채점할 수 없다. 먼저 현재 스키마의 새 시험을 `work/`에
생성한 뒤 그 파일을 변형별로 재채점한다:

```
node scripts/ai-tactics-suite.mjs --positions 120 --games 60 --seed 20260826 \
  --soldiers-only --output work/ai-tactics-soldiers-only-current.json

node scripts/ai-tactics-suite.mjs \
  --load-exam work/ai-tactics-soldiers-only-current.json \
  --soldiers-only \
  --output work/ai-tactics-soldiers-only-scored.json
```

현재 fixture 메타데이터(`120 positions`, `60 game endings`, `seed 20260826`)와 맞춘 새 시험을
생성해야 할 때도 먼저 별도 파일에 쓴 뒤 기존 fixture와 비교한다. 생성 시각은 달라지므로
바이트 단위 동일성은 기대하지 않는다:

```
node scripts/ai-tactics-suite.mjs --positions 120 --games 60 --seed 20260826 \
  --soldiers-only --output work/ai-tactics-soldiers-only-regenerated.json
```
