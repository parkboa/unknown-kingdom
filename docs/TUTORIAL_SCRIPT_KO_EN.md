# 튜토리얼 한국어·영어 스크립트

기준일: 2026-09-05 · 현재 로컬 소스 기준

승인된 영어 수정안과 통합된 도입 3페이지를 반영한 앱 원문입니다. 도입은 환영 → 승리 조건 → 선후공 순서이며, 기존 키 tutorialIntroPage4가 마지막 페이지입니다. 진행 순서는 `app.js`의 실제 튜토리얼 단계와 화면 분기를 기준으로 정리했습니다. 각 항목의 키는 코드에서 해당 문구를 찾을 때 사용합니다. 특수 유닛의 포위 안내는 세 단계에서 반복되며, 짧은 캐릭터 대사도 함께 수록했습니다.

출처: `js/config.js`(한영 원문), `app.js`(진행 순서), `js/render.js`(캐릭터 대사).

## 1. 도입 대사

### tutorialGuideName

**한국어**

이대국

**English**

Daeguk Lee

### tutorialIntroPage1

**한국어**

대국의 세계에 오신 것을 환영합니다! 대국 게임을 안내해 드리겠습니다.

**English**

Welcome to the world of Daeguk! I will guide you through the game.

### tutorialIntroPage2

**한국어**

이 대국은 상대 왕을 잡으면 즉시 승리합니다. 왕을 잡지 못한 채 승부가 끝나면 더 많은 영토를 가진 쪽이 승리합니다.

**English**

Capture the enemy King for an instant win. Otherwise, the side with more territory wins when the match ends.

### tutorialIntroPage4

**한국어**

흑돌이 선공하고 백돌이 후공하여 대국을 시작합니다.

**English**

Black plays first, followed by White.

### tutorialIntroPrompt

**한국어**

시작하기를 누르세요.

**English**

Press Start to begin.

## 2. 왕 배치와 성역

### tutorialKing

**한국어**

먼저 왕을 배치하세요.

**English**

First, place your King.

### tutorialKingPlaced

**한국어**

왕이 배치되면 왕을 둘러싼 성역이 나타납니다. 왕과 주변 8칸이 성역입니다.

**English**

Once the King is placed, a sanctuary appears around it. The King and the eight surrounding squares form the sanctuary.

### tutorialSanctuaryDuration

**한국어**

자신의 돌을 네 개 더 놓을 때까지 상대는 성역 안에 배치할 수 없습니다.

**English**

Your opponent cannot place a unit inside the sanctuary until you place four more units.

## 3. 병사 포획

### tutorialCapture

**한국어**

돌은 상하좌우의 활로가 모두 막히면 포획됩니다. 표시된 칸에 백 병사를 놓아 흑 병사를 잡으세요.

**English**

A Soldier is captured when its group has no liberties left. Place a White Soldier on the highlighted square to capture the Black Soldier.

### tutorialCapturePlaced

**한국어**

흑 병사가 포획되었습니다.

**English**

The Black Soldier was captured.

## 4. 자기 성벽

### tutorialWallDefense

**한국어**

자기 성벽에 닿은 돌은 성벽 쪽에 활로 하나를 얻습니다. 표시된 칸에 병사를 놓아보세요.

**English**

A unit touching its own fortress wall gains one liberty from that wall. Place a Soldier on the highlighted square.

### tutorialWallDefensePlaced

**한국어**

흑 병사는 흑의 성벽에서 활로를 얻어 포획되지 않았습니다.

**English**

The Black Soldier gained a liberty from its own fortress wall and was not captured.

## 5. 상대 성벽

### tutorialWallCapture

**한국어**

상대 성벽에 닿은 돌은 어떻게 될까요? 표시된 칸에 병사를 놓아보세요.

**English**

What happens when a unit touches the opponent's fortress wall? Place a Soldier on the highlighted square.

### tutorialWallCapturePlaced

**한국어**

흑 병사는 백의 성벽에 막혀 포획되었습니다.

**English**

The Black Soldier was blocked by White's fortress wall and was captured.

## 6. 특수 유닛 소개

### tutorialSpecialIntro

**한국어**

특수 유닛을 배워 봅시다. 대국 시작 후 자신의 돌을 다섯 번 놓은 후부터 특수 유닛을 사용할 수 있습니다.

**English**

Let's learn about special units. They become available after you place five units.

## 7. 장군

### tutorialGeneral

**한국어**

특수 유닛은 완전히 포위될 때 능력을 발동합니다. 장군 돌을 선택하고 표시된 칸에 장군을 놓아보세요.

**English**

Special units activate their abilities when fully surrounded. Select the General and place it on the highlighted square.

### tutorialBlackPreparing

**한국어**

흑이 마지막 포위 병사를 놓고 있습니다…

**English**

Black is placing the final surrounding Soldier…

### tutorialSurroundComplete

**한국어**

특수 유닛이 완전히 포위되었습니다. 능력을 발동합니다…

**English**

The unit is fully surrounded. Its special ability is activating…

### generalTauntBubble

**한국어**

