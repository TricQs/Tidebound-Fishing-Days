import { useCallback, useEffect, useRef, useState } from "react";
import { drawScene, dayInfo, mountainLineY, W, H, HORIZON, type SceneState, type SubFish } from "./scene";
import {
  SPECIES,
  RARITY_COLOR,
  ROD_PRICES,
  LURE_PRICES,
  BOAT_PRICES,
  ROD_NAMES,
  ROD_DESCS,
  LURE_NAMES,
  LURE_DESCS,
  BOAT_NAMES,
  BOAT_DESCS,
  BAITS,
  MUTATIONS,
  DEPTH_ZONES,
  getZoneAtX,
  getDepthAtX,
  QUESTS,
  NEW_SAVE,
  xpFor,
  type Save,
  type Species,
  type CaughtFish,
  type MutationId,
  type WeatherKind,
} from "./data";
import { FishSprite } from "./FishSprite";
import { LakeAudio } from "./audio";

const KEY = "tidebound-save-v1";

function castTarget(boatX: number, power: number) {
  const y = HORIZON + 8 + Math.random() * (H - HORIZON - 24);
  const rawX = boatX + 52 + power * 145;
  return { x: Math.max(48, Math.min(W - 10, rawX)), y };
}

type Phase = "idle" | "charging" | "casting" | "waiting" | "bite" | "reeling" | "caught" | "escaped";
type Panel = null | "shop" | "journal" | "aquarium" | "settings" | "pause" | "confirm";
type ShopTab = "bag" | "gear" | "bait";

interface G extends SceneState {
  waitLeft: number;
  biteLeft: number;
  fish: Species | null;
  marker: number; // fish position 0..1
  fishVel: number;
  fishTarget: number;
  fishDecisionT: number;
  dir: number;
  zoneC: number; // player catch bar center 0..1
  zoneVel: number;
  zoneW: number;
  reelProgress: number; // 0..1
  tension: number; // 0..1
  fishPulling: boolean;
  pullTimer: number;
  isHoldingReel: boolean;
  perfectCast: boolean;
  perfectFlash: number;
  nibblesLeft: number;
  nextNibbleAt: number;
  nibbleAnim: number;
  jigAnim: number;
  hits: number;
  misses: number;
  powerDir: number;
  rain: number;
  weather: WeatherKind;
  weatherLeft: number;
  nextWeatherAt: number;
  lightningFlash: number;
  boatX: number;
  boatVx: number;
  moveDir: number;
  subFish: SubFish[];
  rainLeft: number;
  nextRainAt: number;
  fishJump: number;
  fishX: number;
  nextFishAt: number;
  surfaceSplash: number;
  surfaceX: number;
  nextSplashAt: number;
  nextRainDropAt: number;
  fishY: number;
  surfaceY: number;
  birdT: number;
  birdDuration: number;
  birdFlock: number;
  birdDir: number;
  birdY: number;
  nextBirdAt: number;
  meteorT: number;
  meteorX: number;
  meteorY: number;
  nextMeteorAt: number;
}

function createInitialSubFish(): SubFish[] {
  return Array.from({ length: 7 }, (_, i) => ({
    x: 55 + i * 38 + Math.random() * 18,
    y: HORIZON + 10 + (i % 4) * 14,
    vx: (i % 2 === 0 ? 1 : -1) * (6 + Math.random() * 6),
    size: 5 + (i % 3) * 2,
    depth: i,
    curious: false,
  }));
}

const WEATHER_INFO: Record<WeatherKind, { label: string; icon: string; bonus: string }> = {
  clear: { label: "Calm Lake", icon: "☀", bonus: "Clear visibility" },
  rain: { label: "Lake Shower", icon: "🌧", bonus: "+25% Bite Speed" },
  fog: { label: "Mystic Fog", icon: "🌫", bonus: "2x Mutant & Spirit Luck" },
  storm: { label: "Thunder Squall", icon: "⛈", bonus: "+45% Bite & Leviathan Luck" },
  biolume: { label: "Biolume Tide", icon: "✨", bonus: "3x Neon & Mythic Luck!" },
};

