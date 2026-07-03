import { useState } from "react";

const DISMISSED_KEY = "familyspeak-ios-hint-dismissed";

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return "standalone" in window.navigator && Boolean((window.navigator as { standalone?: boolean }).standalone);
}

export function IosInstallHint() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === "1");

  if (dismissed || !isIos() || isStandalone()) {
    return null;
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-emerald-600 px-4 py-2 text-sm text-white">
      <p>
        Pour installer FamilySpeak : appuie sur <strong>Partager</strong> puis{" "}
        <strong>Sur l'écran d'accueil</strong>.
      </p>
      <button onClick={dismiss} className="shrink-0 rounded bg-emerald-700 px-2 py-1 text-xs">
        Fermer
      </button>
    </div>
  );
}
