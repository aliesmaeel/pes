import { CONTROL_HELP } from "../game/input.js";
import { KITS, KIT_UNLOCKS, RANKS } from "../config.js";
import { loadCareer } from "../game/Game.js";

function rankFor(wins) {
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (wins >= rank.wins) current = rank;
  }
  return current;
}

function unlocked(kitId, wins) {
  return wins >= (KIT_UNLOCKS[kitId] ?? 99);
}

function fmtTime(t) {
  const s = Math.max(0, Math.ceil(t));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function kitButtons(name, selected, wins, onPick) {
  return Object.entries(KITS)
    .map(([id, kit]) => {
      const open = unlocked(id, wins);
      return `<button type="button" class="kit-option" data-kit-group="${name}" data-kit="${id}" aria-pressed="${selected === id}" ${open ? "" : "disabled"}>
        <span class="kit-swatch" style="background:#${kit.jersey.toString(16).padStart(6, "0")}"></span>
        ${kit.name}${open ? "" : ` · ${KIT_UNLOCKS[id]} wins`}
      </button>`;
    })
    .join("");
}

export function mountUI(root, game, audio) {
  const setup = {
    mode: "1v1",
    difficulty: "medium",
    twoPlayer: false,
    testMode: false,
    ladder: false,
    homeKit: loadCareer().kitHome || "crimson",
    awayKit: loadCareer().kitAway || "cobalt",
  };

  let view = "menu";
  let lastPhase = "menu";
  let hudMounted = false;

  const sync = (state) => {
    lastPhase = state.phase;
    if (state.phase === "menu") {
      if (view === "hud" || view === "paused" || view === "fulltime") {
        view = "menu";
        hudMounted = false;
        renderMenu();
      }
      return;
    }
    if (state.phase === "playing") {
      if (view !== "hud") {
        view = "hud";
        renderHudShell(state);
      }
      patchHud(state);
      return;
    }
    if (state.phase === "paused" && view !== "paused") {
      view = "paused";
      renderPaused(state);
      return;
    }
    if (state.phase === "fulltime" && view !== "fulltime") {
      view = "fulltime";
      hudMounted = false;
      renderResult(state);
    }
  };

  function startFromSetup() {
    const career = loadCareer();
    career.kitHome = setup.homeKit;
    career.kitAway = setup.awayKit;
    localStorage.setItem("strike3d-career", JSON.stringify(career));
    audio.unlock();
    audio.ui();
    game.startMatch({
      mode: setup.mode,
      twoPlayer: setup.twoPlayer,
      testMode: setup.testMode,
      ladder: setup.ladder,
      difficulty: setup.ladder ? rankFor(career.wins).difficulty : setup.difficulty,
      homeKit: setup.homeKit,
      awayKit: setup.awayKit,
      homeName: "STRIKE",
      awayName: setup.testMode ? "SOLO" : setup.twoPlayer ? "P2" : setup.ladder ? rankFor(career.wins).label.toUpperCase() : "CPU",
    });
    view = "hud";
  }

  function renderMenu() {
    const career = loadCareer();
    const rank = rankFor(career.wins);
    root.innerHTML = `
      <div class="overlay" id="menu-root">
        <div class="panel">
          <div class="brand">
            <h1>STRIKE 3D</h1>
            <p>Arcade football. Charge a shot, time a tackle, beat the clock.</p>
          </div>
          <p class="help">Rank <b>${rank.label}</b> · ${career.wins}–${career.losses}</p>
          <div class="stack">
            <button type="button" class="primary" data-act="quick">Quick match</button>
            <button type="button" class="secondary" data-act="local">Local versus</button>
            <button type="button" data-act="test">Test mode</button>
            <button type="button" data-act="ladder">Ladder</button>
            <button type="button" class="ghost" data-act="help">How to play</button>
          </div>
        </div>
      </div>`;
    bindMenu();
  }

  function renderSetup(kind) {
    setup.twoPlayer = kind === "local";
    setup.ladder = kind === "ladder";
    setup.testMode = kind === "test";
    if (kind === "local") setup.mode = "1v1";
    const career = loadCareer();
    const rank = rankFor(career.wins);
    const title = kind === "ladder" ? "LADDER" : kind === "local" ? "VERSUS" : kind === "test" ? "TEST MODE" : "MATCH";
    const blurb =
      kind === "ladder"
        ? `Next opponent: ${rank.label} AI. Win to climb.`
        : kind === "test"
          ? "Play alone. No opponent, no clock. Run with the ball, shoot, and reset after goals."
          : "Pick a format, kits, and get to kickoff.";
    root.innerHTML = `
      <div class="overlay" id="menu-root">
        <div class="panel">
          <div class="brand">
            <h1>${title}</h1>
            <p>${blurb}</p>
          </div>
          ${
            kind !== "local"
              ? `<div class="row">
                  <button type="button" data-mode="1v1" aria-pressed="${setup.mode === "1v1"}">${kind === "test" ? "Solo" : "1v1"}</button>
                  <button type="button" data-mode="3v3" aria-pressed="${setup.mode === "3v3"}">${kind === "test" ? "With teammates" : "3v3"}</button>
                </div>`
              : ""
          }
          ${
            kind === "quick"
              ? `<label class="field"><span>AI difficulty</span>
                  <select id="diff">
                    <option value="easy">Amateur</option>
                    <option value="medium" selected>Pro</option>
                    <option value="hard">Elite</option>
                  </select>
                </label>`
              : `<p class="help">${kind === "ladder" ? `Difficulty locked to ${rank.label}.` : kind === "test" ? "You are home. Arrows move, S pass, D shoot, E sprint. 3v3 adds AI teammates only." : "Same keyboard. Home: arrows + WASD actions. Away: IJKL or numpad."}</p>`
          }
          <p class="help">Home kit</p>
          <div class="row" id="home-kits">${kitButtons("home", setup.homeKit, career.wins)}</div>
          ${
            kind === "test"
              ? ""
              : `<p class="help">Away kit</p>
          <div class="row" id="away-kits">${kitButtons("away", setup.awayKit, career.wins)}</div>`
          }
          <div class="row">
            <button type="button" class="primary" data-act="kickoff">Kick off</button>
            <button type="button" class="ghost" data-act="back">Back</button>
          </div>
        </div>
      </div>`;
    bindSetup();
  }

  function renderHelp() {
    root.innerHTML = `
      <div class="overlay" id="menu-root">
        <div class="panel">
          <div class="brand">
            <h1>CONTROLS</h1>
            <p>Tap pass, hold to charge a shot. Jump near an aerial ball to header.</p>
          </div>
          <p class="help"><b>Player 1</b><br>${CONTROL_HELP.p1.replace(/ · /g, "<br>")}</p>
          <p class="help"><b>Player 2</b><br>${CONTROL_HELP.p2.replace(/ · /g, "<br>")}</p>
          <p class="help"><kbd>Esc</kbd> pause · Yellow ring is you · Green ring is the pass target · Aim with arrows · Tab switches in 3v3</p>
          <button type="button" class="primary" data-act="back">Back</button>
        </div>
      </div>`;
    root.querySelector("[data-act=back]").addEventListener("click", () => {
      audio.ui();
      view = "menu";
      renderMenu();
    });
  }

  function renderHudShell(state) {
    const m = state.match;
    root.innerHTML = `
      <div class="hud" id="hud-root">
        <div class="hud-top">
          <div class="hud-side">
            <div class="stamina">
              <div class="stamina-label" id="p1-label">P1 stamina</div>
              <div class="bar" aria-hidden="true"><span id="p1-stamina"></span></div>
              <div class="charge-label">Shot charge</div>
              <div class="bar charge" aria-hidden="true"><span id="p1-charge"></span></div>
            </div>
            <button type="button" class="ghost" id="btn-pause" style="pointer-events:auto;min-height:44px">Pause</button>
          </div>
          <div class="scoreboard">
            <div class="team">
              <div class="team-name"><span class="team-kit" id="home-kit"></span><span id="home-name">HOME</span></div>
            </div>
            <div>
              <div class="score"><span id="home-score">0</span><span aria-hidden="true">–</span><span id="away-score">0</span></div>
              <div class="timer" id="clock">1:30</div>
            </div>
            <div class="team away">
              <div class="team-name"><span id="away-name">AWAY</span><span class="team-kit" id="away-kit"></span></div>
            </div>
          </div>
          <div class="hud-side minimap-wrap">
            <canvas class="minimap" id="minimap" width="168" height="110" aria-label="Pitch minimap"></canvas>
            <div class="stamina" id="p2-wrap" hidden>
              <div class="stamina-label">P2 stamina</div>
              <div class="bar" aria-hidden="true"><span id="p2-stamina"></span></div>
            </div>
          </div>
        </div>
        <div class="hint" id="hint">
          <div class="prompt" id="prompt"></div>
          <div id="hint-text">${CONTROL_HELP.p1}</div>
        </div>
        <div class="toast" id="toast" role="status" aria-live="polite"></div>
        <div class="banner" id="banner"></div>
        <div class="sr-only" id="live" aria-live="polite"></div>
      </div>`;
    hudMounted = true;
    root.querySelector("#btn-pause").addEventListener("click", () => game.pause());
    if (m) {
      root.querySelector("#home-name").textContent = m.homeName;
      root.querySelector("#away-name").textContent = m.awayName;
      const hk = KITS[m.homeKit];
      const ak = KITS[m.awayKit];
      root.querySelector("#home-kit").style.background = `#${hk.jersey.toString(16).padStart(6, "0")}`;
      root.querySelector("#away-kit").style.background = `#${ak.jersey.toString(16).padStart(6, "0")}`;
      root.querySelector("#p2-wrap").hidden = !m.twoPlayer;
      const hintText = root.querySelector("#hint-text");
      if (hintText) {
        hintText.textContent = m.twoPlayer ? `${CONTROL_HELP.p1} · ${CONTROL_HELP.p2}` : CONTROL_HELP.p1;
        if (m.mode !== "3v3") hintText.textContent = hintText.textContent.replace(" · Tab switch in 3v3", "");
      }
    }
    patchHud(state);
  }

  function patchHud(state) {
    if (!hudMounted || !state.match) return;
    const m = state.match;
    root.querySelector("#home-score").textContent = String(m.score.home);
    root.querySelector("#away-score").textContent = String(m.score.away);
    root.querySelector("#clock").textContent = m.kickoff > 0 ? String(Math.ceil(m.kickoff)) : m.testMode ? "TEST" : fmtTime(m.time);
    const banner = root.querySelector("#banner");
    if (m.kickoff > 0) {
      banner.textContent = m.kickoff > 2.2 ? "Kickoff" : Math.ceil(m.kickoff) === 0 ? "Play" : String(Math.ceil(m.kickoff));
      banner.classList.add("show");
    } else if (m.goalLock > 0) {
      banner.textContent = "Goal";
      banner.classList.add("show");
    } else {
      banner.classList.remove("show");
    }
    if (state.p1) {
      root.querySelector("#p1-stamina").style.width = `${(state.p1.stamina / 100) * 100}%`;
      root.querySelector("#p1-charge").style.width = `${(state.p1.charge / 1.15) * 100}%`;
    }
    if (state.p2) {
      root.querySelector("#p2-stamina").style.width = `${(state.p2.stamina / 100) * 100}%`;
    }
    if (state.event === "goal") {
      root.querySelector("#live").textContent = `Goal. ${m.score.home} to ${m.score.away}.`;
    }
    if (state.event === "whiff") {
      const toast = root.querySelector("#toast");
      toast.textContent = "Get closer to the ball";
      toast.classList.add("show");
      window.clearTimeout(toast._hide);
      toast._hide = window.setTimeout(() => toast.classList.remove("show"), 900);
    }
    const prompt = root.querySelector("#prompt");
    if (prompt && state.prompt) {
      const bits = state.prompt.hasBall
        ? ["<kbd>S</kbd> Pass", "<kbd>D</kbd> Shoot", "<kbd>W</kbd> Through"]
        : ["<kbd>A</kbd> Slide"];
      if (state.prompt.canSwitch) bits.push("<kbd>Tab</kbd> Switch");
      bits.unshift("<kbd>Arrows</kbd> Aim");
      prompt.innerHTML = bits.join("");
    }
    drawMinimap(state);
  }

  function drawMinimap(state) {
    const canvas = root.querySelector("#minimap");
    if (!canvas || !state.ball) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#166534";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(248,250,252,0.7)";
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.beginPath();
    ctx.moveTo(w / 2, 4);
    ctx.lineTo(w / 2, h - 4);
    ctx.stroke();
    const to = (x, z) => [((x + 26) / 52) * (w - 8) + 4, ((z + 17) / 34) * (h - 8) + 4];
    for (const p of state.players) {
      const [mx, my] = to(p.position.x, p.position.z);
      ctx.fillStyle = p.team === "home" ? "#dc2626" : "#2563eb";
      ctx.beginPath();
      ctx.arc(mx, my, p.human ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const [bx, by] = to(state.ball.position.x, state.ball.position.z);
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(bx, by, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function renderPaused() {
    root.innerHTML = `
      <div class="overlay" id="menu-root">
        <div class="panel">
          <div class="brand"><h1>PAUSED</h1><p>Match clock is frozen.</p></div>
          <div class="stack">
            <button type="button" class="primary" data-act="resume">Resume</button>
            <button type="button" data-act="quit">Quit to menu</button>
          </div>
        </div>
      </div>`;
    hudMounted = false;
    root.querySelector("[data-act=resume]").addEventListener("click", () => {
      audio.ui();
      game.resume();
      view = "hud";
    });
    root.querySelector("[data-act=quit]").addEventListener("click", () => {
      audio.ui();
      game.quitToMenu();
      view = "menu";
      renderMenu();
    });
  }

  function renderResult(state) {
    const m = state.match;
    const title = m.winner === "draw" ? "DRAW" : m.winner === "home" ? "HOME WIN" : "AWAY WIN";
    root.innerHTML = `
      <div class="overlay" id="menu-root">
        <div class="panel">
          <div class="brand">
            <h1>${title}</h1>
            <p>${m.homeName} ${m.score.home} – ${m.score.away} ${m.awayName}</p>
          </div>
          <div class="stats">
            <div class="stat"><b>${m.shots.home}–${m.shots.away}</b><span>Shots</span></div>
            <div class="stat"><b>${m.possession.home}%</b><span>Home poss.</span></div>
            <div class="stat"><b>${m.possession.away}%</b><span>Away poss.</span></div>
          </div>
          <div class="row">
            <button type="button" class="primary" data-act="rematch">Rematch</button>
            <button type="button" class="ghost" data-act="menu">Menu</button>
          </div>
        </div>
      </div>`;
    root.querySelector("[data-act=rematch]").addEventListener("click", () => {
      startFromSetup();
    });
    root.querySelector("[data-act=menu]").addEventListener("click", () => {
      audio.ui();
      game.quitToMenu();
      view = "menu";
      renderMenu();
    });
  }

  function bindMenu() {
    root.querySelector("[data-act=quick]").addEventListener("click", () => {
      audio.ui();
      view = "setup";
      renderSetup("quick");
    });
    root.querySelector("[data-act=local]").addEventListener("click", () => {
      audio.ui();
      view = "setup";
      renderSetup("local");
    });
    root.querySelector("[data-act=test]").addEventListener("click", () => {
      audio.ui();
      view = "setup";
      renderSetup("test");
    });
    root.querySelector("[data-act=ladder]").addEventListener("click", () => {
      audio.ui();
      view = "setup";
      renderSetup("ladder");
    });
    root.querySelector("[data-act=help]").addEventListener("click", () => {
      audio.ui();
      view = "help";
      renderHelp();
    });
  }

  function bindSetup() {
    root.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setup.mode = btn.getAttribute("data-mode");
        audio.ui();
        renderSetup(setup.ladder ? "ladder" : setup.twoPlayer ? "local" : setup.testMode ? "test" : "quick");
      });
    });
    const diff = root.querySelector("#diff");
    if (diff) {
      diff.value = setup.difficulty;
      diff.addEventListener("change", () => {
        setup.difficulty = diff.value;
      });
    }
    root.querySelectorAll("[data-kit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const group = btn.getAttribute("data-kit-group");
        const id = btn.getAttribute("data-kit");
        if (group === "home") setup.homeKit = id;
        else setup.awayKit = id;
        audio.ui();
        renderSetup(setup.ladder ? "ladder" : setup.twoPlayer ? "local" : setup.testMode ? "test" : "quick");
      });
    });
    root.querySelector("[data-act=kickoff]").addEventListener("click", startFromSetup);
    root.querySelector("[data-act=back]").addEventListener("click", () => {
      audio.ui();
      view = "menu";
      renderMenu();
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape") {
      if (game.phase === "playing") game.pause();
      else if (game.phase === "paused") game.resume();
    }
  });

  renderMenu();
  return { sync };
}
