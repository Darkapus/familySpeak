import { useEffect } from "react";
import { fetchMe } from "../api/auth.js";
import { refreshAccessToken } from "../api/client.js";
import { useAuthStore } from "../store/auth.js";

const PROACTIVE_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export function useAuthBootstrap() {
  useEffect(() => {
    async function bootstrap() {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        try {
          const { user } = await fetchMe();
          if (user) {
            useAuthStore.getState().setSession(useAuthStore.getState().accessToken!, user);
            return;
          }
        } catch {
          // fall through to unauthenticated
        }
      }
      useAuthStore.getState().clear();
    }
    void bootstrap();

    function maybeRefresh() {
      if (useAuthStore.getState().status !== "authenticated") return;
      void refreshAccessToken().then((ok) => {
        if (!ok) useAuthStore.getState().clear();
      });
    }

    const interval = setInterval(maybeRefresh, PROACTIVE_REFRESH_INTERVAL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") maybeRefresh();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
