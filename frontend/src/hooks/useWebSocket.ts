import { useEffect, useRef } from "react";
import type { ServerToClientEvent } from "@familyspeak/shared";
import { refreshAccessToken } from "../api/client.js";
import { useAuthStore } from "../store/auth.js";
import { useWsStore } from "../store/ws.js";

const MIN_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 15000;
const UNAUTHORIZED_CLOSE_CODE = 4001;

export function useWebSocket(onEvent: (event: ServerToClientEvent) => void) {
  const status = useAuthStore((state) => state.status);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectDelay = MIN_RECONNECT_DELAY_MS;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    function connect() {
      if (stopped) return;
      const token = useAuthStore.getState().accessToken;
      if (!token) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/ws?token=${token}`);

      socket.addEventListener("open", () => {
        reconnectDelay = MIN_RECONNECT_DELAY_MS;
        useWsStore.getState().setConnected(true);
        useWsStore.getState().setSend((event) => socket?.send(JSON.stringify(event)));
      });

      socket.addEventListener("message", (messageEvent) => {
        try {
          const parsed = JSON.parse(messageEvent.data) as ServerToClientEvent;
          onEventRef.current(parsed);
        } catch {
          // ignore malformed frame
        }
      });

      socket.addEventListener("close", (closeEvent) => {
        useWsStore.getState().setConnected(false);
        useWsStore.getState().setSend(null);
        if (stopped) return;

        const needsFreshToken = closeEvent.code === UNAUTHORIZED_CLOSE_CODE;
        const delay = reconnectDelay;
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);

        reconnectTimer = setTimeout(() => {
          if (!needsFreshToken) {
            connect();
            return;
          }
          refreshAccessToken().then((ok) => {
            if (ok) {
              connect();
            } else {
              useAuthStore.getState().clear();
            }
          });
        }, delay);
      });
    }

    connect();

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      if (socket && socket.readyState === WebSocket.OPEN) return;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectDelay = MIN_RECONNECT_DELAY_MS;
      connect();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      useWsStore.getState().setConnected(false);
      useWsStore.getState().setSend(null);
      socket?.close();
    };
  }, [status]);
}
