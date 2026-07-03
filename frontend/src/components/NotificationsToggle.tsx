import { useState } from "react";
import { enablePushNotifications, isPushSupported } from "../lib/push.js";

export function NotificationsToggle() {
  const [status, setStatus] = useState<"idle" | "enabling" | "enabled" | "denied">(
    typeof Notification !== "undefined" && Notification.permission === "granted" ? "enabled" : "idle",
  );

  if (!isPushSupported()) return null;
  if (status === "enabled") return <span className="text-xs text-slate-400">🔔 Notifications activées</span>;

  async function handleClick() {
    setStatus("enabling");
    const success = await enablePushNotifications().catch(() => false);
    setStatus(success ? "enabled" : "denied");
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === "enabling"}
      className="rounded-lg bg-slate-200 px-2 py-1 text-xs hover:bg-slate-300 disabled:opacity-50"
    >
      {status === "denied" ? "Notifications refusées" : "🔔 Activer notifications"}
    </button>
  );
}
