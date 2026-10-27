export type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";

export interface Species {
  id: string;
  name: string;
  rarity: Rarity;
  value: number; // base coins
  odds: number; // relative weight
  minW: number;
  maxW: number;
  color: string;
  accent: string;
  speed: number; // reel marker speed
  zone: number; // sweet spot size
  hits: number;
  shape: "fish" | "jelly";
  blurb: string;
  rare?: boolean;
  night?: boolean;
}

export const SPECIES: Species[] = [
  { id: "bluegill", name: "Bluegill", rarity: "Common", value: 8, odds: 50, minW: 0.2, maxW: 0.8, color: "#5b8fb0", accent: "#e0a24a", speed: 0.9, zone: 0.26, hits: 2, shape: "fish", blurb: "A friendly little sunfish that loves the shallows." },
  { id: "perch", name: "Perch", rarity: "Uncommon", value: 15, odds: 30, minW: 0.4, maxW: 1.6, color: "#a8b04a", accent: "#3d4a24", speed: 1.15, zone: 0.22, hits: 3, shape: "fish", blurb: "Striped and stubborn. Bites best in the morning light." },
  { id: "trout", name: "Rainbow Trout", rarity: "Rare", value: 35, odds: 15, minW: 1.0, maxW: 4.5, color: "#9fb6c4", accent: "#e07a8a", speed: 1.45, zone: 0.18, hits: 3, shape: "fish", blurb: "A shimmering streak of pink along its silver flank." },
  { id: "koi", name: "Golden Koi", rarity: "Epic", value: 90, odds: 4, minW: 2.0, maxW: 7.0, color: "#f0b43c", accent: "#fff1c4", speed: 1.75, zone: 0.15, hits: 4, shape: "fish", blurb: "Said to bring a lifetime of calm mornings.", rare: true },
  { id: "moonjelly", name: "Moon Jelly", rarity: "Legendary", value: 180, odds: 1, minW: 0.1, maxW: 0.5, color: "#c9b8f0", accent: "#f6efff", speed: 2.0, zone: 0.13, hits: 4, shape: "jelly", blurb: "A drifting glow that only rises when the moon is up.", rare: true, night: true },
];

export const RARITY_COLOR: Record<Rarity, string> = {
  Common: "var(--rarity-common)",
  Uncommon: "var(--rarity-uncommon)",
  Rare: "var(--rarity-rare)",
  Epic: "var(--rarity-epic)",
  Legendary: "var(--rarity-legendary)",
};

export const ROD_PRICES = [60, 160, 320];
export const LURE_PRICES = [80, 200, 420];
export const ROD_NAMES = ["Driftwood Rod", "Willow Rod", "Cedar Rod", "Starlight Rod"];
export const LURE_NAMES = ["Plain Hook", "Lucky Feather", "Glimmer Spoon", "Moonstone Lure"];

export interface Quest {
  text: string;
  kind: "catch" | "sell" | "upgrade";
  species?: string;
  goal: number;
  reward: number;
}

export const QUESTS: Quest[] = [
  { text: "Catch 3 fish", kind: "catch", goal: 3, reward: 30 },
  { text: "Catch a Perch", kind: "catch", species: "perch", goal: 1, reward: 25 },
  { text: "Sell 5 fish at the dock", kind: "sell", goal: 5, reward: 40 },
  { text: "Buy any upgrade", kind: "upgrade", goal: 1, reward: 50 },
  { text: "Catch a Rainbow Trout", kind: "catch", species: "trout", goal: 1, reward: 60 },
  { text: "Catch 15 fish", kind: "catch", goal: 15, reward: 100 },
  { text: "Catch a Golden Koi", kind: "catch", species: "koi", goal: 1, reward: 150 },
  { text: "Catch a Moon Jelly (night)", kind: "catch", species: "moonjelly", goal: 1, reward: 300 },
];

export interface CaughtFish {
  uid: number;
  id: string;
  weight: number;
  value: number;
}

export interface Save {
  coins: number;
  xp: number;
  level: number;
  rod: number;
  lure: number;
  bag: CaughtFish[];
  journal: Record<string, { count: number; best: number }>;
  quest: number;
  questProg: number;
  tutorialDone: boolean;
  hints: boolean;
  totalCaught: number;
}

export const NEW_SAVE: Save = {
  coins: 0, xp: 0, level: 1, rod: 0, lure: 0, bag: [], journal: {},
  quest: 0, questProg: 0, tutorialDone: false, hints: true, totalCaught: 0,
};

export const xpFor = (lvl: number) => 40 + lvl * 30;
