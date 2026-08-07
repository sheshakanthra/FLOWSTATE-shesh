import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * `users` is identity, not workspace data — it carries no workspace_id and
 * has no RLS policy. Authorization for what a user can see happens entirely
 * in the workspace-scoped repos (workspaces.ts, agents.ts), not here.
 */
export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user ?? null;
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  name: string;
}): Promise<UserRecord> {
  const [user] = await db.insert(users).values(input).returning();
  if (!user) throw new Error("user insert failed");
  return user;
}
