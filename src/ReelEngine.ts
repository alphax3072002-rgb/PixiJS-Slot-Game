import * as PIXI from "pixi.js";

type SpinResult = {
  reels: number[][];
  totalWin: number;
  balanceAfter: number;
  freeSpinsAwarded?: number;
  freeSpinsRemaining?: number;
  winLines: {
    lineIndex: number;
    count: number;
  }[];
};

type ReelEngineCallbacks = {
  onSpinComplete: (result: SpinResult) => void;
};

type ReelSpriteState = {
  sprite: PIXI.Sprite;
  logicalRow: number;
};

type ReelState = {
  index: number;
  container: PIXI.Container;
  mask: PIXI.Graphics;
  sprites: ReelSpriteState[];
  strip: string[];
  stripIndex: number;
  speed: number;
  offset: number;
  elapsed: number;
  stopDelay: number;
  isStopping: boolean;
  isStopped: boolean;
  targetSymbols: string[];
};

export class ReelEngine {
  container = new PIXI.Container();

  reels: ReelState[] = [];
  highlightOverlays: PIXI.Graphics[][] = [];
  viewportHeight: number;
  cellWidth: number;
  cellHeight: number;
  reelGap: number;
  rowGap: number;
  config: any;
  getTexture: (symbol: string) => PIXI.Texture;
  callbacks: ReelEngineCallbacks;
  activeResult?: SpinResult;
  isSpinning = false;

  constructor(
    config: any,
    getTexture: (symbol: string) => PIXI.Texture,
    callbacks: ReelEngineCallbacks,
  ) {
    this.config = config;
    this.getTexture = getTexture;
    this.callbacks = callbacks;

    this.container.name = "reelEngine";
    const layout = this.getLayout();
    this.container.position.set(layout.x, layout.y);
    this.viewportHeight =this.config.rows * layout.cellHeight + (this.config.rows - 1) * layout.rowGap;
    this.cellWidth = layout.cellWidth;
    this.cellHeight = layout.cellHeight;
    this.reelGap = layout.reelGap;
    this.rowGap = layout.rowGap;

    this.createFrame();
    this.createReels();
    this.createHighlights();
  }

  startSpin(result: SpinResult): void {
    this.clearHighlights();
    this.activeResult = result;
    this.isSpinning = true;
    const spinConfig = this.getSpinConfig();

    for (let reelIndex = 0; reelIndex < this.reels.length; reelIndex++) {
      const reel = this.reels[reelIndex];
      reel.speed =
        spinConfig.initialSpeed + reelIndex * spinConfig.speedStepPerReel;
      reel.offset = 0;
      reel.elapsed = 0;
      reel.stopDelay =
        spinConfig.stopDelay + reelIndex * spinConfig.stopDelayStepPerReel;
      reel.isStopping = false;
      reel.isStopped = false;
      reel.targetSymbols = result.reels[reelIndex].map(
        (symbolIndex) => this.config.symbols[symbolIndex]!,
      );
    }
  }

  update(delta: number): void {
    if (!this.isSpinning || !this.activeResult) {
      return;
    }

    const dt = delta / 60;
    let stoppedCount = 0;
    const spinConfig = this.getSpinConfig();

    for (const reel of this.reels) {
      if (reel.isStopped) {
        stoppedCount += 1;
        continue;
      }

      reel.elapsed += dt;

      if (reel.elapsed < reel.stopDelay) {
        reel.speed = Math.min(
          reel.speed + spinConfig.acceleration * dt,
          spinConfig.maxSpeed,
        );
      } else {
        reel.isStopping = true;
        reel.speed = Math.max(reel.speed - spinConfig.deceleration * dt, 0);
      }

      reel.offset += reel.speed * dt * spinConfig.movementMultiplier;
      this.recycleSprites(reel);
      this.layoutReelSprites(reel);

      if (reel.isStopping && reel.speed <= spinConfig.snapSpeed) {
        this.snapReelToResult(reel);
        stoppedCount += 1;
      }
    }

    if (stoppedCount === this.reels.length) {
      this.isSpinning = false;
      this.callbacks.onSpinComplete(this.activeResult);
    }
  }

  showWins(result: SpinResult): void {
    this.clearHighlights();

    for (const winLine of result.winLines) {
      for (let reelIndex = 0; reelIndex < winLine.count; reelIndex++) {
        const overlay = this.highlightOverlays[reelIndex]?.[winLine.lineIndex];

        if (!overlay) {
          continue;
        }

        overlay.visible = true;
      }
    }
  }

  clearHighlights(): void {
    for (const reelOverlays of this.highlightOverlays) {
      for (const overlay of reelOverlays) {
        overlay.visible = false;
      }
    }
  }

  createFrame(): void {
    const totalWidth =
      this.config.reels * this.cellWidth + (this.config.reels - 1) * this.reelGap;

    const frame = new PIXI.Graphics();
    frame.name = "reelFrame";
    frame.beginFill(0x0f1726);
    frame.lineStyle(4, 0x315983, 1);
    frame.drawRoundedRect(-16, -16, totalWidth + 32, this.viewportHeight + 32, 28);
    frame.endFill();

    this.container.addChild(frame);
  }

