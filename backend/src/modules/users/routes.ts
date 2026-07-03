import type { FastifyInstance } from "fastify";
import type { UserProfileDTO } from "@familyspeak/shared";
import { requireAuth, requireRole } from "../auth/guard.js";
import { hashPassword } from "../auth/password.js";
import { revokeAllRefreshTokensForUser } from "../auth/refresh-token-repository.js";
import { createUser, findUserByUsername, findUserById, listUsers, setUserActive, userToDTO } from "./repository.js";
import { getProfile } from "../hermes/profileRepository.js";

export async function registerUserRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: requireAuth }, async () => {
    return { users: listUsers() };
  });

  app.post<{ Body: { username: string; password: string; displayName: string } }>(
    "/",
    { preHandler: requireRole("parent") },
    async (request, reply) => {
      const { username, password, displayName } = request.body ?? {};
      if (!username || !password || !displayName) {
        return reply.code(400).send({ error: "username, password et displayName requis" });
      }
      if (password.length < 8) {
        return reply.code(400).send({ error: "Le mot de passe doit contenir au moins 8 caractères" });
      }
      if (findUserByUsername(username)) {
        return reply.code(409).send({ error: "Ce nom d'utilisateur existe déjà" });
      }

      const passwordHash = await hashPassword(password);
      const user = createUser({ username, passwordHash, displayName, role: "child" });
      return reply.code(201).send({ user });
    },
  );

  app.patch<{ Params: { id: string }; Body: { isActive: boolean } }>(
    "/:id/active",
    { preHandler: requireRole("parent") },
    async (request, reply) => {
      const { id } = request.params;
      const { isActive } = request.body ?? {};
      if (typeof isActive !== "boolean") {
        return reply.code(400).send({ error: "isActive (booléen) requis" });
      }

      const user = findUserById(id);
      if (!user) {
        return reply.code(404).send({ error: "Utilisateur introuvable" });
      }
      if (user.role === "parent") {
        return reply.code(403).send({ error: "Impossible de désactiver un compte parent" });
      }

      setUserActive(id, isActive);
      if (!isActive) {
        revokeAllRefreshTokensForUser(id);
      }

      return { user: userToDTO({ ...user, isActive }) };
    },
  );

  app.get<{ Params: { id: string } }>("/:id/profile", { preHandler: requireAuth }, async (request, reply) => {
    const user = findUserById(request.params.id);
    if (!user) {
      return reply.code(404).send({ error: "Utilisateur introuvable" });
    }

    const existing = getProfile(request.params.id);
    const profile: UserProfileDTO = {
      userId: request.params.id,
      profile: existing?.profile ?? null,
      updatedAt: existing?.updatedAt ?? null,
    };
    return { profile };
  });
}
