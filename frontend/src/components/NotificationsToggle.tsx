import { useState } from "react";
import { enablePushNotifications, isPushSupported } from "../lib/push.js";

export function NotificationsToggle() {
  const [status, setStatus] = useState<"idle" | "enabling" | "enabled" | "denied">(
    typeof Notification !== "undefined" && Notification.permission === "granted" ? "enabled" : "idle",
  );

  if (!isPushSupported()) return null;
  if (status === "enabled") {
    return <p className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400">🔔 Notifications activées</p>;
  }

  async function handleClick() {
    setStatus("enabling");
    const success = await enablePushNotifications().catch(() => false);
    setStatus(success ? "enabled" : "denied");
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === "enabling"}
      className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
    >
      {status === "denied" ? "🔕 Notifications refusées" : "🔔 Activer les notifications"}
    </button>
  );
}
