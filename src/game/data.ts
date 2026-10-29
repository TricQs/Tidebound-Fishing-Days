export type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythic";

export type FishShape =
  | "fish"
  | "sunfish"
  | "perch"
  | "trout"
  | "koi"
  | "jelly"
  | "catfish"
  | "pike"
  | "angler"
  | "eel"
  | "oarfish";

export type DepthZoneId = "shallows" | "reeds" | "timber" | "abyss";

export type FightStyle = "steady" | "darter" | "heavy" | "erratic" | "acrobatic";

export type WeatherKind = "clear" | "rain" | "fog" | "storm" | "biolume";

export type MutationId = "none" | "albino" | "golden" | "luminescent" | "shadow" | "colossal" | "celestial";

export interface MutationDef {
  id: MutationId;
  name: string;
  badge: string;
  mult: number;
  odds: number; // base chance weight when mutation triggers
  colorOverride?: string;
  accentOverride?: string;
  glowColor: string;
}

export const MUTATIONS: Record<MutationId, MutationDef> = {
  none: {
    id: "none",
    name: "Normal",
    badge: "",
    mult: 1,
    odds: 0,
    glowColor: "transparent",
  },
  colossal: {
    id: "colossal",
    name: "Colossal",
    badge: "👑 GIANT",
    mult: 2.0,
    odds: 38,
    glowColor: "#f59e0b",
  },
  albino: {
    id: "albino",
    name: "Albino",
    badge: "✦ ALBINO",
    mult: 2.2,
    odds: 26,
    colorOverride: "#f4f1ea",
    accentOverride: "#e85d75",
    glowColor: "#fda4af",
  },
  luminescent: {
    id: "luminescent",
    name: "Neon Glow",
    badge: "⚡ NEON",
    mult: 2.6,
    odds: 18,
    colorOverride: "#2dd4bf",
    accentOverride: "#a7f3d0",
    glowColor: "#2dd4bf",
  },
  shadow: {
    id: "shadow",
    name: "Voidbound",
    badge: "☾ VOID",
    mult: 3.0,
    odds: 10,
    colorOverride: "#27233a",
    accentOverride: "#a855f7",
    glowColor: "#9333ea",
  },
  golden: {
    id: "golden",
    name: "24K Golden",
    badge: "★ GOLDEN",
    mult: 3.8,
    odds: 6,
    colorOverride: "#f5b82e",
    accentOverride: "#fff3b0",
    glowColor: "#facc15",
  },
  celestial: {
    id: "celestial",
    name: "Celestial",
    badge: "☄ CELESTIAL",
    mult: 5.5,
    odds: 2,
    colorOverride: "#818cf8",
    accentOverride: "#f472b6",
    glowColor: "#c084fc",
  },
};

export interface DepthZone {
  id: DepthZoneId;
  name: string;
  minX: number; // canvas X coordinate range
  maxX: number;
  depthM: [number, number];
  desc: string;
  color: string;
}

export const DEPTH_ZONES: DepthZone[] = [
  {
    id: "shallows",
    name: "Sunlit Shallows",
    minX: 45,
    maxX: 115,
    depthM: [1.2, 3.8],
    desc: "Warm dockside water with lily pads and panfish.",
    color: "#4da6a9",
  },
  {
    id: "reeds",
    name: "Whispering Reed Bed",
    minX: 115,
    maxX: 185,
    depthM: [4.0, 9.5],
    desc: "Submerged weeds where striped perch and bass ambush prey.",
    color: "#3b8ea5",
  },
  {
    id: "timber",
    name: "Sunken Timber Shelf",
    minX: 185,
    maxX: 250,
    depthM: [10.0, 18.5],
    desc: "Cold drop-off with drowned pines, trout, and prowling pike.",
    color: "#2c698d",
  },
  {
    id: "abyss",
    name: "Moonlit Trench",
    minX: 250,
    maxX: 316,
    depthM: [19.0, 42.0],
    desc: "Deep abyssal canyon home to ancient & bioluminescent leviathans.",
    color: "#1b435d",
  },
];

export function getZoneAtX(x: number): DepthZone {
  for (const z of DEPTH_ZONES) {
    if (x >= z.minX && x <= z.maxX) return z;
  }
  return x < DEPTH_ZONES[0]!.minX ? DEPTH_ZONES[0]! : DEPTH_ZONES[DEPTH_ZONES.length - 1]!;
}

