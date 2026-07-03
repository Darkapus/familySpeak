import type { UserDTO } from "@familyspeak/shared";
import { api } from "./client.js";

export function login(username: string, password: string) {
  return api.post<{ accessToken: string; user: UserDTO }>("/auth/login", { username, password });
}

export function fetchSetupStatus() {
  return api.get<{ needsSetup: boolean }>("/auth/setup-status");
}

export function setup(username: string, password: string, displayName: string) {
  return api.post<{ accessToken: string; user: UserDTO }>("/auth/setup", { username, password, displayName });
}

export function fetchMe() {
  return api.get<{ user: UserDTO | null }>("/auth/me");
}

export function logout() {
  return api.post<void>("/auth/logout");
}
