import { useQuery } from "@tanstack/react-query";
import { fetchUserProfile } from "../api/users.js";
import { Avatar } from "./Avatar.js";

export function UserProfileModal({
  userId,
  displayName,
  onClose,
}: {
  userId: string;
  displayName: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["userProfile", userId],
    queryFn: () => fetchUserProfile(userId),
  });

  const profile = data?.profile.profile ?? null;
  const bullets = profile
    ? profile
        .split("\n")
        .map((line) => line.replace(/^[-•*]\s*/, "").trim())
        .filter(Boolean)
    : [];

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar id={userId} name={displayName} size="lg" />
            <h2 className="text-lg font-bold text-slate-800">{displayName}</h2>
          </div>
          <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600">
            Fermer
          </button>
        </div>

        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Ce que l'IA sait sur {displayName}
        </h3>
        {isLoading && <p className="text-sm text-slate-400">Chargement...</p>}
        {!isLoading && bullets.length === 0 && (
          <p className="text-sm text-slate-400">
            Pas encore d'information : le profil se construit au fil des discussions avec l'IA de la famille.
          </p>
        )}
        {bullets.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {bullets.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
