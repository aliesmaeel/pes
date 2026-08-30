import { AudioBus } from "./audio.js";
import { Game } from "./game/Game.js";
import { loadPlayerModel } from "./game/playerModel.js";
import { mountUI } from "./ui/app.js";

const canvas = document.querySelector("#stage");
const root = document.querySelector("#app");
const audio = new AudioBus();

await loadPlayerModel().catch((err) => {
  console.warn("Skinned player model failed to load; using box rig.", err);
});

let ui;
const game = new Game(canvas, (state) => ui?.sync(state));
game.setAudio(audio);
ui = mountUI(root, game, audio);
window.strike = game;

window.addEventListener("pointerdown", () => audio.unlock(), { once: true });

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.dispose();
    delete window.strike;
  });
}
