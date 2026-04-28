# Onboarding Note

Start with these files in this order:

1. `src/types.ts`
2. `src/Game.ts`
3. `src/ReelEngine.ts`
4. `src/MockSpinService.ts`
5. `public/config/gameConfig.json`

## What A New Team Member Should Understand First

The project has three important rules:

- `Game.ts` coordinates systems, it should not become the place where all gameplay logic lives.
- `ReelEngine.ts` is only responsible for visual reel motion and symbol display.
- `MockSpinService.ts` is the source of truth for what a spin result contains.

## Area A Junior Could Break Easily

The easiest place to break the project is the relationship between config, reel strips, and visible reel count.

For example:

- changing `reels` without updating `reelStrips`
- adding a symbol to `symbols` but forgetting to use the same label in strips
- returning invalid symbol indexes from the mock spin service

## How The Current Code Protects Against That

- `ReelEngine` throws if a strip is missing for a reel.
- `MockSpinService` throws if a strip contains a symbol not declared in `symbols`.
- shared result types are centralized in `game.ts`.

## Unintuitive Decision

Free spins are handled the same way as base game spins by extending the same flow with some minor changes. The freespins doesnt have a separate state which should be needed in most cases for many decisive checks.
This can look strange but its clearly written in taks that the freespins should be extended using base spins flow.so, because of it, no changes where done specially for free game.

