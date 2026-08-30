/**
 * Bake Mixamo FBX clips into player.glb (Blender-free equivalent of handoff Part A).
 * Run: npm run merge-player
 */
import { readFile, writeFile, copyFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

globalThis.self = globalThis;
globalThis.window = globalThis;
if (!globalThis.createImageBitmap) {
  globalThis.createImageBitmap = async () => ({ close() {} });
}
if (!globalThis.document) {
  globalThis.document = {
    createElement(type) {
      const el = {
        width: 4,
        height: 4,
        style: {},
        getContext() {
          return {
            fillRect() {},
            drawImage() {},
            getImageData() {
              return { data: new Uint8ClampedArray(16) };
            },
          };
        },
        toDataURL() {
          return "data:image/png;base64,AAAA";
        },
      };
      return el;
    },
  };
}
if (!globalThis.FileReader) {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      Promise.resolve(blob.arrayBuffer()).then((buf) => {
        this.result = buf;
        this.onloadend?.();
      });
    }
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ASSETS = path.join(ROOT, "src/assets");
const PLAYER_GLB = path.join(ASSETS, "player.glb");
const BACKUP_GLB = path.join(ASSETS, "player-base.glb");

const FBX_CLIPS = [
  { file: "anims/kick.fbx", role: "Kick" },
  { file: "anims/tackle.fbx", role: "Tackle" },
  { file: "anims/pass.fbx", role: "Pass" },
  { file: "anims/header.fbx", role: "Jump" },
  { file: "anims/standup.fbx", role: "StandUp" },
];

const GROUND_LOCKED = new Set(["Kick", "Pass"]);

function clipKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function boneNames(root) {
  const names = new Set();
  root.traverse((obj) => {
    if (obj.isBone) names.add(obj.name);
  });
  return names;
}

function normalizeBone(name) {
  return String(name || "").replace(/^mixamorig:?/, "");
}

function mapBone(sourceName, targetNames) {
  if (targetNames.has(sourceName)) return sourceName;
  const bare = normalizeBone(sourceName);
  for (const target of targetNames) {
    if (normalizeBone(target) === bare) return target;
  }
  return null;
}

function remapClip(clip, targetNames) {
  const remapped = clip.clone();
  remapped.tracks = remapped.tracks
    .map((track) => {
      const [node, ...rest] = track.name.split(".");
      const mapped = mapBone(node, targetNames);
      if (!mapped) return null;
      const next = track.clone();
      next.name = [mapped, ...rest].join(".");
      return next;
    })
    .filter(Boolean);
  return remapped.tracks.length ? remapped : null;
}

function sanitizeClip(clip, role) {
  const out = clip.clone();
  if (role === "Tackle" || role === "StandUp") {
    out.tracks = out.tracks.filter((track) => {
      const [bone, prop] = track.name.split(".");
      if (normalizeBone(bone) !== "Hips") return true;
      return prop !== "position";
    });
    return out;
  }
  if (!GROUND_LOCKED.has(role)) return out;
  out.tracks = out.tracks.filter((track) => normalizeBone(track.name.split(".")[0]) !== "Hips");
  return out;
}

function adoptClip(clip, targetScene, sourceScene, role, SkeletonUtils) {
  const targetNames = boneNames(targetScene);
  const remapped = remapClip(clip, targetNames);
  if (remapped?.tracks?.length >= 4) {
    remapped.name = role;
    return remapped;
  }
  try {
    const retargeted = SkeletonUtils.retargetClip(targetScene, sourceScene, clip, {
      hip: "mixamorigHips",
    });
    if (retargeted?.tracks?.length) {
      retargeted.name = role;
      return retargeted;
    }
  } catch {
    /* fallback */
  }
  if (remapped) {
    remapped.name = role;
    return remapped;
  }
  clip.name = role;
  return clip;
}

async function loadGlb(filePath, GLTFLoader) {
  const buf = await readFile(filePath);
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(buf.buffer, path.dirname(filePath) + "/", resolve, reject);
  });
}

async function loadFbx(filePath, FBXLoader) {
  const buf = await readFile(filePath);
  const loader = new FBXLoader();
  return loader.parse(buf.buffer, path.dirname(filePath) + "/");
}

async function exportGlb(scene, animations, GLTFExporter) {
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => resolve(result),
      (err) => reject(err),
      { binary: true, animations }
    );
  });
}

async function main() {
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
  const SkeletonUtils = await import("three/addons/utils/SkeletonUtils.js");

  console.log("Loading base", PLAYER_GLB);
  const gltf = await loadGlb(PLAYER_GLB, GLTFLoader);
  const clips = [...gltf.animations];
  const seen = new Set(clips.map((c) => clipKey(c.name)));
  console.log("Base clips:", clips.map((c) => c.name).join(", "));

  for (const { file, role } of FBX_CLIPS) {
    const fbxPath = path.join(ASSETS, file);
    if (seen.has(clipKey(role))) {
      console.log(`Skip ${role} (already in glb)`);
      continue;
    }
    console.log(`Merging ${file} → ${role}`);
    const fbx = await loadFbx(fbxPath, FBXLoader);
    const incoming = fbx.animations?.length ? fbx.animations : [];
    if (!incoming.length) {
      console.warn(`  No animations in ${file}`);
      continue;
    }
    for (const clip of incoming) {
      if (seen.has(clipKey(role))) continue;
      const adopted = adoptClip(clip, gltf.scene, fbx, role, SkeletonUtils);
      if (!adopted) {
        console.warn(`  Failed to adopt ${role}`);
        continue;
      }
      clips.push(sanitizeClip(adopted, role));
      seen.add(clipKey(role));
    }
  }

  console.log("Merged clips:", clips.map((c) => c.name).join(", "));

  gltf.scene.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat) continue;
      for (const key of Object.keys(mat)) {
        if (mat[key]?.isTexture) mat[key] = null;
      }
    }
  });

  try {
    await copyFile(PLAYER_GLB, BACKUP_GLB);
    console.log("Backed up to player-base.glb");
  } catch {
    /* first run */
  }

  const glb = await exportGlb(gltf.scene, clips, GLTFExporter);
  await writeFile(PLAYER_GLB, Buffer.from(glb));
  console.log(`Wrote ${PLAYER_GLB} (${clips.length} clips)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
