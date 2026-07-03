import { broadcastToUsers } from "../../ws/registry.js";
import { listUsersByRole } from "../users/repository.js";

export function notifyParentsOfNewSignupRequest(requestId: string): void {
  try {
    const parents = listUsersByRole("parent");
    broadcastToUsers(
      parents.map((p) => p.id),
      { type: "signup-request:new", payload: { requestId } },
    );
  } catch {
    // Best-effort : ne doit jamais faire échouer la soumission de la demande.
  }
}
