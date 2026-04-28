import * as PIXI from "pixi.js";
import { Application } from "./Application";
import { AssetLoader } from "./AssetLoader";
import { EventBus } from "./EventBus";
import { Hud } from "./Hud";
import { MockSpinService } from "./MockSpinService";
import { ReelEngine } from "./ReelEngine";
import { StateMachine } from "./StateMachine";
import { SymbolFactory } from "./SymbolFactory";

type GameState =
  | "IDLE"
  | "SPINNING"
  | "RESULT"
  | "WIN_PRESENTATION"
  | "TRANSITION";

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

type GameEvents = {
  "REQUEST_SPIN": undefined;
  "SPIN_START": SpinResult;
  "ALL_REEL_STOPPED": SpinResult;
  "SHOW_RESULT": SpinResult;
  "START_WIN_PRESENTATION": SpinResult;
  "WIN_PRESENTATION_COMPLETED": undefined;
  "STATE_CHANGED": GameState;
  "DECREASE_BET": undefined;
  "INCREASE_BET": undefined;
};

export class Game {
  readonly balanceStorageKey = "slot-game-balance";

  appWrapper!: Application;
  app!: PIXI.Application;
  config: any;
  baseWidth = 0;
  baseHeight = 0;
  symbolFactory!: SymbolFactory;
  spinService!: MockSpinService;
  reelEngine!: ReelEngine;
  hud!: Hud;
  currentResult?: SpinResult;
  currentBet = 0;
  currentBalance = 0;
  currentWin = 0;
  freeSpinsRemaining = 0;
  freeSpinsAwarded = 0;
  state = "IDLE";
  currentSpinWasFree = false;
  freeGameTotalWin = 0;
  presentationElapsed = 0;
  freeGameMessageElapsed = 0;
  freeGameMessageText = "";

  events = new EventBus<GameEvents>();
  stateMachine = new StateMachine<GameState>();
  gameContainer = new PIXI.Container();
  backgroundLayer = new PIXI.Container();
  reelPanelLayer = new PIXI.Container();
  reelContainer = new PIXI.Container();
  winLayer = new PIXI.Container();
  hudLayer = new PIXI.Container();
  winMessage = new PIXI.Text("", {
    fill: 0xffdf80,
    fontFamily: "Trebuchet MS",
    fontSize: 34,
    fontWeight: "bold",
  });
  resizeHandler = () => this.applyResponsiveLayout();

  async start(): Promise<void> {
    const configResponse = await fetch("/config/gameConfig.json"); // gameconfig loading and using
    this.config = await configResponse.json();
    this.baseWidth = this.config.app.width;
    this.baseHeight = this.config.app.height;
    
    this.currentBet = this.config.defaultBet;
    this.currentBalance = this.loadBalance();

    await AssetLoader.load();


    this.appWrapper = new Application({
      width: this.config.app.width,
      height: this.config.app.height,
      backgroundColor: this.config.app.backgroundColor,
    });
    this.app = this.appWrapper.app;
    this.symbolFactory = new SymbolFactory(this.app.renderer);
    this.spinService = new MockSpinService(this.config);

    this.setupStageHierarchy();
    this.configureStateMachine();
    this.subscribeEvents();
    this.createScene();
    this.applyResponsiveLayout();
    this.addTicker();
    window.addEventListener("resize", this.resizeHandler);
    this.stateMachine.setState("IDLE");
    // this.loadHeroAsset();//dummy asset for testing
  }

  setupStageHierarchy(): void {
    this.app.stage.name = "stage";
    this.gameContainer.name = "game";
    this.backgroundLayer.name = "backgroundLayer";
    this.reelPanelLayer.name = "panelLayer";
    this.reelContainer.name = "reels";
    this.winLayer.name = "winLayer";
    this.hudLayer.name = "hudLayer";

    this.app.stage.addChild(this.gameContainer);
    this.gameContainer.addChild(
      this.backgroundLayer,
      this.reelPanelLayer,
      this.reelContainer,
      this.winLayer,
      this.hudLayer,
    );
  }