  createReels(): void {
    for (let reelIndex = 0; reelIndex < this.config.reels; reelIndex++) {
      const reelContainer = new PIXI.Container();
      reelContainer.name = `reel${reelIndex + 1}`;
      reelContainer.x = reelIndex * (this.cellWidth + this.reelGap);

      const mask = new PIXI.Graphics();
      mask.name = `mask${reelIndex + 1}`;
      mask.beginFill(0xffffff);
      mask.drawRoundedRect(0, 0, this.cellWidth, this.viewportHeight, 18);
      mask.endFill();

      const reel = this.createReelState(reelContainer, mask, reelIndex);
      reelContainer.mask = mask;

      const reelBg = new PIXI.Graphics();
      reelBg.name = "reelBG";
      reelBg.beginFill(0x132238);
      reelBg.drawRoundedRect(0, 0, this.cellWidth, this.viewportHeight, 18);
      reelBg.endFill();
      reelBg.x = reelContainer.x;

      this.container.addChild(reelBg);
      reelContainer.addChild(mask);
      this.container.addChild(reelContainer);
      this.reels.push(reel);
    }
  }

  createReelState(reelContainer: PIXI.Container,mask: PIXI.Graphics,reelIndex: number): ReelState {
    const strip = this.config.reelStrips[reelIndex];

    if (!strip) {
      throw new Error(`Missing reel strip for reel ${reelIndex}`);
    }

    const sprites: ReelSpriteState[] = [];
    const rowsWithBuffer = this.config.rows + 1;

    for (let row = 0; row < rowsWithBuffer; row++) {
      const symbol = strip[row % strip.length]!;
      const sprite = new PIXI.Sprite(this.getTexture(symbol));
      sprite.name = `symbol${reelIndex + 1}_${row}`;
      sprite.width = this.cellWidth;
      sprite.height = this.cellHeight;
      reelContainer.addChild(sprite);
      sprites.push({ sprite, logicalRow: row - 1 });
    }

    const reel: ReelState = {
      index: reelIndex,
      container: reelContainer,
      mask,
      sprites,
      strip,
      stripIndex: rowsWithBuffer % strip.length,
      speed: 0,
      offset: 0,
      elapsed: 0,
      stopDelay: 0,
      isStopping: false,
      isStopped: true,
      targetSymbols: [],
    };

    this.layoutReelSprites(reel);
    return reel;
  }

  createHighlights(): void {
    for (let reelIndex = 0; reelIndex < this.config.reels; reelIndex++) {
      const reelOverlays: PIXI.Graphics[] = [];

      for (let row = 0; row < this.config.rows; row++) {
        const overlay = new PIXI.Graphics();
        overlay.name = `highlight${reelIndex + 1}_${row + 1}`;
        overlay.beginFill(0xffd166, 0.28);
        overlay.lineStyle(3, 0xffd166, 1);
        overlay.drawRoundedRect(4, 4, this.cellWidth - 8, this.cellHeight - 8, 18);
        overlay.endFill();
        overlay.visible = false;
        overlay.x = reelIndex * (this.cellWidth + this.reelGap);
        overlay.y = row * (this.cellHeight + this.rowGap);
        this.container.addChild(overlay);
        reelOverlays.push(overlay);
      }

      this.highlightOverlays.push(reelOverlays);
    }
  }

  recycleSprites(reel: ReelState): void {
    const step = this.cellHeight + this.rowGap;

    while (reel.offset >= step) {
      reel.offset -= step;
      reel.sprites.forEach((entry) => {
        entry.logicalRow += 1;
      });

      const recycled = reel.sprites.find(
        (entry) => entry.logicalRow >= this.config.rows,
      );

      if (!recycled) {
        continue;
      }

      recycled.logicalRow = -1;
      recycled.sprite.texture = this.getTexture(reel.strip[reel.stripIndex]!);
      recycled.sprite.name = `symbol${reel.index + 1}_buffer`;
      reel.stripIndex = (reel.stripIndex + 1) % reel.strip.length;
    }
  }

  layoutReelSprites(reel: ReelState): void {
    const step = this.cellHeight + this.rowGap;

    for (const entry of reel.sprites) {
      entry.sprite.x = 0;
      entry.sprite.y = entry.logicalRow * step + reel.offset;
    }
  }

  snapReelToResult(reel: ReelState): void {
    reel.speed = 0;
    reel.offset = 0;
    reel.isStopped = true;

    const topSymbol =
      reel.targetSymbols[reel.targetSymbols.length - 1] ?? reel.targetSymbols[0];

    for (let row = 0; row < reel.sprites.length; row++) {
      const entry = reel.sprites[row]!;
      const logicalRow = row - 1;
      const symbol =
        logicalRow < 0 ? topSymbol : reel.targetSymbols[logicalRow] ?? topSymbol;

      entry.logicalRow = logicalRow;
      entry.sprite.visible = true;
      entry.sprite.texture = this.getTexture(symbol);
      entry.sprite.name = `symbol${reel.index + 1}_${row}`;
    }

    this.layoutReelSprites(reel);
  }

  getLayout() { // for variable reels updating the positions
    const totalWidth = this.config.reels * this.config.reelLayout.cellWidth + (this.config.reels - 1) * this.config.reelLayout.reelGap;

    return (
      {
        ...this.config.reelLayout,
        x: Math.round((this.config.app.width - totalWidth) / 2),
      }
    );
  }

  getSpinConfig() {
    const reelSpeedConfig= this.config.reelSpin;
    return {
      initialSpeed: reelSpeedConfig.initialSpeed,
      speedStepPerReel: reelSpeedConfig.speedStepPerReel,
      stopDelay: reelSpeedConfig.stopDelay,
      stopDelayStepPerReel: reelSpeedConfig.stopDelayStepPerReel,
      acceleration: reelSpeedConfig.acceleration,
      maxSpeed: reelSpeedConfig.maxSpeed,
      deceleration: reelSpeedConfig.deceleration,
      movementMultiplier: reelSpeedConfig.movementMultiplier,
      snapSpeed: reelSpeedConfig.snapSpeed,
    };
  }

}
