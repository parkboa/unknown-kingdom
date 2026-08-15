# Unknown Kingdom: Shadow Realm 프로토타입

`Unknown Kingdom: Shadow Realm`의 MVP 규칙을 검증하기 위한 정적 로컬 프로토타입입니다.

## 구조

- `app.js`: 게임 진행 제어, 포획 규칙, 특수 유닛 반응
- `js/config.js`: 상수, 레이블, 현지화된 텍스트
- `js/state.js`: 초기 상태 및 말 생성
- `js/board.js`: 보드 좌표 도우미
- `js/ai.js`: PvE 수 선택
- `js/network.js`: WebSocket 연결 수명 주기
- `js/protocol.js`: WebSocket 메시지 및 서버 상태 검증
- `js/render.js`: 보드 및 인터페이스 렌더링
- `js/i18n.js`: 번역 도우미

## 실행

```bash
python3 -m http.server 4173 --directory outputs/unknown-kingdom-prototype
```

다음 주소를 엽니다.

```text
http://127.0.0.1:4173/
```

## 구현된 기능

- 9×9 게임 보드
- 기본 PvE 모드 및 네트워크 전용 PvP 모드
- 온라인 봇 방에서는 네트워크 테스트를 위해 권한을 가진 WebSocket 서버를 통해 AI 실행
- PvE에서는 아래쪽의 백색 진영을 인간 플레이어가, 위쪽의 흑색 진영을 AI 상대가 담당
- 번갈아 진행하는 배치 턴
- 비어 있는 어느 칸에나 자유롭게 배치 가능
- 포획 또는 특수 반응으로 배치한 유닛이 생존하는 경우를 제외하고 자살 배치 금지
- 양측 모두 첫 번째 수로 왕을 배치해야 함
- 왕은 경기 내내 공개된 상태로 유지
- 자신의 주요 유닛에는 머리글자가 표시되며, 상대의 숨겨진 유닛은 병사와 동일하게 보임
- 상대 특수 유닛의 정체는 능력이 발동되는 순간과 로그에서만 공개
- 발동한 특수 유닛은 원래 머리글자 및 사용 완료 표시와 함께 보드에서 계속 식별 가능
- 온라인 PvP는 비공개 방 생성 및 참가 방식을 사용하며, 로컬 2인 플레이로 대체되지 않음
- 집단 포획: 포위된 집단은 포획한 플레이어의 병사 영역이 됨
- 요새 벽은 해당 보드 가장자리에서 같은 색의 병사처럼 계산
- 벽 연결은 별도의 무적 효과가 아니라 일반적인 활로 및 포획 계산에 포함
- 장군, 외교관, 마법사의 일회성 능력
- 특수 능력은 수동으로 발동할 수 없으며, 해당 유닛이 속한 집단이 완전히 포위되었을 때만 발동
- 포획 반응을 포함하여 마법사의 순간이동 목적지는 플레이어가 선택
- 마법사가 왕을 공격하면, 왕의 탈출을 먼저 처리한 뒤 마법사의 순간이동 목적지를 선택
- 왕은 처음 공격받았을 때 아군 병사와 위치를 바꾸거나 3칸 이내의 빈칸으로 이동하여 탈출
- PvE AI는 왕이 처음 공격받았을 때 위치를 바꿀 병사 또는 인접한 빈 탈출 칸을 자동으로 선택
- PvE AI는 가중치가 적용된 유닛 선택과 함께 균형형, 공격형, 방어형 배치 행동을 무작위로 사용
- 왕의 목숨은 하나이며, 처음 포획되는 즉시 경기가 종료
- 왕을 자신의 요새 벽에 붙여 배치하면 상대에게 한 번의 도발 기회가 주어지며, 1초 동안 말풍선으로 표시
- 외교관이 왕을 전향시켜도 경기가 즉시 종료
- 왕 사망 및 유닛 전멸 승리 조건
- 보드가 가득 찬 상태에서 동점이면 무승부 처리
- 합법적으로 배치할 수 없는 플레이어는 자동으로 턴을 넘기며, 양측 모두 배치할 수 없으면 영역으로 승패 결정
- 승리 사유, 영역, 포획 수, 스킬 사용 현황 및 다시 하기를 포함한 경기 결과 팝업
- 완료된 수를 최대 200개까지 되돌리는 기록. PvE에서는 플레이어의 수와 AI 응답 이전 상태로 복원

## 온라인 PvP 서버 계약

브라우저는 `/ws`의 WebSocket 엔드포인트에 연결합니다. 게임 서버는 권한을 가진 서버여야 하며, 공개되지 않은 적 유닛의 정체를 제외하도록 정제된 상태를 각 플레이어에게 전송해야 합니다.

별도로 호스팅된 서버를 사용하려면 클라이언트를 처음 한 번 다음 쿼리와 함께 엽니다.

```text
?server=wss://your-server.example.com/ws
```

선택한 서버 URL은 이후 경기를 위해 브라우저에 저장됩니다.

클라이언트 메시지:

```json
{ "type": "create_room", "protocolVersion": 2 }
{ "type": "join_room", "roomCode": "ABC123", "protocolVersion": 2 }
{ "type": "choose_side", "roomCode": "ABC123", "side": "blue" }
{ "type": "action", "roomCode": "ABC123", "action": { "type": "deploy", "unitType": "soldier", "row": 4, "col": 4 } }
{ "type": "action", "roomCode": "ABC123", "action": { "type": "taunt" } }
{ "type": "action", "roomCode": "ABC123", "action": { "type": "wizard_teleport", "row": 2, "col": 5 } }
{ "type": "action", "roomCode": "ABC123", "action": { "type": "rematch" } }
```

서버가 제어하는 흑색 봇을 상대로 백색 진영에서 온라인 경기를 시작하려면 `{ "type": "create_bot_room" }`을 사용합니다.

서버 메시지:

```json
{ "type": "room_created", "roomCode": "ABC123" }
{ "type": "waiting", "roomCode": "ABC123" }
{ "type": "side_selection", "roomCode": "ABC123" }
{ "type": "match_start", "roomCode": "ABC123", "player": "blue", "state": {} }
{ "type": "state", "roomCode": "ABC123", "player": "blue", "state": {} }
{ "type": "error", "message": "Invalid room code." }
```

두 플레이어가 모두 참가하면 서버는 `side_selection`을 전송합니다. 먼저 유효한 `choose_side` 명령을 보낸 플레이어가 해당 진영을 선택하며, 상대에게는 다른 진영이 자동으로 배정됩니다. 서버는 합법적인 수의 검증, 포획, 특수 반응, 숨겨진 정보, 턴 순서, 재연결 및 승리 결과를 담당합니다.