  configureStateMachine(): void {
    this.stateMachine
      .addState({
        name: "IDLE",
        onEnter: () => {
          this.freeSpinsAwarded = 0;
          this.events.publish("STATE_CHANGED", "IDLE");
          this.resetHUDValues();

          if (this.freeSpinsRemaining > 0) {
            this.events.publish("REQUEST_SPIN", undefined);
          }
        },
      })
      .addState({
        name: "SPINNING",
        onEnter: () => {
          this.events.publish("STATE_CHANGED", "SPINNING");
          this.resetHUDValues();
        },
        update: (delta) => this.reelEngine.update(delta),
      })
      .addState({
        name: "RESULT",
        onEnter: () => {
          this.events.publish("STATE_CHANGED", "RESULT");
          this.resetHUDValues();

          if (!this.currentResult) {
            return;
          }

          this.events.publish("START_WIN_PRESENTATION", this.currentResult);
        },
      })
      .addState({
        name: "WIN_PRESENTATION",
        onEnter: () => {
          this.presentationElapsed = 0;
          this.events.publish("STATE_CHANGED", "WIN_PRESENTATION");
          this.resetHUDValues();

          if (!this.currentResult || this.currentResult.totalWin <= 0) {
            this.events.publish("WIN_PRESENTATION_COMPLETED", undefined);
            return;
          }

          this.winMessage.text = `WIN ${this.currentResult.totalWin.toFixed(2)}`;
          this.winMessage.position.set(this.config.app.width / 2, 86);
          this.winMessage.visible = true;
          this.reelEngine.showWins(this.currentResult);
        },
        onExit: () => {
          this.reelEngine.clearHighlights();
          this.winMessage.visible = false;
        },
        update: (delta) => this.updateWinPresentation(delta),
      })
      .addState({
        name: "TRANSITION",
        onEnter: () => {
          this.freeGameMessageElapsed = 0;
          this.events.publish("STATE_CHANGED", "TRANSITION");
          this.resetHUDValues();

          this.winMessage.text = this.freeGameMessageText;
          this.winMessage.position.set(
            this.config.app.width / 2,
            this.config.app.height / 2,
          );
          this.winMessage.visible = true;
        },
        onExit: () => {
          this.winMessage.visible = false;
        },
        update: (delta) => this.updateFreeGameMessage(delta),
      });
  }

  subscribeEvents(): void {
    this.events.subscribe("REQUEST_SPIN", () => this.spin_request());

    this.events.subscribe("SPIN_START", (result) => this.handleSpinStart(result));

    this.events.subscribe("ALL_REEL_STOPPED", (result) => {
      console.log(" all reels stopped", this.getSpinSnapshot(result));
      this.events.publish("SHOW_RESULT", result);
    });

    this.events.subscribe("SHOW_RESULT", (result) => this.showResult(result));

    this.events.subscribe("START_WIN_PRESENTATION", () => {
      this.stateMachine.setState("WIN_PRESENTATION");
    });

    this.events.subscribe("WIN_PRESENTATION_COMPLETED", () => this.completeWinPresentation());

    this.events.subscribe("DECREASE_BET", () => {
      this.changeBet(-1);
    });

    this.events.subscribe("INCREASE_BET", () => {
      this.changeBet(1);
    });

    this.events.subscribe("STATE_CHANGED", (state) => {
      console.log(` entered state: ${state}`);
    });
  }
  handleSpinStart(result: SpinResult): void {
    console.log("spin started", this.getSpinSnapshot(result));
    this.reelEngine.startSpin(result);
    this.stateMachine.setState("SPINNING");
  }
  showResult(result:SpinResult):void{
      if (this.currentSpinWasFree) {
        this.freeGameTotalWin += result.totalWin;
      }

      if (result.freeSpinsAwarded && !this.currentSpinWasFree) {
        this.freeGameTotalWin = 0;
      }

      this.currentBalance = result.balanceAfter;
      this.saveBalance();
      this.currentWin = result.totalWin;
      this.freeSpinsAwarded = result.freeSpinsAwarded ?? 0;
      this.freeSpinsRemaining = result.freeSpinsRemaining ?? 0;
      console.log("showing result", this.getSpinSnapshot(result));
      this.stateMachine.setState("RESULT");
  }
  completeWinPresentation():void{
    console.log("win presentation completed");

    if (this.currentResult?.freeSpinsAwarded && !this.currentSpinWasFree) {
        this.showFreeGameMessage("ENTERING FREEGAME");
        return;
      }

      if (this.currentSpinWasFree && this.freeSpinsRemaining === 0) {
        this.showFreeGameMessage(
          `FREEGAME FINISHED\nWIN: ${this.freeGameTotalWin.toFixed(2)}`,
        );
        return;
      }

       this.stateMachine.setState("IDLE");
  }

