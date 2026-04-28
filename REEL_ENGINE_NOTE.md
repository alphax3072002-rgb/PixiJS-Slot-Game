# Reel Engine Extending.

- `ReelEngine.ts` for visual motion or sprite reuse
- `MockSpinService.ts` for result data
- `Game.ts` for orchestration and state transitions
Do not put server result rules directly into `ReelEngine.ts`. It should only have the important function call which are directly realated to reels and its child elements.

## Try with

- change reel speed values
- add more highlight styles for win and scatter presentations.
- use sprites as symbols following the rule of recyling the sprites rather than removing them.

## NOT DO

- creating new sprites during every spin
- changing reel count logic in code instead of reading config
- skipping `SpinResult` types and passing loose objects around
- making state changes directly from reel code without going through events


