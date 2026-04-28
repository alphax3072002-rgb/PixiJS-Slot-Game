import * as PIXI from "pixi.js";

export class AssetLoader {
  static bundleName = "core";
  static isRegistered = false; // flag kept for check if same asseet is loaded more than once

  static async load(): Promise<void> {
    if (!this.isRegistered) {
      PIXI.Assets.addBundle(this.bundleName, {
        // hero: "/src/assets/hero.png",

        // WILD: "/src/assets/symbols/greenStar.png",
        // J: "/src/assets/symbols/orangeBear.png",
        // A: "/src/assets/symbols/pinkBean.png",
        // K: "/src/assets/symbols/pinkCandy.png",
        // Q: "/src/assets/symbols/purpleBear.png",
        // SCATTER: "/src/assets/symbols/scat.png",

      });
      this.isRegistered = true;
    }

    await PIXI.Assets.loadBundle(this.bundleName);
  }
}

