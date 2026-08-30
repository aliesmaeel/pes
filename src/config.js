export const COLORS = {
  primary: "#DC2626",
  secondary: "#2563EB",
  accent: "#22C55E",
  background: "#0A1220",
  foreground: "#F8FAFC",
  muted: "#94A3B8",
};

export const KITS = {
  crimson: { name: "Crimson", jersey: 0xdc2626, shorts: 0xffffff, socks: 0xdc2626, trim: 0xf8fafc },
  cobalt: { name: "Cobalt", jersey: 0x2563eb, shorts: 0xffffff, socks: 0x1d4ed8, trim: 0xf8fafc },
  gold: { name: "Gold", jersey: 0xeab308, shorts: 0x111827, socks: 0xeab308, trim: 0x111827 },
  midnight: { name: "Midnight", jersey: 0x111827, shorts: 0x111827, socks: 0xf8fafc, trim: 0x22c55e },
  teal: { name: "Teal", jersey: 0x0d9488, shorts: 0xf8fafc, socks: 0x0f766e, trim: 0xf8fafc },
  violet: { name: "Violet", jersey: 0x7c3aed, shorts: 0xf8fafc, socks: 0x5b21b6, trim: 0xf8fafc },
};

export const KIT_UNLOCKS = {
  crimson: 0,
  cobalt: 0,
  gold: 1,
  midnight: 3,
  teal: 6,
  violet: 10,
};

export const PITCH = {
  length: 52,
  width: 34,
  goalWidth: 7.2,
  goalHeight: 2.44,
  goalDepth: 1.7,
  lineWidth: 0.12,
  wallHeight: 7.4,
};

export const BALL = {
  radius: 0.28,
  mass: 0.45,
};

export const PLAYER = {
  radius: 0.42,
  height: 1.82,
  mass: 78,
  walkSpeed: 8.6,
  runSpeed: 8.6,
  sprintSpeed: 11.6,
  onBallSpeed: 0.86,
  accel: 28,
  staminaMax: 100,
  staminaDrain: 28,
  staminaRegen: 16,
  kickChargeMax: 1.15,
  passPower: 20,
  throughPower: 24,
  passArriveSpeed: 11,
  passMaxRange: 36,
  shotPowerMin: 9,
  shotPowerMax: 38,
  jumpSpeed: 7.2,
  tackleSpeed: 13.5,
  tackleDuration: 0.42,
  tackleCooldown: 1.35,
  controlRadius: 2.05,
  controlKeepRadius: 2.55,
  stealRadius: 1.15,
  dribbleHold: 0.72,
  kickReach: 2.35,
  firstTouchReach: 3.8,
  passAssistDot: 0.22,
};

export const MATCH = {
  duration: 90,
  kickoffDelay: 3,
  goalHold: 2.6,
};

export const DIFFICULTY = {
  easy: { label: "Amateur", reaction: 0.42, accuracy: 0.38, speed: 0.78, press: 0.45, shootRange: 11 },
  medium: { label: "Pro", reaction: 0.18, accuracy: 0.66, speed: 0.94, press: 0.72, shootRange: 13 },
  hard: { label: "Elite", reaction: 0.06, accuracy: 0.86, speed: 1.04, press: 0.95, shootRange: 15 },
  legend: { label: "Legend", reaction: 0.02, accuracy: 0.93, speed: 1.1, press: 1, shootRange: 16 },
};

export const RANKS = [
  { id: "amateur", label: "Amateur", wins: 0, difficulty: "easy" },
  { id: "pro", label: "Pro", wins: 2, difficulty: "medium" },
  { id: "elite", label: "Elite", wins: 5, difficulty: "hard" },
  { id: "legend", label: "Legend", wins: 9, difficulty: "legend" },
];
