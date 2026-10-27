import { createFileRoute } from "@tanstack/react-router";
import { Game } from "@/game/Game";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tidebound: Little Fishing Days — Cozy Pixel Fishing Game" },
      { name: "description", content: "A relaxing pixel-art fishing game. Cast, reel, collect rare fish, and upgrade your gear on a serene lake." },
      { property: "og:title", content: "Tidebound: Little Fishing Days" },
      { property: "og:description", content: "Cast, reel and collect fish in a cozy pixel-art lake. Play free in your browser." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Game,
});
