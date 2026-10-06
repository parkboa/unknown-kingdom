# DAEGUK screenshot retakes — 2026-10-02

Status: nine Korean and sixteen English original captures received in sibling locale folders
and visually reviewed. Five candidates per locale are exported below. Korean 5/10 screenshots
are registered in App Store Connect's iPhone 6.9-inch slot and persisted after reload in the
documented order. English 5/10 screenshots are also registered and persisted after reload
and reselecting English (U.S.), following explicit user authorization.
The existing September 21 sets and all new originals are preserved.

The user chose to stage and capture the scenes manually after Xcode 27 Device Hub repeatedly
timed out in the native UI automation tool.

## Requested scenes

1. A developed midgame with both armies, Kings and surrounding formations clearly visible.
2. Wizard teleport destination selection, with the legal destinations highlighted.
3. General ability target selection, with the threatened enemy piece visible.

Use `ko/` for Korean and `en/` for English captures. Suggested names:
`01-midgame.png`, `02-wizard.png`, `03-general.png` (JPEG is also acceptable).

Use the Simulator's original screenshot capture, not a screenshot of the Mac window.
The intended device is iPhone 17 Pro Max with portrait `1320×2868` output. Validate actual size,
color mode, alpha, safe areas and absence of personal/online identifiers before selecting the files.
Game UI must be real; do not paint new pieces, controls or effects into the source images.

## Recommended Korean candidates

| Order / export | Original in `../ko/` | Scene |
| --- | --- | --- |
| `ko/01-general-black.png` | `sc_unknown_261002_202844.png` | Black General ability during a developed AI match |
| `ko/02-wizard-white.png` | `sc_unknown_261002_202810.png` | White Wizard ability during an AI match |
| `ko/03-wizard-teleport.png` | `sc_unknown_261002_202550.png` | Tutorial teleport destination selection |
| `ko/04-diplomat.png` | `sc_unknown_261002_202524.png` | Tutorial Diplomat ability |
| `ko/05-general-white.png` | `sc_unknown_261002_202506.png` | Tutorial White General ability |

All nine originals are 1320×2868 RGBA with fully opaque alpha. The five exports are lossless
RGB PNGs without an alpha channel; reopened files match every original RGB pixel and size.
No board, text, effects or artwork were changed. Visual review found no account identifiers.
The Wizard match capture includes the device's Dynamic Island; it remains as captured.

The victory captures ending `202706` and `202915` contain fading character/effect overlays
and are excluded from the recommended set. AI setup `202733` and early game `202748` are
clear but less visually compelling. Existing local locale screenshot sets have not been overwritten.

## Recommended English candidates

| Order / export | Original in `../en/` | Scene |
| --- | --- | --- |
| `en/01-wizard-white.png` | `sc_unknown_261002_230905.png` | White Wizard ability in AI match |
| `en/02-midgame.png` | `sc_unknown_261002_231158.png` | Developed AI match with Kings and armies visible |
| `en/03-wizard-teleport.png` | `sc_unknown_261002_232005.png` | Tutorial teleport destination selection |
| `en/04-diplomat.png` | `sc_unknown_261002_231950.png` | Tutorial Diplomat ability |
| `en/05-kings.png` | `sc_unknown_261002_231413.png` | Two Kings with victory rule explanation |

All sixteen originals are 1320×2868 RGBA with fully opaque alpha. The five selected English
exports were reopened and verified as RGB PNGs matching every original RGB pixel and size.
Full-size visual review found no clipping, debug text or account identifiers. No image content
was edited. Settings/early-game shots and less expressive tutorial frames are not selected.
The user explicitly approved uploading these five English candidates to English (U.S.) on
App Store Connect on 2026-10-02.

## App build

Game web assets remain identical to `c3f49ea`. Native settings now require iOS 15 for Xcode 27.
Local `1.0.1 (2)` Release Simulator build and signed Archive passed. The exact build used for
the user's manual captures has not been independently verified from screenshot metadata.
