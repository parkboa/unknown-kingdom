# AI 목적함수 플래그 구조 정리 제안 (2026-08-28)

**상태:** 제안. 다른 에이전트 의견 대기 중.
**작성:** CLAUDE CODE
**배경 문서:** `docs/AI_MODEL.md`

## 이 문서를 쓰는 이유

리그를 돌려 "어느 설정이 강한가"를 물으려 했다. 그 전에 확인해야 할 것이 있었다 —
**설정들이 서로 독립인가.** 아니었다.

다섯 개로 세어 온 플래그(1a·1b·1c·2단계·`terminalObjectiveModel`) 중 **혼자서는 아무 일도
하지 않는 것이 셋**이다. 이 상태로 조합을 스윕하면 퇴화한 칸을 측정하는 데 시간을 쓰게 되고,
실제로 08-27과 08-28 두 번의 스윕이 그렇게 소모됐다.

의존 관계를 먼저 정하고, 작동하지 않는 것을 버리고, 같이 움직이는 것을 하나로 묶은 뒤에
리그를 돌리는 것이 맞다.

## 실측 증거

전부 오늘 고친 교리 시험지(`ai-tactics-suite.mjs`, 교리 오프닝) 위에서 잰 것이다.
비교 단위는 **결정**(28문제 × 5티어 = 140)이며, 점수가 아니라 **고른 수 자체**를 비교했다.

| 가설 | 비교 | 결과 |
| --- | --- | --- |
| 1c 단독 = `kingTacticalPriority: 0` | `additiveObjectiveModel` vs `kingTacticalPriority: 0` | **0/140 다름** |
| 2단계 단독 = 무효 | `specialAnchorThreat` vs 기준선 | **0/140 다름** |
| 1b 단독 = 무효 | `territoryVerdictModel` vs 기준선 | **0/140 다름** (잡종 코퍼스에서도 0/145) |
| *대조군* | `kingDangerModel` vs 기준선 | 4/140 다름 |

대조군이 차이를 낸다. 따라서 위 세 개의 0은 **비교 방법의 문제가 아니라 플래그의 문제다.**

### 왜 그런가 — 코드 경로

**2단계는 1a 없이 도달 불가능하다.**

```js
// js/state-evaluation.js:87
const kingValueFor = models.kingDanger
  ? (target, side) => kingDangerValue(target, side, settings)   // ← 2단계는 이 안에서만 읽힘
  : kingLibertyValue;                                            // ← 기본 경로
```

`specialAnchorThreat`는 `kingDangerValue` 내부(`state-evaluation.js:47`)에서만 읽힌다.
1a가 꺼지면 그 함수가 **호출조차 되지 않는다.** 출시 설정은 1a가 꺼져 있으므로
**현재 2단계는 어떤 티어에 켜도 아무 일도 일어나지 않는다.**

`scripts/probe-objective-model-tactics.mjs`가 isolated·production 두 팔 모두에
`kingDangerModel: true`를 넣는 이유가 이것이다. 측정 설계의 흠이 아니라 **강제 조건**이다.

**1c는 1b 없이는 결합 방식 교체가 아니다.**

```js
// js/state-evaluation.js:206
function additiveValue(weighted, strategicMultiplier) {
  const strategicValue = /* kingLiberties·territoryVerdict 제외한 합 */;
  return weighted.territoryVerdict + strategicValue + weighted.kingLiberties;
}
```

1b가 꺼지면 `features.territoryVerdict`가 **정확히 0**이므로(`state-evaluation.js:144` 주석이
이를 의도로 명시) 위 식은 `strategicValue + kingLiberties`가 된다. 이는 `blendedValue`에
priority 0을 넣은 것과 **같은 식**이다. `js/ai.js:589`는 루트 정렬에서도 같은 강제를 한다.

즉 **1c 단독은 "새 목적함수"가 아니라 `kingTacticalPriority`를 끄는 스위치다.** 그리고 그 효과는
이미 측정돼 있다 — `docs/AI_MODEL.md` 기록으로 `kingTacticalPriority: 0`은 마스터를
65% → 52.5%로 떨어뜨렸다.

**1b는 1c 없이는 두 겹으로 눌린다.**

`KING_TACTIC_PRIORITY = 0.9`다(`js/strategic-analysis.js:14`). `blendedValue`는 king 이외의
모든 항에 `(1 - 0.9) = 0.1`을 곱한다. 여기에 1b 항 자체가 `margin × 충전율¹²`이다.

교리 코퍼스 28문제의 실측 충전율:

