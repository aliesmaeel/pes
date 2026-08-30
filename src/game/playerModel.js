import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { PLAYER } from "../config.js";
import playerUrl from "../assets/player.glb?url";
import { attachPlayerOverlays } from "./mesh.js";

let cached = null;
let loadPromise = null;

function clipName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function pickClip(clips, aliases) {
  const wanted = aliases.map(clipName);
  return (
    clips.find((c) => wanted.includes(clipName(c.name))) ||
    clips.find((c) => wanted.some((w) => clipName(c.name).includes(w))) ||
    null
  );
}

function collectBones(root) {
  const bones = {};
  root.traverse((obj) => {
    if (!obj.isBone) return;
    bones[obj.name.replace(/^mixamorig:/, "")] = obj;
  });
  return bones;
}

function findBone(root, needles) {
  let found = null;
  root.traverse((obj) => {
    if (found || !obj.isBone) return;
    const n = clipName(obj.name);
    if (needles.some((needle) => n.includes(clipName(needle)))) found = obj;
  });
  return found;
}

function tintJersey(root, kit) {
  const jerseyHints = ["jersey", "shirt", "torso", "body", "kit", "vanguardbody"];
  const skipHints = ["visor", "eye", "hair", "boot", "shoe", "skin"];
  const targets = [];
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((mat, i) => {
      if (!mat) return;
      const name = clipName(mat.name);
      if (skipHints.some((h) => name.includes(h))) return;
      if (jerseyHints.some((h) => name.includes(h)) || targets.length === 0) {
        const clone = mat.clone();
        clone.color = new THREE.Color(kit.jersey);
        if (Array.isArray(obj.material)) obj.material[i] = clone;
        else obj.material = clone;
        targets.push(clone);
      }
    });
  });
}

function attachNumber(root, number) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 36px Orbitron, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number), 32, 34);
  const num = new THREE.Mesh(
    new THREE.PlaneGeometry(0.22, 0.22),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true })
  );
  const spine = findBone(root, ["spine2", "spine1", "spine"]);
  num.position.set(0, 0.12, -0.16);
  if (spine) spine.add(num);
  else {
    num.position.set(0, 1.15, -0.18);
    root.add(num);
  }
}

function fitHeight(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y < 0.2) return;
  model.scale.multiplyScalar(PLAYER.height / size.y);
  box.setFromObject(model);
  model.position.y -= box.min.y;
}

export function loadPlayerModel() {
  if (cached) return Promise.resolve(cached);
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      playerUrl,
      (gltf) => {
        const names = gltf.animations.map((c) => c.name);
        console.info("[player.glb] clips:", names);
        cached = { scene: gltf.scene, animations: gltf.animations, names };
        resolve(cached);
      },
      undefined,
      reject
    );
  });
  return loadPromise;
}

export function isPlayerModelReady() {
  return !!cached;
}

export function createPlayerModel({ kit, number }) {
  if (!cached) throw new Error("Player model not loaded. Call loadPlayerModel() first.");
  const cloned = SkeletonUtils.clone(cached.scene);
  cloned.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.frustumCulled = false;
    }
  });
  tintJersey(cloned, kit);
  fitHeight(cloned);
  attachNumber(cloned, number);
  cloned.rotation.y = Math.PI;

  const root = new THREE.Group();
  root.add(cloned);

  const mixer = new THREE.AnimationMixer(cloned);
  const clips = cached.animations;
  const actions = {
    idle: pickClip(clips, ["idle"]) && mixer.clipAction(pickClip(clips, ["idle"])),
    walk: pickClip(clips, ["walk", "walking"]) && mixer.clipAction(pickClip(clips, ["walk", "walking"])),
    run: pickClip(clips, ["run", "running", "sprint"]) && mixer.clipAction(pickClip(clips, ["run", "running", "sprint"])),
    jump: pickClip(clips, ["jump"]) && mixer.clipAction(pickClip(clips, ["jump"])),
    kick: pickClip(clips, ["kick", "soccerpass", "attack"]) && mixer.clipAction(pickClip(clips, ["kick", "soccerpass", "attack"])),
    slide: pickClip(clips, ["slide", "tackle", "fall"]) && mixer.clipAction(pickClip(clips, ["slide", "tackle", "fall"])),
    celebrate: pickClip(clips, ["celebrate", "dance", "victory"]) && mixer.clipAction(pickClip(clips, ["celebrate", "dance", "victory"])),
  };

  const overlays = attachPlayerOverlays(root, { number, markerY: PLAYER.height + 0.45 });
  return { root, mixer, actions, bones: collectBones(cloned), ...overlays };
}
