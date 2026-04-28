import * as PIXI from "pixi.js";

type HudData = {
  balance: number;
  bet: number;
  win: number;
  freeSpinsRemaining: number;
  freeSpinsAwarded: number;
  spinEnabled: boolean;
  betDecreaseEnabled: boolean;
  betIncreaseEnabled: boolean;
  stateLabel: string;
};

export class Hud {
  container = new PIXI.Container();

  balanceValue: PIXI.Text;
  betValue: PIXI.Text;
  winValue: PIXI.Text;
  featureValue: PIXI.Text;
  stateValue: PIXI.Text;

  spinButton: PIXI.Container;
  betMinusButton: PIXI.Container;
  betPlusButton: PIXI.Container;

  constructor(
    onSpin: () => void,
    onBetDecrease: () => void,
    onBetIncrease: () => void,
  ) {
    this.container.name = "HUD";
    this.container.y = 560;

    this.balanceValue = this.createValueTxt("balanceValue");
    this.betValue = this.createValueTxt("betValue");
    this.winValue = this.createValueTxt("winValue");
    this.featureValue = this.createValueTxt("featureValue");
    this.stateValue = this.createValueTxt("stateValue");

    this.addInfo("BALANCE", this.balanceValue, 36);
    this.addInfo("BET", this.betValue, 300);
    this.addInfo("WIN", this.winValue, 500);
    this.addInfo("FEATURE", this.featureValue, 700);
    this.addInfo("STATE", this.stateValue, 980);

    this.spinButton = this.createButton("SPIN", 120, onSpin);
    this.betMinusButton = this.createButton("-", 58, onBetDecrease);
    this.betPlusButton = this.createButton("+", 58, onBetIncrease);

    this.spinButton.name = "spinButton";
    this.spinButton.position.set(1130, 34);

    this.betMinusButton.name = "betMinusButton";
    this.betMinusButton.position.set(222, 58);

    this.betPlusButton.name = "betPlusButton";
    this.betPlusButton.position.set(418, 58);

    this.container.addChild(
      this.spinButton,
      this.betMinusButton,
      this.betPlusButton,
    );
    console.log(this.container);
    
  }
  
  update(data: HudData): void {
    this.balanceValue.text = data.balance.toFixed(2);
    this.betValue.text = data.bet.toFixed(2);
    this.winValue.text = data.win.toFixed(2);
    this.stateValue.text = data.stateLabel;

    if (data.freeSpinsRemaining > 0) {
      this.featureValue.text = `FREE SPINS: ${data.freeSpinsRemaining}`;
    } else if (data.freeSpinsAwarded > 0) {
      this.featureValue.text = `AWARDED: ${data.freeSpinsAwarded}`;
    } else {
      this.featureValue.text = "NONE";
    }

    this.setButton(this.spinButton, data.spinEnabled);
    this.setButton(this.betMinusButton, data.betDecreaseEnabled);
    this.setButton(this.betPlusButton, data.betIncreaseEnabled);
  }

  addInfo(label: string, valueText: PIXI.Text, x: number): void {
    const labelText = new PIXI.Text(label, {
      fill: 0x87a7d1,
      fontFamily: "Trebuchet MS",
      fontSize: 20,
      fontWeight: "bold",
    });

    labelText.name = label;
    labelText.position.set(x, 30);
    valueText.position.set(x, 66);
    this.container.addChild(labelText, valueText);
  }

  createValueTxt(name: string): PIXI.Text {
    const text = new PIXI.Text("0", {
      fill: 0xf4f7fb,
      fontFamily: "Trebuchet MS",
      fontSize: 34,
      fontWeight: "bold",
    });
    console.log(text);
    text.name = name;
    return text;
  }

  createButton(label: string,width: number,onClick: () => void,): PIXI.Container {
    const button = new PIXI.Container();
    const background = new PIXI.Graphics();
    const text = new PIXI.Text(label, {
      fill: 0xffffff,
      fontFamily: "Trebuchet MS",
      fontSize: 24,
      fontWeight: "bold",
    });

    background.name = label;
    background.beginFill(0x1a6ea8);
    background.drawRoundedRect(0, 0, width, 58, 18);
    background.endFill();

    text.name = label + "text";
    text.anchor.set(0.5);
    text.position.set(width / 2, 29);

    button.eventMode = "static";
    button.on("pointerdown", () => {
      if (button.alpha === 1) {
        onClick();
      }
    });

    button.addChild(background, text);
    return button;
  }

  setButton(button: PIXI.Container, isEnabled: boolean): void {
    if (isEnabled) {
      button.alpha = 1;
      button.cursor = "pointer";
    } else {
      button.alpha = 0.45;
      button.cursor = "default";
    }
  }
}
