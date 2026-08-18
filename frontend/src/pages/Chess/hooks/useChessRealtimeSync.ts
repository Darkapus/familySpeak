import { useQueryClient } from "@tanstack/react-query";
import type { ServerToClientEvent } from "@familyspeak/shared";
import { useWebSocket } from "../../../hooks/useWebSocket.js";

/** Connexion WS dédiée à l'onglet échecs (même pattern que GameCanvas.tsx : chaque page qui a
 * besoin du temps réel ouvre son propre appel useWebSocket plutôt que de dépendre de
 * RealtimeConnection, qui n'est monté que sur la page des discussions). */
export function useChessRealtimeSync(): void {
  const queryClient = useQueryClient();

  useWebSocket((event: ServerToClientEvent) => {
    switch (event.type) {
      case "chess:job-updated":
        void queryClient.invalidateQueries({ queryKey: ["chess", "games"] });
        void queryClient.invalidateQueries({ queryKey: ["chess", "game", event.payload.gameId] });
        void queryClient.invalidateQueries({ queryKey: ["chess", "analysis", event.payload.gameId] });
        if (event.payload.status === "done") {
          void queryClient.invalidateQueries({ queryKey: ["chess", "weakness-profile"] });
        }
        return;
      case "chess:import-completed":
        void queryClient.invalidateQueries({ queryKey: ["chess", "games"] });
        return;
      case "chess:lesson-ready":
        void queryClient.invalidateQueries({ queryKey: ["chess", "lessons"] });
        return;
      default:
        return;
    }
  });
}