export function getDepthAtX(x: number): number {
  const z = getZoneAtX(x);
  const t = Math.max(0, Math.min(1, (x - z.minX) / Math.max(1, z.maxX - z.minX)));
  return +(z.depthM[0] + (z.depthM[1] - z.depthM[0]) * t).toFixed(1);
}

export interface Species {
  id: string;
  name: string;
  scientific: string;
  rarity: Rarity;
  value: number; // base coins
  odds: number; // relative weight
  minW: number;
  maxW: number;
  color: string;
  accent: string;
  belly?: string;
  speed: number; // fight agility
  zone: number; // catch bar ratio
  hits: number; // legacy/tap compatibility + stamina tier
  stamina: number; // seconds of reeling needed
  fightStyle: FightStyle;
  shape: FishShape;
  zones: DepthZoneId[];
  blurb: string;
  rare?: boolean;
  night?: boolean;
  rain?: boolean;
  fog?: boolean;
}

export const SPECIES: Species[] = [
  {
    id: "bluegill",
    name: "Bluegill",
    scientific: "Lepomis macrochirus",
    rarity: "Common",
    value: 9,
    odds: 52,
    minW: 0.2,
    maxW: 0.9,
    color: "#5b8fb0",
    accent: "#e0a24a",
    belly: "#d9c29c",
    speed: 0.85,
    zone: 0.28,
    hits: 2,
    stamina: 3.2,
    fightStyle: "steady",
    shape: "sunfish",
    zones: ["shallows", "reeds"],
    blurb: "A friendly sunfish with an iridescent blue gill plate that loves dockside shade.",
  },
  {
    id: "pumpkinseed",
    name: "Redear Sunfish",
    scientific: "Lepomis microlophus",
    rarity: "Common",
    value: 12,
    odds: 44,
    minW: 0.25,
    maxW: 1.2,
    color: "#c98a3e",
    accent: "#d9453b",
    belly: "#f3dfb6",
    speed: 0.95,
    zone: 0.26,
    hits: 2,
    stamina: 3.5,
    fightStyle: "darter",
    shape: "sunfish",
    zones: ["shallows", "reeds"],
    blurb: "Dappled in warm amber with a bright crimson crescent near its operculum.",
  },
  {
    id: "perch",
    name: "Yellow Perch",
    scientific: "Perca flavescens",
    rarity: "Uncommon",
    value: 18,
    odds: 34,
    minW: 0.4,
    maxW: 1.8,
    color: "#a8b04a",
    accent: "#3d4a24",
    belly: "#e3dfc2",
    speed: 1.12,
    zone: 0.24,
    hits: 3,
    stamina: 4.2,
    fightStyle: "darter",
    shape: "perch",
    zones: ["shallows", "reeds", "timber"],
    blurb: "Armored in dark tiger bars and sharp dorsal spines. Schools near submerged reeds.",
  },
  {
    id: "bass",
    name: "Largemouth Bass",
    scientific: "Micropterus salmoides",
    rarity: "Uncommon",
    value: 26,
    odds: 28,
    minW: 0.9,
    maxW: 4.2,
    color: "#4f7754",
    accent: "#243b27",
    belly: "#d7e2ce",
    speed: 1.22,
    zone: 0.22,
    hits: 3,
    stamina: 4.8,
    fightStyle: "acrobatic",
    shape: "perch",
    zones: ["reeds", "timber"],
    blurb: "An aggressive ambush predator famous for tail-walking leaps when hooked.",
  },
  {
    id: "catfish",
    name: "Channel Catfish",
    scientific: "Ictalurus punctatus",
    rarity: "Uncommon",
    value: 30,
    odds: 24,
    minW: 1.4,
    maxW: 6.8,
    color: "#5c6b73",
    accent: "#2b353b",
    belly: "#c8d0d4",
    speed: 1.08,
    zone: 0.22,
    hits: 3,
    stamina: 5.4,
    fightStyle: "heavy",
    shape: "catfish",
    zones: ["reeds", "timber", "abyss"],
    blurb: "Uses sensitive barbels to prowl muddy drop-offs at dusk and during rainstorms.",
    rain: true,
  },
  {
    id: "trout",
    name: "Rainbow Trout",
    scientific: "Oncorhynchus mykiss",
    rarity: "Rare",
    value: 42,
    odds: 18,
    minW: 1.1,
    maxW: 5.2,
    color: "#8faec0",
    accent: "#e07a8a",
    belly: "#eef4f7",
    speed: 1.38,
    zone: 0.19,
    hits: 3,
    stamina: 5.6,
    fightStyle: "acrobatic",
    shape: "trout",
    zones: ["timber", "abyss"],
    blurb: "A shimmering streak of rose-pink along a speckled silver flank. Thrives in cold depths.",
  },
  {
    id: "pike",
    name: "Northern Pike",
    scientific: "Esox lucius",
    rarity: "Rare",
    value: 58,
    odds: 14,
    minW: 2.2,
    maxW: 9.5,
    color: "#3f6a4e",
    accent: "#d6cf8e",
    belly: "#e5ead7",
    speed: 1.52,
    zone: 0.18,
    hits: 4,
    stamina: 6.2,
    fightStyle: "darter",
    shape: "pike",
    zones: ["reeds", "timber"],
    blurb: "A torpedo-shaped water wolf that strikes lures with explosive velocity.",
    rare: true,
  },
  {
    id: "eel",
    name: "Stormglass Eel",
    scientific: "Anguilla fulgura",
    rarity: "Rare",
    value: 68,
    odds: 11,
    minW: 0.8,
    maxW: 3.6,
    color: "#2e4b63",
    accent: "#64dfdf",
    belly: "#a8dadc",
    speed: 1.58,
    zone: 0.18,
    hits: 4,
    stamina: 6.0,
    fightStyle: "erratic",
    shape: "eel",
    zones: ["timber", "abyss"],
    blurb: "crackles with faint bio-static charge when rain lashes the lake surface.",
    rare: true,
    rain: true,
    night: true,
  },
  {
    id: "koi",
    name: "Imperial Golden Koi",
    scientific: "Cyprinus rubrofuscus",
    rarity: "Epic",
    value: 105,
    odds: 6,
    minW: 2.4,
    maxW: 8.0,
    color: "#f0b43c",
    accent: "#fff1c4",
    belly: "#fde68a",
    speed: 1.65,
    zone: 0.16,
    hits: 4,
    stamina: 6.8,
    fightStyle: "steady",
    shape: "koi",
    zones: ["shallows", "reeds", "timber"],
    blurb: "An ancient metallic carp with flowing veil fins. Said to bring a lifetime of calm mornings.",
    rare: true,
  },
  {
    id: "sakurakoi",
    name: "Sakura Spirit Carp",
    scientific: "Cyprinusitos hanami",
    rarity: "Epic",
    value: 135,
    odds: 4.5,
    minW: 1.8,
    maxW: 6.5,
    color: "#f48fb1",
    accent: "#fff5f8",
    belly: "#fce4ec",
    speed: 1.72,
    zone: 0.16,
    hits: 4,
    stamina: 7.2,
    fightStyle: "acrobatic",
    shape: "koi",
    zones: ["reeds", "timber", "abyss"],
    blurb: "Its scales drift like cherry blossoms through misty waters at dawn and dusk.",
    rare: true,
    fog: true,
  },
  {
    id: "anglerfish",
    name: "Abyssal Lanternfish",
    scientific: "Melanocetus lacustris",
    rarity: "Epic",
    value: 155,
    odds: 3.8,
    minW: 1.5,
    maxW: 7.2,
    color: "#232946",
    accent: "#72efdd",
    belly: "#393e6f",
    speed: 1.78,
    zone: 0.15,
    hits: 4,
    stamina: 7.5,
    fightStyle: "erratic",
    shape: "angler",
    zones: ["abyss"],
    blurb: "Dangles a hypnotic bioluminescent bulb in the pitch-black trench.",
    rare: true,
    night: true,
  },
  {
    id: "moonjelly",
    name: "Moon Jelly",
    scientific: "Aurelia noctiluca",
    rarity: "Legendary",
    value: 210,
    odds: 2.2,
    minW: 0.15,
    maxW: 0.8,
    color: "#c9b8f0",
    accent: "#f6efff",
    belly: "#e9d5ff",
    speed: 1.88,
    zone: 0.14,
    hits: 4,
    stamina: 7.8,
    fightStyle: "erratic",
    shape: "jelly",
    zones: ["timber", "abyss"],
    blurb: "A translucent drifting bell of starlight that only rises when the moon is high.",
    rare: true,
    night: true,
  },
  {
    id: "coelacanth",
    name: "Fossil Coelacanth",
    scientific: "Latimeria primordia",
    rarity: "Legendary",
    value: 290,
    odds: 1.4,
    minW: 8.0,
    maxW: 28.0,
    color: "#355070",
    accent: "#b5e2fa",
    belly: "#6d8ea0",
    speed: 1.92,
    zone: 0.14,
    hits: 5,
    stamina: 8.6,
    fightStyle: "heavy",
    shape: "perch",
    zones: ["abyss"],
    blurb: "A lobe-finned living fossil armored in cosmoid scales from a forgotten era.",
    rare: true,
    night: true,
    fog: true,
  },
  {
    id: "oarfish",
    name: "Tidebound Leviathan",
    scientific: "Regalecusabyssus rex",
    rarity: "Mythic",
    value: 480,
    odds: 0.65,
    minW: 14.0,
    maxW: 55.0,
    color: "#80ffdb",
    accent: "#ff4d6d",
    belly: "#e0fbfc",
    speed: 2.08,
    zone: 0.13,
    hits: 5,
    stamina: 9.8,
    fightStyle: "erratic",
    shape: "oarfish",
    zones: ["abyss"],
    blurb: "A ribbon-crowned sovereign of the deep trench. Seeing one is a once-in-a-lifetime omen.",
    rare: true,
    night: true,
    rain: true,
  },
];

