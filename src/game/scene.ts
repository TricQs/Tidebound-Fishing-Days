import type { WeatherKind } from "./data";

export const W = 320;
export const H = 180;
export const HORIZON = 104;

type RGB = [number, number, number];
const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const css = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

// keyframes: dawn, day, dusk, night
const SKY_TOP = ["#3d5a80", "#4585b4", "#3b3561", "#081021"].map(hex);
const SKY_BOT = ["#f6b77b", "#bfe3e8", "#f08356", "#1b2847"].map(hex);
const MTN_FAR = ["#6b7aa1", "#799fb6", "#685076", "#10192c"].map(hex);
const MTN_NEAR = ["#3e5470", "#456b78", "#3d3252", "#080f1c"].map(hex);
const PINE = ["#1f3a3f", "#22463d", "#202538", "#050a13"].map(hex);
const WATER = ["#1d4a5e", "#1d5b6d", "#22344e", "#0a182b"].map(hex);
const WATER_DEEP = ["#0e2539", "#0c2d40", "#111a30", "#040a16"].map(hex);

export const CYCLE = 840; // 7 minutes of daylight and 7 minutes of night

export function dayInfo(t: number) {
  const p = ((t % CYCLE) / CYCLE) * 4;
  const i = Math.floor(p) % 4;
  const j = (i + 1) % 4;
  const f = p - Math.floor(p);
  const s = f * f * (3 - 2 * f);
  return { i, j, s, phase: p, isNight: p >= 2 };
}

const pick = (arr: RGB[], d: ReturnType<typeof dayInfo>) => mix(arr[d.i]!, arr[d.j]!, d.s);
const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

export function mountainLineY(x: number, t: number) {
  const farX = x + t * 0.25,
    nearX = x + t * 0.65;
  const farY = 60 + Math.sin(farX * 0.03) * 11 + Math.sin(farX * 0.071 + 1) * 6 + Math.sin(farX * 0.013) * 8;
  const nearY = 79 + Math.sin(nearX * 0.045 + 2) * 6 + Math.sin(nearX * 0.11) * 3;
  return Math.min(farY, nearY);
}

export interface SubFish {
  x: number;
  y: number;
  vx: number;
  size: number;
  depth: number;
  curious?: boolean;
}

export interface SceneState {
  t: number;
  phase: string;
  power: number;
  bobber: { x: number; y: number } | null;
  castT: number;
  biteT: number;
  reelPull: number;
  splash: number;
  rain?: number;
  weather?: WeatherKind;
  wind?: number;
  boatX?: number;
  boatVx?: number;
  boatLevel?: number;
  rodLevel?: number;
  tension?: number;
  reelProgress?: number;
  fishPulling?: boolean;
  nibbleAnim?: number;
  jigAnim?: number;
  perfectFlash?: number;
  fishColor?: string;
  subFish?: SubFish[];
  fishJump?: number;
  fishX?: number;
  surfaceSplash?: number;
  surfaceX?: number;
  fishY?: number;
  surfaceY?: number;
  birdT?: number;
  birdDuration?: number;
  birdFlock?: number;
  birdDir?: number;
  birdY?: number;
  meteorT?: number;
  meteorX?: number;
  meteorY?: number;
  lightningFlash?: number;
}

function px(ctx: CanvasRenderingContext2D, c: string, x: number, y: number, w = 1, h = 1) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function line(ctx: CanvasRenderingContext2D, c: string, x0: number, y0: number, x1: number, y1: number) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
  ctx.fillStyle = c;
  for (let k = 0; k <= n; k++) {
    const u = n ? k / n : 0;
    ctx.fillRect(Math.round(x0 + (x1 - x0) * u), Math.round(y0 + (y1 - y0) * u), 1, 1);
  }
}

function quadCurvePx(
  ctx: CanvasRenderingContext2D,
  c: string,
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  steps = 28,
) {
  ctx.fillStyle = c;
  for (let k = 0; k <= steps; k++) {
    const u = k / steps;
    const inv = 1 - u;
    const x = inv * inv * x0 + 2 * inv * u * cx + u * u * x1;
    const y = inv * inv * y0 + 2 * inv * u * cy + u * u * y1;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
}

function lineAboveRidge(
  ctx: CanvasRenderingContext2D,
  c: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  ridgeAt: (x: number) => number,
) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
  ctx.fillStyle = c;
  for (let k = 0; k <= n; k++) {
    const u = n ? k / n : 0;
    const x = Math.round(x0 + (x1 - x0) * u),
      y = Math.round(y0 + (y1 - y0) * u);
    if (y < ridgeAt(x)) ctx.fillRect(x, y, 1, 1);
  }
}

