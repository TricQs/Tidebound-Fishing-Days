export const W = 320;
export const H = 180;
export const HORIZON = 104;
export const ROD_TIP = { x: 118, y: 74 };

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

// keyframes: dawn, day, dusk, night
const SKY_TOP = ["#3d5a80", "#4f8fb8", "#3b3f6e", "#0b1428"].map(hex);
const SKY_BOT = ["#f4b67a", "#bfe3e8", "#f08a5d", "#1f2d4f"].map(hex);
const MTN_FAR = ["#6b7aa1", "#7fa3b8", "#6a557a", "#111a2d"].map(hex);
const MTN_NEAR = ["#3e5470", "#4a6f7c", "#3f3556", "#080f1c"].map(hex);
const PINE = ["#1f3a3f", "#24493f", "#22273a", "#050a13"].map(hex);
const WATER = ["#1d4a5e", "#1e5a6b", "#22354f", "#0b1a2e"].map(hex);
const WATER_DEEP = ["#10293f", "#0f3448", "#141e36", "#050c1a"].map(hex);

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
  meteorDuration?: number;
  meteorX?: number;
  meteorY?: number;
}

function px(ctx: CanvasRenderingContext2D, c: string, x: number, y: number, w = 1, h = 1) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function line(ctx: CanvasRenderingContext2D, c: string, x0: number, y0: number, x1: number, y1: number) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
  ctx.fillStyle = c;
  for (let k = 0; k <= n; k++) {
    const u = n ? k / n : 0;
    ctx.fillRect(Math.round(x0 + (x1 - x0) * u), Math.round(y0 + (y1 - y0) * u), 1, 1);
  }
}