export const RARITY_COLOR: Record<Rarity, string> = {
  Common: "var(--rarity-common)",
  Uncommon: "var(--rarity-uncommon)",
  Rare: "var(--rarity-rare)",
  Epic: "var(--rarity-epic)",
  Legendary: "var(--rarity-legendary)",
  Mythic: "var(--rarity-mythic)",
};

export const ROD_PRICES = [60, 160, 340, 680, 1400];
export const LURE_PRICES = [80, 200, 420, 820, 1650];
export const BOAT_PRICES = [120, 380, 900];

export const ROD_NAMES = [
  "Driftwood Rod",
  "Willow Whip Rod",
  "Cedar Split-Cane",
  "Carbon ProCaster",
  "Starlight Fiberglass",
  "Abyssal Sovereign Rod",
];

export const ROD_DESCS = [
  "Simple shore branch with cotton line.",
  "+15% Catch Bar width & smoother drag.",
  "+30% Catch Bar, higher line tension limit.",
  "Precision graphite blank. Longer casts & +45% bar.",
  "Moon-forged guides. Tames Legendary & Mythic thrashing.",
  "Masterwork deep-sea rod. Maximum control & tension strength.",
];

export const LURE_NAMES = [
  "Plain Iron Hook",
  "Lucky Mallard Feather",
  "Glimmer Brass Spoon",
  "Ruby Crankbait",
  "Moonstone Jig",
  "Prismatic Apex Lure",
];

