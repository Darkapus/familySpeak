import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "../db/client.js";
import { findUserByUsername, createUser } from "../modules/users/repository.js";
import { hashPassword } from "../modules/auth/password.js";

async function main() {
  const [username, password, displayName] = process.argv.slice(2);

  if (!username || !password || !displayName) {
    console.error("Usage: pnpm create-admin <username> <password> <displayName>");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters long.");
    process.exit(1);
  }

  migrate(db, { migrationsFolder: "./drizzle" });

  if (findUserByUsername(username)) {
    console.error(`User "${username}" already exists.`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const user = createUser({ username, passwordHash, displayName, role: "parent" });

  console.log(`Parent account created: ${user.username} (${user.id})`);
}

void main();