| | 충전율 | `충전율¹²` | 블렌드 `×0.1` 후 |
| --- | ---: | ---: | ---: |
| 최소 | 28% | 2.75e-7 | 소멸 |
| 중앙값 | 63% | 3.9e-3 | 3.9e-4 |
| 최대 | 98% | 0.74 | 0.074 |

65%를 넘는 문제가 11/28, 90%를 넘는 문제는 **5/28**뿐이다.
**1b가 세 코퍼스 연속 0을 낸 것은 항이 틀려서가 아니라 눌려서다.** 지수 12와 블렌드 ×0.1이
곱해지면 중앙값 국면에서 4자리가 날아간다.

또한 `kingTacticalPriority`는 **전문·마스터에만** 설정돼 있다(`js/ai.js:152, 211`).
하위 세 티어는 이미 priority가 0이므로 `additiveValue ≡ blendedValue`다.
오늘 1c가 전문·마스터에서만 수를 바꾼 이유가 이것이다.

## 버릴 것

### 1. `ironcladKingDefense` — 읽는 곳이 없다

```
js/ai.js:189:    ironcladKingDefense: true,
```

저장소 전체에서 이 한 줄이 전부다. 마스터 티어에만 `true`로 설정돼 있고 **어디서도 읽지
않는다.** 이름은 최상위 티어의 왕 방어를 약속하지만 동작이 없다.

*판단이 필요하다:* 지울 것인가, 아니면 의도했던 동작을 구현할 것인가.
누군가 의도를 가지고 마스터에만 넣은 흔적이므로 기록을 아는 쪽의 의견을 구한다.

### 2. `terminalObjectiveModel` — 1a·1b·1c의 별칭일 뿐

```js
// js/state-evaluation.js:86
const combined = Boolean(settings.terminalObjectiveModel);
return {
  kingDanger:        combined || Boolean(settings.kingDangerModel),
  territoryVerdict:  combined || Boolean(settings.territoryVerdictModel),
  additiveObjective: combined || Boolean(settings.additiveObjectiveModel),
};
```

세 플래그를 전부 켜는 것과 **평가 결과가 정확히 같다.** 독립적인 의미가 없다.
과거 실험과의 호환을 위해 남겼으나, 축을 둘로 줄이면 존재 이유가 사라진다.

### 3. `specialAnchorThreat`를 최상위 플래그로 두는 것

1a의 하위 모드다. 단독으로 켤 수 있게 두면 "켰는데 아무 일도 안 일어난다"는 오해를 계속
만든다. 1a 안의 옵션으로 넣거나, 1a 없이 켜면 경고하도록 게이트를 둔다.

### 4. `searchAlgorithm` — 게임 코드가 읽지 않는다

다섯 티어 모두 `"heuristic"`으로 설정돼 있으나, 읽는 곳은 오프라인 대국 하네스
`scripts/lib/ai-match.mjs:49`(`=== "is-mcts"` 검사)와 그것을 고정하는 테스트뿐이다.
**어떤 티어도 `"is-mcts"`를 설정하지 않으므로 그 분기는 티어 설정에서 도달 불가능하다.**
하네스 손잡이가 티어 설정에 섞여 있는 형태다.

### 5. 1b·1c를 따로 켜는 실험

위 증거로 수학적으로 무의미하다. 08-27과 08-28의 7변형 스윕에서 **7칸 중 최소 3칸이
퇴화 셀**이었다.

## 엮을 것 — 축은 다섯이 아니라 둘이다

평가함수가 실제로 가진 분리 가능한 관심사는 둘뿐이다.

### A축 — 왕 위험을 무엇으로 재는가 (측정)

- `kingLibertyValue` (성벽 활로를 판 위 활로와 합산) ↔ `kingDangerValue` (병사 포획 거리 기준)
- 현재 1a `kingDangerModel`
- **포함:** 2단계 `specialAnchorThreat`(특수 경로 추가), `kingDangerScale`(1a에서만 적용됨)

### B축 — 항들을 어떻게 합치는가 (결합)

- `blendedValue` (고정 예산, priority 0.9) ↔ `additiveValue` (독립 3항)
- 현재 1b + 1c를 **하나로**
- 1b는 항을 만들고 1c는 그 항이 커질 자리를 만든다. 둘 중 하나만으로는 어느 쪽도 성립하지 않는다.

그러면 조합은 2 × 2 = **네 가지**이며, 각 칸이 실제로 다른 것을 잰다.
지금까지의 7변형 스윕보다 적고, 퇴화 셀이 없다.

## 아직 풀리지 않은 모순 — 4단계는 A축을 전제한다

**이것이 현재 production에 남아 있는 실제 문제다.**

4단계(왕 성벽 오프닝)는 다섯 티어 전부에 반영돼 게임에 나가 있다. 교리는 왕을 자기 성벽
옆에 세우고 상하좌우를 먼저 쌓는다.

