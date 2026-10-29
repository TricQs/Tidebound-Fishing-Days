import type { ReactElement } from "react";
import { MUTATIONS, type FishShape, type MutationId, type Species } from "./data";

const PATTERNS: Record<FishShape, string[]> = {
  fish: [
    "....11111......",
    "..112222211..1.",
    ".12223223221.11",
    "12o222222222111",
    ".14444444421.11",
    "..114444211..1.",
    "....11111......",
  ],
  sunfish: [
    "....111111.....",
    "..1133333311...",
    ".122222322221.1",
    "12o232222322111",
    "122332222222111",
    ".144444444221.1",
    "..1144444211...",
    "....111111.....",
  ],
  perch: [
    "...1311.111....",
    "..1333112221..1",
    ".12232232232111",
    "12o232232232211",
    ".14444444442111",
    "..1133111311..1",
    "....11...1.....",
  ],
  trout: [
    ".....111111.....",
    "..11122222211..1",
    ".122225225222113",
    "12o2333333332213",
    ".144444444442113",
    "..11144444211..1",
    ".....111111.....",
  ],
  koi: [
    "....133331.....13",
    "..1122332211..133",
    ".122332233221133.",
    "12o222332222213..",
    "3144442244421133.",
    "..1133443311..133",
    "....133331.....13",
  ],
  jelly: [
    "....111111....",
    "..1122552211..",
    ".122322223221.",
    ".122235532221.",
    ".144444444441.",
    ".111111111111.",
    "..3.5..3..5.3.",
    ".3..3.5..3..3.",
    "..3..5..3..3..",
  ],
  catfish: [
    ".....1111111....",
    "..11122222221..1",
    ".122222322322111",
    "12o2222222222211",
    "3144444444442111",
    "3.11144441111..1",
    "3....1111.......",
  ],
  pike: [
    ".......11111111...",
    "..11111223223221.1",
    "112222223223222211",
    ".11o22322232232211",
    "..14444444444421.1",
    "....11111133111...",
  ],
  angler: [
    "...55.............",
    "..55111...........",
    "....1..111111.....",
    "...1.1122222211..1",
    "..1112222322322111",
    "..12o2222222222111",
    "..1515122322221.11",
    "..111114444421...1",
    "......1111111.....",
  ],
  eel: [
    "..111111..........",
    ".12o2232111111....",
    ".144422232232211..",
    "..111114444223221.",
    ".......11111444221",
    "............11111.",
  ],
  oarfish: [
    ".3333.............",
    "..133111111.......",
    ".12o222522211111..",
    ".1444222252225221.",
    "..1311144442222321",
    "...3...11111444331",
    "............11111.",
  ],
};

export function FishSprite({
  s,
  size = 6,
  hidden = false,
  mutation = "none",
}: {
  s: Species;
  size?: number | undefined;
  hidden?: boolean | undefined;
  mutation?: MutationId | undefined;
}) {
  const pat = PATTERNS[s.shape] ?? PATTERNS.fish;
  const w = pat[0]!.length;
  const h = pat.length;
  const mut = MUTATIONS[mutation] ?? MUTATIONS.none;

  const mainColor = mut.colorOverride ?? s.color;
  const accentColor = mut.accentOverride ?? s.accent;
  const bellyColor =
    mutation === "golden"
      ? "#fef08a"
      : mutation === "shadow"
        ? "#4c1d95"
        : mutation === "celestial"
          ? "#e0e7ff"
          : (s.belly ?? s.accent);

  const rects: ReactElement[] = [];
  pat.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === ".") return;
      let fill = mainColor;
      if (c === "1") fill = mutation === "shadow" ? "#090514" : mutation === "golden" ? "#713f12" : "#18222f";
      else if (c === "3") fill = accentColor;
      else if (c === "4") fill = bellyColor;
      else if (c === "5") fill = mutation === "none" ? "#72efdd" : mut.glowColor;
      else if (c === "o") fill = mutation === "albino" || mutation === "shadow" ? "#f43f5e" : "#fdf6e3";

      if (hidden) {
        fill = c === "o" ? "#3a4a5c" : "#1e2b38";
      }
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.03} height={1.03} fill={fill} />);
    }),
  );

  // Add subtle pixel crown for Colossal or sparkle pixels for Special Mutations
  if (!hidden && mutation === "colossal") {
    rects.push(
      <rect key="cr-1" x={3} y={0} width={3} height={1} fill="#facc15" />,
      <rect key="cr-2" x={3} y={-1} width={1} height={1} fill="#fef08a" />,
      <rect key="cr-3" x={5} y={-1} width={1} height={1} fill="#fef08a" />,
    );
  } else if (!hidden && (mutation === "golden" || mutation === "celestial" || mutation === "luminescent")) {
    rects.push(
      <rect key="sp-1" x={1} y={0} width={1} height={1} fill="#ffffff" />,
      <rect key="sp-2" x={w - 2} y={1} width={1} height={1} fill={mut.glowColor} />,
    );
  }

  return (
    <svg
      width={w * size}
      height={h * size}
      viewBox={`0 -1 ${w} ${h + 1}`}
      shapeRendering="crispEdges"
      aria-label={hidden ? "Undiscovered" : s.name}
    >
      {rects}
    </svg>
  );
}
