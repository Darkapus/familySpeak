import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { signupRequests, users } from "../../db/schema.js";
import { buildUserRow, findUserByUsername, userToDTO } from "../users/repository.js";
import type { SignupRequestDTO, UserDTO } from "@familyspeak/shared";

type SignupRequestRow = typeof signupRequests.$inferSelect;

function toDTO(row: SignupRequestRow): SignupRequestDTO {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export function findSignupRequestById(id: string): SignupRequestRow | undefined {
  return db.select().from(signupRequests).where(eq(signupRequests.id, id)).get();
}

export function findPendingSignupRequestByUsername(username: string): SignupRequestRow | undefined {
  return db
    .select()
    .from(signupRequests)
    .where(and(eq(signupRequests.username, username), eq(signupRequests.status, "pending")))
    .get();
}

export function listPendingSignupRequests(): SignupRequestDTO[] {
  return db
    .select()
    .from(signupRequests)
    .where(eq(signupRequests.status, "pending"))
    .all()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(toDTO);
}

export function createSignupRequest(input: { username: string; passwordHash: string; displayName: string }): SignupRequestDTO {
  const row: SignupRequestRow = {
    id: crypto.randomUUID(),
    username: input.username,
    passwordHash: input.passwordHash,
    displayName: input.displayName,
    status: "pending",
    createdAt: Date.now(),
    reviewedAt: null,
    reviewedBy: null,
    createdUserId: null,
  };
  db.insert(signupRequests).values(row).run();
  return toDTO(row);
}

type ApproveResult = { user: UserDTO } | { error: "not_found" | "already_reviewed" | "username_taken" };

export function approveSignupRequest(id: string, reviewerId: string): ApproveResult {
  return db.transaction((tx) => {
    const requestRow = tx.select().from(signupRequests).where(eq(signupRequests.id, id)).get();
    if (!requestRow) {
      return { error: "not_found" } as const;
    }
    if (requestRow.status !== "pending") {
      return { error: "already_reviewed" } as const;
    }
    if (findUserByUsername(requestRow.username)) {
      return { error: "username_taken" } as const;
    }

    const userRow = buildUserRow({
      username: requestRow.username,
      passwordHash: requestRow.passwordHash,
      displayName: requestRow.displayName,
      role: "child",
    });
    tx.insert(users).values(userRow).run();

    tx.update(signupRequests)
      .set({ status: "approved", reviewedAt: Date.now(), reviewedBy: reviewerId, createdUserId: userRow.id })
      .where(eq(signupRequests.id, id))
      .run();

    return { user: userToDTO(userRow) };
  });
}

type RejectResult = { request: SignupRequestDTO } | { error: "not_found" | "already_reviewed" };

export function rejectSignupRequest(id: string, reviewerId: string): RejectResult {
  const requestRow = findSignupRequestById(id);
  if (!requestRow) {
    return { error: "not_found" };
  }
  if (requestRow.status !== "pending") {
    return { error: "already_reviewed" };
  }

  db.update(signupRequests)
    .set({ status: "rejected", reviewedAt: Date.now(), reviewedBy: reviewerId })
    .where(eq(signupRequests.id, id))
    .run();

  return { request: toDTO({ ...requestRow, status: "rejected" }) };
}
