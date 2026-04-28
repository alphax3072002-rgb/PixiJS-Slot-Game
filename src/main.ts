import "./style.css";
import { Game } from "./Game";

const game = new Game();

game.start().catch((error: unknown) => {
  console.error("Failed to start game", error);
});