  applyResponsiveLayout(): void {
    const root = document.getElementById("app");

    if (!root) {
      return;
    }

    const availableWidth = Math.max(1, Math.floor(root.clientWidth));
    const availableHeight = Math.max(1, Math.floor(root.clientHeight));
    const scale = Math.min(
      availableWidth / this.baseWidth,
      availableHeight / this.baseHeight,
    );

    this.app.renderer.resize(availableWidth, availableHeight);
    this.gameContainer.scale.set(scale);
    this.gameContainer.position.set(
      Math.round((availableWidth - this.baseWidth * scale) / 2),
      Math.round((availableHeight - this.baseHeight * scale) / 2),
    );
  }


  spin_request():void{
      if (this.stateMachine.current !== "IDLE") {
        return;
      }

      const isFreeSpin = this.freeSpinsRemaining > 0;
      this.currentSpinWasFree = isFreeSpin;

      if (!isFreeSpin && this.currentBalance < this.currentBet) {
        console.error("Not Enough Balance to Play");
        return;
      }

      const result = this.spinService.spin({
        balance: this.currentBalance,
        bet: this.currentBet,
        freeSpinsRemaining: this.freeSpinsRemaining,
      });

      this.currentResult = result;
      console.log(" spin result", this.getSpinSnapshot(result));
      this.events.publish("SPIN_START", result);
    }


  createScene(): void {
    this.createBackground();
    this.createReelPanel();
    this.createReels();
    this.createWinLayer();
    this.createHud();
  }

  createBackground(): void {
    const background = new PIXI.Graphics();
    background.name = "background";
    background.beginFill(this.config.app.backgroundColor);
    background.drawRect(0, 0, this.config.app.width, this.config.app.height);
    background.endFill();

    const title = new PIXI.Text("Variable Reels Slot Game", {
      fill: 0xf6efe0,
      fontFamily: "Trebuchet MS",
      fontSize: 40,
      fontWeight: "bold",
    });
    title.name = "title";
    title.x = 400;
    title.y = 24;

    this.backgroundLayer.addChild(background, title);
  }

  createReelPanel(): void {
    const layout = this.getLayout();
    const totalWidth =
      this.config.reels * layout.cellWidth +
      (this.config.reels - 1) * layout.reelGap;
    const panelWidth = totalWidth + 32;
    const panelHeight =
      this.config.rows * layout.cellHeight +
      (this.config.rows - 1) * layout.rowGap +
      32;
    const panel = new PIXI.Container();
    const shadow = new PIXI.Graphics();
    const frame = new PIXI.Graphics();

    panel.name = "reelPanel";
    shadow.name = "panelShadow";
    shadow.beginFill(0x04070d, 0.45);
    shadow.drawRoundedRect(8, 14, panelWidth, panelHeight, 30);
    shadow.endFill();

    frame.name = "panelFrame";
    frame.beginFill(0x0a1320, 0.92);
    frame.lineStyle(4, 0x2e5b86, 1);
    frame.drawRoundedRect(0, 0, panelWidth, panelHeight, 30);
    frame.endFill();

    panel.addChild(shadow, frame);

    panel.x = Math.round((this.config.app.width - totalWidth) / 2) - 16;
    panel.y = layout.y - 16;
    this.reelPanelLayer.addChild(panel);
  }

  createReels(): void {
    this.reelEngine = new ReelEngine(
      this.config,
      (symbol) => this.symbolFactory.getTexture(symbol),
      {
        onSpinComplete: (result) => {
          this.events.publish("ALL_REEL_STOPPED", result);
        },
      },
    );

    this.reelContainer.addChild(this.reelEngine.container);
  }

  createWinLayer(): void {
    this.winMessage.name = "winText";
    this.winMessage.anchor.set(0.5);
    this.winMessage.position.set(this.config.app.width / 2, 86);
    this.winMessage.visible = false;
    this.winLayer.addChild(this.winMessage);
  }

