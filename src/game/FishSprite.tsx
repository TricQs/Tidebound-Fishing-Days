import type { ReactElement } from "react";
import type { Species } from "./data";

const FISH = [
  "....1111......",
  "..11222211..1.",
  ".1222222221.11",
  "12o22222222111",
  ".1333333331.11",
  "..11333311..1.",
  "....1111......",
];
const JELLY = [
  "...111111...",
  "..12222221..",
  ".1223222221.",
  ".1222222321.",
  ".1111111111.",
  "..3.3..3.3..",
  ".3..3..3..3.",
  "..3.3..3.3..",
];

export function FishSprite({ s, size = 6, hidden = false }: { s: Species; size?: number; hidden?: boolean }) {
  const pat = s.shape === "jelly" ? JELLY : FISH;
  const w = pat[0]!.length;
  const h = pat.length;
  const rects: ReactElement[] = [];
  pat.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === ".") return;
      let fill = s.color;
      if (c === "1") fill = "#1b2533";
      if (c === "3") fill = s.accent;
      if (c === "o") fill = "#fdf6e3";
      if (hidden) fill = c === "o" ? "#3a4a5c" : "#22303f";
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={fill} />);
    }),
  );
  return (
    <svg width={w * size} height={h * size} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" aria-label={hidden ? "Undiscovered" : s.name}>
      {rects}
    </svg>
  );
}
