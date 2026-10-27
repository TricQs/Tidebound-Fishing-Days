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
const MTN_FAR = ["#6b7aa1", "#7fa3b8", "#6a557a", "#1b2742"].map(hex);
const MTN_NEAR = ["#3e5470", "#4a6f7c", "#3f3556", "#121c33"].map(hex);
const PINE = ["#1f3a3f", "#24493f", "#22273a", "#0a1322"].map(hex);
const WATER = ["#1d4a5e", "#1e5a6b", "#22354f", "#0b1a2e"].map(hex);
const WATER_DEEP = ["#10293f", "#0f3448", "#141e36", "#050c1a"].map(hex);

export const CYCLE = 240; // seconds per day

export function dayInfo(t: number) {
  const p = ((t % CYCLE) / CYCLE) * 4;
  const i = Math.floor(p) % 4;
  const j = (i + 1) % 4;
  const f = p - Math.floor(p);
  const s = f * f * (3 - 2 * f);
  return { i, j, s, phase: p, isNight: p > 2.85 && p < 3.85 };
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
  // stars
  const night = d.i === 3 ? 1 - d.s : d.j === 3 ? d.s : 0;
  if (night > 0.05) {
    for (let k = 0; k < 40; k++) {
      if (hash(k + Math.floor(t * 0.7 + k)) > 0.15 * night + 0.85 - night) continue;
      px(ctx, `rgba(255,244,214,${night})`, hash(k) * W, hash(k + 50) * 60);
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
    if (y < 58) px(ctx, "rgba(250,240,220,0.55)", x, y, 1, 2);
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
  // reflection of sun/moon
  for (let k = 0; k < 9; k++) {
    const ry = HORIZON + 3 + k * 4;
    const wob = Math.sin(t * 2 + k) * 2;
    const ww = 10 - k;
    if (ww > 0) px(ctx, moon ? "rgba(243,236,210,0.35)" : "rgba(255,200,120,0.4)", mx - ww / 2 + wob, ry, ww, 1);
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

  // boat
  const by = 96 + Math.round(Math.sin(t * 1.4) * 1);
  const bx = 70;
  const hull = ["#6b3f22", "#7d4a28", "#5a331b", "#3f2413"];
  for (let r = 0; r < 8; r++) {
    const inset = Math.floor(r * r * 0.18);
    px(ctx, r === 0 ? "#c98a4b" : hull[r % 4 === 0 ? 3 : r % 2 ? 1 : 0]!, bx + inset, by + r, 60 - inset * 2, 1);
  }
  px(ctx, "#e2a85c", bx + 2, by + 3, 56 - 4, 1);
  // reflection of boat
  for (let r = 0; r < 4; r++) px(ctx, "rgba(10,20,30,0.35)", bx + 4 + r * 2 + Math.sin(t * 3 + r) * 1.5, by + 9 + r * 2, 52 - r * 4, 1);

  // angler (sitting)
  const ax = bx + 30, ay = by;
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