감히 나를 막아

**English**

How dare you block me

### tutorialGeneralPlaced

**한국어**

장군이 인접한 적을 모두 제거하였습니다.

**English**

The General eliminated all adjacent enemies.

## 8. 외교관

### tutorialDiplomat

**한국어**

외교관 돌을 선택하고 표시된 칸에 외교관을 놓아보세요.

**English**

Select the Diplomat and place it on the highlighted square.

### tutorialBlackPreparing

**한국어**

흑이 마지막 포위 병사를 놓고 있습니다…

**English**

Black is placing the final surrounding Soldier…

### tutorialSurroundComplete

**한국어**

특수 유닛이 완전히 포위되었습니다. 능력을 발동합니다…

**English**

The unit is fully surrounded. Its special ability is activating…

### diplomatTauntBubble

**한국어**

얼마면 돼

**English**

Name your price

### tutorialDiplomatPlaced

**한국어**

외교관이 인접한 적을 모두 아군으로 바꾸었습니다.

**English**

The Diplomat converted all adjacent enemies to your side.

## 9. 마법사와 순간이동

### tutorialWizard

**한국어**

마법사 돌을 선택하고 표시된 칸에 마법사를 놓아보세요.

**English**

Select the Wizard and place it on the highlighted square.

### tutorialBlackPreparing

**한국어**

흑이 마지막 포위 병사를 놓고 있습니다…

**English**

Black is placing the final surrounding Soldier…

### tutorialSurroundComplete

**한국어**

특수 유닛이 완전히 포위되었습니다. 능력을 발동합니다…

**English**

The unit is fully surrounded. Its special ability is activating…

### wizardTauntBubble

**한국어**

아브라카다브라

**English**

Abracadabra

### tutorialWizardTeleport

**한국어**

마법사가 인접한 적을 모두 제거하였습니다. 마법사는 능력이 발동한 후 즉시 한 번 순간이동할 수 있습니다. 표시된 빈칸으로 이동하세요.

**English**

The Wizard eliminated all adjacent enemies and can now teleport once. Teleport to the highlighted empty square.

## 10. 완료 및 AI 대전 안내

### tutorialWizardPlaced

**한국어**

튜토리얼 완료! 흑 왕을 포획하여 승리했습니다. 왕 배치, 포획, 성벽과 세 특수 유닛의 능력을 익혔습니다.

**English**

Tutorial complete! You captured the Black King. You learned King placement, capture, fortress walls, and all three special abilities.

### tutorialAiChallengePrompt

**한국어**

이제 AI 대전에서 삼류 고수에 도전해 보세요.

**English**

Now challenge the Third-Rate Master in an AI match.

## 11. 버튼 및 공통 표시

### tutorial

**한국어**

튜토리얼

**English**

Tutorial

### tutorialDescription

**한국어**

왕 배치, 포획, 성벽과 특수 능력을 단계별로 연습하세요.

**English**

Practice King placement, capture, fortress walls, and special abilities step by step.

### startTutorialAction

**한국어**

시작하기

**English**

Start

### exitTutorialAction

**한국어**

나가기

**English**

Exit

### exitTutorial

**한국어**

종료

**English**

Exit

### nextTutorial

**한국어**

다음

**English**

Next

### dialogueNext

**한국어**

다음

**English**

Next

### dialoguePrev

**한국어**

이전

**English**

Back

### soldier

**한국어**

병사

**English**

Soldier

### king

**한국어**

왕

**English**

King

### general

**한국어**

장군

**English**

General

### diplomat

**한국어**

외교관

**English**

Diplomat

### wizard

**한국어**

마법사

**English**

Wizard

## 부록. 별도 보관 문구

아래는 번역 사전에 남아 있는 추가 튜토리얼 문구입니다. 위의 직접 진입 튜토리얼 진행 대사와 구분해 검토하세요. `tutorialIntroDialogue`는 도입 첫 페이지와 같은 대체 문구이며, Ready 문구와 단계 표시는 현재 본문 진행에서 사용하지 않습니다. `tutorialPuzzleSolvedReason`은 챌린지 완료 처리용 문구입니다.

### tutorialStep

**한국어**

{current} / {total} 단계

**English**

Step {current} / {total}

### tutorialGeneralReady

**한국어**

장군을 배치했습니다. 다음을 누르세요.

**English**

General placed. Press Next.

### tutorialDiplomatReady

**한국어**

외교관을 배치했습니다. 다음을 누르세요.

**English**

Diplomat placed. Press Next.

### tutorialWizardReady

**한국어**

마법사를 배치했습니다. 다음을 누르세요.

**English**

Wizard placed. Press Next.

### tutorialIntroDialogue

**한국어**

대국의 세계에 오신 것을 환영합니다! 대국 게임을 안내해 드리겠습니다.

**English**

Welcome to the world of Daeguk! I will guide you through the game.

### tutorialPuzzleSolvedReason

**한국어**

기본 수련을 완료했습니다. 다음 퍼즐로 이동하세요.

**English**

Basic training complete. Continue to the next puzzle.
