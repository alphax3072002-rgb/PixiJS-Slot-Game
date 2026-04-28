import * as PIXI from "pixi.js";

export class SymbolFactory {
  textures = new Map<string, PIXI.RenderTexture>();
  renderer: PIXI.IRenderer<PIXI.ICanvas>;

  constructor(renderer: PIXI.IRenderer<PIXI.ICanvas>) {
    this.renderer = renderer;
  }

  getTexture(label: string): PIXI.Texture {
    const cached = this.textures.get(label);
    if (cached) { // if texure is available in cache, ie didnt get destroyed or loaded, it will retrun the texture from cache. lazy method
      return cached;
    }

    const texture = this.createTexture(label);
    this.textures.set(label, texture);
    return texture;
  }

  destroy(): void {
    this.textures.forEach((texture) => texture.destroy(true));
    this.textures.clear();
  }

  createTexture(label: string): PIXI.RenderTexture {

    console.log(label);
    
    const width = 150;
    const height = 150;
    const container = new PIXI.Container();
    const frame = new PIXI.Graphics();
    const accent = this.getColor(label);

    container.name = label;
    frame.name = "symbolFrame";
    frame.beginFill(0x14223a);
    frame.lineStyle(4, accent, 1);
    frame.drawRoundedRect(0, 0, width, height, 22);
    frame.endFill();

    // const symbolTexture = PIXI.Assets.get(label);
    // const symbol = new PIXI.Sprite(symbolTexture);
    // symbol.anchor.set(0);


    const text = new PIXI.Text(label, {
      fill: 0xfdf4d7,
      fontFamily: "Trebuchet MS",
      fontSize: label.length > 2 ? 28 : 48,
      fontWeight: "bold",
      align: "center",
    });

    text.name = "symbolText";
    text.anchor.set(0.5);
    text.x = width / 2;
    text.y = height / 2;

    container.addChild(frame, text);

    const renderTexture = PIXI.RenderTexture.create({ width, height });
    this.renderer.render(container, { renderTexture }); // the symbol texure is made by combining the frame and text. then no need of container, so destroy it for optimisation
    container.destroy({ children: true });

    return renderTexture;
  }

  getColor(label: string): number {
    switch (label) {
      case "A":
        return 0xf25f5c;
      case "K":
        return 0x4ea8de;
      case "Q":
        return 0xf4b860;
      case "J":
        return 0x90be6d;
      case "WILD":
        return 0xf9c74f;
      case "SCATTER":
        return 0xf9844a;
      default:
        return 0xd9e2ec;
    }
  }
}
