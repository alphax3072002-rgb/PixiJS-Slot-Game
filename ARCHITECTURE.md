This is a PixiJS v7 slot game with variable reels according to the gameconfig.

## Main Decisions
The game reads one JSON file from `public/config/gameConfig.json`. and this config controls the game important details like 
- reel count
- symbol list
- reel strips
- free spin tigger count
- bet options
- default bet
- starting balance
- reel layout values

the reels can be changed from 3 - 5. the no of rows can also be changed but the reelview will need some adjustment with code.
There are 5 states currently in the game . `IDLE , SPINNING , RESULT , WIN_PRESENTATION , TRANSITION`
`IDLE -> SPINNING -> RESULT -> WIN_PRESENTATION -> IDLE` -> this is the working flow. The `TRANSITION` state is used in the start and end of freegame to show the no of spins awarderd and total win amount in freegame.

Transitions are triggered by events on `EventBus`, not by one state directly calling another state.  

Free spins extend the core flow. Its not considered as a new state . its just the same base game spins without bet deduction. 
The mock spin result updates `freeSpinsRemaining`, and the `IDLE` state listens for whether an auto-spin should be requested.
That means the same reel engine and same state sequence are reused for both normal spins and free spins.

`ReelEngine` creates a fixed set of sprites per reel and recycles them while spinning.
It does not create new symbol display objects every spin.  Movement is updated from `app.ticker` using `delta`, with acceleration, deceleration, and a final snap to the mocked result. we can adjust the spin values from the config to make the reelspine transition as u like.

No external symbol art is used but it can also be loaded. just use the assetloader and use that particular name to load it a sprite.  Currently, the symbols are created by graphics and text combined into a render texuture.

`MockSpinService` returns a typed `SpinResult` and `WinLine[]`.

The reel result is generated locally, but the rest of the game treats it like a server payload:
- visible reel symbols
- win lines
- total win
- balance after spin
- optional free spin award
- optional remaining free spins

## Tradeoffs

- Win evaluation is intentionally simple: only straight horizontal lines are checked.
- Free spins are auto-played immediately to keep the flow small and easy to follow.
- Reels spinning flow can be adjusted according to user need.


##  Improvements With More Time

- add  different sets of paylines rather than using the only straight line logic.
- add resize logic for more polished mobile behavior
- make use of spine libraries to make the game filled with smooth animations.
- try to add some gsap animations.
- make the response come from a actual node js backend with proper database implementation (Important)

# Self Critique

The part I am least satisfied with is the payout model inside `MockSpinService.ts`.
It works and it is fully typed, but it is still a simplified version of what a production slot backend would provide.
 limitations:
- only straight horizontal win lines are implemented
- payout values are generated from a simple ( bet x count of symbols ) rule
- scatter triggering is intentionally basic
The main reason i kept this like is because :

- the simple logic keeps the code easy to evaluate and progress further by adding some improvements to existing pay logic,
- it leaves a clear seam where a real server response can replace the mock later