export function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const tensionRef = useRef<HTMLDivElement>(null);
  const powerRef = useRef<HTMLDivElement>(null);

  const [save, setSave] = useState<Save>(NEW_SAVE);
  const saveRef = useRef(save);
  saveRef.current = save;

  const [loaded, setLoaded] = useState(false);
  const [started, setStarted] = useState(false);
  const [phase, setPhaseS] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const [panel, setPanel] = useState<Panel>(null);
  const panelRef = useRef<Panel>(null);
  panelRef.current = panel;
  const [shopTab, setShopTab] = useState<ShopTab>("bag");

  const startedRef = useRef(false);
  startedRef.current = started;

  const [lastCatch, setLastCatch] = useState<CaughtFish | null>(null);
  const [reelUi, setReelUi] = useState({ pulling: false, speciesRarity: "Common", perfect: false });
  const [toast, setToast] = useState<string | null>(null);
  const [isNight, setIsNight] = useState(false);
  const [weatherState, setWeatherState] = useState<WeatherKind>("clear");
  const [sonarInfo, setSonarInfo] = useState({ zoneName: "Sunlit Shallows", depth: 2.4 });
  const [idleActive, setIdleActive] = useState(false);
  const [idleNotice, setIdleNotice] = useState(false);
  const [soundSettings, setSoundSettings] = useState<{ ambience: number; effects: number }>(() => {
    if (typeof window === "undefined") return { ambience: 100, effects: 80 };
    try {
      const raw = localStorage.getItem("tidebound-audio-v1");
      return raw ? { ambience: 100, effects: 80, ...JSON.parse(raw) } : { ambience: 100, effects: 80 };
    } catch {
      return { ambience: 100, effects: 80 };
    }
  });

  const uid = useRef(1);
  const audio = useRef(new LakeAudio());
  const lastActivity = useRef(Date.now());
  const idleMode = useRef(false);
  const idleRecastAt = useRef(0);

  const g = useRef<G>({
    t: 60,
    phase: "idle",
    power: 0,
    bobber: null,
    castT: 0,
    biteT: 0,
    reelPull: 0,
    splash: 0,
    waitLeft: 0,
    biteLeft: 0,
    fish: null,
    marker: 0.5,
    fishVel: 0,
    fishTarget: 0.5,
    fishDecisionT: 0,
    dir: 1,
    zoneC: 0.35,
    zoneVel: 0,
    zoneW: 0.24,
    reelProgress: 0.25,
    tension: 0,
    fishPulling: false,
    pullTimer: 2,
    isHoldingReel: false,
    perfectCast: false,
    perfectFlash: 0,
    nibblesLeft: 2,
    nextNibbleAt: 2,
    nibbleAnim: 0,
    jigAnim: 0,
    hits: 0,
    misses: 0,
    powerDir: 1,
    rain: 0,
    weather: "clear",
    weatherLeft: 0,
    nextWeatherAt: 75 + Math.random() * 65,
    lightningFlash: 0,
    boatX: 68,
    boatVx: 0,
    moveDir: 0,
    subFish: createInitialSubFish(),
    rainLeft: 0,
    nextRainAt: 600,
    fishJump: 0,
    fishX: 190,
    nextFishAt: 22 + Math.random() * 25,
    surfaceSplash: 0,
    surfaceX: 210,
    surfaceY: HORIZON + 8,
    nextSplashAt: 14 + Math.random() * 18,
    nextRainDropAt: 0.5,
    fishY: HORIZON + 8,
    birdT: -1,
    birdDuration: 12,
    birdFlock: 0,
    birdDir: 1,
    birdY: 28,
    nextBirdAt: 18 + Math.random() * 27,
    meteorT: -1,
    meteorX: 190,
    meteorY: 16,
    nextMeteorAt: 35 + Math.random() * 45,
  });

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    g.current.phase = p;
    setPhaseS(p);
  }, []);

  const flash = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast((c) => (c === m ? null : c)), 2500);
  }, []);

  // Load & persist save with safe migration for older saves
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSave({
          ...NEW_SAVE,
          ...parsed,
          baits: { ...NEW_SAVE.baits, ...(parsed.baits ?? {}) },
          aquarium: Array.isArray(parsed.aquarium) ? parsed.aquarium : [],
        });
      }
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(save));
    const maxBag = save.bag.reduce((m, b) => Math.max(m, b.uid + 1), 1);
    const maxAq = save.aquarium.reduce((m, b) => Math.max(m, b.uid + 1), 1);
    uid.current = Math.max(uid.current, maxBag, maxAq);
  }, [save, loaded]);

  useEffect(() => {
    audio.current.setVolumes(soundSettings.ambience / 100, soundSettings.effects / 100);
    localStorage.setItem("tidebound-audio-v1", JSON.stringify(soundSettings));
  }, [soundSettings]);

  // Passive Aquarium Exhibition Income every 45 seconds
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!startedRef.current) return;
      const aq = saveRef.current.aquarium;
      if (aq.length === 0) return;
      const bonus = Math.max(1, Math.round(aq.reduce((acc, f) => acc + f.value * 0.08, 0)));
      setSave((s) => ({ ...s, coins: s.coins + bonus }));
      flash(`🐠 Aquarium visitors tipped +${bonus}¢!`);
    }, 45000);
    return () => window.clearInterval(timer);
  }, [flash]);

  const advanceQuest = useCallback(
    (
      s: Save,
      kind: "catch" | "sell" | "upgrade" | "mutant" | "zone",
      opts?: { species?: string; zone?: string; n?: number },
    ): Save => {
      const q = QUESTS[s.quest];
      if (!q || q.kind !== kind) return s;
      if (q.species && q.species !== opts?.species) return s;
      if (q.zone && q.zone !== opts?.zone) return s;
      const prog = s.questProg + (opts?.n ?? 1);
      if (prog >= q.goal) {
        window.setTimeout(() => {
          audio.current.play("coin");
          flash(`Quest complete! +${q.reward}¢`);
        }, 400);
        return { ...s, quest: s.quest + 1, questProg: 0, coins: s.coins + q.reward };
      }
      return { ...s, questProg: prog };
    },
    [flash],
  );

  const pickFish = useCallback((): Species => {
    const s = saveRef.current;
    const G = g.current;
    const night = dayInfo(G.t).isNight;
    const castX = G.bobber?.x ?? G.boatX + 90;
    const castZone = getZoneAtX(castX).id;
    const activeBaitDef = s.activeBait ? BAITS.find((b) => b.id === s.activeBait && (s.baits[b.id] ?? 0) > 0) : null;
    const rareMult =
      (1 + s.lure * 0.55) *
      (activeBaitDef?.rareMult ?? 1) *
      (G.perfectCast ? 1.35 : 1) *
      (G.weather === "biolume" ? 1.8 : 1);

    const weights = SPECIES.map((f) => {
      let w = f.odds;
      const inPreferredZone = f.zones.includes(castZone);
      w *= inPreferredZone ? 2.2 : 0.32;
      if (f.rare) w *= rareMult;
      if (f.night) w *= night || G.weather === "biolume" ? 3.8 : 0.15;
      if (f.rain) w *= G.weather === "rain" || G.weather === "storm" ? 2.8 : 0.65;
      if (f.fog) w *= G.weather === "fog" ? 3.2 : 0.65;
      return w;
    });

    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < SPECIES.length; i++) {
      r -= weights[i]!;
      if (r <= 0) return SPECIES[i]!;
    }
    return SPECIES[0]!;
  }, []);

  const rollMutation = useCallback((): MutationId => {
    const s = saveRef.current;
    const G = g.current;
    const activeBaitDef = s.activeBait ? BAITS.find((b) => b.id === s.activeBait && (s.baits[b.id] ?? 0) > 0) : null;
    let mutChance = 0.08 + s.lure * 0.035 + Math.min(0.1, s.streak * 0.015);
    if (G.perfectCast) mutChance += 0.06;
    if (G.weather === "fog") mutChance *= 1.8;
    if (G.weather === "biolume") mutChance *= 2.4;
    if (activeBaitDef) mutChance *= activeBaitDef.mutationMult;

    if (Math.random() > mutChance) return "none";

    const pool = (Object.keys(MUTATIONS) as MutationId[]).filter((k) => k !== "none");
    const weights = pool.map((k) => {
      let w = MUTATIONS[k].odds;
      if (k === "luminescent" && (G.weather === "biolume" || dayInfo(G.t).isNight)) w *= 2.2;
      if (k === "shadow" && G.weather === "fog") w *= 2.2;
      if (k === "celestial" && G.perfectCast) w *= 2.0;
      return w;
    });
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i]!;
      if (r <= 0) return pool[i]!;
    }
    return "colossal";
  }, []);

  const finishCatch = useCallback(() => {
    const G = g.current;
    const f = G.fish!;
    const s0 = saveRef.current;
    const mutation = rollMutation();
    const mutDef = MUTATIONS[mutation];
    const boatWeightBonus = s0.boat >= 3 ? 1.2 : 1;
    const giantMult = mutation === "colossal" ? 1.55 + Math.random() * 0.45 : 1;

    const rawWeight = (f.minW + Math.random() * (f.maxW - f.minW)) * boatWeightBonus * giantMult;
    const weight = +rawWeight.toFixed(2);
    const weightFactor = 0.75 + ((weight - f.minW) / Math.max(0.1, f.maxW - f.minW)) * 0.75;
    const streakMult = 1 + Math.min(1.0, s0.streak * 0.08);
    const perfectMult = G.perfectCast ? 1.15 : 1;
    const baseValue = Math.round(f.value * weightFactor * mutDef.mult * streakMult * perfectMult);
    const value = idleMode.current ? Math.max(1, Math.round(baseValue * 0.5)) : baseValue;

    // Roll for Sunken Treasure Chest (higher in deep water & on Perfect Cast)
    const castZone = getZoneAtX(G.bobber?.x ?? G.boatX + 90).id;
    const chestChance = (castZone === "abyss" ? 0.16 : castZone === "timber" ? 0.1 : 0.05) + (G.perfectCast ? 0.06 : 0);
    const hasChest = !idleMode.current && Math.random() < chestChance;
    const chestCoins = hasChest ? 25 + Math.floor(Math.random() * 65) + s0.level * 8 : 0;

    const c: CaughtFish = {
      uid: uid.current++,
      id: f.id,
      weight,
      value,
      mutation,
      hasChest,
      chestCoins,
    };

    setLastCatch(c);
    setSave((prevSave) => {
      const newStreak = prevSave.streak + 1;
      const newBestStreak = Math.max(prevSave.bestStreak, newStreak);

      // Consume 1 active bait if equipped
      const nextBaits = { ...prevSave.baits };
      let nextActiveBait = prevSave.activeBait;
      if (nextActiveBait && (nextBaits[nextActiveBait] ?? 0) > 0) {
        nextBaits[nextActiveBait] = nextBaits[nextActiveBait]! - 1;
        if (nextBaits[nextActiveBait]! <= 0) nextActiveBait = null;
      }

      let s: Save = {
        ...prevSave,
        coins: prevSave.coins + chestCoins,
        bag: [...prevSave.bag, c],
        baits: nextBaits,
        activeBait: nextActiveBait,
        totalCaught: prevSave.totalCaught + 1,
        tutorialDone: true,
        streak: newStreak,
        bestStreak: newBestStreak,
        perfectCasts: prevSave.perfectCasts + (G.perfectCast ? 1 : 0),
        chestsOpened: prevSave.chestsOpened + (hasChest ? 1 : 0),
      };

      const prevJ = s.journal[f.id];
      if (!prevJ) window.setTimeout(() => flash(`✨ New species discovered: ${f.name}!`), 200);
      const prevMuts = prevJ?.mutations ?? [];
      const nextMuts = mutation !== "none" && !prevMuts.includes(mutation) ? [...prevMuts, mutation] : prevMuts;

      s.journal = {
        ...s.journal,
        [f.id]: {
          count: (prevJ?.count ?? 0) + 1,
          best: Math.max(prevJ?.best ?? 0, weight),
          mutations: nextMuts,
        },
      };

      const xpGain = Math.max(
        1,
        Math.round((f.value * 0.8 + 8) * mutDef.mult * (idleMode.current ? 0.25 : 1)),
      );
      let xp = s.xp + xpGain,
        level = s.level;
      while (xp >= xpFor(level)) {
        xp -= xpFor(level);
        level++;
        window.setTimeout(() => flash(`🎉 Level up! You reached Angler Lv ${level}`), 900);
      }
      s = { ...s, xp, level };
      s = advanceQuest(s, "catch", { species: f.id });
      s = advanceQuest(s, "zone", { zone: castZone });
      if (mutation !== "none") {
        s = advanceQuest(s, "mutant");
      }
      return s;
    });

    if (idleMode.current) idleRecastAt.current = performance.now() + 4500;
    setPhase("caught");
    if (f.rarity === "Epic" || f.rarity === "Legendary" || f.rarity === "Mythic" || mutation !== "none") {
      audio.current.play("fanfare");
    } else {
      audio.current.play("catch");
    }
  }, [advanceQuest, flash, rollMutation, setPhase]);

  const reset = useCallback(() => {
    const G = g.current;
    G.bobber = null;
    G.fish = null;
    G.power = 0;
    G.tension = 0;
    G.reelProgress = 0;
    G.isHoldingReel = false;
    G.perfectCast = false;
    setPhase("idle");
  }, [setPhase]);

  // Jigging the lure during waiting phase to attract fish faster
  const jigLure = useCallback(() => {
    const G = g.current;
    if (phaseRef.current !== "waiting" || G.jigAnim > 0) return;
    G.jigAnim = 0.35;
    G.waitLeft = Math.max(0.2, G.waitLeft - 1.15);
    G.nextNibbleAt = Math.max(0.15, G.nextNibbleAt - 0.7);
    audio.current.play("jig");
  }, []);

  // Primary Action Down (Cast / Hook / Reel Hold & Tap Burst)
  const actionDown = useCallback(() => {
    if (!startedRef.current || panelRef.current) return;
    const G = g.current;
    const p = phaseRef.current;

    if (p === "idle") {
      G.power = 0;
      G.powerDir = 1;
      G.moveDir = 0;
      setPhase("charging");
    } else if (p === "waiting") {
      // If a fish is just nibbling, pulling too early spooks it; otherwise reel in empty
      if (G.nibbleAnim > 0) {
        flash("Pulled too early! Wait for the real strike (!!)");
      }
      reset();
    } else if (p === "bite") {
      const s = saveRef.current;
      const f = G.fish!;
      G.zoneW = Math.min(0.46, f.zone + s.rod * 0.036);
      G.marker = 0.45;
      G.fishTarget = 0.65;
      G.fishVel = 0;
      G.fishDecisionT = 0.4;
      G.zoneC = 0.45;
      G.zoneVel = 0;
      G.reelProgress = 0.28;
      G.tension = 0.1;
      G.fishPulling = false;
      G.pullTimer = 1.6 + Math.random() * 1.4;
      G.isHoldingReel = true;
      G.fishColor = f.color;
      setReelUi({ pulling: false, speciesRarity: f.rarity, perfect: G.perfectCast });
      audio.current.play("hook");
      setPhase("reeling");
    } else if (p === "reeling") {
      G.isHoldingReel = true;
      // Tap burst bonus: if the player taps while the fish is inside the Catch Bar, grant a clean burst!
      const inZone = Math.abs(G.marker - G.zoneC) <= G.zoneW * 0.58;
      if (inZone && !G.fishPulling) {
        G.reelProgress = Math.min(1, G.reelProgress + 0.085);
        audio.current.play("reel_tick");
      }
    } else if (p === "caught" || p === "escaped") {
      reset();
    }
  }, [flash, reset, setPhase]);

  const actionUp = useCallback(() => {
    const G = g.current;
    if (phaseRef.current === "charging") {
      const pw = Math.max(0.15, G.power);
      // Sweet spot between 0.78 and 0.94 gives a PERFECT CAST!
      const isPerfect = pw >= 0.78 && pw <= 0.94;
      G.perfectCast = isPerfect;
      if (isPerfect) {
        G.perfectFlash = 1.0;
        audio.current.play("perfect");
        flash("⚡ PERFECT CAST! +35% Rare Luck & Faster Bite");
      } else {
        audio.current.play("cast");
      }
      G.bobber = castTarget(G.boatX, pw);
      G.castT = 0;
      const z = getZoneAtX(G.bobber.x);
      setSonarInfo({ zoneName: z.name, depth: getDepthAtX(G.bobber.x) });
      setPhase("casting");
    } else if (phaseRef.current === "reeling") {
      G.isHoldingReel = false;
    }
  }, [flash, setPhase]);

  // Keyboard & Pointer Activity
  useEffect(() => {
    const pointerActivity = (e: PointerEvent) => {
      if (!startedRef.current || (e.button !== 0 && e.button !== 2)) return;
      lastActivity.current = Date.now();
      idleMode.current = false;
      setIdleActive(false);
      setIdleNotice(false);
    };
    const down = (e: KeyboardEvent) => {
      if (
        startedRef.current &&
        ["Space", "KeyS", "KeyJ", "KeyA", "KeyD", "KeyW", "ArrowLeft", "ArrowRight", "Escape"].includes(e.code)
      ) {
        lastActivity.current = Date.now();
        idleMode.current = false;
        setIdleActive(false);
        setIdleNotice(false);
      }
      if (!startedRef.current) return;

      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (!e.repeat) actionDown();
      } else if (e.code === "KeyW" || e.code === "ArrowUp") {
        e.preventDefault();
        if (!e.repeat) jigLure();
      } else if ((e.code === "KeyA" || e.code === "ArrowLeft") && phaseRef.current === "idle" && !panelRef.current) {
        g.current.moveDir = -1;
      } else if ((e.code === "KeyD" || e.code === "ArrowRight") && phaseRef.current === "idle" && !panelRef.current) {
        g.current.moveDir = 1;
      } else if (e.code === "Escape") {
        setPanel((p) => (p ? null : "pause"));
      } else if (e.code === "KeyS") {
        setPanel((p) => (p === "shop" ? null : "shop"));
      } else if (e.code === "KeyJ") {
        setPanel((p) => (p === "journal" ? null : "journal"));
      } else if (e.code === "KeyT") {
        setPanel((p) => (p === "aquarium" ? null : "aquarium"));
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        actionUp();
      } else if (e.code === "KeyA" || e.code === "ArrowLeft") {
        if (g.current.moveDir < 0) g.current.moveDir = 0;
      } else if (e.code === "KeyD" || e.code === "ArrowRight") {
        if (g.current.moveDir > 0) g.current.moveDir = 0;
      }
    };
    window.addEventListener("pointerdown", pointerActivity);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("pointerdown", pointerActivity);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [actionDown, actionUp, jigLure]);

  // Main 60FPS Game Loop
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    let raf = 0,
      last = performance.now(),
      hudCheck = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const G = g.current;
      const paused = panelRef.current !== null;

      if (startedRef.current && !paused && Date.now() - lastActivity.current >= 21000 && !idleMode.current) {
        idleMode.current = true;
        setIdleActive(true);
        setIdleNotice(true);
        window.setTimeout(() => setIdleNotice(false), 3000);
      }

      if (!paused) {
        G.t += dt;
        const p = phaseRef.current;
        const s = saveRef.current;
        G.boatLevel = s.boat;
        G.rodLevel = s.rod;

        // Boat horizontal movement in idle phase
        if (p === "idle" && G.moveDir !== 0) {
          const maxSpeed = 28 + s.boat * 14;
          G.boatVx = G.moveDir * maxSpeed;
          G.boatX = Math.max(38, Math.min(195, G.boatX + G.boatVx * dt));
        } else {
          G.boatVx *= Math.max(0, 1 - dt * 8);
        }

        // Underwater Fish Silhouettes AI (roaming & swimming toward bobber!)
        for (const sf of G.subFish) {
          if ((p === "waiting" || p === "bite") && G.bobber && sf.depth === 0) {
            sf.curious = true;
            const dx = G.bobber.x - sf.x;
            const dy = G.bobber.y + 3 - sf.y;
            sf.vx = Math.sign(dx || 1) * Math.min(18, Math.max(4, Math.abs(dx) * 0.8));
            sf.x += sf.vx * dt;
            sf.y += dy * dt * 1.5;
          } else {
            sf.curious = false;
            sf.x += sf.vx * dt;
            if (sf.x < 42) {
              sf.x = 42;
              sf.vx = Math.abs(sf.vx);
            } else if (sf.x > W - 12) {
              sf.x = W - 12;
              sf.vx = -Math.abs(sf.vx);
            }
          }
        }

        // Idle Auto-Fishing Mode
        if (idleMode.current) {
          if ((p === "idle" || p === "caught" || p === "escaped") && performance.now() >= idleRecastAt.current) {
            reset();
            G.power = 0.65;
            G.bobber = castTarget(G.boatX, 0.65);
            G.castT = 0;
            audio.current.play("cast");
            setPhase("casting");
          } else if (p === "bite" || p === "reeling") {
            audio.current.play("hook");
            finishCatch();
          }
        }

        // Dynamic Weather & World Events
        if (startedRef.current) {
          if (G.weather !== "clear") {
            G.weatherLeft -= dt;
            if (G.weather === "rain" || G.weather === "storm") {
              G.nextRainDropAt -= dt;
              if (G.nextRainDropAt <= 0) {
                audio.current.play("droplet");
                G.nextRainDropAt = 0.35 + Math.random() * 0.8;
              }
              if (G.weather === "storm" && Math.random() < dt * 0.08) {
                G.lightningFlash = 1;
              }
            }
            if (G.weatherLeft <= 0) {
              G.weather = "clear";
              G.rain = 0;
              audio.current.setRain(false);
              setWeatherState("clear");
              G.nextWeatherAt = 75 + Math.random() * 85;
            }
          } else {
            G.nextWeatherAt -= dt;
            if (G.nextWeatherAt <= 0) {
              const nightNow = dayInfo(G.t).isNight;
              const roll = Math.random();
              const nextW: WeatherKind =
                nightNow && roll < 0.35
                  ? "biolume"
                  : roll < 0.45
                    ? "rain"
                    : roll < 0.75
                      ? "fog"
                      : "storm";
              G.weather = nextW;
              G.weatherLeft = 55 + Math.random() * 45;
              const isR = nextW === "rain" || nextW === "storm";
              G.rain = isR ? 1 : 0;
              audio.current.setRain(isR);
              setWeatherState(nextW);
              flash(`${WEATHER_INFO[nextW].icon} ${WEATHER_INFO[nextW].label}: ${WEATHER_INFO[nextW].bonus}`);
            }
          }

          if (G.lightningFlash > 0) G.lightningFlash = Math.max(0, G.lightningFlash - dt * 3);
          if (G.perfectFlash > 0) G.perfectFlash = Math.max(0, G.perfectFlash - dt * 1.1);
          if (G.nibbleAnim > 0) G.nibbleAnim = Math.max(0, G.nibbleAnim - dt);
          if (G.jigAnim > 0) G.jigAnim = Math.max(0, G.jigAnim - dt);

          // Ambient surface fish jumps & splashes
          G.fishJump = Math.max(0, G.fishJump - dt);
          G.surfaceSplash = Math.max(0, G.surfaceSplash - dt);
          G.nextFishAt -= dt;
          if (G.nextFishAt <= 0) {
            G.fishJump = 1.35;
            G.fishX = Math.random() < 0.38 ? 68 + Math.random() * 66 : 135 + Math.random() * 160;
            G.fishY = HORIZON + 5 + Math.random() * 20;
            G.nextFishAt = G.rain ? 14 + Math.random() * 18 : 30 + Math.random() * 38;
            window.setTimeout(() => audio.current.play("jump"), 1050);
          }
          G.nextSplashAt -= dt;
          if (G.nextSplashAt <= 0) {
            G.surfaceSplash = 0.75;
            G.surfaceX = 45 + Math.random() * 255;
            G.surfaceY = HORIZON + 4 + Math.random() * 58;
            G.nextSplashAt = 14 + Math.random() * 22;
          }

          // Sky Birds & Night Meteors
          const nowNight = dayInfo(G.t).isNight;
          if (G.birdT >= 0) {
            G.birdT += dt;
            if (G.birdT >= G.birdDuration) G.birdT = -1;
          } else {
            G.nextBirdAt -= dt;
            if (G.nextBirdAt <= 0) {
              if (!nowNight && !G.rain) {
                G.birdT = 0;
                G.birdDuration = 10 + Math.random() * 6;
                G.birdFlock = Math.random() < 0.5 ? 1 : 0;
                G.birdDir = Math.random() < 0.5 ? -1 : 1;
                G.birdY = 15 + Math.random() * 32;
              }
              G.nextBirdAt = nowNight || G.rain ? 10 + Math.random() * 12 : 24 + Math.random() * 38;
            }
          }
          if (G.meteorT >= 0) {
            G.meteorT += dt;
            const meteorX = G.meteorX + G.meteorT * 34;
            const meteorY = G.meteorY + G.meteorT * 36;
            if (meteorY >= mountainLineY(meteorX, G.t) || G.meteorT > 3) G.meteorT = -1;
          } else if (nowNight) {
            G.nextMeteorAt -= dt;
            if (G.nextMeteorAt <= 0) {
              G.meteorT = 0;
              G.meteorX = 36 + Math.random() * 230;
              G.meteorY = 8 + Math.random() * 22;
              G.nextMeteorAt = 32 + Math.random() * 45;
            }
          } else {
            G.nextMeteorAt = Math.min(G.nextMeteorAt, 20);
          }
        }

        // Phase Logic
        if (p === "charging") {
          G.power += G.powerDir * dt * 1.18;
          if (G.power >= 1) {
            G.power = 1;
            G.powerDir = -1;
          }
          if (G.power <= 0) {
            G.power = 0;
            G.powerDir = 1;
          }
          if (powerRef.current) powerRef.current.style.width = `${G.power * 100}%`;
        } else if (p === "casting") {
          G.castT += dt * 1.65;
          if (G.castT >= 1) {
            G.castT = 1;
            G.splash = 1;
            audio.current.play("splash");
            const activeBaitDef = s.activeBait
              ? BAITS.find((b) => b.id === s.activeBait && (s.baits[b.id] ?? 0) > 0)
              : null;
            const speedMult =
              (G.rain ? 1.25 : 1) *
              (G.weather === "storm" ? 1.2 : 1) *
              (G.perfectCast ? 1.25 : 1) *
              (1 + s.lure * 0.08) *
              (activeBaitDef?.biteSpeed ?? 1);
            const baseWait = idleMode.current ? 8 + Math.random() * 6 : (4.8 + Math.random() * 5.2) / speedMult;
            G.waitLeft = Math.max(1.8, baseWait);
            G.nibblesLeft = 1 + Math.floor(Math.random() * 2);
            G.nextNibbleAt = G.waitLeft * 0.42;
            setPhase("waiting");
          }
        } else if (p === "waiting") {
          G.waitLeft -= dt;
          G.nextNibbleAt -= dt;
          if (G.nibblesLeft > 0 && G.nextNibbleAt <= 0 && G.waitLeft > 0.7) {
            G.nibblesLeft--;
            G.nibbleAnim = 0.35;
            G.nextNibbleAt = 1.1 + Math.random() * 1.1;
            audio.current.play("nibble");
          }
          if (G.waitLeft <= 0) {
            G.fish = pickFish();
            audio.current.play("bite");
            G.biteLeft = 1.25 + s.rod * 0.22;
            setPhase("bite");
          }
        } else if (p === "bite") {
          G.biteLeft -= dt;
          if (G.biteLeft <= 0) {
            G.bobber = null;
            setSave((prev) => ({ ...prev, streak: 0 }));
            audio.current.play("snap");
            setPhase("escaped");
          }
        } else if (p === "reeling" && G.fish) {
          const f = G.fish;
          const rodFactor = 1 - s.rod * 0.09;

          // 1. Fish Surge / Pulling state timer
          G.pullTimer -= dt;
          if (G.pullTimer <= 0) {
            const nextPull = !G.fishPulling;
            G.fishPulling = nextPull;
            G.pullTimer = nextPull
              ? 0.9 + Math.random() * 0.85
              : 1.6 + Math.random() * 1.6 + s.rod * 0.2;
            setReelUi((u) => ({ ...u, pulling: nextPull }));
          }

          // 2. Fish AI Movement along 0..1 bar based on species fightStyle
          G.fishDecisionT -= dt;
          if (G.fishDecisionT <= 0) {
            if (f.fightStyle === "darter" || f.fightStyle === "erratic") {
              G.fishTarget = 0.08 + Math.random() * 0.84;
              G.fishDecisionT = 0.45 + Math.random() * 0.55;
            } else if (f.fightStyle === "heavy") {
              G.fishTarget = 0.15 + Math.random() * 0.65;
              G.fishDecisionT = 0.8 + Math.random() * 0.8;
            } else {
              G.fishTarget = Math.max(0.08, Math.min(0.92, G.marker + (Math.random() - 0.48) * 0.55));
              G.fishDecisionT = 0.6 + Math.random() * 0.6;
            }
          }
          const fishAccel = (G.fishTarget - G.marker) * (2.6 + f.speed * 1.4) * rodFactor;
          G.fishVel = G.fishVel * Math.max(0, 1 - dt * 3.5) + fishAccel * dt;
          G.marker = Math.max(0.04, Math.min(0.96, G.marker + G.fishVel * dt));

          // 3. Player Catch Bar Movement (Hold to reel right, release to drift left)
          const barAccel = G.isHoldingReel ? 1.85 : -1.55;
          G.zoneVel = G.zoneVel * Math.max(0, 1 - dt * 6.5) + barAccel * dt;
          G.zoneC = Math.max(G.zoneW / 2, Math.min(1 - G.zoneW / 2, G.zoneC + G.zoneVel * dt));

          // 4. Overlap Check & Progress / Tension Physics
          const dist = Math.abs(G.marker - G.zoneC);
          const inZone = dist <= G.zoneW * 0.55;

          if (inZone) {
            const fillRate = 1 / Math.max(2.6, f.stamina * (1 - s.rod * 0.07));
            G.reelProgress = Math.min(1, G.reelProgress + fillRate * dt);
            G.tension = Math.max(0, G.tension - dt * 0.22);
            if (G.isHoldingReel) audio.current.play("reel_tick");
          } else {
            const drainRate = 0.085 * rodFactor;
            G.reelProgress = Math.max(0, G.reelProgress - drainRate * dt);
          }

          // Line Tension increases if player holds reel while fish is surging outside the sweet spot
          if (G.fishPulling && G.isHoldingReel && !inZone) {
            G.tension = Math.min(1, G.tension + dt * (0.48 * rodFactor));
            audio.current.play("drag");
          } else if (G.fishPulling && G.isHoldingReel && inZone) {
            G.tension = Math.min(1, G.tension + dt * 0.16);
          } else {
            G.tension = Math.max(0, G.tension - dt * 0.34);
          }

          // Update DOM bars smoothly at 60fps
          if (markerRef.current) markerRef.current.style.left = `${G.marker * 100}%`;
          if (zoneRef.current) {
            zoneRef.current.style.left = `${(G.zoneC - G.zoneW / 2) * 100}%`;
            zoneRef.current.style.width = `${G.zoneW * 100}%`;
            zoneRef.current.style.background = inZone ? "var(--tb-green)" : "oklch(0.72 0.17 145 / 0.45)";
          }
          if (progressRef.current) progressRef.current.style.width = `${G.reelProgress * 100}%`;
          if (tensionRef.current) {
            tensionRef.current.style.width = `${G.tension * 100}%`;
            tensionRef.current.style.background =
              G.tension > 0.75 ? "var(--tb-red)" : G.tension > 0.45 ? "var(--tb-amber)" : "var(--tb-teal)";
          }

          // Win or Escape check
          if (G.reelProgress >= 1) {
            finishCatch();
          } else if (G.reelProgress <= 0 || G.tension >= 1) {
            G.bobber = null;
            G.isHoldingReel = false;
            setSave((prev) => ({ ...prev, streak: 0 }));
            audio.current.play("snap");
            flash(G.tension >= 1 ? "💥 Line snapped under high tension!" : "The fish threw the hook…");
            setPhase("escaped");
          }
        }

        if (G.splash > 0) G.splash = Math.max(0, G.splash - dt * 2);
      }

      drawScene(ctx, G);

      hudCheck += dt;
      if (hudCheck > 0.4) {
        hudCheck = 0;
        const night = dayInfo(G.t).isNight;
        setIsNight(night);
        audio.current.setNight(night);
        if (phaseRef.current === "idle") {
          const sampleX = G.boatX + 95;
          const z = getZoneAtX(sampleX);
          setSonarInfo({ zoneName: z.name, depth: getDepthAtX(sampleX) });
        }
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [finishCatch, flash, pickFish, reset, setPhase]);

  // Shop, Bait & Aquarium Actions
  const sell = (ids: number[]) => {
    setSave((s0) => {
      const sold = s0.bag.filter((b) => ids.includes(b.uid) && !b.locked);
      if (!sold.length) return s0;
      const total = sold.reduce((a, b) => a + b.value, 0);
      audio.current.play("coin");
      flash(`Sold ${sold.length} fish for ${total}¢`);
      let s = { ...s0, coins: s0.coins + total, bag: s0.bag.filter((b) => !sold.some((x) => x.uid === b.uid)) };
      s = advanceQuest(s, "sell", { n: sold.length });
      return s;
    });
  };

  const toggleLockFish = (fishUid: number) => {
    setSave((s0) => ({
      ...s0,
      bag: s0.bag.map((b) => (b.uid === fishUid ? { ...b, locked: !b.locked } : b)),
    }));
  };

  const moveToAquarium = (fish: CaughtFish) => {
    setSave((s0) => {
      if (s0.aquarium.length >= 8) {
        flash("Aquarium tank is full (max 8 prized fish)!");
        return s0;
      }
      flash(`Placed ${SPECIES.find((sp) => sp.id === fish.id)?.name ?? "fish"} in your Aquarium!`);
      return {
        ...s0,
        bag: s0.bag.filter((b) => b.uid !== fish.uid),
        aquarium: [...s0.aquarium, fish],
      };
    });
  };

  const returnFromAquarium = (fish: CaughtFish) => {
    setSave((s0) => ({
      ...s0,
      aquarium: s0.aquarium.filter((b) => b.uid !== fish.uid),
      bag: [...s0.bag, fish],
    }));
  };

  const buyUpgrade = (kind: "rod" | "lure" | "boat") => {
    setSave((s0) => {
      const lvl = s0[kind];
      const prices = kind === "rod" ? ROD_PRICES : kind === "lure" ? LURE_PRICES : BOAT_PRICES;
      const names = kind === "rod" ? ROD_NAMES : kind === "lure" ? LURE_NAMES : BOAT_NAMES;
      const price = prices[lvl];
      if (price === undefined || s0.coins < price) return s0;
      audio.current.play("coin");
      flash(`Upgraded to ${names[lvl + 1]}!`);
      return advanceQuest({ ...s0, coins: s0.coins - price, [kind]: lvl + 1 }, "upgrade");
    });
  };

  const buyBait = (baitId: string) => {
    const def = BAITS.find((b) => b.id === baitId);
    if (!def) return;
    setSave((s0) => {
      if (s0.coins < def.price) return s0;
      audio.current.play("coin");
      const currentCount = s0.baits[baitId] ?? 0;
      flash(`Bought ${def.bundle}x ${def.name}!`);
      return {
        ...s0,
        coins: s0.coins - def.price,
        activeBait: baitId,
        baits: { ...s0.baits, [baitId]: currentCount + def.bundle },
      };
    });
  };

  const resetSave = () => {
    localStorage.removeItem(KEY);
    setSave({ ...NEW_SAVE });
    reset();
    setPanel(null);
    setStarted(false);
    idleMode.current = false;
    setIdleActive(false);
    setIdleNotice(false);
  };

  const quest = QUESTS[save.quest];
  const lastSpecies = lastCatch ? SPECIES.find((s) => s.id === lastCatch.id)! : null;
  const lastMut = lastCatch?.mutation ? MUTATIONS[lastCatch.mutation] : MUTATIONS.none;
  const showHints = save.hints || !save.tutorialDone;

  const hint: Record<Phase, string> = {
    idle: "Hold CAST (Space) to charge · Use ◄/► (A/D) to row to deeper water.",
    charging: "Release in the GOLDEN ZONE for a ⚡ PERFECT CAST!",
    casting: "Sailing through the air…",
    waiting: "Watch for nibbles… Wait for !! STRIKE !! (Press W or JIG to attract fish)",
    bite: "!! STRIKE !! Tap HOOK NOW before it bolts!",
    reeling: "HOLD to move bar right, RELEASE to drift left · Keep fish in green bar!",
    caught: "Trophy landed! Tap to continue.",
    escaped: "It got away… tap to cast again.",
  };

  const btnLabel: Record<Phase, string> = {
    idle: "HOLD TO CAST",
    charging: "RELEASE!",
    casting: "…",
    waiting: "PULL LINE",
    bite: "⚡ HOOK IT!",
    reeling: "HOLD / TAP REEL",
    caught: "CONTINUE",
    escaped: "CONTINUE",
  };

  const unlockedBag = save.bag.filter((b) => !b.locked);
  const bagValue = unlockedBag.reduce((a, b) => a + b.value, 0);
  const activeBaitDef = save.activeBait ? BAITS.find((b) => b.id === save.activeBait) : null;
  const activeBaitCount = save.activeBait ? (save.baits[save.activeBait] ?? 0) : 0;

  return (
    <div className="tb-root">
      <a
        href="https://www.youtube.com/@tricq69"
        target="_blank"
        rel="noopener noreferrer"
        className="tb-credit"
      >
        Made By TricQ
      </a>

      <div className="tb-stage">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="tb-canvas"
          onPointerDown={(e) => {
            e.preventDefault();
            if (e.button === 0) actionDown();
            else if (e.button === 2) jigLure();
          }}
          onPointerUp={(e) => {
            if (e.button === 0) actionUp();
          }}
          onPointerLeave={(e) => {
            if (e.buttons & 1) actionUp();
          }}
          onPointerCancel={(e) => {
            if (e.button === 0) actionUp();
          }}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Fishing lake"
        />

        {started && (
          <div className="tb-hud">
            <div className="tb-chip">
              <span className="tb-coin" />
              {save.coins}¢
            </div>
            <div className="tb-chip tb-level">
              <span>Lv {save.level}</span>
              <div className="tb-xpbar">
                <div style={{ width: `${(save.xp / xpFor(save.level)) * 100}%` }} />
              </div>
            </div>
            <div className="tb-chip" title={WEATHER_INFO[weatherState].bonus}>
              {isNight ? "☾" : WEATHER_INFO[weatherState].icon} {WEATHER_INFO[weatherState].label}
            </div>
            <div className="tb-chip tb-sonar-chip" title="Sonar Depth & Biome">
              <span>📡 {sonarInfo.zoneName}</span>
              <b>{sonarInfo.depth}m</b>
            </div>
            {save.streak >= 2 && (
              <div className="tb-chip tb-streak-chip" title={`+${Math.min(100, save.streak * 8)}% Value & XP`}>
                🔥 x{save.streak}
              </div>
            )}
            {idleActive && (
              <div
                className={`tb-chip tb-idle-status ${idleNotice ? "tb-idle-notice" : "tb-idle-dim"}`}
                aria-label="Idle Mode"
              >
                <span className="tb-idle-clock" aria-hidden="true">
                  <i />
                </span>
                {idleNotice && <span>Idle Mode</span>}
              </div>
            )}
            <div className="tb-hud-right">
              <button className="tb-btn tb-btn-sm" onClick={() => setPanel("shop")}>
                Dock <kbd>S</kbd>
              </button>
              <button className="tb-btn tb-btn-sm" onClick={() => setPanel("journal")}>
                Journal <kbd>J</kbd>
              </button>
              <button className="tb-btn tb-btn-sm" onClick={() => setPanel("aquarium")}>
                Tank ({save.aquarium.length}) <kbd>T</kbd>
              </button>
              <button className="tb-btn tb-btn-sm" onClick={() => setPanel("settings")} aria-label="Settings">
                ⚙
              </button>
              <button className="tb-btn tb-btn-sm" onClick={() => setPanel("pause")} aria-label="Pause">
                II
              </button>
            </div>
          </div>
        )}

        {started && quest && (
          <div className="tb-quest">
            <b>Quest</b> {quest.text} <span>{save.questProg}/{quest.goal}</span>
          </div>
        )}

        {started && phase === "charging" && (
          <div className="tb-power-wrap">
            <div className="tb-power-head">
              <span>⚡ CAST POWER</span>
              <span className="tb-sweet-label">★ Sweet Spot (80-94%)</span>
            </div>
            <div className="tb-meter tb-power-bar">
              <div ref={powerRef} className="tb-power-fill" />
              <div className="tb-power-sweetspot" title="Perfect Cast Zone" />
            </div>
          </div>
        )}

        {started && phase === "reeling" && (
          <div className="tb-reel">
            <div className="tb-reel-head">
              <span>
                {reelUi.pulling ? (
                  <b className="tb-pull-warn">⚡ FISH SURGING! Ease Tension!</b>
                ) : (
                  <b>🎣 Keep Fish Inside Green Bar!</b>
                )}
              </span>
              <span className="tb-miss">{reelUi.speciesRarity} Fight</span>
            </div>

            {/* Interactive Tracking Bar */}
            <div className="tb-meter tb-reel-track">
              <div ref={zoneRef} className="tb-zone" />
              <div ref={markerRef} className="tb-marker tb-fish-marker">
                🐟
              </div>
            </div>

            {/* Dual Sub-Meters: Catch Progress & Line Tension */}
            <div className="tb-reel-bars">
              <div className="tb-submeter-col">
                <small>CATCH PROGRESS</small>
                <div className="tb-submeter">
                  <div ref={progressRef} className="tb-submeter-fill tb-prog-fill" />
                </div>
              </div>
              <div className="tb-submeter-col">
                <small>LINE TENSION</small>
                <div className="tb-submeter">
                  <div ref={tensionRef} className="tb-submeter-fill tb-tension-fill" />
                </div>
              </div>
            </div>
          </div>
        )}

        {started && showHints && !panel && phase !== "caught" && phase !== "charging" && phase !== "reeling" && (
          <div className={`tb-hint ${phase === "bite" ? "tb-hint-alert" : ""}`}>{hint[phase]}</div>
        )}

        {toast && <div className="tb-toast">{toast}</div>}

        {phase === "caught" && lastCatch && lastSpecies && (
          <div className="tb-overlay" onClick={reset}>
            <div className="tb-panel tb-catch" onClick={(e) => e.stopPropagation()}>
              <div className="tb-catch-badges">
                <span className="tb-rarity" style={{ color: RARITY_COLOR[lastSpecies.rarity] }}>
                  {lastSpecies.rarity}
                </span>
                {lastMut.id !== "none" && (
                  <span className="tb-mut-badge" style={{ background: lastMut.glowColor }}>
                    {lastMut.badge} ({lastMut.mult}x)
                  </span>
                )}
              </div>
              <div
                className="tb-fish-glow"
                style={{
                  ["--glow" as string]:
                    lastMut.id !== "none" ? lastMut.glowColor : RARITY_COLOR[lastSpecies.rarity],
                }}
              >
                <FishSprite s={lastSpecies} size={8} mutation={lastCatch.mutation} />
              </div>
              <h2>
                {lastMut.id !== "none" ? `${lastMut.name} ` : ""}
                {lastSpecies.name}
              </h2>
              <small className="tb-scientific">{lastSpecies.scientific}</small>
              <p className="tb-muted">{lastSpecies.blurb}</p>
              {lastCatch.hasChest && (
                <div className="tb-chest-banner">
                  🧰 Sunken Chest Hooked! +{lastCatch.chestCoins}¢ Bonus
                </div>
              )}
              <div className="tb-stats">
                <div>
                  <small>Weight</small>
                  {lastCatch.weight} kg
                </div>
                <div>
                  <small>Value</small>
                  {lastCatch.value} ¢
                </div>
                <div>
                  <small>Streak</small>🔥 x{save.streak}
                </div>
              </div>
              <div className="tb-row">
                <button
                  className="tb-btn tb-btn-sm"
                  onClick={() => {
                    moveToAquarium(lastCatch);
                    reset();
                  }}
                >
                  🐠 To Tank
                </button>
                <button className="tb-btn tb-btn-primary" onClick={reset}>
                  Keep Fishing
                </button>
              </div>
            </div>
          </div>
        )}

        {!started && (
          <div className="tb-overlay tb-title-screen">
            <div className="tb-panel tb-start">
              <p className="tb-eyebrow">~ realistic pixel lake &amp; deep trench ~</p>
              <h1>TIDEBOUND</h1>
              <p className="tb-sub">Little Fishing Days · Deluxe Edition</p>
              <button
                className="tb-btn tb-btn-primary tb-btn-lg"
                onClick={() => {
                  audio.current.start();
                  lastActivity.current = Date.now();
                  idleMode.current = false;
                  setIdleActive(false);
                  setIdleNotice(false);
                  setStarted(true);
                }}
                disabled={!loaded}
              >
                {save.totalCaught > 0 ? "Continue" : "Set Sail"}
              </button>
              <div className="tb-controls">
                <div>
                  <kbd>Space</kbd> Cast &amp; Reel · <kbd>A</kbd>/<kbd>D</kbd> Row Boat · <kbd>W</kbd> Jig Bait
                </div>
                <div>
                  <kbd>S</kbd> Dock Shop · <kbd>J</kbd> Journal · <kbd>T</kbd> Aquarium · <kbd>Esc</kbd> Pause
                </div>
                <div className="tb-muted">
                  Explore 4 depth zones, hook rare Mutations, and fill your Aquarium!
                </div>
              </div>
            </div>
          </div>
        )}

        {panel && (
          <div className="tb-overlay" onClick={() => setPanel(null)}>
            <div className="tb-panel tb-wide" onClick={(e) => e.stopPropagation()}>
              {panel === "settings" && (
                <>
                  <div className="tb-panel-head">
                    <h2>Sound Settings</h2>
                    <button className="tb-btn tb-btn-sm" onClick={() => setPanel(null)}>
                      ✕
                    </button>
                  </div>
                  <div className="tb-sound-settings">
                    <label>
                      <span>
                        Ambience <b>{soundSettings.ambience}%</b>
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={soundSettings.ambience}
                        onChange={(e) =>
                          setSoundSettings((v: { ambience: number; effects: number }) => ({
                            ...v,
                            ambience: Number(e.target.value),
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>
                        Sound effects <b>{soundSettings.effects}%</b>
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={soundSettings.effects}
                        onChange={(e) =>
                          setSoundSettings((v: { ambience: number; effects: number }) => ({
                            ...v,
                            effects: Number(e.target.value),
                          }))
                        }
                      />
                    </label>
                  </div>
                  <p className="tb-muted">
                    Procedural lake water, birds, crickets, mechanical reel clicks, and drag acoustics.
                  </p>
                </>
              )}

              {panel === "pause" && (
                <>
                  <h2>Paused</h2>
                  <div className="tb-col">
                    <button className="tb-btn tb-btn-primary" onClick={() => setPanel(null)}>
                      Resume
                    </button>
                    <label className="tb-toggle">
                      <input
                        type="checkbox"
                        checked={save.hints}
                        onChange={(e) => setSave((s) => ({ ...s, hints: e.target.checked }))}
                      />
                      Show angling hints
                    </label>
                    <button
                      className="tb-btn"
                      onClick={() => {
                        setPanel(null);
                        setStarted(false);
                        idleMode.current = false;
                        setIdleActive(false);
                        setIdleNotice(false);
                      }}
                    >
                      Title screen
                    </button>
                    <button className="tb-btn tb-btn-danger" onClick={() => setPanel("confirm")}>
                      Reset save…
                    </button>
                  </div>
                  <p className="tb-muted">
                    Caught {save.totalCaught} fish · Best Streak 🔥 x{save.bestStreak} · Perfect Casts ⚡{" "}
                    {save.perfectCasts}
                  </p>
                </>
              )}

              {panel === "confirm" && (
                <>
                  <h2>Reset all progress?</h2>
                  <p className="tb-muted">
                    Coins, fish, upgrades, aquarium, quests and journal will be erased. This cannot be undone.
                  </p>
                  <div className="tb-row">
                    <button className="tb-btn" onClick={() => setPanel("pause")}>
                      Cancel
                    </button>
                    <button className="tb-btn tb-btn-danger" onClick={resetSave}>
                      Yes, reset
                    </button>
                  </div>
                </>
              )}

              {panel === "shop" && (
                <>
                  <div className="tb-panel-head">
                    <h2>Willow Dock Outfitter</h2>
                    <button className="tb-btn tb-btn-sm" onClick={() => setPanel(null)}>
                      ✕
                    </button>
                  </div>

                  <div className="tb-tabs">
                    <button
                      className={`tb-btn tb-btn-sm ${shopTab === "bag" ? "tb-btn-primary" : ""}`}
                      onClick={() => setShopTab("bag")}
                    >
                      🐟 Catch Bag ({save.bag.length})
                    </button>
                    <button
                      className={`tb-btn tb-btn-sm ${shopTab === "gear" ? "tb-btn-primary" : ""}`}
                      onClick={() => setShopTab("gear")}
                    >
                      🎣 Rods, Lures &amp; Boats
                    </button>
                    <button
                      className={`tb-btn tb-btn-sm ${shopTab === "bait" ? "tb-btn-primary" : ""}`}
                      onClick={() => setShopTab("bait")}
                    >
                      🪱 Live Bait &amp; Tackle
                    </button>
                  </div>

                  {shopTab === "bag" && (
                    <>
                      <p className="tb-muted" style={{ margin: "6px 0" }}>
                        Click a fish to sell it, 🔒 lock prized catches, or 🐠 send to your Aquarium.
                      </p>
                      {save.bag.length === 0 ? (
                        <p className="tb-muted">Your creel is empty. Cast a line into the lake!</p>
                      ) : (
                        <>
                          <div className="tb-bag">
                            {save.bag.map((b) => {
                              const sp = SPECIES.find((s) => s.id === b.id) ?? SPECIES[0]!;
                              const mut = b.mutation ? MUTATIONS[b.mutation] : MUTATIONS.none;
                              return (
                                <div key={b.uid} className={`tb-bag-item ${b.locked ? "tb-bag-locked" : ""}`}>
                                  <button
                                    className="tb-bag-sell-area"
                                    onClick={() => !b.locked && sell([b.uid])}
                                    disabled={b.locked}
                                    title={b.locked ? "Locked" : "Click to sell"}
                                  >
                                    <FishSprite s={sp} size={3} mutation={b.mutation} />
                                    <span>
                                      <b>
                                        {mut.id !== "none" ? `${mut.badge} ` : ""}
                                        {sp.name}
                                      </b>
                                      <small>
                                        {b.weight}kg · {b.value}¢
                                      </small>
                                    </span>
                                  </button>
                                  <div className="tb-bag-actions">
                                    <button
                                      className="tb-icon-btn"
                                      onClick={() => toggleLockFish(b.uid)}
                                      title={b.locked ? "Unlock" : "Lock fish"}
                                    >
                                      {b.locked ? "🔒" : "🔓"}
                                    </button>
                                    <button
                                      className="tb-icon-btn"
                                      onClick={() => moveToAquarium(b)}
                                      title="Move to Aquarium"
                                    >
                                      🐠
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <button
                            className="tb-btn tb-btn-primary"
                            disabled={unlockedBag.length === 0}
                            onClick={() => sell(unlockedBag.map((b) => b.uid))}
                          >
                            Sell all unlocked ({unlockedBag.length}) for {bagValue}¢
                          </button>
                        </>
                      )}
                    </>
                  )}

                  {shopTab === "gear" && (
                    <>
                      <h3>
                        Masterwork Upgrades <span className="tb-muted">· Balance: {save.coins}¢</span>
                      </h3>
                      <div className="tb-upgrades">
                        {(["rod", "lure", "boat"] as const).map((k) => {
                          const lvl = save[k];
                          const names = k === "rod" ? ROD_NAMES : k === "lure" ? LURE_NAMES : BOAT_NAMES;
                          const descs = k === "rod" ? ROD_DESCS : k === "lure" ? LURE_DESCS : BOAT_DESCS;
                          const prices = k === "rod" ? ROD_PRICES : k === "lure" ? LURE_PRICES : BOAT_PRICES;
                          const price = prices[lvl];
                          return (
                            <div key={k} className="tb-upgrade">
                              <small className="tb-rarity">
                                {k.toUpperCase()} · Tier {lvl + 1}/{names.length}
                              </small>
                              <b>{names[lvl]}</b>
                              <small className="tb-muted">{descs[lvl]}</small>
                              {price !== undefined ? (
                                <button
                                  className="tb-btn tb-btn-sm tb-btn-primary"
                                  disabled={save.coins < price}
                                  onClick={() => buyUpgrade(k)}
                                >
                                  Upgrade: {names[lvl + 1]} — {price}¢
                                </button>
                              ) : (
                                <span className="tb-muted">✦ Max Masterwork Tier</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {shopTab === "bait" && (
                    <>
                      <h3>
                        Angler's Bait Shop <span className="tb-muted">· Balance: {save.coins}¢</span>
                      </h3>
                      <div className="tb-upgrades">
                        {BAITS.map((b) => {
                          const owned = save.baits[b.id] ?? 0;
                          const isEquipped = save.activeBait === b.id && owned > 0;
                          return (
                            <div key={b.id} className="tb-upgrade">
                              <div className="tb-panel-head">
                                <b>
                                  {b.icon} {b.name}
                                </b>
                                <span className="tb-muted">Owned: {owned}</span>
                              </div>
                              <small className="tb-muted">{b.desc}</small>
                              <div className="tb-row" style={{ marginTop: 4 }}>
                                <button
                                  className="tb-btn tb-btn-sm tb-btn-primary"
                                  disabled={save.coins < b.price}
                                  onClick={() => buyBait(b.id)}
                                >
                                  Buy {b.bundle}x — {b.price}¢
                                </button>
                                {owned > 0 && (
                                  <button
                                    className="tb-btn tb-btn-sm"
                                    onClick={() =>
                                      setSave((s) => ({
                                        ...s,
                                        activeBait: isEquipped ? null : b.id,
                                      }))
                                    }
                                  >
                                    {isEquipped ? "✓ Equipped" : "Equip"}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}

              {panel === "aquarium" && (
                <>
                  <div className="tb-panel-head">
                    <h2>Prized Aquarium Tank ({save.aquarium.length}/8)</h2>
                    <button className="tb-btn tb-btn-sm" onClick={() => setPanel(null)}>
                      ✕
                    </button>
                  </div>
                  <p className="tb-muted">
                    Showcase your rarest &amp; mutated catches! Visitors tip coins every 45s based on tank value.
                  </p>
                  <div className="tb-aquarium-tank">
                    {save.aquarium.length === 0 ? (
                      <div className="tb-aquarium-empty">
                        No fish in tank yet. Send prized catches here from your Catch Modal or Dock Bag!
                      </div>
                    ) : (
                      save.aquarium.map((f, idx) => {
                        const sp = SPECIES.find((s) => s.id === f.id) ?? SPECIES[0]!;
                        const mut = f.mutation ? MUTATIONS[f.mutation] : MUTATIONS.none;
                        return (
                          <div
                            key={f.uid}
                            className="tb-aquarium-swimmer"
                            style={{
                              top: `${16 + ((idx * 23) % 62)}%`,
                              animationDelay: `${idx * -1.4}s`,
                              animationDuration: `${7 + (idx % 4) * 2}s`,
                            }}
                            onClick={() => returnFromAquarium(f)}
                            title="Click to return to Bag"
                          >
                            <FishSprite s={sp} size={4} mutation={f.mutation} />
                            <small>
                              {mut.id !== "none" ? `${mut.badge} ` : ""}
                              {sp.name} ({f.value}¢)
                            </small>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}

              {panel === "journal" && (
                <>
                  <div className="tb-panel-head">
                    <h2>Ichthyology Journal</h2>
                    <button className="tb-btn tb-btn-sm" onClick={() => setPanel(null)}>
                      ✕
                    </button>
                  </div>
                  <p className="tb-muted">
                    Discovered {Object.keys(save.journal).length}/{SPECIES.length} Species · Explore all 4 lake zones!
                  </p>
                  <div className="tb-journal">
                    {SPECIES.map((sp) => {
                      const j = save.journal[sp.id];
                      const zoneNames = sp.zones
                        .map((zid) => DEPTH_ZONES.find((z) => z.id === zid)?.name.split(" ").pop())
                        .join(", ");
                      return (
                        <div key={sp.id} className="tb-entry">
                          <FishSprite s={sp} size={4} hidden={!j} />
                          <div>
                            <b>{j ? sp.name : "???"}</b>
                            <small style={{ color: RARITY_COLOR[sp.rarity] }}>
                              {sp.rarity} · {zoneNames}
                            </small>
                            <small className="tb-muted">
                              {j
                                ? `Caught ${j.count} · Record ${j.best}kg · ~${sp.value}¢`
                                : sp.night
                                  ? "Rises in dark water at night…"
                                  : sp.rain
                                    ? "Drawn to rainstorms…"
                                    : sp.fog
                                      ? "Lurks in mystic fog…"
                                      : `Found in ${zoneNames}`}
                            </small>
                            {j?.mutations && j.mutations.length > 0 && (
                              <div className="tb-entry-muts">
                                {j.mutations.map((m) => (
                                  <span key={m} className="tb-mini-mut">
                                    {MUTATIONS[m].badge}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {started && (
        <div className="tb-controls-bar">
          {phase === "idle" && (
            <div className="tb-nav-btns">
              <button
                className="tb-btn tb-nav-btn"
                onPointerDown={() => {
                  g.current.moveDir = -1;
                }}
                onPointerUp={() => {
                  g.current.moveDir = 0;
                }}
                onPointerLeave={() => {
                  g.current.moveDir = 0;
                }}
                title="Row Left (A)"
              >
                ◄ Row
              </button>
              <button
                className="tb-btn tb-nav-btn"
                onPointerDown={() => {
                  g.current.moveDir = 1;
                }}
                onPointerUp={() => {
                  g.current.moveDir = 0;
                }}
                onPointerLeave={() => {
                  g.current.moveDir = 0;
                }}
                title="Row Deeper (D)"
              >
                Row ►
              </button>
            </div>
          )}

          {phase === "waiting" && (
            <button className="tb-btn tb-nav-btn" onClick={jigLure} title="Twitch bait to attract nearby fish (W)">
              〰 JIG BAIT
            </button>
          )}

          <button
            className={`tb-btn tb-action tb-action-${phase}`}
            onPointerDown={(e) => {
              e.preventDefault();
              if (e.button === 0) actionDown();
            }}
            onPointerUp={(e) => {
              if (e.button === 0) actionUp();
            }}
            onPointerLeave={(e) => {
              if (e.buttons & 1) actionUp();
            }}
            onPointerCancel={(e) => {
              if (e.button === 0) actionUp();
            }}
            onContextMenu={(e) => e.preventDefault()}
            disabled={phase === "casting"}
          >
            {btnLabel[phase]}
          </button>

          <div className="tb-gear tb-muted">
            {ROD_NAMES[save.rod]} · {LURE_NAMES[save.lure]} · {BOAT_NAMES[save.boat]}
            {activeBaitDef && activeBaitCount > 0 ? ` · ${activeBaitDef.icon} ${activeBaitCount}` : ""} · Bag{" "}
            {save.bag.length}
          </div>
        </div>
      )}
    </div>
  );
}
