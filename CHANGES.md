# Changes Made

## Gameplay

- Replaced the placeholder reel grid with a working reel engine.
- Added spin, deceleration, and snap-stop behavior.
- Reused symbol sprites while spinning instead of creating new display objects each spin.
- Added a typed local mock spin service that returns reel results, win lines, total win, balance updates, and free-spin data.
- Added win-line highlighting and a simple win banner.

## State Flow

- Reworked the game flow into `IDLE -> SPINNING -> RESULT -> WIN_PRESENTATION -> IDLE`.
- Made transitions event-driven through `EventBus`.
- Added free spins on top of the same core flow instead of introducing a separate custom spin path.

## Config And Rendering

- Updated the config file to match the assignment structure.
- Made reel count, rows, strips, bets, free spins, and layout config-driven.
- Added symbol generation through `PIXI.Graphics + PIXI.Text + RenderTexture`.
- Added a simple HUD for balance, bet, win, feature state, and spin control.
- Switched the project styling to a simple slot-game presentation instead of the starter template screen.

## Docs

- Added `ARCHITECTURE.md`
- Added `ONBOARDING.md`
- Added `REEL_ENGINE_NOTE.md`
- Added `SELF_CRITIQUE.md`

