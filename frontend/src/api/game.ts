import type { PlayerHomeDTO, WorldBlockDTO } from "@familyspeak/shared";
import { api } from "./client.js";

export function fetchWorldInfo() {
  return api.get<{ seed: number; homes: PlayerHomeDTO[] }>("/game/world-info");
}

export function fetchChunks(coords: { cx: number; cz: number }[]) {
  if (coords.length === 0) return Promise.resolve({ chunks: {} as Record<string, WorldBlockDTO[]> });
  const query = coords.map(({ cx, cz }) => `${cx}_${cz}`).join(",");
  return api.get<{ chunks: Record<string, WorldBlockDTO[]> }>(`/game/chunks?coords=${query}`);
}
