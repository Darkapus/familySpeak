import type { FastifyInstance } from "fastify";
import { createUser, findUserByUsername, findUserById, hasAnyUser, userToDTO } from "../users/repository.js";
import { hashPassword, verifyPassword } from "./password.js";
import { issueRefreshToken, findValidRefreshToken, revokeRefreshTokenById } from "./refresh-token-repository.js";
import { requireAuth } from "./guard.js";
import { env } from "../../config/env.js";

const REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_COOKIE_PATH = "/api/auth";

function setRefreshCookie(reply: import("fastify").FastifyReply, plain: string, expiresAt: number) {
  reply.setCookie(REFRESH_COOKIE_NAME, plain, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "strict",
    path: REFRESH_COOKIE_PATH,
    expires: new Date(expiresAt),
  });
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get("/setup-status", async () => {
    return { needsSetup: !hasAnyUser() };
  });

  app.post<{ Body: { username: string; password: string; displayName: string } }>(
    "/setup",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      if (hasAnyUser()) {
        return reply.code(409).send({ error: "Un compte existe déjà" });
      }

      const { username, password, displayName } = request.body ?? {};
      if (!username || !password || !displayName) {
        return reply.code(400).send({ error: "username, password et displayName requis" });
      }
      if (password.length < 8) {
        return reply.code(400).send({ error: "Le mot de passe doit contenir au moins 8 caractères" });
      }

      const passwordHash = await hashPassword(password);
      if (hasAnyUser()) {
        return reply.code(409).send({ error: "Un compte existe déjà" });
      }
      const user = createUser({ username, passwordHash, displayName, role: "parent" });

      const accessToken = app.jwt.sign({ sub: user.id, role: user.role });
      const { plain, expiresAt } = issueRefreshToken(user.id);
      setRefreshCookie(reply, plain, expiresAt);

      return reply.code(201).send({ accessToken, user });
    },
  );

  app.post<{ Body: { username: string; password: string } }>(
    "/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { username, password } = request.body ?? {};
      if (!username || !password) {
        return reply.code(400).send({ error: "username et password requis" });
      }

      const user = findUserByUsername(username);
      if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
        return reply.code(401).send({ error: "Identifiants invalides" });
      }

      const accessToken = app.jwt.sign({ sub: user.id, role: user.role });
      const { plain, expiresAt } = issueRefreshToken(user.id);
      setRefreshCookie(reply, plain, expiresAt);

      return { accessToken, user: userToDTO(user) };
    },
  );

  app.post("/refresh", async (request, reply) => {
    const cookieValue = request.cookies[REFRESH_COOKIE_NAME];
    if (!cookieValue) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const existing = findValidRefreshToken(cookieValue);
    if (!existing) {
      // Ne pas effacer le cookie ici : un appel concurrent (onglet multiple, reconnexion WS)
      // a pu légitimement faire tourner le token juste avant ; effacer casserait cette session valide.
      return reply.code(401).send({ error: "unauthorized" });
    }

    const user = findUserById(existing.userId);
    if (!user || !user.isActive) {
      revokeRefreshTokenById(existing.id);
      return reply.code(401).send({ error: "unauthorized" });
    }

    revokeRefreshTokenById(existing.id);
    const accessToken = app.jwt.sign({ sub: user.id, role: user.role });
    const { plain, expiresAt } = issueRefreshToken(user.id);
    setRefreshCookie(reply, plain, expiresAt);

    return { accessToken };
  });

  app.post("/logout", async (request, reply) => {
    const cookieValue = request.cookies[REFRESH_COOKIE_NAME];
    if (cookieValue) {
      const existing = findValidRefreshToken(cookieValue);
      if (existing) {
        revokeRefreshTokenById(existing.id);
      }
    }
    reply.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
    return reply.code(204).send();
  });

  app.get("/me", { preHandler: requireAuth }, async (request) => {
    const user = findUserById(request.user.sub);
    return { user: user ? userToDTO(user) : null };
  });
}
