import { create } from "zustand";
import type { ClientToServerEvent } from "@familyspeak/shared";

interface WsState {
  isConnected: boolean;
  send: ((event: ClientToServerEvent) => void) | null;
  setConnected: (isConnected: boolean) => void;
  setSend: (send: ((event: ClientToServerEvent) => void) | null) => void;
}

export const useWsStore = create<WsState>((set) => ({
  isConnected: false,
  send: null,
  setConnected: (isConnected) => set({ isConnected }),
  setSend: (send) => set({ send }),
}));
