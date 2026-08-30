import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

const extraUrls = {
  ...import.meta.glob("../assets/{kick,slide,jump,pass,tackle,celebrate,standup}.{glb,gltf,fbx}", {
    eager: true,
    query: "?url",
    import: "default",
  }),
  ...import.meta.glob("../assets/anims/*.{glb,gltf,fbx}", {
    eager: true,
    query: "?url",
    import: "default",
  }),
};

function clipKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function roleFromUrl(url) {
  const file = decodeURIComponent(url.split("/").pop().split("?")[0]);
  const n = clipKey(file.replace(/\.(glb|gltf|fbx)$/i, ""));
  if (/(pass|passing)/.test(n)) return "Pass";
  if (/(standup|standingup|getup)/.test(n)) return "StandUp";
  if (/(slide|tackle|dive|fall)/.test(n)) return "Tackle";
  if (/(kick|soccer|strike|shoot)/.test(n)) return "Kick";
  if (/(jump|header)/.test(n)) return "Jump";
  if (/(celeb|dance|victory|win)/.test(n)) return "Celebrate";
  return null;
}

function roleFromClipName(name) {
  const n = clipKey(name);
  if (/(pass|passing)/.test(n)) return "Pass";
  if (/(standup|standingup|getup)/.test(n)) return "StandUp";
  if (/(slide|tackle|dive|fall)/.test(n)) return "Tackle";
  if (/(kick|soccer|strike|shoot)/.test(n)) return "Kick";
  if (/(jump|header)/.test(n)) return "Jump";
  if (/(celeb|dance|victory|win)/.test(n)) return "Celebrate";
  return null;
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

// Mixamo kick/pass clips drive Hips root motion and tip the mesh sideways.
// Tackle/stand-up: strip hips translation only (keep bone pose).
const GROUND_LOCKED = new Set(["Kick", "Pass"]);

// Kick/pass: strip hips entirely (root motion tips the mesh sideways).
// Slide: keep hips rotation for horizontal tackle, drop hips translation (lifts off turf).
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

function adoptClip(clip, targetScene, sourceScene, role) {
  const targetNames = boneNames(targetScene);
  const remapped = remapClip(clip, targetNames);
  if (remapped && remapped.tracks.length >= 4) {
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
    /* keep remapped or raw */
  }
  if (remapped) {
    remapped.name = role;
    return remapped;
  }
  clip.name = role;
  return clip;
}

function loadUrl(url) {
  return new Promise((resolve) => {
    const isFbx = /\.fbx(\?|$)/i.test(url);
    const loader = isFbx ? new FBXLoader() : new GLTFLoader();
    loader.load(
      url,
      (asset) => resolve(asset),
      undefined,
      (err) => {
        console.warn("Optional animation failed to load:", url, err);
        resolve(null);
      }
    );
  });
}

export async function mergeExtraClips(baseGltf) {
  const urls = Object.values(extraUrls).filter(Boolean);
  if (!urls.length) return baseGltf.animations;
  const clips = [...baseGltf.animations];
  const seen = new Set(clips.map((c) => clipKey(c.name)));

  for (const url of urls) {
    const asset = await loadUrl(url);
    if (!asset) continue;
    const scene = asset.scene || asset;
    const incoming = asset.animations || [];
    const fallbackRole = roleFromUrl(url);
    for (const clip of incoming) {
      const role = roleFromClipName(clip.name) || fallbackRole;
      if (!role || seen.has(clipKey(role))) continue;
      const adopted = adoptClip(clip, baseGltf.scene, scene, role);
      if (!adopted) continue;
      clips.push(sanitizeClip(adopted, role));
      seen.add(clipKey(role));
    }
  }
  return clips;
}