export const LURE_DESCS = [
  "Basic bent hook. Fish take their time.",
  "+35% Rare fish attraction & faster nibbles.",
  "Flashes underwater. +75% Rare & +10% Mutation chance.",
  "Realistic swimming wobble. +120% Rare & +18% Mutation.",
  "Glows in deep trenches. +180% Rare & +28% Mutation.",
  "Iridescent relic. Massive Mythic & Celestial mutation boost!",
];

export const BOAT_NAMES = [
  "Weathered Rowboat",
  "Varnished Lake Skiff",
  "Lantern Canopy Boat",
  "Tidebound Steam Launch",
];

export const BOAT_DESCS = [
  "Slow wooden oars. Gets you across the lake.",
  "Sleek hull (+45% move speed) & mounted night lantern.",
  "Rain canopy, fish-finder sonar & +85% cruising speed.",
  "Brass engine, deep-trench sonar & +20% trophy weight aura!",
];

export interface BaitDef {
  id: string;
  name: string;
  price: number;
  bundle: number;
  biteSpeed: number; // multiplier on wait time
  rareMult: number;
  mutationMult: number;
  desc: string;
  icon: string;
}

export const BAITS: BaitDef[] = [
  {
    id: "worm",
    name: "Redigger Worm",
    price: 20,
    bundle: 8,
    biteSpeed: 1.35,
    rareMult: 1.15,
    mutationMult: 1.1,
    desc: "+35% faster bites & +15% rare luck.",
    icon: "🪱",
  },
  {
    id: "cricket",
    name: "Dew Cricket",
    price: 45,
    bundle: 8,
    biteSpeed: 1.5,
    rareMult: 1.45,
    mutationMult: 1.4,
    desc: "+50% faster bites & +45% rare species odds.",
    icon: "🦗",
  },
  {
    id: "minnow",
    name: "Silver Shiner",
    price: 95,
    bundle: 6,
    biteSpeed: 1.65,
    rareMult: 2.1,
    mutationMult: 1.8,
    desc: "Live bait that predators love! 2.1x Rare & 1.8x Mutation.",
    icon: "🐟",
  },
  {
    id: "starbait",
    name: "Luminous Roe",
    price: 210,
    bundle: 5,
    biteSpeed: 1.9,
    rareMult: 3.2,
    mutationMult: 3.0,
    desc: "Glowing deep-sea delicacy. 3.2x Rare & 3x Mutation chance!",
    icon: "✨",
  },
];

