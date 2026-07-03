import type { SignupRequestDTO, UserDTO } from "@familyspeak/shared";
import { api } from "./client.js";

export function submitSignupRequest(input: {
  username: string;
  displayName: string;
  password: string;
  passwordConfirm: string;
}) {
  return api.post<{ request: SignupRequestDTO }>("/signup-requests", input);
}

export function listPendingSignupRequests() {
  return api.get<{ requests: SignupRequestDTO[] }>("/signup-requests");
}

export function approveSignupRequest(id: string) {
  return api.post<{ user: UserDTO }>(`/signup-requests/${id}/approve`);
}

export function rejectSignupRequest(id: string) {
  return api.post<{ request: SignupRequestDTO }>(`/signup-requests/${id}/reject`);
}
