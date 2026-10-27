import { useCallback, useEffect, useRef, useState } from "react";
import { drawScene, dayInfo, W, H, HORIZON, type SceneState } from "./scene";
import {
  SPECIES, RARITY_COLOR, ROD_PRICES, LURE_PRICES, ROD_NAMES, LURE_NAMES, QUESTS, NEW_SAVE, xpFor,
  type Save, type Species, type CaughtFish,
} from "./data";
import { FishSprite } from "./FishSprite";

const KEY = "tidebound-save-v1";
type Phase = "idle" | "charging" | "casting" | "waiting" | "bite" | "reeling" | "caught" | "escaped";
type Panel = null | "shop" | "journal" | "pause" | "confirm";

interface G extends SceneState {
  waitLeft: number;
  biteLeft: number;
  fish: Species | null;
  marker: number;
  dir: number;
  zoneC: number;
  zoneW: number;
  hits: number;
  misses: number;
  powerDir: number;
}

export function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
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
  const startedRef = useRef(false);
  startedRef.current = started;
  const [lastCatch, setLastCatch] = useState<CaughtFish | null>(null);
  const [reelInfo, setReelInfo] = useState({ hits: 0, need: 3, misses: 0, max: 2 });
  const [toast, setToast] = useState<string | null>(null);
  const [isNight, setIsNight] = useState(false);
  const uid = useRef(1);

  const g = useRef<G>({
    t: 60, phase: "idle", power: 0, bobber: null, castT: 0, biteT: 0, reelPull: 0, splash: 0,
    waitLeft: 0, biteLeft: 0, fish: null, marker: 0, dir: 1, zoneC: 0.5, zoneW: 0.2, hits: 0, misses: 0, powerDir: 1,
  });

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    g.current.phase = p;
    setPhaseS(p);
  }, []);

  const flash = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast((c) => (c === m ? null : c)), 2200);
  }, []);

  // load / persist
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSave({ ...NEW_SAVE, ...JSON.parse(raw) });
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(save));
    uid.current = Math.max(uid.current, ...save.bag.map((b) => b.uid + 1));
  }, [save, loaded]);

  const advanceQuest = useCallback((s: Save, kind: "catch" | "sell" | "upgrade", species?: string, n = 1): Save => {
    const q = QUESTS[s.quest];
    if (!q || q.kind !== kind || (q.species && q.species !== species)) return s;
    const prog = s.questProg + n;
    if (prog >= q.goal) {
      window.setTimeout(() => flash(`Quest complete! +${q.reward} coins`), 400);
      return { ...s, quest: s.quest + 1, questProg: 0, coins: s.coins + q.reward };
    }
    return { ...s, questProg: prog };
  }, [flash]);

  const pickFish = useCallback((): Species => {
    const s = saveRef.current;
    const night = dayInfo(g.current.t).isNight;
    const weights = SPECIES.map((f) => {
      let w = f.odds;
      if (f.rare) w *= 1 + s.lure * 0.7;
      if (f.night) w *= night ? 4 : 0.15;
      return w;
    });
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < SPECIES.length; i++) {
      r -= weights[i]!;
      if (r <= 0) return SPECIES[i]!;
    }
    return SPECIES[0]!;
  }, []);

  const newZone = () => {
    const G = g.current;
    G.zoneC = G.zoneW / 2 + Math.random() * (1 - G.zoneW);
  };

  const finishCatch = useCallback(() => {
    const f = g.current.fish!;
    const weight = +(f.minW + Math.random() * (f.maxW - f.minW)).toFixed(2);
    const value = Math.round(f.value * (0.7 + (weight - f.minW) / (f.maxW - f.minW + 0.001) * 0.8));
    const c: CaughtFish = { uid: uid.current++, id: f.id, weight, value };
    setLastCatch(c);
    setSave((s0) => {
      let s = { ...s0, bag: [...s0.bag, c], totalCaught: s0.totalCaught + 1, tutorialDone: true };
      const prev = s.journal[f.id];
      if (!prev) window.setTimeout(() => flash(`New species: ${f.name}!`), 200);
      s.journal = { ...s.journal, [f.id]: { count: (prev?.count ?? 0) + 1, best: Math.max(prev?.best ?? 0, weight) } };
      const xpGain = Math.round(f.value * 0.8 + 5);
      let xp = s.xp + xpGain, level = s.level;
      while (xp >= xpFor(level)) { xp -= xpFor(level); level++; window.setTimeout(() => flash(`Level up! You are now level ${level}`), 900); }
      s = { ...s, xp, level };
      s = advanceQuest(s, "catch", f.id);
      if (QUESTS[s.quest]?.kind === "catch" && !QUESTS[s.quest]!.species && s0.quest !== s.quest) { /* new quest starts fresh */ }
      return s;
    });
    setPhase("caught");
  }, [advanceQuest, flash, setPhase]);

  const reset = useCallback(() => {
    const G = g.current;
    G.bobber = null; G.fish = null; G.power = 0;
    setPhase("idle");
  }, [setPhase]);

  // primary action
  const actionDown = useCallback(() => {
    if (!startedRef.current || panelRef.current) return;
    const G = g.current;
    const p = phaseRef.current;
    if (p === "idle") { G.power = 0; G.powerDir = 1; setPhase("charging"); }
    else if (p === "waiting") { reset(); }
    else if (p === "bite") {
      const s = saveRef.current;
      const f = G.fish!;
      G.zoneW = Math.min(0.45, f.zone + s.rod * 0.04);
      G.marker = 0; G.dir = 1; G.hits = 0; G.misses = 0;
      newZone();
      setReelInfo({ hits: 0, need: f.hits, misses: 0, max: 2 + (s.rod >= 2 ? 1 : 0) });
      setPhase("reeling");
    } else if (p === "reeling") {
      const s = saveRef.current;
      const f = G.fish!;
      const max = 2 + (s.rod >= 2 ? 1 : 0);
      if (Math.abs(G.marker - G.zoneC) <= G.zoneW / 2) {
        G.hits++;
        if (G.hits >= f.hits) { finishCatch(); return; }
        newZone();
      } else {
        G.misses++;
        if (G.misses >= max) { setPhase("escaped"); G.bobber = null; return; }
      }
      setReelInfo({ hits: G.hits, need: f.hits, misses: G.misses, max });
    } else if (p === "caught" || p === "escaped") { reset(); }
  }, [finishCatch, reset, setPhase]);

  const actionUp = useCallback(() => {
    const G = g.current;
    if (phaseRef.current === "charging") {
      const pw = Math.max(0.15, G.power);
      G.bobber = { x: 135 + pw * 165, y: HORIZON + 6 + (1 - pw) * 50 };
      G.castT = 0;
      setPhase("casting");
    }
  }, [setPhase]);

  // keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        if (!startedRef.current) return;
        e.preventDefault();
        if (!e.repeat) actionDown();
      } else if (e.code === "Escape") {
        if (!startedRef.current) return;
        setPanel((p) => (p ? null : "pause"));
      } else if (e.code === "KeyS" && startedRef.current) setPanel((p) => (p === "shop" ? null : "shop"));
      else if (e.code === "KeyJ" && startedRef.current) setPanel((p) => (p === "journal" ? null : "journal"));
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); actionUp(); }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [actionDown, actionUp]);

  // game loop
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    let raf = 0, last = performance.now(), nightCheck = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const G = g.current;
      const paused = panelRef.current === "pause" || panelRef.current === "confirm";
      if (!paused) {
        G.t += dt;
        const p = phaseRef.current;
        const s = saveRef.current;
        if (p === "charging") {
          G.power += G.powerDir * dt * 1.2;
          if (G.power >= 1) { G.power = 1; G.powerDir = -1; }
          if (G.power <= 0) { G.power = 0; G.powerDir = 1; }
          if (powerRef.current) powerRef.current.style.width = `${G.power * 100}%`;
        } else if (p === "casting") {
          G.castT += dt * 1.6;
          if (G.castT >= 1) {
            G.castT = 1; G.splash = 1;
            G.waitLeft = 1.8 + Math.random() * 4.5 - s.lure * 0.3;
            setPhase("waiting");
          }
        } else if (p === "waiting") {
          G.waitLeft -= dt;
          if (G.waitLeft <= 0) {
            G.fish = pickFish();
            G.biteLeft = 1.1 + s.rod * 0.2;
            setPhase("bite");
          }
        } else if (p === "bite") {
          G.biteLeft -= dt;
          if (G.biteLeft <= 0) { G.bobber = null; setPhase("escaped"); }
        } else if (p === "reeling" && G.fish) {
          const sp = G.fish.speed * (1 - s.rod * 0.12);
          G.marker += G.dir * dt * sp;
          if (G.marker >= 1) { G.marker = 1; G.dir = -1; }
          if (G.marker <= 0) { G.marker = 0; G.dir = 1; }
          if (markerRef.current) markerRef.current.style.left = `${G.marker * 100}%`;
          if (zoneRef.current) {
            zoneRef.current.style.left = `${(G.zoneC - G.zoneW / 2) * 100}%`;
            zoneRef.current.style.width = `${G.zoneW * 100}%`;
          }
        }
        if (G.splash > 0) G.splash = Math.max(0, G.splash - dt * 2);
      }
      drawScene(ctx, G);
      nightCheck += dt;
      if (nightCheck > 1) { nightCheck = 0; setIsNight(dayInfo(G.t).isNight); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pickFish, setPhase]);

  // shop actions
  const sell = (ids: number[]) => {
    setSave((s0) => {
      const sold = s0.bag.filter((b) => ids.includes(b.uid));
      if (!sold.length) return s0;
      const total = sold.reduce((a, b) => a + b.value, 0);
      flash(`Sold ${sold.length} fish for ${total} coins`);
      let s = { ...s0, coins: s0.coins + total, bag: s0.bag.filter((b) => !ids.includes(b.uid)) };
      s = advanceQuest(s, "sell", undefined, sold.length);
      return s;
    });
  };
  const buy = (kind: "rod" | "lure") => {
    setSave((s0) => {
      const lvl = s0[kind];
      const price = (kind === "rod" ? ROD_PRICES : LURE_PRICES)[lvl];
      if (price === undefined || s0.coins < price) return s0;
      flash(`Bought ${(kind === "rod" ? ROD_NAMES : LURE_NAMES)[lvl + 1]}!`);
      return advanceQuest({ ...s0, coins: s0.coins - price, [kind]: lvl + 1 }, "upgrade");
    });
  };
  const resetSave = () => {
    localStorage.removeItem(KEY);
    setSave({ ...NEW_SAVE });
    reset();
    setPanel(null);
    setStarted(false);
  };

  const quest = QUESTS[save.quest];
  const lastSpecies = lastCatch ? SPECIES.find((s) => s.id === lastCatch.id)! : null;
  const showHints = save.hints || !save.tutorialDone;
  const hint: Record<Phase, string> = {
    idle: "Hold CAST (or Space) to charge, release to throw.",
    charging: "Release to cast! Further casts reach calmer, deeper water.",
    casting: "Whoosh…",
    waiting: "Watch the bobber… wait for a bite. (Tap to reel in empty)",
    bite: "A BITE! Tap REEL now before it slips away!",
    reeling: "Tap REEL when the marker is inside the green zone.",
    caught: "Nice catch! Tap to continue.",
    escaped: "It got away… tap to try again.",
  };
  const btnLabel: Record<Phase, string> = {
    idle: "HOLD TO CAST", charging: "RELEASE!", casting: "…", waiting: "REEL IN",
    bite: "REEL!", reeling: "REEL!", caught: "CONTINUE", escaped: "CONTINUE",
  };
  const bagValue = save.bag.reduce((a, b) => a + b.value, 0);

  return (
    <div className="tb-root">
      <div className="tb-stage">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="tb-canvas"
          onPointerDown={(e) => { e.preventDefault(); actionDown(); }}
          onPointerUp={actionUp}
          onPointerLeave={actionUp}
          aria-label="Fishing lake"
        />

        {started && (
          <div className="tb-hud">
            <div className="tb-chip"><span className="tb-coin" />{save.coins}</div>
            <div className="tb-chip tb-level">
              <span>Lv {save.level}</span>
              <div className="tb-xpbar"><div style={{ width: `${(save.xp / xpFor(save.level)) * 100}%` }} /></div>
            </div>
            {isNight && <div className="tb-chip">☾ Night</div>}
            <div className="tb-hud-right">
              <button className="tb-btn tb-btn-sm" onClick={() => setPanel("shop")}>Dock <kbd>S</kbd></button>
              <button className="tb-btn tb-btn-sm" onClick={() => setPanel("journal")}>Journal <kbd>J</kbd></button>
              <button className="tb-btn tb-btn-sm" onClick={() => setPanel("pause")} aria-label="Pause">II</button>
            </div>
          </div>
        )}

        {started && quest && (
          <div className="tb-quest">
            <b>Quest</b> {quest.text} <span>{save.questProg}/{quest.goal}</span>
          </div>
        )}

        {started && phase === "charging" && (
          <div className="tb-meter tb-power"><div ref={powerRef} className="tb-power-fill" /></div>
        )}

        {started && phase === "reeling" && (
          <div className="tb-reel">
            <div className="tb-reel-head">
              <span>Hooked! {"●".repeat(reelInfo.hits)}{"○".repeat(reelInfo.need - reelInfo.hits)}</span>
              <span className="tb-miss">Slack {"✕".repeat(reelInfo.misses)}{"·".repeat(reelInfo.max - reelInfo.misses)}</span>
            </div>
            <div className="tb-meter">
              <div ref={zoneRef} className="tb-zone" />
              <div ref={markerRef} className="tb-marker" />
            </div>
          </div>
        )}

        {started && showHints && !panel && phase !== "caught" && (
          <div className={`tb-hint ${phase === "bite" ? "tb-hint-alert" : ""}`}>{hint[phase]}</div>
        )}

        {toast && <div className="tb-toast">{toast}</div>}

        {phase === "caught" && lastCatch && lastSpecies && (
          <div className="tb-overlay" onClick={reset}>
            <div className="tb-panel tb-catch" onClick={(e) => e.stopPropagation()}>
              <div className="tb-rarity" style={{ color: RARITY_COLOR[lastSpecies.rarity] }}>{lastSpecies.rarity}</div>
              <div className="tb-fish-glow" style={{ ["--glow" as string]: RARITY_COLOR[lastSpecies.rarity] }}>
                <FishSprite s={lastSpecies} size={9} />
              </div>
              <h2>{lastSpecies.name}</h2>
              <p className="tb-muted">{lastSpecies.blurb}</p>
              <div className="tb-stats">
                <div><small>Weight</small>{lastCatch.weight} kg</div>
                <div><small>Value</small>{lastCatch.value} ¢</div>
                <div><small>XP</small>+{Math.round(lastSpecies.value * 0.8 + 5)}</div>
              </div>
              <button className="tb-btn tb-btn-primary" onClick={reset}>Keep fishing</button>
            </div>
          </div>
        )}

        {!started && (
          <div className="tb-overlay tb-title-screen">
            <div className="tb-panel tb-start">
              <p className="tb-eyebrow">~ a cozy lake story ~</p>
              <h1>TIDEBOUND</h1>
              <p className="tb-sub">Little Fishing Days</p>
              <button className="tb-btn tb-btn-primary tb-btn-lg" onClick={() => setStarted(true)} disabled={!loaded}>
                {save.totalCaught > 0 ? "Continue" : "Play"}
              </button>
              <div className="tb-controls">
                <div><kbd>Space</kbd> hold &amp; release to cast · tap to reel</div>
                <div><kbd>S</kbd> dock shop · <kbd>J</kbd> journal · <kbd>Esc</kbd> pause</div>
                <div className="tb-muted">On mobile, use the big button or tap the lake.</div>
              </div>
            </div>
          </div>
        )}

        {panel && (
          <div className="tb-overlay" onClick={() => setPanel(null)}>
            <div className="tb-panel tb-wide" onClick={(e) => e.stopPropagation()}>
              {panel === "pause" && (
                <>
                  <h2>Paused</h2>
                  <div className="tb-col">
                    <button className="tb-btn tb-btn-primary" onClick={() => setPanel(null)}>Resume</button>
                    <label className="tb-toggle">
                      <input type="checkbox" checked={save.hints} onChange={(e) => setSave((s) => ({ ...s, hints: e.target.checked }))} />
                      Show hints
                    </label>
                    <button className="tb-btn" onClick={() => { setPanel(null); setStarted(false); }}>Title screen</button>
                    <button className="tb-btn tb-btn-danger" onClick={() => setPanel("confirm")}>Reset save…</button>
                  </div>
                  <p className="tb-muted">Caught {save.totalCaught} fish so far. Progress saves automatically.</p>
                </>
              )}
              {panel === "confirm" && (
                <>
                  <h2>Reset all progress?</h2>
                  <p className="tb-muted">Coins, fish, upgrades, quests and journal will be erased. This cannot be undone.</p>
                  <div className="tb-row">
                    <button className="tb-btn" onClick={() => setPanel("pause")}>Cancel</button>
                    <button className="tb-btn tb-btn-danger" onClick={resetSave}>Yes, reset</button>
                  </div>
                </>
              )}
              {panel === "shop" && (
                <>
                  <div className="tb-panel-head"><h2>Willow Dock</h2><button className="tb-btn tb-btn-sm" onClick={() => setPanel(null)}>✕</button></div>
                  <h3>Your bag ({save.bag.length})</h3>
                  {save.bag.length === 0 ? <p className="tb-muted">No fish yet. Go cast a line!</p> : (
                    <>
                      <div className="tb-bag">
                        {save.bag.map((b) => {
                          const sp = SPECIES.find((s) => s.id === b.id)!;
                          return (
                            <button key={b.uid} className="tb-bag-item" onClick={() => sell([b.uid])} title="Sell">
                              <FishSprite s={sp} size={3} />
                              <span>{sp.name}<small>{b.weight}kg</small></span>
                              <b>{b.value}¢</b>
                            </button>
                          );
                        })}
                      </div>
                      <button className="tb-btn tb-btn-primary" onClick={() => sell(save.bag.map((b) => b.uid))}>Sell all for {bagValue}¢</button>
                    </>
                  )}
                  <h3>Upgrades <span className="tb-muted">· you have {save.coins}¢</span></h3>
                  <div className="tb-upgrades">
                    {(["rod", "lure"] as const).map((k) => {
                      const lvl = save[k];
                      const names = k === "rod" ? ROD_NAMES : LURE_NAMES;
                      const price = (k === "rod" ? ROD_PRICES : LURE_PRICES)[lvl];
                      return (
                        <div key={k} className="tb-upgrade">
                          <b>{names[lvl]}</b>
                          <small className="tb-muted">{k === "rod" ? "Bigger sweet spot, slower marker, longer bite window." : "Raises the chance of rare fish, quicker bites."}</small>
                          {price !== undefined ? (
                            <button className="tb-btn tb-btn-sm tb-btn-primary" disabled={save.coins < price} onClick={() => buy(k)}>
                              {names[lvl + 1]} — {price}¢
                            </button>
                          ) : <span className="tb-muted">Max level</span>}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              {panel === "journal" && (
                <>
                  <div className="tb-panel-head"><h2>Angler's Journal</h2><button className="tb-btn tb-btn-sm" onClick={() => setPanel(null)}>✕</button></div>
                  <p className="tb-muted">Discovered {Object.keys(save.journal).length}/{SPECIES.length}</p>
                  <div className="tb-journal">
                    {SPECIES.map((sp) => {
                      const j = save.journal[sp.id];
                      return (
                        <div key={sp.id} className="tb-entry">
                          <FishSprite s={sp} size={4} hidden={!j} />
                          <div>
                            <b>{j ? sp.name : "???"}</b>
                            <small style={{ color: RARITY_COLOR[sp.rarity] }}>{sp.rarity}</small>
                            <small className="tb-muted">{j ? `Caught ${j.count} · best ${j.best}kg · ~${sp.value}¢` : sp.night ? "Rumoured to rise at night…" : "Not yet discovered"}</small>
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
          <button
            className={`tb-btn tb-action tb-action-${phase}`}
            onPointerDown={(e) => { e.preventDefault(); actionDown(); }}
            onPointerUp={actionUp}
            onPointerLeave={actionUp}
            disabled={phase === "casting"}
          >
            {btnLabel[phase]}
          </button>
          <div className="tb-gear tb-muted">{ROD_NAMES[save.rod]} · {LURE_NAMES[save.lure]} · bag {save.bag.length}</div>
        </div>
      )}
    </div>
  );
}
