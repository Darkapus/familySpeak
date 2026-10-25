import type { OrthoCategory, OrthoStatsDTO } from "@familyspeak/shared";
import { api } from "./client.js";

export function fetchOrthoStats(userId?: string) {
  return api.get<OrthoStatsDTO>(`/orthographe/stats${userId ? `?userId=${userId}` : ""}`);
}

export function recordOrthoAttempt(input: { itemId: string; category: OrthoCategory; correct: boolean }) {
  return api.post<{ ok: true }>("/orthographe/attempts", input);
}
