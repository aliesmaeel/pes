# Strike 3D

Arcade football in the browser. Charge a shot, time a tackle, beat the clock.

Built with [Three.js](https://threejs.org/) and [cannon-es](https://github.com/pmndrs/cannon-es).

## Requirements

- Node.js 18 or newer
- A keyboard (gamepad is not required)

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

```bash
npm run build    # production bundle
npm run preview  # serve the built files
```

## Game modes

| Mode | What it is |
| --- | --- |
| **Quick match** | 1v1 or 3v3 against AI. Pick difficulty. |
| **Local versus** | Two players on one keyboard. |
| **Test mode** | No clock, no opponent. Solo or with AI teammates. |
| **Ladder** | Ranked run. Difficulty locks to your rank. |

Kits unlock with ladder wins (Gold, Midnight, Teal, Violet).

## Controls

### Player 1 (home)

| Key | Action |
| --- | --- |
| Arrow keys | Move and aim |
| **S** | Pass |
| **D** | Shoot (hold to charge) |
| **W** | Through ball |
| **A** | Slide tackle |
| **E** | Sprint (default movement is a slower run) |
| **Space** | Jump / header |
| **Tab** or **Q** | Switch player in 3v3 |
| **Esc** | Pause |

Shift also sprints. With the ball you are a little slower than without it.

### Player 2 (away)

| Key | Action |
| --- | --- |
| **I J K L** or numpad | Move |
| **H** | Pass |
| **N** | Shoot |
| **U** | Through ball |
| **M** | Slide |
| **/** | Jump |

The yellow ring is you. The green ring is the pass target. Aim roughly at a teammate and tap pass — you take control of that player as the ball arrives.

## Play tips

- Hold **D** to charge. Longer charge is harder and flatter, not mostly higher.
- Jump near an aerial ball to header.
- Teammates spread out while you have the ball instead of crowding you.
- The near-camera wall is see-through so the ball stays visible.

## Project layout

```
src/
  config.js          Speeds, pitch size, kits, difficulty
  audio.js           Web Audio bus
  ui/app.js          Menus and HUD
  game/
    Game.js          Match loop, passing, shooting, possession
    player.js        Movement, stamina, jump, tackle
    animator.js      Run, kick, jump poses
    physics.js       Cannon world, walls, ball
    pitch.js         Field, goals, graffiti walls
    ai.js            Teammate and opponent AI
    input.js         Keyboard maps
    camera.js        Follow camera
    playerModel.js   Skinned GLB load + team colors
    animationController.js  Clip crossfades
```

Player visuals load from `src/assets/player.glb` (Mixamo Idle / Walk / Run). See `CREDITS.md`. Replace that file with a Mixamo-rigged soccer mesh to change the look without touching gameplay.

Progress (wins, losses, kits) is stored in the browser under `strike3d-career`.
