import type { UserDTO } from "@familyspeak/shared";
import { api } from "./client.js";

export function login(username: string, password: string) {
  return api.post<{ accessToken: string; user: UserDTO }>("/auth/login", { username, password });
}

export function fetchMe() {
  return api.get<{ user: UserDTO | null }>("/auth/me");
}

export function logout() {
  return api.post<void>("/auth/logout");
}
