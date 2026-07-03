import type { UserDTO, UserProfileDTO } from "@familyspeak/shared";
import { api } from "./client.js";

export function listUsers() {
  return api.get<{ users: UserDTO[] }>("/users");
}

export function createChildUser(input: { username: string; password: string; displayName: string }) {
  return api.post<{ user: UserDTO }>("/users", input);
}

export function setUserActive(userId: string, isActive: boolean) {
  return api.patch<{ user: UserDTO }>(`/users/${userId}/active`, { isActive });
}

export function fetchUserProfile(userId: string) {
  return api.get<{ profile: UserProfileDTO }>(`/users/${userId}/profile`);
}
