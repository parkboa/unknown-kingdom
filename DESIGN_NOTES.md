# Unknown Kingdom: Shadow Realm — Design Notes

## Visual Direction

- Keep the current top-view prototype until the rules and interactions are stable.
- The final game should use a 2.5D or 3D bird's-eye view.
- The human player's fortress should always appear at the bottom of the screen.
- In PvE, the human player is Blue and the AI is Red.
- Preserve the logical 9x9 grid and input coordinates when changing the camera presentation.

## Board and Fortress

- Build the fortress walls as visible architectural structures rather than flat colored bars.
- Walls act as same-color allied units in capture and connection calculations.
- Do not show wall-connected groups as invincible or protected with a permanent white outline.
- Consider a subtle connection effect when a unit touches or completes a chain to its wall.
- A connection effect should communicate attachment, not immunity.

## Units

- Replace prototype spheres with distinguishable unit characters or pieces.
- King, General, Wizard, and Diplomat need immediately recognizable silhouettes.
- Kings remain publicly visible throughout the match.
- Hidden enemy special units should look identical to ordinary Soldiers before activation.
- Own special units should remain identifiable.
- Use initials during the prototype phase:
  - `K` — King
  - `G` — General
  - `W` — Wizard
  - `D` — Diplomat

## Special Ability Reveal

- Reveal an enemy special unit when its ability activates.
- Use a strong activation animation that clearly identifies the unit type.
- After activation, keep its identity visible on the board.
- Clearly mark the ability as spent with reduced saturation, a check mark, broken emblem, or similar used-state treatment.
- Do not allow an activated unit to become visually indistinguishable from unused hidden units.

## Capture and Removal Feedback

- Make the exact captured or removed cells easy to identify.
- Briefly highlight affected units before changing or removing them.
- Use different effects for:
  - Territory capture and color conversion
  - General or Wizard removal
  - Diplomat conversion
  - King attack and escape
- Territory capture should visually show ownership flowing into the captured spaces.
- Avoid instantaneous changes that make players unsure which move caused the result.

## King Escape

- On the King's first attack, highlight both valid escape types:
  - Any friendly Soldier available for a swap
  - Any empty cell within three orthogonal spaces
- Visually distinguish swap targets from empty escape targets.
- Animate the King and Soldier crossing positions during a swap.
- For an empty-cell escape, use a short movement or teleport trail.
- A second King attack should use a decisive defeat animation.

## Wizard Sequence

- If a Wizard attacks a King, resolve the King's escape first.
- After the King finishes moving, highlight the Wizard's teleport destinations.
- Use separate visual phases so players do not confuse the King's movement with the Wizard's movement.

## Turn and Hidden Information

- Make the active team clearly visible without relying only on text.
- In PvE, never reveal the AI's hidden special unit through labels, logs, outlines, or selection details before activation.
- Public information such as the King and activated special units should remain consistently visible.
- Show unavailable or already deployed units clearly in the deploy controls.

## Match Result

- Display a result popup when the match ends.
- Include:
  - Winner
  - Victory reason
  - Final Red and Blue territory
  - Captures by each side
  - Special abilities used
  - Play Again button
- Victory reasons should distinguish King defeat, unit elimination, and territory scoring.

## Animation Priorities

1. Capture and removal location feedback
2. Special ability activation and reveal
3. King escape and Soldier swap
4. Wall connection feedback
5. Match result presentation
6. Full bird's-eye camera and 3D environment

## Deferred Until Final Design

- Character models and detailed unit illustrations
- Final fortress architecture
- Particle effects, lighting, and sound
- Camera movement and bird's-eye perspective
- High-detail capture and destruction animations
- Mobile-specific layout and interaction polish
