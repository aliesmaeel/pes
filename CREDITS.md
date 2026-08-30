# Credits

## Player character

The in-game skinned character is the **Vanguard / Soldier** Mixamo rig distributed with the [Three.js](https://github.com/mrdoob/three.js) examples (`examples/models/gltf/Soldier.glb`, r170).

- Animations: Idle, Walk, Run (Mixamo)
- Three.js is MIT licensed

To swap in the intended football mesh, follow the Mixamo + Blender steps in the player-model handoff and replace `src/assets/player.glb`. Keep the same clip names where possible (`Idle`, `Walk`, `Run`, plus optional `Jump` / kick / slide / celebrate). The loader matches those names automatically.

## Extra Mixamo clips (optional)

`player.glb` only ships Idle / Walk / Run. Drop Mixamo-skeleton clips (no Blender merge required) as:

- `src/assets/kick.glb` or `src/assets/kick.fbx`
- `src/assets/slide.glb` / `tackle.fbx`
- `src/assets/jump.glb`
- `src/assets/pass.glb`
- `src/assets/celebrate.glb`
- or any of those names under `src/assets/anims/`

**Sources (download yourself — accounts required, files are not bundled):**

1. [Mixamo](https://www.mixamo.com) — search Kick, Jump, Slide / Dive. Same `mixamorig` skeleton as this rig. Download FBX, **without skin**.
2. [Rokoko 12 free sports animations](https://www.rokoko.com/resources/rokoko-mocap-12-free-sports-animations) — Mixamo skeleton, email signup for the Drive folder.
3. [MoCap Online free FBX sample pack](https://mocaponline.com/blogs/mocap-news/free-fbx-animations) — biped sample; their paid football pack is the sport-specific set.

Until those files are present, kick / pass / slide / jump use procedural bone poses.

Bundled Mixamo clips (same skeleton as `player.glb`):

- **Kick** — Strike Forward Jog (`src/assets/anims/kick.fbx`)
- **Pass** — Soccer Pass (`src/assets/anims/pass.fbx`)
- **Stand up** — Standing Up (`src/assets/anims/standup.fbx`, plays after slide tackle)
- **Tackle** — Soccer Tackle (`src/assets/anims/tackle.fbx`, merged at runtime as `Tackle`)
- **Jump** — Soccer Header (`src/assets/anims/header.fbx`)

## Intended soccer mesh (optional replacement)

[Low Poly Soccer Player](https://sketchfab.com/3d-models/low-poly-soccer-player-45270d99f19d45fab208a70d1929469f) by PropShop™ (@syedabbas0815) on Sketchfab, [CC BY](https://creativecommons.org/licenses/by/4.0/).
