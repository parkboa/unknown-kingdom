#!/usr/bin/env python3
"""Small OpenSpiel model used to cross-check hidden-tactical contracts."""

import json
import sys

import numpy as np
import pyspiel
from open_spiel.python.algorithms import ismcts, mcts


RISKY = 0
SAFE = 1
SCOUT = 2
HIDDEN = ("soldier", "general", "wizard")
HIDDEN_PROBABILITIES = (0.4, 0.3, 0.3)

GAME_TYPE = pyspiel.GameType(
    short_name="daeguk_hidden_tactical_probe",
    long_name="Daeguk hidden-special tactical probe",
    dynamics=pyspiel.GameType.Dynamics.SEQUENTIAL,
    chance_mode=pyspiel.GameType.ChanceMode.EXPLICIT_STOCHASTIC,
    information=pyspiel.GameType.Information.IMPERFECT_INFORMATION,
    utility=pyspiel.GameType.Utility.ZERO_SUM,
    reward_model=pyspiel.GameType.RewardModel.TERMINAL,
    max_num_players=2,
    min_num_players=2,
    provides_information_state_string=True,
    provides_information_state_tensor=False,
    provides_observation_string=True,
    provides_observation_tensor=False,
)
GAME_INFO = pyspiel.GameInfo(
    num_distinct_actions=3,
    max_chance_outcomes=3,
    num_players=2,
    min_utility=-1.0,
    max_utility=1.0,
    utility_sum=0.0,
    max_game_length=2,
)


class TacticalObserver:
  def __init__(self):
    self.tensor = np.array([], dtype=np.float32)
    self.dict = {}

  def set_from(self, state, player):
    del state, player

  def string_from(self, state, player):
    own_actions = ",".join(str(action) for action in state.actions if player == 0)
    return f"p{player}|observed:enemy-stone|own-actions:{own_actions}"


class TacticalGame(pyspiel.Game):
  def __init__(self, params=None):
    super().__init__(GAME_TYPE, GAME_INFO, params or {})

  def new_initial_state(self):
    return TacticalState(self)

  def make_py_observer(self, iig_obs_type=None, params=None):
    del iig_obs_type, params
    return TacticalObserver()


class TacticalState(pyspiel.State):
  def __init__(self, game):
    super().__init__(game)
    self.hidden = None
    self.actions = []
    self.payoff = None

  def current_player(self):
    if self.is_terminal():
      return pyspiel.PlayerId.TERMINAL
    return pyspiel.PlayerId.CHANCE if self.hidden is None else 0

  def _legal_actions(self, player):
    assert player == 0
    actions = [RISKY, SAFE]
    if self.hidden != "wizard":
      actions.append(SCOUT)
    return actions

  def chance_outcomes(self):
    return list(enumerate(HIDDEN_PROBABILITIES))

  def _apply_action(self, action):
    if self.is_chance_node():
      self.hidden = HIDDEN[action]
      return
    self.actions.append(action)
    if action == RISKY:
      self.payoff = 1.0 if self.hidden == "soldier" else -1.0
    elif action == SAFE:
      self.payoff = 0.4
    else:
      self.payoff = -0.2

  def _action_to_string(self, player, action):
    del player
    return ("risky", "safe", "scout")[action]

  def is_terminal(self):
    return self.payoff is not None

  def returns(self):
    if not self.is_terminal():
      return [0.0, 0.0]
    return [self.payoff, -self.payoff]

  def __str__(self):
    return f"hidden={self.hidden},actions={self.actions}"


def main():
  game = TacticalGame()
  root = game.new_initial_state()
  root.apply_action(0)  # The actual root world is a hidden soldier.
  hidden_states = []
  information_keys = []
  legal_sets = []
  for hidden_index in range(len(HIDDEN)):
    state = game.new_initial_state()
    state.apply_action(hidden_index)
    hidden_states.append(state)
    information_keys.append(state.information_state_string(0))
    legal_sets.append(list(state.legal_actions()))

  sampler_random = np.random.RandomState(20260824)
  availability = {str(action): 0 for action in (RISKY, SAFE, SCOUT)}

  def resampler(_, player):
    assert player == 0
    hidden_index = sampler_random.choice(len(HIDDEN), p=HIDDEN_PROBABILITIES)
    sampled = game.new_initial_state()
    sampled.apply_action(int(hidden_index))
    for action in sampled.legal_actions():
      availability[str(action)] += 1
    return sampled

  search_random = np.random.RandomState(20260824)
  evaluator = mcts.RandomRolloutEvaluator(1, search_random)
  bot = ismcts.ISMCTSBot(
      game,
      evaluator,
      uct_c=np.sqrt(2),
      max_simulations=600,
      random_state=search_random,
      final_policy_type=ismcts.ISMCTSFinalPolicyType.MAX_VALUE,
      allow_inconsistent_action_sets=True,
  )
  bot.set_resampler(resampler)
  policy = bot.get_policy(root)
  selected = max(policy, key=lambda item: item[1])[0]
  child_values = {
      str(action): {
          "visits": int(child.visits),
          "meanValue": child.value(),
      }
      for action, child in bot._root_node.child_info.items()  # pylint: disable=protected-access
  }

  result = {
      "schemaVersion": 1,
      "openSpielVersion": "2.0.2",
      "informationStateKeys": information_keys,
      "sameInformationState": len(set(information_keys)) == 1,
      "legalActionSets": legal_sets,
      "variableActionSets": len({tuple(actions) for actions in legal_sets}) > 1,
      "availability": availability,
      "childValues": child_values,
      "policy": [[int(action), float(probability)] for action, probability in policy],
      "selectedAction": int(selected),
      "selectedActionName": ("risky", "safe", "scout")[selected],
  }
  if not result["sameInformationState"]:
    raise AssertionError("Hidden worlds did not share an OpenSpiel information state")
  if not result["variableActionSets"]:
    raise AssertionError("Tactical probe did not exercise inconsistent action sets")
  if selected != SAFE:
    raise AssertionError(f"OpenSpiel selected {result['selectedActionName']} instead of safe")
  json.dump(result, sys.stdout, indent=2)
  sys.stdout.write("\n")


if __name__ == "__main__":
  main()
