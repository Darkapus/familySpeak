import type { FastifyInstance } from "fastify";
import { requireRole } from "../auth/guard.js";
import { hashPassword } from "../auth/password.js";
import { findUserByUsername } from "../users/repository.js";
import {
  approveSignupRequest,
  createSignupRequest,
  findPendingSignupRequestByUsername,
  listPendingSignupRequests,
  rejectSignupRequest,
} from "./repository.js";
import { notifyParentsOfNewSignupRequest } from "./notify.js";

export async function registerSignupRequestRoutes(app: FastifyInstance) {
  app.post<{ Body: { username: string; displayName: string; password: string; passwordConfirm: string } }>(
    "/",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { username, displayName, password, passwordConfirm } = request.body ?? {};
      if (!username || !displayName || !password || !passwordConfirm) {
        return reply.code(400).send({ error: "username, displayName, password et passwordConfirm requis" });
      }
      if (password !== passwordConfirm) {
        return reply.code(400).send({ error: "Les mots de passe ne correspondent pas" });
      }
      if (password.length < 8) {
        return reply.code(400).send({ error: "Le mot de passe doit contenir au moins 8 caractères" });
      }
      if (findUserByUsername(username)) {
        return reply.code(409).send({ error: "Ce nom d'utilisateur existe déjà" });
      }
      if (findPendingSignupRequestByUsername(username)) {
        return reply.code(409).send({ error: "Une demande est déjà en attente pour ce nom d'utilisateur" });
      }

      const passwordHash = await hashPassword(password);
      const signupRequest = createSignupRequest({ username, passwordHash, displayName });
      notifyParentsOfNewSignupRequest(signupRequest.id);
      return reply.code(201).send({ request: signupRequest });
    },
  );

  app.get("/", { preHandler: requireRole("parent") }, async () => {
    return { requests: listPendingSignupRequests() };
  });

  app.post<{ Params: { id: string } }>("/:id/approve", { preHandler: requireRole("parent") }, async (request, reply) => {
    const result = approveSignupRequest(request.params.id, request.user.sub);
    if ("error" in result) {
      if (result.error === "not_found") {
        return reply.code(404).send({ error: "Demande introuvable" });
      }
      if (result.error === "already_reviewed") {
        return reply.code(409).send({ error: "Cette demande a déjà été traitée" });
      }
      return reply.code(409).send({ error: "Ce nom d'utilisateur existe déjà" });
    }
    return { user: result.user };
  });

  app.post<{ Params: { id: string } }>("/:id/reject", { preHandler: requireRole("parent") }, async (request, reply) => {
    const result = rejectSignupRequest(request.params.id, request.user.sub);
    if ("error" in result) {
      if (result.error === "not_found") {
        return reply.code(404).send({ error: "Demande introuvable" });
      }
      return reply.code(409).send({ error: "Cette demande a déjà été traitée" });
    }
    return { request: result.request };
  });
}
