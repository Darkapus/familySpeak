import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "@familyspeak/shared";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ error: "unauthorized" });
  }
}

export function requireRole(role: UserRole) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await requireAuth(request, reply);
    if (reply.sent) return;
    if (request.user.role !== role) {
      reply.code(403).send({ error: "forbidden" });
    }
  };
}
