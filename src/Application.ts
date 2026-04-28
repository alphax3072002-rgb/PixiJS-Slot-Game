import * as PIXI from "pixi.js";

type AppOptions = {
  width: number;
  height: number;
  backgroundColor: number;
};

export class Application {
  app: PIXI.Application;

  constructor(options: AppOptions) {
    this.app = new PIXI.Application({
      width: options.width,
      height: options.height,
      backgroundColor: options.backgroundColor,
      antialias: true,
    });
    console.log(this.app);
    
    this.app.stage.name = "stage";
    
    const view = this.app.view as HTMLCanvasElement;
    view.style.width = "100%";
    view.style.height = "100%";
    view.style.display = "block";
    
    const parent = document.getElementById("app");
    if (parent) {
      parent.appendChild(view);
    }
    (window as Window & { __PIXI_APP__?: PIXI.Application }).__PIXI_APP__ = this.app; // enbale pixi devtools in browser
  }

}