  createHud(): void {
    this.hud = new Hud(
      () => this.events.publish("REQUEST_SPIN", undefined),
      () => this.events.publish("DECREASE_BET", undefined),
      () => this.events.publish("INCREASE_BET", undefined),
    );

    this.hudLayer.addChild(this.hud.container);
    this.resetHUDValues();
  }

  addTicker(): void {
    this.app.ticker.add((delta) => {
      this.stateMachine.update(delta);
    });
  }

  updateWinPresentation(delta: number): void {
    if (!this.currentResult || this.currentResult.totalWin <= 0) {
      return;
    }

    this.presentationElapsed += delta / 60;

    const pulse = 0.8 + Math.sin(this.presentationElapsed * 8) * 0.2;
    this.winLayer.alpha = pulse;

    if (this.presentationElapsed >= 1.4) {
      this.winLayer.alpha = 1;
      this.events.publish("WIN_PRESENTATION_COMPLETED", undefined);
    }
  }

  updateFreeGameMessage(delta: number): void {
    this.freeGameMessageElapsed += delta / 60;

    if (this.freeGameMessageElapsed >= 1.5) {
      this.stateMachine.setState("IDLE");
    }
  }

  showFreeGameMessage(message: string): void {
    this.freeGameMessageText = message;
    console.log("freegame transition message");
    this.stateMachine.setState("TRANSITION");
  }

  resetHUDValues(): void {
    const currentBetIndex = this.config.betOptions.indexOf(this.currentBet);
    const canChangeBet =
      this.stateMachine.current === "IDLE" && this.freeSpinsRemaining === 0;

    this.hud.update({
      balance: this.currentBalance,
      bet: this.currentBet,
      win: this.currentWin,
      freeSpinsRemaining: this.freeSpinsRemaining,
      freeSpinsAwarded: this.freeSpinsAwarded,
      spinEnabled: this.stateMachine.current === "IDLE",
      betDecreaseEnabled: canChangeBet && currentBetIndex > 0,
      betIncreaseEnabled: canChangeBet && currentBetIndex < this.config.betOptions.length - 1,
      stateLabel: this.stateMachine.current ?? "BOOT",
    });
  }

  loadBalance(): number {
    const savedBalance = localStorage.getItem(this.balanceStorageKey); // taking from localstorage once game loads
    if (savedBalance === null) {
      return this.config.balance;
    }
    const balance = Number(savedBalance);
    return balance;
  }

  saveBalance(): void {
    localStorage.setItem(this.balanceStorageKey,String(this.currentBalance)); // saves the balance in loacal storage.
  }

  changeBet(direction: -1 | 1): void {
    if (this.stateMachine.current !== "IDLE" || this.freeSpinsRemaining > 0) {
      return;
    }

    const currentIndex = this.config.betOptions.indexOf(this.currentBet);
    const nextIndex = currentIndex + direction;
    const nextBet = this.config.betOptions[nextIndex];

    if (nextBet === undefined) {
      return;
    }

    this.currentBet = nextBet;
    this.resetHUDValues();
  }

  getLayout() {
    const baseLayout =
      this.config.reelLayout ?? {
        x: 120,
        y: 90,
        cellWidth: 180,
        cellHeight: 130,
        reelGap: 18,
        rowGap: 12,
      };
    const totalWidth =
      this.config.reels * baseLayout.cellWidth +
      (this.config.reels - 1) * baseLayout.reelGap;

    return {
      ...baseLayout,
      x: Math.round((this.config.app.width - totalWidth) / 2),
    };
  }
  loadHeroAsset(){
    const dummyTexture = PIXI.Assets.get("viteLogo");
    const dummy = new PIXI.Sprite(dummyTexture);
    dummy.x = 0;
    dummy.y = 0;
    this.backgroundLayer.addChild(dummy);

  }

  getSpinSnapshot(result: SpinResult) {
    return {
      currentState: this.stateMachine.current,
      reels: result.reels.map((reel) =>
        reel.map((symbolIndex) => this.config.symbols[symbolIndex] ?? symbolIndex),
      ),
      totalWin: result.totalWin,
      balanceAfter: result.balanceAfter,
      freeSpinsAwarded: result.freeSpinsAwarded ?? 0,
      freeSpinsRemaining: result.freeSpinsRemaining ?? 0,
      winLines: result.winLines,
      currentSpinWasFree: this.currentSpinWasFree,
    };
  }
}
