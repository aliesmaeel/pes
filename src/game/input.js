const P1 = {
  up: ["ArrowUp"],
  down: ["ArrowDown"],
  left: ["ArrowLeft"],
  right: ["ArrowRight"],
  sprint: ["KeyE", "ShiftLeft", "ShiftRight"],
  pass: ["KeyS"],
  shoot: ["KeyD"],
  through: ["KeyW"],
  jump: ["Space"],
  tackle: ["KeyA"],
  switch: ["Tab", "KeyQ"],
};

const P2 = {
  up: ["Numpad8", "KeyI"],
  down: ["Numpad5", "KeyK"],
  left: ["Numpad4", "KeyJ"],
  right: ["Numpad6", "KeyL"],
  sprint: ["NumpadAdd"],
  pass: ["Numpad1", "KeyH"],
  shoot: ["Numpad3", "KeyN"],
  through: ["Numpad7", "KeyU"],
  jump: ["Numpad0", "Slash"],
  tackle: ["Numpad2", "KeyM"],
  switch: [],
};

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.enabled = true;
    this._onDown = (e) => {
      if (!this.enabled) return;
      if (e.code === "Tab" || e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
    };
    this._onUp = (e) => {
      this.down.delete(e.code);
      this.released.add(e.code);
    };
    this._onBlur = () => this.down.clear();
    window.addEventListener("keydown", this._onDown);
    window.addEventListener("keyup", this._onUp);
    window.addEventListener("blur", this._onBlur);
  }

  beginFrame() {
    this.pressed.clear();
    this.released.clear();
  }

  dispose() {
    window.removeEventListener("keydown", this._onDown);
    window.removeEventListener("keyup", this._onUp);
    window.removeEventListener("blur", this._onBlur);
  }

  axis(map) {
    let x = 0;
    let z = 0;
    if (map.left.some((k) => this.down.has(k))) x -= 1;
    if (map.right.some((k) => this.down.has(k))) x += 1;
    if (map.up.some((k) => this.down.has(k))) z += 1;
    if (map.down.some((k) => this.down.has(k))) z -= 1;
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return { x, z };
  }

  held(map, action) {
    return map[action].some((k) => this.down.has(k));
  }

  just(map, action) {
    return map[action].some((k) => this.pressed.has(k));
  }

  up(map, action) {
    return map[action].some((k) => this.released.has(k));
  }

  state(slot) {
    const map = slot === 1 ? P2 : P1;
    return {
      move: this.axis(map),
      sprint: this.held(map, "sprint"),
      jump: this.just(map, "jump"),
      tackle: this.just(map, "tackle"),
      pass: this.just(map, "pass"),
      through: this.just(map, "through"),
      shootStart: this.just(map, "shoot"),
      shootEnd: this.up(map, "shoot"),
      switchPlayer: this.just(map, "switch"),
    };
  }
}

export const CONTROL_HELP = {
  p1: "Arrows aim and move · S pass · D shoot (hold to charge) · W through ball · A slide · E sprint · Space jump · Tab switch in 3v3",
  p2: "IJKL or numpad move · H pass · N shoot · U through · M slide · / jump",
};
