import { useEffect } from "react";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function usePwaAutoReload() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;
    function handleControllerChange() {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    }
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    let interval: ReturnType<typeof setInterval> | undefined;
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration) return;
      interval = setInterval(() => void registration.update(), UPDATE_CHECK_INTERVAL_MS);
    });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      if (interval) clearInterval(interval);
    };
  }, []);
}