export interface Quest {
  text: string;
  kind: "catch" | "sell" | "upgrade" | "mutant" | "zone";
  species?: string;
  zone?: DepthZoneId;
  goal: number;
  reward: number;
}

export const QUESTS: Quest[] = [
  { text: "Catch 3 fish in the lake", kind: "catch", goal: 3, reward: 35 },
  { text: "Catch a Yellow Perch", kind: "catch", species: "perch", goal: 1, reward: 30 },
  { text: "Sell 5 fish at Willow Dock", kind: "sell", goal: 5, reward: 45 },
  { text: "Buy any gear upgrade at the Dock", kind: "upgrade", goal: 1, reward: 60 },
  { text: "Row out and catch 2 fish in Sunken Timber", kind: "zone", zone: "timber", goal: 2, reward: 70 },
  { text: "Catch a Rainbow Trout", kind: "catch", species: "trout", goal: 1, reward: 80 },
  { text: "Catch any Mutated / Variant fish", kind: "mutant", goal: 1, reward: 110 },
  { text: "Catch 15 fish total", kind: "catch", goal: 15, reward: 120 },
  { text: "Catch a Northern Pike", kind: "catch", species: "pike", goal: 1, reward: 140 },
  { text: "Catch an Imperial Golden Koi", kind: "catch", species: "koi", goal: 1, reward: 180 },
  { text: "Explore the Moonlit Trench & catch 3 deep fish", kind: "zone", zone: "abyss", goal: 3, reward: 220 },
  { text: "Catch a Moon Jelly at night", kind: "catch", species: "moonjelly", goal: 1, reward: 320 },
  { text: "Catch a Fossil Coelacanth in the Trench", kind: "catch", species: "coelacanth", goal: 1, reward: 450 },
  { text: "Catch the Mythic Tidebound Leviathan", kind: "catch", species: "oarfish", goal: 1, reward: 800 },
];

export interface CaughtFish {
  uid: number;
  id: string;
  weight: number;
  value: number;
  mutation?: MutationId;
  locked?: boolean;
  hasChest?: boolean;
  chestCoins?: number;
}

export interface Save {
  coins: number;
  xp: number;
  level: number;
  rod: number;
  lure: number;
  boat: number;
  activeBait: string | null;
  baits: Record<string, number>;
  bag: CaughtFish[];
  aquarium: CaughtFish[];
  journal: Record<string, { count: number; best: number; mutations?: MutationId[] }>;
  quest: number;
  questProg: number;
  tutorialDone: boolean;
  hints: boolean;
  totalCaught: number;
  streak: number;
  bestStreak: number;
  perfectCasts: number;
  chestsOpened: number;
}

export const NEW_SAVE: Save = {
  coins: 20,
  xp: 0,
  level: 1,
  rod: 0,
  lure: 0,
  boat: 0,
  activeBait: null,
  baits: { worm: 3 },
  bag: [],
  aquarium: [],
  journal: {},
  quest: 0,
  questProg: 0,
  tutorialDone: false,
  hints: true,
  totalCaught: 0,
  streak: 0,
  bestStreak: 0,
  perfectCasts: 0,
  chestsOpened: 0,
};

export const xpFor = (lvl: number) => 40 + lvl * 30;