그런데 기본 경로 `kingLibertyValue`는 그 왕을 이렇게 읽는다:

| | `kingLibertyCount` | 기본 경로 (현재 출시) | 1a |
| --- | ---: | ---: | ---: |
| 성벽 밀봉 왕 | 1 | **−8** | **0** |
| 중앙 왕 (활로 3) | 3 | +1 | −2.5 |

`kingLibertyCount`가 성벽 활로를 판 위 활로와 합산하기 때문이다. 실제로는 성벽에 밀봉된 왕을
병사로 잡을 수 없다. **1a는 정확히 이 역전을 고치려고 만들어졌다.**

즉 **지금 다섯 티어는 자기 평가함수가 −8점이라고 말하는 자리에 왕을 세우고 시작한다.**
교리와 평가가 같은 국면을 반대로 읽는다.

`docs/AI_MODEL.md`가 기록한 4단계의 근거 자체가 1a의 출발점과 같다 —
"성벽에 밀봉된 왕이 위험하게 읽히는데 병사로는 잡을 수 없다". 행동은 그 근거로 출시됐고
평가는 그 근거를 반영하지 않은 채 꺼져 있다.

**이 모순은 두 방향 중 하나로만 풀린다.**

1. **A축을 켠다** — 교리를 정당화한다. 다만 오늘 교리 시험지에서 1a 단독은 전문·마스터 각 −1이었다.
2. **교리를 되돌린다** — 평가에 맞춘다. 다만 4단계 설계 근거(왕 인접 4칸의 39%가 자기 돌)를 버리게 된다.

**주의:** 오늘 잰 "1a 단독 −1"은 **A축만 켜고 B축은 끈 상태**의 성적이다. 위 구조대로면
그것은 네 칸 중 한 칸일 뿐이며, 아직 A+B를 재지 않았다.

## 제안하는 순서

1. **버릴 것 4개를 정리한다** (`ironcladKingDefense`, `terminalObjectiveModel`,
   `specialAnchorThreat` 최상위 노출, `searchAlgorithm` 티어 노출). 운영 동작 변화 0.
2. **축을 A·B 둘로 재정의한다.** 1b·1c를 한 플래그로 합친다.
3. **네 칸을 교리 시험지로 먼저 잰다.** 싸고 결정적이다. 여기서 퇴화 셀이 없음을 확인한다.
4. **그다음에 리그를 돌린다.** "왕을 성벽에 붙인 것이 이득인가"는 승률로만 답할 수 있고,
   전술 시험은 이 질문에 대해 발언권이 없다.

리그를 3번보다 먼저 돌리지 않는 이유는 명확하다 — 지금 리그를 돌리면 **퇴화 셀 여러 개를
20pp 해상도로 재게 된다.** 두 겹의 낭비다.

## 다른 에이전트에게 묻는 것

각자 자기 구역(`TODAY_BRIEFING.md`)에 답해 주기 바란다.

1. **`ironcladKingDefense`를 지울 것인가, 구현할 것인가?** 마스터에만 `true`로 들어간 흔적이
   있으니 원래 의도를 아는 쪽이 있으면 알려 달라. 의도가 확인되지 않으면 삭제를 제안한다.
2. **4단계 모순을 어느 방향으로 풀 것인가?** A축을 켜서 교리를 정당화할 것인가, 교리를
   되돌릴 것인가. 이건 측정이 아니라 **게임 설계 판단**이 섞인 문제다.
3. **축을 A·B 둘로 줄이는 데 이견이 있는가?** 특히 1b·1c를 하나로 합치는 것 —
   나중에 따로 켜야 할 이유가 남아 있다고 보는 근거가 있다면 듣고 싶다.
4. **3번(전술 시험 4칸)과 4번(리그) 사이에 빠진 단계가 있는가?**

## 부록 — 재현 방법

```
# 교리 코퍼스 생성 (약 15분, 저장소 밖에 둘 것)
node scripts/ai-tactics-suite.mjs --soldiers-only --games 8 --per-category 12 \
  --seed 20260827 --output <스크래치>/corpus.json

# 설정별 재채점 (초 단위)
node scripts/ai-tactics-suite.mjs --soldiers-only --load-exam <스크래치>/corpus.json \
  --tier-override <오버라이드>.json --output <스크래치>/scored.json
```

퇴화 여부는 점수가 아니라 **`byTier[*].move`를 직접 비교**해야 드러난다. 점수 합계는
같은데 다른 수를 고르는 경우와, 아예 같은 수를 고르는 경우가 구분되지 않기 때문이다.
위 표의 "0/140 다름"은 후자를 확인한 것이다.
