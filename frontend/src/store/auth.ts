import { create } from "zustand";
import type { UserDTO } from "@familyspeak/shared";

type AuthStatus = "checking" | "authenticated" | "unauthenticated";

interface AuthState {
  accessToken: string | null;
  user: UserDTO | null;
  status: AuthStatus;
  setSession: (accessToken: string, user: UserDTO) => void;
  setAccessToken: (accessToken: string) => void;
  setStatus: (status: AuthStatus) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: "checking",
  setSession: (accessToken, user) => set({ accessToken, user, status: "authenticated" }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setStatus: (status) => set({ status }),
  clear: () => set({ accessToken: null, user: null, status: "unauthenticated" }),
}));
