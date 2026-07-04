import type { WorldBlockDTO } from "@familyspeak/shared";
import { api } from "./client.js";

export function fetchWorld() {
  return api.get<{ seed: number; blocks: WorldBlockDTO[] }>("/game/world");
}