export function drawScene(ctx: CanvasRenderingContext2D, st: SceneState) {
  const { t } = st;
  const d = dayInfo(t);
  const weather: WeatherKind = st.weather ?? ((st.rain ?? 0) > 0 ? "rain" : "clear");
  const isRaining = weather === "rain" || weather === "storm" || (st.rain ?? 0) > 0;
  const isFoggy = weather === "fog";
  const isBiolume = weather === "biolume";

  const top = pick(SKY_TOP, d),
    bot = pick(SKY_BOT, d);

  // 1. Sky gradient bands
  const bands = 16;
  for (let b = 0; b < bands; b++) {
    ctx.fillStyle = css(mix(top, bot, b / (bands - 1)));
    ctx.fillRect(0, Math.floor((b * HORIZON) / bands), W, Math.ceil(HORIZON / bands) + 1);
  }

  const ridgeAt = (x: number) => mountainLineY(x, t);
  const night = d.i === 3 ? 1 - d.s : d.j === 3 ? d.s : 0;

  // 2. Stars & Bioluminescent Aurora
  const starTwinkle = (k: number) =>
    0.15 + 0.85 * (0.5 + 0.5 * Math.sin(t * (0.9 + hash(k + 333) * 1.4) + hash(k + 444) * Math.PI * 2));
  if (night > 0.05) {
    for (let k = 0; k < 48; k++) {
      const starX = hash(k) * W,
        starY = hash(k + 50) * 64;
      const alpha = night * starTwinkle(k);
      if (starY < ridgeAt(starX)) {
        px(ctx, `rgba(255,246,220,${alpha})`, starX, starY);
        if (k % 9 === 0 && alpha > 0.6) {
          px(ctx, `rgba(255,246,220,${alpha * 0.35})`, starX - 1, starY, 3, 1);
          px(ctx, `rgba(255,246,220,${alpha * 0.35})`, starX, starY - 1, 1, 3);
        }
      }
    }
    // Subtle Aurora Borealis ribbon during biolume or deep night
    if (isBiolume || night > 0.55) {
      const auroraAlpha = (isBiolume ? 0.24 : 0.09) * night;
      for (let x = 20; x < W - 20; x += 2) {
        const ay = 18 + Math.sin(x * 0.035 + t * 0.4) * 6 + Math.cos(x * 0.08 - t * 0.25) * 3;
        const ah = 6 + Math.sin(x * 0.06 + t * 0.7) * 4;
        if (ay + ah < ridgeAt(x)) {
          px(ctx, `rgba(80,245,210,${auroraAlpha})`, x, ay, 2, ah);
          px(ctx, `rgba(168,85,247,${auroraAlpha * 0.6})`, x, ay - 3, 2, 3);
        }
      }
    }
  }

  // 3. Distant bird silhouettes
  if ((st.birdT ?? -1) >= 0 && !d.isNight && !isRaining) {
    const duration = Math.max(1, st.birdDuration ?? 12);
    const progress = Math.max(0, Math.min(1, (st.birdT ?? 0) / duration));
    const dir = st.birdDir ?? 1;
    const centerX = dir > 0 ? -12 + progress * (W + 24) : W + 12 - progress * (W + 24);
    const count = st.birdFlock ? 5 : 1;
    for (let i = 0; i < count; i++) {
      const offset = st.birdFlock ? (i - 2) * 6 : 0;
      const bx = centerX + offset;
      const by = (st.birdY ?? 28) + Math.sin(progress * Math.PI * 2 + i * 0.5) * 1.2 + Math.abs(offset) * 0.35;
      const wing = 2 + Math.floor((Math.sin(t * 7 + i) + 1) * 0.7);
      line(ctx, d.isNight ? "#a3afbd" : "#425a65", bx - wing, by - 1, bx, by + 1);
      line(ctx, d.isNight ? "#a3afbd" : "#425a65", bx, by + 1, bx + wing, by - 1);
    }
  }

  // 4. Shooting star / Meteor
  if ((st.meteorT ?? -1) >= 0 && d.isNight && !isRaining) {
    const elapsed = st.meteorT ?? 0;
    const sx0 = st.meteorX ?? 190,
      sy0 = st.meteorY ?? 15;
    const meteorX = sx0 + elapsed * 34,
      meteorY = sy0 + elapsed * 36;
    const glow = Math.max(0.32, 0.95 - elapsed * 0.18);
    lineAboveRidge(ctx, `rgba(255,247,224,${glow * 0.8})`, meteorX - 11, meteorY - 8, meteorX, meteorY, ridgeAt);
    if (meteorY < ridgeAt(meteorX)) px(ctx, `rgba(255,255,243,${glow})`, meteorX, meteorY, 2, 1);
  }

  // 5. Sun & Moon with atmospheric glow halo
  const ang = ((t % CYCLE) / CYCLE) * Math.PI * 2;
  const sx = W / 2 - Math.cos(ang) * 130,
    sy = 70 - Math.sin(ang + 0.3) * 50;
  const moon = d.phase > 2.5 && d.phase < 3.95;
  const mx = moon ? W - sx : sx;
  const my = moon ? 28 + Math.abs(Math.sin(ang)) * 10 : sy;
  const sc = moon ? "#f3ecd2" : "#ffd27a";
  // Soft outer halo
  for (let y = -10; y <= 10; y++) {
    for (let x = -10; x <= 10; x++) {
      const r2 = x * x + y * y;
      if (r2 > 36 && r2 <= 96) {
        px(ctx, moon ? "rgba(243,236,210,0.08)" : "rgba(255,215,130,0.12)", mx + x, my + y);
      }
    }
  }
  for (let y = -6; y <= 6; y++)
    for (let x = -6; x <= 6; x++) if (x * x + y * y <= 36) px(ctx, sc, mx + x, my + y);
  if (moon) {
    for (let y = -6; y <= 6; y++)
      for (let x = -6; x <= 6; x++)
        if ((x + 3) * (x + 3) + (y - 1) * (y - 1) <= 20 && x * x + y * y <= 36) px(ctx, "#d7cfb3", mx + x, my + y);
  }

  // 6. Far Mountains with 3D sunlit ridges & snowcaps
  const far = pick(MTN_FAR, d);
  const farShade = mix(far, [10, 16, 30], 0.22);
  for (let x = 0; x < W; x++) {
    const xx = x + t * 0.25;
    const y = 60 + Math.sin(xx * 0.03) * 11 + Math.sin(xx * 0.071 + 1) * 6 + Math.sin(xx * 0.013) * 8;
    const slope = Math.cos(xx * 0.03) * 0.33 + Math.cos(xx * 0.071 + 1) * 0.42;
    const col = slope > 0 && !d.isNight ? mix(far, [255, 235, 205], 0.12) : slope < -0.15 ? farShade : far;
    ctx.fillStyle = css(col);
    ctx.fillRect(x, Math.round(y), 1, HORIZON - Math.round(y));
    if (y < 57) {
      px(ctx, d.isNight ? "rgba(95,115,145,0.28)" : "rgba(252,245,230,0.68)", x, y, 1, 2 + (x % 3 === 0 ? 1 : 0));
    }
  }

  // 7. Near Mountains & Distant Waterfall
  const near = css(pick(MTN_NEAR, d));
  ctx.fillStyle = near;
  for (let x = 0; x < W; x++) {
    const xx = x + t * 0.65;
    const y = 79 + Math.sin(xx * 0.045 + 2) * 6 + Math.sin(xx * 0.11) * 3;
    ctx.fillRect(x, Math.round(y), 1, HORIZON - Math.round(y));
  }
  // Distant mountain waterfall around x = 238
  const wfX = 238 - ((t * 0.65) % W);
  const wfScreenX = ((wfX % W) + W) % W;
  if (wfScreenX > 60 && wfScreenX < W - 15) {
    const wfTop = Math.round(81 + Math.sin((wfScreenX + t * 0.65) * 0.045 + 2) * 5);
    for (let wy = wfTop; wy < HORIZON; wy++) {
      const shimmer = (Math.floor(wy + t * 14) % 3) === 0;
      px(
        ctx,
        d.isNight
          ? shimmer
            ? "rgba(150,195,220,0.45)"
            : "rgba(95,140,175,0.3)"
          : shimmer
            ? "rgba(235,250,255,0.75)"
            : "rgba(175,220,235,0.5)",
        wfScreenX,
        wy,
        2,
        1,
      );
    }
    // Mist at waterfall base
    px(ctx, "rgba(220,242,248,0.35)", wfScreenX - 2, HORIZON - 2, 6, 2);
  }

  // 8. Shoreline Pine Forest & Cozy Distant Cabin
  const pine = css(pick(PINE, d));
  const pineLight = css(mix(pick(PINE, d), [90, 140, 110], d.isNight ? 0.05 : 0.18));
  const off = (t * 1.1) % 7;
  for (let i = -1; i < W / 7 + 2; i++) {
    const seed = i + Math.floor((t * 1.1) / 7);
    const h = 8 + hash(seed) * 13;
    const cx = i * 7 - off + 3;
    for (let r = 0; r < h; r++) {
      const hw = Math.floor((r / h) * 3.6);
      ctx.fillStyle = pine;
      ctx.fillRect(Math.round(cx - hw), Math.round(HORIZON - h + r), hw * 2 + 1, 1);
      if (!d.isNight && r % 2 === 0 && hw > 0) {
        ctx.fillStyle = pineLight;
        ctx.fillRect(Math.round(cx - hw), Math.round(HORIZON - h + r), 1, 1);
      }
    }
  }
  ctx.fillStyle = pine;
  ctx.fillRect(0, HORIZON - 2, W, 2);

  // Cozy shoreline cabin on the distant bank (x ~ 18)
  const cabX = 14,
    cabY = HORIZON - 9;
  px(ctx, d.isNight ? "#1a1412" : "#4a3222", cabX, cabY + 3, 12, 6);
  line(ctx, d.isNight ? "#0d131a" : "#2b1d14", cabX - 1, cabY + 3, cabX + 6, cabY - 1);
  line(ctx, d.isNight ? "#0d131a" : "#2b1d14", cabX + 13, cabY + 3, cabX + 6, cabY - 1);
  // Cabin warm window at night/dusk/rain
  if (d.isNight || d.i === 2 || isRaining) {
    const winFlicker = 0.85 + 0.15 * Math.sin(t * 5);
    px(ctx, `rgba(255,205,105,${winFlicker})`, cabX + 3, cabY + 5, 2, 2);
    px(ctx, `rgba(255,205,105,${winFlicker * 0.85})`, cabX + 7, cabY + 5, 2, 2);
  }
  // Chimney smoke
  for (let sm = 0; sm < 5; sm++) {
    const smAge = ((t * 1.4 + sm * 0.8) % 4) / 4;
    const smX = cabX + 9 + smAge * 5 + Math.sin(t * 2 + sm) * 1;
    const smY = cabY - 1 - smAge * 10;
    px(ctx, `rgba(215,225,230,${(1 - smAge) * 0.35})`, smX, smY, 2, 2);
  }

  // 9. Clouds with volume shading
  for (let i = 0; i < 4; i++) {
    const width = 24 + hash(i + 1700) * 26;
    const x = ((hash(i + 1750) * (W + width) + t * (0.9 + i * 0.22)) % (W + width)) - width;
    const y = 20 + hash(i + 1800) * 28;
    const cloud = d.isNight ? "rgba(28,42,66,0.72)" : "rgba(242,246,238,0.66)";
    const cloudShade = d.isNight ? "rgba(17,27,45,0.5)" : "rgba(176,198,204,0.34)";
    px(ctx, cloudShade, x + 2, y + 5, width, 2);
    px(ctx, cloud, x + 4, y + 2, width - 8, 3);
    px(ctx, cloud, x, y + 4, width, 3);
    px(ctx, cloud, x + 6, y, 9, 4);
    px(ctx, cloud, x + width * 0.55, y + 1, 11, 3);
  }

  // 10. Water surface with Horizontal Bathymetry (Shallows -> Deep Trench)
  const wTop = pick(WATER, d),
    wBot = pick(WATER_DEEP, d);
  const wb = 12;
  for (let b = 0; b < wb; b++) {
    const rowRatio = b / (wb - 1);
    const baseRow = mix(wTop, wBot, rowRatio);
    const y0 = HORIZON + Math.floor((b * (H - HORIZON)) / wb);
    const hBand = Math.ceil((H - HORIZON) / wb) + 1;
    ctx.fillStyle = css(baseRow);
    ctx.fillRect(0, y0, W, hBand);
  }

  // Subtle horizontal bathymetry tint: warm teal shallows on left, deep indigo trench on right
  const bathyGrad = ctx.createLinearGradient(0, HORIZON, W, HORIZON);
  bathyGrad.addColorStop(0, d.isNight ? "rgba(35,85,90,0.14)" : "rgba(75,175,165,0.18)");
  bathyGrad.addColorStop(0.38, "rgba(0,0,0,0)");
  bathyGrad.addColorStop(0.75, "rgba(8,22,42,0.16)");
  bathyGrad.addColorStop(1, "rgba(4,10,24,0.34)");
  ctx.fillStyle = bathyGrad;
  ctx.fillRect(0, HORIZON, W, H - HORIZON);

  // Underwater sunbeams / god rays in daytime
  if (!d.isNight && !isRaining) {
    for (let r = 0; r < 4; r++) {
      const rx = 65 + r * 62 + Math.sin(t * 0.4 + r) * 8;
      for (let dy = 2; dy < 42; dy += 2) {
        const rw = Math.max(1, 5 - Math.floor(dy / 10));
        px(ctx, `rgba(190,240,235,${0.065 * (1 - dy / 42)})`, rx + dy * 0.35, HORIZON + dy, rw, 2);
      }
    }
  }

  // Celestial water reflection
  const celestialVisible = my < ridgeAt(mx);
  if (celestialVisible) {
    for (let k = 0; k < 14; k++) {
      const ry = HORIZON + 3 + k * 3;
      const wob = Math.sin(t * 2.2 + k * 1.7) * (2 + k * 0.14);
      const ww = Math.max(1, 13 - k + Math.round(Math.sin(t * 3 + k) * 2));
      px(
        ctx,
        moon ? "rgba(216,226,238,0.21)" : "rgba(255,205,125,0.22)",
        mx - ww / 2 + wob,
        ry,
        ww,
        1,
      );
    }
  }

  // Cabin window reflection on left water
  if (d.isNight || d.i === 2) {
    for (let k = 0; k < 4; k++) {
      px(ctx, "rgba(255,195,95,0.18)", cabX + 4 + Math.sin(t * 3 + k) * 1.5, HORIZON + 3 + k * 2, 4 - k * 0.5, 1);
    }
  }

  // Parallax water ripples
  const layers = [
    { y: HORIZON + 4, rows: 4, sp: 2, len: 3, a: 0.18, gap: 18 },
    { y: HORIZON + 22, rows: 4, sp: 5, len: 5, a: 0.22, gap: 24 },
    { y: HORIZON + 44, rows: 4, sp: 9, len: 8, a: 0.28, gap: 32 },
  ];
  layers.forEach((L, li) => {
    for (let r = 0; r < L.rows; r++) {
      const y = L.y + r * 5;
      for (let k = 0; k < W / L.gap + 2; k++) {
        const x = ((k * L.gap + hash(k + r * 13 + li * 7) * L.gap + t * L.sp * (r % 2 ? 1 : 0.7)) % (W + L.gap)) - L.gap;
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.5 + k + r);
        const col = isBiolume ? `rgba(94,242,220,${L.a * pulse * 1.4})` : `rgba(200,235,240,${L.a * pulse})`;
        px(ctx, col, x, y + Math.sin(t + k) * 0.6, L.len, 1);
      }
    }
  });

  // Bioluminescent plankton particles in deep water or during Biolume event
  if (isBiolume || night > 0.3) {
    const count = isBiolume ? 28 : 10;
    for (let i = 0; i < count; i++) {
      const bx = (hash(i + 500) * (W - 70) + 60 + Math.sin(t * 0.6 + i) * 8) % W;
      const by = HORIZON + 8 + hash(i + 550) * (H - HORIZON - 12);
      const glow = 0.3 + 0.7 * Math.max(0, Math.sin(t * 2.2 + i * 1.7));
      if (bx > 180 || isBiolume) {
        px(ctx, `rgba(64,235,220,${glow * (isBiolume ? 0.65 : 0.35)})`, bx, by, 1, 1);
      }
    }
  }

  // Mountain & Pine reflections
  for (let x = 0; x < W; x += 2) {
    const ridge = ridgeAt(x);
    const depth = Math.min(27, Math.max(3, (HORIZON - ridge) * 0.32));
    const shimmer = Math.sin(t * 1.8 + x * 0.19) * 1.5;
    px(
      ctx,
      d.isNight ? "rgba(76,91,119,0.12)" : "rgba(150,180,180,0.11)",
      x + shimmer,
      HORIZON + depth,
      1 + (x % 7 === 0 ? 2 : 0),
      1,
    );
    if (x % 6 === 0)
      px(
        ctx,
        d.isNight ? "rgba(28,44,59,0.18)" : "rgba(31,62,59,0.13)",
        x - shimmer,
        HORIZON + 3 + hash(x + 1880) * 7,
        2,
        2 + hash(x + 1900) * 5,
      );
  }

  // 11. Underwater Swimming Fish Silhouettes!
  if (st.subFish && st.subFish.length > 0) {
    for (const sf of st.subFish) {
      const dir = sf.vx >= 0 ? 1 : -1;
      const wag = Math.sin(t * 9 + sf.x * 0.2) * 0.8;
      const alpha = sf.curious ? 0.52 : 0.28;
      const shadowCol = isBiolume
        ? `rgba(45,212,191,${alpha})`
        : d.isNight
          ? `rgba(8,18,32,${alpha + 0.15})`
          : `rgba(14,42,56,${alpha})`;
      const w = sf.size;
      px(ctx, shadowCol, sf.x - w / 2, sf.y, w, 2);
      px(ctx, shadowCol, sf.x - w / 2 + 1, sf.y - 1, Math.max(2, w - 2), 1);
      // Tail fin wagging
      const tailX = dir > 0 ? sf.x - w / 2 - 2 : sf.x + w / 2;
      px(ctx, shadowCol, tailX, sf.y + wag, 2, 2);
    }
  }

  // 12. Left Shoreline Reeds, Lily Pads & Wooden Willow Dock
  // Cattails & Reeds near left shore
  const reedPositions = [32, 36, 41, 44, 49, 54, 118, 122];
  reedPositions.forEach((rx, idx) => {
    const sway = Math.sin(t * 1.8 + idx) * 1.2;
    const rh = 9 + (idx % 3) * 3;
    const ry = HORIZON + 4 + (idx % 4) * 3;
    line(ctx, d.isNight ? "#122624" : "#2d5a43", rx, ry, rx + sway, ry - rh);
    if (idx % 2 === 0) {
      px(ctx, d.isNight ? "#241914" : "#5c3a21", rx + sway * 0.8, ry - rh + 2, 1, 3);
    }
  });

  // Floating Lily Pads & Lotus in Shallows
  const lilies = [
    { x: 48, y: HORIZON + 18, flower: true },
    { x: 60, y: HORIZON + 24, flower: false },
    { x: 54, y: HORIZON + 31, flower: false },
    { x: 112, y: HORIZON + 15, flower: true },
  ];
  lilies.forEach((lp, idx) => {
    const bob = Math.sin(t * 1.6 + idx * 2) * 0.5;
    px(ctx, d.isNight ? "#173831" : "#3a7d52", lp.x, lp.y + bob, 6, 2);
    px(ctx, d.isNight ? "#214d42" : "#529e66", lp.x + 1, lp.y - 1 + bob, 4, 1);
    if (lp.flower) {
      px(ctx, "#f48fb1", lp.x + 2, lp.y - 2 + bob, 2, 2);
      px(ctx, "#fce4ec", lp.x + 2, lp.y - 2 + bob, 1, 1);
    }
  });

  // Wooden Willow Dock on far left (x: 0..34)
  const dockY = HORIZON + 12;
  // Pilings & Reflection
  for (const pxX of [6, 18, 30]) {
    px(ctx, "#2e1b0f", pxX, dockY, 3, 14);
    px(ctx, "rgba(25,16,10,0.35)", pxX + Math.sin(t * 2) * 1, dockY + 14, 3, 6);
  }
  // Dock Planks
  px(ctx, "#5a351d", 0, dockY - 2, 34, 3);
  for (let dx = 1; dx < 33; dx += 4) {
    px(ctx, "#8c5630", dx, dockY - 2, 3, 2);
  }
  // Dock Post & Hanging Warm Lantern
  px(ctx, "#4a2b17", 29, dockY - 14, 2, 12);
  px(ctx, "#4a2b17", 29, dockY - 14, 5, 1);
  const lanternOn = d.isNight || d.i === 2 || d.i === 0 || isRaining || isFoggy;
  px(ctx, lanternOn ? "#ffd166" : "#8d99ae", 33, dockY - 12, 2, 3);
  if (lanternOn) {
    const lGlow = 0.22 + 0.05 * Math.sin(t * 6);
    for (let r = 1; r <= 6; r++) {
      px(ctx, `rgba(255,195,90,${lGlow * (1 - r / 7)})`, 34 - r, dockY - 11 - r * 0.5, r * 2, r * 2);
    }
    // Lantern reflection on dockside water
    for (let k = 0; k < 5; k++) {
      px(ctx, `rgba(255,195,90,${0.22 - k * 0.035})`, 32 + Math.sin(t * 3 + k) * 1.5, dockY + 12 + k * 3, 4 - k * 0.5, 1);
    }
  }

  // 13. Natural Jumping Fish in background
  if ((st.fishJump ?? 0) > 0) {
    const left = st.fishJump!;
    const progress = Math.max(0, Math.min(1, (1.35 - left) / 0.95));
    const fx = st.fishX ?? 190;
    const waterY = st.fishY ?? HORIZON + 8;
    if (left > 0.3) {
      const fy = waterY - Math.sin(progress * Math.PI) * 17;
      const facing = progress < 0.5 ? 1 : -1;
      px(ctx, "#d5b45b", fx, fy, 7, 3);
      px(ctx, "#e9d17c", fx + (facing > 0 ? 2 : 1), fy - 2, 4, 2);
      px(ctx, "#6c9b8c", fx + (facing > 0 ? 1 : 5), fy + 2, 2, 2);
      px(ctx, "#f7e8b7", fx + (facing > 0 ? 6 : 0), fy, 1, 1);
    } else {
      const splashAge = (0.3 - left) / 0.3;
      const radius = 2 + splashAge * 7;
      px(ctx, `rgba(225,246,250,${1 - splashAge})`, fx - radius, waterY, 2, 1);
      px(ctx, `rgba(225,246,250,${1 - splashAge})`, fx + radius, waterY, 2, 1);
      px(ctx, `rgba(225,246,250,${1 - splashAge})`, fx - radius * 0.5, waterY - splashAge * 3, 1, 2);
    }
  }

  // 14. Boat & Angler (Movable across the lake + Upgradable Boat Tiers!)
  const boatLevel = st.boatLevel ?? 0;
  const bx = Math.round(st.boatX ?? 70);
  const boatVx = st.boatVx ?? 0;
  const by = 130 + Math.round(Math.sin(t * 1.5 + bx * 0.05) * 1);
  const hull =
    boatLevel >= 3
      ? ["#384b5c", "#4d6478", "#283645", "#1b2530"]
      : boatLevel === 2
        ? ["#5c3d2e", "#754f3c", "#452c20", "#2e1d15"]
        : boatLevel === 1
          ? ["#7c4728", "#945632", "#5e341c", "#422413"]
          : ["#6b3f22", "#7d4a28", "#5a331b", "#3f2413"];

  const ax = bx + 30,
    ay = by,
    waterline = by + 5;
  const rodTipX = ax + 20,
    rodTipY = ay - 26;

  // Boat Wake ripples when moving
  if (Math.abs(boatVx) > 1.5) {
    const wakeX = boatVx > 0 ? bx - 6 : bx + 62;
    for (let w = 0; w < 4; w++) {
      const wx = wakeX - Math.sign(boatVx) * w * 5 + Math.sin(t * 10 + w) * 1.5;
      px(ctx, `rgba(225,248,252,${0.48 - w * 0.1})`, wx, waterline + 1 + w, 4, 1);
    }
  }

  // Boat & Angler Reflection in Water
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, HORIZON, W, H - HORIZON);
  ctx.clip();
  ctx.globalAlpha = 0.28;
  for (let r = 0; r < 4; r++) {
    const inset = Math.floor(r * r * 0.18);
    const reflectedY = 2 * waterline - (by + r);
    px(
      ctx,
      hull[r % 4 === 0 ? 3 : r % 2 ? 1 : 0]!,
      bx + inset + Math.sin(t * 2 + r) * 2,
      reflectedY,
      60 - inset * 2,
      1,
    );
  }
  px(ctx, "#18333a", ax - 4, 2 * waterline - (ay - 10), 9, 8);
  px(ctx, "#223b43", ax - 4, 2 * waterline - (ay - 15), 7, 5);
  px(ctx, "#2d3b46", ax - 4, 2 * waterline - (ay - 17), 10, 2);
  for (let r = 0; r < 4; r++)
    px(
      ctx,
      "rgba(22,31,41,0.7)",
      bx + 5 + r * 2 + Math.sin(t * 2.6 + r) * 2,
      waterline + 6 + r * 3,
      50 - r * 4,
      1,
    );
  ctx.restore();

  // Boat Canopy / Steam Launch Superstructure (behind or around angler)
  if (boatLevel === 2) {
    // Canopy supports
    line(ctx, "#4a2c18", bx + 8, by, bx + 10, by - 22);
    line(ctx, "#4a2c18", bx + 44, by, bx + 42, by - 22);
    // Striped Canopy Roof
    px(ctx, "#d96b43", bx + 6, by - 24, 40, 3);
    for (let cx = bx + 8; cx < bx + 44; cx += 6) {
      px(ctx, "#f4e8c1", cx, by - 24, 3, 3);
    }
  } else if (boatLevel >= 3) {
    // Steam Launch Cabin & Brass Smokestack
    px(ctx, "#2b3a4a", bx + 6, by - 14, 18, 14);
    px(ctx, "#d4a359", bx + 5, by - 15, 20, 2);
    // Glowing cabin porthole
    px(ctx, lanternOn ? "#ffd166" : "#a8dadc", bx + 12, by - 9, 5, 4);
    // Brass smokestack
    px(ctx, "#c98a3b", bx + 13, by - 24, 4, 9);
    px(ctx, "#e6b86a", bx + 12, by - 25, 6, 2);
    // Steam puffs
    for (let sp = 0; sp < 4; sp++) {
      const spAge = ((t * 1.8 + sp * 0.7) % 3) / 3;
      px(
        ctx,
        `rgba(240,246,250,${(1 - spAge) * 0.45})`,
        bx + 13 - spAge * 8 - boatVx * 0.08,
        by - 27 - spAge * 9,
        3,
        2,
      );
    }
  }

  // Boat Hull
  for (let r = 0; r < 8; r++) {
    const inset = Math.floor(r * r * 0.18);
    px(
      ctx,
      r === 0 ? (boatLevel >= 3 ? "#d4a359" : "#c98a4b") : hull[r % 4 === 0 ? 3 : r % 2 ? 1 : 0]!,
      bx + inset,
      by + r,
      60 - inset * 2,
      1,
    );
  }
  px(ctx, boatLevel >= 3 ? "#f0c87a" : "#e2a85c", bx + 2, by + 3, 52, 1);

  // Boat Bow Lantern (for boatLevel >= 1 or night time)
  const hasBoatLantern = boatLevel >= 1 || d.isNight;
  if (hasBoatLantern) {
    const lx = bx + 57,
      ly = by - 5;
    line(ctx, "#4a2c18", bx + 54, by, lx, ly);
    px(ctx, lanternOn ? "#ffd166" : "#94a3b8", lx, ly, 2, 3);
    if (lanternOn) {
      const bGlow = 0.25 + 0.05 * Math.sin(t * 7);
      for (let r = 1; r <= 7; r++) {
        px(ctx, `rgba(255,205,100,${bGlow * (1 - r / 8)})`, lx + 1 - r, ly + 1 - r * 0.5, r * 2, r * 2);
      }
      // Warm reflection on water ahead of bow
      for (let k = 0; k < 5; k++) {
        px(
          ctx,
          `rgba(255,200,95,${0.24 - k * 0.04})`,
          lx - 1 + Math.sin(t * 4 + k) * 2,
          waterline + 3 + k * 2,
          4 - k * 0.5,
          1,
        );
      }
    }
  }

  // Angler (seated, with breathing, wind-blown scarf & dynamic posture)
  const pull =
    st.phase === "reeling"
      ? Math.round(Math.sin(t * 22) * 1.4) - (st.fishPulling ? 1 : 0)
      : 0;
  const breath = Math.sin(t * 2.2) > 0.3 ? -1 : 0;
  px(ctx, "#2c5c6a", ax - 4 - (st.phase === "reeling" ? 1 : 0), ay - 10 + breath, 9, 10 - breath); // coat
  px(ctx, "#1f4450", ax - 4, ay - 3, 9, 3);
  px(ctx, "#f2c9a0", ax - 2, ay - 15 + breath, 6, 5); // face
  px(ctx, "#1b2533", ax + 2, ay - 13 + breath, 1, 1); // eye
  // Hat
  px(ctx, "#e0a24a", ax - 4, ay - 17 + breath, 10, 2);
  px(ctx, "#c8862f", ax - 2, ay - 19 + breath, 6, 2);
  px(ctx, "#a2442f", ax - 4, ay - 16 + breath, 10, 1);
  // Wind-blown red scarf tail behind angler
  const scarfWave = Math.round(Math.sin(t * 6) * 1.2);
  px(ctx, "#c94a38", ax - 6, ay - 10 + breath, 3, 2);
  px(ctx, "#a23828", ax - 8, ay - 10 + breath + scarfWave, 2, 1);

  // Arm & Hand
  const handX = ax + 6 + pull,
    handY = ay - 7 + breath;
  px(ctx, "#2c5c6a", ax + 3, ay - 8 + breath, 4, 2);
  px(ctx, "#f2c9a0", handX, handY - 1, 2, 2);

  // 15. Dynamic Curved Fishing Rod (bends realistically under tension!)
  const rodColors = ["#8a5a2b", "#a47138", "#c28342", "#64748b", "#7dd3fc", "#f472b6"];
  const rodColor = rodColors[Math.min(rodColors.length - 1, st.rodLevel ?? 0)]!;
  const tension = st.tension ?? 0;

  let tipX = rodTipX,
    tipY = rodTipY;
  let ctrlX = (handX + rodTipX) / 2,
    ctrlY = (handY + rodTipY) / 2 - 3;

  if (st.phase === "charging") {
    tipX = handX - 10 - st.power * 8;
    tipY = rodTipY - 4 + st.power * 3;
    ctrlX = handX - 4;
    ctrlY = handY - 14;
  } else if (st.phase === "bite") {
    tipX = rodTipX + 4;
    tipY = rodTipY + 8;
    ctrlX = handX + 10;
    ctrlY = rodTipY - 2;
  } else if (st.phase === "reeling") {
    const bend = 4 + tension * 12 + (st.fishPulling ? 4 : 0);
    tipX = rodTipX + 3 + Math.sin(t * 28) * (0.6 + tension);
    tipY = rodTipY + bend;
    ctrlX = handX + 11;
    ctrlY = rodTipY - 4 + bend * 0.25;
  } else if ((st.jigAnim ?? 0) > 0) {
    tipY = rodTipY - 4;
  }

  quadCurvePx(ctx, rodColor, handX, handY, ctrlX, ctrlY, tipX, tipY, 26);
  // Reel handle at grip
  px(ctx, "#e0a24a", handX + 1, handY - 1, 2, 2);

  // "PERFECT CAST!" sparkle text above angler
  if ((st.perfectFlash ?? 0) > 0) {
    const py = ay - 26 - (1 - st.perfectFlash!) * 8;
    px(ctx, "#fde047", ax - 6, py, 16, 2);
    px(ctx, "#ffffff", ax - 4, py - 1, 12, 1);
  }

  // 16. Fishing Line, Bobber, Nibble Rings & Active Reeling Fight
  if (st.bobber) {
    const b = st.bobber;
    let bxp = b.x,
      byp = b.y;

    if (st.phase === "casting") {
      const u = st.castT;
      bxp = tipX + (b.x - tipX) * u;
      const arc = Math.min(26, Math.max(6, (b.y - tipY) * 0.42));
      byp = tipY + (b.y - tipY) * u - Math.sin(u * Math.PI) * arc;
    } else if (st.phase === "waiting") {
      const nibbleOffset = (st.nibbleAnim ?? 0) > 0 ? 2.2 : 0;
      const jigOffset = (st.jigAnim ?? 0) > 0 ? -1.8 : 0;
      byp += Math.round(Math.sin(t * 3) * 0.6 + nibbleOffset + jigOffset);
      if ((st.jigAnim ?? 0) > 0) {
        bxp -= 1.5;
      }
    } else if (st.phase === "bite") {
      byp += 3 + Math.round(Math.abs(Math.sin(t * 18)) * 2.5);
    } else if (st.phase === "reeling") {
      // As reelProgress goes 0 -> 1, the hooked fish is pulled closer to the boat!
      const prog = Math.max(0, Math.min(0.88, st.reelProgress ?? 0));
      const targetX = bx + 68;
      const targetY = waterline + 2;
      bxp = b.x + (targetX - b.x) * prog + Math.sin(t * (st.fishPulling ? 18 : 8)) * (st.fishPulling ? 5 : 2.5);
      byp = b.y + (targetY - b.y) * prog + Math.cos(t * 14) * 1.5;
    }

    // Bobber reflection
    if (st.phase === "casting" && byp >= HORIZON - 2) {
      const fade = Math.max(0, Math.min(0.18, (byp - HORIZON + 5) * 0.025));
      px(ctx, `rgba(242,220,166,${fade})`, bxp - 2 + Math.sin(t * 3) * 2, Math.min(H - 1, byp + 3), 2, 1);
    } else if (st.phase === "waiting" || st.phase === "bite" || st.phase === "reeling") {
      px(ctx, "rgba(217,69,59,0.22)", bxp + Math.sin(t * 3) * 2, Math.min(H - 1, byp + 3), 2, 1);
    }

    // Fishing Line (Catenary sag when waiting, vibrating taut line when reeling!)
    const n = 44;
    const isTaut = st.phase === "reeling" || st.phase === "bite";
    const lineColor =
      st.phase === "reeling" && tension > 0.78
        ? "rgba(255,110,95,0.95)"
        : st.phase === "reeling" && tension > 0.5
          ? "rgba(255,215,115,0.9)"
          : "rgba(240,234,214,0.85)";
    ctx.fillStyle = lineColor;
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      const sag = isTaut ? Math.max(0.4, 2.5 * (1 - tension)) : 10;
      const vib = isTaut && st.fishPulling ? Math.sin(u * Math.PI * 4 + t * 50) * 0.7 : 0;
      const x = tipX + (bxp - tipX) * u;
      const y = tipY + (byp - tipY) * u + Math.sin(u * Math.PI) * sag + vib;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }

    // Hooked Fish Silhouette & Thrashing Foam during Reeling
    if (st.phase === "reeling") {
      const fCol = st.fishColor ?? "#72efdd";
      const thrashX = bxp + Math.sin(t * 24) * 2;
      // Underwater shadow + flash of fish flank
      px(ctx, "rgba(12,28,40,0.65)", thrashX - 4, byp + 2, 8, 3);
      if (Math.sin(t * 16) > 0) {
        px(ctx, fCol, thrashX - 2, byp + 1, 5, 2);
      }
      // Whitewater foam & spray droplets when fish is fighting
      const sprayCount = st.fishPulling ? 6 : 3;
      for (let sp = 0; sp < sprayCount; sp++) {
        const sx = bxp + Math.cos(t * 15 + sp * 2.1) * (4 + sp);
        const sy = byp - Math.abs(Math.sin(t * 18 + sp * 1.7)) * (st.fishPulling ? 6 : 3);
        px(ctx, "rgba(235,250,255,0.85)", sx, sy, 1, 1);
      }
    }

    // Draw Bobber
    const submerged = st.phase === "bite" || st.phase === "reeling" || (st.nibbleAnim ?? 0) > 0.15;
    px(ctx, "#fdf6e3", bxp - 1, byp - 3, 3, 2);
    if (!submerged) px(ctx, "#d9453b", bxp - 1, byp - 1, 3, 2);
    else px(ctx, "#d9453b", bxp - 1, byp - 1, 3, 1);

    // Concentric Ripple Rings around Bobber
    if (st.phase !== "casting") {
      const speed = (st.nibbleAnim ?? 0) > 0 || (st.jigAnim ?? 0) > 0 ? 12 : 6;
      const rr = (t * speed) % 10;
      const a = 0.55 * (1 - rr / 10);
      px(ctx, `rgba(220,245,248,${a})`, bxp - 3 - rr, byp + 1, 2, 1);
      px(ctx, `rgba(220,245,248,${a})`, bxp + 2 + rr, byp + 1, 2, 1);
    }

    // Subtle Nibble "?" or twitch droplets
    if (st.phase === "waiting" && (st.nibbleAnim ?? 0) > 0) {
      px(ctx, "rgba(235,248,255,0.85)", bxp - 3, byp - 2, 1, 1);
      px(ctx, "rgba(235,248,255,0.85)", bxp + 3, byp - 3, 1, 1);
    }

    // Strike "!!" Alert Cue
    if (st.phase === "bite") {
      const flash = Math.floor(t * 10) % 2 === 0;
      const alertCol = flash ? "#ffd27a" : "#ff4d6d";
      px(ctx, alertCol, bxp - 2, byp - 17, 2, 7);
      px(ctx, alertCol, bxp - 2, byp - 8, 2, 2);
      px(ctx, alertCol, bxp + 2, byp - 17, 2, 7);
      px(ctx, alertCol, bxp + 2, byp - 8, 2, 2);
      for (let k = 0; k < 5; k++) {
        px(
          ctx,
          "rgba(255,255,255,0.85)",
          bxp - 5 + k * 2.5,
          byp + 1 - Math.abs(Math.sin(t * 12 + k)) * 4,
          1,
          1,
        );
      }
    }
  }

  // Cast Landing Splash
  if (st.splash > 0 && st.bobber) {
    const s = 1 - st.splash;
    for (let k = 0; k < 7; k++) {
      const a = (k / 6) * Math.PI;
      px(
        ctx,
        `rgba(230,248,252,${st.splash})`,
        st.bobber.x + Math.cos(a) * s * 9,
        st.bobber.y - Math.sin(a) * s * 9,
        1,
        1,
      );
    }
  }

  // Surface ambient splash
  if ((st.surfaceSplash ?? 0) > 0) {
    const age = 1 - st.surfaceSplash!;
    const radius = 1 + age * 5;
    const sx = st.surfaceX ?? 220,
      sy = st.surfaceY ?? HORIZON + 8;
    px(ctx, `rgba(220,245,250,${st.surfaceSplash})`, sx - radius, sy, 2, 1);
    px(ctx, `rgba(220,245,250,${st.surfaceSplash})`, sx + radius, sy, 2, 1);
    px(ctx, `rgba(245,252,255,${st.surfaceSplash})`, sx, sy - age * 3, 1, 2);
  }

  // 17. Weather Overlays: Mystic Fog, Rain & Storm Lightning
  if (isFoggy) {
    for (let b = 0; b < 4; b++) {
      const fy = HORIZON - 10 + b * 14;
      const fx = ((t * (2.5 + b * 0.8) + b * 70) % (W + 120)) - 120;
      ctx.fillStyle = d.isNight ? "rgba(65,85,110,0.16)" : "rgba(215,232,235,0.22)";
      ctx.fillRect(0, fy, W, 10);
      px(ctx, d.isNight ? "rgba(85,110,138,0.2)" : "rgba(235,245,248,0.28)", fx, fy + 2, 110, 5);
    }
  }

  if (isRaining) {
    ctx.fillStyle = weather === "storm" ? "rgba(12,22,38,0.26)" : "rgba(19,32,51,0.16)";
    ctx.fillRect(0, 0, W, HORIZON);
    const dropCount = weather === "storm" ? 96 : 72;
    ctx.lineWidth = 1;
    for (let i = 0; i < dropCount; i++) {
      const startY = hash(i + 610) * 54;
      const impactY = HORIZON + 2 + hash(i + 710) * (H - HORIZON - 8);
      const speed = (weather === "storm" ? 95 : 72) + hash(i + 810) * 84;
      const travel = Math.max(0.18, (impactY - startY) / speed);
      const cycle = travel + 0.65;
      const age = (t + hash(i + 910) * cycle) % cycle;
      const rawX = hash(i + 210) * W - t * (24 + hash(i + 410) * 28);
      const x0 = ((rawX % W) + W) % W;
      if (age < travel) {
        const y = startY + age * speed;
        if (y < impactY) {
          ctx.strokeStyle = i % 4 === 0 ? "rgba(205,235,245,0.52)" : "rgba(175,215,232,0.32)";
          ctx.beginPath();
          ctx.moveTo(x0 + 3, y);
          ctx.lineTo(x0, y + 6);
          ctx.stroke();
        }
      } else {
        const pulse = 1 - (age - travel) / 0.65;
        const radius = 1 + (1 - pulse) * 3;
        px(ctx, `rgba(225,244,250,${pulse * 0.65})`, x0 - radius, impactY, 2, 1);
        px(ctx, `rgba(225,244,250,${pulse * 0.65})`, x0 + radius, impactY, 2, 1);
      }
    }
    const fog = ctx.createLinearGradient(0, HORIZON - 6, 0, HORIZON + 34);
    fog.addColorStop(0, "rgba(190,213,222,0.015)");
    fog.addColorStop(0.38, "rgba(190,213,222,0.14)");
    fog.addColorStop(1, "rgba(190,213,222,0)");
    ctx.fillStyle = fog;
    ctx.fillRect(0, HORIZON - 6, W, 40);
  }

  if ((st.lightningFlash ?? 0) > 0) {
    ctx.fillStyle = `rgba(235,245,255,${st.lightningFlash! * 0.35})`;
    ctx.fillRect(0, 0, W, H);
  }

  // 18. Fireflies at dusk & night
  if (night > 0.18 && !isRaining) {
    for (let k = 0; k < 10; k++) {
      const fx = (hash(k) * W + Math.sin(t * 0.5 + k) * 14) % W;
      const fy = HORIZON - 4 - hash(k + 9) * 24 + Math.sin(t + k * 2) * 3;
      const pulse = Math.sin(t * 2.4 + k * 3);
      if (pulse > 0.1) {
        px(ctx, `rgba(255,230,120,${night * pulse * 0.3})`, fx - 1, fy - 1, 3, 3);
        px(ctx, `rgba(255,245,160,${night})`, fx, fy, 1, 1);
      }
    }
  }
}