export function drawScene(ctx: CanvasRenderingContext2D, st: SceneState) {
  const { t } = st;
  const d = dayInfo(t);
  const top = pick(SKY_TOP, d), bot = pick(SKY_BOT, d);
  // sky bands
  const bands = 13;
  for (let b = 0; b < bands; b++) {
    ctx.fillStyle = css(mix(top, bot, b / (bands - 1)));
    ctx.fillRect(0, Math.floor((b * HORIZON) / bands), W, Math.ceil(HORIZON / bands) + 1);
  }
  const ridgeAt = (x: number) => {
    const farX = x + t * 0.3, nearX = x + t * 0.8;
    const farY = 62 + Math.sin(farX * 0.03) * 10 + Math.sin(farX * 0.071 + 1) * 6 + Math.sin(farX * 0.013) * 8;
    const nearY = 80 + Math.sin(nearX * 0.045 + 2) * 6 + Math.sin(nearX * 0.11) * 3;
    return Math.min(farY, nearY);
  };
  // stars
  const night = d.i === 3 ? 1 - d.s : d.j === 3 ? d.s : 0;
  if (night > 0.05) {
    for (let k = 0; k < 40; k++) {
      if (hash(k + Math.floor(t * 0.7 + k)) > 0.15 * night + 0.85 - night) continue;
      const starX = hash(k) * W, starY = hash(k + 50) * 60;
      if (starY < ridgeAt(starX)) px(ctx, `rgba(255,244,214,${night})`, starX, starY);

    }
  }
  // A few slow, broken clouds drift behind the ridgeline in every weather.
  for (let i = 0; i < 3; i++) {
    const width = 23 + hash(i + 1700) * 25;
    const x = ((hash(i + 1750) * (W + width) + t * (1.1 + i * 0.25)) % (W + width)) - width;
    const y = 17 + hash(i + 1800) * 27;
    const cloud = d.isNight ? "rgba(25,37,59,0.68)" : "rgba(235,242,231,0.56)";
    const cloudShade = d.isNight ? "rgba(17,27,45,0.4)" : "rgba(180,200,201,0.23)";
    px(ctx, cloudShade, x + 2, y + 5, width, 2);
    px(ctx, cloud, x + 4, y + 2, width - 8, 3);
    px(ctx, cloud, x, y + 4, width, 3);
    px(ctx, cloud, x + 6, y, 9, 4);
    px(ctx, cloud, x + width * 0.55, y + 1, 11, 3);
  }

  // Distant birds fly as either a lone silhouette or a separated flock.
  if ((st.birdT ?? -1) >= 0 && !d.isNight && !st.rain) {
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
      line(ctx, d.isNight ? "#a3afbd" : "#4e6671", bx - wing, by - 1, bx, by + 1);
      line(ctx, d.isNight ? "#a3afbd" : "#4e6671", bx, by + 1, bx + wing, by - 1);
    }
  }

  if ((st.meteorT ?? -1) >= 0 && d.isNight && !st.rain) {
    const duration = Math.max(0.3, st.meteorDuration ?? 0.75);
    const u = Math.max(0, Math.min(1, (st.meteorT ?? 0) / duration));
    const sx0 = st.meteorX ?? 190, sy0 = st.meteorY ?? 15;
    const meteorX = sx0 + u * 30, meteorY = sy0 + u * 18;
    if (meteorY < ridgeAt(meteorX)) {
      line(ctx, `rgba(255,247,224,${0.9 * (1 - u * 0.35)})`, meteorX - 9, meteorY - 5, meteorX, meteorY);
      px(ctx, "rgba(255,255,243,0.95)", meteorX, meteorY);
    }
  }

  // sun / moon arc
  const ang = ((t % CYCLE) / CYCLE) * Math.PI * 2;
  const sx = W / 2 - Math.cos(ang) * 130, sy = 70 - Math.sin(ang + 0.3) * 50;
  const moon = d.phase > 2.5 && d.phase < 3.95;
  const mx = moon ? W - sx : sx;
  const my = moon ? 30 + Math.abs(Math.sin(ang)) * 10 : sy;
  const sc = moon ? "#f3ecd2" : "#ffd27a";
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) if (x * x + y * y <= 36) px(ctx, sc, mx + x, my + y);
  if (moon) for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) if ((x + 3) * (x + 3) + (y - 1) * (y - 1) <= 20 && x * x + y * y <= 36) px(ctx, "#d7cfb3", mx + x, my + y);

  // far mountains (slow parallax)
  const far = css(pick(MTN_FAR, d));
  ctx.fillStyle = far;
  for (let x = 0; x < W; x++) {
    const xx = x + t * 0.3;
    const y = 62 + Math.sin(xx * 0.03) * 10 + Math.sin(xx * 0.071 + 1) * 6 + Math.sin(xx * 0.013) * 8;
    ctx.fillRect(x, Math.round(y), 1, HORIZON - Math.round(y));
    if (y < 58) px(ctx, d.isNight ? "rgba(75,91,116,0.2)" : "rgba(250,240,220,0.55)", x, y, 1, 2);
  }
  const near = css(pick(MTN_NEAR, d));
  ctx.fillStyle = near;
  for (let x = 0; x < W; x++) {
    const xx = x + t * 0.8;
    const y = 80 + Math.sin(xx * 0.045 + 2) * 6 + Math.sin(xx * 0.11) * 3;
    ctx.fillRect(x, Math.round(y), 1, HORIZON - Math.round(y));
  }
  // pines
  const pine = css(pick(PINE, d));
  ctx.fillStyle = pine;
  const off = (t * 1.6) % 7;
  for (let i = -1; i < W / 7 + 2; i++) {
    const seed = i + Math.floor((t * 1.6) / 7);
    const h = 8 + hash(seed) * 12;
    const cx = i * 7 - off + 3;
    for (let r = 0; r < h; r++) {
      const hw = Math.floor((r / h) * 3.5);
      ctx.fillRect(Math.round(cx - hw), Math.round(HORIZON - h + r), hw * 2 + 1, 1);
    }
  }
  ctx.fillRect(0, HORIZON - 2, W, 2);

  // water
  const wTop = pick(WATER, d), wBot = pick(WATER_DEEP, d);
  const wb = 8;
  for (let b = 0; b < wb; b++) {
    ctx.fillStyle = css(mix(wTop, wBot, b / (wb - 1)));
    const y0 = HORIZON + Math.floor((b * (H - HORIZON)) / wb);
    ctx.fillRect(0, y0, W, Math.ceil((H - HORIZON) / wb) + 1);
  }
  // A muted, broken celestial reflection appears only when the ridge does not block the light.
  const celestialVisible = my < ridgeAt(mx);
  if (celestialVisible) {
    for (let k = 0; k < 12; k++) {
      const ry = HORIZON + 3 + k * 3;
      const wob = Math.sin(t * 2.2 + k * 1.7) * (2 + k * 0.12);
      const ww = Math.max(1, 12 - k + Math.round(Math.sin(t * 3 + k) * 2));
      px(ctx, moon ? "rgba(216,226,233,0.19)" : "rgba(255,200,120,0.2)", mx - ww / 2 + wob, ry, ww, 1);
    }
  }
  // ripples, parallax layers
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
        px(ctx, `rgba(200,235,240,${L.a * pulse})`, x, y + Math.sin(t + k) * 0.6, L.len, 1);
      }
    }
  });

  // Soft mountain and pine reflections break into short horizontal strokes.
  for (let x = 0; x < W; x += 2) {
    const ridge = ridgeAt(x);
    const depth = Math.min(27, Math.max(3, (HORIZON - ridge) * 0.32));
    const shimmer = Math.sin(t * 1.8 + x * 0.19) * 1.5;
    px(ctx, d.isNight ? "rgba(76,91,119,0.12)" : "rgba(150,180,180,0.11)", x + shimmer, HORIZON + depth, 1 + (x % 7 === 0 ? 2 : 0), 1);
    if (x % 6 === 0) px(ctx, d.isNight ? "rgba(28,44,59,0.18)" : "rgba(31,62,59,0.13)", x - shimmer, HORIZON + 3 + hash(x + 1880) * 7, 2, 2 + hash(x + 1900) * 5);
  }

  // Night points and a shooting star shimmer softly below the waterline.
  if (night > 0.05) {
    for (let k = 0; k < 40; k++) {
      if (hash(k + Math.floor(t * 0.7 + k)) > 0.15 * night + 0.85 - night) continue;
      const starX = hash(k) * W, starY = hash(k + 50) * 60;
      if (starY < ridgeAt(starX)) {
        const rx = starX + Math.sin(t * 1.7 + k) * 2;
        const ry = HORIZON + Math.min(35, (HORIZON - starY) * 0.34);
        px(ctx, `rgba(220,231,245,${night * 0.16})`, rx, ry, 2, 1);
      }
    }
  }
  if ((st.meteorT ?? -1) >= 0 && d.isNight && !st.rain) {
    const duration = Math.max(0.3, st.meteorDuration ?? 0.75);
    const u = Math.max(0, Math.min(1, (st.meteorT ?? 0) / duration));
    const sx0 = st.meteorX ?? 190, sy0 = st.meteorY ?? 15;
    const mx0 = sx0 + u * 30, my0 = sy0 + u * 18;
    if (my0 < ridgeAt(mx0)) {
      line(ctx, `rgba(255,246,217,${0.85 * (1 - u * 0.35)})`, mx0 - 9, my0 - 5, mx0, my0);
      px(ctx, "rgba(255,255,235,0.9)", mx0, my0);
      const reflectedX = mx0 + Math.sin(t * 2) * 2;
      const reflectedY = HORIZON + Math.min(38, (HORIZON - my0) * 0.34);
      line(ctx, "rgba(220,232,245,0.13)", reflectedX - 5, reflectedY + 1, reflectedX + 4, reflectedY + 4);
    }
  }

  // Sparse natural fish breaches and rain hitting the lake surface.
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
  // boat
  const by = 100 + Math.round(Math.sin(t * 1.4) * 1);
  const bx = 70;
  const hull = ["#6b3f22", "#7d4a28", "#5a331b", "#3f2413"];
  const ax = bx + 30, ay = by;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, HORIZON, W, H - HORIZON); ctx.clip();
  ctx.globalAlpha = 0.3;
  for (let r = 0; r < 8; r++) {
    const inset = Math.floor(r * r * 0.18);
    const reflectedY = 2 * HORIZON - (by + 8 - r);
    px(ctx, hull[r % 4 === 0 ? 3 : r % 2 ? 1 : 0]!, bx + inset + Math.sin(t * 2 + r) * 2, reflectedY, 60 - inset * 2, 1);
  }
  // The seated angler is recognizable in the broken mirror of the lake.
  px(ctx, "#18333a", ax - 4, 2 * HORIZON - (ay - 10), 9, 8);
  px(ctx, "#223b43", ax - 4, 2 * HORIZON - (ay - 15), 7, 5);
  px(ctx, "#2d3b46", ax - 4, 2 * HORIZON - (ay - 17), 10, 2);
  px(ctx, "#26303b", ax - 2, 2 * HORIZON - (ay - 19), 6, 2);
  for (let r = 0; r < 4; r++) px(ctx, "rgba(22,31,41,0.7)", bx + 5 + r * 2 + Math.sin(t * 2.6 + r) * 2, HORIZON + 12 + r * 3, 50 - r * 4, 1);
  ctx.restore();
  for (let r = 0; r < 8; r++) {
    const inset = Math.floor(r * r * 0.18);
    px(ctx, r === 0 ? "#c98a4b" : hull[r % 4 === 0 ? 3 : r % 2 ? 1 : 0]!, bx + inset, by + r, 60 - inset * 2, 1);
  }
  px(ctx, "#e2a85c", bx + 2, by + 3, 56 - 4, 1);
  if ((st.surfaceSplash ?? 0) > 0) {
    const age = 1 - st.surfaceSplash!;
    const radius = 1 + age * 5;
    const sx = st.surfaceX ?? 220, sy = st.surfaceY ?? HORIZON + 8;
    px(ctx, `rgba(220,245,250,${st.surfaceSplash})`, sx - radius, sy, 2, 1);
    px(ctx, `rgba(220,245,250,${st.surfaceSplash})`, sx + radius, sy, 2, 1);
    px(ctx, `rgba(245,252,255,${st.surfaceSplash})`, sx, sy - age * 3, 1, 2);
  }
  if ((st.rain ?? 0) > 0) {
    ctx.fillStyle = "rgba(19,32,51,0.16)";
    ctx.fillRect(0, 0, W, HORIZON);
    for (let i = 0; i < 5; i++) {
      const cx = hash(i + 1540) * W, cy = 13 + hash(i + 1640) * 34;
      ctx.fillStyle = "rgba(49,65,78,0.32)";
      px(ctx, ctx.fillStyle, cx, cy, 14, 3);
      px(ctx, ctx.fillStyle, cx - 3, cy + 1, 20, 3);
      px(ctx, ctx.fillStyle, cx + 3, cy - 2, 7, 2);
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < 72; i++) {
      const startY = hash(i + 610) * 54;
      const impactY = HORIZON + 2 + hash(i + 710) * (H - HORIZON - 8);
      const speed = 72 + hash(i + 810) * 84;
      const travel = Math.max(0.18, (impactY - startY) / speed);
      const cycle = travel + 0.65;
      const age = (t + hash(i + 910) * cycle) % cycle;
      const rawX = hash(i + 210) * W - t * (21 + hash(i + 410) * 27);
      const x0 = ((rawX % W) + W) % W;
      if (age < travel) {
        const y = startY + age * speed;
        if (y < impactY) {
          ctx.strokeStyle = i % 4 === 0 ? "rgba(205,235,245,0.48)" : "rgba(175,215,232,0.3)";
          ctx.beginPath(); ctx.moveTo(x0 + 2, y); ctx.lineTo(x0, y + 5); ctx.stroke();
        }
      } else {
        const pulse = 1 - (age - travel) / 0.65;
        const splashX = x0;
        const radius = 1 + (1 - pulse) * 3;
        px(ctx, `rgba(225,244,250,${pulse * 0.65})`, splashX - radius, impactY, 2, 1);
        px(ctx, `rgba(225,244,250,${pulse * 0.65})`, splashX + radius, impactY, 2, 1);
      }
    }
    // Light rain mist softens the shoreline and the far water.
    const fog = ctx.createLinearGradient(0, HORIZON - 6, 0, HORIZON + 34);
    fog.addColorStop(0, "rgba(190,213,222,0.015)");
    fog.addColorStop(0.38, "rgba(190,213,222,0.12)");
    fog.addColorStop(1, "rgba(190,213,222,0)");
    ctx.fillStyle = fog;
    ctx.fillRect(0, HORIZON - 6, W, 40);
  }

  // angler (sitting)
  const pull = st.phase === "reeling" ? Math.round(Math.sin(t * 20) * 1) : 0;
  px(ctx, "#2c5c6a", ax - 4, ay - 10, 9, 10); // coat
  px(ctx, "#1f4450", ax - 4, ay - 3, 9, 3);
  px(ctx, "#f2c9a0", ax - 2, ay - 15, 6, 5); // face
  px(ctx, "#1b2533", ax + 2, ay - 13, 1, 1); // eye
  px(ctx, "#e0a24a", ax - 4, ay - 17, 10, 2); // hat
  px(ctx, "#c8862f", ax - 2, ay - 19, 6, 2);
  px(ctx, "#a2442f", ax - 4, ay - 16, 10, 1); // band
  // arm
  const handX = ax + 6 + pull, handY = ay - 7;
  px(ctx, "#2c5c6a", ax + 3, ay - 8, 4, 2);
  px(ctx, "#f2c9a0", handX, handY - 1, 2, 2);
  // rod
  let tipX = ROD_TIP.x, tipY = ROD_TIP.y;
  if (st.phase === "charging") {
    tipX = handX - 10 - st.power * 6;
    tipY = ROD_TIP.y - 4;
  } else if (st.phase === "reeling" || st.phase === "bite") {
    tipX = ROD_TIP.x + 2;
    tipY = ROD_TIP.y + 6 + pull;
  }
  line(ctx, "#8a5a2b", handX, handY, tipX, tipY);
  px(ctx, "#e0a24a", handX + 1, handY - 1, 2, 2);

  // line + bobber
  if (st.bobber) {
    const b = st.bobber;
    let bxp = b.x, byp = b.y;
    if (st.phase === "casting") {
      const u = st.castT;
      bxp = tipX + (b.x - tipX) * u;
      byp = tipY + (b.y - tipY) * u - Math.sin(u * Math.PI) * 40;
    } else if (st.phase === "waiting") {
      byp += Math.round(Math.sin(t * 3) * 0.6);
    } else if (st.phase === "bite") {
      byp += 2 + Math.round(Math.abs(Math.sin(t * 18)) * 2);
    } else if (st.phase === "reeling") {
      byp += 2 + Math.round(Math.sin(t * 14) * 1);
      bxp += Math.sin(t * 5) * 3;
    }
    // The moving lure gets a brief broken reflection when it reaches the lake.
    if (st.phase === "casting" && byp >= HORIZON - 2) {
      const fade = Math.max(0, Math.min(0.18, (byp - HORIZON + 5) * 0.025));
      px(ctx, `rgba(242,220,166,${fade})`, bxp - 2 + Math.sin(t * 3) * 2, HORIZON + 8, 2, 1);
    } else if (st.phase === "waiting" || st.phase === "bite" || st.phase === "reeling") {
      px(ctx, "rgba(217,69,59,0.18)", bxp + Math.sin(t * 3) * 2, HORIZON + 9, 2, 1);
    }
    // sagging line
    const n = 40;
    ctx.fillStyle = "rgba(240,232,210,0.85)";
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      const sag = st.phase === "reeling" || st.phase === "bite" ? 2 : 10;
      const x = tipX + (bxp - tipX) * u;
      const y = tipY + (byp - tipY) * u + Math.sin(u * Math.PI) * sag;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    const submerged = st.phase === "bite" || st.phase === "reeling";
    px(ctx, "#fdf6e3", bxp - 1, byp - 3, 3, 2);
    if (!submerged) px(ctx, "#d9453b", bxp - 1, byp - 1, 3, 2);
    else px(ctx, "#d9453b", bxp - 1, byp - 1, 3, 1);
    // ring ripples
    if (st.phase !== "casting") {
      const rr = (t * 6) % 10;
      const a = 0.5 * (1 - rr / 10);
      px(ctx, `rgba(220,240,240,${a})`, bxp - 3 - rr, byp + 1, 2, 1);
      px(ctx, `rgba(220,240,240,${a})`, bxp + 2 + rr, byp + 1, 2, 1);
    }
    if (st.phase === "bite") {
      // "!" cue
      const flash = Math.floor(t * 8) % 2 === 0;
      px(ctx, flash ? "#ffd27a" : "#fdf6e3", bxp, byp - 16, 2, 7);
      px(ctx, flash ? "#ffd27a" : "#fdf6e3", bxp, byp - 7, 2, 2);
      for (let k = 0; k < 4; k++) px(ctx, "rgba(255,255,255,0.8)", bxp - 4 + k * 3, byp + 1 - Math.abs(Math.sin(t * 10 + k)) * 3, 1, 1);
    }
  }
  if (st.splash > 0 && st.bobber) {
    const s = 1 - st.splash;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI;
      px(ctx, `rgba(230,245,250,${st.splash})`, st.bobber.x + Math.cos(a) * s * 8, st.bobber.y - Math.sin(a) * s * 8, 1, 1);
    }
  }

  // fireflies at night / dusk
  if (night > 0.2) {
    for (let k = 0; k < 8; k++) {
      const fx = (hash(k) * W + Math.sin(t * 0.5 + k) * 12) % W;
      const fy = HORIZON - 6 - hash(k + 9) * 20 + Math.sin(t + k * 2) * 3;
      if (Math.sin(t * 2 + k * 3) > 0.2) px(ctx, `rgba(255,220,120,${night})`, fx, fy);
    }
  }
}
