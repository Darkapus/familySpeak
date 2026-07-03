import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { env } from "../../config/env.js";
import type { UserDTO, UserRole } from "@familyspeak/shared";

type UserRow = typeof users.$inferSelect;

function toDTO(row: UserRow): UserDTO {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    role: row.role,
    isActive: row.isActive,
    createdAt: row.createdAt,
    isAiAssistant: row.username === env.hermesBotUsername,
  };
}

export function findUserByUsername(username: string): UserRow | undefined {
  return db.select().from(users).where(eq(users.username, username)).get();
}

export function findUserById(id: string): UserRow | undefined {
  return db.select().from(users).where(eq(users.id, id)).get();
}

export function listUsers(): UserDTO[] {
  return db.select().from(users).all().map(toDTO);
}

export function listUsersByRole(role: UserRole): UserDTO[] {
  return db.select().from(users).where(eq(users.role, role)).all().map(toDTO);
}

export function hasAnyUser(): boolean {
  return db.select({ id: users.id }).from(users).limit(1).get() !== undefined;
}

export function buildUserRow(input: {
  username: string;
  passwordHash: string;
  displayName: string;
  role: UserRole;
}): UserRow {
  return {
    id: crypto.randomUUID(),
    username: input.username,
    passwordHash: input.passwordHash,
    displayName: input.displayName,
    avatarUrl: null,
    role: input.role,
    isActive: true,
    createdAt: Date.now(),
  };
}

export function createUser(input: {
  username: string;
  passwordHash: string;
  displayName: string;
  role: UserRole;
}): UserDTO {
  const row = buildUserRow(input);
  db.insert(users).values(row).run();
  return toDTO(row);
}

export function setUserActive(id: string, isActive: boolean): void {
  db.update(users).set({ isActive }).where(eq(users.id, id)).run();
}

export { toDTO as userToDTO };
